import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CALENDAR_HOSTED_CUTOVER_VALIDATION_AVAILABLE,
  CALENDAR_RESPONSE_LINK_ACTIVATION_REOPENED,
  CALENDAR_ROUTE_CUTOVER_DRY_RUN_AVAILABLE,
  CALENDAR_ROUTE_IMPORTS_READ_MODEL_QUERY_HELPER,
  CALENDAR_ROUTE_MOCK_TO_REAL_MIXING_ALLOWED,
  CALENDAR_ROUTE_PERSISTED_READ_CUTOVER_IMPLEMENTED,
  CALENDAR_ROUTE_PERSISTED_WRITE_AVAILABLE,
  CALENDAR_ROUTE_USES_DRY_RUN_HARNESS,
  CALENDAR_SEED_DATA_AVAILABLE,
  CALENDAR_SERVICE_ROLE_READ_AVAILABLE,
  deriveCalendarRouteCutoverDryRunRange,
  describeCalendarRouteCutoverDryRun,
  runCalendarRouteCutoverDryRun,
} from "../lib/calendar/routeCutoverDryRun.server.ts";
import { describeCalendarRouteCutoverReadiness } from "../lib/calendar/routeCutoverReadiness.server.ts";
import { describeCalendarReadModelQueryHelper } from "../lib/calendar/readModelQuery.server.ts";
import { describeMvpRealDataCutoverPlan } from "../lib/readiness/mvpRealDataCutoverPlan.server.ts";
import { describeResponseLinkProductActionActivationCheckpoint } from "../lib/responseTokens/productActionActivationCheckpoint.server.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dryRunPath = path.join(root, "lib", "calendar", "routeCutoverDryRun.server.ts");
const readinessPath = path.join(root, "lib", "calendar", "routeCutoverReadiness.server.ts");
const queryHelperPath = path.join(root, "lib", "calendar", "readModelQuery.server.ts");
const dryRunSource = await readFile(dryRunPath, "utf8");
const readinessSource = await readFile(readinessPath, "utf8");
const queryHelperSource = await readFile(queryHelperPath, "utf8");
const calendarRouteSource = await readFile(
  path.join(root, "app", "admin", "calendar", "page.tsx"),
  "utf8",
);
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

