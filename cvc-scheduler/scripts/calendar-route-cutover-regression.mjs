import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describeCalendarReadModelQueryHelper } from "../lib/calendar/readModelQuery.server.ts";
import { describeCalendarRouteCutoverStatePrototype } from "../lib/calendar/routeCutoverStatePrototype.server.ts";
import { describeResponseLinkProductActionActivationCheckpoint } from "../lib/responseTokens/productActionActivationCheckpoint.server.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const calendarRoutePath = path.join(root, "app", "admin", "calendar", "page.tsx");
const calendarClientPath = path.join(root, "components", "CalendarClient.tsx");
const routeReadPath = path.join(root, "lib", "calendar", "routeRead.server.ts");
const queryHelperPath = path.join(root, "lib", "calendar", "readModelQuery.server.ts");

const calendarRouteSource = await readFile(calendarRoutePath, "utf8");
const calendarClientSource = await readFile(calendarClientPath, "utf8");
const routeReadSource = await readFile(routeReadPath, "utf8");
const queryHelperSource = await readFile(queryHelperPath, "utf8");
const packageSource = await readFile(path.join(root, "package.json"), "utf8");

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

assert.match(calendarRouteSource, /export const dynamic = "force-dynamic"/);
assert.match(calendarRouteSource, /export const revalidate = 0/);
assert.match(calendarRouteSource, /export const fetchCache = "force-no-store"/);
assert.match(calendarRouteSource, /readCalendarRouteState/);
assert.match(calendarRouteSource, /CalendarClient/);
assert.doesNotMatch(
  calendarRouteSource,
  /@\/lib\/mockData|getCalendarItemsByWeek|demoProjectId|readModelQuery|readCalendarReadModelWithClient|routeCutoverDryRun|routeCutoverFinalPreflight|routeCutoverReadiness|routeCutoverStatePrototype|\.from\(|\.rpc\(|select\(|SUPABASE_SERVICE_ROLE_KEY|createServiceRole|serviceRole/i,
);
assert.doesNotMatch(
  calendarRouteSource,
  /formAction|useActionState|useFormState|sendEmail|enqueueReminder|navigator\.clipboard|response_link|assignment_response_tokens|\/admin\/assignments\//i,
);

assert.match(routeReadSource, /^import "server-only";/);
assert.match(routeReadSource, /createServerSupabaseClient/);
assert.match(routeReadSource, /loadProjectContactGrantsWithClient/);
assert.match(routeReadSource, /readAuthenticatedProjectContactIdWithClient/);
assert.match(routeReadSource, /grant\.projectContactId === projectContactId/);
assert.match(routeReadSource, /readGrantedWorkspacesWithClient/);
assert.match(routeReadSource, /readCalendarReadModelWithClient/);
assert.match(routeReadSource, /getCalendarRouteCutoverStatePrototypePresentation/);
assert.match(routeReadSource, /CALENDAR_ROUTE_PERSISTED_READ_CUTOVER_IMPLEMENTED = true/);
assert.match(routeReadSource, /CALENDAR_ROUTE_PERSISTED_READ_ONLY = false/);
assert.match(routeReadSource, /CALENDAR_ROUTE_PERSISTED_WRITE_AVAILABLE = true/);
assert.match(routeReadSource, /CALENDAR_ROUTE_MOCK_TO_REAL_MIXING_ALLOWED = false/);
assert.match(routeReadSource, /CALENDAR_SERVICE_ROLE_READ_AVAILABLE = false/);
assert.match(routeReadSource, /CALENDAR_SEED_DATA_AVAILABLE = false/);
assert.match(routeReadSource, /"ready_with_items"/);
assert.match(routeReadSource, /"ready_empty"/);
assert.match(routeReadSource, /"unavailable"/);
assert.match(routeReadSource, /"error"/);
assert.match(routeReadSource, /"calendar\.view"/);
assert.match(routeReadSource, /"assignments\.view"/);
assert.match(routeReadSource, /item\.coverage\.assignedCount/);
assert.doesNotMatch(
  routeReadSource,
  /\.from\(|\.rpc\(|\.select\(|select\("\*"\)|SUPABASE_SERVICE_ROLE_KEY|createServiceRole|service-role|insert\(|upsert\(|update\(|delete\(|sendEmail|enqueueReminder|navigator\.clipboard/i,
);
assert.doesNotMatch(
  routeReadSource,
  /assignment_response_tokens|assignment_response_link_reveal_events|\/respond\/|\/admin\/assignments\//i,
);

for (const [flagName, expected] of [
  ["CALENDAR_ROUTE_PERSISTED_READ_CUTOVER_IMPLEMENTED", "true"],
  ["CALENDAR_ROUTE_PERSISTED_READ_ONLY", "false"],
  ["CALENDAR_ROUTE_PERSISTED_WRITE_AVAILABLE", "true"],
  ["CALENDAR_ROUTE_MOCK_TO_REAL_MIXING_ALLOWED", "false"],
  ["CALENDAR_ASSIGNMENT_PICKER_CUTOVER_AVAILABLE", "true"],
  ["CALENDAR_ASSIGNMENT_DETAIL_LINKING_AVAILABLE", "false"],
  ["CALENDAR_RESPONSE_LINK_ACTIVATION_REOPENED", "false"],
  ["CALENDAR_SERVICE_ROLE_READ_AVAILABLE", "false"],
  ["CALENDAR_SEED_DATA_AVAILABLE", "false"],
]) {
  assert.match(routeReadSource, new RegExp(`${flagName} = ${expected}`));
}
assert.match(routeReadSource, /CALENDAR_ROUTE_SERVER_BACKED_NAVIGATION_AVAILABLE = true/);
assert.match(routeReadSource, /CALENDAR_ROUTE_FALSE_EMPTY_FOR_UNQUERIED_RANGE_ALLOWED = false/);
assert.match(routeReadSource, /CALENDAR_ROUTE_AMBIGUOUS_WORKSPACE_SELECTION_ALLOWED = false/);
assert.match(routeReadSource, /normalizeCalendarRouteSearchParams/);
assert.match(routeReadSource, /deriveCalendarRouteReadRange/);
assert.match(routeReadSource, /server_derived_start_inclusive_end_exclusive/);
assert.match(routeReadSource, /dataBoundary: "readCalendarReadModelWithClient"/);
assert.match(routeReadSource, /strictCapabilities: \["calendar\.view", "assignments\.view"\]/);

const queryHelper = describeCalendarReadModelQueryHelper();
assert.equal(queryHelper.dependencyInjected, true);
assert.equal(queryHelper.serviceRoleAvailable, false);
assert.equal(queryHelper.explicitSelectors.calendarItems.includes("*"), false);
assert.doesNotMatch(queryHelperSource, /\.select\(\s*["']\*["']\s*\)/);
for (const selector of Object.values(queryHelper.explicitSelectors)) {
  assert.equal(selector.includes("*"), false);
}

const statePrototype = describeCalendarRouteCutoverStatePrototype();
assert.equal(statePrototype.prototypeAvailable, true);
assert.equal(statePrototype.mockToRealMixingAllowed, false);
assert.deepEqual([...statePrototype.states], [
  "ready_with_items",
  "ready_empty",
  "unavailable",
  "error",
]);

assert.match(calendarClientSource, /type CalendarClientState/);
assert.match(calendarClientSource, /kind: "ready_with_items" \| "ready_empty"/);
assert.match(calendarClientSource, /kind: "unavailable" \| "error"/);
assert.match(calendarClientSource, /canEdit: boolean/);
assert.match(calendarClientSource, /useRouter/);
assert.match(calendarClientSource, /buildCalendarRouteHref/);
assert.match(calendarClientSource, /No scheduled items in this range/);
assert.match(calendarClientSource, /This Calendar view is ready/);
assert.doesNotMatch(
  calendarClientSource,
  /getCalendarItemsByWeek|demoProjectId|readCalendarReadModelWithClient|readModelQuery|routeRead\.server|createServerSupabaseClient|(?:^|\n)\s*\.from\(|(?:^|\n)\s*\.rpc\(|SUPABASE_SERVICE_ROLE_KEY|serviceRole/i,
);
assert.doesNotMatch(
  calendarClientSource,
  /local mock UI|mock item|This mock|sendEmail|enqueueReminder|navigator\.clipboard|\/admin\/assignments\//i,
);

const appAndComponentFiles = [
  ...(await collectFiles(path.join(root, "app"))),
  ...(await collectFiles(path.join(root, "components"))),
].filter((file) => /\.(?:ts|tsx)$/.test(file));

const queryHelperImporters = [];
const dryRunImporters = [];
const finalPreflightImporters = [];
const directCalendarTableMarkers = [];
const assignmentDetailLinks = [];
for (const file of appAndComponentFiles) {
  const relative = path.relative(root, file).replaceAll("\\", "/");
  const source = await readFile(file, "utf8");
  if (source.includes("readModelQuery.server") || source.includes("readCalendarReadModelWithClient")) {
    queryHelperImporters.push(relative);
  }
  if (source.includes("routeCutoverDryRun.server") || source.includes("runCalendarRouteCutoverDryRun")) {
    dryRunImporters.push(relative);
  }
  if (
    source.includes("routeCutoverFinalPreflight.server") ||
    source.includes("describeCalendarRouteCutoverFinalPreflight")
  ) {
    finalPreflightImporters.push(relative);
  }
  if (
    /calendar_items|calendar_assignments|assignment_responses|select\("\*"\)|(?:^|\n)\s*\.from\(|(?:^|\n)\s*\.rpc\(/i.test(
      source,
    )
  ) {
    directCalendarTableMarkers.push(relative);
  }
  if (
    relative !== "app/admin/assignments/[assignmentId]/page.tsx" &&
    source.includes("/admin/assignments/")
  ) {
    assignmentDetailLinks.push(relative);
  }
}
assert.deepEqual(queryHelperImporters, []);
assert.deepEqual(dryRunImporters, []);
assert.deepEqual(finalPreflightImporters, []);
assert.deepEqual(directCalendarTableMarkers, []);
assert.deepEqual(assignmentDetailLinks, []);

const activationCheckpoint = describeResponseLinkProductActionActivationCheckpoint();
assert.equal(activationCheckpoint.checkpointAvailable, true);
assert.equal(activationCheckpoint.activationApproved, false);
assert.equal(activationCheckpoint.activeRevealAvailable, false);
assert.equal(activationCheckpoint.activeCopyAvailable, false);
assert.equal(activationCheckpoint.deliveryAvailable, false);
assert.equal(activationCheckpoint.publicLookupAvailable, false);
assert.equal(activationCheckpoint.rememberedDeviceAvailable, false);

assert.match(packageSource, /"test:calendar-route-cutover"/);

console.log("Calendar route persisted read cutover checks passed.");
console.log("Confirmed /admin/calendar uses reviewed persisted read and narrow create/edit boundaries with no mock fallback.");
