import "server-only";

import type { AppSupabaseClient, PublicRpcArgs } from "../supabase/types.ts";
import {
  parseTaskPreset,
  TaskPresetValidationError,
  validateCreateTaskPresetInput,
  type CreateTaskPresetInput,
  type TaskPreset,
} from "./preset.ts";
import { normalizeWorkspaceReference } from "../workspaces/identity.ts";
import { isTaskPresetColorKey, type TaskPresetColorKey } from "./colors.ts";

export type TaskPresetMutationResult = Readonly<{ presetId: string }>;

export class TaskPresetEditConflictError extends Error {
  constructor() {
    super("This item changed while you were editing it. Review the latest version.");
    this.name = "TaskPresetEditConflictError";
  }
}

function isTaskPresetEditConflict(error: unknown) {
  return typeof error === "object" && error !== null &&
    "code" in error && error.code === "40001" &&
    "details" in error && error.details === "task_preset_edit_conflict";
}

const taskPresetCreateFormFields = new Set([
  "name",
  "description",
  "taskType",
  "defaultNeededCount",
  "volunteerVisible",
  "colorKey",
]);

const taskPresetColumns = [
  "id",
  "workspace_id",
  "name",
  "description",
  "assignment_details_approved_at",
  "task_type",
  "default_needed_count",
  "volunteer_visible",
  "is_system_preset",
  "system_key",
  "color_key",
  "custom_field_definitions",
  "lifecycle",
  "created_at",
  "updated_at",
].join(",");

async function requireAuthenticatedContact(supabase: AppSupabaseClient) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error("Task preset changes require an authenticated contact.");
  }
}

async function createTaskPresetServerClient() {
  const { createServerSupabaseClient } = await import("../supabase/server.ts");
  return createServerSupabaseClient();
}

export async function readTaskPresetsWithClient(
  supabase: AppSupabaseClient,
  workspaceId: string,
): Promise<readonly TaskPreset[]> {
  const normalizedWorkspaceId = normalizeWorkspaceReference({ id: workspaceId }).value;
  const { data, error } = await supabase
    .rpc("read_authorized_task_presets", { p_workspace_id: normalizedWorkspaceId })
    .select(taskPresetColumns)
    .eq("workspace_id", normalizedWorkspaceId)
    .order("lifecycle", { ascending: true })
    .order("name", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    throw new Error("Task presets could not be read.", { cause: error });
  }
  return (data ?? []).map(parseTaskPreset);
}

export async function readCurrentContactTaskPresets(workspaceId: string) {
  const supabase = await createTaskPresetServerClient();
  return readTaskPresetsWithClient(supabase, workspaceId);
}

export function taskPresetCreateInputFromFormData(
  formData: FormData,
  workspaceId: string,
) {
  const submittedFields = [...new Set(formData.keys())].filter(
    (key) => !key.startsWith("$ACTION_"),
  );
  const unsupportedFields = submittedFields.filter(
    (key) => !taskPresetCreateFormFields.has(key),
  );
  const duplicatedFields = submittedFields.filter(
    (key) => formData.getAll(key).length !== 1,
  );
  const volunteerVisible = formData.get("volunteerVisible");

  if (
    unsupportedFields.length > 0 ||
    duplicatedFields.length > 0 ||
    (volunteerVisible !== null && volunteerVisible !== "true")
  ) {
    throw new TaskPresetValidationError([
      "The submitted task contains unsupported fields.",
    ]);
  }

  const description = formData.get("description");
  const neededCount = formData.get("defaultNeededCount");

  return validateCreateTaskPresetInput({
    workspaceId,
    name: formData.get("name"),
    description:
      typeof description === "string" && description.trim().length > 0
        ? description
        : null,
    taskType: formData.get("taskType"),
    defaultNeededCount:
      typeof neededCount === "string" ? Number(neededCount) : Number.NaN,
    volunteerVisible: volunteerVisible === "true",
    colorKey: formData.get("colorKey"),
    customFields: [],
  });
}

export async function createTaskPresetWithClient(
  supabase: AppSupabaseClient,
  input: CreateTaskPresetInput | unknown,
): Promise<TaskPresetMutationResult> {
  await requireAuthenticatedContact(supabase);
  const preset = validateCreateTaskPresetInput(input);
  const { data, error } = await supabase.rpc(
    "create_task_preset",
    {
      p_workspace_id: preset.workspaceId,
      p_name: preset.name,
      p_description: preset.description ?? null,
      p_task_type: preset.taskType,
      p_default_needed_count: preset.defaultNeededCount,
      p_volunteer_visible: preset.volunteerVisible,
      p_custom_field_definitions: preset.customFields,
      p_color_key: preset.colorKey,
    } as unknown as PublicRpcArgs<"create_task_preset">,
  );
  if (error || typeof data !== "string") {
    throw new Error("Task preset could not be created.", { cause: error });
  }
  return { presetId: normalizeWorkspaceReference({ id: data }).value };
}

