import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  buildProjectLocalDefaultTablePrivilegeQuery,
  buildProjectLocalDirectTablePrivilegeQuery,
  compareProjectLocalDefaultTablePrivileges,
  compareProjectLocalDirectTablePrivileges,
  projectLocalTableNames,
} from "../lib/security/projectLocalTablePrivileges.server.ts";

const root = process.cwd();
const expectedName = "project-local-staging";
const expectedRef = "kfuujcfxoayukywvtaeh";
const forbiddenProductionRef = "wdlaauzknfggoqldolmx";
const expectedConfirmation = `${expectedName}:${expectedRef}`;
const optInName = "RUN_HOSTED_ASSIGNMENT_NOTIFICATION_HEALTH_VALIDATION";
const expectedBeforeMigration = "20260811123300";
const expectedAfterMigration = "20260812123430";
const expectedMigrationFile = `${expectedAfterMigration}_project_local_table_privilege_hardening.sql`;
const hostedUrl = `https://${expectedRef}.supabase.co`;
const namespace = `qa-12-33-notification-health-${randomUUID()}`;
const secrets = new Set();
const fullCapabilities = [
  "workspace.read",
  "calendar.view",
  "assignments.view",
  "assignments.edit",
];

const fixture = {
  workspaces: Object.fromEntries(
    ["target", "other", "ambiguous", "inactive"].map((key) => [key, randomUUID()]),
  ),
  contacts: Object.fromEntries(
    [
      "authorized",
      "other",
      "missingCapability",
      "roleOnly",
      "revoked",
      "expired",
      "inactiveGrant",
      "inactiveContact",
      "inactiveWorkspace",
      "ambiguous",
    ].map((key) => [key, randomUUID()]),
  ),
  grants: Object.fromEntries(
    [
      "authorized",
      "other",
      "missingCapability",
      "roleOnly",
      "revoked",
      "expired",
      "inactiveGrant",
      "inactiveContact",
      "inactiveWorkspace",
      "ambiguousTarget",
      "ambiguousSecond",
    ].map((key) => [key, randomUUID()]),
  ),
  volunteers: Object.fromEntries(
    ["targetStale", "targetFresh", "targetSent", "targetFailed", "otherStale"].map(
      (key) => [key, randomUUID()],
    ),
  ),
  items: { target: randomUUID(), other: randomUUID() },
  assignments: Object.fromEntries(
    ["targetStale", "targetFresh", "targetSent", "targetFailed", "otherStale"].map(
      (key) => [key, randomUUID()],
    ),
  ),
  deliveries: Object.fromEntries(
    ["targetStale", "targetFresh", "targetSent", "targetFailed", "otherStale"].map(
      (key) => [key, randomUUID()],
    ),
  ),
  users: Object.fromEntries(
    [
      "authorized",
      "other",
      "missingCapability",
      "roleOnly",
      "revoked",
      "expired",
      "inactiveGrant",
      "inactiveContact",
      "inactiveWorkspace",
      "ambiguous",
      "missingContact",
    ].map((label) => [
      label,
      {
        label,
        userId: randomUUID(),
        identityId: randomUUID(),
        email: "",
        password: "",
        client: null,
      },
    ]),
  ),
};

let hostedAnonKey = "";
let migrationBefore = "unknown";
let migrationAfter = "unknown";
let projectStatus = "unknown";
let exactResidueCount = null;
let namespaceResidueCount = null;
let fixturesCreated = false;
let cleanupCompleted = false;

function redact(value) {
  let message = value instanceof Error ? (value.stack ?? value.message) : String(value);
  for (const secret of secrets) {
    if (typeof secret === "string" && secret.length > 0) {
      message = message.replaceAll(secret, "[redacted]");
      message = message.replaceAll(encodeURIComponent(secret), "[redacted]");
    }
  }
  return message
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted-jwt]")
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "postgres://[redacted]")
    .slice(0, 1800);
}

function sqlText(value) {
  if (value === null || value === undefined) return "null";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlUuid(value) {
  return `${sqlText(value)}::uuid`;
}

function sqlArray(values) {
  return `array[${values.map(sqlText).join(", ")} ]::text[]`;
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
    maxBuffer: 120 * 1024 * 1024,
  });
  if (result.status !== 0) {
    const detail = options.sensitiveOutput
      ? "Sensitive command output was suppressed."
      : [result.error?.message, result.stderr, result.stdout].filter(Boolean).join("\n");
    throw new Error(`${options.stage ?? "Hosted Supabase CLI"} failed: ${redact(detail)}`);
  }
  return (
    options.includeStderr
      ? [result.stdout, result.stderr].filter(Boolean).join("\n")
      : result.stdout
  ).trim();
}

