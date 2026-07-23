import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
import { writeFileSync, unlinkSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import path from "node:path";

import {
  validateCancelAssignmentInput,
  validateCreateAssignmentBatchInput,
} from "../lib/assignments/assignment.ts";
import { readCalendarAssignmentPickerWithClient } from "../lib/calendar/assignmentPicker.server.ts";
import { readCalendarReadModelWithClient } from "../lib/calendar/readModelQuery.server.ts";

const root = process.cwd();
const expectedRef = "kfuujcfxoayukywvtaeh";
const expectedName = "project-local-staging";
const expectedConfirmation = `${expectedName}:${expectedRef}`;
const expectedBeforeMigration = "20260714121700";
const expectedAfterMigration = "20260714121800";
const expectedMigrationFile = `${expectedAfterMigration}_calendar_assignment_management.sql`;
const hostedUrl = `https://${expectedRef}.supabase.co`;
const secrets = new Set();

const fixture = {
  namespace: `qa-12-18-1-${randomUUID()}`,
  workspaceId: randomUUID(),
  otherWorkspaceId: randomUUID(),
  inactiveWorkspaceId: randomUUID(),
  primaryCalendarItemId: null,
  atomicCalendarItemId: null,
  singleCompatItemId: null,
  presetCalendarItemId: null,
  otherCalendarItemId: null,
  createdAssignmentIds: [],
  singleAssignmentId: null,
  volunteers: {
    readyA: randomUUID(),
    readyB: randomUUID(),
    readyC: randomUUID(),
    readyD: randomUUID(),
    onHold: randomUUID(),
    inactive: randomUUID(),
    other: randomUUID(),
  },
  users: Object.fromEntries(
    [
      "full",
      "viewOnly",
      "noVolunteers",
      "calendarOnly",
      "volunteersOnly",
      "assignmentsViewOnly",
      "tasksOnly",
      "roleOnly",
      "other",
      "revoked",
      "expired",
      "inactive",
      "inactiveContact",
      "inactiveWorkspace",
    ].map((label) => [
      label,
      {
        label,
        userId: randomUUID(),
        identityId: randomUUID(),
        contactId: randomUUID(),
        grantId: randomUUID(),
        email: "",
        password: "",
        client: null,
      },
    ]),
  ),
};

let cleanupCompleted = false;
let exactResidueCount = null;
let namespaceResidueCount = null;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function redact(value) {
  let message = value instanceof Error ? value.message : String(value);
  for (const secret of secrets) {
    if (typeof secret === "string" && secret.length > 0) {
      message = message.replaceAll(secret, "[redacted]");
      message = message.replaceAll(encodeURIComponent(secret), "[redacted]");
    }
  }
  return message
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted-jwt]")
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "postgres://[redacted]")
    .replace(/(?:password|apikey|api_key|access_token|refresh_token|bearer)=\S+/gi, "$1=[redacted]");
}

function sqlText(value) {
  if (value === null || value === undefined) return "null";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlUuid(value) {
  return `${sqlText(value)}::uuid`;
}

function sqlCapabilities(values) {
  return `array[${values.map(sqlText).join(", ")}]::text[]`;
}

function runSupabaseCli(args, options = {}) {
  const isWindows = process.platform === "win32";
  const executable = isWindows ? process.execPath : "npx";
  const executableArgs = isWindows
    ? [
        path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npx-cli.js"),
        "--yes",
        "supabase",
        ...args,
      ]
    : ["--yes", "supabase", ...args];
  const result = spawnSync(executable, executableArgs, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 40 * 1024 * 1024,
  });
  if (result.status !== 0) {
    const detail = options.sensitiveOutput
      ? "Sensitive command output was suppressed."
      : [result.error?.message, result.stderr, result.stdout].filter(Boolean).join("\n");
    throw new Error(`Hosted Supabase CLI command failed: ${redact(detail || "No diagnostic was returned.")}`);
  }
  return (options.includeStderr ? [result.stdout, result.stderr].filter(Boolean).join("\n") : result.stdout).trim();
}

function parseCliJson(output, stage) {
  try {
    return JSON.parse(output);
  } catch {
    throw new Error(`${stage} returned unreadable JSON.`);
  }
}

function runHostedSql(sql, stage = "Hosted database query") {
  const file = path.join(tmpdir(), `project-local-hosted-${randomUUID()}.sql`);
  writeFileSync(file, sql, "utf8");
  let output;
  try {
    output = runSupabaseCli(["db", "query", "--linked", "--file", file, "--output", "json"]);
  } finally {
    try {
      unlinkSync(file);
    } catch {
      // Best-effort cleanup only; the temp file contains disposable validation SQL, not credentials.
    }
  }
  const result = parseCliJson(output, stage);
  assert(Array.isArray(result.rows), `${stage} omitted rows.`);
  return result.rows;
}

function latestHostedMigration() {
  return runHostedSql(
    "select version from supabase_migrations.schema_migrations order by version desc limit 1;",
    "Hosted migration-level check",
  )[0]?.version;
}

async function localMigrationVersionsAfter(version) {
  const files = await readdir(path.join(root, "supabase", "migrations"));
  return files
    .map((file) => file.match(/^(\d{14})_/))
    .filter(Boolean)
    .map((match) => match[1])
    .filter((candidate) => candidate > version)
    .sort();
}

function normalizeGeneratedTypes(source) {
  return source
    .replace(/\r\n/g, "\n")
    .replace(
      /\n\s*__InternalSupabase:\s*{\s*\n\s*PostgrestVersion:\s*"[^"]+"\s*\n\s*}\s*(?=\n\s*public:)/m,
      "",
    )
    .trim();
}

async function verifyGeneratedTypes() {
  const localTypes = await readFile(path.join(root, "lib", "supabase", "database.types.ts"), "utf8");
  const hostedTypes = runSupabaseCli(["gen", "types", "typescript", "--linked", "--schema", "public"], {
    sensitiveOutput: true,
  });
  assert(
    normalizeGeneratedTypes(hostedTypes) === normalizeGeneratedTypes(localTypes),
    "Hosted generated public-schema types differ from the committed generated types.",
  );
}

