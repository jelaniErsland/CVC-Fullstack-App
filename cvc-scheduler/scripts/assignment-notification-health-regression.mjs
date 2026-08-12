import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { readAssignmentNotificationHealthWithClient } from "../lib/observability/assignmentNotificationHealth.server.ts";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const root = process.cwd();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const namespace = `qa-12-33-notification-health-${randomUUID()}`;
const fullCapabilities = [
  "workspace.read",
  "calendar.view",
  "assignments.view",
  "assignments.edit",
];
const secrets = new Set();
const authUserIds = [];

const fixture = {
  workspaces: Object.fromEntries(
    ["target", "other", "clean", "limit", "ambiguous", "inactive"].map((key) => [
      key,
      randomUUID(),
    ]),
  ),
  contacts: Object.fromEntries(
    [
      "authorized",
      "other",
      "clean",
      "limit",
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
      "clean",
      "limit",
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
  volunteers: {},
  items: {},
  assignments: [],
  deliveries: [],
};

for (const key of ["target", "other", "clean", "limit"]) {
  fixture.items[key] = randomUUID();
}

function isLoopbackUrl(value) {
  try {
    return ["127.0.0.1", "localhost", "[::1]", "::1"].includes(
      new URL(value).hostname,
    );
  } catch {
    return false;
  }
}

function redact(value) {
  let message = value instanceof Error ? (value.stack ?? value.message) : String(value);
  for (const secret of secrets) {
    if (typeof secret === "string" && secret.length > 0) {
      message = message.replaceAll(secret, "[redacted]");
      message = message.replaceAll(encodeURIComponent(secret), "[redacted]");
    }
  }
  return message.replace(
    /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
    "[redacted-jwt]",
  );
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

function command(commandName, args, options = {}) {
  return spawnSync(commandName, args, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 120 * 1024 * 1024,
    ...options,
  });
}

function runSupabaseCli(args) {
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
  const result = command(executable, executableArgs);
  assert.equal(result.status, 0, "Local Supabase CLI generated-type check failed.");
  return result.stdout;
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
  const current = await readFile(
    path.join(root, "lib", "supabase", "database.types.ts"),
    "utf8",
  );
  const generated = runSupabaseCli([
    "gen",
    "types",
    "typescript",
    "--local",
    "--schema",
    "public",
  ]);
  assert.equal(
    normalizeGeneratedTypes(generated),
    normalizeGeneratedTypes(current),
    "Local generated public-schema types differ from repository types.",
  );
}

function runPsql(containerName, sql) {
  const result = command(
    "docker",
    [
      "exec",
      "-i",
      containerName,
      "psql",
      "--no-psqlrc",
      "-X",
      "-qAt",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "postgres",
      "-d",
      "postgres",
    ],
    { input: sql },
  );
  if (result.status !== 0) {
    throw new Error(`Local notification-health SQL failed: ${redact(result.stderr).slice(0, 900)}`);
  }
  return result.stdout.trim();
}

function queryJson(containerName, sql) {
  const output = runPsql(
    containerName,
    `select coalesce(jsonb_agg(to_jsonb(rows)), '[]'::jsonb)::text from (${sql}) as rows;`,
  );
  return JSON.parse(output || "[]");
}

async function resolveLocalDatabaseContainer() {
  const config = await readFile(path.join(root, "supabase", "config.toml"), "utf8");
  const projectId = config.match(/^project_id\s*=\s*"([a-zA-Z0-9_-]+)"/m)?.[1];
  assert(projectId, "supabase/config.toml must define a local project_id.");
  const containerName = `supabase_db_${projectId}`;
  const result = command("docker", ["inspect", "--format", "{{.State.Running}}", containerName]);
  assert(
    result.status === 0 && result.stdout.trim() === "true",
    "Local Supabase is unavailable. Start disposable local Supabase before this regression.",
  );
  return containerName;
}

async function verifyStaticContract() {
  const [migration, helper, detector, route, types, packageJson] = await Promise.all([
    readFile(
      path.join(
        root,
        "supabase/migrations/20260811123300_stale_assignment_notification_delivery_health.sql",
      ),
      "utf8",
    ),
    readFile(
      path.join(root, "lib/observability/assignmentNotificationHealth.server.ts"),
      "utf8",
    ),
    readFile(path.join(root, "lib/observability/staleAssignmentDeliveries.server.ts"), "utf8"),
    readFile(path.join(root, "app/admin/diagnostics/notification-health/page.tsx"), "utf8"),
    readFile(path.join(root, "lib/supabase/database.types.ts"), "utf8"),
    readFile(path.join(root, "package.json"), "utf8"),
  ]);

  assert.match(migration, /read_assignment_notification_delivery_health\(\)/);
  assert.match(migration, /security definer/i);
  assert.match(migration, /set search_path = ''/i);
  assert.match(migration, /caller_user_id := auth\.uid\(\)/);
  for (const capability of fullCapabilities) assert(migration.includes(capability));
  assert.match(migration, /eligible_workspace_count <> 1/);
  assert.match(migration, /delivery\.delivery_state = 'sending'/);
  assert.match(migration, /order by delivery\.sending_expires_at asc, delivery\.id asc/i);
  assert.match(migration, /limit 100/i);
  assert.doesNotMatch(migration, /select\s+\*/i);
  assert.match(migration, /revoke all on function[^;]+from anon, authenticated/is);
  assert.match(migration, /grant execute on function[^;]+to authenticated/is);
  assert.doesNotMatch(migration, /grant\s+select\s+on\s+(?:table\s+)?public\.assignment_notification_deliveries/i);
  assert.doesNotMatch(migration, /service_role/i);

  assert(helper.startsWith('import "server-only";'));
  assert.match(helper, /\.rpc\(\s*"read_assignment_notification_delivery_health"/s);
  assert.match(helper, /observeStaleAssignmentDeliveries/);
  assert.doesNotMatch(helper, /\.from\(|fetch\(|claim_|finalize_|retry|resend|service.role/i);
  assert.match(detector, /if \(staleDeliveries\.length > 0\)/);

  assert.match(route, /dynamic = "force-dynamic"/);
  assert.match(route, /revalidate = 0/);
  assert.match(route, /readCalendarAssignmentMutationRouteContext/);
  assert.match(route, /No stale assignment email deliveries need attention\./);
  assert.match(route, /stale assignment email/);
  assert.doesNotMatch(route, /deliveryId|delivery_id|recipient_email|provider_message_id|bearer_token/);
  assert(types.includes("read_assignment_notification_delivery_health"));
  assert(packageJson.includes("test:assignment-notification-health"));

  const linkedSources = command("rg", [
    "-l",
    "diagnostics/notification-health",
    "app",
    "components",
  ]);
  assert.equal(linkedSources.status, 1);
  const sourcePaths = linkedSources.stdout
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((value) => value.replaceAll("\\", "/"));
  assert.deepEqual(sourcePaths, []);
}

async function verifyHelperContract() {
  const eventLines = [];
  const now = () => new Date("2026-08-11T18:00:00.000Z");
  const clientFor = (data, error = null) => ({
    rpc: async (name) => {
      assert.equal(name, "read_assignment_notification_delivery_health");
      return { data, error };
    },
  });

  const healthy = await readAssignmentNotificationHealthWithClient(
    clientFor([
      {
        delivery_id: "11111111-1111-4111-8111-111111111111",
        delivery_state: "sending",
        sending_expires_at: "2026-08-11T18:15:00.000Z",
      },
    ]),
    { now },
  );
  assert.equal(healthy.kind, "healthy");
  assert.equal(healthy.checkedSendingDeliveryCount, 1);

  const attention = await readAssignmentNotificationHealthWithClient(
    clientFor([
      {
        delivery_id: "22222222-2222-4222-8222-222222222222",
        delivery_state: "sending",
        sending_expires_at: "2026-08-11T17:45:00.000Z",
      },
      {
        delivery_id: "33333333-3333-4333-8333-333333333333",
        delivery_state: "sending",
        sending_expires_at: "2026-08-11T17:50:00.000Z",
      },
    ]),
    { now, observability: { write: (line) => eventLines.push(line) } },
  );
  assert.equal(attention.kind, "attention");
  assert.equal(attention.staleDeliveryCount, 2);
  assert.equal(eventLines.length, 1, "One operator check must emit at most one stale signal.");

  const denied = await readAssignmentNotificationHealthWithClient(
    clientFor(null, { code: "42501" }),
  );
  assert.equal(denied.kind, "unavailable");
  const malformed = await readAssignmentNotificationHealthWithClient(
    clientFor([{ delivery_id: randomUUID(), delivery_state: "sending", sending_expires_at: now().toISOString(), recipient: "forbidden" }]),
  );
  assert.equal(malformed.kind, "error");
  const oversized = await readAssignmentNotificationHealthWithClient(
    clientFor(Array.from({ length: 101 }, () => ({
      delivery_id: randomUUID(),
      delivery_state: "sending",
      sending_expires_at: now().toISOString(),
    }))),
  );
  assert.equal(oversized.kind, "error");
}

async function verifyPreflight() {
  assert(supabaseUrl && anonKey, "Local public Supabase environment values are missing.");
  assert(isLoopbackUrl(supabaseUrl), "Notification-health regression accepts only local Supabase.");
  secrets.add(anonKey);
  const response = await fetch(new URL("/auth/v1/health", supabaseUrl), {
    headers: { apikey: anonKey },
    redirect: "error",
  });
  assert(response.ok, "Local Supabase Auth is unavailable.");
}

async function createAuthenticatedUser(label) {
  const email = `${namespace}-${label}-${randomUUID()}@example.invalid`;
  const password = `${randomBytes(24).toString("base64url")}aA1!`;
  secrets.add(email);
  secrets.add(password);
  const client = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const signup = await client.auth.signUp({ email, password });
  assert(!signup.error && signup.data.user, `Auth fixture creation failed for ${label}.`);
  let session = signup.data.session;
  if (!session) {
    const signin = await client.auth.signInWithPassword({ email, password });
    assert(!signin.error && signin.data.session, `Auth fixture sign-in failed for ${label}.`);
    session = signin.data.session;
  }
  secrets.add(session.access_token);
  secrets.add(session.refresh_token);
  authUserIds.push(signup.data.user.id);
  return { client, userId: signup.data.user.id };
}

function grantRow(key, contactKey, workspaceKey, capabilities, overrides = {}) {
  return `(${sqlUuid(fixture.grants[key])}, ${sqlUuid(fixture.workspaces[workspaceKey])}, ${sqlUuid(fixture.contacts[contactKey])}, 'main_contact', ${sqlArray(capabilities)}, ${sqlText(overrides.status ?? "active")}, ${overrides.validFrom ?? "clock_timestamp() - interval '1 day'"}, ${overrides.validUntil ?? "null"}, ${overrides.revokedAt ?? "null"})`;
}

function addDelivery(workspaceKey, state, expires, index) {
  const assignmentId = randomUUID();
  const volunteerId = randomUUID();
  const deliveryId = randomUUID();
  fixture.assignments.push({ id: assignmentId, volunteerId, workspaceKey });
  fixture.deliveries.push({ id: deliveryId, assignmentId, volunteerId, workspaceKey, state, expires, index });
  return deliveryId;
}

function seedDeliveryDefinitions() {
  fixture.targetStaleId = addDelivery("target", "sending", "clock_timestamp() - interval '2 hours'", 0);
  fixture.targetFreshId = addDelivery("target", "sending", "clock_timestamp() + interval '2 hours'", 1);
  addDelivery("target", "sent", null, 2);
  addDelivery("target", "failed", null, 3);
  fixture.otherStaleId = addDelivery("other", "sending", "clock_timestamp() - interval '3 hours'", 4);
  for (let index = 0; index < 101; index += 1) {
    addDelivery("limit", "sending", `clock_timestamp() - interval '${200 - index} minutes'`, index);
  }
  addDelivery("limit", "sending", "clock_timestamp() + interval '3 hours'", 101);
}

function insertFixtures(containerName, users) {
  seedDeliveryDefinitions();
  const workspaceRows = Object.entries(fixture.workspaces).map(
    ([key, id]) => `(${sqlUuid(id)}, ${sqlText(`${namespace}-${key}`)}, ${sqlText(`QA 12.33 ${key}`)}, ${sqlText(key === "inactive" ? "archived" : "active")}, 'America/Denver', current_date, current_date + 30, false)`,
  );
  const contactRows = Object.entries(fixture.contacts).map(
    ([key, id]) => `(${sqlUuid(id)}, ${sqlUuid(users[key].userId)}, ${sqlText(key === "inactiveContact" ? "inactive" : "active")})`,
  );
  const grants = [
    grantRow("authorized", "authorized", "target", fullCapabilities),
    grantRow("other", "other", "other", fullCapabilities),
    grantRow("clean", "clean", "clean", fullCapabilities),
    grantRow("limit", "limit", "limit", fullCapabilities),
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
  const ownerFor = { target: "authorized", other: "other", clean: "clean", limit: "limit" };
  const volunteerRows = fixture.assignments.map(({ volunteerId, workspaceKey }, index) => {
    const contactKey = ownerFor[workspaceKey];
    return `(${sqlUuid(volunteerId)}, ${sqlUuid(fixture.workspaces[workspaceKey])}, null, 'manual', ${sqlUuid(fixture.contacts[contactKey])}, clock_timestamp(), 'active', 'ready', ${sqlText(`${namespace} ${workspaceKey} ${index}`)}, ${sqlText(`${namespace}-${workspaceKey}-${index}@example.invalid`)}, null, null, null, '{}'::jsonb, '{}'::jsonb, '')`;
  });
  const itemRows = Object.keys(ownerFor).map((workspaceKey) => {
    const contactKey = ownerFor[workspaceKey];
    return `(${sqlUuid(fixture.items[workspaceKey])}, ${sqlUuid(fixture.workspaces[workspaceKey])}, null, ${sqlText(`${namespace} ${workspaceKey}`)}, 'general', 'timed', current_date + 7, null, '09:00'::time, '10:00'::time, 'America/Denver', 1, null, '{}'::jsonb, 'active', ${sqlUuid(fixture.contacts[contactKey])}, ${sqlUuid(fixture.contacts[contactKey])}, 'published', clock_timestamp(), ${sqlUuid(fixture.contacts[contactKey])})`;
  });
  const assignmentRows = fixture.assignments.map(({ id, volunteerId, workspaceKey }) => {
    const contactKey = ownerFor[workspaceKey];
    return `(${sqlUuid(id)}, ${sqlUuid(fixture.workspaces[workspaceKey])}, ${sqlUuid(fixture.items[workspaceKey])}, ${sqlUuid(volunteerId)}, 'active', null, ${sqlUuid(users[contactKey].userId)})`;
  });
  const deliveryRows = fixture.deliveries.map(({ id, assignmentId, volunteerId, workspaceKey, state, expires }) => {
    const common = `${sqlUuid(id)}, ${sqlUuid(fixture.workspaces[workspaceKey])}, ${sqlUuid(fixture.items[workspaceKey])}, ${sqlUuid(assignmentId)}, ${sqlUuid(volunteerId)}, 'initial_assignment', 'initial-assignment.v1', ${sqlText(state)}, 1`;
    if (state === "sending") {
      return `(${common}, null, null, null, ${sqlText(`health:${assignmentId}`)}, null, clock_timestamp() - interval '5 minutes', ${expires}, null, null)`;
    }
    if (state === "sent") {
      return `(${common}, ${sqlText(`${namespace}-sent@example.invalid`)}, 'qa-provider-id', null, ${sqlText(`health:${assignmentId}`)}, null, null, null, clock_timestamp(), null)`;
    }
    return `(${common}, null, null, 'provider_send_failed', ${sqlText(`health:${assignmentId}`)}, null, null, null, null, clock_timestamp())`;
  });

  runPsql(containerName, `begin;
insert into public.workspaces (id, workspace_key, display_name, lifecycle, timezone, starts_on, ends_on, public_intake_enabled) values ${workspaceRows.join(",\n")};
insert into public.project_contacts (id, auth_user_id, status) values ${contactRows.join(",\n")};
insert into public.workspace_contact_grants (id, workspace_id, project_contact_id, role, capabilities, status, valid_from, valid_until, revoked_at) values ${grants.join(",\n")};
insert into public.volunteer_profiles (id, workspace_id, source_submission_id, profile_source, manual_created_by_project_contact_id, manual_created_at, lifecycle, readiness_status, full_name, email, phone, congregation, preferred_contact_method, availability_snapshot, skills_help_snapshot, profile_notes) values ${volunteerRows.join(",\n")};
insert into public.calendar_items (id, workspace_id, task_preset_id, title_snapshot, task_type_snapshot, schedule_kind, start_date, end_date, start_time, end_time, timezone, needed_count, schedule_notes, custom_values, lifecycle, follow_up_project_contact_id, created_by_project_contact_id, publication_state, published_at, published_by_project_contact_id) values ${itemRows.join(",\n")};
insert into public.calendar_assignments (id, workspace_id, calendar_item_id, volunteer_profile_id, lifecycle, assignment_note, created_by_auth_user_id) values ${assignmentRows.join(",\n")};
insert into public.assignment_notification_deliveries (id, workspace_id, calendar_item_id, calendar_assignment_id, volunteer_profile_id, notification_kind, template_version, delivery_state, attempt_count, recipient_email_snapshot, provider_message_id, safe_failure_code, idempotency_key, initiated_by_project_contact_id, sending_started_at, sending_expires_at, sent_at, failed_at) values ${deliveryRows.join(",\n")};
commit;`);
}

async function expectRpcDenied(client, label) {
  const result = await client.rpc("read_assignment_notification_delivery_health");
  assert(result.error, `${label} should fail closed.`);
}

async function verifyDatabaseBehavior(containerName, users) {
  const signature = queryJson(
    containerName,
    `select p.prosecdef as security_definer, p.provolatile, p.proconfig, has_function_privilege('anon', p.oid, 'execute') as anon_execute, has_function_privilege('authenticated', p.oid, 'execute') as authenticated_execute
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'read_assignment_notification_delivery_health' and p.pronargs = 0`,
  );
  assert.equal(signature.length, 1);
  assert.equal(signature[0].security_definer, true);
  assert.equal(signature[0].provolatile, "s");
  assert.deepEqual(signature[0].proconfig, ["search_path=\"\""]);
  assert.equal(signature[0].anon_execute, false);
  assert.equal(signature[0].authenticated_execute, true);

  const anonClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await expectRpcDenied(anonClient, "Anonymous caller");

  const before = queryJson(
    containerName,
    `select id::text, delivery_state, sending_started_at, sending_expires_at, sent_at, failed_at, attempt_count, updated_at from public.assignment_notification_deliveries where workspace_id = any(array[${Object.values(fixture.workspaces).map(sqlUuid).join(", ")}]) order by id`,
  );
  const target = await users.authorized.client.rpc(
    "read_assignment_notification_delivery_health",
  );
  assert(!target.error, `Authorized RPC failed: ${target.error?.message ?? "unknown"}`);
  assert.equal(target.data.length, 2);
  assert.deepEqual(Object.keys(target.data[0]).sort(), ["delivery_id", "delivery_state", "sending_expires_at"]);
  assert.equal(target.data[0].delivery_id, fixture.targetStaleId);
  assert.equal(target.data[1].delivery_id, fixture.targetFreshId);
  assert(target.data.every((row) => row.delivery_state === "sending"));
  assert(!JSON.stringify(target.data).includes(namespace));

  const healthEvents = [];
  const health = await readAssignmentNotificationHealthWithClient(users.authorized.client, {
    observability: { write: (line) => healthEvents.push(line) },
  });
  assert.equal(health.kind, "attention");
  assert.equal(health.staleDeliveryCount, 1);
  assert.equal(health.checkedSendingDeliveryCount, 2);
  assert.equal(healthEvents.length, 1);

  const empty = await readAssignmentNotificationHealthWithClient(users.clean.client);
  assert.equal(empty.kind, "healthy");
  assert.equal(empty.checkedSendingDeliveryCount, 0);

  const other = await users.other.client.rpc("read_assignment_notification_delivery_health");
  assert(!other.error);
  assert.deepEqual(other.data.map((row) => row.delivery_id), [fixture.otherStaleId]);

  const bounded = await users.limit.client.rpc("read_assignment_notification_delivery_health");
  assert(!bounded.error);
  assert.equal(bounded.data.length, 100);
  for (let index = 1; index < bounded.data.length; index += 1) {
    assert(
      Date.parse(bounded.data[index - 1].sending_expires_at) <=
        Date.parse(bounded.data[index].sending_expires_at),
      "Bounded health rows must be oldest-expiry first.",
    );
  }
  assert(bounded.data.every((row) => Date.parse(row.sending_expires_at) < Date.now()));

  for (const key of [
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
    await expectRpcDenied(users[key].client, key);
  }

  const directRead = await users.authorized.client
    .from("assignment_notification_deliveries")
    .select("id")
    .limit(1);
  assert(directRead.error, "Direct authenticated ledger SELECT must remain denied.");
  const after = queryJson(
    containerName,
    `select id::text, delivery_state, sending_started_at, sending_expires_at, sent_at, failed_at, attempt_count, updated_at from public.assignment_notification_deliveries where workspace_id = any(array[${Object.values(fixture.workspaces).map(sqlUuid).join(", ")}]) order by id`,
  );
  assert.deepEqual(after, before, "Notification-health reads must not mutate the delivery ledger.");
}

function cleanup(containerName) {
  const workspaceIds = Object.values(fixture.workspaces).map(sqlUuid).join(", ");
  const userIds = authUserIds.map(sqlUuid).join(", ");
  runPsql(containerName, `begin;
delete from public.assignment_notification_deliveries where workspace_id in (${workspaceIds});
delete from public.calendar_assignments where workspace_id in (${workspaceIds});
delete from public.calendar_items where workspace_id in (${workspaceIds});
delete from public.volunteer_profiles where workspace_id in (${workspaceIds});
delete from public.workspace_contact_grants where workspace_id in (${workspaceIds});
delete from public.project_contacts where auth_user_id in (${userIds || "null::uuid"});
delete from public.workspaces where id in (${workspaceIds});
delete from auth.users where id in (${userIds || "null::uuid"});
commit;`);
}

function verifyZeroResidue(containerName) {
  const residue = queryJson(
    containerName,
    `select ((select count(*) from public.workspaces where workspace_key like ${sqlText(`${namespace}%`)}) + (select count(*) from auth.users where email like ${sqlText(`${namespace}%`)}))::integer as residue_count`,
  );
  assert.equal(residue[0]?.residue_count, 0, "Notification-health disposable residue remains.");
}

async function main() {
  let containerName;
  try {
    await verifyStaticContract();
    await verifyHelperContract();
    await verifyPreflight();
    containerName = await resolveLocalDatabaseContainer();
    const migration = await readFile(
      path.join(
        root,
        "supabase/migrations/20260811123300_stale_assignment_notification_delivery_health.sql",
      ),
      "utf8",
    );
    const present = queryJson(
      containerName,
      `select 1 as present from pg_proc where proname = 'read_assignment_notification_delivery_health' and pronargs = 0`,
    );
    if (present.length === 0) runPsql(containerName, migration);
    await verifyGeneratedTypes();

    const users = {};
    for (const key of [...Object.keys(fixture.contacts), "missingContact"]) {
      users[key] = await createAuthenticatedUser(key);
    }
    insertFixtures(containerName, users);
    await verifyDatabaseBehavior(containerName, users);
  } catch (error) {
    console.error(redact(error));
    process.exitCode = 1;
  } finally {
    if (containerName) {
      try {
        cleanup(containerName);
        verifyZeroResidue(containerName);
      } catch (error) {
        console.error(redact(error));
        process.exitCode = 1;
      }
    }
  }
  if (!process.exitCode) {
    console.log(
      "Validated the bounded authenticated notification-health RPC, strict authorization and workspace isolation, detector integration, one-event signal, no direct ledger access, no mutation, unlinked safe route, and zero disposable local residue.",
    );
  }
}

await main();
