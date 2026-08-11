import "server-only";

export type ProductionEnvironmentReadinessStatus =
  | "proven"
  | "operator_required"
  | "configuration_required"
  | "blocked"
  | "deferred_non_blocking";

export type ProductionEnvironmentReadinessItem = Readonly<{
  id: string;
  title: string;
  status: ProductionEnvironmentReadinessStatus;
  blocking: boolean;
  evidence: readonly string[];
  requiredAction: string;
}>;

export const PRODUCTION_ENVIRONMENT_READINESS_AVAILABLE = true;
export const PRODUCTION_ENVIRONMENT_READINESS_CAN_DEPLOY = false;
export const PRODUCTION_ENVIRONMENT_READINESS_CAN_CREATE_SUPABASE_PROJECT = false;
export const PRODUCTION_ENVIRONMENT_READINESS_CAN_MODIFY_DNS = false;
export const PRODUCTION_ENVIRONMENT_READINESS_CAN_SEND_EMAIL = false;
export const PRODUCTION_ENVIRONMENT_READINESS_CAN_CREATE_DATA = false;
export const PRODUCTION_ENVIRONMENT_READINESS_CAN_USE_SERVICE_ROLE_APPLICATION = false;
export const PRODUCTION_ENVIRONMENT_READINESS_CAN_ACTIVATE_RESPONSE_LINK_REVEAL = false;
export const PRODUCTION_ENVIRONMENT_READINESS_DECISION = "NO-GO" as const;
export const PRODUCTION_ENVIRONMENT_RECOMMENDED_HOST = "Vercel" as const;
export const PRODUCTION_ENVIRONMENT_EXPECTED_MIGRATION = "20260714122230" as const;
export const PRODUCTION_EMAIL_PROVIDER_CONFIGURATION_PROVEN = true;
export const PRODUCTION_EMAIL_PROVIDER_DIRECT_DELIVERABILITY_PROVEN = true;
export const PRODUCTION_APPLICATION_EMAIL_ENABLED = false;
export const PRODUCTION_APPLICATION_EMAIL_DELIVERY_PROVEN = false;
export const PRODUCTION_APPLICATION_OBSERVABILITY_FOUNDATION_PROVEN = true;
export const PRODUCTION_RUNTIME_LOG_VISIBILITY_PROVEN = true;
export const PRODUCTION_CONTROLLED_OBSERVABLE_EVENT_PROVEN = true;
export const PRODUCTION_OBSERVABILITY_OWNERSHIP_RECORDED = true;
export const PRODUCTION_DEPLOYMENT_STATUS_VISIBILITY_PROVEN = true;
export const PRODUCTION_STALE_DELIVERY_MONITORING_PROVEN = false;
export const PRODUCTION_OPERATOR_ALERT_NOTIFICATION_PROVEN = false;
export const PRODUCTION_OPERATOR_OBSERVABILITY_PROVEN = false;

export const productionEnvironmentKnownStagingTarget = {
  name: "project-local-staging",
  ref: "kfuujcfxoayukywvtaeh",
  validatedMigration: PRODUCTION_ENVIRONMENT_EXPECTED_MIGRATION,
} as const;

