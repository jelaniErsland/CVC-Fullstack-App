import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
export const q=v=>v==null?'null':`'${String(v).replaceAll("'","''")}'`;
export function sql(query,fail=false){const r=spawnSync('docker',['exec','-i','supabase_db_cvc-scheduler','psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],{input:query,encoding:'utf8',windowsHide:true});if(!fail)assert.equal(r.status,0,r.stderr);return r;}
export const value=query=>sql(query).stdout.trim();
export async function fixture(browser=false){
  const admin=browser?await (await import('./bulk-assignment-browser.mjs')).createBrowserAdmin():null;
  const ws=randomUUID(),user=admin?.id??randomUUID(),contact=randomUUID(),volunteers=[],items=[];
  const date=new Date();date.setUTCDate(date.getUTCDate()+7);const day=date.toISOString().slice(0,10);
  const dayAt=n=>{const d=new Date(day+'T12:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
  const auth=query=>`begin;set local role authenticated;set local request.jwt.claim.sub=${q(user)};${query};commit;`;
  sql(`insert into public.workspaces(id,workspace_key,display_name,lifecycle,timezone,starts_on,ends_on) values(${q(ws)},${q('qa-1247-'+ws)},'Bozeman · LOCAL FIXTURE','active','America/Denver',${q(day)},${q(dayAt(60))});
    ${admin?'':`insert into auth.users(id,email) values(${q(user)},${q(user+'@example.invalid')});`}
    insert into public.project_contacts(id,auth_user_id,status,volunteer_facing_display_name,volunteer_facing_email) values(${q(contact)},${q(user)},'active','Local coordinator','coordinator@example.invalid');
    insert into public.workspace_contact_grants(workspace_id,project_contact_id,role,capabilities,status,valid_from)
    values(${q(ws)},${q(contact)},'main_contact',array['workspace.read','volunteers.view','volunteers.edit','calendar.view','calendar.edit','tasks.view','tasks.edit','assignments.view','assignments.edit','questionnaires.review'],'active',now()-interval '1 day');`);
  for(const [i,name] of ['Alex Morgan','Casey Jordan','Riley Chen'].entries()) volunteers.push(value(auth(`select public.create_manual_volunteer_profile(${q(ws)},${q(JSON.stringify({fullName:name,email:`fixture-${ws}-${i}@example.invalid`,phone:`+1202555010${i}`,dateOfBirth:'1980-01-01',emergencyContactName:'PRIVATE EMERGENCY',profileNotes:'PRIVATE PROFILE'}))})`)));
  const preset=value(auth(`select public.create_task_preset(${q(ws)},'Site preparation','Prepare the work area','general',3,true,'[]','blue')`));
  sql(`insert into public.task_presets(workspace_id,name,task_type,default_needed_count,volunteer_visible,is_system_preset,system_key,color_key)
    values(${q(ws)},'Breakfast','food',1,true,true,'breakfast','orange'),(${q(ws)},'Lunch','food',1,true,true,'lunch','gold');`);
  for(let i=0;i<3;i++) {
    const id=value(auth(`select public.create_calendar_item(${q(ws)},${q(preset)},null,null,'timed',${q(dayAt(i))},null,'08:00','11:00',3,'Bring work gloves.','{}')`));
    items.push(id);value(auth(`select public.publish_calendar_item(${q(id)})`));
    value(auth(`select public.create_calendar_assignments_batch(${q(id)},array[${volunteers.slice(0,2).map(q).join(',')}]::uuid[],null)`));
  }
  for(let i=0;i<3;i++) value(auth(`select public.save_calendar_meal(${q(ws)},null,'lunch',${q(dayAt(i))},'12:00','13:00','Local meal team','PRIVATE MEAL CONTACT',${q(['Garden sandwiches and fruit','Rice bowls with roasted vegetables','Soup and fresh bread'][i])},25,'PRIVATE OPERATIONS',null)`));
  const access=JSON.parse(value(auth(`select row_to_json(t) from public.issue_volunteer_schedule_access(${q(volunteers[0])},720) t`)));
  async function cleanup(){
    sql(`delete from public.assignment_notification_deliveries where workspace_id=${q(ws)};delete from public.volunteer_welcome_deliveries where workspace_id=${q(ws)};
      delete from public.communication_assignment_coverage where workspace_id=${q(ws)};delete from public.communication_recipients where workspace_id=${q(ws)};delete from public.communication_operations where workspace_id=${q(ws)};
      delete from public.volunteer_csv_import_operations where workspace_id=${q(ws)};delete from public.volunteer_away_periods where workspace_id=${q(ws)};delete from public.workspace_project_photos where workspace_id=${q(ws)};
      delete from public.volunteer_schedule_access_tokens where workspace_id=${q(ws)};delete from public.assignment_responses where workspace_id=${q(ws)};delete from public.calendar_assignments where workspace_id=${q(ws)};
      delete from public.calendar_repeat_creation_requests where workspace_id=${q(ws)};delete from public.calendar_bulk_assignment_operations where workspace_id=${q(ws)};
      delete from public.calendar_items where workspace_id=${q(ws)};delete from public.volunteer_profiles where workspace_id=${q(ws)};delete from public.task_presets where workspace_id=${q(ws)};
      delete from public.workspace_contact_grants where workspace_id=${q(ws)};delete from public.project_contacts where id=${q(contact)};delete from public.workspaces where id=${q(ws)};delete from auth.users where id=${q(user)};`);
  }
  return {admin,ws,user,contact,volunteers,items,preset,day,dayAt,auth,token:access.bearer_token,tokenId:access.token_id,cleanup};
}
