import { NextResponse, type NextRequest } from "next/server";

import { isSupabaseAuthConfigured } from "@/lib/auth/config";
import { getSafeAdminRedirect } from "@/lib/auth/redirects";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const nextPath = getSafeAdminRedirect(request.nextUrl.searchParams.get("next"));

  if (!code || !isSupabaseAuthConfigured()) {
    return NextResponse.redirect(
      new URL("/admin/login?error=callback", request.url),
    );
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL("/admin/login?error=callback", request.url),
    );
  }

  return NextResponse.redirect(new URL(nextPath, request.url));
}
