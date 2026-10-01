import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// Local release inventory only. Live production, artifact and installed-task
// checks remain the separate established-production preflight.
const base='20260927120000';
const pending=['20260930120000_household_identity_import.sql','20260930130000_overnight_calendar_intervals.sql'];
export function verifyMigrationInventory(files,contract) {
  assert.equal(files.length,47,'Expected 45 reviewed historical migrations plus two 12.49 migrations.');
  assert.deepEqual(files,[...files].sort(),'Migration files are out of order.');
  assert.equal(files[44]?.slice(0,14),base,'The reviewed production baseline is missing or reordered.');
  assert.deepEqual(files.filter(name=>name.slice(0,14)>base),pending,'Pending migrations differ from the reviewed 12.49 sequence.');
  assert.equal(new Set(files.map(name=>name.slice(0,14))).size,files.length,'Migration versions must be unique.');
  const final=pending.at(-1).slice(0,14);
  assert(contract.includes(`$OvernightCalendarProductionMigration = "${final}"`),
    `Backup contract does not declare migration ${final}.`);
  assert(contract.includes('$InstructionPrivacyProductionMigration -and $TargetMigration -ceq $HouseholdIdentityImportProductionMigration') && contract.includes('$HouseholdIdentityImportProductionMigration -and $TargetMigration -ceq $OvernightCalendarProductionMigration'),
    `Backup contract lacks the reviewed adjacent ${base} -> ${final} lock transitions.`);
  const allowed=contract.match(/\$AllowedTerminalMigrations\s*=\s*@\(([^)]*)\)/)?.[1] ?? '';
  const inProgress=contract.match(/\$ReleaseInProgressMigrations\s*=\s*@\(([^)]*)\)/)?.[1] ?? '';
  assert(allowed.includes('$OvernightCalendarProductionMigration'),
    `Backup contract does not allow final terminal ${final}.`);
  assert(!inProgress.includes('$OvernightCalendarProductionMigration'),
    'Final terminal must not be classified as release-in-progress.');
  return {count:files.length,base,final};
}
if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const files=readdirSync(new URL('../supabase/migrations/',import.meta.url))
    .filter(name=>/^\d{14}_[a-z0-9_]+\.sql$/.test(name)).sort();
  const contract=readFileSync(new URL('./production-backup/ProjectLocalProductionMigrationContract.ps1',import.meta.url),'utf8');
  const result=verifyMigrationInventory(files,contract);
  const scripts=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).scripts;
  assert.equal(scripts['gate:12-49-local-postflight'],'node scripts/12-49-local-schema-postflight.mjs',
    'The reviewed local schema postflight is missing from package scripts.');
  console.log(`PASS: ${result.count} ordered migrations and reviewed backup transition ${result.base} -> ${result.final}.`);
}
