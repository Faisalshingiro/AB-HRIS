import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

const configuredUrl = (() => {
  if (!supabaseUrl || !supabaseAnonKey) return null;

  try {
    const url = new URL(supabaseUrl);
    return url.protocol === 'https:' || url.protocol === 'http:' ? supabaseUrl : null;
  } catch {
    return null;
  }
})();

export const isSupabaseConfigured = Boolean(configuredUrl);

export const supabase = createClient(
  configuredUrl || 'https://missing-supabase-config.invalid',
  supabaseAnonKey || 'missing-supabase-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