async function verifyTargetAndReadAnonKey() {
  assert(
    process.env.RUN_HOSTED_CALENDAR_ASSIGNMENT_MANAGEMENT_VALIDATION === expectedConfirmation,
    `Refusing hosted validation without RUN_HOSTED_CALENDAR_ASSIGNMENT_MANAGEMENT_VALIDATION=${expectedConfirmation}.`,
  );
  const linkedRef = (await readFile(path.join(root, "supabase", ".temp", "project-ref"), "utf8")).trim();
  assert(linkedRef === expectedRef, "The linked project is not the approved staging ref.");
  const projectsResult = parseCliJson(
    runSupabaseCli(["projects", "list", "--output", "json"]),
    "Hosted project discovery",
  );
  const projects = Array.isArray(projectsResult) ? projectsResult : projectsResult.projects;
  const project = projects?.find((entry) => entry.ref === expectedRef);
  assert(
    project?.name === expectedName && project?.status === "ACTIVE_HEALTHY",
    "Approved staging is not ACTIVE_HEALTHY and linked.",
  );

  const apiKeys = parseCliJson(
    runSupabaseCli(["projects", "api-keys", "--project-ref", expectedRef, "--output", "json"], {
      sensitiveOutput: true,
    }),
    "Hosted API-key discovery",
  );
  for (const entry of apiKeys) if (typeof entry.api_key === "string") secrets.add(entry.api_key);
  const anonKey = apiKeys.find((entry) => entry.name === "anon")?.api_key;
  assert(typeof anonKey === "string" && anonKey.length > 100, "Hosted anon key is unavailable.");
  return { anonKey, projectStatus: project.status };
}

async function ensureExpectedMigrationApplied() {
  const before = latestHostedMigration();
  assert(
    before === expectedBeforeMigration || before === expectedAfterMigration,
    `Hosted staging latest migration is ${before ?? "unavailable"}, not ${expectedBeforeMigration} or ${expectedAfterMigration}.`,
  );

  if (before === expectedBeforeMigration) {
    const localPending = await localMigrationVersionsAfter(before);
    assert(
      JSON.stringify(localPending) === JSON.stringify([expectedAfterMigration]),
      `Unexpected local pending migrations for hosted staging: ${localPending.join(", ") || "none"}.`,
    );

    const dryRun = runSupabaseCli(["db", "push", "--linked", "--dry-run", "--yes"], {
      includeStderr: true,
    });
    assert(
      dryRun.includes(expectedMigrationFile) || dryRun.includes(expectedAfterMigration),
      "Hosted migration dry-run did not identify the reviewed 12.18 migration.",
    );
    for (const match of dryRun.matchAll(/\b20\d{12}\b/g)) {
      assert(
        match[0] <= expectedBeforeMigration || match[0] === expectedAfterMigration,
        `Hosted migration dry-run included unexpected migration ${match[0]}.`,
      );
    }

    runSupabaseCli(["db", "push", "--linked", "--yes"], { sensitiveOutput: true });
  }

  const after = latestHostedMigration();
  assert(after === expectedAfterMigration, `Hosted staging did not reach ${expectedAfterMigration}.`);
  return { before, after };
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? collectFiles(entryPath) : [entryPath];
  }))).flat();
}

async function verifyStaticBoundaries() {
  const [migration, picker, routeRead, route, client, assignmentServer, packageJson] = await Promise.all([
    readFile(path.join(root, "supabase", "migrations", expectedMigrationFile), "utf8"),
    readFile(path.join(root, "lib", "calendar", "assignmentPicker.server.ts"), "utf8"),
    readFile(path.join(root, "lib", "calendar", "routeRead.server.ts"), "utf8"),
    readFile(path.join(root, "app", "admin", "calendar", "page.tsx"), "utf8"),
    readFile(path.join(root, "components", "CalendarClient.tsx"), "utf8"),
    readFile(path.join(root, "lib", "assignments", "server.ts"), "utf8"),
    readFile(path.join(root, "package.json"), "utf8"),
  ]);
  assert(migration.includes("create_calendar_assignments_batch"), "12.18 batch assignment RPC migration is missing.");
  assert(migration.includes("p_volunteer_profile_ids uuid[]"), "Batch assignment RPC does not accept the reviewed id array.");
  assert(migration.includes("selected_count > 25"), "Batch assignment RPC does not enforce the 25-volunteer maximum.");
  assert(migration.includes("readiness_status = 'ready'"), "Batch assignment RPC does not require ready volunteer profiles.");
  assert(migration.includes("response_status") && migration.includes("'needs_response'"), "Batch assignment RPC does not initialize needs_response rows.");
  assert(migration.includes("grant execute on function public.create_calendar_assignments_batch"), "Batch assignment RPC execute grant is missing.");
  assert(!/grant (?:insert|update|delete|all).*calendar_assignments.*to authenticated/i.test(migration), "12.18 migration broadened assignment direct table writes.");
  assert(picker.includes('from("volunteer_profiles")'), "Assignment picker does not query persisted volunteer profiles.");
  assert(picker.includes("missing_volunteers_view") && picker.includes("canViewVolunteers"), "Assignment picker is not volunteers.view gated.");
  assert(picker.includes("full_name") && picker.includes("congregation"), "Assignment picker projection is not the reviewed identity projection.");
  assert(!picker.includes("email") && !picker.includes("phone") && !picker.includes("select(\"*\")"), "Assignment picker projects unsafe fields or select-star.");
  assert(routeRead.includes("readCalendarAssignmentPickerWithClient"), "Calendar route does not use the persisted assignment picker.");
  assert(routeRead.includes("canEditAssignments") && routeRead.includes("assignments.edit"), "Calendar route does not derive assignment edit capability.");
  assert(routeRead.includes("canViewVolunteers") && routeRead.includes("volunteers.view"), "Calendar route does not derive volunteers.view for picker state.");
  assert(route.includes("createCalendarAssignmentsAction") && route.includes("cancelCalendarAssignmentAction"), "Calendar route does not expose reviewed assignment server actions.");
  assert(client.includes("Assign selected") && client.includes("Remove assignment"), "Calendar UI assignment create/cancel controls are missing.");
  assert(assignmentServer.includes("create_calendar_assignments_batch") && assignmentServer.includes("cancel_calendar_assignment"), "Assignment server helpers do not use reviewed RPCs.");
  assert(packageJson.includes("test:calendar-assignment-management:hosted"), "Hosted assignment-management package script is missing.");
  assert(!/SUPABASE_SERVICE_ROLE_KEY|createServiceRole|auth\.admin/i.test(`${picker}\n${routeRead}\n${route}\n${client}\n${assignmentServer}`), "Assignment management product path references a service-role shortcut.");
  assert(
    !/issue_assignment_response_link|create_assignment_response_token|reveal_assignment_response|sendAssignment|sendEmail|publishCalendar|published_live/i.test(`${route}\n${client}`),
    "12.18 route/UI appears to activate out-of-scope publication, email, or response-link behavior.",
  );

  for (const directory of ["app", "components"]) {
    for (const file of (await collectFiles(path.join(root, directory))).filter((entry) => /\.(?:ts|tsx)$/.test(entry))) {
      const content = await readFile(file, "utf8");
      assert(!content.includes("select(\"*\")") && !content.includes("select('*')"), `Product route/component introduced select-star: ${path.relative(root, file)}`);
    }
  }
}

