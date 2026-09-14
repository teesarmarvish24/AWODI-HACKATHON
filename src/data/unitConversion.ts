import { localStore } from "./localStore.js";
import type { UnitConversion } from "../types.js";

/**
 * Quantity units in Nigerian informal markets (derica, paint rubber, mudu,
 * bag sizes...) are exactly the kind of thing a generic price-checker never
 * models — they assume SI units or a fixed catalog listing. Awòdì treats
 * "what unit did they mean" as a first-class question with three outcomes:
 *
 *   1. The wording maps cleanly to a known unit for that product -> convert.
 *   2. The wording is genuinely ambiguous ("a bag" when the product has both
 *      a 50kg and 100kg bag on file) -> the pipeline must ask, not guess.
 *   3. The unit is simply not in the table yet -> same: ask, don't guess.
 *
 * Guessing wrong here is worse than asking, because a wrong conversion
 * silently produces a confidently wrong fair-price range — exactly the
 * failure mode a scam-protection tool cannot afford.
 */

// Common spellings/spacings a trader might type or a transcription might
// produce, normalized to the canonical unit_name used in unit_conversions.
const UNIT_ALIASES: Record<string, string> = {
  kg: "kg",
  kilo: "kg",
  kilogram: "kg",
  kilograms: "kg",
  litre: "litre",
  liter: "litre",
  litres: "litre",
  liters: "litre",
  yard: "yard",
  yards: "yard",
  derica: "derica",
  derika: "derica",
  "paint rubber": "paint_rubber",
  "paint-rubber": "paint_rubber",
  paintrubber: "paint_rubber",
  rubber: "paint_rubber",
  mudu: "mudu",
  keg: "keg_25l",
  "25l keg": "keg_25l",
  "50kg bag": "bag_50kg",
  "100kg bag": "bag_100kg",
  basket: "basket_medium",
  "medium basket": "basket_medium",
};

export function normalizeUnitName(raw: string): string {
  const key = raw.trim().toLowerCase();
  return UNIT_ALIASES[key] ?? key.replace(/[\s-]+/g, "_");
}

export function conversionsForProduct(productId: string): UnitConversion[] {
  return localStore.unitConversions.filter((c) => c.productId === productId);
}

export function findConversion(productId: string, rawUnitName: string): UnitConversion | null {
  const normalized = normalizeUnitName(rawUnitName);
  return (
    conversionsForProduct(productId).find((c) => c.unitName === normalized) ?? null
  );
}

/**
 * The generic word "bag" (or "basket") is ambiguous on its own for products
 * that have more than one bag size on file. This flags that case so the
 * pipeline can ask "50kg or 100kg bag?" instead of silently picking one.
 */
export function isAmbiguousGenericUnit(productId: string, rawUnitName: string): boolean {
  const generic = rawUnitName.trim().toLowerCase();
  if (!["bag", "basket", "sack"].includes(generic)) return false;
  return genericUnitMatches(productId, generic).length > 1;
}

function genericUnitMatches(productId: string, generic: string): UnitConversion[] {
  const prefix = generic === "sack" ? "bag" : generic;
  return conversionsForProduct(productId).filter((c) => c.unitName.startsWith(prefix));
}

/**
 * When a trader says a size-less generic word ("bag", "basket") and the
 * product happens to have exactly one matching sized unit on file, that's
 * not actually ambiguous — resolve it directly rather than asking a
 * needless clarifying question. Two or more matches is the genuinely
 * ambiguous case handled by `isAmbiguousGenericUnit` above.
 */
function resolveGenericUnit(productId: string, rawUnitName: string): UnitConversion | null {
  const generic = rawUnitName.trim().toLowerCase();
  if (!["bag", "basket", "sack"].includes(generic)) return null;
  const matches = genericUnitMatches(productId, generic);
  return matches.length === 1 ? matches[0]! : null;
}

export interface ConvertResult {
  ok: true;
  baseQuantity: number;
  unitName: string;
}
export interface ConvertFailure {
  ok: false;
  reason: "unknown_unit" | "ambiguous_unit";
  availableUnits: string[];
}

export function convertToBaseQuantity(
  productId: string,
  quantity: number,
  rawUnitName: string,
): ConvertResult | ConvertFailure {
  if (isAmbiguousGenericUnit(productId, rawUnitName)) {
    return {
      ok: false,
      reason: "ambiguous_unit",
      availableUnits: conversionsForProduct(productId).map((c) => c.unitName),
    };
  }

  const conversion = findConversion(productId, rawUnitName) ?? resolveGenericUnit(productId, rawUnitName);
  if (!conversion) {
    return {
      ok: false,
      reason: "unknown_unit",
      availableUnits: conversionsForProduct(productId).map((c) => c.unitName),
    };
  }

  return {
    ok: true,
    baseQuantity: quantity * conversion.toBaseFactor,
    unitName: conversion.unitName,
  };
}
