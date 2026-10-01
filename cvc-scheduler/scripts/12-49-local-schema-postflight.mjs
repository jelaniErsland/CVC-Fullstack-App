import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { verifyMigrationInventory } from './12-49-migration-gate.mjs';
import { readFileSync, readdirSync } from 'node:fs';

const files=readdirSync(new URL('../supabase/migrations/',import.meta.url)).filter(name=>/^\d{14}_[a-z0-9_]+\.sql$/.test(name)).sort();
const contract=readFileSync(new URL('./production-backup/ProjectLocalProductionMigrationContract.ps1',import.meta.url),'utf8');
const {final}=verifyMigrationInventory(files,contract);
const container=process.env.LOCAL_SCHEMA_CONTAINER || 'supabase_db_cvc-scheduler';
assert(/^supabase_db_cvc-(?:scheduler|1249-replay)$/.test(container),'Only a named local fixture database is supported.');
function scalar(query) {
  const result=spawnSync('docker',['exec','-i',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],{input:query,encoding:'utf8',windowsHide:true});
  assert.equal(result.status,0,result.stderr);
  return result.stdout.trim();
}
const versions=scalar('select version from supabase_migrations.schema_migrations order by version');
assert.deepEqual(versions.split(/\r?\n/),files.map(name=>name.slice(0,14)),'Local installed migration ledger differs from the reviewed inventory.');
assert.equal(versions.split(/\r?\n/).at(-1),final);
assert.equal(scalar("select count(*) from pg_constraint where conrelid='public.communication_recipients'::regclass and conname='communication_recipients_operation_id_email_key'"),'0','Shared-address unique constraint remains.');
assert.equal(scalar("select count(*) from pg_trigger where tgrelid='public.calendar_assignments'::regclass and tgname='calendar_assignment_publish_draft' and not tgisinternal"),'1','Assignment publication trigger is missing.');
assert.equal(scalar("select has_function_privilege('anon','public.publish_draft_on_assignment()','EXECUTE') or has_function_privilege('authenticated','public.publish_draft_on_assignment()','EXECUTE')"),'f','Internal publication trigger is callable.');
assert.equal(scalar("select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity"),'0','A public table lacks RLS.');
for(const [signature,marker] of [
  ['public.resolve_volunteer_schedule_contact(text,text)','choose_volunteer'],
  ['public.claim_initial_assignment_notification_deliveries(uuid)','not candidate.has_follow_up_contact'],
  ['public.communication_preview(uuid,jsonb)','endDate'],
  ['public.claim_communication_recipient(uuid,boolean)','sharedContact'],
  ['public.import_volunteer_profiles(uuid,uuid,jsonb)','Only an internal profile ID'],
  ['public.plan_calendar_assignments(uuid,uuid,jsonb,text)','tstzrange'],
]) {
  const definition=scalar(`select pg_get_functiondef('${signature}'::regprocedure)`);
  if(signature.includes('import_volunteer_profiles')) {
    assert(definition.includes('Matching volunteer changed.'),'CSV identity function missing reviewed name ambiguity guard.');
  } else assert(definition.includes(marker),`Reviewed function body missing marker: ${signature}`);
}
assert.equal(scalar("select has_function_privilege('anon','public.verify_volunteer_schedule_lookup(text,text,text)','EXECUTE')"),'f','Legacy surname lookup is still anonymously callable.');
assert.equal(scalar("select has_function_privilege('anon','public.resolve_volunteer_schedule_contact(text,text)','EXECUTE')"),'t','Contact lookup is not anonymously callable.');
assert.equal(scalar("select count(*) from pg_trigger where tgrelid='public.calendar_items'::regclass and tgname='calendar_timed_interval_timezone_check' and not tgisinternal"),'1','Timezone endpoint guard is missing.');
console.log(`PASS: local ${final} ledger, RLS, function guards, shared-address ledger and publication trigger.`);