function authUserSql({ userId, identityId, email, password }) {
  return `insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000'::uuid, ${sqlUuid(userId)},
  'authenticated', 'authenticated', ${sqlText(email)},
  extensions.crypt(${sqlText(password)}, extensions.gen_salt('bf')), clock_timestamp(),
  '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb, clock_timestamp(), clock_timestamp()
);
insert into auth.identities (
  provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, id
) values (
  ${sqlText(userId)}, ${sqlUuid(userId)},
  jsonb_build_object('sub', ${sqlText(userId)}, 'email', ${sqlText(email)}),
  'email', clock_timestamp(), clock_timestamp(), clock_timestamp(), ${sqlUuid(identityId)}
);`;
}

function userValues(label) {
  const user = fixture.users[label];
  user.email = `${fixture.namespace}-${label}@example.invalid`;
  user.password = `${randomBytes(24).toString("base64url")}aA1!`;
  secrets.add(user.email);
  secrets.add(user.password);
  return user;
}

function workspaceRowSql(id, key, name, lifecycle = "active") {
  return `(${sqlUuid(id)}, ${sqlText(key)}, ${sqlText(name)}, ${sqlText(lifecycle)}, 'America/Denver', '2026-08-01'::date, '2026-12-31'::date, false)`;
}

function grantRowSql(label, workspaceId, role, capabilities, status = "active", validity = "current") {
  const user = fixture.users[label];
  const revokedAt = status === "revoked" ? "clock_timestamp()" : "null";
  const validFrom =
    validity === "expired" ? "clock_timestamp() - interval '4 days'" : "clock_timestamp() - interval '1 day'";
  const validUntil = validity === "expired" ? "clock_timestamp() - interval '1 day'" : "null";
  return `(${sqlUuid(user.grantId)}, ${sqlUuid(workspaceId)}, ${sqlUuid(user.contactId)}, ${sqlText(role)}, ${sqlCapabilities(capabilities)}, ${sqlText(status)}, ${validFrom}, ${validUntil}, ${revokedAt})`;
}

function volunteerRowSql(id, workspaceId, fullName, readinessStatus = "ready", lifecycle = "active", contactId = fixture.users.full.contactId) {
  return `(${sqlUuid(id)}, ${sqlUuid(workspaceId)}, null, 'manual', ${sqlUuid(contactId)}, clock_timestamp(), ${sqlText(lifecycle)}, ${sqlText(readinessStatus)}, ${sqlText(fullName)}, ${sqlText(`${fullName.replaceAll(" ", ".").toLowerCase()}@example.invalid`)}, '+1 555 010 1200', 'Bozeman QA', 'Email', '{}'::jsonb, '{}'::jsonb, 'Private hosted QA note')`;
}

