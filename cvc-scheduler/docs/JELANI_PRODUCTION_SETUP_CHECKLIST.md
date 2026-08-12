# Jelani Production Setup Checklist

This checklist names the manual actions needed before Project Local can launch a Bozeman beta. It does not authorize launch by itself.

Current conclusion: `NO-GO`.

## Phase A - Decisions

- Confirm hosting platform. Current repository recommendation: Vercel.
- Confirm the final production domain or app subdomain.
- Confirm the production Supabase project name.
- Confirm owner/admin email addresses for Supabase and hosting.
- Confirm who receives launch alerts.
- Resend is selected and its provider/domain/sender configuration plus direct provider-level inbox delivery are operator-proven; Project Local application-driven delivery is not proven and remains disabled.
- Confirm who can approve the final desktop/mobile UI.
- Confirm who can approve the first controlled Bozeman pilot.

## Phase B - Accounts/projects

- Create a new production Supabase project specifically for Project Local production.
- Do not reuse staging project `project-local-staging` (`kfuujcfxoayukywvtaeh`).
- Create or approve the Vercel project and connect the GitHub repository.
- 12.27 operator evidence confirms Vercel project `project-local` is live and Ready at canonical origin `https://projectlocal.app`, using repository root `cvc-scheduler` and production branch `master`.
- Temporary Vercel fallback alias `https://project-local-one.vercel.app` remains available.
- Keep the chosen domain connected in the hosting platform.
- Do not change DNS unless the hosting platform tells you the exact records.
- Do not add real Bozeman data yet.

## Phase C - Values to collect

Collect these values into private operator notes or the hosting platform, not into source code:

- Supabase production project name.
- Supabase production project ref.
- Supabase production project URL.
- Supabase public anon/publishable key.
- Canonical hosting deployment URL: `https://projectlocal.app`.
- Temporary Vercel fallback alias: `https://project-local-one.vercel.app`.
- Auth callback URL: `https://projectlocal.app/admin/auth/callback`.
- Resend verified sending domain `projectlocal.app` and exact sender `Project Local <notifications@projectlocal.app>`; August 10 operator evidence confirms both.

Creating an Auth user does not grant app access. App access requires:

1. Supabase Auth user identity.
2. Matching `project_contacts` row.
3. Effective `workspace_contact_grants` row.
4. Explicit capabilities.

## Phase D - Secrets

- Store the database password in a password manager.
- Do not paste database passwords into Codex, chat, docs, Git, screenshots, or issue comments.
- Do not expose the Supabase service-role key.
- Leave `SUPABASE_SERVICE_ROLE_KEY` unset in production unless a future reviewed slice explicitly requires it.
- `RESEND_API_KEY` must live only in hosting encrypted server environment settings and must never be copied into source, docs, screenshots, logs, or browser code.
- Never put a secret in a variable starting with `NEXT_PUBLIC_`.
- Never paste secrets into Codex.

## Phase E - Production Supabase setup

- Confirm the production Supabase project is exactly `project-local-production` with ref `wdlaauzknfggoqldolmx`.
- 12.25 already ran the initial/bootstrap empty-production schema gate successfully through migration `20260714122230` before Auth setup:
  ```powershell
  $env:RUN_PRODUCTION_SUPABASE_SCHEMA_VALIDATION='project-local-production:wdlaauzknfggoqldolmx'
  npm run test:production-supabase-schema
  Remove-Item Env:RUN_PRODUCTION_SUPABASE_SCHEMA_VALIDATION
  ```
- If Supabase CLI asks for the database password, enter it directly in the local terminal from the password manager. Do not paste it into Codex, chat, docs, Git, screenshots, or issue comments.
- The bootstrap schema gate is migration/type/security/count validation only. It must not create Auth users, workspaces, contacts, volunteer profiles, Calendar rows, assignments, notification deliveries, storage objects, or real Bozeman data.
- After 12.26 manual Auth proof, one or more approved Auth identities may legitimately exist. Do not delete them to satisfy the old bootstrap zero-Auth assertion.
- Future production migrations after Auth identities or real product data exist require a separately reviewed established-production migration/schema gate that accounts for the intended live state.
- Current Supabase Auth Site URL is `https://projectlocal.app`.
- Current exact final-domain callback is `https://projectlocal.app/admin/auth/callback`.
- Temporary fallback callback remains allowlisted: `https://project-local-one.vercel.app/admin/auth/callback`.
- Add any approved preview/staging callback URLs separately.
- Keep app sign-in invite-only. Unknown emails should not create usable project-contact access.
- Apply reviewed committed migrations to the new production project.
- Confirm final migration level `20260714122230` or later reviewed level.
- Compare generated public-schema types.
- Confirm RLS/Auth before adding real data.
- Verify backups and retention.

