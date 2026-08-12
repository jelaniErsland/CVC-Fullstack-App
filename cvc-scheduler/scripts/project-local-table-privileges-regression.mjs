import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import {
  buildProjectLocalDefaultTablePrivilegeQuery,
  buildProjectLocalDirectTablePrivilegeQuery,
  compareProjectLocalDefaultTablePrivileges,
  compareProjectLocalDirectTablePrivileges,
  projectLocalExpectedDirectTablePrivileges,
  projectLocalProtectedGrantees,
  projectLocalTableNames,
  projectLocalTablePrivilegeContract,
} from "../lib/security/projectLocalTablePrivileges.server.ts";

const root = process.cwd();
const migrationVersion = "20260812123430";
const migrationPath = path.join(
  root,
  "supabase",
  "migrations",
  `${migrationVersion}_project_local_table_privilege_hardening.sql`,
);
const restorePath = path.join(
  root,
  "scripts",
  "production-backup",
  "Test-ProjectLocalBackupRestore.ps1",
);
const aclHelperPath = path.join(
  root,
  "scripts",
  "production-backup",
  "ProjectLocalTableAclRestore.ps1",
);

function read(file) {
  return readFileSync(file, "utf8");
}

function runFixture(scenario) {
  return spawnSync(
    "powershell",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      restorePath,
      "-FixtureMode",
      "-FixtureScenario",
      scenario,
    ],
    { cwd: root, encoding: "utf8", windowsHide: true },
  );
}

function assertFixturePasses(scenario, marker) {
  const result = runFixture(scenario);
  assert.equal(result.status, 0, `${scenario} fixture failed.`);
  assert(result.stdout.includes(marker), `${scenario} fixture omitted its safe success marker.`);
}

function assertFixtureFailsClosed(scenario, marker) {
  const result = runFixture(scenario);
  assert.notEqual(result.status, 0, `${scenario} fixture unexpectedly passed.`);
  const output = `${result.stdout}\n${result.stderr}`;
  assert(output.includes(marker), `${scenario} fixture omitted its safe failure classification.`);
  assert(!/syntheticpassword|postgres(?:ql)?:\/\/|bearer|service[_-]?role[_-]?key/i.test(output));
}

function verifyContract() {
  assert.equal(projectLocalTablePrivilegeContract.version, migrationVersion);
  assert.equal(projectLocalTablePrivilegeContract.creatorRole, "postgres");
  assert.deepEqual([...projectLocalProtectedGrantees].sort(), ["PUBLIC", "anon", "authenticated"]);
  assert.equal(projectLocalTableNames.length, 13);
  assert.equal(projectLocalExpectedDirectTablePrivileges.length, 9);
  assert(
    projectLocalExpectedDirectTablePrivileges.every(
      (row) => row.grantee === "authenticated" && row.privilege_type === "SELECT",
    ),
  );

  const exact = compareProjectLocalDirectTablePrivileges(projectLocalExpectedDirectTablePrivileges);
  assert.deepEqual(exact, { unexpected: [], missing: [] });

  const unknown = compareProjectLocalDirectTablePrivileges([
    ...projectLocalExpectedDirectTablePrivileges,
    {
      table_name: "workspaces",
      grantee: "authenticated",
      privilege_type: "SYNTHETIC_FUTURE_PRIVILEGE",
    },
  ]);
  assert.equal(unknown.unexpected.length, 1, "Unknown table privileges must fail closed.");

  const missing = compareProjectLocalDirectTablePrivileges(
    projectLocalExpectedDirectTablePrivileges.slice(1),
  );
  assert.equal(missing.missing.length, 1, "Missing approved table privileges must fail exact comparison.");

  const defaultUnknown = compareProjectLocalDefaultTablePrivileges([
    {
      owner_name: "postgres",
      schema_name: "public",
      grantee: "anon",
      privilege_type: "SYNTHETIC_FUTURE_PRIVILEGE",
    },
  ]);
  assert.equal(defaultUnknown.unexpected.length, 1, "Unknown default privileges must fail closed.");

  const directQuery = buildProjectLocalDirectTablePrivilegeQuery();
  const defaultQuery = buildProjectLocalDefaultTablePrivilegeQuery();
  assert(directQuery.includes("aclexplode") && defaultQuery.includes("aclexplode"));
  assert(!directQuery.includes("privilege_type in"), "The privilege contract must not enumerate a bad list.");
  assert(!defaultQuery.includes("privilege_type in"), "The default contract must not enumerate a bad list.");
}