async function createFixtures(anonKey) {
  for (const label of Object.keys(fixture.users)) userValues(label);

  runHostedSql(`begin;
${Object.values(fixture.users)
  .map((user) =>
    authUserSql({
      userId: user.userId,
      identityId: user.identityId,
      email: user.email,
      password: user.password,
    }),
  )
  .join("\n")}
commit;
select 'auth-created' as fixture_state;`, "Hosted Calendar assignment Auth fixture creation");

  const fullCaps = ["workspace.read", "calendar.view", "assignments.view", "calendar.edit", "assignments.edit", "volunteers.view", "tasks.view"];
  runHostedSql(`begin;
insert into public.workspaces (
  id, workspace_key, display_name, lifecycle, timezone, starts_on, ends_on, public_intake_enabled
) values
  ${workspaceRowSql(fixture.workspaceId, `${fixture.namespace}-target`, "QA 12.18.1 Calendar Assignment Target Workspace")},
  ${workspaceRowSql(fixture.otherWorkspaceId, `${fixture.namespace}-other`, "QA 12.18.1 Calendar Assignment Other Workspace")},
  ${workspaceRowSql(fixture.inactiveWorkspaceId, `${fixture.namespace}-inactive`, "QA 12.18.1 Calendar Assignment Inactive Workspace", "archived")};

insert into public.project_contacts (id, auth_user_id, status)
values
  ${Object.values(fixture.users)
    .map((user) => `(${sqlUuid(user.contactId)}, ${sqlUuid(user.userId)}, ${user.label === "inactiveContact" ? "'inactive'" : "'active'"})`)
    .join(",\n  ")};

insert into public.workspace_contact_grants (
  id, workspace_id, project_contact_id, role, capabilities, status, valid_from, valid_until, revoked_at
) values
  ${grantRowSql("full", fixture.workspaceId, "main_contact", fullCaps)},
  ${grantRowSql("viewOnly", fixture.workspaceId, "assistant_contact", ["workspace.read", "calendar.view", "assignments.view", "volunteers.view"])},
  ${grantRowSql("noVolunteers", fixture.workspaceId, "assistant_contact", ["workspace.read", "calendar.view", "assignments.view", "assignments.edit"])},
  ${grantRowSql("calendarOnly", fixture.workspaceId, "assistant_contact", ["workspace.read", "calendar.view", "calendar.edit"])},
  ${grantRowSql("volunteersOnly", fixture.workspaceId, "assistant_contact", ["workspace.read", "volunteers.view"])},
  ${grantRowSql("assignmentsViewOnly", fixture.workspaceId, "assistant_contact", ["workspace.read", "assignments.view"])},
  ${grantRowSql("tasksOnly", fixture.workspaceId, "assistant_contact", ["workspace.read", "tasks.view"])},
  ${grantRowSql("roleOnly", fixture.workspaceId, "main_contact", ["workspace.read"])},
  ${grantRowSql("other", fixture.otherWorkspaceId, "main_contact", fullCaps)},
  ${grantRowSql("revoked", fixture.workspaceId, "main_contact", fullCaps, "revoked")},
  ${grantRowSql("expired", fixture.workspaceId, "main_contact", fullCaps, "active", "expired")},
  ${grantRowSql("inactive", fixture.workspaceId, "main_contact", fullCaps, "inactive")},
  ${grantRowSql("inactiveContact", fixture.workspaceId, "main_contact", fullCaps)},
  ${grantRowSql("inactiveWorkspace", fixture.inactiveWorkspaceId, "main_contact", fullCaps)};

insert into public.volunteer_profiles (
  id, workspace_id, source_submission_id, profile_source, manual_created_by_project_contact_id,
  manual_created_at, lifecycle, readiness_status, full_name, email, phone, congregation,
  preferred_contact_method, availability_snapshot, skills_help_snapshot, profile_notes
) values
  ${volunteerRowSql(fixture.volunteers.readyA, fixture.workspaceId, `${fixture.namespace} Ready A`)},
  ${volunteerRowSql(fixture.volunteers.readyB, fixture.workspaceId, `${fixture.namespace} Ready B`)},
  ${volunteerRowSql(fixture.volunteers.readyC, fixture.workspaceId, `${fixture.namespace} Ready C`)},
  ${volunteerRowSql(fixture.volunteers.readyD, fixture.workspaceId, `${fixture.namespace} Ready D`)},
  ${volunteerRowSql(fixture.volunteers.onHold, fixture.workspaceId, `${fixture.namespace} On Hold`, "on_hold")},
  ${volunteerRowSql(fixture.volunteers.inactive, fixture.workspaceId, `${fixture.namespace} Inactive`, "ready", "inactive")},
  ${volunteerRowSql(fixture.volunteers.other, fixture.otherWorkspaceId, `${fixture.namespace} Other`, "ready", "active", fixture.users.other.contactId)};
commit;
select 'product-created' as fixture_state;`, "Hosted Calendar assignment product fixture creation");

  for (const user of Object.values(fixture.users)) {
    const client = createClient(hostedUrl, anonKey, {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    });
    const signin = await client.auth.signInWithPassword({
      email: user.email,
      password: user.password,
    });
    assert(!signin.error && signin.data.session, `Hosted ${user.label} sign-in failed.`);
    secrets.add(signin.data.session.access_token);
    secrets.add(signin.data.session.refresh_token);
    user.client = client;
  }
}

function calendarCreateArgs(overrides = {}) {
  return {
    p_workspace_id: fixture.workspaceId,
    p_task_preset_id: null,
    p_one_off_title: `${fixture.namespace} Assignment Item`,
    p_one_off_task_type: "general",
    p_schedule_kind: "timed",
    p_start_date: "2026-08-20",
    p_end_date: null,
    p_start_time: "09:00",
    p_end_time: "11:00",
    p_needed_count: 1,
    p_schedule_notes: "Hosted assignment validation.",
    p_custom_values: {},
    ...overrides,
  };
}

async function expectFailure(operation, label) {
  try {
    const result = await operation;
    if (result && typeof result === "object" && "error" in result && result.error) {
      return;
    }
  } catch {
    return;
  }
  throw new Error(`${label} should have failed closed.`);
}

async function createCalendarItem(client, overrides = {}) {
  const { data, error } = await client.rpc("create_calendar_item", calendarCreateArgs(overrides));
  if (error || typeof data !== "string") throw new Error("Hosted Calendar item create failed.");
  return data;
}

async function createAssignmentsBatch(client, calendarItemId, volunteerProfileIds, note = null, extra = {}) {
  const normalized = validateCreateAssignmentBatchInput({
    calendarItemId,
    volunteerProfileIds,
    note,
  });
  const { data, error } = await client.rpc("create_calendar_assignments_batch", {
    p_calendar_item_id: normalized.calendarItemId,
    p_volunteer_profile_ids: [...normalized.volunteerProfileIds],
    p_assignment_note: normalized.note,
    ...extra,
  });
  if (error || !Array.isArray(data)) throw new Error("Hosted assignment batch create failed.");
  return data;
}

async function cancelAssignment(client, assignmentId) {
  const normalized = validateCancelAssignmentInput({ assignmentId });
  const { data, error } = await client.rpc("cancel_calendar_assignment", {
    p_assignment_id: normalized.assignmentId,
  });
  if (error || typeof data !== "string") throw new Error("Hosted assignment cancel failed.");
  return data;
}

async function updateAssignmentResponse(client, assignmentId, status, note = null) {
  const { data, error } = await client.rpc("update_assignment_response", {
    p_assignment_id: assignmentId,
    p_response_status: status,
    p_response_note: note,
  });
  if (error || typeof data !== "string") throw new Error("Hosted assignment response update failed.");
  return data;
}

function readAssignments() {
  return runHostedSql(`select assignment.id, assignment.workspace_id, assignment.calendar_item_id,
       assignment.volunteer_profile_id, assignment.lifecycle, assignment.assignment_note,
       response.response_status, response.response_source, response.responded_at is not null as has_responded_at
from public.calendar_assignments as assignment
left join public.assignment_responses as response
  on response.workspace_id = assignment.workspace_id
 and response.assignment_id = assignment.id
where assignment.workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)}, ${sqlUuid(fixture.inactiveWorkspaceId)})
order by assignment.created_at, assignment.id;`, "Hosted assignment row check");
}

async function readPicker(client, canViewVolunteers, itemIds = []) {
  return readCalendarAssignmentPickerWithClient({
    client,
    workspaceId: fixture.workspaceId,
    calendarItemIds: itemIds,
    canViewVolunteers,
  });
}

