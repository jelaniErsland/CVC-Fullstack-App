# Production Supabase Status

Iteration 12.25 added the production Supabase schema gate and completed the first production schema migration/type-parity/read-only validation against the approved production target.

Iteration 12.25.1 stabilizes the gate for a completely pristine Supabase project by treating a missing `supabase_migrations.schema_migrations` table as an explicit clean initial state only after the exact target and environment guards have passed. Actual migration-history query failures and malformed or unexpected remote history still fail closed.

Current status: `SCHEMA VALIDATED`.

Launch conclusion: `NO-GO`.

## Approved production target

- Project name: `project-local-production`
- Project ref: `wdlaauzknfggoqldolmx`
- Forbidden staging ref: `kfuujcfxoayukywvtaeh`
- Expected terminal migration: `20260714122230`

## Bootstrap gate command

```powershell
$env:RUN_PRODUCTION_SUPABASE_SCHEMA_VALIDATION='project-local-production:wdlaauzknfggoqldolmx'
npm run test:production-supabase-schema
Remove-Item Env:RUN_PRODUCTION_SUPABASE_SCHEMA_VALIDATION
```

The command is intentionally exact-target locked and must refuse missing/wrong opt-in, staging ref, fixture flags, enabled email transport, service-role application configuration, and uncommitted worktree state.

This is the initial/bootstrap empty-production schema gate. It was designed to prove a pristine production database before Auth setup or real operator provisioning, including zero product rows, zero Auth users, and zero storage objects. That historical 12.25 evidence remains valid. After 12.26 manual Auth proof, one or more approved Auth identities may legitimately exist, so this bootstrap zero-state gate is not the generic established-production migration gate. Future production migrations after Auth identities or real product data exist require a separately reviewed established-production migration/schema gate that verifies the intended live before/after state without requiring zero Auth users.

## Current validation state

| Check | Status |
| --- | --- |
| Production project name/ref independently discovered | Passed: `project-local-production` / `wdlaauzknfggoqldolmx` |
| Project health | Passed: `ACTIVE_HEALTHY` |
| Migration level before | Passed: clean initial state before migration application |
| Migration application through `20260714122230` | Passed: reviewed committed migrations only; no seeds or roles |
| Migration level after | Passed: `20260714122230` |
| Generated public-schema type parity | Passed |
| Product application table counts | Passed: `0` rows |
| Auth user count | Passed as `0` during 12.25 schema gate before manual Auth evidence; no longer assumed zero after 12.26 manual approved Auth sign-in |
| Storage object count | Passed: `0` objects |
| RLS/security structural proof | Passed: 13 RLS-protected product tables; 0 broad direct mutation grants |
| Public Supabase endpoint connectivity proof | Passed: Auth health endpoint HTTP 200 using anon/publishable key without creating a user |
| App deployment smoke test | Passed: canonical origin `https://projectlocal.app`; commit `082c960` was pushed to `origin/master`, Vercel Production deployment sourced from `082c960` reached Ready, and the exact final-domain production deployment smoke passed after deployment with exit code `0`; this was public HTTP-only and did not perform database validation or mutation |
| Backup verification | Unresolved operator requirement |
| Email provider | Disabled/unconfigured |
| Vercel deployment | Live: Vercel project `project-local` at canonical origin `https://projectlocal.app`; temporary Vercel fallback alias `https://project-local-one.vercel.app` remains available |
| Final-domain Auth URLs | Configured: Site URL `https://projectlocal.app`; callback `https://projectlocal.app/admin/auth/callback`; manual magic-link/Auth session evidence passed |
| Temporary Vercel Auth callback | Still allowlisted for fallback: `https://project-local-one.vercel.app/admin/auth/callback` |
| Real Bozeman data | Not created |

## Safety boundaries

Backup, restore, and rollback readiness is now documented in [`PRODUCTION_BACKUP_RECOVERY_RUNBOOK.md`](./PRODUCTION_BACKUP_RECOVERY_RUNBOOK.md). This status remains unresolved until Jelani supplies actual production Supabase dashboard evidence for backup availability, retention, point-in-time recovery availability, restore initiation behavior, restore ownership, and restore-test evidence.

This gate may apply reviewed committed migrations only. It must not create fixtures, Auth users, workspaces, contacts, volunteers, task presets, Calendar items, assignments, response rows, tokens, notification deliveries, storage objects, real Bozeman data, or Belgrade data.

It must not run hosted staging fixture gates against production. It must not configure or send email. It must not add service-role runtime behavior. It must not activate response-link reveal/copy.

## 12.25 production result

The first exact production gate run correctly refused execution while the repository was linked to staging. The CLI was then linked to the approved production ref, the migration dry-run showed only reviewed committed migrations through `20260714122230` with no seeds or roles, those migrations were applied, and the committed gate passed after migration. The local production CLI link was removed afterward so future commands do not inherit production as the linked target.

No fixtures, Auth users, product rows, storage objects, real Bozeman data, email transport, real email, Vercel deployment, DNS change, Auth redirect change, service-role runtime path, response-link reveal/copy activation, seed data, or staging mutation was used.

## 12.25.1 stabilization result

The pristine migration-history edge case is covered by `npm run test:production-supabase-schema:pristine`. Before 12.26 manual Auth evidence, the already-migrated approved production target was also revalidated read-only at `20260714122230`; generated-type parity, empty product/Auth/storage counts, public Supabase connectivity, and structural RLS/security checks still passed. The local production CLI link was removed afterward.

## 12.26 Auth evidence note

12.26 manual operator evidence used an existing approved Auth email to complete the production magic-link callback. 12.27 confirms the same manual Auth boundary on canonical origin `https://projectlocal.app` with final-domain callback `https://projectlocal.app/admin/auth/callback`; the temporary Vercel callback remains allowlisted for fallback. After that point, the 12.25 schema gate's original zero-Auth-user invariant is no longer the correct post-Auth deployment smoke check. Production product rows, storage objects, email, service-role application behavior, and response-link reveal/copy remain unchanged by the public smoke work. Use `npm run test:production-deployment-smoke` for the post-deployment public route check, and rerun/adjust schema validation only when the intended Auth-user state is explicitly part of the reviewed gate.
