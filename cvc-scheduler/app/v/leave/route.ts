import { NextRequest, NextResponse } from "next/server";
import { volunteerScheduleAccessCookie } from "@/lib/volunteerScheduleAccess/server";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  const fetchSite = request.headers.get("sec-fetch-site");
  let originMatches = false;
  try { originMatches = Boolean(origin && new URL(origin).host === host); } catch { /* Browsers may send Origin: null for a form navigation. */ }
  if (!host || fetchSite === "cross-site" || (!originMatches && fetchSite !== "same-origin")) {
    return new NextResponse(null, { status: 403 });
  }
  const form = await request.formData();
  const mode = form.get("mode") === "forget" ? "forgot" : "switch";
  const response = NextResponse.redirect(new URL(`/?${mode}=1`, originMatches ? origin! : `${request.nextUrl.protocol}//${host}`), 303);
  const secure = request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
  response.cookies.set(volunteerScheduleAccessCookie.name, "", {
    path: volunteerScheduleAccessCookie.path, maxAge: 0, httpOnly: true, sameSite: "lax", secure,
  });
  response.headers.append("Set-Cookie", `${volunteerScheduleAccessCookie.name}=; Path=/v; Max-Age=0; SameSite=Lax; HttpOnly${secure ? "; Secure" : ""}`);
  return response;
}
