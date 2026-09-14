import { describe, expect, it } from "vitest";
import {
  convertToBaseQuantity,
  isAmbiguousGenericUnit,
  normalizeUnitName,
} from "../src/data/unitConversion.js";

describe("normalizeUnitName", () => {
  it("normalizes common spelling variants to canonical unit names", () => {
    expect(normalizeUnitName("paint rubber")).toBe("paint_rubber");
    expect(normalizeUnitName("Paint-Rubber")).toBe("paint_rubber");
    expect(normalizeUnitName("derika")).toBe("derica");
    expect(normalizeUnitName("kg")).toBe("kg");
  });
});

describe("convertToBaseQuantity", () => {
  it("converts a known unit into the product's base unit", () => {
    const result = convertToBaseQuantity("tomato", 2, "paint rubber");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.baseQuantity).toBe(8); // 2 * 4kg
      expect(result.unitName).toBe("paint_rubber");
    }
  });

  it("returns unknown_unit for a unit that has no conversion entry for the product", () => {
    const result = convertToBaseQuantity("tomato", 1, "gallon");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("unknown_unit");
  });

  it("resolves a bare 'bag' unambiguously when the product has only one bag size", () => {
    expect(isAmbiguousGenericUnit("rice-local", "bag")).toBe(false);
    const result = convertToBaseQuantity("rice-local", 1, "bag");
    expect(result.ok).toBe(true); // resolves unambiguously to bag_50kg
  });

  it("flags a generic 'bag' as ambiguous when a product has multiple bag sizes (onion: 25kg and 50kg)", () => {
    expect(isAmbiguousGenericUnit("onion", "bag")).toBe(true);
    const result = convertToBaseQuantity("onion", 1, "bag");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("ambiguous_unit");
      expect(result.availableUnits).toEqual(expect.arrayContaining(["bag_25kg", "bag_50kg"]));
    }
  });

  it("asks for clarification instead of guessing when the unit is unrecognized", () => {
    const result = convertToBaseQuantity("garri", 1, "cup");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.availableUnits.length).toBeGreaterThan(0);
    }
  });
});
