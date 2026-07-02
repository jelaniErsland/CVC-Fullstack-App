import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  parseCalendarItem,
  validateCreateCalendarItemInput,
  type CalendarItem,
  type CreateCalendarItemInput,
} from "@/lib/calendar/item";
import { createServerSupabaseClient } from "@/lib/supabase/server";
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
].join(",");

async function requireAuthenticatedContact(supabase: SupabaseClient) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Calendar changes require an authenticated contact.");
}

export async function readCalendarItemsWithClient(
  supabase: SupabaseClient,
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
  supabase: SupabaseClient,
  input: CreateCalendarItemInput | unknown,
): Promise<CalendarItemMutationResult> {
  await requireAuthenticatedContact(supabase);
  const item = validateCreateCalendarItemInput(input);
  const presetSource = item.source.kind === "preset";
  const schedule = item.schedule;
  const { data, error } = await supabase.rpc("create_calendar_item", {
    p_workspace_id: item.workspaceId,
    p_task_preset_id: presetSource ? item.source.taskPresetId : null,
    p_one_off_title: presetSource ? null : item.source.title,
    p_one_off_task_type: presetSource ? null : item.source.taskType,
    p_schedule_kind: schedule.kind,
    p_start_date: schedule.kind === "multi_day_window" ? schedule.startDate : schedule.date,
    p_end_date: schedule.kind === "multi_day_window" ? schedule.endDate : null,
    p_start_time: schedule.kind === "timed" ? schedule.startTime : null,
    p_end_time: schedule.kind === "timed" ? schedule.endTime : null,
    p_needed_count: item.neededCount,
    p_schedule_notes: item.notes,
    p_custom_values: item.customValues,
  });
  if (error || typeof data !== "string") {
    throw new Error("Calendar item could not be created.", { cause: error });
  }
  return { calendarItemId: normalizeWorkspaceReference({ id: data }).value };
}

export async function createCalendarItem(input: CreateCalendarItemInput | unknown) {
  const supabase = await createServerSupabaseClient();
  return createCalendarItemWithClient(supabase, input);
}

export async function archiveCalendarItemWithClient(
  supabase: SupabaseClient,
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

