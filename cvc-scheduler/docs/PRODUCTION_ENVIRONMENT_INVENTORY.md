# Production Environment Inventory

This inventory is part of Iteration 12.24. It prepares production configuration without creating a production Supabase project, deploying production, configuring DNS, creating real Bozeman data, configuring a real email provider, sending email, or committing secrets.

Current launch conclusion: `NO-GO`.

Recommended host: Vercel, because this repository is a plain Next.js 16 app with server actions, route handlers, dynamic/no-store routes, HttpOnly cookies, preview deployment needs, environment-variable management, custom-domain/HTTPS support, logs, and deployment rollback needs. No `vercel.json` is required yet; no Netlify configuration exists.

## Environment separation

| Environment | Supabase | App origin | Email transport | Data policy |
| --- | --- | --- | --- | --- |
| Local | Loopback/local Supabase only | `http://127.0.0.1:3000` or `http://localhost:3000` | Recording-only for QA | Disposable fixtures only |
| Staging | `project-local-staging` (`kfuujcfxoayukywvtaeh`) validated through migration `20260714122230` | Loopback preview for hosted browser QA, or approved staging preview | Recording-only | Disposable `qa-*` fixtures only |
| Production | `project-local-production` (`wdlaauzknfggoqldolmx`) validated through migration `20260714122230` | Canonical origin `https://projectlocal.app`; temporary Vercel fallback alias `https://project-local-one.vercel.app` | Disabled until provider slice | Real Bozeman data only through reviewed operator procedures |

Production must never reuse staging project ref `kfuujcfxoayukywvtaeh`, staging Auth users, staging rows, staging notification ledger, or hosted fixture scripts.

The approved production Supabase target for the 12.25 bootstrap schema gate is `project-local-production` (`wdlaauzknfggoqldolmx`). The gate passed before Auth setup: production is migrated through `20260714122230`, generated-type parity passed, product/Auth/storage counts remained zero at that time, public Supabase connectivity passed, and structural RLS/security checks passed. After 12.26 manual Auth evidence, one or more approved Auth identities may legitimately exist; no Project Local product rows or storage objects are known to have been created by 12.26.

The approved canonical production deployment target for the 12.27 smoke gate is Vercel project `project-local` at `https://projectlocal.app`. The temporary Vercel alias `https://project-local-one.vercel.app` remains available as a fallback deployment URL. Operator evidence confirms `ADMIN_AUTH_MODE=enforced`, production Supabase public URL/key configured in Vercel Production only, `SUPABASE_SERVICE_ROLE_KEY` absent, email/recording transports absent, Supabase Auth Site URL set to `https://projectlocal.app`, exact final-domain callback `https://projectlocal.app/admin/auth/callback`, temporary Vercel callback still allowlisted for fallback, HTTPS loaded without browser warning, manual magic-link sign-in returned through the final-domain callback, and no Project Local product rows were created.

Production backup/recovery requirements are recorded in [`PRODUCTION_BACKUP_RECOVERY_RUNBOOK.md`](./PRODUCTION_BACKUP_RECOVERY_RUNBOOK.md). 12.28.1 operator dashboard evidence confirms production Supabase is on the Free plan, Supabase-managed scheduled backups are unavailable, no Supabase-managed backup timestamp/status or retention exists, PITR is unavailable and intentionally not required for the initial Bozeman beta, and Supabase-managed restore to new project requires Pro plus physical backups. Before real Bozeman data, Project Local must prove either the preferred independent encrypted logical backup path or the optional Supabase-managed Pro path. Backup artifacts must never enter the public repository, restore testing remains required, and database backups do not automatically prove Supabase Storage object recovery.

## Variable inventory

