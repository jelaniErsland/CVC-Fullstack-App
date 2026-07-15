import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { readCalendarReadModelWithClient } from "../lib/calendar/readModelQuery.server.ts";
import {
  validateCreateCalendarItemInput,
  validateUpdateCalendarOneOffTimedItemInput,
} from "../lib/calendar/item.ts";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const root = process.cwd();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const secrets = new Set();

const fixture = {
  namespace: `qa-12-16-calendar-${randomUUID()}`,
  workspaceId: randomUUID(),
  otherWorkspaceId: randomUUID(),
  contacts: {
    full: randomUUID(),
    viewOnly: randomUUID(),
    roleOnly: randomUUID(),
    other: randomUUID(),
  },
  grants: {
    full: randomUUID(),
    viewOnly: randomUUID(),
    roleOnly: randomUUID(),
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
    throw new Error(`Local Calendar item management fixture command failed: ${redact(result.stderr).slice(0, 800)}`);
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
    "Local Supabase is unavailable. Start Docker Desktop and local Supabase with output redirected/redacted before this local validation.",
  );
  return containerName;
}

async function verifyPreflight() {
  assert(supabaseUrl && anonKey, "Local public Supabase environment values are missing.");
  assert(isLoopbackUrl(supabaseUrl), "Calendar item management validation accepts only local Supabase.");
  secrets.add(anonKey);
  const health = await fetch(new URL("/auth/v1/health", supabaseUrl), {
    headers: { apikey: anonKey },
    redirect: "error",
  });
  assert(health.ok, "Local Supabase Auth is unavailable.");
}

