import "server-only";

import type { AppSupabaseClient } from "../supabase/types.ts";
import { normalizeWorkspaceReference } from "../workspaces/identity.ts";

export const CALENDAR_TASK_PRESET_SELECTOR_AVAILABLE = true;
export const CALENDAR_TASK_PRESET_SELECTOR_ROUTE_INTEGRATED = true;
export const CALENDAR_TASK_PRESET_SELECTOR_REQUIRES_TASKS_VIEW = true;
export const CALENDAR_TASK_PRESET_SELECTOR_MOCK_FALLBACK_ALLOWED = false;
export const CALENDAR_TASK_PRESET_SELECTOR_CREATES_TASK_PRESETS = false;
export const CALENDAR_TASK_PRESET_SELECTOR_SERVICE_ROLE_AVAILABLE = false;

const selectorColumns = [
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
].join(",");

const allowedTaskTypes = ["general", "food", "security", "custom"] as const;
const allowedFieldTypes = [
  "short_text",
  "long_text",
  "number",
  "select",
  "checkbox",
] as const;

type TaskPresetType = (typeof allowedTaskTypes)[number];
type TaskPresetFieldType = (typeof allowedFieldTypes)[number];

export type CalendarTaskPresetSelectorCustomField = Readonly<{
  id: string;
  name: string;
  label: string;
  type: TaskPresetFieldType;
  required: boolean;
  options: readonly string[];
}>;

export type CalendarTaskPresetSelectorOption = Readonly<{
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  taskType: TaskPresetType;
  defaultNeededCount: number;
  volunteerVisible: boolean;
  isSystemPreset: boolean;
  systemKey: string | null;
  customFields: readonly CalendarTaskPresetSelectorCustomField[];
  lifecycle: "active";
}>;

export type CalendarTaskPresetSelectorResult =
  | Readonly<{
      ok: true;
      presets: readonly CalendarTaskPresetSelectorOption[];
      selector: Readonly<{
        table: "task_presets";
        selector: typeof selectorColumns;
        mockFallbackAllowed: false;
        requiresTasksView: true;
      }>;
    }>
  | Readonly<{
      ok: false;
      reason:
        | "missing_tasks_view"
        | "invalid_workspace_id"
        | "query_unavailable"
        | "invalid_projection";
    }>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function asOptionalString(value: unknown) {
  return value === null || value === undefined ? null : asString(value);
}

function asBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function normalizeTaskType(value: unknown): TaskPresetType | null {
  return allowedTaskTypes.includes(value as TaskPresetType)
    ? (value as TaskPresetType)
    : null;
}

function normalizeCustomFieldType(value: unknown): TaskPresetFieldType | null {
  return allowedFieldTypes.includes(value as TaskPresetFieldType)
    ? (value as TaskPresetFieldType)
    : null;
}

function normalizeCustomFields(value: unknown) {
  if (!Array.isArray(value) || value.length > 20) return null;
  const normalized: CalendarTaskPresetSelectorCustomField[] = [];
  const seen = new Set<string>();
  for (const field of value) {
    if (!isRecord(field)) return null;
    const key = asString(field.key);
    const label = asString(field.label);
    const type = normalizeCustomFieldType(field.type);
    const required = asBoolean(field.required);
    const options = Array.isArray(field.options) ? field.options : [];
    if (
      !key ||
      !/^[a-z][a-z0-9_]{0,39}$/.test(key) ||
      seen.has(key) ||
      !label ||
      label.trim() !== label ||
      label.length > 80 ||
      !type ||
      required === null ||
      options.some((option) => typeof option !== "string" || option.length === 0)
    ) {
      return null;
    }
    seen.add(key);
    normalized.push({
      id: key,
      name: key,
      label,
      type,
      required,
      options: options as string[],
    });
  }
  return normalized;
}

function normalizeRow(row: unknown): CalendarTaskPresetSelectorOption | null {
  if (!isRecord(row)) return null;
  const id = asString(row.id);
  const workspaceId = asString(row.workspace_id);
  const name = asString(row.name);
  const description = asOptionalString(row.description);
  const taskType = normalizeTaskType(row.task_type);
  const defaultNeededCount = asNumber(row.default_needed_count);
  const volunteerVisible = asBoolean(row.volunteer_visible);
  const isSystemPreset = asBoolean(row.is_system_preset);
  const systemKey = asOptionalString(row.system_key);
  const customFields = normalizeCustomFields(row.custom_field_definitions);
  if (
    !id ||
    !workspaceId ||
    !name ||
    !taskType ||
    defaultNeededCount === null ||
    defaultNeededCount < 1 ||
    defaultNeededCount > 99 ||
    volunteerVisible === null ||
    isSystemPreset === null ||
    row.lifecycle !== "active" ||
    !customFields
  ) {
    return null;
  }
  return {
    id,
    workspaceId,
    name,
    description,
    taskType,
    defaultNeededCount,
    volunteerVisible,
    isSystemPreset,
    systemKey,
    customFields,
    lifecycle: "active",
  };
}

export async function readCalendarTaskPresetSelectorWithClient(input: {
  client: AppSupabaseClient;
  workspaceId: string;
  canViewTaskPresets: boolean;
}): Promise<CalendarTaskPresetSelectorResult> {
  if (!input.canViewTaskPresets) return { ok: false, reason: "missing_tasks_view" };

  let workspaceId: string;
  try {
    workspaceId = normalizeWorkspaceReference({ id: input.workspaceId }).value;
  } catch {
    return { ok: false, reason: "invalid_workspace_id" };
  }

  const { data, error } = await input.client
    .from("task_presets")
    .select(selectorColumns)
    .eq("workspace_id", workspaceId)
    .eq("lifecycle", "active")
    .order("name", { ascending: true })
    .order("id", { ascending: true });

  if (error || !Array.isArray(data)) return { ok: false, reason: "query_unavailable" };

  const presets = data.map(normalizeRow);
  if (presets.some((preset) => preset === null)) {
    return { ok: false, reason: "invalid_projection" };
  }

  return {
    ok: true,
    presets: presets as CalendarTaskPresetSelectorOption[],
    selector: {
      table: "task_presets",
      selector: selectorColumns,
      mockFallbackAllowed: false,
      requiresTasksView: true,
    },
  };
}
