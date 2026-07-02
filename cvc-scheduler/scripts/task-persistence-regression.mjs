import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { isEffectiveWorkspaceReadGrant } from "../lib/auth/grant.ts";
import {
  TaskPresetValidationError,
  parseTaskPreset,
  validateCreateTaskPresetInput,
} from "../lib/tasks/preset.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationPath = path.join(
  root,
  "supabase",
  "migrations",
  "20260701040000_task_presets.sql",
);
const serverBoundaryPath = path.join(root, "lib", "tasks", "server.ts");
const environmentExamplePath = path.join(root, ".env.example");

const [migration, serverBoundary, environmentExample] = await Promise.all([
  readFile(migrationPath, "utf8"),
  readFile(serverBoundaryPath, "utf8"),
  readFile(environmentExamplePath, "utf8"),
]);

const createdTables = [...migration.matchAll(/create table\s+public\.([a-z_]+)/gi)].map(
  (match) => match[1],
);
assert.deepEqual(createdTables, ["task_presets"]);
const tableDefinition = migration.match(
  /create table public\.task_presets\s*\(([\s\S]*?)\n\);/i,
)?.[1];
assert.ok(tableDefinition, "task_presets table definition must be readable");
for (const forbiddenColumn of [
  "date",
  "start_time",
  "end_time",
  "assigned_volunteer_ids",
  "filled_count",
  "confirmation_state",
  "calendar_item_id",
  "recurrence",
  "response",
]) {
  assert.doesNotMatch(
    tableDefinition,
    new RegExp(`^\\s*${forbiddenColumn}\\s`, "im"),
    `Task presets must not store ${forbiddenColumn}`,
  );
}

assert.match(migration, /workspace_id uuid not null references public\.workspaces/i);
assert.match(migration, /task_type in \('general', 'food', 'security', 'custom'\)/i);
assert.match(migration, /default_needed_count between 1 and 99/i);
assert.match(migration, /system_key text/i);
assert.match(migration, /custom_field_definitions jsonb not null/i);
assert.match(migration, /task_custom_field_definitions_are_valid/i);
assert.match(migration, /alter table public\.task_presets enable row level security/i);
assert.match(migration, /revoke all on table public\.task_presets from anon/i);
assert.doesNotMatch(migration, /grant (?:select|insert|update|delete|all).*to anon/i);
assert.match(
  migration,
  /create policy task_presets_select_with_view_capability[\s\S]*for select[\s\S]*to authenticated/i,
);

for (const requiredReadPredicate of [
  "contact.auth_user_id = (select auth.uid())",
  "contact.status = 'active'",
  "grant_row.status = 'active'",
  "grant_row.revoked_at is null",
  "grant_row.valid_from <= now()",
  "grant_row.valid_until is null or grant_row.valid_until > now()",
  "grant_row.capabilities @> array['tasks.view']::text[]",
]) {
  assert.ok(
    migration.toLowerCase().includes(requiredReadPredicate),
    `Task preset read RLS is missing: ${requiredReadPredicate}`,
  );
}

