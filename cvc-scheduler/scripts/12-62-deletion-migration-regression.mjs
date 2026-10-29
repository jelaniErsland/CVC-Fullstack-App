// Local DB57 -> DB58 only. Never imports a production connection or provider.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {sql,value,q} from './12-47-local-fixtures.mjs';
import {reminderFingerprint} from './reminder-database-local-fixture.mjs';
const version='20261028120000';
const source=fs.readFileSync('supabase/migrations/20261028120000_volunteer_deletion_lifecycle.sql','utf8');
assert(source.startsWith('-- 12.62:'));const start=source.indexOf('\nbegin;\n'),end=source.lastIndexOf('\ncommit;');
assert(start>0&&end>start);const body=source.slice(start+'\nbegin;\n'.length,end);
assert(!/^commit;$/m.test(body),'Only the outer transaction is stripped; function bodies stay exact');
const ledger=()=>value("select count(*)||'|'||max(version) from supabase_migrations.schema_migrations");
assert.equal(ledger(),'57|20261026120000');
const catalogue=()=>value(`select md5(string_agg(x,'|' order by x)) from (
 select pg_get_functiondef(p.oid)||coalesce(p.proacl::text,'')||p.proowner::text x from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
 union all select c.oid::regclass::text||c.relrowsecurity||c.relforcerowsecurity||coalesce(c.relacl::text,'') from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
 union all select conname||pg_get_constraintdef(oid) from pg_constraint where connamespace='public'::regnamespace
 union all select polname||coalesce(pg_get_expr(polqual,polrelid),'') from pg_policy where polrelid in(select oid from pg_class where relnamespace='public'::regnamespace)
) facts`);
const stableData=()=>value(`select md5(string_agg(schemaname||'.'||tablename||':'||(xpath('/row/hash/text()',query_to_xml(format(
 'select md5(coalesce(jsonb_agg(to_jsonb(t)-%L::text[] order by (to_jsonb(t)-%L::text[])::text)::text,''[]'')) hash from %I.%I t',
 case when schemaname='public' and tablename in('volunteer_profiles','calendar_assignments','communication_recipients','volunteer_welcome_deliveries','assignment_notification_deliveries','questionnaire_submissions') then '{deleted_at,deleted_by,removal_reason,recipient_redacted_at,personal_data_redacted_at}' else '{}' end,
 case when schemaname='public' and tablename in('volunteer_profiles','calendar_assignments','communication_recipients','volunteer_welcome_deliveries','assignment_notification_deliveries','questionnaire_submissions') then '{deleted_at,deleted_by,removal_reason,recipient_redacted_at,personal_data_redacted_at}' else '{}' end,
 schemaname,tablename),false,true,'')))[1]::text,'|' order by schemaname,tablename)) from pg_tables where schemaname='public' or (schemaname='auth' and tablename in('users','identities','sessions','refresh_tokens'))`);
const before={data:reminderFingerprint(),catalogue:catalogue(),stable:stableData(),activation:value('select row_to_json(t) from public.assignment_reminder_activation t')};
const insert=`insert into supabase_migrations.schema_migrations(version,name,statements) values(${q(version)},'volunteer_deletion_lifecycle',array[${q(source)}]);`;
const failed=sql(`begin;${body}\n${insert}\ndo $forced$ begin raise exception '12.62 forced failure';end $forced$;commit;`,true);
assert.notEqual(failed.status,0);assert(failed.stderr.includes('12.62 forced failure'),failed.stderr);
assert.equal(ledger(),'57|20261026120000');assert.equal(reminderFingerprint(),before.data);assert.equal(catalogue(),before.catalogue);
console.log('PASS forced failure rolls back migration, ledger, ACL/RLS, definitions and public/Auth data');
sql(`begin;${body}\n${insert}\ncommit;`);
assert.equal(ledger(),'58|'+version);assert.equal(stableData(),before.stable,'Existing operational/Auth values unchanged by schema apply');
assert.equal(value('select row_to_json(t) from public.assignment_reminder_activation t'),before.activation);
assert.equal(value("select count(*) from public.volunteer_profiles where deleted_at is not null"),'0');
assert.equal(value("select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where n.nspname='public' and a.grantee=0 and a.privilege_type='EXECUTE'"),'0');
console.log('PASS clean local migration58, no deletion/backfill/activation/provider action, existing data preserved');
