import { localStore } from "../data/localStore.js";
import type { RawExtraction } from "./languageAgent.js";
import type { SupportedLanguage } from "../types.js";

/**
 * A deliberately simple regex-based extractor used only when no
 * ANTHROPIC_API_KEY is configured. It exists so the rest of the pipeline
 * (unit conversion, scam-risk math, the repository layer) can be developed
 * and unit-tested without an API key or network access — it is not meant
 * to handle the full range of Pidgin/Yoruba/Hausa/Igbo phrasing the real
 * Claude-backed extractor does.
 */
export function extractIntentOffline(rawText: string): RawExtraction {
  const text = rawText.toLowerCase();

  const priceMatch = text.match(/(?:₦|ngn|naira)?\s*([\d,]{3,})(?:\s*(?:naira|ngn))?/);
  const quotedPrice = priceMatch ? Number(priceMatch[1]!.replace(/,/g, "")) : null;

  const UNIT_PATTERN = /(kg|litre|liter|yard|derica|mudu|bag|basket|paint\s?rubber|keg)/;
  const qtyAndUnitMatch = text.match(
    new RegExp(`\\b(\\d+(?:\\.\\d+)?)\\s*${UNIT_PATTERN.source}\\b`),
  );

  let quantity: number | null = null;
  let unitName: string | null = null;
  if (qtyAndUnitMatch) {
    quantity = Number(qtyAndUnitMatch[1]);
    unitName = qtyAndUnitMatch[2]!.replace(/\s+/g, "_");
  } else {
    // No explicit number ("a paint rubber of tomato") — default to a single unit.
    const unitOnlyMatch = text.match(UNIT_PATTERN);
    if (unitOnlyMatch) {
      quantity = 1;
      unitName = unitOnlyMatch[1]!.replace(/\s+/g, "_");
    }
  }

  let productGuess: string | null = null;
  for (const product of localStore.products) {
    const names = [product.name.toLowerCase(), ...product.aliases.map((a) => a.toLowerCase())];
    if (names.some((n) => text.includes(n))) {
      productGuess = product.name;
      break;
    }
  }

  return {
    productGuess,
    quantity,
    unitName,
    quotedPrice,
    language: detectLanguageHeuristic(text),
  };
}

function detectLanguageHeuristic(text: string): SupportedLanguage {
  if (/\b(dey|na|abeg|wetin|oga|wahala)\b/.test(text)) return "pcm";
  if (/\b(elo|owo|nau|ile|bawo)\b/.test(text)) return "yo";
  if (/\b(nawa|kudi|nagode|yaya)\b/.test(text)) return "ha";
  if (/\b(ego|kedu|biko|nnukwu)\b/.test(text)) return "ig";
  return "en";
}
