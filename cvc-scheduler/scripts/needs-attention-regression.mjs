import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  calendarStartEpoch,
  deriveNeedsAttentionSignals,
  NEEDS_ATTENTION_COVERAGE_WINDOW_DAYS,
  NEEDS_ATTENTION_NEAR_WINDOW_HOURS,
  NEEDS_ATTENTION_RESPONSE_WINDOW_DAYS,
  NEEDS_ATTENTION_SIGNAL_LIMIT,
  NEEDS_ATTENTION_SOON_WINDOW_DAYS,
} from "../lib/needsAttention/derive.server.ts";
import {
  describeNeedsAttentionCutover,
  selectNeedsAttentionWorkspaceContext,
} from "../lib/needsAttention/routeRead.server.ts";
import { summarizeCalendarAssignmentCoverage } from "../lib/calendar/readModel.server.ts";

const root = process.cwd();
const at = new Date("2026-08-17T18:00:00.000Z");
const workspace = {
  id: "11111111-1111-4111-8111-111111111111",
  key: "needs-attention-target",
  displayName: "Needs Attention Target",
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
  key: "needs-attention-other",
  displayName: "Needs Attention Other",
};
const projectContactId = "33333333-3333-4333-8333-333333333333";

function grant(overrides = {}) {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    workspaceId: workspace.id,
    projectContactId,
    role: "assistant_contact",
    capabilities: ["workspace.read", "calendar.view", "assignments.view"],
    status: "active",
    validFrom: "2026-01-01T00:00:00Z",
    validUntil: null,
    revokedAt: null,
    ...overrides,
  };
}

function coverage(overrides = {}) {
  return {
    assignedCount: 0,
    confirmedCount: 0,
    deniedCount: 0,
    unassignedCount: 0,
    waitingOnConfirmationCount: 0,
    hasDenied: false,
    allAssignedHelpersDenied: false,
    coverageState: "filled",
    assignedFractionLabel: "0/0 assigned",
    aggregateVolunteerCountOnMultiDayWindowAllowed: false,
    ...overrides,
  };
}

function item(id, title, startDate, overrides = {}) {
  return {
    calendarItemId: id,
    stableDisplayReference: `calendar-item:${id}`,
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
    assignedFractionLabel: "0/1 assigned",
    ...overrides,
  };
}

const authorized = selectNeedsAttentionWorkspaceContext({
  projectContactId,
  ownGrants: [grant()],
  workspaces: [workspace],
  at,
});
assert(authorized.ok, "Required read capabilities should authorize the inbox.");
assert.equal(authorized.workspace.id, workspace.id);
assert(!authorized.capabilities.includes("assignments.edit"), "Edit must not be required.");

