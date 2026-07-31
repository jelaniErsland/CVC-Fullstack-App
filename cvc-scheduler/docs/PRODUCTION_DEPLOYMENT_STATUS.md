# Production Deployment Status

Iteration 12.26 records the first production deployment/Auth evidence and adds a no-fixture public HTTP smoke gate.

Current status: `DEPLOYMENT EVIDENCE RECORDED; EXACT SMOKE GATE PENDING CLEAN-TREE RERUN`.

Launch conclusion: `NO-GO`.

## Approved production deployment target

- Vercel project: `project-local`
- Framework: Next.js
- Repository root directory: `cvc-scheduler`
- Production branch: `master`
- Temporary stable production origin: `https://project-local-one.vercel.app`
- Production Supabase project: `project-local-production`
- Production Supabase ref: `wdlaauzknfggoqldolmx`
- Production migration: `20260714122230`

## Confirmed operator configuration

- `ADMIN_AUTH_MODE` is enforced in Vercel Production.
- Production Supabase URL and public anon/publishable key are configured in Vercel Production only.
- `SUPABASE_SERVICE_ROLE_KEY` is absent.
- Email transport and recording transport are absent/disabled.
- Supabase Auth Site URL is `https://project-local-one.vercel.app`.
- Exact allowed Auth callback is `https://project-local-one.vercel.app/admin/auth/callback`.
- Custom domain is not connected yet.

## Manual Auth evidence

Operator evidence completed before this documentation update; manual magic-link sign-in passed:

1. `/` rendered the Project Local landing page.
2. Anonymous `/admin` redirected to `/admin/login`.
3. `/admin/login` accepted an existing approved Auth email.
4. The Supabase magic link returned through the production callback.
5. The authenticated session successfully opened the admin shell.
6. The authenticated Auth user had no Project Local workspace/contact/grant yet.
7. `/admin/calendar` and `/admin/volunteers` failed closed without displaying or allowing persisted production data.
8. `/v/access/not-a-real-token` showed the calm unavailable schedule behavior.
9. No workspace, project contact, grant, volunteer, Calendar item, assignment, delivery, or other product row was created by these checks.

This manual Auth evidence is intentionally not automated in 12.26. The smoke gate does not request magic links, create Auth users, or require Vercel/Supabase API credentials.

## Automated public smoke gate

```powershell
$env:RUN_PRODUCTION_DEPLOYMENT_SMOKE_VALIDATION='project-local|https://project-local-one.vercel.app|wdlaauzknfggoqldolmx|20260714122230'
npm run test:production-deployment-smoke
Remove-Item Env:RUN_PRODUCTION_DEPLOYMENT_SMOKE_VALIDATION
```

The gate uses public, non-authenticated, non-mutating HTTP GET requests only. It verifies the landing page, anonymous admin redirect, login page render, invalid volunteer access redirect, unauthenticated `/v/schedule` unavailable state, volunteer-route no-store/noindex/no-referrer headers, safe same-origin redirects, and absence of raw internal/credential-like details.

The gate refuses missing or mismatched opt-in, non-HTTPS or loopback origin assumptions, staging ref `kfuujcfxoayukywvtaeh`, fixture flags, enabled email/recording transport, service-role runtime configuration, and dirty worktrees for the actual production run.

During the 12.26 implementation turn, missing/wrong opt-in and dirty-worktree refusal paths passed. The same public HTTP assertions also passed against `https://project-local-one.vercel.app` through a separate non-mutating diagnostic. Because this slice adds the smoke command itself, the exact `npm run test:production-deployment-smoke` command must be rerun after this checkpoint is committed from a clean worktree.

## What remains blocking

- Final custom domain is not connected.
- Production email provider/sender/domain/deliverability is not configured.
- Production backup/restore evidence is unresolved.
- Production observability/alerts are unresolved.
- Production workspace/contact/grants are not provisioned.
- No real Bozeman data has been created.
- Product-owner/pilot launch approval remains unresolved.

The 12.25 production schema gate was the initial/bootstrap empty-production schema gate. It expected zero Auth users because it ran before manual Auth proof, and that historical evidence remains correct. After the 12.26 manual magic-link evidence, that zero-Auth invariant is no longer expected for post-deployment smoke; no Project Local product rows have been provisioned yet. Future production migrations after Auth identities or real product data exist need a separately reviewed established-production migration/schema gate that verifies the intended live before/after state instead of reusing the bootstrap zero-state assumptions.

Do not provision production data until the final custom domain path and remaining launch blockers are reviewed.
