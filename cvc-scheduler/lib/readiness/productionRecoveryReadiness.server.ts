import "server-only";

export type ProductionRecoveryReadinessStatus =
  | "documented"
  | "operator_evidence_required"
  | "restore_test_required"
  | "configuration_required"
  | "proven"
  | "blocked";

export type ProductionRecoveryReadinessItem = Readonly<{
  id: string;
  title: string;
  status: ProductionRecoveryReadinessStatus;
  blocking: boolean;
  evidence: readonly string[];
  requiredAction: string;
}>;

export const PRODUCTION_RECOVERY_READINESS_AVAILABLE = true;
export const PRODUCTION_RECOVERY_READINESS_DECISION = "NO-GO" as const;
export const PRODUCTION_RECOVERY_READINESS_COMPLETE = false;
export const PRODUCTION_RECOVERY_CAN_ACCESS_PRODUCTION = false;
export const PRODUCTION_RECOVERY_CAN_MUTATE_PRODUCTION = false;
export const PRODUCTION_RECOVERY_CAN_PERFORM_RESTORE = false;
export const PRODUCTION_RECOVERY_CAN_CREATE_DUMP = false;
export const PRODUCTION_RECOVERY_CAN_CREATE_DATA = false;
export const PRODUCTION_RECOVERY_CAN_SEND_EMAIL = false;
export const PRODUCTION_RECOVERY_CAN_USE_SERVICE_ROLE_APPLICATION = false;

export const productionRecoveryBaseline = {
  canonicalOrigin: "https://projectlocal.app",
  fallbackOrigin: "https://project-local-one.vercel.app",
  vercelProject: "project-local",
  productionBranch: "master",
  deployedCommit: "082c960",
  supabaseProject: "project-local-production",
  supabaseRef: "wdlaauzknfggoqldolmx",
  forbiddenStagingRef: "kfuujcfxoayukywvtaeh",
  migration: "20260714122230",
  emailTransport: "disabled",
  launchDecision: PRODUCTION_RECOVERY_READINESS_DECISION,
} as const;

