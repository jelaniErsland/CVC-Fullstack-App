import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { readSupabasePublicConfig } from "@/lib/supabase/config";
import { parseProjectPhoto, type ProjectPhoto } from "@/lib/projectPhoto/photo";
import { volunteerScheduleAccessCookie } from "./server";
export type VolunteerHome = { week: string; meals: { date: string; kind: "breakfast" | "lunch"; menu: string | null; provider: string | null; startTime: string | null; endTime: string | null }[]; away: { id: string; start: string; end: string }[]; photo: ProjectPhoto & { asset_scope?: string } };
export async function volunteerHomeSession() {
  const token = (await cookies()).get(volunteerScheduleAccessCookie.name)?.value;
  if (!token) return null;
  const config = readSupabasePublicConfig({ url: process.env.NEXT_PUBLIC_SUPABASE_URL, anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY });
  const client = createClient<Database>(config.url, config.anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  return { client, token };
}
export async function readVolunteerHome(week: string): Promise<VolunteerHome | null> {
  const session = await volunteerHomeSession(); if (!session) return null;
  const { data, error } = await session.client.rpc("read_volunteer_home", { p_token: session.token, p_week: week });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) return null;
  if (!Array.isArray(data.meals) || !Array.isArray(data.away) || typeof data.week !== "string") throw new Error("Home unavailable.");
  return { week: data.week, meals: data.meals as VolunteerHome["meals"], away: data.away as VolunteerHome["away"], photo: parseProjectPhoto(data.photo) };
}
