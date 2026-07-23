import "server-only";

import {
  isEffectiveWorkspaceReadGrant,
  type ProjectContactGrant,
} from "../auth/grant.ts";
import {
  getCalendarRouteCutoverStatePrototypePresentation,
  type CalendarRouteCutoverErrorReason,
  type CalendarRouteCutoverUnavailableReason,
} from "./routeCutoverStatePrototype.server.ts";
import {
  readCalendarReadModelWithClient,
  type CalendarReadModelQueryClient,
  type CalendarReadModelQueryFailureReason,
} from "./readModelQuery.server.ts";
import {
  readCalendarTaskPresetSelectorWithClient,
  type CalendarTaskPresetSelectorOption,
} from "./taskPresetSelector.server.ts";
import {
  readCalendarAssignmentPickerWithClient,
  type CalendarAssignmentPickerAssignment,
  type CalendarAssignmentPickerVolunteer,
} from "./assignmentPicker.server.ts";
import type {
  CalendarReadModelItem,
  CalendarReadModelPeriodKind,
} from "./readModel.server.ts";
import type { AppSupabaseClient } from "../supabase/types.ts";
import type { WorkspaceIdentity } from "../workspaces/identity.ts";

type CalendarClientCategory =
  | "general"
  | "lunch"
  | "security"
  | "cleanup"
  | "construction"
  | "custom";
type CalendarClientStatus =
  | "open"
  | "partiallyFilled"
  | "filled"
  | "needsReview"
  | "draftMock";
type CalendarClientTaskPresetCustomField = {
  id: string;
  name: string;
  label: string;
  type: "shortText" | "longText" | "number" | "select" | "checkbox";
  required?: boolean;
  options?: string[];
};
type CalendarClientTaskPreset = {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  category: CalendarClientCategory;
  neededCount: number;
  visibility: "mainContacts" | "allContacts" | "volunteers";
  customFields: CalendarClientTaskPresetCustomField[];
  isSystemPreset?: boolean;
  sourcePresetId?: string;
};
type CalendarClientItem = {
  id: string;
  projectId: string;
  taskPresetId?: string;
  displayName?: string;
  date: string;
  endDate?: string;
  allDay?: boolean;
  startTime?: string;
  endTime?: string;
  startTimeValue?: string;
  endTimeValue?: string;
  timeWindow?: string;
  category: CalendarClientCategory;
  assignedVolunteerIds: string[];
  assignments: CalendarClientAssignment[];
  filledCount: number;
  neededCount: number;
  status: CalendarClientStatus;
  scheduleNotes?: string;
  taskPreset?: CalendarClientTaskPreset;
  oneOffTask?: {
    name: string;
    category: CalendarClientCategory;
    neededCount: number;
    customFields: never[];
  };
};
type CalendarClientAssignment = {
  assignmentId: string;
  calendarItemId: string;
  volunteerProfileId: string;
  volunteerDisplayName: string;
  volunteerCongregation: string | null;
  responseStatus: "needs_response" | "confirmed" | "declined";
};
export type CalendarRouteView = CalendarReadModelPeriodKind;
export type CalendarRouteQueriedRange = Readonly<{
  rangeStart: string;
  rangeEnd: string;
  periodKind: CalendarRouteView;
  anchorDate: string;
  bounded: true;
  rangeSemantics: "server_derived_start_inclusive_end_exclusive";
}>;
type CalendarClientStateBase = Readonly<{
  view: CalendarRouteView;
  anchorDate: string;
  queriedRange: CalendarRouteQueriedRange;
}>;
type CalendarTaskPresetSelectorClientState =
  | Readonly<{ kind: "ready_with_presets"; presets: readonly CalendarClientTaskPreset[] }>
  | Readonly<{ kind: "ready_empty"; presets: readonly [] }>
  | Readonly<{ kind: "unavailable"; reason: "missing_tasks_view" }>
  | Readonly<{ kind: "error"; reason: "query_unavailable" | "invalid_projection" }>;