assert.match(migration, /create function public\.create_task_preset\(/i);
assert.match(migration, /create function public\.archive_task_preset\(p_preset_id uuid\)/i);
assert.match(migration, /caller_user_id := auth\.uid\(\)/i);
assert.match(migration, /grant_row\.capabilities @> array\['tasks\.edit'\]::text\[\]/i);
assert.match(migration, /p_task_type not in \('general', 'food', 'security', 'custom'\)/i);
assert.match(migration, /p_default_needed_count not between 1 and 99/i);
assert.match(migration, /preset\.is_system_preset = false/i);
assert.doesNotMatch(
  migration,
  /create_task_preset\([\s\S]*?p_(?:date|start_time|end_time|assigned|filled|response|recurrence)/i,
);
assert.match(
  migration,
  /revoke all on function public\.create_task_preset[\s\S]*from public/i,
);
assert.match(
  migration,
  /grant execute on function public\.create_task_preset[\s\S]*to authenticated/i,
);
assert.doesNotMatch(migration, /to anon|service_role/i);

assert.match(serverBoundary, /^import "server-only";/);
assert.match(serverBoundary, /supabase\.auth\.getUser\(\)/);
assert.deepEqual(
  [...serverBoundary.matchAll(/\.rpc\(\s*"([^"]+)"/g)].map((match) => match[1]),
  ["create_task_preset", "archive_task_preset"],
);
assert.deepEqual(
  [...serverBoundary.matchAll(/\.from\("([^"]+)"\)/g)].map((match) => match[1]),
  ["task_presets"],
);
assert.doesNotMatch(serverBoundary, /SUPABASE_SERVICE_ROLE_KEY|serviceRole/i);
assert.match(environmentExample, /^ADMIN_AUTH_MODE=review$/m);

const workspaceId = "550e8400-e29b-41d4-a716-446655440010";
const validInput = {
  workspaceId,
  name: "Lunch",
  description: "Reusable lunch support definition.",
  taskType: "food",
  defaultNeededCount: 3,
  volunteerVisible: true,
  customFields: [
    {
      key: "menu",
      label: "Menu",
      type: "long_text",
      required: true,
    },
  ],
};
const validated = validateCreateTaskPresetInput(validInput);
assert.equal(validated.taskType, "food");
assert.equal(validated.customFields[0]?.key, "menu");
assert.throws(
  () => validateCreateTaskPresetInput({ ...validInput, date: "2026-01-12" }),
  TaskPresetValidationError,
);
assert.throws(
  () => validateCreateTaskPresetInput({ ...validInput, defaultNeededCount: 0 }),
  TaskPresetValidationError,
);
assert.throws(
  () =>
    validateCreateTaskPresetInput({
      ...validInput,
      customFields: [{ key: "menu", label: "Menu", type: "select", required: true }],
    }),
  TaskPresetValidationError,
);

const parsed = parseTaskPreset({
  id: "550e8400-e29b-41d4-a716-446655440011",
  workspace_id: workspaceId,
  name: "Lunch",
  description: "Reusable lunch support definition.",
  task_type: "food",
  default_needed_count: 3,
  volunteer_visible: true,
  is_system_preset: true,
  system_key: "lunch",
  custom_field_definitions: validInput.customFields,
  lifecycle: "active",
  created_at: "2026-07-01T12:00:00.000Z",
  updated_at: "2026-07-01T12:00:00.000Z",
});
assert.equal(parsed.systemKey, "lunch");
assert.equal(parsed.customFields[0]?.label, "Menu");

const at = new Date("2026-07-01T12:00:00.000Z");
const contacts = [
  { id: "contact-a", authUserId: "user-a", status: "active" },
  { id: "contact-b", authUserId: "user-b", status: "active" },
];
const grants = [
  {
    id: "grant-a",
    workspaceId: "workspace-a",
    projectContactId: "contact-a",
    role: "main_contact",
    capabilities: ["workspace.read", "tasks.view", "tasks.edit"],
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
    capabilities: ["workspace.read", "tasks.view"],
    status: "active",
    validFrom: "2026-01-01T00:00:00.000Z",
    validUntil: null,
    revokedAt: null,
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
assert.deepEqual(authorizedWorkspaces(null, "tasks.view"), []);
assert.deepEqual(authorizedWorkspaces("user-a", "tasks.view"), ["workspace-a"]);
assert.deepEqual(authorizedWorkspaces("user-b", "tasks.view"), ["workspace-b"]);
assert.deepEqual(authorizedWorkspaces("user-a", "tasks.edit"), ["workspace-a"]);
assert.deepEqual(authorizedWorkspaces("user-b", "tasks.edit"), []);

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
  if (source.includes("lib/tasks/server")) {
    routeImports.push(path.relative(root, file).replaceAll("\\", "/"));
  }
}
assert.deepEqual(routeImports, [], "Existing Tasks routes must remain mock-only");

console.log("Task preset persistence and authorization checks passed.");
console.log("Confirmed reusable definitions, scoped reads/writes, and no route cutover.");
