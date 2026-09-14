import { hasTranscription, hasYarnGpt } from "../config/env.js";
import { transcribeVoiceNote } from "../ai/transcription.js";
import { describeProductPhoto } from "../ai/vision.js";
import { synthesizeVoiceReply } from "../tts/yarnGpt.js";
import { resolveTraderMarket } from "./onboarding.js";
import { runPipeline } from "./pipeline.js";
import type { InboundMessage } from "../types.js";

export interface OutboundMessage {
  replyText: string;
  replyAudio?: Buffer;
}

/**
 * The single function both channels (Twilio webhook, CLI simulator) call.
 * Normalizes whatever came in — typed text, a voice note, or a photo —
 * down to plain text, resolves the trader's market (asking once if this is
 * their first contact), runs the core pipeline, and optionally attaches a
 * YarnGPT voice note. Each input modality and the voice-out step are
 * additive: this function degrades gracefully to text-only if voice
 * transcription or TTS aren't configured, exactly per the staged build
 * order (text first, voice/photo bolted on after).
 */
export async function handleInboundMessage(input: InboundMessage): Promise<OutboundMessage> {
  const rawText = await resolveText(input);
  if (rawText === null) {
    return {
      replyText:
        "I couldn't understand that message. You can type the item and price, send a voice note, or send a photo of the product.",
    };
  }

  const onboarding = await resolveTraderMarket(input.whatsappNumber, rawText);
  if (onboarding.status === "ask") {
    return { replyText: onboarding.prompt };
  }
  if (onboarding.justResolved && onboarding.welcomeText) {
    return { replyText: onboarding.welcomeText };
  }

  const result = await runPipeline(rawText, onboarding.marketId);

  let replyAudio: Buffer | undefined;
  if (hasYarnGpt) {
    try {
      replyAudio = await synthesizeVoiceReply(result.replyText);
    } catch {
      // Voice-out is additive — a TTS failure should never block the text reply.
    }
  }

  return { replyText: result.replyText, replyAudio };
}

async function resolveText(input: InboundMessage): Promise<string | null> {
  if (input.text && input.text.trim().length > 0) {
    return input.text.trim();
  }

  if (input.audioBuffer) {
    if (!hasTranscription) {
      return null;
    }
    try {
      return await transcribeVoiceNote(input.audioBuffer, input.audioMimeType ?? "audio/ogg");
    } catch {
      return null;
    }
  }

  if (input.imageBase64) {
    try {
      return await describeProductPhoto(input.imageBase64, input.imageMediaType ?? "image/jpeg");
    } catch {
      return null;
    }
  }

  return null;
}
