import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  buildProjectLocalDefaultTablePrivilegeQuery,
  buildProjectLocalDirectTablePrivilegeQuery,
  compareProjectLocalDefaultTablePrivileges,
  compareProjectLocalDirectTablePrivileges,
  projectLocalTableNames,
} from "../lib/security/projectLocalTablePrivileges.server.ts";

const root = process.cwd();
const expectedName = "project-local-production";
const expectedRef = "wdlaauzknfggoqldolmx";
const forbiddenStagingRef = "kfuujcfxoayukywvtaeh";
const expectedConfirmation = `${expectedName}:${expectedRef}`;
const expectedMigration = "20260714122230";
const optInName = "RUN_PRODUCTION_SUPABASE_SCHEMA_VALIDATION";

const productTables = [...projectLocalTableNames];

function redact(value) {
  return String(value)
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted-jwt]")
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[redacted-db-url]")
    .replace(/https:\/\/[a-z0-9]+\.supabase\.co[^\s]*/gi, "https://[redacted].supabase.co/[redacted]")
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
  const executable = isWindows ? process.execPath : "npx";
  const executableArgs = isWindows
    ? [
        path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npx-cli.js"),
        "--yes",
        "supabase",
        ...args,
      ]
    : ["--yes", "supabase", ...args];
  const result = command(executable, executableArgs);
  if (result.status !== 0) {
    const detail = options.sensitiveOutput
      ? "Sensitive command output was suppressed."
      : [result.error?.message, result.stderr, result.stdout].filter(Boolean).join("\n");
    throw new Error(`${options.stage ?? "Supabase command"} failed: ${redact(detail || "No diagnostic returned.")}`);
  }
  return result.stdout.trim();
}

function parseJson(output, stage) {
  try {
    return JSON.parse(output);
  } catch {
    throw new Error(`${stage} returned unreadable JSON.`);
  }
}