async function readTargetCalendarItem(client, calendarItemId) {
  const result = await readCalendarReadModelWithClient({
    client,
    workspaceId: fixture.workspaceId,
    actorContactId: fixture.users.full.contactId,
    workspaceTimezone: "America/Denver",
    rangeStart: "2026-08-19",
    rangeEnd: "2026-08-22",
    periodKind: "week",
    capabilities: ["calendar.view", "assignments.view"],
  });
  assert(result.ok, "Hosted Calendar read model did not return safe persisted items.");
  const item = result.items.find((candidate) => candidate.calendarItemId === calendarItemId);
  assert(item, "Hosted Calendar read model omitted the target assignment item.");
  assert(!("filledCount" in item) && !("assignedVolunteerIds" in item), "Hosted read model exposed mock-style Calendar counters.");
  return item;
}

function verifyHostedSchema() {
  const functions = runHostedSql(`select proname
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in (
    'create_calendar_assignment',
    'create_calendar_assignments_batch',
    'cancel_calendar_assignment',
    'update_assignment_response'
  )
order by proname;`, "Hosted assignment RPC check").map((row) => row.proname);
  assert(
    JSON.stringify(functions) === JSON.stringify([
      "cancel_calendar_assignment",
      "create_calendar_assignment",
      "create_calendar_assignments_batch",
      "update_assignment_response",
    ]),
    "Hosted assignment RPC set is incomplete.",
  );

  const privileges = runHostedSql(`select
  has_table_privilege('authenticated', 'public.calendar_assignments', 'INSERT') as assignment_insert,
  has_table_privilege('authenticated', 'public.calendar_assignments', 'UPDATE') as assignment_update,
  has_table_privilege('authenticated', 'public.calendar_assignments', 'DELETE') as assignment_delete,
  has_table_privilege('authenticated', 'public.assignment_responses', 'INSERT') as response_insert,
  has_table_privilege('authenticated', 'public.assignment_responses', 'UPDATE') as response_update,
  has_table_privilege('authenticated', 'public.assignment_responses', 'DELETE') as response_delete,
  has_table_privilege('authenticated', 'public.volunteer_profiles', 'INSERT') as volunteer_insert,
  has_table_privilege('authenticated', 'public.volunteer_profiles', 'UPDATE') as volunteer_update,
  has_table_privilege('authenticated', 'public.volunteer_profiles', 'DELETE') as volunteer_delete,
  has_table_privilege('authenticated', 'public.calendar_items', 'INSERT') as calendar_insert,
  has_table_privilege('authenticated', 'public.calendar_items', 'UPDATE') as calendar_update,
  has_table_privilege('authenticated', 'public.calendar_items', 'DELETE') as calendar_delete;`, "Hosted assignment table privilege check")[0];
  for (const [key, value] of Object.entries(privileges)) {
    assert(value === false, `Authenticated role has direct ${key} privilege.`);
  }
}

async function verifyDirectTableWriteDenial() {
  const client = fixture.users.full.client;
  const assignmentId = fixture.createdAssignmentIds[1];
  const directAssignmentInsert = await client.from("calendar_assignments").insert({
    workspace_id: fixture.workspaceId,
    calendar_item_id: fixture.primaryCalendarItemId,
    volunteer_profile_id: fixture.volunteers.readyD,
    lifecycle: "active",
  });
  assert(directAssignmentInsert.error, "Hosted direct calendar_assignments insert was allowed.");
  const directAssignmentUpdate = await client.from("calendar_assignments").update({ lifecycle: "canceled" }).eq("id", assignmentId);
  assert(directAssignmentUpdate.error, "Hosted direct calendar_assignments update was allowed.");
  const directAssignmentDelete = await client.from("calendar_assignments").delete().eq("id", assignmentId);
  assert(directAssignmentDelete.error, "Hosted direct calendar_assignments delete was allowed.");

  const directResponseInsert = await client.from("assignment_responses").insert({
    workspace_id: fixture.workspaceId,
    assignment_id: assignmentId,
    response_status: "confirmed",
    response_source: "project_contact",
    responded_at: new Date().toISOString(),
  });
  assert(directResponseInsert.error, "Hosted direct assignment_responses insert was allowed.");
  const directResponseUpdate = await client.from("assignment_responses").update({ response_status: "confirmed" }).eq("assignment_id", assignmentId);
  assert(directResponseUpdate.error, "Hosted direct assignment_responses update was allowed.");
  const directResponseDelete = await client.from("assignment_responses").delete().eq("assignment_id", assignmentId);
  assert(directResponseDelete.error, "Hosted direct assignment_responses delete was allowed.");

  const directVolunteerInsert = await client.from("volunteer_profiles").insert({
    workspace_id: fixture.workspaceId,
    profile_source: "manual",
    lifecycle: "active",
    readiness_status: "ready",
    full_name: `${fixture.namespace} Direct Volunteer`,
  });
  assert(directVolunteerInsert.error, "Hosted direct volunteer_profiles insert was allowed.");
  const directVolunteerUpdate = await client.from("volunteer_profiles").update({ full_name: "Direct Volunteer Update" }).eq("id", fixture.volunteers.readyB);
  assert(directVolunteerUpdate.error, "Hosted direct volunteer_profiles update was allowed.");
  const directVolunteerDelete = await client.from("volunteer_profiles").delete().eq("id", fixture.volunteers.readyB);
  assert(directVolunteerDelete.error, "Hosted direct volunteer_profiles delete was allowed.");

  const directCalendarInsert = await client.from("calendar_items").insert({
    workspace_id: fixture.workspaceId,
    title_snapshot: "Direct Calendar Insert",
    task_type_snapshot: "general",
    schedule_kind: "timed",
    start_date: "2026-08-20",
    start_time: "09:00",
    end_time: "10:00",
    timezone: "America/Denver",
    needed_count: 1,
    custom_values: {},
  });
  assert(directCalendarInsert.error, "Hosted direct calendar_items insert was allowed.");
  const directCalendarUpdate = await client.from("calendar_items").update({ title_snapshot: "Direct Calendar Update" }).eq("id", fixture.primaryCalendarItemId);
  assert(directCalendarUpdate.error, "Hosted direct calendar_items update was allowed.");
  const directCalendarDelete = await client.from("calendar_items").delete().eq("id", fixture.primaryCalendarItemId);
  assert(directCalendarDelete.error, "Hosted direct calendar_items delete was allowed.");
}

