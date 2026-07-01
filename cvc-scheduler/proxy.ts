import { NextResponse, type NextRequest } from "next/server";

import {
  getAdminAuthMode,
  isSupabaseAuthConfigured,
} from "@/lib/auth/config";
import { getSafeAdminRedirect } from "@/lib/auth/redirects";
import { refreshProjectContactSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname === "/admin/login" || pathname.startsWith("/admin/auth/")) {
    return NextResponse.next();
  }

  if (getAdminAuthMode() === "review") {
    return NextResponse.next();
  }

  const loginUrl = new URL("/admin/login", request.url);
  loginUrl.searchParams.set(
    "next",
    getSafeAdminRedirect(`${pathname}${request.nextUrl.search}`),
  );

  if (!isSupabaseAuthConfigured()) {
    loginUrl.searchParams.set("error", "configuration");
    return NextResponse.redirect(loginUrl);
  }

  try {
    const { response, user } = await refreshProjectContactSession(request);

    if (user) {
      return response;
    }
  } catch {
    loginUrl.searchParams.set("error", "session");
  }

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*"],
};
