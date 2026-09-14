// Shared domain types. Kept in one file because almost every module touches
// most of these — the pipeline is short enough that splitting further would
// just add import noise.

export type SupportedLanguage = "en" | "pcm" | "yo" | "ha" | "ig";
// en = English, pcm = Nigerian Pidgin, yo = Yoruba, ha = Hausa, ig = Igbo

export interface Market {
  id: string;
  name: string;
  state: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  baseUnit: string;
  aliases: string[];
}

export interface UnitConversion {
  productId: string;
  unitName: string;
  toBaseFactor: number;
  notes?: string;
}

export type PriceSource = "seed" | "trader_submission" | "verified";

export interface PriceEntry {
  productId: string;
  marketId: string;
  unitName: string;
  lowPrice: number;
  highPrice: number;
  currency: string;
  source: PriceSource;
  confidence: number;
}

export interface Trader {
  whatsappHash: string;
  preferredLanguage: SupportedLanguage;
  marketId?: string;
  state?: string;
}

/**
 * What the language agent extracts from a raw trader message before any
 * price logic runs. `unitName` is left undefined when the trader's wording
 * didn't map cleanly to a known unit for that product — that's the signal
 * the pipeline uses to ask a clarifying question instead of guessing.
 */
export interface ExtractedIntent {
  productGuess: string | null;
  productId: string | null;
  quantity: number | null;
  unitName: string | null;
  quotedPrice: number | null;
  language: SupportedLanguage;
  needsClarification: boolean;
  clarificationReason?: "unknown_unit" | "unknown_product" | "ambiguous_unit" | "missing_quantity";
}

export interface FairRange {
  low: number;
  high: number;
  currency: string;
}

export type ScamRiskLevel = "none" | "low" | "high";

export interface ScamAssessment {
  riskLevel: ScamRiskLevel;
  deviationPct: number | null; // negative = below fair range, positive = above
  fairLow: number | null;
  fairHigh: number | null;
  explanation: string;
}

export interface PipelineResult {
  kind: "priced" | "clarify" | "no_data" | "error";
  replyText: string;
  language: SupportedLanguage;
  intent?: ExtractedIntent;
  scam?: ScamAssessment;
}

export interface InboundMessage {
  whatsappNumber: string;
  text?: string;
  imageBase64?: string;
  imageMediaType?: string;
  audioBuffer?: Buffer;
  audioMimeType?: string;
}
