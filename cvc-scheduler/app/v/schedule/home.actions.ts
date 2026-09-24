"use server";
import { revalidatePath } from "next/cache";
import { readVolunteerHome, volunteerHomeSession, type VolunteerHome } from "@/lib/volunteerScheduleAccess/home.server";
export type AwayResult = { kind: "error"; message: string } | { kind: "saved"; home: VolunteerHome } | { kind: "preview"; fingerprint: string; conflicts: { id: string; date: string; title: string; response: string }[] };
export async function readMenuWeek(week: string) { if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) return null; return readVolunteerHome(week); }
export async function manageAwayAction(form: FormData): Promise<AwayResult> {
  try {
    const session = await volunteerHomeSession(); if (!session) throw new Error();
    const command = String(form.get("command") ?? ""), id = String(form.get("id") ?? ""), week = String(form.get("week") ?? "");
    const start = String(form.get("start") ?? ""), end = String(form.get("end") ?? "");
    if (!["preview", "save", "remove"].includes(command) || !/^[a-f0-9-]{36}$/.test(id) || !/^\d{4}-\d{2}-\d{2}$/.test(week)) throw new Error();
    if (command !== "remove" && (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end))) throw new Error();
    const { data, error } = await session.client.rpc("manage_volunteer_away", { p_token: session.token, p_command: command, p_id: id, p_start: (start || null) as string, p_end: (end || null) as string, p_expected_preview: String(form.get("fingerprint") ?? "") });
    if (error) return { kind: "error", message: error.code === "40001" ? "Assignments changed. Review this away period again." : "Unable to save. Check your dates and existing away periods." };
    if (command === "preview") {
      if (!data || typeof data !== "object" || Array.isArray(data) || !Array.isArray(data.conflicts) || typeof data.fingerprint !== "string") throw new Error();
      return { kind: "preview", fingerprint: data.fingerprint, conflicts: data.conflicts as Extract<AwayResult, { kind: "preview" }>["conflicts"] };
    }
    try { revalidatePath("/v/schedule"); } catch { /* The away period is persisted. */ }
    const home = await readVolunteerHome(week);
    if (!home) return { kind: "error", message: "Your change was saved. Refresh to load the current away periods." };
    return { kind: "saved", home };
  } catch { return { kind: "error", message: "This change could not be confirmed. Refresh your schedule before retrying." }; }
}
