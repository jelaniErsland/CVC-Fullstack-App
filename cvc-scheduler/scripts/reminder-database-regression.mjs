import assert from 'node:assert/strict';
import pg from 'pg';
import {randomBytes} from 'node:crypto';
import {sql,q} from './12-47-local-fixtures.mjs';
import {withLocalReminderRunner,runner,localConfig} from './reminder-database-local-fixture.mjs';
import {createReminderWorkerRpc} from '../lib/notifications/reminderDatabase.server.ts';
await withLocalReminderRunner(async({password,pool,environment})=>{
 const rpc=createReminderWorkerRpc(environment,pool),status=await rpc('status');assert.equal(status.enabled,false);
 const client=await pool.connect();
 try {
  assert.equal((await client.query('select current_user,session_user')).rows[0].current_user,runner);
  for(const statement of [
   'select * from public.volunteer_profiles limit 0','update public.volunteer_profiles set id=id where false',
   'select * from public.calendar_assignments limit 0','select * from auth.users limit 0','select * from vault.decrypted_secrets limit 0',
   'select * from public.communication_recipients limit 0',"select public.read_volunteer_schedule('invalid')",
   "select public.run_assignment_reminder_worker('status','{}')", // NOINHERIT: must explicitly assume worker.
   "select project_local_reminder_infrastructure.activate_delivery('not approved')",
   'create table public.reminder_forbidden(id integer)','set local role postgres','set local role authenticated','set local role service_role','set session authorization postgres',
   `grant authenticated to ${runner}`,`alter role ${runner} superuser`,`alter role ${runner} connection limit 10`,'alter role project_local_reminder_worker login',
  ]) {
   await client.query('BEGIN');await assert.rejects(client.query(statement),e=>e.code==='42501');await client.query('ROLLBACK');
  }
  await client.query('BEGIN');await client.query('SET LOCAL ROLE project_local_reminder_worker');
  await assert.rejects(client.query('select * from public.volunteer_profiles limit 0'),e=>e.code==='42501');await client.query('ROLLBACK');
  // Explicit owner-approved exceptions: catalogue source and temporary objects.
  const catalog=await client.query("select length(prosrc)>0 as visible from pg_proc where proname='activate_delivery'");assert.equal(catalog.rows[0].visible,true);
  await client.query('BEGIN');await client.query('create temporary table reminder_allowed_temp(id integer) on commit drop');await client.query('ROLLBACK');
 }finally{client.release();}
 // Fresh login after owner password change: old password denied, new accepted.
 const next=randomBytes(32).toString('hex');sql(`alter role ${runner} password ${q(next)}`);
 const old=new pg.Client(localConfig(password));await assert.rejects(old.connect(),e=>e.code==='28P01');await old.end();
 const replacement=new pg.Client(localConfig(next));await replacement.connect();await replacement.end();
 sql(`alter role ${runner} nologin`);
 const revoked=new pg.Client(localConfig(next));await assert.rejects(revoked.connect(),e=>e.code==='28000');await revoked.end();
 sql(`alter role ${runner} login`);
 console.log('PASS real local narrow LOGIN -> transaction-local worker -> status Off; role reset; 18 raw SQL privilege/role-escape denials; approved catalogue/TEMP exceptions; password rotation and NOLOGIN revoke new connections; public/Auth fingerprints exact. Local direct connection only, not a hosted Supavisor claim.');
});
