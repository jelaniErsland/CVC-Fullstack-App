import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CALENDAR_ROUTE_AMBIGUOUS_WORKSPACE_SELECTION_ALLOWED,
  CALENDAR_ROUTE_FALSE_EMPTY_FOR_UNQUERIED_RANGE_ALLOWED,
  CALENDAR_ROUTE_SERVER_BACKED_NAVIGATION_AVAILABLE,
  deriveCalendarRouteReadRange,
  describeCalendarRoutePersistedReadCutover,
  normalizeCalendarRouteSearchParams,
  selectCalendarRouteWorkspaceContext,
} from "../lib/calendar/routeRead.server.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const calendarRoutePath = path.join(root, "app", "admin", "calendar", "page.tsx");
const calendarClientPath = path.join(root, "components", "CalendarClient.tsx");
const routeReadPath = path.join(root, "lib", "calendar", "routeRead.server.ts");

const [calendarRouteSource, calendarClientSource, routeReadSource, packageSource] =
  await Promise.all([
    readFile(calendarRoutePath, "utf8"),
    readFile(calendarClientPath, "utf8"),
    readFile(routeReadPath, "utf8"),
    readFile(path.join(root, "package.json"), "utf8"),
  ]);

assert.match(packageSource, /"test:calendar-route-cutover-stabilization"/);

