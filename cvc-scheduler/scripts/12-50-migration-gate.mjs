import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const files = readdirSync(new URL('../supabase/migrations/', import.meta.url))
  .filter(name => /^\d{14}_[a-z0-9_]+\.sql$/.test(name)).sort();
const versions = files.map(name => name.slice(0,14));
const contract = readFileSync(new URL('./production-backup/ProjectLocalProductionMigrationContract.ps1', import.meta.url),'utf8');
assert.equal(files.length, 48, 'Expected 47 reviewed migrations plus 12.50.');
assert.equal(new Set(versions).size, versions.length, 'Migration versions must be unique.');
assert.deepEqual(files.slice(-3), [
  '20260930120000_household_identity_import.sql',
  '20260930130000_overnight_calendar_intervals.sql',
  '20261001120000_admin_workflow_activation.sql',
]);
assert(contract.includes('$AdminWorkflowActivationProductionMigration = "20261001120000"'));
assert(contract.includes('$CurrentMigration -ceq $OvernightCalendarProductionMigration -and $TargetMigration -ceq $AdminWorkflowActivationProductionMigration'));
const allowed = contract.match(/\$AllowedTerminalMigrations\s*=\s*@\(([^)]*)\)/)?.[1] ?? '';
assert(allowed.includes('$AdminWorkflowActivationProductionMigration'));
const releaseInProgress = contract.match(/\$ReleaseInProgressMigrations\s*=\s*@\(([^)]*)\)/)?.[1] ?? '';
assert(!releaseInProgress.includes('$AdminWorkflowActivationProductionMigration'));
const migration = readFileSync(new URL('../supabase/migrations/20261001120000_admin_workflow_activation.sql',import.meta.url),'utf8');
for(const marker of ['begin;', 'commit;', 'explicit_draft', 'calendar_item_operational_insert', 'guard_explicit_draft_assignment', 'activate_calendar_item', 'communication_preview', 'read_authorized_calendar_items']) assert(migration.includes(marker),`Missing reviewed marker: ${marker}`);
console.log('PASS: 48 ordered migrations, additive 12.50 migration and adjacent backup lock transition.');
