import { createInterface } from "node:readline/promises";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { hasSupabase, hasTranscription, hasYarnGpt, env } from "../config/env.js";
import { handleInboundMessage } from "../domain/messageHandler.js";

/**
 * A WhatsApp-free chat simulator that exercises the exact same
 * `handleInboundMessage` pipeline the Twilio webhook uses. This exists so
 * the whole build — onboarding, price lookup, unit conversion, scam
 * detection, localized replies, even voice-out — is demoable live without
 * depending on a Twilio WhatsApp Sandbox connection, a phone, or network
 * conditions during judging. It's also the fastest way to iterate on the
 * pipeline during development.
 *
 * Usage: `npm run demo`
 * Type as a trader would on WhatsApp. Use `/number <digits>` to simulate a
 * different trader (resets onboarding state for that session), and `/exit`
 * to quit.
 */

const OUTPUT_DIR = path.join(process.cwd(), ".demo-output");

async function main() {
  console.log("─".repeat(60));
  console.log("Awòdì — local WhatsApp simulator (no Twilio required)");
  console.log("─".repeat(60));
  console.log(`LLM (Anthropic):   ${env.anthropicApiKey ? "configured" : "not set — running offline fallback"}`);
  console.log(`Price data:        ${hasSupabase ? "Supabase" : "local seed dataset"}`);
  console.log(`Voice input (STT): ${hasTranscription ? "enabled" : "disabled (text/photo only)"}`);
  console.log(`Voice output (TTS):${hasYarnGpt ? " enabled (YarnGPT)" : " disabled"}`);
  console.log("─".repeat(60));
  console.log('Type a trader message, e.g.:');
  console.log('  "Mile 12" (to set your market on first message)');
  console.log('  "Someone wan sell me one paint rubber of tomato for 6000"');
  console.log("Commands: /number <digits>  /exit");
  console.log("─".repeat(60));

  let whatsappNumber = "+2348000000001";
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  // Deliberately a `for await...of` async iterator rather than a loop of
  // `rl.question()` calls: when stdin is piped (non-interactive — e.g. a
  // scripted demo or `echo "..." | npm run demo`), readline can emit 'line'
  // events for buffered input before a fresh `question()` call has attached
  // its listener, silently dropping lines. The async iterator queues lines
  // properly either way, so this works identically whether a human is
  // typing live or a transcript is being piped in for a rehearsal.
  process.stdout.write(`[${whatsappNumber}] you> `);
  for await (const rawLine of rl) {
    const line = rawLine.trim();
    if (!line) {
      process.stdout.write(`[${whatsappNumber}] you> `);
      continue;
    }

    if (line === "/exit") break;
    if (line.startsWith("/number ")) {
      whatsappNumber = line.slice("/number ".length).trim();
      console.log(`(switched to simulated trader ${whatsappNumber})`);
      process.stdout.write(`[${whatsappNumber}] you> `);
      continue;
    }

    try {
      const outbound = await handleInboundMessage({ whatsappNumber, text: line });
      console.log(`awòdì> ${outbound.replyText}`);

      if (outbound.replyAudio) {
        await mkdir(OUTPUT_DIR, { recursive: true });
        const file = path.join(OUTPUT_DIR, `reply-${Date.now()}.wav`);
        await writeFile(file, outbound.replyAudio);
        console.log(`        🔊 voice reply saved to ${file}`);
      }
    } catch (err) {
      console.error("Pipeline error:", err instanceof Error ? err.message : err);
    }

    process.stdout.write(`[${whatsappNumber}] you> `);
  }

  rl.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
