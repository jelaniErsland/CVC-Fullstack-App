import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CALENDAR_HOSTED_QUERY_VALIDATION_AVAILABLE,
  CALENDAR_READ_MODEL_QUERY_ALLOWED_TABLES,
  CALENDAR_READ_MODEL_QUERY_HELPER_AVAILABLE,
  CALENDAR_READ_MODEL_QUERY_HELPER_DEPENDENCY_INJECTED,
  CALENDAR_READ_MODEL_QUERY_HELPER_ROUTE_UNUSED,
  CALENDAR_READ_MODEL_QUERY_HELPER_SERVICE_ROLE_AVAILABLE,
  CALENDAR_READ_MODEL_QUERY_SELECTORS,
  CALENDAR_RESPONSE_LINK_ACTIVATION_REOPENED,
  CALENDAR_ROUTE_MOCK_TO_REAL_MIXING_ALLOWED,
  CALENDAR_ROUTE_PERSISTED_READ_CUTOVER_AVAILABLE,
  CALENDAR_ROUTE_PERSISTED_WRITE_AVAILABLE,
  CALENDAR_SEED_DATA_AVAILABLE,
  describeCalendarReadModelQueryHelper,
  readCalendarReadModelWithClient,
} from "../lib/calendar/readModelQuery.server.ts";
import {
  calendarReadModelForbiddenOutputFields,
  describeCalendarReadModelHelper,
} from "../lib/calendar/readModel.server.ts";
import { describeCalendarPersistedReadModelContract } from "../lib/calendar/readModelContract.server.ts";
import { describeMvpRealDataCutoverPlan } from "../lib/readiness/mvpRealDataCutoverPlan.server.ts";
import { describeResponseLinkProductActionActivationCheckpoint } from "../lib/responseTokens/productActionActivationCheckpoint.server.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const queryHelperPath = path.join(root, "lib", "calendar", "readModelQuery.server.ts");
const helperPath = path.join(root, "lib", "calendar", "readModel.server.ts");
const contractPath = path.join(root, "lib", "calendar", "readModelContract.server.ts");
const queryHelperSource = await readFile(queryHelperPath, "utf8");
const helperSource = await readFile(helperPath, "utf8");
const contractSource = await readFile(contractPath, "utf8");
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

