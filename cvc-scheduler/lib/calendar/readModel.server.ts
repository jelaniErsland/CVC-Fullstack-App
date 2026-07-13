import "server-only";

import {
  CALENDAR_ASSIGNMENT_DETAIL_LINKING_AVAILABLE as CONTRACT_CALENDAR_ASSIGNMENT_DETAIL_LINKING_AVAILABLE,
  CALENDAR_ASSIGNMENT_PICKER_CUTOVER_AVAILABLE as CONTRACT_CALENDAR_ASSIGNMENT_PICKER_CUTOVER_AVAILABLE,
  CALENDAR_RESPONSE_LINK_ACTIVATION_REOPENED as CONTRACT_CALENDAR_RESPONSE_LINK_ACTIVATION_REOPENED,
  CALENDAR_ROUTE_MOCK_TO_REAL_MIXING_ALLOWED as CONTRACT_CALENDAR_ROUTE_MOCK_TO_REAL_MIXING_ALLOWED,
  CALENDAR_ROUTE_PERSISTED_READ_CUTOVER_AVAILABLE as CONTRACT_CALENDAR_ROUTE_PERSISTED_READ_CUTOVER_AVAILABLE,
  CALENDAR_ROUTE_PERSISTED_WRITE_AVAILABLE as CONTRACT_CALENDAR_ROUTE_PERSISTED_WRITE_AVAILABLE,
  CALENDAR_SEED_DATA_AVAILABLE as CONTRACT_CALENDAR_SEED_DATA_AVAILABLE,
  CALENDAR_SERVICE_ROLE_READ_AVAILABLE as CONTRACT_CALENDAR_SERVICE_ROLE_READ_AVAILABLE,
  calendarPersistedReadModelContract,
} from "./readModelContract.server.ts";

export const CALENDAR_PERSISTED_READ_MODEL_HELPER_AVAILABLE = true;
export const CALENDAR_PERSISTED_READ_MODEL_QUERY_SHAPE_AVAILABLE = true;
export const CALENDAR_PERSISTED_READ_MODEL_LIVE_QUERY_AVAILABLE = false;
export const CALENDAR_ROUTE_PERSISTED_READ_CUTOVER_AVAILABLE =
  CONTRACT_CALENDAR_ROUTE_PERSISTED_READ_CUTOVER_AVAILABLE;
export const CALENDAR_ROUTE_MOCK_TO_REAL_MIXING_ALLOWED =
  CONTRACT_CALENDAR_ROUTE_MOCK_TO_REAL_MIXING_ALLOWED;
export const CALENDAR_ROUTE_PERSISTED_WRITE_AVAILABLE =
  CONTRACT_CALENDAR_ROUTE_PERSISTED_WRITE_AVAILABLE;
export const CALENDAR_ASSIGNMENT_PICKER_CUTOVER_AVAILABLE =
  CONTRACT_CALENDAR_ASSIGNMENT_PICKER_CUTOVER_AVAILABLE;
export const CALENDAR_ASSIGNMENT_DETAIL_LINKING_AVAILABLE =
  CONTRACT_CALENDAR_ASSIGNMENT_DETAIL_LINKING_AVAILABLE;
export const CALENDAR_RESPONSE_LINK_ACTIVATION_REOPENED =
  CONTRACT_CALENDAR_RESPONSE_LINK_ACTIVATION_REOPENED;
export const CALENDAR_SERVICE_ROLE_READ_AVAILABLE =
  CONTRACT_CALENDAR_SERVICE_ROLE_READ_AVAILABLE;
export const CALENDAR_SEED_DATA_AVAILABLE = CONTRACT_CALENDAR_SEED_DATA_AVAILABLE;

export type CalendarReadModelCapability = "calendar.view" | "assignments.view";
export type CalendarReadModelPeriodKind = "day" | "week" | "month" | "list";
export type CalendarReadModelTaskTypeFilter = "general" | "food" | "security";
export type CalendarReadModelCoverageFilter =
  | "unfilled"
  | "filled"
  | "waiting"
  | "confirmed"
  | "someDenied"
  | "allDenied";
export type CalendarReadModelLifecycleFilter =
  | "draft"
  | "published"
  | "active"
  | "archived"
  | "canceled"
  | "completed";
