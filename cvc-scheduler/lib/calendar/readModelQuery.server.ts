import "server-only";

import {
  CALENDAR_ASSIGNMENT_DETAIL_LINKING_AVAILABLE as HELPER_CALENDAR_ASSIGNMENT_DETAIL_LINKING_AVAILABLE,
  CALENDAR_ASSIGNMENT_PICKER_CUTOVER_AVAILABLE as HELPER_CALENDAR_ASSIGNMENT_PICKER_CUTOVER_AVAILABLE,
  CALENDAR_RESPONSE_LINK_ACTIVATION_REOPENED as HELPER_CALENDAR_RESPONSE_LINK_ACTIVATION_REOPENED,
  CALENDAR_ROUTE_MOCK_TO_REAL_MIXING_ALLOWED as HELPER_CALENDAR_ROUTE_MOCK_TO_REAL_MIXING_ALLOWED,
  CALENDAR_ROUTE_PERSISTED_READ_CUTOVER_AVAILABLE as HELPER_CALENDAR_ROUTE_PERSISTED_READ_CUTOVER_AVAILABLE,
  CALENDAR_ROUTE_PERSISTED_WRITE_AVAILABLE as HELPER_CALENDAR_ROUTE_PERSISTED_WRITE_AVAILABLE,
  CALENDAR_SEED_DATA_AVAILABLE as HELPER_CALENDAR_SEED_DATA_AVAILABLE,
  CALENDAR_SERVICE_ROLE_READ_AVAILABLE as HELPER_CALENDAR_SERVICE_ROLE_READ_AVAILABLE,
  buildCalendarReadModelQueryShape,
  filterAndSortCalendarReadModelItems,
  mapCalendarReadModelItem,
  type CalendarAssignmentCoverageRow,
  type CalendarReadModelCapability,
  type CalendarReadModelFilters,
  type CalendarReadModelItem,
  type CalendarReadModelItemRow,
  type CalendarReadModelPeriodKind,
} from "./readModel.server.ts";

export const CALENDAR_READ_MODEL_QUERY_HELPER_AVAILABLE = true;
export const CALENDAR_READ_MODEL_QUERY_HELPER_ROUTE_UNUSED = true;
export const CALENDAR_READ_MODEL_QUERY_HELPER_DEPENDENCY_INJECTED = true;
export const CALENDAR_READ_MODEL_QUERY_HELPER_SERVICE_ROLE_AVAILABLE = false;
export const CALENDAR_ROUTE_PERSISTED_READ_CUTOVER_AVAILABLE =
  HELPER_CALENDAR_ROUTE_PERSISTED_READ_CUTOVER_AVAILABLE;
export const CALENDAR_ROUTE_MOCK_TO_REAL_MIXING_ALLOWED =
  HELPER_CALENDAR_ROUTE_MOCK_TO_REAL_MIXING_ALLOWED;
export const CALENDAR_ROUTE_PERSISTED_WRITE_AVAILABLE =
  HELPER_CALENDAR_ROUTE_PERSISTED_WRITE_AVAILABLE;
export const CALENDAR_ASSIGNMENT_PICKER_CUTOVER_AVAILABLE =
  HELPER_CALENDAR_ASSIGNMENT_PICKER_CUTOVER_AVAILABLE;
export const CALENDAR_ASSIGNMENT_DETAIL_LINKING_AVAILABLE =
  HELPER_CALENDAR_ASSIGNMENT_DETAIL_LINKING_AVAILABLE;
export const CALENDAR_RESPONSE_LINK_ACTIVATION_REOPENED =
  HELPER_CALENDAR_RESPONSE_LINK_ACTIVATION_REOPENED;
export const CALENDAR_SERVICE_ROLE_READ_AVAILABLE =
  HELPER_CALENDAR_SERVICE_ROLE_READ_AVAILABLE;
export const CALENDAR_SEED_DATA_AVAILABLE = HELPER_CALENDAR_SEED_DATA_AVAILABLE;
export const CALENDAR_HOSTED_QUERY_VALIDATION_AVAILABLE = false;

export const CALENDAR_READ_MODEL_QUERY_ALLOWED_TABLES = [
  "calendar_items",
  "task_presets",
  "calendar_assignments",
  "assignment_responses",
] as const;

