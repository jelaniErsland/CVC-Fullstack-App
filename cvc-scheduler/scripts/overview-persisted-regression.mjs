import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  OVERVIEW_RANGE_DAYS,
  buildOverviewQuickActions,
  dateInWorkspaceTimezone,
  describeOverviewCutover,
  selectOverviewWorkspaceContext,
  summarizeOverviewCalendar,
  summarizeOverviewTasks,
  summarizeOverviewVolunteers,
} from "../lib/overview/routeRead.server.ts";

const root = process.cwd();
const at = new Date("2026-08-17T18:00:00.000Z");
const workspace = {
  id: "11111111-1111-4111-8111-111111111111",
  key: "overview-target",
  displayName: "Overview Target",
  lifecycle: "active",
  timezone: "America/Denver",
  startsOn: "2026-08-01",
  endsOn: "2026-12-31",
  publicIntakeEnabled: false,
  createdAt: "2026-08-01T00:00:00Z",
  updatedAt: "2026-08-01T00:00:00Z",
};
const otherWorkspace = {
  ...workspace,
  id: "22222222-2222-4222-8222-222222222222",
  key: "overview-other",
  displayName: "Overview Other",
};
const projectContactId = "33333333-3333-4333-8333-333333333333";

function grant(overrides = {}) {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    workspaceId: workspace.id,
    projectContactId,
    role: "main_contact",
    capabilities: [
      "workspace.read",
      "calendar.view",
      "calendar.edit",
      "assignments.view",
      "tasks.view",
      "tasks.edit",
      "volunteers.view",
      "volunteers.edit",
    ],
    status: "active",
    validFrom: "2026-01-01T00:00:00Z",
    validUntil: null,
    revokedAt: null,
    ...overrides,
  };
}

function coverage(overrides = {}) {
  return {
    assignedCount: 1,
    confirmedCount: 1,
    deniedCount: 0,
    unassignedCount: 0,
    waitingOnConfirmationCount: 0,
    hasDenied: false,
    allAssignedHelpersDenied: false,
    coverageState: "confirmed",
    assignedFractionLabel: "1/1",
    aggregateVolunteerCountOnMultiDayWindowAllowed: false,
    ...overrides,
  };
}

function item(id, title, startDate, overrides = {}) {
  return {
    calendarItemId: id,
    stableDisplayReference: id,
    taskSourceLabel: title,
    displayType: "general",
    scheduleKind: "timed",
    startDate,
    endDate: null,
    startTime: "09:00:00",
    endTime: "11:00:00",
    timezone: "America/Denver",
    neededCount: 1,
    lifecycle: "active",
    publicationState: "published",
    isOwnDraft: false,
    publishedAt: "2026-08-01T00:00:00Z",
    scheduleNotes: null,
    taskPresetId: null,
    oneOffTaskLabel: title,
    oneOffTaskType: "general",
    taskPresetLabel: null,
    taskPresetType: null,
    coverage: coverage(),
    assignedFractionLabel: "1/1",
    ...overrides,
  };
}

const selected = selectOverviewWorkspaceContext({
  projectContactId,
  ownGrants: [grant()],
  workspaces: [workspace, otherWorkspace],
  at,
});
assert(selected.ok);
assert.equal(selected.workspace.id, workspace.id);
assert(selected.capabilities.includes("tasks.view"));

for (const deniedGrant of [
  grant({ status: "revoked", revokedAt: "2026-08-01T00:00:00Z" }),
  grant({ validUntil: "2026-08-16T00:00:00Z" }),
  grant({ status: "inactive" }),
  grant({ capabilities: ["calendar.view", "tasks.view"] }),
]) {
  assert.equal(
    selectOverviewWorkspaceContext({
      projectContactId,
      ownGrants: [deniedGrant],
      workspaces: [workspace],
      at,
    }).ok,
    false,
  );
}
assert.equal(
  selectOverviewWorkspaceContext({
    projectContactId,
    ownGrants: [grant()],
    workspaces: [{ ...workspace, lifecycle: "archived" }],
    at,
  }).ok,
  false,
);
assert.equal(
  selectOverviewWorkspaceContext({
    projectContactId,
    ownGrants: [
      grant(),
      grant({
        id: "55555555-5555-4555-8555-555555555555",
        workspaceId: otherWorkspace.id,
      }),
    ],
    workspaces: [workspace, otherWorkspace],
    at,
  }).ok,
  false,
  "Browser-unspecified multi-workspace scope must fail closed.",
);

const roleOnly = selectOverviewWorkspaceContext({
  projectContactId,
  ownGrants: [grant({ role: "main_contact", capabilities: ["workspace.read"] })],
  workspaces: [workspace],
  at,
});
assert(roleOnly.ok);
assert.deepEqual(buildOverviewQuickActions(roleOnly.capabilities, "2026-08-17"), []);

