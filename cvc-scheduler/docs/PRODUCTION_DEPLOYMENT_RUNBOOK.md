# Production Deployment Runbook

Iteration 12.24 prepared this runbook. Iteration 12.25 completed the production Supabase schema gate for the approved production target. Iteration 12.26 records the live Vercel production deployment at `https://project-local-one.vercel.app`, manual Auth/session evidence, and a public read-only smoke gate. Iteration 12.27 records the final production domain `https://projectlocal.app`, final-domain Auth callback evidence, and smoke-gate retargeting. Jelani explicitly product-owner approved the 12.30.1 beta-critical UI and all six desktop/390px review captures. Iteration 12.31 selects Resend and validates the server-only adapter. August 10, 2026 operator evidence proves provider/domain/sender configuration and direct provider-level Gmail inbox delivery while confirming the Project Local application transport is currently disabled. Iteration 12.32 proves the privacy-safe application observability foundation. August 11, 2026 operator evidence proves Vercel Production runtime-log review/search/filtering, deployment/build status review, named ownership/action policy, and one controlled safe event. Iteration 12.33 proves the bounded Notification Health architecture, hosted staging behavior, and manual cadence/escalation policy without accessing production. Iteration 12.34.3 proves full independent technical recovery, and staging is validated through `20260812123430`. Iteration 12.35 proves daily task registration, safe human-visible backup-failure notification, and recovery/rollback ownership; its first scheduled execution failed safely. Iteration 12.35.11 proves one successful controlled scheduled-host production backup/checksum/retention execution, and 12.35.12 safely enables the unchanged permanent task without catch-up execution. Iteration 12.36 locally proves a separate established-production gate for the exact `20260714122230` to `20260812123430` transition while preserving legitimate Auth identities and synthetic product rows; neither hosted target was contacted. Backup/recovery is complete and non-blocking. Production launch remains unavailable until the separately authorized production migration, application-driven email proof and first controlled health check, real operator provisioning, controlled pilot evidence, and explicit launch approval pass.

Iteration 12.28 adds the dedicated backup/recovery/rollback runbook: [`PRODUCTION_BACKUP_RECOVERY_RUNBOOK.md`](./PRODUCTION_BACKUP_RECOVERY_RUNBOOK.md). It documents application rollback, migration-forward recovery, operational pause, and recovery verification. Iteration 12.28.1 records production Free-plan managed-backup limitations; Supabase Pro remains optional and PITR unnecessary for the initial beta. Iteration 12.29 adds the Windows-first independent encrypted backup foundation. Iteration 12.34 proves the first independent encrypted production backup/checksum/status/retention evidence. Iterations 12.34.1 through 12.34.3 prove managed-role compatibility, restore-interaction attribution, deterministic source ACL reconstruction, and complete local recovery-forward. 12.35 proves task registration, safe notification, and ownership; 12.35.11 proves successful scheduled-host backup/checksum/retention; and 12.35.12 enables the permanent task through a harmless no-catch-up transition. Backup/recovery is complete and non-blocking.

Current launch conclusion: `NO-GO`.

## Hosting recommendation

Use Vercel for the first Project Local production deployment unless a future operator decision changes the platform.

Repository evidence:

- The app is a plain Next.js 16 application with `next build` and `next start`.
- No `vercel.json`, `netlify.toml`, or custom server exists.
- The app uses server actions, route handlers, dynamic/no-store routes, HttpOnly cookies, and Supabase Auth callback flows.
- Production does not require persistent filesystem. The only filesystem email transport is the recording QA transport and must be disabled in production.
- Vercel offers the lowest-friction Next.js compatibility, preview deployments, encrypted environment settings, custom domains/HTTPS, runtime logs, and deployment rollback for a small beta.

No hosting configuration file is required because the current Next.js defaults are sufficient and safer than ceremonial redirects/rewrites. Do not add broad caching or route rewrites for Auth, admin, `/v/access/[token]`, `/v/schedule`, or response routes.

Current production deployment evidence:

