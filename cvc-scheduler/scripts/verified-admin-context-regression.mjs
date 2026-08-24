import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  VERIFIED_ADMIN_CONTEXT_CALL_GRAPH,
  resolveVerifiedAdminContextWithClient,
} from "../lib/auth/verified-admin-context.server.ts";
import { isEffectiveWorkspaceReadGrant } from "../lib/auth/grant.ts";
import { selectCalendarRouteWorkspaceContext } from "../lib/calendar/routeRead.server.ts";
import { selectNeedsAttentionWorkspaceContext } from "../lib/needsAttention/routeRead.server.ts";
import { selectOverviewWorkspaceContext } from "../lib/overview/routeRead.server.ts";
import { selectTaskManagementWorkspaceContext } from "../lib/tasks/routeRead.server.ts";
import { selectVolunteerManagementWorkspaceContext } from "../lib/volunteers/routeRead.server.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (...parts) => readFile(path.join(root, ...parts), "utf8");

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
const fullGrant = grant({
  id: "grant-full",
  workspaceId: workspaceA.id,
  capabilities: [
    "workspace.read",
    "calendar.view",
    "assignments.view",
    "calendar.edit",
    "assignments.edit",
    "tasks.view",
    "tasks.edit",
    "volunteers.view",
    "volunteers.edit",
  ],
});

const client = Object.freeze({ marker: "request-client" });
const calls = { auth: 0, grants: 0, contact: 0, workspaces: 0 };
const starts = [];
let releaseContextReads;
const contextReadsReleased = new Promise((resolve) => {
  releaseContextReads = resolve;
});
const dependencies = {
  async readVerifiedUser(receivedClient) {
    calls.auth += 1;
    assert.equal(receivedClient, client);
    return { user: { id: "auth-user-a" }, error: null };
  },
  async loadVerifiedGrants(receivedClient) {
    calls.grants += 1;
    starts.push("grants");
    assert.equal(receivedClient, client);
    await contextReadsReleased;
    return { status: "authorized", grants: [fullGrant], reason: "authorized" };
  },
  async readVerifiedProjectContactId(receivedClient, authenticatedUserId) {
    calls.contact += 1;
    starts.push("contact");
    assert.equal(receivedClient, client);
    assert.equal(authenticatedUserId, "auth-user-a");
    await contextReadsReleased;
    return "contact-a";
  },
  async readGrantedWorkspaces(receivedClient) {
    calls.workspaces += 1;
    starts.push("workspaces");
    assert.equal(receivedClient, client);
    await contextReadsReleased;
    return [workspaceA];
  },
};

const readyPromise = resolveVerifiedAdminContextWithClient(client, dependencies);
await new Promise((resolve) => setImmediate(resolve));
assert.deepEqual(starts.sort(), ["contact", "grants", "workspaces"]);
releaseContextReads();
const ready = await readyPromise;
assert.equal(ready.kind, "ready");
assert.equal(ready.context.supabase, client);
assert.equal(ready.context.authenticatedUserId, "auth-user-a");
assert.equal(ready.context.projectContactId, "contact-a");
assert.deepEqual(ready.context.ownGrants, [fullGrant]);
assert.deepEqual(calls, { auth: 1, grants: 1, contact: 1, workspaces: 1 });

const noLowerReads = { grants: 0, contact: 0, workspaces: 0 };
const unauthenticated = await resolveVerifiedAdminContextWithClient(client, {
  async readVerifiedUser() {
    return { user: null, error: null };
  },
  async loadVerifiedGrants() {
    noLowerReads.grants += 1;
    throw new Error("must not run");
  },
  async readVerifiedProjectContactId() {
    noLowerReads.contact += 1;
    throw new Error("must not run");
  },
  async readGrantedWorkspaces() {
    noLowerReads.workspaces += 1;
    throw new Error("must not run");
  },
});
assert.deepEqual(unauthenticated, { kind: "unauthenticated" });
assert.deepEqual(noLowerReads, { grants: 0, contact: 0, workspaces: 0 });

async function deniedContext({ grantState, contactId = "contact-a", grants = [] }) {
  return resolveVerifiedAdminContextWithClient(client, {
    async readVerifiedUser() {
      return { user: { id: "auth-user-a" }, error: null };
    },
    async loadVerifiedGrants() {
      return grantState ?? { status: "authorized", grants, reason: "test" };
    },
    async readVerifiedProjectContactId() {
      return contactId;
    },
    async readGrantedWorkspaces() {
      return [workspaceA];
    },
  });
}

