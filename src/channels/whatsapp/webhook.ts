import type { Request, Response } from "express";
import twilio from "twilio";
import { env } from "../../config/env.js";
import { handleInboundMessage } from "../../domain/messageHandler.js";
import { downloadTwilioMedia, sendWhatsappText } from "./twilioClient.js";
import type { InboundMessage } from "../../types.js";

interface TwilioInboundBody {
  From?: string;
  Body?: string;
  NumMedia?: string;
  MediaUrl0?: string;
  MediaContentType0?: string;
}

/**
 * Verifies the request actually came from Twilio using the account auth
 * token and the X-Twilio-Signature header, so nobody can spoof inbound
 * WhatsApp messages by POSTing to this endpoint directly.
 */
function isValidTwilioRequest(req: Request): boolean {
  if (!env.twilioAuthToken) return false;
  const signature = req.header("X-Twilio-Signature");
  if (!signature) return false;

  // Twilio signs the exact public URL it called. Behind a tunnel/proxy
  // (ngrok, a PaaS load balancer) that's the forwarded host, not req.protocol.
  const proto = req.header("X-Forwarded-Proto") ?? req.protocol;
  const host = req.header("X-Forwarded-Host") ?? req.get("host");
  const fullUrl = `${proto}://${host}${req.originalUrl}`;

  return twilio.validateRequest(env.twilioAuthToken, signature, fullUrl, req.body as Record<string, string>);
}

export async function twilioWebhookHandler(req: Request, res: Response): Promise<void> {
  if (!isValidTwilioRequest(req)) {
    res.status(403).send("Invalid Twilio signature");
    return;
  }

  const body = req.body as TwilioInboundBody;
  const from = body.From;
  if (!from) {
    res.status(400).send("Missing From");
    return;
  }

  // Acknowledge immediately with empty TwiML so Twilio doesn't time out
  // while the LLM/vision/transcription calls run — the actual reply is
  // sent asynchronously via the REST API below.
  res.set("Content-Type", "text/xml");
  res.send("<Response></Response>");

  try {
    const input = await buildInboundMessage(from, body);
    const outbound = await handleInboundMessage(input);
    await sendWhatsappText(from, outbound.replyText);
    // Note: voice-note replies (outbound.replyAudio) aren't wired to this
    // channel yet — sending WhatsApp media requires the audio to be
    // reachable at a public URL first (e.g. uploaded to Supabase Storage).
    // The CLI demo (src/cli/simulate.ts) already plays/saves the audio
    // locally so the voice feature is fully demonstrable without that step.
  } catch (err) {
    console.error("Failed to handle inbound WhatsApp message:", err);
    await sendWhatsappText(from, "Sorry, something went wrong on my end — please try again in a moment.").catch(
      () => undefined,
    );
  }
}

async function buildInboundMessage(from: string, body: TwilioInboundBody): Promise<InboundMessage> {
  const numMedia = Number(body.NumMedia ?? "0");
  if (numMedia > 0 && body.MediaUrl0) {
    const mediaBuffer = await downloadTwilioMedia(body.MediaUrl0);
    const contentType = body.MediaContentType0 ?? "";

    if (contentType.startsWith("audio/")) {
      return { whatsappNumber: from, audioBuffer: mediaBuffer, audioMimeType: contentType };
    }
    if (contentType.startsWith("image/")) {
      return {
        whatsappNumber: from,
        imageBase64: mediaBuffer.toString("base64"),
        imageMediaType: contentType,
      };
    }
  }

  return { whatsappNumber: from, text: body.Body ?? "" };
}
