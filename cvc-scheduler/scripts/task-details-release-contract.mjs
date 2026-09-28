// Release/recovery metadata only. Never imported by application routes.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

export const taskDetailsRelease = Object.freeze(JSON.parse(readFileSync(new URL("./production-backup/task-details-release-contract.json", import.meta.url), "utf8")));

export function resolveTaskDetailsSmokeTerminal(args) {
  if (args.length === 0) return taskDetailsRelease.final;
  assert.equal(args.length, 2, "Expected only --migration-terminal and an exact reviewed steady-state terminal");
  assert.equal(args[0], "--migration-terminal");
  assert([taskDetailsRelease.before, taskDetailsRelease.final].includes(args[1]), "Unknown or intermediate production smoke terminal");
  return args[1];
}

export function verifyTaskDetailsReleaseContract() {
  const release = taskDetailsRelease;
  assert.deepEqual([release.before, release.intermediate, release.final], ["20260922150000", "20260926120000", "20260927120000"]);
  assert.deepEqual(release.migrations.map(m => m.file), ["20260926120000_assignment_instructions.sql", "20260927120000_instruction_privacy.sql"]);
  const versions = readdirSync(new URL("../supabase/migrations/", import.meta.url)).filter(f => /^\d{14}_.*\.sql$/.test(f)).sort();
  assert.equal(versions.length, 45);
  assert.deepEqual(versions.filter(f => f.slice(0, 14) > release.before), release.migrations.map(m => m.file));
  for (const migration of release.migrations) {
    const contents = readFileSync(new URL(`../supabase/migrations/${migration.file}`, import.meta.url), "utf8").replaceAll("\r\n", "\n");
    assert.equal(createHash("sha256").update(contents).digest("hex"), migration.sha256, "Reviewed migration content changed");
    const approved = spawnSync("git", ["show", `${release.applicationCommit}:cvc-scheduler/supabase/migrations/${migration.file}`], { encoding: "utf8", windowsHide: true });
    assert.equal(approved.status, 0);
    assert.equal(approved.stdout.replaceAll("\r\n", "\n"), contents, "Migration differs from the approved application candidate");
  }
  const ancestry = spawnSync("git", ["merge-base", "--is-ancestor", release.applicationCommit, "HEAD"], { windowsHide: true });
  assert.equal(ancestry.status, 0, "Recovery checkout must include the compatible approved application");
  const appDiff = spawnSync("git", ["diff", release.applicationCommit, "--", "app", "components", "lib", "proxy.ts", "supabase/migrations"], { encoding: "utf8", windowsHide: true });
  assert.equal(appDiff.status, 0);
  assert.equal(appDiff.stdout, "", "Harness update must not change approved application or migrations");
  return versions;
}
