import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  listAuthorizedOperationalWorkspaces,
  parseProjectDayExpectedOnSiteFormValue,
  ProjectDayValidationError,
  selectAuthorizedOperationalWorkspace,
} from "../lib/operations/projectDay.ts";
import { readProjectQuickViewRouteState } from "../lib/operations/projectQuickViewRoute.server.ts";

const root = process.cwd();
const readSource = (...parts) => readFile(path.join(root, ...parts), "utf8");
const [calendarPage, calendarClient, quickViewPage, quickViewClient, quickViewRoute, quickViewServer, adminNav, adminShell] = await Promise.all([
  readSource("app", "admin", "calendar", "page.tsx"),
  readSource("components", "CalendarClient.tsx"),
  readSource("app", "admin", "quick-view", "page.tsx"),
  readSource("components", "ProjectQuickView.tsx"),
  readSource("lib", "operations", "projectQuickViewRoute.server.ts"),
  readSource("lib", "operations", "projectQuickView.server.ts"),
  readSource("components", "AdminNav.tsx"),
  readSource("components", "AdminShell.tsx"),
]);

assert.equal(parseProjectDayExpectedOnSiteFormValue(""), null);
assert.equal(parseProjectDayExpectedOnSiteFormValue("   "), null);
assert.equal(parseProjectDayExpectedOnSiteFormValue("0"), 0);
assert.equal(parseProjectDayExpectedOnSiteFormValue("47"), 47);
for (const invalid of ["-1", "1.5", "4 people", "1e2", "00", null, undefined]) {
  assert.throws(
    () => parseProjectDayExpectedOnSiteFormValue(invalid),
    ProjectDayValidationError,
    `Expected ${String(invalid)} to fail humane Project Day form validation.`,
  );
}

const projectContactId = "20000000-0000-4000-8000-000000000001";
const workspace = (id, key, displayName) => ({
  id,
  key,
  displayName,
  lifecycle: "active",
  timezone: "America/Denver",
  startsOn: null,
  endsOn: null,
  publicIntakeEnabled: false,
  createdAt: "2026-08-31T00:00:00Z",
  updatedAt: "2026-08-31T00:00:00Z",
});
const bozeman = workspace("10000000-0000-4000-8000-000000000001", "bozeman-local", "Bozeman Local");
const helena = workspace("10000000-0000-4000-8000-000000000002", "helena-build", "Helena Build");
const secret = workspace("10000000-0000-4000-8000-000000000003", "secret-project", "Secret Project");
const grant = (id, target, capabilities) => ({
  id,
  workspaceId: target.id,
  projectContactId,
  role: "main_contact",
  capabilities,
  status: "active",
  validFrom: "2026-01-01T00:00:00Z",
  validUntil: null,
  revokedAt: null,
});
const ownGrants = [
  grant("30000000-0000-4000-8000-000000000001", bozeman, ["workspace.read", "calendar.view", "calendar.edit"]),
  grant("30000000-0000-4000-8000-000000000002", helena, ["workspace.read", "calendar.view"]),
  grant("30000000-0000-4000-8000-000000000003", secret, ["workspace.read"]),
];
const context = {
  supabase: {},
  authenticatedUserId: "40000000-0000-4000-8000-000000000001",
  projectContactId,
  ownGrants,
  workspaces: [secret, helena, bozeman],
};

assert.deepEqual(
  listAuthorizedOperationalWorkspaces({
    projectContactId,
    ownGrants,
    workspaces: context.workspaces,
    requiredCapability: "calendar.view",
    at: new Date("2026-09-01T12:00:00Z"),
  }).map(({ workspace: item }) => item.displayName),
  ["Bozeman Local", "Helena Build"],
);
assert.equal(
  selectAuthorizedOperationalWorkspace({
    projectContactId,
    ownGrants,
    workspaces: context.workspaces,
    requiredCapability: "calendar.view",
    workspaceKey: "secret-project",
    at: new Date("2026-09-01T12:00:00Z"),
  }),
  null,
  "A browser-selected project key must match the server-authorized workspace set.",
);
assert.equal(
  selectAuthorizedOperationalWorkspace({
    projectContactId,
    ownGrants,
    workspaces: context.workspaces,
    requiredCapability: "calendar.edit",
    workspaceKey: "helena-build",
    at: new Date("2026-09-01T12:00:00Z"),
  }),
  null,
  "Missing capability must deny the selected workspace.",
);