export type CalendarReadModelScheduleKind =
  | "timed"
  | "date_based"
  | "multi_day_window"
  | "milestone";
export type CalendarReadModelDisplayType = "general" | "food" | "security" | "custom";
export type CalendarCoverageState =
  | "not_assignable"
  | "unfilled"
  | "filled"
  | "waiting"
  | "confirmed"
  | "some_denied"
  | "all_denied";

export type CalendarReadModelFilters = Readonly<{
  taskNameSearch?: string;
  type?: CalendarReadModelTaskTypeFilter;
  coverage?: CalendarReadModelCoverageFilter;
  lifecycle?: CalendarReadModelLifecycleFilter;
}>;

export type CalendarReadModelInput = Readonly<{
  workspaceId: string;
  actorContactId: string;
  rangeStart: string;
  rangeEnd: string;
  workspaceTimezone: string;
  periodKind: CalendarReadModelPeriodKind;
  filters?: CalendarReadModelFilters;
  capabilities: readonly CalendarReadModelCapability[];
}>;

export type CalendarReadModelInputResult =
  | Readonly<{ ok: true; value: CalendarReadModelInput }>
  | Readonly<{ ok: false; reason: string }>;

export type CalendarAssignmentCoverageRow = Readonly<{
  assignmentId: string;
  workspaceId?: string;
  calendarItemId?: string;
  assignmentLifecycle: "active" | "removed" | "canceled" | "archived";
  currentResponseStatus: "needs_response" | "confirmed" | "declined" | "denied";
}>;

export type CalendarCoverageSummary = Readonly<{
  assignedCount: number;
  confirmedCount: number;
  deniedCount: number;
  unassignedCount: number;
  waitingOnConfirmationCount: number;
  hasDenied: boolean;
  allAssignedHelpersDenied: boolean;
  coverageState: CalendarCoverageState;
  assignedFractionLabel: string;
  aggregateVolunteerCountOnMultiDayWindowAllowed: false;
}>;

export type CalendarReadModelItemRow = Readonly<{
  id: string;
  workspaceId: string;
  titleSnapshot: string;
  taskTypeSnapshot: CalendarReadModelDisplayType;
  scheduleKind: CalendarReadModelScheduleKind;
  startDate: string;
  endDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  timezone: string;
  neededCount: number;
  lifecycle: CalendarReadModelLifecycleFilter;
  scheduleNotes?: string | null;
  oneOffTaskLabel?: string | null;
  oneOffTaskType?: CalendarReadModelDisplayType | null;
  taskPresetLabel?: string | null;
  taskPresetType?: CalendarReadModelDisplayType | null;
}>;

export type CalendarReadModelItem = Readonly<{
  calendarItemId: string;
  stableDisplayReference: string;
  taskSourceLabel: string;
  displayType: CalendarReadModelDisplayType;
  scheduleKind: CalendarReadModelScheduleKind;
  startDate: string;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  timezone: string;
  neededCount: number;
  lifecycle: CalendarReadModelLifecycleFilter;
  scheduleNotes: string | null;
  oneOffTaskLabel: string | null;
  oneOffTaskType: CalendarReadModelDisplayType | null;
  taskPresetLabel: string | null;
  taskPresetType: CalendarReadModelDisplayType | null;
  coverage: CalendarCoverageSummary;
  assignedFractionLabel: string;
}>;

export type CalendarAssignmentCoverageScope = Readonly<{
  workspaceId?: string;
  calendarItemId?: string;
}>;

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const maximumRangeDays = 93;
const allowedPeriodKinds: readonly CalendarReadModelPeriodKind[] = [
  "day",
  "week",
  "month",
  "list",
];
const allowedTaskTypeFilters: readonly CalendarReadModelTaskTypeFilter[] = [
  "general",
  "food",
  "security",
];
const allowedCoverageFilters: readonly CalendarReadModelCoverageFilter[] = [
  "unfilled",
  "filled",
  "waiting",
  "confirmed",
  "someDenied",
  "allDenied",
];
const allowedLifecycleFilters: readonly CalendarReadModelLifecycleFilter[] = [
  "draft",
  "published",
  "active",
  "archived",
  "canceled",
  "completed",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeUuid(value: unknown) {
  if (typeof value !== "string" || !uuidPattern.test(value.trim())) return null;
  return value.trim().toLowerCase();
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

function daysBetween(startDate: string, endDate: string) {
  const start = Date.parse(`${startDate}T00:00:00.000Z`);
  const end = Date.parse(`${endDate}T00:00:00.000Z`);
  return Math.round((end - start) / 86_400_000);
}

function normalizeTimezone(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value.trim() }).format(new Date());
    return value.trim();
  } catch {
    return null;
  }
}

