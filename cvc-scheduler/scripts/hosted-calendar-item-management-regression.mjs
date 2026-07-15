import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
import { writeFileSync, unlinkSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import path from "node:path";

import { readCalendarReadModelWithClient } from "../lib/calendar/readModelQuery.server.ts";

const root = process.cwd();
const expectedRef = "kfuujcfxoayukywvtaeh";
const expectedName = "project-local-staging";
const expectedConfirmation = `${expectedName}:${expectedRef}`;
const expectedBeforeMigration = "20260714121500";
const expectedAfterMigration = "20260714121600";
const expectedMigrationFile = `${expectedAfterMigration}_calendar_item_management.sql`;
const hostedUrl = `https://${expectedRef}.supabase.co`;
const secrets = new Set();

const fixture = {
  namespace: `qa-12-16-1-${randomUUID()}`,
  workspaceId: randomUUID(),
  otherWorkspaceId: randomUUID(),
  taskPresetId: randomUUID(),
  legacyCalendarItemId: randomUUID(),
  createdCalendarItemId: null,
  zeroNeededCalendarItemId: null,
  presetBackedCalendarItemId: null,
  otherWorkspaceCalendarItemId: null,
  users: Object.fromEntries(
    ["full", "viewOnly", "roleOnly", "other", "revoked", "expired", "inactive"].map((label) => [
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
    ? [path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npx-cli.js"), "--yes", "supabase", ...args]
    : ["--yes", "supabase", ...args];
  const result = spawnSync(executable, executableArgs, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 30 * 1024 * 1024,
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
    process.env.RUN_HOSTED_CALENDAR_ITEM_MANAGEMENT_VALIDATION === expectedConfirmation,
    `Refusing hosted validation without RUN_HOSTED_CALENDAR_ITEM_MANAGEMENT_VALIDATION=${expectedConfirmation}.`,
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
      sensitiveOutput: false,
    });
    assert(
      dryRun.includes(expectedMigrationFile) || dryRun.includes(expectedAfterMigration),
      "Hosted migration dry-run did not identify the reviewed 12.16 migration.",
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
  const [migration, server, routeRead, route] = await Promise.all([
    readFile(path.join(root, "supabase", "migrations", expectedMigrationFile), "utf8"),
    readFile(path.join(root, "lib", "calendar", "server.ts"), "utf8"),
    readFile(path.join(root, "lib", "calendar", "routeRead.server.ts"), "utf8"),
    readFile(path.join(root, "app", "admin", "calendar", "page.tsx"), "utf8"),
  ]);
  assert(migration.includes("follow_up_project_contact_id"), "Calendar follow-up contact migration is missing.");
  assert(migration.includes("create or replace function public.create_calendar_item"), "Calendar create RPC replacement is missing.");
  assert(migration.includes("update_calendar_item_one_off_timed"), "Calendar update RPC migration is missing.");
  assert(!/grant (?:insert|update|delete|all).*calendar_items.*to authenticated/i.test(migration), "Calendar migration broadened direct table writes.");
  assert(!/SUPABASE_SERVICE_ROLE_KEY|createServiceRole|auth\.admin/i.test(`${server}\n${routeRead}\n${route}`), "Calendar product path references a service-role shortcut.");
  assert(/readCalendarRouteState/.test(route), "Calendar route is not using the reviewed persisted route read state.");
  assert(/createCalendarItemAction/.test(route), "Calendar route is not using the reviewed create action.");
  assert(/updateCalendarItemAction/.test(route), "Calendar route is not using the reviewed update action.");

  const unsafeImports = [];
  for (const directory of ["app", "components", "lib"]) {
    for (const file of (await collectFiles(path.join(root, directory))).filter((entry) => /\.(?:ts|tsx)$/.test(entry))) {
      const relative = path.relative(root, file).replaceAll("\\", "/");
      const source = await readFile(file, "utf8");
      if (source.includes("hosted-calendar-item-management-regression")) {
        unsafeImports.push(relative);
      }
    }
  }
  assert(unsafeImports.length === 0, "Application code imports the hosted Calendar validation harness.");
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

function workspaceRowSql(id, key, name) {
  return `(${sqlUuid(id)}, ${sqlText(key)}, ${sqlText(name)}, 'active', 'America/Denver', '2026-08-01'::date, '2026-12-31'::date, false)`;
}

function grantRowSql(label, workspaceId, role, capabilities, status = "active", validity = "current") {
  const user = fixture.users[label];
  const revokedAt = status === "revoked" ? "clock_timestamp()" : "null";
  const validFrom =
    validity === "expired" ? "clock_timestamp() - interval '4 days'" : "clock_timestamp() - interval '1 day'";
  const validUntil = validity === "expired" ? "clock_timestamp() - interval '1 day'" : "null";
  return `(${sqlUuid(user.grantId)}, ${sqlUuid(workspaceId)}, ${sqlUuid(user.contactId)}, ${sqlText(role)}, ${sqlCapabilities(capabilities)}, ${sqlText(status)}, ${validFrom}, ${validUntil}, ${revokedAt})`;
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
select 'auth-created' as fixture_state;`, "Hosted Calendar Auth fixture creation");

  const fullCaps = ["workspace.read", "calendar.view", "assignments.view", "calendar.edit"];
  runHostedSql(`begin;
insert into public.workspaces (
  id, workspace_key, display_name, lifecycle, timezone, starts_on, ends_on, public_intake_enabled
) values
  ${workspaceRowSql(fixture.workspaceId, `${fixture.namespace}-target`, "QA 12.16.1 Calendar Target Workspace")},
  ${workspaceRowSql(fixture.otherWorkspaceId, `${fixture.namespace}-other`, "QA 12.16.1 Calendar Other Workspace")};

insert into public.project_contacts (id, auth_user_id, status)
values
  ${Object.values(fixture.users)
    .map((user) => `(${sqlUuid(user.contactId)}, ${sqlUuid(user.userId)}, 'active')`)
    .join(",\n  ")};

insert into public.workspace_contact_grants (
  id, workspace_id, project_contact_id, role, capabilities, status, valid_from, valid_until, revoked_at
) values
  ${grantRowSql("full", fixture.workspaceId, "main_contact", fullCaps)},
  ${grantRowSql("viewOnly", fixture.workspaceId, "assistant_contact", ["workspace.read", "calendar.view", "assignments.view"])},
  ${grantRowSql("roleOnly", fixture.workspaceId, "main_contact", ["workspace.read"])},
  ${grantRowSql("other", fixture.otherWorkspaceId, "main_contact", fullCaps)},
  ${grantRowSql("revoked", fixture.workspaceId, "assistant_contact", fullCaps, "revoked")},
  ${grantRowSql("expired", fixture.workspaceId, "assistant_contact", fullCaps, "active", "expired")},
  ${grantRowSql("inactive", fixture.workspaceId, "assistant_contact", fullCaps, "inactive")};

insert into public.task_presets (
  id, workspace_id, name, task_type, default_needed_count, volunteer_visible,
  is_system_preset, custom_field_definitions, lifecycle
) values (
  ${sqlUuid(fixture.taskPresetId)}, ${sqlUuid(fixture.workspaceId)},
  ${sqlText(`${fixture.namespace} Preset`)}, 'general', 2, true, false, '[]'::jsonb, 'active'
);

insert into public.calendar_items (
  id, workspace_id, task_preset_id, title_snapshot, task_type_snapshot, schedule_kind,
  start_date, start_time, end_time, timezone, needed_count, schedule_notes,
  custom_values, lifecycle
) values (
  ${sqlUuid(fixture.legacyCalendarItemId)}, ${sqlUuid(fixture.workspaceId)}, null,
  ${sqlText(`${fixture.namespace} Legacy Compatible Item`)}, 'general', 'timed',
  '2026-08-10'::date, '08:00'::time, '09:00'::time, 'America/Denver',
  1, ${sqlText("Legacy row intentionally has no follow-up contact.")},
  '{}'::jsonb, 'active'
);
commit;
select 'product-created' as fixture_state;`, "Hosted Calendar product fixture creation");

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
    p_one_off_title: `${fixture.namespace} First Scheduled Item`,
    p_one_off_task_type: "general",
    p_schedule_kind: "timed",
    p_start_date: "2026-08-12",
    p_end_date: null,
    p_start_time: "09:00",
    p_end_time: "10:30",
    p_needed_count: 3,
    p_schedule_notes: "Hosted Calendar item management validation.",
    p_custom_values: {},
    ...overrides,
  };
}

function calendarUpdateArgs(calendarItemId, overrides = {}) {
  return {
    p_calendar_item_id: calendarItemId,
    p_one_off_title: `${fixture.namespace} Edited Scheduled Item`,
    p_one_off_task_type: "security",
    p_start_date: "2026-08-13",
    p_start_time: "11:00",
    p_end_time: "12:15",
    p_needed_count: 2,
    p_schedule_notes: "Hosted Calendar item edit persisted.",
    p_custom_values: {},
    ...overrides,
  };
}

async function rpcCreate(client, overrides = {}) {
  const result = await client.rpc("create_calendar_item", calendarCreateArgs(overrides));
  if (result.error || typeof result.data !== "string") {
    throw new Error("Hosted Calendar item create failed.", { cause: result.error });
  }
  return result.data;
}

async function rpcUpdate(client, calendarItemId, overrides = {}) {
  const result = await client.rpc("update_calendar_item_one_off_timed", calendarUpdateArgs(calendarItemId, overrides));
  if (result.error || typeof result.data !== "string") {
    throw new Error("Hosted Calendar item update failed.", { cause: result.error });
  }
  return result.data;
}

async function expectRpcFailure(promise, label) {
  const result = await promise;
  assert(result.error, `${label} must fail closed.`);
}

async function readCalendarRows(client, workspaceId) {
  const result = await client
    .from("calendar_items")
    .select("id,workspace_id,task_preset_id,title_snapshot,task_type_snapshot,schedule_kind,start_date,end_date,start_time,end_time,timezone,needed_count,schedule_notes,lifecycle,follow_up_project_contact_id,custom_values")
    .eq("workspace_id", workspaceId)
    .order("start_date");
  assert(!result.error, "Hosted Calendar item read unexpectedly errored.");
  return result.data ?? [];
}

function verifyHostedSchema() {
  const column = runHostedSql(`select column_name, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'calendar_items'
  and column_name = 'follow_up_project_contact_id';`, "Hosted Calendar follow-up column check")[0];
  assert(column?.is_nullable === "YES", "Hosted follow-up contact column is missing or non-null for legacy rows.");

  const functions = runHostedSql(`select proname
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('create_calendar_item', 'update_calendar_item_one_off_timed')
order by proname;`, "Hosted Calendar RPC check").map((row) => row.proname);
  assert(JSON.stringify(functions) === JSON.stringify(["create_calendar_item", "update_calendar_item_one_off_timed"]), "Hosted Calendar RPC set is incomplete.");

  const privileges = runHostedSql(`select
  has_table_privilege('authenticated', 'public.calendar_items', 'SELECT') as can_select,
  has_table_privilege('authenticated', 'public.calendar_items', 'INSERT') as can_insert,
  has_table_privilege('authenticated', 'public.calendar_items', 'UPDATE') as can_update,
  has_table_privilege('authenticated', 'public.calendar_items', 'DELETE') as can_delete;`, "Hosted Calendar table privilege check")[0];
  assert(privileges.can_select === true, "Authenticated role cannot select Calendar items.");
  assert(privileges.can_insert === false && privileges.can_update === false && privileges.can_delete === false, "Authenticated role has direct Calendar write privileges.");
}

function verifyExistingRowCompatibility() {
  const row = runHostedSql(`select follow_up_project_contact_id, needed_count
from public.calendar_items
where id = ${sqlUuid(fixture.legacyCalendarItemId)};`, "Hosted legacy Calendar row check")[0];
  assert(row?.follow_up_project_contact_id === null, "Hosted legacy-compatible row unexpectedly requires follow-up contact.");
  assert(row?.needed_count === 1, "Hosted legacy-compatible row changed needed count.");
}

async function verifyReadModel(client, calendarItemId, expectedAssignedLabel) {
  const result = await readCalendarReadModelWithClient({
    client,
    workspaceId: fixture.workspaceId,
    actorContactId: fixture.users.full.contactId,
    workspaceTimezone: "America/Denver",
    rangeStart: "2026-08-10",
    rangeEnd: "2026-08-17",
    periodKind: "week",
    capabilities: ["calendar.view", "assignments.view"],
  });
  assert(result.ok, "Hosted Calendar read model did not return safe persisted items.");
  const item = result.items.find((candidate) => candidate.calendarItemId === calendarItemId);
  assert(item, "Hosted Calendar read model omitted the created or edited item.");
  if (expectedAssignedLabel) {
    assert(item.assignedFractionLabel === expectedAssignedLabel, `Hosted Calendar read model did not produce ${expectedAssignedLabel}.`);
  }
  assert(!("follow_up_project_contact_id" in item), "Hosted Calendar read model projected raw follow-up contact id.");
  return item;
}

async function verifyDirectTableWriteDenial() {
  const client = fixture.users.full.client;
  const insert = await client.from("calendar_items").insert({
    workspace_id: fixture.workspaceId,
    title_snapshot: "Direct Insert",
    task_type_snapshot: "general",
    schedule_kind: "timed",
    start_date: "2026-08-12",
    start_time: "09:00",
    end_time: "10:00",
    timezone: "America/Denver",
    needed_count: 1,
    custom_values: {},
  });
  assert(insert.error, "Hosted direct Calendar insert was allowed.");

  const update = await client
    .from("calendar_items")
    .update({ title_snapshot: "Direct Update" })
    .eq("id", fixture.createdCalendarItemId);
  assert(update.error, "Hosted direct Calendar update was allowed.");

  const deletion = await client.from("calendar_items").delete().eq("id", fixture.createdCalendarItemId);
  assert(deletion.error, "Hosted direct Calendar delete was allowed.");
}

async function verifyHostedBehavior() {
  verifyHostedSchema();
  verifyExistingRowCompatibility();

  const full = fixture.users.full.client;
  const viewOnly = fixture.users.viewOnly.client;
  const roleOnly = fixture.users.roleOnly.client;
  const other = fixture.users.other.client;

  fixture.createdCalendarItemId = await rpcCreate(full);
  let createdRow = runHostedSql(`select
  id, workspace_id, task_preset_id, title_snapshot, task_type_snapshot, schedule_kind,
  start_date, start_time::text, end_time::text, timezone, needed_count, schedule_notes,
  lifecycle, follow_up_project_contact_id
from public.calendar_items
where id = ${sqlUuid(fixture.createdCalendarItemId)};`, "Hosted Calendar create check")[0];
  assert(createdRow.workspace_id === fixture.workspaceId, "Hosted Calendar create used the wrong workspace.");
  assert(createdRow.task_preset_id === null, "Hosted one-off Calendar create stored a task preset id.");
  assert(createdRow.schedule_kind === "timed", "Hosted Calendar create did not persist a timed item.");
  assert(createdRow.start_date === "2026-08-12", "Hosted Calendar create persisted the wrong date.");
  assert(createdRow.start_time === "09:00:00" && createdRow.end_time === "10:30:00", "Hosted Calendar create persisted wrong times.");
  assert(createdRow.timezone === "America/Denver", "Hosted Calendar create did not derive trusted workspace timezone.");
  assert(createdRow.needed_count === 3, "Hosted Calendar create persisted the wrong needed count.");
  assert(createdRow.schedule_notes === "Hosted Calendar item management validation.", "Hosted Calendar create persisted wrong notes.");
  assert(createdRow.lifecycle === "active", "Hosted Calendar create persisted unexpected lifecycle.");
  assert(createdRow.follow_up_project_contact_id === fixture.users.full.contactId, "Hosted Calendar create did not derive Follow-up Contact from the scheduler.");

  const followUpGrant = runHostedSql(`select count(*)::int as count
from public.workspace_contact_grants
where workspace_id = ${sqlUuid(fixture.workspaceId)}
  and project_contact_id = ${sqlUuid(createdRow.follow_up_project_contact_id)}
  and status = 'active'
  and revoked_at is null;`, "Hosted Calendar follow-up workspace integrity check")[0]?.count;
  assert(followUpGrant === 1, "Hosted Calendar Follow-up Contact is not tied to the target workspace contact model.");

  await expectRpcFailure(
    full.rpc("create_calendar_item", {
      ...calendarCreateArgs({ p_one_off_title: `${fixture.namespace} Forged Follow-up` }),
      p_follow_up_project_contact_id: fixture.users.other.contactId,
    }),
    "Hosted forged Follow-up Contact create",
  );

  fixture.zeroNeededCalendarItemId = await rpcCreate(full, {
    p_one_off_title: `${fixture.namespace} Zero Needed Item`,
    p_start_time: "13:00",
    p_end_time: "14:00",
    p_needed_count: 0,
    p_schedule_notes: "Zero-needed informational item.",
  });
  const zeroRow = runHostedSql(`select needed_count, follow_up_project_contact_id
from public.calendar_items
where id = ${sqlUuid(fixture.zeroNeededCalendarItemId)};`, "Hosted zero-needed Calendar check")[0];
  assert(zeroRow.needed_count === 0, "Hosted Calendar zero-needed create did not persist 0.");
  assert(zeroRow.follow_up_project_contact_id === fixture.users.full.contactId, "Hosted zero-needed item lost Follow-up Contact.");
  await verifyReadModel(full, fixture.zeroNeededCalendarItemId, "0/0 assigned");

  await expectRpcFailure(
    full.rpc("create_calendar_item", calendarCreateArgs({ p_one_off_title: `${fixture.namespace} Negative Needed`, p_needed_count: -1 })),
    "Hosted negative needed count",
  );
  await expectRpcFailure(
    full.rpc("create_calendar_item", calendarCreateArgs({ p_one_off_title: `${fixture.namespace} Too Many Needed`, p_needed_count: 100 })),
    "Hosted too-large needed count",
  );

  await rpcUpdate(full, fixture.createdCalendarItemId);
  createdRow = runHostedSql(`select
  workspace_id, task_preset_id, title_snapshot, task_type_snapshot, schedule_kind,
  start_date, start_time::text, end_time::text, needed_count, schedule_notes,
  lifecycle, follow_up_project_contact_id
from public.calendar_items
where id = ${sqlUuid(fixture.createdCalendarItemId)};`, "Hosted Calendar edit check")[0];
  assert(createdRow.workspace_id === fixture.workspaceId, "Hosted Calendar edit changed workspace.");
  assert(createdRow.task_preset_id === null, "Hosted Calendar edit changed source kind.");
  assert(createdRow.title_snapshot === `${fixture.namespace} Edited Scheduled Item`, "Hosted Calendar edit did not persist title.");
  assert(createdRow.task_type_snapshot === "security", "Hosted Calendar edit did not persist task type.");
  assert(createdRow.start_date === "2026-08-13", "Hosted Calendar edit did not persist date.");
  assert(createdRow.start_time === "11:00:00" && createdRow.end_time === "12:15:00", "Hosted Calendar edit did not persist times.");
  assert(createdRow.needed_count === 2, "Hosted Calendar edit did not persist needed count.");
  assert(createdRow.schedule_notes === "Hosted Calendar item edit persisted.", "Hosted Calendar edit did not persist notes.");
  assert(createdRow.lifecycle === "active", "Hosted Calendar edit changed lifecycle.");
  assert(createdRow.follow_up_project_contact_id === fixture.users.full.contactId, "Hosted Calendar edit changed Follow-up Contact.");
  const editedReadModelItem = await verifyReadModel(full, fixture.createdCalendarItemId);
  assert(editedReadModelItem.taskSourceLabel === `${fixture.namespace} Edited Scheduled Item`, "Hosted read model did not return edited title.");

  const viewOnlyRows = await readCalendarRows(viewOnly, fixture.workspaceId);
  assert(viewOnlyRows.some((row) => row.id === fixture.createdCalendarItemId), "Hosted view-only contact could not read permitted Calendar rows.");
  await expectRpcFailure(
    viewOnly.rpc("create_calendar_item", calendarCreateArgs({ p_one_off_title: `${fixture.namespace} View Only Cannot Create` })),
    "Hosted view-only create",
  );
  await expectRpcFailure(
    viewOnly.rpc("update_calendar_item_one_off_timed", calendarUpdateArgs(fixture.createdCalendarItemId, { p_one_off_title: `${fixture.namespace} View Only Cannot Edit` })),
    "Hosted view-only edit",
  );

  assert((await readCalendarRows(roleOnly, fixture.workspaceId)).length === 0, "Hosted role/title-only contact read Calendar rows.");
  await expectRpcFailure(
    roleOnly.rpc("create_calendar_item", calendarCreateArgs({ p_one_off_title: `${fixture.namespace} Role Cannot Create` })),
    "Hosted role/title-only create",
  );
  await expectRpcFailure(
    roleOnly.rpc("update_calendar_item_one_off_timed", calendarUpdateArgs(fixture.createdCalendarItemId, { p_one_off_title: `${fixture.namespace} Role Cannot Edit` })),
    "Hosted role/title-only edit",
  );

  for (const label of ["revoked", "expired", "inactive"]) {
    const client = fixture.users[label].client;
    assert((await readCalendarRows(client, fixture.workspaceId)).length === 0, `Hosted ${label} grant read Calendar rows.`);
    await expectRpcFailure(
      client.rpc("create_calendar_item", calendarCreateArgs({ p_one_off_title: `${fixture.namespace} ${label} Cannot Create` })),
      `Hosted ${label} grant create`,
    );
    await expectRpcFailure(
      client.rpc("update_calendar_item_one_off_timed", calendarUpdateArgs(fixture.createdCalendarItemId, { p_one_off_title: `${fixture.namespace} ${label} Cannot Edit` })),
      `Hosted ${label} grant edit`,
    );
  }

  assert((await readCalendarRows(other, fixture.workspaceId)).length === 0, "Hosted other-workspace contact read target workspace rows.");
  await expectRpcFailure(
    other.rpc("update_calendar_item_one_off_timed", calendarUpdateArgs(fixture.createdCalendarItemId, { p_one_off_title: `${fixture.namespace} Other Workspace Cannot Edit` })),
    "Hosted other-workspace edit",
  );
  await expectRpcFailure(
    full.rpc("create_calendar_item", calendarCreateArgs({ p_workspace_id: fixture.otherWorkspaceId, p_one_off_title: `${fixture.namespace} Wrong Workspace Create` })),
    "Hosted wrong-workspace create",
  );
  fixture.otherWorkspaceCalendarItemId = await rpcCreate(other, {
    p_workspace_id: fixture.otherWorkspaceId,
    p_one_off_title: `${fixture.namespace} Other Workspace Item`,
  });
  assert(!(await readCalendarRows(full, fixture.workspaceId)).some((row) => row.id === fixture.otherWorkspaceCalendarItemId), "Hosted wrong-workspace item bled into target reads.");

  await expectRpcFailure(
    full.rpc("create_calendar_item", calendarCreateArgs({ p_one_off_title: `${fixture.namespace} Invalid Date`, p_start_date: "not-a-date" })),
    "Hosted invalid date",
  );
  await expectRpcFailure(
    full.rpc("create_calendar_item", calendarCreateArgs({ p_one_off_title: `${fixture.namespace} Invalid Time`, p_start_time: "12:00", p_end_time: "10:00" })),
    "Hosted invalid time ordering",
  );
  await expectRpcFailure(
    full.rpc("create_calendar_item", calendarCreateArgs({ p_one_off_title: "x".repeat(161) })),
    "Hosted malformed title",
  );
  await expectRpcFailure(
    full.rpc("create_calendar_item", calendarCreateArgs({ p_one_off_title: `${fixture.namespace} Long Notes`, p_schedule_notes: "x".repeat(4001) })),
    "Hosted malformed notes",
  );
  await expectRpcFailure(
    full.rpc("create_calendar_item", calendarCreateArgs({ p_one_off_title: `${fixture.namespace} Bad Kind`, p_schedule_kind: "recurring" })),
    "Hosted unsupported schedule kind",
  );
  await expectRpcFailure(
    full.rpc("create_calendar_item", calendarCreateArgs({ p_one_off_title: `${fixture.namespace} Bad Custom`, p_custom_values: [] })),
    "Hosted malformed custom values",
  );
  await expectRpcFailure(
    full.rpc("create_calendar_item", calendarCreateArgs({ p_task_preset_id: randomUUID(), p_one_off_title: null, p_one_off_task_type: null })),
    "Hosted fake preset source",
  );
  await expectRpcFailure(
    full.rpc("create_calendar_item", calendarCreateArgs({ p_task_preset_id: fixture.taskPresetId, p_one_off_title: `${fixture.namespace} Mixed Source` })),
    "Hosted mixed preset and one-off source",
  );

  const presetCreate = await full.rpc("create_calendar_item", calendarCreateArgs({
    p_task_preset_id: fixture.taskPresetId,
    p_one_off_title: null,
    p_one_off_task_type: null,
    p_needed_count: 2,
    p_schedule_notes: "Preset-backed invariant check.",
  }));
  assert(!presetCreate.error && typeof presetCreate.data === "string", "Hosted existing preset-backed source invariant was broken.");
  fixture.presetBackedCalendarItemId = presetCreate.data;
  const presetRow = runHostedSql(`select task_preset_id, title_snapshot, task_type_snapshot, follow_up_project_contact_id
from public.calendar_items
where id = ${sqlUuid(fixture.presetBackedCalendarItemId)};`, "Hosted preset-backed source check")[0];
  assert(presetRow.task_preset_id === fixture.taskPresetId, "Hosted preset-backed item did not preserve preset id.");
  assert(presetRow.title_snapshot === `${fixture.namespace} Preset`, "Hosted preset-backed item did not derive preset title.");
  assert(presetRow.task_type_snapshot === "general", "Hosted preset-backed item did not derive preset type.");
  assert(presetRow.follow_up_project_contact_id === fixture.users.full.contactId, "Hosted preset-backed item lost Follow-up Contact.");

  await expectRpcFailure(
    full.rpc("update_calendar_item_one_off_timed", {
      ...calendarUpdateArgs(fixture.createdCalendarItemId, { p_one_off_title: `${fixture.namespace} Forged Update Follow-up` }),
      p_follow_up_project_contact_id: fixture.users.other.contactId,
    }),
    "Hosted forged Follow-up Contact edit",
  );
  await expectRpcFailure(
    full.rpc("update_calendar_item_one_off_timed", calendarUpdateArgs(fixture.presetBackedCalendarItemId, { p_one_off_title: `${fixture.namespace} Preset Cannot Be Edited As One-Off` })),
    "Hosted preset-backed one-off edit",
  );

  await verifyDirectTableWriteDenial();
}

async function cleanupFixtures() {
  for (const user of Object.values(fixture.users)) {
    if (user.client) await user.client.auth.signOut({ scope: "local" }).catch(() => undefined);
  }
  const userIds = Object.values(fixture.users).map((user) => user.userId);
  const userIdArray = userIds.map(sqlUuid).join(", ");
  const contactIdArray = Object.values(fixture.users).map((user) => sqlUuid(user.contactId)).join(", ");
  runHostedSql(`begin;
delete from public.assignment_responses
where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)});
delete from public.calendar_assignments
where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)});
delete from public.calendar_items
where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)})
   or title_snapshot like ${sqlText(`${fixture.namespace}%`)};
