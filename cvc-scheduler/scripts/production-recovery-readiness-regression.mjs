import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  PRODUCTION_RECOVERY_CAN_ACCESS_PRODUCTION,
  PRODUCTION_RECOVERY_CAN_CREATE_DATA,
  PRODUCTION_RECOVERY_CAN_CREATE_DUMP,
  PRODUCTION_RECOVERY_CAN_MUTATE_PRODUCTION,
  PRODUCTION_RECOVERY_CAN_PERFORM_RESTORE,
  PRODUCTION_RECOVERY_CAN_SEND_EMAIL,
  PRODUCTION_RECOVERY_CAN_USE_SERVICE_ROLE_APPLICATION,
  PRODUCTION_RECOVERY_READINESS_AVAILABLE,
  PRODUCTION_RECOVERY_READINESS_COMPLETE,
  PRODUCTION_RECOVERY_READINESS_DECISION,
  productionRecoveryBaseline,
  productionRecoveryReadinessItems,
  productionRecoveryReadinessSummary,
} from "../lib/readiness/productionRecoveryReadiness.server.ts";

const root = process.cwd();

async function read(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

function assertIncludes(source, needle, label) {
  assert(source.includes(needle), `${label} is missing ${needle}.`);
}

async function main() {
  assert.equal(PRODUCTION_RECOVERY_READINESS_AVAILABLE, true);
  assert.equal(PRODUCTION_RECOVERY_READINESS_COMPLETE, false);
  assert.equal(PRODUCTION_RECOVERY_READINESS_DECISION, "NO-GO");
  assert.equal(PRODUCTION_RECOVERY_CAN_ACCESS_PRODUCTION, false);
  assert.equal(PRODUCTION_RECOVERY_CAN_MUTATE_PRODUCTION, false);
  assert.equal(PRODUCTION_RECOVERY_CAN_PERFORM_RESTORE, false);
  assert.equal(PRODUCTION_RECOVERY_CAN_CREATE_DUMP, false);
  assert.equal(PRODUCTION_RECOVERY_CAN_CREATE_DATA, false);
  assert.equal(PRODUCTION_RECOVERY_CAN_SEND_EMAIL, false);
  assert.equal(PRODUCTION_RECOVERY_CAN_USE_SERVICE_ROLE_APPLICATION, false);

  assert.equal(productionRecoveryBaseline.canonicalOrigin, "https://projectlocal.app");
  assert.equal(productionRecoveryBaseline.fallbackOrigin, "https://project-local-one.vercel.app");
  assert.equal(productionRecoveryBaseline.vercelProject, "project-local");
  assert.equal(productionRecoveryBaseline.productionBranch, "master");
  assert.equal(productionRecoveryBaseline.deployedCommit, "082c960");
  assert.equal(productionRecoveryBaseline.supabaseProject, "project-local-production");
  assert.equal(productionRecoveryBaseline.supabaseRef, "wdlaauzknfggoqldolmx");
  assert.equal(productionRecoveryBaseline.supabasePlan, "Free");
  assert.equal(productionRecoveryBaseline.forbiddenStagingRef, "kfuujcfxoayukywvtaeh");
  assert.equal(productionRecoveryBaseline.migration, "20260714122230");
  assert.equal(productionRecoveryBaseline.emailTransport, "disabled");

  assert.equal(productionRecoveryReadinessSummary.decision, "NO-GO");
  assert.equal(productionRecoveryReadinessSummary.complete, false);

  const statuses = new Set(productionRecoveryReadinessItems.map((item) => item.status));
  for (const status of [
    "documented",
    "operator_evidence_required",
    "restore_test_required",
    "configuration_required",
    "proven",
    "blocked",
  ]) {
    assert(statuses.has(status), `Production recovery readiness does not exercise status ${status}.`);
  }

  const ids = new Set(productionRecoveryReadinessItems.map((item) => item.id));
  for (const id of [
    "production_baseline",
    "application_rollback",
    "migration_recovery",
    "backup_availability",
    "independent_backup_path",
    "first_independent_backup",
    "point_in_time_recovery",
    "restore_procedure",
    "restore_test",
    "operational_pause",
    "recovery_verification",
    "observability_alerting",
    "incident_ownership",
    "recovery_launch_status",
  ]) {
    assert(ids.has(id), `Production recovery readiness missing ${id}.`);
  }

  for (const item of productionRecoveryReadinessItems) {
    assert(item.evidence.length > 0, `${item.id} needs evidence.`);
    assert(item.requiredAction.length > 32, `${item.id} needs a concrete required action.`);
    if (
      item.status === "operator_evidence_required" ||
      item.status === "restore_test_required" ||
      item.status === "blocked"
    ) {
      assert.equal(item.blocking, true, `${item.id} must block launch until resolved.`);
    }
  }

  const observability = productionRecoveryReadinessItems.find(
    (item) => item.id === "observability_alerting",
  );
  assert(observability, "Recovery readiness is missing observability/alerting.");
  assert.equal(observability.status, "proven");
  assert.equal(observability.blocking, false);
  assert.match(JSON.stringify(observability.evidence), /12\.32/);
  assert.match(JSON.stringify(observability.evidence), /August 11 2026 operator evidence/i);
  assert.match(JSON.stringify(observability.evidence), /schedule_access\.exchange_failure/i);
  assert.match(JSON.stringify(observability.evidence), /12\.33/);
  assert.match(JSON.stringify(observability.evidence), /after each controlled email test or batch/i);
  assert.match(JSON.stringify(observability.evidence), /sufficient manual notification/i);
  assert.match(JSON.stringify(observability.evidence), /production RPC execution.*remain deferred/i);

  const firstBackup = productionRecoveryReadinessItems.find(
    (item) => item.id === "first_independent_backup",
  );
  assert(firstBackup, "Recovery readiness is missing first independent backup evidence.");
  assert.equal(firstBackup.status, "proven");
  assert.equal(firstBackup.blocking, false);
  assert.match(JSON.stringify(firstBackup.evidence), /2026-08-12T17:26:46\.3144615Z/);
  assert.match(JSON.stringify(firstBackup.evidence), /62409 bytes/);
  assert.match(JSON.stringify(firstBackup.evidence), /matching 64-character SHA-256/i);

  const independentPath = productionRecoveryReadinessItems.find(
    (item) => item.id === "independent_backup_path",
  );
  assert(independentPath, "Recovery readiness is missing the independent backup path.");
  assert.equal(independentPath.status, "restore_test_required");
  assert.equal(independentPath.blocking, true);
  assert.match(JSON.stringify(independentPath.evidence), /roles\.sql/);
  assert.match(JSON.stringify(independentPath.evidence), /all required platform roles already exist/i);

  const [
    contract,
    packageJson,
    runbook,
    deploymentRunbook,
    goNoGo,
    roadmap,
    currentState,
    history,
    jelaniChecklist,
    readinessDoc,
  ] = await Promise.all([
    read("lib/readiness/productionRecoveryReadiness.server.ts"),
    read("package.json"),
    read("docs/PRODUCTION_BACKUP_RECOVERY_RUNBOOK.md"),
    read("docs/PRODUCTION_DEPLOYMENT_RUNBOOK.md"),
    read("docs/BOZEMAN_BETA_GO_NO_GO.md"),
    read("docs/BOZEMAN_BETA_ROADMAP.md"),
    read("docs/CURRENT_STATE.md"),
    read("docs/PROJECT_HISTORY.md"),
    read("docs/JELANI_PRODUCTION_SETUP_CHECKLIST.md"),
    read("docs/SUPABASE_AUTH_PERSISTENCE_READINESS.md"),
  ]);

  assert(contract.startsWith('import "server-only";'), "Production recovery contract must stay server-only.");
  assert(!/createClient\(|supabase\.from\(|supabase\.rpc\(|fetch\(|spawnSync\(|execSync\(/.test(contract), "Production recovery contract must not access production.");
  assert(!/sk_live|password\s*=|api[_-]?key\s*=|eyJ[A-Za-z0-9_-]+\./i.test(contract), "Production recovery contract appears to contain secret-like material.");

  assertIncludes(packageJson, "test:production-recovery-readiness", "package.json");
  assertIncludes(runbook, "Application rollback is not database rollback", "backup/recovery runbook");
  assertIncludes(runbook, "Prefer reviewed forward-fix migrations", "backup/recovery runbook");
  assertIncludes(runbook, "Do not perform a production restore", "backup/recovery runbook");
  assertIncludes(runbook, "Do not download or expose database credentials or dumps", "backup/recovery runbook");
  assertIncludes(runbook, "Free Plan does not include project backups", "backup/recovery runbook");
  assertIncludes(runbook, "Point in Time Recovery is a Pro Plan add-on", "backup/recovery runbook");
  assertIncludes(runbook, "Restore to a new project requires Pro Plan and above", "backup/recovery runbook");
  assertIncludes(runbook, "PITR is not considered necessary for the narrow Bozeman beta", "backup/recovery runbook");
  assertIncludes(runbook, "Path A - Preferred independent backup path", "backup/recovery runbook");
  assertIncludes(runbook, "automated logical backup process", "backup/recovery runbook");
  assertIncludes(runbook, "Encrypt every backup before it enters persistent storage", "backup/recovery runbook");
  assertIncludes(runbook, "Store backup artifacts outside the public application repository", "backup/recovery runbook");
  assertIncludes(runbook, "Record backup timestamp, size, checksum/integrity result, and success/failure state", "backup/recovery runbook");
  assertIncludes(runbook, "Path B - Optional Supabase-managed path", "backup/recovery runbook");
  assertIncludes(runbook, "Supabase Pro managed backups remain an optional future path", "backup/recovery runbook");
  assertIncludes(runbook, "At least one reviewed backup path must be proven before real Bozeman data", "backup/recovery runbook");
  assertIncludes(runbook, "Database backups do not automatically prove recovery for Supabase Storage objects", "backup/recovery runbook");
  assertIncludes(runbook, "revoke or expire production workspace grants", "backup/recovery runbook");
  assertIncludes(runbook, "Auth identity deletion is not the normal pause mechanism", "backup/recovery runbook");
  assertIncludes(runbook, "Product-record deletion is not the normal rollback mechanism", "backup/recovery runbook");
  assertIncludes(runbook, "Belgrade Sheets/App Script remains the operational fallback", "backup/recovery runbook");
  assertIncludes(runbook, "082c960", "backup/recovery runbook");
  assertIncludes(runbook, "projectlocal.app", "backup/recovery runbook");
  assertIncludes(runbook, "wdlaauzknfggoqldolmx", "backup/recovery runbook");
  assertIncludes(runbook, "20260714122230", "backup/recovery runbook");
  assertIncludes(runbook, "2026-08-12T17:26:46.3144615Z", "backup/recovery runbook");
  assertIncludes(runbook, "roles.sql", "backup/recovery runbook");

  for (const source of [deploymentRunbook, goNoGo, roadmap, currentState, history, jelaniChecklist, readinessDoc]) {
    assertIncludes(source, "PRODUCTION_BACKUP_RECOVERY_RUNBOOK.md", "canonical production docs");
    assertIncludes(source, "NO-GO", "canonical production docs");
  }

  const routeFiles = [
    "app/admin/calendar/page.tsx",
    "app/admin/volunteers/page.tsx",
    "app/v/access/[token]/route.ts",
    "app/v/schedule/page.tsx",
    "components/CalendarClient.tsx",
    "components/VolunteerDirectory.tsx",
    "components/VolunteerScheduleClient.tsx",
  ];
  for (const file of routeFiles) {
    const source = await read(file);
    assert(!source.includes("productionRecoveryReadiness"), `${file} must not import the production recovery readiness contract.`);
  }

  console.log("Production recovery readiness contract is server-only, route-unused, NO-GO honest, and documentation-backed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
