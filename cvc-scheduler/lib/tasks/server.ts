import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  parseTaskPreset,
  validateCreateTaskPresetInput,
  type CreateTaskPresetInput,
  type TaskPreset,
} from "@/lib/tasks/preset";
import { normalizeWorkspaceReference } from "@/lib/workspaces/identity";

export type TaskPresetMutationResult = Readonly<{ presetId: string }>;

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

async function requireAuthenticatedContact(supabase: SupabaseClient) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error("Task preset changes require an authenticated contact.");
  }
}

export async function readTaskPresetsWithClient(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<readonly TaskPreset[]> {
  const normalizedWorkspaceId = normalizeWorkspaceReference({ id: workspaceId }).value;
  const { data, error } = await supabase
    .from("task_presets")
    .select(taskPresetColumns)
    .eq("workspace_id", normalizedWorkspaceId)
    .order("name");

  if (error) {
    throw new Error("Task presets could not be read.", { cause: error });
  }
  return (data ?? []).map(parseTaskPreset);
}

export async function readCurrentContactTaskPresets(workspaceId: string) {
  const supabase = await createServerSupabaseClient();
  return readTaskPresetsWithClient(supabase, workspaceId);
}

export async function createTaskPresetWithClient(
  supabase: SupabaseClient,
  input: CreateTaskPresetInput | unknown,
): Promise<TaskPresetMutationResult> {
  await requireAuthenticatedContact(supabase);
  const preset = validateCreateTaskPresetInput(input);
  const { data, error } = await supabase.rpc("create_task_preset", {
    p_workspace_id: preset.workspaceId,
    p_name: preset.name,
    p_description: preset.description,
    p_task_type: preset.taskType,
    p_default_needed_count: preset.defaultNeededCount,
    p_volunteer_visible: preset.volunteerVisible,
    p_custom_field_definitions: preset.customFields,
  });
  if (error || typeof data !== "string") {
    throw new Error("Task preset could not be created.", { cause: error });
  }
  return { presetId: normalizeWorkspaceReference({ id: data }).value };
}

export async function createTaskPreset(input: CreateTaskPresetInput | unknown) {
  const supabase = await createServerSupabaseClient();
  return createTaskPresetWithClient(supabase, input);
}

export async function archiveTaskPresetWithClient(
  supabase: SupabaseClient,
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
  const supabase = await createServerSupabaseClient();
  return archiveTaskPresetWithClient(supabase, presetId);
}