function runLinkedSql(sql, stage) {
  const file = path.join(tmpdir(), `project-local-production-schema-${randomUUID()}.sql`);
  writeFileSync(file, sql, "utf8");
  try {
    const output = runSupabaseCli(["db", "query", "--linked", "--file", file, "--output-format", "json"], {
      sensitiveOutput: true,
      stage,
    });
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

function normalizeGeneratedTypes(source) {
  return source
    .replace(/\r\n/g, "\n")
    .replace(
      /\n\s*\/\/ Allows to automatically instantiate createClient with right options\s*\n\s*\/\/ instead of createClient<Database, \{ PostgrestVersion: 'XX' \}>\(URL, KEY\)\s*(?=\n\s*__InternalSupabase:)/m,
      "",
    )
    .replace(
      /\n\s*__InternalSupabase:\s*{\s*\n\s*PostgrestVersion:\s*"[^"]+"\s*\n\s*}\s*(?=\n\s*public:)/m,
      "",
    )
    .trim();
}

function gitStatusShort() {
  const result = command("git", ["status", "--short"]);
  if (result.status !== 0) throw new Error("Could not inspect git status.");
  return result.stdout.trim();
}

function localMigrationVersions() {
  const migrationDir = path.join(root, "supabase", "migrations");
  return readdirSync(migrationDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort()
    .map((name) => name.split("_")[0]);
}

async function verifyStaticRepositoryBoundaries() {
  const [
    packageJson,
    envExample,
    readiness,
    inventory,
    deployment,
    jelani,
    statusDoc,
    databaseTypes,
    productionReadiness,
  ] = await Promise.all([
    readFile(path.join(root, "package.json"), "utf8"),
    readFile(path.join(root, ".env.example"), "utf8"),
    readFile(path.join(root, "docs", "SUPABASE_AUTH_PERSISTENCE_READINESS.md"), "utf8"),
    readFile(path.join(root, "docs", "PRODUCTION_ENVIRONMENT_INVENTORY.md"), "utf8"),
    readFile(path.join(root, "docs", "PRODUCTION_DEPLOYMENT_RUNBOOK.md"), "utf8"),
    readFile(path.join(root, "docs", "JELANI_PRODUCTION_SETUP_CHECKLIST.md"), "utf8"),
    readFile(path.join(root, "docs", "PRODUCTION_SUPABASE_STATUS.md"), "utf8"),
    readFile(path.join(root, "lib", "supabase", "database.types.ts"), "utf8"),
    readFile(path.join(root, "lib", "readiness", "productionEnvironmentReadiness.server.ts"), "utf8"),
  ]);
  assert(packageJson.includes("test:production-supabase-schema"), "Production schema package command is missing.");
  assert(envExample.includes("ASSIGNMENT_NOTIFICATION_EMAIL_TRANSPORT="), "Email transport env example is missing.");
  assert(envExample.includes("SUPABASE_SERVICE_ROLE_KEY="), "Service-role placeholder is missing.");
  assert(readiness.includes("12.25"), "Supabase readiness doc must mention 12.25.");
  assert(inventory.includes(expectedName) && inventory.includes(expectedRef), "Production inventory must record the approved production target.");
  assert(deployment.includes("Do not run hosted disposable fixture scripts against production"), "Deployment runbook must forbid production fixtures.");
  assert(jelani.includes("Creating an Auth user does not grant app access"), "Jelani checklist must distinguish Auth from app grants.");
  assert(statusDoc.includes("NO-GO") && statusDoc.includes(expectedMigration), "Production status doc must preserve NO-GO and migration target.");
  assert(databaseTypes.includes("20260714122230") || databaseTypes.includes("assignment_notification_deliveries"), "Committed generated types do not appear current.");
  assert(productionReadiness.startsWith('import "server-only";'), "Production readiness must stay server-only.");
}

function verifyEnvironmentRefusalPreconditions() {
  assert(
    process.env[optInName] === expectedConfirmation,
    `Refusing production Supabase schema validation without ${optInName}=${expectedConfirmation}.`,
  );
  assert.notEqual(expectedRef, forbiddenStagingRef, "Production ref must never equal staging ref.");
  assert(!process.env.RUN_HOSTED_BOZEMAN_BETA_E2E_VALIDATION, "Hosted fixture E2E opt-in must not be set during production schema validation.");
  assert(!process.env.RUN_HOSTED_ASSIGNMENT_NOTIFICATION_EMAIL_VALIDATION, "Hosted fixture email opt-in must not be set during production schema validation.");
  assert(!process.env.RUN_HOSTED_VOLUNTEER_SCHEDULE_RESPONSE_VALIDATION, "Hosted fixture response opt-in must not be set during production schema validation.");
  assert(!process.env.RUN_PRODUCTION_FIXTURES, "Fixture creation is forbidden for production schema validation.");
  assert(!process.env.SEED_PRODUCTION_DATA, "Seed/product-data creation is forbidden for production schema validation.");
  assert(!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(), "Service-role application configuration must be unset for this gate.");
  assert(!process.env.ASSIGNMENT_NOTIFICATION_EMAIL_TRANSPORT?.trim(), "Email transport must be disabled for production schema validation.");
  assert.equal(gitStatusShort(), "", "Production schema validation requires a clean committed worktree.");
}

function verifyTargetDiscovery() {
  const projectsResult = parseJson(
    runSupabaseCli(["projects", "list", "--output-format", "json"], {
      stage: "Production project discovery",
    }),
    "Production project discovery",
  );
  const projects = Array.isArray(projectsResult) ? projectsResult : projectsResult.projects;
  const project = projects?.find((entry) => entry.ref === expectedRef);
  assert(project, "Approved production project ref was not discovered.");
  assert.equal(project.name, expectedName, "Discovered production project name/ref mismatch.");
  assert.notEqual(project.ref, forbiddenStagingRef, "Production project discovery resolved to staging.");
  assert.equal(project.status, "ACTIVE_HEALTHY", "Production project is not ACTIVE_HEALTHY.");
  return {
    name: project.name,
    ref: project.ref,
    status: project.status,
    region: project.region ?? project.cloud_provider_region ?? "unknown",
  };
}

function verifyLinkedTarget() {
  const linkedPath = path.join(root, "supabase", ".temp", "project-ref");
  assert(existsSync(linkedPath), "Supabase CLI is not linked. Link the exact production project through the secure operator terminal first.");
  const linkedRef = readFileSync(linkedPath, "utf8").trim();
  assert.equal(linkedRef, expectedRef, "Linked Supabase project is not the approved production ref.");
}

export function readRemoteMigrationHistory(query = runLinkedSql) {
  const existenceRows = query(
    "select to_regclass('supabase_migrations.schema_migrations') is not null as exists;",
    "Production migration-history existence check",
  );
  assert.equal(existenceRows.length, 1, "Production migration-history existence check returned an unexpected shape.");
  if (existenceRows[0]?.exists !== true) return [];

  const rows = query(
    "select version from supabase_migrations.schema_migrations order by version;",
    "Production migration-history check",
  );
  return rows.map((row) => {
    const version = String(row.version ?? "");
    assert.match(version, /^\d{14}$/, "Production migration history contains a malformed version.");
    return version;
  });
}

function remoteMigrations() {
  return readRemoteMigrationHistory(runLinkedSql);
}

function latestMigrationLabel(versions) {
  return versions.length ? versions[versions.length - 1] : "none";
}

export function assertExpectedRemoteMigrationHistory(remoteBefore) {
  assert(
    remoteBefore.length === 0 || latestMigrationLabel(remoteBefore) === expectedMigration,
    `Unexpected production migration history before gate: ${latestMigrationLabel(remoteBefore)}.`,
  );
}

function verifyLocalMigrations() {
  const versions = localMigrationVersions();
  assert(versions.length > 0, "No local migrations were found.");
  assert.equal(versions[versions.length - 1], expectedMigration, `Terminal local migration must be ${expectedMigration}.`);
  assert(!versions.some((version) => version > expectedMigration), "Local migrations after the expected production target exist.");
  assert.equal(new Set(versions).size, versions.length, "Local migration versions contain duplicates.");
  return versions;
}

function countExistingData() {
  const tableValues = productTables.map((table) => `('${table}')`).join(", ");
  return runLinkedSql(
    `with target(table_name) as (values ${tableValues})
select target.table_name,
       to_regclass('public.' || target.table_name) is not null as exists,
       case when to_regclass('public.' || target.table_name) is null then 0
            else (xpath('/row/count/text()', query_to_xml(format('select count(*) as count from public.%I', target.table_name), false, true, '')))[1]::text::int
       end as row_count
from target
order by target.table_name;`,
    "Production product-table aggregate count",
  );
}

function countAuthUsers() {
  return Number(
    runLinkedSql("select count(*)::int as count from auth.users;", "Production Auth user count")[0]?.count ?? 0,
  );
}

function countStorageObjects() {
  return Number(
    runLinkedSql(
      "select case when to_regclass('storage.objects') is null then 0 else (select count(*)::int from storage.objects) end as count;",
      "Production storage object count",
    )[0]?.count ?? 0,
  );
}

function verifyNoApplicationData(label) {
  const counts = countExistingData();
  const total = counts.reduce((sum, row) => sum + Number(row.row_count ?? 0), 0);
  assert.equal(total, 0, `${label}: production application tables are not empty.`);
  assert.equal(countAuthUsers(), 0, `${label}: production Auth users exist.`);
  assert.equal(countStorageObjects(), 0, `${label}: production storage objects exist.`);
  return { counts, authUsers: 0, storageObjects: 0 };
}

function verifyMigrationPlan() {
  const output = runSupabaseCli(["db", "push", "--linked", "--include-all", "--dry-run", "--yes"], {
    sensitiveOutput: true,
    stage: "Production migration dry-run",
  });
  assert(!/seed|reset|drop database|repair|auth\.users|insert into public\.workspaces/i.test(output), "Production migration dry-run proposed forbidden data/reset/repair behavior.");
  assert(output.includes(expectedMigration), `Production migration dry-run did not include expected terminal migration ${expectedMigration}.`);
  return output
    .split(/\r?\n/)
    .filter((line) => /^\s*\d{14}/.test(line) || line.includes(".sql"))
    .slice(0, 5)
    .join(" | ") || "reviewed committed migrations through expected terminal migration";
}

function applyMigrations() {
  runSupabaseCli(["db", "push", "--linked", "--include-all", "--yes"], {
    sensitiveOutput: true,
    stage: "Production migration application",
  });
}

function verifyGeneratedTypes() {
  const localTypes = readFileSync(path.join(root, "lib", "supabase", "database.types.ts"), "utf8");
  const productionTypes = runSupabaseCli(["gen", "types", "typescript", "--linked", "--schema", "public"], {
    sensitiveOutput: true,
    stage: "Production generated-type comparison",
  });
  assert.equal(
    normalizeGeneratedTypes(productionTypes),
    normalizeGeneratedTypes(localTypes),
    "Production generated public-schema types differ from committed generated types.",
  );
}

function discoverAnonKey(projectRef) {
  const result = parseJson(
    runSupabaseCli(["projects", "api-keys", "--project-ref", projectRef, "--output-format", "json"], {
      sensitiveOutput: true,
      stage: "Production public-key discovery",
    }),
    "Production public-key discovery",
  );
  const keys = Array.isArray(result) ? result : result.api_keys ?? result.keys;
  const anonEntry = keys?.find((entry) => entry.name === "anon" || entry.name === "publishable");
  const anonKey = anonEntry?.api_key ?? anonEntry?.key ?? anonEntry?.value;
  assert(typeof anonKey === "string" && anonKey.length > 20, "Could not discover production anon/publishable key for public connectivity check.");
  return anonKey;
}

async function verifyPublicConnectivity(projectRef) {
  const anonKey = discoverAnonKey(projectRef);
  const endpoint = `https://${projectRef}.supabase.co/auth/v1/health`;
  const response = await fetch(endpoint, {
    headers: {
      apikey: anonKey,
    },
  });
  assert(response.ok, `Production public Supabase endpoint health check failed with HTTP ${response.status}.`);
  return { endpoint: "auth health", status: response.status };
}

function verifyStructuralSecurity() {
  const rlsRows = runLinkedSql(
    `select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname = any(array[${productTables.map((table) => `'${table}'`).join(", ")}])
order by c.relname;`,
    "Production RLS structural check",
  );
  const rlsMissing = rlsRows.filter((row) => !row.rls_enabled).map((row) => row.table_name);
  assert.equal(rlsMissing.length, 0, `Production tables missing RLS: ${rlsMissing.join(", ")}`);

  const directPrivileges = runLinkedSql(
    buildProjectLocalDirectTablePrivilegeQuery(),
    "Production exact direct table privilege check",
  );
  const directPrivilegeDiff = compareProjectLocalDirectTablePrivileges(directPrivileges);
  assert.equal(directPrivilegeDiff.unexpected.length, 0, "Production exposes an unapproved direct table privilege.");
  assert.equal(directPrivilegeDiff.missing.length, 0, "Production is missing an approved direct table privilege.");

  const defaultPrivileges = runLinkedSql(
    buildProjectLocalDefaultTablePrivilegeQuery(),
    "Production exact default table privilege check",
  );
  const defaultPrivilegeDiff = compareProjectLocalDefaultTablePrivileges(defaultPrivileges);
  assert.equal(defaultPrivilegeDiff.unexpected.length, 0, "Production exposes an unapproved future-table default privilege.");
  assert.equal(defaultPrivilegeDiff.missing.length, 0, "Production is missing an approved future-table default privilege.");

  const tokenColumns = runLinkedSql(
    `select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and table_name in ('assignment_response_tokens', 'volunteer_schedule_access_tokens')
order by table_name, column_name;`,
    "Production token column structural check",
  );
  const columnNames = new Set(tokenColumns.map((row) => `${row.table_name}.${row.column_name}`));
  assert(columnNames.has("assignment_response_tokens.token_verifier_hash"), "Assignment response tokens must store verifier hashes.");
  assert(columnNames.has("volunteer_schedule_access_tokens.token_verifier_hash"), "Volunteer schedule access tokens must store verifier hashes.");
  assert(!columnNames.has("assignment_response_tokens.bearer_token"), "Assignment response token bearer plaintext column exists.");
  assert(!columnNames.has("volunteer_schedule_access_tokens.bearer_token"), "Volunteer schedule bearer plaintext column exists.");

  const deliveryColumns = runLinkedSql(
    `select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'assignment_notification_deliveries'
order by column_name;`,
    "Production notification delivery structural check",
  ).map((row) => String(row.column_name));
  assert(!deliveryColumns.some((name) => /bearer|verifier|token|url/i.test(name)), "Notification deliveries contain credential-like storage columns.");

  return {
    protectedTables: rlsRows.length,
    directPrivilegeRows: directPrivileges.length,
    defaultPrivilegeRows: defaultPrivileges.length,
  };
}

async function main() {
  if (process.env[optInName] !== expectedConfirmation) {
    assert(
      process.env[optInName] === expectedConfirmation,
      `Refusing production Supabase schema validation without ${optInName}=${expectedConfirmation}.`,
    );
  }

  verifyEnvironmentRefusalPreconditions();
  await verifyStaticRepositoryBoundaries();
  const project = verifyTargetDiscovery();
  verifyLinkedTarget();
  const localMigrations = verifyLocalMigrations();
  const remoteBefore = remoteMigrations();
  assertExpectedRemoteMigrationHistory(remoteBefore);
  verifyNoApplicationData("pre-migration");
  const plan = remoteBefore.length === 0 ? verifyMigrationPlan() : "production already at expected migration";
  if (remoteBefore.length === 0) applyMigrations();
  const remoteAfter = remoteMigrations();
  assert.equal(latestMigrationLabel(remoteAfter), expectedMigration, "Production migration level after gate is wrong.");
  assert(remoteAfter.every((version) => localMigrations.includes(version)), "Production remote migration history contains an unexpected version.");
  verifyGeneratedTypes();
  const publicConnectivity = await verifyPublicConnectivity(project.ref);
  const afterData = verifyNoApplicationData("post-migration");
  const security = verifyStructuralSecurity();

  console.log(`Production Supabase schema validation passed for ${project.name} (${project.ref}).`);
  console.log(`Project health: ${project.status}. Region: ${project.region}. Migration before: ${latestMigrationLabel(remoteBefore)}. Migration after: ${latestMigrationLabel(remoteAfter)}.`);
  console.log(`Migration plan: ${plan}. Generated-type parity passed.`);
  console.log(`Public connectivity passed: ${publicConnectivity.endpoint} HTTP ${publicConnectivity.status}.`);
  console.log(`Application data remained empty. Product rows: ${afterData.counts.reduce((sum, row) => sum + Number(row.row_count ?? 0), 0)}. Auth users: ${afterData.authUsers}. Storage objects: ${afterData.storageObjects}.`);
  console.log(`Structural security installed: RLS protected tables ${security.protectedTables}; exact direct privilege rows ${security.directPrivilegeRows}; protected default privilege rows ${security.defaultPrivilegeRows}.`);
  console.log("No fixtures, Auth users, product data, deployment, DNS change, email transport, real email, service-role runtime path, response-link reveal/copy, staging mutation, or seed data were used.");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(redact(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  });
}
