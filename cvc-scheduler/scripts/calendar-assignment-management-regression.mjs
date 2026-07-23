import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  validateCancelAssignmentInput,
  validateCreateAssignmentBatchInput,
} from "../lib/assignments/assignment.ts";
import { readCalendarAssignmentPickerWithClient } from "../lib/calendar/assignmentPicker.server.ts";
import { readCalendarReadModelWithClient } from "../lib/calendar/readModelQuery.server.ts";
import { validateCreateCalendarItemInput } from "../lib/calendar/item.ts";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const root = process.cwd();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const secrets = new Set();

const fixture = {
  namespace: `qa-12-18-calendar-assignments-${randomUUID()}`,
  workspaceId: randomUUID(),
  otherWorkspaceId: randomUUID(),
  contacts: {
    full: randomUUID(),
    viewOnly: randomUUID(),
    noVolunteers: randomUUID(),
    roleOnly: randomUUID(),
    revoked: randomUUID(),
    expired: randomUUID(),
    inactive: randomUUID(),
    other: randomUUID(),
  },
  grants: {
    full: randomUUID(),
    viewOnly: randomUUID(),
    noVolunteers: randomUUID(),
    roleOnly: randomUUID(),
    revoked: randomUUID(),
    expired: randomUUID(),
    inactive: randomUUID(),
    other: randomUUID(),
  },
  volunteers: {
    readyA: randomUUID(),
    readyB: randomUUID(),
    readyC: randomUUID(),
    onHold: randomUUID(),
    inactive: randomUUID(),
    other: randomUUID(),
  },
};

const authUserIds = [];
let cleanupCompleted = false;

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
    throw new Error(`Local Calendar assignment fixture command failed: ${redact(result.stderr).slice(0, 800)}`);
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

async function verifyPreflight() {
  assert(supabaseUrl && anonKey, "Local public Supabase environment values are missing.");
  assert(isLoopbackUrl(supabaseUrl), "Calendar assignment management validation accepts only local Supabase.");
  secrets.add(anonKey);
  const health = await fetch(new URL("/auth/v1/health", supabaseUrl), {
    headers: { apikey: anonKey },
    redirect: "error",
  });
  assert(health.ok, "Local Supabase Auth is unavailable.");
}

async function applyMigrationIfNeeded(containerName, migrationName, probeSql) {
  const hasMigration = queryJson(containerName, probeSql);
  if (hasMigration.length > 0) return;
  const migration = await readFile(
    path.join(root, "supabase", "migrations", migrationName),
    "utf8",
  );
  runPsql(containerName, migration);
}

async function applyCalendarAssignmentMigrationIfNeeded(containerName) {
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
  if (signup.data.session?.access_token) secrets.add(signup.data.session.access_token);
  if (signup.data.session?.refresh_token) secrets.add(signup.data.session.refresh_token);
  if (!signup.data.session) {
    const signin = await client.auth.signInWithPassword({ email, password });
    assert(!signin.error && signin.data.session, `Disposable Auth sign-in failed for ${label}.`);
    secrets.add(signin.data.session.access_token);
    secrets.add(signin.data.session.refresh_token);
  }
  const user = await client.auth.getUser();
  assert.equal(user.data.user?.id, signup.data.user.id);
  authUserIds.push(signup.data.user.id);
  return { client, userId: signup.data.user.id };
}

function grantRow(label, workspaceId, role, capabilities, status = "active", extra = "") {
  const revoked = extra === "revoked" ? "clock_timestamp()" : "null";
  const validUntil = extra === "expired" ? "clock_timestamp() - interval '1 hour'" : "null";
  return `(${sqlUuid(fixture.grants[label])}, ${sqlUuid(workspaceId)}, ${sqlUuid(fixture.contacts[label])}, ${sqlText(role)}, ${sqlArray(capabilities)}, ${sqlText(status)}, clock_timestamp() - interval '1 day', ${validUntil}, ${revoked})`;
}

function volunteerRow(id, workspaceId, fullName, readinessStatus = "ready", lifecycle = "active", contactId = fixture.contacts.full) {
  return `(${sqlUuid(id)}, ${sqlUuid(workspaceId)}, null, 'manual', ${sqlUuid(contactId)}, clock_timestamp(), ${sqlText(lifecycle)}, ${sqlText(readinessStatus)}, ${sqlText(fullName)}, ${sqlText(`${fullName.replaceAll(" ", ".").toLowerCase()}@example.invalid`)}, null, 'Bozeman QA', null, '{}'::jsonb, '{}'::jsonb, '')`;
}

