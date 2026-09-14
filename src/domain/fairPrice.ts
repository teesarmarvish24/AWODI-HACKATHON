import { getPriceRepository } from "../data/index.js";
import { conversionsForProduct, convertToBaseQuantity } from "../data/unitConversion.js";
import type { PriceEntry } from "../types.js";

export interface FairRangeResult {
  ok: true;
  fairLowTotal: number;
  fairHighTotal: number;
  basisEntry: PriceEntry;
  currency: string;
}
export interface FairRangeFailure {
  ok: false;
  reason: "no_data";
}

/**
 * Answers "what should `quantity` `unitName` of this product cost, in this
 * market, right now?" — even when the only price data on file is for a
 * *different* unit of the same product. This is the direct answer to
 * "prices differ by quantity — cups vs paints vs bags": every known price
 * is normalized to a per-base-unit rate (₦/kg, ₦/litre, ₦/yard) using the
 * same unit_conversions table the clarifying-question logic uses, then
 * scaled back up to the quantity the trader actually asked about.
 */
export async function computeFairRangeForQuantity(
  productId: string,
  marketId: string,
  quantity: number,
  unitName: string,
): Promise<FairRangeResult | FairRangeFailure> {
  const repo = getPriceRepository();
  const conversions = conversionsForProduct(productId);
  const conversionMap = new Map(conversions.map((c) => [c.unitName, c.toBaseFactor]));

  const convertedQty = convertToBaseQuantity(productId, quantity, unitName);
  if (!convertedQty.ok) {
    // The caller is expected to have already resolved the unit via the
    // clarifying-question flow before reaching here.
    return { ok: false, reason: "no_data" };
  }

  // Prefer a price entry in the trader's own unit — the tightest, most
  // direct comparison with no conversion error compounding.
  let entry = await repo.getPriceEntry(productId, marketId, convertedQty.unitName);
  let entryFactor = conversionMap.get(convertedQty.unitName);

  if (!entry) {
    // Otherwise take whichever known unit for this product+market we do
    // have data for, and normalize through the base unit.
    for (const [unit, factor] of conversionMap) {
      const candidate = await repo.getPriceEntry(productId, marketId, unit);
      if (candidate) {
        entry = candidate;
        entryFactor = factor;
        break;
      }
    }
  }

  if (!entry || entryFactor === undefined) {
    return { ok: false, reason: "no_data" };
  }

  const perBaseLow = entry.lowPrice / entryFactor;
  const perBaseHigh = entry.highPrice / entryFactor;

  return {
    ok: true,
    fairLowTotal: perBaseLow * convertedQty.baseQuantity,
    fairHighTotal: perBaseHigh * convertedQty.baseQuantity,
    basisEntry: entry,
    currency: entry.currency,
  };
}
