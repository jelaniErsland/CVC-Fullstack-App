import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const container='supabase_db_cvc-scheduler';
function sql(source, allowFailure=false) {
  const r=spawnSync('docker',['exec','-i',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],{input:source,encoding:'utf8',windowsHide:true});
  if (!allowFailure) assert.equal(r.status,0,r.stderr);
  return r;
}
const migration=readFileSync('supabase/migrations/20261010120000_calendar_range_same_day_end.sql','utf8').replaceAll('\r\n','\n');
const previous=readFileSync('supabase/migrations/20261001120000_admin_workflow_activation.sql','utf8');
const start=previous.indexOf('create or replace function public.read_authorized_calendar_items(');
const oldFunction=previous.slice(start,previous.indexOf('$$;',start)+3);
const newFunction=migration.replace(/^begin;/,'').replace(/commit;\s*$/,'');
assert.equal(newFunction.slice(newFunction.indexOf('create or replace')).trim(),oldFunction.replace('p_range_start is null or item.end_date is null or item.end_date >= p_range_start','p_range_start is null or coalesce(item.end_date, item.start_date) >= p_range_start').trim(),'Only overlap predicate changes');
const securityQuery=`select md5(string_agg(row_to_json(p)::text,',' order by p.oid)) from pg_policy p; select proowner,proacl,prosecdef,proconfig from pg_proc where oid='public.read_authorized_calendar_items(uuid,date,date)'::regprocedure; select relrowsecurity,relforcerowsecurity from pg_class where oid='public.calendar_items'::regclass;`;
const securityBefore=sql(securityQuery).stdout;
const originalDefinition=sql("select pg_get_functiondef('public.read_authorized_calendar_items(uuid,date,date)'::regprocedure)").stdout;
const ws='54545454-5454-4454-8454-000000000001', other='54545454-5454-4454-8454-000000000002', user='54545454-5454-4454-8454-000000000003', contact='54545454-5454-4454-8454-000000000004';
const auth=`set local role authenticated; set local request.jwt.claim.sub='${user}';`;
const result=sql(`begin;
${oldFunction}
insert into public.workspaces(id,workspace_key,display_name,lifecycle,timezone) values ('${ws}','qa-1254b-a','Synthetic A','active','America/Denver'),('${other}','qa-1254b-b','Synthetic B','active','America/Denver');
insert into auth.users(id,email) values ('${user}','1254b@example.invalid');
insert into public.project_contacts(id,auth_user_id,status) values ('${contact}','${user}','active');
insert into public.workspace_contact_grants(workspace_id,project_contact_id,role,capabilities,status,valid_from) values ('${ws}','${contact}','main_contact',array['workspace.read','calendar.view','calendar.edit','assignments.view'],'active',now()-interval '1 day');
insert into public.calendar_items(workspace_id,title_snapshot,task_type_snapshot,schedule_kind,start_date,start_time,end_time,timezone,needed_count,lifecycle,created_by_project_contact_id,publication_state,published_by_project_contact_id,published_at,schedule_notes)
select '${ws}','Historical '||n,'general','timed','2030-01-01'::date+n,'08:00','10:00','America/Denver',1,'active','${contact}','published','${contact}',now(),'PRIVATE INSTRUCTION' from generate_series(0,288) n;
${auth}
select 'empty-future-before|'||count(*) from public.read_authorized_calendar_items('${ws}','2031-02-01','2031-03-01');
reset role;
${newFunction}
${auth}
select 'empty-future-after|'||count(*) from public.read_authorized_calendar_items('${ws}','2031-02-01','2031-03-01');
do $$ begin
 if (select count(*) from public.read_authorized_calendar_items('${ws}','2031-02-01','2031-03-01'))<>0 then raise exception 'historical leak'; end if;
 if (select count(*) from public.read_authorized_calendar_items('${ws}','2030-01-01','2030-01-01'))<>1 then raise exception 'same day'; end if;
 if (select count(*) from public.read_authorized_calendar_items('${ws}','2029-12-01','2029-12-31'))<>0 then raise exception 'future leak'; end if;
end $$;
reset role;
insert into public.calendar_items(workspace_id,title_snapshot,task_type_snapshot,schedule_kind,start_date,end_date,start_time,end_time,timezone,needed_count,lifecycle,created_by_project_contact_id,publication_state,published_by_project_contact_id,published_at)
values ('${ws}','Overnight','general','timed','2031-04-01','2031-04-02','22:00','06:00','America/Denver',1,'active','${contact}','published','${contact}',now()),
('${ws}','Multi-day','general','multi_day_window','2031-04-10','2031-04-14',null,null,'America/Denver',0,'active','${contact}','published','${contact}',now()),
('${other}','Other project','general','timed','2031-04-01',null,'08:00','10:00','America/Denver',1,'active','${contact}','published','${contact}',now());
${auth}
do $$ declare d date; begin
 for d in select generate_series('2031-04-01'::date,'2031-04-02'::date,'1 day')::date loop
  if (select count(*) from public.read_authorized_calendar_items('${ws}',d,d))<>1 then raise exception 'overnight'; end if;
 end loop;
 for d in select generate_series('2031-04-10'::date,'2031-04-14'::date,'1 day')::date loop
  if (select count(*) from public.read_authorized_calendar_items('${ws}',d,d))<>1 then raise exception 'multi-day boundary'; end if;
 end loop;
 if (select count(*) from public.read_authorized_calendar_items('${ws}','2031-04-03','2031-04-09'))<>0 then raise exception 'gap'; end if;
 if (select count(*) from public.read_authorized_calendar_items('${ws}','2031-04-15','2031-04-30'))<>0 then raise exception 'after end'; end if;
 if (select count(*) from public.read_authorized_calendar_items('${other}',null,null))<>0 then raise exception 'project isolation'; end if;
end $$;
reset role;
update public.workspace_contact_grants set capabilities=array['workspace.read','calendar.view','assignments.view'] where workspace_id='${ws}';
${auth}
do $$ begin if exists(select 1 from public.read_authorized_calendar_items('${ws}',null,null) where schedule_notes is not null or custom_values<>'{}'::jsonb) then raise exception 'instruction privacy'; end if; end $$;
reset role;
rollback;
`);
assert.match(result.stdout,/empty-future-before\|289/); assert.match(result.stdout,/empty-future-after\|0/);
assert.equal(sql(securityQuery).stdout,securityBefore,'RLS, owner and privileges unchanged after rollback');
assert.equal(sql("select pg_get_functiondef('public.read_authorized_calendar_items(uuid,date,date)'::regprocedure)").stdout,originalDefinition,'Rollback restores exact original definition');
const forced=migration.replace(/commit;\s*$/,`do $$ begin raise exception 'forced failure'; end $$; commit;`);
assert.notEqual(sql(forced,true).status,0);
assert.equal(sql("select pg_get_functiondef('public.read_authorized_calendar_items(uuid,date,date)'::regprocedure)").stdout,originalDefinition,'Failed migration rolls back');
if(process.argv.includes('--apply-local')) {
  sql(migration.replace(/commit;\s*$/,`insert into supabase_migrations.schema_migrations(version,name,statements) values ('20261010120000','calendar_range_same_day_end',array[]::text[]) on conflict(version) do nothing; commit;`));
  assert.equal(sql(securityQuery).stdout,securityBefore,'Applied migration leaves policies/grants unchanged');
}
console.log(result.stdout.trim());
console.log('PASS same-day, past/future exclusion, overnight, multi-day inclusive SQL boundaries, project isolation, instruction privacy, unchanged RLS/grants, exact rollback and forced-failure rollback'+(process.argv.includes('--apply-local')?'; applied locally only':''));