assert.deepEqual(await deniedContext({ contactId: null, grants: [fullGrant] }), {
  kind: "unauthorized",
});
for (const status of ["no_active_grants", "unavailable"]) {
  assert.deepEqual(
    await deniedContext({ grantState: { status, grants: [], reason: status } }),
    { kind: "unauthorized" },
  );
}
for (const deniedGrant of [
  grant({
    id: "revoked",
    workspaceId: workspaceA.id,
    capabilities: fullGrant.capabilities,
    status: "revoked",
    revokedAt: "2026-08-01T00:00:00.000Z",
  }),
  grant({
    id: "inactive",
    workspaceId: workspaceA.id,
    capabilities: fullGrant.capabilities,
    status: "inactive",
  }),
  grant({
    id: "expired",
    workspaceId: workspaceA.id,
    capabilities: fullGrant.capabilities,
    validUntil: "2026-08-01T00:00:00.000Z",
  }),
]) {
  assert.equal(isEffectiveWorkspaceReadGrant(deniedGrant, new Date("2026-08-24T00:00:00.000Z")), false);
}
assert.deepEqual(
  await deniedContext({
    grants: [
      grant({
        id: "grant-other-contact",
        workspaceId: workspaceA.id,
        projectContactId: "contact-b",
        capabilities: fullGrant.capabilities,
      }),
    ],
  }),
  { kind: "unauthorized" },
);

const selectorInput = {
  projectContactId: "contact-a",
  ownGrants: [fullGrant],
  workspaces: [workspaceA],
};
assert.equal(selectOverviewWorkspaceContext(selectorInput).ok, true);
assert.equal(selectTaskManagementWorkspaceContext(selectorInput).ok, true);
assert.equal(selectVolunteerManagementWorkspaceContext(selectorInput).ok, true);
assert.equal(selectNeedsAttentionWorkspaceContext(selectorInput).ok, true);
assert.equal(selectCalendarRouteWorkspaceContext(selectorInput).ok, true);

const inactiveWorkspaceInput = { ...selectorInput, workspaces: [workspace(workspaceA.id, "inactive")] };
for (const select of [
  selectOverviewWorkspaceContext,
  selectTaskManagementWorkspaceContext,
  selectVolunteerManagementWorkspaceContext,
  selectNeedsAttentionWorkspaceContext,
  selectCalendarRouteWorkspaceContext,
]) {
  assert.equal(select(inactiveWorkspaceInput).ok, false);
}

const missingWorkspaceRead = grant({
  id: "missing-workspace-read",
  workspaceId: workspaceA.id,
  capabilities: fullGrant.capabilities.filter((capability) => capability !== "workspace.read"),
});
assert.equal(
  selectOverviewWorkspaceContext({ ...selectorInput, ownGrants: [missingWorkspaceRead] }).ok,
  false,
);

const roleOnly = grant({
  id: "role-only",
  workspaceId: workspaceA.id,
  role: "main_contact",
  capabilities: ["workspace.read"],
});
assert.equal(selectTaskManagementWorkspaceContext({ ...selectorInput, ownGrants: [roleOnly] }).ok, false);
assert.equal(selectVolunteerManagementWorkspaceContext({ ...selectorInput, ownGrants: [roleOnly] }).ok, false);
assert.equal(selectNeedsAttentionWorkspaceContext({ ...selectorInput, ownGrants: [roleOnly] }).ok, false);
assert.equal(selectCalendarRouteWorkspaceContext({ ...selectorInput, ownGrants: [roleOnly] }).ok, false);

const viewOnly = grant({
  id: "view-only",
  workspaceId: workspaceA.id,
  capabilities: [
    "workspace.read",
    "calendar.view",
    "assignments.view",
    "tasks.view",
    "volunteers.view",
  ],
});
assert.equal(selectTaskManagementWorkspaceContext({ ...selectorInput, ownGrants: [viewOnly] }).canEdit, false);
assert.equal(selectVolunteerManagementWorkspaceContext({ ...selectorInput, ownGrants: [viewOnly] }).canEdit, false);
const calendarViewOnly = selectCalendarRouteWorkspaceContext({ ...selectorInput, ownGrants: [viewOnly] });
assert.equal(calendarViewOnly.ok, true);
assert.equal(calendarViewOnly.canEdit, false);
assert.equal(calendarViewOnly.canEditAssignments, false);

const wrongWorkspaceGrant = grant({
  id: "wrong-workspace",
  workspaceId: workspaceB.id,
  capabilities: fullGrant.capabilities,
});
assert.equal(
  selectOverviewWorkspaceContext({ ...selectorInput, ownGrants: [wrongWorkspaceGrant] }).ok,
  false,
);

