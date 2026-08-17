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

export type TaskPresetMutationResult = Readonly<{ presetId: string }>;

const taskPresetCreateFormFields = new Set([
  "name",
  "description",
  "taskType",
  "defaultNeededCount",
  "volunteerVisible",
]);

const taskPresetColumns = [
  "id",
  "workspace_id",
  "name",
  "description",
  "task_type",
  "default_needed_count",
  "volunteer_visible",
  "is_system_preset",
  "system_key",
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
    .from("task_presets")
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
    } as unknown as PublicRpcArgs<"create_task_preset">,
  );
  if (error || typeof data !== "string") {
    throw new Error("Task preset could not be created.", { cause: error });
  }
  return { presetId: normalizeWorkspaceReference({ id: data }).value };
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