function normalizeOptionalText(value: unknown, maximumLength: number) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > maximumLength) return null;
  return normalized;
}

function normalizeFilters(value: unknown): CalendarReadModelFilters | null {
  if (value === undefined) return {};
  if (!isRecord(value)) return null;
  const taskNameSearch = normalizeOptionalText(value.taskNameSearch, 80);
  if (taskNameSearch === null) return null;
  const type = value.type;
  if (
    type !== undefined &&
    (typeof type !== "string" ||
      !allowedTaskTypeFilters.includes(type as CalendarReadModelTaskTypeFilter))
  ) {
    return null;
  }
  const coverage = value.coverage;
  if (
    coverage !== undefined &&
    (typeof coverage !== "string" ||
      !allowedCoverageFilters.includes(coverage as CalendarReadModelCoverageFilter))
  ) {
    return null;
  }
  const lifecycle = value.lifecycle;
  if (
    lifecycle !== undefined &&
    (typeof lifecycle !== "string" ||
      !allowedLifecycleFilters.includes(lifecycle as CalendarReadModelLifecycleFilter))
  ) {
    return null;
  }
  return {
    ...(taskNameSearch ? { taskNameSearch } : {}),
    ...(type ? { type: type as CalendarReadModelTaskTypeFilter } : {}),
    ...(coverage ? { coverage: coverage as CalendarReadModelCoverageFilter } : {}),
    ...(lifecycle ? { lifecycle: lifecycle as CalendarReadModelLifecycleFilter } : {}),
  };
}

function normalizeCapabilities(value: unknown): readonly CalendarReadModelCapability[] | null {
  if (!Array.isArray(value)) return null;
  const normalized = value.filter(
    (capability): capability is CalendarReadModelCapability =>
      capability === "calendar.view" || capability === "assignments.view",
  );
  return [...new Set(normalized)].sort();
}

export function normalizeCalendarReadModelInput(input: unknown): CalendarReadModelInputResult {
  if (!isRecord(input)) return { ok: false, reason: "input_must_be_object" };

  const workspaceId = normalizeUuid(input.workspaceId);
  if (!workspaceId) return { ok: false, reason: "invalid_workspace_id" };

  const actorContactId = normalizeUuid(input.actorContactId);
  if (!actorContactId) return { ok: false, reason: "invalid_actor_contact_id" };

  const rangeStart = normalizeDate(input.rangeStart);
  const rangeEnd = normalizeDate(input.rangeEnd);
  if (!rangeStart || !rangeEnd) return { ok: false, reason: "invalid_date_range" };

  const rangeDays = daysBetween(rangeStart, rangeEnd);
  if (rangeDays <= 0) return { ok: false, reason: "range_end_must_be_after_start" };
  if (rangeDays > maximumRangeDays) return { ok: false, reason: "range_exceeds_bound" };

  const workspaceTimezone = normalizeTimezone(input.workspaceTimezone);
  if (!workspaceTimezone) return { ok: false, reason: "invalid_workspace_timezone" };

  const periodKind = input.periodKind;
  if (
    typeof periodKind !== "string" ||
    !allowedPeriodKinds.includes(periodKind as CalendarReadModelPeriodKind)
  ) {
    return { ok: false, reason: "invalid_period_kind" };
  }

  const capabilities = normalizeCapabilities(input.capabilities);
  if (!capabilities) return { ok: false, reason: "invalid_capabilities" };

  const filters = normalizeFilters(input.filters);
  if (!filters) return { ok: false, reason: "invalid_filters" };

  return {
    ok: true,
    value: {
      workspaceId,
      actorContactId,
      rangeStart,
      rangeEnd,
      workspaceTimezone,
      periodKind: periodKind as CalendarReadModelPeriodKind,
      filters,
      capabilities,
    },
  };
}