## Phase F - Hosting setup

- Connect the GitHub repository to Vercel.
- Select the intended production branch.
- Use the default Next.js build command, `npm run build`.
- Add production environment variables in encrypted settings.
- Set `ADMIN_AUTH_MODE=enforced`.
- Set production Supabase public URL/key.
- Keep application email transport disabled until backup/recovery, provisioning, monitoring, and a separately reviewed controlled app-driven test are ready.
- Leave recording path unset.
- Leave service-role key unset.

### Resend provider configuration (operator-proven August 10, 2026)

- Resend account is configured.
- `projectlocal.app` is verified and ready as the sending domain.
- `Project Local <notifications@projectlocal.app>` is the verified sender.
- A restricted Sending-access key scoped to `projectlocal.app` is stored only as `RESEND_API_KEY` in encrypted Vercel Production settings.
- `ASSIGNMENT_NOTIFICATION_BASE_URL=https://projectlocal.app` and the verified sender value are configured in Vercel Production.
- Open and click tracking are off.
- `ASSIGNMENT_NOTIFICATION_RECORDING_PATH` is absent.
- A direct Resend-dashboard email reached an approved Gmail inbox, proving provider/domain/sender/basic inbox delivery only.
- The dashboard test did not use Project Local's Initial email action or delivery ledger.
- `ASSIGNMENT_NOTIFICATION_EMAIL_TRANSPORT` is currently absent after a temporary no-send enablement and removal; the resulting production deployment is Ready/Latest, so application email is disabled.
- No Project Local production product data or notification-delivery row was created.

### Project Local application email proof (still required)

- Complete backup/recovery and provisioning prerequisites before creating the controlled production-data test case.
- Use the proven 12.32 safe events for claim, provider, finalization, schedule-access, and stale-delivery failures; preserve the proven 12.32.1 Vercel review workflow and the 12.33 bounded Notification Health/cadence contract below.
- Approve a test recipient and a separately reviewed app-driven test procedure.
- Only during that approved procedure, set `ASSIGNMENT_NOTIFICATION_EMAIL_TRANSPORT=resend`, redeploy, and use the real Initial email action.
- Prove the production claim/provider/finalize round trip, inbox delivery, app-generated schedule-access link, duplicate prevention, and retry/failure operations without recording secrets or raw provider payloads.
- Return the transport to empty/disabled immediately if the reviewed procedure does not authorize continued application sending.

### Operator observability (initial-beta architecture proven; production execution pending)

- Application instrumentation is proven in 12.32; do not add a telemetry key, webhook, browser tracking script, analytics, cron, or background job for this gate.
- Proven August 11, 2026: review production events in Vercel -> `project-local` -> Logs; use search, severity, route/request/environment/status filters. Review deployment/build failures in Vercel -> `project-local` -> Deployments and the selected build status/logs.
- Proven August 11, 2026: the Project Local product/operator owner owns alerts and incident response. Codex or engineering may assist without transferring ownership.
- Proven August 11, 2026: the controlled invalid-token schedule-access request returned unavailable safely, created no data or email, and exposed a searchable privacy-safe `schedule_access.exchange_failure` warning without prohibited data.
- Follow the immediate-investigation and immediate-pause policy in [`PRODUCTION_OBSERVABILITY.md`](./PRODUCTION_OBSERVABILITY.md).
- Proven in 12.33 locally and on approved staging: an authenticated, capability-gated, exactly-one-workspace stale-delivery read; the unlinked Notification Health route; and an after-batch/before-retry/end-of-active-day cadence with immediate investigation and pause-on-repeat/multiple-unresolved escalation.
- Manual notification is sufficient for the initial tiny controlled beta. Automated alerting is not required unless later scale or response performance makes the cadence inadequate.
- Still required as controlled-pilot evidence: separately review and apply migration `20260811123300` to production, then record the first production Notification Health execution. Do not treat staging proof as production execution.

