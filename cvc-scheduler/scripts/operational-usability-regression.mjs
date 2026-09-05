import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { createRepeatedCalendarItemsWithClient } from "../lib/calendar/repeat.server.ts";
import { validateCreateRepeatedCalendarItemsInput } from "../lib/calendar/repeat.ts";
import { updateCurrentWorkspaceProjectDatesWithClient } from "../lib/operations/projectDates.server.ts";
import { deleteHistoryFreeVolunteerProfileWithClient } from "../lib/volunteers/server.ts";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());
const root = process.cwd();
let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
let anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const namespace = `qa-1244f4a-${randomUUID()}`;
const ids = {
  workspace: randomUUID(), otherWorkspace: randomUUID(),
  ownerContact: randomUUID(), otherContact: randomUUID(), limitedContact: randomUUID(),
  ownerGrant: randomUUID(), otherGrant: randomUUID(), limitedGrant: randomUUID(),
  freeVolunteer: randomUUID(), historyVolunteer: randomUUID(), tokenVolunteer: randomUUID(),
  assignment: randomUUID(), seedItem: randomUUID(),
};
const authUserIds = [];
const clients = [];
let containerName = "";

function shell(command, args, options = {}) {
  return spawnSync(command, args, { cwd: root, encoding: "utf8", windowsHide: true, ...options });
}
function text(value) { return `'${String(value).replaceAll("'", "''")}'`; }
function uuid(value) { return `${text(value)}::uuid`; }
function psql(sql) {
  const result = shell("docker", ["exec", "-i", containerName, "psql", "--no-psqlrc", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], { input: sql });
  if (result.status !== 0) throw new Error((result.stderr || "Local SQL failed.").replace(/postgres(?:ql)?:\/\/\S+/gi, "postgres://[redacted]"));
  return result.stdout.trim();
}
function queryNumber(sql) { return Number(psql(sql)); }
function requireLoopback() {
  if (!supabaseUrl || !anonKey) {
    const status = shell("npx", ["supabase", "status", "--output", "env"], {
      shell: process.platform === "win32",
    });
    const output = status.stdout ?? "";
    supabaseUrl ??= output.match(/^API_URL="?([^\r\n"]+)/m)?.[1]?.replace(/\/$/, "");
    anonKey ??= output.match(/^ANON_KEY="?([^\r\n"]+)/m)?.[1];
  }
  assert(supabaseUrl && anonKey, "Local Supabase configuration is required.");
  assert(["127.0.0.1", "localhost"].includes(new URL(supabaseUrl).hostname), "Regression refuses non-local Supabase.");
}
async function user(label) {
  const client = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const email = `${namespace}-${label}@example.invalid`;
  const password = `${randomBytes(24).toString("base64url")}aA1!`;
  const result = await client.auth.signUp({ email, password });
  assert(!result.error && result.data.user, `Could not create local ${label} Auth fixture.`);
  if (!result.data.session) {
    const signIn = await client.auth.signInWithPassword({ email, password });
    assert(!signIn.error && signIn.data.session, `Could not sign in local ${label} fixture.`);
  }
  authUserIds.push(result.data.user.id); clients.push(client);
  return { client, id: result.data.user.id };
}
async function expectFailure(label, operation) {
  try { await operation(); } catch { return; }
  assert.fail(`${label} should fail closed.`);
}
async function cleanup() {
  await Promise.allSettled(clients.map((client) => client.auth.signOut()));
  if (!containerName) return;
  psql(`
    delete from public.calendar_repeat_creation_requests where workspace_id in (${uuid(ids.workspace)}, ${uuid(ids.otherWorkspace)});
    delete from public.volunteer_schedule_access_tokens where workspace_id in (${uuid(ids.workspace)}, ${uuid(ids.otherWorkspace)});
    delete from public.calendar_assignments where workspace_id in (${uuid(ids.workspace)}, ${uuid(ids.otherWorkspace)});
    delete from public.calendar_items where workspace_id in (${uuid(ids.workspace)}, ${uuid(ids.otherWorkspace)});
    delete from public.volunteer_profiles where workspace_id in (${uuid(ids.workspace)}, ${uuid(ids.otherWorkspace)});
    delete from public.workspace_contact_grants where id in (${uuid(ids.ownerGrant)},${uuid(ids.otherGrant)},${uuid(ids.limitedGrant)});
    delete from public.project_contacts where id in (${uuid(ids.ownerContact)},${uuid(ids.otherContact)},${uuid(ids.limitedContact)});
    delete from public.workspaces where id in (${uuid(ids.workspace)}, ${uuid(ids.otherWorkspace)});
    delete from auth.users where id = any(array[${authUserIds.map(uuid).join(",")}]);
  `);
  assert.equal(queryNumber(`select count(*) from public.workspaces where workspace_key like ${text(`${namespace}%`)}`), 0, "Workspace fixture residue must be zero.");
}

