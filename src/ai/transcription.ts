import { hasTranscription, required } from "../config/env.js";

/**
 * Voice-note transcription is an optional bolt-on (see build notes: "build
 * the text-based flow first, bolt on voice once that's stable"). When
 * OPENAI_API_KEY isn't set, callers should skip straight to asking the
 * trader to type instead — the core pipeline never requires this module.
 */
export async function transcribeVoiceNote(audio: Buffer, mimeType: string): Promise<string> {
  if (!hasTranscription) {
    throw new Error("Voice transcription is not configured (set OPENAI_API_KEY to enable it).");
  }

  const apiKey = required("OPENAI_API_KEY");
  const form = new FormData();
  const extension = mimeType.includes("ogg") ? "ogg" : mimeType.includes("mp3") ? "mp3" : "wav";
  form.append("file", new Blob([audio], { type: mimeType }), `voice-note.${extension}`);
  form.append("model", "whisper-1");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Transcription request failed (${res.status}): ${body}`);
  }

  const json = (await res.json()) as { text: string };
  return json.text;
}