export const CALENDAR_READ_MODEL_QUERY_SELECTORS = {
  calendarItems:
    "id,workspace_id,task_preset_id,title_snapshot,task_type_snapshot,schedule_kind,start_date,end_date,start_time,end_time,timezone,needed_count,schedule_notes,lifecycle,publication_state,created_by_project_contact_id,published_at",
  taskPresets: "id,workspace_id,name,task_type",
  calendarAssignments: "id,workspace_id,calendar_item_id,lifecycle",
  assignmentResponses: "assignment_id,workspace_id,response_status",
} as const;

type SupabaseLikeQueryBuilder = {
  select(selector: string): SupabaseLikeQueryBuilder;
  eq(column: string, value: unknown): SupabaseLikeQueryBuilder;
  lte(column: string, value: unknown): SupabaseLikeQueryBuilder;
  or(expression: string): SupabaseLikeQueryBuilder;
  in(column: string, values: readonly unknown[]): SupabaseLikeQueryBuilder;
  order(column: string, options?: Readonly<{ ascending?: boolean }>): SupabaseLikeQueryBuilder;
  then<TResult1 = SupabaseQueryResult, TResult2 = never>(
    onfulfilled?:
      | ((value: SupabaseQueryResult) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2>;
};

export type CalendarReadModelQueryClient = Readonly<{
  from(table: string): SupabaseLikeQueryBuilder;
}>;

export type CalendarReadModelQueryInput = Readonly<{
  client: CalendarReadModelQueryClient;
  workspaceId: string;
  actorContactId: string;
  workspaceTimezone: string;
  rangeStart: string;
  rangeEnd: string;
  periodKind: CalendarReadModelPeriodKind;
  capabilities: readonly CalendarReadModelCapability[];
  filters?: CalendarReadModelFilters;
}>;

export type CalendarReadModelQueryResult =
  | Readonly<{
      ok: true;
      items: readonly CalendarReadModelItem[];
      query: Readonly<{
        routeUnused: true;
        dependencyInjected: true;
        tables: typeof CALENDAR_READ_MODEL_QUERY_ALLOWED_TABLES;
        selectors: typeof CALENDAR_READ_MODEL_QUERY_SELECTORS;
      }>;
    }>
  | Readonly<{ ok: false; reason: CalendarReadModelQueryFailureReason }>;

export type CalendarReadModelQueryFailureReason =
  | "invalid_query_client"
  | "invalid_projection"
  | "calendar_items_unavailable"
  | "task_presets_unavailable"
  | "calendar_assignments_unavailable"
  | "assignment_responses_unavailable"
  | "input_must_be_object"
  | "invalid_workspace_id"
  | "invalid_actor_contact_id"
  | "invalid_date_range"
  | "date_range_must_have_end_after_start"
  | "date_range_too_broad"
  | "invalid_workspace_timezone"
  | "invalid_period_kind"
  | "invalid_filters"
  | "invalid_capabilities"
  | "missing_calendar_view"
  | "missing_assignments_view_for_coverage";

type SupabaseQueryResult = Readonly<{
  data: unknown;
  error: unknown;
}>;

type AnyRow = Record<string, unknown>;

const allowedDisplayTypes = ["general", "food", "security", "custom"] as const;
const allowedScheduleKinds = [
  "timed",
  "date_based",
  "multi_day_window",
  "milestone",
] as const;
const allowedLifecycleStates = [
  "draft",
  "published",
  "active",
  "archived",
  "canceled",
  "completed",
] as const;
const allowedPublicationStates = ["draft", "published"] as const;
const activeAssignmentLifecycles = ["active", "removed", "canceled", "archived"] as const;
const responseStatuses = ["needs_response", "confirmed", "declined", "denied"] as const;

function isRecord(value: unknown): value is AnyRow {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRows(value: unknown): readonly AnyRow[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asOptionalString(value: unknown) {
  return value === null || value === undefined ? null : asString(value);
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeDisplayType(value: unknown) {
  return allowedDisplayTypes.includes(value as (typeof allowedDisplayTypes)[number])
    ? (value as CalendarReadModelItemRow["taskTypeSnapshot"])
    : null;
}

function normalizeScheduleKind(value: unknown) {
  return allowedScheduleKinds.includes(value as (typeof allowedScheduleKinds)[number])
    ? (value as CalendarReadModelItemRow["scheduleKind"])
    : null;
}

function normalizeLifecycle(value: unknown) {
  return allowedLifecycleStates.includes(value as (typeof allowedLifecycleStates)[number])
    ? (value as CalendarReadModelItemRow["lifecycle"])
    : null;
}

function normalizePublicationState(value: unknown) {
  return allowedPublicationStates.includes(value as (typeof allowedPublicationStates)[number])
    ? (value as CalendarReadModelItemRow["publicationState"])
    : null;
}

function normalizeAssignmentLifecycle(value: unknown) {
  return activeAssignmentLifecycles.includes(
    value as (typeof activeAssignmentLifecycles)[number],
  )
    ? (value as CalendarAssignmentCoverageRow["assignmentLifecycle"])
    : null;
}

function normalizeResponseStatus(value: unknown) {
  return responseStatuses.includes(value as (typeof responseStatuses)[number])
    ? (value as CalendarAssignmentCoverageRow["currentResponseStatus"])
    : null;
}

function hasQueryableClient(value: unknown): value is CalendarReadModelQueryClient {
  return isRecord(value) && typeof value.from === "function";
}

async function runSafeQuery(
  builder: SupabaseLikeQueryBuilder,
): Promise<SupabaseQueryResult | null> {
  try {
    return await builder;
  } catch {
    return null;
  }
}

function toItemRow(
  row: AnyRow,
  taskPresetById: ReadonlyMap<string, AnyRow>,
): CalendarReadModelItemRow | null {
  const id = asString(row.id);
  const workspaceId = asString(row.workspace_id);
  const titleSnapshot = asString(row.title_snapshot);
  const taskTypeSnapshot = normalizeDisplayType(row.task_type_snapshot);
  const scheduleKind = normalizeScheduleKind(row.schedule_kind);
  const startDate = asString(row.start_date);
  const timezone = asString(row.timezone);
  const neededCount = asNumber(row.needed_count);
  const lifecycle = normalizeLifecycle(row.lifecycle);
  const publicationState = normalizePublicationState(row.publication_state);

  if (
    !id ||
    !workspaceId ||
    !titleSnapshot ||
    !taskTypeSnapshot ||
    !scheduleKind ||
    !startDate ||
    !timezone ||
    neededCount === null ||
    !lifecycle ||
    !publicationState
  ) {
    return null;
  }

  const taskPresetId = asOptionalString(row.task_preset_id);
  const taskPreset = taskPresetId ? taskPresetById.get(taskPresetId) : undefined;
  const taskPresetLabel = taskPreset ? asOptionalString(taskPreset.name) : null;
  const taskPresetType = taskPreset ? normalizeDisplayType(taskPreset.task_type) : null;
  const hasPreset = Boolean(taskPresetId);

  return {
    id,
    workspaceId,
    titleSnapshot,
    taskTypeSnapshot,
    scheduleKind,
    startDate,
    endDate: asOptionalString(row.end_date),
    startTime: asOptionalString(row.start_time),
    endTime: asOptionalString(row.end_time),
    timezone,
    neededCount,
    lifecycle,
    publicationState,
    createdByProjectContactId: asOptionalString(row.created_by_project_contact_id),
    publishedAt: asOptionalString(row.published_at),
    scheduleNotes: asOptionalString(row.schedule_notes),
    taskPresetId,
    oneOffTaskLabel: hasPreset ? null : titleSnapshot,
    oneOffTaskType: hasPreset ? null : taskTypeSnapshot,
    taskPresetLabel,
    taskPresetType,
  };
}

function toCoverageRows(
  assignmentRows: readonly AnyRow[],
  responseRows: readonly AnyRow[],
): readonly CalendarAssignmentCoverageRow[] {
  const responseByAssignmentId = new Map<string, AnyRow>();
  for (const responseRow of responseRows) {
    const assignmentId = asString(responseRow.assignment_id);
    if (assignmentId) responseByAssignmentId.set(assignmentId, responseRow);
  }

  const coverageRows: CalendarAssignmentCoverageRow[] = [];
  for (const assignmentRow of assignmentRows) {
    const assignmentId = asString(assignmentRow.id);
    const workspaceId = asString(assignmentRow.workspace_id);
    const calendarItemId = asString(assignmentRow.calendar_item_id);
    const assignmentLifecycle = normalizeAssignmentLifecycle(assignmentRow.lifecycle);
    if (!assignmentId || !workspaceId || !calendarItemId || !assignmentLifecycle) {
      continue;
    }
    const response = responseByAssignmentId.get(assignmentId);
    const currentResponseStatus =
      normalizeResponseStatus(response?.response_status) ?? "needs_response";
    coverageRows.push({
      assignmentId,
      workspaceId,
      calendarItemId,
      assignmentLifecycle,
      currentResponseStatus,
    });
  }

  return coverageRows;
}

function safeFailure(reason: CalendarReadModelQueryFailureReason): CalendarReadModelQueryResult {
  return { ok: false, reason };
}

export async function readCalendarReadModelWithClient(
  input: CalendarReadModelQueryInput,
): Promise<CalendarReadModelQueryResult> {
  if (!hasQueryableClient(input.client)) return safeFailure("invalid_query_client");

  const queryShape = buildCalendarReadModelQueryShape({
    workspaceId: input.workspaceId,
    actorContactId: input.actorContactId,
    rangeStart: input.rangeStart,
    rangeEnd: input.rangeEnd,
    workspaceTimezone: input.workspaceTimezone,
    periodKind: input.periodKind,
    capabilities: input.capabilities,
    filters: input.filters,
  });

  if (!queryShape.ok) {
    return safeFailure(queryShape.reason as CalendarReadModelQueryFailureReason);
  }

  const { scope } = queryShape.value;
  const calendarItemsResult = await runSafeQuery(
    input.client
      .from("calendar_items")
      .select(CALENDAR_READ_MODEL_QUERY_SELECTORS.calendarItems)
      .eq("workspace_id", scope.workspaceId)
      .lte("start_date", scope.rangeEnd)
      .or(`end_date.is.null,end_date.gte.${scope.rangeStart}`)
      .order("start_date", { ascending: true })
      .order("schedule_kind", { ascending: true })
      .order("start_time", { ascending: true })
      .order("title_snapshot", { ascending: true })
      .order("id", { ascending: true }),
  );
  if (!calendarItemsResult || calendarItemsResult.error) {
    return safeFailure("calendar_items_unavailable");
  }

  const calendarItemRows = asRows(calendarItemsResult.data);
  const visibleCalendarItemRows = calendarItemRows.filter((row) => {
    const publicationState = normalizePublicationState(row.publication_state);
    if (publicationState === "published") return true;
    return (
      publicationState === "draft" &&
      asOptionalString(row.created_by_project_contact_id) === scope.actorContactId
    );
  });
  const calendarItemIds = visibleCalendarItemRows
    .map((row) => asString(row.id))
    .filter((id): id is string => Boolean(id));
  const taskPresetIds = [
    ...new Set(
      visibleCalendarItemRows
        .map((row) => asOptionalString(row.task_preset_id))
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  let taskPresetRows: readonly AnyRow[] = [];
  if (taskPresetIds.length > 0) {
    const taskPresetsResult = await runSafeQuery(
      input.client
        .from("task_presets")
        .select(CALENDAR_READ_MODEL_QUERY_SELECTORS.taskPresets)
        .eq("workspace_id", scope.workspaceId)
        .in("id", taskPresetIds),
    );
    if (!taskPresetsResult || taskPresetsResult.error) {
      return safeFailure("task_presets_unavailable");
    }
    taskPresetRows = asRows(taskPresetsResult.data);
  }

  let assignmentRows: readonly AnyRow[] = [];
  let responseRows: readonly AnyRow[] = [];
  if (calendarItemIds.length > 0) {
    const assignmentsResult = await runSafeQuery(
      input.client
        .from("calendar_assignments")
        .select(CALENDAR_READ_MODEL_QUERY_SELECTORS.calendarAssignments)
        .eq("workspace_id", scope.workspaceId)
        .in("calendar_item_id", calendarItemIds),
    );
    if (!assignmentsResult || assignmentsResult.error) {
      return safeFailure("calendar_assignments_unavailable");
    }
    assignmentRows = asRows(assignmentsResult.data);
    const assignmentIds = assignmentRows
      .map((row) => asString(row.id))
      .filter((id): id is string => Boolean(id));

    if (assignmentIds.length > 0) {
      const responsesResult = await runSafeQuery(
        input.client
          .from("assignment_responses")
          .select(CALENDAR_READ_MODEL_QUERY_SELECTORS.assignmentResponses)
          .eq("workspace_id", scope.workspaceId)
          .in("assignment_id", assignmentIds),
      );
      if (!responsesResult || responsesResult.error) {
        return safeFailure("assignment_responses_unavailable");
      }
      responseRows = asRows(responsesResult.data);
    }
  }

  const taskPresetById = new Map(
    taskPresetRows
      .map((row) => {
        const id = asString(row.id);
        return id ? ([id, row] as const) : null;
      })
      .filter((entry): entry is readonly [string, AnyRow] => Boolean(entry)),
  );
  const itemRows = visibleCalendarItemRows
    .map((row) => toItemRow(row, taskPresetById))
    .filter((row): row is CalendarReadModelItemRow => Boolean(row));
  if (itemRows.length !== visibleCalendarItemRows.length) return safeFailure("invalid_projection");

  const coverageRows = toCoverageRows(assignmentRows, responseRows);
  const items = filterAndSortCalendarReadModelItems(
    itemRows.map((row) => mapCalendarReadModelItem(row, coverageRows)),
    scope.filters,
  );

  return {
    ok: true,
    items,
    query: {
      routeUnused: CALENDAR_READ_MODEL_QUERY_HELPER_ROUTE_UNUSED,
      dependencyInjected: CALENDAR_READ_MODEL_QUERY_HELPER_DEPENDENCY_INJECTED,
      tables: CALENDAR_READ_MODEL_QUERY_ALLOWED_TABLES,
      selectors: CALENDAR_READ_MODEL_QUERY_SELECTORS,
    },
  };
}

export function describeCalendarReadModelQueryHelper() {
  return {
    queryHelperAvailable: CALENDAR_READ_MODEL_QUERY_HELPER_AVAILABLE,
    routeUnused: CALENDAR_READ_MODEL_QUERY_HELPER_ROUTE_UNUSED,
    dependencyInjected: CALENDAR_READ_MODEL_QUERY_HELPER_DEPENDENCY_INJECTED,
    serviceRoleAvailable: CALENDAR_READ_MODEL_QUERY_HELPER_SERVICE_ROLE_AVAILABLE,
    routeCutoverAvailable: CALENDAR_ROUTE_PERSISTED_READ_CUTOVER_AVAILABLE,
    mockToRealMixingAllowed: CALENDAR_ROUTE_MOCK_TO_REAL_MIXING_ALLOWED,
    persistedWriteAvailable: CALENDAR_ROUTE_PERSISTED_WRITE_AVAILABLE,
    assignmentPickerCutoverAvailable: CALENDAR_ASSIGNMENT_PICKER_CUTOVER_AVAILABLE,
    assignmentDetailLinkingAvailable: CALENDAR_ASSIGNMENT_DETAIL_LINKING_AVAILABLE,
    responseLinkActivationReopened: CALENDAR_RESPONSE_LINK_ACTIVATION_REOPENED,
    seedDataAvailable: CALENDAR_SEED_DATA_AVAILABLE,
    hostedQueryValidationAvailable: CALENDAR_HOSTED_QUERY_VALIDATION_AVAILABLE,
    allowedTables: CALENDAR_READ_MODEL_QUERY_ALLOWED_TABLES,
    explicitSelectors: CALENDAR_READ_MODEL_QUERY_SELECTORS,
    forbiddenQueryTables: [
      "volunteer_profiles",
      "questionnaire_submissions",
      "assignment_response_tokens",
      "assignment_response_link_reveal_events",
      "project_contacts",
      "workspace_contact_grants",
      "auth.users",
      "storage.objects",
    ],
    safeErrorShape: "generic_reason_code_only_no_raw_supabase_error",
  } as const;
}
