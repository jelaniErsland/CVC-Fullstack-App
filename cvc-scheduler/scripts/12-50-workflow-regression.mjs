import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fixture, q, sql, value } from './12-47-local-fixtures.mjs';

const f = await fixture();
const reviewer = randomUUID(), reviewerContact = randomUUID();
let quickAccess;
try {
  const ordinary = value(f.auth(`select public.create_calendar_item(${q(f.ws)},null,'Ordinary operation','general','timed',${q(f.dayAt(5))},null,'09:00','11:00',1,'PRIVATE INSTRUCTIONS','{}')`));
  assert.equal(value(`select publication_state || '|' || explicit_draft from public.calendar_items where id=${q(ordinary)}`),'published|false');
  assert.equal(value(`select count(*) from public.communication_operations where workspace_id=${q(f.ws)}`),'0');
  assert.equal(value(`select count(*) from public.assignment_notification_deliveries where workspace_id=${q(f.ws)}`),'0');
  value(f.auth(`select public.create_calendar_assignment(${q(ordinary)},${q(f.volunteers[0])},null)`));
  assert(JSON.stringify(JSON.parse(value(`select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) from public.read_volunteer_schedule(${q(f.token)}) r`))).includes('Ordinary operation'));
  quickAccess=JSON.parse(value(f.auth(`select row_to_json(t) from public.issue_project_quick_view_access(${q(f.ws)}) t`)));
  const quick=JSON.stringify(JSON.parse(value(`select row_to_json(t) from public.read_project_quick_view_by_token(${q(quickAccess.bearer_token)},${q(f.dayAt(5))}) t`)));
  assert(quick.includes('Ordinary operation'));
  assert(!quick.includes('PRIVATE INSTRUCTIONS'));

  const draft = value(f.auth(`select public.create_calendar_item_draft(${q(f.ws)},null,'Intentional draft','general','timed',${q(f.dayAt(6))},null,'09:00','11:00',1,'PRIVATE DRAFT INSTRUCTIONS','{}')`));
  assert.equal(value(`select publication_state || '|' || explicit_draft from public.calendar_items where id=${q(draft)}`),'draft|true');
  assert.equal(sql(f.auth(`select public.create_calendar_assignment(${q(draft)},${q(f.volunteers[0])},null)`),true).status!==0,true);
  assert(!value(`select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) from public.read_volunteer_schedule(${q(f.token)}) r`).includes('Intentional draft'));
  assert(!value(`select row_to_json(t) from public.read_project_quick_view_by_token(${q(quickAccess.bearer_token)},${q(f.dayAt(6))}) t`).includes('Intentional draft'));

  sql(`insert into auth.users(id,email) values(${q(reviewer)},${q(reviewer+'@example.invalid')});
    insert into public.project_contacts(id,auth_user_id,status) values(${q(reviewerContact)},${q(reviewer)},'active');
    insert into public.workspace_contact_grants(workspace_id,project_contact_id,role,capabilities,status,valid_from)
      values(${q(f.ws)},${q(reviewerContact)},'main_contact',array['workspace.read','calendar.view','calendar.edit','assignments.view','assignments.edit'],'active',now()-interval '1 day');`);
  const reviewAuth=query=>`begin;set local role authenticated;set local request.jwt.claim.sub=${q(reviewer)};${query};commit;`;
  assert(value(reviewAuth(`select count(*) from public.read_authorized_calendar_items(${q(f.ws)},null,null) where id=${q(draft)}`)).includes('1'));
  value(reviewAuth(`select public.activate_calendar_item(${q(draft)})`));
  assert.equal(value(`select publication_state || '|' || explicit_draft from public.calendar_items where id=${q(draft)}`),'published|false');
  value(f.auth(`select public.create_calendar_assignment(${q(draft)},${q(f.volunteers[0])},null)`));
  assert(value(`select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) from public.read_volunteer_schedule(${q(f.token)}) r`).includes('Intentional draft'));
  assert.equal(value(`select count(*) from public.communication_operations where workspace_id=${q(f.ws)}`),'0');
  assert.equal(value(`select count(*) from public.assignment_notification_deliveries where workspace_id=${q(f.ws)}`),'0');
  console.log('PASS: operational save, explicit draft guard, editor review/activation, volunteer and Quick View scope, no automatic email operation.');
} finally {
  if(quickAccess) sql(`delete from public.project_quick_view_access_tokens where workspace_id=${q(f.ws)}`);
  sql(`delete from public.workspace_contact_grants where project_contact_id=${q(reviewerContact)}`);
  await f.cleanup();
  sql(`delete from public.project_contacts where id=${q(reviewerContact)}; delete from auth.users where id=${q(reviewer)}`);
}
