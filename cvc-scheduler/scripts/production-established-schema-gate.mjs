import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  buildProjectLocalDefaultTablePrivilegeQuery,
  buildProjectLocalDirectTablePrivilegeQuery,
  compareProjectLocalDefaultTablePrivileges,
  compareProjectLocalDirectTablePrivileges,
  projectLocalExpectedDirectTablePrivileges,
  projectLocalTableNames,
} from "../lib/security/projectLocalTablePrivileges.server.ts";

const root = process.cwd();

export const establishedProductionTarget = Object.freeze({
  projectName: "project-local-production",
  projectRef: "wdlaauzknfggoqldolmx",
  forbiddenStagingRef: "kfuujcfxoayukywvtaeh",
  beforeMigration: "20260714122230",
  afterMigration: "20260812123430",
  pendingMigrations: Object.freeze(["20260811123300", "20260812123430"]),
});

const productionModes = new Set([
  "production-preflight",
  "production-apply",
  "production-postflight",
]);
const optInName = "RUN_ESTABLISHED_PRODUCTION_SCHEMA_GATE";
const backupWindowOptInName = "RUN_ESTABLISHED_PRODUCTION_BACKUP_WINDOW";
const expectedForceRlsTables = Object.freeze([
  "assignment_notification_deliveries",
  "project_contacts",
  "workspace_contact_grants",
  "workspaces",
]);
const expectedMigrationFiles = Object.freeze([
  "20260811123300_stale_assignment_notification_delivery_health.sql",
  "20260812123430_project_local_table_privilege_hardening.sql",
]);
const currentGeneratedTypeMigration = "20260902120000";
const fixtureEnvironmentNames = Object.freeze([
  "RUN_PRODUCTION_FIXTURES",
  "SEED_PRODUCTION_DATA",
  "RUN_HOSTED_BOZEMAN_BETA_E2E_VALIDATION",
  "RUN_HOSTED_ASSIGNMENT_NOTIFICATION_EMAIL_VALIDATION",
  "RUN_HOSTED_VOLUNTEER_SCHEDULE_RESPONSE_VALIDATION",
]);

const secrets = new Set();

function redact(value) {
  let message = value instanceof Error ? (value.stack ?? value.message) : String(value);
  for (const secret of secrets) {
    if (typeof secret === "string" && secret.length > 0) {
      message = message.replaceAll(secret, "[redacted]");
      message = message.replaceAll(encodeURIComponent(secret), "[redacted]");
    }
  }
  return message
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted-jwt]")
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[redacted-db-url]")
    .replace(/(?:password|access_token|refresh_token|service_role|apikey|api_key|authorization)[^\n\r]*/gi, "[redacted-sensitive]");
}

function command(commandName, args, options = {}) {
  return spawnSync(commandName, args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 160 * 1024 * 1024,
    windowsHide: true,
    ...options,
  });
}

function runSupabaseCli(args, options = {}) {
  const isWindows = process.platform === "win32";
  const supabaseArgs = options.workdir
    ? ["--workdir", options.workdir, ...args]
    : args;
  const executable = isWindows ? process.execPath : "npx";
  const executableArgs = isWindows
    ? [
        path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npx-cli.js"),
        "--yes",
        "supabase",
        ...supabaseArgs,
      ]
    : ["--yes", "supabase", ...supabaseArgs];
  const result = command(executable, executableArgs, options.commandOptions);
  if (result.status !== 0) {
    const detail = options.sensitiveOutput
      ? "Sensitive command output was suppressed."
      : [result.error?.message, result.stderr, result.stdout].filter(Boolean).join("\n");
    throw new Error(`${options.stage ?? "Supabase command"} failed: ${redact(detail || "No diagnostic returned.")}`);
  }
  return options.includeStderr
    ? `${result.stdout}\n${result.stderr}`.trim()
    : result.stdout.trim();
}

function parseJson(output, stage) {
  try {
    return JSON.parse(output);
  } catch {
    throw new Error(`${stage} returned unreadable JSON.`);
  }
}

