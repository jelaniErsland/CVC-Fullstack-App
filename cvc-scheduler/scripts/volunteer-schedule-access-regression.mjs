import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const root = process.cwd();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const secrets = new Set();
const authUserIds = [];
let cleanupCompleted = false;

const fixture = {
  namespace: `qa-12-20-${randomUUID()}`,
  workspaceId: randomUUID(),
  otherWorkspaceId: randomUUID(),
  inactiveWorkspaceId: randomUUID(),
  contacts: {
    issuer: randomUUID(),
    noEdit: randomUUID(),
    roleOnly: randomUUID(),
    revoked: randomUUID(),
    expired: randomUUID(),
    inactiveGrant: randomUUID(),
    inactiveContact: randomUUID(),
    other: randomUUID(),
  },
  grants: {
    issuer: randomUUID(),
    noEdit: randomUUID(),
    roleOnly: randomUUID(),
    revoked: randomUUID(),
    expired: randomUUID(),
    inactiveGrant: randomUUID(),
    inactiveContact: randomUUID(),
    other: randomUUID(),
  },
  volunteers: {
    own: randomUUID(),
    otherSameWorkspace: randomUUID(),
    wrongWorkspace: randomUUID(),
    onHold: randomUUID(),
    empty: randomUUID(),
  },
  taskPresetId: randomUUID(),
  items: {
    publishedOneOff: randomUUID(),
    publishedPreset: randomUUID(),
    publishedDeclined: randomUUID(),
    draft: randomUUID(),
    archived: randomUUID(),
    canceled: randomUUID(),
    informational: randomUUID(),
  },
  assignments: {
    needs: randomUUID(),
    confirmed: randomUUID(),
    declined: randomUUID(),
    canceled: randomUUID(),
    otherVolunteer: randomUUID(),
    draft: randomUUID(),
    archivedItem: randomUUID(),
  },
  responses: {
    needs: randomUUID(),
    confirmed: randomUUID(),
    declined: randomUUID(),
    canceled: randomUUID(),
    otherVolunteer: randomUUID(),
    draft: randomUUID(),
    archivedItem: randomUUID(),
  },
};

function isLoopbackUrl(value) {
  try {
    return ["127.0.0.1", "localhost", "[::1]", "::1"].includes(new URL(value).hostname);
  } catch {
    return false;
  }
}

function redact(value) {
  let message = value instanceof Error ? value.message : String(value);
  for (const secret of secrets) {
    if (typeof secret === "string" && secret.length > 0) {
      message = message.replaceAll(secret, "[redacted]");
      message = message.replaceAll(encodeURIComponent(secret), "[redacted]");
    }
  }
  return message.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted-jwt]");
}

function sqlText(value) {
  if (value === null || value === undefined) return "null";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlUuid(value) {
  return `${sqlText(value)}::uuid`;
}

function sqlArray(values) {
  return `array[${values.map(sqlText).join(", ")}]::text[]`;
}

function command(commandName, args, options = {}) {
  return spawnSync(commandName, args, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    ...options,
  });
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
    throw new Error(`Volunteer schedule fixture SQL failed: ${redact(result.stderr).slice(0, 900)}`);
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
    "Local Supabase is unavailable. Start local Supabase with output redirected/redacted before this validation.",
  );
  return containerName;
}

async function applyMigrationIfNeeded(containerName, migrationName, probeSql) {
  const exists = queryJson(containerName, probeSql);
  if (exists.length > 0) return;
  const migration = await readFile(
    path.join(root, "supabase", "migrations", migrationName),
    "utf8",
  );
  runPsql(containerName, migration);
}

