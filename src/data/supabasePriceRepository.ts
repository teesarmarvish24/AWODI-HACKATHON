import { createSupabaseClient, type SupabaseClient } from "./supabaseClient.js";
import type { PriceRepository, PriceSubmissionInput, PriceSubmissionOutcome } from "./priceRepository.js";
import type { Market, PriceEntry, Product } from "../types.js";

const CONSENSUS_COUNT = 3;
const AGREEMENT_TOLERANCE = 0.15;

/** Mirrors LocalPriceRepository's behavior against a real Postgres/Supabase project. */
export class SupabasePriceRepository implements PriceRepository {
  private client: SupabaseClient;

  constructor(client: SupabaseClient = createSupabaseClient()) {
    this.client = client;
  }

  async listMarkets(): Promise<Market[]> {
    const { data, error } = await this.client.from("markets").select("id, name, state");
    if (error) throw error;
    return data ?? [];
  }

  async listProducts(): Promise<Product[]> {
    const { data, error } = await this.client
      .from("products")
      .select("id, name, category, base_unit, aliases");
    if (error) throw error;
    return (data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      baseUnit: p.base_unit,
      aliases: p.aliases ?? [],
    }));
  }

  async findProduct(query: string): Promise<Product | null> {
    const needle = query.trim().toLowerCase();
    const { data, error } = await this.client
      .from("products")
      .select("id, name, category, base_unit, aliases")
      .or(`id.eq.${needle},name.ilike.${needle}`)
      .limit(1);
    if (error) throw error;
    if (data && data.length > 0) {
      const p = data[0]!;
      return { id: p.id, name: p.name, category: p.category, baseUnit: p.base_unit, aliases: p.aliases ?? [] };
    }

    // Fall back to a broader scan for alias/substring matches — Postgres
    // array-contains-ilike isn't a single clean query, so we do it client-side
    // against the (small) product table rather than adding a search extension.
    const all = await this.listProducts();
    return (
      all.find((p) => p.aliases.some((a) => a.toLowerCase() === needle)) ??
      all.find((p) => p.name.toLowerCase().includes(needle) || p.aliases.some((a) => a.toLowerCase().includes(needle))) ??
      null
    );
  }

  async getPriceEntry(productId: string, marketId: string, unitName: string): Promise<PriceEntry | null> {
    const { data, error } = await this.client
      .from("price_entries")
      .select("product_id, market_id, unit_name, low_price, high_price, currency, source, confidence")
      .eq("product_id", productId)
      .eq("market_id", marketId)
      .eq("unit_name", unitName)
      .order("confidence", { ascending: false })
      .limit(1);
    if (error) throw error;
    if (!data || data.length === 0) return null;
    const e = data[0]!;
    return {
      productId: e.product_id,
      marketId: e.market_id,
      unitName: e.unit_name,
      lowPrice: e.low_price,
      highPrice: e.high_price,
      currency: e.currency,
      source: e.source,
      confidence: e.confidence,
    };
  }

  async submitPrice(input: PriceSubmissionInput): Promise<PriceSubmissionOutcome> {
    const { error: insertError } = await this.client.from("price_submissions").insert({
      product_id: input.productId,
      market_id: input.marketId,
      unit_name: input.unitName,
      submitted_price: input.submittedPrice,
      whatsapp_hash: input.whatsappHash,
      status: "pending",
    });
    if (insertError) throw insertError;

    const { data: agreeing, error: fetchError } = await this.client
      .from("price_submissions")
      .select("id, submitted_price")
      .eq("product_id", input.productId)
      .eq("market_id", input.marketId)
      .eq("unit_name", input.unitName)
      .eq("status", "pending");
    if (fetchError) throw fetchError;

    const rows = agreeing ?? [];
    if (rows.length < CONSENSUS_COUNT) {
      return { status: "pending" };
    }

    const prices = rows.map((r) => r.submitted_price as number).sort((a, b) => a - b);
    const median = prices[Math.floor(prices.length / 2)]!;
    const spreadOk = prices.every((p) => Math.abs(p - median) / median <= AGREEMENT_TOLERANCE);
    if (!spreadOk) {
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
      confidence: Math.min(0.9, 0.6 + rows.length * 0.05),
    };

    const { error: upsertError } = await this.client.from("price_entries").upsert(
      {
        product_id: updated.productId,
        market_id: updated.marketId,
        unit_name: updated.unitName,
        low_price: updated.lowPrice,
        high_price: updated.highPrice,
        currency: updated.currency,
        source: updated.source,
        confidence: updated.confidence,
      },
      { onConflict: "product_id,market_id,unit_name,source" },
    );
    if (upsertError) throw upsertError;

    const ids = rows.map((r) => r.id);
    const { error: updateStatusError } = await this.client
      .from("price_submissions")
      .update({ status: "accepted" })
      .in("id", ids);
    if (updateStatusError) throw updateStatusError;

    return { status: "accepted", updatedEntry: updated };
  }
}
