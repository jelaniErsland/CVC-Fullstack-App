import "server-only";

import type { AppSupabaseClient } from "../supabase/types.ts";

export type MatchingAssignmentItem = Readonly<{
  id: string;
  date: string;
  endDate: string | null;
  title: string;
  startTime: string | null;
  endTime: string | null;
}>;
export type MatchingAssignmentCursor = Readonly<{ month: string; offset: number }>;
export type MatchingAssignmentItemsState =
  | Readonly<{ kind: "ready"; month: string; items: readonly MatchingAssignmentItem[]; nextCursor: MatchingAssignmentCursor | null }>
  | Readonly<{ kind: "unavailable" }>;

const pageSize = 120;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
function nextMonth(month: string) {
  const [year, number] = month.split("-").map(Number);
  return new Date(Date.UTC(year, number, 1)).toISOString().slice(0, 7);
}
function lastDay(month: string) {
  const [year, number] = month.split("-").map(Number);
  return new Date(Date.UTC(year, number, 0)).toISOString().slice(0, 10);
}
function validDate(value: string) {
  return datePattern.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`))
    && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
}

export async function readMatchingAssignmentItemsWithClient(input: {
  client: AppSupabaseClient;
  workspaceId: string;
  sourceId: string;
  sourceDate: string;
  cursor: MatchingAssignmentCursor;
  projectStartsOn: string | null;
  projectEndsOn: string | null;
}): Promise<MatchingAssignmentItemsState> {
  const { client, workspaceId, sourceId, sourceDate, cursor, projectStartsOn, projectEndsOn } = input;
  if (!uuid.test(workspaceId) || !uuid.test(sourceId) || !validDate(sourceDate)
    || !monthPattern.test(cursor.month) || cursor.month < sourceDate.slice(0, 7)
    || !Number.isInteger(cursor.offset) || cursor.offset < 0 || cursor.offset > 10000
    || projectStartsOn && !validDate(projectStartsOn) || projectEndsOn && !validDate(projectEndsOn)
    || projectEndsOn && cursor.month > projectEndsOn.slice(0, 7)) return { kind: "unavailable" };
  try {
    const sourceResult = await client.rpc("read_authorized_calendar_items", {
      p_workspace_id: workspaceId, p_range_start: sourceDate, p_range_end: sourceDate,
    }).select("id,workspace_id,task_preset_id,title_snapshot,start_date,lifecycle,publication_state")
      .eq("workspace_id", workspaceId).eq("id", sourceId).eq("start_date", sourceDate)
      .eq("lifecycle", "active").eq("publication_state", "published").limit(1);
    const source = sourceResult.data?.[0];
    if (sourceResult.error || !source) return { kind: "unavailable" };
    const monthStart = `${cursor.month}-01`;
    const start = projectStartsOn && projectStartsOn > monthStart ? projectStartsOn : monthStart;
    const endOfMonth = lastDay(cursor.month);
    const end = projectEndsOn && projectEndsOn < endOfMonth ? projectEndsOn : endOfMonth;
    if (start > end) return { kind: "ready", month: cursor.month, items: [], nextCursor: projectEndsOn && nextMonth(cursor.month) > projectEndsOn.slice(0, 7) ? null : { month: nextMonth(cursor.month), offset: 0 } };
    let query = client.rpc("read_authorized_calendar_items", {
      p_workspace_id: workspaceId, p_range_start: start, p_range_end: end,
    }).select("id,workspace_id,task_preset_id,title_snapshot,start_date,end_date,start_time,end_time,lifecycle,publication_state")
      .eq("workspace_id", workspaceId).eq("lifecycle", "active").eq("publication_state", "published")
      .gte("start_date", start).lte("start_date", end).neq("id", sourceId);
    query = source.task_preset_id ? query.eq("task_preset_id", source.task_preset_id)
      : query.is("task_preset_id", null).eq("title_snapshot", source.title_snapshot);
    const result = await query.order("start_date", { ascending: true })
      .order("start_time", { ascending: true }).order("id", { ascending: true })
      .range(cursor.offset, cursor.offset + pageSize);
    if (result.error || !result.data) return { kind: "unavailable" };
    const hasNextPage = result.data.length > pageSize;
    const next = nextMonth(cursor.month);
    const nextCursor = hasNextPage ? { month: cursor.month, offset: cursor.offset + pageSize }
      : projectEndsOn && next > projectEndsOn.slice(0, 7) ? null : { month: next, offset: 0 };
    return {
      kind: "ready", month: cursor.month, nextCursor,
      items: result.data.slice(0, pageSize).map(row => ({
        id: row.id, date: row.start_date, endDate: row.end_date,
        title: row.title_snapshot, startTime: row.start_time, endTime: row.end_time,
      })),
    };
  } catch {
    return { kind: "unavailable" };
  }
}
