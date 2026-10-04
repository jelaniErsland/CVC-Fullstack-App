// Local fixtures only: never launch the permanent task or connect to production.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const task = 'scripts/production-backup/Register-ProjectLocalBackupTask.ps1';
const backup = 'scripts/production-backup/Invoke-ProjectLocalProductionBackup.ps1';
const current = '20261001120000';
const target = '20261003120000';
function fixture(action, before, after, shouldPass = true, scenario = 'Success') {
  const result = spawnSync('powershell', [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', task, '-FixtureMode',
    '-Action', action, '-FixtureScenario', scenario,
    '-CurrentExpectedMigration', before, '-ExpectedMigration', after,
  ], { encoding: 'utf8', windowsHide: true });
  assert.equal(result.status === 0, shouldPass, `${action} ${before} -> ${after}: ${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

assert.match(fixture('ValidateExpectedMigrationTransition', current, target), /mutation_performed=false/);
assert.match(fixture('UpdateExpectedMigration', current, target), /fixture_backup_migration_lock_transition_ok/);
for (const [before, after] of [
  ['20260930130000', target], // 47 -> 49 skips 48
  [target, current],
  [current, '20991231235959'],
  [current, '20261004120000'],
  [current, current],
]) {
  fixture('ValidateExpectedMigrationTransition', before, after, false);
  fixture('UpdateExpectedMigration', before, after, false);
}
for (const scenario of ['WrongCurrent', 'Duplicate', 'Enabled', 'Running', 'Queued', 'UnexpectedTaskIdentity', 'UnsupportedRuntime']) {
  fixture('UpdateExpectedMigration', current, target, false, scenario);
}
assert.match(fixture('HardenConsoleLaunch', current, current), /mutation_performed=false/);
fixture('HardenConsoleLaunch', current, current, false, 'WrongCurrent');
fixture('HardenConsoleLaunch', current, current, false, 'Running');
assert.match(fixture('ConfigureExecutionContext', current, current), /source=Interactive target=S4U.*mutation_performed=false/);
for (const scenario of ['WrongCurrent', 'Running', 'Queued', 'UnexpectedTaskIdentity']) {
  fixture('ConfigureExecutionContext', current, current, false, scenario);
}
fixture('ConfigureExecutionContext', '20260930130000', '20260930130000', false);

const source = readFileSync(backup, 'utf8');
const progress = spawnSync('powershell', [
  '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', backup,
  '-FixtureMode', '-FixtureScenario', 'SafeProgressJournal',
], { encoding: 'utf8', windowsHide: true });
assert.equal(progress.status, 0, `${progress.stdout}\n${progress.stderr}`);
assert.match(progress.stdout, /fixture_safe_progress_journal_ok/);
for (const marker of ['psql_preflight', 'dump_$Label', 'packaging', 'encryption', 'partialLocalArtifactExists', 'partialEncryptedArtifactExists', 'elapsedSeconds', 'exitCode', 'sessionId', 'userInteractive']) {
  assert.ok(source.includes(marker), `Missing safe backup progress marker: ${marker}`);
}
console.log('PASS 12.52 infrastructure: exact 48 -> 49 only, S4U context fixture and refusal cases, safe console hardening fixture, stage diagnostics.');
