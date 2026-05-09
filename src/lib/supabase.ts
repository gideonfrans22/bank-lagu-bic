import { createClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabaseEnv } from "@/env";

if (!isSupabaseConfigured) {
  console.warn(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Add them to `.env`, restart dev, see README."
  );
}

/**
 * When env is missing we still construct a client with placeholder values so importing modules
 * does not crash. Routes are gated in `main.tsx` so hooks are not mounted until configured.
 */
export const supabase = createClient(
  supabaseEnv.url || "https://placeholder.supabase.co",
  supabaseEnv.anonKey || "placeholder-anon-key"
);
