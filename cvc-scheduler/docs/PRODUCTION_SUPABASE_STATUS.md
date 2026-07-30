# Production Supabase Status

Iteration 12.25 adds the production Supabase schema gate and records the approved target. The actual production migration operation must be run only from a clean committed worktree with the exact opt-in below.

Current status: `PENDING PRODUCTION EXECUTION`.

Launch conclusion: `NO-GO`.

## Approved production target

- Project name: `project-local-production`
- Project ref: `wdlaauzknfggoqldolmx`
- Forbidden staging ref: `kfuujcfxoayukywvtaeh`
- Expected terminal migration: `20260714122230`

## Gate command

```powershell
$env:RUN_PRODUCTION_SUPABASE_SCHEMA_VALIDATION='project-local-production:wdlaauzknfggoqldolmx'
npm run test:production-supabase-schema
Remove-Item Env:RUN_PRODUCTION_SUPABASE_SCHEMA_VALIDATION
```

The command is intentionally exact-target locked and must refuse missing/wrong opt-in, staging ref, fixture flags, enabled email transport, service-role application configuration, and uncommitted worktree state.

## Current validation state

| Check | Status |
| --- | --- |
| Production project name/ref independently discovered | Pending production gate execution |
| Project health | Pending production gate execution |
| Migration level before | Pending production gate execution |
| Migration application through `20260714122230` | Pending production gate execution |
| Migration level after | Pending production gate execution |
| Generated public-schema type parity | Pending production gate execution |
| Product application table counts | Pending production gate execution |
| Auth user count | Pending production gate execution |
| Storage object count | Pending production gate execution |
| RLS/security structural proof | Pending production gate execution |
| Public Supabase endpoint connectivity proof | Pending production gate execution |
| App deployment smoke test | Pending future read-only smoke test |
| Backup verification | Unresolved operator requirement |
| Email provider | Disabled/unconfigured |
| Vercel deployment | Not configured |
| DNS/Auth redirects | Not configured |
| Real Bozeman data | Not created |

## Safety boundaries

This gate may apply reviewed committed migrations only. It must not create fixtures, Auth users, workspaces, contacts, volunteers, task presets, Calendar items, assignments, response rows, tokens, notification deliveries, storage objects, real Bozeman data, or Belgrade data.

It must not run hosted staging fixture gates against production. It must not configure or send email. It must not add service-role runtime behavior. It must not activate response-link reveal/copy.

## Reason this status remains pending

The production schema gate was added in repository code during 12.25. Because the gate itself must refuse actual production execution from an uncommitted worktree, the production migration operation must wait until this 12.25 checkpoint is committed and the command is rerun from a clean tree.