- Vercel project: `project-local`.
- Framework: Next.js.
- Repository root directory: `cvc-scheduler`.
- Production branch: `master`.
- Canonical production origin: `https://projectlocal.app`.
- Temporary Vercel fallback alias: `https://project-local-one.vercel.app`.
- Deployment status: live and Ready by operator evidence.
- Custom domain: connected; HTTPS loaded without a browser warning by operator evidence.

## Production Supabase operator plan

The approved production Supabase target for the 12.25 schema gate is `project-local-production` (`wdlaauzknfggoqldolmx`). Do not create the project from tests or migrations. Jelani/operator performs or verifies:

1. Open Supabase.
2. Create or verify the new project named `project-local-production`.
3. Select the correct organization/account.
4. Choose a strong database password and store it in a password manager.
5. Select the closest appropriate region for Bozeman beta users.
6. Wait for the project to become healthy.
7. Record the production project name and ref in private operator notes; the reviewed 12.25 target is `project-local-production` / `wdlaauzknfggoqldolmx`.
8. Copy the project URL.
9. Copy the public anon/publishable key.
10. Do not expose or use the service-role key in the application.
11. Current Supabase Auth Site URL is `https://projectlocal.app`.
12. Current exact final-domain redirect URL is `https://projectlocal.app/admin/auth/callback`.
13. Temporary Vercel callback `https://project-local-one.vercel.app/admin/auth/callback` remains allowlisted for fallback.
14. Keep unknown public users unable to create project-contact access; the app uses invite-only behavior and database grants.
15. At least one approved production Auth identity now exists and passed the 12.26 magic-link proof. Create additional approved project-contact Auth identities only when needed; an Auth identity alone grants no Project Local access because contact and workspace grant provisioning remains separate.
16. Apply reviewed committed migrations in order.
17. Confirm final migration level `20260714122230` or later reviewed level.
18. Regenerate/compare public-schema types.
19. Verify RLS/Auth before adding real data.
20. Verify backups and retention.
21. Record safe public values in the production environment inventory; never commit secrets.

Creating an Auth user does not grant app access. Application access requires a `project_contacts` row plus an effective `workspace_contact_grants` row with explicit capabilities.

## Production migration plan

Expected current terminal migration: `20260714122230`.

Pending reviewed chain: `20260811123300` then `20260812123430`, with no later migration included. Production remains unapplied at `20260714122230`.

Forbidden hosted target: `project-local-staging` / `kfuujcfxoayukywvtaeh`.

The future production procedure must use the separate established-production gate in three explicit modes. It must begin from a clean committed worktree, exact healthy production link, disabled application email, absent service-role application configuration, and exact current migration history. It allows legitimate Auth identities, requires the currently expected pre-provisioning Project Local row state, creates no fixtures, and compares Auth/product/storage state around the mutation.

12.36 proves the complete local transition from exactly `20260714122230`: one synthetic Auth identity and a minimal workspace/contact/grant fixture survived both migrations unchanged; generated public-schema types, Notification Health behavior, exact direct/default privileges, all-table RLS, the exact four-table FORCE RLS set, owner/service-role posture, and a rolled-back future-table probe passed. Approved staging already has equivalent post-state evidence through `20260812123430`; staging was not contacted in 12.36.

12.25 completed the exact-target initial/bootstrap empty-production schema command. Production advanced from a clean initial migration state to `20260714122230`; generated-type parity, empty product/Auth/storage counts, public Supabase connectivity, and structural RLS/security checks passed before Auth setup. Preserve that evidence, but do not rerun or treat the command as a generic live-production migration gate after approved Auth identities or real product data exist.

```powershell
$env:RUN_PRODUCTION_SUPABASE_SCHEMA_VALIDATION='project-local-production:wdlaauzknfggoqldolmx'
npm run test:production-supabase-schema
Remove-Item Env:RUN_PRODUCTION_SUPABASE_SCHEMA_VALIDATION
```

The historical command refuses staging, wrong project identity, fixture flags, enabled email transport, service-role runtime configuration, and uncommitted worktrees. It verifies bootstrap zero-state assumptions that are no longer valid after approved Auth setup.

After 12.26 manual Auth evidence, one or more approved Auth identities may legitimately exist. `npm run test:production-established-schema` is the local-only 12.36 regression for that lifecycle; it starts and removes a disposable local stack and cannot accept production target arguments.

