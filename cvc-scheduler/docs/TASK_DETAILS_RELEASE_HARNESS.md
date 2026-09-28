# Task Details release and recovery harness

This is local tooling preparation for the approved Task Details application at `6aeb38275e8bf9fc2d78c5dcb7b3c391185eb583`. Production application/database and the permanent backup task have not been changed by this task. The stopped attempt and its existing backup observations are retained in [the release report](project-resources/TASK_DETAILS_PRODUCTION_RELEASE.md).

## Exact contract

`20260922150000 -> 20260926120000 -> 20260927120000`, contract `20260927120000-transition-v1`.

| Terminal | Meaning | Read-only migration preflight | Task lock transition while disabled | Scheduled backup execution/enablement |
| --- | --- | --- | --- | --- |
| `20260922150000` | Current production, complete earlier release | Exact match accepted | Only to `20260926120000` | Allowed |
| `20260926120000` | Instructions applied; coordinated release incomplete | Exact match identifies progress, not recovery GREEN | Only to `20260927120000` | **Denied** |
| `20260927120000` | Final instructions/privacy terminal | Exact match accepted; security/application gates still required | No arbitrary next transition | Allowed only after normal release verification |

An immediately newer database with the preceding task lock returns `migration_lock_transition_pending`. Skipped, reversed, unknown, malformed and lock-ahead states remain errors. The previous 12.47 intermediate-terminal guards and every historical exact adjacent transition remain intact. An intermediate must never be presented as a completed operational or recovery state.

`scripts/production-backup/task-details-release-contract.json` binds the exact two filenames, SHA-256 of their Git/LF contents, compatible approved application commit and baseline, expected 45-migration ledger, 27 public tables and 80-function policy. Its regression requires the migrations to match the approved candidate and rejects changes to its application/migration subtree. No installed migration or application behavior is changed here.

## Boundary trace

- `ProjectLocalProductionMigrationContract.ps1` owns exact terminal membership, explicit adjacent transitions and the completed-release execution guard.
- `Invoke-ProjectLocalProductionBackup.ps1` checks exact target/terminal before any hosted execution. `ExecuteProductionBackup` additionally rejects intermediate terminals; read-only preflight may identify them during a disabled-task release window. Two new exact pending-lock classifications extend the existing model. Its dump, encryption, publication, SHA-256, status, retention, notification, destination and secret-handling code is unchanged.
- `Register-ProjectLocalBackupTask.ps1` retains permanent task identity, action/runtime validation, exact lock replacement, disabled/non-running update window and completed-terminal enablement checks. No task-registration code or live task action is changed.
- `production-deployment-smoke-regression.mjs` defaults its metadata opt-in to the new final terminal. Explicit `--migration-terminal 20260922150000` preserves the current baseline smoke. Only those two steady-state values are accepted. Its HTTP assertions and no-email/no-fixture/clean-tree/security guards remain unchanged. It does not inspect the database; actual migration preflight/postflight must establish the terminal separately.
- `production-established-schema-gate.mjs` remains the frozen historical 12.36 transition, including pre-provisioning assumptions. It must not be reused as the Task Details production apply gate or run against the existing local stack. The new disposable proof applies all 43 baseline migrations and these exact two forward migrations itself.
- `Test-ProjectLocalBackupRestore.ps1` and the 12.47 scoped restore tools retain their historical exact source contracts. They are not made arbitrarily permissive. Final-terminal compatibility is proved by the new Task Details recovery runner and the bounded restore preparation below.

## Recovery preparation and proof

Run `node scripts/production-backup-task-details-recovery-regression.mjs` with Docker, the existing native PostgreSQL utilities and age available. It owns synthetic disposable containers pinned to `public.ecr.aws/supabase/postgres:17.6.1.171`. The source publishes a dynamically allocated loopback port only; the restore target has no network or published port. It never reads the production connection secret, production backups, real volunteers or the owner-held recovery key.

The runner creates the full current baseline, seeds synthetic authorized contacts and a historical published occurrence, applies the two reviewed migrations in order and checks that historical text is retained. It then changes a synthetic occurrence to exercise private history, uses the existing five-stage native dump implementation in explicit loopback fixture mode, packages the standard six members, encrypts with a temporary synthetic age key, independently compares Node and .NET SHA-256, decrypts and validates every member against the manifest.

