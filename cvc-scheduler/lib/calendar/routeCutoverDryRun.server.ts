import "server-only";

import {
  CALENDAR_READ_MODEL_QUERY_HELPER_DEPENDENCY_INJECTED,
  CALENDAR_READ_MODEL_QUERY_HELPER_ROUTE_UNUSED,
  CALENDAR_READ_MODEL_QUERY_HELPER_SERVICE_ROLE_AVAILABLE,
  CALENDAR_READ_MODEL_QUERY_SELECTORS,
  readCalendarReadModelWithClient,
  type CalendarReadModelQueryClient,
} from "./readModelQuery.server.ts";
import type {
  CalendarReadModelCapability,
  CalendarReadModelFilters,
  CalendarReadModelItem,
  CalendarReadModelPeriodKind,
} from "./readModel.server.ts";
import {
  CALENDAR_HOSTED_CUTOVER_VALIDATION_AVAILABLE as READINESS_CALENDAR_HOSTED_CUTOVER_VALIDATION_AVAILABLE,
  CALENDAR_PUBLIC_LOOKUP_CUTOVER_AVAILABLE as READINESS_CALENDAR_PUBLIC_LOOKUP_CUTOVER_AVAILABLE,
  CALENDAR_REMINDER_DELIVERY_AVAILABLE as READINESS_CALENDAR_REMINDER_DELIVERY_AVAILABLE,
  CALENDAR_RESPONSE_LINK_ACTIVATION_REOPENED as READINESS_CALENDAR_RESPONSE_LINK_ACTIVATION_REOPENED,
  CALENDAR_ROUTE_IMPORTS_READ_MODEL_QUERY_HELPER as READINESS_CALENDAR_ROUTE_IMPORTS_READ_MODEL_QUERY_HELPER,
  CALENDAR_ROUTE_MOCK_TO_REAL_MIXING_ALLOWED as READINESS_CALENDAR_ROUTE_MOCK_TO_REAL_MIXING_ALLOWED,
  CALENDAR_ROUTE_PERSISTED_READ_CUTOVER_IMPLEMENTED as READINESS_CALENDAR_ROUTE_PERSISTED_READ_CUTOVER_IMPLEMENTED,
  CALENDAR_ROUTE_PERSISTED_WRITE_AVAILABLE as READINESS_CALENDAR_ROUTE_PERSISTED_WRITE_AVAILABLE,
  CALENDAR_SEED_DATA_AVAILABLE as READINESS_CALENDAR_SEED_DATA_AVAILABLE,
  CALENDAR_SERVICE_ROLE_READ_AVAILABLE as READINESS_CALENDAR_SERVICE_ROLE_READ_AVAILABLE,
  CALENDAR_ASSIGNMENT_DETAIL_LINKING_AVAILABLE as READINESS_CALENDAR_ASSIGNMENT_DETAIL_LINKING_AVAILABLE,
  CALENDAR_ASSIGNMENT_PICKER_CUTOVER_AVAILABLE as READINESS_CALENDAR_ASSIGNMENT_PICKER_CUTOVER_AVAILABLE,
  describeCalendarRouteCutoverReadiness,
} from "./routeCutoverReadiness.server.ts";

export const CALENDAR_ROUTE_CUTOVER_DRY_RUN_AVAILABLE = true;
export const CALENDAR_ROUTE_PERSISTED_READ_CUTOVER_IMPLEMENTED =
  READINESS_CALENDAR_ROUTE_PERSISTED_READ_CUTOVER_IMPLEMENTED;
export const CALENDAR_ROUTE_IMPORTS_READ_MODEL_QUERY_HELPER =
  READINESS_CALENDAR_ROUTE_IMPORTS_READ_MODEL_QUERY_HELPER;
export const CALENDAR_ROUTE_USES_DRY_RUN_HARNESS = false;
export const CALENDAR_ROUTE_MOCK_TO_REAL_MIXING_ALLOWED =
  READINESS_CALENDAR_ROUTE_MOCK_TO_REAL_MIXING_ALLOWED;
