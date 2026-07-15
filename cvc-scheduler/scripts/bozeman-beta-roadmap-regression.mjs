import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  BOZEMAN_BETA_PRINCIPLE,
  BOZEMAN_BETA_ROADMAP_REBASELINE_AVAILABLE,
  BELGRADE_REMAINS_SHEETS_FALLBACK,
  bozemanBetaAuditDomains,
  bozemanBetaCriticalPath,
  bozemanBetaLaunchGate,
  bozemanBetaOld12_14Decision,
  bozemanBetaRoadmap,
  describeBozemanBetaRoadmap,
  evaluateBozemanBetaLaunchReadiness,
} from "../lib/readiness/bozemanBetaRoadmap.server.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

async function listFiles(dir, predicate = () => true) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if ([".next", "node_modules", ".git"].includes(entry.name)) continue;
      files.push(...(await listFiles(fullPath, predicate)));
    } else if (predicate(fullPath)) {
      files.push(fullPath);
    }
  }
  return files;
}

const roadmapPath = path.join(root, "lib", "readiness", "bozemanBetaRoadmap.server.ts");
const roadmapSource = await readFile(roadmapPath, "utf8");
const packageSource = await readFile(path.join(root, "package.json"), "utf8");
const currentState = await readFile(path.join(root, "docs", "CURRENT_STATE.md"), "utf8");
const roadmapDoc = await readFile(path.join(root, "docs", "ROADMAP.md"), "utf8");
const historyDoc = await readFile(path.join(root, "docs", "PROJECT_HISTORY.md"), "utf8");
const authDoc = await readFile(
  path.join(root, "docs", "SUPABASE_AUTH_PERSISTENCE_READINESS.md"),
  "utf8",
);
const betaDoc = await readFile(path.join(root, "docs", "BOZEMAN_BETA_ROADMAP.md"), "utf8");
const calendarRoute = await readFile(path.join(root, "app", "admin", "calendar", "page.tsx"), "utf8");
const tasksRoute = await readFile(path.join(root, "app", "admin", "tasks", "page.tsx"), "utf8");

