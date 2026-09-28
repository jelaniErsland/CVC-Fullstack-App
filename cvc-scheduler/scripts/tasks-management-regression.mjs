import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { readCalendarReadModelWithClient } from "../lib/calendar/readModelQuery.server.ts";
import { readCalendarTaskPresetSelectorWithClient } from "../lib/calendar/taskPresetSelector.server.ts";
import { validateCreateCalendarItemInput } from "../lib/calendar/item.ts";
import {
  applyTaskPresetInstructionsWithClient,
  archiveTaskPresetWithClient,
  createTaskPresetWithClient,
  readFuturePresetInstructionCandidatesWithClient,
  readTaskPresetsWithClient,
  taskPresetDescriptionInputFromFormData,
  taskPresetCreateInputFromFormData,
  updateTaskPresetDescriptionWithClient,
  updateTaskPresetColorWithClient,
} from "../lib/tasks/server.ts";
import {
  TaskPresetValidationError,
  validateCreateTaskPresetInput,
} from "../lib/tasks/preset.ts";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const root = process.cwd();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const secrets = new Set();
const authUserIds = [];
let cleanupCompleted = false;

const fixture = {
  namespace: `qa-12-37-tasks-${randomUUID()}`,
  workspaceId: randomUUID(),
  otherWorkspaceId: randomUUID(),
  presets: {
    active: randomUUID(),
    archived: randomUUID(),
    system: randomUUID(),
    other: randomUUID(),
  },
  contacts: Object.fromEntries(
    ["editor", "viewOnly", "roleOnly", "revoked", "expired", "inactive", "other"].map(
      (label) => [label, randomUUID()],
    ),
  ),
  grants: Object.fromEntries(
    ["editor", "viewOnly", "roleOnly", "revoked", "expired", "inactive", "other"].map(
      (label) => [label, randomUUID()],
    ),
  ),
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
  return message
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted-jwt]")
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "postgres://[redacted]");
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
    throw new Error(redact(result.stderr || "The local Tasks fixture command failed."));
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
    "Local Supabase is unavailable. Start the disposable local stack before this validation.",
  );
  return containerName;
}

async function verifyPreflight() {
  assert(supabaseUrl && anonKey, "Local public Supabase environment values are missing.");
  assert(isLoopbackUrl(supabaseUrl), "Tasks management validation accepts only local Supabase.");
  secrets.add(anonKey);
  const health = await fetch(new URL("/auth/v1/health", supabaseUrl), {
    headers: { apikey: anonKey },
    redirect: "error",
  });
  assert(health.ok, "Local Supabase Auth is unavailable.");
}

