# Production Backup, Recovery, and Rollback Runbook

Iteration 12.28 defines Project Local's production backup, recovery, rollback, and operational-pause boundaries before any real Bozeman workspace or product data is provisioned. Iteration 12.28.1 records operator Supabase dashboard evidence for the current production backup plan state. Iteration 12.29 adds the independent encrypted backup automation foundation. Iteration 12.34 proves the first encrypted production backup. Iteration 12.34.1 solves the managed-role replay boundary, 12.34.2 attributes the 26 restored `TRUNCATE` grants to `RESTORE_INTERACTION`, and 12.34.3 proves deterministic source ACL reconstruction plus complete local recovery-forward through `20260812123430` without changing the six-file package. Iteration 12.35 registers the Windows recurring task, proves safe human-visible failure notification, and records operational ownership; its first scheduled production attempt fails safely at migration preflight. Iteration 12.35.11 then proves one successful controlled Scheduled Task production execution, and 12.35.12 reconciles the complete evidence and safely enables the permanent task after a harmless missed-trigger proof. Iteration 12.36 locally proves the exact migration-lock transition; 12.36.5 completes the authorized production migration and transitions the live task lock to `20260812123430`.

Current status: `RECOVERY READY / NON-BLOCKING`.

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
- Production migration: `20260812123430`
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

Jelani, as the Project Local product/operator owner, approves and executes Vercel application rollback. Codex or engineering may assist with technical investigation or execution, but operational authority remains with that owner. Record rollback/audit notes and the latest known-good deployment after each production change.

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
- No Supabase-managed scheduled production backup is currently available; the independent Windows task is recorded below.
- No Supabase-managed backup timestamp or successful status exists; the separately managed 12.34 backup evidence is recorded below.
- Point in time page: "Point in Time Recovery is a Pro Plan add-on."
- Point in time page describes PITR as: "Roll back your database to a specific second."
- PITR add-on starts at $100/month.
- Pro already includes daily backups at no extra cost.
- PITR is not currently enabled or available.
- PITR is not considered necessary for the narrow Bozeman beta unless a later operational review changes that decision.
- Restore to new project page: "Restore to a new project requires Pro Plan and above."
- Restore to new project requires upgrading to Pro and having physical backups enabled.
- Restore to new project is currently unavailable.
- No Supabase-managed restore was started.
- No second project was created.
- No Supabase-managed dump, credentials, or secrets were accessed or exposed in the 12.28.1 dashboard review.

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

12.34 proves the first independent backup execution: exact production Session Pooler and migration preflight, the unchanged six-file package, age encryption before persistence, success at `2026-08-12T17:26:46.3144615Z`, `62409` encrypted bytes, matching SHA-256, recognition-based retention, and no persistent plaintext.

12.34.1 safely classifies the actual eight-statement `roles.sql`: three session settings, one reset, three `statement_timeout` settings for `anon`/`authenticated`/`authenticator`, and one `SET` privilege on `log_min_messages` for `supabase_realtime_admin`. No user-defined role, password/verifier, ownership statement, or unsupported statement was present. The temporary derived role file verifies those platform roles/settings/privilege rather than recreating platform infrastructure; supported synthetic user-role material remains restorable and unsupported SQL fails closed. The original six-file package and `roles.sql` remain unchanged.

The single fresh 12.34.1 restore attempt then passed the role boundary, schema restore, all 23 migrations through `20260714122230`, data restore, baseline public-function checks, pending Notification Health absence, RLS on all 13 Project Local tables, and expected FORCE RLS. Verification stopped fail-closed because `anon` and `authenticated` each held direct `TRUNCATE` on all 13 Project Local tables: 26 unsafe grants, and `TRUNCATE` bypasses RLS. Do not normalize or waive that mismatch silently. Generated-type parity, product-row state, and remaining application compatibility checks were not reached, so full recovery is not proven.

12.34.2 proved the 26 grants were introduced by `RESTORE_INTERACTION`, not present in the historical source ACL. 12.34.3 therefore added deterministic, fail-closed parsing of the actual encrypted artifact's table ACL statements and reconstructed the exact historical source posture after restore. The completed local recovery-forward ended at 25 migrations through `20260812123430` and passed generated-type parity, RLS on all 13 tables, the exact four FORCE RLS tables, no direct privileges for `anon` or `PUBLIC`, `authenticated` `SELECT` on exactly the nine approved tables, zero protected-role postgres future-table defaults, product-row state, Notification Health, Calendar/assignment, Volunteer, volunteer-schedule compatibility, and zero residue. Full independent technical recovery is proven.

Migration `20260812123430` codifies that exact direct/default privilege posture. Approved staging and production both passed through `20260812123430`; the production application is complete and must not be rerun. The logical database package covers PostgreSQL Auth schema/data and Storage metadata, but it does not prove recovery of Supabase Auth platform configuration or Storage object BLOBs.

12.35 registered exactly one enabled Windows Task Scheduler task named `Project Local Production Backup`. It runs daily at `03:15` local time with `StartWhenAvailable`, `IgnoreNew`, a two-hour limit, the current operator's `Interactive`/limited principal, exact `project-local-production` / `wdlaauzknfggoqldolmx` / `20260714122230` locks, and safe failure notification enabled. Its arguments include the public age recipient but no database credential, DPAPI value, service-role value, or private age identity.

