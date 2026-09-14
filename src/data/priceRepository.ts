import type { Market, PriceEntry, PriceSource, Product } from "../types.js";

export interface PriceSubmissionInput {
  productId: string;
  marketId: string;
  unitName: string;
  submittedPrice: number;
  whatsappHash: string;
}

export interface PriceSubmissionOutcome {
  status: "accepted" | "pending";
  /** Populated when status === "accepted": the entry as it now stands. */
  updatedEntry?: PriceEntry;
}

/**
 * Storage-agnostic contract for the price data layer. `LocalPriceRepository`
 * (data/seed/*.json, in-memory) and `SupabasePriceRepository` (Postgres)
 * both implement this, so the rest of the app — the pipeline, the CLI demo,
 * the Twilio webhook — never knows or cares which one is active. Swapping
 * the backing store is a one-line change in `data/index.ts`.
 */
export interface PriceRepository {
  listMarkets(): Promise<Market[]>;
  findProduct(productIdOrAliasOrName: string): Promise<Product | null>;
  listProducts(): Promise<Product[]>;
  getPriceEntry(productId: string, marketId: string, unitName: string): Promise<PriceEntry | null>;

  /**
   * Records a trader's confirm/correct signal on a quoted price. This is
   * the crowdsourcing loop described in the pitch: the seeded launch data
   * is framed to judges as "Day 1" data, and every real conversation feeds
   * this method, the same way Waze improves from driver reports rather
   * than a maintained catalog.
   */
  submitPrice(input: PriceSubmissionInput): Promise<PriceSubmissionOutcome>;
}

export const PRICE_SOURCE_WEIGHT: Record<PriceSource, number> = {
  seed: 0.5,
  trader_submission: 0.75,
  verified: 1,
};
