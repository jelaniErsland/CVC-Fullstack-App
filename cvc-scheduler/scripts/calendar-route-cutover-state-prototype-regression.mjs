import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describeCalendarReadModelQueryHelper } from "../lib/calendar/readModelQuery.server.ts";
import { describeCalendarPersistedReadModelContract } from "../lib/calendar/readModelContract.server.ts";
import { describeCalendarRouteCutoverDryRun } from "../lib/calendar/routeCutoverDryRun.server.ts";
import { describeCalendarRouteCutoverFinalPreflight } from "../lib/calendar/routeCutoverFinalPreflight.server.ts";
import { describeCalendarRouteCutoverReadiness } from "../lib/calendar/routeCutoverReadiness.server.ts";
import {
  CALENDAR_ASSIGNMENT_DETAIL_LINKING_AVAILABLE,
  CALENDAR_ASSIGNMENT_PICKER_CUTOVER_AVAILABLE,
  CALENDAR_HOSTED_CUTOVER_VALIDATION_AVAILABLE,
  CALENDAR_PUBLIC_LOOKUP_CUTOVER_AVAILABLE,
  CALENDAR_REMINDER_DELIVERY_AVAILABLE,
  CALENDAR_RESPONSE_LINK_ACTIVATION_REOPENED,
  CALENDAR_ROUTE_CUTOVER_STATE_PROTOTYPE_AVAILABLE,
  CALENDAR_ROUTE_CUTOVER_STATE_PROTOTYPE_NEXT_RECOMMENDED_SLICE,
  CALENDAR_ROUTE_CUTOVER_STATE_PROTOTYPE_ROUTE_UNUSED,
  CALENDAR_ROUTE_IMPORTS_READ_MODEL_QUERY_HELPER,
  CALENDAR_ROUTE_MOCK_TO_REAL_MIXING_ALLOWED,
  CALENDAR_ROUTE_PERSISTED_READ_CUTOVER_IMPLEMENTED,
  CALENDAR_ROUTE_PERSISTED_WRITE_AVAILABLE,
  CALENDAR_ROUTE_USES_DRY_RUN_HARNESS,
  CALENDAR_SEED_DATA_AVAILABLE,
  CALENDAR_SERVICE_ROLE_READ_AVAILABLE,
  calendarRouteCutoverStatePrototypeCopy,
  calendarRouteCutoverStatePrototypeStateRules,
  calendarRouteCutoverStatePrototypeStates,
  calendarRouteCutoverStatePrototypeUiContract,
  calendarRouteCutoverStatePrototypeUnsafeUserFacingFields,
  calendarRouteCutoverStatePrototypeViews,
  describeCalendarRouteCutoverStatePrototype,
  getCalendarRouteCutoverStatePrototypePresentation,
} from "../lib/calendar/routeCutoverStatePrototype.server.ts";
import { describeMvpRealDataCutoverPlan } from "../lib/readiness/mvpRealDataCutoverPlan.server.ts";
import { describeResponseLinkProductActionActivationCheckpoint } from "../lib/responseTokens/productActionActivationCheckpoint.server.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const statePrototypePath = path.join(root, "lib", "calendar", "routeCutoverStatePrototype.server.ts");
const queryHelperPath = path.join(root, "lib", "calendar", "readModelQuery.server.ts");
const dryRunPath = path.join(root, "lib", "calendar", "routeCutoverDryRun.server.ts");
const finalPreflightPath = path.join(root, "lib", "calendar", "routeCutoverFinalPreflight.server.ts");
const calendarRoutePath = path.join(root, "app", "admin", "calendar", "page.tsx");

const statePrototypeSource = await readFile(statePrototypePath, "utf8");
const queryHelperSource = await readFile(queryHelperPath, "utf8");
const dryRunSource = await readFile(dryRunPath, "utf8");
const finalPreflightSource = await readFile(finalPreflightPath, "utf8");
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