function insertFixtures(containerName, users) {
  runPsql(
    containerName,
    `insert into public.workspaces (id, workspace_key, display_name, lifecycle, timezone, starts_on, ends_on, public_intake_enabled)
values
  (${sqlUuid(fixture.workspaceId)}, ${sqlText(`${fixture.namespace}-target`)}, 'QA 12.18 Calendar Target', 'active', 'America/Denver', '2026-08-01'::date, '2026-12-31'::date, false),
  (${sqlUuid(fixture.otherWorkspaceId)}, ${sqlText(`${fixture.namespace}-other`)}, 'QA 12.18 Calendar Other', 'active', 'America/Denver', '2026-08-01'::date, '2026-12-31'::date, false);

insert into public.project_contacts (id, auth_user_id, status)
values
  (${sqlUuid(fixture.contacts.full)}, ${sqlUuid(users.full.userId)}, 'active'),
  (${sqlUuid(fixture.contacts.viewOnly)}, ${sqlUuid(users.viewOnly.userId)}, 'active'),
  (${sqlUuid(fixture.contacts.noVolunteers)}, ${sqlUuid(users.noVolunteers.userId)}, 'active'),
  (${sqlUuid(fixture.contacts.roleOnly)}, ${sqlUuid(users.roleOnly.userId)}, 'active'),
  (${sqlUuid(fixture.contacts.revoked)}, ${sqlUuid(users.revoked.userId)}, 'active'),
  (${sqlUuid(fixture.contacts.expired)}, ${sqlUuid(users.expired.userId)}, 'active'),
  (${sqlUuid(fixture.contacts.inactive)}, ${sqlUuid(users.inactive.userId)}, 'active'),
  (${sqlUuid(fixture.contacts.other)}, ${sqlUuid(users.other.userId)}, 'active');

insert into public.workspace_contact_grants (id, workspace_id, project_contact_id, role, capabilities, status, valid_from, valid_until, revoked_at)
values
  ${grantRow("full", fixture.workspaceId, "main_contact", ["workspace.read", "calendar.view", "assignments.view", "calendar.edit", "assignments.edit", "volunteers.view"])},
  ${grantRow("viewOnly", fixture.workspaceId, "assistant_contact", ["workspace.read", "calendar.view", "assignments.view", "volunteers.view"])},
  ${grantRow("noVolunteers", fixture.workspaceId, "assistant_contact", ["workspace.read", "calendar.view", "assignments.view", "assignments.edit"])},
  ${grantRow("roleOnly", fixture.workspaceId, "main_contact", ["workspace.read"])},
  ${grantRow("revoked", fixture.workspaceId, "main_contact", ["workspace.read", "calendar.view", "assignments.view", "assignments.edit", "volunteers.view"], "revoked", "revoked")},
  ${grantRow("expired", fixture.workspaceId, "main_contact", ["workspace.read", "calendar.view", "assignments.view", "assignments.edit", "volunteers.view"], "active", "expired")},
  ${grantRow("inactive", fixture.workspaceId, "main_contact", ["workspace.read", "calendar.view", "assignments.view", "assignments.edit", "volunteers.view"], "inactive")},
  ${grantRow("other", fixture.otherWorkspaceId, "main_contact", ["workspace.read", "calendar.view", "assignments.view", "assignments.edit", "volunteers.view"])};

insert into public.volunteer_profiles (
  id, workspace_id, source_submission_id, profile_source, manual_created_by_project_contact_id,
  manual_created_at, lifecycle, readiness_status, full_name, email, phone, congregation,
  preferred_contact_method, availability_snapshot, skills_help_snapshot, profile_notes
) values
  ${volunteerRow(fixture.volunteers.readyA, fixture.workspaceId, `${fixture.namespace} Ready A`)},
  ${volunteerRow(fixture.volunteers.readyB, fixture.workspaceId, `${fixture.namespace} Ready B`)},
  ${volunteerRow(fixture.volunteers.readyC, fixture.workspaceId, `${fixture.namespace} Ready C`)},
  ${volunteerRow(fixture.volunteers.onHold, fixture.workspaceId, `${fixture.namespace} On Hold`, "on_hold")},
  ${volunteerRow(fixture.volunteers.inactive, fixture.workspaceId, `${fixture.namespace} Inactive`, "ready", "inactive")},
  ${volunteerRow(fixture.volunteers.other, fixture.otherWorkspaceId, `${fixture.namespace} Other`, "ready", "active", fixture.contacts.other)};`,
  );
}

