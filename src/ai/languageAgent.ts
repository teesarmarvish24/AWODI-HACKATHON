import Anthropic from "@anthropic-ai/sdk";
import { env, hasAnthropic, hasGemini, required } from "../config/env.js";
import { EXTRACTION_SYSTEM_PROMPT, buildClarificationSystemPrompt, buildReplySystemPrompt } from "./promptTemplates.js";
import type { ExtractedIntent, ScamAssessment, SupportedLanguage } from "../types.js";
import { extractIntentOffline } from "./offlineFallback.js";
import { composeTextGemini, extractIntentGemini } from "./geminiClient.js";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: required("ANTHROPIC_API_KEY") });
  return client;
}

const INTENT_TOOL: Anthropic.Tool = {
  name: "record_intent",
  description: "Records the structured facts extracted from a trader's message.",
  input_schema: {
    type: "object",
    properties: {
      productGuess: { type: ["string", "null"], description: "Plain-English item name, or null." },
      quantity: { type: ["number", "null"], description: "Numeric quantity mentioned, or null." },
      unitName: { type: ["string", "null"], description: "Unit of measure verbatim, lowercased, or null." },
      quotedPrice: { type: ["number", "null"], description: "Price in Naira mentioned, or null." },
      language: { type: "string", enum: ["en", "pcm", "yo", "ha", "ig"] },
    },
    required: ["productGuess", "quantity", "unitName", "quotedPrice", "language"],
  },
};

export interface RawExtraction {
  productGuess: string | null;
  quantity: number | null;
  unitName: string | null;
  quotedPrice: number | null;
  language: SupportedLanguage;
}

/**
 * Turns a raw trader message (already transcribed if it came in as voice,
 * or a vision-derived product description if it came in as a photo) into
 * structured facts.
 *
 * Provider priority: Anthropic (Claude tool-use, forcing a schema-conformant
 * result) when ANTHROPIC_API_KEY is set, otherwise Gemini (structured JSON
 * output) when GEMINI_API_KEY is set — Google AI Studio issues Gemini keys
 * free, with no credit card required, so this is the zero-cost path to a
 * fully fluent, multilingual demo. With neither key set, falls back to a
 * small deterministic extractor (offlineFallback.ts) so the pipeline's
 * plumbing and the unit-conversion/scam-detection logic can still be
 * exercised and tested without any API key at all.
 */
export async function extractIntentFromText(rawText: string): Promise<RawExtraction> {
  if (hasAnthropic) {
    const anthropic = getClient();
    const response = await anthropic.messages.create({
      model: env.anthropicModel,
      max_tokens: 512,
      system: EXTRACTION_SYSTEM_PROMPT,
      tools: [INTENT_TOOL],
      tool_choice: { type: "tool", name: "record_intent" },
      messages: [{ role: "user", content: rawText }],
    });

    const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (toolUse) return toolUse.input as RawExtraction;
    return extractIntentOffline(rawText);
  }

  if (hasGemini) {
    try {
      return await extractIntentGemini(EXTRACTION_SYSTEM_PROMPT, rawText);
    } catch {
      return extractIntentOffline(rawText);
    }
  }

  return extractIntentOffline(rawText);
}

export interface ReplyContext {
  language: SupportedLanguage;
  productName: string;
  quantity: number;
  unitName: string;
  quotedPrice: number | null;
  scam: ScamAssessment;
}

export async function composeReply(ctx: ReplyContext): Promise<string> {
  const facts = [
    `Item: ${ctx.productName}`,
    `Quantity/unit: ${ctx.quantity} ${ctx.unitName}`,
    ctx.quotedPrice !== null ? `Quoted price: NGN ${ctx.quotedPrice}` : "Quoted price: not given",
    `Fair range: NGN ${ctx.scam.fairLow}–${ctx.scam.fairHigh}`,
    `Risk level: ${ctx.scam.riskLevel}`,
    `Reason: ${ctx.scam.explanation}`,
  ].join("\n");

  return composeText(buildReplySystemPrompt(ctx.language), facts, () => offlineReply(ctx));
}

export async function composeClarification(
  language: SupportedLanguage,
  productGuess: string | null,
  availableUnits: string[],
): Promise<string> {
  const context = [
    `Product mentioned: ${productGuess ?? "unclear"}`,
    availableUnits.length > 0 ? `Known units for this product: ${availableUnits.join(", ")}` : "No known units yet for this product.",
  ].join("\n");

  return composeText(buildClarificationSystemPrompt(language), context, () =>
    offlineClarification(productGuess, availableUnits),
  );
}

/**
 * Shared provider routing for the two free-text composition steps (reply,
 * clarification) — same priority order as extractIntentFromText: Anthropic,
 * then free-tier Gemini, then the offline template as a last resort.
 */
async function composeText(systemPrompt: string, userContent: string, offline: () => string): Promise<string> {
  if (hasAnthropic) {
    const anthropic = getClient();
    const response = await anthropic.messages.create({
      model: env.anthropicModel,
      max_tokens: 400,
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
    });
    return extractText(response);
  }

  if (hasGemini) {
    try {
      return await composeTextGemini(systemPrompt, userContent);
    } catch {
      return offline();
    }
  }

  return offline();
}

function extractText(response: Anthropic.Message): string {
  const block = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  return block?.text.trim() ?? "";
}

function offlineReply(ctx: ReplyContext): string {
  const range = `₦${ctx.scam.fairLow}–₦${ctx.scam.fairHigh}`;
  if (ctx.scam.riskLevel === "none") {
    return `${ctx.productName} (${ctx.quantity} ${ctx.unitName}): fair range is ${range}. ${ctx.quotedPrice !== null ? "Your quoted price is within range — good deal." : ""}`;
  }
  return `${ctx.productName} (${ctx.quantity} ${ctx.unitName}): fair range is ${range}. ${ctx.scam.explanation} Consider countering closer to the middle of the range before agreeing.`;
}

function offlineClarification(productGuess: string | null, availableUnits: string[]): string {
  const item = productGuess ?? "that item";
  if (availableUnits.length > 0) {
    return `Which unit do you mean for ${item} — ${availableUnits.join(", ")}?`;
  }
  return `Can you tell me the quantity and unit for ${item} (e.g. per kg, per derica, per bag)?`;
}

export function toExtractedIntent(
  raw: RawExtraction,
  resolvedProductId: string | null,
  needsClarification: boolean,
  clarificationReason?: ExtractedIntent["clarificationReason"],
): ExtractedIntent {
  return {
    productGuess: raw.productGuess,
    productId: resolvedProductId,
    quantity: raw.quantity,
    unitName: raw.unitName,
    quotedPrice: raw.quotedPrice,
    language: raw.language,
    needsClarification,
    clarificationReason,
  };
}
