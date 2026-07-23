import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { readCalendarReadModelWithClient } from "../lib/calendar/readModelQuery.server.ts";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const root = process.cwd();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const secrets = new Set();

const fixture = {
  namespace: `qa-12-19-calendar-publication-${randomUUID()}`,
  workspaceId: randomUUID(),
  otherWorkspaceId: randomUUID(),
  contacts: {
    owner: randomUUID(),
    editor: randomUUID(),
    readOnly: randomUUID(),
    roleOnly: randomUUID(),
    revoked: randomUUID(),
    expired: randomUUID(),
    inactive: randomUUID(),
    other: randomUUID(),
  },
  grants: {
    owner: randomUUID(),
    editor: randomUUID(),
    readOnly: randomUUID(),
    roleOnly: randomUUID(),
    revoked: randomUUID(),
    expired: randomUUID(),
    inactive: randomUUID(),
    other: randomUUID(),
  },
  volunteers: {
    ready: randomUUID(),
    readyB: randomUUID(),
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
    throw new Error(`Local Calendar publication fixture command failed: ${redact(result.stderr).slice(0, 800)}`);
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
  assert(isLoopbackUrl(supabaseUrl), "Calendar publication validation accepts only local Supabase.");
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

async function applyCalendarPublicationMigrationsIfNeeded(containerName) {
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
  if (!signup.data.session) {
    const signin = await client.auth.signInWithPassword({ email, password });
    assert(!signin.error && signin.data.session, `Disposable Auth sign-in failed for ${label}.`);
    secrets.add(signin.data.session.access_token);
    secrets.add(signin.data.session.refresh_token);
  } else {
    secrets.add(signup.data.session.access_token);
    secrets.add(signup.data.session.refresh_token);
  }
  authUserIds.push(signup.data.user.id);
  return { client, userId: signup.data.user.id };
}

function grantRow(label, workspaceId, role, capabilities, status = "active", extra = "") {
  const revoked = extra === "revoked" ? "clock_timestamp()" : "null";
  const validUntil = extra === "expired" ? "clock_timestamp() - interval '1 hour'" : "null";
  return `(${sqlUuid(fixture.grants[label])}, ${sqlUuid(workspaceId)}, ${sqlUuid(fixture.contacts[label])}, ${sqlText(role)}, ${sqlArray(capabilities)}, ${sqlText(status)}, clock_timestamp() - interval '1 day', ${validUntil}, ${revoked})`;
}

function volunteerRow(id, workspaceId, fullName, contactId) {
  return `(${sqlUuid(id)}, ${sqlUuid(workspaceId)}, null, 'manual', ${sqlUuid(contactId)}, clock_timestamp(), 'active', 'ready', ${sqlText(fullName)}, ${sqlText(`${fullName.replaceAll(" ", ".").toLowerCase()}@example.invalid`)}, null, 'Bozeman QA', null, '{}'::jsonb, '{}'::jsonb, '')`;
}

function insertFixtures(containerName, users) {
  runPsql(
    containerName,
    `insert into public.workspaces (id, workspace_key, display_name, lifecycle, timezone, starts_on, ends_on, public_intake_enabled)
values
  (${sqlUuid(fixture.workspaceId)}, ${sqlText(`${fixture.namespace}-target`)}, 'QA 12.19 Calendar Target', 'active', 'America/Denver', '2026-08-01'::date, '2026-12-31'::date, false),
  (${sqlUuid(fixture.otherWorkspaceId)}, ${sqlText(`${fixture.namespace}-other`)}, 'QA 12.19 Calendar Other', 'active', 'America/Denver', '2026-08-01'::date, '2026-12-31'::date, false);

insert into public.project_contacts (id, auth_user_id, status)
values
  (${sqlUuid(fixture.contacts.owner)}, ${sqlUuid(users.owner.userId)}, 'active'),
  (${sqlUuid(fixture.contacts.editor)}, ${sqlUuid(users.editor.userId)}, 'active'),
  (${sqlUuid(fixture.contacts.readOnly)}, ${sqlUuid(users.readOnly.userId)}, 'active'),
  (${sqlUuid(fixture.contacts.roleOnly)}, ${sqlUuid(users.roleOnly.userId)}, 'active'),
  (${sqlUuid(fixture.contacts.revoked)}, ${sqlUuid(users.revoked.userId)}, 'active'),
  (${sqlUuid(fixture.contacts.expired)}, ${sqlUuid(users.expired.userId)}, 'active'),
  (${sqlUuid(fixture.contacts.inactive)}, ${sqlUuid(users.inactive.userId)}, 'active'),
  (${sqlUuid(fixture.contacts.other)}, ${sqlUuid(users.other.userId)}, 'active');

insert into public.workspace_contact_grants (id, workspace_id, project_contact_id, role, capabilities, status, valid_from, valid_until, revoked_at)
values
  ${grantRow("owner", fixture.workspaceId, "main_contact", ["workspace.read", "calendar.view", "assignments.view", "calendar.edit", "assignments.edit", "volunteers.view"])},
  ${grantRow("editor", fixture.workspaceId, "assistant_contact", ["workspace.read", "calendar.view", "assignments.view", "calendar.edit", "assignments.edit", "volunteers.view"])},
  ${grantRow("readOnly", fixture.workspaceId, "assistant_contact", ["workspace.read", "calendar.view", "assignments.view", "volunteers.view"])},
  ${grantRow("roleOnly", fixture.workspaceId, "main_contact", ["workspace.read"])},
  ${grantRow("revoked", fixture.workspaceId, "main_contact", ["workspace.read", "calendar.view", "assignments.view", "calendar.edit", "assignments.edit", "volunteers.view"], "revoked", "revoked")},
  ${grantRow("expired", fixture.workspaceId, "main_contact", ["workspace.read", "calendar.view", "assignments.view", "calendar.edit", "assignments.edit", "volunteers.view"], "active", "expired")},
  ${grantRow("inactive", fixture.workspaceId, "main_contact", ["workspace.read", "calendar.view", "assignments.view", "calendar.edit", "assignments.edit", "volunteers.view"], "inactive")},
  ${grantRow("other", fixture.otherWorkspaceId, "main_contact", ["workspace.read", "calendar.view", "assignments.view", "calendar.edit", "assignments.edit", "volunteers.view"])};

insert into public.volunteer_profiles (
  id, workspace_id, source_submission_id, profile_source, manual_created_by_project_contact_id,
  manual_created_at, lifecycle, readiness_status, full_name, email, phone, congregation,
  preferred_contact_method, availability_snapshot, skills_help_snapshot, profile_notes
) values
  ${volunteerRow(fixture.volunteers.ready, fixture.workspaceId, `${fixture.namespace} Ready`, fixture.contacts.owner)},
  ${volunteerRow(fixture.volunteers.readyB, fixture.workspaceId, `${fixture.namespace} Ready B`, fixture.contacts.owner)},
  ${volunteerRow(fixture.volunteers.other, fixture.otherWorkspaceId, `${fixture.namespace} Other`, fixture.contacts.other)};`,
  );
}

async function expectFailure(label, operation) {
  let failed = false;
  try {
    await operation();
  } catch {
    failed = true;
  }
  assert(failed, `${label} must fail closed.`);
}

async function createTimedItem(client, title) {
  const { data, error } = await client.rpc("create_calendar_item", {
    p_workspace_id: fixture.workspaceId,
    p_task_preset_id: null,
    p_one_off_title: title,
    p_one_off_task_type: "general",
    p_schedule_kind: "timed",
    p_start_date: "2026-08-12",
    p_end_date: null,
    p_start_time: "09:00",
    p_end_time: "10:00",
    p_needed_count: 1,
    p_schedule_notes: "draft note",
    p_custom_values: {},
  });
  assert(!error && typeof data === "string", "Authorized Calendar draft creation must succeed.");
  return data;
}

async function updateTimedItem(
  client,
  calendarItemId,
  title = `${fixture.namespace} Edited`,
  neededCount = 1,
) {
  const { data, error } = await client.rpc("update_calendar_item_one_off_timed", {
    p_calendar_item_id: calendarItemId,
    p_one_off_title: title,
    p_one_off_task_type: "general",
    p_start_date: "2026-08-13",
    p_start_time: "10:00",
    p_end_time: "11:00",
    p_needed_count: neededCount,
    p_schedule_notes: "edited note",
    p_custom_values: {},
  });
  assert(!error && data === calendarItemId, "Authorized Calendar edit must succeed.");
}

async function publishItem(client, calendarItemId) {
  const { data, error } = await client.rpc("publish_calendar_item", {
    p_calendar_item_id: calendarItemId,
  });
  assert(!error && data === calendarItemId, "Authorized Calendar publish must succeed.");
}

async function createAssignment(client, calendarItemId) {
  const { data, error } = await client.rpc("create_calendar_assignments_batch", {
    p_calendar_item_id: calendarItemId,
    p_volunteer_profile_ids: [fixture.volunteers.ready],
    p_assignment_note: "assignment prep",
  });
  assert(!error && Array.isArray(data) && data.length === 1, "Authorized assignment preparation must succeed.");
  return data[0];
}

async function readModel(client, actorContactId) {
  return readCalendarReadModelWithClient({
    client,
    workspaceId: fixture.workspaceId,
    actorContactId,
    workspaceTimezone: "America/Denver",
    rangeStart: "2026-08-01",
    rangeEnd: "2026-08-31",
    periodKind: "month",
    capabilities: ["calendar.view", "assignments.view"],
  });
}

async function assertReadModelContains(client, actorContactId, calendarItemId, expectedPublicationState) {
  const model = await readModel(client, actorContactId);
  assert.equal(model.ok, true, "Calendar read model should be available.");
  const item = model.items.find((candidate) => candidate.calendarItemId === calendarItemId);
  assert(item, "Expected Calendar item to be visible in read model.");
  assert.equal(item.publicationState, expectedPublicationState);
  return item;
}

async function assertReadModelOmits(client, actorContactId, calendarItemId) {
  const model = await readModel(client, actorContactId);
  assert.equal(model.ok, true, "Calendar read model should be available.");
  assert.equal(
    model.items.some((candidate) => candidate.calendarItemId === calendarItemId),
    false,
    "Private draft must not appear to this actor.",
  );
}

async function verifyPublication(containerName, users) {
  const calendarItemId = await createTimedItem(
    users.owner.client,
    `${fixture.namespace} Draft`,
  );
  const createdRows = queryJson(
    containerName,
    `select publication_state, created_by_project_contact_id, follow_up_project_contact_id, published_at, published_by_project_contact_id
from public.calendar_items
where id = ${sqlUuid(calendarItemId)}`,
  );
  assert.equal(createdRows.length, 1);
  assert.equal(createdRows[0].publication_state, "draft");
  assert.equal(createdRows[0].created_by_project_contact_id, fixture.contacts.owner);
  assert.equal(createdRows[0].follow_up_project_contact_id, fixture.contacts.owner);
  assert.equal(createdRows[0].published_at, null);
  assert.equal(createdRows[0].published_by_project_contact_id, null);

  await assertReadModelContains(users.owner.client, fixture.contacts.owner, calendarItemId, "draft");
  await assertReadModelOmits(users.editor.client, fixture.contacts.editor, calendarItemId);
  await assertReadModelOmits(users.readOnly.client, fixture.contacts.readOnly, calendarItemId);

  await updateTimedItem(users.owner.client, calendarItemId);
  await expectFailure("same-workspace non-owner draft edit", () =>
    updateTimedItem(users.editor.client, calendarItemId, `${fixture.namespace} Leaked Edit`),
  );
  await expectFailure("view-only draft edit", () =>
    updateTimedItem(users.readOnly.client, calendarItemId, `${fixture.namespace} View Edit`),
  );

  const assignmentId = await createAssignment(users.owner.client, calendarItemId);
  await expectFailure("same-workspace non-owner draft assignment", () =>
    users.editor.client.rpc("create_calendar_assignments_batch", {
      p_calendar_item_id: calendarItemId,
      p_volunteer_profile_ids: [fixture.volunteers.readyB],
      p_assignment_note: "draft non-owner blocked",
    }).then(({ error }) => {
      if (error) throw error;
    }),
  );

  await expectFailure("draft response token issuance", () =>
    users.owner.client.rpc("issue_assignment_response_token", {
      p_assignment_id: assignmentId,
      p_ttl_hours: 1,
      p_internal_note: "draft blocked",
    }).then(({ error }) => {
      if (error) throw error;
    }),
  );

  const ownerDetail = await users.owner.client.rpc("read_assignment_detail_context", {
    p_assignment_id: assignmentId,
  });
  assert(!ownerDetail.error && ownerDetail.data?.length === 1, "Draft assignment detail should remain available to the draft owner.");
  const editorDetail = await users.editor.client.rpc("read_assignment_detail_context", {
    p_assignment_id: assignmentId,
  });
  assert(!editorDetail.error && editorDetail.data?.length === 0, "Draft assignment detail must not leak to a non-owner same-workspace contact.");

  await expectFailure("role-only publish", () =>
    users.roleOnly.client.rpc("publish_calendar_item", { p_calendar_item_id: calendarItemId }).then(({ error }) => {
      if (error) throw error;
    }),
  );
  for (const label of ["revoked", "expired", "inactive"]) {
    await expectFailure(`${label} grant publish`, () =>
      users[label].client.rpc("publish_calendar_item", { p_calendar_item_id: calendarItemId }).then(({ error }) => {
        if (error) throw error;
      }),
    );
  }
  await expectFailure("wrong-workspace publish", () =>
    users.other.client.rpc("publish_calendar_item", { p_calendar_item_id: calendarItemId }).then(({ error }) => {
      if (error) throw error;
    }),
  );
  await expectFailure("malformed publish id", () =>
    users.owner.client.rpc("publish_calendar_item", { p_calendar_item_id: randomUUID() }).then(({ error }) => {
      if (error) throw error;
    }),
  );

  const directUpdate = await users.owner.client
    .from("calendar_items")
    .update({ publication_state: "published" })
    .eq("id", calendarItemId);
  assert(directUpdate.error, "Direct table publication update must remain denied.");

  await publishItem(users.owner.client, calendarItemId);
  await publishItem(users.owner.client, calendarItemId);
  const publishedRows = queryJson(
    containerName,
    `select publication_state, created_by_project_contact_id, published_at, published_by_project_contact_id
from public.calendar_items
where id = ${sqlUuid(calendarItemId)}`,
  );
  assert.equal(publishedRows[0].publication_state, "published");
  assert.equal(publishedRows[0].created_by_project_contact_id, fixture.contacts.owner);
  assert(publishedRows[0].published_at, "Published item must have published_at.");
  assert.equal(publishedRows[0].published_by_project_contact_id, fixture.contacts.owner);

  await assertReadModelContains(users.owner.client, fixture.contacts.owner, calendarItemId, "published");
  const editorItem = await assertReadModelContains(users.editor.client, fixture.contacts.editor, calendarItemId, "published");
  assert.equal(editorItem.assignedFractionLabel, "1/1 assigned");

  await updateTimedItem(users.editor.client, calendarItemId, `${fixture.namespace} Published Edit`);
  const token = await users.editor.client.rpc("issue_assignment_response_token", {
    p_assignment_id: assignmentId,
    p_ttl_hours: 1,
    p_internal_note: "published ok",
  });
  assert(!token.error && token.data?.length === 1, "Published assignment token issuance should remain compatible.");
  assert.equal(token.data[0].bearer_token.length, 43);

  const noTokenSideEffectsBeforePublish = queryJson(
    containerName,
    `select count(*)::int as count
from public.assignment_response_tokens
where workspace_id = ${sqlUuid(fixture.workspaceId)}`,
  );
  assert.equal(noTokenSideEffectsBeforePublish[0].count, 1, "Only explicit post-publish token issuance should create a token.");
}

function cleanup(containerName) {
  const userIds = authUserIds.map(sqlUuid).join(", ");
  runPsql(
    containerName,
    `begin;
delete from public.assignment_response_link_reveal_events where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)});
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
  assert.equal(residue, "0", `Calendar publication cleanup left residue count ${residue}.`);
  cleanupCompleted = true;
}

async function main() {
  await verifyPreflight();
  const containerName = await resolveLocalDatabaseContainer();
  await applyCalendarPublicationMigrationsIfNeeded(containerName);
  const users = {
    owner: await createAuthenticatedUser("owner"),
    editor: await createAuthenticatedUser("editor"),
    readOnly: await createAuthenticatedUser("read-only"),
    roleOnly: await createAuthenticatedUser("role-only"),
    revoked: await createAuthenticatedUser("revoked"),
    expired: await createAuthenticatedUser("expired"),
    inactive: await createAuthenticatedUser("inactive"),
    other: await createAuthenticatedUser("other"),
  };

  try {
    insertFixtures(containerName, users);
    await verifyPublication(containerName, users);
  } finally {
    cleanup(containerName);
  }

  console.log(
    "Confirmed Calendar publication visibility: draft owner-only reads, publish, published cross-contact visibility, assignment/token gating, direct-write denial, and zero-residue cleanup.",
  );
}

main().catch((error) => {
  console.error(redact(error));
  process.exitCode = 1;
}).finally(() => {
  if (!cleanupCompleted) {
    console.error("Calendar publication cleanup did not complete.");
  }
});
