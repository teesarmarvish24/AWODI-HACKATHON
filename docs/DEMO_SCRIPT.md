# Live demo script

Two ways to demo, in order of reliability. Rehearse the CLI path even if you plan to demo live on WhatsApp — it's the fallback if venue Wi-Fi or Twilio's sandbox join-flow causes friction in front of judges.

## Path A — CLI simulator (recommended primary path)

No WhatsApp, no phone, no network dependency beyond the Anthropic API. Judges watch your terminal.

```bash
npm run demo
```

**Script (read the bot's replies out loud as they print):**

```
you> Mile 12
awòdì> Got it — Mile 12 Market, Lagos ✅ Now send me an item and price...

you> Someone wan sell me 1 paint rubber of tomato for 6000
awòdì> [fair range + "~25% above fair range" scam flag + negotiation tip]
```

Talking point here: *"That 6000 naira quote is real Mile 12 pricing behavior — traders get quoted 20-40% over on an unfamiliar buyer. Awòdì caught it and told her why, in one message."*

```
you> Someone wan sell me 1 paint rubber of tomato for 4000
awòdì> [within fair range — reassurance, no false alarm]
```

Talking point: *"It's not crying wolf — a fair price gets a clean pass, so traders actually trust the warnings when they come."*

**Optional — show the ambiguous-unit handling (a direct answer to "what about quantity/units?"):**

```
you> How much for a bag of onion
awòdì> [asks: 25kg or 50kg bag?]
```

**Optional — show a different language (works even on the offline fallback, but is much stronger with `ANTHROPIC_API_KEY` set):**

```
you> Won ta mi tomati fun 6000 fun paint rubber kan
```

*(Yoruba: "They want to sell me tomato for 6000 for one paint rubber")* — Claude should detect the language and reply in Yoruba.

## Path B — live WhatsApp via Twilio Sandbox

Only attempt this if you completed the Twilio setup in `docs/SETUP_CHECKLIST.md` and tested it end-to-end beforehand — don't debug sandbox join codes live in front of judges.

1. Have your phone already joined to the sandbox before your slot starts.
2. Send the same script as Path A, but as real WhatsApp messages.
3. Keep the CLI demo running in a second terminal as a silent fallback — if the webhook or tunnel misbehaves mid-demo, switch to Path A without missing a beat.

## Answering "is this real data?" live

Pull up `data/seed/priceEntries.json` on screen for 5 seconds if asked. Say the line from `docs/QA_PREP.md` directly: *"Day 1 seeded data for two pilot markets — the real product grows this from trader confirmations, the same way Waze builds traffic data from drivers, not a maintained catalog."* Then, if you want to go one level deeper, open `src/data/priceRepository.ts` and point at `submitPrice()` — it's implemented, not just described in the pitch.

## Closing line

*"A price checker tells you the number. Awòdì tells you when someone's using that number against you."*
