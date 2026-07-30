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
      "production project has not been created or recorded",
    ],
    requiredAction:
      "Create and document a separate production Supabase project and deployment environment; never reuse staging data, Auth users, or notification ledger.",
  },
  {
    id: "hosting_recommendation",
    title: "Production hosting platform",
    status: "operator_required",
    blocking: true,
    evidence: [
      "repository is plain Next.js with no Netlify/Vercel config yet",
      "Next server actions, route handlers, dynamic/no-store routes, and HttpOnly cookies need first-class support",
      "Vercel is the lowest-friction fit for this Next.js app and provides preview deployments, env management, domains, HTTPS, logs, and rollback",
    ],
    requiredAction:
      "Jelani should create or approve a Vercel production project connected to the GitHub repository; no deployment is created by this contract.",
  },
  {
    id: "production_supabase",
    title: "Production Supabase project",
    status: "operator_required",
    blocking: true,
    evidence: [
      "12.23.1 validates only non-production staging",
      "production must not reuse kfuujcfxoayukywvtaeh",
    ],
    requiredAction:
      "Create a separate Project Local production Supabase project, store its password securely, collect public URL/key, configure Auth URLs, apply reviewed migrations, and verify schema/type parity before real data.",
  },
  {
    id: "production_environment_variables",
    title: "Production environment variables",
    status: "configuration_required",
    blocking: true,
    evidence: [
      ".env.example lists current app variables",
      "ADMIN_AUTH_MODE must be enforced in production",
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
    ],
    requiredAction:
      "Configure production Site URL and exact /admin/auth/callback redirect URLs after the final HTTPS domain is verified.",
  },
  {
    id: "domain_dns",
    title: "Domain and DNS",
    status: "operator_required",
    blocking: true,
    evidence: [
      "no domain registrar/provider is recorded in the repository",
      "production callback and notification base URL require a stable HTTPS origin",
    ],
    requiredAction:
      "Choose canonical production domain, connect it to the hosting project, verify HTTPS, and only then configure Auth and app base URLs.",
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
    status: "configuration_required",
    blocking: true,
    evidence: [
      "production smoke test must not create fixtures or send email",
      "current hosted fixture gates are locked to staging and must not run against production",
    ],
    requiredAction:
      "After production deployment exists, run a read-only, exact-opt-in smoke test that verifies health, migration level, type parity, anonymous admin redirect, login page, invalid schedule credential, no raw errors, and no mutation.",
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
      "production Supabase plan is not selected",
      "restore test and deployment rollback evidence are not recorded",
      "Belgrade Sheets/App Script remains fallback",
    ],
    requiredAction:
      "Verify backup availability, retention, restore procedure, deployment rollback, grant revocation fallback, email disable switch, and Belgrade operational fallback before launch.",
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
    "Production environment readiness is a NO-GO until a separate production Supabase project, hosting project, HTTPS domain/Auth redirects, production env values, email provider decision, observability, backups, rollback, operator provisioning, UI approval, and pilot evidence exist.",
  items: productionEnvironmentReadinessItems,
} as const;