async function verifyStaticRouteBoundary() {
  const [route, routeRead, component, server, packageSource] = await Promise.all([
    readFile(path.join(root, "app", "admin", "tasks", "page.tsx"), "utf8"),
    readFile(path.join(root, "lib", "tasks", "routeRead.server.ts"), "utf8"),
    readFile(path.join(root, "components", "TaskPresetManagement.tsx"), "utf8"),
    readFile(path.join(root, "lib", "tasks", "server.ts"), "utf8"),
    readFile(path.join(root, "package.json"), "utf8"),
  ]);

  assert.match(route, /export const dynamic = "force-dynamic"/);
  assert.match(route, /fetchCache = "force-no-store"/);
  assert.match(route, /readTaskManagementRouteState/);
  assert.match(route, /createTaskPresetWithClient/);
  assert.match(route, /archiveTaskPresetWithClient/);
  assert.doesNotMatch(`${route}\n${component}`, /lib\/mockData|mockTask|mockPreset/i);
  assert.match(routeRead, /TASKS_MANAGEMENT_MOCK_FALLBACK_ALLOWED = false/);
  assert.match(routeRead, /TASKS_MANAGEMENT_BROWSER_SCOPE_INPUT_TRUSTED = false/);
  assert.match(routeRead, /tasks\.view/);
  assert.match(routeRead, /tasks\.edit/);
  assert.doesNotMatch(
    `${route}\n${routeRead}\n${server}`,
    /SUPABASE_SERVICE_ROLE_KEY|createServiceRole/i,
  );
  assert.deepEqual(
    [...server.matchAll(/\.from\("([^"]+)"\)/g)].map((match) => match[1]),
    ["task_presets", "calendar_items"],
  );
  assert.match(packageSource, /"test:tasks-management"/);
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
  assert(!signup.error && signup.data.user, `Disposable Auth creation failed for ${label}.`);
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

function grantRow(label, workspaceId, capabilities, options = {}) {
  const status = options.status ?? "active";
  const validUntil = options.validUntil ? `${sqlText(options.validUntil)}::timestamptz` : "null";
  const revokedAt = options.revokedAt ? `${sqlText(options.revokedAt)}::timestamptz` : "null";
  return `(${sqlUuid(fixture.grants[label])}, ${sqlUuid(workspaceId)}, ${sqlUuid(
    fixture.contacts[label],
  )}, ${sqlText(options.role ?? "main_contact")}, ${sqlArray(capabilities)}, ${sqlText(
    status,
  )}, '2026-01-01T00:00:00Z'::timestamptz, ${validUntil}, ${revokedAt})`;
}

function insertFixtures(containerName, users) {
  runPsql(
    containerName,
    `insert into public.workspaces (
  id, workspace_key, display_name, lifecycle, timezone, starts_on, ends_on, public_intake_enabled
) values
  (${sqlUuid(fixture.workspaceId)}, ${sqlText(`${fixture.namespace}-target`)}, 'QA 12.37 Tasks Target', 'active', 'America/Denver', '2026-08-01', '2026-12-31', false),
  (${sqlUuid(fixture.otherWorkspaceId)}, ${sqlText(`${fixture.namespace}-other`)}, 'QA 12.37 Tasks Other', 'active', 'America/Denver', '2026-08-01', '2026-12-31', false);

insert into public.project_contacts (id, auth_user_id, status) values
  ${Object.keys(fixture.contacts)
    .map(
      (label) =>
        `(${sqlUuid(fixture.contacts[label])}, ${sqlUuid(users[label].userId)}, 'active')`,
    )
    .join(",\n  ")};

insert into public.workspace_contact_grants (
  id, workspace_id, project_contact_id, role, capabilities, status, valid_from, valid_until, revoked_at
) values
  ${grantRow("editor", fixture.workspaceId, [
    "workspace.read",
    "tasks.view",
    "tasks.edit",
    "calendar.view",
    "calendar.edit",
    "assignments.view",
  ])},
  ${grantRow("viewOnly", fixture.workspaceId, ["workspace.read", "tasks.view"], {
    role: "assistant_contact",
  })},
  ${grantRow("roleOnly", fixture.workspaceId, ["workspace.read"])},
  ${grantRow("revoked", fixture.workspaceId, ["workspace.read", "tasks.view", "tasks.edit"], {
    status: "revoked",
    revokedAt: "2026-08-01T00:00:00Z",
  })},
  ${grantRow("expired", fixture.workspaceId, ["workspace.read", "tasks.view", "tasks.edit"], {
    validUntil: "2026-08-01T00:00:00Z",
  })},
  ${grantRow("inactive", fixture.workspaceId, ["workspace.read", "tasks.view", "tasks.edit"], {
    status: "inactive",
  })},
  ${grantRow("other", fixture.otherWorkspaceId, ["workspace.read", "tasks.view", "tasks.edit"])};

insert into public.task_presets (
  id, workspace_id, name, description, task_type, default_needed_count, volunteer_visible,
  is_system_preset, system_key, custom_field_definitions, lifecycle
) values
  (${sqlUuid(fixture.presets.active)}, ${sqlUuid(fixture.workspaceId)}, ${sqlText(
    `${fixture.namespace} Gate Attendant`,
  )}, 'Welcome arriving volunteers.', 'general', 2, true, false, null, '[]'::jsonb, 'active'),
  (${sqlUuid(fixture.presets.archived)}, ${sqlUuid(fixture.workspaceId)}, ${sqlText(
    `${fixture.namespace} Archived Crew`,
  )}, null, 'custom', 1, false, false, null, '[]'::jsonb, 'archived'),
  (${sqlUuid(fixture.presets.system)}, ${sqlUuid(fixture.workspaceId)}, ${sqlText(
    `${fixture.namespace} Built-in`,
  )}, null, 'food', 4, true, true, 'qa_builtin', '[]'::jsonb, 'active'),
  (${sqlUuid(fixture.presets.other)}, ${sqlUuid(fixture.otherWorkspaceId)}, ${sqlText(
    `${fixture.namespace} Other Workspace`,
  )}, null, 'security', 1, true, false, null, '[]'::jsonb, 'active');`,
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

async function createCalendarItem(client, input) {
  const item = validateCreateCalendarItemInput(input);
  assert.equal(item.source.kind, "preset");
  assert.equal(item.schedule.kind, "timed");
  const { data, error } = await client.rpc("create_calendar_item", {
    p_workspace_id: item.workspaceId,
    p_task_preset_id: item.source.taskPresetId,
    p_one_off_title: null,
    p_one_off_task_type: null,
    p_schedule_kind: item.schedule.kind,
    p_start_date: item.schedule.date,
    p_end_date: null,
    p_start_time: item.schedule.startTime,
    p_end_time: item.schedule.endTime,
    p_needed_count: item.neededCount,
    p_schedule_notes: item.notes ?? null,
    p_custom_values: item.customValues,
  });
  if (error || typeof data !== "string") throw new Error("Calendar item could not be created.");
  return data;
}

async function updateCalendarPresetTimedItemWithClient(client, input) {
  const { data, error } = await client.rpc("update_calendar_item_preset_timed", {
    p_calendar_item_id: input.calendarItemId,
    p_start_date: input.schedule.date,
    p_start_time: input.schedule.startTime,
    p_end_time: input.schedule.endTime,
    p_needed_count: input.neededCount,
    p_schedule_notes: input.notes,
    p_custom_values: input.customValues,
    p_expected_updated_at: input.expectedUpdatedAt,
  });
  if (error || data !== input.calendarItemId) throw new Error("Authorized occurrence edit failed.", { cause: error });
}

async function verifyInstructionLifecycle(containerName, users, presetId) {
  const workspaceId = fixture.workspaceId;
  const textBefore = "Keep incoming materials organized.";
  const textAfter = "Report to the materials lead.\n\nBring work gloves and check in at the east gate.";
  const schedule = (date) => ({ kind: "timed", date, startTime: "09:00", endTime: "11:00" });
  const create = (date, notes = null) => createCalendarItem(users.editor.client, {
    workspaceId, source: { kind: "preset", taskPresetId: presetId }, schedule: schedule(date),
    neededCount: 3, notes, customValues: {},
  });
  const row = (id) => queryJson(containerName,
    `select id, schedule_notes, instruction_source, instruction_preset_updated_at, updated_at, publication_state
     from public.calendar_items where id = ${sqlUuid(id)}`)[0];

  const oldItem = await create("2026-08-18");
  const futureA = await create("2026-11-17");
  const futureB = await create("2026-11-18");
  const futureC = await create("2026-11-21");
  const exception = await create("2026-11-19", "Meet at the west gate for this date only.");
  assert.equal(row(oldItem).schedule_notes, textBefore);
  assert.equal(row(futureA).instruction_source, "preset");
  assert.equal(row(exception).instruction_source, "manual");
  runPsql(containerName, `update public.calendar_items set publication_state = 'published', published_at = now(),
    published_by_project_contact_id = ${sqlUuid(fixture.contacts.editor)}
    where id in (${sqlUuid(oldItem)}, ${sqlUuid(futureA)});`);

  const preset = (await readTaskPresetsWithClient(users.editor.client, workspaceId)).find((item) => item.id === presetId);
  assert(preset?.assignmentDetailsApprovedAt, "New task instructions must be approved for copying.");
  const editForm = new FormData();
  editForm.set("presetId", presetId);
  editForm.set("expectedUpdatedAt", preset.updatedAt);
  editForm.set("description", textAfter);
  const editInput = taskPresetDescriptionInputFromFormData(editForm);
  for (const label of ["viewOnly", "roleOnly", "revoked", "expired", "inactive", "other"]) {
    const denied = await users[label].client.rpc("update_task_preset_description", {
      p_preset_id: presetId, p_description: textAfter, p_expected_updated_at: preset.updatedAt,
    });
    assert.equal(denied.error?.code, "42501", `${label}: instruction edit must fail at the authorized boundary.`);
  }
  const anonClient = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const anonymousEdit = await anonClient.rpc("update_task_preset_description", {
    p_preset_id: presetId, p_description: textAfter, p_expected_updated_at: preset.updatedAt,
  });
  assert(anonymousEdit.error, "Anonymous preset edits must remain denied at the database boundary.");
  await updateTaskPresetDescriptionWithClient(users.editor.client, editInput);
  await expectFailure("stale preset instructions edit", () => updateTaskPresetDescriptionWithClient(users.editor.client, editInput));
  const stalePreset = await users.editor.client.rpc("update_task_preset_description", {
    p_preset_id: presetId, p_description: "Stale replacement", p_expected_updated_at: preset.updatedAt,
  });
  assert.equal(stalePreset.error?.code, "40001");
  assert.equal(stalePreset.error?.details, "task_preset_edit_conflict");
  assert.equal(row(oldItem).schedule_notes, textBefore, "Past published wording must not change with preset edits.");
  assert.equal(row(futureA).schedule_notes, textBefore, "Published future wording must not silently change.");
  assert.equal(row(exception).schedule_notes, "Meet at the west gate for this date only.");

  const newItem = await create("2026-11-20");
  assert.equal(row(newItem).schedule_notes, textAfter, "New items should snapshot the approved preset text.");
  const currentPreset = (await readTaskPresetsWithClient(users.editor.client, workspaceId)).find((item) => item.id === presetId);
  const preview = await readFuturePresetInstructionCandidatesWithClient(
    users.editor.client, workspaceId, presetId, textAfter, fixture.contacts.editor, "2026-09-27",
  );
  assert.deepEqual(new Set(preview.map((item) => item.id)), new Set([futureA, futureB, futureC]));

  const beforeExceptionEdit = row(futureB);
  await updateCalendarPresetTimedItemWithClient(users.editor.client, {
    calendarItemId: futureB, expectedUpdatedAt: beforeExceptionEdit.updated_at,
    schedule: schedule("2026-11-18"), neededCount: 3,
    notes: "Use the temporary loading entrance on this date.", customValues: {},
  });
  assert.equal(row(futureB).instruction_source, "manual", "Occurrence edit must become an exception.");
  const currentPreview = await readFuturePresetInstructionCandidatesWithClient(
    users.editor.client, workspaceId, presetId, textAfter, fixture.contacts.editor, "2026-09-27",
  );
  assert.deepEqual(new Set(currentPreview.map((item) => item.id)), new Set([futureA, futureC]));
  const selected = [{ id: futureA, updated_at: currentPreview[0].updatedAt }];
  const applyInput = { presetId, expectedUpdatedAt: currentPreset.updatedAt, targets: selected };
  for (const label of ["viewOnly", "roleOnly", "revoked", "expired", "inactive", "other"]) {
    const denied = await users[label].client.rpc("apply_task_preset_instructions", {
      p_preset_id: presetId, p_expected_preset_updated_at: currentPreset.updatedAt, p_targets: selected,
    });
    assert.equal(denied.error?.code, "42501", `${label}: future apply must fail closed.`);
  }
  const anonymousApply = await anonClient.rpc("apply_task_preset_instructions", {
    p_preset_id: presetId, p_expected_preset_updated_at: currentPreset.updatedAt,
    p_targets: selected,
  });
  assert(anonymousApply.error, "Anonymous future-occurrence updates must remain denied.");
  await updateCalendarPresetTimedItemWithClient(users.editor.client, {
    calendarItemId: futureA, expectedUpdatedAt: selected[0].updated_at,
    schedule: { kind: "timed", date: "2026-11-17", startTime: "10:00", endTime: "12:00" },
    neededCount: 3, notes: textBefore, customValues: {},
  });
  await expectFailure("stale selected occurrence", () => applyTaskPresetInstructionsWithClient(users.editor.client, applyInput));
  const beforeC = row(futureC);
  const atomicConflict = await users.editor.client.rpc("apply_task_preset_instructions", {
    p_preset_id: presetId, p_expected_preset_updated_at: currentPreset.updatedAt,
    p_targets: [{ id: futureC, updated_at: beforeC.updated_at }, ...selected],
  });
  assert.equal(atomicConflict.error?.code, "40001");
  assert.equal(atomicConflict.error?.details, "calendar_item_edit_conflict");
  assert.deepEqual(row(futureC), beforeC, "A later stale target must roll back every earlier update in the same request.");
  for (const id of [oldItem, exception, fixture.presets.other]) {
    const denied = await users.editor.client.rpc("apply_task_preset_instructions", {
      p_preset_id: presetId, p_expected_preset_updated_at: currentPreset.updatedAt,
      p_targets: [{ id, updated_at: row(futureA).updated_at }],
    });
    assert.equal(denied.error?.code, "42501", "Past, exception and foreign targets must remain unavailable.");
  }
  const fresh = row(futureA);
  await applyTaskPresetInstructionsWithClient(users.editor.client, {
    presetId, expectedUpdatedAt: currentPreset.updatedAt,
    targets: [{ id: futureA, updated_at: fresh.updated_at }],
  });
  assert.equal(row(futureA).schedule_notes, textAfter);
  assert.equal(row(futureA).instruction_source, "preset");
  assert.equal(row(futureB).schedule_notes, "Use the temporary loading entrance on this date.");
  assert.deepEqual(row(futureC), beforeC, "An unselected future item must retain its published snapshot.");
  const history = queryJson(containerName,
    `select previous_text, new_text, item_was_published from public.assignment_instruction_revisions
     where calendar_item_id = ${sqlUuid(futureA)} order by id`);
  assert(history.some((revision) => revision.previous_text === textBefore &&
    revision.new_text === textAfter && revision.item_was_published === true));

  const deliveries = queryJson(containerName,
    `select id from public.assignment_notification_deliveries where workspace_id = ${sqlUuid(workspaceId)}`);
  assert.deepEqual(deliveries, [], "Instruction edits and previews must not create notification deliveries.");

  const repeat = await users.editor.client.rpc("create_current_workspace_repeated_calendar_items", {
    p_request_key: randomUUID(), p_task_preset_id: presetId,
    p_one_off_title: null, p_one_off_task_type: null,
    p_start_date: "2026-11-01", p_end_date: "2026-11-30", p_weekdays: [0,1,2,3,4,5,6],
    p_start_time: "13:00", p_end_time: "15:00", p_needed_count: 3,
    p_schedule_notes: null, p_custom_values: {}, p_meal_kind: null, p_meal_provider: null,
    p_meal_contact: null, p_meal_menu: null, p_meal_total: null,
  });
  assert(!repeat.error && repeat.data?.length === 30, "Busy-month repeat creation should produce 30 independent snapshots.");
  const busyRows = queryJson(containerName,
    `select instruction_source, schedule_notes, count(*)::integer as count from public.calendar_items
     where id = any(${sqlArray(repeat.data).replace("::text[]", "::uuid[]")}) group by instruction_source, schedule_notes`);
  assert.deepEqual(busyRows, [{ instruction_source: "preset", schedule_notes: textAfter, count: 30 }]);
  const busyStart = performance.now();
  const monthModel = await readCalendarReadModelWithClient({
    client: users.editor.client, workspaceId, actorContactId: fixture.contacts.editor,
    workspaceTimezone: "America/Denver", rangeStart: "2026-11-01", rangeEnd: "2026-11-30",
    periodKind: "month", capabilities: ["calendar.view", "assignments.view"],
  });
  const busyMs = Math.round(performance.now() - busyStart);
  assert(monthModel.ok && monthModel.items.length >= 30);
  assert(busyMs < 10_000, `Busy-month authorized Calendar read took ${busyMs}ms locally.`);
  console.log(`Instruction lifecycle and busy-month read passed (${busyMs}ms local month read).`);
}

async function verifyPersistedBoundary(containerName, users) {
  const initial = await readTaskPresetsWithClient(users.editor.client, fixture.workspaceId);
  assert.deepEqual(
    initial.map((preset) => preset.id),
    [fixture.presets.system, fixture.presets.active, fixture.presets.archived],
  );
  assert(initial.every((preset) => preset.workspaceId === fixture.workspaceId));
  assert.deepEqual(await readTaskPresetsWithClient(users.editor.client, fixture.otherWorkspaceId), []);
  assert.equal(
    (await readTaskPresetsWithClient(users.viewOnly.client, fixture.workspaceId)).length,
    3,
  );
  for (const label of ["roleOnly", "revoked", "expired", "inactive"]) {
    assert.deepEqual(
      await readTaskPresetsWithClient(users[label].client, fixture.workspaceId),
      [],
      `${label} read should fail closed through RLS.`,
    );
  }

  const formData = new FormData();
  formData.set("name", `${fixture.namespace} Material Staging`);
  formData.set("description", "Keep incoming materials organized.");
  formData.set("taskType", "general");
  formData.set("defaultNeededCount", "3");
  formData.set("volunteerVisible", "true");
  formData.set("colorKey", "cyan");
  const formInput = taskPresetCreateInputFromFormData(formData, fixture.workspaceId);
  assert.equal(formInput.workspaceId, fixture.workspaceId);
  assert.deepEqual(formInput.customFields, []);
  assert.equal(formInput.colorKey, "cyan");

  const created = await createTaskPresetWithClient(users.editor.client, formInput);
  const reloaded = await readTaskPresetsWithClient(users.editor.client, fixture.workspaceId);
  const createdPreset = reloaded.find((preset) => preset.id === created.presetId);
  assert(createdPreset, "Created reusable task should persist and reload.");
  assert.equal(createdPreset.name, `${fixture.namespace} Material Staging`);
  assert.equal(createdPreset.isSystemPreset, false);
  assert.equal(createdPreset.systemKey, null);
  assert.equal(createdPreset.colorKey, "cyan");

  const recolored = await updateTaskPresetColorWithClient(users.editor.client, { presetId: created.presetId, colorKey: "violet", expectedUpdatedAt: createdPreset.updatedAt });
  assert.equal(recolored.presetId, created.presetId);
  assert.equal((await readTaskPresetsWithClient(users.editor.client, fixture.workspaceId)).find((preset) => preset.id === created.presetId)?.colorKey, "violet");
  await expectFailure("invalid task color", () => updateTaskPresetColorWithClient(users.editor.client, { presetId: created.presetId, colorKey: "invalid", expectedUpdatedAt: createdPreset.updatedAt }));

  await expectFailure("view-only create", () =>
    createTaskPresetWithClient(users.viewOnly.client, formInput),
  );
  await expectFailure("role-title create", () =>
    createTaskPresetWithClient(users.roleOnly.client, formInput),
  );
  await expectFailure("revoked create", () =>
    createTaskPresetWithClient(users.revoked.client, formInput),
  );
  await expectFailure("expired create", () =>
    createTaskPresetWithClient(users.expired.client, formInput),
  );
  await expectFailure("inactive create", () =>
    createTaskPresetWithClient(users.inactive.client, formInput),
  );
  await expectFailure("cross-workspace create", () =>
    createTaskPresetWithClient(users.other.client, formInput),
  );

  assert.throws(
    () => validateCreateTaskPresetInput({ ...formInput, isSystemPreset: true, systemKey: "forged" }),
    TaskPresetValidationError,
  );
  assert.throws(
    () => validateCreateTaskPresetInput({ ...formInput, date: "2026-08-17" }),
    TaskPresetValidationError,
  );
  const schedulingForm = new FormData();
  for (const [key, value] of formData.entries()) schedulingForm.append(key, value);
  schedulingForm.set("startTime", "09:00");
  assert.throws(
    () => taskPresetCreateInputFromFormData(schedulingForm, fixture.workspaceId),
    TaskPresetValidationError,
  );

  const selectorBeforeArchive = await readCalendarTaskPresetSelectorWithClient({
    client: users.editor.client,
    workspaceId: fixture.workspaceId,
    canViewTaskPresets: true,
  });
  assert(selectorBeforeArchive.ok);
  assert(selectorBeforeArchive.presets.some((preset) => preset.id === created.presetId));

  const calendarItemId = await createCalendarItem(users.editor.client, {
    workspaceId: fixture.workspaceId,
    source: { kind: "preset", taskPresetId: created.presetId },
    schedule: { kind: "timed", date: "2026-08-17", startTime: "09:00", endTime: "11:00" },
    neededCount: 3,
    notes: "Persisted Tasks integration proof.",
    customValues: {},
  });

  await verifyInstructionLifecycle(containerName, users, created.presetId);

  await expectFailure("view-only archive", () =>
    archiveTaskPresetWithClient(users.viewOnly.client, created.presetId),
  );
  await expectFailure("wrong-workspace archive", () =>
    archiveTaskPresetWithClient(users.other.client, created.presetId),
  );
  await expectFailure("system preset archive", () =>
    archiveTaskPresetWithClient(users.editor.client, fixture.presets.system),
  );
  await archiveTaskPresetWithClient(users.editor.client, created.presetId);

  const archivedReload = await readTaskPresetsWithClient(users.editor.client, fixture.workspaceId);
  assert.equal(
    archivedReload.find((preset) => preset.id === created.presetId)?.lifecycle,
    "archived",
  );
  const selectorAfterArchive = await readCalendarTaskPresetSelectorWithClient({
    client: users.editor.client,
    workspaceId: fixture.workspaceId,
    canViewTaskPresets: true,
  });
  assert(selectorAfterArchive.ok);
  assert.equal(selectorAfterArchive.presets.some((preset) => preset.id === created.presetId), false);

  const readModel = await readCalendarReadModelWithClient({
    client: users.editor.client,
    workspaceId: fixture.workspaceId,
    actorContactId: fixture.contacts.editor,
    workspaceTimezone: "America/Denver",
    rangeStart: "2026-08-17",
    rangeEnd: "2026-08-18",
    periodKind: "day",
    capabilities: ["calendar.view", "assignments.view"],
  });
  assert(readModel.ok, "Calendar read model should remain available after preset archive.");
  const existingOccurrence = readModel.items.find((item) => item.calendarItemId === calendarItemId);
  assert(existingOccurrence, "Existing Calendar occurrence must survive task archive.");
  assert.equal(existingOccurrence.taskPresetId, created.presetId);
  assert.equal(existingOccurrence.taskSourceLabel, `${fixture.namespace} Material Staging`);

  const directInsert = await users.editor.client.from("task_presets").insert({
    workspace_id: fixture.workspaceId,
    name: `${fixture.namespace} Direct Insert`,
    task_type: "general",
    default_needed_count: 1,
    volunteer_visible: true,
    custom_field_definitions: [],
  });
  assert(directInsert.error, "Direct authenticated task_presets insert must remain denied.");
  const directUpdate = await users.editor.client
    .from("task_presets")
    .update({ name: `${fixture.namespace} Direct Update` })
    .eq("id", fixture.presets.active);
  assert(directUpdate.error, "Direct authenticated task_presets update must remain denied.");
  const directDelete = await users.editor.client
    .from("task_presets")
    .delete()
    .eq("id", fixture.presets.active);
  assert(directDelete.error, "Direct authenticated task_presets delete must remain denied.");

  const calendarRows = queryJson(
    containerName,
    `select id, task_preset_id, title_snapshot from public.calendar_items where id = ${sqlUuid(
      calendarItemId,
    )}`,
  );
  assert.deepEqual(calendarRows, [
    {
      id: calendarItemId,
      task_preset_id: created.presetId,
      title_snapshot: `${fixture.namespace} Material Staging`,
    },
  ]);
}

function cleanup(containerName) {
  const userIds = authUserIds.map(sqlUuid).join(", ");
  runPsql(
    containerName,
    `begin;
delete from public.assignment_responses where workspace_id in (${sqlUuid(
      fixture.workspaceId,
    )}, ${sqlUuid(fixture.otherWorkspaceId)});
delete from public.calendar_assignments where workspace_id in (${sqlUuid(
      fixture.workspaceId,
    )}, ${sqlUuid(fixture.otherWorkspaceId)});
delete from public.calendar_repeat_creation_requests where workspace_id in (${sqlUuid(
      fixture.workspaceId,
    )}, ${sqlUuid(fixture.otherWorkspaceId)});
delete from public.calendar_items where workspace_id in (${sqlUuid(
      fixture.workspaceId,
    )}, ${sqlUuid(fixture.otherWorkspaceId)});
delete from public.task_presets where workspace_id in (${sqlUuid(
      fixture.workspaceId,
    )}, ${sqlUuid(fixture.otherWorkspaceId)});
delete from public.workspace_contact_grants where workspace_id in (${sqlUuid(
      fixture.workspaceId,
    )}, ${sqlUuid(fixture.otherWorkspaceId)});
delete from public.project_contacts where id in (${Object.values(fixture.contacts)
      .map(sqlUuid)
      .join(", ")});
delete from public.workspaces where id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(
      fixture.otherWorkspaceId,
    )});
${userIds ? `delete from auth.users where id in (${userIds});` : ""}
commit;`,
  );
  const residue = runPsql(
    containerName,
    `select
  (select count(*) from public.workspaces where workspace_key like ${sqlText(
    `${fixture.namespace}%`,
  )}) +
  (select count(*) from public.task_presets where name like ${sqlText(`${fixture.namespace}%`)}) +
  (select count(*) from public.calendar_items where title_snapshot like ${sqlText(
    `${fixture.namespace}%`,
  )}) +
  (select count(*) from auth.users where email like ${sqlText(
    `${fixture.namespace}-%@example.invalid`,
  )});`,
  );
  assert.equal(residue, "0", `Tasks management cleanup left residue count ${residue}.`);
  cleanupCompleted = true;
}

let containerName;
try {
  await verifyPreflight();
  await verifyStaticRouteBoundary();
  containerName = await resolveLocalDatabaseContainer();
  const labels = Object.keys(fixture.contacts);
  const createdUsers = await Promise.all(labels.map((label) => createAuthenticatedUser(label)));
  const users = Object.fromEntries(labels.map((label, index) => [label, createdUsers[index]]));
  insertFixtures(containerName, users);
  await verifyPersistedBoundary(containerName, users);
  console.log("Tasks management local persistence validation passed.");
  console.log(
    "Confirmed scoped persisted read/create/archive, Calendar compatibility, grant denials, direct-write denial, and zero mock fallback.",
  );
} catch (error) {
  console.error(redact(error));
  process.exitCode = 1;
} finally {
  if (containerName) {
    try {
      cleanup(containerName);
    } catch (cleanupError) {
      console.error(redact(cleanupError));
      process.exitCode = 1;
    }
  }
  if (!cleanupCompleted) process.exitCode = 1;
}
