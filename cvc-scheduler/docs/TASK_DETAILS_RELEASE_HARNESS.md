# Task Details release and recovery harness

This is local tooling preparation for the approved Task Details application at `6aeb38275e8bf9fc2d78c5dcb7b3c391185eb583`. Production application/database and the permanent backup task have not been changed by this task. The stopped attempt and its existing backup observations are retained in [the release report](project-resources/TASK_DETAILS_PRODUCTION_RELEASE.md).

**Resumed release verification, September 28:** reviewed HEAD `f4821e8dbe81722ac149b349f5e15a66ff6525e2` passes exact approved-content reconciliation. Live backup integrity/task/preflight evidence was refreshed successfully, but the fresh production-build browser runner and two isolated unmodified repeats fail `No completed RSC payload inspected.` Production changes stopped: database/lock remain `20260922150000`, task Enabled/Ready, application `ca54020`. All 29 captured relation fingerprints and task XML match before/after. The next harness correction must obtain and await real completed RSC evidence without dropping privacy assertions; all release gates must then restart from a clean reviewed checkout. No migration-lock, application or test-source change was made in this stopped attempt. The report distinguishes fresh passes from unexecuted gates; earlier recovery passes are not substituted for new release evidence.

## Completed bearer RSC capture repair

The separate test fix `49a1fa54434904ca949f2ebfc44010876580597b` resolves the missing evidence locally. Response traces proved actual HTTP-200 `text/x-component` navigation fetches, but some ended `net::ERR_ABORTED` before `requestfinished`, even when the test paused after its Day click. Passive completion-only instrumentation could therefore collect HTML and no readable completed Flight body. Neither MIME parameters, redirects, prefetch/cache nor late listener placement caused the missing classification; a precise internal cancellation/GC stack is not claimed.

Only the disposable recipient browser context changes: a fetch observer independently drains a clone of real same-origin `/qv` Flight responses and returns the original unchanged. It does not issue another request or synthesize/intercept server data. A completion wait registered before the existing Day click then requires the exact route/date, established bearer cookie, non-prefetch `RSC: 1`, HTTP 200, genuine normalized MIME type, successful response completion and full body. All private sentinels must be absent; exact fixture IDs/project/publication/date/times/staffing/meal total/contact/provider/menu must be present. Canceled, failed, redirected, unreadable, empty or unrelated responses cannot satisfy that positive proof. The general collector retains full completed HTML/RSC/JSON negative checks, and all existing UI/admin/read-only/revocation assertions remain.

**Five consecutive isolated runs pass**, each after its own fresh production build: populated Day RSC **7,578 bytes**, **5 completed HTML / 3 RSC / 0 separate JSON** bodies per run, no skipped assertions, unchanged four notification/communication fingerprints, disabled providers and complete fixture/server cleanup. This route serializes client data in HTML/RSC; no separate browser JSON call was fabricated. The existing direct RPC test proves actual JSON projection privacy. The complete Task Details runner passes again from the committed fix; focused real local access/privacy/privilege/volunteer/notification suites, lint and TypeScript also pass. See [the repair evidence and scope](project-resources/TASK_DETAILS_PRODUCTION_RELEASE.md).

The test-fix and documentation HEAD preserve approved `6aeb382` and reviewed `f4821e8` application/migration contents exactly. The final handoff records the full potential release SHA; documentation changes do not authorize an application diff or restart deployment. Production remains at the old terminal/application. All full production-release gates and live backup/preflight/fingerprints must be refreshed only in a separately resumed release; this task changes no production task, database, application, Auth or notification configuration.

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