try {
  requireLoopback();
  const config = await readFile(path.join(root, "supabase", "config.toml"), "utf8");
  const projectId = config.match(/^project_id\s*=\s*"([\w-]+)"/m)?.[1];
  assert(projectId, "Local Supabase project id is missing.");
  containerName = `supabase_db_${projectId}`;
  assert.equal(shell("docker", ["inspect", "--format", "{{.State.Running}}", containerName]).stdout.trim(), "true", "Local Supabase must be running.");
  const [owner, other, limited] = await Promise.all([user("owner"), user("other"), user("limited")]);
  psql(`
    insert into public.workspaces (id, workspace_key, display_name, lifecycle, timezone, starts_on, ends_on)
    values (${uuid(ids.workspace)}, ${text(`${namespace}-main`)}, 'Usability Main', 'active', 'America/Denver', '2026-01-01', '2026-01-31'),
           (${uuid(ids.otherWorkspace)}, ${text(`${namespace}-other`)}, 'Usability Other', 'active', 'America/Denver', '2026-02-01', '2026-02-28');
    insert into public.project_contacts (id, auth_user_id, status)
    values (${uuid(ids.ownerContact)}, ${uuid(owner.id)}, 'active'), (${uuid(ids.otherContact)}, ${uuid(other.id)}, 'active'), (${uuid(ids.limitedContact)}, ${uuid(limited.id)}, 'active');
    insert into public.workspace_contact_grants (id, workspace_id, project_contact_id, role, capabilities, status, valid_from)
    values (${uuid(ids.ownerGrant)}, ${uuid(ids.workspace)}, ${uuid(ids.ownerContact)}, 'main_contact', array['workspace.read','calendar.view','calendar.edit','volunteers.view','volunteers.edit','assignments.view']::text[], 'active', now() - interval '1 day'),
           (${uuid(ids.otherGrant)}, ${uuid(ids.otherWorkspace)}, ${uuid(ids.otherContact)}, 'main_contact', array['workspace.read','calendar.view','calendar.edit','volunteers.view','volunteers.edit','assignments.view']::text[], 'active', now() - interval '1 day'),
           (${uuid(ids.limitedGrant)}, ${uuid(ids.workspace)}, ${uuid(ids.limitedContact)}, 'assistant_contact', array['workspace.read','calendar.view','volunteers.view']::text[], 'active', now() - interval '1 day');
    insert into public.volunteer_profiles (id, workspace_id, profile_source, lifecycle, readiness_status, full_name, email, availability_snapshot, skills_help_snapshot, profile_notes, manual_created_at, manual_created_by_project_contact_id)
    values (${uuid(ids.freeVolunteer)}, ${uuid(ids.workspace)}, 'manual', 'active', 'ready', 'Free volunteer', 'free@example.invalid', '{}'::jsonb, '{}'::jsonb, '', now(), ${uuid(ids.ownerContact)}),
           (${uuid(ids.historyVolunteer)}, ${uuid(ids.workspace)}, 'manual', 'active', 'ready', 'History volunteer', 'history@example.invalid', '{}'::jsonb, '{}'::jsonb, '', now(), ${uuid(ids.ownerContact)}),
           (${uuid(ids.tokenVolunteer)}, ${uuid(ids.workspace)}, 'manual', 'active', 'ready', 'Token volunteer', 'token@example.invalid', '{}'::jsonb, '{}'::jsonb, '', now(), ${uuid(ids.ownerContact)});
    insert into public.calendar_items (id, workspace_id, title_snapshot, task_type_snapshot, schedule_kind, start_date, start_time, end_time, timezone, needed_count, custom_values, lifecycle, publication_state, follow_up_project_contact_id, created_by_project_contact_id)
    values (${uuid(ids.seedItem)}, ${uuid(ids.workspace)}, 'History item', 'general', 'timed', '2026-10-01', '08:00', '10:00', 'America/Denver', 1, '{}'::jsonb, 'active', 'draft', ${uuid(ids.ownerContact)}, ${uuid(ids.ownerContact)});
    insert into public.calendar_assignments (id, workspace_id, calendar_item_id, volunteer_profile_id, lifecycle, created_by_auth_user_id)
    values (${uuid(ids.assignment)}, ${uuid(ids.workspace)}, ${uuid(ids.seedItem)}, ${uuid(ids.historyVolunteer)}, 'active', ${uuid(owner.id)});
    insert into public.volunteer_schedule_access_tokens (workspace_id, volunteer_profile_id, token_verifier_hash, expires_at)
    values (${uuid(ids.workspace)}, ${uuid(ids.tokenVolunteer)}, decode(repeat('ab', 32), 'hex'), now() + interval '1 day');
  `);

  const updatedDates = await updateCurrentWorkspaceProjectDatesWithClient(owner.client, { startsOn: '2026-09-29', endsOn: '2026-12-08' });
  assert.deepEqual(updatedDates, { startsOn: '2026-09-29', endsOn: '2026-12-08' });
  await expectFailure('start after end', () => updateCurrentWorkspaceProjectDatesWithClient(owner.client, { startsOn: '2026-12-09', endsOn: '2026-12-08' }));
  await expectFailure('malformed project date', () => updateCurrentWorkspaceProjectDatesWithClient(owner.client, { startsOn: 'not-a-date', endsOn: '2026-12-08' }));
  await expectFailure('unauthorized project date update', () => updateCurrentWorkspaceProjectDatesWithClient(limited.client, { startsOn: '2026-09-29', endsOn: '2026-12-08' }));
  assert.equal(psql(`select starts_on::text || '|' || ends_on::text from public.workspaces where id=${uuid(ids.otherWorkspace)}`), '2026-02-01|2026-02-28');

  assert.equal(await deleteHistoryFreeVolunteerProfileWithClient(owner.client, ids.freeVolunteer), 'deleted');
  assert.equal(await deleteHistoryFreeVolunteerProfileWithClient(owner.client, ids.historyVolunteer), 'has_history');
  assert.equal(await deleteHistoryFreeVolunteerProfileWithClient(owner.client, ids.tokenVolunteer), 'has_history');
  await expectFailure('cross-workspace volunteer deletion', () => deleteHistoryFreeVolunteerProfileWithClient(other.client, ids.historyVolunteer));
  await expectFailure('unauthorized volunteer deletion', () => deleteHistoryFreeVolunteerProfileWithClient(limited.client, ids.historyVolunteer));
  assert.equal(queryNumber(`select count(*) from public.calendar_assignments where id=${uuid(ids.assignment)}`), 1, 'Historical assignment must remain.');

  const repeatBase = {
    workspaceId: ids.workspace, source: { kind: 'one_off', title: 'Repeat proof', taskType: 'general' },
    startDate: '2026-09-29', endDate: '2026-10-10', weekdays: [2], startTime: '08:00', endTime: '10:00', neededCount: 2, notes: 'repeat proof', customValues: {},
  };
  const oneWeekday = await createRepeatedCalendarItemsWithClient(owner.client, { ...repeatBase, requestKey: randomUUID() });
  assert.equal(oneWeekday.length, 2);
  const multiWeekday = await createRepeatedCalendarItemsWithClient(owner.client, { ...repeatBase, weekdays: [2, 4, 6], requestKey: randomUUID() });
  assert.equal(multiWeekday.length, 6);
  const tenWeek = await createRepeatedCalendarItemsWithClient(owner.client, { ...repeatBase, startDate: '2026-09-29', endDate: '2026-12-05', weekdays: [2, 3, 4, 5, 6], requestKey: randomUUID() });
  assert.equal(tenWeek.length, 50);
  const replayKey = randomUUID();
  const firstReplay = await createRepeatedCalendarItemsWithClient(owner.client, { ...repeatBase, requestKey: replayKey });
  const secondReplay = await createRepeatedCalendarItemsWithClient(owner.client, { ...repeatBase, requestKey: replayKey });
  assert.deepEqual(secondReplay, firstReplay, 'Same request key must not create another batch.');
  await expectFailure('zero generated dates', () => Promise.resolve(validateCreateRepeatedCalendarItemsInput({ ...repeatBase, weekdays: [], requestKey: randomUUID() })));
  await expectFailure('range cap', () => Promise.resolve(validateCreateRepeatedCalendarItemsInput({ ...repeatBase, startDate: '2026-01-01', endDate: '2026-12-31', weekdays: [0,1,2,3,4,5,6], requestKey: randomUUID() })));
  await expectFailure('unauthorized repeat creation', () => createRepeatedCalendarItemsWithClient(limited.client, { ...repeatBase, requestKey: randomUUID() }));
  const repeatRows = queryNumber(`select count(*) from public.calendar_items where workspace_id=${uuid(ids.workspace)} and title_snapshot='Repeat proof' and publication_state='draft' and lifecycle='active'`);
  assert.equal(repeatRows, oneWeekday.length + multiWeekday.length + tenWeek.length + firstReplay.length);
  assert.equal(queryNumber(`select count(*) from public.calendar_assignments where calendar_item_id = any(array[${[...oneWeekday, ...multiWeekday, ...tenWeek, ...firstReplay].map(uuid).join(',')}])`), 0, 'Repeat creation must not assign volunteers.');
  assert.equal(queryNumber(`select count(*) from public.assignment_notification_deliveries where calendar_item_id = any(array[${[...oneWeekday, ...multiWeekday, ...tenWeek, ...firstReplay].map(uuid).join(',')}])`), 0, 'Repeat creation must not create notifications.');
  console.log('PASS operational usability regression');
} finally {
  await cleanup();
}