export function evaluateCalendarReadModelCapabilities(
  capabilities: readonly CalendarReadModelCapability[],
) {
  const canReadItemShells = capabilities.includes("calendar.view");
  const canReadAssignmentDerivedCoverage =
    canReadItemShells && capabilities.includes("assignments.view");
  return {
    canReadItemShells,
    canReadAssignmentDerivedCoverage,
    strictCoverageRule:
      "calendar.view_and_assignments.view_required_for_assignment_derived_counts",
  } as const;
}

export function buildCalendarReadModelQueryShape(input: unknown) {
  const normalized = normalizeCalendarReadModelInput(input);
  if (!normalized.ok) return normalized;

  const capabilities = evaluateCalendarReadModelCapabilities(normalized.value.capabilities);
  if (!capabilities.canReadItemShells) {
    return { ok: false as const, reason: "missing_calendar_view" };
  }
  if (!capabilities.canReadAssignmentDerivedCoverage) {
    return { ok: false as const, reason: "missing_assignments_view_for_coverage" };
  }

  return {
    ok: true as const,
    value: {
      scope: {
        workspaceId: normalized.value.workspaceId,
        actorContactId: normalized.value.actorContactId,
        rangeStart: normalized.value.rangeStart,
        rangeEnd: normalized.value.rangeEnd,
        workspaceTimezone: normalized.value.workspaceTimezone,
        periodKind: normalized.value.periodKind,
        filters: normalized.value.filters,
        requiredCapabilities: ["calendar.view", "assignments.view"] as const,
      },
      selectorPlan: {
        calendarItemShellRows: {
          table: "calendar_items",
          requiredColumns: [
            "id",
            "workspace_id",
            "title_snapshot",
            "task_type_snapshot",
            "schedule_kind",
            "start_date",
            "end_date",
            "start_time",
            "end_time",
            "timezone",
            "needed_count",
            "lifecycle",
            "schedule_notes",
            "task_preset_id",
          ],
          joins: ["optional_task_presets_label_type_only"],
        },
        assignmentAggregateRows: {
          tables: ["calendar_assignments", "assignment_responses"],
          aggregateOnly: true,
          requiredColumns: [
            "calendar_item_id",
            "assignment_lifecycle",
            "current_response_status",
          ],
        },
        forbiddenTables: [
          "volunteer_contact_values",
          "questionnaire_answers",
          "emergency_contacts",
          "assignment_response_tokens",
          "assignment_response_link_reveal_events",
          "project_contact_grants_raw_capabilities",
        ],
        forbiddenOutput: calendarReadModelForbiddenOutputFields,
        stableSortOrder: ["date", "schedule_kind", "time", "task_label", "id"] as const,
      },
    },
  };
}