delete from public.task_presets
where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)})
   or name like ${sqlText(`${fixture.namespace}%`)};
delete from public.workspace_contact_grants
where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)})
   or project_contact_id in (${contactIdArray});
delete from public.project_contacts
where id in (${contactIdArray})
   or auth_user_id = any(array[${userIdArray}]);
delete from public.workspaces
where id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)})
   or workspace_key like ${sqlText(`${fixture.namespace}%`)};
delete from auth.identities where user_id = any(array[${userIdArray}]);
delete from auth.users where id = any(array[${userIdArray}]);
commit;
select 'cleaned' as fixture_state;`, "Hosted Calendar cleanup");

  exactResidueCount = runHostedSql(`select (
  (select count(*) from public.workspaces where id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)})) +
  (select count(*) from public.project_contacts where auth_user_id = any(array[${userIdArray}])) +
  (select count(*) from public.workspace_contact_grants where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)})) +
  (select count(*) from public.task_presets where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)})) +
  (select count(*) from public.calendar_items where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)})) +
  (select count(*) from public.calendar_assignments where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)})) +
  (select count(*) from public.assignment_responses where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)})) +
  (select count(*) from auth.users where id = any(array[${userIdArray}]))
)::int as residue_count;`, "Hosted Calendar exact residue check")[0]?.residue_count;
  assert(exactResidueCount === 0, "Hosted Calendar fixtures left exact-run residue.");
  cleanupCompleted = true;
}

function verifyNamespaceResidue() {
  namespaceResidueCount = runHostedSql(`select (
  (select count(*) from public.workspaces where workspace_key like 'qa-12-16-1-%') +
  (select count(*) from public.task_presets where name like 'qa-12-16-1-%') +
  (select count(*) from public.calendar_items where title_snapshot like 'qa-12-16-1-%') +
  (select count(*) from auth.users where email like 'qa-12-16-1-%@example.invalid')
)::int as residue_count;`, "Hosted 12.16.1 namespace residue check")[0]?.residue_count;
  assert(namespaceResidueCount === 0, "Hosted qa-12-16-1 namespace left fixture/Auth residue.");
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
  assert(cleanupCompleted && verifyNamespaceResidue() === 0, "Hosted Calendar cleanup did not complete.");
  console.log("Hosted staging Calendar item management QA passed.");
  console.log(`Validated target ${expectedName} (${expectedRef}) with status ${projectStatus}.`);
  console.log(`Migration level before gate: ${before}; after gate: ${after}.`);
  console.log("Validated one-off timed create/edit, Follow-up Contact, zero-needed read-model output, capability isolation, direct table-write denial, malformed/source rejection, generated type parity, and existing-row compatibility.");
  console.log(`Hosted disposable product and Auth residue: ${exactResidueCount + namespaceResidueCount}.`);
  console.log("No access token, refresh token, password, API key, database URL, bearer, verifier, or service credential was logged.");
}

main().catch((error) => {
  console.error(`Hosted Calendar item management QA failed: ${redact(error)}`);
  process.exitCode = 1;
});
