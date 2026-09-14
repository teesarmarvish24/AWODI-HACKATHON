# Pitch material — IdentArk × 3MTT AI Hackathon Challenge

## One-liner (for the submission form)

> *"Awòdì is a WhatsApp AI assistant that gives Nigerian traders instant, localized fair-price checks and scam warnings — turning the phone they already use into a shield against exploitation in the informal market."*

## The problem

Millions of petty traders and market women/men across Nigeria — especially those buying in bulk from middlemen or selling to itinerant buyers — routinely lose money to two things: not knowing the fair current price of goods (tomatoes, pepper, rice, fabric, electronics, etc.) in their local market, and falling for pricing scams from unfamiliar buyers/sellers who exploit that information gap. This isn't hypothetical — price volatility and information asymmetry are among the most cited reasons small trading businesses fail to grow in Nigeria's informal economy, which employs over 80% of the workforce.

## The solution

Awòdì is a WhatsApp-based AI assistant — no app download, no data-heavy interface, works on any phone. A trader sends a voice note, text, or photo of a product and gets back, in seconds, in their preferred language (English, Pidgin, Yoruba, Hausa, Igbo):

1. **Fair price range** for that item in their state/market, using aggregated local price data.
2. **Scam risk flag** — if a quoted price is significantly off from market range, Awòdì warns them and explains why (e.g. "this price is 40% below market rate — a common tactic used to rush a sale").
3. **Negotiation tip** — a one-line, culturally natural suggestion for how to respond.

## Why this wins

- **Local relevance (direct hit on judging criteria):** not an imported idea reskinned for Nigeria — it targets a problem specific to how Nigerian informal trade actually works, shaped around WhatsApp because that's where the target user already lives digitally.
- **Originality:** most submissions in this space do generic "price checker" apps. Awòdì's edge is the *scam-detection layer* — reframing the problem from "what's the price" to "am I being exploited right now," the sharper, more emotionally resonant pain point.
- **Judge-friendly demo:** a live WhatsApp exchange (or the bundled CLI simulator) is instantly understandable to any judge in 30 seconds — no dashboard, no onboarding flow to explain.
- **Built for scale, not just a demo:** because it rides on WhatsApp, there's a believable path from hackathon prototype to real usage.

## Technical overview

- **Input layer:** WhatsApp Business API via Twilio (sandbox for demo) receives text/voice/image.
- **AI core:** Claude (or Gemini as a free-tier alternative — the app auto-selects whichever API key is configured) handles language understanding, cross-language reasoning (Pidgin/Yoruba/Hausa/Igbo), and generates the scam-risk explanation and negotiation tip in natural, localized phrasing.
- **Price data layer:** a lightweight, swappable data layer (Supabase in production, a bundled seed dataset for demo/dev) covering a handful of high-frequency goods in 1-2 pilot markets (Mile 12, Balogun) — enough for a convincing demo, expandable via crowdsourced trader submissions.
- **Voice/image handling:** Whisper speech-to-text for voice notes; a vision-capable Claude call for photo-based product identification when text isn't given; YarnGPT (Nigerian-built, open-source TTS) for natural-accented voice replies.

## Feasibility by the deadline

Intentionally scoped to avoid the two things that sink hackathon projects — training custom models and building a native app. Everything uses existing APIs and a thin data layer, so the full pipeline (WhatsApp in → AI processing → price/scam response out) is buildable and demoable within a one-week window. See the repo's [`README.md`](../README.md) for the actual implementation and [`docs/DEMO_SCRIPT.md`](DEMO_SCRIPT.md) for how to run it live.
