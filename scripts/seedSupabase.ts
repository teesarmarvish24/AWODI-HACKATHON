import { createSupabaseClient } from "../src/data/supabaseClient.js";
import { localStore } from "../src/data/localStore.js";

/**
 * Loads the bundled seed dataset (data/seed/*.json) into a real Supabase
 * project, matching db/schema.sql. Run this once after applying the schema
 * to a fresh project, if you want to start from the same "Day 1" data the
 * local JSON fallback uses instead of an empty database.
 *
 * Usage: npm run seed:supabase   (requires SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY to be set in .env)
 */
async function main() {
  const client = createSupabaseClient();

  console.log(`Seeding ${localStore.markets.length} markets...`);
  const { error: marketsError } = await client.from("markets").upsert(localStore.markets, { onConflict: "id" });
  if (marketsError) throw marketsError;

  console.log(`Seeding ${localStore.products.length} products...`);
  const { error: productsError } = await client.from("products").upsert(
    localStore.products.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      base_unit: p.baseUnit,
      aliases: p.aliases,
    })),
    { onConflict: "id" },
  );
  if (productsError) throw productsError;

  console.log(`Seeding ${localStore.unitConversions.length} unit conversions...`);
  const { error: conversionsError } = await client.from("unit_conversions").upsert(
    localStore.unitConversions.map((c) => ({
      product_id: c.productId,
      unit_name: c.unitName,
      to_base_factor: c.toBaseFactor,
      notes: c.notes ?? null,
    })),
    { onConflict: "product_id,unit_name" },
  );
  if (conversionsError) throw conversionsError;

  console.log(`Seeding ${localStore.priceEntries.length} price entries...`);
  const { error: priceEntriesError } = await client.from("price_entries").upsert(
    localStore.priceEntries.map((e) => ({
      product_id: e.productId,
      market_id: e.marketId,
      unit_name: e.unitName,
      low_price: e.lowPrice,
      high_price: e.highPrice,
      currency: e.currency,
      source: e.source,
      confidence: e.confidence,
    })),
    { onConflict: "product_id,market_id,unit_name,source" },
  );
  if (priceEntriesError) throw priceEntriesError;

  console.log("Done. Supabase now has the same seed dataset as the local JSON fallback.");
}

main().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
