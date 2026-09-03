import { NextRequest, NextResponse } from "next/server";

import {
  projectQuickViewAccessCookie,
  readSharedProjectQuickView,
} from "@/lib/projectQuickViewAccess/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type RouteContext = Readonly<{ params: Promise<{ token: string }> }>;

function safeHeaders(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

function cleanUrl(request: NextRequest, linked = false) {
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProtocol === "https" ? "https:" : request.nextUrl.protocol;
  const host = request.headers.get("host") ?? request.nextUrl.host;
  const target = new URL(`${protocol}//${host}/qv`);
  if (linked) target.searchParams.set("access", "linked");
  return target;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { token } = await params;
  try {
    const view = await readSharedProjectQuickView({ token });
    if (view.kind !== "ready") {
      return safeHeaders(NextResponse.redirect(cleanUrl(request), 302));
    }
    const response = NextResponse.redirect(cleanUrl(request, true), 302);
    response.cookies.set(projectQuickViewAccessCookie.name, token, {
      expires: new Date(view.expiresAt),
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https",
      path: projectQuickViewAccessCookie.path,
    });
    return safeHeaders(response);
  } catch {
    return safeHeaders(NextResponse.redirect(cleanUrl(request), 302));
  }
}
