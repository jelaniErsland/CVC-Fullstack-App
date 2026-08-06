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
    ],
    requiredAction:
      "Set production values only in encrypted hosting settings: production Supabase public URL/key, ADMIN_AUTH_MODE=enforced, HTTPS app origins, and disabled email transport until provider setup.",
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
    status: "blocked",
    blocking: true,
    evidence: [
      "12.22/12.22.1 validate disabled/recording transport only",
      "no provider SDK, sender domain, provider secret, or real deliverability proof exists",
    ],
    requiredAction:
      "Keep production email disabled until a separate reviewed provider slice approves provider, sender domain, sender identity, secret, monitoring, and test-send policy.",
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
      "launch runbook lists runtime failure signals",
      "no production logging/alerting evidence exists",
    ],
    requiredAction:
      "Configure deployment/runtime error visibility and alert ownership without logging credentials, tokens, raw provider payloads, SQL, grants, or capability arrays.",
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
      "preferred independent encrypted logical backup path is not implemented yet",
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
    title: "Operator provisioning, UI approval, and controlled pilot",
    status: "operator_required",
    blocking: true,
    evidence: [
      "12.14 provisioning boundary exists but real Bozeman rows are not created",
      "12.23 UI polish exists but product-owner approval remains separate",
    ],
    requiredAction:
      "Provision real Bozeman access through reviewed operator steps, complete product-owner desktop/mobile review, and run a controlled pilot before replacing any operational process.",
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
    "Production environment readiness is a NO-GO until email provider, observability, a reviewed backup path, restore-test evidence, rollback/restore ownership, operator provisioning, UI approval, and pilot evidence exist.",
  items: productionEnvironmentReadinessItems,
} as const;