async function applyRequiredMigrations(containerName) {
  await applyMigrationIfNeeded(
    containerName,
    "20260714121500_manual_volunteer_profiles.sql",
    "select 1 as present from information_schema.columns where table_schema = 'public' and table_name = 'volunteer_profiles' and column_name = 'profile_source'",
  );
  await applyMigrationIfNeeded(
    containerName,
    "20260714121600_calendar_item_management.sql",
    "select 1 as present from information_schema.columns where table_schema = 'public' and table_name = 'calendar_items' and column_name = 'follow_up_project_contact_id'",
  );
  await applyMigrationIfNeeded(
    containerName,
    "20260714121700_calendar_source_selection.sql",
    "select 1 as present from pg_proc where proname = 'update_calendar_item_preset_timed'",
  );
  await applyMigrationIfNeeded(
    containerName,
    "20260714121800_calendar_assignment_management.sql",
    "select 1 as present from pg_proc where proname = 'create_calendar_assignments_batch'",
  );
  await applyMigrationIfNeeded(
    containerName,
    "20260714121900_calendar_publication_visibility.sql",
    "select 1 as present from information_schema.columns where table_schema = 'public' and table_name = 'calendar_items' and column_name = 'publication_state'",
  );
  await applyMigrationIfNeeded(
    containerName,
    "20260714122000_volunteer_schedule_access.sql",
    "select 1 as present from information_schema.tables where table_schema = 'public' and table_name = 'volunteer_schedule_access_tokens'",
  );
}

async function createAuthenticatedUser(label) {
  const email = `${fixture.namespace}-${label}-${randomUUID()}@example.invalid`;
  const password = `${randomBytes(24).toString("base64url")}aA1!`;
  secrets.add(email);
  secrets.add(password);
  const client = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const signup = await client.auth.signUp({ email, password });
  assert(!signup.error && signup.data.user, `Disposable Auth user creation failed for ${label}.`);
  let session = signup.data.session;
  if (!session) {
    const signin = await client.auth.signInWithPassword({ email, password });
    assert(!signin.error && signin.data.session, `Disposable Auth sign-in failed for ${label}.`);
    session = signin.data.session;
  }
  secrets.add(session.access_token);
  secrets.add(session.refresh_token);
  authUserIds.push(signup.data.user.id);
  return { client, userId: signup.data.user.id };
}

function grantRow(label, workspaceId, role, capabilities, status = "active", extra = "") {
  const revoked = extra === "revoked" ? "clock_timestamp()" : "null";
  const validUntil = extra === "expired" ? "clock_timestamp() - interval '1 hour'" : "null";
  return `(${sqlUuid(fixture.grants[label])}, ${sqlUuid(workspaceId)}, ${sqlUuid(fixture.contacts[label])}, ${sqlText(role)}, ${sqlArray(capabilities)}, ${sqlText(status)}, clock_timestamp() - interval '1 day', ${validUntil}, ${revoked})`;
}

function volunteerRow(id, workspaceId, fullName, contactId, readiness = "ready") {
  return `(${sqlUuid(id)}, ${sqlUuid(workspaceId)}, null, 'manual', ${sqlUuid(contactId)}, clock_timestamp(), 'active', ${sqlText(readiness)}, ${sqlText(fullName)}, ${sqlText(`${fullName.replaceAll(" ", ".").toLowerCase()}@example.invalid`)}, null, 'Bozeman QA', null, '{}'::jsonb, '{}'::jsonb, '')`;
}

function itemRow(id, workspaceId, taskPresetId, title, kind, date, needed, lifecycle, publication, creatorContactId, notes = null) {
  const publishedAt = publication === "published" ? "clock_timestamp()" : "null";
  const publisher = publication === "published" ? sqlUuid(creatorContactId) : "null";
  return `(${sqlUuid(id)}, ${sqlUuid(workspaceId)}, ${taskPresetId ? sqlUuid(taskPresetId) : "null"}, ${sqlText(title)}, ${sqlText(kind)}, 'timed', ${sqlText(date)}::date, null, '09:00'::time, '11:00'::time, 'America/Denver', ${needed}, ${sqlText(notes)}, '{}'::jsonb, ${sqlText(lifecycle)}, ${sqlUuid(creatorContactId)}, ${sqlUuid(creatorContactId)}, ${sqlText(publication)}, ${publishedAt}, ${publisher})`;
}

