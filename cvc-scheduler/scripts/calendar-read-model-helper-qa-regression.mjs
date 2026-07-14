import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CALENDAR_ASSIGNMENT_DETAIL_LINKING_AVAILABLE,
  CALENDAR_ASSIGNMENT_PICKER_CUTOVER_AVAILABLE,
  CALENDAR_PERSISTED_READ_MODEL_HELPER_AVAILABLE,
  CALENDAR_PERSISTED_READ_MODEL_LIVE_QUERY_AVAILABLE,
  CALENDAR_PERSISTED_READ_MODEL_QUERY_SHAPE_AVAILABLE,
  CALENDAR_RESPONSE_LINK_ACTIVATION_REOPENED,
  CALENDAR_ROUTE_MOCK_TO_REAL_MIXING_ALLOWED,
  CALENDAR_ROUTE_PERSISTED_READ_CUTOVER_AVAILABLE,
  CALENDAR_ROUTE_PERSISTED_WRITE_AVAILABLE,
  CALENDAR_SEED_DATA_AVAILABLE,
  CALENDAR_SERVICE_ROLE_READ_AVAILABLE,
  buildCalendarReadModelQueryShape,
  calendarReadModelExplicitlyBlocked,
  calendarReadModelForbiddenOutputFields,
  describeCalendarReadModelHelper,
  evaluateCalendarReadModelCapabilities,
  filterAndSortCalendarReadModelItems,
  mapCalendarReadModelItem,
  normalizeCalendarReadModelInput,
  summarizeCalendarAssignmentCoverage,
} from "../lib/calendar/readModel.server.ts";
import {
  CALENDAR_PERSISTED_READ_MODEL_CONTRACT_AVAILABLE,
  describeCalendarPersistedReadModelContract,
} from "../lib/calendar/readModelContract.server.ts";
import {
  MVP_REAL_DATA_CUTOVER_PLAN_AVAILABLE,
  describeMvpRealDataCutoverPlan,
} from "../lib/readiness/mvpRealDataCutoverPlan.server.ts";
import {
  RESPONSE_LINK_PRODUCT_ACTION_ACTIVATION_APPROVED,
  describeResponseLinkProductActionActivationCheckpoint,
} from "../lib/responseTokens/productActionActivationCheckpoint.server.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const helperPath = path.join(root, "lib", "calendar", "readModel.server.ts");
const helperSource = await readFile(helperPath, "utf8");
const contractSource = await readFile(
  path.join(root, "lib", "calendar", "readModelContract.server.ts"),
  "utf8",
);
const calendarRouteSource = await readFile(
  path.join(root, "app", "admin", "calendar", "page.tsx"),
  "utf8",
);
const packageSource = await readFile(path.join(root, "package.json"), "utf8");
const currentStateSource = await readFile(path.join(root, "docs", "CURRENT_STATE.md"), "utf8");
const roadmapSource = await readFile(path.join(root, "docs", "ROADMAP.md"), "utf8");
const calendarReadinessSource = await readFile(
  path.join(root, "docs", "CALENDAR_DATA_MODEL_READINESS.md"),
  "utf8",
);
const authReadinessSource = await readFile(
  path.join(root, "docs", "SUPABASE_AUTH_PERSISTENCE_READINESS.md"),
  "utf8",
);
const localSetupSource = await readFile(
  path.join(root, "docs", "SUPABASE_LOCAL_SETUP.md"),
  "utf8",
);
const projectHistorySource = await readFile(
  path.join(root, "docs", "PROJECT_HISTORY.md"),
  "utf8",
);

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      return entry.isDirectory() ? collectFiles(entryPath) : [entryPath];
    }),
  );
  return nested.flat();
}