Fresh platform creator defaults can grant privileges absent from the source when objects are recreated. `scripts/production-backup/task-details-restore-platform-defaults.sql` clears only the disposable target's postgres global/public defaults for tables/functions/sequences before replaying schema. The backed-up schema then restores source object ACLs and final defaults. **Never apply this preparation SQL to production.** Its caller verifies an owned, disconnected target before use.

Recovery must match all 27 public table fingerprints, every public function body (normalizing only the native Windows writer's CRLF line endings) and exact table/sequence/function/creator-default grants using role names rather than cluster-specific OIDs. It must also pass the 80-function owner/search-path/EXECUTE policy, all-table RLS, private history with no read policy, protected history/sequence denial, restored history sequence continuity, admin instruction visibility, generic on-site redaction/raw-read denial and bearer projection redaction. Notification deliveries remain zero. Owned containers, temporary key, SQL, ZIP and encrypted test artifacts are removed in `finally`.

This proves the feature's synthetic database/package recovery contract on the pinned platform. It does not replace a production-artifact restore exercise, external Auth/platform configuration recovery, session establishment evidence or future site-map object recovery. Site-map upload remains disabled.

## Repeatable regression commands

Run from `cvc-scheduler`; shared database/browser release suites remain serial when the later production release is resumed.

```powershell
node scripts/production-backup-task-details-transition-regression.mjs
node scripts/production-backup-12-47-transition-regression.mjs
node --conditions=react-server --no-warnings --experimental-strip-types scripts/production-independent-backup-regression.mjs --native-dump-loopback
node scripts/production-backup-task-details-recovery-regression.mjs
node --conditions=react-server --no-warnings --experimental-strip-types scripts/production-recovery-readiness-regression.mjs
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/production-backup-checkpoint-prestart-regression.ps1
npm run lint
npx tsc --noEmit
```

The checkpoint prestart regression preserves a historical marker only when it names a removed 12.47 task; an unexpected marker or live old task still fails. Its actual stale-marker, task identity, principal, action, disabled/running state, trigger and prior-run denials remain intact. The regression creates and removes separately named harmless local tasks with no trigger; none is started. It does not change the permanent production task. The backup foundation suite covers existing encryption/manifest/checksum, role/source-ACL restore, retention, failure/redaction/cleanup, connection/credential boundaries, old terminals/transitions and native loopback dump behavior. New transition tests cover both adjacent moves, intermediate execution/enable denial, final/current/historical acceptance, task identity/state/runtime refusals and public-smoke terminal argument rejection.

After a clean committed checkout, the current application's public GET-only smoke may use:

```powershell
$env:RUN_PRODUCTION_DEPLOYMENT_SMOKE_VALIDATION='project-local|https://projectlocal.app|wdlaauzknfggoqldolmx|20260922150000'
node --conditions=react-server --no-warnings --experimental-strip-types scripts/production-deployment-smoke-regression.mjs --migration-terminal 20260922150000
Remove-Item Env:RUN_PRODUCTION_DEPLOYMENT_SMOKE_VALIDATION
```

Use the default command and final-terminal opt-in only after independently verifying the final production database terminal. No HTTP smoke can substitute for that check.

## Remaining production gates

The earlier stopped attempt's production preflight, encrypted-artifact integrity and fingerprints are historical observations. Refresh scheduled-backup task result, artifact SHA-256/manifest/residue and exact old lock; verify the unchanged production baseline and full pending plan. Capture a new repeatable-read baseline across every relevant table, comparing original columns explicitly where migrations add columns. Rerun all application/quality/Auth/RLS/browser/privacy/notification/responsive gates before production changes.

Prepare the compatible application deployment path first. In the controlled window, disable the non-running permanent task, apply only instructions then privacy, advance each exact lock while disabled, validate the final database/security/application contract, deploy the reviewed matching application and resume the task without starting it. Schedule, principal, credentials, destination, encryption, retention and notifications must remain unchanged. Verify Production/Ready, authorized read-only smoke, final recovery locks and pre/post operational/delivery fingerprints. Prefer a compatible forward application repair; never broaden instruction access or blindly restore the old application after privacy RLS is live.
