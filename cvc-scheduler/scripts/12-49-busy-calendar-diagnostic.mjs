import assert from 'node:assert/strict';
import { fixture, q, value, sql } from './12-47-local-fixtures.mjs';

// Disposable loopback database diagnostic. No provider or production requests.
const f=await fixture();
try {
  sql(`insert into public.volunteer_profiles
    (workspace_id,profile_source,manual_created_by_project_contact_id,manual_created_at,lifecycle,readiness_status,full_name,email,availability_snapshot,skills_help_snapshot)
    select ${q(f.ws)},'manual',${q(f.contact)},now(),'active','ready',
      'Synthetic volunteer '||n, 'synthetic-'||n||'-${f.ws}@example.invalid','{}'::jsonb,'{}'::jsonb
    from generate_series(1,297) n;`);
  sql(`insert into public.calendar_items
    (workspace_id,task_preset_id,title_snapshot,task_type_snapshot,schedule_kind,start_date,start_time,end_time,timezone,needed_count,lifecycle,created_by_project_contact_id,publication_state,published_at,published_by_project_contact_id)
    select ${q(f.ws)},${q(f.preset)},'Synthetic busy item '||n,'general','timed',
      ${q(f.day)}::date+(n%30),'08:00'::time,'11:00'::time,'America/Denver',2,'active',${q(f.contact)},'published',now(),${q(f.contact)}
    from generate_series(1,294) n;`);
  sql(`with volunteers as (select id,row_number() over(order by full_name,id) n from public.volunteer_profiles where workspace_id=${q(f.ws)}),
    items as (select id,row_number() over(order by title_snapshot,id) n from public.calendar_items where workspace_id=${q(f.ws)})
    insert into public.calendar_assignments(workspace_id,calendar_item_id,volunteer_profile_id,lifecycle,created_by_auth_user_id)
    select ${q(f.ws)},i.id,v.id,'active',${q(f.user)} from items i join volunteers v using(n) where i.n>3;`);
  sql(`insert into public.assignment_responses(workspace_id,assignment_id,response_status,response_source,updated_by_auth_user_id)
    select ${q(f.ws)},a.id,'needs_response','project_contact',${q(f.user)} from public.calendar_assignments a
    where a.workspace_id=${q(f.ws)} and not exists(select 1 from public.assignment_responses r where r.assignment_id=a.id);`);
  const count=Number(value(`select count(*) from public.volunteer_profiles where workspace_id=${q(f.ws)}`));
  const itemCount=Number(value(`select count(*) from public.calendar_items where workspace_id=${q(f.ws)}`));
  assert.equal(count,300);assert.equal(itemCount,300);
  const rangeEnd=f.dayAt(31);
  function measured(query) {
    const output=value(f.auth(`explain (analyze,buffers,format json) ${query}`));
    const plan=JSON.parse(output)[0];
    return {planningMs:plan['Planning Time'],executionMs:plan['Execution Time'],sharedHitBlocks:plan.Plan['Shared Hit Blocks']??0,rows:plan.Plan['Actual Rows']};
  }
  const calendar=[];const assignments=[];
  for(let n=0;n<3;n++) {
    calendar.push(measured(`select id from public.read_authorized_calendar_items(${q(f.ws)},${q(f.day)},${q(rangeEnd)}) where start_date>=${q(f.day)} and start_date<${q(rangeEnd)}`));
    assignments.push(measured(`select id from public.calendar_assignments where workspace_id=${q(f.ws)} and calendar_item_id in (select id from public.calendar_items where workspace_id=${q(f.ws)} and start_date>=${q(f.day)} and start_date<${q(rangeEnd)})`));
  }
  assert(calendar.every(run=>run.rows>=300),'Calendar diagnostic did not return busy-month items.');
  console.log(JSON.stringify({fixture:'disposable_local_300_volunteers_300_items',calendar,assignments,productionIncidentReproduced:false}));
} finally { await f.cleanup(); }
