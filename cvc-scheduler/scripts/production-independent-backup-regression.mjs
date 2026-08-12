import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const root = process.cwd();
const backupDir = path.join(root, "scripts", "production-backup");
const backupScript = path.join(backupDir, "Invoke-ProjectLocalProductionBackup.ps1");
const restoreScript = path.join(backupDir, "Test-ProjectLocalBackupRestore.ps1");
const initializeSecretScript = path.join(backupDir, "Initialize-ProjectLocalBackupSecret.ps1");
const fixtureCredentials = [
  "syntheticPassword123",
  "synthetic@Password123",
  "synthetic:Password123",
  "synthetic/Password123",
  "synthetic#Password123",
  "synthetic%Password123",
  "synthetic?Password123",
  "synthetic+Password123",
  "synthetic Password123",
  "synthetic@:/#%?+ Password123",
  "syntheticScramVerifier123",
];

async function read(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

function assertIncludes(source, needle, label) {
  assert(source.includes(needle), `${label} missing ${needle}.`);
}

function assertNotIncludes(source, needle, label) {
  assert(!source.includes(needle), `${label} must not include ${needle}.`);
}

function assertOrder(source, before, after, label) {
  const beforeIndex = source.indexOf(before);
  const afterIndex = source.indexOf(after);
  assert(beforeIndex >= 0, `${label} missing before marker ${before}.`);
  assert(afterIndex >= 0, `${label} missing after marker ${after}.`);
  assert(beforeIndex < afterIndex, `${label} expected ${before} before ${after}.`);
}

function runPowerShell(args, { expectSuccess }) {
  const result = spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", ...args], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      SUPABASE_SERVICE_ROLE_KEY: "",
    },
  });
  const combined = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  for (const fixtureCredential of fixtureCredentials) {
    assert(!combined.includes(fixtureCredential), "Fixture output exposed a synthetic credential.");
  }
  assert(!/postgres(?:ql)?:\/\/|service_role|anon[_-]?key|password=|eyJ[A-Za-z0-9_-]+\./i.test(combined), "Fixture output leaked secret-like material.");
  if (expectSuccess) {
    assert.equal(result.status, 0, combined);
  } else {
    assert.notEqual(result.status, 0, "Expected fixture command to fail closed.");
  }
  return combined;
}

async function assertNoRouteImports() {
  const routeRoots = ["app", "components", "lib"];
  const files = [];
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".next") continue;
        await walk(full);
      } else if (/\.(tsx?|jsx?|mjs|cjs)$/.test(entry.name)) {
        files.push(full);
      }
    }
  }
  for (const relative of routeRoots) {
    await walk(path.join(root, relative));
  }
  for (const file of files) {
    if (file.includes(`${path.sep}lib${path.sep}readiness${path.sep}`)) continue;
    const source = await readFile(file, "utf8");
    assert(!source.includes("production-backup"), `${path.relative(root, file)} must not import production backup scripts.`);
    assert(!source.includes("ProjectLocalProductionBackup"), `${path.relative(root, file)} must not import production backup scripts.`);
  }
}