function assertCredentialFree(value, label) {
  const text = JSON.stringify(value);
  for (const forbidden of [
    "unsafe_volunteer_contact_marker",
    "emergency-contact",
    "questionnaire-answer",
    "unsafe_public_response_url_marker",
    "unsafe_public_response_url_marker[redacted]",
    "unsafe_bearer_marker",
    "unsafe_verifier_marker",
    "unsafe_token_marker",
    "unsafe_audit_marker",
    "unsafe_access_token_marker",
    "unsafe_refresh_token_marker",
    "unsafe_password_marker",
    "unsafe_api_key_marker",
    "unsafe_service_role_marker",
    "unsafe_sql_detail_marker",
    "unsafe_rpc_detail_marker",
    "unsafe_raw_capability_marker",
    "unsafe_unrelated_row_marker",
    "unsafe_provider_dump_marker",
    "unsafe_stack_trace_marker",
    "unsafe_raw_exception_marker",
  ]) {
    assert.equal(text.includes(forbidden), false, `${label} exposed ${forbidden}`);
  }
}

const workspaceId = "11111111-1111-4111-8111-111111111111";
const otherWorkspaceId = "99999999-9999-4999-8999-999999999999";
const actorContactId = "22222222-2222-4222-8222-222222222222";
const calendarItemId = "33333333-3333-4333-8333-333333333333";
const otherCalendarItemId = "44444444-4444-4444-8444-444444444444";
const baseInput = {
  workspaceId,
  actorContactId,
  rangeStart: "2026-01-12",
  rangeEnd: "2026-01-19",
  workspaceTimezone: "America/Denver",
  periodKind: "week",
  capabilities: ["calendar.view", "assignments.view"],
};

