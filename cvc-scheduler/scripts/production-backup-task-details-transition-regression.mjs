// Local PowerShell fixtures only: no live task operation or hosted connection.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { taskDetailsRelease, verifyTaskDetailsReleaseContract, resolveTaskDetailsSmokeTerminal } from "./task-details-release-contract.mjs";

verifyTaskDetailsReleaseContract();
const task = "scripts/production-backup/Register-ProjectLocalBackupTask.ps1";
const backup = "scripts/production-backup/Invoke-ProjectLocalProductionBackup.ps1";
const contract = "scripts/production-backup/ProjectLocalProductionMigrationContract.ps1";
const sequence = [taskDetailsRelease.before, taskDetailsRelease.intermediate, taskDetailsRelease.final];
assert.equal(resolveTaskDetailsSmokeTerminal([]), sequence[2]);
for (const terminal of [sequence[0], sequence[2]]) assert.equal(resolveTaskDetailsSmokeTerminal(["--migration-terminal", terminal]), terminal);
for (const args of [["--migration-terminal", sequence[1]], ["--migration-terminal", "20991231235959"], ["--migration-terminal"], ["--force", sequence[2]]]) {
  assert.throws(() => resolveTaskDetailsSmokeTerminal(args));
}
function ps(args, succeeds = true, expected = null) {
  const result = spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", ...args], { encoding: "utf8", windowsHide: true });
  assert.equal(result.status === 0, succeeds, `${result.stdout}\n${result.stderr}`);
  if (expected) assert.match(result.stdout + result.stderr, expected);
}
for (let index = 0; index < 2; index++) {
  const current = sequence[index], target = sequence[index + 1];
  for (const action of ["ValidateExpectedMigrationTransition", "UpdateExpectedMigration"]) {
    ps(["-File", task, "-FixtureMode", "-Action", action, "-CurrentExpectedMigration", current, "-ExpectedMigration", target], true,
      action === "ValidateExpectedMigrationTransition" ? /mutation_performed=false/ : /fixture_backup_migration_lock_transition_ok/);
  }
  for (const state of ["Enabled", "Running", "Queued", "Duplicate", "UnexpectedTaskIdentity", "UnsupportedRuntime", "WrongCurrent", "WrongTarget"]) {
    ps(["-File", task, "-FixtureMode", "-Action", "UpdateExpectedMigration", "-FixtureScenario", state, "-CurrentExpectedMigration", current, "-ExpectedMigration", target], false);
  }
  ps(["-File", task, "-FixtureMode", "-Action", "UpdateExpectedMigration", "-CurrentExpectedMigration", target, "-ExpectedMigration", current], false);
}
for (const [current, target] of [[sequence[0], sequence[2]], [sequence[2], sequence[0]], [sequence[0], "20991231235959"], ["20260922150001", sequence[1]], [sequence[1], "not-a-migration"], [sequence[2], sequence[2]]]) {
  ps(["-File", task, "-FixtureMode", "-Action", "ValidateExpectedMigrationTransition", "-CurrentExpectedMigration", current, "-ExpectedMigration", target], false);
}
ps(["-File", task, "-FixtureMode", "-Action", "Enable", "-ExpectedMigration", sequence[1]], false, /completed release terminal/);
for (const final of [sequence[0], sequence[2], "20260714122230", "20260812123430", "20260908130000"]) {
  ps(["-File", task, "-FixtureMode", "-Action", "Enable", "-ExpectedMigration", final], true, /mutation_performed=false/);
}
for (const state of ["Enabled", "Running", "Queued", "UnexpectedTaskIdentity"]) {
  ps(["-File", task, "-FixtureMode", "-Action", "Enable", "-FixtureScenario", state, "-ExpectedMigration", sequence[2]], false);
}
ps(["-File", backup, "-FixtureMode", "-FixtureScenario", "MigrationPreflightTaskDetailsSequence"], true, /fixture_migration_preflight_task_details_sequence_ok/);
ps(["-Command", `. './${contract}'; if (-not (Test-ProjectLocalReleaseInProgressMigration '${sequence[1]}')) { throw 'intermediate missing' }; try { Assert-ProjectLocalBackupRunnableMigration '${sequence[1]}'; throw 'intermediate allowed' } catch { if ($_.Exception.Message -cne 'Backup execution/enablement requires a reviewed completed release terminal.') { throw } }; Assert-ProjectLocalBackupRunnableMigration '${sequence[2]}'; 'fixture_backup_execution_guard_ok'`], true, /fixture_backup_execution_guard_ok/);
const source = readFileSync(backup, "utf8");
assert.match(source, /if \(\$ExecuteProductionBackup\) \{\s*Assert-ProjectLocalBackupRunnableMigration/);
assert.match(readFileSync(task, "utf8"), /"Enable" \{\s*Assert-TransitionTaskIdentity[^\n]*\n\s*Assert-ProjectLocalBackupRunnableMigration/);
console.log("PASS exact Task Details adjacent transitions, pending-lock preflight, intermediate execution/enable denial, final/current/historical terminals, task-state/runtime/identity guards and approved application/migration contract.");
