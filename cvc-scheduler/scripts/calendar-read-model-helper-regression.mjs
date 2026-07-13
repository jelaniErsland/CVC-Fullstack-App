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

const baseInput = {
  workspaceId: "11111111-1111-4111-8111-111111111111",
  actorContactId: "22222222-2222-4222-8222-222222222222",
  rangeStart: "2026-01-12",
  rangeEnd: "2026-01-19",
  workspaceTimezone: "America/Denver",
  periodKind: "week",
  filters: {
    taskNameSearch: "gate",
    type: "general",
    coverage: "waiting",
    lifecycle: "active",
  },
  capabilities: ["calendar.view", "assignments.view"],
};

assert.match(helperSource, /^import "server-only";/);
assert.doesNotMatch(
  helperSource,
  /["']use server["']|createServerSupabaseClient|createBrowserSupabaseClient|\.from\(|\.rpc\(|SUPABASE_SERVICE_ROLE_KEY|createServiceRole|sendEmail\(|sendReminder\(|enqueue[A-Z]|\bcron[A-Z]|\bseedDatabase|navigator\.clipboard|clipboard\.writeText/i,
);
assert.match(helperSource, /CALENDAR_PERSISTED_READ_MODEL_HELPER_AVAILABLE = true/);
assert.match(helperSource, /CALENDAR_PERSISTED_READ_MODEL_QUERY_SHAPE_AVAILABLE = true/);
assert.match(helperSource, /CALENDAR_PERSISTED_READ_MODEL_LIVE_QUERY_AVAILABLE = false/);
for (const falseFlag of [
  "CALENDAR_ROUTE_PERSISTED_READ_CUTOVER_AVAILABLE",
  "CALENDAR_ROUTE_MOCK_TO_REAL_MIXING_ALLOWED",
  "CALENDAR_ROUTE_PERSISTED_WRITE_AVAILABLE",
  "CALENDAR_ASSIGNMENT_PICKER_CUTOVER_AVAILABLE",
  "CALENDAR_ASSIGNMENT_DETAIL_LINKING_AVAILABLE",
  "CALENDAR_RESPONSE_LINK_ACTIVATION_REOPENED",
  "CALENDAR_SERVICE_ROLE_READ_AVAILABLE",
  "CALENDAR_SEED_DATA_AVAILABLE",
]) {
  assert.match(helperSource, new RegExp(`export const ${falseFlag}`));
}

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
assert.equal(description.queryShapeAvailable, true);
assert.equal(description.liveQueryAvailable, false);
assert.equal(description.routeCutoverAvailable, false);
assert.equal(description.mockToRealMixingAllowed, false);
assert.equal(description.persistedWriteAvailable, false);
assert.equal(description.assignmentPickerCutoverAvailable, false);
assert.equal(description.assignmentDetailLinkingAvailable, false);
assert.equal(description.responseLinkActivationReopened, false);
assert.equal(description.serviceRoleReadAvailable, false);
assert.equal(description.seedDataAvailable, false);
assert.deepEqual(description.strictCoverageCapabilities, ["calendar.view", "assignments.view"]);

const normalized = normalizeCalendarReadModelInput(baseInput);
assert.equal(normalized.ok, true);
if (normalized.ok) {
  assert.equal(normalized.value.workspaceId, baseInput.workspaceId);
  assert.equal(normalized.value.actorContactId, baseInput.actorContactId);
  assert.equal(normalized.value.rangeStart, "2026-01-12");
  assert.equal(normalized.value.rangeEnd, "2026-01-19");
  assert.deepEqual(normalized.value.capabilities, ["assignments.view", "calendar.view"]);
}

for (const [label, input] of [
  ["missing range start", { ...baseInput, rangeStart: undefined }],
  ["range end before start", { ...baseInput, rangeEnd: "2026-01-11" }],
  ["unbounded range", { ...baseInput, rangeEnd: "2026-06-01" }],
  ["invalid date", { ...baseInput, rangeStart: "2026-02-31" }],
  ["invalid timezone", { ...baseInput, workspaceTimezone: "Browser/Provided" }],
  ["missing workspace", { ...baseInput, workspaceId: "not-a-uuid" }],
  ["missing actor", { ...baseInput, actorContactId: "not-a-uuid" }],
]) {
  const result = normalizeCalendarReadModelInput(input);
  assert.equal(result.ok, false, label);
}

assert.deepEqual(evaluateCalendarReadModelCapabilities(["calendar.view"]), {
  canReadItemShells: true,
  canReadAssignmentDerivedCoverage: false,
  strictCoverageRule:
    "calendar.view_and_assignments.view_required_for_assignment_derived_counts",
});
assert.deepEqual(evaluateCalendarReadModelCapabilities(["assignments.view"]), {
  canReadItemShells: false,
  canReadAssignmentDerivedCoverage: false,
  strictCoverageRule:
    "calendar.view_and_assignments.view_required_for_assignment_derived_counts",
});

const missingCalendarView = buildCalendarReadModelQueryShape({
  ...baseInput,
  capabilities: ["assignments.view"],
});
assert.deepEqual(missingCalendarView, { ok: false, reason: "missing_calendar_view" });

const missingAssignmentsView = buildCalendarReadModelQueryShape({
  ...baseInput,
  capabilities: ["calendar.view"],
});
assert.deepEqual(missingAssignmentsView, {
  ok: false,
  reason: "missing_assignments_view_for_coverage",
});

const queryShape = buildCalendarReadModelQueryShape(baseInput);
assert.equal(queryShape.ok, true);
if (queryShape.ok) {
  assert.deepEqual(queryShape.value.scope.requiredCapabilities, [
    "calendar.view",
    "assignments.view",
  ]);
  assert.equal(queryShape.value.selectorPlan.calendarItemShellRows.table, "calendar_items");
  assert.deepEqual(queryShape.value.selectorPlan.assignmentAggregateRows.tables, [
    "calendar_assignments",
    "assignment_responses",
  ]);
  assert.equal(queryShape.value.selectorPlan.assignmentAggregateRows.aggregateOnly, true);
  for (const forbiddenTable of [
    "volunteer_contact_values",
    "questionnaire_answers",
    "emergency_contacts",
    "assignment_response_tokens",
    "assignment_response_link_reveal_events",
    "project_contact_grants_raw_capabilities",
  ]) {
    assert.ok(queryShape.value.selectorPlan.forbiddenTables.includes(forbiddenTable));
  }
}

const coverage = summarizeCalendarAssignmentCoverage(4, "timed", [
  {
    assignmentId: "a1",
    assignmentLifecycle: "active",
    currentResponseStatus: "needs_response",
  },
  {
    assignmentId: "a2",
    assignmentLifecycle: "active",
    currentResponseStatus: "confirmed",
  },
  {
    assignmentId: "a3",
    assignmentLifecycle: "active",
    currentResponseStatus: "declined",
  },
  {
    assignmentId: "a4",
    assignmentLifecycle: "removed",
    currentResponseStatus: "confirmed",
  },
]);
assert.equal(coverage.assignedCount, 2);
assert.equal(coverage.confirmedCount, 1);
assert.equal(coverage.deniedCount, 1);
assert.equal(coverage.waitingOnConfirmationCount, 1);
assert.equal(coverage.unassignedCount, 2);
assert.equal(coverage.hasDenied, true);
assert.equal(coverage.allAssignedHelpersDenied, false);
assert.equal(coverage.coverageState, "some_denied");
assert.equal(coverage.assignedFractionLabel, "2/4 assigned");
assert.equal(coverage.aggregateVolunteerCountOnMultiDayWindowAllowed, false);

const overAssigned = summarizeCalendarAssignmentCoverage(1, "timed", [
  {
    assignmentId: "a1",
    assignmentLifecycle: "active",
    currentResponseStatus: "confirmed",
  },
  {
    assignmentId: "a2",
    assignmentLifecycle: "active",
    currentResponseStatus: "needs_response",
  },
]);
assert.equal(overAssigned.unassignedCount, 0);
assert.equal(overAssigned.assignedFractionLabel, "2/1 assigned");

const allDenied = summarizeCalendarAssignmentCoverage(2, "date_based", [
  {
    assignmentId: "a1",
    assignmentLifecycle: "active",
    currentResponseStatus: "declined",
  },
  {
    assignmentId: "a2",
    assignmentLifecycle: "active",
    currentResponseStatus: "denied",
  },
]);
assert.equal(allDenied.assignedCount, 0);
assert.equal(allDenied.deniedCount, 2);
assert.equal(allDenied.allAssignedHelpersDenied, true);
assert.equal(allDenied.coverageState, "all_denied");

for (const scheduleKind of ["multi_day_window", "milestone"]) {
  const informational = summarizeCalendarAssignmentCoverage(99, scheduleKind, [
    {
      assignmentId: "a1",
      assignmentLifecycle: "active",
      currentResponseStatus: "confirmed",
    },
  ]);
  assert.equal(informational.assignedCount, 0);
  assert.equal(informational.confirmedCount, 0);
  assert.equal(informational.assignedFractionLabel, "0/0 assigned");
  assert.equal(informational.coverageState, "not_assignable");
  assert.equal(informational.aggregateVolunteerCountOnMultiDayWindowAllowed, false);
}

const unsafeRow = {
  id: "33333333-3333-4333-8333-333333333333",
  workspaceId: baseInput.workspaceId,
  titleSnapshot: "Gate attendant",
  taskTypeSnapshot: "general",
  scheduleKind: "timed",
  startDate: "2026-01-13",
  endDate: null,
  startTime: "07:30",
  endTime: "10:30",
  timezone: "America/Denver",
  neededCount: 2,
  lifecycle: "active",
  scheduleNotes: "Safe project-contact note",
  taskPresetLabel: "Gate attendant",
  taskPresetType: "general",
  volunteerEmail: "unsafe@example.invalid",
  emergencyContactPhone: "+1 555 0100",
  questionnaireAnswers: "unsafe answer",
  bearer: "unsafe bearer",
  verifier: "unsafe verifier",
  tokenId: "unsafe token",
  auditId: "unsafe audit",
  rawCapabilities: ["calendar.view"],
};
const mapped = mapCalendarReadModelItem(unsafeRow, [
  {
    assignmentId: "a1",
    assignmentLifecycle: "active",
    currentResponseStatus: "confirmed",
  },
]);
assert.equal(mapped.calendarItemId, unsafeRow.id);
assert.equal(mapped.stableDisplayReference, `calendar-item:${unsafeRow.id}`);
assert.equal(mapped.taskSourceLabel, "Gate attendant");
assert.equal(mapped.displayType, "general");
assert.equal(mapped.assignedFractionLabel, "1/2 assigned");
const mappedText = JSON.stringify(mapped);
for (const unsafeNeedle of [
  "unsafe@example.invalid",
  "555 0100",
  "unsafe answer",
  "unsafe bearer",
  "unsafe verifier",
  "unsafe token",
  "unsafe audit",
  "rawCapabilities",
  "calendar.view",
]) {
  assert.equal(mappedText.includes(unsafeNeedle), false);
}

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

for (const blocked of [
  "admin_calendar_route_cutover",
  "calendar_ui_changes",
  "calendar_create_edit_archive_cancel_ui",
  "calendar_write_commands",
  "assignment_picker",
  "assignment_create_cancel",
  "public_volunteer_lookup",
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
const serviceRoleMarkers = [];
for (const file of appAndComponentFiles) {
  const relative = path.relative(root, file).replaceAll("\\", "/");
  const source = await readFile(file, "utf8");
  if (
    source.includes("readModel.server") ||
    source.includes("describeCalendarReadModelHelper") ||
    source.includes("CALENDAR_PERSISTED_READ_MODEL_HELPER") ||
    source.includes("buildCalendarReadModelQueryShape") ||
    source.includes("mapCalendarReadModelItem")
  ) {
    helperImporters.push(relative);
  }
  if (
    /@\/lib\/calendar\/server|@\/lib\/calendar\/readModel|readCurrentContactCalendarItems|readCalendarItemsWithClient|buildCalendarReadModelQueryShape|calendar_items|calendar_assignments|assignment_responses/i.test(
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
  if (/SUPABASE_SERVICE_ROLE_KEY|serviceRole|createServiceRole/i.test(source)) {
    serviceRoleMarkers.push(relative);
  }
}

assert.deepEqual(helperImporters, []);
assert.deepEqual(persistedCalendarRouteImporters, []);
assert.deepEqual(assignmentDetailLinks, []);
assert.deepEqual(serviceRoleMarkers, []);
assert.match(calendarRouteSource, /@\/lib\/mockData/);
assert.doesNotMatch(
  calendarRouteSource,
  /@\/lib\/calendar\/readModel|@\/lib\/calendar\/server|readCurrentContactCalendarItems|readCalendarItemsWithClient|calendar_items|calendar_assignments|assignment_responses/i,
);

const contract = describeCalendarPersistedReadModelContract();
assert.equal(CALENDAR_PERSISTED_READ_MODEL_CONTRACT_AVAILABLE, true);
assert.equal(contract.contractAvailable, true);
assert.equal(contract.implementationAvailable, false);
assert.equal(contract.routeCutoverAvailable, false);
assert.deepEqual(contract.contract.capabilityContract.assignmentDerivedCoverageCountsRequire, [
  "calendar.view",
  "assignments.view",
]);

const mvpPlan = describeMvpRealDataCutoverPlan();
assert.equal(MVP_REAL_DATA_CUTOVER_PLAN_AVAILABLE, true);
assert.equal(mvpPlan.planAvailable, true);
assert.equal(mvpPlan.calendarRoutePersistedReadCutoverAvailable, false);
assert.equal(mvpPlan.responseLinkActivationReopened, false);

const activationCheckpoint = describeResponseLinkProductActionActivationCheckpoint();
assert.equal(activationCheckpoint.checkpointAvailable, true);
assert.equal(RESPONSE_LINK_PRODUCT_ACTION_ACTIVATION_APPROVED, false);
assert.equal(activationCheckpoint.activeRevealAvailable, false);
assert.equal(activationCheckpoint.activeCopyAvailable, false);

assert.match(packageSource, /"test:calendar-read-model-helper": "node --conditions=react-server --no-warnings --experimental-strip-types scripts\/calendar-read-model-helper-regression\.mjs"/);
assert.match(currentStateSource, /Iteration 12\.3/);
assert.match(roadmapSource, /12\.3 Route-Unused Calendar Read Model Helper or Query-Shape Review/);
assert.match(calendarReadinessSource, /12\.3 Route-Unused Calendar Read Model Helper/);
assert.match(authReadinessSource, /12\.3 route-unused Calendar read model helper/i);
assert.match(localSetupSource, /test:calendar-read-model-helper/);
assert.match(projectHistorySource, /Iteration 12\.3 - Route-Unused Calendar Read Model Helper or Query-Shape Review/);
assert.match(localSetupSource, /Do not print raw Supabase CLI\/status\/start output/);
assert.match(localSetupSource, /Redirect Supabase start\/status output to a temporary file/);
assert.match(localSetupSource, /Redact key-like values before displaying diagnostics/);

console.log("Calendar read model helper/query-shape checks passed.");
console.log("Confirmed route-unused helper, strict capabilities, safe projection, and assignment-derived coverage.");