Future production execution requires separate authorization. The exact commands are documented now for review and must not be run merely because they exist:

```powershell
$before = '20260714122230'
$after = '20260812123430'
$target = 'project-local-production'
$ref = 'wdlaauzknfggoqldolmx'

$env:RUN_ESTABLISHED_PRODUCTION_SCHEMA_GATE="$target`:$ref`:production-preflight`:$before`:$after"
npm run gate:production-established-schema -- --mode production-preflight --project-name $target --project-ref $ref --expected-before $before --expected-after $after
Remove-Item Env:RUN_ESTABLISHED_PRODUCTION_SCHEMA_GATE

# Only after a separately reviewed recent-backup check and after the permanent task is disabled:
$env:RUN_ESTABLISHED_PRODUCTION_SCHEMA_GATE="$target`:$ref`:production-apply`:$before`:$after"
$env:RUN_ESTABLISHED_PRODUCTION_BACKUP_WINDOW="$target`:task-disabled`:$before`:$after"
npm run gate:production-established-schema -- --mode production-apply --project-name $target --project-ref $ref --expected-before $before --expected-after $after
Remove-Item Env:RUN_ESTABLISHED_PRODUCTION_BACKUP_WINDOW
Remove-Item Env:RUN_ESTABLISHED_PRODUCTION_SCHEMA_GATE

$env:RUN_ESTABLISHED_PRODUCTION_SCHEMA_GATE="$target`:$ref`:production-postflight`:$before`:$after"
npm run gate:production-established-schema -- --mode production-postflight --project-name $target --project-ref $ref --expected-before $before --expected-after $after
Remove-Item Env:RUN_ESTABLISHED_PRODUCTION_SCHEMA_GATE
```

The apply mode independently repeats the exact baseline, zero-fixture, product-state, security, and two-file dry-run checks before mutation; it also verifies that the permanent backup task is disabled, not running, and still locked to `20260714122230`. It applies only the exact two reviewed migrations and then verifies migration history, Auth/product/storage preservation, types, Notification Health metadata, direct/default privileges, RLS/FORCE RLS, and owner/platform behavior.

The current permanent task remains enabled/Ready and locked to `20260714122230`; 12.36 did not change it. That lock will intentionally fail after production advances. A separately authorized migration window must:

1. Verify a recent successful encrypted backup/status before mutation.
2. Disable the task with its current `20260714122230` lock and verify it is not running.
3. Run the reviewed preflight, apply, and postflight commands above.
4. Update only the task action's lock with `Register-ProjectLocalBackupTask.ps1 -Action UpdateExpectedMigration -ConfirmTaskAction -CurrentExpectedMigration 20260714122230 -ExpectedMigration 20260812123430`.
5. Compare action, principal, trigger, settings, notification, destination, and secret-free argument metadata; only the expected-migration value may differ.
6. Re-enable with `-Action Enable -ConfirmTaskAction -ExpectedMigration 20260812123430`, without manually starting a backup.
7. Leave the task Ready for its next normal run and require that run to prove the new lock.

Do not rewrite applied migration history, copy staging data, or repair a post-application defect by down-migrating; use a reviewed forward migration. Do not run hosted disposable fixture scripts against production.

## Auth URL and redirect plan

Current callback route: `/admin/auth/callback`.

Local allowed callback URLs:

- `http://localhost:3000/admin/auth/callback`
- `http://127.0.0.1:3000/admin/auth/callback`

Preview/staging:

- Add exact preview/staging callback URLs only for approved non-production deployments.
- Avoid broad wildcard redirects unless the hosting/Auth operator explicitly accepts the risk and verifies they cannot capture untrusted domains.

Production:

- Site URL: `https://projectlocal.app`.
- Redirect URL: `https://projectlocal.app/admin/auth/callback`.
- Temporary fallback redirect: `https://project-local-one.vercel.app/admin/auth/callback`.
- Do not loosen app callback validation to guess domains.