const actions = buildOverviewQuickActions(selected.capabilities, "2026-08-17");
assert.deepEqual(actions.map((action) => action.kind), ["calendar", "tasks", "volunteers"]);
assert.equal(actions[0].label, "Schedule work");
assert.equal(actions[1].label, "New task");
assert.equal(actions[2].label, "Add volunteer");
assert.deepEqual(
  buildOverviewQuickActions(["workspace.read", "tasks.view"], "2026-08-17").map(
    (action) => action.kind,
  ),
  ["tasks"],
);
assert.deepEqual(
  buildOverviewQuickActions(["workspace.read", "calendar.view"], "2026-08-17"),
  [],
  "Calendar-derived Overview content must preserve the stricter assignment coverage boundary.",
);

const summary = summarizeOverviewCalendar(
  [
    item("00000000-0000-4000-8000-000000000008", "Outside", "2026-08-24"),
    item("00000000-0000-4000-8000-000000000003", "Waiting crew", "2026-08-19", {
      coverage: coverage({
        confirmedCount: 0,
        waitingOnConfirmationCount: 1,
        coverageState: "waiting",
      }),
    }),
    item("00000000-0000-4000-8000-000000000002", "Unfilled crew", "2026-08-18", {
      neededCount: 3,
      coverage: coverage({ unassignedCount: 2, coverageState: "unfilled", assignedFractionLabel: "1/3" }),
      assignedFractionLabel: "1/3",
    }),
    item("00000000-0000-4000-8000-000000000001", "Gate team", "2026-08-17"),
    item("00000000-0000-4000-8000-000000000004", "Denied crew", "2026-08-20", {
      coverage: coverage({
        confirmedCount: 0,
        deniedCount: 1,
        hasDenied: true,
        allAssignedHelpersDenied: true,
        coverageState: "all_denied",
      }),
    }),
    item("00000000-0000-4000-8000-000000000005", "Archived", "2026-08-21", { lifecycle: "archived" }),
  ],
  "2026-08-17",
  "2026-08-24",
);
assert.equal(OVERVIEW_RANGE_DAYS, 7);
assert.deepEqual(summary.upcomingItems.map((row) => row.title), [
  "Gate team",
  "Unfilled crew",
  "Waiting crew",
  "Denied crew",
]);
assert.equal(summary.scheduledCount, 4);
assert.equal(summary.pendingResponseCount, 1);
assert.deepEqual(summary.reviewSignals.map((signal) => signal.kind), [
  "denied",
  "unfilled",
  "waiting",
]);
assert(summary.reviewSignals.every((signal) => signal.href.startsWith("/admin/calendar?view=day&date=")));
assert.equal(summarizeOverviewTasks([{ lifecycle: "active" }, { lifecycle: "archived" }]).activeCount, 1);
assert.equal(
  summarizeOverviewVolunteers([
    { lifecycle: "active", readinessStatus: "ready" },
    { lifecycle: "active", readinessStatus: "on_hold" },
    { lifecycle: "inactive", readinessStatus: "ready" },
  ]).readyActiveCount,
  1,
);
assert.equal(dateInWorkspaceTimezone(new Date("2026-08-18T05:30:00Z"), "America/Denver"), "2026-08-17");

const [pageSource, routeSource, packageSource] = await Promise.all([
  readFile(path.join(root, "app", "admin", "dashboard", "page.tsx"), "utf8"),
  readFile(path.join(root, "lib", "overview", "routeRead.server.ts"), "utf8"),
  readFile(path.join(root, "package.json"), "utf8"),
]);
assert.match(pageSource, /export const dynamic = "force-dynamic"/);
assert.match(pageSource, /fetchCache = "force-no-store"/);
assert.match(pageSource, /readOverviewRouteState/);
assert.match(routeSource, /readVerifiedAdminContext/);
assert.doesNotMatch(routeSource, /auth\.getUser\(\)|loadProjectContactGrantsWithClient|readAuthenticatedProjectContactIdWithClient/);
assert.match(routeSource, /readCalendarReadModelWithClient/);
assert.match(routeSource, /readTaskPresetsWithClient/);
assert.match(routeSource, /readVolunteerProfilesWithClient/);
assert.doesNotMatch(`${pageSource}\n${routeSource}`, /mockData|mock Calendar|mock Needs Attention/i);
assert.doesNotMatch(`${pageSource}\n${routeSource}`, /SUPABASE_SERVICE_ROLE_KEY|createServiceRole/i);
assert.doesNotMatch(routeSource, /\.insert\(|\.update\(|\.delete\(|\.upsert\(|\.rpc\(/i);
assert.doesNotMatch(pageSource, /needs-attention|questionnaire|recent communication|sent count/i);
assert.doesNotMatch(pageSource, /capabilities|workspaceId|projectContactId|auth_user/i);
assert.match(packageSource, /"test:overview"/);

const contract = describeOverviewCutover();
assert.equal(contract.persistedCutoverImplemented, true);
assert.equal(contract.mockFallbackAllowed, false);
assert.equal(contract.serviceRoleAvailable, false);
assert.equal(contract.browserScopeInputTrusted, false);
assert.equal(contract.getMutationAvailable, false);
assert.equal(contract.upcomingLimit, 6);
assert.equal(contract.reviewSignalLimit, 5);

console.log("Overview persisted route contract validation passed.");
console.log("Confirmed deterministic workspace scope, capability-aware composition, bounded Calendar summaries, safe derived review signals, and zero mock fallback.");