export const productionEnvironmentReadinessItems: readonly ProductionEnvironmentReadinessItem[] = [
  {
    id: "staging_baseline",
    title: "Hosted staging baseline",
    status: "proven",
    blocking: false,
    evidence: [
      "12.23.1 proved the integrated hosted beta loop on project-local-staging/kfuujcfxoayukywvtaeh",
      "staging remains validated through migration 20260714122230 with generated-type parity and zero residue",
    ],
    requiredAction:
      "Keep staging separate from production and rerun focused staging gates only when staging-facing schema/runtime assumptions change.",
  },
  {
    id: "environment_separation",
    title: "Local, staging, and production separation",
    status: "configuration_required",
    blocking: true,
    evidence: [
      "local uses loopback Supabase and disposable fixtures",
      "staging is project-local-staging/kfuujcfxoayukywvtaeh through 20260714122230",
      "production is project-local-production/wdlaauzknfggoqldolmx through 20260714122230",
      "production deployment uses project-local at canonical origin https://projectlocal.app",
      "temporary Vercel fallback alias remains https://project-local-one.vercel.app",
    ],
    requiredAction:
      "Keep production separated from staging and local fixtures; do not create real rows until the remaining launch blockers and reviewed operator provisioning steps pass.",
  },
  {
    id: "hosting_recommendation",
    title: "Production hosting platform",
    status: "proven",
    blocking: false,
    evidence: [
      "Vercel project project-local is live and Ready with temporary fallback alias https://project-local-one.vercel.app",
      "canonical production origin https://projectlocal.app is connected and loaded successfully over HTTPS without a browser warning",
      "repository root directory is cvc-scheduler and production branch is master",
      "Next server actions, route handlers, dynamic/no-store routes, and HttpOnly cookies need first-class support",
      "Vercel is the lowest-friction fit for this Next.js app and provides preview deployments, env management, domains, HTTPS, logs, and rollback",
    ],
    requiredAction:
      "Keep using the approved Vercel project and canonical domain; do not provision real Bozeman data until remaining launch blockers pass.",
  },
  {
    id: "production_supabase",
    title: "Production Supabase project",
    status: "proven",
    blocking: false,
    evidence: [
      "12.25 validated the initial/bootstrap empty production schema on project-local-production/wdlaauzknfggoqldolmx through 20260714122230",
      "production product rows, Auth users, and storage objects remained empty before 12.26 manual Auth proof",
      "after 12.26, approved Auth identities may exist while Project Local product rows and storage remain unprovisioned",
      "production must not reuse kfuujcfxoayukywvtaeh",
    ],
    requiredAction:
      "Keep Project Local product rows/storage empty until reviewed Bozeman operator provisioning; use a separately reviewed established-production migration gate after Auth identities or real product data exist.",
  },
  {
    id: "production_environment_variables",
    title: "Production environment variables",
    status: "proven",
    blocking: false,
    evidence: [
      ".env.example lists current app variables",
      "ADMIN_AUTH_MODE must be enforced in production",
      "operator evidence confirms ADMIN_AUTH_MODE is enforced and production Supabase public URL/key are configured in Vercel Production only",
      "operator evidence confirms SUPABASE_SERVICE_ROLE_KEY is absent",
      "recording email transport writes to filesystem and must not be production delivery",
      "12.31 adds RESEND_API_KEY as a server-only variable required only when the explicit resend transport is selected",
      "August 10 2026 operator evidence confirms RESEND_API_KEY is stored only in encrypted Vercel Production settings, with canonical notification base URL and verified sender configured",
      "ASSIGNMENT_NOTIFICATION_EMAIL_TRANSPORT and ASSIGNMENT_NOTIFICATION_RECORDING_PATH are currently absent, so application email is disabled",
    ],
    requiredAction:
      "Keep the restricted key and non-secret notification values in encrypted Vercel Production settings, keep the application transport disabled, and do not enable it until monitoring plus reviewed backup/recovery, provisioning, and controlled-test prerequisites are ready.",
  },
  {
    id: "auth_redirects",
    title: "Auth Site URL and redirect allowlist",
    status: "configuration_required",
    blocking: true,
    evidence: [
      "/admin/auth/callback exchanges Supabase Auth code",
      "getSafeAdminRedirect accepts only local /admin paths",
      "proxy requires Auth only when ADMIN_AUTH_MODE=enforced",
      "operator evidence confirms Supabase Auth Site URL is https://projectlocal.app and exact final-domain callback is configured",
      "temporary Vercel callback remains allowlisted for fallback",
      "manual magic-link sign-in returned through the final-domain production callback and opened the admin shell",
      "no-workspace/no-grant Calendar and Volunteers routes failed closed after sign-in",
    ],
    requiredAction:
      "Keep Auth Site URL/callbacks aligned with the canonical production domain and rerun smoke checks after any Auth/domain change.",
  },
  {
    id: "domain_dns",
    title: "Domain and DNS",
    status: "proven",
    blocking: false,
    evidence: [
      "canonical production origin is https://projectlocal.app",
      "temporary Vercel fallback alias remains https://project-local-one.vercel.app",
      "HTTPS loaded successfully without a browser warning by operator evidence",
    ],
    requiredAction:
      "Keep DNS/domain ownership documented privately and rerun smoke checks after any domain, certificate, or redirect change.",
  },
  {
    id: "email_provider",
    title: "Production email provider",
    status: "configuration_required",
    blocking: true,
    evidence: [
      "12.22/12.22.1 validate the authoritative claim/finalize ledger and recording transport",
      "12.31 selects Resend and validates a direct server-only HTTPS adapter, provider idempotency, safe response handling, and fail-closed configuration without real network delivery",
      "August 10 2026 operator evidence confirms projectlocal.app is verified and ready in Resend, Project Local <notifications@projectlocal.app> is configured, a restricted domain-scoped sending key is stored only in Vercel Production, and open/click tracking are disabled",
      "a direct Resend-dashboard message from the verified sender arrived in an approved Gmail inbox, proving provider/domain/sender/basic inbox deliverability only",
      "the provider test did not use Project Local's Initial email action or production delivery ledger, and no application assignment email or product row was created",
      "the transport was removed after a temporary no-send enablement and the resulting https://projectlocal.app production deployment is Ready/Latest; application email is currently disabled",
      "application-ledger delivery proof, schedule-link proof, duplicate/retry behavior with real Resend, and production email-failure monitoring remain unavailable",
    ],
    requiredAction:
      "Keep production application email disabled until a reviewed controlled pilot/test is safe; then prove the actual Initial email claim/provider/finalize round trip, duplicate protection, schedule-access link, retry/failure operations, and credential-free monitoring with an approved recipient.",
  },
  {
    id: "smoke_test",
    title: "Read-only production smoke test",
    status: "proven",
    blocking: false,
    evidence: [
      "12.26 adds npm run test:production-deployment-smoke for exact-origin public HTTP validation",
      "12.27 retargets the exact smoke gate to canonical origin https://projectlocal.app",
      "the command's refusal paths passed during implementation",
      "the same public HTTP assertions passed against https://projectlocal.app through a separate non-mutating diagnostic",
      "commit 082c960 was pushed to origin/master and the Vercel Production deployment sourced from 082c960 reached Ready",
      "the exact production deployment smoke passed before push and again after the Ready deployment with exit code 0",
      "manual operator evidence confirms anonymous /admin redirect, login, final-domain magic-link callback, no-grant fail-closed admin behavior, and invalid volunteer schedule unavailable behavior",
      "current hosted fixture gates are locked to staging and must not run against production",
    ],
    requiredAction:
      "Rerun the exact production deployment smoke gate after domain, Auth redirect, deployment, or environment changes.",
  },
  {
    id: "observability",
    title: "Logging and observability",
    status: "configuration_required",
    blocking: true,
    evidence: [
      "12.32 adds a server-only allowlisted structured event model for beta-critical failures and high-value assignment-email delivery success",
      "12.32 distinguishes assignment-email configuration, claim, schedule-access, provider, and finalization failures plus successful delivery without logging PII, credentials, URLs, raw errors, or provider payloads",
      "12.32 adds a deterministic route-unused non-mutating stale-sending detection seam and regression proof",
      "application events write naturally to server runtime logs and logging failure cannot change product behavior",
      "August 11 2026 operator evidence proves Vercel Production runtime-log visibility, event search and filtering, deployment/build status visibility, named alert and incident ownership, actionable conditions, and one controlled privacy-safe schedule_access.exchange_failure event",
      "the controlled invalid-token request created no data and sent no email, and the observed event exposed no volunteer identity, bearer, full URL, credential, provider payload, raw error, SQL, grant, capability array, API key, or environment secret",
      "an authorized production read path for stale assignment_notification_deliveries, check cadence, threshold/escalation proof, and a practical notification mechanism beyond manual Vercel Hobby review remain unproven",
    ],
    requiredAction:
      "Define and prove the authorized stale-delivery read path, check cadence, threshold/escalation procedure, and practical operator notification mechanism without adding unsafe data exposure; preserve the proven Vercel Logs/Deployments review workflow and privacy contract.",
  },
  {
    id: "backup_recovery",
    title: "Backup, restore, and rollback",
    status: "configuration_required",
    blocking: true,
    evidence: [
      "docs/PRODUCTION_BACKUP_RECOVERY_RUNBOOK.md documents application rollback, migration-forward recovery, operational pause, and recovery verification",
      "operator dashboard evidence confirms production Supabase is on the Free plan and scheduled backups are not available",
      "no first successful backup timestamp/status exists and retention is not recorded",
      "12.29 adds the preferred independent encrypted logical backup automation foundation with dependency preflights and a guarded local restore boundary, but no production backup has run",
      "Supabase-managed restore to new project is unavailable unless the optional Pro path is chosen and physical backups are enabled",
      "PITR is unavailable and intentionally not required for the initial beta",
      "restore test evidence is not recorded",
      "Belgrade Sheets/App Script remains fallback",
    ],
    requiredAction:
      "Before real Bozeman data is provisioned, implement and restore-test either the preferred independent encrypted backup path or optional Supabase-managed Pro path, then record backup timestamp/status, retention, restore verification, deployment rollback ownership, grant revocation fallback, email disable switch, and Belgrade operational fallback.",
  },
  {
    id: "operator_pilot_approval",
    title: "Operator provisioning and controlled pilot",
    status: "operator_required",
    blocking: true,
    evidence: [
      "12.14 provisioning boundary exists but real Bozeman rows are not created",
      "Jelani explicitly product-owner approved the 12.30.1 beta-critical UI and its six desktop/390px review captures",
      "real Bozeman provisioning and controlled pilot evidence remain incomplete",
    ],
    requiredAction:
      "Provision real Bozeman access through reviewed operator steps and run a controlled pilot before replacing any operational process.",
  },
  {
    id: "deferred_non_blocking_features",
    title: "Deferred non-blocking features",
    status: "deferred_non_blocking",
    blocking: false,
    evidence: [
      "response-link reveal/copy remains paused",
      "public lookup, remembered devices, /admin/tasks cutover, imports, Communications, reminders, and Belgrade migration are out of scope",
    ],
    requiredAction:
      "Do not add deferred features as production-readiness shortcuts; revisit only through separate reviewed slices.",
  },
];

export const productionEnvironmentReadinessSummary = {
  decision: PRODUCTION_ENVIRONMENT_READINESS_DECISION,
  recommendedHost: PRODUCTION_ENVIRONMENT_RECOMMENDED_HOST,
  expectedMigration: PRODUCTION_ENVIRONMENT_EXPECTED_MIGRATION,
  stagingTarget: productionEnvironmentKnownStagingTarget,
  reason:
    "Production environment readiness is a NO-GO even though the privacy-safe application observability foundation, Vercel runtime-log review and controlled-event proof, Resend domain/sender/secret configuration, and direct provider-level inbox delivery are proven. Project Local application-driven delivery, stale-delivery monitoring and practical alert notification, a reviewed backup path, restore-test evidence, rollback/restore ownership, operator provisioning, and pilot evidence remain incomplete. Product-owner UI approval is proven through 12.30.1.",
  items: productionEnvironmentReadinessItems,
} as const;
