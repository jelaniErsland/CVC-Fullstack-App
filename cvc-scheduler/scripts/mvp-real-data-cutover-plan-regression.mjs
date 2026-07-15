import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CALENDAR_ROUTE_PERSISTED_READ_CUTOVER_AVAILABLE,
  COMMUNICATIONS_PERSISTENCE_CUTOVER_AVAILABLE,
  MOCK_TO_REAL_MIXING_ALLOWED,
  MVP_REAL_DATA_CUTOVER_PLAN_AVAILABLE,
  MVP_ROUTE_CUTOVER_IMPLEMENTATION_AVAILABLE,
  PUBLIC_VOLUNTEER_LOOKUP_CUTOVER_AVAILABLE,
  REMINDER_DELIVERY_AVAILABLE,
  RESPONSE_LINK_ACTIVATION_REOPENED,
  SERVICE_ROLE_CUTOVER_AVAILABLE,
  TASKS_ROUTE_PERSISTED_READ_CUTOVER_AVAILABLE,
  VOLUNTEERS_ROUTE_PERSISTED_READ_CUTOVER_AVAILABLE,
  describeMvpRealDataCutoverPlan,
  evaluateMvpRealDataCutoverReadiness,
  mvpRealDataCutoverPlan,
} from "../lib/readiness/mvpRealDataCutoverPlan.server.ts";
import {
  RESPONSE_LINK_PRODUCT_ACTION_ACTIVATION_APPROVED,
  RESPONSE_LINK_PRODUCT_ACTION_ACTIVATION_CHECKPOINT_AVAILABLE,
  describeResponseLinkProductActionActivationCheckpoint,
} from "../lib/responseTokens/productActionActivationCheckpoint.server.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const planPath = path.join(root, "lib", "readiness", "mvpRealDataCutoverPlan.server.ts");
const planSource = await readFile(planPath, "utf8");
const packageSource = await readFile(path.join(root, "package.json"), "utf8");
const currentStateSource = await readFile(path.join(root, "docs", "CURRENT_STATE.md"), "utf8");
const roadmapSource = await readFile(path.join(root, "docs", "ROADMAP.md"), "utf8");
const readinessSource = await readFile(
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

assert.match(planSource, /^import "server-only";/);
assert.match(planSource, /MVP_REAL_DATA_CUTOVER_PLAN_AVAILABLE = true/);
for (const falseFlag of [
  "MVP_ROUTE_CUTOVER_IMPLEMENTATION_AVAILABLE",
  "CALENDAR_ROUTE_PERSISTED_READ_CUTOVER_AVAILABLE",
  "TASKS_ROUTE_PERSISTED_READ_CUTOVER_AVAILABLE",
  "VOLUNTEERS_ROUTE_PERSISTED_READ_CUTOVER_AVAILABLE",
  "PUBLIC_VOLUNTEER_LOOKUP_CUTOVER_AVAILABLE",
  "COMMUNICATIONS_PERSISTENCE_CUTOVER_AVAILABLE",
  "REMINDER_DELIVERY_AVAILABLE",
  "RESPONSE_LINK_ACTIVATION_REOPENED",
  "MOCK_TO_REAL_MIXING_ALLOWED",
  "SERVICE_ROLE_CUTOVER_AVAILABLE",
]) {
  assert.match(planSource, new RegExp(`${falseFlag} = false`));
}
assert.doesNotMatch(
  planSource,
  /["']use server["']|createServerSupabaseClient|createBrowserSupabaseClient|\.from\(|\.rpc\(|SUPABASE_SERVICE_ROLE_KEY|createServiceRole|sendEmail\(|sendReminder\(|enqueue[A-Z]|\bcron[A-Z]|\bseed[A-Z]|navigator\.clipboard|clipboard\.writeText/i,
);

for (const foundation of [
  "workspace_identity",
  "project_contact_grants",
  "questionnaire_submissions",
  "volunteer_profiles",
  "task_presets",
  "calendar_items",
  "calendar_assignments_current_responses",
  "public_response_tokens",
  "assignment_detail_context",
  "response_link_infrastructure_boxed_behind_false_activation_flags",
]) {
  assert.match(planSource, new RegExp(foundation));
  assert.ok(mvpRealDataCutoverPlan.persistedFoundationsAvailable.includes(foundation));
}

for (const mockOnlySurface of [
  "/admin/calendar",
  "/admin/tasks",
  "/admin/volunteers",
  "/admin/announcements",
  "/admin/announcements/templates",
  "/v/demo",
  "/v/demo/assignments/[assignmentId]",
  "/v/demo/reminder/[assignmentId]",
  "/",
  "/admin/food",
  "/admin/security",
  "/admin/schedule",
]) {
  assert.match(planSource, new RegExp(mockOnlySurface.replaceAll("/", "\\/").replaceAll("[", "\\[").replaceAll("]", "\\]")));
  assert.ok(mvpRealDataCutoverPlan.mockOnlyPrototypeSurfaces.includes(mockOnlySurface));
}

assert.deepEqual(
  mvpRealDataCutoverPlan.recommendedCutoverSequence.map((step) => step.id),
  [
    "route_scoped_persisted_calendar_read_model",
    "persisted_task_preset_read_model",
    "persisted_volunteer_profile_admin_scheduling_read_model",
    "persisted_assignment_coverage_read_model",
    "calendar_creation_edit_command_readiness",
    "assignment_picker_create_cancel_command_readiness",
    "volunteer_schedule_lookup_read_model",
    "public_volunteer_confirm_deny_confirm_all_integration",
    "communications_reminder_queue_persistence_review_send_workflow",
    "automatic_reminder_engine_history_after_communications_persistence",
  ],
);
assert.equal(
  mvpRealDataCutoverPlan.recommendedNextImplementationSlice.name,
  "Persisted Calendar Read Model Contract",
);
assert.equal(mvpRealDataCutoverPlan.recommendedNextImplementationSlice.id, "12.2");

for (const nonNegotiable of [
  "one_route_may_not_silently_mix_mock_items_and_persisted_items_as_one_truth_source",
  "mock_routes_must_stay_clearly_mock_prototype",
  "persisted_routes_must_use_reviewed_server_only_helpers_and_explicit_capability_checks",
  "route_cutovers_must_be_incremental_and_separately_reviewed",
  "persisted_routes_must_define_unavailable_and_empty_states_before_exposing_data",
  "calendar_assignment_counts_must_come_from_assignment_rows_not_mock_counters",
  "volunteer_response_truth_must_come_from_assignment_current_response_rows_not_mock_local_state",
  "communications_reminders_must_not_send_until_review_send_delivery_boundaries_exist",
  "public_volunteer_lookup_must_not_expose_project_or_volunteer_existence_through_ambiguous_errors",
  "response_link_work_remains_paused_unless_a_later_explicit_slice_reopens_it",
  "no_service_role_usage_unless_a_future_reviewed_server_only_operation_requires_it",
  "no_seed_data_or_mock_to_real_bridging",
  "no_broad_assignment_directory_or_search_route_unless_separately_reviewed",
]) {
  assert.ok(mvpRealDataCutoverPlan.nonNegotiableCutoverRules.includes(nonNegotiable));
}

for (const blockedItem of [
  "active_response_link_reveal",
  "response_link_copy_ui",
  "assignment_detail_entry_links",
  "public_volunteer_lookup_cutover",
  "remembered_devices",
  "email_reminder_delivery",
  "automatic_reminders",
  "calendar_route_cutover",
  "volunteer_route_cutover",
  "task_route_cutover",
  "communications_route_cutover",
  "production_seed_data",
  "service_role_paths",
  "hosted_validation_unless_db_rpc_generated_type_or_hosted_behavior_changes",
]) {
  assert.ok(mvpRealDataCutoverPlan.explicitlyBlockedForNow.includes(blockedItem));
}

assert.equal(MVP_REAL_DATA_CUTOVER_PLAN_AVAILABLE, true);
assert.equal(MVP_ROUTE_CUTOVER_IMPLEMENTATION_AVAILABLE, false);
assert.equal(CALENDAR_ROUTE_PERSISTED_READ_CUTOVER_AVAILABLE, false);
assert.equal(TASKS_ROUTE_PERSISTED_READ_CUTOVER_AVAILABLE, false);
assert.equal(VOLUNTEERS_ROUTE_PERSISTED_READ_CUTOVER_AVAILABLE, false);
assert.equal(PUBLIC_VOLUNTEER_LOOKUP_CUTOVER_AVAILABLE, false);
assert.equal(COMMUNICATIONS_PERSISTENCE_CUTOVER_AVAILABLE, false);
assert.equal(REMINDER_DELIVERY_AVAILABLE, false);
assert.equal(RESPONSE_LINK_ACTIVATION_REOPENED, false);
assert.equal(MOCK_TO_REAL_MIXING_ALLOWED, false);
assert.equal(SERVICE_ROLE_CUTOVER_AVAILABLE, false);
assert.equal(RESPONSE_LINK_PRODUCT_ACTION_ACTIVATION_CHECKPOINT_AVAILABLE, true);
assert.equal(RESPONSE_LINK_PRODUCT_ACTION_ACTIVATION_APPROVED, false);

const description = describeMvpRealDataCutoverPlan();
assert.equal(description.planAvailable, true);
assert.equal(description.routeCutoverImplementationAvailable, false);
assert.equal(description.calendarRoutePersistedReadCutoverAvailable, false);
assert.equal(description.tasksRoutePersistedReadCutoverAvailable, false);
assert.equal(description.volunteersRoutePersistedReadCutoverAvailable, false);
assert.equal(description.publicVolunteerLookupCutoverAvailable, false);
assert.equal(description.communicationsPersistenceCutoverAvailable, false);
assert.equal(description.reminderDeliveryAvailable, false);
assert.equal(description.responseLinkActivationReopened, false);
assert.equal(description.responseLinkActivationCheckpointAvailable, true);
assert.equal(description.responseLinkActivationApproved, false);
assert.equal(description.mockToRealMixingAllowed, false);
assert.equal(description.serviceRoleCutoverAvailable, false);

const readiness = evaluateMvpRealDataCutoverReadiness();
assert.equal(readiness.allowed, false);
assert.equal(readiness.recommendedNextImplementationSlice.id, "12.2");
for (const blocker of [
  "route_cutover_not_implemented",
  "calendar_route_persisted_read_cutover_unavailable",
  "tasks_route_persisted_read_cutover_unavailable",
  "volunteers_route_persisted_read_cutover_unavailable",
  "public_volunteer_lookup_cutover_unavailable",
  "communications_persistence_cutover_unavailable",
  "reminder_delivery_unavailable",
  "response_link_activation_paused_after_11_50",
  "mock_to_real_mixing_disallowed",
  "service_role_cutover_unavailable",
]) {
  assert.ok(readiness.blockers.includes(blocker));
}

const activationCheckpoint = describeResponseLinkProductActionActivationCheckpoint();
assert.equal(activationCheckpoint.checkpointAvailable, true);
assert.equal(activationCheckpoint.activationApproved, false);
assert.equal(activationCheckpoint.activeRevealAvailable, false);
assert.equal(activationCheckpoint.activeCopyAvailable, false);
assert.equal(activationCheckpoint.deliveryAvailable, false);
assert.equal(activationCheckpoint.publicLookupAvailable, false);
assert.equal(activationCheckpoint.rememberedDeviceAvailable, false);

const appAndComponentFiles = [];
for (const directory of ["app", "components"]) {
  appAndComponentFiles.push(
    ...(await collectFiles(path.join(root, directory))).filter((file) =>
      /\.(?:ts|tsx)$/.test(file),
    ),
  );
}

const planImporters = [];
const assignmentDetailLinks = [];
const persistedCutoverImporters = [];
const serviceRoleMarkers = [];
for (const file of appAndComponentFiles) {
  const relative = path.relative(root, file).replaceAll("\\", "/");
  const source = await readFile(file, "utf8");
  if (
    source.includes("mvpRealDataCutoverPlan") ||
    source.includes("MVP_REAL_DATA_CUTOVER") ||
    source.includes("MVP_ROUTE_CUTOVER") ||
    source.includes("CALENDAR_ROUTE_PERSISTED_READ_CUTOVER")
  ) {
    planImporters.push(relative);
  }
  if (
    relative !== "app/admin/assignments/[assignmentId]/page.tsx" &&
    source.includes("/admin/assignments/")
  ) {
    assignmentDetailLinks.push(relative);
  }
  if (
    /@\/lib\/(?:calendar|tasks|volunteers)(?:\/|["'])|@\/lib\/readiness|readPersistedCalendar|readCalendarReadModel|readTaskPresetReadModel|readVolunteerProfileReadModel|loadPersistedCalendar|loadPersistedTasks|loadPersistedVolunteers|calendar_items|task_presets|volunteer_profiles|calendar_assignments/i.test(
      source,
    )
  ) {
    if (
      !(
        relative === "app/admin/calendar/page.tsx" &&
        source.includes("@/lib/calendar/routeRead.server")
      ) &&
      !(
        relative === "app/admin/volunteers/page.tsx" &&
        source.includes("@/lib/volunteers/routeRead.server")
      ) &&
      !(
        (relative === "components/VolunteerCard.tsx" ||
          relative === "components/VolunteerDirectory.tsx") &&
        source.includes("@/lib/volunteers/profile")
      )
    ) {
      persistedCutoverImporters.push(relative);
    }
  }
  if (/SUPABASE_SERVICE_ROLE_KEY|serviceRole|createServiceRole/i.test(source)) {
    serviceRoleMarkers.push(relative);
  }
}

assert.deepEqual(planImporters, []);
assert.deepEqual(assignmentDetailLinks, []);
assert.deepEqual(persistedCutoverImporters, []);
assert.deepEqual(serviceRoleMarkers, []);

for (const [relative, requiredMarker] of [
  ["app/admin/tasks/page.tsx", "@/lib/mockData"],
  ["app/admin/announcements/page.tsx", "@/lib/mockData"],
  ["app/admin/announcements/templates/page.tsx", "@/lib/mockData"],
  ["app/v/demo/page.tsx", "@/lib/volunteerPreview"],
  ["app/v/demo/assignments/[assignmentId]/page.tsx", "@/lib/volunteerPreview"],
  ["app/v/demo/reminder/[assignmentId]/page.tsx", "@/lib/volunteerPreview"],
  ["app/admin/food/page.tsx", "@/lib/mockData"],
  ["app/admin/security/page.tsx", "@/lib/mockData"],
  ["app/admin/schedule/page.tsx", "@/lib/mockData"],
]) {
  const source = await readFile(path.join(root, ...relative.split("/")), "utf8");
  assert.match(source, new RegExp(requiredMarker.replace("/", "\\/")));
}

const calendarRouteSource = await readFile(
  path.join(root, "app", "admin", "calendar", "page.tsx"),
  "utf8",
);
assert.match(calendarRouteSource, /@\/lib\/calendar\/routeRead\.server/);
assert.doesNotMatch(calendarRouteSource, /@\/lib\/mockData|getCalendarItemsByWeek/);

const volunteersRouteSource = await readFile(
  path.join(root, "app", "admin", "volunteers", "page.tsx"),
  "utf8",
);
assert.match(volunteersRouteSource, /@\/lib\/volunteers\/routeRead\.server/);
assert.doesNotMatch(volunteersRouteSource, /@\/lib\/mockData|projectVolunteers|getVolunteerById/);

assert.match(packageSource, /"test:mvp-cutover-plan": "node --conditions=react-server --no-warnings --experimental-strip-types scripts\/mvp-real-data-cutover-plan-regression\.mjs"/);
assert.match(readinessSource, /12\.1 MVP real-data cutover sequencing review/i);
assert.match(readinessSource, /12\.2 Persisted Calendar Read Model Contract/);
assert.match(readinessSource, /Response-link activation remains paused after 11\.50/i);
assert.match(localSetupSource, /test:mvp-cutover-plan/);
assert.match(localSetupSource, /After 12\.1/);
assert.match(currentStateSource, /Iteration 12\.1/);
assert.match(roadmapSource, /12\.1 MVP Real-Data Cutover Sequencing Review/);
assert.match(projectHistorySource, /Iteration 12\.1 - MVP Real-Data Cutover Sequencing Review/);
assert.match(localSetupSource, /Do not print raw Supabase CLI\/status\/start output/);
assert.match(localSetupSource, /Redirect Supabase start\/status output to a temporary file/);
assert.match(localSetupSource, /Redact key-like values before displaying diagnostics/);

console.log("MVP real-data cutover sequencing checks passed.");
console.log("Confirmed the 12.1 cutover plan remains intact while /admin/calendar uses the approved 12.11 read adapter.");