export const CALENDAR_ROUTE_PERSISTED_WRITE_AVAILABLE =
  READINESS_CALENDAR_ROUTE_PERSISTED_WRITE_AVAILABLE;
export const CALENDAR_ASSIGNMENT_PICKER_CUTOVER_AVAILABLE =
  READINESS_CALENDAR_ASSIGNMENT_PICKER_CUTOVER_AVAILABLE;
export const CALENDAR_ASSIGNMENT_DETAIL_LINKING_AVAILABLE =
  READINESS_CALENDAR_ASSIGNMENT_DETAIL_LINKING_AVAILABLE;
export const CALENDAR_RESPONSE_LINK_ACTIVATION_REOPENED =
  READINESS_CALENDAR_RESPONSE_LINK_ACTIVATION_REOPENED;
export const CALENDAR_PUBLIC_LOOKUP_CUTOVER_AVAILABLE =
  READINESS_CALENDAR_PUBLIC_LOOKUP_CUTOVER_AVAILABLE;
export const CALENDAR_REMINDER_DELIVERY_AVAILABLE =
  READINESS_CALENDAR_REMINDER_DELIVERY_AVAILABLE;
export const CALENDAR_SERVICE_ROLE_READ_AVAILABLE =
  READINESS_CALENDAR_SERVICE_ROLE_READ_AVAILABLE;
export const CALENDAR_SEED_DATA_AVAILABLE = READINESS_CALENDAR_SEED_DATA_AVAILABLE;
export const CALENDAR_HOSTED_CUTOVER_VALIDATION_AVAILABLE =
  READINESS_CALENDAR_HOSTED_CUTOVER_VALIDATION_AVAILABLE;

export type CalendarRouteCutoverDryRunState =
  | "ready"
  | "empty"
  | "unauthenticated"
  | "unauthorized"
  | "missing-calendar-view"
  | "missing-assignments-view"
  | "invalid-range"
  | "workspace-unavailable"
  | "query-unavailable"
  | "safe-error";

export type CalendarRouteCutoverDryRunTrustedContext = Readonly<{
  authSessionPresent: boolean;
  workspaceId?: string;
  actorContactId?: string;
  workspaceTimezone?: string;
  workspaceAvailable?: boolean;
  grantActive?: boolean;
  capabilities?: readonly CalendarReadModelCapability[];
  roleTitle?: string;
}>;

export type CalendarRouteCutoverDryRunInput = Readonly<{
  executionMode: "dryRun";
  client: CalendarReadModelQueryClient;
  trustedContext: CalendarRouteCutoverDryRunTrustedContext;
  periodKind: CalendarReadModelPeriodKind;
  anchorDate: string;
  filters?: CalendarReadModelFilters;
}>;

export type CalendarRouteCutoverDryRunRange = Readonly<{
  periodKind: CalendarReadModelPeriodKind;
  rangeStart: string;
  rangeEnd: string;
  anchorDate: string;
  workspaceTimezone: string;
  bounded: true;
  rangeSemantics: "start_inclusive_end_exclusive_for_dry_run_route_planning";
}>;

export type CalendarRouteCutoverDryRunResult = Readonly<{
  available: boolean;
  state: CalendarRouteCutoverDryRunState;
  dryRunOnly: true;
  routeUnused: true;
  range?: CalendarRouteCutoverDryRunRange;
  items?: readonly CalendarReadModelItem[];
  summary?: CalendarRouteCutoverDryRunSummary;
}>;

export type CalendarRouteCutoverDryRunSummary = Readonly<{
  itemCount: number;
  assignedCount: number;
  confirmedCount: number;
  waitingOnConfirmationCount: number;
  deniedCount: number;
  unassignedCount: number;
}>;

const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const maximumRangeDays = 93;
const supportedPeriodKinds = ["day", "week", "month", "list"] as const;

