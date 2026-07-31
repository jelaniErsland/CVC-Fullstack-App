# Jelani Production Setup Checklist

This checklist names the manual actions needed before Project Local can launch a Bozeman beta. It does not authorize launch by itself.

Current conclusion: `NO-GO`.

## Phase A - Decisions

- Confirm hosting platform. Current repository recommendation: Vercel.
- Confirm the final production domain or app subdomain.
- Confirm the production Supabase project name.
- Confirm owner/admin email addresses for Supabase and hosting.
- Confirm who receives launch alerts.
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
- Future email provider secrets must live only in hosting encrypted environment settings.
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
- Leave email transport disabled until the production provider slice.
- Leave recording path unset.
- Leave service-role key unset.

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

- Confirm backups and restore/rollback plan.
- Use [`PRODUCTION_BACKUP_RECOVERY_RUNBOOK.md`](./PRODUCTION_BACKUP_RECOVERY_RUNBOOK.md) to record backup availability, retention, PITR availability, restore initiation behavior, restore approval owner, post-restore verification, and incident owners.
- Confirm logging/alerts.
- Confirm production email provider plan separately.
- Confirm product-owner UI approval.
- Confirm controlled pilot plan.
- Keep Belgrade Sheets/App Script as the fallback.

Do not launch if any blocker remains unresolved.
