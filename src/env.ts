/** Trimmed Supabase vars from Vite (undefined if absent). */
export const supabaseEnv = {
  url: import.meta.env.VITE_SUPABASE_URL?.trim() ?? "",
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? "",
};

export const isSupabaseConfigured = Boolean(supabaseEnv.url && supabaseEnv.anonKey);
