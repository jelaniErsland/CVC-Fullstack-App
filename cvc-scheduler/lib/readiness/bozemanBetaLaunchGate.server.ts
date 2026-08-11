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
export const BOZEMAN_BETA_LAUNCH_GATE_PRODUCTION_EMAIL_PROVIDER_APPROVED = true;
export const BOZEMAN_BETA_LAUNCH_GATE_PRODUCTION_EMAIL_PROVIDER = "resend" as const;
export const BOZEMAN_BETA_LAUNCH_GATE_EMAIL_PROVIDER_CONFIGURATION_PROVEN = true;
export const BOZEMAN_BETA_LAUNCH_GATE_PROVIDER_DIRECT_DELIVERABILITY_PROVEN = true;
export const BOZEMAN_BETA_LAUNCH_GATE_APPLICATION_EMAIL_ENABLED = false;
export const BOZEMAN_BETA_LAUNCH_GATE_APPLICATION_EMAIL_DELIVERY_PROVEN = false;
export const BOZEMAN_BETA_APPLICATION_OBSERVABILITY_FOUNDATION_PROVEN = true;
export const BOZEMAN_BETA_OPERATOR_OBSERVABILITY_PROVEN = false;
export const BOZEMAN_BETA_PRODUCT_OWNER_UI_APPROVED = true;
export const BOZEMAN_BETA_APPROVED_UI_REFERENCE_PATH =
  "docs/design/approved-project-local-ui";
export const BOZEMAN_BETA_APPROVED_UI_REVIEW_CAPTURE_COUNT = 6;
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
      "12.31 selects Resend and validates a server-only production transport through deterministic fake-network regression",
      "August 10 2026 operator evidence proves projectlocal.app domain verification, the verified Project Local sender, a restricted domain-scoped production key stored only in Vercel Production, canonical base URL and sender configuration, disabled open/click tracking, and direct Resend-dashboard delivery to an approved Gmail inbox",
      "The direct provider test did not use Project Local's Initial email action or assignment_notification_deliveries claim/provider/finalize boundary",
      "ASSIGNMENT_NOTIFICATION_EMAIL_TRANSPORT is currently absent after a Ready/Latest redeployment, so application email is disabled; the recording path is also absent",
      "No Project Local production product data or notification-delivery row was created during the provider test",
    ],
    requiredAction:
      "Keep application email disabled until backup/recovery and provisioning prerequisites permit a reviewed controlled app-driven test; then prove the Initial email action through the production ledger/provider/finalize round trip, duplicate behavior, schedule-access link, retry/failure operations, and credential-free monitoring.",
  },
  {
    id: "beta_critical_ui",
    title: "Beta-critical Project Local UI polish",
    status: "proven",
    blocking: false,
    evidence: [
      "docs/design/approved-project-local-ui defines the approved bright, polished direction",
      "12.23 performs focused polish on Calendar, Volunteers, and volunteer schedule surfaces",
      "12.30 was functionally validated but rejected in product-owner visual review",
      "Jelani explicitly product-owner approved the corrected 12.30.1 Project Local beta UI direction",
      "All six real-route desktop and 390px 12.30.1 review captures were reviewed and accepted",
    ],
    requiredAction:
      "Preserve the approved 12.30.1 visual baseline while the separate provisioning, production-readiness, and controlled-pilot gates are completed.",
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
    id: "application_observability_foundation",
    title: "Privacy-safe application observability foundation",
    status: "proven",
    blocking: false,
    evidence: [
      "12.32 adds a server-only bounded structured event schema with allowlisted event names and failure codes",
      "Auth, Calendar, Volunteer, assignment, schedule-access, volunteer-response, and assignment-email boundaries emit credential-free operational outcomes",
      "assignment-email claim, schedule-access, provider, finalization, sent, and stale-sending outcomes remain distinguishable",
      "deterministic regression proves redaction constraints, non-mutating stale detection, no Client Component import, and logging-failure isolation",
    ],
    requiredAction:
      "Preserve the 12.32 application event contract while completing the separate operator runtime visibility, alert ownership, alert-condition, stale-check cadence, and controlled production observation gate.",
  },
  {
    id: "controlled_pilot",
    title: "Controlled Bozeman beta pilot",
    status: "pilot_required",
    blocking: true,
    evidence: [
      "Jelani explicitly product-owner approved the 12.30.1 beta-critical UI",
      "no real Bozeman records were created by the UI review or local regression fixtures",
      "no controlled pilot approval or production launch approval has been granted",
    ],
    requiredAction:
      "After the remaining production-readiness gates and real Bozeman provisioning are complete, run and document a small controlled pilot with approved data and test recipients.",
  },
  {
    id: "production_environment",
    title: "Production deployment, Auth redirects, observability, backup, and rollback",
    status: "configuration_required",
    blocking: true,
    evidence: [
      "12.32 application instrumentation is proven locally without production or staging access",
      "operator runtime event visibility, alert ownership, stale-delivery check cadence, and controlled production observation are not proven",
      "Belgrade Sheets/App Script remains the operational fallback",
    ],
    requiredAction:
      "Verify production runtime/deployment event visibility, alert and incident ownership, actionable conditions, stale-delivery check cadence, one controlled privacy-safe observation, backups, restore/rollback procedure, and fallback decision.",
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
    "The core persisted scheduling loop, privacy-safe application observability foundation, Resend application adapter, provider/domain/sender configuration, and direct provider-level inbox delivery are proven. Project Local application-driven production delivery through its ledger and schedule-access boundary, operator runtime visibility and alerting, backup/recovery, provisioning, and pilot prerequisites remain unresolved, so the honest launch decision is NO-GO.",
  target: BOZEMAN_BETA_LAUNCH_STAGING_TARGET,
  items: bozemanBetaLaunchGateItems,
} as const;
