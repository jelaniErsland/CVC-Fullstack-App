import "server-only";

import { createServerSupabaseClient } from "../supabase/server.ts";
import type { AppSupabaseClient, PublicRpcArgs } from "../supabase/types.ts";

export type ReadAssignmentDetailContextInput = Readonly<{
  assignmentId: string;
}>;

export type AssignmentDetailContext = Readonly<{
  assignmentId: string;
  assignmentLifecycle: "active";
  workspaceId: string;
  workspaceDisplayName: string;
  calendarItemId: string;
  taskTitle: string;
  scheduleKind: "timed" | "date_based" | "multi_day_window" | "milestone";
  scheduledDate: string;
  scheduledEndDate: string | null;
  startTime: string | null;
  endTime: string | null;
  timezone: string;
  plannedNeededCount: number;
  volunteerProfileId: string;
  volunteerDisplayName: string;
  volunteerCongregation: string | null;
  currentResponseStatus: "needs_response" | "confirmed" | "declined";
  currentResponseUpdatedAt: string;
  currentResponseSource: "project_contact" | "public_token" | "volunteer_schedule";
  canEditAssignment: boolean;
  responseLinkProductSurfaceAvailable: false;
  futureResponseLinkSurface: "future_project_contact_assignment_response_reveal";
}>;

export class AssignmentDetailContextValidationError extends Error {
  constructor() {
    super("Assignment detail context input is invalid.");
    this.name = "AssignmentDetailContextValidationError";
  }
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const scheduleKinds = ["timed", "date_based", "multi_day_window", "milestone"] as const;
const responseStatuses = ["needs_response", "confirmed", "declined"] as const;
const responseSources = ["project_contact", "public_token", "volunteer_schedule"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeInput(input: unknown) {
  if (
    !isRecord(input) ||
    Object.keys(input).some((key) => key !== "assignmentId") ||
    typeof input.assignmentId !== "string" ||
    !uuidPattern.test(input.assignmentId.trim())
  ) {
    throw new AssignmentDetailContextValidationError();
  }
  return { assignmentId: input.assignmentId.trim().toLowerCase() } as const;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function parseContext(value: unknown): AssignmentDetailContext | null {
  if (!Array.isArray(value)) {
    throw new Error("Assignment detail context returned an invalid result.");
  }
  if (value.length === 0) return null;
  if (value.length !== 1 || !isRecord(value[0])) {
    throw new Error("Assignment detail context returned an invalid result.");
  }

  const row = value[0];
  if (
    typeof row.assignment_reference !== "string" ||
    !uuidPattern.test(row.assignment_reference) ||
    row.assignment_lifecycle !== "active" ||
    typeof row.workspace_reference !== "string" ||
    !uuidPattern.test(row.workspace_reference) ||
    typeof row.workspace_display_name !== "string" ||
    row.workspace_display_name.length === 0 ||
    typeof row.calendar_item_reference !== "string" ||
    !uuidPattern.test(row.calendar_item_reference) ||
    typeof row.task_title !== "string" ||
    row.task_title.length === 0 ||
    typeof row.schedule_kind !== "string" ||
    !scheduleKinds.includes(row.schedule_kind as (typeof scheduleKinds)[number]) ||
    typeof row.scheduled_date !== "string" ||
    !isNullableString(row.scheduled_end_date) ||
    !isNullableString(row.scheduled_start_time) ||
    !isNullableString(row.scheduled_end_time) ||
    typeof row.schedule_timezone !== "string" ||
    typeof row.planned_needed_count !== "number" ||
    !Number.isInteger(row.planned_needed_count) ||
    row.planned_needed_count < 1 ||
    typeof row.volunteer_profile_reference !== "string" ||
    !uuidPattern.test(row.volunteer_profile_reference) ||
    typeof row.volunteer_display_name !== "string" ||
    row.volunteer_display_name.length === 0 ||
    !isNullableString(row.volunteer_congregation) ||
    typeof row.current_response_status !== "string" ||
    !responseStatuses.includes(
      row.current_response_status as (typeof responseStatuses)[number],
    ) ||
    typeof row.current_response_updated_at !== "string" ||
    !Number.isFinite(Date.parse(row.current_response_updated_at)) ||
    typeof row.current_response_source !== "string" ||
    !responseSources.includes(row.current_response_source as (typeof responseSources)[number]) ||
    typeof row.can_edit_assignment !== "boolean" ||
    row.response_link_product_surface_available !== false ||
    row.future_response_link_surface !==
      "future_project_contact_assignment_response_reveal"
  ) {
    throw new Error("Assignment detail context returned an invalid result.");
  }

  return {
    assignmentId: row.assignment_reference.toLowerCase(),
    assignmentLifecycle: "active",
    workspaceId: row.workspace_reference.toLowerCase(),
    workspaceDisplayName: row.workspace_display_name,
    calendarItemId: row.calendar_item_reference.toLowerCase(),
    taskTitle: row.task_title,
    scheduleKind: row.schedule_kind as AssignmentDetailContext["scheduleKind"],
    scheduledDate: row.scheduled_date,
    scheduledEndDate: row.scheduled_end_date,
    startTime: row.scheduled_start_time,
    endTime: row.scheduled_end_time,
    timezone: row.schedule_timezone,
    plannedNeededCount: row.planned_needed_count,
    volunteerProfileId: row.volunteer_profile_reference.toLowerCase(),
    volunteerDisplayName: row.volunteer_display_name,
    volunteerCongregation: row.volunteer_congregation,
    currentResponseStatus:
      row.current_response_status as AssignmentDetailContext["currentResponseStatus"],
    currentResponseUpdatedAt: row.current_response_updated_at,
    currentResponseSource:
      row.current_response_source as AssignmentDetailContext["currentResponseSource"],
    canEditAssignment: row.can_edit_assignment,
    responseLinkProductSurfaceAvailable: false,
    futureResponseLinkSurface: "future_project_contact_assignment_response_reveal",
  };
}

async function requireAuthenticatedContact(supabase: AppSupabaseClient) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Assignment detail requires an authenticated contact.");
}

export async function readAssignmentDetailContextWithClient(
  supabase: AppSupabaseClient,
  input: ReadAssignmentDetailContextInput | unknown,
) {
  await requireAuthenticatedContact(supabase);
  const request = normalizeInput(input);
  const { data, error } = await supabase.rpc("read_assignment_detail_context", {
    p_assignment_id: request.assignmentId,
  } as PublicRpcArgs<"read_assignment_detail_context">);
  if (error) {
    throw new Error("Assignment detail context is unavailable.", { cause: error });
  }
  return parseContext(data);
}

export async function readAssignmentDetailContext(
  input: ReadAssignmentDetailContextInput | unknown,
) {
  const supabase = await createServerSupabaseClient();
  return readAssignmentDetailContextWithClient(supabase, input);
}