function assignmentRow(id, itemId, volunteerId, lifecycle = "active") {
  return `(${sqlUuid(id)}, ${sqlUuid(fixture.workspaceId)}, ${sqlUuid(itemId)}, ${sqlUuid(volunteerId)}, ${sqlText(lifecycle)}, null, null)`;
}

function responseRow(id, assignmentId, status) {
  const respondedAt = status === "needs_response" ? "null" : "clock_timestamp()";
  return `(${sqlUuid(id)}, ${sqlUuid(fixture.workspaceId)}, ${sqlUuid(assignmentId)}, ${sqlText(status)}, 'project_contact', null, ${respondedAt}, null)`;
}

function insertFixtures(containerName, users) {
  runPsql(
    containerName,
    `insert into public.workspaces (id, workspace_key, display_name, lifecycle, timezone, starts_on, ends_on, public_intake_enabled)
values
  (${sqlUuid(fixture.workspaceId)}, ${sqlText(`${fixture.namespace}-workspace`)}, 'QA 12.20 Schedule Workspace', 'active', 'America/Denver', '2026-08-01', '2026-12-31', false),
  (${sqlUuid(fixture.otherWorkspaceId)}, ${sqlText(`${fixture.namespace}-other`)}, 'QA 12.20 Other Workspace', 'active', 'America/Denver', '2026-08-01', '2026-12-31', false),
  (${sqlUuid(fixture.inactiveWorkspaceId)}, ${sqlText(`${fixture.namespace}-inactive`)}, 'QA 12.20 Inactive Workspace', 'archived', 'America/Denver', '2026-08-01', '2026-12-31', false);

insert into public.project_contacts (id, auth_user_id, status)
values
  (${sqlUuid(fixture.contacts.issuer)}, ${sqlUuid(users.issuer.userId)}, 'active'),
  (${sqlUuid(fixture.contacts.noEdit)}, ${sqlUuid(users.noEdit.userId)}, 'active'),
  (${sqlUuid(fixture.contacts.roleOnly)}, ${sqlUuid(users.roleOnly.userId)}, 'active'),
  (${sqlUuid(fixture.contacts.revoked)}, ${sqlUuid(users.revoked.userId)}, 'active'),
  (${sqlUuid(fixture.contacts.expired)}, ${sqlUuid(users.expired.userId)}, 'active'),
  (${sqlUuid(fixture.contacts.inactiveGrant)}, ${sqlUuid(users.inactiveGrant.userId)}, 'active'),
  (${sqlUuid(fixture.contacts.inactiveContact)}, ${sqlUuid(users.inactiveContact.userId)}, 'inactive'),
  (${sqlUuid(fixture.contacts.other)}, ${sqlUuid(users.other.userId)}, 'active');

insert into public.workspace_contact_grants (id, workspace_id, project_contact_id, role, capabilities, status, valid_from, valid_until, revoked_at)
values
  ${grantRow("issuer", fixture.workspaceId, "main_contact", ["workspace.read", "assignments.edit"])},
  ${grantRow("noEdit", fixture.workspaceId, "assistant_contact", ["workspace.read", "assignments.view", "volunteers.view"])},
  ${grantRow("roleOnly", fixture.workspaceId, "main_contact", ["workspace.read"])},
  ${grantRow("revoked", fixture.workspaceId, "assistant_contact", ["workspace.read", "assignments.edit"], "revoked", "revoked")},
  ${grantRow("expired", fixture.workspaceId, "assistant_contact", ["workspace.read", "assignments.edit"], "active", "expired")},
  ${grantRow("inactiveGrant", fixture.workspaceId, "assistant_contact", ["workspace.read", "assignments.edit"], "inactive")},
  ${grantRow("inactiveContact", fixture.workspaceId, "assistant_contact", ["workspace.read", "assignments.edit"])},
  ${grantRow("other", fixture.otherWorkspaceId, "main_contact", ["workspace.read", "assignments.edit"])};

insert into public.volunteer_profiles (
  id, workspace_id, source_submission_id, profile_source, manual_created_by_project_contact_id, manual_created_at,
  lifecycle, readiness_status, full_name, email, phone, congregation, preferred_contact_method,
  availability_snapshot, skills_help_snapshot, profile_notes
)
values
  ${volunteerRow(fixture.volunteers.own, fixture.workspaceId, `${fixture.namespace} Own Volunteer`, fixture.contacts.issuer)},
  ${volunteerRow(fixture.volunteers.otherSameWorkspace, fixture.workspaceId, `${fixture.namespace} Other Volunteer`, fixture.contacts.issuer)},
  ${volunteerRow(fixture.volunteers.empty, fixture.workspaceId, `${fixture.namespace} Empty Volunteer`, fixture.contacts.issuer)},
  ${volunteerRow(fixture.volunteers.onHold, fixture.workspaceId, `${fixture.namespace} On Hold Volunteer`, fixture.contacts.issuer, "on_hold")},
  ${volunteerRow(fixture.volunteers.wrongWorkspace, fixture.otherWorkspaceId, `${fixture.namespace} Wrong Workspace Volunteer`, fixture.contacts.other)};

insert into public.task_presets (
  id, workspace_id, name, description, task_type, default_needed_count, volunteer_visible,
  is_system_preset, system_key, custom_field_definitions, lifecycle
)
values (${sqlUuid(fixture.taskPresetId)}, ${sqlUuid(fixture.workspaceId)}, ${sqlText(`${fixture.namespace} Preset`)}, 'Preset fixture', 'general', 2, true, false, null, '[]'::jsonb, 'active');

insert into public.calendar_items (
  id, workspace_id, task_preset_id, title_snapshot, task_type_snapshot, schedule_kind,
  start_date, end_date, start_time, end_time, timezone, needed_count, schedule_notes,
  custom_values, lifecycle, follow_up_project_contact_id, created_by_project_contact_id,
  publication_state, published_at, published_by_project_contact_id
)
values
  ${itemRow(fixture.items.publishedOneOff, fixture.workspaceId, null, `${fixture.namespace} Published One-Off`, "general", "2026-08-10", 2, "active", "published", fixture.contacts.issuer, "Bring gloves.")},
  ${itemRow(fixture.items.publishedPreset, fixture.workspaceId, fixture.taskPresetId, `${fixture.namespace} Published Preset`, "general", "2026-08-11", 1, "active", "published", fixture.contacts.issuer)},
  ${itemRow(fixture.items.publishedDeclined, fixture.workspaceId, null, `${fixture.namespace} Published Declined`, "general", "2026-08-12", 1, "active", "published", fixture.contacts.issuer)},
  ${itemRow(fixture.items.draft, fixture.workspaceId, null, `${fixture.namespace} Draft Hidden`, "general", "2026-08-12", 1, "active", "draft", fixture.contacts.issuer)},
  ${itemRow(fixture.items.archived, fixture.workspaceId, null, `${fixture.namespace} Archived Hidden`, "general", "2026-08-13", 1, "archived", "published", fixture.contacts.issuer)},
  ${itemRow(fixture.items.canceled, fixture.workspaceId, null, `${fixture.namespace} Canceled Hidden`, "general", "2026-08-14", 1, "canceled", "published", fixture.contacts.issuer)},
  ${itemRow(fixture.items.informational, fixture.workspaceId, null, `${fixture.namespace} Informational Unassigned`, "general", "2026-08-15", 0, "active", "published", fixture.contacts.issuer)};

insert into public.calendar_assignments (
  id, workspace_id, calendar_item_id, volunteer_profile_id, lifecycle, assignment_note, created_by_auth_user_id
)
values
  ${assignmentRow(fixture.assignments.needs, fixture.items.publishedOneOff, fixture.volunteers.own)},
  ${assignmentRow(fixture.assignments.confirmed, fixture.items.publishedPreset, fixture.volunteers.own)},
  ${assignmentRow(fixture.assignments.declined, fixture.items.publishedDeclined, fixture.volunteers.own)},
  ${assignmentRow(fixture.assignments.canceled, fixture.items.publishedPreset, fixture.volunteers.own, "canceled")},
  ${assignmentRow(fixture.assignments.otherVolunteer, fixture.items.publishedOneOff, fixture.volunteers.otherSameWorkspace)},
  ${assignmentRow(fixture.assignments.draft, fixture.items.draft, fixture.volunteers.own)},
  ${assignmentRow(fixture.assignments.archivedItem, fixture.items.archived, fixture.volunteers.own)};

insert into public.assignment_responses (
  id, workspace_id, assignment_id, response_status, response_source, response_note, responded_at, updated_by_auth_user_id
)
values
  ${responseRow(fixture.responses.needs, fixture.assignments.needs, "needs_response")},
  ${responseRow(fixture.responses.confirmed, fixture.assignments.confirmed, "confirmed")},
  ${responseRow(fixture.responses.declined, fixture.assignments.declined, "declined")},
  ${responseRow(fixture.responses.canceled, fixture.assignments.canceled, "confirmed")},
  ${responseRow(fixture.responses.otherVolunteer, fixture.assignments.otherVolunteer, "confirmed")},
  ${responseRow(fixture.responses.draft, fixture.assignments.draft, "needs_response")},
  ${responseRow(fixture.responses.archivedItem, fixture.assignments.archivedItem, "needs_response")};`,
  );
}