function isSupportedPeriodKind(value: unknown): value is CalendarReadModelPeriodKind {
  return supportedPeriodKinds.includes(value as CalendarReadModelPeriodKind);
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

function safeResult(
  state: CalendarRouteCutoverDryRunState,
  range?: CalendarRouteCutoverDryRunRange,
): CalendarRouteCutoverDryRunResult {
  return {
    available: state === "ready" || state === "empty",
    state,
    dryRunOnly: true,
    routeUnused: true,
    ...(range ? { range } : {}),
    ...(state === "empty" ? { items: [], summary: emptySummary } : {}),
  };
}

const emptySummary = {
  itemCount: 0,
  assignedCount: 0,
  confirmedCount: 0,
  waitingOnConfirmationCount: 0,
  deniedCount: 0,
  unassignedCount: 0,
} as const;

export function deriveCalendarRouteCutoverDryRunRange(input: {
  periodKind: CalendarReadModelPeriodKind;
  anchorDate: string;
  workspaceTimezone: string;
}): CalendarRouteCutoverDryRunRange | null {
  if (!isSupportedPeriodKind(input.periodKind)) return null;
  const anchorDate = normalizeDate(input.anchorDate);
  if (!anchorDate || !isTrustedTimezone(input.workspaceTimezone)) return null;

  let rangeStart: string;
  let rangeEnd: string;
  if (input.periodKind === "day") {
    rangeStart = anchorDate;
    rangeEnd = addDays(anchorDate, 1);
  } else if (input.periodKind === "week") {
    rangeStart = mondayWeekStart(anchorDate);
    rangeEnd = addDays(rangeStart, 7);
  } else if (input.periodKind === "month") {
    rangeStart = firstDayOfMonth(anchorDate);
    rangeEnd = firstDayOfNextMonth(anchorDate);
  } else {
    rangeStart = anchorDate;
    rangeEnd = addDays(anchorDate, 42);
  }

  const length = rangeLengthDays(rangeStart, rangeEnd);
  if (!Number.isFinite(length) || length <= 0 || length > maximumRangeDays) return null;

  return {
    periodKind: input.periodKind,
    rangeStart,
    rangeEnd,
    anchorDate,
    workspaceTimezone: input.workspaceTimezone.trim(),
    bounded: true,
    rangeSemantics: "start_inclusive_end_exclusive_for_dry_run_route_planning",
  };
}

function summarizeItems(items: readonly CalendarReadModelItem[]): CalendarRouteCutoverDryRunSummary {
  return items.reduce<CalendarRouteCutoverDryRunSummary>(
    (summary, item) => ({
      itemCount: summary.itemCount + 1,
      assignedCount: summary.assignedCount + item.coverage.assignedCount,
      confirmedCount: summary.confirmedCount + item.coverage.confirmedCount,
      waitingOnConfirmationCount:
        summary.waitingOnConfirmationCount + item.coverage.waitingOnConfirmationCount,
      deniedCount: summary.deniedCount + item.coverage.deniedCount,
      unassignedCount: summary.unassignedCount + item.coverage.unassignedCount,
    }),
    { ...emptySummary },
  );
}

export async function runCalendarRouteCutoverDryRun(
  input: CalendarRouteCutoverDryRunInput,
): Promise<CalendarRouteCutoverDryRunResult> {
  if (input.executionMode !== "dryRun") return safeResult("safe-error");

  const context = input.trustedContext;
  if (!context.authSessionPresent) return safeResult("unauthenticated");
  if (
    context.workspaceAvailable === false ||
    !context.workspaceId ||
    !context.actorContactId ||
    !context.workspaceTimezone
  ) {
    return safeResult("workspace-unavailable");
  }
  if (context.grantActive === false || !Array.isArray(context.capabilities)) {
    return safeResult("unauthorized");
  }
  if (!context.capabilities.includes("calendar.view")) {
    return safeResult("missing-calendar-view");
  }
  if (!context.capabilities.includes("assignments.view")) {
    return safeResult("missing-assignments-view");
  }

  const range = deriveCalendarRouteCutoverDryRunRange({
    periodKind: input.periodKind,
    anchorDate: input.anchorDate,
    workspaceTimezone: context.workspaceTimezone,
  });
  if (!range) return safeResult("invalid-range");

  const query = await readCalendarReadModelWithClient({
    client: input.client,
    workspaceId: context.workspaceId,
    actorContactId: context.actorContactId,
    workspaceTimezone: range.workspaceTimezone,
    rangeStart: range.rangeStart,
    rangeEnd: range.rangeEnd,
    periodKind: range.periodKind,
    capabilities: context.capabilities,
    filters: input.filters,
  });

  if (!query.ok) {
    if (query.reason === "missing_calendar_view") return safeResult("missing-calendar-view", range);
    if (query.reason === "missing_assignments_view_for_coverage") {
      return safeResult("missing-assignments-view", range);
    }
    if (
      query.reason === "invalid_date_range" ||
      query.reason === "date_range_must_have_end_after_start" ||
      query.reason === "date_range_too_broad" ||
      query.reason === "invalid_workspace_timezone" ||
      query.reason === "invalid_period_kind"
    ) {
      return safeResult("invalid-range", range);
    }
    return safeResult("query-unavailable", range);
  }

  if (query.items.length === 0) return safeResult("empty", range);

  return {
    available: true,
    state: "ready",
    dryRunOnly: true,
    routeUnused: true,
    range,
    items: query.items,
    summary: summarizeItems(query.items),
  };
}

export function describeCalendarRouteCutoverDryRun() {
  return {
    dryRunAvailable: CALENDAR_ROUTE_CUTOVER_DRY_RUN_AVAILABLE,
    routePersistedReadCutoverImplemented: CALENDAR_ROUTE_PERSISTED_READ_CUTOVER_IMPLEMENTED,
    routeImportsReadModelQueryHelper: CALENDAR_ROUTE_IMPORTS_READ_MODEL_QUERY_HELPER,
    routeUsesDryRunHarness: CALENDAR_ROUTE_USES_DRY_RUN_HARNESS,
    mockToRealMixingAllowed: CALENDAR_ROUTE_MOCK_TO_REAL_MIXING_ALLOWED,
    persistedWriteAvailable: CALENDAR_ROUTE_PERSISTED_WRITE_AVAILABLE,
    assignmentPickerCutoverAvailable: CALENDAR_ASSIGNMENT_PICKER_CUTOVER_AVAILABLE,
    assignmentDetailLinkingAvailable: CALENDAR_ASSIGNMENT_DETAIL_LINKING_AVAILABLE,
    responseLinkActivationReopened: CALENDAR_RESPONSE_LINK_ACTIVATION_REOPENED,
    publicLookupCutoverAvailable: CALENDAR_PUBLIC_LOOKUP_CUTOVER_AVAILABLE,
    reminderDeliveryAvailable: CALENDAR_REMINDER_DELIVERY_AVAILABLE,
    serviceRoleReadAvailable: CALENDAR_SERVICE_ROLE_READ_AVAILABLE,
    seedDataAvailable: CALENDAR_SEED_DATA_AVAILABLE,
    hostedCutoverValidationAvailable: CALENDAR_HOSTED_CUTOVER_VALIDATION_AVAILABLE,
    queryHelperRouteUnused: CALENDAR_READ_MODEL_QUERY_HELPER_ROUTE_UNUSED,
    queryHelperDependencyInjected: CALENDAR_READ_MODEL_QUERY_HELPER_DEPENDENCY_INJECTED,
    queryHelperServiceRoleAvailable: CALENDAR_READ_MODEL_QUERY_HELPER_SERVICE_ROLE_AVAILABLE,
    queryHelperExplicitSelectors: CALENDAR_READ_MODEL_QUERY_SELECTORS,
    requiredReadinessReview: describeCalendarRouteCutoverReadiness(),
    resultShape:
      "safe_state_items_and_summary_only_no_raw_grants_capabilities_errors_or_database_rows",
    nextRecommendedSlice: "12.9 Calendar Route Cutover Final Preflight",
  } as const;
}
