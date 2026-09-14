import { readFileSync } from "node:fs";
import path from "node:path";
import type { Market, Product, PriceEntry, UnitConversion } from "../types.js";

// Resolved from the process working directory rather than __dirname/import.meta.url:
// this module's compiled depth under dist/ (dist/src/data/...) differs from its
// source depth (src/data/...), so a __dirname-relative path would silently break
// between `npm run dev`/`npm run demo` (run via tsx directly against src/) and
// `npm start` (run against the compiled dist/ output). All npm scripts in this
// project are documented to run from the repo root, so process.cwd() is stable.
const seedDir = path.join(process.cwd(), "data", "seed");

function loadJson<T>(file: string): T {
  const raw = readFileSync(path.join(seedDir, file), "utf-8");
  return JSON.parse(raw) as T;
}

interface RawProduct {
  id: string;
  name: string;
  category: string;
  base_unit: string;
  aliases: string[];
}

interface RawUnitConversion {
  product_id: string;
  unit_name: string;
  to_base_factor: number;
  notes?: string;
}

interface RawPriceEntry {
  product_id: string;
  market_id: string;
  unit_name: string;
  low_price: number;
  high_price: number;
  currency?: string;
  source: "seed" | "trader_submission" | "verified";
  confidence: number;
}

/**
 * The whole dataset held in memory. This is the offline fallback used when
 * SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY aren't set — it lets the entire
 * pipeline run with zero external accounts, which matters for a reliable
 * live demo. Swapping to `supabaseStore.ts` later is a drop-in change
 * because both implement the same `PriceStore` interface.
 */
class LocalStore {
  readonly markets: Market[];
  readonly products: Product[];
  readonly unitConversions: UnitConversion[];
  readonly priceEntries: PriceEntry[];

  constructor() {
    this.markets = loadJson<Market[]>("markets.json");

    this.products = loadJson<RawProduct[]>("products.json").map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      baseUnit: p.base_unit,
      aliases: p.aliases,
    }));

    this.unitConversions = loadJson<RawUnitConversion[]>("unitConversions.json").map((u) => ({
      productId: u.product_id,
      unitName: u.unit_name,
      toBaseFactor: u.to_base_factor,
      notes: u.notes,
    }));

    this.priceEntries = loadJson<RawPriceEntry[]>("priceEntries.json").map((p) => ({
      productId: p.product_id,
      marketId: p.market_id,
      unitName: p.unit_name,
      lowPrice: p.low_price,
      highPrice: p.high_price,
      currency: p.currency ?? "NGN",
      source: p.source,
      confidence: p.confidence,
    }));
  }
}

export const localStore = new LocalStore();
