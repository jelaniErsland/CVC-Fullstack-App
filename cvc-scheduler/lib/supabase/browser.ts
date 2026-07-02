"use client";

import { createBrowserClient } from "@supabase/ssr";

import { readSupabasePublicConfig } from "@/lib/supabase/config";
import type { Database } from "@/lib/supabase/database.types";
import type { AppSupabaseClient } from "@/lib/supabase/types";

/**
 * Creates the typed browser client for future public/authenticated slices.
 * Nothing in the application calls this factory yet.
 */
export function createBrowserSupabaseClient(): AppSupabaseClient {
  const config = readSupabasePublicConfig({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  return createBrowserClient<Database>(config.url, config.anonKey);
}
