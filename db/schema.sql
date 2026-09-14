-- Awòdì — Supabase / Postgres schema
--
-- Design notes:
--   * Every price is tied to a (product, market, unit) triple — never a bare
--     number — because "how much is rice" is meaningless without knowing
--     which market and which measure (derica, paint rubber, 50kg bag...).
--   * `price_entries.source` distinguishes hand-seeded launch data from
--     trader-submitted corrections, so the crowdsourcing loop (see
--     price_submissions) can raise confidence over time without a
--     human ever hand-editing the table.
--   * Phone numbers are never stored in plaintext — only a salted hash —
--     so the trader-identity table is useless to anyone who dumps it.

create extension if not exists "pgcrypto";

create table if not exists markets (
  id         text primary key,          -- slug, e.g. 'mile-12'
  name       text not null,              -- e.g. 'Mile 12 Market'
  state      text not null,              -- e.g. 'Lagos'
  created_at timestamptz not null default now()
);

create table if not exists products (
  id          text primary key,          -- slug, e.g. 'tomato'
  name        text not null,             -- e.g. 'Tomato'
  category    text not null,             -- e.g. 'produce' | 'grain' | 'fuel' | 'textile'
  base_unit   text not null,             -- canonical unit for this product, e.g. 'kg', 'litre', 'yard'
  aliases     text[] not null default '{}', -- pidgin/local names an LLM extraction may surface
  created_at  timestamptz not null default now()
);

-- How many base_unit does one of `unit_name` equal for this product?
-- e.g. product='rice', unit_name='derica', to_base_factor=1.5 -> 1 derica ≈ 1.5kg
create table if not exists unit_conversions (
  id              bigserial primary key,
  product_id      text not null references products(id) on delete cascade,
  unit_name       text not null,
  to_base_factor  numeric not null check (to_base_factor > 0),
  notes           text,
  unique (product_id, unit_name)
);

create table if not exists price_entries (
  id           bigserial primary key,
  product_id   text not null references products(id) on delete cascade,
  market_id    text not null references markets(id) on delete cascade,
  unit_name    text not null,
  low_price    numeric not null check (low_price >= 0),
  high_price   numeric not null check (high_price >= low_price),
  currency     text not null default 'NGN',
  source       text not null default 'seed' check (source in ('seed', 'trader_submission', 'verified')),
  confidence   numeric not null default 0.5 check (confidence between 0 and 1),
  recorded_at  timestamptz not null default now(),
  unique (product_id, market_id, unit_name, source)
);

-- Traders are identified only by a hash of their WhatsApp number, so the
-- bot can remember a preferred market/language across sessions without
-- ever persisting a raw phone number.
create table if not exists traders (
  id                  bigserial primary key,
  whatsapp_hash       text not null unique,
  preferred_language  text not null default 'en',
  market_id           text references markets(id),
  state               text,
  created_at          timestamptz not null default now(),
  last_seen_at        timestamptz not null default now()
);

-- The crowdsourcing loop: every time a trader confirms or corrects a price
-- Awòdì quoted them, it lands here first. A submission only promotes into
-- price_entries (source='trader_submission') once it clears a simple
-- agreement threshold (see src/data/priceRepository.ts), so one bad actor
-- can't poison the dataset alone.
create table if not exists price_submissions (
  id                bigserial primary key,
  product_id        text not null references products(id) on delete cascade,
  market_id         text not null references markets(id) on delete cascade,
  unit_name         text not null,
  submitted_price   numeric not null check (submitted_price >= 0),
  whatsapp_hash     text not null,
  status            text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at        timestamptz not null default now()
);

create index if not exists idx_price_entries_lookup
  on price_entries (product_id, market_id, unit_name);

create index if not exists idx_price_submissions_pending
  on price_submissions (product_id, market_id, unit_name)
  where status = 'pending';
