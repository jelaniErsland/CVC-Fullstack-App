import { NextRequest, NextResponse } from "next/server";

import {
  readVolunteerSchedule,
  volunteerScheduleAccessCookie,
} from "@/lib/volunteerScheduleAccess/server";
import { VolunteerScheduleAccessValidationError } from "@/lib/volunteerScheduleAccess/token";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type RouteContext = Readonly<{
  params: Promise<{ token: string }>;
}>;

function applySafeHeaders(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

function cleanScheduleRedirect(request: NextRequest, linked = false) {
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProtocol === "https" ? "https:" : request.nextUrl.protocol;
  const host = request.headers.get("host") ?? request.nextUrl.host;
  const target = new URL(`${protocol}//${host}/v/schedule`);
  if (linked) target.searchParams.set("access", "linked");
  return target;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { token } = await params;
  const redirectTarget = cleanScheduleRedirect(request);

  try {
    const schedule = await readVolunteerSchedule({ token });
    if (schedule.kind === "unavailable") {
      return applySafeHeaders(NextResponse.redirect(redirectTarget, 302));
    }

    const response = NextResponse.redirect(cleanScheduleRedirect(request, true), 302);
    response.cookies.set(volunteerScheduleAccessCookie.name, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      path: volunteerScheduleAccessCookie.path,
    });
    return applySafeHeaders(response);
  } catch (error) {
    if (error instanceof VolunteerScheduleAccessValidationError) {
      return applySafeHeaders(NextResponse.redirect(redirectTarget, 302));
    }
    return applySafeHeaders(NextResponse.redirect(redirectTarget, 302));
  }
}