export function summarizeCalendarAssignmentCoverage(
  neededCount: number,
  scheduleKind: CalendarReadModelScheduleKind,
  assignments: readonly CalendarAssignmentCoverageRow[],
  scope: CalendarAssignmentCoverageScope = {},
): CalendarCoverageSummary {
  const assignable =
    scheduleKind === "timed" || scheduleKind === "date_based";
  const normalizedNeededCount =
    assignable && Number.isInteger(neededCount) && neededCount > 0 ? neededCount : 0;

  if (!assignable || normalizedNeededCount === 0) {
    return {
      assignedCount: 0,
      confirmedCount: 0,
      deniedCount: 0,
      unassignedCount: 0,
      waitingOnConfirmationCount: 0,
      hasDenied: false,
      allAssignedHelpersDenied: false,
      coverageState: "not_assignable",
      assignedFractionLabel: "0/0 assigned",
      aggregateVolunteerCountOnMultiDayWindowAllowed: false,
    };
  }

  const scopedAssignments = assignments.filter(
    (assignment) =>
      (scope.workspaceId === undefined ||
        assignment.workspaceId === undefined ||
        assignment.workspaceId === scope.workspaceId) &&
      (scope.calendarItemId === undefined ||
        assignment.calendarItemId === undefined ||
        assignment.calendarItemId === scope.calendarItemId),
  );

  const activeResponses = scopedAssignments.filter(
    (assignment) => assignment.assignmentLifecycle === "active",
  );
  const confirmedCount = activeResponses.filter(
    (assignment) => assignment.currentResponseStatus === "confirmed",
  ).length;
  const waitingOnConfirmationCount = activeResponses.filter(
    (assignment) => assignment.currentResponseStatus === "needs_response",
  ).length;
  const deniedCount = activeResponses.filter(
    (assignment) =>
      assignment.currentResponseStatus === "declined" ||
      assignment.currentResponseStatus === "denied",
  ).length;
  const assignedCount = confirmedCount + waitingOnConfirmationCount;
  const unassignedCount = Math.max(normalizedNeededCount - assignedCount, 0);
  const hasDenied = deniedCount > 0;
  const allAssignedHelpersDenied = activeResponses.length > 0 && deniedCount === activeResponses.length;
  const coverageState: CalendarCoverageState = allAssignedHelpersDenied
    ? "all_denied"
    : hasDenied
      ? "some_denied"
      : confirmedCount >= normalizedNeededCount
        ? "confirmed"
        : assignedCount >= normalizedNeededCount && waitingOnConfirmationCount > 0
          ? "waiting"
          : assignedCount >= normalizedNeededCount
            ? "filled"
            : waitingOnConfirmationCount > 0
              ? "waiting"
              : "unfilled";

  return {
    assignedCount,
    confirmedCount,
    deniedCount,
    unassignedCount,
    waitingOnConfirmationCount,
    hasDenied,
    allAssignedHelpersDenied,
    coverageState,
    assignedFractionLabel: `${assignedCount}/${normalizedNeededCount} assigned`,
    aggregateVolunteerCountOnMultiDayWindowAllowed: false,
  };
}

export function mapCalendarReadModelItem(
  row: CalendarReadModelItemRow,
  assignments: readonly CalendarAssignmentCoverageRow[],
): CalendarReadModelItem {
  const coverage = summarizeCalendarAssignmentCoverage(
    row.neededCount,
    row.scheduleKind,
    assignments,
    { workspaceId: row.workspaceId, calendarItemId: row.id },
  );
  const taskPresetLabel = row.taskPresetLabel ?? null;
  const oneOffTaskLabel = row.oneOffTaskLabel ?? null;
  const taskSourceLabel = oneOffTaskLabel ?? taskPresetLabel ?? row.titleSnapshot;
  const displayType =
    row.oneOffTaskType ?? row.taskPresetType ?? row.taskTypeSnapshot;
  const assignable = row.scheduleKind === "timed" || row.scheduleKind === "date_based";

  return {
    calendarItemId: row.id,
    stableDisplayReference: `calendar-item:${row.id}`,
    taskSourceLabel,
    displayType,
    scheduleKind: row.scheduleKind,
    startDate: row.startDate,
    endDate: row.endDate ?? null,
    startTime: row.startTime ?? null,
    endTime: row.endTime ?? null,
    timezone: row.timezone,
    neededCount: assignable ? row.neededCount : 0,
    lifecycle: row.lifecycle,
    scheduleNotes: row.scheduleNotes ?? null,
    oneOffTaskLabel,
    oneOffTaskType: row.oneOffTaskType ?? null,
    taskPresetLabel,
    taskPresetType: row.taskPresetType ?? null,
    coverage,
    assignedFractionLabel: coverage.assignedFractionLabel,
  };
}

const scheduleKindSortOrder: Record<CalendarReadModelScheduleKind, number> = {
  timed: 0,
  date_based: 1,
  multi_day_window: 2,
  milestone: 3,
};

function coverageFilterMatches(
  coverageState: CalendarCoverageState,
  coverageFilter: CalendarReadModelCoverageFilter,
) {
  if (coverageFilter === "someDenied") return coverageState === "some_denied";
  if (coverageFilter === "allDenied") return coverageState === "all_denied";
  return coverageState === coverageFilter;
}

