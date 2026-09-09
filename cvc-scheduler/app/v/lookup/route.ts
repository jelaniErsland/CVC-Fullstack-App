import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { readSupabasePublicConfig } from "@/lib/supabase/config";
import { volunteerScheduleAccessCookie } from "@/lib/volunteerScheduleAccess/server";
import { parseLookupInput, parseLookupResult } from "@/lib/volunteerScheduleAccess/lookup";

export const dynamic = "force-dynamic";

function reply(body: object) {
  return NextResponse.json(body, { headers: {
    "Cache-Control": "no-store, max-age=0", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow",
  } });
}

export async function POST(request: NextRequest) {
  const failure = () => reply({ status: "unverified" });
  // JSON-only, same-origin POST prevents a third party replacing a volunteer session.
  try {
    const origin = request.headers.get("origin");
    if (!origin || new URL(origin).host !== request.headers.get("host")
      || request.headers.get("sec-fetch-site") === "cross-site"
      || !request.headers.get("content-type")?.startsWith("application/json")) return failure();
    // Bound streaming bodies too; Content-Length alone is not trustworthy.
    const reader = request.body?.getReader();
    if (!reader) return failure();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 2048) { await reader.cancel(); return failure(); }
      chunks.push(value);
    }
    const input = parseLookupInput(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    if (!input) return failure();
    const config = readSupabasePublicConfig({ url: process.env.NEXT_PUBLIC_SUPABASE_URL, anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY });
    const client = createClient<Database>(config.url, config.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error } = await client.rpc("verify_volunteer_schedule_lookup", {
      p_full_name: input.lastName, p_contact: input.contact, p_project_choice: input.projectChoice,
    });
    if (error) return failure();
    const result = parseLookupResult(data);
    if (result.status !== "verified") return reply(result);
    const response = reply({ status: "verified" });
    response.cookies.set(volunteerScheduleAccessCookie.name, result.bearer_token, {
      httpOnly: true, sameSite: "lax", path: volunteerScheduleAccessCookie.path,
      secure: request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https",
      // Match personalized-link session lifetime: browser session, with DB expiry.
    });
    return response;
  } catch {
    // Do not log submitted identity, database errors, or returned credentials.
    return failure();
  }
}