for (const deniedGrant of [
  grant({ capabilities: ["calendar.view", "assignments.view"] }),
  grant({ capabilities: ["workspace.read", "assignments.view"] }),
  grant({ capabilities: ["workspace.read", "calendar.view"] }),
  grant({ status: "revoked", revokedAt: "2026-08-01T00:00:00Z" }),
  grant({ status: "inactive" }),
  grant({ validUntil: "2026-08-17T17:59:59Z" }),
  grant({ validFrom: "2026-08-17T18:00:01Z" }),
  grant({ role: "main_contact", capabilities: ["workspace.read"] }),
]) {
  assert.equal(
    selectNeedsAttentionWorkspaceContext({
      projectContactId,
      ownGrants: [deniedGrant],
      workspaces: [workspace],
      at,
    }).ok,
    false,
  );
}
assert.equal(
  selectNeedsAttentionWorkspaceContext({
    projectContactId,
    ownGrants: [grant()],
    workspaces: [{ ...workspace, lifecycle: "archived" }],
    at,
  }).ok,
  false,
  "Inactive workspaces must fail closed.",
);
assert.equal(
  selectNeedsAttentionWorkspaceContext({
    projectContactId,
    ownGrants: [grant({ workspaceId: otherWorkspace.id })],
    workspaces: [workspace],
    at,
  }).ok,
  false,
  "Wrong-workspace grants must not authorize the target.",
);
assert.equal(
  selectNeedsAttentionWorkspaceContext({
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

const mixedCoverage = summarizeCalendarAssignmentCoverage(4, "timed", [
  { assignmentId: "confirmed", assignmentLifecycle: "active", currentResponseStatus: "confirmed" },
  { assignmentId: "pending", assignmentLifecycle: "active", currentResponseStatus: "needs_response" },
  { assignmentId: "denied", assignmentLifecycle: "active", currentResponseStatus: "denied" },
  { assignmentId: "canceled", assignmentLifecycle: "canceled", currentResponseStatus: "confirmed" },
]);
assert.equal(mixedCoverage.assignedCount, 2, "Confirmed and pending are active assigned truth.");
assert.equal(mixedCoverage.unassignedCount, 2);
assert.equal(mixedCoverage.deniedCount, 1, "Denied remains a response signal but not assigned coverage.");

const fullyCovered = summarizeCalendarAssignmentCoverage(2, "timed", [
  { assignmentId: "one", assignmentLifecycle: "active", currentResponseStatus: "needs_response" },
  { assignmentId: "two", assignmentLifecycle: "active", currentResponseStatus: "confirmed" },
]);
const noAssignments = summarizeCalendarAssignmentCoverage(3, "timed", []);
const reconfirmed = summarizeCalendarAssignmentCoverage(1, "timed", [
  { assignmentId: "reconfirmed", assignmentLifecycle: "active", currentResponseStatus: "confirmed" },
]);

const fixtures = [
  item("00000000-0000-4000-8000-000000000001", "Near mixed crew", "2026-08-18", {
    startTime: "08:00:00",
    neededCount: 4,
    coverage: mixedCoverage,
    assignedFractionLabel: mixedCoverage.assignedFractionLabel,
  }),
  item("00000000-0000-4000-8000-000000000002", "Soon open crew", "2026-08-21", {
    neededCount: 3,
    coverage: noAssignments,
    assignedFractionLabel: noAssignments.assignedFractionLabel,
  }),
  item("00000000-0000-4000-8000-000000000003", "Upcoming response crew", "2026-08-27", {
    neededCount: 2,
    coverage: fullyCovered,
    assignedFractionLabel: fullyCovered.assignedFractionLabel,
  }),
  item("00000000-0000-4000-8000-000000000004", "Confirmed crew", "2026-08-20", {
    coverage: reconfirmed,
    assignedFractionLabel: reconfirmed.assignedFractionLabel,
  }),
  item("00000000-0000-4000-8000-000000000005", "Coverage outside", "2026-09-01", {
    neededCount: 3,
    coverage: noAssignments,
    assignedFractionLabel: noAssignments.assignedFractionLabel,
  }),
  item("00000000-0000-4000-8000-000000000006", "Response outside", "2026-09-08", {
    neededCount: 2,
    coverage: fullyCovered,
    assignedFractionLabel: fullyCovered.assignedFractionLabel,
  }),
  item("00000000-0000-4000-8000-000000000007", "Draft crew", "2026-08-19", {
    publicationState: "draft",
    neededCount: 3,
    coverage: noAssignments,
    assignedFractionLabel: noAssignments.assignedFractionLabel,
  }),
  item("00000000-0000-4000-8000-000000000008", "Canceled work", "2026-08-19", {
    lifecycle: "canceled",
    neededCount: 3,
    coverage: noAssignments,
    assignedFractionLabel: noAssignments.assignedFractionLabel,
  }),
  item("00000000-0000-4000-8000-000000000009", "Passed work", "2026-08-17", {
    startTime: "08:00:00",
    neededCount: 3,
    coverage: noAssignments,
    assignedFractionLabel: noAssignments.assignedFractionLabel,
  }),
  item("00000000-0000-4000-8000-000000000010", "Information only", "2026-08-19", {
    neededCount: 0,
    coverage: coverage({ coverageState: "not_assignable" }),
    assignedFractionLabel: "0/0 assigned",
  }),
];

const result = deriveNeedsAttentionSignals(fixtures, {
  at,
  workspaceTimezone: "America/Denver",
});
assert.equal(NEEDS_ATTENTION_COVERAGE_WINDOW_DAYS, 14);
assert.equal(NEEDS_ATTENTION_RESPONSE_WINDOW_DAYS, 21);
assert.equal(NEEDS_ATTENTION_SOON_WINDOW_DAYS, 7);
assert.equal(NEEDS_ATTENTION_NEAR_WINDOW_HOURS, 48);
assert.deepEqual(result.signals.map((signal) => signal.kind), [
  "coverage",
  "pending",
  "denied",
  "coverage",
  "pending",
]);
assert.deepEqual(result.signals.map((signal) => signal.urgency), [
  "near",
  "near",
  "near",
  "soon",
  "upcoming",
]);
assert.equal(result.staffing.length, 2);
assert.equal(result.responses.length, 3);
assert(result.signals.every((signal) => signal.href.startsWith("/admin/calendar?view=day&date=")));
assert(!result.signals.some((signal) => /Draft|Canceled|Passed|outside|Information/.test(signal.title)));
assert(!result.signals.some((signal) => signal.title === "Confirmed crew"));
assert.equal(
  calendarStartEpoch(fixtures[0], "America/Denver"),
  Date.parse("2026-08-18T14:00:00.000Z"),
  "Workspace-local time must not use the host timezone.",
);

const bounded = deriveNeedsAttentionSignals(
  Array.from({ length: 120 }, (_, index) =>
    item(
      `00000000-0000-4000-8${String(index).padStart(3, "0")}-000000000000`,
      `Bounded ${index}`,
      "2026-08-19",
      {
        neededCount: 3,
        coverage: noAssignments,
        assignedFractionLabel: noAssignments.assignedFractionLabel,
      },
    ),
  ),
  { at, workspaceTimezone: "America/Denver" },
);
assert.equal(bounded.signals.length, NEEDS_ATTENTION_SIGNAL_LIMIT);
assert.equal(bounded.totalCandidateCount, 120);
assert.equal(bounded.truncated, true);

const [pageSource, routeSource, deriveSource, navSource, shellSource, authSource, packageSource] =
  await Promise.all([
    readFile(path.join(root, "app", "admin", "needs-attention", "page.tsx"), "utf8"),
    readFile(path.join(root, "lib", "needsAttention", "routeRead.server.ts"), "utf8"),
    readFile(path.join(root, "lib", "needsAttention", "derive.server.ts"), "utf8"),
    readFile(path.join(root, "components", "AdminNav.tsx"), "utf8"),
    readFile(path.join(root, "components", "AdminShell.tsx"), "utf8"),
    readFile(path.join(root, "lib", "auth", "project-contact-grants.ts"), "utf8"),
    readFile(path.join(root, "package.json"), "utf8"),
  ]);
const productSource = `${pageSource}\n${routeSource}\n${deriveSource}`;
assert.match(pageSource, /export const dynamic = "force-dynamic"/);
assert.match(pageSource, /fetchCache = "force-no-store"/);
assert.match(routeSource, /readCalendarReadModelWithClient/);
assert.match(routeSource, /loadProjectContactGrantsWithClient/);
assert.match(routeSource, /readGrantedWorkspacesWithClient/);
assert.match(authSource, /\.eq\("status", "active"\)/);
assert.doesNotMatch(productSource, /mockData|mock Needs Attention|groupNeedsAttentionItems/i);
assert.doesNotMatch(productSource, /SUPABASE_SERVICE_ROLE_KEY|createServiceRole/i);
assert.doesNotMatch(productSource, /\.insert\(|\.update\(|\.delete\(|\.upsert\(|\.rpc\(/i);
assert.doesNotMatch(productSource, /needs_attention(_items?|_issues?)?\b/i);
assert.doesNotMatch(pageSource, /needs-attention\/\[itemId\]|\/admin\/needs-attention\/\$\{/i);
assert.doesNotMatch(pageSource, /capabilities|workspaceId|projectContactId|auth_user|response token|bearer/i);
assert.match(navSource, /label: "Needs Attention"[\s\S]*href: "\/admin\/needs-attention"/);
assert.match(shellSource, /id: "needs-attention"[\s\S]*href: "\/admin\/needs-attention"/);
assert.match(shellSource, /label: "Volunteers", href: "\/admin\/volunteers"/);
assert.match(packageSource, /"test:needs-attention"/);
assert.match(packageSource, /"test:needs-attention:browser"/);

const contract = describeNeedsAttentionCutover();
assert.equal(contract.persistedCutoverImplemented, true);
assert.equal(contract.mockFallbackAllowed, false);
assert.equal(contract.serviceRoleAvailable, false);
assert.equal(contract.browserScopeInputTrusted, false);
assert.equal(contract.getMutationAvailable, false);
assert.equal(contract.persistenceAvailable, false);
assert.deepEqual(contract.requiredCapabilities, [
  "workspace.read",
  "calendar.view",
  "assignments.view",
]);

console.log("Needs Attention persisted derived-inbox validation passed.");
console.log("Confirmed canonical staffing/response windows, deterministic urgency/order/bounds, fail-closed scope, zero persistence, and zero mock fallback.");
