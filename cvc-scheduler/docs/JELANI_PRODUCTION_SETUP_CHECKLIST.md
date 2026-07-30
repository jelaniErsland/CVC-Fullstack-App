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
- Add the chosen domain in the hosting platform.
- Do not configure DNS until the hosting platform tells you the exact records.
- Do not add real Bozeman data yet.

## Phase C - Values to collect

Collect these values into private operator notes or the hosting platform, not into source code:

- Supabase production project name.
- Supabase production project ref.
- Supabase production project URL.
- Supabase public anon/publishable key.
- Hosting deployment URL.
- Final production domain.
- Auth callback URL, usually `https://<final-domain>/admin/auth/callback`.

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

- Configure Supabase Auth Site URL after the final HTTPS domain is working.
- Add exact redirect URLs:
  - `https://<final-domain>/admin/auth/callback`
  - any approved preview/staging callback URLs separately.
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

## Phase H - Before real beta data

- Confirm backups and restore/rollback plan.
- Confirm logging/alerts.
- Confirm production email provider plan separately.
- Confirm product-owner UI approval.
- Confirm controlled pilot plan.
- Keep Belgrade Sheets/App Script as the fallback.

Do not launch if any blocker remains unresolved.
