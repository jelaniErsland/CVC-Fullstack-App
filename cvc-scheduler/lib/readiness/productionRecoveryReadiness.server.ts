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
  supabasePlan: "Free",
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
    title: "Supabase-managed backup availability and retention",
    status: "configuration_required",
    blocking: true,
    evidence: [
      "operator dashboard evidence confirms project-local-production/wdlaauzknfggoqldolmx is on the Free plan",
      "Supabase Scheduled backups page states: Free Plan does not include project backups",
      "upgrading to Pro provides up to 7 days of scheduled backups",
      "no scheduled production backup is currently available",
      "no backup timestamp or successful backup status exists yet",
      "Supabase Pro remains optional",
      "Supabase Pro managed backups are optional, not a mandatory initial beta prerequisite",
    ],
    requiredAction:
      "Before real Bozeman data is provisioned, prove either the preferred independent encrypted backup path or the optional Supabase-managed Pro backup path with recorded retention and successful backup evidence.",
  },
  {
    id: "independent_backup_path",
    title: "Preferred independent encrypted backup path",
    status: "configuration_required",
    blocking: true,
    evidence: [
      "approved policy minimizes recurring subscriptions until Project Local has multiple active users every month",
      "preferred near-term strategy is a tested encrypted independent logical PostgreSQL backup system",
      "12.29 adds a Windows-first PowerShell automation foundation with Supabase CLI/Docker/age/psql dependency preflights and fixture/static guardrails",
      "no production backup has run and no restore has passed",
      "backup artifacts must never enter the public application repository",
      "database backups do not automatically prove Supabase Storage object recovery",
    ],
    requiredAction:
      "Complete operator setup: create real age keys, store the DPAPI secret safely, run the first encrypted production backup, record checksum/status/retention evidence, validate notification behavior, and restore-test into an approved disposable non-production target before real Bozeman data.",
  },
  {
    id: "independent_backup_automation_foundation",
    title: "Independent backup automation foundation",
    status: "documented",
    blocking: false,
    evidence: [
      "12.29 adds PowerShell scripts for DPAPI secret setup, guarded logical backup, Task Scheduler registration, and an explicit guarded local restore boundary",
      "normal regression requires no real Supabase credentials, OneDrive, age, Docker, production access, or running local Supabase",
      "scripts are route-unused and do not change application runtime behavior",
      "scheduled task is not registered by the repository or tests",
    ],
    requiredAction:
      "Use the operator guide to install dependencies, create keys, configure the DPAPI secret, run a first manual backup, register the task explicitly, and complete a restore drill before real data.",
  },
  {
    id: "point_in_time_recovery",
    title: "Point-in-time recovery",
    status: "documented",
    blocking: false,
    evidence: [
      "operator dashboard evidence confirms Point in Time Recovery is a Pro Plan add-on",
      "PITR is not currently enabled or available on the Free plan",
      "PITR add-on starts at $100/month",
      "PITR is intentionally not required for the narrow initial Bozeman beta unless a later operational review changes that decision",
    ],
    requiredAction:
      "Do not treat PITR as an initial beta blocker; revisit only if a later operational review requires second-level recovery.",
  },
  {
    id: "restore_procedure",
    title: "Restore procedure and approval",
    status: "configuration_required",
    blocking: true,
    evidence: [
      "operator dashboard evidence confirms Restore to new project requires Pro Plan and above",
      "Supabase-managed restore to new project requires Pro and physical backups",
      "restore to new project is currently unavailable",
      "no restore was started and no second project was created",
      "no database dump, credentials, or secrets were accessed or exposed",
      "restore approval owner is unknown",
    ],
    requiredAction:
      "Complete restore testing for the chosen backup path: independent encrypted backups restore into an approved disposable non-production target, or optional Supabase-managed backups restore to a new project after Pro/physical backups are enabled.",
  },
  {
    id: "restore_test",
    title: "Restore test evidence",
    status: "restore_test_required",
    blocking: true,
    evidence: [
      "no production restore was performed in 12.28 or 12.28.1",
      "no database dump or second production project was created",
      "restore readiness cannot be claimed until a reviewed restore test for the chosen backup path exists",
    ],
    requiredAction:
      "Run a safe restore test into local Supabase or another approved disposable non-production target, then verify schema, migration level, expected records, RLS/security assumptions, application compatibility, and cleanup without exposing credentials or dumps.",
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
      "12.32 proves the privacy-safe application event model and a route-unused non-mutating stale-sending detection seam",
      "production runtime alert owner is not recorded",
      "restore/rollback incident logging location is not recorded",
      "no operator stale-delivery check cadence or alert path is configured",
      "no controlled production-safe event has been observed in the operator runtime-log workflow",
    ],
    requiredAction:
      "Configure runtime visibility, alert ownership, stale-delivery check cadence, and incident logging, then prove one controlled event is observable without recording credentials, tokens, PII, raw provider payloads, SQL, grants, capability arrays, or secret-bearing stack traces.",
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
      "production backup configuration is confirmed blocked by the current Free plan",
      "preferred independent encrypted backup foundation exists but has not produced a successful encrypted production backup or restore test",
      "at least one reviewed backup path must be proven before real Bozeman data",
      "first backup timestamp/status, retention, restore owner, restore test evidence, and incident ownership remain unresolved",
      "real Bozeman product data remains unprovisioned",
      "launch remains NO-GO",
    ],
    requiredAction:
      "Keep launch blocked until either the preferred independent encrypted backup path or optional Supabase-managed Pro path is implemented, restore-tested, and documented, and until incident ownership, email, observability, provisioning, and pilot evidence pass. Product-owner UI approval is already proven through 12.30.1.",
  },
];

export const productionRecoveryReadinessSummary = {
  decision: PRODUCTION_RECOVERY_READINESS_DECISION,
  complete: PRODUCTION_RECOVERY_READINESS_COMPLETE,
  baseline: productionRecoveryBaseline,
  reason:
    "Production recovery readiness is incomplete until either the preferred independent encrypted backup path or optional Supabase-managed Pro path is implemented, restore-tested, and documented; PITR is unavailable and not required for the initial beta.",
  items: productionRecoveryReadinessItems,
} as const;
