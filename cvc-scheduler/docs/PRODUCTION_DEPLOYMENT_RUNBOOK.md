# Production Deployment Runbook

Iteration 12.24 prepared this runbook. Iteration 12.25 completed the production Supabase schema gate for the approved production target. Iteration 12.26 records the live Vercel production deployment at `https://project-local-one.vercel.app`, manual Auth/session evidence, and a public read-only smoke gate. Production launch remains unavailable until the final custom domain, email, backup/restore, observability, operator provisioning, UI approval, and pilot gates pass.

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
- Temporary stable production origin: `https://project-local-one.vercel.app`.
- Deployment status: live and Ready by operator evidence.
- Custom domain: not connected yet.

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
11. Current temporary Auth Site URL is `https://project-local-one.vercel.app`.
12. Current exact allowed redirect URL is `https://project-local-one.vercel.app/admin/auth/callback`.
13. Reconfigure Auth Site URL and exact allowed redirect URLs after the final HTTPS domain is ready.
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

Procedure:

1. Verify the local migration list from `supabase/migrations`.
2. Verify the target project name/ref is the production project and is not `project-local-staging` / `kfuujcfxoayukywvtaeh`.
3. Verify the project is healthy.
4. Apply only reviewed committed migrations.
5. Confirm the final migration level.
6. Generate hosted public-schema types with the established UTF-8-safe workflow.
7. Compare generated types to `lib/supabase/database.types.ts`.
8. Stop on mismatch.
9. Do not rewrite applied migration history.
10. If a production-specific defect is found after a migration is applied, add a forward migration.
11. Do not copy staging data into production.
12. Do not run hosted disposable fixture scripts against production.
13. Verify production tables contain no real Bozeman data after schema setup until operator provisioning begins.

12.25 completed the exact-target initial/bootstrap empty-production schema command. Production advanced from a clean initial migration state to `20260714122230`; generated-type parity, empty product/Auth/storage counts, public Supabase connectivity, and structural RLS/security checks passed before Auth setup. Preserve that evidence, but do not treat the command as a generic live-production migration gate after approved Auth identities or real product data exist.

```powershell
$env:RUN_PRODUCTION_SUPABASE_SCHEMA_VALIDATION='project-local-production:wdlaauzknfggoqldolmx'
npm run test:production-supabase-schema
Remove-Item Env:RUN_PRODUCTION_SUPABASE_SCHEMA_VALIDATION
```

The command refuses staging, wrong project identity, fixture flags, enabled email transport, service-role runtime configuration, and uncommitted worktrees. It applies only reviewed committed migrations to the expected production database, compares generated public-schema types, checks read-only structural security and public Supabase connectivity, and verifies the bootstrap zero-state assumptions.

After 12.26 manual Auth evidence, one or more approved Auth identities may legitimately exist. Future production migrations after Auth identities or real product data exist require a separately reviewed established-production migration/schema gate that accounts for the intended live state, verifies safe before/after behavior, and does not require zero Auth users.

## Auth URL and redirect plan

Current callback route: `/admin/auth/callback`.

Local allowed callback URLs:

- `http://localhost:3000/admin/auth/callback`
- `http://127.0.0.1:3000/admin/auth/callback`

Preview/staging:

- Add exact preview/staging callback URLs only for approved non-production deployments.
- Avoid broad wildcard redirects unless the hosting/Auth operator explicitly accepts the risk and verifies they cannot capture untrusted domains.

Production:

- Site URL: final HTTPS origin, for example `https://<final-domain>`.
- Redirect URL: `https://<final-domain>/admin/auth/callback`.
- Use placeholders until the final domain is chosen; do not loosen app callback validation to guess domains.

The callback sanitizes `next` to local `/admin` paths and rejects `/admin/auth`, `/admin/login`, protocol-relative, and non-admin return paths. `ADMIN_AUTH_MODE=enforced` is required for production admin routes. Test sign-in with an approved Auth user that has no workspace grants first, then revoke/disable the test identity if not needed.

## Domain and DNS plan

The repository does not confirm a final production domain or registrar.

Jelani/operator must decide:

- Registrar/DNS provider.
- Canonical host: root, `www`, or app subdomain.
- Recommended beta-safe pattern: a dedicated app subdomain or a final root domain once ownership is clear.
- Whether `www` redirects to root or root redirects to `www`.

Checklist:

1. Choose canonical production URL.
2. Connect domain in Vercel.
3. Add only hosting-platform DNS records provided by Vercel.
4. Wait for DNS propagation; timing varies.
5. Verify HTTPS certificate issuance.
6. Verify the deployed origin before configuring Supabase Auth.
7. Configure Supabase Site URL and redirect allowlist.
8. Keep future email DNS records (SPF/DKIM/DMARC) for the email-provider slice; do not add them in 12.24.
9. Roll back DNS by reverting records or detaching the domain in the hosting platform if needed.

If a `.app` domain is chosen, HTTPS is mandatory by browser policy; Vercel-managed HTTPS should satisfy this after certificate issuance.

## Initial deployment plan

1. Connect GitHub repository `jelaniErsland/CVC-Fullstack-App` to Vercel.
2. Select the intended production branch.
3. Use Next.js defaults: install command from package manager, build command `npm run build`.
4. Add production environment variables from `docs/PRODUCTION_ENVIRONMENT_INVENTORY.md`.
5. Keep email transport disabled.
6. Deploy only after production Supabase schema is ready.
7. Keep the deployment operationally unused until final domain/Auth, email, smoke tests, rollback, and UI review pass.

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
- Initial email claim/finalize failure.
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

Observability remains `configuration_required` until production ownership and alerting are configured.

## Backup and recovery

Before launch, verify:

- Supabase backup availability.
- Retention period.
- Point-in-time recovery availability for the selected plan, if applicable.
- Manual export expectations for pilot data.
- Restore test plan.
- Restore decision owner.
- How to pause beta by revoking grants.
- How to disable email.
- How to roll back app deployment.
- Why migration rollback should generally be forward-fix based.
- Why deleting real records is not normal rollback.
- Belgrade fallback remains intact.

Backup readiness cannot be claimed until the production project and plan are known.

## Read-only production smoke test

12.26 adds the read-only production smoke test as a public HTTP-only production smoke test against `https://project-local-one.vercel.app`:

```powershell
$env:RUN_PRODUCTION_DEPLOYMENT_SMOKE_VALIDATION='project-local|https://project-local-one.vercel.app|wdlaauzknfggoqldolmx|20260714122230'
npm run test:production-deployment-smoke
Remove-Item Env:RUN_PRODUCTION_DEPLOYMENT_SMOKE_VALIDATION
```

The command refuses unless:

- Operator explicitly opts in.
- Production Vercel project/origin/Supabase ref/migration are exact.
- Target ref is not `kfuujcfxoayukywvtaeh`.
- Origin is HTTPS, non-loopback, and the approved stable Vercel origin.
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

Manual Auth/session evidence is recorded in `docs/PRODUCTION_DEPLOYMENT_STATUS.md`. Do not automate production magic-link requests in this gate.
