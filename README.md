# Awòdì

*("Awòdì" — Yoruba for hawk: sharp-eyed, watches over the market.)*

**A WhatsApp AI assistant that gives Nigerian traders instant, localized fair-price checks and scam warnings — turning the phone they already use into a shield against exploitation in the informal market.**

Built for the IdentArk × 3MTT AI Hackathon Challenge — *"Build AI. Solve Local."*

---

## The problem

Millions of petty traders and market buyers across Nigeria — people buying in bulk from middlemen, or selling to itinerant buyers — routinely lose money to two compounding problems:

1. **They don't know the fair current price** of goods (tomatoes, pepper, rice, fabric...) in their local market.
2. **They fall for pricing scams** from unfamiliar buyers/sellers who exploit that information gap — quoting a price far outside the real range and counting on the other side not knowing better.

A price-comparison app doesn't fix this. Most existing tools assume a digitized, typed-search catalog — but the market Awòdì targets is the *informal, undigitized* one: someone haggling over tomatoes at Mile 12, where the "price" only exists as word-of-mouth and negotiation, quoted in units like *derica*, *paint rubber*, and *mudu* that no spreadsheet models cleanly.

## What Awòdì actually does

A trader sends a voice note, text, or photo on WhatsApp — no app download, no data-heavy interface, works on any phone — and gets back, in seconds, in their own language (English, Nigerian Pidgin, Yoruba, Hausa, or Igbo):

1. **Fair price range** for that item in their state/market, from aggregated local price data.
2. **Scam-risk flag** — if a quoted price is significantly outside the fair range, Awòdì warns them and explains *why* ("this price is 40% below market rate — a common tactic used to rush a sale").
3. **Negotiation tip** — a one-line, culturally natural suggestion for how to respond.

A price checker tells you the number. **Awòdì tells you when someone's using that number against you** — that judgment layer, not the lookup, is the product.

## How it works

```
WhatsApp (voice / text / photo)
        │
        ▼
 Twilio webhook  ──────────────────────────────┐
        │                                       │  or, for local demo/dev:
        ▼                                       ▼
┌───────────────────────────────────────────────────────┐
│                  messageHandler.ts                     │
│  (channel-agnostic — same path for Twilio & CLI demo)  │
└───────────────────────────────────────────────────────┘
        │
        ├─ voice note  → ai/transcription.ts   (Whisper STT, optional bolt-on)
        ├─ photo       → ai/vision.ts          (Claude vision → text description)
        └─ text/derived
                │
                ▼
   domain/onboarding.ts  — resolve trader's market (ask once, remember by hashed number)
                │
                ▼
   ai/languageAgent.ts   — Claude extracts structured intent (product, qty, unit, quoted price, language)
                │
                ▼
   data/unitConversion.ts — normalize the unit; ask a clarifying question instead of guessing if ambiguous
                │
                ▼
   domain/fairPrice.ts    — look up + normalize known prices to the requested quantity/unit
                │
                ▼
   domain/scamDetector.ts — deterministic % deviation from fair range → risk level (auditable, not LLM-guessed)
                │
                ▼
   ai/languageAgent.ts   — Claude composes the natural, localized reply from the computed facts
                │
                ▼
        tts/yarnGpt.ts  — optional: reply as a Nigerian-accented voice note (bolt-on, non-blocking)
```

**Design principle:** the LLM's job is understanding messy multilingual input and phrasing a natural reply. The price math and the scam-risk threshold are plain, auditable arithmetic — never hallucinated, always the same answer for the same numbers.

### Why this is buildable in the hackathon window

Deliberately scoped to avoid the two things that sink hackathon projects: **no custom model training, no native app.** Everything here rides on existing APIs (Claude for language/vision, Twilio for the WhatsApp channel, optional Whisper/YarnGPT for voice) plus a thin, swappable data layer — so the full pipeline (WhatsApp in → AI processing → price/scam response out) is buildable and demoable inside a one-week window, with the local JSON dataset meaning **the entire text pipeline runs and is fully testable with zero external accounts except an Anthropic API key.**

## Project structure

