import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ASSIGNMENT_DETAIL_CALENDAR_ENTRY_LINKAGE_AVAILABLE,
  ASSIGNMENT_DETAIL_NEEDS_ATTENTION_ENTRY_LINKAGE_AVAILABLE,
  ASSIGNMENT_DETAIL_ROUTE_ENTRY_IMPLEMENTATION_AVAILABLE,
  ASSIGNMENT_DETAIL_VOLUNTEERS_ENTRY_LINKAGE_AVAILABLE,
} from "../lib/assignments/detailRouteEntryPolicy.server.ts";
import {
  ASSIGNMENT_DETAIL_ROUTE_LINKED_FROM_PRODUCT_NAVIGATION,
} from "../lib/assignments/detailRoutePolicy.server.ts";
import {
  ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_COPY_AVAILABLE,
  ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_ENTRY_LINKING_AVAILABLE,
  ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_REVEAL_AVAILABLE,
} from "../lib/assignments/detailResponseLinkEnablementChecklist.server.ts";
import { deriveNeedsAttentionSignals } from "../lib/needsAttention/derive.server.ts";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = async (relativePath) =>
  readFile(path.join(repositoryRoot, relativePath), "utf8");

const [calendarSource, needsAttentionSource, detailSource, routeReadSource] =
  await Promise.all([
    source("components/CalendarClient.tsx"),
    source("app/admin/needs-attention/page.tsx"),
    source("app/admin/assignments/[assignmentId]/page.tsx"),
    source("lib/needsAttention/routeRead.server.ts"),
  ]);

assert.equal(ASSIGNMENT_DETAIL_ROUTE_ENTRY_IMPLEMENTATION_AVAILABLE, true);
assert.equal(ASSIGNMENT_DETAIL_CALENDAR_ENTRY_LINKAGE_AVAILABLE, true);
assert.equal(ASSIGNMENT_DETAIL_NEEDS_ATTENTION_ENTRY_LINKAGE_AVAILABLE, true);
assert.equal(ASSIGNMENT_DETAIL_ROUTE_LINKED_FROM_PRODUCT_NAVIGATION, true);
assert.equal(ASSIGNMENT_DETAIL_VOLUNTEERS_ENTRY_LINKAGE_AVAILABLE, false);

assert.match(
  calendarSource,
  /href={`\/admin\/assignments\/\$\{encodeURIComponent\(assignment\.assignmentId\)\}`}/,
);
assert.match(calendarSource, /View assignment for \$\{assignment\.volunteerDisplayName\}/);
assert.doesNotMatch(calendarSource, /admin\/assignments\/[^`]*\?(?:workspace|contact|role|capabilit|token)/i);
assert.match(
  needsAttentionSource,
  /href={`\/admin\/assignments\/\$\{encodeURIComponent\(assignmentLinks\[0\]\.assignmentId\)\}`}/,
);
assert.match(needsAttentionSource, /assignmentLinks\.length === 1/);
assert.match(needsAttentionSource, /assignmentLinks\.length > 1/);
assert.doesNotMatch(needsAttentionSource, /mockData|readAssignmentDetailContext/);
assert.match(routeReadSource, /readCalendarReadModelWithClient/);
assert.match(routeReadSource, /NEEDS_ATTENTION_SERVICE_ROLE_AVAILABLE = false/);
assert.doesNotMatch(routeReadSource, /createClient\([^)]*service|SUPABASE_SERVICE_ROLE_KEY/i);

const ids = {
  pendingOne: "11111111-1111-4111-8111-111111111111",
  pendingTwo: "22222222-2222-4222-8222-222222222222",
  denied: "33333333-3333-4333-8333-333333333333",
};
const summary = deriveNeedsAttentionSignals(
  [
    {
      calendarItemId: "44444444-4444-4444-8444-444444444444",
      stableDisplayReference: "calendar-item:fixture",
      taskSourceLabel: "Persisted fixture task",
      displayType: "general",
      scheduleKind: "timed",
      startDate: "2026-08-26",
      endDate: null,
      startTime: "10:00:00",
      endTime: "12:00:00",
      timezone: "America/Denver",
      neededCount: 3,
      lifecycle: "active",
      publicationState: "published",
      isOwnDraft: false,
      publishedAt: "2026-08-20T00:00:00.000Z",
      scheduleNotes: null,
      taskPresetId: null,
      oneOffTaskLabel: "Persisted fixture task",
      oneOffTaskType: "general",
      taskPresetLabel: null,
      taskPresetType: null,
      coverage: {
        assignedCount: 2,
        confirmedCount: 0,
        deniedCount: 1,
        unassignedCount: 1,
        waitingOnConfirmationCount: 2,
        hasDenied: true,
        allAssignedHelpersDenied: false,
        coverageState: "some_denied",
        assignedFractionLabel: "2/3 assigned",
        aggregateVolunteerCountOnMultiDayWindowAllowed: false,
      },
      assignments: [
        {
          assignmentId: ids.pendingOne,
          assignmentLifecycle: "active",
          currentResponseStatus: "needs_response",
        },
        {
          assignmentId: ids.pendingTwo,
          assignmentLifecycle: "active",
          currentResponseStatus: "needs_response",
        },
        {
          assignmentId: ids.denied,
          assignmentLifecycle: "active",
          currentResponseStatus: "declined",
        },
      ],
      assignedFractionLabel: "2/3 assigned",
    },
  ],
  { at: new Date("2026-08-24T12:00:00.000Z"), workspaceTimezone: "America/Denver" },
);

const pending = summary.responses.find((signal) => signal.kind === "pending");
const denied = summary.responses.find((signal) => signal.kind === "denied");
assert.deepEqual(
  pending?.affectedAssignments.map((assignment) => assignment.assignmentId),
  [ids.pendingOne, ids.pendingTwo],
);
assert.deepEqual(
  denied?.affectedAssignments.map((assignment) => assignment.assignmentId),
  [ids.denied],
);

assert.match(detailSource, /readAssignmentDetailContext/);
assert.match(detailSource, /Assignment unavailable/);
assert.match(detailSource, /Manual response-link tools are not enabled for this beta/);
assert.doesNotMatch(detailSource, /Assignment reference|navigator\.clipboard|\/respond\//);
assert.doesNotMatch(detailSource, /<form|formAction=|type="submit"/);
assert.doesNotMatch(detailSource, /service.?role/i);
assert.equal(ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_REVEAL_AVAILABLE, false);
assert.equal(ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_COPY_AVAILABLE, false);
assert.equal(ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_ENTRY_LINKING_AVAILABLE, false);

console.log("Assignment Detail persisted product-entry validation passed.");
