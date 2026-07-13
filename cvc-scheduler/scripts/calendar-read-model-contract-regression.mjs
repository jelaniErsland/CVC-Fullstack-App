import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CALENDAR_ASSIGNMENT_DETAIL_LINKING_AVAILABLE,
  CALENDAR_ASSIGNMENT_PICKER_CUTOVER_AVAILABLE,
  CALENDAR_PERSISTED_READ_MODEL_CONTRACT_AVAILABLE,
  CALENDAR_PERSISTED_READ_MODEL_IMPLEMENTATION_AVAILABLE,
  CALENDAR_RESPONSE_LINK_ACTIVATION_REOPENED,
  CALENDAR_ROUTE_MOCK_TO_REAL_MIXING_ALLOWED,
  CALENDAR_ROUTE_PERSISTED_READ_CUTOVER_AVAILABLE,
  CALENDAR_ROUTE_PERSISTED_WRITE_AVAILABLE,
  CALENDAR_SEED_DATA_AVAILABLE,
  CALENDAR_SERVICE_ROLE_READ_AVAILABLE,
  calendarPersistedReadModelContract,
  describeCalendarPersistedReadModelContract,
  evaluateCalendarPersistedReadModelReadiness,
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
const contractPath = path.join(root, "lib", "calendar", "readModelContract.server.ts");
const contractSource = await readFile(contractPath, "utf8");
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

