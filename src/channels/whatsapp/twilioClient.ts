import twilio from "twilio";
import { env, hasTwilio, required } from "../../config/env.js";

let client: ReturnType<typeof twilio> | null = null;
function getClient() {
  if (!client) client = twilio(required("TWILIO_ACCOUNT_SID"), required("TWILIO_AUTH_TOKEN"));
  return client;
}

export async function sendWhatsappText(to: string, body: string): Promise<void> {
  if (!hasTwilio) throw new Error("Twilio is not configured.");
  await getClient().messages.create({ from: env.twilioWhatsappFrom, to, body });
}

/**
 * Twilio media (voice notes, photos) is fetched from a short-lived,
 * auth-gated URL rather than being pushed in the webhook body — this
 * downloads it into a Buffer for the transcription/vision modules.
 */
export async function downloadTwilioMedia(mediaUrl: string): Promise<Buffer> {
  const accountSid = required("TWILIO_ACCOUNT_SID");
  const authToken = required("TWILIO_AUTH_TOKEN");
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  const res = await fetch(mediaUrl, { headers: { Authorization: `Basic ${auth}` } });
  if (!res.ok) {
    throw new Error(`Failed to download Twilio media (${res.status})`);
  }
  return Buffer.from(await res.arrayBuffer());
}
