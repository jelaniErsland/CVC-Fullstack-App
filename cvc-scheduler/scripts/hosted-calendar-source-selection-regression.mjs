import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
import { writeFileSync, unlinkSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import path from "node:path";

import { readCalendarReadModelWithClient } from "../lib/calendar/readModelQuery.server.ts";
import { readCalendarTaskPresetSelectorWithClient } from "../lib/calendar/taskPresetSelector.server.ts";

const root = process.cwd();
const expectedRef = "kfuujcfxoayukywvtaeh";
const expectedName = "project-local-staging";
const expectedConfirmation = `${expectedName}:${expectedRef}`;
const expectedBeforeMigration = "20260714121600";
const expectedAfterMigration = "20260714121700";
const expectedMigrationFile = `${expectedAfterMigration}_calendar_source_selection.sql`;
const hostedUrl = `https://${expectedRef}.supabase.co`;
const secrets = new Set();

const fixture = {
  namespace: `qa-12-17-1-${randomUUID()}`,
  workspaceId: randomUUID(),
  otherWorkspaceId: randomUUID(),
  taskPresetId: randomUUID(),
  archivedTaskPresetId: randomUUID(),
  otherTaskPresetId: randomUUID(),
  existingPresetBackedItemId: randomUUID(),
  createdPresetItemId: null,
  editedPresetItemId: null,
  oneOffItemId: null,
  noTasksOneOffItemId: null,
  otherWorkspaceItemId: null,
  users: Object.fromEntries(
    [
      "full",
      "noTasks",
      "tasksOnly",
      "viewOnly",
      "roleOnly",
      "other",
      "revoked",
      "expired",
      "inactive",
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
    process.env.RUN_HOSTED_CALENDAR_SOURCE_SELECTION_VALIDATION === expectedConfirmation,
    `Refusing hosted validation without RUN_HOSTED_CALENDAR_SOURCE_SELECTION_VALIDATION=${expectedConfirmation}.`,
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
      "Hosted migration dry-run did not identify the reviewed 12.17 migration.",
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
  const [migration, selector, server, routeRead, route, calendarClient, packageJson] = await Promise.all([
    readFile(path.join(root, "supabase", "migrations", expectedMigrationFile), "utf8"),
    readFile(path.join(root, "lib", "calendar", "taskPresetSelector.server.ts"), "utf8"),
    readFile(path.join(root, "lib", "calendar", "server.ts"), "utf8"),
    readFile(path.join(root, "lib", "calendar", "routeRead.server.ts"), "utf8"),
    readFile(path.join(root, "app", "admin", "calendar", "page.tsx"), "utf8"),
    readFile(path.join(root, "components", "CalendarClient.tsx"), "utf8"),
    readFile(path.join(root, "package.json"), "utf8"),
  ]);
  assert(migration.includes("update_calendar_item_preset_timed"), "12.17 preset timed update RPC migration is missing.");
  assert(migration.includes("item.task_preset_id is not null"), "Preset timed update RPC does not preserve preset-backed source shape.");
  assert(migration.includes("grant execute on function public.update_calendar_item_preset_timed"), "Preset timed update RPC execute grant is missing.");
  assert(!/grant (?:insert|update|delete|all).*calendar_items.*to authenticated/i.test(migration), "12.17 migration broadened Calendar direct table writes.");
  assert(selector.includes('from("task_presets")'), "Task preset selector does not query persisted task presets.");
  assert(selector.includes(".eq(\"workspace_id\", workspaceId)") && selector.includes(".eq(\"lifecycle\", \"active\")"), "Task preset selector is not same-workspace active-only.");
  assert(selector.includes("missing_tasks_view") && selector.includes("selectorColumns"), "Task preset selector is not capability gated with explicit selectors.");
  assert(!selector.includes('select("*")'), "Task preset selector uses select-star.");
  assert(routeRead.includes("readCalendarTaskPresetSelectorWithClient"), "Calendar route read state does not use the persisted task preset selector.");
  assert(route.includes("calendarPresetTimedCreateInputFromFormData"), "Calendar route does not expose the reviewed preset create form adapter.");
  assert(route.includes("updateCalendarPresetTimedItem"), "Calendar route does not expose the reviewed preset timed update boundary.");
  assert(calendarClient.includes("Task preset") && calendarClient.includes("Custom one-off"), "Calendar UI source-selection controls are missing.");
  assert(packageJson.includes("test:calendar-source-selection:hosted"), "Hosted source-selection package script is missing.");
  assert(!/SUPABASE_SERVICE_ROLE_KEY|createServiceRole|auth\.admin/i.test(`${selector}\n${server}\n${routeRead}\n${route}\n${calendarClient}`), "Calendar source-selection product path references a service-role shortcut.");

  for (const directory of ["app", "components"]) {
    for (const file of (await collectFiles(path.join(root, directory))).filter((entry) => /\.(?:ts|tsx)$/.test(entry))) {
      const content = await readFile(file, "utf8");
      assert(!content.includes("from(\"task_presets\")") && !content.includes(".from('task_presets')"), `Product route/component directly queries task presets: ${path.relative(root, file)}`);
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
select 'auth-created' as fixture_state;`, "Hosted Calendar source Auth fixture creation");

  const fullCaps = ["workspace.read", "calendar.view", "assignments.view", "calendar.edit", "tasks.view"];
  runHostedSql(`begin;
insert into public.workspaces (
  id, workspace_key, display_name, lifecycle, timezone, starts_on, ends_on, public_intake_enabled
) values
  ${workspaceRowSql(fixture.workspaceId, `${fixture.namespace}-target`, "QA 12.17.1 Calendar Source Target Workspace")},
  ${workspaceRowSql(fixture.otherWorkspaceId, `${fixture.namespace}-other`, "QA 12.17.1 Calendar Source Other Workspace")};

insert into public.project_contacts (id, auth_user_id, status)
values
  ${Object.values(fixture.users)
    .map((user) => `(${sqlUuid(user.contactId)}, ${sqlUuid(user.userId)}, 'active')`)
    .join(",\n  ")};

insert into public.workspace_contact_grants (
  id, workspace_id, project_contact_id, role, capabilities, status, valid_from, valid_until, revoked_at
) values
  ${grantRowSql("full", fixture.workspaceId, "main_contact", fullCaps)},
  ${grantRowSql("noTasks", fixture.workspaceId, "main_contact", ["workspace.read", "calendar.view", "assignments.view", "calendar.edit"])},
  ${grantRowSql("tasksOnly", fixture.workspaceId, "assistant_contact", ["workspace.read", "tasks.view"])},
  ${grantRowSql("viewOnly", fixture.workspaceId, "assistant_contact", ["workspace.read", "calendar.view", "assignments.view", "tasks.view"])},
  ${grantRowSql("roleOnly", fixture.workspaceId, "main_contact", ["workspace.read"])},
  ${grantRowSql("other", fixture.otherWorkspaceId, "main_contact", fullCaps)},
  ${grantRowSql("revoked", fixture.workspaceId, "assistant_contact", fullCaps, "revoked")},
  ${grantRowSql("expired", fixture.workspaceId, "assistant_contact", fullCaps, "active", "expired")},
  ${grantRowSql("inactive", fixture.workspaceId, "assistant_contact", fullCaps, "inactive")};

insert into public.task_presets (
  id, workspace_id, name, description, task_type, default_needed_count, volunteer_visible,
  is_system_preset, system_key, custom_field_definitions, lifecycle
) values
  (
    ${sqlUuid(fixture.taskPresetId)}, ${sqlUuid(fixture.workspaceId)},
    ${sqlText(`${fixture.namespace} Setup Crew`)}, 'Reusable setup definition', 'general',
    3, true, false, null,
    '[{"key":"area","label":"Area","type":"short_text","required":false,"options":[]}]'::jsonb,
    'active'
  ),
  (
    ${sqlUuid(fixture.archivedTaskPresetId)}, ${sqlUuid(fixture.workspaceId)},
    ${sqlText(`${fixture.namespace} Archived`)}, null, 'security',
    1, true, false, null, '[]'::jsonb, 'archived'
  ),
  (
    ${sqlUuid(fixture.otherTaskPresetId)}, ${sqlUuid(fixture.otherWorkspaceId)},
    ${sqlText(`${fixture.namespace} Other`)}, null, 'food',
    1, true, false, null, '[]'::jsonb, 'active'
  );

insert into public.calendar_items (
  id, workspace_id, task_preset_id, title_snapshot, task_type_snapshot, schedule_kind,
  start_date, start_time, end_time, timezone, needed_count, schedule_notes,
  custom_values, lifecycle, follow_up_project_contact_id
) values (
  ${sqlUuid(fixture.existingPresetBackedItemId)}, ${sqlUuid(fixture.workspaceId)},
  ${sqlUuid(fixture.taskPresetId)}, ${sqlText(`${fixture.namespace} Existing Occurrence Snapshot`)},
  'general', 'timed', '2026-08-10'::date, '08:00'::time, '09:00'::time,
  'America/Denver', 1, 'Existing preset-backed compatibility row.',
  '{}'::jsonb, 'active', ${sqlUuid(fixture.users.full.contactId)}
);
commit;
select 'product-created' as fixture_state;`, "Hosted Calendar source product fixture creation");

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
    p_one_off_title: `${fixture.namespace} One-Off Scheduled Item`,
    p_one_off_task_type: "general",
    p_schedule_kind: "timed",
    p_start_date: "2026-08-12",
    p_end_date: null,
    p_start_time: "09:00",
    p_end_time: "10:30",
    p_needed_count: 3,
    p_schedule_notes: "Hosted Calendar source-selection validation.",
    p_custom_values: {},
    ...overrides,
  };
}

function presetCreateArgs(overrides = {}) {
  return calendarCreateArgs({
    p_task_preset_id: fixture.taskPresetId,
    p_one_off_title: null,
    p_one_off_task_type: null,
    p_needed_count: 3,
    p_schedule_notes: "Hosted preset-backed create validation.",
    ...overrides,
  });
}

function presetUpdateArgs(calendarItemId, overrides = {}) {
  return {
    p_calendar_item_id: calendarItemId,
    p_start_date: "2026-08-14",
    p_start_time: "11:00",
    p_end_time: "12:15",
    p_needed_count: 2,
    p_schedule_notes: "Hosted preset-backed edit persisted.",
    p_custom_values: {},
    ...overrides,
  };
}

function oneOffUpdateArgs(calendarItemId, overrides = {}) {
  return {
    p_calendar_item_id: calendarItemId,
    p_one_off_title: `${fixture.namespace} Edited One-Off Item`,
    p_one_off_task_type: "security",
    p_start_date: "2026-08-13",
    p_start_time: "10:00",
    p_end_time: "11:00",
    p_needed_count: 2,
    p_schedule_notes: "Hosted one-off continuity edit.",
    p_custom_values: {},
    ...overrides,
  };
}

async function expectRpcFailure(promise, label) {
  const result = await promise;
  assert(result.error, `${label} must fail closed.`);
}

async function createCalendarItem(client, args) {
  const result = await client.rpc("create_calendar_item", args);
  if (result.error || typeof result.data !== "string") {
    throw new Error("Hosted Calendar item create failed.", { cause: result.error });
  }
  return result.data;
}

async function updatePresetItem(client, calendarItemId, overrides = {}) {
  const result = await client.rpc("update_calendar_item_preset_timed", presetUpdateArgs(calendarItemId, overrides));
  if (result.error || typeof result.data !== "string") {
    throw new Error("Hosted preset-backed Calendar item update failed.", { cause: result.error });
  }
  return result.data;
}

async function updateOneOffItem(client, calendarItemId, overrides = {}) {
  const result = await client.rpc("update_calendar_item_one_off_timed", oneOffUpdateArgs(calendarItemId, overrides));
  if (result.error || typeof result.data !== "string") {
    throw new Error("Hosted one-off Calendar item update failed.", { cause: result.error });
  }
  return result.data;
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

async function readTaskPresetRows(client, workspaceId) {
  const result = await client
    .from("task_presets")
    .select("id,workspace_id,name,description,task_type,default_needed_count,volunteer_visible,is_system_preset,system_key,custom_field_definitions,lifecycle")
    .eq("workspace_id", workspaceId)
    .order("name");
  assert(!result.error, "Hosted Task preset read unexpectedly errored.");
  return result.data ?? [];
}

async function verifySelector(client, canViewTaskPresets) {
  return readCalendarTaskPresetSelectorWithClient({
    client,
    workspaceId: fixture.workspaceId,
    canViewTaskPresets,
  });
}

function verifyHostedSchema() {
  const functions = runHostedSql(`select proname
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('create_calendar_item', 'update_calendar_item_one_off_timed', 'update_calendar_item_preset_timed')
order by proname;`, "Hosted Calendar source RPC check").map((row) => row.proname);
  assert(
    JSON.stringify(functions) === JSON.stringify(["create_calendar_item", "update_calendar_item_one_off_timed", "update_calendar_item_preset_timed"]),
    "Hosted Calendar source RPC set is incomplete.",
  );

  const privileges = runHostedSql(`select
  has_table_privilege('authenticated', 'public.calendar_items', 'INSERT') as calendar_insert,
  has_table_privilege('authenticated', 'public.calendar_items', 'UPDATE') as calendar_update,
  has_table_privilege('authenticated', 'public.calendar_items', 'DELETE') as calendar_delete,
  has_table_privilege('authenticated', 'public.task_presets', 'INSERT') as preset_insert,
  has_table_privilege('authenticated', 'public.task_presets', 'UPDATE') as preset_update,
  has_table_privilege('authenticated', 'public.task_presets', 'DELETE') as preset_delete;`, "Hosted source table privilege check")[0];
  assert(
    privileges.calendar_insert === false && privileges.calendar_update === false && privileges.calendar_delete === false,
    "Authenticated role has direct Calendar item write privileges.",
  );
  assert(
    privileges.preset_insert === false && privileges.preset_update === false && privileges.preset_delete === false,
    "Authenticated role has direct Task preset write privileges.",
  );
}

async function verifyReadModel(client, calendarItemId) {
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
  assert(item, "Hosted Calendar read model omitted the target item.");
  assert(!("workspace_id" in item) && !("capabilities" in item), "Hosted Calendar read model exposed raw internal fields.");
  return item;
}

async function verifyDirectTableWriteDenial() {
  const client = fixture.users.full.client;
  const calendarInsert = await client.from("calendar_items").insert({
    workspace_id: fixture.workspaceId,
    task_preset_id: fixture.taskPresetId,
    title_snapshot: "Direct Calendar Insert",
    task_type_snapshot: "general",
    schedule_kind: "timed",
    start_date: "2026-08-12",
    start_time: "09:00",
    end_time: "10:00",
    timezone: "America/Denver",
    needed_count: 1,
    custom_values: {},
  });
  assert(calendarInsert.error, "Hosted direct Calendar insert was allowed.");

  const calendarUpdate = await client
    .from("calendar_items")
    .update({ title_snapshot: "Direct Calendar Update" })
    .eq("id", fixture.createdPresetItemId);
  assert(calendarUpdate.error, "Hosted direct Calendar update was allowed.");

  const calendarDelete = await client.from("calendar_items").delete().eq("id", fixture.createdPresetItemId);
  assert(calendarDelete.error, "Hosted direct Calendar delete was allowed.");

  const presetInsert = await client.from("task_presets").insert({
    workspace_id: fixture.workspaceId,
    name: "Direct Preset Insert",
    task_type: "general",
    default_needed_count: 1,
    volunteer_visible: true,
    is_system_preset: false,
    custom_field_definitions: [],
    lifecycle: "active",
  });
  assert(presetInsert.error, "Hosted direct Task preset insert was allowed.");

  const presetUpdate = await client
    .from("task_presets")
    .update({ name: "Direct Preset Update" })
    .eq("id", fixture.taskPresetId);
  assert(presetUpdate.error, "Hosted direct Task preset update was allowed.");

  const presetDelete = await client.from("task_presets").delete().eq("id", fixture.taskPresetId);
  assert(presetDelete.error, "Hosted direct Task preset delete was allowed.");
}

async function verifyHostedBehavior() {
  verifyHostedSchema();

  const full = fixture.users.full.client;
  const noTasks = fixture.users.noTasks.client;
  const tasksOnly = fixture.users.tasksOnly.client;
  const viewOnly = fixture.users.viewOnly.client;
  const roleOnly = fixture.users.roleOnly.client;
  const other = fixture.users.other.client;

  const fullSelector = await verifySelector(full, true);
  assert(fullSelector.ok, "Hosted selector did not return presets for tasks.view contact.");
  assert(fullSelector.selector.table === "task_presets" && fullSelector.selector.requiresTasksView === true, "Hosted selector metadata is not safe.");
  assert(fullSelector.presets.length === 1, "Hosted selector returned the wrong number of target presets.");
  const presetOption = fullSelector.presets[0];
  assert(presetOption.id === fixture.taskPresetId, "Hosted selector omitted the active target preset.");
  assert(presetOption.name === `${fixture.namespace} Setup Crew`, "Hosted selector projected wrong preset name.");
  assert(presetOption.taskType === "general" && presetOption.defaultNeededCount === 3, "Hosted selector projected wrong type/default needed count.");
  assert(presetOption.customFields.length === 1 && presetOption.customFields[0].id === "area", "Hosted selector did not preserve bounded custom-field definitions.");
  assert(!("capabilities" in presetOption) && !("workspace_contact_grants" in presetOption), "Hosted selector exposed unsafe authorization internals.");
  assert(!fullSelector.presets.some((preset) => preset.id === fixture.archivedTaskPresetId), "Hosted selector included archived preset.");
  assert(!fullSelector.presets.some((preset) => preset.id === fixture.otherTaskPresetId), "Hosted selector leaked wrong-workspace preset.");

  const noTasksSelector = await verifySelector(noTasks, false);
  assert(!noTasksSelector.ok && noTasksSelector.reason === "missing_tasks_view", "Hosted selector did not fail closed without tasks.view.");
  const roleOnlySelector = await verifySelector(roleOnly, false);
  assert(!roleOnlySelector.ok && roleOnlySelector.reason === "missing_tasks_view", "Hosted role/title-only selector did not fail closed.");
  assert((await readTaskPresetRows(full, fixture.workspaceId)).some((row) => row.id === fixture.taskPresetId), "Hosted tasks.view contact could not read same-workspace presets.");
  assert(!(await readTaskPresetRows(full, fixture.workspaceId)).some((row) => row.id === fixture.otherTaskPresetId), "Hosted task preset read leaked other workspace.");

  fixture.createdPresetItemId = await createCalendarItem(full, presetCreateArgs());
  const createdPresetRow = runHostedSql(`select
  id, workspace_id, task_preset_id, title_snapshot, task_type_snapshot, schedule_kind,
  start_date, start_time::text, end_time::text, timezone, needed_count, schedule_notes,
  lifecycle, follow_up_project_contact_id
from public.calendar_items
where id = ${sqlUuid(fixture.createdPresetItemId)};`, "Hosted preset-backed create check")[0];
  assert(createdPresetRow.workspace_id === fixture.workspaceId, "Hosted preset-backed create used wrong workspace.");
  assert(createdPresetRow.task_preset_id === fixture.taskPresetId, "Hosted preset-backed create did not preserve preset id.");
  assert(createdPresetRow.title_snapshot === `${fixture.namespace} Setup Crew`, "Hosted preset-backed create did not snapshot preset name.");
  assert(createdPresetRow.task_type_snapshot === "general", "Hosted preset-backed create did not snapshot preset type.");
  assert(createdPresetRow.schedule_kind === "timed", "Hosted preset-backed create did not persist timed schedule kind.");
  assert(createdPresetRow.start_date === "2026-08-12", "Hosted preset-backed create persisted wrong date.");
  assert(createdPresetRow.start_time === "09:00:00" && createdPresetRow.end_time === "10:30:00", "Hosted preset-backed create persisted wrong times.");
  assert(createdPresetRow.timezone === "America/Denver", "Hosted preset-backed create did not derive trusted workspace timezone.");
  assert(createdPresetRow.needed_count === 3, "Hosted preset-backed create persisted wrong needed count.");
  assert(createdPresetRow.follow_up_project_contact_id === fixture.users.full.contactId, "Hosted preset-backed create did not derive Follow-up Contact.");

  const presetReadItem = await verifyReadModel(full, fixture.createdPresetItemId);
  assert(presetReadItem.taskPresetId === fixture.taskPresetId, "Hosted read model did not expose safe taskPresetId metadata.");
  assert(presetReadItem.taskSourceLabel === `${fixture.namespace} Setup Crew`, "Hosted read model did not preserve source snapshot label.");
  assert(presetReadItem.taskPresetLabel === `${fixture.namespace} Setup Crew`, "Hosted read model did not expose preset metadata label.");

  const existingReadItem = await verifyReadModel(full, fixture.existingPresetBackedItemId);
  assert(existingReadItem.taskSourceLabel === `${fixture.namespace} Existing Occurrence Snapshot`, "Hosted read model allowed preset metadata to overwrite occurrence snapshot truth.");
  assert(existingReadItem.taskPresetLabel === `${fixture.namespace} Setup Crew`, "Hosted read model lost preset metadata for existing preset-backed row.");

  await expectRpcFailure(
    full.rpc("create_calendar_item", presetCreateArgs({ p_task_preset_id: randomUUID() })),
    "Hosted fake preset create",
  );
  await expectRpcFailure(
    full.rpc("create_calendar_item", presetCreateArgs({ p_task_preset_id: fixture.otherTaskPresetId })),
    "Hosted wrong-workspace preset create",
  );
  await expectRpcFailure(
    full.rpc("create_calendar_item", presetCreateArgs({ p_task_preset_id: fixture.archivedTaskPresetId })),
    "Hosted archived preset create",
  );
  await expectRpcFailure(
    full.rpc("create_calendar_item", presetCreateArgs({ p_one_off_title: `${fixture.namespace} Mixed`, p_one_off_task_type: "general" })),
    "Hosted invalid mixed source create",
  );

  fixture.oneOffItemId = await createCalendarItem(full, calendarCreateArgs());
  const oneOffRow = runHostedSql(`select task_preset_id, title_snapshot, task_type_snapshot, follow_up_project_contact_id
from public.calendar_items
where id = ${sqlUuid(fixture.oneOffItemId)};`, "Hosted one-off continuity check")[0];
  assert(oneOffRow.task_preset_id === null, "Hosted one-off create stored a task preset.");
  assert(oneOffRow.title_snapshot === `${fixture.namespace} One-Off Scheduled Item`, "Hosted one-off create lost title snapshot.");
  assert(oneOffRow.follow_up_project_contact_id === fixture.users.full.contactId, "Hosted one-off create lost Follow-up Contact.");
  await updateOneOffItem(full, fixture.oneOffItemId);
  const editedOneOff = await verifyReadModel(full, fixture.oneOffItemId);
  assert(editedOneOff.taskPresetId === null && editedOneOff.taskSourceLabel === `${fixture.namespace} Edited One-Off Item`, "Hosted 12.17 migration broke 12.16 one-off edit compatibility.");

  fixture.noTasksOneOffItemId = await createCalendarItem(noTasks, calendarCreateArgs({
    p_one_off_title: `${fixture.namespace} No Tasks One-Off`,
    p_start_time: "13:00",
    p_end_time: "14:00",
  }));
  const noTasksOneOffRow = runHostedSql(`select task_preset_id, title_snapshot
from public.calendar_items
where id = ${sqlUuid(fixture.noTasksOneOffItemId)};`, "Hosted missing-tasks one-off continuity check")[0];
  assert(noTasksOneOffRow.task_preset_id === null, "Hosted no-tasks custom create stored a preset id.");

  fixture.editedPresetItemId = await updatePresetItem(full, fixture.createdPresetItemId);
  assert(fixture.editedPresetItemId === fixture.createdPresetItemId, "Hosted preset edit returned the wrong item id.");
  const editedPresetRow = runHostedSql(`select
  workspace_id, task_preset_id, title_snapshot, task_type_snapshot, schedule_kind,
  start_date, start_time::text, end_time::text, needed_count, schedule_notes,
  lifecycle, follow_up_project_contact_id
from public.calendar_items
where id = ${sqlUuid(fixture.createdPresetItemId)};`, "Hosted preset-backed edit check")[0];
  assert(editedPresetRow.workspace_id === fixture.workspaceId, "Hosted preset edit changed workspace.");
  assert(editedPresetRow.task_preset_id === fixture.taskPresetId, "Hosted preset edit changed preset id.");
  assert(editedPresetRow.title_snapshot === `${fixture.namespace} Setup Crew`, "Hosted preset edit changed preset/source snapshot.");
  assert(editedPresetRow.task_type_snapshot === "general", "Hosted preset edit changed preset/source type.");
  assert(editedPresetRow.start_date === "2026-08-14", "Hosted preset edit did not persist date.");
  assert(editedPresetRow.start_time === "11:00:00" && editedPresetRow.end_time === "12:15:00", "Hosted preset edit did not persist times.");
  assert(editedPresetRow.needed_count === 2, "Hosted preset edit did not persist needed count.");
  assert(editedPresetRow.schedule_notes === "Hosted preset-backed edit persisted.", "Hosted preset edit did not persist notes.");
  assert(editedPresetRow.lifecycle === "active", "Hosted preset edit changed lifecycle.");
  assert(editedPresetRow.follow_up_project_contact_id === fixture.users.full.contactId, "Hosted preset edit changed Follow-up Contact.");
  const editedPresetReadItem = await verifyReadModel(full, fixture.createdPresetItemId);
  assert(editedPresetReadItem.taskPresetId === fixture.taskPresetId, "Hosted edited preset item lost source metadata.");
  assert(editedPresetReadItem.taskSourceLabel === `${fixture.namespace} Setup Crew`, "Hosted edited preset item lost occurrence display label.");

  await expectRpcFailure(
    full.rpc("update_calendar_item_preset_timed", {
      ...presetUpdateArgs(fixture.createdPresetItemId, { p_start_date: "2026-08-15" }),
      p_one_off_title: `${fixture.namespace} Forged Source`,
    }),
    "Hosted preset edit source-forging payload",
  );
  await expectRpcFailure(
    full.rpc("update_calendar_item_preset_timed", presetUpdateArgs(fixture.oneOffItemId)),
    "Hosted one-off cannot be edited as preset-backed",
  );
  await expectRpcFailure(
    full.rpc("update_calendar_item_one_off_timed", oneOffUpdateArgs(fixture.createdPresetItemId)),
    "Hosted preset-backed item cannot be edited as one-off",
  );

  await expectRpcFailure(
    tasksOnly.rpc("create_calendar_item", presetCreateArgs({ p_schedule_notes: "Tasks only cannot mutate." })),
    "Hosted tasks.view-only preset create",
  );
  await expectRpcFailure(
    tasksOnly.rpc("update_calendar_item_preset_timed", presetUpdateArgs(fixture.createdPresetItemId)),
    "Hosted tasks.view-only preset edit",
  );
  await expectRpcFailure(
    viewOnly.rpc("create_calendar_item", presetCreateArgs({ p_schedule_notes: "View only cannot mutate." })),
    "Hosted read-only preset create",
  );
  await expectRpcFailure(
    viewOnly.rpc("update_calendar_item_preset_timed", presetUpdateArgs(fixture.createdPresetItemId)),
    "Hosted read-only preset edit",
  );
  await expectRpcFailure(
    roleOnly.rpc("create_calendar_item", presetCreateArgs({ p_schedule_notes: "Role only cannot mutate." })),
    "Hosted role/title-only preset create",
  );
  await expectRpcFailure(
    roleOnly.rpc("update_calendar_item_preset_timed", presetUpdateArgs(fixture.createdPresetItemId)),
    "Hosted role/title-only preset edit",
  );

  for (const label of ["revoked", "expired", "inactive"]) {
    const client = fixture.users[label].client;
    const selector = await verifySelector(client, true);
    assert(selector.ok && selector.presets.length === 0, `Hosted ${label} grant received preset selector rows.`);
    assert((await readCalendarRows(client, fixture.workspaceId)).length === 0, `Hosted ${label} grant read Calendar rows.`);
    await expectRpcFailure(
      client.rpc("create_calendar_item", presetCreateArgs({ p_schedule_notes: `${label} cannot create.` })),
      `Hosted ${label} preset create`,
    );
    await expectRpcFailure(
      client.rpc("update_calendar_item_preset_timed", presetUpdateArgs(fixture.createdPresetItemId)),
      `Hosted ${label} preset edit`,
    );
  }

  assert((await readCalendarRows(other, fixture.workspaceId)).length === 0, "Hosted other-workspace contact read target Calendar rows.");
  const otherSelector = await verifySelector(other, true);
  assert(otherSelector.ok && otherSelector.presets.length === 0, "Hosted other-workspace contact received target selector rows.");
  await expectRpcFailure(
    other.rpc("update_calendar_item_preset_timed", presetUpdateArgs(fixture.createdPresetItemId)),
    "Hosted other-workspace preset edit",
  );
  await expectRpcFailure(
    full.rpc("create_calendar_item", presetCreateArgs({ p_workspace_id: fixture.otherWorkspaceId })),
    "Hosted target contact wrong-workspace preset create",
  );
  fixture.otherWorkspaceItemId = await createCalendarItem(other, presetCreateArgs({
    p_workspace_id: fixture.otherWorkspaceId,
    p_task_preset_id: fixture.otherTaskPresetId,
    p_schedule_notes: "Other workspace item.",
  }));
  assert(!(await readCalendarRows(full, fixture.workspaceId)).some((row) => row.id === fixture.otherWorkspaceItemId), "Hosted other-workspace item bled into target reads.");

  await expectRpcFailure(
    full.rpc("create_calendar_item", presetCreateArgs({ p_start_date: "not-a-date" })),
    "Hosted invalid date",
  );
  await expectRpcFailure(
    full.rpc("create_calendar_item", presetCreateArgs({ p_start_time: "12:00", p_end_time: "10:00" })),
    "Hosted invalid time ordering",
  );
  await expectRpcFailure(
    full.rpc("create_calendar_item", presetCreateArgs({ p_needed_count: -1 })),
    "Hosted negative needed count",
  );
  await expectRpcFailure(
    full.rpc("create_calendar_item", presetCreateArgs({ p_needed_count: 100 })),
    "Hosted too-large needed count",
  );
  await expectRpcFailure(
    full.rpc("create_calendar_item", presetCreateArgs({ p_custom_values: [] })),
    "Hosted malformed custom values",
  );
  await expectRpcFailure(
    full.rpc("update_calendar_item_preset_timed", presetUpdateArgs(fixture.createdPresetItemId, { p_start_date: "not-a-date" })),
    "Hosted preset edit invalid date",
  );
  await expectRpcFailure(
    full.rpc("update_calendar_item_preset_timed", presetUpdateArgs(fixture.createdPresetItemId, { p_start_time: "12:00", p_end_time: "10:00" })),
    "Hosted preset edit invalid time ordering",
  );
  await expectRpcFailure(
    full.rpc("update_calendar_item_preset_timed", presetUpdateArgs(fixture.createdPresetItemId, { p_needed_count: 100 })),
    "Hosted preset edit invalid needed count",
  );
  await expectRpcFailure(
    full.rpc("update_calendar_item_preset_timed", presetUpdateArgs(fixture.createdPresetItemId, { p_custom_values: [] })),
    "Hosted preset edit malformed custom values",
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
select 'cleaned' as fixture_state;`, "Hosted Calendar source cleanup");

  exactResidueCount = runHostedSql(`select (
  (select count(*) from public.workspaces where id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)})) +
  (select count(*) from public.project_contacts where auth_user_id = any(array[${userIdArray}])) +
  (select count(*) from public.workspace_contact_grants where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)})) +
  (select count(*) from public.task_presets where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)})) +
  (select count(*) from public.calendar_items where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)})) +
  (select count(*) from public.calendar_assignments where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)})) +
  (select count(*) from public.assignment_responses where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)})) +
  (select count(*) from auth.users where id = any(array[${userIdArray}]))
)::int as residue_count;`, "Hosted Calendar source exact residue check")[0]?.residue_count;
  assert(exactResidueCount === 0, "Hosted Calendar source fixtures left exact-run residue.");
  cleanupCompleted = true;
}

function verifyNamespaceResidue() {
  namespaceResidueCount = runHostedSql(`select (
  (select count(*) from public.workspaces where workspace_key like 'qa-12-17-1-%') +
  (select count(*) from public.task_presets where name like 'qa-12-17-1-%') +
  (select count(*) from public.calendar_items where title_snapshot like 'qa-12-17-1-%') +
  (select count(*) from auth.users where email like 'qa-12-17-1-%@example.invalid')
)::int as residue_count;`, "Hosted 12.17.1 namespace residue check")[0]?.residue_count;
  assert(namespaceResidueCount === 0, "Hosted qa-12-17-1 namespace left fixture/Auth residue.");
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
  assert(cleanupCompleted && verifyNamespaceResidue() === 0, "Hosted Calendar source cleanup did not complete.");
  console.log("Hosted staging Calendar source-selection QA passed.");
  console.log(`Validated target ${expectedName} (${expectedRef}) with status ${projectStatus}.`);
  console.log(`Migration level before gate: ${before}; after gate: ${after}.`);
  console.log("Validated selector authorization/projection/scoping, preset-backed create/edit, source immutability, one-off continuity, capability isolation, direct table-write denial, malformed/source rejection, generated type parity, and read-model compatibility.");
  console.log(`Hosted disposable product and Auth residue: ${exactResidueCount + namespaceResidueCount}.`);
  console.log("No access token, refresh token, password, API key, database URL, bearer, verifier, or service credential was logged.");
}

main().catch((error) => {
  console.error(`Hosted Calendar source-selection QA failed: ${redact(error)}`);
  process.exitCode = 1;
});