const ambiguousInput = {
  projectContactId: "contact-a",
  ownGrants: [
    fullGrant,
    grant({ id: "grant-b", workspaceId: workspaceB.id, capabilities: fullGrant.capabilities }),
  ],
  workspaces: [workspaceA, workspaceB],
};
for (const select of [
  selectOverviewWorkspaceContext,
  selectTaskManagementWorkspaceContext,
  selectVolunteerManagementWorkspaceContext,
  selectNeedsAttentionWorkspaceContext,
  selectCalendarRouteWorkspaceContext,
]) {
  assert.equal(select(ambiguousInput).ok, false);
}

const crossWorkspaceCapabilities = [
  grant({
    id: "calendar-a",
    workspaceId: workspaceA.id,
    capabilities: ["workspace.read", "calendar.view"],
  }),
  grant({
    id: "assignments-b",
    workspaceId: workspaceB.id,
    capabilities: ["workspace.read", "assignments.view"],
  }),
];
assert.equal(
  selectCalendarRouteWorkspaceContext({
    projectContactId: "contact-a",
    ownGrants: crossWorkspaceCapabilities,
    workspaces: [workspaceA, workspaceB],
  }).ok,
  false,
);

assert.deepEqual(VERIFIED_ADMIN_CONTEXT_CALL_GRAPH, {
  proxyVerifiedAuthCalls: 1,
  pageSupabaseClients: 1,
  pageVerifiedAuthCalls: 1,
  contextDatabaseReads: 3,
  contextDatabaseReadStagesAfterAuth: 1,
  expectedRemoteCallsIncludingProxy: {
    tasksEmpty: { before: 8, after: 6 },
    volunteersEmpty: { before: 8, after: 6 },
    needsAttentionEmpty: { before: 8, after: 6 },
    overviewEmpty: { before: 10, after: 8 },
    calendarEmpty: { before: 10, after: 8 },
  },
});

const [
  contextSource,
  grantSource,
  proxySource,
  tasksSource,
  volunteersSource,
  needsAttentionSource,
  overviewSource,
  calendarSource,
  assignmentDetailSource,
] = await Promise.all([
  read("lib", "auth", "verified-admin-context.server.ts"),
  read("lib", "auth", "project-contact-grants.ts"),
  read("lib", "supabase", "proxy.ts"),
  read("lib", "tasks", "routeRead.server.ts"),
  read("lib", "volunteers", "routeRead.server.ts"),
  read("lib", "needsAttention", "routeRead.server.ts"),
  read("lib", "overview", "routeRead.server.ts"),
  read("lib", "calendar", "routeRead.server.ts"),
  read("lib", "assignments", "detailContext.server.ts"),
]);

assert.match(contextSource, /^import "server-only";/);
assert.equal((contextSource.match(/auth\.getUser\(\)/g) ?? []).length, 1);
assert.match(contextSource, /Promise\.all\(\[/);
assert.doesNotMatch(contextSource, /unstable_cache|localStorage|sessionStorage|service.?role|module-level|new Map/i);
assert.match(grantSource, /loadVerifiedProjectContactGrantsWithClient/);
assert.match(grantSource, /readVerifiedProjectContactIdWithClient/);
assert.match(proxySource, /auth\.getUser\(\)/);

for (const source of [tasksSource, volunteersSource, needsAttentionSource, overviewSource]) {
  assert.match(source, /readVerifiedAdminContext/);
  assert.doesNotMatch(source, /auth\.getUser\(\)/);
}
const calendarReadOnlySource = calendarSource.slice(
  calendarSource.indexOf("export async function readCalendarRouteState"),
  calendarSource.indexOf("export async function readCalendarMutationRouteContext"),
);
assert.match(calendarReadOnlySource, /resolveVerifiedAdminContext/);
assert.doesNotMatch(calendarReadOnlySource, /auth\.getUser\(\)/);
const calendarMutationsSource = calendarSource.slice(
  calendarSource.indexOf("export async function readCalendarMutationRouteContext"),
);
assert.equal((calendarMutationsSource.match(/auth\.getUser\(\)/g) ?? []).length, 2);
assert.equal((assignmentDetailSource.match(/auth\.getUser\(\)/g) ?? []).length, 1);
assert.equal((assignmentDetailSource.match(/createServerSupabaseClient\(\)/g) ?? []).length, 1);

console.log("Verified admin request-context call graph and authorization regressions passed.");
console.log("Confirmed one page client/Auth call, three parallel RLS context reads, route isolation, and fresh mutation Auth boundaries.");