async function main() {
  const [
    packageJson,
    backup,
    restore,
    initSecret,
    task,
    runbook,
    setupDoc,
    recoveryContract,
    envContract,
    connectionValidator,
    roleRestoreHelper,
  ] = await Promise.all([
    read("package.json"),
    read("scripts/production-backup/Invoke-ProjectLocalProductionBackup.ps1"),
    read("scripts/production-backup/Test-ProjectLocalBackupRestore.ps1"),
    read("scripts/production-backup/Initialize-ProjectLocalBackupSecret.ps1"),
    read("scripts/production-backup/Register-ProjectLocalBackupTask.ps1"),
    read("docs/PRODUCTION_BACKUP_RECOVERY_RUNBOOK.md"),
    read("docs/INDEPENDENT_PRODUCTION_BACKUP_SETUP.md"),
    read("lib/readiness/productionRecoveryReadiness.server.ts"),
    read("lib/readiness/productionEnvironmentReadiness.server.ts"),
    read("scripts/production-backup/ProjectLocalProductionConnection.ps1"),
    read("scripts/production-backup/ProjectLocalRoleRestore.ps1"),
  ]);

  assertIncludes(packageJson, "test:production-independent-backup", "package.json");
  const oldRestoreUrlParam = "Target" + "Database" + "Url";
  const oldPlaceholderPassword = "local" + "-" + "password";

  for (const [label, source] of [
    ["backup script", backup],
    ["restore script", restore],
    ["secret setup script", initSecret],
    ["task script", task],
    ["connection validator", connectionValidator],
  ]) {
    assertIncludes(source, "Set-StrictMode -Version Latest", label);
    assert(!/SUPABASE_SERVICE_ROLE_KEY\s*=|sk_live|service-role-secret|age-secret-key-|postgres(?:ql)?:\/\/(?!\|)[^\\s`\"]+/i.test(source), `${label} contains secret-like material.`);
    assert(!/postgres(?:ql)?:\/\/\S+:\S+@/i.test(source), `${label} contains a password-bearing PostgreSQL URL.`);
  }
  assert(!/postgres(?:ql)?:\/\/\S+:\S+@/i.test(setupDoc), "independent backup setup doc contains a password-bearing PostgreSQL URL.");

  assertIncludes(backup, "-ExecuteProductionBackup", "backup script");
  assertIncludes(backup, "project-local-production", "backup script");
  assertIncludes(backup, "wdlaauzknfggoqldolmx", "backup script");
  assertIncludes(backup, "20260714122230", "backup script");
  assertIncludes(backup, "kfuujcfxoayukywvtaeh", "backup script");
  assertIncludes(backup, "SUPABASE_SERVICE_ROLE_KEY", "backup script");
  assertIncludes(backup, "ConvertTo-SecureString", "backup script");
  assertIncludes(backup, "ProjectLocalProductionConnection.ps1", "backup script");
  assertIncludes(backup, "ConvertTo-NativeArgumentString", "backup script");
  assertIncludes(backup, "--role-only", "backup script");
  assertIncludes(backup, "--use-copy", "backup script");
  assertIncludes(backup, "Get-Command \"docker\"", "backup script");
  assertIncludes(backup, "docker_preflight", "backup script");
  assertIncludes(backup, "supabase_migrations", "backup script");
  assertIncludes(backup, "storage.buckets_vectors", "backup script");
  assertIncludes(backup, "storage.vector_indexes", "backup script");
  assertIncludes(backup, "manifest.json", "backup script");
  assertIncludes(backup, "age-encryption.org/v1", "backup script");
  assertIncludes(backup, ".partial", "backup script");
  assertIncludes(backup, "System.Security.Cryptography.SHA256", "backup script");
  assertIncludes(backup, "latest-status.json", "backup script");
  assertIncludes(backup, "Remove-RecognizedBackups", "backup script");
  assertIncludes(backup, "finally", "backup script");
  assertIncludes(backup, "Remove-Item -LiteralPath $workRoot -Recurse -Force", "backup script");
  assertIncludes(backup, "FixtureMode", "backup script");
  assertIncludes(backup, "Project Local Backups\\production", "backup script");
  assertIncludes(backup, "SUPABASE_SERVICE_ROLE_KEY must not be present", "backup script");
  assertNotIncludes(backup, "-p ", "backup script");
  assertNotIncludes(backup, "--passphrase", "backup script");
  assertNotIncludes(backup, "AGE-SECRET-KEY", "backup script");

  assertIncludes(initSecret, "Read-Host", "secret setup script");
  assertIncludes(initSecret, "-AsSecureString", "secret setup script");
  assertIncludes(initSecret, "ConvertFrom-SecureString", "secret setup script");
  assertIncludes(initSecret, "ProjectLocalProductionConnection.ps1", "secret setup script");
  assertIncludes(initSecret, "System.Text.UTF8Encoding($false)", "secret setup script");
  assertIncludes(initSecret, "secure_string_character_count", "secret setup script");
  assertIncludes(initSecret, "secure_plaintext_lengths_match", "secret setup script");
  assertIncludes(initSecret, 'inputBoundary = "SecureString to BSTR to canonical URI"', "secret setup script");
  assertIncludes(initSecret, "Set-ProjectLocalSecretAcl", "secret setup script");
  assertIncludes(initSecret, "Test-ProjectLocalSecretAcl", "secret setup script");
  assertIncludes(initSecret, "SetAccessRuleProtection($true, $false)", "secret setup script");
  assertIncludes(initSecret, "RemoveAccessRuleSpecific", "secret setup script");
  assertIncludes(initSecret, '[System.IO.File]::GetAccessControl', "secret setup script");
  assertIncludes(initSecret, '[System.IO.File]::SetAccessControl', "secret setup script");
  assertIncludes(initSecret, "Production backup secret ACL verification failed", "secret setup script");
  assertIncludes(initSecret, "ProjectLocal\\ProductionBackup", "secret setup script");
  assertIncludes(initSecret, "Windows-only", "secret setup script");
  assertIncludes(initSecret, "does not create or store the age private recovery identity", "secret setup script");

  assertIncludes(task, "Register-ScheduledTask", "task script");
  assertIncludes(task, "-StartWhenAvailable", "task script");
  assertIncludes(task, "-ConfirmTaskAction", "task script");
  assertIncludes(task, "Refusing to silently replace", "task script");
  assertNotIncludes(task, "production-db-url", "task script");

  assertIncludes(restore, "Refusing production, staging, or hosted restore target", "restore script");
  assertIncludes(restore, "$HostName -notin", "restore script");
  assertIncludes(restore, "TargetHost", "restore script");
  assertIncludes(restore, "TargetPort", "restore script");
  assertIncludes(restore, "TargetDatabase", "restore script");
  assertIncludes(restore, "TargetUser", "restore script");
  assert(!/\[[^\]]+\]\$[A-Za-z]*Password\b/.test(restore.slice(0, restore.indexOf("Set-StrictMode"))), "restore operator parameters must not include a password parameter.");
  assertNotIncludes(restore, oldRestoreUrlParam, "restore script");
  assertIncludes(restore, "-ExecuteLocalRestore", "restore script");
  assertIncludes(restore, "VerifyExistingLocalRestore", "restore script");
  assertIncludes(restore, "UseSupabaseLocalDefaults", "restore script");
  assertIncludes(restore, "Assert-SupabaseLocalDefaultsTarget", "restore script");
  assertIncludes(restore, "exact 127.0.0.1:54322 postgres target", "restore script");
  assertIncludes(restore, "Local restore execution requires -ExecuteLocalRestore.", "restore script");
  assertIncludes(restore, "Read-Host \"Local disposable database password\" -AsSecureString", "restore script");
  assertIncludes(restore, "EnvironmentVariables[\"PGPASSWORD\"]", "restore script");
  assertIncludes(restore, "EnvironmentVariables.Remove(\"PGPASSWORD\")", "restore script");
  assertIncludes(restore, "ChildScopedSecret", "restore script");
  assertIncludes(restore, "ZeroFreeBSTR", "restore script");
  assertNotIncludes(restore, "$env:PGPASSWORD", "restore script");
  assertNotIncludes(restore, "SetEnvironmentVariable", "restore script");
  assertIncludes(restore, "age private identity", "restore script");
  assertIncludes(restore, "Backup package contains an unsafe path.", "restore script");
  assertIncludes(restore, "Backup package contains unexpected files.", "restore script");
  assertIncludes(restore, "Get-Command \"psql\"", "restore script");
  assertIncludes(restore, "System.Security.Cryptography.SHA256", "restore script");
  assertIncludes(restore, "psql --single-transaction --set ON_ERROR_STOP=1", "restore script");
  assertIncludes(restore, "string_agg(version, ',' order by version)", "restore script");
  assertIncludes(restore, "$ExpectedMigrationHistory", "restore script");
  assertIncludes(restore, "$ExpectedBaselineFunctions", "restore script");
  assertIncludes(restore, "read_assignment_notification_delivery_health", "restore script");
  assertIncludes(restore, "production_baseline_generated_type_mismatch", "restore script");
  assertIncludes(restore, "relation.relforcerowsecurity = true", "restore script");
  assertNotIncludes(restore, "pg_catalog.pg_tables where schemaname = 'public' and tablename in ($tableList) and forcerowsecurity", "restore script");
  assertIncludes(restore, "2ebe35912ae3ff203b249d92d8914a8af73bd9ca", "restore script");
  assertIncludes(restore, "auth_schema_or_data_represented", "restore script");
  assertIncludes(restore, "storage_object_blobs_represented", "restore script");
  assertIncludes(restore, "unsafe_broad_table_mutation_grants", "restore script");
  assertIncludes(restore, "decrypted_cleanup_failed", "restore script");
  assertIncludes(restore, 'throw "Local restore validation failed safely at $restoreStage with $safeFailureCode."', "restore script");
  assertIncludes(restore, "ProjectLocalRoleRestore.ps1", "restore script");
  assertIncludes(restore, "Write-ProjectLocalRoleRestoreSql", "restore script");
  assertIncludes(restore, 'Join-Path $extractRoot "roles-restore.sql"', "restore script");
  assertIncludes(restore, 'if ($name -eq "roles.sql") { $derivedRolesPath }', "restore script");
  assertIncludes(roleRestoreHelper, "Split-ProjectLocalSqlStatements", "role restore helper");
  assertIncludes(roleRestoreHelper, "New-ProjectLocalRoleRestorePlan", "role restore helper");
  assertIncludes(roleRestoreHelper, "Write-ProjectLocalRoleRestoreSql", "role restore helper");
  assertIncludes(roleRestoreHelper, "project_local_managed_role_missing", "role restore helper");
  assertIncludes(roleRestoreHelper, "project_local_managed_role_property_mismatch", "role restore helper");
  assertIncludes(roleRestoreHelper, "project_local_managed_role_configuration_mismatch", "role restore helper");
  assertIncludes(roleRestoreHelper, "project_local_managed_parameter_privilege_mismatch", "role restore helper");
  assertIncludes(roleRestoreHelper, "roles_sql_statement_class_unsupported", "role restore helper");
  assertIncludes(roleRestoreHelper, "roles_sql_user_privileged_property_refused", "role restore helper");
  assertIncludes(roleRestoreHelper, '"supabase_realtime_admin"', "role restore helper");
  assertNotIncludes(roleRestoreHelper, "-replace.*CREATE ROLE", "role restore helper");
  assertOrder(restore, "Get-TargetPsqlArguments", "Read-Host \"Local disposable database password\" -AsSecureString", "restore password prompt order");
  assertOrder(restore, "Get-Sha256Hex -Path $EncryptedBackupPath", "Read-Host \"Local disposable database password\" -AsSecureString", "restore password prompt order");
  assertOrder(restore, "Get-Command \"psql\"", "Read-Host \"Local disposable database password\" -AsSecureString", "restore password prompt order");
  assertOrder(restore, "Assert-ApprovedArchiveMembers", "Read-Host \"Local disposable database password\" -AsSecureString", "restore password prompt order");

  assertIncludes(runbook, "Path A - Preferred independent backup path", "backup/recovery runbook");
  assertIncludes(runbook, "Supabase Pro managed backups remain an optional future path", "backup/recovery runbook");
  assertIncludes(runbook, "PITR is unavailable and intentionally not required", "backup/recovery runbook");
  assertIncludes(runbook, "Database backups do not automatically prove recovery for Supabase Storage objects", "backup/recovery runbook");

  assertIncludes(setupDoc, "Windows Task Scheduler", "independent backup setup doc");
  assertIncludes(setupDoc, "DPAPI-protected database connection secret", "independent backup setup doc");
  assertIncludes(setupDoc, "docker version", "independent backup setup doc");
  assertIncludes(setupDoc, "psql --version", "independent backup setup doc");
  assertIncludes(setupDoc, "-ExecuteLocalRestore", "independent backup setup doc");
  assertIncludes(setupDoc, "-TargetHost", "independent backup setup doc");
  assertIncludes(setupDoc, "-TargetPort", "independent backup setup doc");
  assertIncludes(setupDoc, "-TargetDatabase", "independent backup setup doc");
  assertIncludes(setupDoc, "-TargetUser", "independent backup setup doc");
  assertIncludes(setupDoc, "Read-Host -AsSecureString", "independent backup setup doc");
  assertIncludes(setupDoc, "not placed in PowerShell history", "independent backup setup doc");
  assertNotIncludes(setupDoc, oldRestoreUrlParam, "independent backup setup doc");
  assertNotIncludes(setupDoc, oldPlaceholderPassword, "independent backup setup doc");
  assertIncludes(setupDoc, "public age recipient", "independent backup setup doc");
  assertIncludes(setupDoc, "private age recovery identity", "independent backup setup doc");
  assertIncludes(setupDoc, "GitHub Actions artifacts", "independent backup setup doc");
  assertIncludes(setupDoc, "old backups still require the old private identity", "independent backup setup doc");
  assertIncludes(setupDoc, "two secure copies", "independent backup setup doc");
  assertIncludes(setupDoc, "does not back up Supabase Storage object contents", "independent backup setup doc");

  assertIncludes(recoveryContract, "independent_backup_automation_foundation", "recovery contract");
  assertIncludes(recoveryContract, "Supabase Pro remains optional", "recovery contract");
  assertIncludes(recoveryContract, "PITR is unavailable and not required", "recovery contract");
  assertIncludes(envContract, "reviewed backup path", "environment contract");

  assertIncludes(connectionValidator, '@("postgres", "postgresql")', "connection validator");
  assertIncludes(connectionValidator, '"postgres.$ExpectedProjectRef"', "connection validator");
  assertIncludes(connectionValidator, '.pooler.supabase.com', "connection validator");
  assertIncludes(connectionValidator, "$uri.Port -ne 5432", "connection validator");
  assertIncludes(connectionValidator, '$uri.AbsolutePath -cne "/postgres"', "connection validator");
  assertIncludes(connectionValidator, "$uri.Query", "connection validator");
  assertIncludes(connectionValidator, "$uri.Fragment", "connection validator");
  assertIncludes(connectionValidator, "scheme_prefix_missing", "connection validator");
  assertIncludes(connectionValidator, "canonical_uri_parse_failed", "connection validator");
  for (const safeFact of [
    "plaintext_character_count",
    "trimmed_character_count",
    "starts_with_expected_scheme",
    "contains_exactly_one_scheme_separator",
    "contains_expected_username_marker",
    "contains_at_separator",
    "contains_expected_pooler_suffix",
    "contains_expected_port_marker",
    "ends_with_postgres_path",
    "contains_control_character",
    "contains_BOM",
    "contains_outer_quote",
    "uri_trycreate_success",
  ]) {
    assertIncludes(connectionValidator, safeFact, "connection validator diagnostics");
  }

  await assertNoRouteImports();

  assertIncludes(
    runPowerShell(["-File", initializeSecretScript, "-FixtureAclValidateOnly"], { expectSuccess: true }),
    "fixture_secret_acl_ok",
    "secret ACL fixture",
  );

  runPowerShell(["-File", backupScript], { expectSuccess: false });
  runPowerShell(["-File", backupScript, "-FixtureMode", "-FixtureScenario", "GuardStagingRef"], { expectSuccess: false });
  runPowerShell(["-File", backupScript, "-FixtureMode", "-FixtureScenario", "GuardRepoDestination"], { expectSuccess: false });
  runPowerShell(["-File", backupScript, "-FixtureMode", "-FixtureScenario", "GuardMissingRecipient"], { expectSuccess: false });
  runPowerShell(["-File", backupScript, "-FixtureMode", "-FixtureScenario", "GuardMissingSecret"], { expectSuccess: false });
  runPowerShell(["-File", backupScript, "-FixtureMode", "-FixtureScenario", "GuardMalformedSecret"], { expectSuccess: false });

  const validConnectionUrls = [
    `postgres://postgres.wdlaauzknfggoqldolmx:${fixtureCredentials[0]}@aws-1-us-west-2.pooler.supabase.com:5432/postgres`,
    `postgresql://postgres.wdlaauzknfggoqldolmx:${fixtureCredentials[0]}@aws-1-us-west-2.pooler.supabase.com:5432/postgres`,
    ...fixtureCredentials.slice(1).map(
      (credential) => `postgresql://postgres.wdlaauzknfggoqldolmx:${credential}@aws-1-us-west-2.pooler.supabase.com:5432/postgres`,
    ),
    `postgresql://postgres.wdlaauzknfggoqldolmx:synthetic%40Password123@aws-1-us-west-2.pooler.supabase.com:5432/postgres`,
    `  \ufeff"postgresql://postgres.wdlaauzknfggoqldolmx:${fixtureCredentials[0]}@aws-1-us-west-2.pooler.supabase.com:5432/postgres"\r\n`,
  ];
  for (const connectionUrl of validConnectionUrls) {
    assertIncludes(
      runPowerShell(["-File", backupScript, "-FixtureMode", "-FixtureScenario", "ValidateConnectionUrl", "-FixtureConnectionUrl", connectionUrl], { expectSuccess: true }),
      "fixture_connection_url_ok",
      "backup connection fixture",
    );
    assertIncludes(
      runPowerShell(["-File", initializeSecretScript, "-FixtureValidateOnly", "-FixtureConnectionUrl", connectionUrl], { expectSuccess: true }),
      '"ok"',
      "initializer connection fixture",
    );
  }

  const invalidConnectionUrls = [
    `postgresql://postgres.wdlaauzknfggoqldolmx:${fixtureCredentials[0]}@database.example.invalid:5432/postgres`,
    `postgresql://postgres.wdlaauzknfggoqldolmx:${fixtureCredentials[0]}@aws-1-us-west-2.pooler.supabase.com:6543/postgres`,
    `postgresql://postgres.wrongprojectref:${fixtureCredentials[0]}@aws-1-us-west-2.pooler.supabase.com:5432/postgres`,
    `postgresql://postgres.kfuujcfxoayukywvtaeh:${fixtureCredentials[0]}@aws-1-us-west-2.pooler.supabase.com:5432/postgres`,
    `postgresql://postgres.wdlaauzknfggoqldolmx:${fixtureCredentials[0]}@aws-1-us-west-2.pooler.supabase.com:5432/template1`,
    `postgresql://postgres.wdlaauzknfggoqldolmx@aws-1-us-west-2.pooler.supabase.com:5432/postgres`,
    `postgresql://postgres.wdlaauzknfggoqldolmx:${fixtureCredentials[0]}@aws-1-us-west-2.pooler.supabase.com:5432/postgres?host=example.invalid`,
    `postgresql://postgres.wdlaauzknfggoqldolmx:${fixtureCredentials[0]}@aws-1-us-west-2.pooler.supabase.com:5432/postgres#alternate`,
    `psql postgresql://postgres.wdlaauzknfggoqldolmx:${fixtureCredentials[0]}@aws-1-us-west-2.pooler.supabase.com:5432/postgres`,
    "not-an-absolute-postgresql-uri",
  ];
  for (const connectionUrl of invalidConnectionUrls) {
    runPowerShell(["-File", backupScript, "-FixtureMode", "-FixtureScenario", "ValidateConnectionUrl", "-FixtureConnectionUrl", connectionUrl], { expectSuccess: false });
    const safeInitializerFailure = runPowerShell(["-File", initializeSecretScript, "-FixtureValidateOnly", "-FixtureConnectionUrl", connectionUrl], { expectSuccess: false });
    assertIncludes(safeInitializerFailure, "Production database connection validation failed safely:", "initializer safe failure");
    assertIncludes(safeInitializerFailure, "secure_string_character_count=", "initializer safe failure");
    assertIncludes(safeInitializerFailure, "plaintext_character_count=", "initializer safe failure");
    assertIncludes(safeInitializerFailure, "starts_with_expected_scheme=", "initializer safe failure");
    assertIncludes(safeInitializerFailure, "uri_trycreate_success=", "initializer safe failure");
  }
  assertIncludes(runPowerShell(["-File", backupScript, "-FixtureMode", "-FixtureScenario", "Retention"], { expectSuccess: true }), "fixture_retention_ok", "retention fixture");
  assertIncludes(runPowerShell(["-File", backupScript, "-FixtureMode", "-FixtureScenario", "StatusRedaction"], { expectSuccess: true }), "fixture_status_ok", "status fixture");
  runPowerShell(["-File", restoreScript, "-FixtureMode", "-FixtureScenario", "GuardProductionTarget"], { expectSuccess: false });
  runPowerShell(["-File", restoreScript, "-FixtureMode", "-FixtureScenario", "GuardStagingTarget"], { expectSuccess: false });
  runPowerShell(["-File", restoreScript, "-FixtureMode", "-FixtureScenario", "GuardNonLoopback"], { expectSuccess: false });
  runPowerShell(["-File", restoreScript, "-FixtureMode", "-FixtureScenario", "GuardMissingExecute"], { expectSuccess: false });
  runPowerShell(["-File", restoreScript, "-FixtureMode", "-FixtureScenario", "GuardPrivateIdentityInRepo"], { expectSuccess: false });
  runPowerShell(["-File", restoreScript, "-FixtureMode", "-FixtureScenario", "GuardPrivateIdentityInBackupDestination"], { expectSuccess: false });
  runPowerShell(["-File", restoreScript, "-FixtureMode", "-FixtureScenario", "GuardMalformedArtifact"], { expectSuccess: false });
  runPowerShell(["-File", restoreScript, "-FixtureMode", "-FixtureScenario", "GuardUnexpectedArchiveMember"], { expectSuccess: false });
  runPowerShell(["-File", restoreScript, "-FixtureMode", "-FixtureScenario", "GuardPathTraversalArchiveMember"], { expectSuccess: false });
  assertIncludes(runPowerShell(["-File", restoreScript, "-FixtureMode", "-FixtureScenario", "ChecksumAndCleanup"], { expectSuccess: true }), "fixture_checksum_cleanup_ok", "restore cleanup fixture");
  assertIncludes(runPowerShell(["-File", restoreScript, "-FixtureMode", "-FixtureScenario", "ManagedRolePlan"], { expectSuccess: true }), "fixture_managed_role_plan_ok", "managed role plan fixture");
  assertIncludes(runPowerShell(["-File", restoreScript, "-FixtureMode", "-FixtureScenario", "UserRolePlan"], { expectSuccess: true }), "fixture_user_role_application_plan_ok", "user role application plan fixture");
  runPowerShell(["-File", restoreScript, "-FixtureMode", "-FixtureScenario", "UnsupportedRoleStatement"], { expectSuccess: false });
  assertIncludes(runPowerShell(["-File", restoreScript, "-FixtureMode", "-FixtureScenario", "RolePlanFailureCleanup"], { expectSuccess: true }), "fixture_failed_role_plan_cleanup_ok", "failed role plan cleanup fixture");

  const residueRoot = await mkdtemp(path.join(tmpdir(), "project-local-backup-regression-"));
  await writeFile(path.join(residueRoot, "probe.txt"), "probe", "utf8");
  await rm(residueRoot, { recursive: true, force: true });

  console.log("Production independent backup foundation is route-unused, credential-free, guardrailed, fixture-safe, and NO-GO honest.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
