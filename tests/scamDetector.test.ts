import { describe, expect, it } from "vitest";
import { assessScamRisk } from "../src/domain/scamDetector.js";

const range = { low: 1000, high: 1500, currency: "NGN" };

describe("assessScamRisk", () => {
  it("returns 'none' for a price within the fair range", () => {
    const result = assessScamRisk(1250, range);
    expect(result.riskLevel).toBe("none");
    expect(result.deviationPct).toBe(0);
  });

  it("returns 'low' for a price moderately outside the range", () => {
    // 20% below the low end
    const result = assessScamRisk(800, range);
    expect(result.riskLevel).toBe("low");
    expect(result.deviationPct).toBeLessThan(0);
  });

  it("returns 'high' for a price far outside the range and explains the direction", () => {
    // 50% below the low end — a classic "rush the sale" underprice
    const result = assessScamRisk(500, range);
    expect(result.riskLevel).toBe("high");
    expect(result.explanation).toMatch(/below/);
  });

  it("flags an inflated price above the range as high risk too", () => {
    const result = assessScamRisk(2300, range); // >35% above 1500
    expect(result.riskLevel).toBe("high");
    expect(result.explanation).toMatch(/above/);
  });
});