assert.match(contractSource, /^import "server-only";/);
assert.doesNotMatch(
  contractSource,
  /["']use server["']|createServerSupabaseClient|createBrowserSupabaseClient|\.from\(|\.rpc\(|SUPABASE_SERVICE_ROLE_KEY|createServiceRole|sendEmail\(|sendReminder\(|enqueue[A-Z]|\bcron[A-Z]|\bseedDatabase|navigator\.clipboard|clipboard\.writeText/i,
);
assert.match(contractSource, /CALENDAR_PERSISTED_READ_MODEL_CONTRACT_AVAILABLE = true/);
for (const falseFlag of [
  "CALENDAR_PERSISTED_READ_MODEL_IMPLEMENTATION_AVAILABLE",
  "CALENDAR_ROUTE_PERSISTED_READ_CUTOVER_AVAILABLE",
  "CALENDAR_ROUTE_MOCK_TO_REAL_MIXING_ALLOWED",
  "CALENDAR_ROUTE_PERSISTED_WRITE_AVAILABLE",
  "CALENDAR_ASSIGNMENT_PICKER_CUTOVER_AVAILABLE",
  "CALENDAR_ASSIGNMENT_DETAIL_LINKING_AVAILABLE",
  "CALENDAR_RESPONSE_LINK_ACTIVATION_REOPENED",
  "CALENDAR_SERVICE_ROLE_READ_AVAILABLE",
  "CALENDAR_SEED_DATA_AVAILABLE",
]) {
  assert.match(contractSource, new RegExp(`${falseFlag} = false`));
}

assert.equal(CALENDAR_PERSISTED_READ_MODEL_CONTRACT_AVAILABLE, true);
assert.equal(CALENDAR_PERSISTED_READ_MODEL_IMPLEMENTATION_AVAILABLE, false);
assert.equal(CALENDAR_ROUTE_PERSISTED_READ_CUTOVER_AVAILABLE, false);
assert.equal(CALENDAR_ROUTE_MOCK_TO_REAL_MIXING_ALLOWED, false);
assert.equal(CALENDAR_ROUTE_PERSISTED_WRITE_AVAILABLE, false);
assert.equal(CALENDAR_ASSIGNMENT_PICKER_CUTOVER_AVAILABLE, false);
assert.equal(CALENDAR_ASSIGNMENT_DETAIL_LINKING_AVAILABLE, false);
assert.equal(CALENDAR_RESPONSE_LINK_ACTIVATION_REOPENED, false);
assert.equal(CALENDAR_SERVICE_ROLE_READ_AVAILABLE, false);
assert.equal(CALENDAR_SEED_DATA_AVAILABLE, false);

const description = describeCalendarPersistedReadModelContract();
assert.equal(description.contractAvailable, true);
assert.equal(description.implementationAvailable, false);
assert.equal(description.routeCutoverAvailable, false);
assert.equal(description.mockToRealMixingAllowed, false);
assert.equal(description.persistedWriteAvailable, false);
assert.equal(description.assignmentPickerCutoverAvailable, false);
assert.equal(description.assignmentDetailLinkingAvailable, false);
assert.equal(description.responseLinkActivationReopened, false);
assert.equal(description.serviceRoleReadAvailable, false);
assert.equal(description.seedDataAvailable, false);

const readiness = evaluateCalendarPersistedReadModelReadiness();
assert.equal(readiness.allowedForRouteCutover, false);
assert.equal(readiness.recommendedNextImplementationSlice.id, "12.3");
for (const blocker of [
  "read_model_implementation_unavailable",
  "admin_calendar_route_cutover_unavailable",
  "mock_to_real_mixing_disallowed",
  "calendar_writes_unavailable",
  "assignment_picker_cutover_unavailable",
  "assignment_detail_linking_unavailable",
  "response_link_activation_paused_after_11_50",
  "service_role_read_unavailable",
  "seed_data_unavailable",
]) {
  assert.ok(readiness.blockers.includes(blocker));
}

assert.equal(calendarPersistedReadModelContract.routeUnused, true);
assert.equal(calendarPersistedReadModelContract.currentRouteCutover, false);
assert.equal(calendarPersistedReadModelContract.periodListRead.workspaceScoped, true);
assert.equal(calendarPersistedReadModelContract.periodListRead.authenticatedProjectContactOnly, true);
assert.equal(calendarPersistedReadModelContract.periodListRead.capabilityChecked, true);
assert.equal(calendarPersistedReadModelContract.periodListRead.anonymousReadAllowed, false);
assert.equal(calendarPersistedReadModelContract.periodListRead.serviceRolePathAllowed, false);
assert.equal(calendarPersistedReadModelContract.periodListRead.seedDataAllowed, false);
assert.equal(calendarPersistedReadModelContract.periodListRead.mockFallbackAllowed, false);
assert.deepEqual(calendarPersistedReadModelContract.periodListRead.suitableViews, [
  "day",
  "week",
  "month",
  "list",
]);
assert.equal(calendarPersistedReadModelContract.periodListRead.explicitDateRangeRequired, true);
assert.equal(calendarPersistedReadModelContract.periodListRead.timezoneRule, "workspace_timezone");
assert.equal(calendarPersistedReadModelContract.periodListRead.rawBroadTableExposureAllowed, false);

for (const safeField of [
  "calendar_item_id",
  "workspace_id_internal_only_when_needed",
  "task_source_label",
  "task_type_category_display_value",
  "schedule_kind",
  "start_date",
  "end_date",
  "start_time",
  "end_time",
  "timezone",
  "needed_count",
  "lifecycle_publication_state",
  "safe_schedule_notes_for_project_contacts",
  "one_off_task_snapshot_label",
  "one_off_task_snapshot_type",
  "task_preset_reference_label",
  "stable_display_reference",
  "assignment_derived_counts",
  "safe_inspector_fields_for_project_contact_calendar_context",
]) {
  assert.ok(calendarPersistedReadModelContract.itemProjection.safeFields.includes(safeField));
}

assert.equal(
  calendarPersistedReadModelContract.assignmentDerivedCoverageSummary.sourceOfTruth,
  "calendar_assignments_and_current_assignment_responses",
);
for (const forbiddenSource of [
  "calendar_item_counters",
  "mock_filledCount",
  "assignedVolunteerIds_arrays",
  "client_calculated_coverage",
]) {
  assert.ok(
    calendarPersistedReadModelContract.assignmentDerivedCoverageSummary.forbiddenProductionTruthSources.includes(
      forbiddenSource,
    ),
  );
}
for (const coverageField of [
  "assigned_count",
  "confirmed_count",
  "denied_count",
  "unassigned_count",
  "waiting_on_confirmation_count",
  "has_denied",
  "all_assigned_helpers_denied",
  "coverage_state",
  "assigned_fraction_label",
]) {
  assert.ok(calendarPersistedReadModelContract.assignmentDerivedCoverageSummary.fields.includes(coverageField));
}
assert.match(
  calendarPersistedReadModelContract.assignmentDerivedCoverageSummary.assignedCountRule,
  /needs_response_or_confirmed/,
);
assert.equal(
  calendarPersistedReadModelContract.assignmentDerivedCoverageSummary.deniedAndRemovedAssignmentsCountTowardAssigned,
  false,
);
assert.equal(
  calendarPersistedReadModelContract.assignmentDerivedCoverageSummary.needsResponseAndConfirmedCountTowardAssigned,
  true,
);
assert.equal(
  calendarPersistedReadModelContract.assignmentDerivedCoverageSummary.zeroNeededAssignedFractionLabel,
  "0/0 assigned",
);
assert.equal(
  calendarPersistedReadModelContract.assignmentDerivedCoverageSummary.aggregateVolunteerCountOnMultiDayWindowAllowed,
  false,
);

assert.deepEqual(calendarPersistedReadModelContract.capabilityContract.calendarItemShellsRequire, [
  "calendar.view",
]);
assert.deepEqual(
  calendarPersistedReadModelContract.capabilityContract.assignmentDerivedCoverageCountsRequire,
  ["calendar.view", "assignments.view"],
);
assert.match(
  calendarPersistedReadModelContract.capabilityContract.strictCurrentSafeRule,
  /require_both_calendar\.view_and_assignments\.view/,
);
assert.equal(calendarPersistedReadModelContract.capabilityContract.volunteerLabelsAllowedInListRead, false);
assert.equal(calendarPersistedReadModelContract.capabilityContract.volunteerContactDetailsAllowedInListRead, false);
assert.equal(calendarPersistedReadModelContract.capabilityContract.broadVolunteerValuesAllowed, false);

assert.equal(calendarPersistedReadModelContract.filtersAndSorting.explicitDateRangeRequired, true);
for (const filter of [
  "task_name_search",
  "type_general_food_security",
  "coverage_unfilled",
  "coverage_filled",
  "coverage_waiting",
  "coverage_confirmed",
  "coverage_denied_someDenied_allDenied",
  "lifecycle_publication",
]) {
  assert.ok(calendarPersistedReadModelContract.filtersAndSorting.optionalFilters.includes(filter));
}
assert.deepEqual(calendarPersistedReadModelContract.filtersAndSorting.stableSortOrder, [
  "date",
  "schedule_kind",
  "time",
  "task_label",
  "id",
]);
assert.equal(calendarPersistedReadModelContract.filtersAndSorting.boundedRangeOrPaginationRequired, true);

for (const forbiddenField of [
  "response_link_url",
  "public_token",
  "verifier",
  "token_id",
  "audit_id",
  "questionnaire_answers",
  "emergency_contact_detail",
  "raw_grants",
  "raw_capability_arrays",
  "unrelated_volunteer_rows",
  "broad_assignment_directory",
  "assignment_detail_route_links",
  "helper_contact_values_without_later_review",
]) {
  assert.ok(calendarPersistedReadModelContract.detailInspectorContract.forbiddenFields.includes(forbiddenField));
}

for (const cutoverRule of [
  "admin_calendar_remains_mock_only_after_12_2",
  "no_current_app_route_or_component_imports_this_contract",
  "no_current_route_imports_persisted_calendar_helpers_as_part_of_12_2",
  "no_route_silently_combines_mock_calendar_items_with_persisted_calendar_items",
  "no_route_reads_persisted_calendar_data_and_falls_back_to_mock_data_in_the_same_user_facing_truth_source",
  "existing_mock_calendar_regression_remains_the_product_ui_behavior_reference_until_a_separate_cutover_slice",
]) {
  assert.ok(calendarPersistedReadModelContract.mockToRealCutoverRules.includes(cutoverRule));
}
for (const blocked of [
  "admin_calendar_route_cutover",
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
  assert.ok(calendarPersistedReadModelContract.explicitlyBlocked.includes(blocked));
}

const appAndComponentFiles = [];
for (const directory of ["app", "components"]) {
  appAndComponentFiles.push(
    ...(await collectFiles(path.join(root, directory))).filter((file) =>
      /\.(?:ts|tsx)$/.test(file),
    ),
  );
}

const contractImporters = [];
const persistedCalendarRouteImporters = [];
const assignmentDetailLinks = [];
const serviceRoleMarkers = [];
for (const file of appAndComponentFiles) {
  const relative = path.relative(root, file).replaceAll("\\", "/");
  const source = await readFile(file, "utf8");
  if (
    source.includes("readModelContract") ||
    source.includes("calendarPersistedReadModelContract") ||
    source.includes("CALENDAR_PERSISTED_READ_MODEL_CONTRACT")
  ) {
    contractImporters.push(relative);
  }
  if (
    /@\/lib\/calendar\/server|readCurrentContactCalendarItems|readCalendarItemsWithClient|createCalendarItem|archiveCalendarItem|calendar_items|calendar_assignments|assignment_responses/i.test(
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

assert.deepEqual(contractImporters, []);
assert.deepEqual(persistedCalendarRouteImporters, []);
assert.deepEqual(assignmentDetailLinks, []);
assert.deepEqual(serviceRoleMarkers, []);

assert.match(calendarRouteSource, /@\/lib\/mockData/);
assert.doesNotMatch(
  calendarRouteSource,
  /@\/lib\/calendar\/readModelContract|@\/lib\/calendar\/server|readCurrentContactCalendarItems|readCalendarItemsWithClient|calendar_items|calendar_assignments|assignment_responses/i,
);

const mvpPlan = describeMvpRealDataCutoverPlan();
assert.equal(MVP_REAL_DATA_CUTOVER_PLAN_AVAILABLE, true);
assert.equal(mvpPlan.planAvailable, true);
assert.equal(mvpPlan.calendarRoutePersistedReadCutoverAvailable, false);
assert.equal(mvpPlan.responseLinkActivationReopened, false);
assert.equal(mvpPlan.plan.recommendedNextImplementationSlice.id, "12.2");
assert.equal(mvpPlan.plan.recommendedNextImplementationSlice.name, "Persisted Calendar Read Model Contract");

const activationCheckpoint = describeResponseLinkProductActionActivationCheckpoint();
assert.equal(activationCheckpoint.checkpointAvailable, true);
assert.equal(RESPONSE_LINK_PRODUCT_ACTION_ACTIVATION_APPROVED, false);
assert.equal(activationCheckpoint.activeRevealAvailable, false);
assert.equal(activationCheckpoint.activeCopyAvailable, false);

assert.match(packageSource, /"test:calendar-read-model-contract": "node --conditions=react-server --no-warnings --experimental-strip-types scripts\/calendar-read-model-contract-regression\.mjs"/);
assert.match(currentStateSource, /Iteration 12\.2/);
assert.match(roadmapSource, /12\.2 Persisted Calendar Read Model Contract/);
assert.match(calendarReadinessSource, /12\.2 Persisted Calendar Read Model Contract/);
assert.match(authReadinessSource, /12\.2 persisted Calendar read model contract/i);
assert.match(localSetupSource, /test:calendar-read-model-contract/);
assert.match(projectHistorySource, /Iteration 12\.2 - Persisted Calendar Read Model Contract/);
assert.match(localSetupSource, /Do not print raw Supabase CLI\/status\/start output/);
assert.match(localSetupSource, /Redirect Supabase start\/status output to a temporary file/);
assert.match(localSetupSource, /Redact key-like values before displaying diagnostics/);

console.log("Persisted Calendar read model contract checks passed.");
console.log("Confirmed route-unused contract, no /admin/calendar cutover, and assignment-derived coverage rules.");