async function expectRpcFailure(label, fn) {
  try {
    await fn();
  } catch {
    return;
  }
  assert.fail(`${label} unexpectedly succeeded.`);
}

async function issueScheduleToken(client, input) {
  const allowedKeys = ["volunteerProfileId", "expiresInHours"];
  const extraKeys = Object.keys(input).filter((key) => !allowedKeys.includes(key));
  if (extraKeys.length > 0) throw new Error("unsupported fields");
  const { data, error } = await client.rpc("issue_volunteer_schedule_access", {
    p_volunteer_profile_id: input.volunteerProfileId,
    p_ttl_hours: input.expiresInHours ?? 720,
  });
  if (error) throw new Error("issue failed", { cause: error });
  assert(Array.isArray(data) && data.length === 1, "issue RPC returned invalid shape");
  const row = data[0];
  assert.match(row.bearer_token, /^[A-Za-z0-9_-]{43}$/);
  return {
    tokenId: row.token_id,
    token: row.bearer_token,
    expiresAt: row.token_expires_at,
  };
}

async function readSchedule(client, token) {
  const { data, error } = await client.rpc("read_volunteer_schedule", {
    p_bearer_token: token,
  });
  if (error) throw new Error("read failed", { cause: error });
  assert(Array.isArray(data) && data.length >= 1, "read RPC returned invalid shape");
  const first = data[0];
  if (first.schedule_state === "unavailable") return { kind: "unavailable" };
  if (first.schedule_state === "ready_empty") {
    return {
      kind: "ready_empty",
      workspaceDisplayName: first.workspace_display_name,
      volunteerDisplayName: first.volunteer_display_name,
      assignments: [],
    };
  }
  assert.equal(first.schedule_state, "ready");
  return {
    kind: "ready",
    workspaceDisplayName: first.workspace_display_name,
    volunteerDisplayName: first.volunteer_display_name,
    assignments: data.map((row) => ({
      taskTitle: row.task_title,
      currentResponseStatus: row.current_response_status,
      activeAssignedCount: row.active_assigned_count,
      neededCount: row.needed_count,
    })),
    raw: data,
  };
}

