import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CALENDAR_ASSIGNMENT_DETAIL_LINKING_AVAILABLE,
  CALENDAR_ASSIGNMENT_PICKER_CUTOVER_AVAILABLE,
  CALENDAR_HOSTED_CUTOVER_VALIDATION_AVAILABLE,
  CALENDAR_PUBLIC_LOOKUP_CUTOVER_AVAILABLE,
  CALENDAR_REMINDER_DELIVERY_AVAILABLE,
  CALENDAR_RESPONSE_LINK_ACTIVATION_REOPENED,
  CALENDAR_ROUTE_CUTOVER_FINAL_PREFLIGHT_AVAILABLE,
  CALENDAR_ROUTE_CUTOVER_FINAL_PREFLIGHT_NEXT_RECOMMENDED_SLICE,
  CALENDAR_ROUTE_IMPORTS_READ_MODEL_QUERY_HELPER,
  CALENDAR_ROUTE_MOCK_TO_REAL_MIXING_ALLOWED,
  CALENDAR_ROUTE_PERSISTED_READ_CUTOVER_IMPLEMENTED,
  CALENDAR_ROUTE_PERSISTED_WRITE_AVAILABLE,
  CALENDAR_ROUTE_USES_DRY_RUN_HARNESS,
  CALENDAR_SEED_DATA_AVAILABLE,
  CALENDAR_SERVICE_ROLE_READ_AVAILABLE,
  calendarRouteCutoverFinalCandidateScope,
  calendarRouteCutoverFinalForbiddenMappingFields,
  calendarRouteCutoverFinalGoNoGoChecklist,
  calendarRouteCutoverFinalMockToRealBoundary,
  calendarRouteCutoverFinalRequiredImplementationPath,
  calendarRouteCutoverFinalRollbackPlan,
  calendarRouteCutoverFinalSafeMappingFields,
  calendarRouteCutoverFinalStateContract,
  calendarRouteCutoverFinalUiPreservationContract,
  describeCalendarRouteCutoverFinalPreflight,
} from "../lib/calendar/routeCutoverFinalPreflight.server.ts";
import { describeCalendarRouteCutoverDryRun } from "../lib/calendar/routeCutoverDryRun.server.ts";
import { describeCalendarRouteCutoverReadiness } from "../lib/calendar/routeCutoverReadiness.server.ts";
import { describeCalendarReadModelQueryHelper } from "../lib/calendar/readModelQuery.server.ts";
import { describeMvpRealDataCutoverPlan } from "../lib/readiness/mvpRealDataCutoverPlan.server.ts";
import { describeResponseLinkProductActionActivationCheckpoint } from "../lib/responseTokens/productActionActivationCheckpoint.server.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const preflightPath = path.join(root, "lib", "calendar", "routeCutoverFinalPreflight.server.ts");
const dryRunPath = path.join(root, "lib", "calendar", "routeCutoverDryRun.server.ts");
const readinessPath = path.join(root, "lib", "calendar", "routeCutoverReadiness.server.ts");
const queryHelperPath = path.join(root, "lib", "calendar", "readModelQuery.server.ts");
const calendarRoutePath = path.join(root, "app", "admin", "calendar", "page.tsx");

const preflightSource = await readFile(preflightPath, "utf8");
const dryRunSource = await readFile(dryRunPath, "utf8");
const readinessSource = await readFile(readinessPath, "utf8");
const queryHelperSource = await readFile(queryHelperPath, "utf8");
const calendarRouteSource = await readFile(calendarRoutePath, "utf8");
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

