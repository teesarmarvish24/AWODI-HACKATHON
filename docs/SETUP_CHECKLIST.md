# Setup checklist — what you need to do

The codebase is complete and runs the full pricing/scam-detection pipeline offline with **zero accounts**. Everything below is only needed to light up specific features. Do them in this order — each is additive and independent.

## 1. Required for any real AI behavior (~5 min, $0)

Pick **one** of these — the app auto-detects whichever key is set (Anthropic wins if both are).

**Option A — Gemini (free, no credit card, recommended if you have no budget):**
- [ ] Go to https://aistudio.google.com/apikey, sign in with a Google account, click "Create API key". No billing setup required to use the free tier.
- [ ] `cp .env.example .env`
- [ ] Paste the key into `GEMINI_API_KEY=` in `.env`

**Option B — Anthropic (requires a small prepaid credit balance):**
- [ ] Create an account and get an API key: https://console.anthropic.com
- [ ] `cp .env.example .env`
- [ ] Paste the key into `ANTHROPIC_API_KEY=` in `.env`

**Either way, then:**
- [ ] Run `npm install && npm run demo` and try:
  ```
  Mile 12
  Someone wan sell me 1 paint rubber of tomato for 6000
  ```
  You should get a natural-language reply flagging the price as above the fair range. The startup banner tells you which provider is active.

Without either key, the app still runs (`npm run demo` works, all tests pass) using a small rule-based fallback — good for development, **not** what you want for the live judging demo, since it won't have real multilingual fluency.

## 2. Recommended before judging day (~15 min)

- [ ] **Rehearse the CLI demo** (`npm run demo`) a few times with your actual pitch script — see `docs/DEMO_SCRIPT.md`. This is your fallback if live WhatsApp/network access is flaky during judging, and it exercises the exact same pipeline.
- [ ] Read `docs/QA_PREP.md` and `docs/PITCH.md` — these match what group members already pushed back on, so the answers are pre-loaded.
- [ ] Skim `data/seed/priceEntries.json` and `data/seed/unitConversions.json` so you know which item/market/unit combos are guaranteed to work live (currently: tomato, tatashe pepper, onion, local rice, garri, beans, fuel, ankara fabric — at Mile 12 and/or Balogun).

## 3. Optional: live WhatsApp channel via Twilio (~15-20 min)

Only needed if you want judges to message a real WhatsApp number instead of watching the CLI demo.

- [ ] Sign up for Twilio (free trial is enough for a sandbox): https://www.twilio.com/try-twilio
- [ ] Activate the WhatsApp Sandbox: Twilio Console → Messaging → Try it out → Send a WhatsApp message. It gives you a sandbox number and a join code.
- [ ] Copy your Account SID and Auth Token from the Twilio Console into `.env` (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`). Leave `TWILIO_WHATSAPP_FROM` as the sandbox default (`whatsapp:+14155238886`) unless Twilio gave you a different sandbox number.
- [ ] Run `npm run dev` (starts the server on port 3000).
- [ ] Expose it publicly for Twilio to reach, e.g. `npx ngrok http 3000` (or any tunnel tool you prefer).
- [ ] In the Twilio Console's WhatsApp Sandbox settings, set "WHEN A MESSAGE COMES IN" to `https://<your-tunnel-domain>/webhooks/whatsapp` (POST).
- [ ] From your own phone, WhatsApp the Twilio sandbox number the join code shown in the console, then send a test message like "Mile 12".

**Caveat to know going in:** Twilio's sandbox requires each phone that messages it to first send the join code — fine for you and a couple of judges testing live, but expect to explain that step out loud during the demo.

## 4. Optional: a real database instead of the seed dataset (~15 min)

Only needed if you want price data (and the crowdsourced-correction loop) to persist across restarts / be shared across multiple deployments, rather than living in the bundled JSON files.

- [ ] Create a free Supabase project: https://supabase.com
- [ ] In the Supabase SQL editor, run the contents of `db/schema.sql`.
- [ ] Copy your project URL and service-role key into `.env` (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`). Both must be set — the app falls back to the local dataset if either is missing.
- [ ] Run `npm run seed:supabase` to load the same seed dataset the local JSON fallback uses (`scripts/seedSupabase.ts`) into your new tables.

## 5. Optional: voice input (~5 min, requires a prepaid OpenAI balance)

Unlike the Gemini option above, there's no free tier for Whisper — skip this one entirely if you're on zero budget. It's a genuine bolt-on: the text and photo paths work fully without it.

- [ ] Get an OpenAI API key: https://platform.openai.com
- [ ] Set `OPENAI_API_KEY` in `.env`. Voice notes sent to the Twilio webhook will now be transcribed automatically before hitting the pipeline.

## 6. Optional: voice replies via YarnGPT (~15-20 min, do last)

- [ ] Deploy YarnGPT as a Hugging Face Inference Endpoint (don't self-host — see model card: https://huggingface.co/saheedniyi/YarnGPT). This requires a Hugging Face account and (for a always-on endpoint) a paid plan — a serverless/on-demand endpoint is enough for demo purposes.
- [ ] Set `YARNGPT_HF_ENDPOINT_URL` and `YARNGPT_HF_API_TOKEN` in `.env`.
- [ ] Run `npm run demo` again — replies will now also save a `.wav` voice note into `.demo-output/`.
- [ ] **Not required for the live WhatsApp channel to work** — see the caveat in the main README's Status section about why voice *replies* over WhatsApp specifically need one more piece (public-URL media hosting) that's documented but intentionally not built, per the "bolt this on last, don't let it block the core demo" build plan.

---

## Fastest path to a working demo right now

If you only do one thing: get a **free** Gemini API key (step 1, option A) and run `npm run demo`. Everything else is additive polish.
