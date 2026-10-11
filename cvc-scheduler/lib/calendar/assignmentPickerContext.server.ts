import "server-only";

import { randomUUID } from "node:crypto";
import { validateBulkAssignmentPlan, type BulkAssignmentPlan, type BulkAssignmentPreview } from "./bulkAssignments.ts";
import type { PickerContextState, PickerVolunteerContext } from "./assignmentPickerContext.ts";
import type { AppSupabaseClient } from "../supabase/types.ts";
import type { Json } from "../supabase/database.types.ts";
import { withReadTimeout } from "../readTimeout.ts";

const batchSize = 25;
const batchConcurrency = 4;
function chunks<T>(values: readonly T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

export async function readAssignmentPickerContextWithClient(input: {
  client: AppSupabaseClient;
  workspaceId: string;
  plan: BulkAssignmentPlan;
  candidateIds: readonly string[];
}): Promise<PickerContextState> {
  const controller = new AbortController();
  const deadline = Date.now() + 15_000;
  const read = <T>(query: PromiseLike<T> & { abortSignal?: (signal: AbortSignal) => PromiseLike<T> }) =>
    withReadTimeout(query.abortSignal?.(controller.signal) ?? query, Math.max(1, deadline - Date.now()));
  async function readChunks<T>(ids: readonly string[], query: (ids: string[]) => PromiseLike<T> & { abortSignal?: (signal: AbortSignal) => PromiseLike<T> }) {
    const results: T[] = [];
    for (const wave of chunks(chunks(ids, 120), batchConcurrency)) {
      results.push(...await Promise.all(wave.map(ids => read(query(ids)))));
    }
    return results;
  }
  try {
    if (!input.candidateIds.length || input.candidateIds.length > 1000) return { kind: "unavailable" };
    const volunteers: PickerVolunteerContext[] = [];
    const conflicts = new Map<string, { volunteerId: string; assignmentId: string }>();
    let selectedItems: BulkAssignmentPreview["items"] | null = null;
    for (const wave of chunks(chunks(input.candidateIds, batchSize), batchConcurrency)) {
      const results = await read(Promise.all(wave.map(async ids => {
        const plan = validateBulkAssignmentPlan({ ...input.plan, volunteers: ids.map(id => ({ id, excludeDates: [] })), note: null }, input.workspaceId, randomUUID());
        const { data, error } = await read(input.client.rpc("plan_calendar_assignments", {
          p_workspace_id: input.workspaceId,
          p_request_id: randomUUID(),
          p_plan: plan as Json,
          // The generated signature marks this nullable SQL argument as non-null.
          p_expected_preview: null as unknown as string,
        }));
        if (error || !data || typeof data !== "object" || Array.isArray(data)) throw new Error("Context unavailable");
        const preview = data as unknown as BulkAssignmentPreview;
        if (preview.saved !== false || !Array.isArray(preview.items) || !Array.isArray(preview.sameDayWork)) throw new Error("Context unavailable");
        return { ids, preview };
      })));
      // Merge in candidate order, regardless of network completion order. A
      // failed wave returns no partial availability and starts no further work.
      for (const { ids, preview } of results) {
        selectedItems ??= preview.items;
        for (const row of preview.sameDayWork) conflicts.set(row.assignmentId, { volunteerId: row.volunteerId, assignmentId: row.assignmentId });
        for (const id of ids) volunteers.push({
          volunteerId: id,
          conflicts: [],
          awayPeriods: [],
        });
      }
    }
    if (!selectedItems?.length) return { kind: "unavailable" };
    const rangeStart = selectedItems.map(item => item.date).sort()[0];
    const rangeThrough = selectedItems.map(item => item.endDate ?? item.date).sort().at(-1)!;
    const awayResult = await read(input.client.rpc("read_assignment_picker_away_periods", {
      p_workspace_id: input.workspaceId,
      p_volunteer_ids: [...input.candidateIds],
      p_from: rangeStart,
      p_through: rangeThrough,
    }));
    if (awayResult.error || !awayResult.data) return { kind: "unavailable" };
    const byVolunteer = new Map(volunteers.map(row => [row.volunteerId, row]));
    for (const period of awayResult.data) {
      const person = byVolunteer.get(period.volunteer_profile_id);
      if (!person) return { kind: "unavailable" };
      (person.awayPeriods as Array<(typeof person.awayPeriods)[number]>).push({ start: period.starts_on, end: period.ends_on });
    }
    const conflictIds = [...conflicts.keys()];
    if (!conflictIds.length) return { kind: "ready", volunteers };
    const assignmentRows = await readChunks(conflictIds, ids => input.client.from("calendar_assignments")
      .select("id,calendar_item_id,volunteer_profile_id").eq("workspace_id", input.workspaceId).in("id", ids));
    const responses = await readChunks(conflictIds, ids => input.client.from("assignment_responses")
      .select("assignment_id,response_status,updated_at").eq("workspace_id", input.workspaceId).in("assignment_id", ids).order("updated_at", { ascending: false }));
    if (assignmentRows.some(result => result.error) || responses.some(result => result.error)) return { kind: "unavailable" };
    const status = new Map<string, string>();
    for (const row of responses.flatMap(result => result.data ?? [])) if (!status.has(row.assignment_id)) status.set(row.assignment_id, row.response_status);
    const assignments = assignmentRows.flatMap(result => result.data ?? []).filter(row => conflicts.has(row.id) && status.get(row.id) !== "declined");
    const itemIds = [...new Set(assignments.map(row => row.calendar_item_id))];
    const itemResults = await readChunks(itemIds, ids => input.client.from("calendar_items")
      .select("id,title_snapshot,start_date,end_date,start_time,end_time").eq("workspace_id", input.workspaceId).in("id", ids));
    if (itemResults.some(result => result.error)) return { kind: "unavailable" };
    const items = new Map(itemResults.flatMap(result => result.data ?? []).map(item => [item.id, item]));
    for (const assignment of assignments) {
      const item = items.get(assignment.calendar_item_id);
      const person = byVolunteer.get(assignment.volunteer_profile_id);
      if (!item || !person) return { kind: "unavailable" };
      (person.conflicts as Array<(typeof person.conflicts)[number]>).push({
        assignmentId: assignment.id,
        date: item.start_date,
        endDate: item.end_date,
        title: item.title_snapshot,
        startTime: item.start_time,
        endTime: item.end_time,
      });
    }
    return { kind: "ready", volunteers };
  } catch {
    return { kind: "unavailable" };
  } finally {
    controller.abort();
  }
}