assert.match(preflightSource, /^import "server-only";/);
assert.match(preflightSource, /CALENDAR_ROUTE_CUTOVER_FINAL_PREFLIGHT_AVAILABLE = true/);
assert.match(preflightSource, /CALENDAR_ROUTE_PERSISTED_READ_CUTOVER_IMPLEMENTED/);
assert.match(preflightSource, /CALENDAR_ROUTE_USES_DRY_RUN_HARNESS/);
assert.doesNotMatch(
  preflightSource,
  /createClient|createServerSupabaseClient|createBrowserSupabaseClient|lib\/supabase\/server|cookies\(|headers\(|from\s+["']app\/|React|JSX|\.from\(|\.rpc\(|SUPABASE_SERVICE_ROLE_KEY|createServiceRole|sendEmail|enqueueReminder|navigator\.clipboard/i,
);

assert.equal(CALENDAR_ROUTE_CUTOVER_FINAL_PREFLIGHT_AVAILABLE, true);
assert.equal(CALENDAR_ROUTE_PERSISTED_READ_CUTOVER_IMPLEMENTED, false);
assert.equal(CALENDAR_ROUTE_IMPORTS_READ_MODEL_QUERY_HELPER, false);
assert.equal(CALENDAR_ROUTE_USES_DRY_RUN_HARNESS, false);
assert.equal(CALENDAR_ROUTE_MOCK_TO_REAL_MIXING_ALLOWED, false);
assert.equal(CALENDAR_ROUTE_PERSISTED_WRITE_AVAILABLE, false);
assert.equal(CALENDAR_ASSIGNMENT_PICKER_CUTOVER_AVAILABLE, false);
assert.equal(CALENDAR_ASSIGNMENT_DETAIL_LINKING_AVAILABLE, false);
assert.equal(CALENDAR_RESPONSE_LINK_ACTIVATION_REOPENED, false);
assert.equal(CALENDAR_PUBLIC_LOOKUP_CUTOVER_AVAILABLE, false);
assert.equal(CALENDAR_REMINDER_DELIVERY_AVAILABLE, false);
assert.equal(CALENDAR_SERVICE_ROLE_READ_AVAILABLE, false);
assert.equal(CALENDAR_SEED_DATA_AVAILABLE, false);
assert.equal(CALENDAR_HOSTED_CUTOVER_VALIDATION_AVAILABLE, false);
assert.equal(
  CALENDAR_ROUTE_CUTOVER_FINAL_PREFLIGHT_NEXT_RECOMMENDED_SLICE,
  "12.10 Calendar Route Cutover Empty/Unavailable State Prototype",
);

assert.deepEqual(calendarRouteCutoverFinalCandidateScope, {
  candidateRoute: "/admin/calendar",
  candidateDataPath: "persisted_read_only_calendar_display_items",
  readOnlyOnly: true,
  calendarWritesAllowed: false,
  assignmentMutationsAllowed: false,
  assignmentPickerAllowed: false,
  assignmentDetailLinksAllowed: false,
  responseLinkActivationAllowed: false,
  deliveryAllowed: false,
  publicVolunteerLookupAllowed: false,
  rememberedDeviceBehaviorAllowed: false,
  seedDataAllowed: false,
  serviceRoleUsageAllowed: false,
});

for (const requiredStep of [
  "dynamic_no_store_admin_calendar_server_boundary",
  "verified_project_contact_session",
  "reviewed_workspace_contact_grant_resolution",
  "trusted_workspace_id",
  "trusted_actor_contact_id",
  "trusted_workspace_timezone",
  "calendar.view_capability",
  "assignments.view_capability_for_coverage_bearing_output",
  "server_derived_bounded_period_range",
  "12.8_dry_run_equivalent_state_contract",
  "12.6_dependency_injected_query_helper_or_reviewed_successor",
  "12.3_safe_projection_helper_or_reviewed_successor",
  "one_user_facing_truth_source_per_route_execution",
]) {
  assert.ok(calendarRouteCutoverFinalRequiredImplementationPath.includes(requiredStep));
}

for (const checklistItem of [
  "local_disposable_validation_green",
  "dry_run_harness_green",
  "route_cutover_readiness_green",
  "query_helper_regression_green",
  "calendar_browser_regression_green",
  "assignment_detail_response_link_guardrails_green",
  "no_migration_or_type_change_required_for_cutover",
  "hosted_validation_not_required_unless_db_rpc_type_or_hosted_behavior_changes",
  "rollback_path_defined",
  "empty_unavailable_states_defined",
  "route_import_plan_defined",
  "mock_to_real_non_mixing_rule_defined",
  "safe_error_rendering_rule_defined",
  "preview_browser_proof_defined",
]) {
  assert.ok(calendarRouteCutoverFinalGoNoGoChecklist.includes(checklistItem));
}

for (const state of [
  "unauthenticated",
  "unauthorized_no_workspace_access",
  "missing_calendar.view",
  "missing_assignments.view",
  "invalid_period_or_range",
  "workspace_unavailable_inactive_archived_if_applicable",
  "query_unavailable_safe_error",
  "empty_range_no_calendar_items",
  "ready_with_projected_calendar_items",
]) {
  assert.ok(calendarRouteCutoverFinalStateContract.states.includes(state));
}
assert.equal(calendarRouteCutoverFinalStateContract.requirements.calm, true);
assert.equal(calendarRouteCutoverFinalStateContract.requirements.nonDisclosing, true);
assert.equal(calendarRouteCutoverFinalStateContract.requirements.credentialFree, true);
assert.equal(calendarRouteCutoverFinalStateContract.requirements.rawProviderErrorsAllowed, false);
assert.equal(calendarRouteCutoverFinalStateContract.requirements.stackTracesAllowed, false);
assert.equal(calendarRouteCutoverFinalStateContract.requirements.mockFallbackStatesAllowed, false);
assert.equal(
  calendarRouteCutoverFinalStateContract.requirements.persistedPartialDataMixedWithMockAllowed,
  false,
);

assert.equal(calendarRouteCutoverFinalUiPreservationContract.dayWeekMonthListControlsStillWork, true);
assert.equal(calendarRouteCutoverFinalUiPreservationContract.filtersStillWork, true);
assert.equal(calendarRouteCutoverFinalUiPreservationContract.inspectorStillOpensAndCloses, true);
assert.equal(
  calendarRouteCutoverFinalUiPreservationContract.creationSurfaceRemainsPreviewOnlyAndDoesNotSave,
  true,
);
assert.equal(calendarRouteCutoverFinalUiPreservationContract.mobileMoreFilterCreateInspectDoNotStack, true);
assert.equal(calendarRouteCutoverFinalUiPreservationContract.desktopHorizontalOverflowAllowed, false);
assert.equal(calendarRouteCutoverFinalUiPreservationContract.mobile390HorizontalOverflowAllowed, false);
assert.equal(
  calendarRouteCutoverFinalUiPreservationContract.compactBlocksShowTaskNamePlusAssignedFractionWhenDataPresent,
  true,
);
assert.equal(calendarRouteCutoverFinalUiPreservationContract.emptyPersistedStateIsCalm, true);
assert.equal(calendarRouteCutoverFinalUiPreservationContract.unauthorizedUnavailableStatesAreCalm, true);
assert.equal(calendarRouteCutoverFinalUiPreservationContract.rawIdsCapabilitiesErrorsSecretsRendered, false);

for (const safeField of [
  "calendar_item_id_or_display_reference",
  "task_source_label",
  "display_type_or_category",
  "schedule_kind",
  "date_range_time_fields",
  "timezone",
  "needed_count",
  "lifecycle_publication_state",
  "safe_schedule_notes_if_allowed",
  "task_preset_or_one_off_labels",
  "assignment_derived_coverage_summary",
  "assigned_fraction_label",
]) {
  assert.ok(calendarRouteCutoverFinalSafeMappingFields.includes(safeField));
}
for (const forbiddenField of [
  "volunteer_contact_values",
  "emergency_contacts",
  "questionnaire_answers",
  "response_urls",
  "bearer",
  "verifier",
  "token_id",
  "audit_id",
  "access_token",
  "refresh_token",
  "password",
  "api_key",
  "service_role_key",
  "sql_rpc_detail",
  "raw_grants_capability_arrays",
  "unrelated_rows",
  "provider_dumps",
  "stack_traces",
  "raw_exception_messages",
]) {
  assert.ok(calendarRouteCutoverFinalForbiddenMappingFields.includes(forbiddenField));
}

assert.equal(calendarRouteCutoverFinalMockToRealBoundary.persistedReadPlusMockFallbackSameExecutionAllowed, false);
assert.equal(calendarRouteCutoverFinalMockToRealBoundary.mockCalendarItemMergedWithPersistedCalendarItemAllowed, false);
assert.equal(calendarRouteCutoverFinalMockToRealBoundary.mockFilledCountProductionTruthAllowed, false);
assert.equal(calendarRouteCutoverFinalMockToRealBoundary.assignedVolunteerIdArrayProductionTruthAllowed, false);
assert.equal(calendarRouteCutoverFinalMockToRealBoundary.deterministicMockColorsStorageTruthAllowed, false);
assert.equal(
  calendarRouteCutoverFinalMockToRealBoundary.currentMockRouteBehaviorRemainsVisualReferenceUntilImplementation,
  true,
);
assert.equal(calendarRouteCutoverFinalMockToRealBoundary.actualCutoverRequiresOneReviewedTruthSourceBranch, true);

assert.equal(calendarRouteCutoverFinalRollbackPlan.routeIntegrationSmallAndReversible, true);
assert.equal(calendarRouteCutoverFinalRollbackPlan.schemaChangesInSameSliceAllowed, false);
assert.equal(calendarRouteCutoverFinalRollbackPlan.uiRedesignInSameSliceAllowed, false);
assert.equal(calendarRouteCutoverFinalRollbackPlan.calendarWritesInSameSliceAllowed, false);
assert.equal(calendarRouteCutoverFinalRollbackPlan.assignmentMutationsInSameSliceAllowed, false);
assert.equal(calendarRouteCutoverFinalRollbackPlan.responseLinkActivationInSameSliceAllowed, false);
assert.equal(
  calendarRouteCutoverFinalRollbackPlan.ifValidationFails,
  "revert_route_integration_instead_of_weakening_auth_query_projection_rules",
);
assert.equal(calendarRouteCutoverFinalRollbackPlan.previousMockBehaviorRecoverableUntilCutoverSucceeds, true);

const description = describeCalendarRouteCutoverFinalPreflight();
assert.equal(description.finalPreflightAvailable, true);
assert.equal(description.priorDryRunAvailable, true);
assert.equal(description.routePersistedReadCutoverImplemented, false);
assert.equal(description.routeImportsReadModelQueryHelper, false);
assert.equal(description.routeUsesDryRunHarness, false);
assert.equal(description.mockToRealMixingAllowed, false);
assert.equal(description.persistedWriteAvailable, false);
assert.equal(description.assignmentPickerCutoverAvailable, false);
assert.equal(description.assignmentDetailLinkingAvailable, false);
assert.equal(description.responseLinkActivationReopened, false);
assert.equal(description.publicLookupCutoverAvailable, false);
assert.equal(description.reminderDeliveryAvailable, false);
assert.equal(description.serviceRoleReadAvailable, false);
assert.equal(description.seedDataAvailable, false);
assert.equal(description.hostedCutoverValidationAvailable, false);
assert.equal(
  description.nextRecommendedSlice,
  "12.10 Calendar Route Cutover Empty/Unavailable State Prototype",
);

const readiness = describeCalendarRouteCutoverReadiness();
assert.equal(readiness.readinessReviewAvailable, true);
assert.equal(readiness.routePersistedReadCutoverImplemented, false);
assert.equal(readiness.routeImportsReadModelQueryHelper, false);
assert.equal(readiness.responseLinkActivationReopened, false);

const dryRun = describeCalendarRouteCutoverDryRun();
assert.equal(dryRun.dryRunAvailable, true);
assert.equal(dryRun.routePersistedReadCutoverImplemented, false);
assert.equal(dryRun.routeImportsReadModelQueryHelper, false);
assert.equal(dryRun.routeUsesDryRunHarness, false);
assert.equal(dryRun.mockToRealMixingAllowed, false);
assert.equal(dryRun.nextRecommendedSlice, "12.9 Calendar Route Cutover Final Preflight");

const queryHelper = describeCalendarReadModelQueryHelper();
assert.equal(queryHelper.routeUnused, true);
assert.equal(queryHelper.dependencyInjected, true);
assert.equal(queryHelper.serviceRoleAvailable, false);
assert.equal(queryHelper.explicitSelectors.calendarItems.includes("*"), false);
assert.doesNotMatch(queryHelperSource, /\.select\(\s*["']\*["']\s*\)/);

const appAndComponentFiles = [
  ...(await collectFiles(path.join(root, "app"))),
  ...(await collectFiles(path.join(root, "components"))),
].filter((file) => /\.(?:ts|tsx)$/.test(file));

const finalPreflightImporters = [];
const dryRunImporters = [];
const readinessImporters = [];
const queryHelperImporters = [];
const persistedCalendarRouteImporters = [];
const assignmentDetailLinks = [];
for (const file of appAndComponentFiles) {
  const relative = path.relative(root, file).replaceAll("\\", "/");
  const source = await readFile(file, "utf8");
  if (
    source.includes("routeCutoverFinalPreflight.server") ||
    source.includes("describeCalendarRouteCutoverFinalPreflight")
  ) {
    finalPreflightImporters.push(relative);
  }
  if (
    source.includes("routeCutoverDryRun.server") ||
    source.includes("runCalendarRouteCutoverDryRun")
  ) {
    dryRunImporters.push(relative);
  }
  if (
    source.includes("routeCutoverReadiness.server") ||
    source.includes("describeCalendarRouteCutoverReadiness")
  ) {
    readinessImporters.push(relative);
  }
  if (
    source.includes("readModelQuery.server") ||
    source.includes("readCalendarReadModelWithClient")
  ) {
    queryHelperImporters.push(relative);
  }
  if (
    /@\/lib\/calendar\/readModel|@\/lib\/calendar\/server|calendar_items|calendar_assignments|assignment_responses|readCurrentContactCalendarItems|readCalendarItemsWithClient/i.test(
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
assert.deepEqual(finalPreflightImporters, []);
assert.deepEqual(dryRunImporters, []);
assert.deepEqual(readinessImporters, []);
assert.deepEqual(queryHelperImporters, []);
assert.deepEqual(persistedCalendarRouteImporters, []);
assert.deepEqual(assignmentDetailLinks, []);

assert.match(calendarRouteSource, /@\/lib\/calendar\/routeRead\.server/);
assert.doesNotMatch(
  calendarRouteSource,
  /routeCutoverFinalPreflight|routeCutoverDryRun|routeCutoverReadiness|readModelQuery|readCalendarReadModelWithClient|runCalendarRouteCutoverDryRun|@\/lib\/calendar\/readModel|@\/lib\/calendar\/server|calendar_items|calendar_assignments|assignment_responses|(?:^|\n)\s*\.from\(|\.rpc\(|SUPABASE_SERVICE_ROLE_KEY|createServiceRole|serviceRole|formAction|useActionState|useFormState/i,
);
assert.doesNotMatch(
  calendarRouteSource,
  /sendEmail|enqueueReminder|rememberedDevice|publicLookup|assignment_response_tokens|response_link|navigator\.clipboard/i,
);

assert.match(readinessSource, /CALENDAR_ROUTE_CUTOVER_READINESS_REVIEW_AVAILABLE = true/);
assert.match(dryRunSource, /CALENDAR_ROUTE_CUTOVER_DRY_RUN_AVAILABLE = true/);
assert.match(packageSource, /"test:calendar-route-cutover-final-preflight"/);
assert.match(currentStateSource, /Iteration 12\.9/);
assert.match(roadmapSource, /12\.10 Calendar Route Cutover Empty\/Unavailable State Prototype/);
assert.match(calendarReadinessSource, /12\.9 Calendar Route Cutover Final Preflight/);
assert.match(authReadinessSource, /12\.9 Calendar route cutover final preflight/i);
assert.match(localSetupSource, /test:calendar-route-cutover-final-preflight/);
assert.match(localSetupSource, /Redirect Supabase start\/status output to a temporary file/);
assert.match(localSetupSource, /Redact key-like values before displaying diagnostics/);
assert.match(projectHistorySource, /Iteration 12\.9 - Calendar Route Cutover Final Preflight/);

const cutoverPlan = describeMvpRealDataCutoverPlan();
assert.equal(cutoverPlan.planAvailable, true);
assert.equal(cutoverPlan.calendarRoutePersistedReadCutoverAvailable, false);
assert.equal(cutoverPlan.mockToRealMixingAllowed, false);
assert.equal(cutoverPlan.responseLinkActivationReopened, false);

const activationCheckpoint = describeResponseLinkProductActionActivationCheckpoint();
assert.equal(activationCheckpoint.checkpointAvailable, true);
assert.equal(activationCheckpoint.activationApproved, false);
assert.equal(activationCheckpoint.activeRevealAvailable, false);
assert.equal(activationCheckpoint.activeCopyAvailable, false);

console.log("Calendar route cutover final preflight checks passed.");
console.log("Confirmed final preflight remains route-unused and /admin/calendar uses only the reviewed route read adapter.");