export function taskPresetColorUpdateInputFromFormData(formData: FormData) {
  const fields = [...new Set(formData.keys())].filter((key) => !key.startsWith("$ACTION_"));
  if (fields.some((key) => key !== "presetId" && key !== "colorKey" && key !== "expectedUpdatedAt") || fields.some((key) => formData.getAll(key).length !== 1)) {
    throw new TaskPresetValidationError(["The submitted task color is invalid."]);
  }
  const presetId = formData.get("presetId");
  const colorKey = formData.get("colorKey");
  const expectedUpdatedAt = formData.get("expectedUpdatedAt");
  if (typeof presetId !== "string") throw new TaskPresetValidationError(["The submitted task color is invalid."]);
  if (!isTaskPresetColorKey(colorKey)) throw new TaskPresetValidationError(["The submitted task color is invalid."]);
  if (typeof expectedUpdatedAt !== "string" || expectedUpdatedAt.trim().length === 0 || Number.isNaN(new Date(expectedUpdatedAt).valueOf())) throw new TaskPresetValidationError(["The submitted task color is invalid."]);
  return { presetId: normalizeWorkspaceReference({ id: presetId }).value, colorKey, expectedUpdatedAt: expectedUpdatedAt.trim() };
}

export async function updateTaskPresetColorWithClient(
  supabase: AppSupabaseClient,
  input: Readonly<{ presetId: string; colorKey: TaskPresetColorKey; expectedUpdatedAt: string }>,
): Promise<TaskPresetMutationResult> {
  await requireAuthenticatedContact(supabase);
  const { data, error } = await supabase.rpc("update_task_preset_color", {
    p_preset_id: normalizeWorkspaceReference({ id: input.presetId }).value,
    p_color_key: input.colorKey,
    p_expected_updated_at: input.expectedUpdatedAt,
  } as unknown as PublicRpcArgs<"update_task_preset_color">);
  if (isTaskPresetEditConflict(error)) throw new TaskPresetEditConflictError();
  if (error || typeof data !== "string") throw new Error("Task preset color could not be updated.", { cause: error });
  return { presetId: normalizeWorkspaceReference({ id: data }).value };
}

export function taskPresetDescriptionInputFromFormData(formData: FormData) {
  const fields = [...new Set(formData.keys())].filter((key) => !key.startsWith("$ACTION_"));
  if (fields.some((key) => !["presetId", "expectedUpdatedAt", "description"].includes(key)) ||
    fields.some((key) => formData.getAll(key).length !== 1)) {
    throw new TaskPresetValidationError(["The submitted assignment details are invalid."]);
  }
  const presetId = formData.get("presetId");
  const expectedUpdatedAt = formData.get("expectedUpdatedAt");
  const description = formData.get("description");
  if (typeof presetId !== "string" || typeof expectedUpdatedAt !== "string" ||
    Number.isNaN(Date.parse(expectedUpdatedAt)) || typeof description !== "string" ||
    description.trim().length > 2000) {
    throw new TaskPresetValidationError(["Assignment details must be at most 2,000 characters."]);
  }
  return {
    presetId: normalizeWorkspaceReference({ id: presetId }).value,
    expectedUpdatedAt,
    description: description.trim() || null,
  };
}

export async function updateTaskPresetDescriptionWithClient(
  supabase: AppSupabaseClient,
  input: ReturnType<typeof taskPresetDescriptionInputFromFormData>,
): Promise<TaskPresetMutationResult> {
  await requireAuthenticatedContact(supabase);
  const { data, error } = await supabase.rpc("update_task_preset_description", {
    p_preset_id: input.presetId,
    p_description: input.description,
    p_expected_updated_at: input.expectedUpdatedAt,
  } as unknown as PublicRpcArgs<"update_task_preset_description">);
  if (isTaskPresetEditConflict(error)) throw new TaskPresetEditConflictError();
  if (error || typeof data !== "string") throw new Error("Assignment details could not be saved.", { cause: error });
  return { presetId: normalizeWorkspaceReference({ id: data }).value };
}

export type FutureInstructionCandidate = Readonly<{
  id: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  currentText: string | null;
  updatedAt: string;
  publicationState: string;
}>;

