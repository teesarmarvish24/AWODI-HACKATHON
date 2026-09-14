import { hasSupabase } from "../config/env.js";
import type { PriceRepository } from "./priceRepository.js";
import { LocalPriceRepository } from "./localPriceRepository.js";
import { SupabasePriceRepository } from "./supabasePriceRepository.js";

let repository: PriceRepository | null = null;

/**
 * Single entry point the rest of the app uses to get a price store.
 * Chooses Supabase when both SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are
 * set, otherwise falls back to the bundled local JSON dataset — this is
 * the switch referenced throughout the docs as "Day 1 data now, real
 * backend later, zero code changes at the call sites."
 */
export function getPriceRepository(): PriceRepository {
  if (!repository) {
    repository = hasSupabase ? new SupabasePriceRepository() : new LocalPriceRepository();
  }
  return repository;
}

export { hasSupabase };
