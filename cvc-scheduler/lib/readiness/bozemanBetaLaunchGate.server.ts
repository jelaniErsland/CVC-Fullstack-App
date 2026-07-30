import "server-only";

export type BozemanBetaLaunchGateStatus =
  | "proven"
  | "operator_required"
  | "configuration_required"
  | "pilot_required"
  | "blocked"
  | "deferred_non_blocking";

export type BozemanBetaLaunchGateItem = Readonly<{
  id: string;
  title: string;
  status: BozemanBetaLaunchGateStatus;
  blocking: boolean;
  evidence: readonly string[];
  requiredAction: string;
}>;

export const BOZEMAN_BETA_LAUNCH_GATE_AVAILABLE = true;
export const BOZEMAN_BETA_LAUNCH_GATE_CAN_LAUNCH_PRODUCTION = false;
export const BOZEMAN_BETA_LAUNCH_GATE_CAN_CREATE_DATA = false;
export const BOZEMAN_BETA_LAUNCH_GATE_CAN_SEND_EMAIL = false;
export const BOZEMAN_BETA_LAUNCH_GATE_CAN_MUTATE_DEPLOYMENT = false;
export const BOZEMAN_BETA_LAUNCH_GATE_SERVICE_ROLE_APPLICATION_AVAILABLE = false;
export const BOZEMAN_BETA_LAUNCH_GATE_RESPONSE_LINK_REVEAL_COPY_AVAILABLE = false;
export const BOZEMAN_BETA_LAUNCH_GATE_PRODUCTION_EMAIL_PROVIDER_APPROVED = false;
export const BOZEMAN_BETA_LAUNCH_GATE_DECISION = "NO-GO" as const;

export const BOZEMAN_BETA_LAUNCH_STAGING_TARGET = {
  name: "project-local-staging",
  ref: "kfuujcfxoayukywvtaeh",
  requiredHealth: "ACTIVE_HEALTHY",
  validatedMigration: "20260714122230",
  hostedResidueExpectation: 0,
} as const;

export const bozemanBetaLaunchGateItems: readonly BozemanBetaLaunchGateItem[] = [
  {
    id: "workspace_contact_grant_provisioning",
    title: "Workspace/contact/grant provisioning boundary",
    status: "operator_required",
    blocking: true,
    evidence: [
      "12.14 provisioning boundary and local validation exist",
      "real Bozeman rows are intentionally not committed or auto-created",
    ],
    requiredAction:
      "Operator must provision the real Bozeman workspace, approved Auth identities, project contacts, and explicit grants.",
  },
  {
    id: "volunteer_add_edit",
    title: "Persisted Volunteer Add/Edit",
    status: "proven",
    blocking: false,
    evidence: [
      "12.15 /admin/volunteers persisted Add/Edit path",
      "12.15.1 hosted staging validation passed",
      "test:volunteer-profile-management and browser proof cover local behavior",
    ],
    requiredAction: "Run final pilot spot checks with approved Bozeman data before launch.",
  },
  {
    id: "calendar_scheduling_loop",
    title: "Calendar create/edit, source selection, assignment, publish, and response truth",
    status: "proven",
    blocking: false,
    evidence: [
      "12.16 through 12.19.1 hosted validations passed",
      "12.18 assignment create/cancel uses assignment/current-response truth",
      "Calendar route remains persisted-truth-only with no mock fallback",
    ],
    requiredAction: "Complete 12.23 desktop/mobile UI polish and final browser sweep.",
  },
  {
    id: "volunteer_schedule_responses",
    title: "Account-light volunteer schedule and Confirm/Deny",
    status: "proven",
    blocking: false,
    evidence: [
      "12.20/12.20.1 schedule access uses hash-only credentials and HttpOnly cookies",
      "12.21/12.21.1 Confirm, Can’t make it, eligible changes, and Confirm All passed hosted validation",
    ],
    requiredAction: "Run final browser checks for mobile response-state clarity.",
  },
  {
    id: "initial_assignment_email_boundary",
    title: "Initial assignment notification boundary",
    status: "configuration_required",
    blocking: true,
    evidence: [
      "12.22 explicit send boundary exists",
      "12.22.1 hosted staging validation passed through 20260714122230",
      "Recording transport validated; real provider sending was intentionally not performed",
    ],
    requiredAction:
      "Approve and configure production provider, verified sender domain, sender identity, provider secret, base URL, failure monitoring, and a live test-recipient policy.",
  },
  {
    id: "beta_critical_ui",
    title: "Beta-critical Project Local UI polish",
    status: "pilot_required",
    blocking: true,
    evidence: [
      "Existing prototype and sample mockup images define the approved bright, polished direction",
      "12.23 performs focused polish on Calendar, Volunteers, and volunteer schedule surfaces",
    ],
    requiredAction:
      "Product owner must review final desktop/390px screenshots and complete a small controlled pilot.",
  },
  {
    id: "hosted_staging_validation",
    title: "Hosted staging validation",
    status: "proven",
    blocking: false,
    evidence: [
      "Non-production project-local-staging/kfuujcfxoayukywvtaeh validated through 20260714122230",
      "Generated public-schema type parity passed",
      "Hosted disposable residue count was zero after focused gates",
    ],
    requiredAction:
      "Run 12.23 hosted launch-gate verification against the same staging target before launch decision review.",
  },
  {
    id: "production_environment",
    title: "Production deployment, Auth redirects, observability, backup, and rollback",
    status: "configuration_required",
    blocking: true,
    evidence: [
      "No production target was accessed by 12.23",
      "Belgrade Sheets/App Script remains the operational fallback",
    ],
    requiredAction:
      "Document and verify production Supabase, deployment, domain/base URL, redirect allowlist, secrets inventory, logging, alerts, backups, restore/rollback procedure, and fallback decision.",
  },
  {
    id: "production_launch_action",
    title: "Production launch action",
    status: "blocked",
    blocking: true,
    evidence: [
      "12.23 is a launch-candidate gate only",
      "No explicit production-launch approval or production data procedure was requested",
    ],
    requiredAction:
      "Do not launch production until every blocking configuration/operator/pilot gate is complete and an explicit launch instruction is given.",
  },
  {
    id: "deferred_features",
    title: "Non-blocking deferred features",
    status: "deferred_non_blocking",
    blocking: false,
    evidence: [
      "Response-link reveal/copy remains paused",
      "/admin/tasks and /v/demo are not cut over",
      "Public lookup, remembered devices, Communications, reminders, and import remain deferred",
    ],
    requiredAction: "Keep these out of launch unless separately reviewed.",
  },
];

export const bozemanBetaLaunchGateSummary = {
  decision: BOZEMAN_BETA_LAUNCH_GATE_DECISION,
  reason:
    "The core persisted scheduling loop is proven through local and hosted staging gates, but production provider/domain/deployment/observability/backup/pilot prerequisites are unresolved. The honest launch decision is NO-GO until those blocking actions are completed.",
  target: BOZEMAN_BETA_LAUNCH_STAGING_TARGET,
  items: bozemanBetaLaunchGateItems,
} as const;