type CalendarAssignmentPickerClientState =
  | Readonly<{
      kind: "ready";
      volunteers: readonly CalendarAssignmentPickerVolunteer[];
      assignments: readonly CalendarClientAssignment[];
    }>
  | Readonly<{ kind: "unavailable"; reason: "missing_volunteers_view" }>
  | Readonly<{ kind: "error"; reason: "query_unavailable" | "invalid_projection" }>;
type CalendarClientState =
  | (CalendarClientStateBase &
      Readonly<{
        kind: "ready_with_items" | "ready_empty";
        items: CalendarClientItem[];
        canEdit: boolean;
        canEditAssignments: boolean;
        canViewVolunteers: boolean;
        canViewTaskPresets: boolean;
        taskPresetSelector: CalendarTaskPresetSelectorClientState;
        assignmentPicker: CalendarAssignmentPickerClientState;
      }>)
  | (CalendarClientStateBase &
      Readonly<{ kind: "unavailable" | "error"; title: string; message: string }>);

type CalendarRouteSearchParams =
  | Record<string, string | string[] | undefined>
  | undefined;

type CalendarRouteWorkspaceSelection =
  | Readonly<{
      ok: true;
      workspace: WorkspaceIdentity;
      projectContactId: string;
      capabilities: readonly ["calendar.view", "assignments.view"];
      canEdit: boolean;
      canEditAssignments: boolean;
      canViewVolunteers: boolean;
      canViewTaskPresets: boolean;
    }>
  | Readonly<{
      ok: false;
      reason:
        | "unauthorized"
        | "missing_calendar_view"
        | "missing_assignments_view"
        | "workspace_unavailable";
    }>;

export const CALENDAR_ROUTE_PERSISTED_READ_CUTOVER_IMPLEMENTED = true;
export const CALENDAR_ROUTE_PERSISTED_READ_ONLY = false;
export const CALENDAR_ROUTE_PERSISTED_WRITE_AVAILABLE = true;
export const CALENDAR_ROUTE_MOCK_TO_REAL_MIXING_ALLOWED = false;
export const CALENDAR_ASSIGNMENT_PICKER_CUTOVER_AVAILABLE = true;
export const CALENDAR_ASSIGNMENT_DETAIL_LINKING_AVAILABLE = false;
export const CALENDAR_RESPONSE_LINK_ACTIVATION_REOPENED = false;
export const CALENDAR_SERVICE_ROLE_READ_AVAILABLE = false;
export const CALENDAR_SEED_DATA_AVAILABLE = false;
export const CALENDAR_ROUTE_SERVER_BACKED_NAVIGATION_AVAILABLE = true;
export const CALENDAR_ROUTE_FALSE_EMPTY_FOR_UNQUERIED_RANGE_ALLOWED = false;
export const CALENDAR_ROUTE_AMBIGUOUS_WORKSPACE_SELECTION_ALLOWED = false;

export const CALENDAR_ROUTE_DEFAULT_ANCHOR_DATE = "2026-01-13";
export const CALENDAR_ROUTE_DEFAULT_VIEW: CalendarRouteView = "week";
export const CALENDAR_ROUTE_MAXIMUM_RANGE_DAYS = 93;
export const CALENDAR_ROUTE_PERSISTED_READ_RANGE = {
  rangeStart: "2026-01-12",
  rangeEnd: "2026-01-19",
  periodKind: "week",
  anchorDate: CALENDAR_ROUTE_DEFAULT_ANCHOR_DATE,
  boundedRangeDays: 7,
  rangeSemantics: "server_derived_start_inclusive_end_exclusive",
} as const;

const supportedRouteViews = ["day", "week", "month", "list"] as const;
const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const fallbackRange: CalendarRouteQueriedRange = {
  rangeStart: "2026-01-12",
  rangeEnd: "2026-01-19",
  periodKind: "week",
  anchorDate: CALENDAR_ROUTE_DEFAULT_ANCHOR_DATE,
  bounded: true,
  rangeSemantics: "server_derived_start_inclusive_end_exclusive",
};

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isSupportedRouteView(value: unknown): value is CalendarRouteView {
  return supportedRouteViews.includes(value as CalendarRouteView);
}