```
db/schema.sql              Supabase/Postgres schema (markets, products, unit_conversions,
                            price_entries, traders, price_submissions)
data/seed/*.json            Seeded "Day 1" price data for the pilot markets (Mile 12, Balogun)
src/
  config/env.ts              Central env var access + feature-flag booleans (hasSupabase, hasTwilio, ...)
  types.ts                   Shared domain types
  data/                      Storage-agnostic price/trader repositories (local JSON ⇄ Supabase, same interface)
  domain/                    Pure/deterministic business logic: unit conversion, fair-price math,
                              scam-risk scoring, onboarding, the pipeline orchestrator
  ai/                        Language understanding, vision, prompt templates — routed across
                              Claude, free-tier Gemini, or a rule-based offline fallback,
                              in that priority order, based on which API key is set
  tts/yarnGpt.ts              Optional Nigerian-accented voice-reply synthesis (YarnGPT via HF endpoint)
  channels/whatsapp/          Twilio webhook + REST client
  cli/simulate.ts             WhatsApp-free chat simulator for reliable live demos
tests/                      Vitest suite covering unit conversion, scam-risk math, and the full pipeline
docs/                       Pitch one-liner, anticipated Q&A, setup checklist, demo script
```

## Quickstart

```bash
npm install
cp .env.example .env        # fill in ANTHROPIC_API_KEY, or GEMINI_API_KEY for a free-tier option
npm run demo                # chat with Awòdì locally — no WhatsApp/Twilio needed
```

**No budget for API credits?** Set `GEMINI_API_KEY` instead of `ANTHROPIC_API_KEY` — Google AI Studio (https://aistudio.google.com/apikey) issues Gemini keys on a genuinely free tier, no credit card required. The app picks whichever provider is configured automatically (Anthropic first if both are set).

Try:

```
[you] Mile 12
[you] Someone wan sell me 1 paint rubber of tomato for 6000
```

Run the automated checks:

```bash
npm run typecheck
npm test
```

Run the real WhatsApp channel (needs a Twilio WhatsApp Sandbox + a public URL, e.g. via `ngrok http 3000`):

```bash
npm run dev
# then point the Twilio Sandbox's "when a message comes in" webhook at:
#   https://<your-tunnel>/webhooks/whatsapp
```

Full setup steps (what accounts/keys you need and where to get them) are in [`docs/SETUP_CHECKLIST.md`](docs/SETUP_CHECKLIST.md).

## Data & the "Day 1" crowdsourcing story

The seeded price data (`data/seed/`) is hand-collected launch data for two pilot markets — honestly framed as **Day 1 data, not a maintained catalog.** Every trader interaction is a chance to confirm or correct a price; `submitPrice()` in `src/data/priceRepository.ts` collects those signals and only promotes a correction into the live fair-price range once **3 independent submissions agree within 15%** — the same crowdsourcing loop Waze uses for traffic data, and a guard against one bad actor poisoning the dataset alone.

## Quantity/unit handling

Nigerian markets price in *derica*, *paint rubber*, *mudu*, 50kg/100kg bags — not a fixed catalog unit. `src/data/unitConversion.ts` normalizes these, and when a unit is ambiguous (e.g. a bare "bag" when a product has both a 25kg and 50kg bag on file — see `data/seed/unitConversions.json`) or simply unrecognized, **the system asks a clarifying question instead of guessing.** `src/domain/fairPrice.ts` then normalizes whatever price data *is* on file to a per-base-unit rate (₦/kg, ₦/litre, ₦/yard) so a fair range can be computed even when the trader asked in a different unit than the one that's priced.

## Status / scope

- ✅ Text pipeline: fully implemented, tested, and runnable offline (local dataset + rule-based fallback with no API key at all).
- ✅ Photo input: implemented via Claude vision — reuses the same text pipeline.
- ✅ Voice input: implemented via Whisper, gated behind `OPENAI_API_KEY` — additive, never blocks text.
- ✅ Voice output: implemented via YarnGPT, gated behind HF endpoint credentials — additive.
- ⚠️ Voice-note *replies* over the live WhatsApp channel need one more piece of plumbing beyond this repo: Twilio requires outbound media to be served from a public URL, so shipping voice replies to real WhatsApp users means uploading the synthesized audio to object storage (e.g. Supabase Storage) first. The CLI demo already plays/saves synthesized voice replies locally, so the feature is fully demonstrable without that step.
- 🗺️ Roadmap: nationwide market coverage (currently 2 pilot markets), more products, a lightweight admin view for reviewing pending price submissions.