async function expectFailure(label, operation) {
  try {
    await operation();
  } catch {
    return;
  }
  assert.fail(`${label} should have failed closed.`);
}

async function createCalendarItemWithClient(client, input) {
  const item = validateCreateCalendarItemInput(input);
  const schedule = item.schedule;
  const { data, error } = await client.rpc("create_calendar_item", {
    p_workspace_id: item.workspaceId,
    p_task_preset_id: null,
    p_one_off_title: item.source.kind === "one_off" ? item.source.title : null,
    p_one_off_task_type: item.source.kind === "one_off" ? item.source.taskType : null,
    p_schedule_kind: schedule.kind,
    p_start_date: schedule.kind === "multi_day_window" ? schedule.startDate : schedule.date,
    p_end_date: schedule.kind === "multi_day_window" ? schedule.endDate : null,
    p_start_time: schedule.kind === "timed" ? schedule.startTime : null,
    p_end_time: schedule.kind === "timed" ? schedule.endTime : null,
    p_needed_count: item.neededCount,
    p_schedule_notes: item.notes ?? null,
    p_custom_values: item.customValues,
  });
  if (error || typeof data !== "string") throw new Error("Calendar item create failed.");
  return { calendarItemId: data };
}

async function createAssignmentsBatchWithClient(client, input) {
  const assignment = validateCreateAssignmentBatchInput(input);
  const { data, error } = await client.rpc("create_calendar_assignments_batch", {
    p_calendar_item_id: assignment.calendarItemId,
    p_volunteer_profile_ids: [...assignment.volunteerProfileIds],
    p_assignment_note: assignment.note ?? null,
  });
  if (error || !Array.isArray(data)) throw new Error("Assignment batch create failed.");
  return { assignmentIds: data };
}

async function cancelAssignmentWithClient(client, input) {
  const assignment = validateCancelAssignmentInput(input);
  const { data, error } = await client.rpc("cancel_calendar_assignment", {
    p_assignment_id: assignment.assignmentId,
  });
  if (error || typeof data !== "string") throw new Error("Assignment cancel failed.");
  return { assignmentId: data };
}

function readAssignmentRows(containerName) {
  return queryJson(
    containerName,
    `select assignment.id, assignment.calendar_item_id, assignment.volunteer_profile_id,
            assignment.lifecycle, response.response_status
     from public.calendar_assignments as assignment
     left join public.assignment_responses as response
       on response.workspace_id = assignment.workspace_id
      and response.assignment_id = assignment.id
     where assignment.workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)})
     order by assignment.created_at, assignment.id`,
  );
}