The callback sanitizes `next` to local `/admin` paths and rejects `/admin/auth`, `/admin/login`, protocol-relative, and non-admin return paths. `ADMIN_AUTH_MODE=enforced` is required for production admin routes. Manual 12.27 operator evidence confirms magic-link sign-in returned through `https://projectlocal.app/admin/auth/callback`, opened the admin shell, and failed closed on no-workspace/no-grant Calendar and Volunteers routes.

## Domain and DNS plan

The canonical production domain is `https://projectlocal.app`.

Jelani/operator must still record private ownership/operations details:

- Registrar/DNS provider.
- Canonical host behavior for any `www` alias.
- Whether `www` redirects to root or root redirects to `www`.

Checklist:

1. Keep canonical production URL `https://projectlocal.app`.
2. Keep the domain connected in Vercel.
3. Keep only hosting-platform DNS records provided by Vercel.
4. Monitor DNS propagation and certificate status if records change.
5. Verify HTTPS certificate issuance after any DNS/domain change.
6. Verify the deployed origin before changing Supabase Auth.
7. Keep Supabase Site URL and redirect allowlist aligned with the canonical origin.
8. Preserve the exact Resend-supplied email DNS records that produced the August 10 verified/ready `projectlocal.app` domain state; review any later email DNS change separately.
9. Roll back DNS by reverting records or detaching the domain in the hosting platform if needed.

If a `.app` domain is chosen, HTTPS is mandatory by browser policy; Vercel-managed HTTPS should satisfy this after certificate issuance.

## Resend readiness and controlled application-proof plan

Iteration 12.31 completes application integration. August 10, 2026 operator evidence proves the following provider prerequisites:

1. The Resend account is configured.
2. `projectlocal.app` is verified and ready as the sending domain.
3. `Project Local <notifications@projectlocal.app>` is the verified sender.
4. A restricted Sending-access key scoped to `projectlocal.app` is stored only as `RESEND_API_KEY` in Vercel encrypted Production settings; never use a `NEXT_PUBLIC_` name.
5. `ASSIGNMENT_NOTIFICATION_BASE_URL=https://projectlocal.app` and the verified sender are configured in Vercel Production.
6. `ASSIGNMENT_NOTIFICATION_RECORDING_PATH` is absent.
7. Resend open and click tracking are disabled.
8. A direct Resend-dashboard message reached an approved Gmail inbox, proving provider/domain/sender/basic inbox deliverability only.

The direct dashboard test did not use Project Local's Initial email action, authoritative delivery ledger, schedule-access handoff, duplicate prevention, or retry/failure operations. The application transport was temporarily enabled only after provider readiness; no Project Local assignment email was sent. The transport was then removed, Vercel redeployed, and the resulting `https://projectlocal.app` deployment is Ready/Latest. `ASSIGNMENT_NOTIFICATION_EMAIL_TRANSPORT` is currently absent, so Project Local application email is disabled.

Before the Initial Assignment Email launch gate can pass, Jelani/operator must:

1. Complete the reviewed backup/recovery prerequisites and permit the narrow production-data fixture through the real Bozeman provisioning/pilot process.
2. Configure credential-free failure visibility for claim, provider delivery, schedule access, ledger finalization, and stale `sending` rows.
3. Approve a narrow test recipient and explicit app-driven procedure.
4. Only for that reviewed procedure, set `ASSIGNMENT_NOTIFICATION_EMAIL_TRANSPORT=resend` and redeploy.
5. Use Project Local's real Initial email action and confirm the production ledger claim/provider/finalize round trip, inbox placement, app-generated schedule-link behavior, safe provider message-id persistence, duplicate prevention, and failure/retry operations without logging the recipient, bearer, full URL, API key, authorization header, or raw provider body.
6. Keep or remove the transport only according to the reviewed procedure; on any failure or absent continued-send approval, restore it to empty/disabled and redeploy.

The database delivery ledger remains the authoritative duplicate-send boundary; Resend's deterministic idempotency header is defense in depth and has a provider-documented 24-hour window.

## Initial deployment plan

1. Connect GitHub repository `jelaniErsland/CVC-Fullstack-App` to Vercel.
2. Select the intended production branch.
3. Use Next.js defaults: install command from package manager, build command `npm run build`.
4. Add production environment variables from `docs/PRODUCTION_ENVIRONMENT_INVENTORY.md`.
5. Keep application email transport disabled until the separately reviewed controlled application-proof prerequisites are complete.
6. Deploy only after production Supabase schema is ready.
7. Keep the deployment operationally unused until final-domain smoke, email, rollback, and UI review pass.

