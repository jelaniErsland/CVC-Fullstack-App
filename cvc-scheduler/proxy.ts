import { NextResponse, type NextRequest } from "next/server";

import {
  getAdminAuthMode,
  isSupabaseAuthConfigured,
} from "@/lib/auth/config";
import { getSafeAdminRedirect } from "@/lib/auth/redirects";
import { refreshProjectContactSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname === "/v/schedule" || pathname.startsWith("/v/access/")) {
    const response = NextResponse.next();
    response.headers.set("Cache-Control", "no-store, max-age=0");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  }

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
  matcher: ["/admin/:path*", "/v/schedule", "/v/access/:path*"],
};