const readProjection = async (_context, date, key) => ({
  projectDisplayName: key === "helena-build" ? "Helena Build" : "Bozeman Local",
  date,
  expectedOnSiteCount: key === "helena-build" ? 0 : 47,
  publishedSchedule: [{
    title: "General setup",
    category: "general",
    schedule: { kind: "timed", startTime: "07:30:00", endTime: "17:00:00" },
    plannedStaffingCount: 3,
  }],
});
const ready = await readProjectQuickViewRouteState(
  { project: "helena-build", date: "2026-09-02" },
  {
    resolveContext: async () => ({ kind: "ready", context }),
    readProjection,
    now: new Date("2026-09-01T12:00:00Z"),
  },
);
assert.equal(ready.kind, "ready");
assert.deepEqual(ready.projects, [
  { key: "bozeman-local", displayName: "Bozeman Local" },
  { key: "helena-build", displayName: "Helena Build" },
]);
assert.equal(ready.selectedProjectKey, "helena-build");
assert.equal(ready.projection.expectedOnSiteCount, 0);

const guessed = await readProjectQuickViewRouteState(
  { project: "secret-project", date: "2026-09-01" },
  {
    resolveContext: async () => ({ kind: "ready", context }),
    readProjection,
    now: new Date("2026-09-01T12:00:00Z"),
  },
);
assert.equal(guessed.kind, "unavailable");
assert.equal(guessed.reason, "project_unavailable");
assert.equal(guessed.projects.some(({ displayName }) => displayName === "Secret Project"), false);

const anonymous = await readProjectQuickViewRouteState(undefined, {
  resolveContext: async () => ({ kind: "unauthenticated" }),
  readProjection,
  now: new Date("2026-09-01T12:00:00Z"),
});
assert.equal(anonymous.kind, "unavailable");
assert.deepEqual(anonymous.projects, []);

assert.match(calendarPage, /readVerifiedAdminContext\(\)/);
assert.match(calendarPage, /setProjectDayExpectedOnSiteWithVerifiedContext/);
assert.match(calendarPage, /revalidatePath\("\/admin\/calendar"\)/);
assert.match(calendarPage, /revalidatePath\("\/admin\/quick-view"\)/);
assert.doesNotMatch(calendarPage, /formData\.get\(["']workspace/i);
assert.match(calendarClient, /Expected on site/);
assert.match(calendarClient, /Leave blank to clear it/);
assert.match(calendarClient, /MobileOverlaySheet/);
assert.match(calendarClient, /buildCalendarProjectDayHref/);
assert.match(quickViewPage, /readProjectQuickViewRouteState/);
assert.doesNotMatch(quickViewPage, /mockData|\.from\(/);
assert.match(quickViewClient, /toLocaleLowerCase\(\)\.includes/);
assert.match(quickViewClient, /Previous day/);
assert.match(quickViewClient, /Next day/);
assert.match(quickViewClient, /Not set/);
assert.match(quickViewRoute, /listAuthorizedOperationalWorkspaces/);
assert.match(quickViewRoute, /selectedProject\.key/);
assert.doesNotMatch(quickViewRoute, /service_role|SUPABASE_SERVICE_ROLE_KEY/i);
assert.deepEqual([...quickViewServer.matchAll(/\.from\("([^"]+)"\)/g)].map((match) => match[1]), ["project_days", "calendar_items"]);
assert.doesNotMatch(quickViewServer, /volunteer_profiles|calendar_assignments|assignment_responses|questionnaire|token|delivery/i);
assert.match(quickViewServer, /\.neq\("task_type_snapshot", "security"\)/);
assert.match(adminNav, /Quick View/);
assert.match(adminShell, /Project Quick View/);

for (const forbidden of [
  "volunteerEmail",
  "volunteerPhone",
  "profileNotes",
  "questionnaireAnswers",
  "assignmentId",
  "responseToken",
  "deliveryState",
]) {
  assert.equal(`${quickViewPage}${quickViewClient}`.includes(forbidden), false, `Quick View UI included forbidden ${forbidden}.`);
}

console.log("Project Day admin entry and authorized Quick View contract checks passed.");
console.log("Project selection, Project Day validation, safe projection use, and redaction remain fail-closed.");