async function verifyHostedBehavior() {
  verifyHostedSchema();

  const full = fixture.users.full.client;
  const viewOnly = fixture.users.viewOnly.client;
  const noVolunteers = fixture.users.noVolunteers.client;
  const calendarOnly = fixture.users.calendarOnly.client;
  const volunteersOnly = fixture.users.volunteersOnly.client;
  const assignmentsViewOnly = fixture.users.assignmentsViewOnly.client;
  const tasksOnly = fixture.users.tasksOnly.client;
  const roleOnly = fixture.users.roleOnly.client;
  const other = fixture.users.other.client;

  fixture.primaryCalendarItemId = await createCalendarItem(full);
  fixture.atomicCalendarItemId = await createCalendarItem(full, {
    p_one_off_title: `${fixture.namespace} Atomic Item`,
    p_start_time: "12:00",
    p_end_time: "13:00",
  });
  fixture.singleCompatItemId = await createCalendarItem(full, {
    p_one_off_title: `${fixture.namespace} Single Assignment Compatibility Item`,
    p_start_time: "14:00",
    p_end_time: "15:00",
  });
  fixture.presetCalendarItemId = await createCalendarItem(full, {
    p_one_off_title: `${fixture.namespace} Preset-Compatible Item`,
    p_start_time: "15:30",
    p_end_time: "16:30",
  });
  fixture.otherCalendarItemId = await createCalendarItem(other, {
    p_workspace_id: fixture.otherWorkspaceId,
    p_one_off_title: `${fixture.namespace} Other Workspace Item`,
  });

  const picker = await readPicker(full, true, [fixture.primaryCalendarItemId]);
  assert(picker.kind === "ready", "Hosted assignment picker was not ready for volunteers.view contact.");
  assert(
    JSON.stringify(picker.volunteers.map((volunteer) => volunteer.id)) ===
      JSON.stringify([fixture.volunteers.readyA, fixture.volunteers.readyB, fixture.volunteers.readyC, fixture.volunteers.readyD]),
    "Hosted picker did not include only active ready same-workspace volunteers.",
  );
  assert(picker.volunteers[0].displayName.includes("Ready A"), "Hosted picker did not project display name.");
  assert("congregation" in picker.volunteers[0], "Hosted picker did not project congregation.");
  assert(!("email" in picker.volunteers[0]) && !("phone" in picker.volunteers[0]) && !("profile_notes" in picker.volunteers[0]), "Hosted picker exposed unsafe volunteer fields.");
  assert(!picker.volunteers.some((volunteer) => volunteer.id === fixture.volunteers.other), "Hosted picker leaked wrong-workspace volunteer.");
  assert(!picker.volunteers.some((volunteer) => volunteer.id === fixture.volunteers.onHold || volunteer.id === fixture.volunteers.inactive), "Hosted picker included ineligible volunteers.");

  for (const [label, client, canViewVolunteers] of [
    ["no volunteers.view", noVolunteers, false],
    ["calendar.edit only", calendarOnly, false],
    ["assignments.view only", assignmentsViewOnly, false],
    ["assignments.edit without volunteers.view", noVolunteers, false],
    ["tasks only", tasksOnly, false],
    ["role/title only", roleOnly, false],
  ]) {
    const state = await readPicker(client, canViewVolunteers, [fixture.primaryCalendarItemId]);
    assert(state.kind === "unavailable", `Hosted picker did not fail closed for ${label}.`);
  }

  const emptyPicker = await readCalendarAssignmentPickerWithClient({
    client: full,
    workspaceId: fixture.workspaceId,
    calendarItemIds: [],
    canViewVolunteers: true,
  });
  assert(emptyPicker.kind === "ready" && emptyPicker.assignments.length === 0, "Hosted picker did not preserve a safe empty assignment state.");

  fixture.createdAssignmentIds = await createAssignmentsBatch(
    full,
    fixture.primaryCalendarItemId,
    [fixture.volunteers.readyA, fixture.volunteers.readyB],
    "Bring gloves.",
  );
  assert(fixture.createdAssignmentIds.length === 2, "Hosted batch assignment did not create all selected rows.");

  let rows = readAssignments().filter((row) => row.calendar_item_id === fixture.primaryCalendarItemId);
  assert(rows.length === 2, "Hosted batch assignment did not persist two assignment rows.");
  assert(rows.every((row) => row.workspace_id === fixture.workspaceId && row.lifecycle === "active"), "Hosted batch assignment persisted wrong workspace/lifecycle.");
  assert(rows.every((row) => row.response_status === "needs_response" && row.response_source === "project_contact"), "Hosted batch assignment did not initialize needs_response project-contact rows.");
  assert(rows.every((row) => row.assignment_note === "Bring gloves."), "Hosted batch assignment did not persist bounded note.");

  let readItem = await readTargetCalendarItem(full, fixture.primaryCalendarItemId);
  assert(readItem.assignedFractionLabel === "2/1 assigned", "Hosted over-assignment did not derive the expected assigned fraction.");
  assert(readItem.coverage.assignedCount === 2 && readItem.coverage.waitingOnConfirmationCount === 2, "Hosted over-assignment did not count needs_response assignments as active assigned coverage.");

  await expectFailure(createAssignmentsBatch(full, fixture.primaryCalendarItemId, [fixture.volunteers.readyA]), "Hosted duplicate active assignment");
  await expectFailure(createAssignmentsBatch(full, fixture.atomicCalendarItemId, [fixture.volunteers.readyC, fixture.volunteers.readyC]), "Hosted duplicate ids in one request");
  const beforeAtomic = readAssignments().filter((row) => row.calendar_item_id === fixture.atomicCalendarItemId).length;
  await expectFailure(createAssignmentsBatch(full, fixture.atomicCalendarItemId, [fixture.volunteers.readyC, fixture.volunteers.onHold]), "Hosted atomic batch with on-hold volunteer");
  const afterAtomic = readAssignments().filter((row) => row.calendar_item_id === fixture.atomicCalendarItemId).length;
  assert(beforeAtomic === afterAtomic, "Hosted failed atomic batch left partial assignment residue.");
  await expectFailure(createAssignmentsBatch(full, fixture.primaryCalendarItemId, [fixture.volunteers.other]), "Hosted wrong-workspace volunteer assignment");
  await expectFailure(createAssignmentsBatch(full, fixture.primaryCalendarItemId, []), "Hosted empty assignment selection");
  await expectFailure(createAssignmentsBatch(full, fixture.primaryCalendarItemId, Array.from({ length: 26 }, () => fixture.volunteers.readyC)), "Hosted oversized assignment selection");
  await expectFailure(createAssignmentsBatch(full, fixture.primaryCalendarItemId, [fixture.volunteers.readyC], "x".repeat(2001)), "Hosted oversized assignment note");
  const blankNoteAssignment = await createAssignmentsBatch(full, fixture.atomicCalendarItemId, [fixture.volunteers.readyD], "   ");
  const blankNoteRow = readAssignments().find((row) => row.id === blankNoteAssignment[0]);
  assert(blankNoteRow?.assignment_note === null, "Hosted blank optional assignment note did not normalize to null.");

  fixture.createdAssignmentIds.push(...await createAssignmentsBatch(full, fixture.primaryCalendarItemId, [fixture.volunteers.readyC], null));
  await updateAssignmentResponse(full, fixture.createdAssignmentIds[1], "confirmed", "Confirmed by scheduler.");
  await updateAssignmentResponse(full, fixture.createdAssignmentIds[2], "declined", "Declined by scheduler.");
  await cancelAssignment(full, fixture.createdAssignmentIds[0]);

  rows = readAssignments().filter((row) => row.calendar_item_id === fixture.primaryCalendarItemId);
  assert(rows.find((row) => row.id === fixture.createdAssignmentIds[0])?.lifecycle === "canceled", "Hosted cancellation did not mark assignment canceled.");
  assert(rows.find((row) => row.id === fixture.createdAssignmentIds[1])?.response_status === "confirmed", "Hosted confirmed response state did not persist.");
  assert(rows.find((row) => row.id === fixture.createdAssignmentIds[2])?.response_status === "declined", "Hosted declined response state did not persist.");

  readItem = await readTargetCalendarItem(full, fixture.primaryCalendarItemId);
  assert(readItem.coverage.assignedCount === 1, "Hosted canceled/declined rows counted toward active assigned coverage.");
  assert(readItem.coverage.confirmedCount === 1, "Hosted confirmed count is wrong.");
  assert(readItem.coverage.deniedCount === 1, "Hosted declined/denied count is wrong.");
  assert(readItem.coverage.waitingOnConfirmationCount === 0, "Hosted waiting count is wrong after response updates.");
  assert(readItem.coverage.unassignedCount === 0, "Hosted unassigned count is wrong.");
  assert(readItem.coverage.coverageState === "some_denied", "Hosted coverage state did not reflect declined assignment.");
  assert(readItem.assignedFractionLabel === "1/1 assigned", "Hosted assigned fraction did not exclude canceled/declined assignments.");

  runHostedSql(`update public.volunteer_profiles
set readiness_status = 'on_hold'
where id = ${sqlUuid(fixture.volunteers.readyB)};`, "Hosted picker assigned-volunteer lifecycle adjustment");
  const assignedPicker = await readPicker(full, true, [fixture.primaryCalendarItemId]);
  assert(assignedPicker.kind === "ready", "Hosted assigned picker failed after volunteer readiness changed.");
  assert(!assignedPicker.volunteers.some((volunteer) => volunteer.id === fixture.volunteers.readyB), "Hosted picker still offered no-longer-ready volunteer.");
  assert(assignedPicker.assignments.some((assignment) => assignment.volunteerProfileId === fixture.volunteers.readyB && assignment.responseStatus === "confirmed"), "Hosted picker did not display current assigned volunteer status after readiness changed.");

  await expectFailure(cancelAssignment(full, fixture.createdAssignmentIds[0]), "Hosted repeated cancellation");
  await expectFailure(cancelAssignment(viewOnly, fixture.createdAssignmentIds[1]), "Hosted view-only cancellation");
  await expectFailure(cancelAssignment(other, fixture.createdAssignmentIds[1]), "Hosted other-workspace cancellation");
  await expectFailure(cancelAssignment(full, randomUUID()), "Hosted fake assignment cancellation");

  for (const [label, client] of [
    ["view-only", viewOnly],
    ["calendar.edit only", calendarOnly],
    ["volunteers.view only", volunteersOnly],
    ["assignments.view only", assignmentsViewOnly],
    ["tasks only", tasksOnly],
    ["role/title only", roleOnly],
    ["other workspace", other],
    ["revoked", fixture.users.revoked.client],
    ["expired", fixture.users.expired.client],
    ["inactive", fixture.users.inactive.client],
    ["inactive contact", fixture.users.inactiveContact.client],
    ["inactive workspace", fixture.users.inactiveWorkspace.client],
  ]) {
    await expectFailure(
      createAssignmentsBatch(client, fixture.primaryCalendarItemId, [fixture.volunteers.readyD]),
      `Hosted ${label} assignment create`,
    );
  }

  await expectFailure(full.rpc("create_calendar_assignments_batch", {
    p_calendar_item_id: "not-a-uuid",
    p_volunteer_profile_ids: [fixture.volunteers.readyD],
    p_assignment_note: null,
  }), "Hosted malformed Calendar item id");
  await expectFailure(full.rpc("create_calendar_assignments_batch", {
    p_calendar_item_id: fixture.primaryCalendarItemId,
    p_volunteer_profile_ids: ["not-a-uuid"],
    p_assignment_note: null,
  }), "Hosted malformed volunteer id");
  await expectFailure(full.rpc("create_calendar_assignments_batch", {
    p_calendar_item_id: fixture.primaryCalendarItemId,
    p_volunteer_profile_ids: [fixture.volunteers.readyD],
    p_assignment_note: null,
    p_workspace_id: fixture.otherWorkspaceId,
  }), "Hosted unsupported browser field");

  const single = await full.rpc("create_calendar_assignment", {
    p_calendar_item_id: fixture.singleCompatItemId,
    p_volunteer_profile_id: fixture.volunteers.readyD,
    p_assignment_note: "Single compatibility.",
  });
  assert(!single.error && typeof single.data === "string", "Hosted existing single-assignment RPC compatibility failed.");
  fixture.singleAssignmentId = single.data;
  await cancelAssignment(full, fixture.singleAssignmentId);

  await verifyDirectTableWriteDenial();

  const tokenCount = runHostedSql(`select count(*)::int as token_count
from public.assignment_response_tokens
where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)}, ${sqlUuid(fixture.inactiveWorkspaceId)});`, "Hosted response-token absence check")[0]?.token_count;
  assert(tokenCount === 0, "Hosted assignment management created response tokens.");

  const profileMutationCheck = runHostedSql(`select full_name, readiness_status, lifecycle
from public.volunteer_profiles
where id = ${sqlUuid(fixture.volunteers.readyC)};`, "Hosted volunteer non-mutation check")[0];
  assert(profileMutationCheck.full_name === `${fixture.namespace} Ready C` && profileMutationCheck.lifecycle === "active", "Hosted assignment management mutated volunteer profile identity/lifecycle.");
}

