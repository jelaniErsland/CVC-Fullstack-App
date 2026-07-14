import "server-only";

import {
  loadProjectContactGrantsWithClient,
  readAuthenticatedProjectContactIdWithClient,
} from "../auth/project-contact-grants.ts";
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
import type { CalendarReadModelItem } from "./readModel.server.ts";
import { createServerSupabaseClient } from "../supabase/server.ts";
import { readGrantedWorkspacesWithClient } from "../workspaces/granted.ts";

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
type CalendarClientItem = {
  id: string;
  projectId: string;
  taskPresetId?: string;
  date: string;
  endDate?: string;
  allDay?: boolean;
  startTime?: string;
  endTime?: string;
  timeWindow?: string;
  category: CalendarClientCategory;
  assignedVolunteerIds: string[];
  filledCount: number;
  neededCount: number;
  status: CalendarClientStatus;
  scheduleNotes?: string;
  oneOffTask?: {
    name: string;
    category: CalendarClientCategory;
    neededCount: number;
    customFields: never[];
  };
};
type CalendarClientState =
  | Readonly<{ kind: "ready_with_items" | "ready_empty"; items: CalendarClientItem[] }>
  | Readonly<{ kind: "unavailable" | "error"; title: string; message: string }>;

export const CALENDAR_ROUTE_PERSISTED_READ_CUTOVER_IMPLEMENTED = true;
export const CALENDAR_ROUTE_PERSISTED_READ_ONLY = true;
export const CALENDAR_ROUTE_PERSISTED_WRITE_AVAILABLE = false;
export const CALENDAR_ROUTE_MOCK_TO_REAL_MIXING_ALLOWED = false;
export const CALENDAR_ASSIGNMENT_PICKER_CUTOVER_AVAILABLE = false;
export const CALENDAR_ASSIGNMENT_DETAIL_LINKING_AVAILABLE = false;
export const CALENDAR_RESPONSE_LINK_ACTIVATION_REOPENED = false;
export const CALENDAR_SERVICE_ROLE_READ_AVAILABLE = false;
export const CALENDAR_SEED_DATA_AVAILABLE = false;

export const CALENDAR_ROUTE_PERSISTED_READ_RANGE = {
  rangeStart: "2026-01-01",
  rangeEnd: "2026-04-04",
  periodKind: "list",
  anchorDate: "2026-01-13",
  boundedRangeDays: 93,
} as const;

function unavailableState(
  reason: CalendarRouteCutoverUnavailableReason,
): CalendarClientState {
  const presentation = getCalendarRouteCutoverStatePrototypePresentation({
    kind: "unavailable",
    view: "week",
    reason,
  });

  return {
    kind: "unavailable",
    title: presentation.userFacingHeading,
    message: presentation.userFacingCopy,
  };
}

function errorState(reason: CalendarRouteCutoverErrorReason): CalendarClientState {
  const presentation = getCalendarRouteCutoverStatePrototypePresentation({
    kind: "error",
    view: "week",
    reason,
  });

  return {
    kind: "error",
    title: presentation.userFacingHeading,
    message: presentation.userFacingCopy,
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

function mapPersistedItemToCalendarItem(item: CalendarReadModelItem): CalendarClientItem {
  const startTime = formatTime(item.startTime);
  const endTime = formatTime(item.endTime);
  const category = mapDisplayTypeToCategory(item.displayType);

  return {
    id: item.calendarItemId,
    projectId: item.stableDisplayReference,
    taskPresetId: undefined,
    date: item.startDate,
    endDate: item.endDate ?? undefined,
    allDay: item.scheduleKind !== "timed",
    startTime,
    endTime,
    timeWindow: startTime && endTime ? `${startTime} - ${endTime}` : undefined,
    category,
    assignedVolunteerIds: [],
    filledCount: item.coverage.assignedCount,
    neededCount: item.neededCount,
    status: mapCoverageToStatus(item.coverage.coverageState),
    scheduleNotes: item.scheduleNotes ?? undefined,
    oneOffTask: {
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

export async function readCalendarRouteState(): Promise<CalendarClientState> {
  try {
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
    const candidate = ownGrants
      .map((grant) => ({
        grant,
        workspace: workspaces.find((workspace) => workspace.id === grant.workspaceId),
      }))
      .find(({ grant, workspace }) => {
        if (!workspace || workspace.lifecycle !== "active") return false;
        return (
          grant.capabilities.includes("calendar.view") &&
          grant.capabilities.includes("assignments.view")
        );
      });

    if (!candidate?.workspace) {
      const hasCalendarView = ownGrants.some((grant) =>
        grant.capabilities.includes("calendar.view"),
      );
      return unavailableState(
        hasCalendarView ? "missing_assignments_view" : "missing_calendar_view",
      );
    }

    const query = await readCalendarReadModelWithClient({
      client: supabase as unknown as CalendarReadModelQueryClient,
      workspaceId: candidate.workspace.id,
      actorContactId: candidate.grant.projectContactId,
      workspaceTimezone: candidate.workspace.timezone,
      rangeStart: CALENDAR_ROUTE_PERSISTED_READ_RANGE.rangeStart,
      rangeEnd: CALENDAR_ROUTE_PERSISTED_READ_RANGE.rangeEnd,
      periodKind: CALENDAR_ROUTE_PERSISTED_READ_RANGE.periodKind,
      capabilities: ["calendar.view", "assignments.view"],
    });

    if (!query.ok) {
      return isUnavailableQueryFailure(query.reason)
        ? unavailableState("prerequisite_unavailable")
        : errorState("query_unavailable");
    }

    const items = query.items.map(mapPersistedItemToCalendarItem);
    return items.length > 0
      ? { kind: "ready_with_items", items }
      : { kind: "ready_empty", items: [] };
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
    routeRange: CALENDAR_ROUTE_PERSISTED_READ_RANGE,
    states: ["ready_with_items", "ready_empty", "unavailable", "error"],
    dataBoundary: "readCalendarReadModelWithClient",
    authBoundary:
      "server_supabase_auth_user_plus_loadProjectContactGrantsWithClient_plus_readGrantedWorkspacesWithClient",
    strictCapabilities: ["calendar.view", "assignments.view"],
  } as const;
}