function normalizeDate(value: unknown) {
  if (typeof value !== "string") return null;
  const match = datePattern.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return value.trim();
}

function addDays(date: string, days: number) {
  const nextDate = new Date(`${date}T00:00:00Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate.toISOString().slice(0, 10);
}

function firstDayOfMonth(date: string) {
  const current = new Date(`${date}T00:00:00Z`);
  return new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
}

function firstDayOfNextMonth(date: string) {
  const current = new Date(`${date}T00:00:00Z`);
  return new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 1))
    .toISOString()
    .slice(0, 10);
}

function mondayWeekStart(date: string) {
  const current = new Date(`${date}T00:00:00Z`);
  const day = current.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  current.setUTCDate(current.getUTCDate() + offset);
  return current.toISOString().slice(0, 10);
}

function rangeLengthDays(rangeStart: string, rangeEnd: string) {
  return Math.round(
    (new Date(`${rangeEnd}T00:00:00Z`).getTime() -
      new Date(`${rangeStart}T00:00:00Z`).getTime()) /
      (24 * 60 * 60 * 1000),
  );
}

function isTrustedTimezone(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value.trim() }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function normalizeCalendarRouteSearchParams(
  searchParams: CalendarRouteSearchParams,
):
  | Readonly<{ ok: true; view: CalendarRouteView; anchorDate: string }>
  | Readonly<{ ok: false; view: CalendarRouteView; anchorDate: string }> {
  const rawView = firstSearchParam(searchParams?.view);
  const rawDate = firstSearchParam(searchParams?.date);

  const view = rawView === undefined ? CALENDAR_ROUTE_DEFAULT_VIEW : rawView;
  const anchorDate =
    rawDate === undefined ? CALENDAR_ROUTE_DEFAULT_ANCHOR_DATE : normalizeDate(rawDate);

  if (!isSupportedRouteView(view) || !anchorDate) {
    return {
      ok: false,
      view: CALENDAR_ROUTE_DEFAULT_VIEW,
      anchorDate: CALENDAR_ROUTE_DEFAULT_ANCHOR_DATE,
    };
  }

  return { ok: true, view, anchorDate };
}

export function deriveCalendarRouteReadRange(input: {
  view: CalendarRouteView;
  anchorDate: string;
  workspaceTimezone: string;
}): CalendarRouteQueriedRange | null {
  const anchorDate = normalizeDate(input.anchorDate);
  if (!isSupportedRouteView(input.view) || !anchorDate || !isTrustedTimezone(input.workspaceTimezone)) {
    return null;
  }

  let rangeStart: string;
  let rangeEnd: string;
  if (input.view === "day") {
    rangeStart = anchorDate;
    rangeEnd = addDays(anchorDate, 1);
  } else if (input.view === "week") {
    rangeStart = mondayWeekStart(anchorDate);
    rangeEnd = addDays(rangeStart, 7);
  } else if (input.view === "month") {
    rangeStart = firstDayOfMonth(anchorDate);
    rangeEnd = firstDayOfNextMonth(anchorDate);
  } else {
    rangeStart = anchorDate;
    rangeEnd = addDays(anchorDate, 42);
  }

  const length = rangeLengthDays(rangeStart, rangeEnd);
  if (!Number.isFinite(length) || length <= 0 || length > CALENDAR_ROUTE_MAXIMUM_RANGE_DAYS) {
    return null;
  }

  return {
    rangeStart,
    rangeEnd,
    periodKind: input.view,
    anchorDate,
    bounded: true,
    rangeSemantics: "server_derived_start_inclusive_end_exclusive",
  };
}

function unavailableState(
  reason: CalendarRouteCutoverUnavailableReason,
  range: CalendarRouteQueriedRange = fallbackRange,
): CalendarClientState {
  const presentation = getCalendarRouteCutoverStatePrototypePresentation({
    kind: "unavailable",
    view: range.periodKind,
    reason,
  });

  return {
    kind: "unavailable",
    title: presentation.userFacingHeading,
    message: presentation.userFacingCopy,
    view: range.periodKind,
    anchorDate: range.anchorDate,
    queriedRange: range,
  };
}

function errorState(
  reason: CalendarRouteCutoverErrorReason,
  range: CalendarRouteQueriedRange = fallbackRange,
): CalendarClientState {
  const presentation = getCalendarRouteCutoverStatePrototypePresentation({
    kind: "error",
    view: range.periodKind,
    reason,
  });

  return {
    kind: "error",
    title: presentation.userFacingHeading,
    message: presentation.userFacingCopy,
    view: range.periodKind,
    anchorDate: range.anchorDate,
    queriedRange: range,
  };
}

function mapDisplayTypeToCategory(
  displayType: CalendarReadModelItem["displayType"],
): CalendarClientCategory {
  if (displayType === "food") return "lunch";
  if (displayType === "security") return "security";
  if (displayType === "custom") return "custom";
  return "general";
}

function mapPresetTaskTypeToCategory(
  taskType: CalendarTaskPresetSelectorOption["taskType"],
): CalendarClientCategory {
  if (taskType === "food") return "lunch";
  if (taskType === "security") return "security";
  if (taskType === "custom") return "custom";
  return "general";
}

function mapTaskPresetCustomFieldType(
  type: CalendarTaskPresetSelectorOption["customFields"][number]["type"],
): CalendarClientTaskPresetCustomField["type"] {
  if (type === "short_text") return "shortText";
  if (type === "long_text") return "longText";
  return type;
}

function mapSelectorPresetToClientPreset(
  preset: CalendarTaskPresetSelectorOption,
): CalendarClientTaskPreset {
  return {
    id: preset.id,
    projectId: `workspace:${preset.workspaceId}`,
    name: preset.name,
    description: preset.description,
    category: mapPresetTaskTypeToCategory(preset.taskType),
    neededCount: preset.defaultNeededCount,
    visibility: preset.volunteerVisible ? "volunteers" : "mainContacts",
    customFields: preset.customFields.map((field) => ({
      id: field.id,
      name: field.name,
      label: field.label,
      type: mapTaskPresetCustomFieldType(field.type),
      required: field.required,
      options: [...field.options],
    })),
    isSystemPreset: preset.isSystemPreset || undefined,
    sourcePresetId: preset.systemKey ?? undefined,
  };
}

function taskPresetSelectorUnavailable(): CalendarTaskPresetSelectorClientState {
  return { kind: "unavailable", reason: "missing_tasks_view" };
}

async function readTaskPresetSelectorState(input: {
  supabase: AppSupabaseClient;
  workspaceId: string;
  canViewTaskPresets: boolean;
}): Promise<CalendarTaskPresetSelectorClientState> {
  const selector = await readCalendarTaskPresetSelectorWithClient({
    client: input.supabase,
    workspaceId: input.workspaceId,
    canViewTaskPresets: input.canViewTaskPresets,
  });

  if (!selector.ok) {
    return selector.reason === "missing_tasks_view"
      ? taskPresetSelectorUnavailable()
      : { kind: "error", reason: "query_unavailable" };
  }

  const presets = selector.presets.map(mapSelectorPresetToClientPreset);
  return presets.length > 0
    ? { kind: "ready_with_presets", presets }
    : { kind: "ready_empty", presets: [] };
}

async function readAssignmentPickerState(input: {
  supabase: AppSupabaseClient;
  workspaceId: string;
  calendarItemIds: readonly string[];
  canViewVolunteers: boolean;
}): Promise<CalendarAssignmentPickerClientState> {
  const picker = await readCalendarAssignmentPickerWithClient({
    client: input.supabase,
    workspaceId: input.workspaceId,
    calendarItemIds: input.calendarItemIds,
    canViewVolunteers: input.canViewVolunteers,
  });

  if (picker.kind !== "ready") return picker;
  return {
    kind: "ready",
    volunteers: picker.volunteers,
    assignments: picker.assignments.map(mapAssignmentToClientAssignment),
  };
}

function mapAssignmentToClientAssignment(
  assignment: CalendarAssignmentPickerAssignment,
): CalendarClientAssignment {
  return {
    assignmentId: assignment.assignmentId,
    calendarItemId: assignment.calendarItemId,
    volunteerProfileId: assignment.volunteerProfileId,
    volunteerDisplayName: assignment.volunteerDisplayName,
    volunteerCongregation: assignment.volunteerCongregation,
    responseStatus: assignment.responseStatus,
  };
}

function mapCoverageToStatus(
  coverageState: CalendarReadModelItem["coverage"]["coverageState"],
): CalendarClientStatus {
  if (coverageState === "confirmed" || coverageState === "filled") return "filled";
  if (coverageState === "waiting") return "needsReview";
  if (coverageState === "some_denied" || coverageState === "all_denied") {
    return "needsReview";
  }
  if (coverageState === "unfilled" || coverageState === "not_assignable") return "open";
  return "partiallyFilled";
}

function formatTime(value: string | null) {
  if (!value) return undefined;
  const [hoursText, minutesText = "00"] = value.split(":");
  const hours = Number(hoursText);
  const minutes = Number(minutesText);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return undefined;
  const date = new Date(Date.UTC(2000, 0, 1, hours, minutes));
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

function mapPersistedItemToCalendarItem(
  item: CalendarReadModelItem,
  assignments: readonly CalendarClientAssignment[] = [],
): CalendarClientItem {
  const startTime = formatTime(item.startTime);
  const endTime = formatTime(item.endTime);
  const category = mapDisplayTypeToCategory(item.displayType);

  return {
    id: item.calendarItemId,
    projectId: item.stableDisplayReference,
    taskPresetId: item.taskPresetId ?? undefined,
    displayName: item.taskSourceLabel,
    date: item.startDate,
    endDate: item.endDate ?? undefined,
    allDay: item.scheduleKind !== "timed",
    startTime,
    endTime,
    startTimeValue: item.startTime ?? undefined,
    endTimeValue: item.endTime ?? undefined,
    timeWindow: startTime && endTime ? `${startTime} - ${endTime}` : undefined,
    category,
    assignedVolunteerIds: assignments.map((assignment) => assignment.volunteerProfileId),
    assignments: [...assignments],
    filledCount: item.coverage.assignedCount,
    neededCount: item.neededCount,
    status: mapCoverageToStatus(item.coverage.coverageState),
    scheduleNotes: item.scheduleNotes ?? undefined,
    taskPreset: item.taskPresetId
      ? {
          id: item.taskPresetId,
          projectId: item.stableDisplayReference,
          name: item.taskPresetLabel ?? item.taskSourceLabel,
          description: null,
          category,
          neededCount: item.neededCount,
          visibility: "mainContacts",
          customFields: [],
        }
      : undefined,
    oneOffTask: item.taskPresetId
      ? undefined
      : {
          name: item.taskSourceLabel,
          category,
          neededCount: item.neededCount,
          customFields: [],
        },
  };
}

function isUnavailableQueryFailure(reason: CalendarReadModelQueryFailureReason) {
  return (
    reason === "missing_calendar_view" ||
    reason === "missing_assignments_view_for_coverage" ||
    reason === "invalid_workspace_id" ||
    reason === "invalid_actor_contact_id" ||
    reason === "invalid_date_range" ||
    reason === "date_range_must_have_end_after_start" ||
    reason === "date_range_too_broad" ||
    reason === "invalid_workspace_timezone" ||
    reason === "invalid_period_kind" ||
    reason === "invalid_capabilities"
  );
}

function readModelItemOverlapsRouteRange(
  item: CalendarReadModelItem,
  range: CalendarRouteQueriedRange,
) {
  const itemEndDate = item.endDate ?? item.startDate;
  return item.startDate < range.rangeEnd && itemEndDate >= range.rangeStart;
}

export function selectCalendarRouteWorkspaceContext(input: {
  projectContactId: string;
  ownGrants: readonly ProjectContactGrant[];
  workspaces: readonly WorkspaceIdentity[];
}): CalendarRouteWorkspaceSelection {
  if (input.ownGrants.length === 0) return { ok: false, reason: "unauthorized" };

  const activeWorkspaces = new Map(
    input.workspaces
      .filter((workspace) => workspace.lifecycle === "active")
      .map((workspace) => [workspace.id, workspace]),
  );
  const workspaceCapabilities = new Map<
    string,
    { workspace: WorkspaceIdentity; capabilities: Set<string> }
  >();

  for (const grant of input.ownGrants) {
    if (grant.projectContactId !== input.projectContactId) continue;
    if (!isEffectiveWorkspaceReadGrant(grant)) continue;
    const workspace = activeWorkspaces.get(grant.workspaceId);
    if (!workspace) continue;
    const existing = workspaceCapabilities.get(workspace.id) ?? {
      workspace,
      capabilities: new Set<string>(),
    };
    for (const capability of grant.capabilities) existing.capabilities.add(capability);
    workspaceCapabilities.set(workspace.id, existing);
  }

  if (workspaceCapabilities.size === 0) {
    return { ok: false, reason: "workspace_unavailable" };
  }

  const candidates = [...workspaceCapabilities.values()];
  const eligible = candidates.filter(
    ({ capabilities }) =>
      capabilities.has("calendar.view") && capabilities.has("assignments.view"),
  );

  if (eligible.length === 1) {
    return {
      ok: true,
      workspace: eligible[0].workspace,
      projectContactId: input.projectContactId,
      capabilities: ["calendar.view", "assignments.view"],
      canEdit: eligible[0].capabilities.has("calendar.edit"),
      canEditAssignments: eligible[0].capabilities.has("assignments.edit"),
      canViewVolunteers: eligible[0].capabilities.has("volunteers.view"),
      canViewTaskPresets: eligible[0].capabilities.has("tasks.view"),
    };
  }

  if (eligible.length > 1) {
    return { ok: false, reason: "workspace_unavailable" };
  }

  const hasCalendarView = candidates.some(({ capabilities }) =>
    capabilities.has("calendar.view"),
  );
  return {
    ok: false,
    reason: hasCalendarView ? "missing_assignments_view" : "missing_calendar_view",
  };
}

export async function readCalendarRouteState(
  searchParams?: CalendarRouteSearchParams,
): Promise<CalendarClientState> {
  const routeRequest = normalizeCalendarRouteSearchParams(searchParams);
  if (!routeRequest.ok) return unavailableState("invalid_period_or_range");

  try {
    const { createServerSupabaseClient } = await import("../supabase/server.ts");
    const {
      loadProjectContactGrantsWithClient,
      readAuthenticatedProjectContactIdWithClient,
    } = await import("../auth/project-contact-grants.ts");
    const { readGrantedWorkspacesWithClient } = await import("../workspaces/granted.ts");
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) return unavailableState("unauthenticated");

    const grantState = await loadProjectContactGrantsWithClient(supabase, user.id);
    if (grantState.status !== "authorized") return unavailableState("unauthorized");
    const projectContactId = await readAuthenticatedProjectContactIdWithClient(
      supabase,
      user.id,
    );
    if (!projectContactId) return unavailableState("unauthorized");
    const ownGrants = grantState.grants.filter(
      (grant) => grant.projectContactId === projectContactId,
    );
    if (ownGrants.length === 0) return unavailableState("unauthorized");

    const workspaces = await readGrantedWorkspacesWithClient(supabase);
    const workspaceSelection = selectCalendarRouteWorkspaceContext({
      projectContactId,
      ownGrants,
      workspaces,
    });

    if (!workspaceSelection.ok) return unavailableState(workspaceSelection.reason);

    const range = deriveCalendarRouteReadRange({
      view: routeRequest.view,
      anchorDate: routeRequest.anchorDate,
      workspaceTimezone: workspaceSelection.workspace.timezone,
    });
    if (!range) return unavailableState("invalid_period_or_range");

    const query = await readCalendarReadModelWithClient({
      client: supabase as unknown as CalendarReadModelQueryClient,
      workspaceId: workspaceSelection.workspace.id,
      actorContactId: workspaceSelection.projectContactId,
      workspaceTimezone: workspaceSelection.workspace.timezone,
      rangeStart: range.rangeStart,
      rangeEnd: range.rangeEnd,
      periodKind: range.periodKind,
      capabilities: workspaceSelection.capabilities,
    });

    if (!query.ok) {
      return isUnavailableQueryFailure(query.reason)
        ? unavailableState("prerequisite_unavailable", range)
        : errorState("query_unavailable", range);
    }

    const readModelItems = query.items.filter((item) =>
      readModelItemOverlapsRouteRange(item, range),
    );
    const taskPresetSelector = await readTaskPresetSelectorState({
      supabase: supabase as AppSupabaseClient,
      workspaceId: workspaceSelection.workspace.id,
      canViewTaskPresets: workspaceSelection.canViewTaskPresets,
    });
    const assignmentPicker = await readAssignmentPickerState({
      supabase: supabase as AppSupabaseClient,
      workspaceId: workspaceSelection.workspace.id,
      calendarItemIds: readModelItems.map((item) => item.calendarItemId),
      canViewVolunteers: workspaceSelection.canViewVolunteers,
    });
    const assignmentsByItemId = new Map<string, CalendarClientAssignment[]>();
    if (assignmentPicker.kind === "ready") {
      for (const assignment of assignmentPicker.assignments) {
        const existing = assignmentsByItemId.get(assignment.calendarItemId) ?? [];
        existing.push(assignment);
        assignmentsByItemId.set(assignment.calendarItemId, existing);
      }
    }
    const items = readModelItems.map((item) =>
      mapPersistedItemToCalendarItem(
        item,
        assignmentsByItemId.get(item.calendarItemId) ?? [],
      ),
    );
    return items.length > 0
      ? {
          kind: "ready_with_items",
          items,
          canEdit: workspaceSelection.canEdit,
          canEditAssignments: workspaceSelection.canEditAssignments,
          canViewVolunteers: workspaceSelection.canViewVolunteers,
          canViewTaskPresets: workspaceSelection.canViewTaskPresets,
          taskPresetSelector,
          assignmentPicker,
          view: range.periodKind,
          anchorDate: range.anchorDate,
          queriedRange: range,
        }
      : {
          kind: "ready_empty",
          items: [],
          canEdit: workspaceSelection.canEdit,
          canEditAssignments: workspaceSelection.canEditAssignments,
          canViewVolunteers: workspaceSelection.canViewVolunteers,
          canViewTaskPresets: workspaceSelection.canViewTaskPresets,
          taskPresetSelector,
          assignmentPicker,
          view: range.periodKind,
          anchorDate: range.anchorDate,
          queriedRange: range,
        };
  } catch {
    return errorState("safe_error");
  }
}

export function describeCalendarRoutePersistedReadCutover() {
  return {
    persistedReadCutoverImplemented: CALENDAR_ROUTE_PERSISTED_READ_CUTOVER_IMPLEMENTED,
    readOnly: CALENDAR_ROUTE_PERSISTED_READ_ONLY,
    persistedWriteAvailable: CALENDAR_ROUTE_PERSISTED_WRITE_AVAILABLE,
    mockToRealMixingAllowed: CALENDAR_ROUTE_MOCK_TO_REAL_MIXING_ALLOWED,
    assignmentPickerCutoverAvailable: CALENDAR_ASSIGNMENT_PICKER_CUTOVER_AVAILABLE,
    assignmentDetailLinkingAvailable: CALENDAR_ASSIGNMENT_DETAIL_LINKING_AVAILABLE,
    responseLinkActivationReopened: CALENDAR_RESPONSE_LINK_ACTIVATION_REOPENED,
    serviceRoleReadAvailable: CALENDAR_SERVICE_ROLE_READ_AVAILABLE,
    seedDataAvailable: CALENDAR_SEED_DATA_AVAILABLE,
    serverBackedNavigationAvailable: CALENDAR_ROUTE_SERVER_BACKED_NAVIGATION_AVAILABLE,
    falseEmptyForUnqueriedRangeAllowed:
      CALENDAR_ROUTE_FALSE_EMPTY_FOR_UNQUERIED_RANGE_ALLOWED,
    ambiguousWorkspaceSelectionAllowed:
      CALENDAR_ROUTE_AMBIGUOUS_WORKSPACE_SELECTION_ALLOWED,
    routeRange: CALENDAR_ROUTE_PERSISTED_READ_RANGE,
    states: ["ready_with_items", "ready_empty", "unavailable", "error"],
    dataBoundary: "readCalendarReadModelWithClient",
    authBoundary:
      "server_supabase_auth_user_plus_contact_scoped_loadProjectContactGrantsWithClient_plus_readGrantedWorkspacesWithClient",
    strictCapabilities: ["calendar.view", "assignments.view"],
    taskPresetSelectorCapability: "tasks.view",
    assignmentPickerCapabilities: ["assignments.edit", "volunteers.view"],
  } as const;
}

export async function readCalendarMutationRouteContext() {
  try {
    const { createServerSupabaseClient } = await import("../supabase/server.ts");
    const {
      loadProjectContactGrantsWithClient,
      readAuthenticatedProjectContactIdWithClient,
    } = await import("../auth/project-contact-grants.ts");
    const { readGrantedWorkspacesWithClient } = await import("../workspaces/granted.ts");
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) return null;
    const grantState = await loadProjectContactGrantsWithClient(supabase, user.id);
    if (grantState.status !== "authorized") return null;
    const projectContactId = await readAuthenticatedProjectContactIdWithClient(
      supabase,
      user.id,
    );
    if (!projectContactId) return null;
    const ownGrants = grantState.grants.filter(
      (grant) => grant.projectContactId === projectContactId,
    );
    const workspaces = await readGrantedWorkspacesWithClient(supabase);
    const workspaceSelection = selectCalendarRouteWorkspaceContext({
      projectContactId,
      ownGrants,
      workspaces,
    });

    if (!workspaceSelection.ok || !workspaceSelection.canEdit) return null;

    return {
      supabase,
      workspace: workspaceSelection.workspace,
      projectContactId: workspaceSelection.projectContactId,
    } as const;
  } catch {
    return null;
  }
}

export async function readCalendarAssignmentMutationRouteContext() {
  try {
    const { createServerSupabaseClient } = await import("../supabase/server.ts");
    const {
      loadProjectContactGrantsWithClient,
      readAuthenticatedProjectContactIdWithClient,
    } = await import("../auth/project-contact-grants.ts");
    const { readGrantedWorkspacesWithClient } = await import("../workspaces/granted.ts");
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) return null;
    const grantState = await loadProjectContactGrantsWithClient(supabase, user.id);
    if (grantState.status !== "authorized") return null;
    const projectContactId = await readAuthenticatedProjectContactIdWithClient(
      supabase,
      user.id,
    );
    if (!projectContactId) return null;
    const ownGrants = grantState.grants.filter(
      (grant) => grant.projectContactId === projectContactId,
    );
    const workspaces = await readGrantedWorkspacesWithClient(supabase);
    const workspaceSelection = selectCalendarRouteWorkspaceContext({
      projectContactId,
      ownGrants,
      workspaces,
    });

    if (!workspaceSelection.ok || !workspaceSelection.canEditAssignments) return null;

    return {
      supabase,
      workspace: workspaceSelection.workspace,
      projectContactId: workspaceSelection.projectContactId,
    } as const;
  } catch {
    return null;
  }
}