async function cleanupFixtures() {
  for (const user of Object.values(fixture.users)) {
    if (user.client) await user.client.auth.signOut({ scope: "local" }).catch(() => undefined);
  }
  const userIds = Object.values(fixture.users).map((user) => user.userId);
  const userIdArray = userIds.map(sqlUuid).join(", ");
  const contactIdArray = Object.values(fixture.users).map((user) => sqlUuid(user.contactId)).join(", ");
  runHostedSql(`begin;
delete from public.assignment_response_tokens
where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)}, ${sqlUuid(fixture.inactiveWorkspaceId)});
delete from public.assignment_responses
where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)}, ${sqlUuid(fixture.inactiveWorkspaceId)});
delete from public.calendar_assignments
where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)}, ${sqlUuid(fixture.inactiveWorkspaceId)});
delete from public.calendar_items
where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)}, ${sqlUuid(fixture.inactiveWorkspaceId)})
   or title_snapshot like ${sqlText(`${fixture.namespace}%`)};
delete from public.volunteer_profiles
where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)}, ${sqlUuid(fixture.inactiveWorkspaceId)})
   or full_name like ${sqlText(`${fixture.namespace}%`)};
delete from public.workspace_contact_grants
where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)}, ${sqlUuid(fixture.inactiveWorkspaceId)})
   or project_contact_id in (${contactIdArray});
delete from public.project_contacts
where id in (${contactIdArray})
   or auth_user_id = any(array[${userIdArray}]);
delete from public.workspaces
where id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)}, ${sqlUuid(fixture.inactiveWorkspaceId)})
   or workspace_key like ${sqlText(`${fixture.namespace}%`)};
delete from auth.identities where user_id = any(array[${userIdArray}]);
delete from auth.users where id = any(array[${userIdArray}]);
commit;
select 'cleaned' as fixture_state;`, "Hosted Calendar assignment cleanup");

  exactResidueCount = runHostedSql(`select (
  (select count(*) from public.workspaces where id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)}, ${sqlUuid(fixture.inactiveWorkspaceId)})) +
  (select count(*) from public.project_contacts where auth_user_id = any(array[${userIdArray}])) +
  (select count(*) from public.workspace_contact_grants where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)}, ${sqlUuid(fixture.inactiveWorkspaceId)})) +
  (select count(*) from public.volunteer_profiles where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)}, ${sqlUuid(fixture.inactiveWorkspaceId)})) +
  (select count(*) from public.calendar_items where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)}, ${sqlUuid(fixture.inactiveWorkspaceId)})) +
  (select count(*) from public.calendar_assignments where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)}, ${sqlUuid(fixture.inactiveWorkspaceId)})) +
  (select count(*) from public.assignment_responses where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)}, ${sqlUuid(fixture.inactiveWorkspaceId)})) +
  (select count(*) from public.assignment_response_tokens where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)}, ${sqlUuid(fixture.inactiveWorkspaceId)})) +
  (select count(*) from auth.users where id = any(array[${userIdArray}]))
)::int as residue_count;`, "Hosted Calendar assignment exact residue check")[0]?.residue_count;
  assert(exactResidueCount === 0, "Hosted Calendar assignment fixtures left exact-run residue.");
  cleanupCompleted = true;
}

