import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  AssignmentValidationError,
  parseAssignmentResponse,
  parseCalendarAssignment,
  validateCreateAssignmentInput,
  validateUpdateAssignmentResponseInput,
} from "../lib/assignments/assignment.ts";
import { isEffectiveWorkspaceReadGrant } from "../lib/auth/grant.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationPath = path.join(
  root,
  "supabase",
  "migrations",
  "20260701060000_assignment_responses.sql",
);
const calendarMigrationPath = path.join(
  root,
  "supabase",
  "migrations",
  "20260701050000_calendar_items.sql",
);
const serverBoundaryPath = path.join(root, "lib", "assignments", "server.ts");
const environmentExamplePath = path.join(root, ".env.example");

const [migration, calendarMigration, serverBoundary, environmentExample] = await Promise.all([
  readFile(migrationPath, "utf8"),
  readFile(calendarMigrationPath, "utf8"),
  readFile(serverBoundaryPath, "utf8"),
  readFile(environmentExamplePath, "utf8"),
]);

const createdTables = [...migration.matchAll(/create table\s+public\.([a-z_]+)/gi)].map(
  (match) => match[1],
);
assert.deepEqual(createdTables, ["calendar_assignments", "assignment_responses"]);
assert.doesNotMatch(migration, /create table\s+public\.(?:tokens?|reminders?|communications?|needs_attention)/i);

const assignmentTable = migration.match(
  /create table public\.calendar_assignments\s*\(([\s\S]*?)\n\);/i,
)?.[1];
const responseTable = migration.match(
  /create table public\.assignment_responses\s*\(([\s\S]*?)\n\);/i,
)?.[1];
assert.ok(assignmentTable);
assert.ok(responseTable);

assert.match(
  assignmentTable,
  /foreign key\s*\(\s*workspace_id,\s*calendar_item_id\s*\)[\s\S]*references public\.calendar_items\s*\(workspace_id, id\)/i,
);
assert.match(
  assignmentTable,
  /foreign key\s*\(\s*workspace_id,\s*volunteer_profile_id\s*\)[\s\S]*references public\.volunteer_profiles\s*\(workspace_id, id\)/i,
);
assert.match(migration, /unique index calendar_assignments_one_active_volunteer_item/i);
assert.match(migration, /where lifecycle = 'active'/i);
assert.match(assignmentTable, /lifecycle in \('active', 'canceled', 'archived'\)/i);
assert.match(assignmentTable, /char_length\(assignment_note\) between 1 and 2000/i);

for (const forbiddenAssignmentField of [
  "questionnaire_answers",
  "emergency_contact",
  "filled_count",
  "confirmed_count",
  "declined_count",
  "waiting_count",
  "open_count",
  "response_status",
  "reminder_token",
  "public_token",
]) {
  assert.doesNotMatch(
    assignmentTable,
    new RegExp(`^\\s*${forbiddenAssignmentField}\\s`, "im"),
  );
}

assert.match(responseTable, /constraint assignment_responses_assignment_unique unique \(assignment_id\)/i);
assert.match(
  responseTable,
  /foreign key\s*\(\s*workspace_id,\s*assignment_id\s*\)[\s\S]*references public\.calendar_assignments\s*\(workspace_id, id\)/i,
);
assert.match(responseTable, /response_status in \('needs_response', 'confirmed', 'declined'\)/i);
assert.match(responseTable, /response_source = 'project_contact'/i);
assert.match(responseTable, /char_length\(response_note\) between 1 and 1000/i);
assert.match(responseTable, /response_status = 'needs_response' and responded_at is null/i);

const calendarTable = calendarMigration.match(
  /create table public\.calendar_items\s*\(([\s\S]*?)\n\);/i,
)?.[1];
assert.ok(calendarTable);
for (const forbiddenCalendarField of [
  "assigned_volunteer_ids",
  "filled_count",
  "confirmed_count",
  "declined_count",
  "waiting_count",
  "open_count",
  "response_state",
]) {
  assert.doesNotMatch(calendarTable, new RegExp(`^\\s*${forbiddenCalendarField}\\s`, "im"));
}
assert.doesNotMatch(migration, /alter table public\.calendar_items\s+add column/i);

for (const table of ["calendar_assignments", "assignment_responses"]) {
  assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  assert.match(migration, new RegExp(`revoke all on table public\\.${table} from anon, authenticated`, "i"));
  assert.match(migration, new RegExp(`grant select on table public\\.${table} to authenticated`, "i"));
}
assert.doesNotMatch(migration, /grant (?:insert|update|delete|all).*to (?:anon|authenticated)/i);
assert.doesNotMatch(migration, /grant select.*to anon/i);

