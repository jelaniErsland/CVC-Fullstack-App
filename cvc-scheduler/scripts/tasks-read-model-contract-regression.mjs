import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  TASKS_ASSIGNMENT_COVERAGE_DECORATION_AVAILABLE,
  TASKS_CALENDAR_OCCURRENCE_DECORATION_AVAILABLE,
  TASKS_PERSISTED_READ_MODEL_CONTRACT_AVAILABLE,
  TASKS_PERSISTED_READ_MODEL_IMPLEMENTATION_AVAILABLE,
  TASKS_ROUTE_MOCK_TO_REAL_MIXING_ALLOWED,
  TASKS_ROUTE_PERSISTED_READ_CUTOVER_AVAILABLE,
  TASKS_ROUTE_PERSISTED_WRITE_AVAILABLE,
  TASKS_SEED_DATA_AVAILABLE,
  TASKS_SERVICE_ROLE_READ_AVAILABLE,
  describePersistedTasksReadModelContract,
  evaluatePersistedTasksReadModelReadiness,
  persistedTasksReadModelContract,
} from "../lib/tasks/readModelContract.server.ts";
import {
  describeTaskManagementCutover,
  selectTaskManagementWorkspaceContext,
} from "../lib/tasks/routeRead.server.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (...parts) => readFile(path.join(root, ...parts), "utf8");
const [
  contractSource,
  routeSource,
  routeReadSource,
  componentSource,
  serverSource,
  calendarSelectorSource,
  packageSource,
  currentStateSource,
  roadmapSource,
  historySource,
  authReadinessSource,
] = await Promise.all([
  read("lib", "tasks", "readModelContract.server.ts"),
  read("app", "admin", "tasks", "page.tsx"),
  read("lib", "tasks", "routeRead.server.ts"),
  read("components", "TaskPresetManagement.tsx"),
  read("lib", "tasks", "server.ts"),
  read("lib", "calendar", "taskPresetSelector.server.ts"),
  read("package.json"),
  read("docs", "CURRENT_STATE.md"),
  read("docs", "ROADMAP.md"),
  read("docs", "PROJECT_HISTORY.md"),
  read("docs", "SUPABASE_AUTH_PERSISTENCE_READINESS.md"),
]);

assert.equal(TASKS_PERSISTED_READ_MODEL_CONTRACT_AVAILABLE, true);
assert.equal(TASKS_PERSISTED_READ_MODEL_IMPLEMENTATION_AVAILABLE, true);
assert.equal(TASKS_ROUTE_PERSISTED_READ_CUTOVER_AVAILABLE, true);
assert.equal(TASKS_ROUTE_PERSISTED_WRITE_AVAILABLE, true);
assert.equal(TASKS_ROUTE_MOCK_TO_REAL_MIXING_ALLOWED, false);
assert.equal(TASKS_CALENDAR_OCCURRENCE_DECORATION_AVAILABLE, false);
assert.equal(TASKS_ASSIGNMENT_COVERAGE_DECORATION_AVAILABLE, false);
assert.equal(TASKS_SERVICE_ROLE_READ_AVAILABLE, false);
assert.equal(TASKS_SEED_DATA_AVAILABLE, false);

const description = describePersistedTasksReadModelContract();
assert.equal(description.implementationAvailable, true);
assert.equal(description.routeCutoverAvailable, true);
assert.equal(description.persistedWriteAvailable, true);
assert.equal(description.requiredCapability, "tasks.view");
assert.deepEqual(description.routeStates, [
  "ready_with_presets",
  "ready_empty",
  "unavailable",
  "error",
]);

const readiness = evaluatePersistedTasksReadModelReadiness();
assert.equal(readiness.allowedForAdminTasksCutover, true);
assert.deepEqual(readiness.blockers, []);
assert.equal(readiness.recommendedNextImplementationSlice.id, "12.38");