export async function readFuturePresetInstructionCandidatesWithClient(
  supabase: AppSupabaseClient,
  workspaceId: string,
  presetId: string,
  currentDescription: string,
  projectContactId: string,
  projectToday: string,
): Promise<readonly FutureInstructionCandidate[]> {
  const { data, error } = await supabase.rpc("read_authorized_calendar_items", { p_workspace_id: workspaceId })
    .select("id,start_date,start_time,end_time,schedule_notes,updated_at,publication_state,created_by_project_contact_id")
    .eq("workspace_id", normalizeWorkspaceReference({ id: workspaceId }).value)
    .eq("task_preset_id", normalizeWorkspaceReference({ id: presetId }).value)
    .eq("instruction_source", "preset")
    .neq("schedule_notes", currentDescription)
    .eq("lifecycle", "active")
    .is("meal_kind", null)
    .gt("start_date", projectToday)
    .or(`publication_state.eq.published,created_by_project_contact_id.eq.${normalizeWorkspaceReference({ id: projectContactId }).value}`)
    .order("start_date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(100);
  if (error) throw new Error("Future occurrences could not be previewed.", { cause: error });
  return (data ?? [])
    .filter((item) => item.schedule_notes !== currentDescription &&
      (item.publication_state === "published" || item.created_by_project_contact_id === projectContactId))
    .map((item) => ({
      id: item.id,
      date: item.start_date,
      startTime: item.start_time,
      endTime: item.end_time,
      currentText: item.schedule_notes,
      updatedAt: item.updated_at,
      publicationState: item.publication_state,
    }));
}

export function selectedInstructionTargetsFromFormData(formData: FormData) {
  const selected = formData.getAll("selectedOccurrence");
  if (selected.length < 1 || selected.length > 100) throw new TaskPresetValidationError(["Select 1–100 future occurrences."]);
  const seen = new Set<string>();
  return selected.map((value) => {
    if (typeof value !== "string") throw new TaskPresetValidationError(["Invalid occurrence selection."]);
    let parsed: unknown;
    try { parsed = JSON.parse(value); } catch { throw new TaskPresetValidationError(["Invalid occurrence selection."]); }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new TaskPresetValidationError(["Invalid occurrence selection."]);
    const target = parsed as Record<string, unknown>;
    if (Object.keys(target).sort().join(",") !== "id,updated_at" ||
      typeof target.id !== "string" || typeof target.updated_at !== "string" ||
      Number.isNaN(Date.parse(target.updated_at))) throw new TaskPresetValidationError(["Invalid occurrence selection."]);
    const id = normalizeWorkspaceReference({ id: target.id }).value;
    if (seen.has(id)) throw new TaskPresetValidationError(["An occurrence was selected twice."]);
    seen.add(id);
    return { id, updated_at: target.updated_at };
  });
}

export async function applyTaskPresetInstructionsWithClient(
  supabase: AppSupabaseClient,
  input: Readonly<{ presetId: string; expectedUpdatedAt: string; targets: ReturnType<typeof selectedInstructionTargetsFromFormData> }>,
) {
  await requireAuthenticatedContact(supabase);
  const { data, error } = await supabase.rpc("apply_task_preset_instructions", {
    p_preset_id: input.presetId,
    p_expected_preset_updated_at: input.expectedUpdatedAt,
    p_targets: input.targets,
  });
  if (isTaskPresetEditConflict(error)) throw new TaskPresetEditConflictError();
  if (isCalendarItemEditConflict(error)) throw new TaskPresetEditConflictError();
  if (error || typeof data !== "number") throw new Error("Future instructions could not be applied.", { cause: error });
  return data;
}

function isCalendarItemEditConflict(error: unknown) {
  return typeof error === "object" && error !== null &&
    "code" in error && error.code === "40001" &&
    "details" in error && error.details === "calendar_item_edit_conflict";
}

export async function createTaskPreset(input: CreateTaskPresetInput | unknown) {
  const supabase = await createTaskPresetServerClient();
  return createTaskPresetWithClient(supabase, input);
}

export async function archiveTaskPresetWithClient(
  supabase: AppSupabaseClient,
  presetId: string,
): Promise<TaskPresetMutationResult> {
  await requireAuthenticatedContact(supabase);
  const normalizedPresetId = normalizeWorkspaceReference({ id: presetId }).value;
  const { data, error } = await supabase.rpc("archive_task_preset", {
    p_preset_id: normalizedPresetId,
  });
  if (error || typeof data !== "string") {
    throw new Error("Task preset could not be archived.", { cause: error });
  }
  return { presetId: normalizeWorkspaceReference({ id: data }).value };
}

export async function archiveTaskPreset(presetId: string) {
  const supabase = await createTaskPresetServerClient();
  return archiveTaskPresetWithClient(supabase, presetId);
}
