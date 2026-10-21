import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fixture, sql, value, q } from './12-47-local-fixtures.mjs';
const f=await fixture();
try {
 const assignments=JSON.parse(value(`select jsonb_agg(id) from public.calendar_assignments where workspace_id=${q(f.ws)}`));
 const query=`select min(r.finalized_at) from public.communication_assignment_coverage ac join public.communication_recipients r on r.id=ac.recipient_id where ac.assignment_id=${q(assignments[1])} and ac.initially_unsent and r.state='sent'`;
 const result=sql(`begin;
 create temp table reminder_plan_ids(id uuid primary key) on commit drop;
 insert into reminder_plan_ids select gen_random_uuid() from generate_series(1,10000);
 insert into public.communication_operations(id,workspace_id,actor_id,kind,mode,plan) select id,${q(f.ws)},${q(f.contact)},'schedule','new','{}' from reminder_plan_ids;
 insert into public.communication_recipients(id,workspace_id,operation_id,volunteer_id,email,snapshot,state,finalized_at) select id,${q(f.ws)},id,${q(f.volunteers[0])},'local-plan@example.invalid','{}','sent',now() from reminder_plan_ids;
 insert into public.communication_assignment_coverage(workspace_id,recipient_id,assignment_id,initially_unsent) select ${q(f.ws)},id,${q(assignments[0])},true from reminder_plan_ids;
 analyze public.communication_assignment_coverage;analyze public.communication_recipients;
 drop index if exists public.assignment_reminder_coverage_anchor;
 select 'BEFORE';explain(analyze,format json) ${query};
 create index assignment_reminder_coverage_anchor on public.communication_assignment_coverage(assignment_id) where initially_unsent;
 select 'AFTER';explain(analyze,format json) ${query};
 rollback;`).stdout;
 const [before,after]=result.split('BEFORE\n')[1].split('AFTER\n').map(JSON.parse);
 assert(JSON.stringify(before).includes('Seq Scan'));assert(JSON.stringify(after).includes('assignment_reminder_coverage_anchor'));
 fs.mkdirSync(new URL('../docs/audits/12-57-evidence/',import.meta.url),{recursive:true});
 fs.writeFileSync(new URL('../docs/audits/12-57-evidence/initial-anchor-explain.json',import.meta.url),JSON.stringify({historicalCoverage:10000,before,after},null,2)+'\n');
 console.log(JSON.stringify({historicalCoverage:10000,beforeMs:before[0]['Execution Time'],afterMs:after[0]['Execution Time'],historicalProbeUsesIndex:true}));
} finally {await f.cleanup();}