Do not call deployment successful merely because build passed.

## Verification checklist

- Build succeeds.
- HTTPS origin works.
- Anonymous `/admin/*` redirects to `/admin/login`.
- `/admin/login` renders.
- `/admin/auth/callback` is listed in Supabase redirects.
- Invalid `/v/access/not-a-real-token` reaches safe unavailable schedule behavior.
- `/v/schedule` is no-store/noindex/no-referrer and does not leak data without a valid cookie.
- `/admin/calendar` and `/admin/volunteers` show authorized empty states only after a real approved contact/grant exists.
- No real email is sent.
- Email transport is disabled.
- No real Bozeman data exists until operator provisioning.
- No raw Supabase/provider errors, stack traces with secrets, credentials, grants, or capability arrays render.
- No product service-role path is configured.

## Rollback plan

- Roll back to a previous Vercel deployment.
- Disable/detach custom domain if necessary.
- Revoke or expire production workspace grants to pause access.
- Disable email transport.
- Do not casually delete production data.
- Preserve migration history; prefer forward fixes.
- Keep staging independent.
- Keep Belgrade Sheets/App Script operational as fallback.

## Security headers and cache review

Current repository behavior:

- `proxy.ts` sets `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`, and `Referrer-Policy: no-referrer` for `/v/access/*` and `/v/schedule`.
- `/v/access/[token]` is dynamic/no-store and redirects to `/v/schedule` with an HttpOnly SameSite=Lax cookie.
- `/v/schedule` is dynamic/no-store with noindex/no-referrer metadata.
- Auth callback and admin routes are dynamic/server-owned where needed.

Do not add broad CSP or HSTS in 12.24. Add HSTS only after the stable HTTPS production domain is confirmed. Do not add analytics or third-party scripts in this slice. If security headers are later added, validate Calendar, Volunteers, Supabase Auth, and volunteer schedule routes before launch.

## Logging and observability

12.32 application instrumentation is proven. August 11, 2026 operator evidence proves that its structured events reach Vercel Production Logs and can be searched and filtered. Runtime review is Vercel -> `project-local` -> Logs; deployment/build review is Vercel -> `project-local` -> Deployments and the selected deployment's build status/logs. The stable event model, privacy denylist, assignment-email stages, non-mutating stale detector, action policy, and remaining operator gate are canonical in [`PRODUCTION_OBSERVABILITY.md`](./PRODUCTION_OBSERVABILITY.md). Structured events contain only catalogued fields; logging failure cannot change a mutation or delivery outcome.

The Project Local product/operator owner is the primary alert and incident-response owner. The owner investigates fatal events, repeated errors, repeated beta-critical failures that impede normal operation, and—after application email is later enabled—any assignment-email provider/finalization failure. Pause affected operations for cross-workspace or wrong-volunteer exposure, secret/full-URL leakage, duplicate external assignment email, corrupted Confirm/Deny truth, unrecoverable production mutation, or provider/security misconfiguration. Codex or engineering assistance may be used without transferring operational ownership.

The controlled `https://projectlocal.app/v/access/not-a-real-token` request returned the expected unavailable behavior, created no data, sent no email, and produced a searchable privacy-safe `schedule_access.exchange_failure` warning in Vercel Production Logs.

Minimum production signals:

- Deployment/build failure.
- Server/runtime failure.
- Auth callback/sign-in failure.
- Calendar mutation failure.
- Volunteer Add/Edit failure.
- Assignment mutation failure.
- Publication failure.
- Volunteer schedule-access failure.
- Confirm/Deny failure.
- Initial email claim failure, provider delivery failure, and delivery-ledger finalization failure as distinct credential-free stages.
- Stale notification delivery rows.
- Unexpected server errors.

Safe logging rules:

- No bearer token.
- No full schedule URL.
- No verifier/hash.
- No access or refresh token.
- No session cookie.
- No password.
- No provider secret.
- No raw provider payload.
- No raw SQL.
- No grants or capability arrays.
- No questionnaire answers or emergency-contact data.
- No raw stack trace containing environment values.