async function verifyAssignments(containerName, users) {
  const item = await createCalendarItemWithClient(users.full.client, {
    workspaceId: fixture.workspaceId,
    source: { kind: "one_off", title: `${fixture.namespace} Build Crew`, taskType: "general" },
    schedule: { kind: "timed", date: "2026-08-20", startTime: "09:00", endTime: "11:00" },
    neededCount: 1,
    notes: "Assignment QA.",
    customValues: {},
  });

  const volunteerProbe = await users.full.client
    .from("volunteer_profiles")
    .select("id,full_name,congregation,lifecycle,readiness_status")
    .eq("workspace_id", fixture.workspaceId);
  assert(!volunteerProbe.error, "Authorized volunteer picker projection should be readable.");
  assert.equal(volunteerProbe.data?.length, 5, "Authorized volunteer picker projection should include same-workspace volunteers.");

  const picker = await readCalendarAssignmentPickerWithClient({
    client: users.full.client,
    workspaceId: fixture.workspaceId,
    calendarItemIds: [item.calendarItemId],
    canViewVolunteers: true,
  });
  assert.equal(picker.kind, "ready", `Picker should be ready, received ${picker.kind}${"reason" in picker ? `:${picker.reason}` : ""}.`);
  assert.deepEqual(
    picker.volunteers.map((volunteer) => volunteer.id),
    [fixture.volunteers.readyA, fixture.volunteers.readyB, fixture.volunteers.readyC],
    "Picker should include only active ready same-workspace volunteers.",
  );
  assert(!("email" in picker.volunteers[0]), "Picker projection must not expose email.");
  assert(!("phone" in picker.volunteers[0]), "Picker projection must not expose phone.");

  const noVolunteerPicker = await readCalendarAssignmentPickerWithClient({
    client: users.noVolunteers.client,
    workspaceId: fixture.workspaceId,
    calendarItemIds: [item.calendarItemId],
    canViewVolunteers: false,
  });
  assert.equal(noVolunteerPicker.kind, "unavailable");

  const created = await createAssignmentsBatchWithClient(users.full.client, {
    calendarItemId: item.calendarItemId,
    volunteerProfileIds: [fixture.volunteers.readyA, fixture.volunteers.readyB],
    note: "Bring gloves.",
  });
  assert.equal(created.assignmentIds.length, 2);

  let assignments = readAssignmentRows(containerName);
  assert.equal(assignments.length, 2);
  assert.deepEqual(
    assignments.map((assignment) => assignment.response_status),
    ["needs_response", "needs_response"],
    "New assignments should start as needs_response.",
  );

  let readModel = await readCalendarReadModelWithClient({
    client: users.full.client,
    workspaceId: fixture.workspaceId,
    actorContactId: fixture.contacts.full,
    workspaceTimezone: "America/Denver",
    rangeStart: "2026-08-19",
    rangeEnd: "2026-08-21",
    periodKind: "week",
    capabilities: ["calendar.view", "assignments.view"],
  });
  assert(readModel.ok, "Calendar read model should see assignment-derived coverage.");
  let readItem = readModel.items.find((candidate) => candidate.calendarItemId === item.calendarItemId);
  assert(readItem);
  assert.equal(readItem.assignedFractionLabel, "2/1 assigned");
  assert.equal(readItem.coverage.assignedCount, 2);

  await expectFailure("duplicate assignment", () =>
    createAssignmentsBatchWithClient(users.full.client, {
      calendarItemId: item.calendarItemId,
      volunteerProfileIds: [fixture.volunteers.readyA],
      note: null,
    }),
  );
  await expectFailure("duplicate input validation", () =>
    validateCreateAssignmentBatchInput({
      calendarItemId: item.calendarItemId,
      volunteerProfileIds: [fixture.volunteers.readyC, fixture.volunteers.readyC],
    }),
  );
  await expectFailure("wrong-workspace volunteer", () =>
    createAssignmentsBatchWithClient(users.full.client, {
      calendarItemId: item.calendarItemId,
      volunteerProfileIds: [fixture.volunteers.other],
      note: null,
    }),
  );
  await expectFailure("on-hold volunteer", () =>
    createAssignmentsBatchWithClient(users.full.client, {
      calendarItemId: item.calendarItemId,
      volunteerProfileIds: [fixture.volunteers.onHold],
      note: null,
    }),
  );
  await expectFailure("view-only contact create", () =>
    createAssignmentsBatchWithClient(users.viewOnly.client, {
      calendarItemId: item.calendarItemId,
      volunteerProfileIds: [fixture.volunteers.readyC],
      note: null,
    }),
  );
  await expectFailure("missing volunteers does not imply edit failure but still cannot borrow full grant", () =>
    createAssignmentsBatchWithClient(users.roleOnly.client, {
      calendarItemId: item.calendarItemId,
      volunteerProfileIds: [fixture.volunteers.readyC],
      note: null,
    }),
  );
  await expectFailure("other workspace contact create", () =>
    createAssignmentsBatchWithClient(users.other.client, {
      calendarItemId: item.calendarItemId,
      volunteerProfileIds: [fixture.volunteers.readyC],
      note: null,
    }),
  );
  for (const label of ["revoked", "expired", "inactive"]) {
    await expectFailure(`${label} grant create`, () =>
      createAssignmentsBatchWithClient(users[label].client, {
        calendarItemId: item.calendarItemId,
        volunteerProfileIds: [fixture.volunteers.readyC],
        note: null,
      }),
    );
  }

  const directInsert = await users.full.client.from("calendar_assignments").insert({
    workspace_id: fixture.workspaceId,
    calendar_item_id: item.calendarItemId,
    volunteer_profile_id: fixture.volunteers.readyC,
    lifecycle: "active",
  });
  assert(directInsert.error, "Direct authenticated calendar_assignments insert should remain denied.");
  const directUpdate = await users.full.client
    .from("calendar_assignments")
    .update({ lifecycle: "canceled" })
    .eq("id", created.assignmentIds[0]);
  assert(directUpdate.error, "Direct authenticated calendar_assignments update should remain denied.");
  const directDelete = await users.full.client
    .from("calendar_assignments")
    .delete()
    .eq("id", created.assignmentIds[0]);
  assert(directDelete.error, "Direct authenticated calendar_assignments delete should remain denied.");

  await cancelAssignmentWithClient(users.full.client, { assignmentId: created.assignmentIds[0] });
  assignments = readAssignmentRows(containerName);
  assert.equal(
    assignments.find((assignment) => assignment.id === created.assignmentIds[0])?.lifecycle,
    "canceled",
  );

  readModel = await readCalendarReadModelWithClient({
    client: users.full.client,
    workspaceId: fixture.workspaceId,
    actorContactId: fixture.contacts.full,
    workspaceTimezone: "America/Denver",
    rangeStart: "2026-08-19",
    rangeEnd: "2026-08-21",
    periodKind: "week",
    capabilities: ["calendar.view", "assignments.view"],
  });
  assert(readModel.ok);
  readItem = readModel.items.find((candidate) => candidate.calendarItemId === item.calendarItemId);
  assert(readItem);
  assert.equal(readItem.assignedFractionLabel, "1/1 assigned");

  await expectFailure("cancel requires edit", () =>
    cancelAssignmentWithClient(users.viewOnly.client, { assignmentId: created.assignmentIds[1] }),
  );
  await expectFailure("cancel malformed input", () =>
    validateCancelAssignmentInput({ assignmentId: "not-a-uuid" }),
  );

  const tokenRows = queryJson(
    containerName,
    `select id from public.assignment_response_tokens where workspace_id = ${sqlUuid(fixture.workspaceId)}`,
  );
  assert.equal(tokenRows.length, 0, "Assignment management must not generate response tokens.");
}

