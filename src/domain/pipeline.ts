import { getPriceRepository } from "../data/index.js";
import { conversionsForProduct, convertToBaseQuantity } from "../data/unitConversion.js";
import { computeFairRangeForQuantity } from "./fairPrice.js";
import { assessScamRisk } from "./scamDetector.js";
import { composeClarification, composeReply, extractIntentFromText, toExtractedIntent } from "../ai/languageAgent.js";
import type { PipelineResult, SupportedLanguage } from "../types.js";

/**
 * The single orchestration point every channel (Twilio webhook, CLI demo)
 * calls into. Keeping this channel-agnostic — it only knows about text in,
 * PipelineResult out — is what let the text flow ship first and voice/photo
 * bolt on afterwards without ever touching this function's internals: the
 * webhook and CLI layers are responsible for turning a voice note or photo
 * into text (via transcription.ts / vision.ts) *before* calling this.
 *
 * Deliberately kept deterministic where it matters: the LLM's job is
 * understanding messy multilingual input and phrasing the final reply. The
 * price math and the scam-risk threshold are plain arithmetic in
 * fairPrice.ts / scamDetector.ts — auditable, testable, and never
 * hallucinated.
 */
export async function runPipeline(rawText: string, marketId: string): Promise<PipelineResult> {
  const repo = getPriceRepository();
  const raw = await extractIntentFromText(rawText);
  const language: SupportedLanguage = raw.language;

  if (!raw.productGuess) {
    const intent = toExtractedIntent(raw, null, true, "unknown_product");
    return {
      kind: "clarify",
      replyText: await composeClarification(language, null, []),
      language,
      intent,
    };
  }

  const product = await repo.findProduct(raw.productGuess);
  if (!product) {
    const intent = toExtractedIntent(raw, null, true, "unknown_product");
    return {
      kind: "clarify",
      replyText: await composeClarification(language, raw.productGuess, []),
      language,
      intent,
    };
  }

  if (!raw.unitName) {
    const knownUnits = conversionsForProduct(product.id).map((c) => c.unitName);
    const intent = toExtractedIntent(raw, product.id, true, "unknown_unit");
    return {
      kind: "clarify",
      replyText: await composeClarification(language, product.name, knownUnits),
      language,
      intent,
    };
  }

  const quantity = raw.quantity ?? 1;
  const conversion = convertToBaseQuantity(product.id, quantity, raw.unitName);

  if (!conversion.ok) {
    const reason = conversion.reason === "ambiguous_unit" ? "ambiguous_unit" : "unknown_unit";
    const intent = toExtractedIntent(raw, product.id, true, reason);
    return {
      kind: "clarify",
      replyText: await composeClarification(language, product.name, conversion.availableUnits),
      language,
      intent,
    };
  }

  const fairRange = await computeFairRangeForQuantity(product.id, marketId, quantity, raw.unitName);
  if (!fairRange.ok) {
    const intent = toExtractedIntent(raw, product.id, false);
    return {
      kind: "no_data",
      replyText:
        language === "pcm"
          ? `I no get price data for ${product.name} for this market yet. As soon as more traders use Awòdì here, I go fit help with this.`
          : `I don't have price data for ${product.name} in this market yet — as more traders use Awòdì here, this will improve.`,
      language,
      intent,
    };
  }

  const quotedPrice = raw.quotedPrice;
  const scam = assessScamRisk(quotedPrice ?? (fairRange.fairLowTotal + fairRange.fairHighTotal) / 2, {
    low: fairRange.fairLowTotal,
    high: fairRange.fairHighTotal,
    currency: fairRange.currency,
  });

  const intent = toExtractedIntent(raw, product.id, false);
  const replyText = await composeReply({
    language,
    productName: product.name,
    quantity,
    unitName: conversion.unitName,
    quotedPrice,
    scam,
  });

  return { kind: "priced", replyText, language, intent, scam };
}
