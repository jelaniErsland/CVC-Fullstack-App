import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { verifyMigrationInventory } from './12-49-migration-gate.mjs';

const files=readdirSync(new URL('../supabase/migrations/',import.meta.url)).filter(name=>/^\d{14}_.*\.sql$/.test(name)).sort();
const contract=readFileSync(new URL('./production-backup/ProjectLocalProductionMigrationContract.ps1',import.meta.url),'utf8');
assert.equal(verifyMigrationInventory(files,contract).final,'20260930130000');
assert.throws(()=>verifyMigrationInventory(files.slice(0,-1),contract),/45 reviewed historical/);
assert.throws(()=>verifyMigrationInventory([files[1],files[0],...files.slice(2)],contract),/out of order/);
assert.throws(()=>verifyMigrationInventory(files,contract.replace('$OvernightCalendarProductionMigration = "20260930130000"','$OvernightCalendarProductionMigration = "20260927120000"')),/does not declare/);
assert.throws(()=>verifyMigrationInventory(files,contract.replace('($CurrentMigration -ceq $HouseholdIdentityImportProductionMigration -and $TargetMigration -ceq $OvernightCalendarProductionMigration)','')),/lacks the reviewed adjacent/);
assert.throws(()=>verifyMigrationInventory(files,contract.replace('$HouseholdIdentityImportProductionMigration,\n  $OvernightCalendarProductionMigration','$HouseholdIdentityImportProductionMigration')),/does not allow final/);

function fixture(action,current,target,passes) {
  const result=spawnSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File','scripts/production-backup/Register-ProjectLocalBackupTask.ps1','-FixtureMode','-Action',action,'-CurrentExpectedMigration',current,'-ExpectedMigration',target],{encoding:'utf8',windowsHide:true});
  assert.equal(result.status===0,passes,`${action} ${current} -> ${target} should ${passes?'pass':'fail'} locally.`);
}
fixture('ValidateExpectedMigrationTransition','20260927120000','20260930120000',true);
fixture('UpdateExpectedMigration','20260927120000','20260930120000',true);
fixture('ValidateExpectedMigrationTransition','20260930120000','20260930130000',true);
fixture('UpdateExpectedMigration','20260930120000','20260930130000',true);
fixture('ValidateExpectedMigrationTransition','20260926120000','20260930120000',false);
fixture('ValidateExpectedMigrationTransition','20260930120000','20260927120000',false);
fixture('ValidateExpectedMigrationTransition','20260927120000','20991231235959',false);
console.log('PASS: complete sequence, missing/reordered migrations, stale lock declarations, and adjacent task-lock fixture boundaries.');