export function filterAndSortCalendarReadModelItems(
  items: readonly CalendarReadModelItem[],
  filters: unknown = {},
): readonly CalendarReadModelItem[] {
  const normalizedFilters = normalizeFilters(filters);
  if (!normalizedFilters) return [];

  const taskNameSearch = normalizedFilters.taskNameSearch?.toLowerCase();
  return [...items]
    .filter((item) => {
      if (
        taskNameSearch &&
        !item.taskSourceLabel.toLowerCase().includes(taskNameSearch)
      ) {
        return false;
      }
      if (normalizedFilters.type && item.displayType !== normalizedFilters.type) {
        return false;
      }
      if (
        normalizedFilters.coverage &&
        !coverageFilterMatches(item.coverage.coverageState, normalizedFilters.coverage)
      ) {
        return false;
      }
      if (normalizedFilters.lifecycle && item.lifecycle !== normalizedFilters.lifecycle) {
        return false;
      }
      return true;
    })
    .sort(
      (left, right) =>
        left.startDate.localeCompare(right.startDate) ||
        scheduleKindSortOrder[left.scheduleKind] -
          scheduleKindSortOrder[right.scheduleKind] ||
        (left.startTime ?? "").localeCompare(right.startTime ?? "") ||
        left.taskSourceLabel.localeCompare(right.taskSourceLabel) ||
        left.calendarItemId.localeCompare(right.calendarItemId),
    );
}

export const calendarReadModelForbiddenOutputFields = [
  "volunteer_contact_values",
  "emergency_contact_details",
  "questionnaire_answers",
  "public_response_url",
  "redacted_response_url",
  "bearer",
  "verifier",
  "token_id",
  "audit_id",
  "access_token",
  "refresh_token",
  "password",
  "api_key",
  "service_role_key",
  "sql_internal_rpc_detail",
  "raw_grants_capability_arrays",
  "unrelated_row_data",
  "provider_error_dump",
  "stack_trace",
  "raw_exception_message",
] as const;

export const calendarReadModelExplicitlyBlocked = [
  "admin_calendar_route_cutover",
  "calendar_ui_changes",
  "calendar_create_edit_archive_cancel_ui",
  "calendar_write_commands",
  "drag_drop_persistence",
  "resize_persistence",
  "recurrence_copy_persistence",
  "assignment_picker",
  "assignment_create_cancel",
  "assignment_response_mutation_from_calendar_ui",
  "public_volunteer_lookup",
  "public_volunteer_schedule_cutover",
  "email_reminder_delivery",
  "communications_persistence_cutover",
  "needs_attention_persistence_cutover",
  "response_link_activation",
  "assignment_detail_entry_links",
  "service_role_usage",
  "seed_data",
  "hosted_validation_unless_db_rpc_generated_type_or_hosted_behavior_changes",
] as const;

export function describeCalendarReadModelHelper() {
  return {
    helperAvailable: CALENDAR_PERSISTED_READ_MODEL_HELPER_AVAILABLE,
    queryShapeAvailable: CALENDAR_PERSISTED_READ_MODEL_QUERY_SHAPE_AVAILABLE,
    liveQueryAvailable: CALENDAR_PERSISTED_READ_MODEL_LIVE_QUERY_AVAILABLE,
    routeCutoverAvailable: CALENDAR_ROUTE_PERSISTED_READ_CUTOVER_AVAILABLE,
    mockToRealMixingAllowed: CALENDAR_ROUTE_MOCK_TO_REAL_MIXING_ALLOWED,
    persistedWriteAvailable: CALENDAR_ROUTE_PERSISTED_WRITE_AVAILABLE,
    assignmentPickerCutoverAvailable: CALENDAR_ASSIGNMENT_PICKER_CUTOVER_AVAILABLE,
    assignmentDetailLinkingAvailable: CALENDAR_ASSIGNMENT_DETAIL_LINKING_AVAILABLE,
    responseLinkActivationReopened: CALENDAR_RESPONSE_LINK_ACTIVATION_REOPENED,
    serviceRoleReadAvailable: CALENDAR_SERVICE_ROLE_READ_AVAILABLE,
    seedDataAvailable: CALENDAR_SEED_DATA_AVAILABLE,
    strictCoverageCapabilities:
      calendarPersistedReadModelContract.capabilityContract
        .assignmentDerivedCoverageCountsRequire,
    forbiddenOutputFields: calendarReadModelForbiddenOutputFields,
    explicitlyBlocked: calendarReadModelExplicitlyBlocked,
  } as const;
}
