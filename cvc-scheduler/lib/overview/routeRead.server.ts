import "server-only";

import {
  isEffectiveWorkspaceReadGrant,
  type ProjectContactGrant,
} from "../auth/grant.ts";
import {
  readCalendarReadModelWithClient,
  type CalendarReadModelQueryClient,
} from "../calendar/readModelQuery.server.ts";
import type { CalendarReadModelItem } from "../calendar/readModel.server.ts";
import type { AppSupabaseClient } from "../supabase/types.ts";
import { readTaskPresetsWithClient } from "../tasks/server.ts";
import { readVolunteerProfilesWithClient } from "../volunteers/server.ts";
import type { WorkspaceIdentity } from "../workspaces/identity.ts";

export const OVERVIEW_PERSISTED_CUTOVER_IMPLEMENTED = true;
export const OVERVIEW_MOCK_FALLBACK_ALLOWED = false;
export const OVERVIEW_SERVICE_ROLE_AVAILABLE = false;
export const OVERVIEW_BROWSER_SCOPE_INPUT_TRUSTED = false;
export const OVERVIEW_GET_MUTATION_AVAILABLE = false;
export const OVERVIEW_UPCOMING_LIMIT = 6;
export const OVERVIEW_REVIEW_SIGNAL_LIMIT = 5;
export const OVERVIEW_RANGE_DAYS = 7;

type OverviewModuleState<T> =
  | Readonly<{ kind: "ready"; value: T }>
  | Readonly<{ kind: "unavailable" }>
  | null;

export type OverviewUpcomingItem = Readonly<{
  id: string;
  title: string;
  startDate: string;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  timezone: string;
  assignedFractionLabel: string;
  publicationState: "draft" | "published";
  href: string;
}>;

export type OverviewReviewSignal = Readonly<{
  id: string;
  kind: "denied" | "unfilled" | "waiting";
  title: string;
  message: string;
  href: string;
}>;

export type OverviewQuickAction = Readonly<{
  kind: "calendar" | "tasks" | "volunteers";
  href: string;
  label: string;
  note: string;
}>;

export type OverviewCalendarSummary = Readonly<{
  upcomingItems: readonly OverviewUpcomingItem[];
  reviewSignals: readonly OverviewReviewSignal[];
  scheduledCount: number;
  pendingResponseCount: number;
}>;

export type OverviewReadyRouteState = Readonly<{
  kind: "ready";
  workspaceName: string;
  workspaceTimezone: string;
  workspaceStartsOn: string | null;
  workspaceEndsOn: string | null;
  today: string;
  calendar: OverviewModuleState<OverviewCalendarSummary>;
  tasks: OverviewModuleState<Readonly<{ activeCount: number }>>;
  volunteers: OverviewModuleState<Readonly<{ readyActiveCount: number }>>;
  actions: readonly OverviewQuickAction[];
  isEmpty: boolean;
}>;

export type OverviewRouteState =
  | OverviewReadyRouteState
  | Readonly<{
      kind: "unavailable" | "error";
      title: string;
      message: string;
    }>;