function verifyMigration() {
  const migration = read(migrationPath);
  assert.match(
    migration,
    /alter default privileges for role postgres in schema public\s+revoke all privileges on tables from anon, authenticated, PUBLIC;/i,
  );
  assert.match(
    migration,
    /revoke all privileges on table[\s\S]+from anon, authenticated, PUBLIC;/i,
  );
  assert.match(migration, /grant select on table[\s\S]+to authenticated;/i);
  assert.doesNotMatch(migration, /grant all/i);
  assert.doesNotMatch(migration, /\bservice_role\b/i);
  for (const table of projectLocalTableNames) {
    assert(migration.includes(`public.${table}`), `Privilege migration omitted ${table}.`);
  }
  const authenticatedSelectTables = projectLocalExpectedDirectTablePrivileges.map(
    (row) => row.table_name,
  );
  assert.equal(new Set(authenticatedSelectTables).size, 9);

  const migrationDirectory = path.join(root, "supabase", "migrations");
  const tableCreatingMigrations = readdirSync(migrationDirectory)
    .filter((name) => name.endsWith(".sql") && name <= `${migrationVersion}_zzzz.sql`)
    .map((name) => read(path.join(migrationDirectory, name)))
    .filter((source) => /create table public\./i.test(source));
  assert(tableCreatingMigrations.length > 0);
  for (const source of tableCreatingMigrations) {
    assert.doesNotMatch(source, /^\s*set\s+role\b/im, "Table migrations switch away from the postgres creator role.");
    assert.doesNotMatch(source, /^\s*alter\s+table[^;]+owner\s+to\b/im, "Table migrations override the postgres creator owner.");
  }
}

function verifyRestoreBoundary() {
  const restore = read(restorePath);
  const helper = read(aclHelperPath);
  assert(restore.includes("target_default_acl_neutralization"));
  assert(restore.includes("source_table_acl_reconciliation"));
  assert(restore.includes("ApplyRecoveryForward"));
  assert(helper.includes("source_table_acl_contract_mismatch"));
  assert(helper.includes("Split-ProjectLocalSqlStatements"));
  assert(helper.includes("REVOKE ALL PRIVILEGES ON TABLE"));
  assert(helper.includes("ALTER DEFAULT PRIVILEGES FOR ROLE postgres"));
  assert(!helper.includes("privilege_type in"));
  assertFixturePasses("SourceAclPlan", "fixture_source_acl_plan_ok");
  assertFixtureFailsClosed("SourceAclUnknownPrivilege", "source_table_acl_contract_mismatch");
  assertFixtureFailsClosed("SourceAclGrantAll", "source_protected_table_grant_all_unsupported");
  assertFixtureFailsClosed("SourceAclDuplicateTable", "source_table_shape_mismatch");
  assertFixtureFailsClosed("SourceAclMissingTable", "source_table_shape_mismatch");
  assertFixtureFailsClosed("SourceAclUnsupportedOwnership", "source_security_statement_shape_unclassified");
  assertFixturePasses("SourceAclFunctionBodyFalsePositive", "fixture_source_acl_function_body_ignored_ok");
}

verifyContract();
verifyMigration();
verifyRestoreBoundary();

console.log(
  "Project Local table privileges are centralized, exact, future-unknown fail-closed, default-hardened, and source-reconciled.",
);
