import type { FairRange, ScamAssessment, ScamRiskLevel } from "../types.js";

/**
 * The core reframe from "price checker" to "scam shield": a fair-price
 * range on its own is a lookup. What Awòdì adds is judging a specific
 * quoted price against that range and naming *why* it's suspicious in
 * plain terms — the layer a catalog app doesn't have.
 *
 * Thresholds are intentionally simple (a percentage deviation from the
 * known fair range) — the honest answer when judges ask "isn't this just
 * a rule?" is yes, and the value is in surfacing that rule as protection,
 * in the trader's own language, inside the app they already use daily.
 */
const LOW_RISK_DEVIATION = 0.15; // >15% outside fair range
const HIGH_RISK_DEVIATION = 0.35; // >35% outside fair range

export function assessScamRisk(quotedPrice: number, range: FairRange): ScamAssessment {
  const { low, high } = range;

  let deviationPct: number;
  if (quotedPrice < low) {
    deviationPct = -((low - quotedPrice) / low);
  } else if (quotedPrice > high) {
    deviationPct = (quotedPrice - high) / high;
  } else {
    deviationPct = 0;
  }

  const magnitude = Math.abs(deviationPct);
  let riskLevel: ScamRiskLevel = "none";
  if (magnitude > HIGH_RISK_DEVIATION) riskLevel = "high";
  else if (magnitude > LOW_RISK_DEVIATION) riskLevel = "low";

  const explanation = buildExplanation(riskLevel, deviationPct, range);

  return { riskLevel, deviationPct, fairLow: low, fairHigh: high, explanation };
}

function buildExplanation(risk: ScamRiskLevel, deviationPct: number, range: FairRange): string {
  const rangeText = `${range.currency} ${Math.round(range.low)}–${Math.round(range.high)}`;
  if (risk === "none") {
    return `Within the known fair range for this market (${rangeText}).`;
  }

  const pct = Math.round(Math.abs(deviationPct) * 100);
  const direction = deviationPct < 0 ? "below" : "above";
  const tactic =
    deviationPct < 0
      ? "a common tactic used to rush a sale or offload something with a hidden defect"
      : "a common tactic used against buyers who don't know the local range";

  return `This price is about ${pct}% ${direction} the fair range (${rangeText}) for this market — ${tactic}.`;
}
