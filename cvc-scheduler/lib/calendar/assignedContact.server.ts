import "server-only";

import type { AppSupabaseClient } from "../supabase/types.ts";
import { readVolunteerScheduleWithClient } from "../volunteers/schedule.server.ts";

export type AssignedContact = Readonly<{
  name: string;
  phone: string | null;
  email: string | null;
  congregation: string | null;
}>;

export type AssignedContactResult =
  | Readonly<{ kind: "ready"; contact: AssignedContact; responseStatus?: "confirmed" | "declined" | "needs_response"; upcoming?: readonly Readonly<{ date: string; title: string; responseStatus: "confirmed" | "declined" | "needs_response" }>[] }>
  | Readonly<{ kind: "unavailable" }>;

/** Every field is selected only after the assignment and its item are authorized. */
export async function readAssignedContactWithClient(input: {
  client: AppSupabaseClient;
  workspaceId: string;
  assignmentId: string;
  quickView: boolean;
}): Promise<AssignedContactResult> {
  const { client, workspaceId, assignmentId, quickView } = input;
  const assignment = await client.from("calendar_assignments")
    .select("calendar_item_id,volunteer_profile_id")
    .eq("workspace_id", workspaceId).eq("id", assignmentId).eq("lifecycle", "active").maybeSingle();
  if (assignment.error || !assignment.data) return { kind: "unavailable" };

  const item = await client.rpc("read_authorized_calendar_items", { p_workspace_id: workspaceId })
    .select("id,lifecycle,publication_state,start_date")
    .eq("id", assignment.data.calendar_item_id).limit(1).maybeSingle();
  if (item.error || !item.data || item.data.lifecycle !== "active" ||
      (quickView && item.data.publication_state !== "published")) return { kind: "unavailable" };
  const itemStartDate = item.data.start_date;

  const profile = await client.from("volunteer_profiles")
    .select("full_name,phone,email,congregation")
    .eq("workspace_id", workspaceId).eq("id", assignment.data.volunteer_profile_id).maybeSingle();
  if (profile.error || !profile.data) return { kind: "unavailable" };
  const contact: AssignedContact = {
    name: profile.data.full_name,
    phone: profile.data.phone,
    email: profile.data.email,
    congregation: profile.data.congregation,
  };
  if (quickView) return { kind: "ready", contact };

  const [response, schedule] = await Promise.all([
    client.from("assignment_responses").select("response_status")
      .eq("workspace_id", workspaceId).eq("assignment_id", assignmentId).maybeSingle(),
    readVolunteerScheduleWithClient({ client, workspaceId, profileId: assignment.data.volunteer_profile_id }),
  ]);
  const status = response.data?.response_status;
  const responseStatus = !response.error && (status === "confirmed" || status === "declined" || status === "needs_response")
    ? status : "needs_response";
  const upcoming = schedule.kind === "ready"
    ? schedule.items.filter(row => row.assignmentId !== assignmentId && row.responseStatus !== "declined" && row.date >= itemStartDate)
      .sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3)
      .map(row => ({ date: row.date, title: row.title, responseStatus: row.responseStatus }))
    : [];
  return { kind: "ready", contact, responseStatus, upcoming };
}
