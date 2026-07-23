import "server-only";

import {
  parseCalendarItem,
  validatePublishCalendarItemInput,
  validateCreateCalendarItemInput,
  validateUpdateCalendarOneOffTimedItemInput,
  validateUpdateCalendarPresetTimedItemInput,
  type CalendarItem,
  type CreateCalendarItemInput,
  type PublishCalendarItemInput,
  type UpdateCalendarOneOffTimedItemInput,
  type UpdateCalendarPresetTimedItemInput,
} from "@/lib/calendar/item";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { AppSupabaseClient, PublicRpcArgs } from "@/lib/supabase/types";
import { normalizeWorkspaceReference } from "@/lib/workspaces/identity";

export type CalendarItemMutationResult = Readonly<{ calendarItemId: string }>;

const calendarItemColumns = [
  "id",
  "workspace_id",
  "task_preset_id",
  "title_snapshot",
  "task_type_snapshot",
  "schedule_kind",
  "start_date",
  "end_date",
  "start_time",
  "end_time",
  "timezone",
  "needed_count",
  "schedule_notes",
  "custom_values",
  "lifecycle",
  "created_at",
    "updated_at",
    "follow_up_project_contact_id",
    "created_by_project_contact_id",
    "publication_state",
    "published_at",
    "published_by_project_contact_id",
].join(",");

async function requireAuthenticatedContact(supabase: AppSupabaseClient) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Calendar changes require an authenticated contact.");
}

export async function readCalendarItemsWithClient(
  supabase: AppSupabaseClient,
  workspaceId: string,
): Promise<readonly CalendarItem[]> {
  const normalizedWorkspaceId = normalizeWorkspaceReference({ id: workspaceId }).value;
  const { data, error } = await supabase
    .from("calendar_items")
    .select(calendarItemColumns)
    .eq("workspace_id", normalizedWorkspaceId)
    .order("start_date")
    .order("start_time");
  if (error) throw new Error("Calendar items could not be read.", { cause: error });
  return (data ?? []).map(parseCalendarItem);
}

export async function readCurrentContactCalendarItems(workspaceId: string) {
  const supabase = await createServerSupabaseClient();
  return readCalendarItemsWithClient(supabase, workspaceId);
}

export async function createCalendarItemWithClient(
  supabase: AppSupabaseClient,
  input: CreateCalendarItemInput | unknown,
): Promise<CalendarItemMutationResult> {
  await requireAuthenticatedContact(supabase);
  const item = validateCreateCalendarItemInput(input);
  const presetSource = item.source.kind === "preset";
  const schedule = item.schedule;
  const { data, error } = await supabase.rpc(
    "create_calendar_item",
    {
      p_workspace_id: item.workspaceId,
      p_task_preset_id: presetSource ? item.source.taskPresetId : null,
      p_one_off_title: presetSource ? null : item.source.title,
      p_one_off_task_type: presetSource ? null : item.source.taskType,
      p_schedule_kind: schedule.kind,
      p_start_date:
        schedule.kind === "multi_day_window" ? schedule.startDate : schedule.date,
      p_end_date: schedule.kind === "multi_day_window" ? schedule.endDate : null,
      p_start_time: schedule.kind === "timed" ? schedule.startTime : null,
      p_end_time: schedule.kind === "timed" ? schedule.endTime : null,
      p_needed_count: item.neededCount,
      p_schedule_notes: item.notes ?? null,
      p_custom_values: item.customValues,
    } as PublicRpcArgs<"create_calendar_item">,
  );
  if (error || typeof data !== "string") {
    throw new Error("Calendar item could not be created.", { cause: error });
  }
  return { calendarItemId: normalizeWorkspaceReference({ id: data }).value };
}

export async function createCalendarItem(input: CreateCalendarItemInput | unknown) {
  const supabase = await createServerSupabaseClient();
  return createCalendarItemWithClient(supabase, input);
}

export async function updateCalendarOneOffTimedItemWithClient(
  supabase: AppSupabaseClient,
  input: UpdateCalendarOneOffTimedItemInput | unknown,
): Promise<CalendarItemMutationResult> {
  await requireAuthenticatedContact(supabase);
  const item = validateUpdateCalendarOneOffTimedItemInput(input);
  const { data, error } = await supabase.rpc(
    "update_calendar_item_one_off_timed",
    {
      p_calendar_item_id: item.calendarItemId,
      p_one_off_title: item.source.title,
      p_one_off_task_type: item.source.taskType,
      p_start_date: item.schedule.date,
      p_start_time: item.schedule.startTime,
      p_end_time: item.schedule.endTime,
      p_needed_count: item.neededCount,
      p_schedule_notes: item.notes ?? null,
      p_custom_values: item.customValues,
    } as PublicRpcArgs<"update_calendar_item_one_off_timed">,
  );
  if (error || typeof data !== "string") {
    throw new Error("Calendar item could not be updated.", { cause: error });
  }
  return { calendarItemId: normalizeWorkspaceReference({ id: data }).value };
}

export async function updateCalendarOneOffTimedItem(
  input: UpdateCalendarOneOffTimedItemInput | unknown,
) {
  const supabase = await createServerSupabaseClient();
  return updateCalendarOneOffTimedItemWithClient(supabase, input);
}

