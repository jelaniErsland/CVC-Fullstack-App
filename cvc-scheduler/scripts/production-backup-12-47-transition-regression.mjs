// Production-independent fixture proof. No production connection or task action.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const task='scripts/production-backup/Register-ProjectLocalBackupTask.ps1';
const backup='scripts/production-backup/Invoke-ProjectLocalProductionBackup.ps1';
const contract='scripts/production-backup/ProjectLocalProductionMigrationContract.ps1';
const versions=['20260908130000','20260922120000','20260922130000','20260922140000','20260922150000'];
function ps(args,pass=true){
  const result=spawnSync('powershell',['-NoProfile','-ExecutionPolicy','Bypass',...args],{encoding:'utf8',windowsHide:true});
  assert.equal(result.status===0,pass,`Unexpected fixture result: ${result.stdout}\n${result.stderr}`);
  return result.stdout+result.stderr;
}
for(let index=0;index<4;index++){
  const current=versions[index],target=versions[index+1];
  assert.match(ps(['-File',task,'-FixtureMode','-Action','ValidateExpectedMigrationTransition','-CurrentExpectedMigration',current,'-ExpectedMigration',target]),/mutation_performed=false/);
  assert.match(ps(['-File',task,'-FixtureMode','-Action','UpdateExpectedMigration','-CurrentExpectedMigration',current,'-ExpectedMigration',target]),/fixture_backup_migration_lock_transition_ok/);
  for(const state of ['Enabled','Running','Queued','Duplicate','UnexpectedTaskIdentity','UnsupportedRuntime']){
    ps(['-File',task,'-FixtureMode','-Action','UpdateExpectedMigration','-FixtureScenario',state,'-CurrentExpectedMigration',current,'-ExpectedMigration',target],false);
  }
  if(index<3)ps(['-File',task,'-FixtureMode','-Action','UpdateExpectedMigration','-CurrentExpectedMigration',current,'-ExpectedMigration',versions[index+2]],false);
  ps(['-File',task,'-FixtureMode','-Action','UpdateExpectedMigration','-CurrentExpectedMigration',target,'-ExpectedMigration',current],false);
}
for(const target of ['20991231235959','not-a-migration']){
  ps(['-File',task,'-FixtureMode','-Action','UpdateExpectedMigration','-CurrentExpectedMigration',versions[0],'-ExpectedMigration',target],false);
}
for(const intermediate of versions.slice(1,4)){
  ps(['-File',task,'-FixtureMode','-Action','Enable','-ExpectedMigration',intermediate],false);
}
assert.match(ps(['-File',task,'-FixtureMode','-Action','Enable','-ExpectedMigration',versions[4]]),/mutation_performed=false/);
for(const state of ['Running','Enabled','Queued','UnexpectedTaskIdentity']){
  ps(['-File',task,'-FixtureMode','-Action','Enable','-FixtureScenario',state,'-ExpectedMigration',versions[4]],false);
}
assert.match(ps(['-File',backup,'-FixtureMode','-FixtureScenario','MigrationPreflight1247Sequence']),/fixture_migration_preflight_1247_sequence_ok/);
const guardSource=readFileSync(contract,'utf8');
const backupSource=readFileSync(backup,'utf8');
const taskSource=readFileSync(task,'utf8');
assert.ok(/function Assert-ProjectLocalBackupRunnableMigration/.test(guardSource),'Intermediate-run guard missing');
assert.ok(/if \(\$ExecuteProductionBackup\) \{\s*Assert-ProjectLocalBackupRunnableMigration/.test(backupSource),'Backup runtime guard missing');
assert.ok(/"Enable" \{\s*Assert-TransitionTaskIdentity[^\n]*\n\s*Assert-ProjectLocalBackupRunnableMigration/.test(taskSource),'Task enable guard missing');
assert.ok(/runtimeSource\.Contains\('Assert-ProjectLocalBackupRunnableMigration'\)/.test(taskSource),'Installed runtime guard validation missing');
const guardCommand=`. './${contract}'; foreach ($v in @('20260922120000','20260922130000','20260922140000')) { try { Assert-ProjectLocalBackupRunnableMigration -Migration $v; throw 'intermediate unexpectedly runnable' } catch { if ($_.Exception.Message -cne 'Backup execution/enablement requires a reviewed completed release terminal.') { throw } } }; Assert-ProjectLocalBackupRunnableMigration -Migration '20260922150000'; 'fixture_intermediate_backup_denied'`;
assert.match(ps(['-Command',guardCommand]),/fixture_intermediate_backup_denied/);
console.log('PASS 12.47 exact four-step transitions: current/pending, interrupted old/new lock, intermediate STOP, wrong/skipped/future/malformed, task status and backup-run guards.');