assert.match(queryHelperSource, /^import "server-only";/);
assert.doesNotMatch(
  queryHelperSource,
  /createClient|createServerSupabaseClient|createBrowserSupabaseClient|lib\/supabase\/server|from\s+["']app\/|cookies\(|headers\(|SUPABASE_SERVICE_ROLE_KEY|createServiceRole|serviceRoleClient|serviceRolePath/i,
);
assert.doesNotMatch(queryHelperSource, /\.select\(\s*["']\*["']\s*\)/);
assert.doesNotMatch(queryHelperSource, /\.rpc\(/);
for (const forbiddenFrom of [
  "volunteer_profiles",
  "questionnaire_submissions",
  "assignment_response_tokens",
  "assignment_response_link_reveal_events",
  "project_contacts",
  "workspace_contact_grants",
  "auth.users",
  "storage.objects",
]) {
  assert.doesNotMatch(
    queryHelperSource,
    new RegExp(`\\.from\\(\\s*["']${forbiddenFrom}["']\\s*\\)`),
    `query helper must not query ${forbiddenFrom}`,
  );
}
for (const selector of Object.values(CALENDAR_READ_MODEL_QUERY_SELECTORS)) {
  assert.equal(selector.includes("*"), false, `selector must be explicit: ${selector}`);
  assert.equal(/volunteer|email|phone|questionnaire|emergency|token|bearer|verifier|audit|grant|capabil/i.test(selector), false);
}

assert.equal(CALENDAR_READ_MODEL_QUERY_HELPER_AVAILABLE, true);
assert.equal(CALENDAR_READ_MODEL_QUERY_HELPER_ROUTE_UNUSED, true);
assert.equal(CALENDAR_READ_MODEL_QUERY_HELPER_DEPENDENCY_INJECTED, true);
assert.equal(CALENDAR_READ_MODEL_QUERY_HELPER_SERVICE_ROLE_AVAILABLE, false);
assert.equal(CALENDAR_ROUTE_PERSISTED_READ_CUTOVER_AVAILABLE, false);
assert.equal(CALENDAR_ROUTE_MOCK_TO_REAL_MIXING_ALLOWED, false);
assert.equal(CALENDAR_ROUTE_PERSISTED_WRITE_AVAILABLE, false);
assert.equal(CALENDAR_RESPONSE_LINK_ACTIVATION_REOPENED, false);
assert.equal(CALENDAR_SEED_DATA_AVAILABLE, false);
assert.equal(CALENDAR_HOSTED_QUERY_VALIDATION_AVAILABLE, false);
assert.deepEqual(CALENDAR_READ_MODEL_QUERY_ALLOWED_TABLES, [
  "calendar_items",
  "task_presets",
  "calendar_assignments",
  "assignment_responses",
]);

const description = describeCalendarReadModelQueryHelper();
assert.equal(description.queryHelperAvailable, true);
assert.equal(description.routeUnused, true);
assert.equal(description.dependencyInjected, true);
assert.equal(description.serviceRoleAvailable, false);
assert.equal(description.routeCutoverAvailable, false);
assert.equal(description.mockToRealMixingAllowed, false);
assert.equal(description.persistedWriteAvailable, false);
assert.equal(description.assignmentPickerCutoverAvailable, false);
assert.equal(description.assignmentDetailLinkingAvailable, false);
assert.equal(description.responseLinkActivationReopened, false);
assert.equal(description.seedDataAvailable, false);
assert.equal(description.hostedQueryValidationAvailable, false);
assert.equal(description.safeErrorShape, "generic_reason_code_only_no_raw_supabase_error");

const appFiles = await collectFiles(path.join(root, "app"));
const componentFiles = await collectFiles(path.join(root, "components"));
for (const filePath of [...appFiles, ...componentFiles]) {
  const source = await readFile(filePath, "utf8");
  assert.equal(
    source.includes("readModelQuery.server"),
    false,
    `${path.relative(root, filePath)} must not import the Calendar query helper`,
  );
}
assert.equal(calendarRouteSource.includes("readModelQuery.server"), false);
assert.equal(calendarRouteSource.includes("readCalendarReadModelWithClient"), false);
assert.equal(calendarRouteSource.includes("readModel.server"), false);
assert.match(calendarRouteSource, /@\/lib\/calendar\/routeRead\.server/);
assert.doesNotMatch(calendarRouteSource, /MOCK_CALENDAR_ITEMS|getCalendarItemsByWeek|demoProjectId/i);
assert.equal(packageSource.includes('"test:calendar-read-model-query-helper"'), true);

for (const docsSource of [
  currentStateSource,
  roadmapSource,
  calendarReadinessSource,
  authReadinessSource,
  localSetupSource,
  projectHistorySource,
]) {
  assert.match(docsSource, /12\.6/);
  assert.match(docsSource, /query-helper readiness|query helper readiness|query-helper/i);
}
assert.match(roadmapSource, /12\.7 Calendar Route Cutover Readiness Review/);
assert.match(calendarReadinessSource, /dependency-injected/i);
assert.match(calendarReadinessSource, /select\("\*"\)|select\('\*'\)|select star|No `select\("\*"\)`/i);
assert.match(localSetupSource, /redirected\/redacted|redirected and redacted|redacted/i);

assert.equal(describeCalendarReadModelHelper().routeCutoverAvailable, false);
assert.equal(describeCalendarPersistedReadModelContract().routeCutoverAvailable, false);
assert.equal(describeMvpRealDataCutoverPlan().responseLinkActivationReopened, false);
assert.equal(describeResponseLinkProductActionActivationCheckpoint().activationApproved, false);
assert.match(contractSource, /CALENDAR_PERSISTED_READ_MODEL_CONTRACT_AVAILABLE = true/);
assert.match(helperSource, /CALENDAR_PERSISTED_READ_MODEL_HELPER_AVAILABLE = true/);

const workspaceId = "11111111-1111-4111-8111-111111111111";
const actorContactId = "22222222-2222-4222-8222-222222222222";
const baseInput = {
  workspaceId,
  actorContactId,
  rangeStart: "2031-02-01",
  rangeEnd: "2031-02-28",
  workspaceTimezone: "America/Denver",
  periodKind: "month",
  capabilities: ["calendar.view", "assignments.view"],
};

function createFakeSupabaseClient({ errorTable } = {}) {
  const calls = [];
  const tables = {
    calendar_items: [
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
        needed_count: 3,
        schedule_notes: "Safe schedule note",
        lifecycle: "active",
        publication_state: "published",
        created_by_project_contact_id: actorContactId,
        published_at: "2031-02-01T12:00:00.000Z",
        filledCount: 999,
        assignedVolunteerIds: ["should-not-project"],
      },
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
        workspace_id: workspaceId,
        task_preset_id: null,
        title_snapshot: "Window",
        task_type_snapshot: "general",
        schedule_kind: "multi_day_window",
        start_date: "2031-02-05",
        end_date: "2031-02-07",
        start_time: null,
        end_time: null,
        timezone: "America/Denver",
        needed_count: 6,
        schedule_notes: "Informational",
        lifecycle: "active",
        publication_state: "draft",
        created_by_project_contact_id: actorContactId,
        published_at: null,
      },
    ],
    task_presets: [
      {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
        workspace_id: workspaceId,
        name: "Preset Gate Crew",
        task_type: "general",
        volunteer_email: "unsafe@example.test",
      },
    ],
    calendar_assignments: [
      {
        id: "cccccccc-cccc-4ccc-8ccc-ccccccccccc1",
        workspace_id: workspaceId,
        calendar_item_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
        lifecycle: "active",
        volunteer_phone: "555-0101",
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
        lifecycle: "canceled",
      },
      {
        id: "cccccccc-cccc-4ccc-8ccc-ccccccccccc4",
        workspace_id: "33333333-3333-4333-8333-333333333333",
        calendar_item_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
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
        response_status: "denied",
      },
      {
        assignment_id: "cccccccc-cccc-4ccc-8ccc-ccccccccccc4",
        workspace_id: "33333333-3333-4333-8333-333333333333",
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
              error: { message: "provider leaked SQL detail that must not escape" },
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

const missingCalendarClient = createFakeSupabaseClient();
const missingCalendarResult = await readCalendarReadModelWithClient({
  ...baseInput,
  client: missingCalendarClient,
  capabilities: ["assignments.view"],
});
assert.deepEqual(missingCalendarResult, { ok: false, reason: "missing_calendar_view" });
assert.equal(missingCalendarClient.calls.length, 0, "capability failure must happen before reads");

const missingAssignmentsClient = createFakeSupabaseClient();
const missingAssignmentsResult = await readCalendarReadModelWithClient({
  ...baseInput,
  client: missingAssignmentsClient,
  capabilities: ["calendar.view"],
});
assert.deepEqual(missingAssignmentsResult, {
  ok: false,
  reason: "missing_assignments_view_for_coverage",
});
assert.equal(missingAssignmentsClient.calls.length, 0, "coverage capability failure must happen before reads");

const invalidRangeClient = createFakeSupabaseClient();
const invalidRangeResult = await readCalendarReadModelWithClient({
  ...baseInput,
  client: invalidRangeClient,
  rangeEnd: "2031-08-01",
});
assert.equal(invalidRangeResult.ok, false);
assert.equal(invalidRangeClient.calls.length, 0, "range failure must happen before reads");

const roleOnlyClient = createFakeSupabaseClient();
const roleOnlyResult = await readCalendarReadModelWithClient({
  ...baseInput,
  client: roleOnlyClient,
  capabilities: [],
});
assert.deepEqual(roleOnlyResult, { ok: false, reason: "missing_calendar_view" });
assert.equal(roleOnlyClient.calls.length, 0, "role/title strings alone must not authorize reads");

const fakeClient = createFakeSupabaseClient();
const result = await readCalendarReadModelWithClient({ ...baseInput, client: fakeClient });
assert.equal(result.ok, true);
if (result.ok) {
  assert.equal(result.query.routeUnused, true);
  assert.equal(result.query.dependencyInjected, true);
  assert.deepEqual(result.query.tables, CALENDAR_READ_MODEL_QUERY_ALLOWED_TABLES);
  assert.equal(result.items.length, 2);
  const timedItem = result.items.find(
    (item) => item.calendarItemId === "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  );
  assert(timedItem, "timed read-model item should be projected");
  assert.equal(timedItem.taskSourceLabel, "Gate Crew");
  assert.equal(timedItem.taskPresetId, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1");
  assert.equal(timedItem.taskPresetLabel, "Preset Gate Crew");
  assert.equal(timedItem.coverage.assignedCount, 2);
  assert.equal(timedItem.coverage.confirmedCount, 1);
  assert.equal(timedItem.coverage.waitingOnConfirmationCount, 1);
  assert.equal(timedItem.coverage.deniedCount, 0);
  assert.equal(timedItem.coverage.unassignedCount, 1);
  assert.equal(timedItem.assignedFractionLabel, "2/3 assigned");

  const windowItem = result.items.find(
    (item) => item.calendarItemId === "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
  );
  assert(windowItem, "multi-day window should be projected as informational");
  assert.equal(windowItem.neededCount, 0);
  assert.equal(windowItem.coverage.assignedFractionLabel, "0/0 assigned");

  const output = JSON.stringify(result);
  for (const forbidden of [
    ...calendarReadModelForbiddenOutputFields,
    "volunteer_email",
    "volunteer_phone",
    "assignedVolunteerIds",
    "filledCount",
    "provider leaked SQL detail",
    "service_role",
    "bearer",
    "verifier",
    "token",
    "audit",
  ]) {
    assert.equal(output.includes(forbidden), false, `output exposed ${forbidden}`);
  }
}

assert.deepEqual(
  fakeClient.calls.map((call) => call.table),
  ["calendar_items", "task_presets", "calendar_assignments", "assignment_responses"],
);
for (const call of fakeClient.calls) {
  assert.ok(CALENDAR_READ_MODEL_QUERY_ALLOWED_TABLES.includes(call.table));
  assert.notEqual(call.selector, "*");
  assert.equal(call.eq.some(([column]) => column === "workspace_id"), true);
}
const itemCall = fakeClient.calls.find((call) => call.table === "calendar_items");
assert(itemCall, "calendar_items query should be recorded");
assert.equal(itemCall.selector, CALENDAR_READ_MODEL_QUERY_SELECTORS.calendarItems);
assert.equal(itemCall.lte.some(([column, value]) => column === "start_date" && value === "2031-02-28"), true);
assert.equal(itemCall.or.some((expression) => expression.includes("end_date.gte.2031-02-01")), true);

const errorClient = createFakeSupabaseClient({ errorTable: "calendar_items" });
const errorResult = await readCalendarReadModelWithClient({ ...baseInput, client: errorClient });
assert.deepEqual(errorResult, { ok: false, reason: "calendar_items_unavailable" });
assert.equal(JSON.stringify(errorResult).includes("provider leaked SQL detail"), false);

for (const falseFlag of [
  CALENDAR_ROUTE_PERSISTED_READ_CUTOVER_AVAILABLE,
  CALENDAR_ROUTE_MOCK_TO_REAL_MIXING_ALLOWED,
  CALENDAR_ROUTE_PERSISTED_WRITE_AVAILABLE,
  CALENDAR_RESPONSE_LINK_ACTIVATION_REOPENED,
  CALENDAR_SEED_DATA_AVAILABLE,
  CALENDAR_HOSTED_QUERY_VALIDATION_AVAILABLE,
]) {
  assert.equal(falseFlag, false);
}

console.log("Calendar read model query-helper regression passed.");
