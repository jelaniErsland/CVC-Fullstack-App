import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const read = (relativePath) => readFile(path.join(root, relativePath), "utf8");
const migrationNames = (await readdir(path.join(root, "supabase", "migrations")))
  .filter((name) => name.endsWith(".sql"))
  .sort();
const migrationSql = (
  await Promise.all(migrationNames.map((name) => read(path.join("supabase", "migrations", name))))
).join("\n");

const [calendarRead, quickViewRead, needsAttention, overview, assignmentDetail] =
  await Promise.all([
    read("lib/calendar/readModelQuery.server.ts"),
    read("lib/operations/projectQuickView.server.ts"),
    read("lib/needsAttention/derive.server.ts"),
    read("lib/overview/routeRead.server.ts"),
    read("lib/assignments/detailContext.server.ts"),
  ]);

assert.match(
  calendarRead,
  /\.from\("calendar_items"\)[\s\S]*?\.eq\("workspace_id", scope\.workspaceId\)[\s\S]*?\.eq\("lifecycle", "active"\)/,
);
assert.match(
  quickViewRead,
  /\.from\("calendar_items"\)[\s\S]*?\.eq\("lifecycle", "active"\)[\s\S]*?\.eq\("publication_state", "published"\)/,
);
assert.match(needsAttention, /item\.lifecycle !== "active"/);
assert.match(overview, /\["archived", "canceled", "completed"\]\.includes\(item\.lifecycle\)/);

const archiveFunction = migrationSql.match(
  /create or replace function public\.archive_calendar_item\([\s\S]*?\n\$\$;/i,
)?.[0];
assert(archiveFunction, "Current archive Calendar function must exist.");
assert.match(archiveFunction, /update public\.calendar_items[\s\S]*?set lifecycle = 'archived'/i);
assert.doesNotMatch(archiveFunction, /delete\s+from/i);
assert.doesNotMatch(
  archiveFunction,
  /calendar_assignments|assignment_responses|assignment_notification_deliveries|volunteer_schedule_access_tokens/i,
  "Archiving must preserve assignment, response, delivery, and schedule-access history rows.",
);

assert.match(
  migrationSql,
  /read_volunteer_schedule[\s\S]*?item\.lifecycle = 'active'/i,
  "Volunteer schedule must exclude archived parent items.",
);
assert.match(
  migrationSql,
  /read_initial_assignment_notification_summaries[\s\S]*?item_lifecycle = 'active'/i,
  "Initial-email readiness must exclude archived parent items.",
);
assert.match(
  migrationSql,
  /claim_initial_assignment_notification_deliveries[\s\S]*?item\.lifecycle = 'active'/i,
  "Initial-email claims must deny archived parent items.",
);
assert.match(
  migrationSql,
  /read_assignment_detail_context[\s\S]*?item\.lifecycle = 'active'/i,
  "Assignment Detail remains an authenticated active-work projection.",
);
assert.match(assignmentDetail, /requireAuthenticatedContact/);

assert.doesNotMatch(archiveFunction, /send|email/i);
assert.doesNotMatch(archiveFunction, /project_days|expected_on_site_count/i);

console.log("Calendar archive lifecycle contract checks passed.");
console.log("Confirmed active operational exclusion, preserved rows, no archive email, and active-only historical UI boundary.");