assert.match(helperSource, /^import "server-only";/);
assert.doesNotMatch(
  helperSource,
  /["']use server["']|createServerSupabaseClient|createBrowserSupabaseClient|\.from\(|\.rpc\(|SUPABASE_SERVICE_ROLE_KEY|createServiceRole|sendEmail\(|sendReminder\(|enqueue[A-Z]|\bcron[A-Z]|\bseedDatabase|navigator\.clipboard|clipboard\.writeText/i,
);
assert.doesNotMatch(
  helperSource,
  /from\s+["'][^"']*(?:responseTokens|productAction|assignmentDetail|diagnostic|serviceRole|mockData)/i,
);
assert.doesNotMatch(helperSource, /filledCount|assignedVolunteerIds|assignedVolunteers/);
assert.match(helperSource, /filterAndSortCalendarReadModelItems/);
assert.match(helperSource, /CalendarAssignmentCoverageScope/);

assert.equal(CALENDAR_PERSISTED_READ_MODEL_HELPER_AVAILABLE, true);
assert.equal(CALENDAR_PERSISTED_READ_MODEL_QUERY_SHAPE_AVAILABLE, true);
assert.equal(CALENDAR_PERSISTED_READ_MODEL_LIVE_QUERY_AVAILABLE, false);
assert.equal(CALENDAR_ROUTE_PERSISTED_READ_CUTOVER_AVAILABLE, false);
assert.equal(CALENDAR_ROUTE_MOCK_TO_REAL_MIXING_ALLOWED, false);
assert.equal(CALENDAR_ROUTE_PERSISTED_WRITE_AVAILABLE, false);
assert.equal(CALENDAR_ASSIGNMENT_PICKER_CUTOVER_AVAILABLE, false);
assert.equal(CALENDAR_ASSIGNMENT_DETAIL_LINKING_AVAILABLE, false);
assert.equal(CALENDAR_RESPONSE_LINK_ACTIVATION_REOPENED, false);
assert.equal(CALENDAR_SERVICE_ROLE_READ_AVAILABLE, false);
assert.equal(CALENDAR_SEED_DATA_AVAILABLE, false);

const description = describeCalendarReadModelHelper();
assert.equal(description.helperAvailable, true);
assert.equal(description.liveQueryAvailable, false);
assert.equal(description.routeCutoverAvailable, false);
assert.equal(description.mockToRealMixingAllowed, false);
assert.deepEqual(description.strictCoverageCapabilities, ["calendar.view", "assignments.view"]);

const appAndComponentFiles = [];
for (const directory of ["app", "components"]) {
  appAndComponentFiles.push(
    ...(await collectFiles(path.join(root, directory))).filter((file) =>
      /\.(?:ts|tsx)$/.test(file),
    ),
  );
}

const helperImporters = [];
const persistedCalendarRouteImporters = [];
const assignmentDetailLinks = [];
for (const file of appAndComponentFiles) {
  const relative = path.relative(root, file).replaceAll("\\", "/");
  const source = await readFile(file, "utf8");
  if (
    source.includes("readModel.server") ||
    source.includes("buildCalendarReadModelQueryShape") ||
    source.includes("mapCalendarReadModelItem") ||
    source.includes("filterAndSortCalendarReadModelItems") ||
    source.includes("CALENDAR_PERSISTED_READ_MODEL_HELPER")
  ) {
    helperImporters.push(relative);
  }
  if (
    /@\/lib\/calendar\/server|@\/lib\/calendar\/readModel|readCurrentContactCalendarItems|readCalendarItemsWithClient|calendar_items|calendar_assignments|assignment_responses/i.test(
      source,
    )
  ) {
    persistedCalendarRouteImporters.push(relative);
  }
  if (
    relative !== "app/admin/assignments/[assignmentId]/page.tsx" &&
    source.includes("/admin/assignments/")
  ) {
    assignmentDetailLinks.push(relative);
  }
}
assert.deepEqual(helperImporters, []);
assert.deepEqual(persistedCalendarRouteImporters, []);
assert.deepEqual(assignmentDetailLinks, []);
assert.match(calendarRouteSource, /@\/lib\/calendar\/routeRead\.server/);
assert.doesNotMatch(
  calendarRouteSource,
  /@\/lib\/calendar\/readModel|@\/lib\/calendar\/server|readCurrentContactCalendarItems|readCalendarItemsWithClient|calendar_items|calendar_assignments|assignment_responses|getCalendarItemsByWeek/i,
);

assert.equal(normalizeCalendarReadModelInput(baseInput).ok, true);
for (const [label, input, reason] of [
  ["workspace id required", { ...baseInput, workspaceId: undefined }, "invalid_workspace_id"],
  ["actor/contact id required", { ...baseInput, actorContactId: undefined }, "invalid_actor_contact_id"],
  ["timezone required", { ...baseInput, workspaceTimezone: undefined }, "invalid_workspace_timezone"],
  ["range start required", { ...baseInput, rangeStart: undefined }, "invalid_date_range"],
  ["range end required", { ...baseInput, rangeEnd: undefined }, "invalid_date_range"],
  ["end after start", { ...baseInput, rangeEnd: "2026-01-12" }, "range_end_must_be_after_start"],
  ["invalid dates fail closed", { ...baseInput, rangeStart: "2026-02-31" }, "invalid_date_range"],
  ["unbounded range fails closed", { ...baseInput, rangeEnd: "2026-12-31" }, "range_exceeds_bound"],
  ["period kind rejected", { ...baseInput, periodKind: "quarter" }, "invalid_period_kind"],
  ["unknown type filter rejected", { ...baseInput, filters: { type: "medical" } }, "invalid_filters"],
  ["unknown coverage rejected", { ...baseInput, filters: { coverage: "maybe" } }, "invalid_filters"],
  ["unknown lifecycle rejected", { ...baseInput, filters: { lifecycle: "hidden_state" } }, "invalid_filters"],
  [
    "overlong search rejected",
    { ...baseInput, filters: { taskNameSearch: "x".repeat(81) } },
    "invalid_filters",
  ],
]) {
  const result = normalizeCalendarReadModelInput(input);
  assert.deepEqual(result, { ok: false, reason }, label);
}

const normalizedFilters = normalizeCalendarReadModelInput({
  ...baseInput,
  filters: { taskNameSearch: "  Gate  ", type: "general", coverage: "waiting" },
});
assert.equal(normalizedFilters.ok, true);
if (normalizedFilters.ok) {
  assert.deepEqual(normalizedFilters.value.filters, {
    taskNameSearch: "Gate",
    type: "general",
    coverage: "waiting",
  });
}

assert.deepEqual(buildCalendarReadModelQueryShape({ ...baseInput, capabilities: [] }), {
  ok: false,
  reason: "missing_calendar_view",
});
assert.deepEqual(
  buildCalendarReadModelQueryShape({ ...baseInput, capabilities: ["calendar.view"] }),
  { ok: false, reason: "missing_assignments_view_for_coverage" },
);
assert.deepEqual(evaluateCalendarReadModelCapabilities(["calendar.view"]), {
  canReadItemShells: true,
  canReadAssignmentDerivedCoverage: false,
  strictCoverageRule:
    "calendar.view_and_assignments.view_required_for_assignment_derived_counts",
});
assert.deepEqual(
  buildCalendarReadModelQueryShape({
    ...baseInput,
    capabilities: [],
    roleTitle: "Owner with calendar.view and assignments.view",
  }),
  { ok: false, reason: "missing_calendar_view" },
);

for (const periodKind of ["day", "week", "month", "list"]) {
  const shape = buildCalendarReadModelQueryShape({ ...baseInput, periodKind });
  assert.equal(shape.ok, true, `${periodKind} shape should be valid`);
  if (shape.ok) {
    assert.equal(shape.value.selectorPlan.calendarItemShellRows.table, "calendar_items");
    assert.deepEqual(shape.value.selectorPlan.assignmentAggregateRows.tables, [
      "calendar_assignments",
      "assignment_responses",
    ]);
    assert.equal(shape.value.selectorPlan.assignmentAggregateRows.aggregateOnly, true);
    assert.deepEqual(shape.value.selectorPlan.scope?.capabilities, undefined);
    assert.deepEqual(shape.value.scope.requiredCapabilities, [
      "calendar.view",
      "assignments.view",
    ]);
  }
}

const coverageRows = [
  {
    assignmentId: "needs",
    workspaceId,
    calendarItemId,
    assignmentLifecycle: "active",
    currentResponseStatus: "needs_response",
  },
  {
    assignmentId: "confirmed",
    workspaceId,
    calendarItemId,
    assignmentLifecycle: "active",
    currentResponseStatus: "confirmed",
  },
  {
    assignmentId: "declined",
    workspaceId,
    calendarItemId,
    assignmentLifecycle: "active",
    currentResponseStatus: "declined",
  },
  {
    assignmentId: "removed",
    workspaceId,
    calendarItemId,
    assignmentLifecycle: "removed",
    currentResponseStatus: "confirmed",
  },
  {
    assignmentId: "other-workspace",
    workspaceId: otherWorkspaceId,
    calendarItemId,
    assignmentLifecycle: "active",
    currentResponseStatus: "confirmed",
  },
  {
    assignmentId: "other-item",
    workspaceId,
    calendarItemId: otherCalendarItemId,
    assignmentLifecycle: "active",
    currentResponseStatus: "confirmed",
  },
];
const scopedCoverage = summarizeCalendarAssignmentCoverage(6, "timed", coverageRows, {
  workspaceId,
  calendarItemId,
});
assert.equal(scopedCoverage.assignedCount, 2);
assert.equal(scopedCoverage.confirmedCount, 1);
assert.equal(scopedCoverage.deniedCount, 1);
assert.equal(scopedCoverage.waitingOnConfirmationCount, 1);
assert.equal(scopedCoverage.unassignedCount, 4);
assert.equal(scopedCoverage.hasDenied, true);
assert.equal(scopedCoverage.allAssignedHelpersDenied, false);
assert.equal(scopedCoverage.coverageState, "some_denied");
assert.equal(scopedCoverage.assignedFractionLabel, "2/6 assigned");

const partialWaiting = summarizeCalendarAssignmentCoverage(6, "timed", [
  ...Array.from({ length: 3 }, (_, index) => ({
    assignmentId: `confirmed-${index}`,
    assignmentLifecycle: "active",
    currentResponseStatus: "confirmed",
  })),
  {
    assignmentId: "waiting",
    assignmentLifecycle: "active",
    currentResponseStatus: "needs_response",
  },
]);
assert.equal(partialWaiting.assignedCount, 4);
assert.equal(partialWaiting.waitingOnConfirmationCount, 1);
assert.equal(partialWaiting.assignedFractionLabel, "4/6 assigned");
assert.equal(partialWaiting.coverageState, "waiting");

const fullyConfirmed = summarizeCalendarAssignmentCoverage(
  6,
  "date_based",
  Array.from({ length: 6 }, (_, index) => ({
    assignmentId: `confirmed-${index}`,
    assignmentLifecycle: "active",
    currentResponseStatus: "confirmed",
  })),
);
assert.equal(fullyConfirmed.assignedCount, 6);
assert.equal(fullyConfirmed.confirmedCount, 6);
assert.equal(fullyConfirmed.unassignedCount, 0);
assert.equal(fullyConfirmed.assignedFractionLabel, "6/6 assigned");
assert.equal(fullyConfirmed.coverageState, "confirmed");

const overAssigned = summarizeCalendarAssignmentCoverage(
  1,
  "timed",
  Array.from({ length: 3 }, (_, index) => ({
    assignmentId: `over-${index}`,
    assignmentLifecycle: "active",
    currentResponseStatus: "confirmed",
  })),
);
assert.equal(overAssigned.unassignedCount, 0);
assert.equal(overAssigned.assignedFractionLabel, "3/1 assigned");

const allDenied = summarizeCalendarAssignmentCoverage(2, "timed", [
  {
    assignmentId: "denied-1",
    assignmentLifecycle: "active",
    currentResponseStatus: "denied",
  },
  {
    assignmentId: "denied-2",
    assignmentLifecycle: "active",
    currentResponseStatus: "declined",
  },
]);
assert.equal(allDenied.assignedCount, 0);
assert.equal(allDenied.deniedCount, 2);
assert.equal(allDenied.allAssignedHelpersDenied, true);
assert.equal(allDenied.coverageState, "all_denied");

const zeroNeeded = summarizeCalendarAssignmentCoverage(0, "timed", [
  {
    assignmentId: "ignored",
    assignmentLifecycle: "active",
    currentResponseStatus: "confirmed",
  },
]);
assert.equal(zeroNeeded.assignedFractionLabel, "0/0 assigned");
assert.equal(zeroNeeded.allAssignedHelpersDenied, false);
assert.equal(zeroNeeded.coverageState, "not_assignable");

for (const scheduleKind of ["multi_day_window", "milestone"]) {
  const informational = summarizeCalendarAssignmentCoverage(99, scheduleKind, [
    {
      assignmentId: "ignored",
      workspaceId,
      calendarItemId,
      assignmentLifecycle: "active",
      currentResponseStatus: "confirmed",
    },
  ]);
  assert.equal(informational.assignedCount, 0);
  assert.equal(informational.assignedFractionLabel, "0/0 assigned");
  assert.equal(informational.coverageState, "not_assignable");
  assert.equal(informational.aggregateVolunteerCountOnMultiDayWindowAllowed, false);
}

function itemRow(overrides = {}) {
  return {
    id: calendarItemId,
    workspaceId,
    titleSnapshot: "Gate Crew",
    taskTypeSnapshot: "general",
    scheduleKind: "timed",
    startDate: "2026-01-13",
    endDate: null,
    startTime: "07:30",
    endTime: "10:30",
    timezone: "America/Denver",
    neededCount: 6,
    lifecycle: "active",
    scheduleNotes: "Safe project-contact note",
    oneOffTaskLabel: null,
    oneOffTaskType: null,
    taskPresetLabel: "Gate Crew",
    taskPresetType: "general",
    volunteerEmail: "unsafe_volunteer_contact_marker",
    emergencyContact: "emergency-contact",
    questionnaireAnswers: "questionnaire-answer",
    responseUrl: "unsafe_public_response_url_markerunsafe_bearer_marker",
    redactedResponseUrl: "unsafe_public_response_url_marker[redacted]",
    bearer: "unsafe_bearer_marker",
    verifier: "unsafe_verifier_marker",
    tokenId: "unsafe_token_marker",
    auditId: "unsafe_audit_marker",
    accessToken: "unsafe_access_token_marker",
    refreshToken: "unsafe_refresh_token_marker",
    password: "unsafe_password_marker",
    apiKey: "unsafe_api_key_marker",
    serviceRoleKey: "unsafe_service_role_marker",
    sqlDetail: "unsafe_sql_detail_marker",
    rpcDetail: "unsafe_rpc_detail_marker",
    rawCapabilities: "unsafe_raw_capability_marker",
    unrelatedRow: "unsafe_unrelated_row_marker",
    providerDump: "unsafe_provider_dump_marker",
    stackTrace: "unsafe_stack_trace_marker",
    rawException: "unsafe_raw_exception_marker",
    ...overrides,
  };
}

const mapped = mapCalendarReadModelItem(itemRow(), coverageRows);
assert.deepEqual(Object.keys(mapped).sort(), [
  "assignedFractionLabel",
  "calendarItemId",
  "coverage",
  "displayType",
  "endDate",
  "endTime",
  "lifecycle",
  "neededCount",
  "oneOffTaskLabel",
  "oneOffTaskType",
  "scheduleKind",
  "scheduleNotes",
  "stableDisplayReference",
  "startDate",
  "startTime",
  "taskPresetLabel",
  "taskPresetType",
  "taskSourceLabel",
  "timezone",
]);
assert.equal(mapped.calendarItemId, calendarItemId);
assert.equal(mapped.stableDisplayReference, `calendar-item:${calendarItemId}`);
assert.equal(mapped.taskSourceLabel, "Gate Crew");
assert.equal(mapped.displayType, "general");
assert.equal(mapped.scheduleKind, "timed");
assert.equal(mapped.timezone, "America/Denver");
assert.equal(mapped.neededCount, 6);
assert.equal(mapped.lifecycle, "active");
assert.equal(mapped.scheduleNotes, "Safe project-contact note");
assert.equal(mapped.assignedFractionLabel, "2/6 assigned");
assertCredentialFree(mapped, "mapped calendar item");

for (const forbiddenField of [
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
]) {
  assert.ok(calendarReadModelForbiddenOutputFields.includes(forbiddenField));
}

const filterItems = [
  mapCalendarReadModelItem(
    itemRow({
      id: "55555555-5555-4555-8555-555555555555",
      titleSnapshot: "Alpha Security",
      taskPresetLabel: "Alpha Security",
      taskPresetType: "security",
      taskTypeSnapshot: "security",
      startDate: "2026-01-13",
      startTime: "08:00",
      neededCount: 1,
    }),
    [{ assignmentId: "a", assignmentLifecycle: "active", currentResponseStatus: "confirmed" }],
  ),
  mapCalendarReadModelItem(
    itemRow({
      id: "66666666-6666-4666-8666-666666666666",
      titleSnapshot: "Breakfast Service",
      taskPresetLabel: "Breakfast Service",
      taskPresetType: "food",
      taskTypeSnapshot: "food",
      startDate: "2026-01-14",
      startTime: "06:30",
      neededCount: 2,
      lifecycle: "published",
    }),
    [{ assignmentId: "b", assignmentLifecycle: "active", currentResponseStatus: "needs_response" }],
  ),
  mapCalendarReadModelItem(
    itemRow({
      id: "77777777-7777-4777-8777-777777777777",
      titleSnapshot: "Gate Crew",
      taskPresetLabel: "Gate Crew",
      startDate: "2026-01-13",
      startTime: "07:30",
      neededCount: 2,
    }),
    [
      { assignmentId: "c", assignmentLifecycle: "active", currentResponseStatus: "confirmed" },
      { assignmentId: "d", assignmentLifecycle: "active", currentResponseStatus: "needs_response" },
    ],
  ),
  mapCalendarReadModelItem(
    itemRow({
      id: "88888888-8888-4888-8888-888888888888",
      titleSnapshot: "Gate Denied",
      taskPresetLabel: "Gate Denied",
      startDate: "2026-01-13",
      startTime: "09:00",
      neededCount: 2,
    }),
    [
      { assignmentId: "e", assignmentLifecycle: "active", currentResponseStatus: "declined" },
      { assignmentId: "f", assignmentLifecycle: "active", currentResponseStatus: "confirmed" },
    ],
  ),
];
assert.deepEqual(
  filterAndSortCalendarReadModelItems(filterItems).map((item) => item.calendarItemId),
  [
    "77777777-7777-4777-8777-777777777777",
    "55555555-5555-4555-8555-555555555555",
    "88888888-8888-4888-8888-888888888888",
    "66666666-6666-4666-8666-666666666666",
  ],
);
assert.deepEqual(
  filterAndSortCalendarReadModelItems(filterItems, { taskNameSearch: "gate" }).map(
    (item) => item.taskSourceLabel,
  ),
  ["Gate Crew", "Gate Denied"],
);
assert.deepEqual(
  filterAndSortCalendarReadModelItems(filterItems, { type: "food" }).map(
    (item) => item.taskSourceLabel,
  ),
  ["Breakfast Service"],
);
assert.deepEqual(
  filterAndSortCalendarReadModelItems(filterItems, { coverage: "waiting" }).map(
    (item) => item.taskSourceLabel,
  ),
  ["Gate Crew", "Breakfast Service"],
);
assert.deepEqual(
  filterAndSortCalendarReadModelItems(filterItems, { coverage: "someDenied" }).map(
    (item) => item.taskSourceLabel,
  ),
  ["Gate Denied"],
);
assert.deepEqual(
  filterAndSortCalendarReadModelItems(filterItems, { lifecycle: "published" }).map(
    (item) => item.taskSourceLabel,
  ),
  ["Breakfast Service"],
);
assert.deepEqual(filterAndSortCalendarReadModelItems(filterItems, { type: "medical" }), []);
assert.deepEqual(
  filterAndSortCalendarReadModelItems(filterItems, { taskNameSearch: "x".repeat(81) }),
  [],
);

for (const blocked of [
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
]) {
  assert.ok(calendarReadModelExplicitlyBlocked.includes(blocked));
}

const contract = describeCalendarPersistedReadModelContract();
assert.equal(CALENDAR_PERSISTED_READ_MODEL_CONTRACT_AVAILABLE, true);
assert.equal(contract.routeCutoverAvailable, false);
assert.equal(contract.mockToRealMixingAllowed, false);
assert.deepEqual(contract.contract.capabilityContract.assignmentDerivedCoverageCountsRequire, [
  "calendar.view",
  "assignments.view",
]);
assert.match(contractSource, /calendar_item_counters/);
assert.match(contractSource, /mock_filledCount/);
assert.match(contractSource, /assignedVolunteerIds_arrays/);

const mvpPlan = describeMvpRealDataCutoverPlan();
assert.equal(MVP_REAL_DATA_CUTOVER_PLAN_AVAILABLE, true);
assert.equal(mvpPlan.calendarRoutePersistedReadCutoverAvailable, false);
assert.equal(mvpPlan.responseLinkActivationReopened, false);
assert.equal(mvpPlan.mockToRealMixingAllowed, false);
assert.equal(mvpPlan.serviceRoleCutoverAvailable, false);

const activationCheckpoint = describeResponseLinkProductActionActivationCheckpoint();
assert.equal(RESPONSE_LINK_PRODUCT_ACTION_ACTIVATION_APPROVED, false);
assert.equal(activationCheckpoint.activeRevealAvailable, false);
assert.equal(activationCheckpoint.activeCopyAvailable, false);

assert.match(
  packageSource,
  /"test:calendar-read-model-helper:qa": "node --conditions=react-server --no-warnings --experimental-strip-types scripts\/calendar-read-model-helper-qa-regression\.mjs"/,
);
assert.match(currentStateSource, /Iteration 12\.4/);
assert.match(roadmapSource, /12\.5 Route-Unused Calendar Read Model Disposable Local Data Validation/);
assert.match(calendarReadinessSource, /12\.4 Route-Unused Calendar Read Model Helper QA Harness/);
assert.match(authReadinessSource, /12\.4 route-unused Calendar read model helper QA harness/i);
assert.match(localSetupSource, /test:calendar-read-model-helper:qa/);
assert.match(projectHistorySource, /Iteration 12\.4 - Route-Unused Calendar Read Model Helper QA Harness/);
assert.match(localSetupSource, /Do not print raw Supabase CLI\/status\/start output/);
assert.match(localSetupSource, /Redirect Supabase start\/status output to a temporary file/);
assert.match(localSetupSource, /Redact key-like values before displaying diagnostics/);

console.log("Calendar read model helper QA checks passed.");
console.log("Confirmed route-unused QA with in-memory fixtures, strict capabilities, safe projection, and no live database calls.");
