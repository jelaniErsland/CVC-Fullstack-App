import { NextResponse, type NextRequest } from "next/server";

import { isSupabaseAuthConfigured } from "@/lib/auth/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  if (isSupabaseAuthConfigured()) {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.signOut({ scope: "local" });
  }

  return NextResponse.redirect(new URL("/admin/login?signedOut=1", request.url), 303);
}
