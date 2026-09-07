// Explicit fresh/empty local-stack migration proof. Never accepts a hosted target.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

assert(process.argv.includes('--fresh-empty-local'), 'Explicit fresh-empty-local opt-in required');
function run(command, args, input) {
  const result = spawnSync(command, args, { encoding: 'utf8', input, windowsHide: true, shell: command === 'npx' && process.platform === 'win32', maxBuffer: 8 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr || 'Local migration command failed');
  return result.stdout.trim();
}
const sql = statement => run('docker', ['exec','-i','supabase_db_cvc-scheduler','psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'], statement);
const config = JSON.parse(run('npx', ['supabase','status','--output','json']));
assert.equal(new URL(config.API_URL).hostname, '127.0.0.1');
assert.equal(sql('select count(*) from public.workspaces;'), '0', 'Refuse to reset a populated local workspace');
run('npx', ['supabase','db','reset','--local','--version','20260905130000']);
assert.equal(sql('select max(version) from supabase_migrations.schema_migrations;'), '20260905130000');
const ws = randomUUID(), contact = randomUUID(), actor = randomUUID(), item = randomUUID(), token = randomUUID();
const q = value => "'" + value + "'";
try {
  sql('insert into auth.users(id,email) values (' + q(actor) + ",'migration-review@example.invalid'); insert into public.project_contacts(id,auth_user_id) values (" + q(contact) + ',' + q(actor) + '); insert into public.workspaces(id,workspace_key,display_name,lifecycle,timezone,starts_on,ends_on) values (' + q(ws) + ",'qa-1245-migration','Migration review','active','America/Denver','2026-09-29','2099-12-31'); insert into public.project_days(workspace_id,project_date,expected_on_site_count,created_by_project_contact_id,updated_by_project_contact_id) values (" + q(ws) + ",'2026-10-06',321," + q(contact) + ',' + q(contact) + '); insert into public.calendar_items(id,workspace_id,title_snapshot,task_type_snapshot,schedule_kind,start_date,timezone,needed_count,custom_values) values (' + q(item) + ',' + q(ws) + ",'Historical work','general','date_based','2026-10-06','America/Denver',2,'{\"zone\":\"North\"}'); insert into public.project_quick_view_access_tokens(id,workspace_id,token_verifier_hash,expires_at) values (" + q(token) + ',' + q(ws) + ",decode(repeat('ab',32),'hex'),now()+interval '1 day');");
  const history = sql('select row_to_json(d) from public.project_days d where workspace_id=' + q(ws));
  const itemBefore = JSON.parse(sql('select row_to_json(i) from public.calendar_items i where id=' + q(item)));
  run('npx', ['supabase','migration','up','--local']);
  assert.equal(sql('select max(version) from supabase_migrations.schema_migrations;'), '20260906130000');
  assert.equal(sql('select row_to_json(d) from public.project_days d where workspace_id=' + q(ws)), history);
  const after = JSON.parse(sql('select row_to_json(i) from public.calendar_items i where id=' + q(item)));
  for (const key of ['meal_kind','meal_provider','meal_contact','meal_menu','meal_total']) { assert.equal(after[key], null); delete after[key]; }
  assert.deepEqual(after, itemBefore, 'Historical Calendar definition is unchanged');
  assert.equal(sql('select count(*) from public.project_quick_view_access_tokens where id=' + q(token) + ' and revoked_at is not null'), '1', 'Prior narrow-audience link retained and revoked');
  assert.equal(sql("select count(*) from public.task_presets where workspace_id=" + q(ws) + " and is_system_preset and system_key in ('breakfast','lunch') and task_type='food' and lifecycle='active'"), '2', 'Existing workspace receives both persisted meal presets');
  const generated = run('npx', ['supabase','gen','types','typescript','--local','--schema','public,graphql_public']);
  const saved = await readFile('lib/supabase/database.types.ts','utf8');
  assert.equal(generated.replaceAll('\r\n','\n').trim(), saved.replaceAll('\r\n','\n').trim(), 'Generated database type parity');
  console.log('PASS full adjacent migration, historical Project Day and Calendar preservation, prior-link revocation, generated DB type parity');
} finally {
  sql('delete from public.project_quick_view_access_tokens where workspace_id=' + q(ws) + '; delete from public.project_days where workspace_id=' + q(ws) + '; delete from public.calendar_items where workspace_id=' + q(ws) + '; delete from public.task_presets where workspace_id=' + q(ws) + '; delete from public.workspaces where id=' + q(ws) + '; delete from public.project_contacts where id=' + q(contact) + '; delete from auth.users where id=' + q(actor) + ';');
}