export const productionRecoveryReadinessItems: readonly ProductionRecoveryReadinessItem[] = [
  {
    id: "production_baseline",
    title: "Verified production baseline",
    status: "proven",
    blocking: false,
    evidence: [
      "canonical production origin is https://projectlocal.app",
      "Vercel project project-local deployed commit 082c960 from branch master",
      "production Supabase project-local-production/wdlaauzknfggoqldolmx is migrated through 20260714122230",
      "exact post-deployment production smoke passed after 12.27",
    ],
    requiredAction:
      "Record a new verified deployment baseline after every production deployment and smoke pass.",
  },
  {
    id: "application_rollback",
    title: "Application rollback",
    status: "documented",
    blocking: false,
    evidence: [
      "Vercel project project-local is the production host",
      "currently verified deployment baseline is commit 082c960 on branch master",
      "application rollback means Vercel rollback or redeploying a known-good commit",
      "application rollback is not database rollback",
    ],
    requiredAction:
      "Before launch, confirm who can approve and execute Vercel rollback, then verify the canonical-domain smoke gate after any rollback.",
  },
  {
    id: "migration_recovery",
    title: "Database migration recovery",
    status: "documented",
    blocking: false,
    evidence: [
      "production is migrated through 20260714122230",
      "applied migration history must be preserved",
      "reviewed forward-fix migrations are the normal recovery path after an applied production migration",
      "future production migrations need an established-production gate because approved Auth identities may now exist",
    ],
    requiredAction:
      "Do not delete, rename, reorder, rewrite, or down-migrate applied production migrations; design a reviewed forward fix and live-state gate instead.",
  },
  {
    id: "backup_availability",
    title: "Production backup availability and retention",
    status: "operator_evidence_required",
    blocking: true,
    evidence: [
      "repository has no Supabase dashboard evidence for automatic backups",
      "retention period and visible backup status are not recorded",
      "point-in-time recovery availability for the current plan is unknown",
    ],
    requiredAction:
      "Jelani must inspect the production Supabase dashboard and record plan, automatic backup status, retention, visible backup timestamps/status, and PITR availability without exposing secrets.",
  },
  {
    id: "restore_procedure",
    title: "Restore procedure and approval",
    status: "operator_evidence_required",
    blocking: true,
    evidence: [
      "restore initiation path is not verified",
      "whether restore creates a new project/database or replaces the existing one is not recorded",
      "restore approval owner is unknown",
    ],
    requiredAction:
      "Document who may approve restore, where restore is initiated, whether it creates or replaces a project/database, and what verification must follow.",
  },
  {
    id: "restore_test",
    title: "Restore test evidence",
    status: "restore_test_required",
    blocking: true,
    evidence: [
      "no production restore was performed in 12.28",
      "no database dump or second production project was created",
      "restore readiness cannot be claimed until a reviewed restore test or equivalent operator evidence exists",
    ],
    requiredAction:
      "Plan a safe non-destructive restore test or operator-approved equivalent before launch; never expose database credentials or dumps in the repository or transcript.",
  },
  {
    id: "operational_pause",
    title: "Operational pause without deletion",
    status: "documented",
    blocking: false,
    evidence: [
      "workspace_contact_grants support revocation, inactive state, and validity windows",
      "email transport remains disabled",
      "Belgrade Sheets/App Script remains operational fallback",
      "Auth identity deletion and product-record deletion are not normal pause mechanisms",
    ],
    requiredAction:
      "Pause Project Local by stopping provisioning, revoking/expiring production workspace grants, keeping email disabled, and optionally rolling back app deployment.",
  },
  {
    id: "recovery_verification",
    title: "Post-recovery verification",
    status: "documented",
    blocking: false,
    evidence: [
      "canonical-domain smoke gate exists for public route checks",
      "production migration level is 20260714122230",
      "no routine recovery check should request magic links automatically or create production fixtures",
    ],
    requiredAction:
      "After recovery, verify deployment health, canonical-domain smoke, manual Auth callback if approved, no-grant fail-closed behavior, migration/schema/type compatibility, RLS expectations, volunteer schedule privacy, and email disabled state.",
  },
  {
    id: "observability_alerting",
    title: "Recovery observability and alerting",
    status: "configuration_required",
    blocking: true,
    evidence: [
      "production runtime alert owner is not recorded",
      "restore/rollback incident logging location is not recorded",
      "stale email delivery monitoring remains unresolved until the production email slice",
    ],
    requiredAction:
      "Configure alert ownership and incident logging without recording credentials, tokens, raw provider payloads, SQL, grants, capability arrays, or secret-bearing stack traces.",
  },
  {
    id: "incident_ownership",
    title: "Incident ownership",
    status: "operator_evidence_required",
    blocking: true,
    evidence: [
      "application rollback owner is not recorded",
      "operational pause owner is not recorded",
      "database restore owner is not recorded",
      "email disablement and pilot cancellation owners are not recorded",
    ],
    requiredAction:
      "Name the decision owners for application rollback, operational pause, database restore, email disablement, and pilot cancellation before launch.",
  },
  {
    id: "recovery_launch_status",
    title: "Recovery readiness launch status",
    status: "blocked",
    blocking: true,
    evidence: [
      "backup availability, retention, restore process, restore ownership, restore test evidence, and incident ownership remain unresolved",
      "real Bozeman product data remains unprovisioned",
      "launch remains NO-GO",
    ],
    requiredAction:
      "Keep launch blocked until operator backup/restore evidence, restore-test evidence, incident ownership, email, observability, provisioning, UI approval, and pilot evidence pass.",
  },
];

export const productionRecoveryReadinessSummary = {
  decision: PRODUCTION_RECOVERY_READINESS_DECISION,
  complete: PRODUCTION_RECOVERY_READINESS_COMPLETE,
  baseline: productionRecoveryBaseline,
  reason:
    "Production recovery readiness is incomplete until Supabase backup/retention/PITR evidence, restore ownership/procedure, restore-test evidence, incident ownership, email, observability, operator provisioning, UI approval, and pilot evidence exist.",
  items: productionRecoveryReadinessItems,
} as const;
