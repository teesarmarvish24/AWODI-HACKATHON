import { describe, expect, it } from "vitest";
import { computeFairRangeForQuantity } from "../src/domain/fairPrice.js";

describe("computeFairRangeForQuantity", () => {
  it("scales a known price entry to the requested quantity in the same unit", async () => {
    // Seed data: tomato @ mile-12, paint_rubber, NGN 3500-4800 for 1 unit.
    const result = await computeFairRangeForQuantity("tomato", "mile-12", 2, "paint rubber");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.fairLowTotal).toBeCloseTo(7000, 5); // 2 * 3500
      expect(result.fairHighTotal).toBeCloseTo(9600, 5); // 2 * 4800
    }
  });

  it("normalizes across units when the trader asks in a different unit than the priced entry", async () => {
    // rice-local at mile-12 is priced per derica (1.5kg) — ask for a price
    // in raw kg instead and confirm it's derived via the base-unit rate.
    const derica = await computeFairRangeForQuantity("rice-local", "mile-12", 1, "derica");
    const kg = await computeFairRangeForQuantity("rice-local", "mile-12", 1.5, "kg");

    expect(derica.ok).toBe(true);
    expect(kg.ok).toBe(true);
    if (derica.ok && kg.ok) {
      // 1 derica (1.5kg) should equal the range for 1.5kg, since both
      // resolve through the same per-kg rate.
      expect(kg.fairLowTotal).toBeCloseTo(derica.fairLowTotal, 5);
      expect(kg.fairHighTotal).toBeCloseTo(derica.fairHighTotal, 5);
    }
  });

  it("returns no_data for a product/market combination with no price entries at all", async () => {
    const result = await computeFairRangeForQuantity("ankara-fabric", "mile-12", 1, "yard");
    expect(result.ok).toBe(false);
  });
});