async function applyCalendarManagementMigrationIfNeeded(containerName) {
  const hasColumn = queryJson(
    containerName,
    "select 1 as present from information_schema.columns where table_schema = 'public' and table_name = 'calendar_items' and column_name = 'follow_up_project_contact_id'",
  );
  const hasFunction = queryJson(
    containerName,
    "select 1 as present from pg_proc where proname = 'update_calendar_item_one_off_timed'",
  );
  if (hasColumn.length > 0 && hasFunction.length > 0) return;
  const migration = await readFile(
    path.join(root, "supabase", "migrations", "20260714121600_calendar_item_management.sql"),
    "utf8",
  );
  runPsql(containerName, migration);
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

function grantRow(label, workspaceId, role, capabilities) {
  return `(${sqlUuid(fixture.grants[label])}, ${sqlUuid(workspaceId)}, ${sqlUuid(fixture.contacts[label])}, ${sqlText(role)}, ${sqlArray(capabilities)}, 'active', clock_timestamp() - interval '1 day', null, null)`;
}

function insertFixtures(containerName, users) {
  runPsql(
    containerName,
    `insert into public.workspaces (id, workspace_key, display_name, lifecycle, timezone, starts_on, ends_on, public_intake_enabled)
values
  (${sqlUuid(fixture.workspaceId)}, ${sqlText(`${fixture.namespace}-target`)}, 'QA 12.16 Calendar Target', 'active', 'America/Denver', '2026-08-01'::date, '2026-12-31'::date, false),
  (${sqlUuid(fixture.otherWorkspaceId)}, ${sqlText(`${fixture.namespace}-other`)}, 'QA 12.16 Calendar Other', 'active', 'America/Denver', '2026-08-01'::date, '2026-12-31'::date, false);

insert into public.project_contacts (id, auth_user_id, status)
values
  (${sqlUuid(fixture.contacts.full)}, ${sqlUuid(users.full.userId)}, 'active'),
  (${sqlUuid(fixture.contacts.viewOnly)}, ${sqlUuid(users.viewOnly.userId)}, 'active'),
  (${sqlUuid(fixture.contacts.roleOnly)}, ${sqlUuid(users.roleOnly.userId)}, 'active'),
  (${sqlUuid(fixture.contacts.other)}, ${sqlUuid(users.other.userId)}, 'active');

insert into public.workspace_contact_grants (id, workspace_id, project_contact_id, role, capabilities, status, valid_from, valid_until, revoked_at)
values
  ${grantRow("full", fixture.workspaceId, "main_contact", ["workspace.read", "calendar.view", "assignments.view", "calendar.edit"])},
  ${grantRow("viewOnly", fixture.workspaceId, "assistant_contact", ["workspace.read", "calendar.view", "assignments.view"])},
  ${grantRow("roleOnly", fixture.workspaceId, "main_contact", ["workspace.read"])},
  ${grantRow("other", fixture.otherWorkspaceId, "main_contact", ["workspace.read", "calendar.view", "assignments.view", "calendar.edit"])};`,
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
  const presetSource = item.source.kind === "preset";
  const schedule = item.schedule;
  const { data, error } = await client.rpc("create_calendar_item", {
    p_workspace_id: item.workspaceId,
    p_task_preset_id: presetSource ? item.source.taskPresetId : null,
    p_one_off_title: presetSource ? null : item.source.title,
    p_one_off_task_type: presetSource ? null : item.source.taskType,
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

async function updateCalendarOneOffTimedItemWithClient(client, input) {
  const item = validateUpdateCalendarOneOffTimedItemInput(input);
  const { data, error } = await client.rpc("update_calendar_item_one_off_timed", {
    p_calendar_item_id: item.calendarItemId,
    p_one_off_title: item.source.title,
    p_one_off_task_type: item.source.taskType,
    p_start_date: item.schedule.date,
    p_start_time: item.schedule.startTime,
    p_end_time: item.schedule.endTime,
    p_needed_count: item.neededCount,
    p_schedule_notes: item.notes ?? null,
    p_custom_values: item.customValues,
  });
  if (error || typeof data !== "string") throw new Error("Calendar item update failed.");
  return { calendarItemId: data };
}

async function verifyCalendarManagement(containerName, users) {
  const created = await createCalendarItemWithClient(users.full.client, {
    workspaceId: fixture.workspaceId,
    source: { kind: "one_off", title: "QA 12.16 First Scheduled Item", taskType: "general" },
    schedule: { kind: "timed", date: "2026-08-12", startTime: "09:00", endTime: "10:30" },
    neededCount: 0,
    notes: "Created by the 12.16 local validation.",
    customValues: {},
  });
  assert.match(created.calendarItemId, /^[0-9a-f-]{36}$/);

  let rows = queryJson(
    containerName,
    `select id, workspace_id, title_snapshot, start_date, start_time::text, end_time::text, needed_count, schedule_notes, follow_up_project_contact_id
     from public.calendar_items where id = ${sqlUuid(created.calendarItemId)}`,
  );
  assert.equal(rows.length, 1, "Created Calendar item row was not persisted.");
  assert.equal(rows[0].workspace_id, fixture.workspaceId);
  assert.equal(rows[0].needed_count, 0);
  assert.equal(rows[0].follow_up_project_contact_id, fixture.contacts.full);

  const readModel = await readCalendarReadModelWithClient({
    client: users.full.client,
    workspaceId: fixture.workspaceId,
    actorContactId: fixture.contacts.full,
    workspaceTimezone: "America/Denver",
    rangeStart: "2026-08-10",
    rangeEnd: "2026-08-17",
    periodKind: "week",
    capabilities: ["calendar.view", "assignments.view"],
  });
  assert.equal(readModel.ok, true, "Created item did not appear through the persisted read model.");
  assert(readModel.ok && readModel.items.some((item) => item.calendarItemId === created.calendarItemId));

  await updateCalendarOneOffTimedItemWithClient(users.full.client, {
    calendarItemId: created.calendarItemId,
    source: { title: "QA 12.16 Edited Scheduled Item", taskType: "security" },
    schedule: { kind: "timed", date: "2026-08-13", startTime: "11:00", endTime: "12:15" },
    neededCount: 2,
    notes: "Edited by the 12.16 local validation.",
    customValues: {},
  });

  rows = queryJson(
    containerName,
    `select title_snapshot, task_type_snapshot, start_date, start_time::text, end_time::text, needed_count, schedule_notes, follow_up_project_contact_id
     from public.calendar_items where id = ${sqlUuid(created.calendarItemId)}`,
  );
  assert.equal(rows[0].title_snapshot, "QA 12.16 Edited Scheduled Item");
  assert.equal(rows[0].task_type_snapshot, "security");
  assert.equal(rows[0].start_date, "2026-08-13");
  assert.equal(rows[0].needed_count, 2);
  assert.equal(rows[0].follow_up_project_contact_id, fixture.contacts.full);

  await expectFailure("view-only create", () =>
    createCalendarItemWithClient(users.viewOnly.client, {
      workspaceId: fixture.workspaceId,
      source: { kind: "one_off", title: "Should Not Save", taskType: "general" },
      schedule: { kind: "timed", date: "2026-08-12", startTime: "09:00", endTime: "10:00" },
      neededCount: 1,
      notes: null,
      customValues: {},
    }),
  );
  await expectFailure("view-only edit", () =>
    updateCalendarOneOffTimedItemWithClient(users.viewOnly.client, {
      calendarItemId: created.calendarItemId,
      source: { title: "Should Not Edit", taskType: "general" },
      schedule: { kind: "timed", date: "2026-08-12", startTime: "09:00", endTime: "10:00" },
      neededCount: 1,
      notes: null,
      customValues: {},
    }),
  );
  await expectFailure("role-only create", () =>
    createCalendarItemWithClient(users.roleOnly.client, {
      workspaceId: fixture.workspaceId,
      source: { kind: "one_off", title: "Role Is Not Authority", taskType: "general" },
      schedule: { kind: "timed", date: "2026-08-12", startTime: "09:00", endTime: "10:00" },
      neededCount: 1,
      notes: null,
      customValues: {},
    }),
  );
  await expectFailure("wrong-workspace create", () =>
    createCalendarItemWithClient(users.full.client, {
      workspaceId: fixture.otherWorkspaceId,
      source: { kind: "one_off", title: "Wrong Workspace", taskType: "general" },
      schedule: { kind: "timed", date: "2026-08-12", startTime: "09:00", endTime: "10:00" },
      neededCount: 1,
      notes: null,
      customValues: {},
    }),
  );
  await expectFailure("invalid time ordering", () =>
    createCalendarItemWithClient(users.full.client, {
      workspaceId: fixture.workspaceId,
      source: { kind: "one_off", title: "Bad Time", taskType: "general" },
      schedule: { kind: "timed", date: "2026-08-12", startTime: "12:00", endTime: "10:00" },
      neededCount: 1,
      notes: null,
      customValues: {},
    }),
  );
  await expectFailure("invalid needed count", () =>
    createCalendarItemWithClient(users.full.client, {
      workspaceId: fixture.workspaceId,
      source: { kind: "one_off", title: "Bad Needed", taskType: "general" },
      schedule: { kind: "timed", date: "2026-08-12", startTime: "09:00", endTime: "10:00" },
      neededCount: -1,
      notes: null,
      customValues: {},
    }),
  );
  await expectFailure("unsupported preset source", () =>
    createCalendarItemWithClient(users.full.client, {
      workspaceId: fixture.workspaceId,
      source: { kind: "preset", taskPresetId: randomUUID() },
      schedule: { kind: "timed", date: "2026-08-12", startTime: "09:00", endTime: "10:00" },
      neededCount: 1,
      notes: null,
      customValues: {},
    }),
  );

  const directInsert = await users.full.client.from("calendar_items").insert({
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
  assert(directInsert.error, "Direct authenticated Calendar table insert should be denied.");
  const directUpdate = await users.full.client
    .from("calendar_items")
    .update({ title_snapshot: "Direct Update" })
    .eq("id", created.calendarItemId);
  assert(directUpdate.error, "Direct authenticated Calendar table update should be denied.");
  const directDelete = await users.full.client
    .from("calendar_items")
    .delete()
    .eq("id", created.calendarItemId);
  assert(directDelete.error, "Direct authenticated Calendar table delete should be denied.");
}

function cleanup(containerName) {
  if (authUserIds.length === 0) return;
  const authIds = `array[${authUserIds.map(sqlUuid).join(", ")}]::uuid[]`;
  runPsql(
    containerName,
    `delete from public.assignment_responses where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)});
delete from public.calendar_assignments where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)});
delete from public.calendar_items where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)});
delete from public.workspace_contact_grants where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)});
delete from public.project_contacts where auth_user_id = any(${authIds});
delete from public.workspaces where workspace_key like ${sqlText(`${fixture.namespace}%`)};
delete from auth.identities where user_id = any(${authIds});
delete from auth.users where id = any(${authIds});`,
  );
  const residue = queryJson(
    containerName,
    `select
      (select count(*) from public.calendar_items where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)})) +
      (select count(*) from public.workspace_contact_grants where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)})) +
      (select count(*) from public.project_contacts where auth_user_id = any(${authIds})) +
      (select count(*) from public.workspaces where workspace_key like ${sqlText(`${fixture.namespace}%`)}) +
      (select count(*) from auth.users where id = any(${authIds})) as residue`,
  )[0]?.residue;
  assert.equal(Number(residue), 0, "Calendar item management cleanup left residue.");
  cleanupCompleted = true;
}

async function main() {
  await verifyPreflight();
  const containerName = await resolveLocalDatabaseContainer();
  try {
    await applyCalendarManagementMigrationIfNeeded(containerName);
    const users = {
      full: await createAuthenticatedUser("full"),
      viewOnly: await createAuthenticatedUser("view-only"),
      roleOnly: await createAuthenticatedUser("role-only"),
      other: await createAuthenticatedUser("other"),
    };
    insertFixtures(containerName, users);
    await verifyCalendarManagement(containerName, users);
  } finally {
    cleanup(containerName);
  }
  assert(cleanupCompleted, "Calendar item management cleanup did not complete.");
  console.log("Calendar item management local validation passed.");
  console.log("Confirmed create/edit persistence, Follow-up Contact, authorization isolation, direct table-write denial, and zero residue.");
}

main().catch((error) => {
  console.error(`Calendar item management validation failed: ${redact(error)}`);
  process.exit(1);
});
