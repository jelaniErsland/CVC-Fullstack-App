# Production Backup, Recovery, and Rollback Runbook

Iteration 12.28 defines Project Local's production backup, recovery, rollback, and operational-pause boundaries before any real Bozeman workspace or product data is provisioned.

Current status: `RECOVERY READINESS INCOMPLETE`.

Launch conclusion: `NO-GO`.

## Verified production baseline

- Canonical production origin: `https://projectlocal.app`
- Temporary Vercel fallback alias: `https://project-local-one.vercel.app`
- Vercel project: `project-local`
- Production branch: `master`
- Verified deployed commit: `082c960`
- Production Supabase project: `project-local-production`
- Production Supabase ref: `wdlaauzknfggoqldolmx`
- Production migration: `20260714122230`
- Production Auth: enforced
- Email transport: disabled
- Real Project Local product data: not provisioned
- Belgrade Sheets/App Script remains the operational fallback.

This runbook is documentation and readiness only. Do not use it to access production Supabase, perform a restore, download a dump, configure Vercel/DNS/Auth/email, request magic links, create Auth users, create product rows, or send email.

## Readiness states

| State | Meaning |
| --- | --- |
| `documented` | The repository records the intended operational boundary, but launch may still require owner evidence or drills elsewhere. |
| `operator_evidence_required` | Jelani/operator must provide dashboard, plan, ownership, or procedure evidence before the gate can pass. |
| `restore_test_required` | A safe reviewed restore test or approved equivalent has not been performed. |
| `configuration_required` | A provider/platform setting or operational system is not yet configured or verified. |
| `proven` | The repository has current evidence that the requirement is satisfied. |
| `blocked` | Launch must not proceed until this item is resolved. |

## A. Application rollback

Application rollback is not database rollback.

If the deployed application needs to be rolled back:

1. Use Vercel deployment rollback or redeploy a known-good commit.
2. Treat commit `082c960` as the currently verified production deployment baseline.
3. Preserve canonical domain `https://projectlocal.app` and production environment separation.
4. Do not change Supabase migration history as part of app rollback.
5. Do not delete product data as part of app rollback.
6. After rollback, run the exact clean-tree production smoke gate against `https://projectlocal.app`.
7. If Auth/domain/environment settings changed, manually verify Auth callback behavior with an approved operator flow; do not automate magic-link requests in routine checks.

Required operator evidence before launch:

- Who can approve application rollback.
- Who can execute Vercel rollback.
- Where rollback/audit notes are recorded.
- Which commit is considered the latest known-good deployment after each production change.

## B. Database migration recovery

Preserve applied migration history.

Prefer reviewed forward-fix migrations. Normal production database recovery after an applied migration should use reviewed forward-fix migrations:

1. Stop and classify the issue.
2. Do not delete, rename, reorder, rewrite, or edit applied migration files.
3. Do not assume destructive down migrations are the normal recovery path.
4. If the issue is schema-related, design a reviewed forward migration.
5. If approved Auth identities or real product data exist, use a separately reviewed established-production migration/schema gate that accounts for the intended live before/after state.
6. Regenerate/compare public-schema types when schema/RPC/type surfaces change.
7. Verify RLS/security expectations and application compatibility after the forward fix.

The 12.25 `npm run test:production-supabase-schema` gate was the initial/bootstrap empty-production gate. It is not the generic established-production gate now that approved Auth identities may exist.

## C. Data backup and restore evidence

Do not claim backup readiness until Jelani supplies actual production Supabase dashboard/plan evidence.

Jelani/operator must record, outside secrets and without exposing credentials:

- Whether automatic backups are enabled.
- Retention period.
- Visible backup timestamps/status where available.
- Whether point-in-time recovery is available for the current plan.
- How a restore would be initiated in Supabase.
- Who is authorized to approve a restore.
- Whether restore creates a new project/database or replaces the current one.
- What verification must follow a restore.

Do not perform a production restore in this slice. Do not create a second production project automatically. Do not download or expose database credentials or dumps.

## D. Operational pause

Pause Project Local without deleting data:

1. Stop real Bozeman provisioning.
2. revoke or expire production workspace grants.
3. Keep or set email transport disabled.
4. Pause any manual sends and operator workflows.
5. Optionally roll back the Vercel application deployment if app behavior is part of the incident.
6. Keep Belgrade Sheets/App Script available.
7. Communicate that Project Local is paused, not data-deleted.

Auth identity deletion is not the normal pause mechanism. Product-record deletion is not the normal rollback mechanism.

## E. Recovery verification

After a rollback, pause, restore, or forward-fix migration, use safe checks appropriate to the change:

- Production deployment health.
- Exact clean-tree canonical-domain smoke gate.
- Auth callback through manual operator evidence when needed.
- No-workspace/no-grant admin fail-closed behavior.
- Migration level.
- Schema and generated-type compatibility.
- RLS/security expectations.
- Workspace/contact/grant isolation.
- Volunteer schedule privacy.
- Email remains disabled unless explicitly re-approved.

No routine recovery check should request magic links automatically, create production fixtures, create product rows, send email, or expose credentials.

## F. Incident ownership

Unknown ownership remains a launch blocker.

Before launch, record who decides:

- Application rollback.
- Operational pause.
- Database restore.
- Email disablement.
- Pilot cancellation.

Do not guess ownership in source code or tests. Record owners in private operator notes or an approved operational location.

## Current NO-GO reason

Application rollback planning, migration-forward policy, Belgrade fallback, and grant-revocation pause are documented.

Production recovery readiness remains incomplete because the repository still lacks operator evidence for:

- Supabase automatic backups.
- Retention period.
- Backup timestamps/status.
- Point-in-time recovery availability.
- Restore initiation behavior.
- Restore approval owner.
- Whether restore creates or replaces a project/database.
- Post-restore verification procedure.
- Restore-test evidence.
- Incident ownership.

Real Bozeman data remains unprovisioned. Launch remains `NO-GO`.