assert.equal(persistedTasksReadModelContract.milestone, "12.37");
assert.equal(persistedTasksReadModelContract.routeUnused, false);
assert.equal(persistedTasksReadModelContract.currentRouteCutover, true);
assert.equal(persistedTasksReadModelContract.currentRouteTruthSource, "persisted_task_presets_only");
assert.equal(persistedTasksReadModelContract.requiredCapability, "tasks.view");
assert.equal(persistedTasksReadModelContract.authContext.browserProvidedWorkspaceIdTrusted, false);
assert.equal(persistedTasksReadModelContract.authContext.browserProvidedContactIdTrusted, false);
assert.equal(persistedTasksReadModelContract.authContext.browserProvidedCapabilityArrayTrusted, false);
assert.equal(persistedTasksReadModelContract.authContext.roleOrTitleStringsAuthorizeReads, false);
assert.equal(persistedTasksReadModelContract.stateContract.mockFallbackAllowed, false);
assert.equal(persistedTasksReadModelContract.searchFilterSort.clientQueryIntegrationImplemented, true);
assert.deepEqual(persistedTasksReadModelContract.searchFilterSort.stableDefaultSort, [
  "active_before_archived",
  "name",
  "id",
]);
assert.equal(
  persistedTasksReadModelContract.calendarSeparation.calendarTablesMustNotBeQueriedForTasksLibraryDecoration,
  true,
);
assert.equal(
  persistedTasksReadModelContract.calendarSeparation.currentCoverageOrUpcomingOccurrenceAggregatesAllowed,
  false,
);

for (const forbidden of [
  "scheduled_date",
  "start_time",
  "end_time",
  "assigned_volunteers",
  "assignment_responses",
  "times_scheduled",
]) {
  assert.ok(persistedTasksReadModelContract.calendarSeparation.taskPresetFieldsMustNotInclude.includes(forbidden));
}

const cutover = describeTaskManagementCutover();
assert.equal(cutover.routeCutoverImplemented, true);
assert.equal(cutover.persistedTruthSource, true);
assert.equal(cutover.mockFallbackAllowed, false);
assert.equal(cutover.serviceRoleAvailable, false);
assert.equal(cutover.createAvailable, true);
assert.equal(cutover.archiveAvailable, true);
assert.equal(cutover.generalEditAvailable, false);
assert.equal(cutover.browserScopeInputTrusted, false);
assert.equal(cutover.readCapability, "tasks.view");
assert.equal(cutover.editCapability, "tasks.edit");
assert.deepEqual(cutover.routeProjection, [
  "id",
  "name",
  "description",
  "taskType",
  "defaultNeededCount",
  "volunteerVisible",
  "isSystemPreset",
  "customFields",
  "lifecycle",
]);

const workspace = (id, lifecycle = "active") => ({
  id,
  key: `workspace-${id.slice(-4)}`,
  displayName: `Workspace ${id.slice(-4)}`,
  lifecycle,
  timezone: "America/Denver",
  startsOn: null,
  endsOn: null,
  publicIntakeEnabled: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});
const grant = ({
  id,
  workspaceId,
  projectContactId = "contact-a",
  capabilities,
  role = "assistant_contact",
  status = "active",
  validUntil = null,
  revokedAt = null,
}) => ({
  id,
  workspaceId,
  projectContactId,
  role,
  capabilities,
  status,
  validFrom: "2026-01-01T00:00:00.000Z",
  validUntil,
  revokedAt,
});
const workspaceA = workspace("550e8400-e29b-41d4-a716-446655440010");
const workspaceB = workspace("550e8400-e29b-41d4-a716-446655440020");
const editable = grant({
  id: "grant-editable",
  workspaceId: workspaceA.id,
  capabilities: ["workspace.read", "tasks.view", "tasks.edit"],
});
const selected = selectTaskManagementWorkspaceContext({
  projectContactId: "contact-a",
  ownGrants: [editable],
  workspaces: [workspaceA],
});
assert.equal(selected.ok, true);
assert.equal(selected.canEdit, true);
assert.equal(selected.workspace.id, workspaceA.id);
const viewOnly = selectTaskManagementWorkspaceContext({
  projectContactId: "contact-a",
  ownGrants: [
    grant({
      id: "grant-view",
      workspaceId: workspaceA.id,
      capabilities: ["workspace.read", "tasks.view"],
    }),
  ],
  workspaces: [workspaceA],
});
assert.equal(viewOnly.ok, true);
assert.equal(viewOnly.canEdit, false);
const roleOnly = selectTaskManagementWorkspaceContext({
  projectContactId: "contact-a",
  ownGrants: [
    grant({
      id: "grant-role-only",
      workspaceId: workspaceA.id,
      capabilities: ["workspace.read"],
      role: "main_contact",
    }),
  ],
  workspaces: [workspaceA],
});
assert.deepEqual(roleOnly, { ok: false, reason: "missing_tasks_view" });
const ambiguous = selectTaskManagementWorkspaceContext({
  projectContactId: "contact-a",
  ownGrants: [
    editable,
    grant({
      id: "grant-b",
      workspaceId: workspaceB.id,
      capabilities: ["workspace.read", "tasks.view"],
    }),
  ],
  workspaces: [workspaceA, workspaceB],
});
assert.deepEqual(ambiguous, { ok: false, reason: "workspace_unavailable" });
for (const deniedGrant of [
  grant({
    id: "grant-revoked",
    workspaceId: workspaceA.id,
    capabilities: ["workspace.read", "tasks.view"],
    status: "revoked",
    revokedAt: "2026-02-01T00:00:00.000Z",
  }),
  grant({
    id: "grant-expired",
    workspaceId: workspaceA.id,
    capabilities: ["workspace.read", "tasks.view"],
    validUntil: "2026-02-01T00:00:00.000Z",
  }),
]) {
  const denied = selectTaskManagementWorkspaceContext({
    projectContactId: "contact-a",
    ownGrants: [deniedGrant],
    workspaces: [workspaceA],
  });
  assert.equal(denied.ok, false);
}

