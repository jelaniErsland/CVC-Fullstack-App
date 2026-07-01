import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { readSupabaseServerConfig } from "@/lib/supabase/config";

export function getSupabaseServerConfig() {
  return readSupabaseServerConfig({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
}

/**
 * Creates a server-only, anonymous client without cookie/session behavior.
 * It is not an authenticated user client and is not used by any route yet.
 */
export function createServerSupabaseClient(): SupabaseClient {
  const config = getSupabaseServerConfig();

  return createClient(config.url, config.anonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}
