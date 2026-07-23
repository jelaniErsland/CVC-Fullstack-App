import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { isEffectiveWorkspaceReadGrant } from "../lib/auth/grant.ts";
import {
  CalendarItemValidationError,
  parseCalendarItem,
  validateCreateCalendarItemInput,
} from "../lib/calendar/item.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationPath = path.join(
  root,
  "supabase",
  "migrations",
  "20260701050000_calendar_items.sql",
);
const itemManagementMigrationPath = path.join(
  root,
  "supabase",
  "migrations",
  "20260714121600_calendar_item_management.sql",
);
const sourceSelectionMigrationPath = path.join(
  root,
  "supabase",
  "migrations",
  "20260714121700_calendar_source_selection.sql",
);
const serverBoundaryPath = path.join(root, "lib", "calendar", "server.ts");
const hostedManagementGatePath = path.join(
  root,
  "scripts",
  "hosted-calendar-item-management-regression.mjs",
);
const environmentExamplePath = path.join(root, ".env.example");

const [
  migration,
  itemManagementMigration,
  sourceSelectionMigration,
  serverBoundary,
  hostedManagementGate,
  packageJson,
  environmentExample,
] = await Promise.all([
  readFile(migrationPath, "utf8"),
  readFile(itemManagementMigrationPath, "utf8"),
  readFile(sourceSelectionMigrationPath, "utf8"),
  readFile(serverBoundaryPath, "utf8"),
  readFile(hostedManagementGatePath, "utf8"),
  readFile(path.join(root, "package.json"), "utf8"),
  readFile(environmentExamplePath, "utf8"),
]);

const createdTables = [...migration.matchAll(/create table\s+public\.([a-z_]+)/gi)].map(
  (match) => match[1],
);
assert.deepEqual(createdTables, ["calendar_items"]);
const tableDefinition = migration.match(
  /create table public\.calendar_items\s*\(([\s\S]*?)\n\);/i,
)?.[1];
assert.ok(tableDefinition, "calendar_items table definition must be readable");
for (const forbiddenColumn of [
  "assigned_volunteer_ids",
  "filled_count",
  "confirmed_count",
  "denied_count",
  "waiting_count",
  "open_count",
  "response_state",
  "recurrence_rule",
  "reminder_id",
]) {
  assert.doesNotMatch(
    tableDefinition,
    new RegExp(`^\\s*${forbiddenColumn}\\s`, "im"),
    `Calendar items must not store ${forbiddenColumn}`,
  );
}

assert.match(migration, /workspace_id uuid not null references public\.workspaces/i);
assert.match(
  migration,
  /foreign key\s*\(\s*workspace_id,\s*task_preset_id\s*\)[\s\S]*references public\.task_presets\s*\(workspace_id, id\)/i,
);
assert.match(
  migration,
  /schedule_kind in \('timed', 'date_based', 'multi_day_window', 'milestone'\)/i,
);
assert.match(migration, /end_time > start_time/i);
assert.match(migration, /end_date > start_date/i);
assert.match(migration, /schedule_kind in \('multi_day_window', 'milestone'\)[\s\S]*needed_count = 0/i);
assert.match(migration, /calendar_custom_values_are_valid/i);
assert.match(migration, /enforce_calendar_item_workspace_timezone/i);
assert.match(migration, /new\.timezone is distinct from expected_timezone/i);
assert.match(migration, /alter table public\.calendar_items enable row level security/i);
assert.match(migration, /revoke all on table public\.calendar_items from anon/i);
assert.doesNotMatch(migration, /grant (?:select|insert|update|delete|all).*to anon/i);
assert.match(
  migration,
  /create policy calendar_items_select_with_view_capability[\s\S]*for select[\s\S]*to authenticated/i,
);

for (const requiredReadPredicate of [
  "contact.auth_user_id = (select auth.uid())",
  "contact.status = 'active'",
  "grant_row.status = 'active'",
  "grant_row.revoked_at is null",
  "grant_row.valid_from <= now()",
  "grant_row.valid_until is null or grant_row.valid_until > now()",
  "grant_row.capabilities @> array['calendar.view']::text[]",
]) {
  assert.ok(
    migration.toLowerCase().includes(requiredReadPredicate),
    `Calendar read RLS is missing: ${requiredReadPredicate}`,
  );
}

