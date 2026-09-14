import { env, required } from "../config/env.js";
import type { RawExtraction } from "./languageAgent.js";

/**
 * Free-tier alternative to the Anthropic client. Google AI Studio issues
 * Gemini API keys with no credit card required (see
 * docs/SETUP_CHECKLIST.md), so this is the path for a fully-functional,
 * fluent, multilingual demo at zero cost. Implemented as a thin REST
 * wrapper (fetch, no SDK dependency) rather than the Anthropic SDK's
 * typed client — the two providers are intentionally kept as separate,
 * swappable implementations behind the same functions languageAgent.ts
 * and vision.ts call, selected automatically in config/env.ts based on
 * which API key is present.
 */

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const INTENT_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    productGuess: { type: "STRING", nullable: true },
    quantity: { type: "NUMBER", nullable: true },
    unitName: { type: "STRING", nullable: true },
    quotedPrice: { type: "NUMBER", nullable: true },
    language: { type: "STRING", enum: ["en", "pcm", "yo", "ha", "ig"] },
  },
  required: ["productGuess", "quantity", "unitName", "quotedPrice", "language"],
} as const;

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
}

async function callGemini(body: Record<string, unknown>): Promise<string> {
  const apiKey = required("GEMINI_API_KEY");
  const res = await fetch(`${API_BASE}/${env.geminiModel}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Gemini request failed (${res.status}): ${errBody}`);
  }

  const json = (await res.json()) as GeminiResponse;
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (text === undefined) {
    throw new Error("Gemini response contained no text.");
  }
  return text;
}

export async function extractIntentGemini(systemPrompt: string, rawText: string): Promise<RawExtraction> {
  const text = await callGemini({
    contents: [{ role: "user", parts: [{ text: rawText }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: INTENT_RESPONSE_SCHEMA,
    },
  });

  return JSON.parse(text) as RawExtraction;
}

export async function composeTextGemini(systemPrompt: string, userContent: string): Promise<string> {
  const text = await callGemini({
    contents: [{ role: "user", parts: [{ text: userContent }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
  });
  return text.trim();
}

export async function describeImageGemini(imageBase64: string, mediaType: string, prompt: string): Promise<string> {
  const text = await callGemini({
    contents: [
      {
        role: "user",
        parts: [{ inlineData: { mimeType: mediaType, data: imageBase64 } }, { text: prompt }],
      },
    ],
  });
  return text.trim();
}
