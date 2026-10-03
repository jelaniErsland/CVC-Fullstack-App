import "server-only";

import {
  assignmentResponseStatuses,
  type AssignmentResponseStatus,
} from "../assignments/assignment.ts";
import type { AppSupabaseClient } from "../supabase/types.ts";
import { normalizeWorkspaceReference } from "../workspaces/identity.ts";

export type CalendarAssignmentPickerVolunteer = Readonly<{
  id: string;
  displayName: string;
  congregation: string | null;
  lifecycle: string;
  readinessStatus: string;
  emailAvailable: boolean;
  phoneAvailable: boolean;
  preferredContactMethod: string | null;
  profileNotes: string | null;
}>;

export type CalendarAssignmentPickerAssignment = Readonly<{
  assignmentId: string;
  calendarItemId: string;
  volunteerProfileId: string;
  volunteerDisplayName: string;
  volunteerCongregation: string | null;
  volunteerLifecycle: string;
  volunteerReadinessStatus: string;
  volunteerEmailAvailable: boolean;
  volunteerPhoneAvailable: boolean;
  volunteerPreferredContactMethod: string | null;
  volunteerProfileNotes: string | null;
  responseStatus: AssignmentResponseStatus;
}>;

export type CalendarAssignmentPickerState =
  | Readonly<{
      kind: "ready";
      volunteers: readonly CalendarAssignmentPickerVolunteer[];
      assignments: readonly CalendarAssignmentPickerAssignment[];
    }>
  | Readonly<{ kind: "unavailable"; reason: "missing_volunteers_view" }>
  | Readonly<{ kind: "error"; reason: "query_unavailable" | "invalid_projection" }>;

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const maximumCalendarItemsPerPickerRead = 120;

function normalizeUuid(value: string) {
  const trimmed = value.trim().toLowerCase();
  return uuidPattern.test(trimmed) ? trimmed : null;
}

function normalizeCalendarItemIds(calendarItemIds: readonly string[]) {
  const normalized = calendarItemIds
    .map(normalizeUuid)
    .filter((value): value is string => Boolean(value));
  return [...new Set(normalized)];
}

function chunks<T>(values: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let start = 0; start < values.length; start += size) result.push(values.slice(start, start + size));
  return result;
}

function safeText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function isResponseStatus(value: unknown): value is AssignmentResponseStatus {
  return assignmentResponseStatuses.includes(value as AssignmentResponseStatus);
}

function responseRank(status: AssignmentResponseStatus) {
  if (status === "confirmed") return 0;
  if (status === "declined") return 1;
  return 2;
}

