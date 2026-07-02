import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

export type AppSupabaseClient = SupabaseClient<Database>;

export type PublicRpcArgs<
  Name extends keyof Database["public"]["Functions"],
> = Database["public"]["Functions"][Name] extends { Args: infer Args }
  ? Args
  : never;
