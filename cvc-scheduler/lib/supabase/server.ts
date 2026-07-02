import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { readSupabaseServerConfig } from "@/lib/supabase/config";
import type { Database } from "@/lib/supabase/database.types";
import type { AppSupabaseClient } from "@/lib/supabase/types";

export function getSupabaseServerConfig() {
  return readSupabaseServerConfig({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
}

/**
 * Creates the cookie-aware server client used by the contact auth shell.
 * Product data and authorization remain outside this boundary.
 */
export async function createServerSupabaseClient(): Promise<AppSupabaseClient> {
  const config = getSupabaseServerConfig();
  const cookieStore = await cookies();

  return createServerClient<Database>(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, options, value }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components cannot write cookies. proxy.ts owns refreshes;
          // Route Handlers can write callback/sign-out changes normally.
        }
      },
    },
  });
}