function verifyNamespaceResidue() {
  namespaceResidueCount = runHostedSql(`select (
  (select count(*) from public.workspaces where workspace_key like 'qa-12-18-1-%') +
  (select count(*) from public.volunteer_profiles where full_name like 'qa-12-18-1-%') +
  (select count(*) from public.calendar_items where title_snapshot like 'qa-12-18-1-%') +
  (select count(*) from auth.users where email like 'qa-12-18-1-%@example.invalid')
)::int as residue_count;`, "Hosted 12.18.1 namespace residue check")[0]?.residue_count;
  assert(namespaceResidueCount === 0, "Hosted qa-12-18-1 namespace left fixture/Auth residue.");
  return namespaceResidueCount;
}

async function main() {
  const { anonKey, projectStatus } = await verifyTargetAndReadAnonKey();
  const { before, after } = await ensureExpectedMigrationApplied();
  await verifyGeneratedTypes();
  try {
    await verifyStaticBoundaries();
    await createFixtures(anonKey);
    await verifyHostedBehavior();
  } finally {
    await cleanupFixtures();
  }
  assert(cleanupCompleted && verifyNamespaceResidue() === 0, "Hosted Calendar assignment cleanup did not complete.");
  console.log("Hosted staging Calendar assignment-management QA passed.");
  console.log(`Validated target ${expectedName} (${expectedRef}) with status ${projectStatus}.`);
  console.log(`Migration level before gate: ${before}; after gate: ${after}.`);
  console.log("Validated picker authorization/projection/filtering, atomic batch create, duplicate/retry failure, over-assignment, response initialization, cancellation, coverage truth, capability isolation, direct table-write denial, blank-note normalization, generated type parity, and compatibility.");
  console.log(`Hosted disposable product and Auth residue: ${exactResidueCount + namespaceResidueCount}.`);
  console.log("No access token, refresh token, password, API key, database URL, bearer, verifier, or service credential was logged.");
}

main().catch((error) => {
  console.error(`Hosted Calendar assignment-management QA failed: ${redact(error)}`);
  process.exitCode = 1;
});
