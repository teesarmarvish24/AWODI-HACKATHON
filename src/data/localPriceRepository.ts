import { localStore } from "./localStore.js";
import type { PriceRepository, PriceSubmissionInput, PriceSubmissionOutcome } from "./priceRepository.js";
import type { Market, PriceEntry, Product } from "../types.js";

interface PendingSubmission extends PriceSubmissionInput {
  createdAt: number;
}

const CONSENSUS_COUNT = 3; // how many agreeing submissions before we trust them
const AGREEMENT_TOLERANCE = 0.15; // 15% spread allowed among agreeing submissions

/**
 * In-memory implementation backed by the seeded JSON dataset. State does
 * not persist across process restarts — that's fine for a hackathon demo
 * and local dev; a real deployment swaps this for `SupabasePriceRepository`
 * without touching any caller.
 */
export class LocalPriceRepository implements PriceRepository {
  private entries: PriceEntry[] = [...localStore.priceEntries];
  private pending: PendingSubmission[] = [];

  async listMarkets(): Promise<Market[]> {
    return localStore.markets;
  }

  async listProducts(): Promise<Product[]> {
    return localStore.products;
  }

  async findProduct(query: string): Promise<Product | null> {
    const needle = query.trim().toLowerCase();
    return (
      localStore.products.find(
        (p) =>
          p.id === needle ||
          p.name.toLowerCase() === needle ||
          p.aliases.some((a) => a.toLowerCase() === needle),
      ) ??
      localStore.products.find(
        (p) =>
          p.name.toLowerCase().includes(needle) ||
          p.aliases.some((a) => a.toLowerCase().includes(needle)),
      ) ??
      null
    );
  }

  async getPriceEntry(productId: string, marketId: string, unitName: string): Promise<PriceEntry | null> {
    return (
      this.entries.find(
        (e) => e.productId === productId && e.marketId === marketId && e.unitName === unitName,
      ) ?? null
    );
  }

  async submitPrice(input: PriceSubmissionInput): Promise<PriceSubmissionOutcome> {
    this.pending.push({ ...input, createdAt: Date.now() });

    const agreeing = this.pending.filter(
      (p) =>
        p.productId === input.productId &&
        p.marketId === input.marketId &&
        p.unitName === input.unitName,
    );

    if (agreeing.length < CONSENSUS_COUNT) {
      return { status: "pending" };
    }

    const prices = agreeing.map((p) => p.submittedPrice).sort((a, b) => a - b);
    const median = prices[Math.floor(prices.length / 2)]!;
    const spreadOk = prices.every((p) => Math.abs(p - median) / median <= AGREEMENT_TOLERANCE);

    if (!spreadOk) {
      // Traders disagree too much to trust yet — keep collecting, don't pollute the range.
      return { status: "pending" };
    }

    const updated: PriceEntry = {
      productId: input.productId,
      marketId: input.marketId,
      unitName: input.unitName,
      lowPrice: Math.min(...prices),
      highPrice: Math.max(...prices),
      currency: "NGN",
      source: "trader_submission",
      confidence: Math.min(0.9, 0.6 + agreeing.length * 0.05),
    };

    this.entries = this.entries.filter(
      (e) => !(e.productId === input.productId && e.marketId === input.marketId && e.unitName === input.unitName),
    );
    this.entries.push(updated);

    this.pending = this.pending.filter(
      (p) =>
        !(p.productId === input.productId && p.marketId === input.marketId && p.unitName === input.unitName),
    );

    return { status: "accepted", updatedEntry: updated };
  }
}