function sqlText(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlUuid(value) {
  return `${sqlText(value)}::uuid`;
}

function localMigrationFiles() {
  const migrationDirectory = path.join(root, "supabase", "migrations");
  return readdirSync(migrationDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort();
}

function migrationVersion(fileName) {
  const version = fileName.split("_")[0];
  assert.match(version, /^\d{14}$/, `Malformed migration filename: ${fileName}.`);
  return version;
}

export function assertMigrationInventory(files = localMigrationFiles()) {
  const versions = files.map(migrationVersion);
  assert.equal(new Set(versions).size, versions.length, "Migration versions must be unique.");
  const beforeIndex = versions.indexOf(establishedProductionTarget.beforeMigration);
  assert(beforeIndex >= 0, "The established production baseline migration is missing.");
  const historicalTerminalIndex = versions.indexOf(establishedProductionTarget.afterMigration);
  assert(historicalTerminalIndex >= 0, "The established production terminal migration is missing.");
  assert.deepEqual(
    files.slice(beforeIndex + 1, historicalTerminalIndex + 1),
    expectedMigrationFiles,
    "The reviewed historical established-production migration chain is missing, reordered, or contains an unexpected migration.",
  );
  assert.deepEqual(
    versions.slice(beforeIndex + 1, historicalTerminalIndex + 1),
    [...establishedProductionTarget.pendingMigrations],
    "The pending migration set must be exactly the two reviewed migrations.",
  );
  const historicalVersions = versions.slice(0, historicalTerminalIndex + 1);
  assert.equal(
    historicalVersions.at(-1),
    establishedProductionTarget.afterMigration,
    "The historical established-production migration view has the wrong terminal version.",
  );
  return { files, versions: historicalVersions, repositoryVersions: versions, beforeIndex, historicalTerminalIndex };
}

function createLocalMigrationWorkdir(terminalMigration, label) {
  assert.match(terminalMigration, /^\d{14}$/, "Disposable migration view requires an exact terminal migration.");
  const workdir = path.join(tmpdir(), `project-local-established-schema-${label}-${randomUUID()}`);
  const supabaseDirectory = path.join(workdir, "supabase");
  const migrationDirectory = path.join(supabaseDirectory, "migrations");
  mkdirSync(migrationDirectory, { recursive: true });
  copyFileSync(path.join(root, "supabase", "config.toml"), path.join(supabaseDirectory, "config.toml"));
  for (const fileName of localMigrationFiles()) {
    if (migrationVersion(fileName) > terminalMigration) continue;
    copyFileSync(
      path.join(root, "supabase", "migrations", fileName),
      path.join(migrationDirectory, fileName),
    );
  }
  return workdir;
}

function assertMigrationFilesCommittedAndUnchanged() {
  for (const fileName of expectedMigrationFiles) {
    const relativePath = path.join("supabase", "migrations", fileName);
    const result = command("git", ["diff", "--quiet", "HEAD", "--", relativePath]);
    assert.equal(result.status, 0, `${fileName} differs from the committed reviewed file.`);
  }
}

export function parseGateArguments(argv) {
  if (
    argv.length === 5 &&
    productionModes.has(argv[0]) &&
    argv.every((value) => typeof value === "string" && value.length > 0 && !value.startsWith("--"))
  ) {
    const [mode, projectName, projectRef, expectedBefore, expectedAfter] = argv;
    const config = { mode, projectName, projectRef, expectedBefore, expectedAfter };
    assert.equal(config.projectName, establishedProductionTarget.projectName, "Wrong production project name.");
    assert.equal(config.projectRef, establishedProductionTarget.projectRef, "Wrong production project ref.");
    assert.notEqual(config.projectRef, establishedProductionTarget.forbiddenStagingRef, "Staging is forbidden in production mode.");
    assert.equal(config.expectedBefore, establishedProductionTarget.beforeMigration, "Wrong established production baseline.");
    assert.equal(config.expectedAfter, establishedProductionTarget.afterMigration, "Wrong established production target.");
    return config;
  }
  assert(argv.length % 2 === 0, "Gate arguments must use explicit option/value pairs.");
  const allowed = new Set([
    "--mode",
    "--project-name",
    "--project-ref",
    "--expected-before",
    "--expected-after",
  ]);
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    assert(allowed.has(key), `Unknown or fixture-capable gate option: ${key}.`);
    assert(!values.has(key), `Duplicate gate option: ${key}.`);
    assert(typeof value === "string" && value.length > 0, `Missing value for ${key}.`);
    values.set(key, value);
  }
  const mode = values.get("--mode");
  assert(mode, "The gate requires --mode.");
  if (mode === "local-regression") {
    assert.equal(values.size, 1, "Local regression mode does not accept production target arguments.");
    return { mode };
  }
  assert(productionModes.has(mode), "Unknown established-production gate mode.");
  const config = {
    mode,
    projectName: values.get("--project-name"),
    projectRef: values.get("--project-ref"),
    expectedBefore: values.get("--expected-before"),
    expectedAfter: values.get("--expected-after"),
  };
  assert.equal(config.projectName, establishedProductionTarget.projectName, "Wrong production project name.");
  assert.equal(config.projectRef, establishedProductionTarget.projectRef, "Wrong production project ref.");
  assert.notEqual(config.projectRef, establishedProductionTarget.forbiddenStagingRef, "Staging is forbidden in production mode.");
  assert.equal(config.expectedBefore, establishedProductionTarget.beforeMigration, "Wrong established production baseline.");
  assert.equal(config.expectedAfter, establishedProductionTarget.afterMigration, "Wrong established production target.");
  return config;
}

function expectedOptIn(mode) {
  return [
    establishedProductionTarget.projectName,
    establishedProductionTarget.projectRef,
    mode,
    establishedProductionTarget.beforeMigration,
    establishedProductionTarget.afterMigration,
  ].join(":");
}

export function assertProductionEnvironment(config, environment = process.env, gitStatus = undefined) {
  assert(productionModes.has(config.mode), "Production environment guards require a production mode.");
  assert.equal(
    environment[optInName],
    expectedOptIn(config.mode),
    `Refusing established-production gate without exact ${optInName}.`,
  );
  for (const name of fixtureEnvironmentNames) {
    assert(!environment[name]?.trim(), `${name} is forbidden in production mode.`);
  }
  const emailTransport = environment.ASSIGNMENT_NOTIFICATION_EMAIL_TRANSPORT?.trim();
  assert(
    !emailTransport || emailTransport === "disabled",
    "Application email transport must be absent or explicitly disabled.",
  );
  assert(!environment.SUPABASE_SERVICE_ROLE_KEY?.trim(), "Service-role application configuration is forbidden.");
  if (config.mode === "production-apply") {
    const expectedWindow = [
      establishedProductionTarget.projectName,
      "task-disabled",
      establishedProductionTarget.beforeMigration,
      establishedProductionTarget.afterMigration,
    ].join(":");
    assert.equal(
      environment[backupWindowOptInName],
      expectedWindow,
      `Production apply requires the separately verified disabled-task window in ${backupWindowOptInName}.`,
    );
  }
  const status = gitStatus ?? command("git", ["status", "--short"]).stdout.trim();
  assert.equal(status, "", "Production established-schema execution requires a clean committed worktree.");
}

export function assertBackupTaskWindowMetadata(metadata) {
  assert.equal(metadata?.present, true, "The permanent production backup task is missing.");
  assert.equal(metadata.enabled, false, "The permanent production backup task must be disabled during migration apply.");
  assert.notEqual(metadata.state, "Running", "The permanent production backup task must not be running during migration apply.");
  assert.equal(metadata.baselineLock, true, "The disabled backup task must still hold the reviewed pre-migration lock.");
  assert.equal(metadata.targetLock, false, "The backup task lock must not advance before the production migration succeeds.");
}

function assertProductionBackupTaskWindow() {
  const script = [
    "$task = Get-ScheduledTask -TaskName 'Project Local Production Backup' -ErrorAction SilentlyContinue",
    "if ($null -eq $task) { [pscustomobject]@{ present = $false } | ConvertTo-Json -Compress; exit 0 }",
    "$arguments = [string]$task.Actions[0].Arguments",
    "[pscustomobject]@{ present = $true; enabled = [bool]$task.Settings.Enabled; state = [string]$task.State; baselineLock = [bool]($arguments -match '(?i)-ExpectedMigration\\s+\"?20260714122230(?:\"|\\s|$)'); targetLock = [bool]($arguments -match '(?i)-ExpectedMigration\\s+\"?20260812123430(?:\"|\\s|$)') } | ConvertTo-Json -Compress",
  ].join("; ");
  const result = command("powershell.exe", ["-NoProfile", "-Command", script]);
  assert.equal(result.status, 0, "Could not inspect the local permanent backup-task migration window.");
  assertBackupTaskWindowMetadata(parseJson(result.stdout.trim(), "Permanent backup-task window"));
}

export function assertDiscoveredTarget(project) {
  assert(project, "Approved production project ref was not discovered.");
  assert.equal(project.name, establishedProductionTarget.projectName, "Discovered project name mismatch.");
  assert.equal(project.ref, establishedProductionTarget.projectRef, "Discovered project ref mismatch.");
  assert.notEqual(project.ref, establishedProductionTarget.forbiddenStagingRef, "Target discovery resolved to staging.");
  assert.equal(project.status, "ACTIVE_HEALTHY", "Established production target is not ACTIVE_HEALTHY.");
}

export function assertLinkedTarget(linkedRef) {
  assert.equal(linkedRef, establishedProductionTarget.projectRef, "Supabase CLI is not linked to the exact production ref.");
  assert.notEqual(linkedRef, establishedProductionTarget.forbiddenStagingRef, "Supabase CLI is linked to staging.");
}

function assertWellFormedHistory(versions) {
  assert(versions.length > 0, "Established production cannot use pristine migration history.");
  for (const version of versions) assert.match(version, /^\d{14}$/, "Migration history contains a malformed version.");
  assert.equal(new Set(versions).size, versions.length, "Migration history contains a duplicate version.");
  assert.deepEqual([...versions].sort(), versions, "Migration history is not ordered.");
}

export function assertBeforeMigrationHistory(actual, localVersions) {
  assertWellFormedHistory(actual);
  const expected = localVersions.filter((version) => version <= establishedProductionTarget.beforeMigration);
  assert.deepEqual(actual, expected, "Established production history is not the exact reviewed pre-migration baseline.");
  assert.equal(actual.at(-1), establishedProductionTarget.beforeMigration, "Established production terminal migration is wrong.");
}

export function assertAfterMigrationHistory(actual, localVersions) {
  assertWellFormedHistory(actual);
  assert.deepEqual(actual, localVersions, "Post-migration history is partial, duplicated, or unexpected.");
  assert.equal(actual.at(-1), establishedProductionTarget.afterMigration, "Post-migration terminal version is wrong.");
  const tail = actual.slice(-2);
  assert.deepEqual(tail, [...establishedProductionTarget.pendingMigrations], "Reviewed migrations were not applied exactly once in order.");
}

export function parseDryRunVersions(output) {
  const versions = [];
  for (const line of String(output).split(/\r?\n/)) {
    if (!/\.sql\b/i.test(line) && !/^\s*[•*+-]?\s*\d{14}\b/.test(line)) continue;
    const match = line.match(/(?<!\d)(\d{14})(?!\d)/);
    if (match) versions.push(match[1]);
  }
  return [...new Set(versions)];
}

export function assertExactPendingPlan(versions) {
  assert.deepEqual(
    versions,
    [...establishedProductionTarget.pendingMigrations],
    "Migration dry-run must contain exactly the two reviewed pending migrations.",
  );
}

function runLinkedSql(sql, stage) {
  const file = path.join(tmpdir(), `project-local-established-schema-${randomUUID()}.sql`);
  writeFileSync(file, sql, "utf8");
  try {
    const output = runSupabaseCli(
      ["db", "query", "--linked", "--file", file, "--output-format", "json"],
      { sensitiveOutput: true, stage },
    );
    const parsed = parseJson(output, stage);
    assert(Array.isArray(parsed.rows), `${stage} omitted rows.`);
    return parsed.rows;
  } finally {
    try {
      unlinkSync(file);
    } catch {
      // best effort
    }
  }
}

function readMigrationHistory(query) {
  const rows = query(
    "select version from supabase_migrations.schema_migrations order by version;",
    "Established production migration history",
  );
  return rows.map((row) => String(row.version ?? ""));
}

function buildProductCountsQuery() {
  return projectLocalTableNames
    .map((table) => `select ${sqlText(table)} as table_name, count(*)::int as row_count from public.${table}`)
    .join(" union all ") + " order by table_name;";
}

function readStateSnapshot(query) {
  const authUsers = query("select id::text from auth.users order by id;", "Established production Auth inventory")
    .map((row) => String(row.id));
  const productCounts = query(buildProductCountsQuery(), "Established production product-row inventory")
    .map((row) => ({ table_name: String(row.table_name), row_count: Number(row.row_count) }));
  const storageObjects = Number(
    query(
      "select case when to_regclass('storage.objects') is null then 0 else (select count(*)::int from storage.objects) end as count;",
      "Established production Storage metadata inventory",
    )[0]?.count ?? 0,
  );
  const fixtureResidue = Number(
    query(
      `select ((select count(*) from public.workspaces where workspace_key like 'qa-%') +
       (select count(*) from auth.users where email like 'qa-%@example.invalid'))::int as count;`,
      "Established production fixture-residue check",
    )[0]?.count ?? 0,
  );
  return { authUsers, productCounts, storageObjects, fixtureResidue };
}

function totalProductRows(snapshot) {
  return snapshot.productCounts.reduce((sum, row) => sum + row.row_count, 0);
}

function assertCurrentPreProvisioningState(snapshot, label) {
  assert.equal(totalProductRows(snapshot), 0, `${label}: Project Local product rows exist before approved provisioning.`);
  assert.equal(snapshot.fixtureResidue, 0, `${label}: fixture/test namespace residue exists.`);
}

function assertStatePreserved(before, after) {
  assert.deepEqual(after.authUsers, before.authUsers, "Pre-existing Auth identities changed across migration.");
  assert.deepEqual(after.productCounts, before.productCounts, "Project Local product rows changed across migration.");
  assert.equal(after.storageObjects, before.storageObjects, "Storage metadata changed across migration.");
  assert.equal(after.fixtureResidue, before.fixtureResidue, "Fixture residue changed across migration.");
}

function querySecurityMetadata(query) {
  const rls = query(
    `select c.relname as table_name, c.relrowsecurity as rls_enabled, c.relforcerowsecurity as force_rls,
            owner.rolname as owner_name
     from pg_catalog.pg_class c
     join pg_catalog.pg_namespace n on n.oid = c.relnamespace
     join pg_catalog.pg_roles owner on owner.oid = c.relowner
     where n.nspname = 'public' and c.relkind = 'r'
       and c.relname = any(array[${projectLocalTableNames.map(sqlText).join(", ")}])
     order by c.relname;`,
    "Established production RLS metadata",
  );
  return { rls };
}

function assertBaselineSecurity(query) {
  const metadata = querySecurityMetadata(query);
  assert.equal(metadata.rls.length, projectLocalTableNames.length, "Baseline Project Local table set is incomplete.");
  assert(metadata.rls.every((row) => row.rls_enabled === true), "Baseline Project Local RLS is incomplete.");
  assert.deepEqual(
    metadata.rls.filter((row) => row.force_rls === true).map((row) => row.table_name).sort(),
    [...expectedForceRlsTables],
    "Baseline FORCE RLS set differs from the reviewed contract.",
  );
  const functionCount = Number(
    query(
      "select count(*)::int as count from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'read_assignment_notification_delivery_health';",
      "Established production pending-function absence",
    )[0]?.count ?? 0,
  );
  assert.equal(functionCount, 0, "Notification Health is unexpectedly present at the pre-migration baseline.");
}

function assertPostSecurity(query) {
  const metadata = querySecurityMetadata(query);
  assert.equal(metadata.rls.length, projectLocalTableNames.length, "Post-migration Project Local table set is incomplete.");
  assert(metadata.rls.every((row) => row.rls_enabled === true), "Post-migration RLS is incomplete.");
  assert(metadata.rls.every((row) => row.owner_name === "postgres"), "Project Local table ownership changed unexpectedly.");
  assert.deepEqual(
    metadata.rls.filter((row) => row.force_rls === true).map((row) => row.table_name).sort(),
    [...expectedForceRlsTables],
    "Post-migration FORCE RLS set differs from the reviewed contract.",
  );

  const functions = query(
    `select p.oid::regprocedure::text as signature, p.prosecdef as security_definer,
            p.provolatile, p.proconfig, owner.rolname as owner_name,
            exists (
              select 1
              from pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) as function_acl
              where function_acl.grantee = 0 and function_acl.privilege_type = 'EXECUTE'
            ) as public_execute,
            has_function_privilege('anon', p.oid, 'execute') as anon_execute,
            has_function_privilege('authenticated', p.oid, 'execute') as authenticated_execute,
            pg_get_functiondef(p.oid) as definition
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     join pg_roles owner on owner.oid = p.proowner
     where n.nspname = 'public' and p.proname = 'read_assignment_notification_delivery_health';`,
    "Established production Notification Health metadata",
  );
  assert.equal(functions.length, 1, "Notification Health must have exactly one overload.");
  const fn = functions[0];
  assert.equal(fn.signature, "read_assignment_notification_delivery_health()", "Notification Health signature changed.");
  assert.equal(fn.security_definer, true, "Notification Health must remain SECURITY DEFINER.");
  assert.equal(fn.provolatile, "s", "Notification Health must remain STABLE.");
  assert.deepEqual(fn.proconfig, ["search_path=\"\""], "Notification Health search_path changed.");
  assert.equal(fn.owner_name, "postgres", "Notification Health owner changed.");
  assert.equal(fn.public_execute, false, "PUBLIC may not execute Notification Health.");
  assert.equal(fn.anon_execute, false, "anon may not execute Notification Health.");
  assert.equal(fn.authenticated_execute, true, "authenticated must execute Notification Health.");
  for (const marker of [
    "auth.uid()",
    "workspace.read",
    "calendar.view",
    "assignments.view",
    "assignments.edit",
    "eligible_workspace_count <> 1",
    "delivery.delivery_state = 'sending'",
    "limit 100",
  ]) {
    assert(String(fn.definition).toLowerCase().includes(marker.toLowerCase()), `Notification Health definition lost ${marker}.`);
  }

  const directPrivileges = query(
    buildProjectLocalDirectTablePrivilegeQuery(),
    "Established production direct table privileges",
  );
  assert.deepEqual(
    compareProjectLocalDirectTablePrivileges(directPrivileges),
    { unexpected: [], missing: [] },
    "Direct table privileges differ from the centralized exact contract.",
  );
  const defaultPrivileges = query(
    buildProjectLocalDefaultTablePrivilegeQuery(),
    "Established production default table privileges",
  );
  assert.deepEqual(
    compareProjectLocalDefaultTablePrivileges(defaultPrivileges),
    { unexpected: [], missing: [] },
    "Protected future-table default privileges differ from the exact contract.",
  );
  assert.equal(
    projectLocalExpectedDirectTablePrivileges.filter((row) => row.grantee === "authenticated").length,
    9,
    "Authenticated SELECT allowlist must contain exactly nine tables.",
  );
  const serviceRole = query(
    "select rolname, rolbypassrls from pg_roles where rolname = 'service_role';",
    "Established production platform-role check",
  );
  assert.equal(serviceRole.length, 1, "Supabase service_role platform role is missing.");
  assert.equal(serviceRole[0].rolbypassrls, true, "Supabase service_role must retain platform RLS bypass behavior.");
}

function normalizeGeneratedTypes(source) {
  return source
    .replace(/\r\n/g, "\n")
    .replace(
      /\n\s*\/\/ Allows to automatically instantiate createClient with right options\s*\n\s*\/\/ instead of createClient<Database, \{ PostgrestVersion: 'XX' \}>\(URL, KEY\)\s*(?=\n\s*__InternalSupabase:)/m,
      "",
    )
    .replace(
      /\n\s*__InternalSupabase:\s*\{\s*\n\s*PostgrestVersion:\s*"[^"]+"\s*\n\s*\}\s*(?=\n\s*public:)/m,
      "",
    )
    .trim();
}

function verifyGeneratedTypes(mode) {
  const committed = readFileSync(path.join(root, "lib", "supabase", "database.types.ts"), "utf8");
  const args = ["gen", "types", "typescript", mode === "local" ? "--local" : "--linked", "--schema", "public"];
  const generated = runSupabaseCli(args, {
    sensitiveOutput: mode !== "local",
    stage: `${mode} generated-type comparison`,
  });
  assert.equal(
    normalizeGeneratedTypes(generated),
    normalizeGeneratedTypes(committed),
    `${mode} generated public-schema types differ from committed types.`,
  );
}

function discoverAndVerifyProductionTarget() {
  const output = runSupabaseCli(["projects", "list", "--output-format", "json"], {
    stage: "Established production project discovery",
  });
  const parsed = parseJson(output, "Established production project discovery");
  const projects = Array.isArray(parsed) ? parsed : parsed.projects;
  const project = projects?.find((entry) => entry.ref === establishedProductionTarget.projectRef);
  assertDiscoveredTarget(project);
  const linkedPath = path.join(root, "supabase", ".temp", "project-ref");
  assert(existsSync(linkedPath), "Supabase CLI is not linked for the separately authorized production gate.");
  assertLinkedTarget(readFileSync(linkedPath, "utf8").trim());
}

function productionMigrationPlan() {
  const output = runSupabaseCli(
    ["db", "push", "--linked", "--include-all", "--skip-vault", "--dry-run", "--yes"],
    { sensitiveOutput: true, includeStderr: true, stage: "Established production migration dry-run" },
  );
  const versions = parseDryRunVersions(output);
  assertExactPendingPlan(versions);
  return versions;
}

function applyProductionMigrations() {
  runSupabaseCli(
    ["db", "push", "--linked", "--include-all", "--skip-vault", "--yes"],
    { sensitiveOutput: true, stage: "Established production migration application" },
  );
}

async function runProductionGate(config) {
  assertProductionEnvironment(config);
  if (config.mode === "production-apply") assertProductionBackupTaskWindow();
  const inventory = assertMigrationInventory();
  assertMigrationFilesCommittedAndUnchanged();
  discoverAndVerifyProductionTarget();
  const query = runLinkedSql;
  const history = readMigrationHistory(query);

  if (config.mode === "production-preflight") {
    assertBeforeMigrationHistory(history, inventory.versions);
    const snapshot = readStateSnapshot(query);
    assertCurrentPreProvisioningState(snapshot, "preflight");
    assertBaselineSecurity(query);
    productionMigrationPlan();
    console.log(`Established-production preflight passed. Auth identities observed: ${snapshot.authUsers.length}. Storage objects observed: ${snapshot.storageObjects}.`);
    console.log("Exact pending chain: 20260811123300, 20260812123430. No mutation occurred.");
    return;
  }

  if (config.mode === "production-apply") {
    assertBeforeMigrationHistory(history, inventory.versions);
    const before = readStateSnapshot(query);
    assertCurrentPreProvisioningState(before, "pre-apply");
    assertBaselineSecurity(query);
    productionMigrationPlan();
    applyProductionMigrations();
    const afterHistory = readMigrationHistory(query);
    assertAfterMigrationHistory(afterHistory, inventory.versions);
    const after = readStateSnapshot(query);
    assertStatePreserved(before, after);
    assertPostSecurity(query);
    verifyGeneratedTypes("linked");
    console.log("Established-production migration and post-state verification passed for the exact two-migration chain.");
    console.log(`Auth identities preserved: ${after.authUsers.length}. Project Local product rows: ${totalProductRows(after)}.`);
    return;
  }

  assertAfterMigrationHistory(history, inventory.versions);
  const snapshot = readStateSnapshot(query);
  assertCurrentPreProvisioningState(snapshot, "postflight");
  assertPostSecurity(query);
  verifyGeneratedTypes("linked");
  console.log(`Established-production postflight passed. Auth identities observed: ${snapshot.authUsers.length}. Project Local product rows: ${totalProductRows(snapshot)}.`);
}

function resolveLocalDatabaseContainer() {
  const config = readFileSync(path.join(root, "supabase", "config.toml"), "utf8");
  const projectId = config.match(/^project_id\s*=\s*"([a-zA-Z0-9_-]+)"/m)?.[1];
  assert(projectId, "supabase/config.toml must define a local project_id.");
  const containerName = `supabase_db_${projectId}`;
  const result = command("docker", ["inspect", "--format", "{{.State.Running}}", containerName]);
  assert(result.status === 0 && result.stdout.trim() === "true", "Disposable local Supabase database is unavailable.");
  return containerName;
}

function runLocalPsql(containerName, sql) {
  const result = command(
    "docker",
    [
      "exec", "-i", containerName, "psql", "--no-psqlrc", "-X", "-qAt",
      "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres",
    ],
    { input: sql },
  );
  if (result.status !== 0) throw new Error(`Disposable local SQL failed: ${redact(result.stderr).slice(0, 900)}`);
  return result.stdout.trim();
}

function localQuery(containerName, sql) {
  const normalizedSql = String(sql).trim().replace(/;+\s*$/, "");
  const output = runLocalPsql(
    containerName,
    `select coalesce(jsonb_agg(to_jsonb(rows)), '[]'::jsonb)::text from (${normalizedSql}) as rows;`,
  );
  return JSON.parse(output || "[]");
}

function localStatus() {
  return parseJson(runSupabaseCli(["status", "--output", "json"], { stage: "Local Supabase status" }), "Local Supabase status");
}

async function createLocalAuthIdentity(status, namespace) {
  const apiUrl = status.API_URL;
  const anonKey = status.ANON_KEY;
  assert(typeof apiUrl === "string" && new URL(apiUrl).hostname === "127.0.0.1", "Local Auth URL is not loopback.");
  assert(typeof anonKey === "string" && anonKey.length > 20, "Local anon key is missing.");
  const email = `${namespace}-${randomUUID()}@example.invalid`;
  const password = `${randomBytes(24).toString("base64url")}aA1!`;
  for (const value of [anonKey, email, password]) secrets.add(value);
  const client = createClient(apiUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const result = await client.auth.signUp({ email, password });
  assert(!result.error && result.data.user, "Synthetic local Auth identity creation failed.");
  if (result.data.session) {
    secrets.add(result.data.session.access_token);
    secrets.add(result.data.session.refresh_token);
  }
  return { id: result.data.user.id, email };
}

function insertLocalPreservationFixture(containerName, fixture) {
  runLocalPsql(containerName, `begin;
insert into public.workspaces (id, workspace_key, display_name, lifecycle, timezone, starts_on, ends_on, public_intake_enabled)
values (${sqlUuid(fixture.workspaceId)}, ${sqlText(fixture.workspaceKey)}, 'Established gate fixture', 'active', 'America/Denver', current_date, current_date + 1, false);
insert into public.project_contacts (id, auth_user_id, status)
values (${sqlUuid(fixture.contactId)}, ${sqlUuid(fixture.authUserId)}, 'active');
insert into public.workspace_contact_grants (id, workspace_id, project_contact_id, role, capabilities, status, valid_from, valid_until, revoked_at)
values (${sqlUuid(fixture.grantId)}, ${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.contactId)}, 'main_contact', array['workspace.read','calendar.view','assignments.view','assignments.edit']::text[], 'active', clock_timestamp() - interval '1 day', null, null);
commit;`);
}

function readLocalFixtureSnapshot(containerName, fixture) {
  return localQuery(
    containerName,
    `select
       (select count(*)::int from auth.users where id = ${sqlUuid(fixture.authUserId)}) as auth_count,
       (select count(*)::int from auth.users where email = ${sqlText(fixture.email)}) as auth_email_count,
       (select count(*)::int from public.workspaces where id = ${sqlUuid(fixture.workspaceId)} and workspace_key = ${sqlText(fixture.workspaceKey)} and lifecycle = 'active') as workspace_count,
       (select count(*)::int from public.project_contacts where id = ${sqlUuid(fixture.contactId)} and auth_user_id = ${sqlUuid(fixture.authUserId)} and status = 'active') as contact_count,
       (select count(*)::int from public.workspace_contact_grants where id = ${sqlUuid(fixture.grantId)} and workspace_id = ${sqlUuid(fixture.workspaceId)} and project_contact_id = ${sqlUuid(fixture.contactId)} and status = 'active') as grant_count`,
  )[0];
}

function assertLocalFixturePreserved(snapshot) {
  assert.deepEqual(snapshot, {
    auth_count: 1,
    auth_email_count: 1,
    workspace_count: 1,
    contact_count: 1,
    grant_count: 1,
  }, "Synthetic Auth/product preservation fixture changed across migration.");
}

function verifyFutureTableDefaults(containerName, namespace) {
  const tableName = `${namespace.replaceAll("-", "_")}_future_table`;
  runLocalPsql(containerName, `begin;
create table public.${tableName} (id bigint primary key);
do $$
declare unexpected_count integer;
begin
  select count(*)::integer into unexpected_count
  from pg_class relation
  join pg_namespace namespace on namespace.oid = relation.relnamespace
  cross join lateral aclexplode(coalesce(relation.relacl, acldefault('r', relation.relowner))) expanded
  left join pg_roles grantee on grantee.oid = expanded.grantee
  where namespace.nspname = 'public'
    and relation.relname = ${sqlText(tableName)}
    and coalesce(grantee.rolname, 'PUBLIC') in ('anon', 'authenticated', 'PUBLIC');
  if unexpected_count <> 0 then raise exception 'future_table_default_privilege_mismatch'; end if;
end;
$$;
rollback;`);
  const residue = localQuery(
    containerName,
    `select to_regclass(${sqlText(`public.${tableName}`)}) is not null as present`,
  );
  assert.equal(residue[0]?.present, false, "Future-table probe residue remains.");
}

function cleanupLocalFixture(containerName, fixture) {
  runLocalPsql(containerName, `begin;
delete from public.workspaces where id = ${sqlUuid(fixture.workspaceId)};
delete from auth.users where id = ${sqlUuid(fixture.authUserId)};
commit;`);
  const residue = localQuery(
    containerName,
    `select ((select count(*) from public.workspaces where workspace_key = ${sqlText(fixture.workspaceKey)}) +
             (select count(*) from auth.users where id = ${sqlUuid(fixture.authUserId)}))::int as count`,
  );
  assert.equal(residue[0]?.count, 0, "Established gate fixture residue remains.");
}

function runExistingNotificationHealthRegression(status) {
  const executable = process.platform === "win32" ? process.execPath : "npm";
  const args = process.platform === "win32"
    ? [
        path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js"),
        "run",
        "test:assignment-notification-health",
      ]
    : ["run", "test:assignment-notification-health"];
  const result = command(
    executable,
    args,
    {
      env: {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
        ASSIGNMENT_NOTIFICATION_EMAIL_TRANSPORT: "disabled",
        SUPABASE_SERVICE_ROLE_KEY: "",
      },
    },
  );
  if (result.status !== 0) throw new Error(`Notification Health compatibility regression failed: ${redact(`${result.error?.message ?? ""}\n${result.stdout ?? ""}\n${result.stderr ?? ""}`).slice(0, 1200)}`);
}

function runTaskMigrationLockFixture(scenario, shouldPass) {
  const scriptPath = path.join(
    root,
    "scripts",
    "production-backup",
    "Register-ProjectLocalBackupTask.ps1",
  );
  const result = command(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy", "Bypass",
      "-File", scriptPath,
      "-Action", "UpdateExpectedMigration",
      "-FixtureMode",
      "-FixtureScenario", scenario,
      "-CurrentExpectedMigration", establishedProductionTarget.beforeMigration,
      "-ExpectedMigration", establishedProductionTarget.afterMigration,
    ],
  );
  const output = `${result.stdout}\n${result.stderr}`;
  if (shouldPass) {
    assert.equal(result.status, 0, `Backup migration-lock ${scenario} fixture failed.`);
    assert(output.includes("fixture_backup_migration_lock_transition_ok"), "Backup migration-lock fixture omitted its safe marker.");
  } else {
    assert.notEqual(result.status, 0, `Backup migration-lock ${scenario} fixture unexpectedly passed.`);
  }
  assert(!/postgres(?:ql)?:\/\/|AGE-SECRET-KEY|bearer|service[_-]?role[_-]?key/i.test(output), "Backup migration-lock fixture output exposed credential-like material.");
}

async function verifyStaticMigrationRiskMap() {
  const [healthMigration, privilegeMigration, bootstrapGate, packageJson, taskRegistration, backupExecution, migrationContract] = await Promise.all([
    readFile(path.join(root, "supabase", "migrations", expectedMigrationFiles[0]), "utf8"),
    readFile(path.join(root, "supabase", "migrations", expectedMigrationFiles[1]), "utf8"),
    readFile(path.join(root, "scripts", "production-supabase-schema-regression.mjs"), "utf8"),
    readFile(path.join(root, "package.json"), "utf8"),
    readFile(path.join(root, "scripts", "production-backup", "Register-ProjectLocalBackupTask.ps1"), "utf8"),
    readFile(path.join(root, "scripts", "production-backup", "Invoke-ProjectLocalProductionBackup.ps1"), "utf8"),
    readFile(path.join(root, "scripts", "production-backup", "ProjectLocalProductionMigrationContract.ps1"), "utf8"),
  ]);
  assert.match(healthMigration, /create function public\.read_assignment_notification_delivery_health\(\)/i);
  assert.match(healthMigration, /language plpgsql\s+stable\s+security definer\s+set search_path = ''/i);
  assert.match(healthMigration, /revoke all on function[\s\S]+from public;/i);
  assert.match(healthMigration, /revoke all on function[\s\S]+from anon, authenticated;/i);
  assert.match(healthMigration, /grant execute on function[\s\S]+to authenticated;/i);
  assert.doesNotMatch(healthMigration, /\b(insert|update|delete|truncate)\b/i);
  assert.match(privilegeMigration, /alter default privileges for role postgres in schema public/i);
  assert.match(privilegeMigration, /revoke all privileges on table[\s\S]+from anon, authenticated, PUBLIC;/i);
  assert.match(privilegeMigration, /grant select on table[\s\S]+to authenticated;/i);
  assert.doesNotMatch(privilegeMigration, /\b(insert|update|delete|truncate|create table|drop table)\b/i);
  assert(bootstrapGate.includes("production Auth users exist"), "Historical bootstrap gate must retain its zero-Auth contract.");
  assert(packageJson.includes("test:production-supabase-schema"), "Historical bootstrap command must remain present.");
  assert(packageJson.includes("test:production-established-schema"), "Established-production regression command is missing.");
  assert(taskRegistration.includes("UpdateExpectedMigration"), "Reviewed backup task migration-lock update action is missing.");
  assert(backupExecution.includes("ProjectLocalProductionMigrationContract.ps1"), "Backup execution must load the reviewed terminal-migration contract.");
  assert(migrationContract.includes("AllowedTerminalMigrations"), "Backup execution must retain an explicit reviewed terminal-migration allowlist.");
  assert(migrationContract.includes("20260714122230") && migrationContract.includes("20260812123430"), "The historical backup transition endpoints must remain supported.");
  assert(migrationContract.includes("20260824123500") && migrationContract.includes("20260902120000") && migrationContract.includes("20260903120000") && migrationContract.includes("20260904120000"), "The later reviewed backup transition endpoints must remain explicit.");
  runTaskMigrationLockFixture("Success", true);
  runTaskMigrationLockFixture("WrongCurrent", false);
  runTaskMigrationLockFixture("WrongTarget", false);
  runTaskMigrationLockFixture("Duplicate", false);
  runTaskMigrationLockFixture("Enabled", false);
  runTaskMigrationLockFixture("Running", false);
}

function verifyRefusalMatrix(localVersions) {
  const productionArgs = [
    "--mode", "production-preflight",
    "--project-name", establishedProductionTarget.projectName,
    "--project-ref", establishedProductionTarget.projectRef,
    "--expected-before", establishedProductionTarget.beforeMigration,
    "--expected-after", establishedProductionTarget.afterMigration,
  ];
  const config = parseGateArguments(productionArgs);
  assert.throws(() => parseGateArguments([]), /requires --mode/);
  assert.throws(() => parseGateArguments([...productionArgs.slice(0, 5), establishedProductionTarget.forbiddenStagingRef, ...productionArgs.slice(6)]), /Wrong production project ref|Staging/);
  assert.throws(() => parseGateArguments([...productionArgs, "--fixture", "true"]), /Unknown or fixture-capable/);
  assert.throws(() => parseGateArguments(productionArgs.map((value) => value === establishedProductionTarget.projectName ? "wrong-project" : value)), /Wrong production project name/);
  assert.throws(() => assertProductionEnvironment(config, {}, ""), /exact RUN_ESTABLISHED_PRODUCTION_SCHEMA_GATE/);
  const baseEnv = { [optInName]: expectedOptIn(config.mode) };
  assert.throws(() => assertProductionEnvironment(config, { ...baseEnv, RUN_PRODUCTION_FIXTURES: "1" }, ""), /forbidden/);
  assert.throws(() => assertProductionEnvironment(config, { ...baseEnv, ASSIGNMENT_NOTIFICATION_EMAIL_TRANSPORT: "resend" }, ""), /must be absent or explicitly disabled/);
  assert.throws(() => assertProductionEnvironment(config, { ...baseEnv, SUPABASE_SERVICE_ROLE_KEY: "synthetic" }, ""), /Service-role/);
  assert.throws(() => assertProductionEnvironment(config, baseEnv, " M synthetic"), /clean committed worktree/);
  assert.throws(() => assertBackupTaskWindowMetadata({ present: false }), /missing/);
  assert.throws(() => assertBackupTaskWindowMetadata({ present: true, enabled: true, state: "Ready", baselineLock: true, targetLock: false }), /disabled/);
  assert.throws(() => assertBackupTaskWindowMetadata({ present: true, enabled: false, state: "Running", baselineLock: true, targetLock: false }), /not be running/);
  assert.throws(() => assertBackupTaskWindowMetadata({ present: true, enabled: false, state: "Disabled", baselineLock: false, targetLock: false }), /pre-migration lock/);
  assert.throws(() => assertBackupTaskWindowMetadata({ present: true, enabled: false, state: "Disabled", baselineLock: true, targetLock: true }), /must not advance/);
  assert.doesNotThrow(() => assertBackupTaskWindowMetadata({ present: true, enabled: false, state: "Disabled", baselineLock: true, targetLock: false }));
  assert.throws(() => assertLinkedTarget(establishedProductionTarget.forbiddenStagingRef), /exact production ref|staging/i);
  assert.throws(() => assertDiscoveredTarget({ name: establishedProductionTarget.projectName, ref: "unexpected", status: "ACTIVE_HEALTHY" }), /ref mismatch/);
  const before = localVersions.filter((version) => version <= establishedProductionTarget.beforeMigration);
  const after = [...localVersions];
  assert.throws(() => assertBeforeMigrationHistory(after, localVersions), /exact reviewed pre-migration baseline/);
  assert.throws(() => assertBeforeMigrationHistory(before.slice(0, -1), localVersions), /exact reviewed pre-migration baseline/);
  assert.throws(() => assertBeforeMigrationHistory([...before, "malformed"], localVersions), /malformed/);
  assert.throws(() => assertAfterMigrationHistory([...before, establishedProductionTarget.pendingMigrations[0]], localVersions), /partial|unexpected/);
  assert.throws(() => assertExactPendingPlan([establishedProductionTarget.pendingMigrations[0]]), /exactly the two reviewed/);
  assert.throws(() => assertExactPendingPlan([...establishedProductionTarget.pendingMigrations, "20269999999999"]), /exactly the two reviewed/);
  assert.throws(
    () => assertStatePreserved(
      { authUsers: ["a"], productCounts: [], storageObjects: 0, fixtureResidue: 0 },
      { authUsers: [], productCounts: [], storageObjects: 0, fixtureResidue: 0 },
    ),
    /Auth identities changed/,
  );
}

async function runLocalRegression() {
  const inventory = assertMigrationInventory();
  assert(
    inventory.repositoryVersions
      .slice(inventory.historicalTerminalIndex + 1)
      .includes("20260824123500"),
    "The separately reviewed later migration must remain outside the historical 12.36 chain.",
  );
  assert.throws(
    () => assertMigrationInventory([
      ...inventory.files,
      "20260812000000_unexpected_inside_established_transition.sql",
    ].sort()),
    /historical established-production migration chain is missing, reordered, or contains an unexpected migration/,
  );
  assertMigrationFilesCommittedAndUnchanged();
  await verifyStaticMigrationRiskMap();
  verifyRefusalMatrix(inventory.versions);

  const docker = command("docker", ["info"]);
  assert.equal(docker.status, 0, "Docker must be running for the disposable local established-production regression.");
  const linkedPath = path.join(root, "supabase", ".temp", "project-ref");
  assert(!existsSync(linkedPath), "Refusing local regression while Supabase CLI link metadata is present.");

  let startedLocalStack = false;
  let containerName;
  let fixture;
  let historicalWorkdir;
  let currentTypeWorkdir;
  try {
    const initialStatus = command(
      process.platform === "win32" ? process.execPath : "npx",
      process.platform === "win32"
        ? [path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npx-cli.js"), "--yes", "supabase", "status", "--output", "json"]
        : ["--yes", "supabase", "status", "--output", "json"],
    );
    assert.notEqual(initialStatus.status, 0, "Refusing to reset an already-running local Supabase stack; stop it before the disposable gate.");
    runSupabaseCli(["start"], { sensitiveOutput: true, stage: "Disposable local Supabase start" });
    startedLocalStack = true;
    const status = localStatus();
    runSupabaseCli(
      ["db", "reset", "--local", "--version", establishedProductionTarget.beforeMigration, "--no-seed", "--yes"],
      { sensitiveOutput: true, stage: "Disposable established baseline reset" },
    );
    containerName = resolveLocalDatabaseContainer();
    const query = (sql) => localQuery(containerName, sql);
    const beforeHistory = readMigrationHistory(query);
    assertBeforeMigrationHistory(beforeHistory, inventory.versions);
    assertBaselineSecurity(query);

    const namespace = `qa-12-36-${randomUUID()}`;
    const auth = await createLocalAuthIdentity(status, namespace);
    fixture = {
      authUserId: auth.id,
      email: auth.email,
      workspaceId: randomUUID(),
      workspaceKey: `${namespace}-workspace`,
      contactId: randomUUID(),
      grantId: randomUUID(),
    };
    insertLocalPreservationFixture(containerName, fixture);
    const fixtureBefore = readLocalFixtureSnapshot(containerName, fixture);
    assertLocalFixturePreserved(fixtureBefore);

    historicalWorkdir = createLocalMigrationWorkdir(establishedProductionTarget.afterMigration, "history");
    const dryRun = runSupabaseCli(
      ["db", "push", "--local", "--include-all", "--skip-vault", "--dry-run", "--yes"],
      { sensitiveOutput: true, includeStderr: true, stage: "Disposable exact migration dry-run", workdir: historicalWorkdir },
    );
    assertExactPendingPlan(parseDryRunVersions(dryRun));
    runSupabaseCli(
      ["migration", "up", "--local", "--include-all", "--yes"],
      { sensitiveOutput: true, stage: "Disposable exact migration application", workdir: historicalWorkdir },
    );

    const afterHistory = readMigrationHistory(query);
    assertAfterMigrationHistory(afterHistory, inventory.versions);
    assertLocalFixturePreserved(readLocalFixtureSnapshot(containerName, fixture));
    assertPostSecurity(query);

    currentTypeWorkdir = createLocalMigrationWorkdir(currentGeneratedTypeMigration, "current-types");
    const currentTypeDryRun = runSupabaseCli(
      ["db", "push", "--local", "--include-all", "--skip-vault", "--dry-run", "--yes"],
      { sensitiveOutput: true, includeStderr: true, stage: "Disposable current-type migration dry-run", workdir: currentTypeWorkdir },
    );
    const reviewedLaterMigrations = inventory.repositoryVersions.filter(
      (version) => version > establishedProductionTarget.afterMigration && version <= currentGeneratedTypeMigration,
    );
    assert.deepEqual(
      parseDryRunVersions(currentTypeDryRun),
      reviewedLaterMigrations,
      "Current generated-type compatibility must apply only the separately reviewed later migrations.",
    );
    runSupabaseCli(
      ["migration", "up", "--local", "--include-all", "--yes"],
      { sensitiveOutput: true, stage: "Disposable current-type migration application", workdir: currentTypeWorkdir },
    );
    const currentTypeVersions = inventory.repositoryVersions.filter(
      (version) => version <= currentGeneratedTypeMigration,
    );
    assert.deepEqual(
      readMigrationHistory(query),
      currentTypeVersions,
      "Current generated-type compatibility changed or skipped the reviewed migration history.",
    );
    assertLocalFixturePreserved(readLocalFixtureSnapshot(containerName, fixture));
    verifyGeneratedTypes("local");
    verifyFutureTableDefaults(containerName, namespace);
    runExistingNotificationHealthRegression(status);
    assertLocalFixturePreserved(readLocalFixtureSnapshot(containerName, fixture));
    cleanupLocalFixture(containerName, fixture);
    fixture = undefined;
  } finally {
    if (containerName && fixture) {
      try {
        cleanupLocalFixture(containerName, fixture);
      } catch (error) {
        console.error(redact(error));
        process.exitCode = 1;
      }
    }
    if (startedLocalStack) {
      try {
        runSupabaseCli(["stop", "--no-backup"], { sensitiveOutput: true, stage: "Disposable local Supabase stop" });
      } catch (error) {
        console.error(redact(error));
        process.exitCode = 1;
      }
    }
    if (historicalWorkdir) {
      rmSync(historicalWorkdir, { recursive: true, force: true });
    }
    if (currentTypeWorkdir) {
      rmSync(currentTypeWorkdir, { recursive: true, force: true });
    }
  }
  if (!process.exitCode) {
    console.log("Established-production gate passed exact refusal, preflight, two-migration dry-run/application, Auth/product preservation, Notification Health, privilege, RLS/FORCE RLS, type-parity, and zero-residue local proof.");
  }
}

async function main() {
  const config = parseGateArguments(process.argv.slice(2));
  if (config.mode === "local-regression") {
    await runLocalRegression();
  } else {
    await runProductionGate(config);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(redact(error));
    process.exit(1);
  });
}
