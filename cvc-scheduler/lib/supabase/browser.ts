"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { readSupabasePublicConfig } from "@/lib/supabase/config";

/**
 * Creates an untyped browser client for future public/authenticated slices.
 * Nothing in the application calls this factory yet. Add generated database
 * types before the first product-table integration.
 */
export function createBrowserSupabaseClient(): SupabaseClient {
  const config = readSupabasePublicConfig({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  return createBrowserClient(config.url, config.anonKey);
}