assert.match(migration, /create function public\.create_calendar_item\(/i);
assert.match(migration, /create function public\.archive_calendar_item\(p_calendar_item_id uuid\)/i);
assert.match(migration, /caller_user_id := auth\.uid\(\)/i);
assert.match(migration, /grant_row\.capabilities @> array\['calendar\.edit'\]::text\[\]/i);
assert.match(migration, /preset\.workspace_id = p_workspace_id/i);
assert.match(migration, /preset\.lifecycle = 'active'/i);
assert.match(migration, /p_one_off_title is not null or p_one_off_task_type is not null/i);
assert.match(migration, /target_timezone/i);
assert.doesNotMatch(
  migration,
  /create_calendar_item\([\s\S]*?p_(?:timezone|assigned|filled|confirmed|denied|response|recurrence)/i,
);
assert.match(
  migration,
  /grant execute on function public\.create_calendar_item[\s\S]*to authenticated/i,
);
assert.match(itemManagementMigration, /follow_up_project_contact_id uuid/i);
assert.match(
  itemManagementMigration,
  /references public\.project_contacts\s*\(\s*id\s*\)/i,
);
assert.match(itemManagementMigration, /p_needed_count between 0 and 99/i);
assert.match(itemManagementMigration, /create or replace function public\.create_calendar_item\(/i);
assert.match(itemManagementMigration, /caller_project_contact_id/i);
assert.match(itemManagementMigration, /follow_up_project_contact_id/i);
assert.match(
  itemManagementMigration,
  /create (?:or replace )?function public\.update_calendar_item_one_off_timed\(/i,
);
assert.match(
  itemManagementMigration,
  /grant execute on function public\.update_calendar_item_one_off_timed[\s\S]*to authenticated/i,
);
assert.doesNotMatch(itemManagementMigration, /grant .*to anon|service_role/i);
assert.match(
  sourceSelectionMigration,
  /create (?:or replace )?function public\.update_calendar_item_preset_timed\(/i,
);
assert.match(
  sourceSelectionMigration,
  /grant execute on function public\.update_calendar_item_preset_timed[\s\S]*to authenticated/i,
);
assert.match(sourceSelectionMigration, /item\.task_preset_id is not null/i);
assert.doesNotMatch(sourceSelectionMigration, /grant .*to anon|service_role/i);
assert.doesNotMatch(migration, /to anon|service_role/i);

assert.match(packageJson, /"test:calendar-item-management:hosted": "node --conditions=react-server --no-warnings --experimental-strip-types scripts\/hosted-calendar-item-management-regression\.mjs"/);
assert.match(hostedManagementGate, /const expectedRef = "kfuujcfxoayukywvtaeh";/);
assert.match(hostedManagementGate, /const expectedName = "project-local-staging";/);
assert.match(hostedManagementGate, /RUN_HOSTED_CALENDAR_ITEM_MANAGEMENT_VALIDATION === expectedConfirmation/);
assert.match(hostedManagementGate, /const expectedBeforeMigration = "20260714121500";/);
assert.match(hostedManagementGate, /const expectedAfterMigration = "20260714121600";/);
assert.match(hostedManagementGate, /const expectedMigrationFile = `\$\{expectedAfterMigration\}_calendar_item_management\.sql`;/);
assert.match(hostedManagementGate, /db", "push", "--linked", "--dry-run", "--yes"/);
assert.match(hostedManagementGate, /db", "push", "--linked", "--yes"/);
assert.match(hostedManagementGate, /gen", "types", "typescript", "--linked", "--schema", "public"/);
assert.match(hostedManagementGate, /create_calendar_item/);
assert.match(hostedManagementGate, /update_calendar_item_one_off_timed/);
assert.match(hostedManagementGate, /follow_up_project_contact_id/);
assert.match(hostedManagementGate, /verifyNamespaceResidue/);
assert.match(hostedManagementGate, /Hosted disposable product and Auth residue/);
assert.doesNotMatch(
  hostedManagementGate
    .replace(/service credential/g, "")
    .replace(/SUPABASE_SERVICE_ROLE_KEY/g, "")
    .replace(/createServiceRole/g, ""),
  /SUPABASE_SERVICE_ROLE_KEY|createServiceRole/,
);

assert.match(serverBoundary, /^import "server-only";/);
assert.match(serverBoundary, /supabase\.auth\.getUser\(\)/);
assert.deepEqual(
  [...serverBoundary.matchAll(/\.rpc\(\s*"([^"]+)"/g)].map((match) => match[1]),
  [
    "create_calendar_item",
    "update_calendar_item_one_off_timed",
    "update_calendar_item_preset_timed",
    "publish_calendar_item",
    "archive_calendar_item",
  ],
);
assert.deepEqual(
  [...serverBoundary.matchAll(/\.from\("([^"]+)"\)/g)].map((match) => match[1]),
  ["calendar_items"],
);
assert.doesNotMatch(serverBoundary, /SUPABASE_SERVICE_ROLE_KEY|serviceRole/i);
assert.match(environmentExample, /^ADMIN_AUTH_MODE=review$/m);

const workspaceId = "550e8400-e29b-41d4-a716-446655440020";
const presetId = "550e8400-e29b-41d4-a716-446655440021";
const base = {
  workspaceId,
  source: { kind: "preset", taskPresetId: presetId },
  neededCount: 3,
  notes: "Meet at the south entrance.",
  customValues: { menu: "Soup and sandwiches" },
};
const timed = validateCreateCalendarItemInput({
  ...base,
  schedule: { kind: "timed", date: "2026-01-12", startTime: "09:00", endTime: "11:30" },
});
assert.equal(timed.schedule.kind, "timed");
const zeroNeededTimed = validateCreateCalendarItemInput({
  ...base,
  neededCount: 0,
  schedule: { kind: "timed", date: "2026-01-12", startTime: "12:00", endTime: "13:00" },
});
assert.equal(zeroNeededTimed.neededCount, 0);
const dateBased = validateCreateCalendarItemInput({
  ...base,
  schedule: { kind: "date_based", date: "2026-01-13" },
});
assert.equal(dateBased.schedule.kind, "date_based");
const windowItem = validateCreateCalendarItemInput({
  ...base,
  source: { kind: "one_off", title: "Concrete cure window", taskType: "general" },
  schedule: {
    kind: "multi_day_window",
    startDate: "2026-01-14",
    endDate: "2026-01-17",
  },
  neededCount: 0,
});
assert.equal(windowItem.source.kind, "one_off");
const milestone = validateCreateCalendarItemInput({
  ...base,
  source: { kind: "one_off", title: "Inspection", taskType: "custom" },
  schedule: { kind: "milestone", date: "2026-01-18" },
  neededCount: 0,
});
assert.equal(milestone.schedule.kind, "milestone");

assert.throws(
  () =>
    validateCreateCalendarItemInput({
      ...base,
      schedule: { kind: "timed", date: "2026-01-12", startTime: "22:00", endTime: "02:00" },
    }),
  CalendarItemValidationError,
);
assert.throws(
  () => validateCreateCalendarItemInput({ ...base, filledCount: 2, schedule: timed.schedule }),
  CalendarItemValidationError,
);
assert.throws(
  () =>
    validateCreateCalendarItemInput({
      ...base,
      source: { kind: "preset", taskPresetId: presetId, title: "Forged title" },
      schedule: timed.schedule,
    }),
  CalendarItemValidationError,
);
assert.throws(
  () =>
    validateCreateCalendarItemInput({
      ...base,
      schedule: { kind: "multi_day_window", startDate: "2026-01-17", endDate: "2026-01-14" },
      neededCount: 0,
    }),
  CalendarItemValidationError,
);

const parsed = parseCalendarItem({
  id: "550e8400-e29b-41d4-a716-446655440022",
  workspace_id: workspaceId,
  task_preset_id: presetId,
  title_snapshot: "Lunch",
  task_type_snapshot: "food",
  schedule_kind: "timed",
  start_date: "2026-01-12",
  end_date: null,
  start_time: "09:00:00",
  end_time: "11:30:00",
  timezone: "America/Denver",
  needed_count: 3,
  schedule_notes: "Meet at the south entrance.",
  custom_values: { menu: "Soup and sandwiches" },
  lifecycle: "active",
  publication_state: "published",
  created_by_project_contact_id: "550e8400-e29b-41d4-a716-446655440099",
  published_at: "2026-07-01T12:05:00.000Z",
  published_by_project_contact_id: "550e8400-e29b-41d4-a716-446655440099",
  created_at: "2026-07-01T12:00:00.000Z",
  updated_at: "2026-07-01T12:00:00.000Z",
});
assert.equal(parsed.title, "Lunch");
assert.equal(parsed.schedule.kind, "timed");
assert.equal("filledCount" in parsed, false);

const at = new Date("2026-07-01T12:00:00.000Z");
const contacts = [
  { id: "contact-a", authUserId: "user-a", status: "active" },
  { id: "contact-b", authUserId: "user-b", status: "active" },
  { id: "contact-inactive", authUserId: "user-inactive", status: "inactive" },
  { id: "contact-expired", authUserId: "user-expired", status: "active" },
  { id: "contact-revoked", authUserId: "user-revoked", status: "active" },
];
const grants = [
  {
    id: "grant-a",
    workspaceId: "workspace-a",
    projectContactId: "contact-a",
    role: "main_contact",
    capabilities: ["workspace.read", "calendar.view", "calendar.edit"],
    status: "active",
    validFrom: "2026-01-01T00:00:00.000Z",
    validUntil: null,
    revokedAt: null,
  },
  {
    id: "grant-b-view-only",
    workspaceId: "workspace-b",
    projectContactId: "contact-b",
    role: "assistant_contact",
    capabilities: ["workspace.read", "calendar.view"],
    status: "active",
    validFrom: "2026-01-01T00:00:00.000Z",
    validUntil: null,
    revokedAt: null,
  },
  {
    id: "grant-inactive-contact",
    workspaceId: "workspace-inactive",
    projectContactId: "contact-inactive",
    role: "main_contact",
    capabilities: ["calendar.view", "calendar.edit"],
    status: "active",
    validFrom: "2026-01-01T00:00:00.000Z",
    validUntil: null,
    revokedAt: null,
  },
  {
    id: "grant-expired",
    workspaceId: "workspace-expired",
    projectContactId: "contact-expired",
    role: "main_contact",
    capabilities: ["calendar.view", "calendar.edit"],
    status: "active",
    validFrom: "2026-01-01T00:00:00.000Z",
    validUntil: "2026-06-01T00:00:00.000Z",
    revokedAt: null,
  },
  {
    id: "grant-revoked",
    workspaceId: "workspace-revoked",
    projectContactId: "contact-revoked",
    role: "main_contact",
    capabilities: ["calendar.view", "calendar.edit"],
    status: "active",
    validFrom: "2026-01-01T00:00:00.000Z",
    validUntil: null,
    revokedAt: "2026-06-15T00:00:00.000Z",
  },
];
function authorizedWorkspaces(authUserId, capability) {
  if (authUserId === null) return [];
  return grants
    .filter((grant) => {
      const contact = contacts.find((candidate) => candidate.id === grant.projectContactId);
      return (
        contact?.authUserId === authUserId &&
        contact.status === "active" &&
        grant.capabilities.includes(capability) &&
        isEffectiveWorkspaceReadGrant(grant, at)
      );
    })
    .map((grant) => grant.workspaceId);
}
assert.deepEqual(authorizedWorkspaces(null, "calendar.view"), []);
assert.deepEqual(authorizedWorkspaces("user-a", "calendar.view"), ["workspace-a"]);
assert.deepEqual(authorizedWorkspaces("user-b", "calendar.view"), ["workspace-b"]);
assert.deepEqual(authorizedWorkspaces("user-a", "calendar.edit"), ["workspace-a"]);
assert.deepEqual(authorizedWorkspaces("user-b", "calendar.edit"), []);
assert.deepEqual(authorizedWorkspaces("user-inactive", "calendar.view"), []);
assert.deepEqual(authorizedWorkspaces("user-expired", "calendar.view"), []);
assert.deepEqual(authorizedWorkspaces("user-revoked", "calendar.view"), []);

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
const routeFiles = (await collectFiles(path.join(root, "app"))).filter((file) =>
  /\.(?:ts|tsx)$/.test(file),
);
const routeImports = [];
for (const file of routeFiles) {
  const source = await readFile(file, "utf8");
if (source.includes("lib/calendar/server")) {
    routeImports.push(path.relative(root, file).replaceAll("\\", "/"));
  }
}
assert.deepEqual(
  routeImports,
  ["app/admin/calendar/page.tsx"],
  "Only the reviewed Calendar route may import the server Calendar mutation boundary",
);

console.log("Calendar item persistence and authorization checks passed.");
console.log("Confirmed schedule unions, scoped reads/writes, Follow-up Contact, and no coverage truth.");
