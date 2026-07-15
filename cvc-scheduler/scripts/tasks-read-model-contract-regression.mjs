import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  TASKS_ASSIGNMENT_COVERAGE_DECORATION_AVAILABLE,
  TASKS_CALENDAR_OCCURRENCE_DECORATION_AVAILABLE,
  TASKS_HOSTED_VALIDATION_REQUIRED,
  TASKS_PERSISTED_READ_MODEL_CONTRACT_AVAILABLE,
  TASKS_PERSISTED_READ_MODEL_IMPLEMENTATION_AVAILABLE,
  TASKS_PUBLIC_LOOKUP_CUTOVER_AVAILABLE,
  TASKS_REMEMBERED_DEVICE_AVAILABLE,
  TASKS_REMINDER_DELIVERY_AVAILABLE,
  TASKS_RESPONSE_LINK_ACTIVATION_REOPENED,
  TASKS_ROUTE_MOCK_TO_REAL_MIXING_ALLOWED,
  TASKS_ROUTE_PERSISTED_READ_CUTOVER_AVAILABLE,
  TASKS_ROUTE_PERSISTED_WRITE_AVAILABLE,
  TASKS_SEED_DATA_AVAILABLE,
  TASKS_SERVICE_ROLE_READ_AVAILABLE,
  describePersistedTasksReadModelContract,
  evaluatePersistedTasksReadModelReadiness,
  persistedTasksReadModelContract,
} from "../lib/tasks/readModelContract.server.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contractPath = path.join(root, "lib", "tasks", "readModelContract.server.ts");
const tasksRoutePath = path.join(root, "app", "admin", "tasks", "page.tsx");
const calendarRoutePath = path.join(root, "app", "admin", "calendar", "page.tsx");
const packagePath = path.join(root, "package.json");

const [
  contractSource,
  tasksRouteSource,
  calendarRouteSource,
  packageSource,
  currentStateSource,
  roadmapSource,
  historySource,
  localSetupSource,
  authReadinessSource,
] = await Promise.all([
  readFile(contractPath, "utf8"),
  readFile(tasksRoutePath, "utf8"),
  readFile(calendarRoutePath, "utf8"),
  readFile(packagePath, "utf8"),
  readFile(path.join(root, "docs", "CURRENT_STATE.md"), "utf8"),
  readFile(path.join(root, "docs", "ROADMAP.md"), "utf8"),
  readFile(path.join(root, "docs", "PROJECT_HISTORY.md"), "utf8"),
  readFile(path.join(root, "docs", "SUPABASE_LOCAL_SETUP.md"), "utf8"),
  readFile(path.join(root, "docs", "SUPABASE_AUTH_PERSISTENCE_READINESS.md"), "utf8"),
]);

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