Application observability plus runtime/deployment visibility, ownership, action-policy, controlled-event proof, and the 12.33 operator Notification Health architecture are proven. The bounded read and manual after-batch/before-retry/end-of-active-day cadence passed locally and on approved staging through `20260812123430`; repeated or multiple unresolved stale rows pause sending. That manual mechanism is sufficient for the initial tiny controlled beta, so automated alert delivery is not required. Production execution is not yet proven: apply `20260811123300` and `20260812123430` only through separate production review and record the first Notification Health check during the controlled pilot.

## Backup and recovery

Detailed recovery requirements are recorded in [`PRODUCTION_BACKUP_RECOVERY_RUNBOOK.md`](./PRODUCTION_BACKUP_RECOVERY_RUNBOOK.md).

The preferred independent encrypted backup and full technical recovery path, successful scheduled-host backup/checksum/retention execution, enabled recurring task, safe human-confirmed failure notification, and recovery/rollback ownership are proven. Preserve that path and its operator procedure before and during real Bozeman provisioning. The Supabase-managed Pro path remains optional.

For the preferred independent path:

- Preserve the registered recurring task and prove one successful logical PostgreSQL execution after the migration-preflight failure is diagnosed and separately authorized.
- Use reviewed secure operator credentials or a dedicated least-privilege backup credential.
- Encrypt every backup before persistent storage.
- Store backup artifacts outside the public repository in private independent storage.
- Record backup timestamp, size, checksum/integrity result, and success/failure state without exposing contents.
- Record retention.
- Preserve the proven safe failure notification and credential-free status records.
- Preserve and periodically repeat the proven disposable recovery drill after material backup, migration, or privilege-contract changes.

For the optional Supabase-managed path:

- Upgrade to Supabase Pro only if the operator chooses this path.
- Confirm managed scheduled/physical backups.
- Record retention and successful backup evidence.
- Complete an approved restore test.

For both paths:

- Manual export expectations for pilot data.
- Restore decision owner.
- How to pause beta by revoking grants.
- How to disable email.
- How to roll back app deployment.
- Why migration rollback should generally be forward-fix based.
- Why deleting real records is not normal rollback.
- Belgrade fallback remains intact.

PITR is unavailable on the current Free plan and is intentionally not required for the initial Bozeman beta unless a later operational review changes that decision. Database backups do not automatically prove Supabase Storage object recovery; add a separate storage backup plan before enabling Storage-backed features such as volunteer photos.

## Read-only production smoke test

12.27 retargets the read-only production smoke test as a public HTTP-only production smoke test against the canonical origin `https://projectlocal.app`:

```powershell
$env:RUN_PRODUCTION_DEPLOYMENT_SMOKE_VALIDATION='project-local|https://projectlocal.app|wdlaauzknfggoqldolmx|20260714122230'
npm run test:production-deployment-smoke
Remove-Item Env:RUN_PRODUCTION_DEPLOYMENT_SMOKE_VALIDATION
```

The command refuses unless:

- Operator explicitly opts in.
- Production Vercel project/origin/Supabase ref/migration are exact.
- Target ref is not `kfuujcfxoayukywvtaeh`.
- Origin is HTTPS, non-loopback, and the approved canonical production origin.
- Email transport is disabled.
- Fixture creation is not enabled.
- Service-role runtime configuration is absent.
- The worktree is clean.

The smoke test is read-only and proves:

- Landing page.
- Anonymous admin redirect.
- Login page.
- Invalid volunteer credential unavailable state.
- `/v/schedule` without a valid cookie exposes no schedule/private data.
- Volunteer credential routes preserve no-store/noindex/no-referrer protections.
- Redirects remain on the approved origin.
- No raw errors.
- No real email.
- No data mutation.

Manual Auth/session evidence is recorded in `docs/PRODUCTION_DEPLOYMENT_STATUS.md`. The temporary Vercel origin remains available as a fallback deployment alias, but it is no longer the canonical smoke-test origin. Do not automate production magic-link requests in this gate.