async function revokeScheduleToken(client, tokenId) {
  const { data, error } = await client.rpc("revoke_volunteer_schedule_access", {
    p_token_id: tokenId,
  });
  if (error || typeof data !== "string") throw new Error("revoke failed", { cause: error });
  return data;
}

async function run() {
  assert(supabaseUrl && anonKey, "Local public Supabase environment values are missing.");
  assert(isLoopbackUrl(supabaseUrl), "Volunteer schedule validation accepts only local Supabase.");
  secrets.add(anonKey);
  const health = await fetch(new URL("/auth/v1/health", supabaseUrl), {
    headers: { apikey: anonKey },
    redirect: "error",
  });
  assert(health.ok, "Local Supabase Auth is unavailable.");

  const containerName = await resolveLocalDatabaseContainer();
  await applyRequiredMigrations(containerName);

  const users = {
    issuer: await createAuthenticatedUser("issuer"),
    noEdit: await createAuthenticatedUser("no-edit"),
    roleOnly: await createAuthenticatedUser("role-only"),
    revoked: await createAuthenticatedUser("revoked"),
    expired: await createAuthenticatedUser("expired"),
    inactiveGrant: await createAuthenticatedUser("inactive-grant"),
    inactiveContact: await createAuthenticatedUser("inactive-contact"),
    other: await createAuthenticatedUser("other"),
  };
  insertFixtures(containerName, users);

  const anonClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const issued = await issueScheduleToken(users.issuer.client, {
    volunteerProfileId: fixture.volunteers.own,
  });
  secrets.add(issued.token);
  assert.match(issued.token, /^[A-Za-z0-9_-]{43}$/);

  const tokenRows = queryJson(
    containerName,
    `select id, octet_length(token_verifier_hash) as hash_length, purpose, token_version,
      round(extract(epoch from (expires_at - created_at)) / 3600)::integer as ttl_hours,
      issued_by_project_contact_id::text as issuer,
      position(${sqlText(issued.token)} in encode(token_verifier_hash, 'hex')) as plaintext_position
     from public.volunteer_schedule_access_tokens
     where id = ${sqlUuid(issued.tokenId)}`,
  );
  assert.equal(tokenRows.length, 1, "issued token row was not persisted");
  assert.equal(tokenRows[0].hash_length, 32);
  assert.equal(tokenRows[0].purpose, "volunteer_schedule_access");
  assert.equal(tokenRows[0].token_version, 1);
  assert.equal(tokenRows[0].ttl_hours, 720);
  assert.equal(tokenRows[0].issuer, fixture.contacts.issuer);
  assert.equal(tokenRows[0].plaintext_position, 0);

  const schedule = await readSchedule(anonClient, issued.token);
  assert.equal(schedule.kind, "ready");
  assert.equal(schedule.workspaceDisplayName, "QA 12.20 Schedule Workspace");
  assert.equal(schedule.volunteerDisplayName, `${fixture.namespace} Own Volunteer`);
  const allAssignments = schedule.assignments;
  assert.equal(allAssignments.length, 3, "only own active published assignments should render");
  assert(allAssignments.some((assignment) => assignment.currentResponseStatus === "needs_response"));
  assert(allAssignments.some((assignment) => assignment.currentResponseStatus === "confirmed"));
  assert(allAssignments.some((assignment) => assignment.currentResponseStatus === "declined"));
  assert(allAssignments.some((assignment) => assignment.taskTitle.includes("Published Preset")));
  assert(!allAssignments.some((assignment) => assignment.taskTitle.includes("Draft")));
  assert(!allAssignments.some((assignment) => assignment.taskTitle.includes("Archived")));
  assert(!allAssignments.some((assignment) => assignment.taskTitle.includes("Other Volunteer")));
  assert(!JSON.stringify(schedule).includes("example.invalid"), "volunteer contact values leaked");
  assert(!JSON.stringify(schedule).includes("token_verifier_hash"), "token hash leaked");

  const emptyIssued = await issueScheduleToken(users.issuer.client, {
    volunteerProfileId: fixture.volunteers.empty,
    expiresInHours: 1,
  });
  secrets.add(emptyIssued.token);
  const emptySchedule = await readSchedule(anonClient, emptyIssued.token);
  assert.equal(emptySchedule.kind, "ready_empty");

  assert.equal(
    (await readSchedule(anonClient, "malformed")).kind,
    "unavailable",
  );
  assert.equal(
    (await readSchedule(anonClient, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")).kind,
    "unavailable",
  );

  await expectRpcFailure("minimum TTL", () =>
    issueScheduleToken(users.issuer.client, {
      volunteerProfileId: fixture.volunteers.own,
      expiresInHours: 0,
    }),
  );
  await expectRpcFailure("maximum TTL", () =>
    issueScheduleToken(users.issuer.client, {
      volunteerProfileId: fixture.volunteers.own,
      expiresInHours: 2161,
    }),
  );
  await expectRpcFailure("protected fields", () =>
    issueScheduleToken(users.issuer.client, {
      volunteerProfileId: fixture.volunteers.own,
      expiresInHours: 1,
      workspaceId: fixture.otherWorkspaceId,
    }),
  );
  await expectRpcFailure("missing assignments.edit", () =>
    issueScheduleToken(users.noEdit.client, {
      volunteerProfileId: fixture.volunteers.own,
    }),
  );
  await expectRpcFailure("role/title only", () =>
    issueScheduleToken(users.roleOnly.client, {
      volunteerProfileId: fixture.volunteers.own,
    }),
  );
  await expectRpcFailure("revoked grant", () =>
    issueScheduleToken(users.revoked.client, {
      volunteerProfileId: fixture.volunteers.own,
    }),
  );
  await expectRpcFailure("expired grant", () =>
    issueScheduleToken(users.expired.client, {
      volunteerProfileId: fixture.volunteers.own,
    }),
  );
  await expectRpcFailure("inactive grant", () =>
    issueScheduleToken(users.inactiveGrant.client, {
      volunteerProfileId: fixture.volunteers.own,
    }),
  );
  await expectRpcFailure("inactive contact", () =>
    issueScheduleToken(users.inactiveContact.client, {
      volunteerProfileId: fixture.volunteers.own,
    }),
  );
  await expectRpcFailure("wrong workspace volunteer", () =>
    issueScheduleToken(users.issuer.client, {
      volunteerProfileId: fixture.volunteers.wrongWorkspace,
    }),
  );
  await expectRpcFailure("ineligible volunteer", () =>
    issueScheduleToken(users.issuer.client, {
      volunteerProfileId: fixture.volunteers.onHold,
    }),
  );

  const { error: anonReadError } = await anonClient
    .from("volunteer_schedule_access_tokens")
    .select("id")
    .limit(1);
  assert(anonReadError, "anon direct schedule-token read should be denied");
  const { error: authReadError } = await users.issuer.client
    .from("volunteer_schedule_access_tokens")
    .select("id")
    .limit(1);
  assert(authReadError, "authenticated direct schedule-token read should be denied");
  const { error: directInsertError } = await users.issuer.client
    .from("volunteer_schedule_access_tokens")
    .insert({
      workspace_id: fixture.workspaceId,
      volunteer_profile_id: fixture.volunteers.own,
      token_verifier_hash: "00",
      expires_at: new Date().toISOString(),
    });
  assert(directInsertError, "authenticated direct schedule-token insert should be denied");

  await revokeScheduleToken(users.issuer.client, issued.tokenId);
  await revokeScheduleToken(users.issuer.client, issued.tokenId);
  assert.equal(
    (await readSchedule(anonClient, issued.token)).kind,
    "unavailable",
  );
  const preservation = queryJson(
    containerName,
    `select
      (select count(*) from public.volunteer_profiles where id = ${sqlUuid(fixture.volunteers.own)}) as volunteers,
      (select count(*) from public.calendar_assignments where volunteer_profile_id = ${sqlUuid(fixture.volunteers.own)}) as assignments,
      (select count(*) from public.assignment_responses where workspace_id = ${sqlUuid(fixture.workspaceId)}) as responses,
      (select count(*) from public.volunteer_schedule_access_tokens where id = ${sqlUuid(issued.tokenId)} and token_verifier_hash is not null and revoked_at is not null) as revoked_hash_only`,
  )[0];
  assert.equal(preservation.volunteers, 1);
  assert(preservation.assignments >= 1);
  assert(preservation.responses >= 1);
  assert.equal(preservation.revoked_hash_only, 1);

  console.log("Volunteer schedule access local validation passed.");
  console.log("Validated hash-only issuance, safe read, filtering, revocation, direct-table denial, and zero-residue cleanup.");
}

async function cleanup(containerName) {
  const authIdArray =
    authUserIds.length > 0
      ? authUserIds.map((id) => `${sqlText(id)}::uuid`).join(", ")
      : "'00000000-0000-4000-8000-000000000000'::uuid";
  const authDeletes = authUserIds
    .map((id) => `delete from auth.users where id = ${sqlUuid(id)};`)
    .join("\n");
  const residue = runPsql(
    containerName,
    `begin;
delete from public.assignment_response_link_reveal_events where workspace_id in (select id from public.workspaces where workspace_key like ${sqlText(`${fixture.namespace}%`)});
delete from public.assignment_response_tokens where workspace_id in (select id from public.workspaces where workspace_key like ${sqlText(`${fixture.namespace}%`)});
delete from public.volunteer_schedule_access_tokens where workspace_id in (select id from public.workspaces where workspace_key like ${sqlText(`${fixture.namespace}%`)});
delete from public.assignment_responses where workspace_id in (select id from public.workspaces where workspace_key like ${sqlText(`${fixture.namespace}%`)});
delete from public.calendar_assignments where workspace_id in (select id from public.workspaces where workspace_key like ${sqlText(`${fixture.namespace}%`)});
delete from public.calendar_items where workspace_id in (select id from public.workspaces where workspace_key like ${sqlText(`${fixture.namespace}%`)});
delete from public.task_presets where workspace_id in (select id from public.workspaces where workspace_key like ${sqlText(`${fixture.namespace}%`)});
delete from public.volunteer_profiles where workspace_id in (select id from public.workspaces where workspace_key like ${sqlText(`${fixture.namespace}%`)});
delete from public.questionnaire_submissions where workspace_id in (select id from public.workspaces where workspace_key like ${sqlText(`${fixture.namespace}%`)});
delete from public.workspace_contact_grants
where workspace_id in (select id from public.workspaces where workspace_key like ${sqlText(`${fixture.namespace}%`)})
or project_contact_id in (select id from public.project_contacts where auth_user_id = any(array[${authIdArray}]));
delete from public.project_contacts where auth_user_id = any(array[${authIdArray}]);
delete from public.workspaces where workspace_key like ${sqlText(`${fixture.namespace}%`)};
${authDeletes}
commit;
select (
  (select count(*) from public.workspaces where workspace_key like ${sqlText(`${fixture.namespace}%`)}) +
  (select count(*) from public.volunteer_profiles where full_name like ${sqlText(`${fixture.namespace}%`)}) +
  (select count(*) from public.calendar_items where title_snapshot like ${sqlText(`${fixture.namespace}%`)}) +
  (select count(*) from public.volunteer_schedule_access_tokens where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)}, ${sqlUuid(fixture.inactiveWorkspaceId)})) +
  (select count(*) from public.project_contacts where auth_user_id = any(array[${authIdArray}])) +
  (select count(*) from auth.users where email like ${sqlText(`${fixture.namespace}-%@example.invalid`)})
)::text;`,
  );
  assert.equal(residue, "0", `Volunteer schedule cleanup left residue count ${residue}.`);
  cleanupCompleted = true;
}

let containerName;
try {
  containerName = await resolveLocalDatabaseContainer();
  await run();
} catch (error) {
  console.error(redact(error));
  process.exitCode = 1;
} finally {
  if (containerName) {
    try {
      await cleanup(containerName);
    } catch (cleanupError) {
      console.error(redact(cleanupError));
      process.exitCode = 1;
    }
  }
  if (!cleanupCompleted) process.exitCode = 1;
}
