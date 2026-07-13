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
  CALENDAR_ROUTE_CUTOVER_ELIGIBLE_ROUTE,
  CALENDAR_ROUTE_CUTOVER_READINESS_REVIEW_AVAILABLE,
  CALENDAR_ROUTE_IMPORTS_READ_MODEL_QUERY_HELPER,
  CALENDAR_ROUTE_MOCK_TO_REAL_MIXING_ALLOWED,
  CALENDAR_ROUTE_PERSISTED_READ_CUTOVER_IMPLEMENTED,
  CALENDAR_ROUTE_PERSISTED_WRITE_AVAILABLE,
  CALENDAR_SEED_DATA_AVAILABLE,
  CALENDAR_SERVICE_ROLE_READ_AVAILABLE,
  calendarRouteCutoverBlockedUiAndProductChanges,
  calendarRouteCutoverBrowserProofRequirements,
  calendarRouteCutoverCapabilityRules,
  calendarRouteCutoverMockToRealRules,
  calendarRouteCutoverRangeAndPeriodRules,
  calendarRouteCutoverRenderingConstraints,
  calendarRouteCutoverRequiredDataPath,
  calendarRouteCutoverRequiredStates,
  calendarRouteCutoverRollbackRules,
  describeCalendarRouteCutoverReadiness,
} from "../lib/calendar/routeCutoverReadiness.server.ts";
import { describeCalendarReadModelQueryHelper } from "../lib/calendar/readModelQuery.server.ts";
import { describeMvpRealDataCutoverPlan } from "../lib/readiness/mvpRealDataCutoverPlan.server.ts";
import { describeResponseLinkProductActionActivationCheckpoint } from "../lib/responseTokens/productActionActivationCheckpoint.server.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readinessPath = path.join(root, "lib", "calendar", "routeCutoverReadiness.server.ts");
const queryHelperPath = path.join(root, "lib", "calendar", "readModelQuery.server.ts");
const readinessSource = await readFile(readinessPath, "utf8");
const queryHelperSource = await readFile(queryHelperPath, "utf8");
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