assert.match(packageSource, /"test:tasks-management"/);
assert.match(routeSource, /dynamic = "force-dynamic"/);
assert.match(routeSource, /fetchCache = "force-no-store"/);
assert.match(routeSource, /readTaskManagementRouteState/);
assert.match(routeSource, /readTaskManagementRouteContext/);
assert.match(routeSource, /createTaskPresetWithClient/);
assert.match(routeSource, /archiveTaskPresetWithClient/);
assert.match(routeSource, /revalidatePath\("\/admin\/tasks"\)/);
assert.match(routeSource, /revalidatePath\("\/admin\/calendar"\)/);
assert.doesNotMatch(routeSource, /mockData|service.?role|\.from\(|\.rpc\(/i);
assert.doesNotMatch(componentSource, /workspaceId|projectContactId|capabilities|systemKey/);
assert.match(componentSource, /Search tasks/);
assert.match(componentSource, /Active tasks/);
assert.match(componentSource, /Archive this task\?/);
assert.match(componentSource, /Existing scheduled items won’t be changed/);
assert.doesNotMatch(componentSource, /Edit task|Duplicate task|times scheduled|fill rate/i);
assert.match(routeReadSource, /^import "server-only";/);
assert.match(routeReadSource, /tasks\.view/);
assert.match(routeReadSource, /tasks\.edit/);
assert.match(routeReadSource, /eligible\.length === 1/);
assert.match(routeReadSource, /readTaskPresetsWithClient/);
assert.doesNotMatch(
  routeReadSource,
  /select\("\*"\)|SUPABASE_SERVICE_ROLE_KEY|createServiceRole|calendar_items|calendar_assignments/i,
);
assert.match(serverSource, /\.from\("task_presets"\)/);
assert.match(serverSource, /\.select\(taskPresetColumns\)/);
assert.doesNotMatch(serverSource, /select\("\*"\)|SUPABASE_SERVICE_ROLE_KEY|createServiceRole/i);
assert.deepEqual(
  [...serverSource.matchAll(/\.rpc\(\s*"([^"]+)"/g)].map((match) => match[1]),
  ["create_task_preset", "archive_task_preset"],
);
assert.match(calendarSelectorSource, /\.eq\("lifecycle", "active"\)/);
assert.equal(contractSource.includes("mock_prototype_until_separate_cutover"), false);

for (const doc of [currentStateSource, roadmapSource, historySource, authReadinessSource]) {
  assert.match(doc, /12\.37/);
  assert.match(doc, /\/admin\/tasks/);
  assert.match(doc, /persisted/i);
  assert.match(doc, /tasks\.view/);
  assert.match(doc, /tasks\.edit/);
}

console.log("Persisted Tasks read-model and route-cutover contract checks passed.");
console.log("Confirmed deterministic tasks.view scope, real create/archive, minimal projection, no mock fallback, and no general edit.");
