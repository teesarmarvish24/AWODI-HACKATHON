import { env, hasYarnGpt } from "../config/env.js";

/**
 * Voice replies via YarnGPT — a Nigerian-built, open-source TTS model
 * (Nigerian-accented English, plus Yoruba/Igbo/Hausa in YarnGPT2) — so a
 * reply can come back as a WhatsApp voice note in a natural Nigerian voice
 * instead of a robotic generic TTS accent. Per the build notes, this is a
 * bolt-on over the stable text pipeline, not a blocking dependency: the
 * text -> LLM -> reply flow works completely without it, and this module
 * calls out to a hosted Hugging Face Inference Endpoint rather than
 * self-hosting the model, to avoid burning a week's build budget on model
 * hosting.
 */
export async function synthesizeVoiceReply(text: string): Promise<Buffer> {
  if (!hasYarnGpt) {
    throw new Error(
      "YarnGPT is not configured (set YARNGPT_HF_ENDPOINT_URL and YARNGPT_HF_API_TOKEN to enable voice replies).",
    );
  }

  const res = await fetch(env.yarnGptEndpointUrl!, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.yarnGptApiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ inputs: text }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`YarnGPT request failed (${res.status}): ${body}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
