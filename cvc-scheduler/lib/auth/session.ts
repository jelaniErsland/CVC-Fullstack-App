import "server-only";

import { isSupabaseAuthConfigured } from "@/lib/auth/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type ProjectContactSession =
  | Readonly<{ status: "unconfigured" }>
  | Readonly<{ status: "anonymous" }>
  | Readonly<{ status: "unavailable" }>
  | Readonly<{
      status: "authenticated";
      userId: string;
      email: string | null;
    }>;

export async function readProjectContactSession(): Promise<ProjectContactSession> {
  if (!isSupabaseAuthConfigured()) {
    return { status: "unconfigured" };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { status: "anonymous" };
    }

    return {
      status: "authenticated",
      userId: user.id,
      email: user.email ?? null,
    };
  } catch {
    return { status: "unavailable" };
  }
}