type OverviewWorkspaceSelection =
  | Readonly<{
      ok: true;
      workspace: WorkspaceIdentity;
      projectContactId: string;
      capabilities: readonly string[];
    }>
  | Readonly<{
      ok: false;
      reason: "unauthorized" | "workspace_unavailable";
    }>;

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function dateInWorkspaceTimezone(at: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

/**
 * Applies the same active-grant plus RLS-visible-workspace resolution used by
 * Calendar, Tasks, and Volunteers, but requires only workspace.read for the
 * base project home. Multiple eligible workspaces fail closed because the
 * browser never supplies workspace scope.
 */
export function selectOverviewWorkspaceContext(input: {
  projectContactId: string;
  ownGrants: readonly ProjectContactGrant[];
  workspaces: readonly WorkspaceIdentity[];
  at?: Date;
}): OverviewWorkspaceSelection {
  if (input.ownGrants.length === 0) return { ok: false, reason: "unauthorized" };

  const activeWorkspaces = new Map(
    input.workspaces
      .filter((workspace) => workspace.lifecycle === "active")
      .map((workspace) => [workspace.id, workspace]),
  );
  const eligible = new Map<
    string,
    { workspace: WorkspaceIdentity; capabilities: Set<string> }
  >();

  for (const grant of input.ownGrants) {
    if (grant.projectContactId !== input.projectContactId) continue;
    if (!isEffectiveWorkspaceReadGrant(grant, input.at)) continue;
    const workspace = activeWorkspaces.get(grant.workspaceId);
    if (!workspace) continue;
    const current = eligible.get(workspace.id) ?? {
      workspace,
      capabilities: new Set<string>(),
    };
    for (const capability of grant.capabilities) current.capabilities.add(capability);
    eligible.set(workspace.id, current);
  }

  if (eligible.size !== 1) {
    return { ok: false, reason: "workspace_unavailable" };
  }

  const selected = [...eligible.values()][0];
  return {
    ok: true,
    workspace: selected.workspace,
    projectContactId: input.projectContactId,
    capabilities: [...selected.capabilities].sort(),
  };
}

function calendarHref(item: Pick<CalendarReadModelItem, "startDate">) {
  const params = new URLSearchParams({ view: "day", date: item.startDate });
  return `/admin/calendar?${params.toString()}`;
}

function countLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function summarizeOverviewCalendar(
  items: readonly CalendarReadModelItem[],
  rangeStart: string,
  rangeEnd: string,
): OverviewCalendarSummary {
  const relevant = items
    .filter((item) => {
      if (["archived", "canceled", "completed"].includes(item.lifecycle)) return false;
      const itemEnd = item.endDate ?? item.startDate;
      return item.startDate < rangeEnd && itemEnd >= rangeStart;
    })
    .sort((left, right) =>
      left.startDate.localeCompare(right.startDate) ||
      (left.startTime ?? "").localeCompare(right.startTime ?? "") ||
      left.taskSourceLabel.localeCompare(right.taskSourceLabel) ||
      left.calendarItemId.localeCompare(right.calendarItemId),
    );

  const upcomingItems = relevant.slice(0, OVERVIEW_UPCOMING_LIMIT).map((item) => ({
    id: item.calendarItemId,
    title: item.taskSourceLabel,
    startDate: item.startDate,
    endDate: item.endDate,
    startTime: item.startTime,
    endTime: item.endTime,
    timezone: item.timezone,
    assignedFractionLabel: item.assignedFractionLabel,
    publicationState: item.publicationState,
    href: calendarHref(item),
  }));

  const candidates: OverviewReviewSignal[] = [];
  for (const item of relevant) {
    const href = calendarHref(item);
    if (item.coverage.deniedCount > 0) {
      candidates.push({
        id: `${item.calendarItemId}:denied`,
        kind: "denied",
        title: item.taskSourceLabel,
        message: `${countLabel(item.coverage.deniedCount, "volunteer")} can’t make it`,
        href,
      });
    }
    if (item.coverage.unassignedCount > 0) {
      candidates.push({
        id: `${item.calendarItemId}:unfilled`,
        kind: "unfilled",
        title: item.taskSourceLabel,
        message: `${countLabel(item.coverage.unassignedCount, "volunteer")} still needed`,
        href,
      });
    }
    if (item.coverage.waitingOnConfirmationCount > 0) {
      candidates.push({
        id: `${item.calendarItemId}:waiting`,
        kind: "waiting",
        title: item.taskSourceLabel,
        message: `${countLabel(item.coverage.waitingOnConfirmationCount, "response")} pending`,
        href,
      });
    }
  }

  const priority = { denied: 0, unfilled: 1, waiting: 2 } as const;
  const reviewSignals = candidates
    .sort((left, right) => priority[left.kind] - priority[right.kind])
    .slice(0, OVERVIEW_REVIEW_SIGNAL_LIMIT);

  return {
    upcomingItems,
    reviewSignals,
    scheduledCount: relevant.length,
    pendingResponseCount: relevant.reduce(
      (count, item) => count + item.coverage.waitingOnConfirmationCount,
      0,
    ),
  };
}

export function buildOverviewQuickActions(
  capabilities: readonly string[],
  today: string,
): readonly OverviewQuickAction[] {
  const allowed = new Set(capabilities);
  const actions: OverviewQuickAction[] = [];
  if (allowed.has("calendar.view") && allowed.has("assignments.view")) {
    actions.push({
      kind: "calendar",
      href: `/admin/calendar?view=week&date=${today}`,
      label: allowed.has("calendar.edit") ? "Schedule work" : "Open Calendar",
      note: allowed.has("calendar.edit") ? "Add or review this week" : "Review this week",
    });
  }
  if (allowed.has("tasks.view")) {
    actions.push({
      kind: "tasks",
      href: "/admin/tasks",
      label: allowed.has("tasks.edit") ? "New task" : "Open Tasks",
      note: allowed.has("tasks.edit") ? "Build reusable work" : "Browse reusable work",
    });
  }
  if (allowed.has("volunteers.view")) {
    actions.push({
      kind: "volunteers",
      href: "/admin/volunteers",
      label: allowed.has("volunteers.edit") ? "Add volunteer" : "Open Volunteers",
      note: allowed.has("volunteers.edit") ? "Keep the directory ready" : "Browse the directory",
    });
  }
  return actions;
}

export function summarizeOverviewTasks(
  presets: readonly Readonly<{ lifecycle: string }>[],
) {
  return { activeCount: presets.filter((preset) => preset.lifecycle === "active").length };
}

export function summarizeOverviewVolunteers(
  profiles: readonly Readonly<{ lifecycle: string; readinessStatus: string }>[],
) {
  return {
    readyActiveCount: profiles.filter(
      (profile) => profile.lifecycle === "active" && profile.readinessStatus === "ready",
    ).length,
  };
}

export async function readOverviewRouteContext() {
  const { readVerifiedAdminContext } = await import(
    "../auth/verified-admin-context.server.ts"
  );
  const verified = await readVerifiedAdminContext();
  if (!verified) return null;
  const selection = selectOverviewWorkspaceContext({
    projectContactId: verified.projectContactId,
    ownGrants: verified.ownGrants,
    workspaces: verified.workspaces,
  });
  if (!selection.ok) return null;
  return { supabase: verified.supabase, ...selection } as const;
}

async function readOptionalCalendar(
  client: AppSupabaseClient,
  workspace: WorkspaceIdentity,
  projectContactId: string,
  capabilities: ReadonlySet<string>,
  rangeStart: string,
  rangeEnd: string,
): Promise<OverviewReadyRouteState["calendar"]> {
  if (!capabilities.has("calendar.view") || !capabilities.has("assignments.view")) {
    return null;
  }
  try {
    const result = await readCalendarReadModelWithClient({
      client: client as unknown as CalendarReadModelQueryClient,
      workspaceId: workspace.id,
      actorContactId: projectContactId,
      workspaceTimezone: workspace.timezone,
      rangeStart,
      rangeEnd,
      periodKind: "list",
      capabilities: ["calendar.view", "assignments.view"],
    });
    return result.ok
      ? { kind: "ready", value: summarizeOverviewCalendar(result.items, rangeStart, rangeEnd) }
      : { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}

async function readOptionalTasks(
  client: AppSupabaseClient,
  workspaceId: string,
  capabilities: ReadonlySet<string>,
): Promise<OverviewReadyRouteState["tasks"]> {
  if (!capabilities.has("tasks.view")) return null;
  try {
    const presets = await readTaskPresetsWithClient(client, workspaceId);
    return {
      kind: "ready",
      value: summarizeOverviewTasks(presets),
    };
  } catch {
    return { kind: "unavailable" };
  }
}

async function readOptionalVolunteers(
  client: AppSupabaseClient,
  workspaceId: string,
  capabilities: ReadonlySet<string>,
): Promise<OverviewReadyRouteState["volunteers"]> {
  if (!capabilities.has("volunteers.view")) return null;
  try {
    const profiles = await readVolunteerProfilesWithClient(client, workspaceId);
    return {
      kind: "ready",
      value: summarizeOverviewVolunteers(profiles),
    };
  } catch {
    return { kind: "unavailable" };
  }
}

export async function readOverviewRouteState(at = new Date()): Promise<OverviewRouteState> {
  try {
    const context = await readOverviewRouteContext();
    if (!context) {
      return {
        kind: "unavailable",
        title: "Overview is unavailable",
        message: "We could not safely open a single active project workspace for this account.",
      };
    }

    const today = dateInWorkspaceTimezone(at, context.workspace.timezone);
    const rangeEnd = addDays(today, OVERVIEW_RANGE_DAYS);
    const capabilities = new Set(context.capabilities);
    const [calendar, tasks, volunteers] = await Promise.all([
      readOptionalCalendar(
        context.supabase,
        context.workspace,
        context.projectContactId,
        capabilities,
        today,
        rangeEnd,
      ),
      readOptionalTasks(context.supabase, context.workspace.id, capabilities),
      readOptionalVolunteers(context.supabase, context.workspace.id, capabilities),
    ]);
    const calendarCount = calendar?.kind === "ready" ? calendar.value.scheduledCount : 0;
    const taskCount = tasks?.kind === "ready" ? tasks.value.activeCount : 0;
    const volunteerCount = volunteers?.kind === "ready" ? volunteers.value.readyActiveCount : 0;

    return {
      kind: "ready",
      workspaceName: context.workspace.displayName,
      workspaceTimezone: context.workspace.timezone,
      workspaceStartsOn: context.workspace.startsOn,
      workspaceEndsOn: context.workspace.endsOn,
      today,
      calendar,
      tasks,
      volunteers,
      actions: buildOverviewQuickActions(context.capabilities, today),
      isEmpty: calendarCount === 0 && taskCount === 0 && volunteerCount === 0,
    };
  } catch {
    return {
      kind: "error",
      title: "Overview could not be loaded",
      message: "Something went wrong while loading this project home. Please try again.",
    };
  }
}

export function describeOverviewCutover() {
  return {
    persistedCutoverImplemented: OVERVIEW_PERSISTED_CUTOVER_IMPLEMENTED,
    mockFallbackAllowed: OVERVIEW_MOCK_FALLBACK_ALLOWED,
    serviceRoleAvailable: OVERVIEW_SERVICE_ROLE_AVAILABLE,
    browserScopeInputTrusted: OVERVIEW_BROWSER_SCOPE_INPUT_TRUSTED,
    getMutationAvailable: OVERVIEW_GET_MUTATION_AVAILABLE,
    baseCapability: "workspace.read",
    calendarCapabilities: ["calendar.view", "assignments.view"],
    tasksCapability: "tasks.view",
    volunteersCapability: "volunteers.view",
    upcomingLimit: OVERVIEW_UPCOMING_LIMIT,
    reviewSignalLimit: OVERVIEW_REVIEW_SIGNAL_LIMIT,
    rangeDays: OVERVIEW_RANGE_DAYS,
  } as const;
}
