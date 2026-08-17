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
  archiveTaskPresetWithClient,
  createTaskPresetWithClient,
  readTaskPresetsWithClient,
  taskPresetCreateInputFromFormData,
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
    ["task_presets"],
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
  const formInput = taskPresetCreateInputFromFormData(formData, fixture.workspaceId);
  assert.equal(formInput.workspaceId, fixture.workspaceId);
  assert.deepEqual(formInput.customFields, []);

  const created = await createTaskPresetWithClient(users.editor.client, formInput);
  const reloaded = await readTaskPresetsWithClient(users.editor.client, fixture.workspaceId);
  const createdPreset = reloaded.find((preset) => preset.id === created.presetId);
  assert(createdPreset, "Created reusable task should persist and reload.");
  assert.equal(createdPreset.name, `${fixture.namespace} Material Staging`);
  assert.equal(createdPreset.isSystemPreset, false);
  assert.equal(createdPreset.systemKey, null);

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