Because the task uses an Interactive principal, the current Windows operator must be logged in for it to run. If the computer is asleep, powered off, or logged out at `03:15`, it cannot start then. `StartWhenAvailable` causes that missed start to run when Task Scheduler next has the operator's interactive session and the computer is awake/available; it does not make the PC an always-on backup host. If the PC is awake and the operator is logged in but the network is offline, the task still starts at `03:15`; its connection preflight fails safely and notifies the operator, and this task configuration does not automatically retry merely because connectivity later returns.

The historical 12.35 Task Scheduler production execution reached the read-only migration-preflight stage, returned `migration_preflight_failed`, and produced no new encrypted artifact. No retry occurred in that iteration. This failed attempt remains part of the record because it motivated the credential-safe native dump and classification repairs.

12.35 also ran one separately named deterministic pre-network Task Scheduler fixture. It exited nonzero with `injected_pre_network_failure`, wrote atomic credential-free failure and notification status, emitted the Windows-local notification, created no backup/plaintext artifact, made no production connection, and left no backup workspace. Jelani confirmed the human-visible Windows notification, and the temporary task and status root were removed. Safe failure-notification behavior is proven.

12.35.11 used one temporary triggerless Scheduled Task with the reviewed permanent action, current-operator `Interactive`/limited principal, exact production locks, and no secret-bearing arguments. Exactly one manual start produced exactly one successful read-only production execution. Migration preflight through `20260714122230`, roles/schema/data/migration-schema/migration-data native dumps, the unchanged six-file package, ZIP construction, age encryption, atomic publication, safe status, and cleanup all passed. The new `project-local-production-20260816T203034Z-c438e330.zip.age` artifact is `62622` bytes. Its independently recomputed SHA-256 is `dfdbb535fc41098e411d0a2b70bbe11c1ef60e2fc6d4601b16d420e6ece72a15`, matching the safe status and Sunday weekly copy. Daily artifacts changed from one to two, weekly artifacts from zero to one, retention correctly deleted zero files below the `14`/`8` limits, and no plaintext SQL/ZIP, `.partial`, decrypted material, or duplicate execution remained.

12.35.12 registered a completely harmless daily clone with `StartWhenAvailable`, `IgnoreNew`, and the same `Interactive`/limited principal. The task remained disabled through a real scheduled occurrence; enabling it afterward did not run or catch up, did not write its marker, and left its never-run LastRunTime/result unchanged while advancing NextRunTime to the next day. The clone was removed. With the permanent task action, locks, principal, trigger, and hash otherwise verified, the permanent `Project Local Production Backup` task was enabled directly. It remained `Ready`, did not execute, retained its historical LastRunTime/result, and scheduled the next future daily `03:15` occurrence. Only the enabled flag changed; `StartWhenAvailable`, `IgnoreNew`, the two-hour limit, principal, action, and exact production/migration locks remain intact.

12.36.5 completed the reviewed transition: the live task is enabled/Ready and locked to `20260812123430`; no manual start occurred. The backup script and task-registration boundary retain the historical exact `20260714122230` to `20260812123430` action as evidence only. A future migration requires a newly reviewed gate and task-lock transition; do not rerun the completed procedure or move the lock backward.

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

Jelani, as the Project Local product/operator owner, is the responsible owner for:

- Recurring backup operations and backup failure response.
- Database restore approval and execution.
- Vercel application rollback approval and execution.
- Operational pause.
- Email disablement.
- Pilot cancellation.

Codex or engineering assistance may be used to investigate or execute technical steps, but operational authority remains with the Project Local product/operator owner.

## Current recovery decision

Application rollback planning, migration-forward policy, Belgrade fallback, and grant-revocation pause are documented.

Production recovery readiness is complete and non-blocking because:

- Supabase-managed backups are unavailable on the current Free plan.
- That fact does not by itself require a Pro upgrade.
- Independent encrypted backups are the preferred current plan; the first encrypted production backup, checksum/status, and retention behavior are proven.
- The 12.34.1 managed-role boundary, 12.34.2 restore-interaction attribution, and 12.34.3 full independent technical recovery are proven.
- Supabase Pro remains optional.
- Recurring task registration and safe human-confirmed failure notification are proven.
- 12.35.11 proves one successful scheduled-host production backup, five native dump stages, six-file packaging, age encryption, daily/weekly publication, independently matching SHA-256, retention execution, duplicate prevention, and plaintext cleanup.
- 12.35.12 proves the no-catch-up enablement behavior on this Windows host and leaves the permanent daily `03:15` task enabled and `Ready` without an extra execution.
- Restore to new project is unavailable unless the optional Supabase-managed Pro path is chosen and physical backups are enabled.
- Recovery/rollback decision ownership is recorded under the Project Local product/operator owner.

PITR is unavailable and intentionally not required for the initial Bozeman beta unless a later operational review changes that decision.

Database backups do not automatically prove recovery for Supabase Storage objects. Add a separate backup plan before enabling Storage-backed features such as volunteer photos.

Real Bozeman data remains unprovisioned. Overall launch remains `NO-GO` for the separate production migrations/first Notification Health execution, application-driven Initial email, real Bozeman provisioning, controlled pilot, and explicit launch-approval gates; backup/recovery is no longer among the blockers.
