import "server-only";

import {
  parseAssignmentResponse,
  parseCalendarAssignment,
  validateCancelAssignmentInput,
  validateCreateAssignmentBatchInput,
  validateCreateAssignmentInput,
  validateUpdateAssignmentResponseInput,
  type AssignmentResponse,
  type CancelAssignmentInput,
  type CalendarAssignment,
  type CreateAssignmentBatchInput,
  type CreateAssignmentInput,
  type UpdateAssignmentResponseInput,
} from "@/lib/assignments/assignment";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { AppSupabaseClient, PublicRpcArgs } from "@/lib/supabase/types";
import { normalizeWorkspaceReference } from "@/lib/workspaces/identity";

export type AssignmentMutationResult = Readonly<{ assignmentId: string }>;
export type AssignmentBatchMutationResult = Readonly<{ assignmentIds: readonly string[] }>;
export type AssignmentState = Readonly<{
  assignments: readonly CalendarAssignment[];
  responses: readonly AssignmentResponse[];
}>;

const assignmentColumns = [
  "id",
  "workspace_id",
  "calendar_item_id",
  "volunteer_profile_id",
  "lifecycle",
  "assignment_note",
  "created_by_auth_user_id",
  "created_at",
  "updated_at",
].join(",");

const responseColumns = [
  "id",
  "workspace_id",
  "assignment_id",
  "response_status",
  "response_source",
  "response_note",
  "responded_at",
  "updated_by_auth_user_id",
  "created_at",
  "updated_at",
].join(",");

async function requireAuthenticatedContact(supabase: AppSupabaseClient) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Assignment changes require an authenticated contact.");
}

export async function readAssignmentsWithClient(
  supabase: AppSupabaseClient,
  workspaceId: string,
): Promise<readonly CalendarAssignment[]> {
  const normalizedWorkspaceId = normalizeWorkspaceReference({ id: workspaceId }).value;
  const { data, error } = await supabase
    .from("calendar_assignments")
    .select(assignmentColumns)
    .eq("workspace_id", normalizedWorkspaceId)
    .order("created_at");
  if (error) throw new Error("Assignments could not be read.", { cause: error });
  return (data ?? []).map(parseCalendarAssignment);
}

export async function readAssignmentResponsesWithClient(
  supabase: AppSupabaseClient,
  workspaceId: string,
): Promise<readonly AssignmentResponse[]> {
  const normalizedWorkspaceId = normalizeWorkspaceReference({ id: workspaceId }).value;
  const { data, error } = await supabase
    .from("assignment_responses")
    .select(responseColumns)
    .eq("workspace_id", normalizedWorkspaceId)
    .order("created_at");
  if (error) throw new Error("Assignment responses could not be read.", { cause: error });
  return (data ?? []).map(parseAssignmentResponse);
}

export async function readAssignmentStateWithClient(
  supabase: AppSupabaseClient,
  workspaceId: string,
): Promise<AssignmentState> {
  const [assignments, responses] = await Promise.all([
    readAssignmentsWithClient(supabase, workspaceId),
    readAssignmentResponsesWithClient(supabase, workspaceId),
  ]);
  return { assignments, responses };
}

export async function readCurrentContactAssignmentState(workspaceId: string) {
  const supabase = await createServerSupabaseClient();
  return readAssignmentStateWithClient(supabase, workspaceId);
}

export async function createAssignmentWithClient(
  supabase: AppSupabaseClient,
  input: CreateAssignmentInput | unknown,
): Promise<AssignmentMutationResult> {
  await requireAuthenticatedContact(supabase);
  const assignment = validateCreateAssignmentInput(input);
  const { data, error } = await supabase.rpc(
    "create_calendar_assignment",
    {
      p_calendar_item_id: assignment.calendarItemId,
      p_volunteer_profile_id: assignment.volunteerProfileId,
      p_assignment_note: assignment.note ?? null,
    } as PublicRpcArgs<"create_calendar_assignment">,
  );
  if (error || typeof data !== "string") {
    throw new Error("Assignment could not be created.", { cause: error });
  }
  return { assignmentId: normalizeWorkspaceReference({ id: data }).value };
}

export async function createAssignment(input: CreateAssignmentInput | unknown) {
  const supabase = await createServerSupabaseClient();
  return createAssignmentWithClient(supabase, input);
}

export async function createAssignmentsBatchWithClient(
  supabase: AppSupabaseClient,
  input: CreateAssignmentBatchInput | unknown,
): Promise<AssignmentBatchMutationResult> {
  await requireAuthenticatedContact(supabase);
  const assignment = validateCreateAssignmentBatchInput(input);
  const { data, error } = await supabase.rpc(
    "create_calendar_assignments_batch",
    {
      p_calendar_item_id: assignment.calendarItemId,
      p_volunteer_profile_ids: [...assignment.volunteerProfileIds],
      p_assignment_note: assignment.note ?? null,
    } as PublicRpcArgs<"create_calendar_assignments_batch">,
  );
  if (error || !Array.isArray(data)) {
    throw new Error("Assignments could not be created.", { cause: error });
  }
  return {
    assignmentIds: data.map((id) => normalizeWorkspaceReference({ id }).value),
  };
}

export async function createAssignmentsBatch(
  input: CreateAssignmentBatchInput | unknown,
) {
  const supabase = await createServerSupabaseClient();
  return createAssignmentsBatchWithClient(supabase, input);
}

export async function cancelAssignmentWithClient(
  supabase: AppSupabaseClient,
  input: CancelAssignmentInput | string | unknown,
): Promise<AssignmentMutationResult> {
  await requireAuthenticatedContact(supabase);
  const assignment =
    typeof input === "string"
      ? validateCancelAssignmentInput({ assignmentId: input })
      : validateCancelAssignmentInput(input);
  const normalizedId = normalizeWorkspaceReference({ id: assignment.assignmentId }).value;
  const { data, error } = await supabase.rpc("cancel_calendar_assignment", {
    p_assignment_id: normalizedId,
  });
  if (error || typeof data !== "string") {
    throw new Error("Assignment could not be canceled.", { cause: error });
  }
  return { assignmentId: normalizeWorkspaceReference({ id: data }).value };
}

export async function cancelAssignment(input: CancelAssignmentInput | string | unknown) {
  const supabase = await createServerSupabaseClient();
  return cancelAssignmentWithClient(supabase, input);
}

export async function updateAssignmentResponseWithClient(
  supabase: AppSupabaseClient,
  input: UpdateAssignmentResponseInput | unknown,
): Promise<AssignmentMutationResult> {
  await requireAuthenticatedContact(supabase);
  const response = validateUpdateAssignmentResponseInput(input);
  const { data, error } = await supabase.rpc(
    "update_assignment_response",
    {
      p_assignment_id: response.assignmentId,
      p_response_status: response.status,
      p_response_note: response.note ?? null,
    } as PublicRpcArgs<"update_assignment_response">,
  );
  if (error || typeof data !== "string") {
    throw new Error("Assignment response could not be updated.", { cause: error });
  }
  return { assignmentId: normalizeWorkspaceReference({ id: data }).value };
}

export async function updateAssignmentResponse(
  input: UpdateAssignmentResponseInput | unknown,
) {
  const supabase = await createServerSupabaseClient();
  return updateAssignmentResponseWithClient(supabase, input);
}