export async function readCalendarAssignmentPickerWithClient(input: {
  client: AppSupabaseClient;
  workspaceId: string;
  calendarItemIds: readonly string[];
  canViewVolunteers: boolean;
}): Promise<CalendarAssignmentPickerState> {
  if (!input.canViewVolunteers) {
    return { kind: "unavailable", reason: "missing_volunteers_view" };
  }

  let workspaceId: string;
  try {
    workspaceId = normalizeWorkspaceReference({ id: input.workspaceId }).value;
  } catch {
    return { kind: "error", reason: "invalid_projection" };
  }

  const calendarItemIds = normalizeCalendarItemIds(input.calendarItemIds);

  try {
    const volunteersQuery = input.client
      .from("volunteer_profiles")
      .select(
        "id,full_name,email,phone,congregation,preferred_contact_method,profile_notes,lifecycle,readiness_status",
      )
      .eq("workspace_id", workspaceId)
      .order("full_name", { ascending: true })
      .order("id", { ascending: true });

    const assignmentsQueries = chunks(calendarItemIds, maximumCalendarItemsPerPickerRead).map((itemIds) => input.client
            .from("calendar_assignments")
            .select("id,calendar_item_id,volunteer_profile_id,lifecycle")
            .eq("workspace_id", workspaceId)
            .in("calendar_item_id", itemIds)
            .eq("lifecycle", "active")
            .order("created_at", { ascending: true }));

    const [volunteersResult, assignmentsResults] = await Promise.all([
      volunteersQuery,
      Promise.all(assignmentsQueries),
    ]);

    if (volunteersResult.error || assignmentsResults.some((result) => result.error)) {
      return { kind: "error", reason: "query_unavailable" };
    }

    const volunteerRows = (volunteersResult.data ?? []).map((row) => {
      const id = normalizeUuid(row.id);
      const displayName = safeText(row.full_name);
      if (!id || !displayName) throw new Error("invalid volunteer projection");
      return {
        id,
        displayName,
        congregation: safeText(row.congregation),
        emailAvailable: Boolean(safeText(row.email)),
        phoneAvailable: Boolean(safeText(row.phone)),
        preferredContactMethod: safeText(row.preferred_contact_method),
        profileNotes: safeText(row.profile_notes),
        lifecycle: row.lifecycle,
        readinessStatus: row.readiness_status,
      };
    });
    const volunteers = volunteerRows
      .filter(
        (volunteer) =>
          volunteer.lifecycle === "active" && volunteer.readinessStatus === "ready",
      )
      .map(
        ({
          congregation,
          displayName,
          emailAvailable,
          id,
          lifecycle,
          phoneAvailable,
          preferredContactMethod,
          profileNotes,
          readinessStatus,
        }) => ({
          congregation,
          displayName,
          emailAvailable,
          id,
          lifecycle,
          phoneAvailable,
          preferredContactMethod,
          profileNotes,
          readinessStatus,
        }),
      );

    const assignmentRows = assignmentsResults.flatMap((result) => result.data ?? []);
    const assignmentIds = assignmentRows
      .map((row) => normalizeUuid(row.id))
      .filter((value): value is string => Boolean(value));
    const responsesResults = await Promise.all(chunks(assignmentIds, maximumCalendarItemsPerPickerRead).map((ids) => input.client
            .from("assignment_responses")
            .select("assignment_id,response_status,updated_at")
            .eq("workspace_id", workspaceId)
            .in("assignment_id", ids)
            .order("updated_at", { ascending: false })));

    if (responsesResults.some((result) => result.error)) {
      return { kind: "error", reason: "query_unavailable" };
    }

    const responseByAssignmentId = new Map<string, AssignmentResponseStatus>();
    for (const response of responsesResults.flatMap((result) => result.data ?? [])) {
      const assignmentId = normalizeUuid(response.assignment_id);
      if (!assignmentId || responseByAssignmentId.has(assignmentId)) continue;
      responseByAssignmentId.set(
        assignmentId,
        isResponseStatus(response.response_status)
          ? response.response_status
          : "needs_response",
      );
    }

    const volunteerById = new Map(volunteerRows.map((volunteer) => [volunteer.id, volunteer]));
    const assignments = assignmentRows
      .map((row) => {
        const assignmentId = normalizeUuid(row.id);
        const calendarItemId = normalizeUuid(row.calendar_item_id);
        const volunteerProfileId = normalizeUuid(row.volunteer_profile_id);
        const volunteer = volunteerProfileId ? volunteerById.get(volunteerProfileId) : undefined;
        if (!assignmentId || !calendarItemId || !volunteerProfileId || !volunteer) {
          throw new Error("invalid assignment projection");
        }
        return {
          assignmentId,
          calendarItemId,
          volunteerProfileId,
          volunteerDisplayName: volunteer.displayName,
          volunteerCongregation: volunteer.congregation,
          volunteerLifecycle: String(volunteer.lifecycle),
          volunteerReadinessStatus: String(volunteer.readinessStatus),
          volunteerEmailAvailable: volunteer.emailAvailable,
          volunteerPhoneAvailable: volunteer.phoneAvailable,
          volunteerPreferredContactMethod: volunteer.preferredContactMethod,
          volunteerProfileNotes: volunteer.profileNotes,
          responseStatus: responseByAssignmentId.get(assignmentId) ?? "needs_response",
        } satisfies CalendarAssignmentPickerAssignment;
      })
      .sort(
        (first, second) =>
          first.calendarItemId.localeCompare(second.calendarItemId) ||
          responseRank(first.responseStatus) - responseRank(second.responseStatus) ||
          first.volunteerDisplayName.localeCompare(second.volunteerDisplayName) ||
          first.assignmentId.localeCompare(second.assignmentId),
      );

    return { kind: "ready", volunteers, assignments };
  } catch {
    return { kind: "error", reason: "invalid_projection" };
  }
}
