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
      "12.34 produced the first independent age-encrypted production logical backup at 2026-08-12T17:26:46.3144615Z",
      "recurring scheduling and failure-notification behavior are not yet proven",
      "Supabase Pro remains optional",
      "Supabase Pro managed backups are optional, not a mandatory initial beta prerequisite",
    ],
    requiredAction:
      "Before real Bozeman data is provisioned, prove either the preferred independent encrypted backup path or the optional Supabase-managed Pro backup path with recorded retention and successful backup evidence.",
  },
  {
    id: "independent_backup_path",
    title: "Preferred independent encrypted backup path",
    status: "restore_test_required",
    blocking: true,
    evidence: [
      "approved policy minimizes recurring subscriptions until Project Local has multiple active users every month",
      "preferred near-term strategy is a tested encrypted independent logical PostgreSQL backup system",
      "12.29 adds a Windows-first PowerShell automation foundation with Supabase CLI/Docker/age/psql dependency preflights and fixture/static guardrails",
      "12.34 safely validated the current-user-only DPAPI secret ACL and exact production Session Pooler target",
      "the first six-file production package was encrypted before OneDrive persistence, recorded a matching SHA-256 and 62409-byte size, and left no plaintext residue",
      "12.34.1 classifies the actual eight-statement roles.sql, verifies four represented Supabase-managed roles and their safe configuration/parameter privilege without recreating them, and fails closed on unsupported role material",
      "the single fresh 12.34.1 restore passed roles, schema, all 23 migrations through 20260714122230, data, baseline functions, pending-function absence, RLS, and FORCE RLS before stopping on 26 unsafe restored TRUNCATE grants",
      "backup artifacts must never enter the public application repository",
      "database backups do not automatically prove Supabase Storage object recovery",
    ],
    requiredAction:
      "Resolve the fail-closed TRUNCATE-grant recovery blocker without weakening the production security baseline, complete the remaining disposable post-restore checks, then prove scheduling/failure notification and record recovery ownership before real Bozeman data.",
  },
  {
    id: "first_independent_backup",
    title: "First independent encrypted production backup",
    status: "proven",
    blocking: false,
    evidence: [
      "read-only preflight proved project-local-production/wdlaauzknfggoqldolmx, database postgres, and terminal migration 20260714122230",
      "one real backup execution produced roles.sql, schema.sql, data.sql, supabase_migrations schema/data, and a credential-free manifest",
      "the age-encrypted artifact was persisted atomically at 2026-08-12T17:26:46.3144615Z with 62409 bytes and a matching 64-character SHA-256",
      "daily/weekly recognition-based retention passed and no plaintext SQL, zip, connection value, or private identity persisted in OneDrive or the repository",
    ],
    requiredAction:
      "Preserve the encrypted artifact, credential-free status evidence, and managed-role rule while the restored TRUNCATE-grant mismatch and recurring operator procedure are completed.",
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
      "12.34.1 reused the existing encrypted artifact for exactly one fresh loopback-only full restore attempt and created no hosted project",
      "checksum, age decryption, exact six-member archive guards, managed-role verification, schema, complete migration history, data, baseline functions, pending-function absence, RLS, and FORCE RLS passed",
      "the restore then failed closed because anon and authenticated each held TRUNCATE on all 13 Project Local tables; TRUNCATE bypasses RLS",
      "production-baseline generated-type parity, product-row verification, and remaining application compatibility checks were not reached and are not claimed",
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
      "no production restore was performed",
      "12.34.1 performed exactly one fresh full restore attempt using the existing 12.34 encrypted artifact",
      "the managed-role boundary verified rather than recreated anon, authenticated, authenticator, and supabase_realtime_admin; no user-defined roles or password/verifier statements were present",
      "schema, 23-version migration history through 20260714122230, data, baseline functions, pending Notification Health absence, all-table RLS, and expected FORCE RLS passed",
      "verification stopped fail-closed on 26 direct TRUNCATE grants covering anon and authenticated across all 13 Project Local tables",
      "decrypted/transformed workspaces and disposable containers were removed after diagnosis",
      "restore readiness cannot be claimed until the grant mismatch is resolved and the remaining type/product/application checks pass",
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
    status: "proven",
    blocking: false,
    evidence: [
      "12.32 proves the privacy-safe application event model and non-mutating stale-sending definition",
      "August 11 2026 operator evidence records Vercel Production Logs as the runtime review location and Vercel Deployments/build status as the deployment-failure review location",
      "Project Local product/operator owner is recorded as the primary alert and incident-response owner and may use Codex or engineering assistance without transferring operational ownership",
      "a controlled invalid schedule-access token request produced the expected safe unavailable behavior and a searchable privacy-safe schedule_access.exchange_failure warning in Vercel Production Logs",
      "12.33 adds an authenticated capability-gated bounded read, an unlinked Notification Health route, one-signal detector integration, local proof, and project-local-staging proof through 20260811123300",
      "the named operator checks after each controlled email test or batch, before manual retry, and at the end of each active email day; any stale row requires immediate ledger reconciliation, while repetition or more than one unresolved row pauses application email",
      "this explicit pull check plus proven Vercel runtime logs and named ownership is sufficient manual notification for the initial tiny controlled beta; automated alert delivery is unproven and not required at that scale",
      "production RPC execution and real production stale-row observation remain deferred to the reviewed production migration/provisioning and controlled pilot",
    ],
    requiredAction:
      "Preserve the 12.33 cadence and privacy boundary; record the first production Notification Health execution after a separately reviewed migration and provisioning, and add automated alert delivery only if scale, repetition, or response performance makes manual operation inadequate.",
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
      "the preferred independent path has produced its first successful encrypted production backup and solved the managed-role restore boundary, but full recovery remains blocked by unsafe restored TRUNCATE grants",
      "at least one reviewed backup path must be proven before real Bozeman data",
      "recurring schedule/failure notification, restore owner, full restore evidence, and incident ownership remain unresolved",
      "real Bozeman product data remains unprovisioned",
      "launch remains NO-GO",
    ],
    requiredAction:
      "Keep launch blocked until either the preferred independent encrypted backup path or optional Supabase-managed Pro path is implemented, restore-tested, and documented, and until incident ownership, application email, provisioning, production notification-health execution, and pilot evidence pass. Product-owner UI and initial-beta observability architecture are already proven.",
  },
];

export const productionRecoveryReadinessSummary = {
  decision: PRODUCTION_RECOVERY_READINESS_DECISION,
  complete: PRODUCTION_RECOVERY_READINESS_COMPLETE,
  baseline: productionRecoveryBaseline,
  reason:
    "The first independent encrypted production backup and managed-role restore boundary are proven, but recovery readiness remains incomplete until the restored TRUNCATE-grant mismatch is resolved, the remaining disposable verification passes, and recurring operator/ownership evidence is recorded; PITR is unavailable and not required for the initial beta.",
  items: productionRecoveryReadinessItems,
} as const;
