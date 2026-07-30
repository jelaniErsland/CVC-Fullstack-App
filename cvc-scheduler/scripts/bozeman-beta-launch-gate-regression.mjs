import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  BOZEMAN_BETA_LAUNCH_GATE_AVAILABLE,
  BOZEMAN_BETA_LAUNCH_GATE_CAN_CREATE_DATA,
  BOZEMAN_BETA_LAUNCH_GATE_CAN_LAUNCH_PRODUCTION,
  BOZEMAN_BETA_LAUNCH_GATE_CAN_MUTATE_DEPLOYMENT,
  BOZEMAN_BETA_LAUNCH_GATE_CAN_SEND_EMAIL,
  BOZEMAN_BETA_LAUNCH_GATE_DECISION,
  BOZEMAN_BETA_LAUNCH_GATE_PRODUCTION_EMAIL_PROVIDER_APPROVED,
  BOZEMAN_BETA_LAUNCH_GATE_RESPONSE_LINK_REVEAL_COPY_AVAILABLE,
  BOZEMAN_BETA_LAUNCH_GATE_SERVICE_ROLE_APPLICATION_AVAILABLE,
  BOZEMAN_BETA_LAUNCH_STAGING_TARGET,
  bozemanBetaLaunchGateItems,
  bozemanBetaLaunchGateSummary,
} from "../lib/readiness/bozemanBetaLaunchGate.server.ts";

const root = process.cwd();

async function read(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

function assertIncludes(source, needle, label) {
  assert(source.includes(needle), `${label} is missing ${needle}.`);
}

async function main() {
  assert.equal(BOZEMAN_BETA_LAUNCH_GATE_AVAILABLE, true);
  assert.equal(BOZEMAN_BETA_LAUNCH_GATE_CAN_LAUNCH_PRODUCTION, false);
  assert.equal(BOZEMAN_BETA_LAUNCH_GATE_CAN_CREATE_DATA, false);
  assert.equal(BOZEMAN_BETA_LAUNCH_GATE_CAN_SEND_EMAIL, false);
  assert.equal(BOZEMAN_BETA_LAUNCH_GATE_CAN_MUTATE_DEPLOYMENT, false);
  assert.equal(BOZEMAN_BETA_LAUNCH_GATE_SERVICE_ROLE_APPLICATION_AVAILABLE, false);
  assert.equal(BOZEMAN_BETA_LAUNCH_GATE_RESPONSE_LINK_REVEAL_COPY_AVAILABLE, false);
  assert.equal(BOZEMAN_BETA_LAUNCH_GATE_PRODUCTION_EMAIL_PROVIDER_APPROVED, false);
  assert.equal(BOZEMAN_BETA_LAUNCH_GATE_DECISION, "NO-GO");
  assert.equal(bozemanBetaLaunchGateSummary.decision, "NO-GO");
  assert.equal(BOZEMAN_BETA_LAUNCH_STAGING_TARGET.name, "project-local-staging");
  assert.equal(BOZEMAN_BETA_LAUNCH_STAGING_TARGET.ref, "kfuujcfxoayukywvtaeh");
  assert.equal(BOZEMAN_BETA_LAUNCH_STAGING_TARGET.validatedMigration, "20260714122230");
  assert.equal(BOZEMAN_BETA_LAUNCH_STAGING_TARGET.hostedResidueExpectation, 0);

  const statuses = new Set(bozemanBetaLaunchGateItems.map((item) => item.status));
  for (const status of [
    "proven",
    "operator_required",
    "configuration_required",
    "pilot_required",
    "blocked",
    "deferred_non_blocking",
  ]) {
    assert(statuses.has(status), `Launch gate does not exercise status ${status}.`);
  }

  const ids = new Set(bozemanBetaLaunchGateItems.map((item) => item.id));
  for (const id of [
    "workspace_contact_grant_provisioning",
    "volunteer_add_edit",
    "calendar_scheduling_loop",
    "volunteer_schedule_responses",
    "initial_assignment_email_boundary",
    "beta_critical_ui",
    "hosted_staging_validation",
    "production_environment",
    "production_launch_action",
    "deferred_features",
  ]) {
    assert(ids.has(id), `Launch gate missing ${id}.`);
  }

  for (const item of bozemanBetaLaunchGateItems) {
    assert(item.evidence.length > 0, `${item.id} needs evidence.`);
    assert(item.requiredAction.length > 20, `${item.id} needs a concrete required action.`);
    if (item.status === "configuration_required" || item.status === "operator_required") {
      assert.equal(item.blocking, true, `${item.id} unresolved production/operator work must block launch.`);
    }
  }

  const [contract, packageJson, roadmap, runbook, goNoGo] = await Promise.all([
    read("lib/readiness/bozemanBetaLaunchGate.server.ts"),
    read("package.json"),
    read("docs/BOZEMAN_BETA_ROADMAP.md"),
    read("docs/BOZEMAN_BETA_LAUNCH_RUNBOOK.md"),
    read("docs/BOZEMAN_BETA_GO_NO_GO.md"),
  ]);

  assert(contract.startsWith('import "server-only";'), "Launch gate contract must stay server-only.");
  assert(!/SUPABASE_SERVICE_ROLE_KEY|sk_live|password\s*=|api[_-]?key\s*=|eyJ[A-Za-z0-9_-]+\./i.test(contract), "Launch gate contract appears to contain secret-like material.");
  assert.equal(BOZEMAN_BETA_LAUNCH_GATE_SERVICE_ROLE_APPLICATION_AVAILABLE, false);
  assertIncludes(packageJson, "test:bozeman-beta-launch-gate", "package.json");
  assertIncludes(packageJson, "test:bozeman-beta-ui", "package.json");
  assertIncludes(packageJson, "test:bozeman-beta-launch:hosted", "package.json");
  assertIncludes(roadmap, "12.23 Bozeman Beta UI Polish, Hosted Validation, and Launch Gate", "roadmap");
  assertIncludes(runbook, "Belgrade Sheets/App Script remains the fallback", "runbook");
  assertIncludes(runbook, "Do not log credentials, tokens, full schedule URLs, or raw provider payloads", "runbook");
  assertIncludes(goNoGo, "Conclusion: NO-GO", "go/no-go report");
  assertIncludes(goNoGo, "Production email provider", "go/no-go report");
  assertIncludes(goNoGo, "project-local-staging", "go/no-go report");
  assertIncludes(goNoGo, "20260714122230", "go/no-go report");

  const routeFiles = [
    "app/admin/calendar/page.tsx",
    "app/admin/volunteers/page.tsx",
    "app/v/schedule/page.tsx",
    "components/CalendarClient.tsx",
    "components/VolunteerDirectory.tsx",
    "components/VolunteerScheduleClient.tsx",
  ];
  for (const file of routeFiles) {
    const source = await read(file);
    assert(!source.includes("bozemanBetaLaunchGate"), `${file} must not import the launch gate.`);
  }

  console.log("Bozeman beta launch gate contract is server-only, route-unused, NO-GO honest, and documentation-backed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
