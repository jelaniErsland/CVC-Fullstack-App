import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const root = process.cwd();
const backupDir = path.join(root, "scripts", "production-backup");
const backupScript = path.join(backupDir, "Invoke-ProjectLocalProductionBackup.ps1");
const restoreScript = path.join(backupDir, "Test-ProjectLocalBackupRestore.ps1");
const initializeSecretScript = path.join(backupDir, "Initialize-ProjectLocalBackupSecret.ps1");
const taskRegistrationScript = path.join(backupDir, "Register-ProjectLocalBackupTask.ps1");
const reviewedBackupTerminalMigrations = Object.freeze([
  "20260714122230",
  "20260812123430",
  "20260824123500",
  "20260902120000",
  "20260903120000",
]);
const partialMigrationTerminals = Object.freeze(["20260829130000", "20260901120000"]);
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
  "ProjectLocalDumpBoundaryMarker123",
  "ProjectLocalParentPasswordBoundary123",
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

function runPowerShell(args, { expectSuccess, env = {}, unsetEnv = [] }) {
  const childEnvironment = {
    ...process.env,
    SUPABASE_SERVICE_ROLE_KEY: "",
    ...env,
  };
  for (const name of unsetEnv) delete childEnvironment[name];
  const result = spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", ...args], {
    cwd: root,
    encoding: "utf8",
    env: childEnvironment,
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

function runLocalCommand(file, args, { expectSuccess = true } = {}) {
  const result = spawnSync(file, args, { cwd: root, encoding: "utf8" });
  const combined = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  for (const fixtureCredential of fixtureCredentials) {
    assert(!combined.includes(fixtureCredential), `${file} output exposed a synthetic credential.`);
  }
  if (expectSuccess) {
    assert.equal(result.status, 0, combined);
  } else {
    assert.notEqual(result.status, 0, `Expected ${file} to fail closed.`);
  }
  return combined;
}

async function runNativeDumpLoopbackProof() {
  const fixturePassword = "ProjectLocalDumpBoundaryMarker123";
  const containerName = `project-local-native-dump-${process.pid}-${Date.now()}`;
  const proofRoot = await mkdtemp(path.join(tmpdir(), "project-local-native-dump-proof-"));
  const argumentAuditPath = path.join(proofRoot, "native-dump-arguments.ndjson");
  const connectionFailureAuditPath = path.join(proofRoot, "connection-failure-arguments.ndjson");
  const authenticationFailureAuditPath = path.join(proofRoot, "authentication-failure-arguments.ndjson");
  const launchFailureAuditPath = path.join(proofRoot, "launch-failure-environment.ndjson");
  const tempPrefix = "project-local-backup-fixture-";
  const platformOwnerQuery = "SELECT string_agg(n.nspname || '|' || pg_get_userbyid(n.nspowner), ',' ORDER BY n.nspname) FROM pg_namespace n WHERE n.nspname IN ('auth','storage')";
  let containerStarted = false;
  let fixtureSetupAttempted = false;
  let originalPlatformOwners = null;
  let originalPlatformObjectCount = null;
  let optionalSchemasBefore = [];
  try {
    runLocalCommand("docker", ["version", "--format", "{{.Server.Version}}"]);
    runLocalCommand("docker", [
      "run", "--detach", "--name", containerName,
      "--publish", "127.0.0.1::5432",
      "--env", `POSTGRES_PASSWORD=${fixturePassword}`,
      "public.ecr.aws/supabase/postgres:17.6.1.158",
    ]);
    containerStarted = true;
    let consecutiveReadyChecks = 0;
    for (let attempt = 0; attempt < 60 && consecutiveReadyChecks < 3; attempt += 1) {
      const probe = spawnSync("docker", ["exec", containerName, "pg_isready", "-U", "postgres", "-d", "postgres"], { cwd: root, encoding: "utf8" });
      if (probe.status === 0) {
        consecutiveReadyChecks += 1;
      } else {
        consecutiveReadyChecks = 0;
      }
      await delay(750);
    }
    assert.equal(consecutiveReadyChecks, 3, "Disposable native-dump PostgreSQL fixture did not become stably ready.");
    const portOutput = runLocalCommand("docker", ["port", containerName, "5432/tcp"]);
    const portMatch = portOutput.match(/127\.0\.0\.1:(\d+)/);
    assert(portMatch, "Disposable native-dump fixture did not expose a loopback port.");
    const fixturePort = Number.parseInt(portMatch[1], 10);
    assert(fixturePort > 0 && fixturePort <= 65535);

    originalPlatformOwners = runLocalCommand("docker", [
      "exec", containerName, "psql", "-U", "postgres", "-d", "postgres", "-X", "-tA", "-v", "ON_ERROR_STOP=1", "-c", platformOwnerQuery,
    ]).trim();
    assert.equal(originalPlatformOwners, "auth|supabase_admin,storage|supabase_admin", "Disposable Supabase platform schema owners were unexpected.");
    originalPlatformObjectCount = runLocalCommand("docker", [
      "exec", containerName, "psql", "-U", "postgres", "-d", "postgres", "-X", "-tA", "-v", "ON_ERROR_STOP=1", "-c",
      "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname IN ('auth','storage')",
    ]).trim();
    optionalSchemasBefore = runLocalCommand("docker", [
      "exec", containerName, "psql", "-U", "postgres", "-d", "postgres", "-X", "-tA", "-v", "ON_ERROR_STOP=1", "-c",
      "SELECT nspname FROM pg_namespace WHERE nspname IN ('supabase_functions','supabase_migrations') ORDER BY nspname",
    ]).trim().split(/\r?\n/).filter(Boolean);
    assert(!optionalSchemasBefore.includes("supabase_migrations"), "Disposable fixture already contains production-like migration state that the regression will not alter.");

    const postgresFixtureSql = [
      "DO $$ BEGIN IF to_regclass('auth.schema_migrations') IS NULL THEN RAISE EXCEPTION 'fixture_auth_migration_relation_missing'; END IF; IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'project_local_dump_fixture_role') THEN RAISE EXCEPTION 'fixture_role_collision'; END IF; END $$",
      "CREATE ROLE project_local_dump_fixture_role",
      "CREATE TABLE public.project_local_dump_fixture(id integer PRIMARY KEY, label text NOT NULL)",
      "INSERT INTO public.project_local_dump_fixture VALUES (1, 'fixture-public-row')",
      ...(!optionalSchemasBefore.includes("supabase_functions") ? [
        "CREATE SCHEMA supabase_functions AUTHORIZATION postgres",
        "CREATE TABLE supabase_functions.project_local_dump_fixture_data(id integer, label text)",
        "INSERT INTO supabase_functions.project_local_dump_fixture_data VALUES (1, 'fixture-functions-row')",
      ] : []),
      "CREATE SCHEMA supabase_migrations AUTHORIZATION postgres",
      "CREATE TABLE supabase_migrations.schema_migrations(version text NOT NULL)",
      "INSERT INTO supabase_migrations.schema_migrations VALUES ('20991231235959')",
    ].join("; ") + ";";
    const platformOwnerFixtureSql = [
      "CREATE TABLE auth.project_local_dump_fixture_data(id integer, label text)",
      "INSERT INTO auth.project_local_dump_fixture_data VALUES (1, 'fixture-auth-row')",
      "CREATE TABLE storage.project_local_dump_fixture_metadata(id integer, label text)",
      "INSERT INTO storage.project_local_dump_fixture_metadata VALUES (1, 'fixture-storage-row')",
    ].join("; ") + ";";
    fixtureSetupAttempted = true;
    runLocalCommand("docker", ["exec", containerName, "psql", "-U", "postgres", "-d", "postgres", "-X", "-v", "ON_ERROR_STOP=1", "-q", "-c", postgresFixtureSql]);
    runLocalCommand("docker", ["exec", containerName, "psql", "-U", "supabase_admin", "-d", "postgres", "-X", "-v", "ON_ERROR_STOP=1", "-q", "-c", platformOwnerFixtureSql]);

    const fixtureUrl = `postgresql://postgres:${encodeURIComponent(fixturePassword)}@127.0.0.1:${fixturePort}/postgres`;
    const tempBefore = new Set((await readdir(tmpdir())).filter((name) => name.startsWith(tempPrefix)));
    const successOutput = runPowerShell([
      "-File", backupScript,
      "-FixtureMode",
      "-FixtureScenario", "NativeDumpPackageLoopback",
      "-FixtureArgumentAuditPath", argumentAuditPath,
    ], {
      expectSuccess: true,
      env: { PROJECT_LOCAL_NATIVE_DUMP_FIXTURE_URL: fixtureUrl },
      unsetEnv: ["PGHOST", "PGPORT", "PGDATABASE", "PGUSER", "PGPASSWORD", "PGSSLMODE", "PGOPTIONS", "PGCONNECT_TIMEOUT"],
    });
    assertIncludes(successOutput, "fixture_native_dump_package_ok", "native dump loopback package fixture");

    const auditText = await readFile(argumentAuditPath, "utf8");
    assert(!auditText.includes(fixturePassword), "Native dump argument audit exposed the synthetic password.");
    assert(!/postgres(?:ql)?:\/\//i.test(auditText), "Native dump argument audit contained a credential-bearing URI.");
    const auditRecords = auditText.trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line.replace(/^\uFEFF/, "")));
    const processAuditRecords = auditRecords.filter((record) => record.record_type === "process_arguments");
    const environmentAuditRecords = auditRecords.filter((record) => record.record_type === "parent_environment");
    assert.equal(processAuditRecords.length, 5, "Native dump package must launch exactly five database dump processes.");
    assert.equal(environmentAuditRecords.length, 5, "Native dump package must restore the parent environment after all five processes.");
    assert.deepEqual(processAuditRecords.map((record) => record.label).sort(), ["data", "migrations_data", "migrations_schema", "roles", "schema"]);
    for (const record of processAuditRecords) {
      assert.equal(record.password_environment_present, true, `${record.label} did not receive child-scoped PGPASSWORD.`);
      assert.equal(record.fixture_url_environment_absent, true, `${record.label} inherited the synthetic connection URL.`);
      assert.equal(record.password_argument_present, false, `${record.label} exposed the password in arguments.`);
      assert.equal(record.credential_uri_argument_present, false, `${record.label} exposed a connection URI in arguments.`);
      assert.equal(record.ssl_mode, "disable", `${record.label} did not use the loopback-only SSL override.`);
      assert(Array.isArray(record.arguments) && record.arguments.length > 0, `${record.label} argument audit was empty.`);
    }
    for (const record of environmentAuditRecords) {
      assert.equal(record.parent_environment_restored, true, `${record.label} did not restore the parent PostgreSQL environment.`);
      assert.equal(record.pgpassword_present_before, false, `${record.label} unexpectedly began with parent PGPASSWORD.`);
      assert.equal(record.pgpassword_present_after, false, `${record.label} left PGPASSWORD in the parent environment.`);
      assert.equal(record.pgsslmode_present_before, false, `${record.label} unexpectedly began with parent PGSSLMODE.`);
      assert.equal(record.pgsslmode_present_after, false, `${record.label} left PGSSLMODE in the parent environment.`);
    }
    const dataAudit = processAuditRecords.find((record) => record.label === "data");
    assert(dataAudit.arguments.includes("auth.schema_migrations"), "Native data dump did not exclude auth migration state.");
    assert(dataAudit.arguments.includes("storage.migrations"), "Native data dump did not exclude storage migration state.");
    assert(dataAudit.arguments.includes("supabase_functions.migrations"), "Native data dump did not exclude functions migration state.");
    assert(dataAudit.arguments.includes("storage.buckets_vectors"), "Native data dump did not exclude storage vector buckets.");
    assert(dataAudit.arguments.includes("storage.vector_indexes"), "Native data dump did not exclude storage vector indexes.");

    const connectionFailureUrl = `postgresql://postgres:${encodeURIComponent(fixturePassword)}@127.0.0.1:1/postgres`;
    const connectionFailureOutput = runPowerShell([
      "-File", backupScript,
      "-FixtureMode",
      "-FixtureScenario", "NativeDumpConnectionFailure",
      "-FixtureArgumentAuditPath", connectionFailureAuditPath,
    ], {
      expectSuccess: false,
      env: {
        PROJECT_LOCAL_NATIVE_DUMP_FIXTURE_URL: connectionFailureUrl,
        PGPASSWORD: "ProjectLocalParentPasswordBoundary123",
        PGSSLMODE: "verify-full",
        PGHOST: "parent.invalid",
        PGPORT: "6543",
        PGDATABASE: "parent_database",
        PGUSER: "parent_user",
        PGOPTIONS: "-c statement_timeout=12345",
        PGCONNECT_TIMEOUT: "29",
      },
    });
    assertIncludes(connectionFailureOutput, "dump_connection_or_authentication_failed_roles", "native dump connection failure fixture");
    const connectionFailureAudit = await readFile(connectionFailureAuditPath, "utf8");
    assert(!connectionFailureAudit.includes(fixturePassword), "Connection-failure argument audit exposed the synthetic password.");
    const connectionFailureRecords = connectionFailureAudit.trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line.replace(/^\uFEFF/, "")));
    const connectionProcessAudit = connectionFailureRecords.find((record) => record.record_type === "process_arguments");
    const connectionEnvironmentAudit = connectionFailureRecords.find((record) => record.record_type === "parent_environment");
    assert.equal(connectionFailureRecords.length, 2, "Connection failure must audit and restore only the roles process.");
    assert.equal(connectionProcessAudit.password_argument_present, false, "Connection failure exposed the password in arguments.");
    assert.equal(connectionProcessAudit.credential_uri_argument_present, false, "Connection failure exposed a credential URI in arguments.");
    assert.equal(connectionEnvironmentAudit.parent_environment_restored, true, "Connection failure did not restore the parent PostgreSQL environment.");
    assert.equal(connectionEnvironmentAudit.pgpassword_present_before, true, "Connection failure did not exercise a pre-existing parent PGPASSWORD.");
    assert.equal(connectionEnvironmentAudit.pgpassword_present_after, true, "Connection failure removed the pre-existing parent PGPASSWORD.");
    assert.equal(connectionEnvironmentAudit.pgsslmode_present_before, true, "Connection failure did not exercise a pre-existing parent PGSSLMODE.");
    assert.equal(connectionEnvironmentAudit.pgsslmode_present_after, true, "Connection failure removed the pre-existing parent PGSSLMODE.");

    const wrongPasswordUrl = `postgresql://postgres:${encodeURIComponent(`${fixturePassword}Wrong`)}@127.0.0.1:${fixturePort}/postgres`;
    const authenticationFailureOutput = runPowerShell([
      "-File", backupScript,
      "-FixtureMode",
      "-FixtureScenario", "NativeDumpAuthenticationFailure",
      "-FixtureArgumentAuditPath", authenticationFailureAuditPath,
    ], {
      expectSuccess: false,
      env: {
        PROJECT_LOCAL_NATIVE_DUMP_FIXTURE_URL: wrongPasswordUrl,
        PGPASSWORD: "ProjectLocalParentPasswordBoundary123",
        PGSSLMODE: "verify-full",
        PGHOST: "parent.invalid",
        PGPORT: "6543",
        PGDATABASE: "parent_database",
        PGUSER: "parent_user",
        PGOPTIONS: "-c statement_timeout=12345",
        PGCONNECT_TIMEOUT: "29",
      },
    });
    assertIncludes(authenticationFailureOutput, "dump_connection_or_authentication_failed_roles", "native dump authentication failure fixture");
    const authenticationFailureAudit = await readFile(authenticationFailureAuditPath, "utf8");
    assert(!authenticationFailureAudit.includes(`${fixturePassword}Wrong`), "Authentication-failure argument audit exposed the synthetic password.");
    const authenticationFailureRecords = authenticationFailureAudit.trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line.replace(/^\uFEFF/, "")));
    const authenticationProcessAudit = authenticationFailureRecords.find((record) => record.record_type === "process_arguments");
    const authenticationEnvironmentAudit = authenticationFailureRecords.find((record) => record.record_type === "parent_environment");
    assert.equal(authenticationFailureRecords.length, 2, "Authentication failure must audit and restore only the roles process.");
    assert.equal(authenticationProcessAudit.password_argument_present, false, "Authentication failure exposed the password in arguments.");
    assert.equal(authenticationProcessAudit.credential_uri_argument_present, false, "Authentication failure exposed a credential URI in arguments.");
    assert.equal(authenticationEnvironmentAudit.parent_environment_restored, true, "Authentication failure did not restore the parent PostgreSQL environment.");
    assert.equal(authenticationEnvironmentAudit.pgpassword_present_before, true, "Authentication failure did not exercise a pre-existing parent PGPASSWORD.");
    assert.equal(authenticationEnvironmentAudit.pgpassword_present_after, true, "Authentication failure removed the pre-existing parent PGPASSWORD.");
    assert.equal(authenticationEnvironmentAudit.pgsslmode_present_before, true, "Authentication failure did not exercise a pre-existing parent PGSSLMODE.");
    assert.equal(authenticationEnvironmentAudit.pgsslmode_present_after, true, "Authentication failure removed the pre-existing parent PGSSLMODE.");

    const launchFailureOutput = runPowerShell([
      "-File", backupScript,
      "-FixtureMode",
      "-FixtureScenario", "NativeDumpLaunchFailure",
      "-FixtureArgumentAuditPath", launchFailureAuditPath,
    ], {
      expectSuccess: false,
      env: {
        PROJECT_LOCAL_NATIVE_DUMP_FIXTURE_URL: fixtureUrl,
        PGPASSWORD: "ProjectLocalParentPasswordBoundary123",
        PGSSLMODE: "verify-full",
      },
    });
    assertIncludes(launchFailureOutput, "dump_executable_unavailable_roles", "native dump launch failure fixture");
    const launchFailureAudit = await readFile(launchFailureAuditPath, "utf8");
    assert(!launchFailureAudit.includes(fixturePassword), "Launch-failure environment audit exposed the synthetic password.");
    const launchFailureRecords = launchFailureAudit.trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line.replace(/^\uFEFF/, "")));
    assert.equal(launchFailureRecords.length, 1, "Launch failure must not record a process argument boundary.");
    assert.equal(launchFailureRecords[0].record_type, "parent_environment");
    assert.equal(launchFailureRecords[0].parent_environment_restored, true, "Launch failure did not preserve the parent environment.");
    assert.equal(launchFailureRecords[0].pgpassword_present_before, true, "Launch failure did not exercise a pre-existing parent PGPASSWORD.");
    assert.equal(launchFailureRecords[0].pgpassword_present_after, true, "Launch failure removed the pre-existing parent PGPASSWORD.");
    assert.equal(launchFailureRecords[0].pgsslmode_present_before, true, "Launch failure did not exercise a pre-existing parent PGSSLMODE.");
    assert.equal(launchFailureRecords[0].pgsslmode_present_after, true, "Launch failure removed the pre-existing parent PGSSLMODE.");

    const tempAfter = (await readdir(tmpdir())).filter((name) => name.startsWith(tempPrefix) && !tempBefore.has(name));
    assert.deepEqual(tempAfter, [], "Native dump fixture left a plaintext temporary package directory.");
  } finally {
    if (containerStarted) {
      try {
        if (fixtureSetupAttempted) {
          const platformOwnerCleanupSql = [
            "DROP TABLE IF EXISTS auth.project_local_dump_fixture_data",
            "DROP TABLE IF EXISTS storage.project_local_dump_fixture_metadata",
          ].join("; ") + ";";
          runLocalCommand("docker", ["exec", containerName, "psql", "-U", "supabase_admin", "-d", "postgres", "-X", "-v", "ON_ERROR_STOP=1", "-q", "-c", platformOwnerCleanupSql]);
          const postgresCleanupSql = [
            "DROP TABLE IF EXISTS public.project_local_dump_fixture",
            "DROP TABLE IF EXISTS supabase_functions.project_local_dump_fixture_data",
            "DROP TABLE IF EXISTS supabase_migrations.schema_migrations",
            ...(!optionalSchemasBefore.includes("supabase_functions") ? ["DROP SCHEMA IF EXISTS supabase_functions"] : []),
            ...(!optionalSchemasBefore.includes("supabase_migrations") ? ["DROP SCHEMA IF EXISTS supabase_migrations"] : []),
            "DROP ROLE IF EXISTS project_local_dump_fixture_role",
          ].join("; ") + ";";
          runLocalCommand("docker", ["exec", containerName, "psql", "-U", "postgres", "-d", "postgres", "-X", "-v", "ON_ERROR_STOP=1", "-q", "-c", postgresCleanupSql]);
          const fixtureResidue = runLocalCommand("docker", [
            "exec", containerName, "psql", "-U", "postgres", "-d", "postgres", "-X", "-tA", "-v", "ON_ERROR_STOP=1", "-c",
            "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE (n.nspname, c.relname) IN (('public','project_local_dump_fixture'),('auth','project_local_dump_fixture_data'),('storage','project_local_dump_fixture_metadata'),('supabase_functions','project_local_dump_fixture_data'),('supabase_migrations','schema_migrations'))",
          ]).trim();
          assert.equal(fixtureResidue, "0", "Fixture-owned database objects were not removed.");
          const optionalSchemasAfter = runLocalCommand("docker", [
            "exec", containerName, "psql", "-U", "postgres", "-d", "postgres", "-X", "-tA", "-v", "ON_ERROR_STOP=1", "-c",
            "SELECT nspname FROM pg_namespace WHERE nspname IN ('supabase_functions','supabase_migrations') ORDER BY nspname",
          ]).trim().split(/\r?\n/).filter(Boolean);
          assert.deepEqual(optionalSchemasAfter, optionalSchemasBefore, "Fixture-created optional schemas were not restored to their original state.");
          const finalPlatformOwners = runLocalCommand("docker", [
            "exec", containerName, "psql", "-U", "postgres", "-d", "postgres", "-X", "-tA", "-v", "ON_ERROR_STOP=1", "-c", platformOwnerQuery,
          ]).trim();
          assert.equal(finalPlatformOwners, originalPlatformOwners, "Platform schema ownership changed during the fixture run.");
          const finalPlatformObjectCount = runLocalCommand("docker", [
            "exec", containerName, "psql", "-U", "postgres", "-d", "postgres", "-X", "-tA", "-v", "ON_ERROR_STOP=1", "-c",
            "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname IN ('auth','storage')",
          ]).trim();
          assert.equal(finalPlatformObjectCount, originalPlatformObjectCount, "Pre-existing platform object inventory changed during the fixture run.");
          const authMigrationRelation = runLocalCommand("docker", [
            "exec", containerName, "psql", "-U", "postgres", "-d", "postgres", "-X", "-tA", "-v", "ON_ERROR_STOP=1", "-c", "SELECT to_regclass('auth.schema_migrations') IS NOT NULL",
          ]).trim();
          assert.equal(authMigrationRelation, "t", "Pre-existing auth migration state was damaged by the fixture.");
        }
      } finally {
        spawnSync("docker", ["rm", "--force", containerName], { cwd: root, encoding: "utf8" });
      }
    }
    await rm(proofRoot, { recursive: true, force: true });
  }
  const remaining = spawnSync("docker", ["ps", "-a", "--filter", `name=^/${containerName}$`, "--format", "{{.Names}}"], { cwd: root, encoding: "utf8" });
  assert.equal((remaining.stdout ?? "").trim(), "", "Native dump diagnostic container was not removed.");
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
    migrationContract,
    roleRestoreHelper,
    tableAclRestoreHelper,
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
    read("scripts/production-backup/ProjectLocalProductionMigrationContract.ps1"),
    read("scripts/production-backup/ProjectLocalRoleRestore.ps1"),
    read("scripts/production-backup/ProjectLocalTableAclRestore.ps1"),
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
    ["production migration contract", migrationContract],
  ]) {
    assertIncludes(source, "Set-StrictMode -Version Latest", label);
    assert(!/SUPABASE_SERVICE_ROLE_KEY\s*=|sk_live|service-role-secret|age-secret-key-|postgres(?:ql)?:\/\/(?!\|)[^\\s`\"]+/i.test(source), `${label} contains secret-like material.`);
    assert(!/postgres(?:ql)?:\/\/\S+:\S+@/i.test(source), `${label} contains a password-bearing PostgreSQL URL.`);
  }
  assert(!/postgres(?:ql)?:\/\/\S+:\S+@/i.test(setupDoc), "independent backup setup doc contains a password-bearing PostgreSQL URL.");

  assertIncludes(backup, "-ExecuteProductionBackup", "backup script");
  assertIncludes(backup, "-ExecuteProductionPreflight", "backup script");
  assertIncludes(backup, "project-local-production", "backup script");
  assertIncludes(backup, "wdlaauzknfggoqldolmx", "backup script");
  assertIncludes(migrationContract, '"20260714122230"', "production migration contract historical terminal");
  assertIncludes(migrationContract, '"20260812123430"', "production migration contract historical terminal");
  assertIncludes(migrationContract, '"20260902120000"', "production migration contract");
  assertIncludes(migrationContract, '$ProjectLocalProductionMigrationContractVersion = "20260903120000-transition-v1"', "production migration contract version");
  assertIncludes(migrationContract, '$FollowUpContactProductionMigration = "20260824123500"', "production migration contract current terminal");
  assertIncludes(migrationContract, '$ProjectQuickViewProductionMigration = "20260902120000"', "production migration contract future terminal");
  assertIncludes(migrationContract, '$ProjectQuickViewPrivilegeHardeningProductionMigration = "20260903120000"', "production migration contract security terminal");
  assertIncludes(migrationContract, '"20260829130000"', "production migration contract partial terminal");
  assertIncludes(migrationContract, '"20260901120000"', "production migration contract partial terminal");
  assertIncludes(migrationContract, "Test-ProjectLocalReviewedLockTransition", "production migration contract");
  assertIncludes(migrationContract, "Assert-ProjectLocalReviewedLockTransition", "production migration contract");
  assertIncludes(migrationContract, "AllowedTerminalMigrations", "production migration contract");
  assertIncludes(
    backup,
    '. (Join-Path $ScriptRoot "ProjectLocalProductionMigrationContract.ps1")',
    "backup script shared terminal-migration contract",
  );
  assertIncludes(backup, "Test-ProjectLocalApprovedTerminalMigration", "backup script terminal-migration guard");
  assertIncludes(backup, "kfuujcfxoayukywvtaeh", "backup script");
  assertIncludes(backup, "SUPABASE_SERVICE_ROLE_KEY", "backup script");
  assertIncludes(backup, "ConvertTo-SecureString", "backup script");
  assertIncludes(backup, "ProjectLocalProductionConnection.ps1", "backup script");
  assertIncludes(backup, "ConvertTo-NativeArgumentString", "backup script");
  assertIncludes(backup, "Invoke-ProjectLocalNativeDumpPackage", "backup script");
  assertIncludes(backup, "Invoke-ProjectLocalNativeDumpProcess", "backup script");
  assertIncludes(backup, "Get-Command \"pg_dump\"", "backup script");
  assertIncludes(backup, "Get-Command \"pg_dumpall\"", "backup script");
  assertIncludes(backup, "--roles-only", "backup script");
  assertIncludes(backup, "--data-only", "backup script");
  assertIncludes(backup, "--file", "backup script");
  assertIncludes(backup, 'dumpTool = "postgresql-native"', "backup script");
  assertIncludes(backup, 'dockerPreflight = "not_required_native_dump"', "backup script");
  assertIncludes(backup, "supabase_migrations", "backup script");
  assertIncludes(backup, "storage.buckets_vectors", "backup script");
  assertIncludes(backup, "storage.vector_indexes", "backup script");
  assertIncludes(backup, "manifest.json", "backup script");
  assertIncludes(backup, "age-encryption.org/v1", "backup script");
  assertIncludes(backup, ".partial", "backup script");
  assertIncludes(backup, "System.Security.Cryptography.SHA256", "backup script");
  assertIncludes(backup, "latest-status.json", "backup script");
  assertIncludes(backup, "latest-notification.json", "backup script");
  assertIncludes(backup, "SafeInjectedFailure", "backup script");
  assertIncludes(backup, "injected_pre_network_failure", "backup script");
  assertIncludes(backup, "msg.exe", "backup script");
  assertIncludes(backup, "migration_preflight", "backup script");
  assertIncludes(backup, "current_database()", "backup script");
  assertIncludes(backup, "Invoke-ProjectLocalMigrationPreflight", "backup script");
  assertIncludes(backup, "BEGIN TRANSACTION READ ONLY", "backup script");
  assertIncludes(backup, "to_regclass('supabase_migrations.schema_migrations')", "backup script");
  assertIncludes(backup, "migration_relation_present", "backup script");
  assertIncludes(backup, 'EnvironmentVariables["PGPASSWORD"]', "backup script");
  assertIncludes(backup, 'EnvironmentVariables["PGOPTIONS"] = "-c default_transaction_read_only=on"', "backup script");
  assertIncludes(backup, 'EnvironmentVariables["PGSSLMODE"]', "backup script");
  assertIncludes(backup, 'EnvironmentVariables.Remove($name)', "backup script");
  assertIncludes(backup, "migration_preflight_query_failed", "backup script");
  assertIncludes(backup, "migration_preflight_output_invalid", "backup script");
  assertIncludes(backup, "migration_preflight_history_missing", "backup script");
  assertIncludes(backup, "migration_preflight_history_invalid", "backup script");
  assertIncludes(backup, "migration_preflight_mismatch", "backup script");
  assertIncludes(backup, "migration_preflight_partial_terminal", "backup script");
  assertIncludes(backup, "migration_lock_transition_pending", "backup script");
  assertNotIncludes(backup, '@("db", "query"', "backup script");
  assertNotIncludes(backup, '"--db-url"', "backup script");
  assertNotIncludes(backup, '"--password"', "backup script");
  assertNotIncludes(backup, "$supabase.Source", "backup script");
  assertIncludes(backup, "dump_argument_secret_detected", "backup script");
  assertIncludes(backup, "dump_executable_unavailable", "backup script");
  assertIncludes(backup, "dump_process_launch_failed", "backup script");
  assertIncludes(backup, "dump_connection_or_authentication_failed", "backup script");
  assertNotIncludes(backup, 'throw "dump_connection_failed_', "backup script");
  assertNotIncludes(backup, 'throw "dump_authentication_failed_', "backup script");
  assertIncludes(backup, "Write-ProjectLocalDumpEnvironmentAudit", "backup script");
  assertIncludes(backup, "parent_environment_restored", "backup script");
  assertIncludes(backup, "dump_process_failed", "backup script");
  assertIncludes(backup, "dump_output_missing", "backup script");
  assertIncludes(backup, "dump_output_empty", "backup script");
  assertIncludes(backup, "dump_package_construction_failed", "backup script");
  assertIncludes(backup, "PROJECT_LOCAL_NATIVE_DUMP_FIXTURE_URL", "backup script");
  assertIncludes(backup, "fixture_url_environment_absent", "backup script");
  assertIncludes(backup, "Move-Item -LiteralPath $temporaryStatusPath", "backup script");
  assertIncludes(backup, "Remove-RecognizedBackups", "backup script");
  assertIncludes(backup, "finally", "backup script");
  assertIncludes(backup, "Remove-Item -LiteralPath $workRoot -Recurse -Force", "backup script");
  assertIncludes(backup, "FixtureMode", "backup script");
  assertIncludes(backup, "Project Local Backups\\production", "backup script");
  assertIncludes(backup, "SUPABASE_SERVICE_ROLE_KEY must not be present", "backup script");
  assertNotIncludes(backup, "-p ", "backup script");
  assertNotIncludes(backup, "--passphrase", "backup script");
  assertNotIncludes(backup, "AGE-SECRET-KEY", "backup script");

  assertIncludes(task, "UpdateExpectedMigration", "task script");
  assertIncludes(task, "ValidateExpectedMigrationTransition", "task script");
  assertIncludes(task, "Get-ExpectedMigrationArgumentValues", "task script");
  assertIncludes(
    task,
    '. (Join-Path $ScriptRoot "ProjectLocalProductionMigrationContract.ps1")',
    "task script shared terminal-migration contract",
  );
  assertIncludes(task, "MutationPerformed = $false", "task script dry-run result");
  assertIncludes(task, "Assert-BackupRuntimeTransitionContract", "task script runtime contract validation");

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
  assertIncludes(task, '[string]$DailyTime = "03:15"', "task script");
  assertIncludes(task, '"-NotifyOnFailure"', "task script");
  assertIncludes(task, "-LogonType Interactive", "task script");
  assertIncludes(task, "-RunLevel Limited", "task script");
  assertIncludes(task, '$taskAction = New-ScheduledTaskAction', "task script");
  assertIncludes(task, 'Register-ScheduledTask -TaskName $TaskName -Action $taskAction', "task script");
  assertIncludes(task, "Test-IsCurrentOperatorIdentity", "task script");
  assertIncludes(task, '$triggers[0].CimClass.CimClassName -eq "MSFT_TaskDailyTrigger"', "task script");
  assertIncludes(task, '([datetime]$triggers[0].StartBoundary).ToString("HH:mm") -eq "03:15"', "task script");
  assertIncludes(task, '[string]$Task.Principal.LogonType -eq "Interactive"', "task script");
  assertIncludes(task, "Get-SafeTaskMetadata", "task script");
  assertIncludes(task, "SecretBearingArgumentsPresent", "task script");
  assertIncludes(task, "Refusing to modify an unexpected scheduled task", "task script");
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
  assertIncludes(restore, "source_table_acl_reconstruction_mismatch", "restore script");
  assertIncludes(restore, "recovery_forward_direct_privilege_contract_mismatch", "restore script");
  assertIncludes(restore, "recovery_forward_default_privilege_contract_mismatch", "restore script");
  assertIncludes(restore, "ApplyRecoveryForward", "restore script");
  assertIncludes(restore, "ValidateSourceAclPlanOnly", "restore script");
  assertIncludes(restore, "database_connection_attempted = $false", "restore script");
  assertIncludes(restore, "decrypted_cleanup_failed", "restore script");
  assertIncludes(restore, 'throw "Local restore validation failed safely at $restoreStage with $safeFailureCode."', "restore script");
  assertIncludes(restore, "ProjectLocalRoleRestore.ps1", "restore script");
  assertIncludes(restore, "Write-ProjectLocalRoleRestoreSql", "restore script");
  assertIncludes(restore, 'Join-Path $extractRoot "roles-restore.sql"', "restore script");
  assertIncludes(restore, "target_default_acl_neutralization", "restore script");
  assertIncludes(restore, "source_table_acl_reconciliation", "restore script");
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
  assertIncludes(tableAclRestoreHelper, "Get-ProjectLocalSourceTableAclPlan", "table ACL restore helper");
  assertIncludes(tableAclRestoreHelper, "ALTER DEFAULT PRIVILEGES FOR ROLE postgres", "table ACL restore helper");
  assertIncludes(tableAclRestoreHelper, "REVOKE ALL PRIVILEGES ON TABLE", "table ACL restore helper");
  assertIncludes(tableAclRestoreHelper, "source_table_acl_contract_mismatch", "table ACL restore helper");
  assertNotIncludes(tableAclRestoreHelper, "privilege_type in", "table ACL restore helper");
  assertOrder(restore, "Get-TargetPsqlArguments", "Read-Host \"Local disposable database password\" -AsSecureString", "restore password prompt order");
  assertOrder(restore, "Get-Sha256Hex -Path $EncryptedBackupPath", "Read-Host \"Local disposable database password\" -AsSecureString", "restore password prompt order");
  assertOrder(restore, "Get-Command \"psql\"", "Read-Host \"Local disposable database password\" -AsSecureString", "restore password prompt order");
  assertOrder(restore, "Assert-ApprovedArchiveMembers", "Read-Host \"Local disposable database password\" -AsSecureString", "restore password prompt order");

  assertIncludes(runbook, "Path A - Preferred independent backup path", "backup/recovery runbook");
  assertIncludes(runbook, "Supabase Pro managed backups remain an optional future path", "backup/recovery runbook");
  assertIncludes(runbook, "PITR is unavailable and intentionally not required", "backup/recovery runbook");
  assertIncludes(runbook, "Database backups do not automatically prove recovery for Supabase Storage objects", "backup/recovery runbook");
  assertIncludes(runbook, "Reviewed 12.44F.3 migration transition", "backup/recovery runbook");
  assertIncludes(runbook, "20260824123500` to `20260902120000", "backup/recovery runbook");
  assertIncludes(runbook, "20260902120000` to `20260903120000", "backup/recovery runbook");
  assertIncludes(runbook, "MutationPerformed = false", "backup/recovery runbook");
  assertIncludes(runbook, "partial migration", "backup/recovery runbook");

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
  assertIncludes(setupDoc, "Iteration 12.44F.3 reviewed transition contract", "independent backup setup doc");
  assertIncludes(setupDoc, "-Action ValidateExpectedMigrationTransition", "independent backup setup doc");
  assertIncludes(setupDoc, "live task lock remains `20260902120000`", "independent backup setup doc");
  assertIncludes(setupDoc, "20260902120000` to `20260903120000", "independent backup setup doc");
  assertIncludes(setupDoc, "intermediate terminals `20260829130000` and `20260901120000`", "independent backup setup doc");

  assertIncludes(recoveryContract, "independent_backup_automation_foundation", "recovery contract");
  assertIncludes(recoveryContract, "Supabase Pro remains optional", "recovery contract");
  assertIncludes(recoveryContract, "PITR remains unavailable and unnecessary", "recovery contract");
  assertIncludes(envContract, "full independent technical recovery is proven", "environment contract");
  assertIncludes(envContract, "daily 03:15 StartWhenAvailable task registration", "environment contract");
  assertIncludes(envContract, "12.35.11 proves one successful controlled Task Scheduler production execution", "environment contract");

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
  for (const migration of reviewedBackupTerminalMigrations) {
    assertIncludes(
      runPowerShell([
        "-File", backupScript,
        "-FixtureMode",
        "-FixtureScenario", "GuardProductionMigrationContract",
        "-ProjectName", "project-local-production",
        "-ProjectRef", "wdlaauzknfggoqldolmx",
        "-ExpectedMigration", migration,
      ], { expectSuccess: true }),
      "fixture_production_migration_contract_ok",
      `production backup migration guard ${migration}`,
    );
  }
  for (const migration of ["20991231235959", "not-a-migration"]) {
    runPowerShell([
      "-File", backupScript,
      "-FixtureMode",
      "-FixtureScenario", "GuardProductionMigrationContract",
      "-ProjectName", "project-local-production",
      "-ProjectRef", "wdlaauzknfggoqldolmx",
      "-ExpectedMigration", migration,
    ], { expectSuccess: false });
  }
  for (const migration of partialMigrationTerminals) {
    runPowerShell([
      "-File", backupScript,
      "-FixtureMode",
      "-FixtureScenario", "GuardProductionMigrationContract",
      "-ProjectName", "project-local-production",
      "-ProjectRef", "wdlaauzknfggoqldolmx",
      "-ExpectedMigration", migration,
    ], { expectSuccess: false });
  }
  runPowerShell([
    "-File", backupScript,
    "-FixtureMode",
    "-FixtureScenario", "GuardProductionMigrationContract",
    "-ProjectName", "wrong-production-project",
    "-ProjectRef", "wdlaauzknfggoqldolmx",
    "-ExpectedMigration", "20260824123500",
  ], { expectSuccess: false });
  runPowerShell([
    "-File", backupScript,
    "-FixtureMode",
    "-FixtureScenario", "GuardProductionMigrationContract",
    "-ProjectName", "project-local-production",
    "-ProjectRef", "kfuujcfxoayukywvtaeh",
    "-ExpectedMigration", "20260824123500",
  ], { expectSuccess: false });
  for (const [currentMigration, targetMigration] of [
    ["20260714122230", "20260812123430"],
    ["20260812123430", "20260824123500"],
    ["20260824123500", "20260902120000"],
    ["20260902120000", "20260903120000"],
  ]) {
    assertIncludes(
      runPowerShell([
        "-File", taskRegistrationScript,
        "-FixtureMode",
        "-Action", "UpdateExpectedMigration",
        "-FixtureScenario", "Success",
        "-CurrentExpectedMigration", currentMigration,
        "-ExpectedMigration", targetMigration,
      ], { expectSuccess: true }),
      "fixture_backup_migration_lock_transition_ok",
      `${currentMigration} to ${targetMigration} task migration-lock transition`,
    );
  }
  assertIncludes(
    runPowerShell([
      "-File", taskRegistrationScript,
      "-FixtureMode",
      "-Action", "ValidateExpectedMigrationTransition",
      "-FixtureScenario", "Success",
      "-CurrentExpectedMigration", "20260824123500",
      "-ExpectedMigration", "20260902120000",
    ], { expectSuccess: true }),
    "fixture_backup_migration_lock_transition_dry_run_ok mutation_performed=false",
    "reviewed task migration-lock transition dry-run",
  );
  assertIncludes(
    runPowerShell([
      "-File", taskRegistrationScript,
      "-FixtureMode",
      "-Action", "ValidateExpectedMigrationTransition",
      "-FixtureScenario", "Success",
      "-CurrentExpectedMigration", "20260902120000",
      "-ExpectedMigration", "20260903120000",
    ], { expectSuccess: true }),
    "fixture_backup_migration_lock_transition_dry_run_ok mutation_performed=false",
    "Quick View privilege-hardening task migration-lock transition dry-run",
  );
  for (const scenario of ["WrongCurrent", "WrongTarget", "Running", "UnexpectedTaskIdentity", "UnsupportedRuntime"]) {
    runPowerShell([
      "-File", taskRegistrationScript,
      "-FixtureMode",
      "-Action", "ValidateExpectedMigrationTransition",
      "-FixtureScenario", scenario,
      "-CurrentExpectedMigration", "20260824123500",
      "-ExpectedMigration", "20260902120000",
    ], { expectSuccess: false });
    runPowerShell([
      "-File", taskRegistrationScript,
      "-FixtureMode",
      "-Action", "ValidateExpectedMigrationTransition",
      "-FixtureScenario", scenario,
      "-CurrentExpectedMigration", "20260902120000",
      "-ExpectedMigration", "20260903120000",
    ], { expectSuccess: false });
  }
  for (const [currentMigration, targetMigration] of [
    ["20260824123500", "20260824123500"],
    ["20260824123500", "20260901120000"],
    ["20260824123500", "20991231235959"],
    ["20260902120000", "20260824123500"],
    ["20260902120000", "20260902120000"],
    ["20260902120000", "20991231235959"],
    ["20260903120000", "20260902120000"],
    ["20260829130000", "20260902120000"],
    ["20260901120000", "20260902120000"],
  ]) {
    runPowerShell([
      "-File", taskRegistrationScript,
      "-FixtureMode",
      "-Action", "ValidateExpectedMigrationTransition",
      "-FixtureScenario", "Success",
      "-CurrentExpectedMigration", currentMigration,
      "-ExpectedMigration", targetMigration,
    ], { expectSuccess: false });
  }
  for (const targetMigration of ["20991231235959", "not-a-migration"]) {
    runPowerShell([
      "-File", taskRegistrationScript,
      "-FixtureMode",
      "-Action", "UpdateExpectedMigration",
      "-FixtureScenario", "Success",
      "-CurrentExpectedMigration", "20260824123500",
      "-ExpectedMigration", targetMigration,
    ], { expectSuccess: false });
  }
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
  assertIncludes(runPowerShell(["-File", backupScript, "-FixtureMode", "-FixtureScenario", "MigrationPreflightExpected"], { expectSuccess: true }), "fixture_migration_preflight_expected_ok", "migration preflight expected fixture");
  assertIncludes(runPowerShell(["-File", backupScript, "-FixtureMode", "-FixtureScenario", "MigrationPreflightFutureExpected"], { expectSuccess: true }), "fixture_migration_preflight_future_expected_ok", "future migration preflight expected fixture");
  assertIncludes(runPowerShell(["-File", backupScript, "-FixtureMode", "-FixtureScenario", "MigrationPreflightPrivilegeHardeningExpected"], { expectSuccess: true }), "fixture_migration_preflight_privilege_hardening_expected_ok", "privilege-hardening migration preflight expected fixture");
  assertIncludes(runPowerShell(["-File", backupScript, "-FixtureMode", "-FixtureScenario", "MigrationPreflightTransitionPending"], { expectSuccess: true }), "fixture_migration_preflight_transition_pending_rejected", "pre-lock-transition migration mismatch fixture");
  assertIncludes(runPowerShell(["-File", backupScript, "-FixtureMode", "-FixtureScenario", "MigrationPreflightPrivilegeHardeningTransitionPending"], { expectSuccess: true }), "fixture_migration_preflight_privilege_hardening_transition_pending_rejected", "privilege-hardening pre-lock-transition mismatch fixture");
  assertIncludes(runPowerShell(["-File", backupScript, "-FixtureMode", "-FixtureScenario", "MigrationPreflightPartialProjectDay"], { expectSuccess: true }), "fixture_migration_preflight_partial_project_day_rejected", "partial Project Day migration preflight fixture");
  assertIncludes(runPowerShell(["-File", backupScript, "-FixtureMode", "-FixtureScenario", "MigrationPreflightPartialAnonRevoke"], { expectSuccess: true }), "fixture_migration_preflight_partial_anon_revoke_rejected", "partial anon-revoke migration preflight fixture");
  assertIncludes(runPowerShell(["-File", backupScript, "-FixtureMode", "-FixtureScenario", "MigrationPreflightWrong"], { expectSuccess: true }), "fixture_migration_preflight_wrong_rejected", "migration preflight wrong fixture");
  assertIncludes(runPowerShell(["-File", backupScript, "-FixtureMode", "-FixtureScenario", "MigrationPreflightMissing"], { expectSuccess: true }), "fixture_migration_preflight_missing_rejected", "migration preflight missing fixture");
  assertIncludes(runPowerShell(["-File", backupScript, "-FixtureMode", "-FixtureScenario", "MigrationPreflightMalformed"], { expectSuccess: true }), "fixture_migration_preflight_malformed_rejected", "migration preflight malformed fixture");
  assertIncludes(runPowerShell(["-File", backupScript, "-FixtureMode", "-FixtureScenario", "MigrationPreflightQueryFailure"], { expectSuccess: true }), "fixture_migration_preflight_query_failure_rejected", "migration preflight query-failure fixture");
  const failureProofRoot = await mkdtemp(path.join(tmpdir(), "project-local-backup-failure-proof-"));
  try {
    const notificationSink = path.join(failureProofRoot, "operator-signal.txt");
    const failureOutput = runPowerShell([
      "-File", backupScript,
      "-FixtureMode",
      "-FixtureScenario", "SafeInjectedFailure",
      "-ConfirmSafeInjectedFailure",
      "-NotifyOnFailure",
      "-FailureTestStatusRoot", failureProofRoot,
      "-NotificationTestSinkPath", notificationSink,
    ], { expectSuccess: false });
    assertIncludes(failureOutput, "Safe injected pre-network failure completed", "safe injected failure");
    const failureStatus = JSON.parse(await readFile(path.join(failureProofRoot, "latest-status.json"), "utf8"));
    assert.equal(failureStatus.status, "failure");
    assert.equal(failureStatus.safeFailureCode, "injected_pre_network_failure");
    assert.equal(failureStatus.encryptedFileName, null);
    assert.equal(failureStatus.sha256, null);
    const notificationStatus = JSON.parse(await readFile(path.join(failureProofRoot, "latest-notification.json"), "utf8"));
    assert.equal(notificationStatus.notificationState, "emitted");
    assert.equal(notificationStatus.safeFailureCode, "injected_pre_network_failure");
    const operatorSignal = await readFile(notificationSink, "utf8");
    assert.match(operatorSignal, /Project Local production backup failed/);
    assert.match(operatorSignal, /injected_pre_network_failure/);
    assert(!/postgres(?:ql)?:\/\/|password|AGE-SECRET-KEY|service.role|eyJ[A-Za-z0-9_-]+\./i.test(operatorSignal));
  } finally {
    await rm(failureProofRoot, { recursive: true, force: true });
  }
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
  assertIncludes(runPowerShell(["-File", restoreScript, "-FixtureMode", "-FixtureScenario", "SourceAclPlan"], { expectSuccess: true }), "fixture_source_acl_plan_ok", "source ACL plan fixture");
  assertIncludes(runPowerShell(["-File", restoreScript, "-FixtureMode", "-FixtureScenario", "SourceAclUnknownPrivilege"], { expectSuccess: false }), "source_table_acl_contract_mismatch", "source ACL unknown privilege fixture");
  assertIncludes(runPowerShell(["-File", restoreScript, "-FixtureMode", "-FixtureScenario", "SourceAclGrantAll"], { expectSuccess: false }), "source_protected_table_grant_all_unsupported", "source ACL grant-all fixture");
  assertIncludes(runPowerShell(["-File", restoreScript, "-FixtureMode", "-FixtureScenario", "SourceAclDuplicateTable"], { expectSuccess: false }), "source_table_shape_mismatch", "source ACL duplicate table fixture");
  assertIncludes(runPowerShell(["-File", restoreScript, "-FixtureMode", "-FixtureScenario", "SourceAclMissingTable"], { expectSuccess: false }), "source_table_shape_mismatch", "source ACL missing table fixture");
  assertIncludes(runPowerShell(["-File", restoreScript, "-FixtureMode", "-FixtureScenario", "SourceAclUnsupportedOwnership"], { expectSuccess: false }), "source_security_statement_shape_unclassified", "source ACL unsupported ownership fixture");
  assertIncludes(runPowerShell(["-File", restoreScript, "-FixtureMode", "-FixtureScenario", "SourceAclFunctionBodyFalsePositive"], { expectSuccess: true }), "fixture_source_acl_function_body_ignored_ok", "source ACL function-body false-positive fixture");

  const residueRoot = await mkdtemp(path.join(tmpdir(), "project-local-backup-regression-"));
  await writeFile(path.join(residueRoot, "probe.txt"), "probe", "utf8");
  await rm(residueRoot, { recursive: true, force: true });

  if (process.argv.includes("--native-dump-loopback")) {
    await runNativeDumpLoopbackProof();
  }

  console.log("Production independent backup foundation is route-unused, credential-free, guardrailed, fixture-safe, and NO-GO honest.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