function parseCliJson(output, stage) {
  try {
    return JSON.parse(output);
  } catch {
    throw new Error(`${stage} returned unreadable JSON.`);
  }
}

function runHostedSql(sql, stage = "Hosted database query") {
  const file = path.join(tmpdir(), `project-local-12-33-${randomUUID()}.sql`);
  writeFileSync(file, sql, "utf8");
  let output;
  try {
    output = runSupabaseCli(
      ["db", "query", "--linked", "--file", file, "--output-format", "json"],
      { sensitiveOutput: true, stage },
    );
  } finally {
    try {
      unlinkSync(file);
    } catch {
      // Best effort; the OS temporary directory is outside the repository.
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
      /\n\s*\/\/ Allows to automatically instantiate createClient with right options\s*\n\s*\/\/ instead of createClient<Database, \{ PostgrestVersion: 'XX' \}>\(URL, KEY\)\s*(?=\n\s*__InternalSupabase:)/m,
      "",
    )
    .replace(
      /\n\s*__InternalSupabase:\s*\{\s*\n\s*PostgrestVersion:\s*"[^"]+"\s*\n\s*\}\s*(?=\n\s*public:)/m,
      "",
    )
    .trim();
}

async function verifyGeneratedTypes() {
  const localTypes = await readFile(
    path.join(root, "lib", "supabase", "database.types.ts"),
    "utf8",
  );
  const hostedTypes = runSupabaseCli(
    ["gen", "types", "typescript", "--linked", "--schema", "public"],
    { sensitiveOutput: true, stage: "Hosted generated-type comparison" },
  );
  assert.equal(
    normalizeGeneratedTypes(hostedTypes),
    normalizeGeneratedTypes(localTypes),
    "Hosted public-schema types differ from repository generated types.",
  );
}

async function verifyTargetAndReadAnonKey() {
  assert.equal(
    process.env[optInName],
    expectedConfirmation,
    `Refusing hosted validation without ${optInName}=${expectedConfirmation}.`,
  );
  assert.notEqual(expectedRef, forbiddenProductionRef, "Hosted staging gate resolved to production.");
  assert(!process.env.ASSIGNMENT_NOTIFICATION_EMAIL_TRANSPORT?.trim(), "Application email must remain disabled during hosted staging validation.");
  assert(!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(), "Service-role application configuration must remain absent during hosted staging validation.");
  const linkedRef = (
    await readFile(path.join(root, "supabase", ".temp", "project-ref"), "utf8")
  ).trim();
  assert.equal(linkedRef, expectedRef, "Linked Supabase target is not approved staging.");
  const projectList = parseCliJson(
    runSupabaseCli(["projects", "list", "--output-format", "json"]),
    "Hosted project discovery",
  );
  const projects = Array.isArray(projectList) ? projectList : projectList.projects;
  const project = projects?.find((entry) => entry.ref === expectedRef);
  assert(
    project?.name === expectedName && project?.status === "ACTIVE_HEALTHY",
    "Approved staging is not ACTIVE_HEALTHY.",
  );
  projectStatus = project.status;

  const apiKeyResult = parseCliJson(
    runSupabaseCli(
      ["projects", "api-keys", "--project-ref", expectedRef, "--output-format", "json"],
      { sensitiveOutput: true, stage: "Hosted API-key discovery" },
    ),
    "Hosted API-key discovery",
  );
  const apiKeys = Array.isArray(apiKeyResult)
    ? apiKeyResult
    : (apiKeyResult.api_keys ?? apiKeyResult.keys);
  assert(Array.isArray(apiKeys), "Hosted API-key discovery returned an unexpected shape.");
  for (const entry of apiKeys) if (typeof entry.api_key === "string") secrets.add(entry.api_key);
  hostedAnonKey = apiKeys.find((entry) => entry.name === "anon")?.api_key ?? "";
  assert(hostedAnonKey.length > 100, "Hosted anon key is unavailable.");
}

async function ensureExpectedMigrationApplied() {
  migrationBefore = latestHostedMigration() ?? "unknown";
  assert(
    [expectedBeforeMigration, expectedAfterMigration].includes(migrationBefore),
    `Hosted staging latest migration ${migrationBefore} is outside the reviewed 12.34.3 boundary.`,
  );
  if (migrationBefore === expectedBeforeMigration) {
    const pending = await localMigrationVersionsAfter(migrationBefore);
    assert.deepEqual(pending, [expectedAfterMigration]);
    const dryRun = runSupabaseCli(["db", "push", "--linked", "--dry-run", "--yes"], {
      includeStderr: true,
      stage: "Hosted migration dry-run",
    });
    assert(
      dryRun.includes(expectedMigrationFile) || dryRun.includes(expectedAfterMigration),
      "Hosted dry-run did not identify only the reviewed 12.34.3 migration.",
    );
    for (const match of dryRun.matchAll(/\b20\d{12}\b/g)) {
      assert(
        match[0] <= expectedBeforeMigration || match[0] === expectedAfterMigration,
        `Hosted dry-run included unexpected migration ${match[0]}.`,
      );
    }
    runSupabaseCli(["db", "push", "--linked", "--yes"], {
      sensitiveOutput: true,
      stage: "Hosted reviewed 12.34.3 migration application",
    });
  }
  migrationAfter = latestHostedMigration() ?? "unknown";
  assert.equal(migrationAfter, expectedAfterMigration);
}

function verifyStructuralPrivileges() {
  const directRows = runHostedSql(
    buildProjectLocalDirectTablePrivilegeQuery(),
    "Hosted exact direct table privilege check",
  );
  const directDiff = compareProjectLocalDirectTablePrivileges(directRows);
  assert.equal(directDiff.unexpected.length, 0, "Hosted staging has an unapproved direct table privilege.");
  assert.equal(directDiff.missing.length, 0, "Hosted staging is missing an approved direct table privilege.");

  const defaultRows = runHostedSql(
    buildProjectLocalDefaultTablePrivilegeQuery(),
    "Hosted exact default table privilege check",
  );
  const defaultDiff = compareProjectLocalDefaultTablePrivileges(defaultRows);
  assert.equal(defaultDiff.unexpected.length, 0, "Hosted staging has an unapproved default table privilege.");
  assert.equal(defaultDiff.missing.length, 0, "Hosted staging is missing an approved default table privilege.");

  const tableList = projectLocalTableNames.map(sqlText).join(", ");
  const rlsRows = runHostedSql(
    `select relname as table_name, relrowsecurity as rls_enabled, relforcerowsecurity as force_rls
from pg_catalog.pg_class as relation
join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
where namespace.nspname = 'public' and relation.relkind = 'r' and relation.relname in (${tableList})
order by relation.relname;`,
    "Hosted RLS/FORCE RLS structural check",
  );
  assert.equal(rlsRows.length, 13);
  assert(rlsRows.every((row) => row.rls_enabled === true), "Hosted staging has a Project Local table without RLS.");
  assert.deepEqual(
    rlsRows.filter((row) => row.force_rls === true).map((row) => row.table_name),
    [
      "assignment_notification_deliveries",
      "project_contacts",
      "workspace_contact_grants",
      "workspaces",
    ],
  );
}

function hostedClient() {
  return createClient(hostedUrl, hostedAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function authUserSql(user) {
  return `insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000'::uuid, ${sqlUuid(user.userId)},
  'authenticated', 'authenticated', ${sqlText(user.email)}, extensions.crypt(${sqlText(user.password)}, extensions.gen_salt('bf')), clock_timestamp(),
  '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb, clock_timestamp(), clock_timestamp()
);
insert into auth.identities (
  provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, id
) values (
  ${sqlText(user.userId)}, ${sqlUuid(user.userId)},
  jsonb_build_object('sub', ${sqlText(user.userId)}, 'email', ${sqlText(user.email)}),
  'email', clock_timestamp(), clock_timestamp(), clock_timestamp(), ${sqlUuid(user.identityId)}
);`;
}

async function createAuthFixtures() {
  for (const user of Object.values(fixture.users)) {
    user.email = `${namespace}-${user.label}@example.invalid`;
    user.password = `${randomBytes(24).toString("base64url")}aA1!`;
    secrets.add(user.email);
    secrets.add(user.password);
  }
  runHostedSql(
    `${Object.values(fixture.users).map(authUserSql).join("\n")}\nselect 'created' as state;`,
    "Hosted notification-health Auth fixture creation",
  );
  fixturesCreated = true;
}

function grantRow(key, contactKey, workspaceKey, capabilities, overrides = {}) {
  return `(${sqlUuid(fixture.grants[key])}, ${sqlUuid(fixture.workspaces[workspaceKey])}, ${sqlUuid(fixture.contacts[contactKey])}, 'main_contact', ${sqlArray(capabilities)}, ${sqlText(overrides.status ?? "active")}, ${overrides.validFrom ?? "clock_timestamp() - interval '1 day'"}, ${overrides.validUntil ?? "null"}, ${overrides.revokedAt ?? "null"})`;
}

function createProductFixtures() {
  const workspaceRows = Object.entries(fixture.workspaces).map(
    ([key, id]) => `(${sqlUuid(id)}, ${sqlText(`${namespace}-${key}`)}, ${sqlText(`QA 12.33 ${key}`)}, ${sqlText(key === "inactive" ? "archived" : "active")}, 'America/Denver', current_date, current_date + 30, false)`,
  );
  const contactRows = Object.entries(fixture.contacts).map(
    ([key, id]) => `(${sqlUuid(id)}, ${sqlUuid(fixture.users[key].userId)}, ${sqlText(key === "inactiveContact" ? "inactive" : "active")})`,
  );
  const grants = [
    grantRow("authorized", "authorized", "target", fullCapabilities),
    grantRow("other", "other", "other", fullCapabilities),
    grantRow("missingCapability", "missingCapability", "target", fullCapabilities.slice(0, 3)),
    grantRow("roleOnly", "roleOnly", "target", ["workspace.read"]),
    grantRow("revoked", "revoked", "target", fullCapabilities, { status: "revoked", revokedAt: "clock_timestamp() - interval '1 hour'" }),
    grantRow("expired", "expired", "target", fullCapabilities, { validFrom: "clock_timestamp() - interval '2 days'", validUntil: "clock_timestamp() - interval '1 day'" }),
    grantRow("inactiveGrant", "inactiveGrant", "target", fullCapabilities, { status: "inactive" }),
    grantRow("inactiveContact", "inactiveContact", "target", fullCapabilities),
    grantRow("inactiveWorkspace", "inactiveWorkspace", "inactive", fullCapabilities),
    grantRow("ambiguousTarget", "ambiguous", "target", fullCapabilities),
    grantRow("ambiguousSecond", "ambiguous", "ambiguous", fullCapabilities),
  ];
  const volunteerRows = [
    ["targetStale", "target", "authorized"],
    ["targetFresh", "target", "authorized"],
    ["targetSent", "target", "authorized"],
    ["targetFailed", "target", "authorized"],
    ["otherStale", "other", "other"],
  ].map(([key, workspaceKey, contactKey]) => `(${sqlUuid(fixture.volunteers[key])}, ${sqlUuid(fixture.workspaces[workspaceKey])}, null, 'manual', ${sqlUuid(fixture.contacts[contactKey])}, clock_timestamp(), 'active', 'ready', ${sqlText(`${namespace} ${key}`)}, ${sqlText(`${namespace}-${key}@example.invalid`)}, null, null, null, '{}'::jsonb, '{}'::jsonb, '')`);
  const itemRows = [
    ["target", "authorized"],
    ["other", "other"],
  ].map(([workspaceKey, contactKey]) => `(${sqlUuid(fixture.items[workspaceKey])}, ${sqlUuid(fixture.workspaces[workspaceKey])}, null, ${sqlText(`${namespace} ${workspaceKey}`)}, 'general', 'timed', current_date + 7, null, '09:00'::time, '10:00'::time, 'America/Denver', 1, null, '{}'::jsonb, 'active', ${sqlUuid(fixture.contacts[contactKey])}, ${sqlUuid(fixture.contacts[contactKey])}, 'published', clock_timestamp(), ${sqlUuid(fixture.contacts[contactKey])})`);
  const assignmentRows = [
    ["targetStale", "target", "authorized"],
    ["targetFresh", "target", "authorized"],
    ["targetSent", "target", "authorized"],
    ["targetFailed", "target", "authorized"],
    ["otherStale", "other", "other"],
  ].map(([key, workspaceKey, userKey]) => `(${sqlUuid(fixture.assignments[key])}, ${sqlUuid(fixture.workspaces[workspaceKey])}, ${sqlUuid(fixture.items[workspaceKey])}, ${sqlUuid(fixture.volunteers[key])}, 'active', null, ${sqlUuid(fixture.users[userKey].userId)})`);
  const sendingRow = (key, workspaceKey, expiration) => `(${sqlUuid(fixture.deliveries[key])}, ${sqlUuid(fixture.workspaces[workspaceKey])}, ${sqlUuid(fixture.items[workspaceKey])}, ${sqlUuid(fixture.assignments[key])}, ${sqlUuid(fixture.volunteers[key])}, 'initial_assignment', 'initial-assignment.v1', 'sending', 1, null, null, null, ${sqlText(`health:${fixture.assignments[key]}`)}, null, clock_timestamp() - interval '5 minutes', ${expiration}, null, null)`;
  const deliveryRows = [
    sendingRow("targetStale", "target", "clock_timestamp() - interval '2 hours'"),
    sendingRow("targetFresh", "target", "clock_timestamp() + interval '2 hours'"),
    `(${sqlUuid(fixture.deliveries.targetSent)}, ${sqlUuid(fixture.workspaces.target)}, ${sqlUuid(fixture.items.target)}, ${sqlUuid(fixture.assignments.targetSent)}, ${sqlUuid(fixture.volunteers.targetSent)}, 'initial_assignment', 'initial-assignment.v1', 'sent', 1, ${sqlText(`${namespace}-sent@example.invalid`)}, 'qa-provider-id', null, ${sqlText(`health:${fixture.assignments.targetSent}`)}, null, null, null, clock_timestamp(), null)`,
    `(${sqlUuid(fixture.deliveries.targetFailed)}, ${sqlUuid(fixture.workspaces.target)}, ${sqlUuid(fixture.items.target)}, ${sqlUuid(fixture.assignments.targetFailed)}, ${sqlUuid(fixture.volunteers.targetFailed)}, 'initial_assignment', 'initial-assignment.v1', 'failed', 1, null, null, 'provider_send_failed', ${sqlText(`health:${fixture.assignments.targetFailed}`)}, null, null, null, null, clock_timestamp())`,
    sendingRow("otherStale", "other", "clock_timestamp() - interval '3 hours'"),
  ];

  runHostedSql(`begin;
insert into public.workspaces (id, workspace_key, display_name, lifecycle, timezone, starts_on, ends_on, public_intake_enabled) values ${workspaceRows.join(",\n")};
insert into public.project_contacts (id, auth_user_id, status) values ${contactRows.join(",\n")};
insert into public.workspace_contact_grants (id, workspace_id, project_contact_id, role, capabilities, status, valid_from, valid_until, revoked_at) values ${grants.join(",\n")};
insert into public.volunteer_profiles (id, workspace_id, source_submission_id, profile_source, manual_created_by_project_contact_id, manual_created_at, lifecycle, readiness_status, full_name, email, phone, congregation, preferred_contact_method, availability_snapshot, skills_help_snapshot, profile_notes) values ${volunteerRows.join(",\n")};
insert into public.calendar_items (id, workspace_id, task_preset_id, title_snapshot, task_type_snapshot, schedule_kind, start_date, end_date, start_time, end_time, timezone, needed_count, schedule_notes, custom_values, lifecycle, follow_up_project_contact_id, created_by_project_contact_id, publication_state, published_at, published_by_project_contact_id) values ${itemRows.join(",\n")};
insert into public.calendar_assignments (id, workspace_id, calendar_item_id, volunteer_profile_id, lifecycle, assignment_note, created_by_auth_user_id) values ${assignmentRows.join(",\n")};
insert into public.assignment_notification_deliveries (id, workspace_id, calendar_item_id, calendar_assignment_id, volunteer_profile_id, notification_kind, template_version, delivery_state, attempt_count, recipient_email_snapshot, provider_message_id, safe_failure_code, idempotency_key, initiated_by_project_contact_id, sending_started_at, sending_expires_at, sent_at, failed_at) values ${deliveryRows.join(",\n")};
commit;
select 'created' as state;`, "Hosted notification-health product fixture creation");
}

async function signInUsers() {
  for (const user of Object.values(fixture.users)) {
    user.client = hostedClient();
    const result = await user.client.auth.signInWithPassword({
      email: user.email,
      password: user.password,
    });
    assert(!result.error && result.data.session, `Hosted sign-in failed for ${user.label}.`);
    secrets.add(result.data.session.access_token);
    secrets.add(result.data.session.refresh_token);
  }
}

async function expectDenied(client, label) {
  const result = await client.rpc("read_assignment_notification_delivery_health");
  assert(result.error, `${label} should fail closed.`);
}

async function verifyRpcBehavior() {
  const anon = hostedClient();
  await expectDenied(anon, "Anonymous caller");

  const before = runHostedSql(
    `select id::text, delivery_state, attempt_count, sending_started_at, sending_expires_at, sent_at, failed_at, updated_at from public.assignment_notification_deliveries where workspace_id in (${sqlUuid(fixture.workspaces.target)}, ${sqlUuid(fixture.workspaces.other)}) order by id;`,
    "Hosted notification-health pre-read state",
  );
  const result = await fixture.users.authorized.client.rpc(
    "read_assignment_notification_delivery_health",
  );
  assert(!result.error);
  assert.equal(result.data.length, 2);
  assert.deepEqual(Object.keys(result.data[0]).sort(), [
    "delivery_id",
    "delivery_state",
    "sending_expires_at",
  ]);
  assert.deepEqual(
    result.data.map((row) => row.delivery_id),
    [fixture.deliveries.targetStale, fixture.deliveries.targetFresh],
  );
  assert(result.data.every((row) => row.delivery_state === "sending"));
  const serialized = JSON.stringify(result.data);
  assert(!serialized.includes(namespace));
  for (const forbidden of [
    "recipient",
    "volunteer",
    "provider",
    "token",
    "error",
    "capabilities",
  ]) {
    assert(!serialized.toLowerCase().includes(forbidden));
  }

  const other = await fixture.users.other.client.rpc(
    "read_assignment_notification_delivery_health",
  );
  assert(!other.error);
  assert.deepEqual(other.data.map((row) => row.delivery_id), [fixture.deliveries.otherStale]);

  for (const label of [
    "missingCapability",
    "roleOnly",
    "revoked",
    "expired",
    "inactiveGrant",
    "inactiveContact",
    "inactiveWorkspace",
    "ambiguous",
    "missingContact",
  ]) {
    await expectDenied(fixture.users[label].client, label);
  }

  const direct = await fixture.users.authorized.client
    .from("assignment_notification_deliveries")
    .select("id")
    .limit(1);
  assert(direct.error, "Hosted direct authenticated ledger SELECT must remain denied.");
  const deniedWorkspaceInsert = await fixture.users.authorized.client
    .from("workspaces")
    .insert({
      id: randomUUID(),
      workspace_key: `${namespace}-denied-authenticated`,
      display_name: "Denied authenticated fixture",
      lifecycle: "active",
      timezone: "America/Denver",
      starts_on: "2026-08-12",
      ends_on: "2026-08-13",
      public_intake_enabled: false,
    });
  assert(deniedWorkspaceInsert.error, "Hosted direct authenticated table mutation must remain denied.");
  const deniedAnonInsert = await anon.from("workspaces").insert({
    id: randomUUID(),
    workspace_key: `${namespace}-denied-anon`,
    display_name: "Denied anonymous fixture",
    lifecycle: "active",
    timezone: "America/Denver",
    starts_on: "2026-08-12",
    ends_on: "2026-08-13",
    public_intake_enabled: false,
  });
  assert(deniedAnonInsert.error, "Hosted direct anonymous table mutation must remain denied.");
  const after = runHostedSql(
    `select id::text, delivery_state, attempt_count, sending_started_at, sending_expires_at, sent_at, failed_at, updated_at from public.assignment_notification_deliveries where workspace_id in (${sqlUuid(fixture.workspaces.target)}, ${sqlUuid(fixture.workspaces.other)}) order by id;`,
    "Hosted notification-health post-read state",
  );
  assert.deepEqual(after, before, "Hosted notification-health reads mutated the ledger.");
}

function idArray(values) {
  return values.map(sqlUuid).join(", ") || "null::uuid";
}

function cleanupFixtures() {
  for (const user of Object.values(fixture.users)) {
    if (user.client) user.client.auth.signOut({ scope: "local" }).catch(() => undefined);
  }
  const workspaceIds = idArray(Object.values(fixture.workspaces));
  const contactIds = idArray(Object.values(fixture.contacts));
  const userIds = idArray(Object.values(fixture.users).map((user) => user.userId));
  runHostedSql(`begin;
delete from public.assignment_notification_deliveries where workspace_id in (${workspaceIds});
delete from public.calendar_assignments where workspace_id in (${workspaceIds});
delete from public.calendar_items where workspace_id in (${workspaceIds});
delete from public.volunteer_profiles where workspace_id in (${workspaceIds});
delete from public.workspace_contact_grants where workspace_id in (${workspaceIds}) or project_contact_id in (${contactIds});
delete from public.project_contacts where id in (${contactIds}) or auth_user_id in (${userIds});
delete from public.workspaces where id in (${workspaceIds}) or workspace_key like ${sqlText(`${namespace}%`)};
delete from auth.identities where user_id in (${userIds});
delete from auth.users where id in (${userIds}) or email like ${sqlText(`${namespace}%`)};
commit;
select 'cleaned' as state;`, "Hosted notification-health cleanup");
  cleanupCompleted = true;
}

function verifyZeroResidue() {
  const workspaceIds = idArray(Object.values(fixture.workspaces));
  const contactIds = idArray(Object.values(fixture.contacts));
  const userIds = idArray(Object.values(fixture.users).map((user) => user.userId));
  exactResidueCount = Number(
    runHostedSql(`select (
      (select count(*) from public.assignment_notification_deliveries where workspace_id in (${workspaceIds})) +
      (select count(*) from public.calendar_assignments where workspace_id in (${workspaceIds})) +
      (select count(*) from public.calendar_items where workspace_id in (${workspaceIds})) +
      (select count(*) from public.volunteer_profiles where workspace_id in (${workspaceIds})) +
      (select count(*) from public.workspace_contact_grants where workspace_id in (${workspaceIds}) or project_contact_id in (${contactIds})) +
      (select count(*) from public.project_contacts where id in (${contactIds}) or auth_user_id in (${userIds})) +
      (select count(*) from public.workspaces where id in (${workspaceIds})) +
      (select count(*) from auth.users where id in (${userIds}))
    )::int as residue_count;`, "Hosted notification-health exact residue check")[0]?.residue_count,
  );
  namespaceResidueCount = Number(
    runHostedSql(`select (
      (select count(*) from public.workspaces where workspace_key like ${sqlText(`${namespace}%`)}) +
      (select count(*) from public.volunteer_profiles where full_name like ${sqlText(`${namespace}%`)}) +
      (select count(*) from public.calendar_items where title_snapshot like ${sqlText(`${namespace}%`)}) +
      (select count(*) from auth.users where email like ${sqlText(`${namespace}%`)})
    )::int as residue_count;`, "Hosted notification-health namespace residue check")[0]?.residue_count,
  );
  assert.equal(exactResidueCount, 0);
  assert.equal(namespaceResidueCount, 0);
  assert.equal(latestHostedMigration(), expectedAfterMigration);
}

async function main() {
  try {
    await verifyTargetAndReadAnonKey();
    await ensureExpectedMigrationApplied();
    await verifyGeneratedTypes();
    verifyStructuralPrivileges();
    await createAuthFixtures();
    createProductFixtures();
    await signInUsers();
    await verifyRpcBehavior();
  } catch (error) {
    console.error(redact(error));
    process.exitCode = 1;
  } finally {
    if (fixturesCreated) {
      try {
        cleanupFixtures();
        verifyZeroResidue();
      } catch (error) {
        console.error(redact(error));
        process.exitCode = 1;
      }
    }
  }
  assert(!fixturesCreated || cleanupCompleted, "Hosted fixture cleanup did not complete.");
  if (!process.exitCode) {
    console.log(`Hosted notification-health validation passed for ${expectedName} (${expectedRef}).`);
    console.log(`Project health: ${projectStatus}. Migration before: ${migrationBefore}. Migration after: ${migrationAfter}.`);
    console.log("Validated authenticated/capability authorization, unique workspace derivation, isolation, minimal sending-only projection, stale/fresh behavior, no mutation, direct table denial, and zero hosted residue.");
    console.log(`Hosted disposable residue: exact=${exactResidueCount}, namespace=${namespaceResidueCount}.`);
    console.log("No email, production target, service credential, recipient, volunteer, provider payload, token, schedule URL, or raw database error was exposed.");
  }
}

await main();
