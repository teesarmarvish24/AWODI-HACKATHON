import { createHash } from "node:crypto";
import { hasSupabase } from "../config/env.js";
import { createSupabaseClient } from "./supabaseClient.js";
import type { SupportedLanguage, Trader } from "../types.js";

/**
 * WhatsApp numbers are hashed (never stored raw) before touching any store.
 * A SHA-256 of the raw number is enough to key a returning trader's
 * onboarding state without the dataset itself being personally identifying.
 */
export function hashWhatsappNumber(rawNumber: string): string {
  return createHash("sha256").update(rawNumber.trim()).digest("hex");
}

/**
 * Location handling per the build notes: ask the trader's state/market once
 * on first contact, remember it against their hashed number, and use it for
 * every price lookup after that — no nationwide coverage needed for a demo,
 * just proof the mechanism works for the 1-2 pilot markets that are seeded.
 */
export interface TraderRepository {
  get(whatsappHash: string): Promise<Trader | null>;
  upsert(trader: Trader): Promise<void>;
}

class InMemoryTraderRepository implements TraderRepository {
  private traders = new Map<string, Trader>();

  async get(whatsappHash: string): Promise<Trader | null> {
    return this.traders.get(whatsappHash) ?? null;
  }

  async upsert(trader: Trader): Promise<void> {
    this.traders.set(trader.whatsappHash, trader);
  }
}

class SupabaseTraderRepository implements TraderRepository {
  private client = createSupabaseClient();

  async get(whatsappHash: string): Promise<Trader | null> {
    const { data, error } = await this.client
      .from("traders")
      .select("whatsapp_hash, preferred_language, market_id, state")
      .eq("whatsapp_hash", whatsappHash)
      .limit(1);
    if (error) throw error;
    if (!data || data.length === 0) return null;
    const t = data[0]!;
    return {
      whatsappHash: t.whatsapp_hash,
      preferredLanguage: t.preferred_language as SupportedLanguage,
      marketId: t.market_id ?? undefined,
      state: t.state ?? undefined,
    };
  }

  async upsert(trader: Trader): Promise<void> {
    const { error } = await this.client.from("traders").upsert(
      {
        whatsapp_hash: trader.whatsappHash,
        preferred_language: trader.preferredLanguage,
        market_id: trader.marketId ?? null,
        state: trader.state ?? null,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "whatsapp_hash" },
    );
    if (error) throw error;
  }
}

let traderRepository: TraderRepository | null = null;

export function getTraderRepository(): TraderRepository {
  if (!traderRepository) {
    traderRepository = hasSupabase ? new SupabaseTraderRepository() : new InMemoryTraderRepository();
  }
  return traderRepository;
}