assert.match(packageSource, /"test:tasks-read-model-contract"/);
assert.match(contractSource, /^import "server-only";/);
assert.doesNotMatch(
  contractSource,
  /["']use client["']|["']use server["']|createServerSupabaseClient|createBrowserClient|\.from\(|\.rpc\(|select\("\*"\)|SUPABASE_SERVICE_ROLE_KEY|createServiceRole|service-role|sendEmail|enqueueReminder|navigator\.clipboard|seedDatabase/i,
);

for (const trueFlag of ["TASKS_PERSISTED_READ_MODEL_CONTRACT_AVAILABLE"]) {
  assert.match(contractSource, new RegExp(`${trueFlag} = true`));
}
for (const falseFlag of [
  "TASKS_PERSISTED_READ_MODEL_IMPLEMENTATION_AVAILABLE",
  "TASKS_ROUTE_PERSISTED_READ_CUTOVER_AVAILABLE",
  "TASKS_ROUTE_MOCK_TO_REAL_MIXING_ALLOWED",
  "TASKS_ROUTE_PERSISTED_WRITE_AVAILABLE",
  "TASKS_CALENDAR_OCCURRENCE_DECORATION_AVAILABLE",
  "TASKS_ASSIGNMENT_COVERAGE_DECORATION_AVAILABLE",
  "TASKS_SERVICE_ROLE_READ_AVAILABLE",
  "TASKS_SEED_DATA_AVAILABLE",
  "TASKS_HOSTED_VALIDATION_REQUIRED",
  "TASKS_RESPONSE_LINK_ACTIVATION_REOPENED",
  "TASKS_PUBLIC_LOOKUP_CUTOVER_AVAILABLE",
  "TASKS_REMINDER_DELIVERY_AVAILABLE",
  "TASKS_REMEMBERED_DEVICE_AVAILABLE",
]) {
  assert.match(contractSource, new RegExp(`${falseFlag} = false`));
}

assert.equal(TASKS_PERSISTED_READ_MODEL_CONTRACT_AVAILABLE, true);
assert.equal(TASKS_PERSISTED_READ_MODEL_IMPLEMENTATION_AVAILABLE, false);
assert.equal(TASKS_ROUTE_PERSISTED_READ_CUTOVER_AVAILABLE, false);
assert.equal(TASKS_ROUTE_MOCK_TO_REAL_MIXING_ALLOWED, false);
assert.equal(TASKS_ROUTE_PERSISTED_WRITE_AVAILABLE, false);
assert.equal(TASKS_CALENDAR_OCCURRENCE_DECORATION_AVAILABLE, false);
assert.equal(TASKS_ASSIGNMENT_COVERAGE_DECORATION_AVAILABLE, false);
assert.equal(TASKS_SERVICE_ROLE_READ_AVAILABLE, false);
assert.equal(TASKS_SEED_DATA_AVAILABLE, false);
assert.equal(TASKS_HOSTED_VALIDATION_REQUIRED, false);
assert.equal(TASKS_RESPONSE_LINK_ACTIVATION_REOPENED, false);
assert.equal(TASKS_PUBLIC_LOOKUP_CUTOVER_AVAILABLE, false);
assert.equal(TASKS_REMINDER_DELIVERY_AVAILABLE, false);
assert.equal(TASKS_REMEMBERED_DEVICE_AVAILABLE, false);

const description = describePersistedTasksReadModelContract();
assert.equal(description.contractAvailable, true);
assert.equal(description.implementationAvailable, false);
assert.equal(description.routeCutoverAvailable, false);
assert.equal(description.requiredCapability, "tasks.view");
assert.equal(description.eligibleFutureRoute, "/admin/tasks");
assert.deepEqual(description.routeStates, [
  "ready_with_presets",
  "ready_empty",
  "unavailable",
  "error",
]);
assert.equal(description.recommendedNextSlice.id, "12.14");

const readiness = evaluatePersistedTasksReadModelReadiness();
assert.equal(readiness.allowedForAdminTasksCutover, false);
assert.equal(readiness.recommendedNextImplementationSlice.id, "12.14");
for (const blocker of [
  "read_model_implementation_unavailable",
  "admin_tasks_route_cutover_unavailable",
  "mock_to_real_mixing_disallowed",
  "persisted_writes_unavailable",
  "calendar_occurrence_decoration_unavailable",
  "assignment_coverage_decoration_unavailable",
  "service_role_read_unavailable",
  "seed_data_unavailable",
  "response_link_activation_paused_after_11_50",
]) {
  assert.ok(readiness.blockers.includes(blocker), `Missing blocker ${blocker}`);
}

assert.equal(persistedTasksReadModelContract.routeUnused, true);
assert.equal(persistedTasksReadModelContract.currentRouteCutover, false);
assert.equal(persistedTasksReadModelContract.currentRouteTruthSource, "mock_prototype_until_separate_cutover");
assert.equal(persistedTasksReadModelContract.requiredCapability, "tasks.view");
assert.equal(
  persistedTasksReadModelContract.canonicalEntity,
  "task_template_or_preset_reusable_scheduling_definition_not_calendar_occurrence",
);
assert.equal(persistedTasksReadModelContract.authContext.authenticatedProjectContactRequired, true);
assert.equal(persistedTasksReadModelContract.authContext.deterministicActiveWorkspaceContextRequired, true);
assert.equal(persistedTasksReadModelContract.authContext.roleOrTitleStringsAuthorizeReads, false);
assert.equal(persistedTasksReadModelContract.authContext.browserProvidedWorkspaceIdTrusted, false);
assert.equal(persistedTasksReadModelContract.authContext.browserProvidedCapabilityArrayTrusted, false);
assert.match(
  persistedTasksReadModelContract.authContext.stabilizedWorkspaceSelectionPrinciple,
  /12_12_contact_scoped_effective_grant_selection/,
);

for (const schemaField of [
  "id",
  "workspace_id",
  "name",
  "description",
  "task_type",
  "default_needed_count",
  "volunteer_visible",
  "is_system_preset",
  "system_key",
  "custom_field_definitions",
  "lifecycle",
  "created_at",
  "updated_at",
]) {
  assert.ok(persistedTasksReadModelContract.currentSchemaSupportedFields.includes(schemaField));
}

for (const safeConcept of [
  "task_preset_id",
  "stable_display_reference",
  "name",
  "description_or_instructions_when_present",
  "high_level_type_category_general_food_security_custom",
  "default_needed_count",
  "volunteer_visibility_default",
  "lifecycle_active_or_archived",
  "bounded_custom_field_definitions",
  "safe_system_trusted_identity",
]) {
  assert.ok(persistedTasksReadModelContract.safeProjectionConcepts.includes(safeConcept));
}

for (const futureGap of [
  "default_duration",
  "default_area_or_location",
  "congregation_preference",
  "skill_text",
  "age_driver_equipment_safety_notes",
  "default_follow_up_contact",
]) {
  assert.ok(persistedTasksReadModelContract.currentSchemaGaps.includes(futureGap));
}

assert.equal(persistedTasksReadModelContract.calendarSeparation.calendarOccurrenceStateAllowed, false);
assert.equal(
  persistedTasksReadModelContract.calendarSeparation.calendarTablesMustNotBeQueriedForTasksLibraryDecoration,
  true,
);
assert.equal(
  persistedTasksReadModelContract.calendarSeparation.currentCoverageOrUpcomingOccurrenceAggregatesAllowed,
  false,
);
for (const forbiddenTaskField of [
  "scheduled_date",
  "start_time",
  "end_time",
  "date_range",
  "calendar_placement",
  "calendar_item_id_as_preset_state",
  "assigned_volunteers",
  "assignment_responses",
  "assigned_count",
  "confirmed_count",
  "denied_count",
  "coverage_state",
  "times_scheduled",
  "upcoming_occurrence_count",
]) {
  assert.ok(
    persistedTasksReadModelContract.calendarSeparation.taskPresetFieldsMustNotInclude.includes(
      forbiddenTaskField,
    ),
  );
}

assert.equal(persistedTasksReadModelContract.customFieldContract.sourceField, "custom_field_definitions");
assert.equal(persistedTasksReadModelContract.customFieldContract.bounded, true);
assert.equal(persistedTasksReadModelContract.customFieldContract.maximumFieldCount, 20);
assert.equal(persistedTasksReadModelContract.customFieldContract.maximumSerializedBytes, 16384);
assert.equal(persistedTasksReadModelContract.customFieldContract.preserveOrder, true);
assert.deepEqual(persistedTasksReadModelContract.customFieldContract.allowedFieldTypes, [
  "short_text",
  "long_text",
  "number",
  "select",
  "checkbox",
]);
assert.equal(persistedTasksReadModelContract.customFieldContract.executableConfigurationAllowed, false);
assert.equal(persistedTasksReadModelContract.customFieldContract.submittedVolunteerAnswersAllowed, false);
assert.equal(persistedTasksReadModelContract.customFieldContract.calendarOccurrenceValuesAllowed, false);

assert.equal(persistedTasksReadModelContract.systemTrustedPresetContract.ordinaryRowsMayMasqueradeAsSystemPresets, false);
assert.equal(persistedTasksReadModelContract.systemTrustedPresetContract.historicalLunchCompatibilityIsNotCanonicalMealsModel, true);
assert.equal(persistedTasksReadModelContract.systemTrustedPresetContract.mealsSchemaAdded, false);

assert.deepEqual(persistedTasksReadModelContract.searchFilterSort.stableDefaultSort, [
  "active_before_archived",
  "name",
  "id",
]);
assert.equal(persistedTasksReadModelContract.searchFilterSort.nondeterministicDatabaseRowOrderAllowed, false);
assert.equal(persistedTasksReadModelContract.futureQueryShapeRules.explicitAllowlistedSelectorRequired, true);
assert.equal(persistedTasksReadModelContract.futureQueryShapeRules.selectStarAllowed, false);
assert.equal(persistedTasksReadModelContract.futureQueryShapeRules.broadRawRowOutputAllowed, false);
assert.deepEqual(persistedTasksReadModelContract.futureQueryShapeRules.allowedTableConcepts, [
  "task_presets",
]);
for (const forbiddenTable of [
  "calendar_items",
  "calendar_assignments",
  "assignment_responses",
  "volunteer_profiles",
  "questionnaire_submissions",
  "assignment_response_tokens",
  "assignment_response_link_reveal_events",
]) {
  assert.ok(persistedTasksReadModelContract.futureQueryShapeRules.forbiddenTableConcepts.includes(forbiddenTable));
}

assert.match(persistedTasksReadModelContract.stateContract.ready_empty, /zero_task_presets_not_error/);
assert.match(persistedTasksReadModelContract.stateContract.unavailable, /tasks_view_or_ambiguous_context/);
assert.match(persistedTasksReadModelContract.stateContract.error, /without_raw_provider_error/);
assert.equal(persistedTasksReadModelContract.stateContract.mockFallbackAllowed, false);
assert.equal(persistedTasksReadModelContract.mockToRealBoundary.oneUserFacingTruthSourcePerExecutionPath, true);
assert.equal(persistedTasksReadModelContract.mockToRealBoundary.persistedAndMockPresetMixingAllowed, false);
assert.equal(persistedTasksReadModelContract.mockToRealBoundary.failedPersistedReadMayFallbackToMockPresets, false);
assert.equal(persistedTasksReadModelContract.mockToRealBoundary.calendarPreviewScaffoldingDoesNotDefineTasksRouteTruth, true);

for (const unsafeField of [
  "volunteer_contact_details",
  "volunteer_profiles",
  "questionnaire_answers",
  "emergency_contact_data",
  "calendar_assignment_rows",
  "assignment_responses",
  "response_token_rows",
  "response_urls",
  "bearers",
  "verifiers",
  "audit_reveal_rows",
  "raw_grants_capability_arrays",
  "auth_session_secrets",
  "service_role_credentials",
  "provider_error_dumps",
  "stack_traces",
  "sql_internal_rpc_detail",
  "unrelated_workspace_rows",
]) {
  assert.ok(persistedTasksReadModelContract.unsafeDataDenylist.includes(unsafeField));
}

assert.match(tasksRouteSource, /@\/lib\/mockData/);
assert.match(tasksRouteSource, /getTaskPresetsForActiveWorkspace/);
assert.doesNotMatch(
  tasksRouteSource,
  /readModelContract|readTaskPresetsWithClient|readCurrentContactTaskPresets|createServerSupabaseClient|\.from\(|\.rpc\(|task_presets|tasks\.view|select\(/i,
);
assert.match(calendarRouteSource, /readCalendarRouteState/);
assert.doesNotMatch(calendarRouteSource, /tasks\/readModelContract|readTaskPresets|task_presets/i);

for (const directory of ["app", "components"]) {
  const files = (await collectFiles(path.join(root, directory))).filter((file) =>
    /\.(?:ts|tsx)$/.test(file),
  );
  const importers = [];
  for (const file of files) {
    const source = await readFile(file, "utf8");
    if (source.includes("tasks/readModelContract")) {
      importers.push(path.relative(root, file).replaceAll("\\", "/"));
    }
  }
  assert.deepEqual(importers, [], `${directory} must not import the Tasks read-model contract`);
}

for (const doc of [
  currentStateSource,
  roadmapSource,
  historySource,
  localSetupSource,
  authReadinessSource,
]) {
  assert.match(doc, /12\.13/);
  assert.match(doc, /Tasks read-model contract|Tasks Read Model Contract|persisted Tasks read-model contract|Persisted Tasks Read Model Contract/i);
  assert.match(doc, /tasks\.view/);
  assert.match(doc, /\/admin\/tasks.*mock|mock.*\/admin\/tasks/i);
  assert.match(doc, /12\.14/);
}

console.log("Persisted Tasks read-model contract checks passed.");
console.log("Confirmed route-unused contract, reusable-definition separation, tasks.view scope, and no /admin/tasks cutover.");
