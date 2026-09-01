import "server-only";

import type { VerifiedAdminContext } from "../auth/verified-admin-context.server.ts";
import {
  selectAuthorizedOperationalWorkspace,
  normalizeProjectDate,
  parseProjectDay,
  selectOperationalWorkspace,
} from "./projectDay.ts";
import {
  buildFoodOperationalProjection,
  buildQuickViewSafeProjection,
  type OperationalScheduleSource,
} from "./projections.ts";

const safeScheduleColumns =
  "title_snapshot,task_type_snapshot,schedule_kind,start_date,end_date,start_time,end_time,needed_count,lifecycle,publication_state";

function parseScheduleSource(value: unknown): OperationalScheduleSource {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Operational schedule projection is invalid.");
  }
  const row = value as Record<string, unknown>;
  const taskType = row.task_type_snapshot;
  const scheduleKind = row.schedule_kind;
  const lifecycle = row.lifecycle;
  const publicationState = row.publication_state;
  if (
    typeof row.title_snapshot !== "string" ||
    !["general", "food", "security", "custom"].includes(String(taskType)) ||
    !["timed", "date_based", "multi_day_window", "milestone"].includes(String(scheduleKind)) ||
    !["active", "archived", "canceled"].includes(String(lifecycle)) ||
    !["draft", "published"].includes(String(publicationState)) ||
    typeof row.start_date !== "string" ||
    (row.end_date !== null && typeof row.end_date !== "string") ||
    (row.start_time !== null && typeof row.start_time !== "string") ||
    (row.end_time !== null && typeof row.end_time !== "string") ||
    !Number.isInteger(row.needed_count)
  ) {
    throw new Error("Operational schedule projection is invalid.");
  }
  return {
    title: row.title_snapshot,
    taskType: taskType as OperationalScheduleSource["taskType"],
    scheduleKind: scheduleKind as OperationalScheduleSource["scheduleKind"],
    startDate: row.start_date,
    endDate: row.end_date as string | null,
    startTime: row.start_time as string | null,
    endTime: row.end_time as string | null,
    neededCount: row.needed_count as number,
    lifecycle: lifecycle as OperationalScheduleSource["lifecycle"],
    publicationState: publicationState as OperationalScheduleSource["publicationState"],
  };
}

async function readSafeOperationalSources(
  context: VerifiedAdminContext,
  workspaceId: string,
  date: string,
) {
  const [projectDayResult, scheduleResult] = await Promise.all([
    context.supabase
      .from("project_days")
      .select("project_date,expected_on_site_count,created_at,updated_at")
      .eq("workspace_id", workspaceId)
      .eq("project_date", date)
      .maybeSingle(),
    context.supabase
      .from("calendar_items")
      .select(safeScheduleColumns)
      .eq("workspace_id", workspaceId)
      .eq("lifecycle", "active")
      .eq("publication_state", "published")
      .neq("task_type_snapshot", "security")
      .or(`start_date.eq.${date},and(start_date.lte.${date},end_date.gte.${date})`)
      .order("start_time")
      .order("title_snapshot"),
  ]);
  if (projectDayResult.error || scheduleResult.error) {
    throw new Error("Operational projection could not be read.", {
      cause: projectDayResult.error ?? scheduleResult.error,
    });
  }
  return {
    projectDay:
      projectDayResult.data === null ? null : parseProjectDay(projectDayResult.data),
    schedule: (scheduleResult.data ?? []).map(parseScheduleSource),
  };
}

/**
 * Future Quick View owner: an authenticated, verified project-contact context.
 * This is deliberately not a public project-name/key lookup and is not routed yet.
 */
export async function readAuthorizedQuickViewSafeProjection(
  context: VerifiedAdminContext,
  dateInput: unknown,
  workspaceKeyInput?: unknown,
) {
  const date = normalizeProjectDate(dateInput);
  const selection = workspaceKeyInput === undefined
    ? selectOperationalWorkspace({
        projectContactId: context.projectContactId,
        ownGrants: context.ownGrants,
        workspaces: context.workspaces,
        requiredCapability: "calendar.view",
      })
    : selectAuthorizedOperationalWorkspace({
        projectContactId: context.projectContactId,
        ownGrants: context.ownGrants,
        workspaces: context.workspaces,
        requiredCapability: "calendar.view",
        workspaceKey: workspaceKeyInput,
      });
  if (!selection || !("workspace" in selection) || ("ok" in selection && !selection.ok)) {
    throw new Error("Quick View is unavailable.");
  }
  const source = await readSafeOperationalSources(
    context,
    selection.workspace.id,
    date,
  );
  return buildQuickViewSafeProjection({
    projectDisplayName: selection.workspace.displayName,
    date,
    ...source,
  });
}

export async function readAuthorizedFoodOperationalProjection(
  context: VerifiedAdminContext,
  dateInput: unknown,
) {
  const date = normalizeProjectDate(dateInput);
  const selection = selectOperationalWorkspace({
    projectContactId: context.projectContactId,
    ownGrants: context.ownGrants,
    workspaces: context.workspaces,
    requiredCapability: "calendar.view",
  });
  if (!selection.ok) throw new Error("Food operational data is unavailable.");
  const source = await readSafeOperationalSources(
    context,
    selection.workspace.id,
    date,
  );
  return buildFoodOperationalProjection({ date, ...source });
}