export async function updateCalendarPresetTimedItemWithClient(
  supabase: AppSupabaseClient,
  input: UpdateCalendarPresetTimedItemInput | unknown,
): Promise<CalendarItemMutationResult> {
  await requireAuthenticatedContact(supabase);
  const item = validateUpdateCalendarPresetTimedItemInput(input);
  const { data, error } = await supabase.rpc(
    "update_calendar_item_preset_timed",
    {
      p_calendar_item_id: item.calendarItemId,
      p_start_date: item.schedule.date,
      p_start_time: item.schedule.startTime,
      p_end_time: item.schedule.endTime,
      p_needed_count: item.neededCount,
      p_schedule_notes: item.notes ?? null,
      p_custom_values: item.customValues,
    } as PublicRpcArgs<"update_calendar_item_preset_timed">,
  );
  if (error || typeof data !== "string") {
    throw new Error("Calendar item could not be updated.", { cause: error });
  }
  return { calendarItemId: normalizeWorkspaceReference({ id: data }).value };
}

export async function updateCalendarPresetTimedItem(
  input: UpdateCalendarPresetTimedItemInput | unknown,
) {
  const supabase = await createServerSupabaseClient();
  return updateCalendarPresetTimedItemWithClient(supabase, input);
}

export async function publishCalendarItemWithClient(
  supabase: AppSupabaseClient,
  input: PublishCalendarItemInput | unknown,
): Promise<CalendarItemMutationResult> {
  await requireAuthenticatedContact(supabase);
  const item = validatePublishCalendarItemInput(input);
  const { data, error } = await supabase.rpc("publish_calendar_item", {
    p_calendar_item_id: item.calendarItemId,
  } as PublicRpcArgs<"publish_calendar_item">);
  if (error || typeof data !== "string") {
    throw new Error("Calendar item could not be published.", { cause: error });
  }
  return { calendarItemId: normalizeWorkspaceReference({ id: data }).value };
}

export async function publishCalendarItem(input: PublishCalendarItemInput | unknown) {
  const supabase = await createServerSupabaseClient();
  return publishCalendarItemWithClient(supabase, input);
}

export async function archiveCalendarItemWithClient(
  supabase: AppSupabaseClient,
  calendarItemId: string,
): Promise<CalendarItemMutationResult> {
  await requireAuthenticatedContact(supabase);
  const normalizedId = normalizeWorkspaceReference({ id: calendarItemId }).value;
  const { data, error } = await supabase.rpc("archive_calendar_item", {
    p_calendar_item_id: normalizedId,
  });
  if (error || typeof data !== "string") {
    throw new Error("Calendar item could not be archived.", { cause: error });
  }
  return { calendarItemId: normalizeWorkspaceReference({ id: data }).value };
}

export async function archiveCalendarItem(calendarItemId: string) {
  const supabase = await createServerSupabaseClient();
  return archiveCalendarItemWithClient(supabase, calendarItemId);
}

function textFromFormData(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function optionalTextFromFormData(formData: FormData, key: string) {
  const value = textFromFormData(formData, key).trim();
  return value.length > 0 ? value : null;
}

function taskTypeFromFormData(formData: FormData) {
  const value = textFromFormData(formData, "taskType");
  if (value === "food" || value === "security" || value === "custom") return value;
  return "general";
}

function neededCountFromFormData(formData: FormData) {
  const value = Number(textFromFormData(formData, "neededCount"));
  return Number.isInteger(value) ? value : Number.NaN;
}

export function calendarOneOffTimedCreateInputFromFormData(
  formData: FormData,
  workspaceId: string,
): CreateCalendarItemInput {
  return validateCreateCalendarItemInput({
    workspaceId,
    source: {
      kind: "one_off",
      title: textFromFormData(formData, "title"),
      taskType: taskTypeFromFormData(formData),
    },
    schedule: {
      kind: "timed",
      date: textFromFormData(formData, "date"),
      startTime: textFromFormData(formData, "startTime"),
      endTime: textFromFormData(formData, "endTime"),
    },
    neededCount: neededCountFromFormData(formData),
    notes: optionalTextFromFormData(formData, "notes"),
    customValues: {},
  });
}

export function calendarPresetTimedCreateInputFromFormData(
  formData: FormData,
  workspaceId: string,
): CreateCalendarItemInput {
  return validateCreateCalendarItemInput({
    workspaceId,
    source: {
      kind: "preset",
      taskPresetId: textFromFormData(formData, "taskPresetId"),
    },
    schedule: {
      kind: "timed",
      date: textFromFormData(formData, "date"),
      startTime: textFromFormData(formData, "startTime"),
      endTime: textFromFormData(formData, "endTime"),
    },
    neededCount: neededCountFromFormData(formData),
    notes: optionalTextFromFormData(formData, "notes"),
    customValues: {},
  });
}

export function calendarOneOffTimedUpdateInputFromFormData(
  formData: FormData,
): UpdateCalendarOneOffTimedItemInput {
  return validateUpdateCalendarOneOffTimedItemInput({
    calendarItemId: textFromFormData(formData, "calendarItemId"),
    source: {
      title: textFromFormData(formData, "title"),
      taskType: taskTypeFromFormData(formData),
    },
    schedule: {
      kind: "timed",
      date: textFromFormData(formData, "date"),
      startTime: textFromFormData(formData, "startTime"),
      endTime: textFromFormData(formData, "endTime"),
    },
    neededCount: neededCountFromFormData(formData),
    notes: optionalTextFromFormData(formData, "notes"),
    customValues: {},
  });
}

export function calendarPresetTimedUpdateInputFromFormData(
  formData: FormData,
): UpdateCalendarPresetTimedItemInput {
  return validateUpdateCalendarPresetTimedItemInput({
    calendarItemId: textFromFormData(formData, "calendarItemId"),
    schedule: {
      kind: "timed",
      date: textFromFormData(formData, "date"),
      startTime: textFromFormData(formData, "startTime"),
      endTime: textFromFormData(formData, "endTime"),
    },
    neededCount: neededCountFromFormData(formData),
    notes: optionalTextFromFormData(formData, "notes"),
    customValues: {},
  });
}