## Phase G - Verification

Ask Codex or the operator to run only documented non-mutating checks first:

- Production deployment smoke:
  ```powershell
  $env:RUN_PRODUCTION_DEPLOYMENT_SMOKE_VALIDATION='project-local|https://projectlocal.app|wdlaauzknfggoqldolmx|20260714122230'
  npm run test:production-deployment-smoke
  Remove-Item Env:RUN_PRODUCTION_DEPLOYMENT_SMOKE_VALIDATION
  ```
  12.27 completion evidence records that commit `082c960` was pushed to `origin/master`, the Vercel Production deployment sourced from `082c960` reached Ready, and this final-domain smoke passed again with exit code `0`. Rerun it after future deployment, domain, Auth redirect, or production environment changes.
- Build/deployment health.
- HTTPS domain.
- Anonymous admin redirect.
- Login page.
- Auth callback.
- Invalid volunteer schedule credential safe state.
- Migration level.
- Generated type parity.
- No real email.
- No real data mutation.
- No raw errors or credentials.

Stop before real Bozeman provisioning until these checks pass.

Manual Auth evidence from 12.27 passed on the canonical origin: an existing approved Auth email received a magic link, returned through `https://projectlocal.app/admin/auth/callback`, opened the admin shell, and failed closed on persisted admin routes because no Project Local workspace/contact/grant exists yet. Do not automate production magic-link requests in routine smoke tests.

## Phase H - Before real beta data

Use [`PRODUCTION_BACKUP_RECOVERY_RUNBOOK.md`](./PRODUCTION_BACKUP_RECOVERY_RUNBOOK.md) for the backup, restore, rollback, and operational-pause evidence trail. Use [`INDEPENDENT_PRODUCTION_BACKUP_SETUP.md`](./INDEPENDENT_PRODUCTION_BACKUP_SETUP.md) for the preferred Windows-first independent backup setup.

- Review the 12.29 PowerShell automation foundation before any real Bozeman product data is provisioned.
- Create the real age key pair outside the repository.
- Store the private age recovery identity in at least two secure places.
- Use secure operator credentials or a dedicated least-privilege backup credential reviewed for this purpose.
- Run the DPAPI secret setup locally; do not paste secrets into Git, chat, screenshots, or logs.
- Completed in 12.34: the first read-only manual production backup was age-encrypted before persistence and its checksum/status/retention evidence passed.
- Store encrypted backup artifacts outside the public application repository in private independent storage.
- Completed in 12.34: safe status at `2026-08-12T17:26:46.3144615Z`, `62409` encrypted bytes, matching SHA-256, and daily/weekly recognition-based retention.
- Completed through 12.34.3: managed-role compatibility, restore-interaction attribution, deterministic source ACL reconstruction, and full independent technical recovery-forward through `20260812123430`.
- Register and prove the recurring backup schedule.
- Configure safe failure notification.
- Preserve the proven managed-role and source ACL reconstruction procedures; do not skip or remove `roles.sql`.
- Record recovery/rollback approval owner.
- Supabase Pro managed backups are optional and may be chosen later if recurring usage justifies the subscription.
- PITR is unavailable on the current Free plan and is intentionally not required for the initial Bozeman beta unless a later operational review changes that decision.
- Add a separate backup plan before any Supabase Storage objects such as volunteer photos are enabled.
- Confirm logging/alerts.
- Preserve the proven Resend provider configuration, then complete and record the still-required Project Local application-driven delivery and monitoring evidence above. Direct dashboard delivery is not a substitute for the Initial email boundary proof.
- Product-owner UI approval is complete through 12.30.1; preserve [`design/approved-project-local-ui`](./design/approved-project-local-ui/) and the six accepted desktop/390px review captures.
- Confirm controlled pilot plan.
- Keep Belgrade Sheets/App Script as the fallback.

Do not launch if any blocker remains unresolved.