assert.match(dryRunSource, /^import "server-only";/);
assert.match(dryRunSource, /CALENDAR_ROUTE_CUTOVER_DRY_RUN_AVAILABLE = true/);
assert.match(dryRunSource, /CALENDAR_ROUTE_PERSISTED_READ_CUTOVER_IMPLEMENTED/);
assert.match(dryRunSource, /CALENDAR_ROUTE_USES_DRY_RUN_HARNESS = false/);
assert.doesNotMatch(
  dryRunSource,
  /createClient|createServerSupabaseClient|createBrowserSupabaseClient|lib\/supabase\/server|cookies\(|headers\(|from\s+["']app\/|React|JSX|\.rpc\(|SUPABASE_SERVICE_ROLE_KEY|createServiceRole|sendEmail|enqueueReminder|navigator\.clipboard/i,
);
assert.doesNotMatch(dryRunSource, /\.from\(/);
assert.match(dryRunSource, /readCalendarReadModelWithClient/);

assert.equal(CALENDAR_ROUTE_CUTOVER_DRY_RUN_AVAILABLE, true);
assert.equal(CALENDAR_ROUTE_PERSISTED_READ_CUTOVER_IMPLEMENTED, false);
assert.equal(CALENDAR_ROUTE_IMPORTS_READ_MODEL_QUERY_HELPER, false);
assert.equal(CALENDAR_ROUTE_USES_DRY_RUN_HARNESS, false);
assert.equal(CALENDAR_ROUTE_MOCK_TO_REAL_MIXING_ALLOWED, false);
assert.equal(CALENDAR_ROUTE_PERSISTED_WRITE_AVAILABLE, false);
assert.equal(CALENDAR_RESPONSE_LINK_ACTIVATION_REOPENED, false);
assert.equal(CALENDAR_SERVICE_ROLE_READ_AVAILABLE, false);
assert.equal(CALENDAR_SEED_DATA_AVAILABLE, false);
assert.equal(CALENDAR_HOSTED_CUTOVER_VALIDATION_AVAILABLE, false);

assert.deepEqual(deriveCalendarRouteCutoverDryRunRange({
  periodKind: "day",
  anchorDate: "2031-02-03",
  workspaceTimezone: "America/Denver",
}), {
  periodKind: "day",
  rangeStart: "2031-02-03",
  rangeEnd: "2031-02-04",
  anchorDate: "2031-02-03",
  workspaceTimezone: "America/Denver",
  bounded: true,
  rangeSemantics: "start_inclusive_end_exclusive_for_dry_run_route_planning",
});
assert.deepEqual(deriveCalendarRouteCutoverDryRunRange({
  periodKind: "week",
  anchorDate: "2031-02-06",
  workspaceTimezone: "America/Denver",
})?.rangeStart, "2031-02-03");
assert.deepEqual(deriveCalendarRouteCutoverDryRunRange({
  periodKind: "week",
  anchorDate: "2031-02-06",
  workspaceTimezone: "America/Denver",
})?.rangeEnd, "2031-02-10");
assert.deepEqual(deriveCalendarRouteCutoverDryRunRange({
  periodKind: "month",
  anchorDate: "2031-02-06",
  workspaceTimezone: "America/Denver",
})?.rangeStart, "2031-02-01");
assert.deepEqual(deriveCalendarRouteCutoverDryRunRange({
  periodKind: "month",
  anchorDate: "2031-02-06",
  workspaceTimezone: "America/Denver",
})?.rangeEnd, "2031-03-01");
assert.deepEqual(deriveCalendarRouteCutoverDryRunRange({
  periodKind: "list",
  anchorDate: "2031-02-06",
  workspaceTimezone: "America/Denver",
})?.rangeEnd, "2031-03-20");
assert.equal(deriveCalendarRouteCutoverDryRunRange({
  periodKind: "month",
  anchorDate: "not-a-date",
  workspaceTimezone: "America/Denver",
}), null);
assert.equal(deriveCalendarRouteCutoverDryRunRange({
  periodKind: "month",
  anchorDate: "2031-02-06",
  workspaceTimezone: "Browser/Provided",
}), null);

const workspaceId = "11111111-1111-4111-8111-111111111111";
const actorContactId = "22222222-2222-4222-8222-222222222222";
const baseContext = {
  authSessionPresent: true,
  workspaceId,
  actorContactId,
  workspaceTimezone: "America/Denver",
  workspaceAvailable: true,
  grantActive: true,
  capabilities: ["calendar.view", "assignments.view"],
  roleTitle: "main_contact",
};

function createFakeSupabaseClient({ empty = false, errorTable } = {}) {
  const calls = [];
  const tables = {
    calendar_items: empty
      ? []
      : [
          {
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
            workspace_id: workspaceId,
            task_preset_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
            title_snapshot: "Gate Crew",
            task_type_snapshot: "general",
            schedule_kind: "timed",
            start_date: "2031-02-03",
            end_date: null,
            start_time: "07:30:00",
            end_time: "10:30:00",
            timezone: "America/Denver",
            needed_count: 4,
            schedule_notes: "Safe schedule note",
            lifecycle: "active",
            filledCount: 99,
            assignedVolunteerIds: ["not-production-truth"],
          },
          {
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
            workspace_id: workspaceId,
            task_preset_id: null,
            title_snapshot: "Project Window",
            task_type_snapshot: "general",
            schedule_kind: "multi_day_window",
            start_date: "2031-02-05",
            end_date: "2031-02-07",
            start_time: null,
            end_time: null,
            timezone: "America/Denver",
            needed_count: 3,
            schedule_notes: "Informational",
            lifecycle: "active",
          },
        ],
    task_presets: [
      {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
        workspace_id: workspaceId,
        name: "Preset Gate Crew",
        task_type: "general",
        volunteer_email: "unsafe@example.invalid",
      },
    ],
    calendar_assignments: [
      {
        id: "cccccccc-cccc-4ccc-8ccc-ccccccccccc1",
        workspace_id: workspaceId,
        calendar_item_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
        lifecycle: "active",
      },
      {
        id: "cccccccc-cccc-4ccc-8ccc-ccccccccccc2",
        workspace_id: workspaceId,
        calendar_item_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
        lifecycle: "active",
      },
      {
        id: "cccccccc-cccc-4ccc-8ccc-ccccccccccc3",
        workspace_id: workspaceId,
        calendar_item_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
        lifecycle: "active",
      },
      {
        id: "cccccccc-cccc-4ccc-8ccc-ccccccccccc4",
        workspace_id: workspaceId,
        calendar_item_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
        lifecycle: "canceled",
      },
      {
        id: "cccccccc-cccc-4ccc-8ccc-ccccccccccc5",
        workspace_id: "33333333-3333-4333-8333-333333333333",
        calendar_item_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
        lifecycle: "active",
      },
      {
        id: "cccccccc-cccc-4ccc-8ccc-ccccccccccc6",
        workspace_id: workspaceId,
        calendar_item_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
        lifecycle: "active",
      },
    ],
    assignment_responses: [
      {
        assignment_id: "cccccccc-cccc-4ccc-8ccc-ccccccccccc1",
        workspace_id: workspaceId,
        response_status: "needs_response",
      },
      {
        assignment_id: "cccccccc-cccc-4ccc-8ccc-ccccccccccc2",
        workspace_id: workspaceId,
        response_status: "confirmed",
      },
      {
        assignment_id: "cccccccc-cccc-4ccc-8ccc-ccccccccccc3",
        workspace_id: workspaceId,
        response_status: "declined",
      },
      {
        assignment_id: "cccccccc-cccc-4ccc-8ccc-ccccccccccc4",
        workspace_id: workspaceId,
        response_status: "confirmed",
      },
      {
        assignment_id: "cccccccc-cccc-4ccc-8ccc-ccccccccccc5",
        workspace_id: "33333333-3333-4333-8333-333333333333",
        response_status: "confirmed",
      },
      {
        assignment_id: "cccccccc-cccc-4ccc-8ccc-ccccccccccc6",
        workspace_id: workspaceId,
        response_status: "confirmed",
      },
    ],
  };
  return {
    calls,
    from(table) {
      const call = { table, selector: null, eq: [], lte: [], or: [], in: [], order: [] };
      calls.push(call);
      const builder = {
        select(selector) {
          call.selector = selector;
          return builder;
        },
        eq(column, value) {
          call.eq.push([column, value]);
          return builder;
        },
        lte(column, value) {
          call.lte.push([column, value]);
          return builder;
        },
        or(expression) {
          call.or.push(expression);
          return builder;
        },
        in(column, values) {
          call.in.push([column, values]);
          return builder;
        },
        order(column, options = {}) {
          call.order.push([column, options]);
          return builder;
        },
        then(resolve, reject) {
          if (errorTable === table) {
            return Promise.resolve({
              data: null,
              error: { message: "raw provider SQL detail must not escape" },
            }).then(resolve, reject);
          }
          let data = [...(tables[table] ?? [])];
          for (const [column, value] of call.eq) {
            data = data.filter((row) => row[column] === value);
          }
          for (const [column, value] of call.lte) {
            data = data.filter((row) => row[column] <= value);
          }
          for (const [column, values] of call.in) {
            data = data.filter((row) => values.includes(row[column]));
          }
          return Promise.resolve({ data, error: null }).then(resolve, reject);
        },
      };
      return builder;
    },
  };
}

const unauthenticatedClient = createFakeSupabaseClient();
assert.deepEqual(
  await runCalendarRouteCutoverDryRun({
    executionMode: "dryRun",
    client: unauthenticatedClient,
    trustedContext: { ...baseContext, authSessionPresent: false },
    periodKind: "month",
    anchorDate: "2031-02-03",
  }),
  {
    available: false,
    state: "unauthenticated",
    dryRunOnly: true,
    routeUnused: true,
  },
);
assert.equal(unauthenticatedClient.calls.length, 0);

const noWorkspaceClient = createFakeSupabaseClient();
const noWorkspace = await runCalendarRouteCutoverDryRun({
  executionMode: "dryRun",
  client: noWorkspaceClient,
  trustedContext: { ...baseContext, workspaceId: undefined },
  periodKind: "month",
  anchorDate: "2031-02-03",
});
assert.equal(noWorkspace.state, "workspace-unavailable");
assert.equal(noWorkspaceClient.calls.length, 0);

const missingCalendarClient = createFakeSupabaseClient();
const missingCalendar = await runCalendarRouteCutoverDryRun({
  executionMode: "dryRun",
  client: missingCalendarClient,
  trustedContext: { ...baseContext, capabilities: ["assignments.view"] },
  periodKind: "month",
  anchorDate: "2031-02-03",
});
assert.equal(missingCalendar.state, "missing-calendar-view");
assert.equal(missingCalendarClient.calls.length, 0);

const missingAssignmentsClient = createFakeSupabaseClient();
const missingAssignments = await runCalendarRouteCutoverDryRun({
  executionMode: "dryRun",
  client: missingAssignmentsClient,
  trustedContext: { ...baseContext, capabilities: ["calendar.view"] },
  periodKind: "month",
  anchorDate: "2031-02-03",
});
assert.equal(missingAssignments.state, "missing-assignments-view");
assert.equal(missingAssignmentsClient.calls.length, 0);

const roleOnlyClient = createFakeSupabaseClient();
const roleOnly = await runCalendarRouteCutoverDryRun({
  executionMode: "dryRun",
  client: roleOnlyClient,
  trustedContext: { ...baseContext, capabilities: [], roleTitle: "owner" },
  periodKind: "month",
  anchorDate: "2031-02-03",
});
assert.equal(roleOnly.state, "missing-calendar-view");
assert.equal(roleOnlyClient.calls.length, 0);

const invalidRangeClient = createFakeSupabaseClient();
const invalidRange = await runCalendarRouteCutoverDryRun({
  executionMode: "dryRun",
  client: invalidRangeClient,
  trustedContext: baseContext,
  periodKind: "month",
  anchorDate: "2031-02-31",
});
assert.equal(invalidRange.state, "invalid-range");
assert.equal(invalidRangeClient.calls.length, 0);

const emptyClient = createFakeSupabaseClient({ empty: true });
const empty = await runCalendarRouteCutoverDryRun({
  executionMode: "dryRun",
  client: emptyClient,
  trustedContext: baseContext,
  periodKind: "month",
  anchorDate: "2031-02-03",
});
assert.equal(empty.available, true);
assert.equal(empty.state, "empty");
assert.deepEqual(empty.items, []);
assert.equal(empty.summary.itemCount, 0);

const fakeClient = createFakeSupabaseClient();
const ready = await runCalendarRouteCutoverDryRun({
  executionMode: "dryRun",
  client: fakeClient,
  trustedContext: baseContext,
  periodKind: "month",
  anchorDate: "2031-02-03",
});
assert.equal(ready.available, true);
assert.equal(ready.state, "ready");
assert.equal(ready.dryRunOnly, true);
assert.equal(ready.routeUnused, true);
assert.equal(ready.range.rangeStart, "2031-02-01");
assert.equal(ready.range.rangeEnd, "2031-03-01");
assert.equal(ready.items.length, 2);
const readyTimed = ready.items.find(
  (item) => item.calendarItemId === "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
);
assert(readyTimed);
assert.equal(readyTimed.coverage.assignedCount, 2);
assert.equal(readyTimed.coverage.confirmedCount, 1);
assert.equal(readyTimed.coverage.waitingOnConfirmationCount, 1);
assert.equal(readyTimed.coverage.deniedCount, 1);
assert.equal(readyTimed.coverage.unassignedCount, 2);
assert.equal(readyTimed.assignedFractionLabel, "2/4 assigned");
const readyWindow = ready.items.find(
  (item) => item.calendarItemId === "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
);
assert(readyWindow);
assert.equal(readyWindow.neededCount, 0);
assert.equal(readyWindow.assignedFractionLabel, "0/0 assigned");
assert.equal(ready.summary.itemCount, 2);
assert.equal(ready.summary.assignedCount, 2);
assert.equal(ready.summary.confirmedCount, 1);
assert.equal(ready.summary.waitingOnConfirmationCount, 1);
assert.equal(ready.summary.deniedCount, 1);

for (const call of fakeClient.calls) {
  assert.ok(
    ["calendar_items", "task_presets", "calendar_assignments", "assignment_responses"].includes(
      call.table,
    ),
  );
  assert.notEqual(call.selector, "*");
  assert.equal(call.eq.some(([column]) => column === "workspace_id"), true);
}
assert.deepEqual(
  fakeClient.calls.map((call) => call.table),
  ["calendar_items", "task_presets", "calendar_assignments", "assignment_responses"],
);

const providerErrorClient = createFakeSupabaseClient({ errorTable: "calendar_items" });
const providerError = await runCalendarRouteCutoverDryRun({
  executionMode: "dryRun",
  client: providerErrorClient,
  trustedContext: baseContext,
  periodKind: "month",
  anchorDate: "2031-02-03",
});
assert.equal(providerError.state, "query-unavailable");
assert.equal(JSON.stringify(providerError).includes("raw provider SQL detail"), false);

for (const result of [
  unauthenticatedClient,
  noWorkspace,
  missingCalendar,
  missingAssignments,
  roleOnly,
  invalidRange,
  empty,
  ready,
  providerError,
]) {
  const text = JSON.stringify(result);
  for (const forbidden of [
    "calendar.view",
    "assignments.view",
    "workspace.read",
    "volunteer_email",
    "assignedVolunteerIds",
    "filledCount",
    "raw provider SQL detail",
    "public_response_url",
    "redacted_response_url",
    "bearer",
    "verifier",
    "token",
    "audit",
    "password",
    "access_token",
    "refresh_token",
    "service_role",
    "sql",
    "rpc",
    "stack",
  ]) {
    assert.equal(text.includes(forbidden), false, `dry-run output exposed ${forbidden}`);
  }
}

const description = describeCalendarRouteCutoverDryRun();
assert.equal(description.dryRunAvailable, true);
assert.equal(description.routePersistedReadCutoverImplemented, false);
assert.equal(description.routeImportsReadModelQueryHelper, false);
assert.equal(description.routeUsesDryRunHarness, false);
assert.equal(description.mockToRealMixingAllowed, false);
assert.equal(description.persistedWriteAvailable, false);
assert.equal(description.assignmentPickerCutoverAvailable, false);
assert.equal(description.assignmentDetailLinkingAvailable, false);
assert.equal(description.responseLinkActivationReopened, false);
assert.equal(description.publicLookupCutoverAvailable, false);
assert.equal(description.reminderDeliveryAvailable, false);
assert.equal(description.serviceRoleReadAvailable, false);
assert.equal(description.seedDataAvailable, false);
assert.equal(description.hostedCutoverValidationAvailable, false);
assert.equal(description.queryHelperRouteUnused, true);
assert.equal(description.queryHelperDependencyInjected, true);
assert.equal(description.queryHelperExplicitSelectors.calendarItems.includes("*"), false);
assert.equal(description.nextRecommendedSlice, "12.9 Calendar Route Cutover Final Preflight");

const readiness = describeCalendarRouteCutoverReadiness();
assert.equal(readiness.readinessReviewAvailable, true);
assert.equal(readiness.routePersistedReadCutoverImplemented, false);
assert.equal(readiness.routeImportsReadModelQueryHelper, false);
assert.equal(readiness.responseLinkActivationReopened, false);

const queryHelper = describeCalendarReadModelQueryHelper();
assert.equal(queryHelper.routeUnused, true);
assert.equal(queryHelper.dependencyInjected, true);
assert.equal(queryHelper.serviceRoleAvailable, false);
assert.equal(queryHelper.explicitSelectors.calendarItems.includes("*"), false);
assert.doesNotMatch(queryHelperSource, /\.select\(\s*["']\*["']\s*\)/);

const appAndComponentFiles = [
  ...(await collectFiles(path.join(root, "app"))),
  ...(await collectFiles(path.join(root, "components"))),
].filter((file) => /\.(?:ts|tsx)$/.test(file));

const dryRunImporters = [];
const readinessImporters = [];
const queryHelperImporters = [];
const persistedCalendarRouteImporters = [];
const assignmentDetailLinks = [];
for (const file of appAndComponentFiles) {
  const relative = path.relative(root, file).replaceAll("\\", "/");
  const source = await readFile(file, "utf8");
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
assert.deepEqual(dryRunImporters, []);
assert.deepEqual(readinessImporters, []);
assert.deepEqual(queryHelperImporters, []);
assert.deepEqual(persistedCalendarRouteImporters, []);
assert.deepEqual(assignmentDetailLinks, []);

assert.match(calendarRouteSource, /@\/lib\/mockData/);
assert.doesNotMatch(
  calendarRouteSource,
  /routeCutoverDryRun|routeCutoverReadiness|readModelQuery|readCalendarReadModelWithClient|@\/lib\/calendar\/readModel|@\/lib\/calendar\/server|calendar_items|calendar_assignments|assignment_responses|(?:^|\n)\s*\.from\(|\.rpc\(|SUPABASE_SERVICE_ROLE_KEY|createServiceRole|serviceRole|formAction|useActionState|useFormState/i,
);
assert.doesNotMatch(
  calendarRouteSource,
  /sendEmail|enqueueReminder|rememberedDevice|publicLookup|assignment_response_tokens|response_link|navigator\.clipboard/i,
);

assert.match(packageSource, /"test:calendar-route-cutover-dry-run"/);
assert.match(currentStateSource, /Iteration 12\.8/);
assert.match(roadmapSource, /12\.9 Calendar Route Cutover Final Preflight/);
assert.match(calendarReadinessSource, /12\.8 Calendar Route Cutover Dry-Run Harness/);
assert.match(authReadinessSource, /12\.8 Calendar route cutover dry-run harness/i);
assert.match(localSetupSource, /test:calendar-route-cutover-dry-run/);
assert.match(localSetupSource, /Redirect Supabase start\/status output to a temporary file/);
assert.match(localSetupSource, /Redact key-like values before displaying diagnostics/);
assert.match(projectHistorySource, /Iteration 12\.8 - Calendar Route Cutover Dry-Run Harness/);
assert.match(readinessSource, /CALENDAR_ROUTE_CUTOVER_READINESS_REVIEW_AVAILABLE = true/);

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

console.log("Calendar route cutover dry-run checks passed.");
console.log("Confirmed dry-run remains route-unused and /admin/calendar remains mock-only.");
