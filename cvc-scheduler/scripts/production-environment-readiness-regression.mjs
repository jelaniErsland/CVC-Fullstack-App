import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  PRODUCTION_ENVIRONMENT_EXPECTED_MIGRATION,
  PRODUCTION_ENVIRONMENT_READINESS_AVAILABLE,
  PRODUCTION_ENVIRONMENT_READINESS_CAN_ACTIVATE_RESPONSE_LINK_REVEAL,
  PRODUCTION_ENVIRONMENT_READINESS_CAN_CREATE_DATA,
  PRODUCTION_ENVIRONMENT_READINESS_CAN_CREATE_SUPABASE_PROJECT,
  PRODUCTION_ENVIRONMENT_READINESS_CAN_DEPLOY,
  PRODUCTION_ENVIRONMENT_READINESS_CAN_MODIFY_DNS,
  PRODUCTION_ENVIRONMENT_READINESS_CAN_SEND_EMAIL,
  PRODUCTION_ENVIRONMENT_READINESS_CAN_USE_SERVICE_ROLE_APPLICATION,
  PRODUCTION_ENVIRONMENT_READINESS_DECISION,
  PRODUCTION_ENVIRONMENT_RECOMMENDED_HOST,
  PRODUCTION_EMAIL_PROVIDER_CONFIGURATION_PROVEN,
  PRODUCTION_EMAIL_PROVIDER_DIRECT_DELIVERABILITY_PROVEN,
  PRODUCTION_APPLICATION_EMAIL_ENABLED,
  PRODUCTION_APPLICATION_EMAIL_DELIVERY_PROVEN,
  PRODUCTION_APPLICATION_OBSERVABILITY_FOUNDATION_PROVEN,
  PRODUCTION_RUNTIME_LOG_VISIBILITY_PROVEN,
  PRODUCTION_CONTROLLED_OBSERVABLE_EVENT_PROVEN,
  PRODUCTION_OBSERVABILITY_OWNERSHIP_RECORDED,
  PRODUCTION_DEPLOYMENT_STATUS_VISIBILITY_PROVEN,
  PRODUCTION_STALE_DELIVERY_MONITORING_PROVEN,
  PRODUCTION_STALE_DELIVERY_STAGING_BEHAVIOR_PROVEN,
  PRODUCTION_STALE_DELIVERY_PRODUCTION_READ_PROVEN,
  PRODUCTION_MANUAL_STALE_DELIVERY_NOTIFICATION_SUFFICIENT,
  PRODUCTION_OPERATOR_ALERT_NOTIFICATION_PROVEN,
  PRODUCTION_OPERATOR_OBSERVABILITY_PROVEN,
  productionEnvironmentKnownStagingTarget,
  productionEnvironmentReadinessItems,
  productionEnvironmentReadinessSummary,
} from "../lib/readiness/productionEnvironmentReadiness.server.ts";

const root = process.cwd();

