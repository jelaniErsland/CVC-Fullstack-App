import "server-only";

import type { AppSupabaseClient } from "../supabase/types.ts";
import { normalizeWorkspaceReference } from "../workspaces/identity.ts";

export type VolunteerScheduleItem = Readonly<{
  assignmentId: string;
  itemId: string;
  date: string;
  title: string;
  startTime: string | null;
  endTime: string | null;
  timezone: string;
  responseStatus: "confirmed" | "needs_response" | "declined";
}>;

export type VolunteerScheduleResult =
  | Readonly<{ kind: "ready"; items: readonly VolunteerScheduleItem[] }>
  | Readonly<{ kind: "unavailable" | "error" }>;

export async function readVolunteerScheduleWithClient(input: {
  client: AppSupabaseClient;
  workspaceId: string;
  profileId: string;
}): Promise<VolunteerScheduleResult> {
  try {
    const workspaceId = normalizeWorkspaceReference({ id: input.workspaceId }).value;
    const profileId = normalizeWorkspaceReference({ id: input.profileId }).value;
    const profile = await input.client.from("volunteer_profiles").select("id").eq("workspace_id", workspaceId).eq("id", profileId).single();
    if (profile.error || !profile.data) return { kind: "unavailable" };

    const assignments = await input.client.from("calendar_assignments")
      .select("id,calendar_item_id").eq("workspace_id", workspaceId)
      .eq("volunteer_profile_id", profileId).eq("lifecycle", "active")
      .order("created_at", { ascending: true });
    if (assignments.error) return { kind: "error" };
    const assignmentRows = assignments.data ?? [];
    if (!assignmentRows.length) return { kind: "ready", items: [] };

    const itemIds = [...new Set(assignmentRows.map((row) => row.calendar_item_id))];
    const assignmentIds = assignmentRows.map((row) => row.id);
    const [items, responses] = await Promise.all([
      input.client.from("calendar_items")
        .select("id,start_date,title_snapshot,start_time,end_time,timezone,lifecycle")
        .eq("workspace_id", workspaceId).in("id", itemIds),
      input.client.from("assignment_responses")
        .select("assignment_id,response_status,updated_at")
        .eq("workspace_id", workspaceId).in("assignment_id", assignmentIds)
        .order("updated_at", { ascending: false }),
    ]);
    if (items.error || responses.error) return { kind: "error" };
    const itemById = new Map((items.data ?? []).filter((item) => item.lifecycle === "active").map((item) => [item.id, item]));
    const responseById = new Map<string, VolunteerScheduleItem["responseStatus"]>();
    for (const response of responses.data ?? []) {
      if (!responseById.has(response.assignment_id) && (response.response_status === "confirmed" || response.response_status === "declined" || response.response_status === "needs_response")) {
        responseById.set(response.assignment_id, response.response_status);
      }
    }
    const result: VolunteerScheduleItem[] = [];
    for (const assignment of assignmentRows) {
      const item = itemById.get(assignment.calendar_item_id);
      if (!item) continue;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(item.start_date) || !item.title_snapshot.trim()) return { kind: "error" };
      result.push({
        assignmentId: assignment.id,
        itemId: item.id,
        date: item.start_date,
        title: item.title_snapshot,
        startTime: item.start_time,
        endTime: item.end_time,
        timezone: item.timezone,
        responseStatus: responseById.get(assignment.id) ?? "needs_response",
      });
    }
    return { kind: "ready", items: result };
  } catch {
    return { kind: "error" };
  }
}