function cleanup(containerName) {
  const userIds = authUserIds.map(sqlUuid).join(", ");
  runPsql(
    containerName,
    `begin;
delete from public.assignment_response_tokens where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)});
delete from public.assignment_responses where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)});
delete from public.calendar_assignments where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)});
delete from public.calendar_items where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)});
delete from public.volunteer_profiles where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)});
delete from public.workspace_contact_grants where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)});
delete from public.project_contacts where id in (${Object.values(fixture.contacts).map(sqlUuid).join(", ")});
delete from public.workspaces where id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)});
${userIds ? `delete from auth.users where id in (${userIds});` : ""}
commit;`,
  );
  const residue = runPsql(
    containerName,
    `select
  (select count(*) from public.workspaces where workspace_key like ${sqlText(`${fixture.namespace}%`)}) +
  (select count(*) from public.volunteer_profiles where full_name like ${sqlText(`${fixture.namespace}%`)}) +
  (select count(*) from public.calendar_items where title_snapshot like ${sqlText(`${fixture.namespace}%`)}) +
  (select count(*) from auth.users where email like ${sqlText(`${fixture.namespace}-%@example.invalid`)});`,
  );
  assert.equal(residue, "0", `Calendar assignment cleanup left residue count ${residue}.`);
  cleanupCompleted = true;
}

async function main() {
  await verifyPreflight();
  const containerName = await resolveLocalDatabaseContainer();
  await applyCalendarAssignmentMigrationIfNeeded(containerName);
  const users = {
    full: await createAuthenticatedUser("full"),
    viewOnly: await createAuthenticatedUser("view-only"),
    noVolunteers: await createAuthenticatedUser("no-volunteers"),
    roleOnly: await createAuthenticatedUser("role-only"),
    revoked: await createAuthenticatedUser("revoked"),
    expired: await createAuthenticatedUser("expired"),
    inactive: await createAuthenticatedUser("inactive"),
    other: await createAuthenticatedUser("other"),
  };

  try {
    insertFixtures(containerName, users);
    await verifyAssignments(containerName, users);
  } finally {
    cleanup(containerName);
  }

  console.log(
    "Confirmed Calendar assignment management: persisted picker, atomic create, cancel, coverage refresh, capability isolation, direct-write denial, no response-link activation, and zero-residue cleanup.",
  );
}

main().catch((error) => {
  console.error(redact(error));
  process.exitCode = 1;
}).finally(() => {
  if (!cleanupCompleted) {
    console.error("Calendar assignment management cleanup did not complete.");
  }
});
