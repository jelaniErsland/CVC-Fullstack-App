// LOCAL ONLY: ephemeral password, no hosted key, token, provider or credential.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import pg from 'pg';
import {q,sql,value} from './12-47-local-fixtures.mjs';
export const runner='project_local_reminder_runner';
export const localConfig=password=>({host:'127.0.0.1',port:54322,user:runner,password,database:'postgres',ssl:false,max:1,connectionTimeoutMillis:3000,idleTimeoutMillis:100,allowExitOnIdle:true});
export const fixtureEnvironment=password=>{
 const url=new URL('postgresql://aws-1-us-west-2.pooler.supabase.com:6543/postgres');url.username=runner+'.wdlaauzknfggoqldolmx';url.password=password;
 return {REMINDER_SCHEDULER_HMAC_SECRET:'4'.repeat(64),REMINDER_DATABASE_URL:url.toString(),ASSIGNMENT_NOTIFICATION_EMAIL_TRANSPORT:'resend',ASSIGNMENT_NOTIFICATION_FROM:'Local fixture <fixture@example.invalid>',ASSIGNMENT_NOTIFICATION_BASE_URL:'https://projectlocal.app'};
};
export const reminderFingerprint=()=>value(`select md5(string_agg(schemaname||'.'||tablename||':'||(xpath('/row/hash/text()',query_to_xml(format('select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,''[]'')) hash from %I.%I t',schemaname,tablename),false,true,'')))[1]::text,'|' order by schemaname,tablename)) from pg_tables where schemaname='public' or (schemaname='auth' and tablename in('users','identities','sessions','refresh_tokens'))`);
export async function withLocalReminderRunner(test){
 assert.equal(value("select rolcanlogin and not rolsuper and not rolcreatedb and not rolcreaterole and not rolbypassrls and not rolinherit and rolconnlimit=2 from pg_roles where rolname='project_local_reminder_runner'"),'t','Apply local migration55 first');
 assert.equal(value('select delivery_enabled from public.assignment_reminder_activation'),'f');
 const password=randomBytes(32).toString('hex'),pool=new pg.Pool(localConfig(password)),before=reminderFingerprint();
 try {
  const unprovisioned=new pg.Client(localConfig(password));
  await assert.rejects(unprovisioned.connect(),/password authentication failed/);await unprovisioned.end();
  sql(`alter role ${runner} password ${q(password)};`);
  await test({password,pool,environment:fixtureEnvironment(password)});
 }finally{
  await pool.end();sql(`alter role ${runner} login password null;`);
  assert.equal(reminderFingerprint(),before,'Local Off transport must not mutate public/Auth data');
 }
}
