# Production Backup, Recovery, and Rollback Runbook

Iteration 12.28 defines Project Local's production backup, recovery, rollback, and operational-pause boundaries before any real Bozeman workspace or product data is provisioned. Iteration 12.28.1 records operator Supabase dashboard evidence for the current production backup plan state. Iteration 12.29 adds the independent encrypted backup automation foundation and operator setup guide without running a production backup or restore.

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
- Production Supabase plan: Free
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

Operator dashboard evidence is now recorded for `project-local-production` (`wdlaauzknfggoqldolmx`):

- Current plan: Free.
- Scheduled backups page: "Free Plan does not include project backups."
- Scheduled backups page states that upgrading to Pro provides up to 7 days of scheduled backups.
- No scheduled production backup is currently available.
- No backup timestamp or successful backup status exists yet.
- Point in time page: "Point in Time Recovery is a Pro Plan add-on."
- Point in time page describes PITR as: "Roll back your database to a specific second."
- PITR add-on starts at $100/month.
- Pro already includes daily backups at no extra cost.
- PITR is not currently enabled or available.
- PITR is not considered necessary for the narrow Bozeman beta unless a later operational review changes that decision.
- Restore to new project page: "Restore to a new project requires Pro Plan and above."
- Restore to new project requires upgrading to Pro and having physical backups enabled.
- Restore to new project is currently unavailable.
- No restore was started.
- No second project was created.
- No database dump, credentials, or secrets were accessed or exposed.

This evidence does not by itself require upgrading to Supabase Pro. Project Local's approved near-term policy is to minimize recurring subscriptions until there are multiple active users every month, prefer secure free or low-cost self-managed infrastructure where practical, and still preserve recoverability and architectural integrity.

At least one reviewed backup path must be proven before real Bozeman data is provisioned.

### Path A - Preferred independent backup path

Before any real Bozeman product data is provisioned, the preferred current strategy is a tested encrypted independent backup system:

1. Implement an automated logical backup process for the production PostgreSQL database.
2. Use secure operator credentials or a dedicated least-privilege backup credential reviewed for this purpose.
3. Never expose the database password, connection string, encryption key, dump contents, service-role key, or volunteer data.
4. Encrypt every backup before it enters persistent storage.
5. Store backup artifacts outside the public application repository.
6. Use private independent storage with a documented retention policy.
7. Retain a reviewed number of daily and weekly backups.
8. Record backup timestamp, size, checksum/integrity result, and success/failure state without exposing contents.
9. Configure safe failure notification.
10. Perform a separately reviewed restore test into local Supabase or another approved disposable non-production target.
11. Verify schema, migration level, expected records, RLS/security assumptions, application compatibility, and cleanup.
12. Document the real disaster-recovery procedure.
13. Add a separate backup plan before any Supabase Storage objects such as volunteer photos are enabled.

The 12.29 automation foundation exists, including dependency preflight checks and a guarded executable local restore boundary, but do not claim the independent backup path is proven yet. Operator key creation, DPAPI secret setup, first encrypted production backup, checksum/status evidence, retention confirmation, notification confirmation, restore drill execution, post-restore verification, and recovery ownership remain incomplete.

See [`INDEPENDENT_PRODUCTION_BACKUP_SETUP.md`](./INDEPENDENT_PRODUCTION_BACKUP_SETUP.md) for the Windows-first operator setup and restore-drill guide.

### Path B - Optional Supabase-managed path

The operator may instead later upgrade to Supabase Pro, confirm managed scheduled/physical backups, record retention and successful backup evidence, and complete an approved restore test. This is optional and should be reconsidered when recurring usage justifies the subscription.

Supabase Pro managed backups remain an optional future path, not a mandatory launch prerequisite.

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

Production recovery readiness remains incomplete because:

- Supabase-managed backups are unavailable on the current Free plan.
- That fact does not by itself require a Pro upgrade.
- Independent encrypted backups are the preferred current plan; the automation foundation exists, but operator setup and proof are incomplete.
- The 12.29 automation foundation exists, but no production backup has run and no restore has passed.
- Supabase Pro remains optional.
- No first successful backup timestamp/status exists.
- Retention is not yet recorded.
- At least one reviewed backup path must be proven before real Bozeman data.
- Restore to new project is unavailable unless the optional Supabase-managed Pro path is chosen and physical backups are enabled.
- Restore approval owner.
- Post-restore verification procedure.
- Restore-test evidence.
- Incident ownership.

PITR is unavailable and intentionally not required for the initial Bozeman beta unless a later operational review changes that decision.

Database backups do not automatically prove recovery for Supabase Storage objects. Add a separate backup plan before enabling Storage-backed features such as volunteer photos.

Real Bozeman data remains unprovisioned. Launch remains `NO-GO`.
