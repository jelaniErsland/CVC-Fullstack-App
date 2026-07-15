import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { readCalendarReadModelWithClient } from "../lib/calendar/readModelQuery.server.ts";
import { readCalendarTaskPresetSelectorWithClient } from "../lib/calendar/taskPresetSelector.server.ts";
import {
  validateCreateCalendarItemInput,
  validateUpdateCalendarPresetTimedItemInput,
  validateUpdateCalendarOneOffTimedItemInput,
} from "../lib/calendar/item.ts";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const root = process.cwd();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const secrets = new Set();

const fixture = {
  namespace: `qa-12-17-calendar-source-${randomUUID()}`,
  workspaceId: randomUUID(),
  otherWorkspaceId: randomUUID(),
  taskPresetId: randomUUID(),
  archivedTaskPresetId: randomUUID(),
  otherTaskPresetId: randomUUID(),
  contacts: {
    full: randomUUID(),
    noTasks: randomUUID(),
    viewOnly: randomUUID(),
    roleOnly: randomUUID(),
    other: randomUUID(),
  },
  grants: {
    full: randomUUID(),
    noTasks: randomUUID(),
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
    throw new Error(`Local Calendar source-selection fixture command failed: ${redact(result.stderr).slice(0, 800)}`);
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
  assert(isLoopbackUrl(supabaseUrl), "Calendar source-selection validation accepts only local Supabase.");
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

async function applyCalendarSourceSelectionMigrationsIfNeeded(containerName) {
  await applyMigrationIfNeeded(
    containerName,
    "20260714121600_calendar_item_management.sql",
    "select 1 as present from pg_proc where proname = 'update_calendar_item_one_off_timed'",
  );
  await applyMigrationIfNeeded(
    containerName,
    "20260714121700_calendar_source_selection.sql",
    "select 1 as present from pg_proc where proname = 'update_calendar_item_preset_timed'",
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

function grantRow(label, workspaceId, role, capabilities, status = "active") {
  return `(${sqlUuid(fixture.grants[label])}, ${sqlUuid(workspaceId)}, ${sqlUuid(fixture.contacts[label])}, ${sqlText(role)}, ${sqlArray(capabilities)}, ${sqlText(status)}, clock_timestamp() - interval '1 day', null, null)`;
}

function insertFixtures(containerName, users) {
  runPsql(
    containerName,
    `insert into public.workspaces (id, workspace_key, display_name, lifecycle, timezone, starts_on, ends_on, public_intake_enabled)
values
  (${sqlUuid(fixture.workspaceId)}, ${sqlText(`${fixture.namespace}-target`)}, 'QA 12.17 Calendar Target', 'active', 'America/Denver', '2026-08-01'::date, '2026-12-31'::date, false),
  (${sqlUuid(fixture.otherWorkspaceId)}, ${sqlText(`${fixture.namespace}-other`)}, 'QA 12.17 Calendar Other', 'active', 'America/Denver', '2026-08-01'::date, '2026-12-31'::date, false);

insert into public.project_contacts (id, auth_user_id, status)
values
  (${sqlUuid(fixture.contacts.full)}, ${sqlUuid(users.full.userId)}, 'active'),
  (${sqlUuid(fixture.contacts.noTasks)}, ${sqlUuid(users.noTasks.userId)}, 'active'),
  (${sqlUuid(fixture.contacts.viewOnly)}, ${sqlUuid(users.viewOnly.userId)}, 'active'),
  (${sqlUuid(fixture.contacts.roleOnly)}, ${sqlUuid(users.roleOnly.userId)}, 'active'),
  (${sqlUuid(fixture.contacts.other)}, ${sqlUuid(users.other.userId)}, 'active');

insert into public.workspace_contact_grants (id, workspace_id, project_contact_id, role, capabilities, status, valid_from, valid_until, revoked_at)
values
  ${grantRow("full", fixture.workspaceId, "main_contact", ["workspace.read", "calendar.view", "assignments.view", "calendar.edit", "tasks.view"])},
  ${grantRow("noTasks", fixture.workspaceId, "main_contact", ["workspace.read", "calendar.view", "assignments.view", "calendar.edit"])},
  ${grantRow("viewOnly", fixture.workspaceId, "assistant_contact", ["workspace.read", "calendar.view", "assignments.view", "tasks.view"])},
  ${grantRow("roleOnly", fixture.workspaceId, "main_contact", ["workspace.read"])},
  ${grantRow("other", fixture.otherWorkspaceId, "main_contact", ["workspace.read", "calendar.view", "assignments.view", "calendar.edit", "tasks.view"])};

insert into public.task_presets (
  id, workspace_id, name, description, task_type, default_needed_count, volunteer_visible,
  is_system_preset, custom_field_definitions, lifecycle
) values
  (${sqlUuid(fixture.taskPresetId)}, ${sqlUuid(fixture.workspaceId)}, ${sqlText(`${fixture.namespace} Setup Crew`)}, 'Reusable setup definition', 'general', 3, true, false, '[{"key":"area","label":"Area","type":"short_text","required":false,"options":[]}]'::jsonb, 'active'),
  (${sqlUuid(fixture.archivedTaskPresetId)}, ${sqlUuid(fixture.workspaceId)}, ${sqlText(`${fixture.namespace} Archived`)}, null, 'security', 1, true, false, '[]'::jsonb, 'archived'),
  (${sqlUuid(fixture.otherTaskPresetId)}, ${sqlUuid(fixture.otherWorkspaceId)}, ${sqlText(`${fixture.namespace} Other`)}, null, 'food', 1, true, false, '[]'::jsonb, 'active');`,
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
  if (error || typeof data !== "string") throw new Error("Calendar one-off update failed.");
  return { calendarItemId: data };
}

async function updateCalendarPresetTimedItemWithClient(client, input) {
  const item = validateUpdateCalendarPresetTimedItemInput(input);
  const { data, error } = await client.rpc("update_calendar_item_preset_timed", {
    p_calendar_item_id: item.calendarItemId,
    p_start_date: item.schedule.date,
    p_start_time: item.schedule.startTime,
    p_end_time: item.schedule.endTime,
    p_needed_count: item.neededCount,
    p_schedule_notes: item.notes ?? null,
    p_custom_values: item.customValues,
  });
  if (error || typeof data !== "string") throw new Error("Calendar preset update failed.");
  return { calendarItemId: data };
}

function readCalendarRows(containerName) {
  return queryJson(
    containerName,
    `select id, workspace_id, task_preset_id, title_snapshot, task_type_snapshot,
            schedule_kind, start_date, start_time, end_time, needed_count,
            schedule_notes, follow_up_project_contact_id
     from public.calendar_items
     where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)})
     order by title_snapshot`,
  );
}

async function verifySourceSelection(containerName, users) {
  const selector = await readCalendarTaskPresetSelectorWithClient({
    client: users.full.client,
    workspaceId: fixture.workspaceId,
    canViewTaskPresets: true,
  });
  assert(selector.ok, "Authorized task preset selector should succeed.");
  assert.deepEqual(selector.presets.map((preset) => preset.id), [fixture.taskPresetId]);
  assert.equal(selector.presets[0].name, `${fixture.namespace} Setup Crew`);
  assert.equal(selector.presets[0].customFields[0].id, "area");

  const noTasksSelector = await readCalendarTaskPresetSelectorWithClient({
    client: users.noTasks.client,
    workspaceId: fixture.workspaceId,
    canViewTaskPresets: false,
  });
  assert.equal(noTasksSelector.ok, false);
  assert.equal(noTasksSelector.reason, "missing_tasks_view");

  const presetCreate = await createCalendarItemWithClient(users.full.client, {
    workspaceId: fixture.workspaceId,
    source: { kind: "preset", taskPresetId: fixture.taskPresetId },
    schedule: { kind: "timed", date: "2026-08-11", startTime: "09:00", endTime: "10:30" },
    neededCount: 3,
    notes: "Bring labels.",
    customValues: {},
  });
  const presetItemId = presetCreate.calendarItemId;
  let row = readCalendarRows(containerName).find((item) => item.id === presetItemId);
  assert(row, "Preset-backed Calendar item should persist.");
  assert.equal(row.workspace_id, fixture.workspaceId);
  assert.equal(row.task_preset_id, fixture.taskPresetId);
  assert.equal(row.title_snapshot, `${fixture.namespace} Setup Crew`);
  assert.equal(row.task_type_snapshot, "general");
  assert.equal(row.follow_up_project_contact_id, fixture.contacts.full);

  const readModel = await readCalendarReadModelWithClient({
    client: users.full.client,
    workspaceId: fixture.workspaceId,
    actorContactId: fixture.contacts.full,
    workspaceTimezone: "America/Denver",
    rangeStart: "2026-08-10",
    rangeEnd: "2026-08-12",
    periodKind: "week",
    capabilities: ["calendar.view", "assignments.view"],
  });
  assert(readModel.ok, "Preset-backed item should be readable through the Calendar read model.");
  const readItem = readModel.items.find((item) => item.calendarItemId === presetItemId);
  assert(readItem, "Preset-backed read model item should be present.");
  assert.equal(readItem.taskPresetId, fixture.taskPresetId);
  assert.equal(readItem.taskSourceLabel, `${fixture.namespace} Setup Crew`);
  assert.equal(readItem.assignedFractionLabel, "0/3 assigned");

  await updateCalendarPresetTimedItemWithClient(users.full.client, {
    calendarItemId: presetItemId,
    schedule: { kind: "timed", date: "2026-08-12", startTime: "13:00", endTime: "15:00" },
    neededCount: 0,
    notes: "Updated setup window.",
    customValues: {},
  });
  row = readCalendarRows(containerName).find((item) => item.id === presetItemId);
  assert.equal(row.task_preset_id, fixture.taskPresetId);
  assert.equal(row.title_snapshot, `${fixture.namespace} Setup Crew`);
  assert.equal(row.start_date, "2026-08-12");
  assert.equal(row.start_time, "13:00:00");
  assert.equal(row.end_time, "15:00:00");
  assert.equal(row.needed_count, 0);
  assert.equal(row.schedule_notes, "Updated setup window.");
  assert.equal(row.follow_up_project_contact_id, fixture.contacts.full);

  await expectFailure("preset item one-off edit", () =>
    updateCalendarOneOffTimedItemWithClient(users.full.client, {
      calendarItemId: presetItemId,
      source: { title: "Forged One-Off", taskType: "custom" },
      schedule: { kind: "timed", date: "2026-08-12", startTime: "13:00", endTime: "15:00" },
      neededCount: 1,
      notes: null,
      customValues: {},
    }),
  );

  await expectFailure("fake preset id", () =>
    createCalendarItemWithClient(users.full.client, {
      workspaceId: fixture.workspaceId,
      source: { kind: "preset", taskPresetId: randomUUID() },
      schedule: { kind: "timed", date: "2026-08-13", startTime: "09:00", endTime: "10:00" },
      neededCount: 1,
      notes: null,
      customValues: {},
    }),
  );
  await expectFailure("other workspace preset id", () =>
    createCalendarItemWithClient(users.full.client, {
      workspaceId: fixture.workspaceId,
      source: { kind: "preset", taskPresetId: fixture.otherTaskPresetId },
      schedule: { kind: "timed", date: "2026-08-13", startTime: "09:00", endTime: "10:00" },
      neededCount: 1,
      notes: null,
      customValues: {},
    }),
  );
  await expectFailure("archived preset id", () =>
    createCalendarItemWithClient(users.full.client, {
      workspaceId: fixture.workspaceId,
      source: { kind: "preset", taskPresetId: fixture.archivedTaskPresetId },
      schedule: { kind: "timed", date: "2026-08-13", startTime: "09:00", endTime: "10:00" },
      neededCount: 1,
      notes: null,
      customValues: {},
    }),
  );

  const oneOffCreate = await createCalendarItemWithClient(users.noTasks.client, {
    workspaceId: fixture.workspaceId,
    source: { kind: "one_off", title: `${fixture.namespace} Custom`, taskType: "custom" },
    schedule: { kind: "timed", date: "2026-08-14", startTime: "10:00", endTime: "11:00" },
    neededCount: 0,
    notes: "Custom still works without tasks.view.",
    customValues: {},
  });
  const oneOffRow = readCalendarRows(containerName).find((item) => item.id === oneOffCreate.calendarItemId);
  assert.equal(oneOffRow.task_preset_id, null);
  assert.equal(oneOffRow.title_snapshot, `${fixture.namespace} Custom`);

  await expectFailure("view-only preset create", () =>
    createCalendarItemWithClient(users.viewOnly.client, {
      workspaceId: fixture.workspaceId,
      source: { kind: "preset", taskPresetId: fixture.taskPresetId },
      schedule: { kind: "timed", date: "2026-08-15", startTime: "09:00", endTime: "10:00" },
      neededCount: 1,
      notes: null,
      customValues: {},
    }),
  );
  await expectFailure("view-only preset edit", () =>
    updateCalendarPresetTimedItemWithClient(users.viewOnly.client, {
      calendarItemId: presetItemId,
      schedule: { kind: "timed", date: "2026-08-12", startTime: "09:00", endTime: "10:00" },
      neededCount: 1,
      notes: null,
      customValues: {},
    }),
  );
  await expectFailure("role/title mutation", () =>
    createCalendarItemWithClient(users.roleOnly.client, {
      workspaceId: fixture.workspaceId,
      source: { kind: "preset", taskPresetId: fixture.taskPresetId },
      schedule: { kind: "timed", date: "2026-08-15", startTime: "09:00", endTime: "10:00" },
      neededCount: 1,
      notes: null,
      customValues: {},
    }),
  );
  await expectFailure("wrong workspace edit", () =>
    updateCalendarPresetTimedItemWithClient(users.other.client, {
      calendarItemId: presetItemId,
      schedule: { kind: "timed", date: "2026-08-12", startTime: "09:00", endTime: "10:00" },
      neededCount: 1,
      notes: null,
      customValues: {},
    }),
  );

  await expectFailure("preset update source forge validation", () =>
    validateUpdateCalendarPresetTimedItemInput({
      calendarItemId: presetItemId,
      source: { kind: "one_off", title: "Forged", taskType: "custom" },
      schedule: { kind: "timed", date: "2026-08-12", startTime: "09:00", endTime: "10:00" },
      neededCount: 1,
      notes: null,
      customValues: {},
    }),
  );
  await expectFailure("mixed preset and one-off create validation", () =>
    validateCreateCalendarItemInput({
      workspaceId: fixture.workspaceId,
      source: {
        kind: "preset",
        taskPresetId: fixture.taskPresetId,
        title: "Forged",
      },
      schedule: { kind: "timed", date: "2026-08-12", startTime: "09:00", endTime: "10:00" },
      neededCount: 1,
      notes: null,
      customValues: {},
    }),
  );

  const directInsert = await users.full.client.from("calendar_items").insert({
    workspace_id: fixture.workspaceId,
    task_preset_id: fixture.taskPresetId,
    title_snapshot: "Direct Write",
    task_type_snapshot: "general",
    schedule_kind: "timed",
    start_date: "2026-08-15",
    start_time: "09:00",
    end_time: "10:00",
    timezone: "America/Denver",
    needed_count: 1,
    custom_values: {},
    lifecycle: "active",
  });
  assert(directInsert.error, "Direct authenticated calendar_items insert should remain denied.");
  const directUpdate = await users.full.client
    .from("calendar_items")
    .update({ title_snapshot: "Direct Update" })
    .eq("id", presetItemId);
  assert(directUpdate.error, "Direct authenticated calendar_items update should remain denied.");
  const directDelete = await users.full.client.from("calendar_items").delete().eq("id", presetItemId);
  assert(directDelete.error, "Direct authenticated calendar_items delete should remain denied.");
}

function cleanup(containerName) {
  const userIds = authUserIds.map(sqlUuid).join(", ");
  runPsql(
    containerName,
    `begin;
delete from public.assignment_responses where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)});
delete from public.calendar_assignments where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)});
delete from public.calendar_items where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)});
delete from public.task_presets where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)});
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
  (select count(*) from public.task_presets where name like ${sqlText(`${fixture.namespace}%`)}) +
  (select count(*) from public.calendar_items where title_snapshot like ${sqlText(`${fixture.namespace}%`)}) +
  (select count(*) from auth.users where email like ${sqlText(`${fixture.namespace}-%@example.invalid`)});`,
  );
  assert.equal(residue, "0", `Calendar source-selection cleanup left residue count ${residue}.`);
  cleanupCompleted = true;
}

async function main() {
  await verifyPreflight();
  const containerName = await resolveLocalDatabaseContainer();
  await applyCalendarSourceSelectionMigrationsIfNeeded(containerName);
  const users = {
    full: await createAuthenticatedUser("full"),
    noTasks: await createAuthenticatedUser("no-tasks"),
    viewOnly: await createAuthenticatedUser("view-only"),
    roleOnly: await createAuthenticatedUser("role-only"),
    other: await createAuthenticatedUser("other"),
  };

  try {
    insertFixtures(containerName, users);
    await verifySourceSelection(containerName, users);
  } finally {
    cleanup(containerName);
  }

  console.log(
    "Confirmed Calendar source selection: persisted task presets, one-off creation, preset-backed edit, authorization, direct-write denial, and zero-residue cleanup.",
  );
}

main().catch((error) => {
  console.error(redact(error));
  process.exitCode = 1;
}).finally(() => {
  if (!cleanupCompleted) {
    console.error("Calendar source-selection cleanup did not complete.");
  }
});