for (const predicate of [
  "contact.auth_user_id = (select auth.uid())",
  "contact.status = 'active'",
  "grant_row.status = 'active'",
  "grant_row.revoked_at is null",
  "grant_row.valid_from <= now()",
  "grant_row.valid_until is null or grant_row.valid_until > now()",
  "grant_row.capabilities @> array['assignments.view']::text[]",
]) {
  assert.ok(migration.toLowerCase().includes(predicate), `Missing read predicate: ${predicate}`);
}

assert.match(migration, /create function public\.create_calendar_assignment\(\s*p_calendar_item_id uuid,\s*p_volunteer_profile_id uuid,\s*p_assignment_note text/i);
assert.match(migration, /create function public\.cancel_calendar_assignment\(p_assignment_id uuid\)/i);
assert.match(migration, /create function public\.update_assignment_response\(\s*p_assignment_id uuid,\s*p_response_status text,\s*p_response_note text/i);
assert.match(migration, /grant_row\.capabilities @> array\['assignments\.edit'\]::text\[\]/i);
assert.match(migration, /volunteer\.workspace_id = item\.workspace_id/i);
assert.match(migration, /item\.schedule_kind in \('timed', 'date_based'\)/i);
assert.match(migration, /volunteer\.readiness_status = 'ready'/i);
assert.match(migration, /insert into public\.assignment_responses/i);
assert.match(migration, /'needs_response',[\s\S]*'project_contact'/i);
assert.match(migration, /p_response_status = current_status/i);
assert.match(migration, /current_status = 'needs_response' and p_response_status in \('confirmed', 'declined'\)/i);
assert.match(migration, /assignment\.lifecycle = 'active'/i);
assert.match(migration, /response\.response_status = current_status/i);
assert.match(migration, /current_assignment\.lifecycle = 'active'/i);
assert.match(migration, /Assignment response changed concurrently/i);

const createSignature = migration.match(
  /create function public\.create_calendar_assignment\(([\s\S]*?)\)\s*returns uuid/i,
)?.[1];
const responseSignature = migration.match(
  /create function public\.update_assignment_response\(([\s\S]*?)\)\s*returns uuid/i,
)?.[1];
assert.ok(createSignature);
assert.ok(responseSignature);
for (const forbiddenParameter of [
  "workspace",
  "filled",
  "confirmed_count",
  "waiting",
  "open_count",
  "schedule",
  "emergency",
  "questionnaire",
  "token",
]) {
  assert.doesNotMatch(createSignature, new RegExp(forbiddenParameter, "i"));
}
assert.doesNotMatch(responseSignature, /workspace|source|token|volunteer_profile|calendar_item/i);
assert.doesNotMatch(migration, /to anon|service_role/i);

assert.match(serverBoundary, /^import "server-only";/);
assert.match(serverBoundary, /supabase\.auth\.getUser\(\)/);
assert.deepEqual(
  [...serverBoundary.matchAll(/\.rpc\(\s*"([^"]+)"/g)].map((match) => match[1]),
  ["create_calendar_assignment", "cancel_calendar_assignment", "update_assignment_response"],
);
assert.deepEqual(
  [...serverBoundary.matchAll(/\.from\("([^"]+)"\)/g)].map((match) => match[1]),
  ["calendar_assignments", "assignment_responses"],
);
assert.doesNotMatch(serverBoundary, /SUPABASE_SERVICE_ROLE_KEY|serviceRole|bearer|token/i);
assert.match(environmentExample, /^ADMIN_AUTH_MODE=review$/m);

const calendarItemId = "550e8400-e29b-41d4-a716-446655440030";
const volunteerProfileId = "550e8400-e29b-41d4-a716-446655440031";
const assignmentId = "550e8400-e29b-41d4-a716-446655440032";
const workspaceId = "550e8400-e29b-41d4-a716-446655440033";
const authUserId = "550e8400-e29b-41d4-a716-446655440034";

const createInput = validateCreateAssignmentInput({
  calendarItemId,
  volunteerProfileId,
  note: "Meet at the south entrance.",
});
assert.equal(createInput.note, "Meet at the south entrance.");
const responseInput = validateUpdateAssignmentResponseInput({
  assignmentId,
  status: "confirmed",
  note: "Confirmed by phone.",
});
assert.equal(responseInput.status, "confirmed");

for (const rejected of [
  { calendarItemId, volunteerProfileId, workspaceId },
  { calendarItemId, volunteerProfileId, filledCount: 1 },
  { calendarItemId, volunteerProfileId, schedule: { date: "2026-01-12" } },
  { calendarItemId, volunteerProfileId, questionnaireAnswers: {} },
  { calendarItemId, volunteerProfileId, emergencyContact: {} },
  { calendarItemId, volunteerProfileId, publicToken: "not-allowed" },
]) {
  assert.throws(() => validateCreateAssignmentInput(rejected), AssignmentValidationError);
}
assert.throws(
  () =>
    validateUpdateAssignmentResponseInput({
      assignmentId,
      status: "confirmed",
      source: "public_volunteer",
    }),
  AssignmentValidationError,
);
assert.throws(
  () => validateUpdateAssignmentResponseInput({ assignmentId, status: "waiting" }),
  AssignmentValidationError,
);

const parsedAssignment = parseCalendarAssignment({
  id: assignmentId,
  workspace_id: workspaceId,
  calendar_item_id: calendarItemId,
  volunteer_profile_id: volunteerProfileId,
  lifecycle: "active",
  assignment_note: null,
  created_by_auth_user_id: authUserId,
  created_at: "2026-07-01T12:00:00.000Z",
  updated_at: "2026-07-01T12:00:00.000Z",
});
assert.equal(parsedAssignment.calendarItemId, calendarItemId);
assert.equal("filledCount" in parsedAssignment, false);

const parsedResponse = parseAssignmentResponse({
  id: "550e8400-e29b-41d4-a716-446655440035",
  workspace_id: workspaceId,
  assignment_id: assignmentId,
  response_status: "needs_response",
  response_source: "project_contact",
  response_note: null,
  responded_at: null,
  updated_by_auth_user_id: authUserId,
  created_at: "2026-07-01T12:00:00.000Z",
  updated_at: "2026-07-01T12:00:00.000Z",
});
assert.equal(parsedResponse.status, "needs_response");

const at = new Date("2026-07-01T12:00:00.000Z");
const contacts = [
  { id: "contact-a", authUserId: "user-a", status: "active" },
  { id: "contact-b", authUserId: "user-b", status: "active" },
  { id: "contact-inactive", authUserId: "user-inactive", status: "inactive" },
  { id: "contact-revoked", authUserId: "user-revoked", status: "active" },
];
const grants = [
  {
    id: "grant-a",
    workspaceId: "workspace-a",
    projectContactId: "contact-a",
    role: "main_contact",
    capabilities: ["workspace.read", "assignments.view", "assignments.edit"],
    status: "active",
    validFrom: "2026-01-01T00:00:00.000Z",
    validUntil: null,
    revokedAt: null,
  },
  {
    id: "grant-b-unrelated",
    workspaceId: "workspace-b",
    projectContactId: "contact-b",
    role: "assistant_contact",
    capabilities: ["workspace.read", "calendar.view", "volunteers.view"],
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
    capabilities: ["workspace.read", "assignments.view", "assignments.edit"],
    status: "active",
    validFrom: "2026-01-01T00:00:00.000Z",
    validUntil: null,
    revokedAt: null,
  },
  {
    id: "grant-expired",
    workspaceId: "workspace-expired",
    projectContactId: "contact-a",
    role: "main_contact",
    capabilities: ["workspace.read", "assignments.view", "assignments.edit"],
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
    capabilities: ["workspace.read", "assignments.view", "assignments.edit"],
    status: "active",
    validFrom: "2026-01-01T00:00:00.000Z",
    validUntil: null,
    revokedAt: "2026-06-15T00:00:00.000Z",
  },
];
function authorizedWorkspaces(authUserIdValue, capability) {
  if (authUserIdValue === null) return [];
  return grants
    .filter((grant) => {
      const contact = contacts.find((candidate) => candidate.id === grant.projectContactId);
      return (
        contact?.authUserId === authUserIdValue &&
        contact.status === "active" &&
        grant.capabilities.includes(capability) &&
        isEffectiveWorkspaceReadGrant(grant, at)
      );
    })
    .map((grant) => grant.workspaceId);
}
assert.deepEqual(authorizedWorkspaces(null, "assignments.view"), []);
assert.deepEqual(authorizedWorkspaces("user-a", "assignments.view"), ["workspace-a"]);
assert.deepEqual(authorizedWorkspaces("user-a", "assignments.edit"), ["workspace-a"]);
assert.deepEqual(authorizedWorkspaces("user-b", "assignments.view"), []);
assert.deepEqual(authorizedWorkspaces("user-inactive", "assignments.view"), []);
assert.deepEqual(authorizedWorkspaces("user-revoked", "assignments.view"), []);

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
  if (source.includes("lib/assignments/server")) {
    routeImports.push(path.relative(root, file).replaceAll("\\", "/"));
  }
}
assert.deepEqual(routeImports, [], "Existing routes must remain mock-only");

console.log("Assignment and volunteer-response persistence checks passed.");
console.log("Confirmed scoped truth, deterministic transitions, no counters/tokens, and no route cutover.");