assert.match(statePrototypeSource, /^import "server-only";/);
assert.match(statePrototypeSource, /CALENDAR_ROUTE_CUTOVER_STATE_PROTOTYPE_AVAILABLE = true/);
assert.match(statePrototypeSource, /type CalendarRouteCutoverPrototypeState/);
assert.match(statePrototypeSource, /ready_with_items/);
assert.match(statePrototypeSource, /ready_empty/);
assert.match(statePrototypeSource, /unavailable/);
assert.match(statePrototypeSource, /error/);
assert.doesNotMatch(
  statePrototypeSource,
  /createClient|createServerSupabaseClient|createBrowserSupabaseClient|lib\/supabase\/server|cookies\(|headers\(|from\s+["']app\/|React|JSX|\.from\(|\.rpc\(|SUPABASE_SERVICE_ROLE_KEY|createServiceRole|sendEmail|enqueueReminder|navigator\.clipboard/i,
);

assert.equal(CALENDAR_ROUTE_CUTOVER_STATE_PROTOTYPE_AVAILABLE, true);
assert.equal(CALENDAR_ROUTE_CUTOVER_STATE_PROTOTYPE_ROUTE_UNUSED, true);
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
  CALENDAR_ROUTE_CUTOVER_STATE_PROTOTYPE_NEXT_RECOMMENDED_SLICE,
  "12.11 Calendar Persisted Read Route Cutover Implementation",
);

assert.deepEqual([...calendarRouteCutoverStatePrototypeStates], [
  "ready_with_items",
  "ready_empty",
  "unavailable",
  "error",
]);
assert.deepEqual([...calendarRouteCutoverStatePrototypeViews], [
  "day",
  "week",
  "month",
  "list",
]);

assert.equal(calendarRouteCutoverStatePrototypeStateRules.readyWithItems.renderNormalCalendarItems, true);
assert.equal(calendarRouteCutoverStatePrototypeStateRules.readyWithItems.renderExistingCalendarSurface, true);
assert.equal(calendarRouteCutoverStatePrototypeStateRules.readyEmpty.emptyIsFailure, false);
assert.equal(calendarRouteCutoverStatePrototypeStateRules.readyEmpty.emptyIsUnavailable, false);
assert.equal(calendarRouteCutoverStatePrototypeStateRules.readyEmpty.emptyIsError, false);
assert.equal(calendarRouteCutoverStatePrototypeStateRules.readyEmpty.createFakeCalendarItemsToFillView, false);
assert.equal(calendarRouteCutoverStatePrototypeStateRules.unavailable.distinctFromUnexpectedError, true);
assert.equal(calendarRouteCutoverStatePrototypeStateRules.unavailable.silentMockFallbackAllowed, false);
assert.equal(calendarRouteCutoverStatePrototypeStateRules.error.distinctFromUnavailable, true);
assert.equal(calendarRouteCutoverStatePrototypeStateRules.error.rawErrorRenderingAllowed, false);
assert.equal(calendarRouteCutoverStatePrototypeStateRules.error.silentMockFallbackAllowed, false);

assert.equal(calendarRouteCutoverStatePrototypeUiContract.preserveExistingCalendarShell, true);
assert.equal(calendarRouteCutoverStatePrototypeUiContract.preserveDayWeekMonthListViews, true);
assert.equal(calendarRouteCutoverStatePrototypeUiContract.preserveDateNavigation, true);
assert.equal(calendarRouteCutoverStatePrototypeUiContract.preserveViewControls, true);
assert.equal(calendarRouteCutoverStatePrototypeUiContract.preserveFilters, true);
assert.equal(calendarRouteCutoverStatePrototypeUiContract.preservePreviewOnlyCreationBehavior, true);
assert.equal(calendarRouteCutoverStatePrototypeUiContract.redesignCalendarSurfaceInThisSlice, false);
assert.equal(calendarRouteCutoverStatePrototypeUiContract.overviewDashboardLayerAllowed, false);
assert.equal(calendarRouteCutoverStatePrototypeUiContract.eventBlocksRemainMinimal, true);
assert.equal(calendarRouteCutoverStatePrototypeUiContract.emptyUnavailableErrorFitInsideExistingPage, true);
assert.equal(calendarRouteCutoverStatePrototypeUiContract.productionRouteDataBehaviorChanged, false);

for (const [name, copy] of Object.entries(calendarRouteCutoverStatePrototypeCopy)) {
  const text = JSON.stringify(copy).toLowerCase();
  assert.equal(text.includes("supabase"), false, `${name} copy mentions Supabase`);
  assert.equal(text.includes("sql"), false, `${name} copy mentions SQL`);
  assert.equal(text.includes("rpc"), false, `${name} copy mentions RPC`);
  assert.equal(text.includes("policy"), false, `${name} copy mentions policy`);
  assert.equal(text.includes("token"), false, `${name} copy mentions token`);
}

for (const unsafe of [
  "auth_session_detail",
  "grant_detail",
  "workspace_internal_detail",
  "raw_capability_arrays",
  "supabase_error",
  "sql_detail",
  "rpc_detail",
  "policy_name",
  "table_name",
  "stack_trace",
  "raw_exception_message",
  "token",
  "bearer",
  "verifier",
  "audit_id",
  "access_token",
  "refresh_token",
  "service_role_key",
  "response_url",
  "volunteer_contact_values",
  "questionnaire_answers",
  "emergency_contact_values",
  "unrelated_row_data",
]) {
  assert.ok(calendarRouteCutoverStatePrototypeUnsafeUserFacingFields.includes(unsafe));
}

const readyWithItems = getCalendarRouteCutoverStatePrototypePresentation({
  kind: "ready_with_items",
  view: "week",
  itemCount: 3,
});
assert.equal(readyWithItems.stateKind, "ready_with_items");
assert.equal(readyWithItems.renderNormalCalendarItems, true);
assert.equal(readyWithItems.renderEmptyState, false);
assert.equal(readyWithItems.renderUnavailableState, false);
assert.equal(readyWithItems.renderErrorState, false);
assert.equal(readyWithItems.preserveCalendarShell, true);
assert.equal(readyWithItems.preserveViewControls, true);
assert.equal(readyWithItems.mockFallbackAllowed, false);
assert.equal(readyWithItems.mockPersistedMixAllowed, false);

const readyEmpty = getCalendarRouteCutoverStatePrototypePresentation({
  kind: "ready_empty",
  view: "month",
  itemCount: 0,
});
assert.equal(readyEmpty.stateKind, "ready_empty");
assert.equal(readyEmpty.renderNormalCalendarItems, false);
assert.equal(readyEmpty.renderEmptyState, true);
assert.equal(readyEmpty.renderUnavailableState, false);
assert.equal(readyEmpty.renderErrorState, false);
assert.equal(readyEmpty.userFacingTone, "empty");
assert.match(readyEmpty.userFacingHeading, /No scheduled items/);
assert.equal(readyEmpty.mockFallbackAllowed, false);
assert.equal(readyEmpty.mockPersistedMixAllowed, false);

const unavailable = getCalendarRouteCutoverStatePrototypePresentation({
  kind: "unavailable",
  view: "list",
  reason: "missing_assignments_view",
});
assert.equal(unavailable.stateKind, "unavailable");
assert.equal(unavailable.renderNormalCalendarItems, false);
assert.equal(unavailable.renderEmptyState, false);
assert.equal(unavailable.renderUnavailableState, true);
assert.equal(unavailable.renderErrorState, false);
assert.equal(unavailable.userFacingTone, "unavailable");
assert.equal(unavailable.rawInternalDetailsAllowed, false);

const error = getCalendarRouteCutoverStatePrototypePresentation({
  kind: "error",
  view: "day",
  reason: "query_unavailable",
});
assert.equal(error.stateKind, "error");
assert.equal(error.renderNormalCalendarItems, false);
assert.equal(error.renderEmptyState, false);
assert.equal(error.renderUnavailableState, false);
assert.equal(error.renderErrorState, true);
assert.equal(error.userFacingTone, "error");
assert.equal(error.rawInternalDetailsAllowed, false);

const malformedReady = getCalendarRouteCutoverStatePrototypePresentation({
  kind: "ready_with_items",
  view: "day",
  itemCount: 0,
});
assert.equal(malformedReady.stateKind, "error");
assert.equal(malformedReady.renderErrorState, true);
assert.equal(malformedReady.mockFallbackAllowed, false);

for (const presentation of [readyWithItems, readyEmpty, unavailable, error, malformedReady]) {
  const text = JSON.stringify(presentation).toLowerCase();
  for (const forbidden of [
    "supabase",
    "sql",
    "rpc",
    "policy",
    "stack",
    "bearer",
    "verifier",
    "access_token",
    "refresh_token",
    "service_role",
    "response_url",
    "questionnaire",
    "emergency",
  ]) {
    assert.equal(text.includes(forbidden), false, `presentation exposed ${forbidden}`);
  }
  assert.equal(presentation.preserveCalendarShell, true);
  assert.equal(presentation.preserveDateNavigation, true);
  assert.equal(presentation.preserveCreationPreviewOnlyBehavior, true);
  assert.equal(presentation.mockFallbackAllowed, false);
  assert.equal(presentation.mockPersistedMixAllowed, false);
  assert.equal(presentation.safeForUserFacingOutput, true);
}

const description = describeCalendarRouteCutoverStatePrototype();
assert.equal(description.prototypeAvailable, true);
assert.equal(description.routeUnused, true);
assert.equal(description.routePersistedReadCutoverImplemented, false);
assert.equal(description.routeImportsReadModelQueryHelper, false);
assert.equal(description.routeUsesDryRunHarness, false);
assert.equal(description.mockToRealMixingAllowed, false);
assert.equal(description.persistedWriteAvailable, false);
assert.equal(description.assignmentPickerCutoverAvailable, false);
assert.equal(description.assignmentDetailLinkingAvailable, false);
assert.equal(description.responseLinkActivationReopened, false);
assert.equal(description.serviceRoleReadAvailable, false);
assert.equal(description.seedDataAvailable, false);
assert.equal(description.nextRecommendedSlice, "12.11 Calendar Persisted Read Route Cutover Implementation");

const readModelContract = describeCalendarPersistedReadModelContract();
assert.equal(readModelContract.contract.assignmentDerivedCoverageSummary.sourceOfTruth, "calendar_assignments_and_current_assignment_responses");
assert.equal(readModelContract.contract.assignmentDerivedCoverageSummary.needsResponseAndConfirmedCountTowardAssigned, true);
assert.equal(readModelContract.contract.assignmentDerivedCoverageSummary.deniedAndRemovedAssignmentsCountTowardAssigned, false);
assert.deepEqual(readModelContract.contract.capabilityContract.assignmentDerivedCoverageCountsRequire, [
  "calendar.view",
  "assignments.view",
]);
assert.equal(readModelContract.contract.capabilityContract.broadVolunteerValuesAllowed, false);

const queryHelper = describeCalendarReadModelQueryHelper();
assert.equal(queryHelper.routeUnused, true);
assert.equal(queryHelper.dependencyInjected, true);
assert.equal(queryHelper.serviceRoleAvailable, false);
assert.equal(queryHelper.explicitSelectors.calendarItems.includes("*"), false);
assert.doesNotMatch(queryHelperSource, /\.select\(\s*["']\*["']\s*\)/);

const readiness = describeCalendarRouteCutoverReadiness();
assert.equal(readiness.readinessReviewAvailable, true);
assert.equal(readiness.routePersistedReadCutoverImplemented, false);

const dryRun = describeCalendarRouteCutoverDryRun();
assert.equal(dryRun.dryRunAvailable, true);
assert.equal(dryRun.routeUsesDryRunHarness, false);
assert.equal(dryRun.routeImportsReadModelQueryHelper, false);

const finalPreflight = describeCalendarRouteCutoverFinalPreflight();
assert.equal(finalPreflight.finalPreflightAvailable, true);
assert.equal(finalPreflight.routePersistedReadCutoverImplemented, false);
assert.equal(finalPreflight.routeImportsReadModelQueryHelper, false);

assert.match(dryRunSource, /CALENDAR_ROUTE_CUTOVER_DRY_RUN_AVAILABLE = true/);
assert.match(finalPreflightSource, /CALENDAR_ROUTE_CUTOVER_FINAL_PREFLIGHT_AVAILABLE = true/);

const appAndComponentFiles = [
  ...(await collectFiles(path.join(root, "app"))),
  ...(await collectFiles(path.join(root, "components"))),
].filter((file) => /\.(?:ts|tsx)$/.test(file));

const statePrototypeImporters = [];
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
    source.includes("routeCutoverStatePrototype.server") ||
    source.includes("describeCalendarRouteCutoverStatePrototype") ||
    source.includes("getCalendarRouteCutoverStatePrototypePresentation")
  ) {
    statePrototypeImporters.push(relative);
  }
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
assert.deepEqual(statePrototypeImporters, []);
assert.deepEqual(finalPreflightImporters, []);
assert.deepEqual(dryRunImporters, []);
assert.deepEqual(readinessImporters, []);
assert.deepEqual(queryHelperImporters, []);
assert.deepEqual(persistedCalendarRouteImporters, []);
assert.deepEqual(assignmentDetailLinks, []);

assert.match(calendarRouteSource, /@\/lib\/calendar\/routeRead\.server/);
assert.doesNotMatch(
  calendarRouteSource,
  /routeCutoverStatePrototype|routeCutoverFinalPreflight|routeCutoverDryRun|routeCutoverReadiness|readModelQuery|readCalendarReadModelWithClient|runCalendarRouteCutoverDryRun|@\/lib\/calendar\/readModel|@\/lib\/calendar\/server|calendar_items|calendar_assignments|assignment_responses|(?:^|\n)\s*\.from\(|\.rpc\(|SUPABASE_SERVICE_ROLE_KEY|createServiceRole|serviceRole|formAction|useActionState|useFormState/i,
);
assert.doesNotMatch(
  calendarRouteSource,
  /sendEmail|enqueueReminder|rememberedDevice|publicLookup|assignment_response_tokens|response_link|navigator\.clipboard/i,
);

assert.match(packageSource, /"test:calendar-route-cutover-state-prototype"/);
assert.match(currentStateSource, /Iteration 12\.10/);
assert.match(roadmapSource, /12\.10 Calendar Route Cutover Empty\/Unavailable State Prototype/);
assert.match(calendarReadinessSource, /12\.10 Calendar Route Cutover Empty\/Unavailable State Prototype/);
assert.match(authReadinessSource, /12\.10 Calendar route cutover empty\/unavailable state prototype/i);
assert.match(localSetupSource, /test:calendar-route-cutover-state-prototype/);
assert.match(localSetupSource, /Redirect Supabase start\/status output to a temporary file/);
assert.match(localSetupSource, /Redact key-like values before displaying diagnostics/);
assert.match(projectHistorySource, /Iteration 12\.10 - Calendar Route Cutover Empty\/Unavailable State Prototype/);

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

console.log("Calendar route cutover state prototype checks passed.");
console.log("Confirmed 12.10 prototype remains route-unused and /admin/calendar uses only the reviewed route read adapter.");
