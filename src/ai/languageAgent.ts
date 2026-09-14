import Anthropic from "@anthropic-ai/sdk";
import { env, required } from "../config/env.js";
import { EXTRACTION_SYSTEM_PROMPT, buildClarificationSystemPrompt, buildReplySystemPrompt } from "./promptTemplates.js";
import type { ExtractedIntent, ScamAssessment, SupportedLanguage } from "../types.js";
import { extractIntentOffline } from "./offlineFallback.js";

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
 * structured facts. Uses Claude's tool-use to force a schema-conformant
 * result instead of parsing free-form JSON out of prose — cheaper to get
 * right and impossible to hallucinate extra fields into.
 *
 * Falls back to a small deterministic extractor (offlineFallback.ts) when
 * no ANTHROPIC_API_KEY is configured, so the pipeline's plumbing and the
 * unit-conversion/scam-detection logic can be exercised and tested without
 * spending API credits.
 */
export async function extractIntentFromText(rawText: string): Promise<RawExtraction> {
  if (!env.anthropicApiKey) {
    return extractIntentOffline(rawText);
  }

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
  if (!toolUse) {
    return extractIntentOffline(rawText);
  }
  return toolUse.input as RawExtraction;
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
  if (!env.anthropicApiKey) {
    return offlineReply(ctx);
  }

  const anthropic = getClient();
  const facts = [
    `Item: ${ctx.productName}`,
    `Quantity/unit: ${ctx.quantity} ${ctx.unitName}`,
    ctx.quotedPrice !== null ? `Quoted price: NGN ${ctx.quotedPrice}` : "Quoted price: not given",
    `Fair range: NGN ${ctx.scam.fairLow}–${ctx.scam.fairHigh}`,
    `Risk level: ${ctx.scam.riskLevel}`,
    `Reason: ${ctx.scam.explanation}`,
  ].join("\n");

  const response = await anthropic.messages.create({
    model: env.anthropicModel,
    max_tokens: 400,
    system: buildReplySystemPrompt(ctx.language),
    messages: [{ role: "user", content: facts }],
  });

  return extractText(response);
}

export async function composeClarification(
  language: SupportedLanguage,
  productGuess: string | null,
  availableUnits: string[],
): Promise<string> {
  if (!env.anthropicApiKey) {
    return offlineClarification(productGuess, availableUnits);
  }

  const anthropic = getClient();
  const context = [
    `Product mentioned: ${productGuess ?? "unclear"}`,
    availableUnits.length > 0 ? `Known units for this product: ${availableUnits.join(", ")}` : "No known units yet for this product.",
  ].join("\n");

  const response = await anthropic.messages.create({
    model: env.anthropicModel,
    max_tokens: 200,
    system: buildClarificationSystemPrompt(language),
    messages: [{ role: "user", content: context }],
  });

  return extractText(response);
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
