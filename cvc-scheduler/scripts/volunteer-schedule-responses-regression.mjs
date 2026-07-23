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

const fixture = {
  namespace: `qa-12-21-${randomUUID()}`,
  workspaceId: randomUUID(),
  otherWorkspaceId: randomUUID(),
  contactId: randomUUID(),
  otherContactId: randomUUID(),
  grantId: randomUUID(),
  otherGrantId: randomUUID(),
  volunteerId: randomUUID(),
  otherVolunteerId: randomUUID(),
  items: {
    far: randomUUID(),
    confirmAllA: randomUUID(),
    confirmAllB: randomUUID(),
    inside48: randomUUID(),
    past: randomUUID(),
    otherWorkspace: randomUUID(),
  },
  assignments: {
    far: randomUUID(),
    confirmAllA: randomUUID(),
    confirmAllB: randomUUID(),
    inside48: randomUUID(),
    past: randomUUID(),
    otherWorkspace: randomUUID(),
  },
  responses: {
    far: randomUUID(),
    confirmAllA: randomUUID(),
    confirmAllB: randomUUID(),
    inside48: randomUUID(),
    past: randomUUID(),
    otherWorkspace: randomUUID(),
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
    throw new Error(`Volunteer schedule response SQL failed: ${redact(result.stderr).slice(0, 900)}`);
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
  if (queryJson(containerName, probeSql).length > 0) return;
  const migration = await readFile(
    path.join(root, "supabase", "migrations", migrationName),
    "utf8",
  );
  runPsql(containerName, migration);
}

async function applyRequiredMigrations(containerName) {
  const migrations = [
    ["20260714121500_manual_volunteer_profiles.sql", "select 1 from information_schema.columns where table_schema = 'public' and table_name = 'volunteer_profiles' and column_name = 'profile_source'"],
    ["20260714121600_calendar_item_management.sql", "select 1 from information_schema.columns where table_schema = 'public' and table_name = 'calendar_items' and column_name = 'follow_up_project_contact_id'"],
    ["20260714121700_calendar_source_selection.sql", "select 1 from pg_proc where proname = 'update_calendar_item_preset_timed'"],
    ["20260714121800_calendar_assignment_management.sql", "select 1 from pg_proc where proname = 'create_calendar_assignments_batch'"],
    ["20260714121900_calendar_publication_visibility.sql", "select 1 from information_schema.columns where table_schema = 'public' and table_name = 'calendar_items' and column_name = 'publication_state'"],
    ["20260714122000_volunteer_schedule_access.sql", "select 1 from information_schema.tables where table_schema = 'public' and table_name = 'volunteer_schedule_access_tokens'"],
    ["20260714122100_volunteer_schedule_responses.sql", "select 1 from pg_constraint, pg_proc where conname = 'assignment_responses_source_known' and pg_get_constraintdef(pg_constraint.oid) like '%volunteer_schedule%' and proname = 'submit_volunteer_schedule_assignment_response' and prosrc like '%response_source = ''volunteer_schedule''%'"],
  ];
  for (const [migrationName, probeSql] of migrations) {
    await applyMigrationIfNeeded(containerName, migrationName, probeSql);
  }
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

function itemValues(id, workspaceId, contactId, title, dateSql, needed = 1) {
  return `(${sqlUuid(id)}, ${sqlUuid(workspaceId)}, null, ${sqlText(title)}, 'general', 'timed', (${dateSql})::date, null, '09:00'::time, '11:00'::time, 'America/Denver', ${needed}, null, '{}'::jsonb, 'active', ${sqlUuid(contactId)}, ${sqlUuid(contactId)}, 'published', clock_timestamp(), ${sqlUuid(contactId)})`;
}

function assignmentValues(id, workspaceId, itemId, volunteerId) {
  return `(${sqlUuid(id)}, ${sqlUuid(workspaceId)}, ${sqlUuid(itemId)}, ${sqlUuid(volunteerId)}, 'active', null, null)`;
}

function responseValues(id, workspaceId, assignmentId, status = "needs_response") {
  const respondedAt = status === "needs_response" ? "null" : "clock_timestamp()";
  return `(${sqlUuid(id)}, ${sqlUuid(workspaceId)}, ${sqlUuid(assignmentId)}, ${sqlText(status)}, 'project_contact', null, ${respondedAt}, null)`;
}

function insertFixtures(containerName, users) {
  runPsql(
    containerName,
    `insert into public.workspaces (id, workspace_key, display_name, lifecycle, timezone, starts_on, ends_on, public_intake_enabled)
values
  (${sqlUuid(fixture.workspaceId)}, ${sqlText(`${fixture.namespace}-workspace`)}, 'QA 12.21 Response Workspace', 'active', 'America/Denver', current_date - 30, current_date + 120, false),
  (${sqlUuid(fixture.otherWorkspaceId)}, ${sqlText(`${fixture.namespace}-other`)}, 'QA 12.21 Other Workspace', 'active', 'America/Denver', current_date - 30, current_date + 120, false);

insert into public.project_contacts (id, auth_user_id, status)
values
  (${sqlUuid(fixture.contactId)}, ${sqlUuid(users.scheduler.userId)}, 'active'),
  (${sqlUuid(fixture.otherContactId)}, ${sqlUuid(users.other.userId)}, 'active');

insert into public.workspace_contact_grants (id, workspace_id, project_contact_id, role, capabilities, status, valid_from, valid_until, revoked_at)
values
  (${sqlUuid(fixture.grantId)}, ${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.contactId)}, 'main_contact', array['workspace.read','assignments.edit']::text[], 'active', clock_timestamp() - interval '1 day', null, null),
  (${sqlUuid(fixture.otherGrantId)}, ${sqlUuid(fixture.otherWorkspaceId)}, ${sqlUuid(fixture.otherContactId)}, 'main_contact', array['workspace.read','assignments.edit']::text[], 'active', clock_timestamp() - interval '1 day', null, null);

insert into public.volunteer_profiles (
  id, workspace_id, source_submission_id, profile_source, manual_created_by_project_contact_id, manual_created_at,
  lifecycle, readiness_status, full_name, email, phone, congregation, preferred_contact_method,
  availability_snapshot, skills_help_snapshot, profile_notes
)
values
  (${sqlUuid(fixture.volunteerId)}, ${sqlUuid(fixture.workspaceId)}, null, 'manual', ${sqlUuid(fixture.contactId)}, clock_timestamp(), 'active', 'ready', ${sqlText(`${fixture.namespace} Volunteer`)}, ${sqlText(`${fixture.namespace}@example.invalid`)}, null, 'Bozeman QA', null, '{}'::jsonb, '{}'::jsonb, ''),
  (${sqlUuid(fixture.otherVolunteerId)}, ${sqlUuid(fixture.otherWorkspaceId)}, null, 'manual', ${sqlUuid(fixture.otherContactId)}, clock_timestamp(), 'active', 'ready', ${sqlText(`${fixture.namespace} Other Volunteer`)}, ${sqlText(`${fixture.namespace}-other@example.invalid`)}, null, 'Bozeman QA', null, '{}'::jsonb, '{}'::jsonb, '');

insert into public.calendar_items (
  id, workspace_id, task_preset_id, title_snapshot, task_type_snapshot, schedule_kind,
  start_date, end_date, start_time, end_time, timezone, needed_count, schedule_notes,
  custom_values, lifecycle, follow_up_project_contact_id, created_by_project_contact_id,
  publication_state, published_at, published_by_project_contact_id
)
values
  ${itemValues(fixture.items.far, fixture.workspaceId, fixture.contactId, `${fixture.namespace} Far Future`, "current_date + 10", 1)},
  ${itemValues(fixture.items.confirmAllA, fixture.workspaceId, fixture.contactId, `${fixture.namespace} Confirm All A`, "current_date + 11", 1)},
  ${itemValues(fixture.items.confirmAllB, fixture.workspaceId, fixture.contactId, `${fixture.namespace} Confirm All B`, "current_date + 12", 1)},
  ${itemValues(fixture.items.inside48, fixture.workspaceId, fixture.contactId, `${fixture.namespace} Inside 48`, "current_date + 1", 1)},
  ${itemValues(fixture.items.past, fixture.workspaceId, fixture.contactId, `${fixture.namespace} Past`, "current_date - 1", 1)},
  ${itemValues(fixture.items.otherWorkspace, fixture.otherWorkspaceId, fixture.otherContactId, `${fixture.namespace} Other Workspace`, "current_date + 10", 1)};

insert into public.calendar_assignments (
  id, workspace_id, calendar_item_id, volunteer_profile_id, lifecycle, assignment_note, created_by_auth_user_id
)
values
  ${assignmentValues(fixture.assignments.far, fixture.workspaceId, fixture.items.far, fixture.volunteerId)},
  ${assignmentValues(fixture.assignments.confirmAllA, fixture.workspaceId, fixture.items.confirmAllA, fixture.volunteerId)},
  ${assignmentValues(fixture.assignments.confirmAllB, fixture.workspaceId, fixture.items.confirmAllB, fixture.volunteerId)},
  ${assignmentValues(fixture.assignments.inside48, fixture.workspaceId, fixture.items.inside48, fixture.volunteerId)},
  ${assignmentValues(fixture.assignments.past, fixture.workspaceId, fixture.items.past, fixture.volunteerId)},
  ${assignmentValues(fixture.assignments.otherWorkspace, fixture.otherWorkspaceId, fixture.items.otherWorkspace, fixture.otherVolunteerId)};

insert into public.assignment_responses (
  id, workspace_id, assignment_id, response_status, response_source, response_note, responded_at, updated_by_auth_user_id
)
values
  ${responseValues(fixture.responses.far, fixture.workspaceId, fixture.assignments.far)},
  ${responseValues(fixture.responses.confirmAllA, fixture.workspaceId, fixture.assignments.confirmAllA)},
  ${responseValues(fixture.responses.confirmAllB, fixture.workspaceId, fixture.assignments.confirmAllB)},
  ${responseValues(fixture.responses.inside48, fixture.workspaceId, fixture.assignments.inside48)},
  ${responseValues(fixture.responses.past, fixture.workspaceId, fixture.assignments.past)},
  ${responseValues(fixture.responses.otherWorkspace, fixture.otherWorkspaceId, fixture.assignments.otherWorkspace)};`,
  );
}

async function expectRpcFailure(label, fn) {
  const result = await fn();
  assert(result.error, `${label} unexpectedly succeeded.`);
  assert(!redact(JSON.stringify(result.error)).includes("[redacted]"), `${label} leaked a secret.`);
  return result.error;
}

async function issueScheduleToken(client, volunteerProfileId) {
  const { data, error } = await client.rpc("issue_volunteer_schedule_access", {
    p_volunteer_profile_id: volunteerProfileId,
    p_ttl_hours: 720,
  });
  assert(!error && Array.isArray(data) && data.length === 1, "schedule token issuance failed");
  secrets.add(data[0].bearer_token);
  return data[0].bearer_token;
}

async function issueAssignmentResponseToken(client, assignmentId) {
  const { data, error } = await client.rpc("issue_assignment_response_token", {
    p_assignment_id: assignmentId,
    p_ttl_hours: 72,
    p_internal_note: "qa 12.21 response parity",
  });
  assert(!error && Array.isArray(data) && data.length === 1, "assignment response token issuance failed");
  secrets.add(data[0].bearer_token);
  return data[0].bearer_token;
}

async function runBehavior(containerName, users) {
  const anon = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const token = await issueScheduleToken(users.scheduler.client, fixture.volunteerId);

  const initial = await anon.rpc("read_volunteer_schedule", { p_bearer_token: token });
  assert(!initial.error, "schedule read failed");
  assert.equal(initial.data.filter((row) => row.schedule_state === "ready").length, 5);
  const farInitial = initial.data.find((row) => row.assignment_reference === fixture.assignments.far);
  const insideInitial = initial.data.find((row) => row.assignment_reference === fixture.assignments.inside48);
  const pastInitial = initial.data.find((row) => row.assignment_reference === fixture.assignments.past);
  assert(farInitial.can_confirm && farInitial.can_decline, "far assignment should allow confirm and decline");
  assert(insideInitial.can_confirm && !insideInitial.can_decline && insideInitial.response_lock_reason === "inside_48_hours", "inside-48 assignment should allow only confirm");
  assert(!pastInitial.can_confirm && !pastInitial.can_decline && pastInitial.response_lock_reason === "started", "past assignment should be locked");
  assert(!JSON.stringify(initial.data).includes(fixture.otherWorkspaceId), "schedule read leaked wrong workspace id");

  const confirm = await anon.rpc("submit_volunteer_schedule_assignment_response", {
    p_bearer_token: token,
    p_assignment_id: fixture.assignments.far,
    p_response_status: "confirmed",
    p_response_note: "  ignored for confirm  ",
  });
  assert(!confirm.error && confirm.data[0].current_response_status === "confirmed", "confirm failed");
  assert.equal(confirm.data[0].response_note, null, "confirm should clear response note");

  const decline = await anon.rpc("submit_volunteer_schedule_assignment_response", {
    p_bearer_token: token,
    p_assignment_id: fixture.assignments.far,
    p_response_status: "declined",
    p_response_note: "  I am away  ",
  });
  assert(!decline.error && decline.data[0].current_response_status === "declined", "decline failed");
  assert.equal(decline.data[0].response_note, "I am away", "decline note was not normalized");

  const repeatDecline = await anon.rpc("submit_volunteer_schedule_assignment_response", {
    p_bearer_token: token,
    p_assignment_id: fixture.assignments.far,
    p_response_status: "declined",
    p_response_note: null,
  });
  assert(!repeatDecline.error && repeatDecline.data[0].current_response_status === "declined", "repeat decline should be idempotent");
  assert.equal(repeatDecline.data[0].response_note, "I am away", "repeat decline should preserve note when no new note is supplied");

  const confirmAgain = await anon.rpc("submit_volunteer_schedule_assignment_response", {
    p_bearer_token: token,
    p_assignment_id: fixture.assignments.far,
    p_response_status: "confirmed",
    p_response_note: null,
  });
  assert(!confirmAgain.error && confirmAgain.data[0].current_response_status === "confirmed", "declined to confirmed failed");

  await expectRpcFailure("inside-48 decline", () =>
    anon.rpc("submit_volunteer_schedule_assignment_response", {
      p_bearer_token: token,
      p_assignment_id: fixture.assignments.inside48,
      p_response_status: "declined",
      p_response_note: "too late",
    }),
  );

  const insideConfirm = await anon.rpc("submit_volunteer_schedule_assignment_response", {
    p_bearer_token: token,
    p_assignment_id: fixture.assignments.inside48,
    p_response_status: "confirmed",
    p_response_note: null,
  });
  assert(!insideConfirm.error && insideConfirm.data[0].current_response_status === "confirmed", "inside-48 confirm failed");

  await expectRpcFailure("past confirm", () =>
    anon.rpc("submit_volunteer_schedule_assignment_response", {
      p_bearer_token: token,
      p_assignment_id: fixture.assignments.past,
      p_response_status: "confirmed",
      p_response_note: null,
    }),
  );
  await expectRpcFailure("wrong workspace assignment", () =>
    anon.rpc("submit_volunteer_schedule_assignment_response", {
      p_bearer_token: token,
      p_assignment_id: fixture.assignments.otherWorkspace,
      p_response_status: "confirmed",
      p_response_note: null,
    }),
  );
  await expectRpcFailure("malformed status", () =>
    anon.rpc("submit_volunteer_schedule_assignment_response", {
      p_bearer_token: token,
      p_assignment_id: fixture.assignments.far,
      p_response_status: "needs_response",
      p_response_note: null,
    }),
  );
  await expectRpcFailure("oversized note", () =>
    anon.rpc("submit_volunteer_schedule_assignment_response", {
      p_bearer_token: token,
      p_assignment_id: fixture.assignments.far,
      p_response_status: "declined",
      p_response_note: "x".repeat(1001),
    }),
  );

  const confirmAll = await anon.rpc("confirm_all_volunteer_schedule_assignments", {
    p_bearer_token: token,
  });
  assert(!confirmAll.error && confirmAll.data[0].confirmed_count === 2, "confirm all failed");

  const after = queryJson(
    containerName,
    `select assignment_id::text, response_status, response_source, response_note, responded_at is not null as responded
     from public.assignment_responses
     where workspace_id = ${sqlUuid(fixture.workspaceId)}
     order by assignment_id::text`,
  );
  const rowFor = (assignmentId) => after.find((row) => row.assignment_id === assignmentId);
  assert.equal(rowFor(fixture.assignments.far).response_status, "confirmed");
  assert.equal(rowFor(fixture.assignments.far).response_source, "volunteer_schedule");
  assert.equal(rowFor(fixture.assignments.confirmAllA).response_status, "confirmed");
  assert.equal(rowFor(fixture.assignments.confirmAllA).response_source, "volunteer_schedule");
  assert.equal(rowFor(fixture.assignments.confirmAllB).response_status, "confirmed");
  assert.equal(rowFor(fixture.assignments.confirmAllB).response_source, "volunteer_schedule");
  assert.equal(rowFor(fixture.assignments.past).response_status, "needs_response", "past assignment changed unexpectedly");
  const scheduleTokenSideEffects = queryJson(
    containerName,
    `select count(*)::int as count
     from public.assignment_response_tokens
     where workspace_id = ${sqlUuid(fixture.workspaceId)}`,
  )[0]?.count;
  assert.equal(
    scheduleTokenSideEffects,
    0,
    "Schedule responses created or consumed assignment-response token rows.",
  );

  const assignmentBearer = await issueAssignmentResponseToken(
    users.scheduler.client,
    fixture.assignments.confirmAllA,
  );
  await expectRpcFailure("same-status assignment response token", () =>
    anon.rpc("submit_assignment_response_by_token", {
      p_bearer_token: assignmentBearer,
      p_response_status: "confirmed",
      p_response_note: null,
    }),
  );
  const insideBearer = await issueAssignmentResponseToken(users.scheduler.client, fixture.assignments.inside48);
  await expectRpcFailure("inside-48 token decline", () =>
    anon.rpc("submit_assignment_response_by_token", {
      p_bearer_token: insideBearer,
      p_response_status: "declined",
      p_response_note: null,
    }),
  );

  const directInsert = await anon.from("assignment_responses").insert({
    workspace_id: fixture.workspaceId,
    assignment_id: fixture.assignments.far,
    response_status: "declined",
    response_source: "volunteer_schedule",
  });
  assert(directInsert.error, "direct assignment response insert was allowed");
  const directUpdate = await anon
    .from("assignment_responses")
    .update({ response_status: "declined" })
    .eq("assignment_id", fixture.assignments.far);
  assert(directUpdate.error, "direct assignment response update was allowed");
  const directDelete = await anon
    .from("assignment_responses")
    .delete()
    .eq("assignment_id", fixture.assignments.far);
  assert(directDelete.error, "direct assignment response delete was allowed");

  const coverage = queryJson(
    containerName,
    `select
      count(*) filter (where response_status in ('needs_response', 'confirmed'))::int as active_assigned,
      count(*) filter (where response_status = 'confirmed')::int as confirmed,
      count(*) filter (where response_status = 'declined')::int as declined
     from public.calendar_assignments assignment
     join public.assignment_responses response on response.assignment_id = assignment.id
     where assignment.workspace_id = ${sqlUuid(fixture.workspaceId)}
       and assignment.lifecycle = 'active'`,
  )[0];
  assert(coverage.active_assigned >= 4 && coverage.confirmed >= 4 && coverage.declined === 0, "coverage truth was not assignment/current-response based");
}

function cleanup(containerName) {
  const workspaceIds = [fixture.workspaceId, fixture.otherWorkspaceId].map(sqlUuid).join(",");
  runPsql(
    containerName,
    `delete from public.assignment_response_tokens where workspace_id in (${workspaceIds});
delete from public.volunteer_schedule_access_tokens where workspace_id in (${workspaceIds});
delete from public.assignment_responses where workspace_id in (${workspaceIds});
delete from public.calendar_assignments where workspace_id in (${workspaceIds});
delete from public.calendar_items where workspace_id in (${workspaceIds});
delete from public.volunteer_profiles where workspace_id in (${workspaceIds});
delete from public.workspace_contact_grants where workspace_id in (${workspaceIds});
delete from public.project_contacts where id in (${sqlUuid(fixture.contactId)}, ${sqlUuid(fixture.otherContactId)});
delete from public.workspaces where id in (${workspaceIds});
delete from auth.users where id in (${authUserIds.map(sqlUuid).join(",") || "null::uuid"});`,
  );
}

function verifyNoResidue(containerName) {
  const residue = queryJson(
    containerName,
    `select (
      (select count(*) from public.workspaces where workspace_key like ${sqlText(`${fixture.namespace}%`)}) +
      (select count(*) from public.volunteer_profiles where full_name like ${sqlText(`${fixture.namespace}%`)}) +
      (select count(*) from public.calendar_items where title_snapshot like ${sqlText(`${fixture.namespace}%`)}) +
      (select count(*) from auth.users where email like ${sqlText(`${fixture.namespace}%`)})
    )::int as residue`,
  )[0]?.residue;
  assert.equal(residue, 0, "Disposable volunteer schedule response residue remains.");
}

async function runStaticGuards() {
  const migration = await readFile(
    path.join(root, "supabase", "migrations", "20260714122100_volunteer_schedule_responses.sql"),
    "utf8",
  );
  const client = await readFile(path.join(root, "components", "VolunteerScheduleClient.tsx"), "utf8");
  const server = await readFile(path.join(root, "lib", "volunteerScheduleAccess", "server.ts"), "utf8");
  const pkg = await readFile(path.join(root, "package.json"), "utf8");
  assert(migration.includes("submit_volunteer_schedule_assignment_response"), "schedule response RPC missing");
  assert(migration.includes("confirm_all_volunteer_schedule_assignments"), "confirm-all RPC missing");
  assert(migration.includes("submit_assignment_response_by_token"), "response-token parity replacement missing");
  assert(migration.includes("response_source in ('project_contact', 'public_token', 'volunteer_schedule')"), "schedule response source provenance is not explicit");
  assert(migration.includes("response_source = 'volunteer_schedule'"), "schedule responses do not record volunteer_schedule provenance");
  assert(migration.includes("interval '48 hours'"), "48-hour cutoff missing");
  assert(migration.includes("assignment_start_at <= now()"), "start lock missing");
  assert(!/sendEmail|delivery_record|remembered_device|reveal_assignment_response_link/.test(migration), "migration activated out-of-scope behavior");
  assert(client.includes("Confirm all pending"), "volunteer schedule UI lacks Confirm All control");
  assert(client.includes("Can’t make it"), "volunteer schedule UI lacks denial label");
  assert(!client.includes("read-only for 12.20"), "stale read-only copy remains");
  assert(server.includes("createVolunteerScheduleReadClient"), "public schedule client seam missing");
  assert(server.includes("submit_volunteer_schedule_assignment_response"), "server helper does not call schedule response RPC");
  assert(pkg.includes("test:volunteer-schedule-responses"), "package script missing");
}

async function main() {
  assert(supabaseUrl && anonKey, "Local public Supabase environment values are missing.");
  assert(isLoopbackUrl(supabaseUrl), "Volunteer schedule response validation accepts only local Supabase.");
  secrets.add(anonKey);
  await runStaticGuards();

  const containerName = await resolveLocalDatabaseContainer();
  try {
    await applyRequiredMigrations(containerName);
    const users = {
      scheduler: await createAuthenticatedUser("scheduler"),
      other: await createAuthenticatedUser("other"),
    };
    insertFixtures(containerName, users);
    await runBehavior(containerName, users);
  } finally {
    try {
      cleanup(containerName);
      verifyNoResidue(containerName);
    } catch (error) {
      throw new Error(`Volunteer schedule response cleanup failed: ${redact(error)}`);
    }
  }

  console.log("Validated volunteer schedule Confirm/Deny, denial notes, Confirm All, 48-hour/start locks, response-token parity, direct table denial, assignment/current-response truth, safe output, and zero disposable residue.");
}

main().catch((error) => {
  console.error(redact(error));
  process.exit(1);
});
