// Fixture mode only: this test never reads or changes the permanent scheduled task.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const helper = 'scripts/production-backup/Register-ProjectLocalBackupTask.ps1';
const current = '20261003120000';
const target = '20261009120000';

function fixture(action, before, after, expectedSuccess, scenario = 'Success') {
  const result = spawnSync('powershell', [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', helper, '-FixtureMode',
    '-Action', action, '-FixtureScenario', scenario,
    '-CurrentExpectedMigration', before, '-ExpectedMigration', after,
  ], { encoding: 'utf8', windowsHide: true });
  assert.equal(result.status === 0, expectedSuccess,
    `${action} ${before} -> ${after} (${scenario}): ${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

for (const action of ['ValidateExpectedMigrationTransition', 'UpdateExpectedMigration']) {
  assert.match(fixture(action, current, target, true), /fixture_backup_migration_lock_transition/);
  for (const [before, after] of [
    ['20261001120000', target], // 48 -> 50 skips 49.
    ['20260930130000', target], // Earlier baseline skips two migrations.
    ['20990101120000', target], // Unknown current lock.
    [current, '20991231235959'], // Unknown future target.
    [current, '20261010120000'], // Unreviewed next target.
    [current, current], // No-op is not a reviewed transition.
    [target, current], // Reverse order.
  ]) fixture(action, before, after, false);
  for (const scenario of ['WrongCurrent', 'WrongTarget', 'UnexpectedTaskIdentity', 'UnsupportedRuntime']) {
    fixture(action, current, target, false, scenario);
  }
}
for (const scenario of ['Enabled', 'Running', 'Queued', 'Duplicate']) {
  fixture('UpdateExpectedMigration', current, target, false, scenario);
}

console.log('PASS 12.53 lock contract: exact 49 -> 50 accepted; skipped, unknown, reverse, unexpected-current, enabled, and busy cases rejected. Fixture mode performed no task mutation.');
