import assert from 'node:assert/strict';
import { fixture,q,value,sql } from './12-47-local-fixtures.mjs';

const f=await fixture();
let quickAccess;
try {
  const historic=value(f.auth(`select public.create_calendar_item_draft(${q(f.ws)},null,'Intentional private draft','general','timed',${q(f.dayAt(4))},null,'09:00','11:00',1,null,'{}')`));
  const ordinary=value(f.auth(`select public.create_calendar_item(${q(f.ws)},null,'Ordinary saved assignment','general','timed',${q(f.dayAt(5))},null,'09:00','11:00',1,null,'{}')`));
  assert.equal(value(`select publication_state from public.calendar_items where id=${q(historic)}`),'draft');
  assert.equal(value(`select publication_state from public.calendar_items where id=${q(ordinary)}`),'published');
  assert.notEqual(sql(f.auth(`select public.create_calendar_assignment(${q(historic)},${q(f.volunteers[0])},null)`),true).status,0,'Intentional draft requires activation.');
  const before=JSON.parse(value(`select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) from public.read_volunteer_schedule(${q(f.token)}) r`));
  assert(!JSON.stringify(before).includes('Intentional private draft'),'Draft stays invisible to volunteer.');
  value(f.auth(`select public.create_calendar_assignment(${q(ordinary)},${q(f.volunteers[0])},null)`));
  assert.equal(value(`select publication_state from public.calendar_items where id=${q(ordinary)}`),'published','Assignment save publishes an authorized creator draft.');
  const after=JSON.parse(value(`select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) from public.read_volunteer_schedule(${q(f.token)}) r`));
  assert(JSON.stringify(after).includes('Ordinary saved assignment'),'Saved assignment becomes individually visible.');
  assert(!JSON.stringify(after).includes('Intentional private draft'));
  quickAccess=JSON.parse(value(f.auth(`select row_to_json(t) from public.issue_project_quick_view_access(${q(f.ws)}) t`)));
  const quickDay=JSON.parse(value(`select row_to_json(t) from public.read_project_quick_view_by_token(${q(quickAccess.bearer_token)},${q(f.dayAt(5))}) t`));
  assert(JSON.stringify(quickDay).includes('Ordinary saved assignment'),'Saved assignment becomes visible in authorized Quick View.');
  const quickHistorical=JSON.parse(value(`select row_to_json(t) from public.read_project_quick_view_by_token(${q(quickAccess.bearer_token)},${q(f.dayAt(4))}) t`));
  assert(!JSON.stringify(quickHistorical).includes('Intentional private draft'),'Draft remains absent from Quick View.');
  assert.equal(value(`select count(*) from public.assignment_notification_deliveries where workspace_id=${q(f.ws)}`),'0','Saving sends no initial email.');
  assert.equal(value(`select count(*) from public.communication_operations where workspace_id=${q(f.ws)}`),'0','Saving creates no communication operation.');
  console.log('PASS: ordinary item operational before assignment, intentional draft remains private and assignment-blocked, no email.');
} finally {
  if(quickAccess) sql(`delete from public.project_quick_view_access_tokens where workspace_id=${q(f.ws)}`);
  await f.cleanup();
}
