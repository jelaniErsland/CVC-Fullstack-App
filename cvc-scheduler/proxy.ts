import { NextResponse, type NextRequest } from "next/server";

import {
  getAdminAuthMode,
  isSupabaseAuthConfigured,
} from "@/lib/auth/config";
import { getSafeAdminRedirect } from "@/lib/auth/redirects";
import { refreshProjectContactSession } from "@/lib/supabase/proxy";

function isContainedBetaRoute(pathname: string) {
  return [
    "/admin/announcements",
    "/admin/food",
    "/admin/onboarding",
    "/admin/projects",
    "/admin/questionnaires",
    "/admin/schedule",
    "/admin/security",
    "/admin/settings",
  ].some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function betaUnavailableResponse(request: NextRequest) {
  return NextResponse.rewrite(new URL("/admin/beta-unavailable", request.url));
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname === "/qv" || pathname.startsWith("/qv/")) {
    const response = NextResponse.next();
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  }

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
    return isContainedBetaRoute(pathname)
      ? betaUnavailableResponse(request)
      : NextResponse.next();
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
      return isContainedBetaRoute(pathname)
        ? betaUnavailableResponse(request)
        : response;
    }
  } catch {
    loginUrl.searchParams.set("error", "session");
  }

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*", "/v/schedule", "/v/access/:path*", "/qv/:path*"],
};