assert.match(calendarRouteSource, /export const dynamic = "force-dynamic"/);
assert.match(calendarRouteSource, /export const revalidate = 0/);
assert.match(calendarRouteSource, /export const fetchCache = "force-no-store"/);
assert.match(calendarRouteSource, /searchParams/);
assert.match(calendarRouteSource, /readCalendarRouteState\(await searchParams\)/);
assert.doesNotMatch(
  calendarRouteSource,
  /@\/lib\/mockData|getCalendarItemsByWeek|demoProjectId|readModelQuery|readCalendarReadModelWithClient|routeCutoverDryRun|routeCutoverFinalPreflight|routeCutoverReadiness|routeCutoverStatePrototype|\.from\(|\.rpc\(|select\(|SUPABASE_SERVICE_ROLE_KEY|createServiceRole|serviceRole/i,
);

assert.match(routeReadSource, /^import "server-only";/);
assert.match(routeReadSource, /normalizeCalendarRouteSearchParams/);
assert.match(routeReadSource, /deriveCalendarRouteReadRange/);
assert.match(routeReadSource, /selectCalendarRouteWorkspaceContext/);
assert.match(routeReadSource, /isEffectiveWorkspaceReadGrant/);
assert.match(routeReadSource, /grant\.projectContactId !== input\.projectContactId/);
assert.match(routeReadSource, /eligible\.length > 1/);
assert.match(routeReadSource, /workspace_unavailable/);
assert.match(routeReadSource, /readModelItemOverlapsRouteRange/);
assert.match(routeReadSource, /server_derived_start_inclusive_end_exclusive/);
assert.match(routeReadSource, /CALENDAR_ROUTE_SERVER_BACKED_NAVIGATION_AVAILABLE = true/);
assert.match(routeReadSource, /CALENDAR_ROUTE_FALSE_EMPTY_FOR_UNQUERIED_RANGE_ALLOWED = false/);
assert.match(routeReadSource, /CALENDAR_ROUTE_AMBIGUOUS_WORKSPACE_SELECTION_ALLOWED = false/);
assert.match(routeReadSource, /"ready_with_items"/);
assert.match(routeReadSource, /"ready_empty"/);
assert.match(routeReadSource, /"unavailable"/);
assert.match(routeReadSource, /"error"/);
assert.doesNotMatch(
  routeReadSource,
  /\.from\(|\.rpc\(|\.select\(|select\("\*"\)|SUPABASE_SERVICE_ROLE_KEY|createServiceRole|service-role|insert\(|upsert\(|update\(|delete\(|sendEmail|enqueueReminder|navigator\.clipboard/i,
);
assert.doesNotMatch(
  routeReadSource,
  /assignment_response_tokens|assignment_response_link_reveal_events|\/respond\/|\/admin\/assignments\//i,
);

assert.match(calendarClientSource, /useRouter/);
assert.match(calendarClientSource, /buildCalendarRouteHref/);
assert.match(calendarClientSource, /router\.push\(buildCalendarRouteHref\(view, calendarAnchor\)\)/);
assert.match(calendarClientSource, /shiftCalendarAnchor\(calendarAnchor, amount, activeView\)/);
assert.match(calendarClientSource, /router\.push\(buildCalendarRouteHref\("day", date\)\)/);
assert.doesNotMatch(calendarClientSource, /setCalendarAnchor\(\(current\)/);
assert.doesNotMatch(calendarClientSource, /getCalendarItemsByWeek|demoProjectId/);
assert.doesNotMatch(
  calendarClientSource,
  /readCalendarReadModelWithClient|readModelQuery|routeCutoverDryRun|routeCutoverFinalPreflight|\.rpc\(|select\("\*"\)|SUPABASE_SERVICE_ROLE_KEY|navigator\.clipboard/i,
);

assert.equal(CALENDAR_ROUTE_SERVER_BACKED_NAVIGATION_AVAILABLE, true);
assert.equal(CALENDAR_ROUTE_FALSE_EMPTY_FOR_UNQUERIED_RANGE_ALLOWED, false);
assert.equal(CALENDAR_ROUTE_AMBIGUOUS_WORKSPACE_SELECTION_ALLOWED, false);
const summary = describeCalendarRoutePersistedReadCutover();
assert.equal(summary.serverBackedNavigationAvailable, true);
assert.equal(summary.falseEmptyForUnqueriedRangeAllowed, false);
assert.equal(summary.ambiguousWorkspaceSelectionAllowed, false);

assert.deepEqual(normalizeCalendarRouteSearchParams(undefined), {
  ok: true,
  view: "week",
  anchorDate: "2026-01-13",
});
assert.deepEqual(normalizeCalendarRouteSearchParams({ view: "month", date: "2026-02-20" }), {
  ok: true,
  view: "month",
  anchorDate: "2026-02-20",
});
assert.equal(normalizeCalendarRouteSearchParams({ view: "timeline" }).ok, false);
assert.equal(normalizeCalendarRouteSearchParams({ date: "2026-02-31" }).ok, false);

assert.deepEqual(
  deriveCalendarRouteReadRange({
    view: "day",
    anchorDate: "2026-01-13",
    workspaceTimezone: "America/Denver",
  }),
  {
    rangeStart: "2026-01-13",
    rangeEnd: "2026-01-14",
    periodKind: "day",
    anchorDate: "2026-01-13",
    bounded: true,
    rangeSemantics: "server_derived_start_inclusive_end_exclusive",
  },
);
assert.deepEqual(
  deriveCalendarRouteReadRange({
    view: "week",
    anchorDate: "2026-01-13",
    workspaceTimezone: "America/Denver",
  })?.rangeStart,
  "2026-01-12",
);
assert.deepEqual(
  deriveCalendarRouteReadRange({
    view: "week",
    anchorDate: "2026-01-13",
    workspaceTimezone: "America/Denver",
  })?.rangeEnd,
  "2026-01-19",
);
assert.deepEqual(
  deriveCalendarRouteReadRange({
    view: "month",
    anchorDate: "2026-02-20",
    workspaceTimezone: "America/Denver",
  })?.rangeEnd,
  "2026-03-01",
);
assert.deepEqual(
  deriveCalendarRouteReadRange({
    view: "list",
    anchorDate: "2026-01-13",
    workspaceTimezone: "America/Denver",
  })?.rangeEnd,
  "2026-02-24",
);
assert.equal(
  deriveCalendarRouteReadRange({
    view: "week",
    anchorDate: "2026-01-13",
    workspaceTimezone: "Not/AZone",
  }),
  null,
);

function workspace(id, lifecycle = "active") {
  return {
    id,
    workspaceKey: id,
    displayName: id,
    lifecycle,
    timezone: "America/Denver",
    startsOn: null,
    endsOn: null,
    publicIntakeEnabled: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function grant({
  id,
  workspaceId,
  projectContactId = "contact-a",
  capabilities,
  status = "active",
  validFrom = "2026-01-01T00:00:00.000Z",
  validUntil = null,
  revokedAt = null,
}) {
  return {
    id,
    workspaceId,
    projectContactId,
    role: "main_contact",
    capabilities,
    status,
    validFrom,
    validUntil,
    revokedAt,
  };
}

const workspaces = [workspace("workspace-a"), workspace("workspace-b")];
const exactOne = selectCalendarRouteWorkspaceContext({
  projectContactId: "contact-a",
  workspaces,
  ownGrants: [
    grant({
      id: "grant-a",
      workspaceId: "workspace-a",
      capabilities: ["workspace.read", "calendar.view", "assignments.view"],
    }),
  ],
});
assert.equal(exactOne.ok, true);
assert.equal(exactOne.ok && exactOne.workspace.id, "workspace-a");

const sameWorkspaceSplitCapabilities = selectCalendarRouteWorkspaceContext({
  projectContactId: "contact-a",
  workspaces,
  ownGrants: [
    grant({
      id: "grant-a-calendar",
      workspaceId: "workspace-a",
      capabilities: ["workspace.read", "calendar.view"],
    }),
    grant({
      id: "grant-a-assignments",
      workspaceId: "workspace-a",
      capabilities: ["workspace.read", "assignments.view"],
    }),
  ],
});
assert.equal(sameWorkspaceSplitCapabilities.ok, true);
assert.equal(
  sameWorkspaceSplitCapabilities.ok && sameWorkspaceSplitCapabilities.workspace.id,
  "workspace-a",
);

const ambiguous = selectCalendarRouteWorkspaceContext({
  projectContactId: "contact-a",
  workspaces,
  ownGrants: [
    grant({
      id: "grant-a",
      workspaceId: "workspace-a",
      capabilities: ["workspace.read", "calendar.view", "assignments.view"],
    }),
    grant({
      id: "grant-b",
      workspaceId: "workspace-b",
      capabilities: ["workspace.read", "calendar.view", "assignments.view"],
    }),
  ],
});
assert.deepEqual(ambiguous, { ok: false, reason: "workspace_unavailable" });

const noBorrowingAcrossContacts = selectCalendarRouteWorkspaceContext({
  projectContactId: "contact-a",
  workspaces,
  ownGrants: [
    grant({
      id: "grant-a-calendar",
      workspaceId: "workspace-a",
      capabilities: ["workspace.read", "calendar.view"],
    }),
    grant({
      id: "grant-b-assignments",
      workspaceId: "workspace-a",
      projectContactId: "contact-b",
      capabilities: ["workspace.read", "assignments.view"],
    }),
  ],
});
assert.deepEqual(noBorrowingAcrossContacts, {
  ok: false,
  reason: "missing_assignments_view",
});

const noBorrowingAcrossWorkspaces = selectCalendarRouteWorkspaceContext({
  projectContactId: "contact-a",
  workspaces,
  ownGrants: [
    grant({
      id: "grant-a-calendar",
      workspaceId: "workspace-a",
      capabilities: ["workspace.read", "calendar.view"],
    }),
    grant({
      id: "grant-b-assignments",
      workspaceId: "workspace-b",
      capabilities: ["workspace.read", "assignments.view"],
    }),
  ],
});
assert.deepEqual(noBorrowingAcrossWorkspaces, {
  ok: false,
  reason: "missing_assignments_view",
});

for (const ignoredGrant of [
  grant({
    id: "revoked",
    workspaceId: "workspace-a",
    capabilities: ["workspace.read", "calendar.view", "assignments.view"],
    status: "revoked",
    revokedAt: "2026-01-02T00:00:00.000Z",
  }),
  grant({
    id: "inactive",
    workspaceId: "workspace-a",
    capabilities: ["workspace.read", "calendar.view", "assignments.view"],
    status: "inactive",
  }),
  grant({
    id: "expired",
    workspaceId: "workspace-a",
    capabilities: ["workspace.read", "calendar.view", "assignments.view"],
    validUntil: "2026-01-02T00:00:00.000Z",
  }),
]) {
  assert.equal(
    selectCalendarRouteWorkspaceContext({
      projectContactId: "contact-a",
      workspaces,
      ownGrants: [ignoredGrant],
    }).ok,
    false,
  );
}

const missingAssignmentsView = selectCalendarRouteWorkspaceContext({
  projectContactId: "contact-a",
  workspaces,
  ownGrants: [
    grant({
      id: "calendar-only",
      workspaceId: "workspace-a",
      capabilities: ["workspace.read", "calendar.view"],
    }),
  ],
});
assert.deepEqual(missingAssignmentsView, {
  ok: false,
  reason: "missing_assignments_view",
});

const inactiveWorkspace = selectCalendarRouteWorkspaceContext({
  projectContactId: "contact-a",
  workspaces: [workspace("workspace-a", "archived")],
  ownGrants: [
    grant({
      id: "eligible-but-archived",
      workspaceId: "workspace-a",
      capabilities: ["workspace.read", "calendar.view", "assignments.view"],
    }),
  ],
});
assert.deepEqual(inactiveWorkspace, { ok: false, reason: "workspace_unavailable" });

console.log("Calendar route cutover stabilization checks passed.");
console.log(
  "Confirmed server-backed bounded navigation, deterministic contact-scoped workspace selection, and no false-empty fallback.",
);
