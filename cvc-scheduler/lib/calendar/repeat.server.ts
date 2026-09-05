import "server-only";

import type { AppSupabaseClient, PublicRpcArgs } from "../supabase/types.ts";
import { normalizeWorkspaceReference } from "../workspaces/identity.ts";
import {
  validateCreateRepeatedCalendarItemsInput,
  type CreateRepeatedCalendarItemsInput,
} from "./repeat.ts";

export async function createRepeatedCalendarItemsWithClient(
  supabase: AppSupabaseClient,
  input: CreateRepeatedCalendarItemsInput | unknown,
) {
  const value = validateCreateRepeatedCalendarItemsInput(input);
  const { data, error } = await supabase.rpc(
    "create_current_workspace_repeated_calendar_items",
    {
      p_request_key: value.requestKey,
      p_task_preset_id: value.source.kind === "preset" ? value.source.taskPresetId : null,
      p_one_off_title: value.source.kind === "one_off" ? value.source.title : null,
      p_one_off_task_type: value.source.kind === "one_off" ? value.source.taskType : null,
      p_start_date: value.startDate,
      p_end_date: value.endDate,
      p_weekdays: [...value.weekdays],
      p_start_time: value.startTime,
      p_end_time: value.endTime,
      p_needed_count: value.neededCount,
      p_schedule_notes: value.notes,
      p_custom_values: value.customValues,
    } as PublicRpcArgs<"create_current_workspace_repeated_calendar_items">,
  );
  if (error || !Array.isArray(data) || data.length === 0) {
    throw new Error("Repeated Calendar items could not be created.", { cause: error });
  }
  return data.map((id) => normalizeWorkspaceReference({ id }).value);
}