assert.match(readinessSource, /^import "server-only";/);
assert.match(readinessSource, /CALENDAR_ROUTE_CUTOVER_READINESS_REVIEW_AVAILABLE = true/);
assert.match(readinessSource, /CALENDAR_ROUTE_PERSISTED_READ_CUTOVER_IMPLEMENTED = false/);
assert.match(readinessSource, /CALENDAR_ROUTE_IMPORTS_READ_MODEL_QUERY_HELPER = false/);
assert.doesNotMatch(
  readinessSource,
  /createClient|createServerSupabaseClient|createBrowserSupabaseClient|cookies\(|headers\(|\.from\(|\.rpc\(|SUPABASE_SERVICE_ROLE_KEY|createServiceRole|sendEmail|enqueueReminder|navigator\.clipboard/i,
);

assert.equal(CALENDAR_ROUTE_CUTOVER_READINESS_REVIEW_AVAILABLE, true);
assert.equal(CALENDAR_ROUTE_CUTOVER_ELIGIBLE_ROUTE, "/admin/calendar");
assert.equal(CALENDAR_ROUTE_PERSISTED_READ_CUTOVER_IMPLEMENTED, false);
assert.equal(CALENDAR_ROUTE_IMPORTS_READ_MODEL_QUERY_HELPER, false);
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

assert.deepEqual(calendarRouteCutoverRenderingConstraints, {
  eligibleRoute: "/admin/calendar",
  routeMustBeDynamicNoStoreWhenPersisted: true,
  persistedReadExecution: "server_boundary_only",
  clientSupabaseForProductCalendarDataAllowed: false,
  browserProvidedWorkspaceIdTrusted: false,
  browserProvidedCapabilitiesTrusted: false,
  browserProvidedActorIdTrusted: false,
  browserProvidedSelectorTrusted: false,
  contextSource:
    "reviewed_authenticated_server_helpers_for_workspace_contact_capabilities_and_timezone",
  routeMayCallOnly: "reviewed_server_only_calendar_read_seams",
  routeMayCallFromDirectly: false,
  routeMayCallRpcDirectly: false,
  serviceRoleAllowed: false,
  broadTableQueriesAllowed: false,
  rawErrorRenderingAllowed: false,
  secretOrInternalPolicyRenderingAllowed: false,
});
assert.deepEqual(calendarRouteCutoverRequiredDataPath, [
  "verified_project_contact_session",
  "active_workspace_contact_grant_resolution",
  "calendar.view_capability",
  "assignments.view_capability_for_coverage_bearing_output",
  "trusted_workspace_id",
  "trusted_contact_actor_id",
  "trusted_workspace_timezone",
  "server_derived_explicit_bounded_calendar_period_range",
  "12.6_dependency_injected_query_helper_or_reviewed_successor",
  "12.3_pure_read_model_projection_or_reviewed_successor",
]);
assert.deepEqual(calendarRouteCutoverRangeAndPeriodRules.supportedPeriods, [
  "day",
  "week",
  "month",
  "list",
]);
assert.equal(calendarRouteCutoverRangeAndPeriodRules.unboundedWorkspaceWideReadsAllowed, false);
assert.equal(calendarRouteCutoverRangeAndPeriodRules.endMustBeAfterStart, true);
assert.equal(calendarRouteCutoverRangeAndPeriodRules.mustObeyHelperBoundedRangePolicy, true);
assert.equal(calendarRouteCutoverCapabilityRules.missingCalendarViewRevealsCalendarItemExistence, false);
assert.equal(calendarRouteCutoverCapabilityRules.missingAssignmentsViewMaySilentlyProduceZeroCoverage, false);
assert.equal(calendarRouteCutoverCapabilityRules.roleOrTitleAloneAuthorizesReads, false);
assert.deepEqual(calendarRouteCutoverCapabilityRules.requiredCapabilitiesForCoverage, [
  "calendar.view",
  "assignments.view",
]);
assert.equal(
  calendarRouteCutoverMockToRealRules.silentlyCombineMockAndPersistedCalendarItemsAllowed,
  false,
);
assert.equal(
  calendarRouteCutoverMockToRealRules.persistedReadFallbackToMockInSameTruthSourceAllowed,
  false,
);
for (const mockField of [
  "filledCount",
  "assignedVolunteerIds",
  "deterministicColors",
  "localCreationDrafts",
]) {
  assert.ok(calendarRouteCutoverMockToRealRules.mockFieldsNotProductionTruth.includes(mockField));
}
for (const state of [
  "unauthenticated",
  "unauthorized_or_no_workspace_access",
  "missing_calendar.view",
  "missing_assignments.view",
  "no_calendar_items_in_selected_range",
  "query_helper_safe_failure",
  "invalid_period_or_range",
]) {
  assert.ok(calendarRouteCutoverRequiredStates.includes(state));
}
for (const blocked of [
  "calendar_create_edit_archive_delete_persistence",
  "assignment_picker",
  "assignment_create_cancel",
  "assignment_detail_entry_links",
  "response_link_generation",
  "copy_ui",
  "delivery",
  "public_lookup",
  "remembered_device_behavior",
  "seed_data",
  "service_role_usage",
]) {
  assert.ok(calendarRouteCutoverBlockedUiAndProductChanges.includes(blocked));
}
for (const proof of [
  "desktop_calendar_renders_without_browser_errors",
  "mobile_390px_has_no_horizontal_overflow",
  "day_week_month_list_switch",
  "empty_persisted_data_shows_calm_empty_state",
  "unauthorized_persisted_contexts_show_calm_unavailable_state",
  "no_mock_persisted_data_mix_appears",
  "no_response_link_or_assignment_detail_entry_behavior",
  "preview_logs_are_redirected_and_redacted",
]) {
  assert.ok(calendarRouteCutoverBrowserProofRequirements.includes(proof));
}
assert.equal(calendarRouteCutoverRollbackRules.schemaChangesInSameSliceAllowed, false);
assert.equal(calendarRouteCutoverRollbackRules.uiRedesignInSameSliceAllowed, false);
assert.equal(calendarRouteCutoverRollbackRules.calendarWritesInSameSliceAllowed, false);
assert.equal(
  calendarRouteCutoverRollbackRules.failedValidationAction,
  "revert_route_integration_not_authorization_or_helper_weakening",
);

const description = describeCalendarRouteCutoverReadiness();
assert.equal(description.readinessReviewAvailable, true);
assert.equal(description.eligibleRoute, "/admin/calendar");
assert.equal(description.routePersistedReadCutoverImplemented, false);
assert.equal(description.routeImportsReadModelQueryHelper, false);
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
assert.equal(description.queryHelperRouteUnused, true);
assert.equal(description.queryHelperDependencyInjected, true);
assert.equal(description.queryHelperExplicitSelectors.calendarItems.includes("*"), false);
assert.equal(description.nextRecommendedSlice, "12.8 Calendar Route Cutover Dry-Run Harness");

const queryHelper = describeCalendarReadModelQueryHelper();
assert.equal(queryHelper.routeUnused, true);
assert.equal(queryHelper.dependencyInjected, true);
assert.equal(queryHelper.serviceRoleAvailable, false);
assert.equal(queryHelper.routeCutoverAvailable, false);
assert.equal(queryHelper.mockToRealMixingAllowed, false);
assert.equal(queryHelper.explicitSelectors.calendarItems.includes("*"), false);
assert.doesNotMatch(queryHelperSource, /\.select\(\s*["']\*["']\s*\)/);

const appAndComponentFiles = [
  ...(await collectFiles(path.join(root, "app"))),
  ...(await collectFiles(path.join(root, "components"))),
].filter((file) => /\.(?:ts|tsx)$/.test(file));

const readinessImporters = [];
const queryHelperImporters = [];
const persistedCalendarRouteImporters = [];
const assignmentDetailLinks = [];
for (const file of appAndComponentFiles) {
  const relative = path.relative(root, file).replaceAll("\\", "/");
  const source = await readFile(file, "utf8");
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
assert.deepEqual(readinessImporters, []);
assert.deepEqual(queryHelperImporters, []);
assert.deepEqual(persistedCalendarRouteImporters, []);
assert.deepEqual(assignmentDetailLinks, []);

assert.match(calendarRouteSource, /@\/lib\/mockData/);
assert.doesNotMatch(
  calendarRouteSource,
  /routeCutoverReadiness|readModelQuery|readCalendarReadModelWithClient|@\/lib\/calendar\/readModel|@\/lib\/calendar\/server|calendar_items|calendar_assignments|assignment_responses|(?:^|\n)\s*\.from\(|\.rpc\(|SUPABASE_SERVICE_ROLE_KEY|createServiceRole|serviceRole|formAction|useActionState|useFormState/i,
);
assert.doesNotMatch(
  calendarRouteSource,
  /sendEmail|enqueueReminder|rememberedDevice|publicLookup|assignment_response_tokens|response_link|navigator\.clipboard/i,
);

assert.match(packageSource, /"test:calendar-route-cutover-readiness"/);
assert.match(currentStateSource, /Iteration 12\.7/);
assert.match(roadmapSource, /12\.8 Calendar Route Cutover Dry-Run Harness/);
assert.match(calendarReadinessSource, /12\.7 Calendar Route Cutover Readiness Review/);
assert.match(authReadinessSource, /12\.7 Calendar route cutover readiness review/i);
assert.match(localSetupSource, /test:calendar-route-cutover-readiness/);
assert.match(localSetupSource, /Redirect Supabase start\/status output to a temporary file/);
assert.match(localSetupSource, /Redact key-like values before displaying diagnostics/);
assert.match(projectHistorySource, /Iteration 12\.7 - Calendar Route Cutover Readiness Review/);

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

console.log("Calendar route cutover readiness checks passed.");
console.log("Confirmed /admin/calendar remains mock-only and no route imports the query helper.");