| Variable | Required | Visible | Local category | Staging category | Production category | Owner | Secret class | Restart/redeploy | Validation | Safe failure | Commit? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Required when Auth/persistence is used | Browser-visible | Local Supabase URL | Staging Supabase project URL | Production Supabase project URL | Supabase | Public, not secret | Yes | `npm run supabase:check`; production smoke test | Auth/persisted routes fail safely/unavailable | Placeholder only |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Required when Auth/persistence is used | Browser-visible | Local anon/publishable key | Staging anon/publishable key | Production anon/publishable key | Supabase | Public, not service secret | Yes | `npm run supabase:check`; generated type/migration checks | Auth/persisted routes fail safely/unavailable | Placeholder only |
| `ADMIN_AUTH_MODE` | Required in production | Server-only | `review` for mock review or `enforced` for local Auth QA | `enforced` in hosted browser gates | `enforced` | App/deployment | Non-secret | Yes | Anonymous `/admin/*` redirects to `/admin/login`; login/callback works | Configuration/login error instead of open admin | Placeholder/default only |
| `RESPONSE_LINK_BASE_URL` | Optional; diagnostic/reveal only | Server-only | Loopback only when running response-link diagnostic QA | Not used for 12.23.1; response-link activation paused | Leave unset until response-link reveal/copy is separately approved | App/operator | Non-secret origin, sensitive if wrong | Yes | Diagnostic route shows safe unavailable when unset | No response link issued | Placeholder only |
| `ASSIGNMENT_NOTIFICATION_EMAIL_TRANSPORT` | Required for email sending; disabled otherwise | Server-only | `recording` only for local QA | `recording` only for hosted QA | Empty/disabled until provider slice | App/email provider | Non-secret enum | Yes | Initial email summary shows disabled/unavailable when unset | No email sent | Placeholder/default only |
| `ASSIGNMENT_NOTIFICATION_BASE_URL` | Required only when notification transport active | Server-only | Loopback origin for recording QA | Loopback preview origin for hosted recording QA | Final HTTPS production origin after domain/Auth verification | App/operator | Non-secret origin, sensitive if wrong | Yes | Notification configuration check; smoke test must reject loopback in production | Send boundary unavailable | Placeholder only |
| `ASSIGNMENT_NOTIFICATION_FROM` | Required only when notification transport active | Server-only | Synthetic sender for recording QA | Synthetic sender for recording QA | Future verified sender identity | Email provider/operator | Sender identity, not a secret | Yes | Notification config check and provider test after provider slice | Send boundary unavailable | Placeholder only |
| `ASSIGNMENT_NOTIFICATION_RECORDING_PATH` | Required only for recording transport | Server-only | Temp path outside repo | Temp path outside repo | Must be unset; production must not use filesystem recording transport | QA only | File path; may reveal machine details | Yes | Recording tests check temp file and removal | Recording send unavailable | Never real value |
| `SUPABASE_SERVICE_ROLE_KEY` | Not currently required | Server-only | Empty | Empty in product paths; hosted QA may use CLI/operator setup outside app | Must remain unset unless future reviewed server-only need exists | Supabase/operator | Secret | Yes | Static guards; no product client consumes it | No privileged path available | Never |
| `PREVIEW_BASE_URL` | Validation-only | Script environment | Loopback preview URL | Loopback preview URL | Not a production app variable | QA | Non-secret | No app redeploy | Browser regressions refuse non-loopback where required | Browser test refuses | Never necessary |
| `PREVIEW_BROWSER_EXECUTABLE`, `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`, `CHROME_EXECUTABLE_PATH`, `MSEDGE_EXECUTABLE_PATH` | Validation-only | Script environment | Optional local browser path | Optional QA browser path | Not production app variables | QA | Local path | No | Browser regressions | Browser test skips/fails safely | Never necessary |
| Deployment platform system variables | Platform-owned | Mixed | Not relevant | Preview deployment metadata | Vercel-owned deployment metadata | Hosting platform | Some may be sensitive | Platform-specific | Hosting dashboard/build logs | Build/runtime failure | Never manually committed |

No secret may use a `NEXT_PUBLIC_` prefix. No production secret may enter Git, documentation, screenshots, logs, browser output, hosted test output, or chat transcripts.

## Production-specific requirements

- `ADMIN_AUTH_MODE=enforced`.
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` point to the approved production Supabase project, not staging.
- `ASSIGNMENT_NOTIFICATION_EMAIL_TRANSPORT` remains empty/disabled until the production email-provider slice.
- `ASSIGNMENT_NOTIFICATION_RECORDING_PATH` remains unset in production.
- `SUPABASE_SERVICE_ROLE_KEY` remains unset.
- `RESPONSE_LINK_BASE_URL` remains unset until response-link reveal/copy is separately approved.
- Final production origins must be HTTPS and non-loopback.
- Canonical production origin is `https://projectlocal.app`.
- Temporary Vercel fallback alias remains `https://project-local-one.vercel.app`.

## Validation procedure

1. Confirm production values are entered only in encrypted hosting settings.
2. Verify the deployment project does not reference staging ref `kfuujcfxoayukywvtaeh`.
3. Verify `ADMIN_AUTH_MODE=enforced`.
4. Verify no production email transport is active before the provider slice.
5. Run a read-only production smoke test only after the operator supplies the exact production project name/ref and HTTPS origin.
6. Stop on any mismatch; do not “fix” by copying staging values.

The 12.25 command remains the documented bootstrap zero-state gate:

```powershell
$env:RUN_PRODUCTION_SUPABASE_SCHEMA_VALIDATION='project-local-production:wdlaauzknfggoqldolmx'
npm run test:production-supabase-schema
Remove-Item Env:RUN_PRODUCTION_SUPABASE_SCHEMA_VALIDATION
```

Do not use the bootstrap gate as the generic established-production migration check after approved Auth identities or real product data exist. Future production migrations in an established production environment require a separately reviewed gate that verifies the intended live before/after state. After deployment, Auth, or origin changes, rerun the production deployment smoke gate:

```powershell
$env:RUN_PRODUCTION_DEPLOYMENT_SMOKE_VALIDATION='project-local|https://projectlocal.app|wdlaauzknfggoqldolmx|20260714122230'
npm run test:production-deployment-smoke
Remove-Item Env:RUN_PRODUCTION_DEPLOYMENT_SMOKE_VALIDATION
```
