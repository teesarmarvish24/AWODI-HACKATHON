# Anticipated judge Q&A

Answers here match what's actually implemented in this repo — point to the file when a judge wants to see it, not just hear it.

---

### "There are price checker apps already — how is this different?"

Reframe before answering: this isn't a price-checker with extra features, it's solving a different problem for a different user.

1. **Most existing price checkers are catalog/comparison tools** — you search a product, they show listed prices from vendors or marketplaces. They assume the data is already digitized. Awòdì is built for the **informal, undigitized market** — someone haggling over tomatoes at Mile 12 with no listed price anywhere, where the "price" only exists as word-of-mouth and negotiation.
2. **The core feature isn't the price, it's the scam-risk flag and reasoning.** A price checker tells you a number. Awòdì tells you *"this offer is manipulative, and here's why"* plus how to respond — a judgment layer, not a lookup. See `src/domain/scamDetector.ts`.
3. **Input format is the differentiator, not just the output.** Voice notes in Pidgin/Yoruba/Hausa, or a photo with no typing at all, aimed at users who may not comfortably use a typed-search app in the first place.

**Memorable line:** *"A price checker tells you the number. Awòdì tells you when someone's using that number against you."*

**If pushed further — "isn't scam detection just a rule (price is X% off)?"** — be honest: yes, the detection threshold itself is simple percentage-deviation math (`src/domain/scamDetector.ts`, ~15%/35% thresholds). The value is in *packaging that as protection*, in the trader's own language, inside the app they already use daily. Judges reward the insight and delivery as much as algorithmic complexity, especially for a "solve local" brief.

**The real test:** would a plain price-comparison app on its own have caught the *why*, explained it in Yoruba, and told the person what to say back? If not, it's not the same category of tool — it just looks up the same data.

---

### "Where is this market price data coming from?"

Honest answer: at hackathon stage, it's **seeded "Day 1" data** — hand-collected price ranges for 8 high-frequency items (tomato, pepper, onion, rice, garri, beans, fuel, ankara fabric) across 2 pilot markets (Mile 12, Balogun), in `data/seed/priceEntries.json`.

Frame this to judges as a **deliberate launch strategy, not a limitation**: the real product grows this via **trader-submitted prices** — every time someone uses the bot, they can confirm or correct a price, which feeds the dataset. This is implemented, not just described: `submitPrice()` in `src/data/priceRepository.ts` collects submissions and only promotes a correction into the live fair-price range once **3 independent traders agree within 15%** of each other — the same crowdsourcing loop Waze uses for traffic data, and a guard against one bad actor poisoning the dataset alone.

---

### "Prices differ by location — how do you handle that?"

Solved with a simple onboarding step (`src/domain/onboarding.ts`): the bot asks the trader's market once on first contact ("Mile 12" or "Balogun"), remembers it against a *hashed* WhatsApp number (never stored raw — see `src/data/traderRepository.ts`), and tags every price lookup with that market. The schema (`db/schema.sql`) ties every price to a `(product, market, unit)` triple, never a bare number. The MVP only needs the 2 seeded pilot markets to prove the mechanism — nationwide coverage is a roadmap item, not a demo requirement.

---

### "What about quantity — rice in cups, paint rubbers, bags? Prices aren't per-kg."

This is a real, well-known problem in Nigerian markets, and it's handled directly rather than assumed away:

- A **unit-conversion reference table** per product (`data/seed/unitConversions.json`) — e.g. 1 derica of rice ≈ 1.5kg, 1 paint rubber of tomato ≈ 4kg — lets `src/domain/fairPrice.ts` normalize any known price to a ₦-per-base-unit rate and scale it back up to whatever quantity/unit the trader actually asked about, even when the only price on file is for a *different* unit of the same product.
- **If the system can't tell what unit was meant, it asks a clarifying question instead of guessing** (`src/data/unitConversion.ts` — see `isAmbiguousGenericUnit` / `convertToBaseQuantity`). For example, onion has both a 25kg and 50kg bag on file, so a bare "bag" triggers a clarifying question rather than a silent, possibly-wrong guess. This is covered by an automated test (`tests/unitConversion.test.ts`).

This shows the domain understanding judges are looking for, not just the tech — and it's a small feature that strengthens the pitch, because it shows the system adapting to how Nigerians actually talk, rather than forcing them into a rigid form.

---

### "Are you using YarnGPT?"

Yes — `src/tts/yarnGpt.ts`. YarnGPT is a genuinely Nigerian-built, open-source TTS model (Nigerian-accented English, with YarnGPT2 adding Yoruba/Igbo/Hausa), so a reply can come back as a WhatsApp voice note in a natural Nigerian voice instead of a robotic generic-accent TTS. That's a real originality point: *built on Nigerian AI, for Nigerian traders.*

Scoping decision, stated plainly to judges: it's called via a hosted Hugging Face Inference Endpoint rather than self-hosted, to avoid burning build time on model hosting — and it's wired as a strictly additive bolt-on over the already-stable text pipeline (`src/domain/messageHandler.ts`: a TTS failure never blocks the text reply). Voice-note *replies* over the live WhatsApp channel need one more piece of plumbing this repo documents but doesn't wire up (Twilio requires outbound media at a public URL) — the CLI demo already plays synthesized voice replies locally, so the capability is fully demonstrable without that step.

---

### "Why WhatsApp and not a native app?"

Because the target user already lives there. Asking "can a woman selling pepper at a roadside stall, on a WhatsApp-only phone, use a price-comparison app?" is itself the answer — she can't, but she's already texting and sending voice notes on WhatsApp today. Building a native app would mean solving distribution and onboarding from zero; building on WhatsApp means zero download, zero new habit to form.

---

### "How would this actually make money / survive past the hackathon?"

Not the pitch's centerpiece, but a credible answer: the crowdsourced price dataset itself is a durable asset (aggregated local market pricing is valuable to lenders, FMCG distributors, and agri-supply chains beyond the trader-facing bot), and a freemium model (basic checks free, higher-volume or multi-market access for small business owners) is a natural fit for a WhatsApp-native tool with no app-store distribution cost.
