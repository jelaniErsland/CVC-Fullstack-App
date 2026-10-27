// Actual-activity depth, separate from the large future-schedule fixture.
// Local Docker only; synthetic events, no claim/finalize/provider/worker calls.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fixture,sql,value,q } from './12-47-local-fixtures.mjs';
import { reminderFingerprint } from './reminder-database-local-fixture.mjs';
const f=await fixture();
const assignment=value(`select id from public.calendar_assignments where calendar_item_id=${q(f.items[0])} and volunteer_profile_id=${q(f.volunteers[0])}`);
try {
 sql(`update public.calendar_items set start_date=current_date-60 where id=${q(f.items[0])};
 insert into public.assignment_reminder_enrollments(assignment_id,workspace_id,volunteer_id,response_status,response_baseline,start_at) values(${q(assignment)},${q(f.ws)},${q(f.volunteers[0])},'confirmed',now()-interval '90 days',now()-interval '60 days');
 insert into public.assignment_reminder_occurrences(workspace_id,assignment_id,volunteer_id,kind,occurrence_key,due_at,start_at,enrolled_at,scheduling_state)
 select ${q(f.ws)},${q(assignment)},${q(f.volunteers[0])},'response','pending:'||n,now()-interval '61 days',now()-interval '60 days',now()-interval '90 days','expired' from generate_series(1,1000)n;
 insert into public.assignment_reminder_events(occurrence_id,workspace_id,event,happened_at,due_at,attempt)
 select o.id,o.workspace_id,case n%3 when 0 then 'unknown' when 1 then 'sent' else 'failed' end,now()-n*interval '1 minute',o.due_at,1 from (select x.*,row_number() over(order by id)n from public.assignment_reminder_occurrences x where workspace_id=${q(f.ws)})o;
 update public.calendar_assignments set lifecycle='canceled' where id=${q(assignment)};
 update public.calendar_items set lifecycle='archived' where id=${q(f.items[0])};
 analyze public.assignment_reminder_occurrences;analyze public.assignment_reminder_events;`);
 const call=cursor=>`select public.read_assignment_reminder_workspace(${q(f.ws)},'history',null,${q(cursor?JSON.stringify(cursor):null)}::jsonb,50)`;
 const before=reminderFingerprint()+'|'+value('select last_value::text||is_called::text from public.assignment_reminder_events_id_seq');
 let cursor=null,deep=null,pages=0;const ids=new Set();
 do{const page=JSON.parse(value(f.auth(call(cursor))));if(pages===19)deep=cursor;for(const row of page.rows){assert(!ids.has(row.id));ids.add(row.id);}pages++;cursor=page.nextCursor;}while(cursor);
 assert.equal(ids.size,1000);assert.equal(pages,20);assert(deep);
 const plans={newest:JSON.parse(value(f.auth(`explain(analyze,buffers,format json) ${call(null)}`))),deep:JSON.parse(value(f.auth(`explain(analyze,buffers,format json) ${call(deep)}`)))};
 assert.equal(reminderFingerprint()+'|'+value('select last_value::text||is_called::text from public.assignment_reminder_events_id_seq'),before);
 fs.writeFileSync(new URL('../docs/audits/12-58-evidence/history-scale.json',import.meta.url),JSON.stringify({actualOutcomes:1000,pages,deepPage:20,plans},null,2)+'\n');
 console.log(JSON.stringify({actualOutcomes:1000,pages,newestMs:plans.newest[0]['Execution Time'],deepMs:plans.deep[0]['Execution Time'],readOnly:true}));
}finally{sql(`delete from public.assignment_reminder_events where workspace_id=${q(f.ws)};delete from public.assignment_reminder_occurrences where workspace_id=${q(f.ws)};delete from public.assignment_reminder_enrollments where workspace_id=${q(f.ws)};`);await f.cleanup();}
