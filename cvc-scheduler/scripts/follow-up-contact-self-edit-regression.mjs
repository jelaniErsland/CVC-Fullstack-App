import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { normalizeVolunteerFacingContactDetailsInput } from "../lib/projectContacts/volunteerFacingDetails.ts";
import { readInitialAssignmentNotificationSummariesWithClient } from "../lib/calendar/assignmentNotifications.server.ts";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const root = process.cwd();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const migrationPath = path.join(
  root,
  "supabase",
  "migrations",
  "20260824123500_follow_up_contact_self_edit.sql",
);
const secrets = new Set();
const clients = [];
const authUserIds = [];
let cleanupCompleted = false;

const fixture = {
  namespace: `qa-12-43-b-1-${randomUUID()}`,
  workspaceId: randomUUID(),
  inactiveWorkspaceId: randomUUID(),
  otherWorkspaceId: randomUUID(),
  itemId: randomUUID(),
  assignmentId: randomUUID(),
  responseId: randomUUID(),
  volunteerId: randomUUID(),
  contacts: Object.fromEntries(
    [
      "owner",
      "other",
      "noGrant",
      "revoked",
      "expired",
      "future",
      "inactiveContact",
      "inactiveWorkspace",
    ].map((label) => [label, randomUUID()]),
  ),
  grants: Object.fromEntries(
    [
      "owner",
      "other",
      "revoked",
      "expired",
      "future",
      "inactiveContact",
      "inactiveWorkspace",
    ].map((label) => [label, randomUUID()]),
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
  let message = value instanceof Error ? value.stack ?? value.message : String(value);
  for (const secret of secrets) {
    if (typeof secret === "string" && secret) {
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

function command(commandName, args, options = {}) {
  return spawnSync(commandName, args, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 20 * 1024 * 1024,
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
    throw new Error(redact(result.stderr || "Local Follow-up Contact SQL failed."));
  }
  return result.stdout.trim();
}

function queryJson(containerName, sql) {
  const innerSql = sql.trim().replace(/;+$/, "");
  const output = runPsql(
    containerName,
    `select coalesce(jsonb_agg(to_jsonb(rows)), '[]'::jsonb)::text from (${innerSql}) as rows;`,
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
    "Local Supabase must be running for the Follow-up Contact regression.",
  );
  return containerName;
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
  assert(!signup.error && signup.data.user, `Auth fixture ${label} could not be created.`);
  let session = signup.data.session;
  if (!session) {
    const signin = await client.auth.signInWithPassword({ email, password });
    assert(!signin.error && signin.data.session, `Auth fixture ${label} could not sign in.`);
    session = signin.data.session;
  }
  secrets.add(session.access_token);
  secrets.add(session.refresh_token);
  authUserIds.push(signup.data.user.id);
  clients.push(client);
  return { client, userId: signup.data.user.id };
}

function grantRow(label, workspaceId, capabilities, overrides = {}) {
  return `(${sqlUuid(fixture.grants[label])}, ${sqlUuid(workspaceId)}, ${sqlUuid(fixture.contacts[label])}, ${sqlText(overrides.role ?? "main_contact")}, array[${capabilities.map(sqlText).join(", ")}]::text[], ${sqlText(overrides.status ?? "active")}, ${sqlText(overrides.validFrom ?? "2026-08-01T00:00:00Z")}::timestamptz, ${overrides.validUntil ? `${sqlText(overrides.validUntil)}::timestamptz` : "null"}, ${overrides.revokedAt ? `${sqlText(overrides.revokedAt)}::timestamptz` : "null"})`;
}

async function expectRpcFailure(label, operation) {
  try {
    const result = await operation();
    if (result?.error) return;
  } catch {
    return;
  }
  assert.fail(`${label} should fail closed.`);
}

async function readCurrentVolunteerFacingContactDetailsWithClient(client, projectContactId) {
  const result = await client
    .from("project_contacts")
    .select("volunteer_facing_display_name,volunteer_facing_email,volunteer_facing_phone")
    .eq("id", projectContactId)
    .eq("status", "active")
    .maybeSingle();
  assert(!result.error && result.data, "Current Follow-up Contact details should be readable.");
  return {
    displayName: result.data.volunteer_facing_display_name,
    email: result.data.volunteer_facing_email,
    phone: result.data.volunteer_facing_phone,
  };
}

async function updateCurrentVolunteerFacingContactDetailsWithClient(client, workspaceId, input) {
  const details = normalizeVolunteerFacingContactDetailsInput(input);
  const result = await client.rpc("update_current_project_contact_volunteer_facing_details", {
    p_workspace_id: workspaceId,
    p_display_name: details.displayName,
    p_email: details.email,
    p_phone: details.phone ?? "",
  });
  assert(!result.error && result.data === true, "Follow-up Contact details should update through the RPC.");
  return details;
}

async function verifyStaticBoundaries() {
  const [migration, helper, page, client, types, privileges] = await Promise.all([
    readFile(migrationPath, "utf8"),
    readFile(path.join(root, "lib", "projectContacts", "volunteerFacingDetails.server.ts"), "utf8"),
    readFile(path.join(root, "app", "admin", "calendar", "page.tsx"), "utf8"),
    readFile(path.join(root, "components", "CalendarClient.tsx"), "utf8"),
    readFile(path.join(root, "lib", "supabase", "database.types.ts"), "utf8"),
    readFile(path.join(root, "lib", "security", "projectLocalTablePrivileges.contract.json"), "utf8"),
  ]);
  assert.match(migration, /update_current_project_contact_volunteer_facing_details/);
  assert.match(migration, /caller_user_id := auth\.uid\(\)/);
  assert.match(migration, /capabilities @> array\['workspace\.read'\]/);
  assert.match(migration, /security definer/i);
  assert.match(migration, /grant execute .* to authenticated/is);
  assert.doesNotMatch(migration, /grant (?:update|all).*project_contacts.*authenticated/i);
  assert.match(helper, /^import "server-only";/);
  assert.match(helper, /resolveVerifiedAdminContext/);
  assert.match(helper, /trustedWorkspaceIds\.length !== 1/);
  assert.doesNotMatch(helper, /assignments\.edit|service_role|auth\.admin/i);
  assert.match(page, /updateCurrentVolunteerFacingContactDetailsAction/);
  assert.match(client, /Add contact details/);
  assert.match(client, /Edit contact details/);
  assert.match(types, /update_current_project_contact_volunteer_facing_details/);
  assert.deepEqual(JSON.parse(privileges).directPrivileges.project_contacts.authenticated, ["SELECT"]);
}

async function setupFixtures(containerName, users) {
  const rpcExists = runPsql(
    containerName,
    "select to_regprocedure('public.update_current_project_contact_volunteer_facing_details(uuid,text,text,text)') is not null;",
  );
  if (rpcExists !== "t") {
    const migration = await readFile(migrationPath, "utf8");
    runPsql(containerName, migration);
  }
  runPsql(
    containerName,
    `insert into public.workspaces (id, workspace_key, display_name, lifecycle, timezone, starts_on, ends_on, public_intake_enabled) values
  (${sqlUuid(fixture.workspaceId)}, ${sqlText(`${fixture.namespace}-target`)}, 'QA Follow-up Contact', 'active', 'America/Denver', '2026-08-01', '2099-12-31', false),
  (${sqlUuid(fixture.otherWorkspaceId)}, ${sqlText(`${fixture.namespace}-other`)}, 'QA Other Workspace', 'active', 'America/Denver', '2026-08-01', '2099-12-31', false),
  (${sqlUuid(fixture.inactiveWorkspaceId)}, ${sqlText(`${fixture.namespace}-inactive`)}, 'QA Inactive Workspace', 'archived', 'America/Denver', '2026-08-01', '2099-12-31', false);

insert into public.project_contacts (id, auth_user_id, status, volunteer_facing_display_name, volunteer_facing_email, volunteer_facing_phone) values
  (${sqlUuid(fixture.contacts.owner)}, ${sqlUuid(users.owner.userId)}, 'active', null, null, null),
  (${sqlUuid(fixture.contacts.other)}, ${sqlUuid(users.other.userId)}, 'active', 'Other Contact', 'other@example.invalid', null),
  (${sqlUuid(fixture.contacts.noGrant)}, ${sqlUuid(users.noGrant.userId)}, 'active', null, null, null),
  (${sqlUuid(fixture.contacts.revoked)}, ${sqlUuid(users.revoked.userId)}, 'active', null, null, null),
  (${sqlUuid(fixture.contacts.expired)}, ${sqlUuid(users.expired.userId)}, 'active', null, null, null),
  (${sqlUuid(fixture.contacts.future)}, ${sqlUuid(users.future.userId)}, 'active', null, null, null),
  (${sqlUuid(fixture.contacts.inactiveContact)}, ${sqlUuid(users.inactiveContact.userId)}, 'inactive', null, null, null),
  (${sqlUuid(fixture.contacts.inactiveWorkspace)}, ${sqlUuid(users.inactiveWorkspace.userId)}, 'active', null, null, null);

insert into public.workspace_contact_grants (id, workspace_id, project_contact_id, role, capabilities, status, valid_from, valid_until, revoked_at) values
  ${grantRow("owner", fixture.workspaceId, ["workspace.read", "calendar.view", "assignments.view", "assignments.edit"])},
  ${grantRow("other", fixture.workspaceId, ["workspace.read"], { role: "assistant_contact" })},
  ${grantRow("revoked", fixture.workspaceId, ["workspace.read"], { status: "revoked", revokedAt: "2026-08-20T00:00:00Z" })},
  ${grantRow("expired", fixture.workspaceId, ["workspace.read"], { validUntil: "2026-08-20T00:00:00Z" })},
  ${grantRow("future", fixture.workspaceId, ["workspace.read"], { validFrom: "2099-01-01T00:00:00Z" })},
  ${grantRow("inactiveContact", fixture.workspaceId, ["workspace.read"])},
  ${grantRow("inactiveWorkspace", fixture.inactiveWorkspaceId, ["workspace.read"])};

insert into public.volunteer_profiles (
  id, workspace_id, source_submission_id, profile_source, manual_created_by_project_contact_id,
  manual_created_at, lifecycle, readiness_status, full_name, email, phone, congregation,
  preferred_contact_method, availability_snapshot, skills_help_snapshot, profile_notes
) values (
  ${sqlUuid(fixture.volunteerId)}, ${sqlUuid(fixture.workspaceId)}, null, 'manual', ${sqlUuid(fixture.contacts.owner)},
  clock_timestamp(), 'active', 'ready', ${sqlText(`${fixture.namespace} Volunteer`)}, ${sqlText(`${fixture.namespace}-volunteer@example.invalid`)},
  null, null, null, '{}'::jsonb, '{}'::jsonb, ''
);

insert into public.calendar_items (
  id, workspace_id, task_preset_id, title_snapshot, task_type_snapshot, schedule_kind,
  start_date, end_date, start_time, end_time, timezone, needed_count, schedule_notes,
  custom_values, lifecycle, follow_up_project_contact_id, created_by_project_contact_id,
  publication_state, published_at, published_by_project_contact_id
) values (
  ${sqlUuid(fixture.itemId)}, ${sqlUuid(fixture.workspaceId)}, null, ${sqlText(`${fixture.namespace} Scheduling proof`)},
  'general', 'timed', '2099-09-07', null, '09:00', '10:00', 'America/Denver', 1, null,
  '{}'::jsonb, 'active', ${sqlUuid(fixture.contacts.owner)}, ${sqlUuid(fixture.contacts.owner)},
  'published', clock_timestamp(), ${sqlUuid(fixture.contacts.owner)}
);

insert into public.calendar_assignments (
  id, workspace_id, calendar_item_id, volunteer_profile_id, lifecycle, assignment_note, created_by_auth_user_id
) values (
  ${sqlUuid(fixture.assignmentId)}, ${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.itemId)},
  ${sqlUuid(fixture.volunteerId)}, 'active', null, ${sqlUuid(users.owner.userId)}
);

insert into public.assignment_responses (
  id, workspace_id, assignment_id, response_status, response_source, response_note, responded_at, updated_by_auth_user_id
) values (
  ${sqlUuid(fixture.responseId)}, ${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.assignmentId)},
  'needs_response', 'project_contact', null, null, ${sqlUuid(users.owner.userId)}
);`,
  );
}

function preservationSnapshot(containerName) {
  return queryJson(
    containerName,
    `select
  contact.auth_user_id,
  contact.status as contact_status,
  grant_row.role,
  grant_row.capabilities,
  grant_row.status as grant_status,
  item.follow_up_project_contact_id,
  item.publication_state,
  assignment.lifecycle as assignment_lifecycle,
  response.response_status,
  (select count(*) from public.assignment_notification_deliveries where workspace_id = ${sqlUuid(fixture.workspaceId)})::int as delivery_count,
  (select count(*) from public.volunteer_schedule_access_tokens where workspace_id = ${sqlUuid(fixture.workspaceId)})::int as schedule_token_count,
  (select count(*) from public.assignment_response_tokens where workspace_id = ${sqlUuid(fixture.workspaceId)})::int as response_token_count
from public.project_contacts as contact
join public.workspace_contact_grants as grant_row on grant_row.project_contact_id = contact.id
join public.calendar_items as item on item.follow_up_project_contact_id = contact.id
join public.calendar_assignments as assignment on assignment.calendar_item_id = item.id
join public.assignment_responses as response on response.assignment_id = assignment.id
where contact.id = ${sqlUuid(fixture.contacts.owner)} and item.id = ${sqlUuid(fixture.itemId)};`,
  )[0];
}

async function verifyBehavior(containerName, users) {
  assert.deepEqual(
    normalizeVolunteerFacingContactDetailsInput({
      displayName: "  QA Contact  ",
      email: "  QA.CONTACT@EXAMPLE.INVALID ",
      phone: " ",
    }),
    { displayName: "QA Contact", email: "qa.contact@example.invalid", phone: null },
  );
  for (const input of [
    { displayName: "", email: "valid@example.invalid", phone: null },
    { displayName: "<b>Name</b>", email: "valid@example.invalid", phone: null },
    { displayName: "Name", email: "bad", phone: null },
    { displayName: "Name", email: "valid@example.invalid", phone: "bad" },
  ]) {
    assert.throws(() => normalizeVolunteerFacingContactDetailsInput(input));
  }

  const beforeSummary = await readInitialAssignmentNotificationSummariesWithClient({
    supabase: users.owner.client,
    calendarItemIds: [fixture.itemId],
    canSendInitialAssignmentNotifications: true,
  });
  assert.equal(beforeSummary.kind, "ready");
  assert.equal(beforeSummary.summaries[0]?.eligibleToSendCount, 0);
  assert.equal(beforeSummary.summaries[0]?.missingFollowUpContactCount, 1);
  const before = preservationSnapshot(containerName);
  assert.throws(
    () =>
      runPsql(
        containerName,
        `update public.workspace_contact_grants set capabilities = array['calendar.view']::text[] where id = ${sqlUuid(fixture.grants.owner)};`,
      ),
    "The permanent grant constraint must reject a role/title row without workspace.read.",
  );

  const first = await updateCurrentVolunteerFacingContactDetailsWithClient(
    users.owner.client,
    fixture.workspaceId,
    { displayName: "  QA Follow-up Contact  ", email: "  QA.FOLLOWUP@EXAMPLE.INVALID ", phone: "406-555-0100" },
  );
  assert.deepEqual(first, {
    displayName: "QA Follow-up Contact",
    email: "qa.followup@example.invalid",
    phone: "406-555-0100",
  });
  await updateCurrentVolunteerFacingContactDetailsWithClient(users.owner.client, fixture.workspaceId, {
    displayName: "QA Follow-up Contact",
    email: "qa.followup@example.invalid",
    phone: "",
  });
  assert.deepEqual(
    await readCurrentVolunteerFacingContactDetailsWithClient(users.owner.client, fixture.contacts.owner),
    { displayName: "QA Follow-up Contact", email: "qa.followup@example.invalid", phone: null },
  );

  const afterSummary = await readInitialAssignmentNotificationSummariesWithClient({
    supabase: users.owner.client,
    calendarItemIds: [fixture.itemId],
    canSendInitialAssignmentNotifications: true,
  });
  assert.equal(afterSummary.kind, "ready");
  assert.equal(afterSummary.summaries[0]?.eligibleToSendCount, 1);
  assert.equal(afterSummary.summaries[0]?.missingFollowUpContactCount, 0);
  assert.deepEqual(preservationSnapshot(containerName), before);

  const anon = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await expectRpcFailure("unauthenticated RPC", () =>
    anon.rpc("update_current_project_contact_volunteer_facing_details", {
      p_workspace_id: fixture.workspaceId,
      p_display_name: "Anonymous",
      p_email: "anonymous@example.invalid",
      p_phone: "",
    }),
  );
  for (const label of [
    "noGrant",
    "revoked",
    "expired",
    "future",
    "inactiveContact",
  ]) {
    await expectRpcFailure(`${label} RPC`, () =>
      users[label].client.rpc("update_current_project_contact_volunteer_facing_details", {
        p_workspace_id: fixture.workspaceId,
        p_display_name: "Denied",
        p_email: "denied@example.invalid",
        p_phone: "",
      }),
    );
  }
  await expectRpcFailure("inactive workspace RPC", () =>
    users.inactiveWorkspace.client.rpc("update_current_project_contact_volunteer_facing_details", {
      p_workspace_id: fixture.inactiveWorkspaceId,
      p_display_name: "Denied",
      p_email: "denied@example.invalid",
      p_phone: "",
    }),
  );
  await expectRpcFailure("cross-workspace RPC", () =>
    users.other.client.rpc("update_current_project_contact_volunteer_facing_details", {
      p_workspace_id: fixture.otherWorkspaceId,
      p_display_name: "Forged",
      p_email: "forged@example.invalid",
      p_phone: "",
    }),
  );
  for (const args of [
    { p_display_name: "", p_email: "valid@example.invalid", p_phone: "" },
    { p_display_name: "<b>Bad</b>", p_email: "valid@example.invalid", p_phone: "" },
    { p_display_name: "Valid", p_email: "bad", p_phone: "" },
    { p_display_name: "Valid", p_email: "valid@example.invalid", p_phone: "bad" },
  ]) {
    await expectRpcFailure("malformed RPC", () =>
      users.owner.client.rpc("update_current_project_contact_volunteer_facing_details", {
        p_workspace_id: fixture.workspaceId,
        ...args,
      }),
    );
  }

  const directUpdate = await users.owner.client
    .from("project_contacts")
    .update({ volunteer_facing_display_name: "Direct update" })
    .eq("id", fixture.contacts.owner);
  assert(directUpdate.error, "Authenticated direct project_contacts UPDATE must remain denied.");
  const otherBefore = queryJson(
    containerName,
    `select volunteer_facing_display_name, volunteer_facing_email from public.project_contacts where id = ${sqlUuid(fixture.contacts.other)};`,
  )[0];
  await updateCurrentVolunteerFacingContactDetailsWithClient(users.other.client, fixture.workspaceId, {
    displayName: "Other Self",
    email: "other.self@example.invalid",
    phone: null,
  });
  const ownerAfterOther = queryJson(
    containerName,
    `select volunteer_facing_display_name, volunteer_facing_email from public.project_contacts where id = ${sqlUuid(fixture.contacts.owner)};`,
  )[0];
  assert.deepEqual(ownerAfterOther, {
    volunteer_facing_display_name: "QA Follow-up Contact",
    volunteer_facing_email: "qa.followup@example.invalid",
  });
  assert.notDeepEqual(
    queryJson(containerName, `select volunteer_facing_display_name, volunteer_facing_email from public.project_contacts where id = ${sqlUuid(fixture.contacts.other)};`)[0],
    otherBefore,
  );
}

async function cleanup(containerName) {
  for (const client of clients) await client.auth.signOut({ scope: "local" }).catch(() => undefined);
  const userIds = authUserIds.length
    ? authUserIds.map(sqlUuid).join(", ")
    : "'00000000-0000-4000-8000-000000000000'::uuid";
  const workspaceIds = [fixture.workspaceId, fixture.otherWorkspaceId, fixture.inactiveWorkspaceId]
    .map(sqlUuid)
    .join(", ");
  const residue = runPsql(
    containerName,
    `begin;
delete from public.assignment_notification_deliveries where workspace_id in (${workspaceIds});
delete from public.volunteer_schedule_access_tokens where workspace_id in (${workspaceIds});
delete from public.assignment_response_tokens where workspace_id in (${workspaceIds});
delete from public.assignment_response_link_reveal_events where workspace_id in (${workspaceIds});
delete from public.assignment_responses where workspace_id in (${workspaceIds});
delete from public.calendar_assignments where workspace_id in (${workspaceIds});
delete from public.calendar_items where workspace_id in (${workspaceIds});
delete from public.volunteer_profiles where workspace_id in (${workspaceIds});
delete from public.workspace_contact_grants where workspace_id in (${workspaceIds});
delete from public.project_contacts where auth_user_id in (${userIds});
delete from public.workspaces where id in (${workspaceIds});
delete from auth.identities where user_id in (${userIds});
delete from auth.users where id in (${userIds});
commit;
select (
  (select count(*) from public.workspaces where workspace_key like ${sqlText(`${fixture.namespace}%`)}) +
  (select count(*) from public.project_contacts where auth_user_id in (${userIds})) +
  (select count(*) from auth.users where id in (${userIds}))
)::text;`,
  );
  assert.equal(residue, "0", `Follow-up Contact regression cleanup residue was ${residue}.`);
  cleanupCompleted = true;
}

async function main() {
  assert(supabaseUrl && anonKey, "Local Supabase public environment values are required.");
  assert(isLoopbackUrl(supabaseUrl), "Follow-up Contact regression accepts only local Supabase.");
  secrets.add(anonKey);
  await verifyStaticBoundaries();
  const containerName = await resolveLocalDatabaseContainer();
  try {
    const labels = Object.keys(fixture.contacts);
    const users = Object.fromEntries(
      await Promise.all(labels.map(async (label) => [label, await createAuthenticatedUser(label)])),
    );
    await setupFixtures(containerName, users);
    await verifyBehavior(containerName, users);
  } finally {
    await cleanup(containerName);
  }
  assert(cleanupCompleted, "Follow-up Contact regression cleanup did not complete.");
  console.log("Follow-up Contact self-edit local validation passed.");
  console.log("Validated own-contact normalization, missing workspace.read/role-title and grant lifecycle denial, cross-contact isolation, eligibility 0/1 -> 1/0, preservation, direct-table denial, and zero email/token/delivery residue.");
}

try {
  await main();
} catch (error) {
  console.error(redact(error));
  process.exitCode = 1;
}
