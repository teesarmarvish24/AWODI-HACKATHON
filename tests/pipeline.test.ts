import { describe, expect, it } from "vitest";
import { runPipeline } from "../src/domain/pipeline.js";

// These tests run without ANTHROPIC_API_KEY set, so the pipeline exercises
// its deterministic offline fallback (src/ai/offlineFallback.ts) for
// language understanding — this keeps the suite free, fast, and network-
// independent while still covering every branch of the pipeline's control
// flow (the part that matters: unit conversion, price lookup, scam math).

describe("runPipeline", () => {
  it("asks for clarification when no product can be identified", async () => {
    const result = await runPipeline("hello good morning", "mile-12");
    expect(result.kind).toBe("clarify");
    expect(result.intent?.clarificationReason).toBe("unknown_product");
  });

  it("asks for clarification when the product is known but no unit was given", async () => {
    const result = await runPipeline("how much be tomato", "mile-12");
    expect(result.kind).toBe("clarify");
    expect(result.intent?.productId).toBe("tomato");
    expect(result.intent?.clarificationReason).toBe("unknown_unit");
  });

  it("prices a well-formed message and flags a moderately inflated quote as low risk", async () => {
    const result = await runPipeline(
      "Someone wan sell me 1 paint rubber of tomato for 6000",
      "mile-12",
    );
    expect(result.kind).toBe("priced");
    expect(result.scam?.riskLevel).toBe("low"); // fair range is 3500-4800, 6000 is ~25% over
  });

  it("flags a price within the known fair range as no risk", async () => {
    const result = await runPipeline(
      "Someone wan sell me 1 paint rubber of tomato for 4000",
      "mile-12",
    );
    expect(result.kind).toBe("priced");
    expect(result.scam?.riskLevel).toBe("none");
  });

  it("returns no_data when there's no price entry for the resolved product/market/unit", async () => {
    const result = await runPipeline("how much be ankara for 2 yard", "mile-12");
    expect(result.kind).toBe("no_data");
  });
});