assert.equal(BOZEMAN_BETA_ROADMAP_REBASELINE_AVAILABLE, true);
assert.equal(BELGRADE_REMAINS_SHEETS_FALLBACK, true);
assert.equal(BOZEMAN_BETA_PRINCIPLE, "cut_features_not_integrity");
assert.match(roadmapSource, /^import "server-only";/);
assert.doesNotMatch(
  roadmapSource,
  /createServerSupabaseClient|createBrowserClient|\.from\(|\.rpc\(|select\("\*"\)|SUPABASE_SERVICE_ROLE_KEY|createServiceRole|sendEmail|enqueue|fetch\(/i,
  "roadmap artifact must remain documentation/readiness only",
);

const description = describeBozemanBetaRoadmap();
assert.equal(description.target, "bozeman");
assert.equal(description.idealReadinessTarget, "mid_august_2026");
assert.equal(description.productImplementationStarted, false);
assert.equal(description.responseLinkActivationReopened, false);
assert.equal(description.serviceRoleShortcutAllowed, false);
assert.equal(description.mockPersistedMixingAllowed, false);
assert.equal(description.realEmailSendingAvailable, false);
assert.equal(description.productionDataAccessAvailable, false);
assert.equal(description.domainCount, 11);

const launchGateText = JSON.stringify(bozemanBetaLaunchGate);
for (const required of [
  "authorized_project_contact_can_access_correct_bozeman_workspace",
  "trusted_helpers_can_add_or_import_volunteer_profiles",
  "authorized_scheduler_can_create_and_edit_real_calendar_scheduled_items",
  "volunteers_can_be_assigned_to_scheduled_items",
  "draft_private_and_published_live_state_are_correct",
  "assigned_volunteers_can_securely_access_their_own_schedules_without_normal_accounts",
  "volunteers_can_confirm_or_deny_assignments",
  "basic_initial_assignment_notification_email_can_send_reliably",
  "beta_critical_surfaces_use_approved_polished_project_local_visual_direction",
]) {
  assert.match(launchGateText, new RegExp(required));
}

const domainIds = bozemanBetaAuditDomains.map((domain) => domain.id);
assert.deepEqual(domainIds, [
  "workspace_admin_access",
  "volunteer_data_entry_import",
  "tasks",
  "calendar",
  "volunteer_assignment",
  "publication_lifecycle",
  "volunteer_schedule_access",
  "confirm_deny",
  "initial_assignment_email",
  "ui_integration",
  "production_readiness",
]);

for (const domain of bozemanBetaAuditDomains) {
  assert.ok(domain.statuses.length > 0, `${domain.id} must classify current state`);
  assert.ok(domain.repositoryFindings.length > 0, `${domain.id} must cite repository findings`);
  assert.ok(domain.blockers.length > 0, `${domain.id} must list blockers or decisions`);
}

const domainText = JSON.stringify(bozemanBetaAuditDomains);
for (const required of [
  "workspace identity, project contacts, grants, Auth shell",
  "volunteer_profiles table",
  "task_presets persistence",
  "/admin/calendar uses persisted item truth",
  "create/cancel assignment RPCs",
  "assignment_responses persist current",
  "Communications/reminders are mock-only",
  "sample mockup images",
  "Belgrade Sheets/App Script remains the operational fallback",
]) {
  assert.match(domainText, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

const criticalPathIds = bozemanBetaCriticalPath.map((slice) => slice.id);
assert.deepEqual(criticalPathIds, [
  "bozeman_workspace_access_provisioning",
  "manual_volunteer_profile_entry",
  "calendar_write_foundation",
  "calendar_task_preset_selector",
  "assignment_picker_commands",
  "publication_lifecycle",
  "volunteer_schedule_access",
  "confirm_deny_round_trip",
  "initial_assignment_email",
  "beta_ui_and_production_gate",
]);

assert.equal(bozemanBetaOld12_14Decision.decision, "move_and_modify");
assert.match(
  bozemanBetaOld12_14Decision.rationale,
  /not the highest-priority beta unblocker/i,
);
assert.match(
  bozemanBetaOld12_14Decision.immediateNextImplementationSlice,
  /Bozeman Workspace Access/i,
);

const readiness = evaluateBozemanBetaLaunchReadiness();
assert.equal(readiness.allowedToLaunch, false);
for (const blocker of [
  "bozeman_workspace_provisioning_and_project_contact_grants",
  "manual_volunteer_add_edit_or_controlled_import",
  "calendar_create_edit_archive_publication_mutations",
  "secure_account_light_volunteer_schedule_access",
  "basic_initial_assignment_email_delivery_boundary",
  "approved_ui_integration_for_beta_critical_surfaces",
]) {
  assert.ok(readiness.blockers.includes(blocker), `missing blocker ${blocker}`);
}

assert.equal(bozemanBetaRoadmap.implementationAddedInThisSlice, false);
assert.equal(bozemanBetaRoadmap.migrationAddedInThisSlice, false);
assert.equal(bozemanBetaRoadmap.hostedValidationRequiredForThisSlice, false);

assert.match(packageSource, /"test:bozeman-beta-roadmap"/);

const appAndComponentFiles = await listFiles(root, (file) => {
  const relative = path.relative(root, file).replaceAll(path.sep, "/");
  return (
    (relative.startsWith("app/") || relative.startsWith("components/")) &&
    /\.(ts|tsx|js|jsx)$/.test(relative)
  );
});

for (const file of appAndComponentFiles) {
  const source = await readFile(file, "utf8");
  assert.equal(
    source.includes("bozemanBetaRoadmap") ||
      source.includes("describeBozemanBetaRoadmap") ||
      source.includes("BOZEMAN_BETA"),
    false,
    `app/component must not import roadmap artifact: ${path.relative(root, file)}`,
  );
}

assert.doesNotMatch(
  calendarRoute,
  /bozemanBetaRoadmap|BOZEMAN_BETA|@\/lib\/readiness\/bozemanBetaRoadmap/i,
);
assert.match(calendarRoute, /readCalendarRouteState/);
assert.doesNotMatch(
  tasksRoute,
  /bozemanBetaRoadmap|tasks\/readModelContract|readTaskPresets|task_presets|createServerSupabaseClient|\.from\(|\.rpc\(/i,
);
assert.match(tasksRoute, /@\/lib\/mockData/);

for (const doc of [currentState, roadmapDoc, historyDoc, authDoc, betaDoc]) {
  assert.match(doc, /Bozeman/i);
  assert.match(doc, /mid-August 2026/i);
  assert.match(doc, /Belgrade.*Sheets|Sheets.*Belgrade/i);
  assert.match(doc, /Cut features, not integrity/i);
  assert.match(doc, /response-link activation remains paused|Response-link activation remains paused/i);
}

assert.match(betaDoc, /Bozeman Beta launch gate/i);
assert.match(betaDoc, /Ready with items|ready with items/i);
assert.match(betaDoc, /first real Bozeman volunteer record/i);
assert.match(betaDoc, /first real persisted scheduled item/i);
assert.match(betaDoc, /first real Confirm\/Deny round trip/i);
assert.match(betaDoc, /first real assignment notification email/i);
assert.match(betaDoc, /12\.14 Route-Unused Persisted Tasks Read Model Helper \/ Query-Shape Review/i);
assert.match(betaDoc, /moved and modified|move and modify/i);
assert.match(betaDoc, /12\.14 Bozeman Workspace Access and Provisioning Readiness/i);
assert.match(betaDoc, /approved Project Local UI/i);
assert.match(betaDoc, /sample mockup images/i);

assert.match(roadmapDoc, /Bozeman Scheduling Beta Re-baseline/i);
assert.match(roadmapDoc, /12\.14 Bozeman Workspace Access and Provisioning Readiness/i);
assert.match(currentState, /Bozeman Scheduling Beta Roadmap Re-baseline/i);
assert.match(historyDoc, /Bozeman Scheduling Beta Roadmap Re-baseline/i);
assert.match(authDoc, /Bozeman beta re-baseline/i);

console.log(
  "Confirmed Bozeman beta roadmap re-baseline, route-unused artifact, launch gate, blockers, deferrals, and superseded 12.14 sequencing.",
);
