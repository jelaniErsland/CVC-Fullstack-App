import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { parseLookupInput, parseLookupResult } from "../lib/volunteerScheduleAccess/lookup.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
assert(url && ["127.0.0.1", "localhost"].includes(new URL(url).hostname), "Loopback only.");
const client = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const sql = (query) => {
  const result = spawnSync("docker", ["exec", "-i", "supabase_db_cvc-scheduler", "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], { input: query, encoding: "utf8", windowsHide: true });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
};
const text = (v) => `'${String(v).replaceAll("'", "''")}'`;
const workspaces = Array.from({ length: 3 }, randomUUID);
const contactId = randomUUID();
const authId = randomUUID();
const ids = Array.from({ length: 8 }, randomUUID);
const namespace = `lookup-${randomUUID()}`;
const reset = () => sql("delete from public.volunteer_lookup_attempts where bucket <> 'global'; update public.volunteer_lookup_attempts set attempts=0, window_started_at=now() where bucket='global';");
async function verify(name, contact, projectChoice) {
  const result = await client.rpc("verify_volunteer_schedule_lookup", { p_full_name: name, p_contact: contact, p_project_choice: projectChoice });
  assert.equal(result.error, null);
  return result.data;
}
const failed = { status: "unverified" };
try {
  sql(`insert into public.workspaces (id, workspace_key, display_name, lifecycle) values
    (${text(workspaces[0])}, ${text(namespace + '-a')}, 'Local project A', 'active'),
    (${text(workspaces[1])}, ${text(namespace + '-b')}, 'Local project B', 'active'),
    (${text(workspaces[2])}, ${text(namespace + '-c')}, 'Inactive project', 'archived');
    insert into auth.users (id, aud, role) values (${text(authId)}, 'authenticated', 'authenticated');
    insert into public.project_contacts (id, auth_user_id, status) values (${text(contactId)}, ${text(authId)}, 'active');`);
  const profiles = [
    [0, 0, 'Jordan Rivera', 'jordan@example.invalid', '+1 (406) 555-0100', 'active', 'ready'],
    [1, 0, 'Jordan Rivera', 'different@example.invalid', '+1 (406) 555-0101', 'active', 'ready'],
    [2, 1, 'Morgan Lee', 'morgan@example.invalid', null, 'active', 'ready'],
    [3, 0, 'Morgan Lee', 'morgan@example.invalid', null, 'active', 'ready'],
    [4, 0, 'Inactive Person', 'inactive@example.invalid', null, 'inactive', 'ready'],
    [5, 0, 'Held Person', 'held@example.invalid', null, 'active', 'on_hold'],
    [6, 2, 'Archived Project', 'archived@example.invalid', null, 'active', 'ready'],
  ];
  for (const [i, w, name, email, phone, lifecycle, readiness] of profiles) sql(`insert into public.volunteer_profiles
    (id, workspace_id, profile_source, lifecycle, readiness_status, full_name, email, phone, availability_snapshot, skills_help_snapshot, manual_created_at, manual_created_by_project_contact_id)
    values (${text(ids[i])},${text(workspaces[w])},'manual',${text(lifecycle)},${text(readiness)},${text(name)},${text(email)},${phone ? text(phone) : 'null'},'{}','{}',now(),${text(contactId)});`);
  reset();
  const first = await verify('  jOrDaN   RIVERA ', ' JORDAN@EXAMPLE.INVALID ');
  assert.equal(first.status, 'verified');
  assert.equal(parseLookupResult(first).status, 'verified');
  const schedule = await client.rpc('read_volunteer_schedule', { p_bearer_token: first.bearer_token });
  assert.equal(schedule.error, null);
  assert.equal(schedule.data[0].volunteer_display_name, 'Jordan Rivera');
  assert.equal(schedule.data[0].workspace_display_name, 'Local project A');
  assert.equal(sql(`select volunteer_profile_id from public.volunteer_schedule_access_tokens where token_verifier_hash=extensions.digest(${text(first.bearer_token)},'sha256')`), ids[0]);
  assert.equal((await verify('Jordan Rivera', '+1 406.555.0100')).status, 'verified');
  for (const [name, contact] of [['Jordan Rivera','wrong@example.invalid'],['Unknown Person','wrong@example.invalid'],['Inactive Person','inactive@example.invalid'],['Held Person','held@example.invalid'],['Archived Project','archived@example.invalid'],['Jordan Rivera','4065550100']]) assert.deepEqual(await verify(name,contact), failed);
  reset();
  assert.deepEqual(await verify('Jordan Rivera', 'jordan@example.invalid', '0'.repeat(64)), failed);
  assert.deepEqual(await verify('Jordan Rivera', ''), failed);
  assert.deepEqual(await verify(null, null), failed);
  assert.deepEqual(await verify('x'.repeat(1000), 'x@example.invalid'), failed);
  assert.deepEqual(await verify('Jordan Rivera', 'call 14065550100'), failed);
  const choices = await verify('Morgan Lee', 'morgan@example.invalid');
  assert.equal(choices.status, 'choose_project');
  assert.equal(choices.projects.length, 2);
  for (const p of choices.projects) assert.deepEqual(Object.keys(p).sort(), ['choice','name']);
  assert(!JSON.stringify(choices).includes('volunteer'));
  assert(!JSON.stringify(choices).includes(workspaces[0]) && !JSON.stringify(choices).includes(workspaces[1]));
  const selectedChoice = choices.projects.find((project) => project.name === 'Local project B').choice;
  const selected = await verify('Morgan Lee', 'morgan@example.invalid', selectedChoice);
  assert.equal(selected.status, 'verified');
  assert.equal(sql(`select volunteer_profile_id from public.volunteer_schedule_access_tokens where token_verifier_hash=extensions.digest(${text(selected.bearer_token)},'sha256')`), ids[2]);
  const selectedSchedule = await client.rpc('read_volunteer_schedule', { p_bearer_token: selected.bearer_token });
  assert.equal(selectedSchedule.error, null);
  assert.equal(selectedSchedule.data[0].workspace_display_name, 'Local project B');
  assert.equal(selectedSchedule.data[0].volunteer_display_name, 'Morgan Lee');
  const originalScheduleAgain = await client.rpc('read_volunteer_schedule', { p_bearer_token: first.bearer_token });
  assert.equal(originalScheduleAgain.error, null);
  assert.equal(originalScheduleAgain.data[0].workspace_display_name, 'Local project A');
  assert(!JSON.stringify(choices).match(/schedule|email|phone|bearer|token|volunteer/i));
  assert.deepEqual(await verify('Morgan Lee','wrong@example.invalid',selectedChoice),failed);
  // Identical contact/name duplicates in a workspace must fail, not choose a record.
  sql(`insert into public.volunteer_profiles (id,workspace_id,profile_source,full_name,email,availability_snapshot,skills_help_snapshot,manual_created_at,manual_created_by_project_contact_id)
    values (${text(ids[7])},${text(workspaces[0])},'manual','Morgan Lee','morgan@example.invalid','{}','{}',now(),${text(contactId)});`);
  assert.deepEqual(await verify('Morgan Lee','morgan@example.invalid'),failed);
  reset();
  const attempts = await Promise.all(Array.from({length: 10}, () => verify('Jordan Rivera','jordan@example.invalid')));
  assert.equal(attempts.filter(x => x.status === 'verified').length,6,'Concurrent calls cannot bypass the limiter.');
  assert.deepEqual(await verify('Jordan Rivera','jordan@example.invalid'),failed);
  sql("update public.volunteer_lookup_attempts set window_started_at=now()-interval '16 minutes';");
  assert.equal((await verify('Jordan Rivera','jordan@example.invalid')).status,'verified','Temporary limit recovers.');
  reset();
  for(let i=0;i<7;i++)assert.deepEqual(await verify('Unknown Person','wrong@example.invalid'),failed);
  assert.equal(sql("select max(attempts) from public.volunteer_lookup_attempts where bucket <> 'global'"),'7');
  sql("update public.volunteer_lookup_attempts set attempts=200 where bucket='global';");
  assert.deepEqual(await verify('Jordan Rivera','jordan@example.invalid'),failed);
  assert.deepEqual(await verify('Anyone Else','wrong@example.invalid'),failed);
  reset();
  for (const table of ['volunteer_profiles','volunteer_schedule_access_tokens','volunteer_lookup_attempts']) {
    const read = await client.from(table).select('*');
    assert(read.error, `${table} denies anonymous reads.`);
  }
  assert((await client.rpc('issue_volunteer_schedule_access',{p_volunteer_profile_id:ids[0],p_ttl_hours:24})).error);
  assert.equal(sql("select has_function_privilege('anon','public.verify_volunteer_schedule_lookup(text,text,text)','EXECUTE') and has_function_privilege('authenticated','public.verify_volunteer_schedule_lookup(text,text,text)','EXECUTE')"),'t');
  assert.equal(sql("select count(*) from pg_proc p, lateral aclexplode(p.proacl) acl where p.oid='public.verify_volunteer_schedule_lookup(text,text,text)'::regprocedure and acl.grantee=0"),'0','No PUBLIC ACL.');
  assert.equal(sql("select count(*) from pg_class t, lateral aclexplode(t.relacl) acl where t.oid='public.volunteer_lookup_attempts'::regclass and acl.grantee in (0, 'anon'::regrole::oid, 'authenticated'::regrole::oid)"),'0');
  assert.equal(sql("select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('create_repeated_calendar_items','delete_history_free_volunteer_profile','update_current_workspace_project_dates','issue_project_quick_view_share_access') and has_function_privilege('anon',p.oid,'EXECUTE')"),'0');
  const denied = spawnSync('docker',['exec','-i','supabase_db_cvc-scheduler','psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],{input:'set role authenticated; select * from public.volunteer_lookup_attempts;',encoding:'utf8',windowsHide:true});
  assert.notEqual(denied.status,0);
  assert.equal(parseLookupInput({name:'Jordan Rivera'}),null);
  assert.equal(parseLookupInput({name:'Jordan Rivera',contact:'x@y.invalid',projectChoice:'bad'}),null);
  assert.equal(parseLookupResult({status:'verified',bearer_token:'bad',expires_at:'tomorrow'}).status,'unverified');
  console.log('PASS lookup: exact email/phone, normalization, generic failures, same-name and duplicate collisions, inactive/readiness/project gates, project choice, workspace/session scope, malformed input, concurrent/expiring/global limits, direct anon denial, explicit PUBLIC/anon/authenticated ACLs.');
} finally {
  reset();
  sql(`delete from public.volunteer_schedule_access_tokens where workspace_id in (${workspaces.map(text)});
    delete from public.volunteer_profiles where workspace_id in (${workspaces.map(text)});
    delete from public.project_contacts where id=${text(contactId)};
    delete from auth.users where id=${text(authId)};
    delete from public.workspaces where id in (${workspaces.map(text)});`);
}
