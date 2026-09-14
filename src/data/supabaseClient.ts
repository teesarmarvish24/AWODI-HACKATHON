import { createClient } from "@supabase/supabase-js";
import { required } from "../config/env.js";

export function createSupabaseClient() {
  const url = required("SUPABASE_URL");
  const key = required("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

export type SupabaseClient = ReturnType<typeof createSupabaseClient>;