async function read(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

function assertIncludes(source, needle, label) {
  assert(source.includes(needle), `${label} is missing ${needle}.`);
}

async function main() {
  assert.equal(PRODUCTION_ENVIRONMENT_READINESS_AVAILABLE, true);
  assert.equal(PRODUCTION_ENVIRONMENT_READINESS_CAN_DEPLOY, false);
  assert.equal(PRODUCTION_ENVIRONMENT_READINESS_CAN_CREATE_SUPABASE_PROJECT, false);
  assert.equal(PRODUCTION_ENVIRONMENT_READINESS_CAN_MODIFY_DNS, false);
  assert.equal(PRODUCTION_ENVIRONMENT_READINESS_CAN_SEND_EMAIL, false);
  assert.equal(PRODUCTION_ENVIRONMENT_READINESS_CAN_CREATE_DATA, false);
  assert.equal(PRODUCTION_ENVIRONMENT_READINESS_CAN_USE_SERVICE_ROLE_APPLICATION, false);
  assert.equal(PRODUCTION_ENVIRONMENT_READINESS_CAN_ACTIVATE_RESPONSE_LINK_REVEAL, false);
  assert.equal(PRODUCTION_ENVIRONMENT_READINESS_DECISION, "NO-GO");
  assert.equal(PRODUCTION_ENVIRONMENT_RECOMMENDED_HOST, "Vercel");
  assert.equal(PRODUCTION_EMAIL_PROVIDER_CONFIGURATION_PROVEN, true);
  assert.equal(PRODUCTION_EMAIL_PROVIDER_DIRECT_DELIVERABILITY_PROVEN, true);
  assert.equal(PRODUCTION_APPLICATION_EMAIL_ENABLED, false);
  assert.equal(PRODUCTION_APPLICATION_EMAIL_DELIVERY_PROVEN, false);
  assert.equal(PRODUCTION_APPLICATION_OBSERVABILITY_FOUNDATION_PROVEN, true);
  assert.equal(PRODUCTION_RUNTIME_LOG_VISIBILITY_PROVEN, true);
  assert.equal(PRODUCTION_CONTROLLED_OBSERVABLE_EVENT_PROVEN, true);
  assert.equal(PRODUCTION_OBSERVABILITY_OWNERSHIP_RECORDED, true);
  assert.equal(PRODUCTION_DEPLOYMENT_STATUS_VISIBILITY_PROVEN, true);
  assert.equal(PRODUCTION_STALE_DELIVERY_MONITORING_PROVEN, true);
  assert.equal(PRODUCTION_STALE_DELIVERY_STAGING_BEHAVIOR_PROVEN, true);
  assert.equal(PRODUCTION_STALE_DELIVERY_PRODUCTION_READ_PROVEN, false);
  assert.equal(PRODUCTION_MANUAL_STALE_DELIVERY_NOTIFICATION_SUFFICIENT, true);
  assert.equal(PRODUCTION_OPERATOR_ALERT_NOTIFICATION_PROVEN, false);
  assert.equal(PRODUCTION_OPERATOR_OBSERVABILITY_PROVEN, true);
  assert.equal(PRODUCTION_ENVIRONMENT_EXPECTED_MIGRATION, "20260714122230");
  assert.equal(productionEnvironmentKnownStagingTarget.name, "project-local-staging");
  assert.equal(productionEnvironmentKnownStagingTarget.ref, "kfuujcfxoayukywvtaeh");
  assert.equal(productionEnvironmentKnownStagingTarget.validatedMigration, "20260811123300");
  assert.equal(productionEnvironmentReadinessSummary.decision, "NO-GO");
  assert.equal(productionEnvironmentReadinessSummary.recommendedHost, "Vercel");

  const statuses = new Set(productionEnvironmentReadinessItems.map((item) => item.status));
  for (const status of [
    "proven",
    "operator_required",
    "configuration_required",
    "deferred_non_blocking",
  ]) {
    assert(statuses.has(status), `Production readiness does not exercise status ${status}.`);
  }

  const ids = new Set(productionEnvironmentReadinessItems.map((item) => item.id));
  for (const id of [
    "staging_baseline",
    "environment_separation",
    "hosting_recommendation",
    "production_supabase",
    "production_environment_variables",
    "auth_redirects",
    "domain_dns",
    "email_provider",
    "smoke_test",
    "observability",
    "backup_recovery",
    "operator_pilot_approval",
    "deferred_non_blocking_features",
  ]) {
    assert(ids.has(id), `Production readiness missing ${id}.`);
  }

  for (const item of productionEnvironmentReadinessItems) {
    assert(item.evidence.length > 0, `${item.id} needs evidence.`);
    assert(item.requiredAction.length > 24, `${item.id} needs a concrete required action.`);
    if (item.status !== "deferred_non_blocking" && item.status !== "proven") {
      assert.equal(item.blocking, true, `${item.id} should remain blocking until proven.`);
    }
  }

  const emailProvider = productionEnvironmentReadinessItems.find(
    (item) => item.id === "email_provider",
  );
  assert(emailProvider, "Production readiness is missing the email-provider item.");
  assert.equal(emailProvider.status, "configuration_required");
  assert.equal(emailProvider.blocking, true);
  assert.match(JSON.stringify(emailProvider.evidence), /direct Resend-dashboard message/i);
  assert.match(JSON.stringify(emailProvider.evidence), /did not use Project Local's Initial email action/i);
  assert.match(JSON.stringify(emailProvider.evidence), /application email is currently disabled/i);

  const observability = productionEnvironmentReadinessItems.find(
    (item) => item.id === "observability",
  );
  assert(observability, "Production readiness is missing observability.");
  assert.equal(observability.status, "proven");
  assert.equal(observability.blocking, false);
  assert.match(JSON.stringify(observability.evidence), /12\.32/);
  assert.match(JSON.stringify(observability.evidence), /August 11 2026 operator evidence/i);
  assert.match(JSON.stringify(observability.evidence), /schedule_access\.exchange_failure/i);
  assert.match(JSON.stringify(observability.evidence), /20260811123300/);
  assert.match(JSON.stringify(observability.evidence), /sufficient manual notification/i);
  assert.match(JSON.stringify(observability.evidence), /production execution.*unproven/i);

  const [
    contract,
    packageJson,
    envExample,
    nextConfig,
    proxy,
    readinessDoc,
    inventory,
    deploymentRunbook,
    jelaniChecklist,
    goNoGo,
    launchRunbook,
  ] = await Promise.all([
    read("lib/readiness/productionEnvironmentReadiness.server.ts"),
    read("package.json"),
    read(".env.example"),
    read("next.config.ts"),
    read("proxy.ts"),
    read("docs/SUPABASE_AUTH_PERSISTENCE_READINESS.md"),
    read("docs/PRODUCTION_ENVIRONMENT_INVENTORY.md"),
    read("docs/PRODUCTION_DEPLOYMENT_RUNBOOK.md"),
    read("docs/JELANI_PRODUCTION_SETUP_CHECKLIST.md"),
    read("docs/BOZEMAN_BETA_GO_NO_GO.md"),
    read("docs/BOZEMAN_BETA_LAUNCH_RUNBOOK.md"),
  ]);

  assert(contract.startsWith('import "server-only";'), "Production readiness contract must stay server-only.");
  assert(!/sk_live|password\s*=|api[_-]?key\s*=|eyJ[A-Za-z0-9_-]+\./i.test(contract), "Production readiness contract appears to contain secret-like material.");
  assertIncludes(packageJson, "test:production-environment-readiness", "package.json");
  assertIncludes(envExample, "ADMIN_AUTH_MODE=review", ".env.example");
  assertIncludes(envExample, "ASSIGNMENT_NOTIFICATION_EMAIL_TRANSPORT=", ".env.example");
  assertIncludes(envExample, "RESEND_API_KEY=", ".env.example");
  assert(!envExample.includes("NEXT_PUBLIC_RESEND"), ".env.example must keep the Resend key server-only.");
  assertIncludes(envExample, "SUPABASE_SERVICE_ROLE_KEY=", ".env.example");
  assert(!/vercel|netlify/i.test(nextConfig), "next.config should not gain ceremonial hosting assumptions.");
  assertIncludes(proxy, 'pathname === "/v/schedule"', "proxy no-store schedule handling");
  assertIncludes(proxy, 'Referrer-Policy", "no-referrer"', "proxy referrer policy");

  for (const source of [inventory, deploymentRunbook, jelaniChecklist, goNoGo, launchRunbook, readinessDoc]) {
    assertIncludes(source, "NO-GO", "production readiness docs");
    assertIncludes(source, "20260714122230", "production readiness docs");
    assertIncludes(source, "project-local-staging", "production readiness docs");
    assertIncludes(source, "kfuujcfxoayukywvtaeh", "production readiness docs");
    assertIncludes(source, "Vercel", "production readiness docs");
  }

  assertIncludes(inventory, "NEXT_PUBLIC_SUPABASE_URL", "environment inventory");
  assertIncludes(inventory, "ASSIGNMENT_NOTIFICATION_EMAIL_TRANSPORT", "environment inventory");
  assertIncludes(inventory, "RESEND_API_KEY", "environment inventory");
  assertIncludes(inventory, "SUPABASE_SERVICE_ROLE_KEY", "environment inventory");
  assertIncludes(deploymentRunbook, "read-only production smoke test", "deployment runbook");
  assertIncludes(deploymentRunbook, "Do not run hosted disposable fixture scripts against production", "deployment runbook");
  assertIncludes(jelaniChecklist, "Never paste secrets into Codex", "Jelani checklist");
  assertIncludes(jelaniChecklist, "Creating an Auth user does not grant app access", "Jelani checklist");
  assertIncludes(goNoGo, "Conclusion: NO-GO", "GO/NO-GO");

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
    assert(!source.includes("productionEnvironmentReadiness"), `${file} must not import the production readiness contract.`);
  }

  assert(!/RUN_HOSTED_[A-Z_]+=production|project-local-staging.*production/i.test(deploymentRunbook), "Deployment runbook appears to blur staging and production hosted gates.");

  console.log("Production environment readiness contract is server-only, route-unused, NO-GO honest, and documentation-backed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
