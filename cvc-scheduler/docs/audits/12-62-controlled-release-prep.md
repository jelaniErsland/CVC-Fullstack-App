# 12.62 final polish and controlled release preparation

Prepared 2026-10-29. No deployment, hosted migration, real deletion, communication send, reminder invocation, Cron change, backup-task change, or active tooling installation was performed.

## Frozen product boundary

Base implementation: `f0db7fc6af6e365e1d1f349e88b54646dba2eb2e`.
The only additional product change is in `components/DeleteVolunteerDialog.tsx`:

- “Alex Morgan will be removed from 3 current/upcoming assignments.” Calendar events remain intact. “Those staffing positions will become open.” remains present.
- Nearest work uses the existing `formatScheduleDate` and `formatScheduleClockTime` helpers, including the actual project-local start time. No new formatter or timezone conversion was introduced. The standard full human-readable date is retained.

All other changes in this preparation commit are test support, regression evidence, and this runbook. The approved deletion architecture and data model are unchanged. The final application commit is recorded in the release receipt/final delivery rather than embedding a self-referential Git hash here.

## Production read-only preflight

At 17:07 UTC and again at 17:37 UTC (11:37 AM Mountain):

- `projectlocal.app` resolves to deployment `dpl_AGKqHhTFSRzju2oW52TDS2TdmLtY`, Production / READY, application `19fe6a29d5b59941bb0612cf9e18fe85a080f474`.
- Database exactly 57 / `20261026120000`. The only pending migration is reviewed migration58.
- Exact retained **103-function** production policy matches. PUBLIC execute zero. All 10 catalogue/security categories match the previous release and this pass's initial capture: columns, constraints, default ACL, function privileges, function definitions, indexes, ledger, policies, relations, triggers.
- All 33 contracted public/Auth relation fingerprints, relation details, sequences and reminder state also match between this pass's initial and final captures.
- Restricted runner membership remains precisely the reviewed worker role, SET allowed, INHERIT/admin disallowed, no direct table grants; worker has no login/superuser/bypass privilege. Activation remains owner-only SECURITY INVOKER with empty search_path, denied to anonymous/authenticated/service/worker/runner.
- Reminders remain ON. Original baseline `2026-10-23T20:05:28.288289Z` is unchanged. Counts: 194 enrollments, 640 occurrences, 180 events, 90 reminder operations and 90 recipients. Recent natural sweeps at 17:20/25/30/35 UTC each evaluated 199, eligible/claimed/sent/failed/unknown all zero. No manual invocation occurred.
- Cloudflare dashboard: Workers Free is Current plan; one Worker `project-local-reminder-clock`, deployment version `ec59bb7d`, one active Cron. Its existing expression was inspected as exactly `*/5 * * * *` and the inspection canceled without edits. Only the existing encrypted HMAC secret is present; no bindings.
- Backup remains Enabled / Ready / idle; last result zero; exact full task definition unchanged; lock `20261026120000`; next normal run 2026-10-30 03:15 Mountain. The permanent task was never manually run.
- SEC-12.57-01 remains OPEN / SEPARATE.

The Vercel connector still returned a scope authorization error after consent, so the same read-only alias/deployment endpoints were verified successfully through the already authenticated CLI with explicit project/team scope. No deployment was attempted.

## Exact migration boundary

`20261028120000_volunteer_deletion_lifecycle.sql` is byte-for-byte unchanged:

`9a32dde49b26ad3f71cd8a7925edbf768103059f4ca069e445facb7a8af7b89e`

All 57 earlier migration files are unchanged against production. The reviewed migration changes six existing tables, adds seven functions and six row guards, and amends the 39 approved existing function bodies. No new table, role, broad grant, policy/RLS change or CASCADE conversion is introduced. All 46 migration function bodies match the local catalogue exactly. Local DB58 has the exact 110-function privilege policy and PUBLIC execute zero. Worker and permanent runner cannot execute deletion review/deletion or the admin dispatch revalidation function.

## Mixed-version proof

A canonical Git export of **exact live application 19fe6a29...** was built in production mode with Next16.2.7 and the guarded Webpack path. All 1,006 tracked export files still match the production Git blobs after the proof. It used only local DB58 and synthetic fixtures; browser and server external traffic were blocked and provider configuration disabled.

Passed:

- authenticated session/workspace context and anonymous login redirect;
- Overview; Volunteers; search/filter/sort; profile; Edit save; Add save;
- CSV export, preview and actual disposable local import;
- Calendar and the full normal-latency desktop/mobile Calendar suite, including assignment creation/save/cancel, bulk editing, picker, remembered view/date and mobile More;
- Communications, Automatic reminders and read-only Project Quick View;
- volunteer lookup and schedule access.

The legacy `/admin/projects` route remains intentionally beta-contained; the real authorized workspace context was verified in the current shell. No deleted fixture was used for this old-app browser compatibility proof. The legacy old-app hard-delete workflow is intentionally refused by DB58 and is not an approved rollback workflow.

The exact exported old application reminder worker also ran against local DB58 through an injected local restricted-runner connection. It evaluated six fixture assignments, generated only future scheduling state, and passed repeated/concurrent exact occurrence comparison with zero duplicate identities and **zero provider calls**. Status was narrowed to that fixture's already-authorized workspace to prevent tests from sweeping unrelated local fixtures.

## Atomic transition and recovery proof

`scripts/12-62-release-transition.py` uses a disconnected PostgreSQL17 container, no ports, no hosted credentials and no provider:

1. Replay all 57 existing migrations.
2. Enable synthetic prospective reminder state with pending/confirmed assignments.
3. Force a late failure inside migration58 + ledger transaction: exact DB57 schema/security/public/Auth state is restored.
4. Hold a bounded old worker transaction while migration58's atomic DDL waits, then run the unchanged worker command contract after commit. Future occurrence identities and timestamps are exact; no duplicates or send surface exist.
5. Verify clean ledger58, old operational/Auth data preserved and activation/baseline unchanged.
6. Use the actual deletion RPC on a disposable identity and logically dump/restore DB58 into a separate database. Compare all public/Auth/ledger rows, all110 function bodies/owners/ACL/security/search_path, relation and column contracts, pretty constraint definitions, RLS/policies/default grants, triggers and indexes. Scrubbed identity and assignment-withdrawal history survive exactly.
7. Remove the disconnected container.

Recovery follows the established platform separation: exclude platform event triggers from the application dump, retain global/public default privileges, and restore the explicit owner-only ACL on FORCE-RLS reminder tables. Constraint comparison uses the same PostgreSQL pretty form as the retained production snapshot. No app security assertion is relaxed.

The package remains the existing encrypted six-member `project-local.logical-backup.v1` contract; Auth coverage/transient exclusions are unchanged. The legacy baseline23 restore/forward-migration harness must not be used for DB58. Use the current in-memory exact-terminal recovery protocol and matching source fingerprints.

## Independent backup tooling

Prepared separately, **not installed**: tooling commit `c504ab1dbf4835c3087bd3ddd7ad6ecc48a1faf9`.

- Recognizes terminal `20261028120000`; accepts only explicit reviewed `20261026120000 -> 20261028120000` for this release.
- 86 fixture cases passed, preserving all 32 reviewed adjacent transitions and rejecting skip/reverse/unknown/no-op, wrong current/target/task/runtime and enabled/running/queued/duplicate-task lock changes.
- Backup preflight fixture accepts terminal58. Generic native schema/data dumps retain the six-table additions and all110 function definitions; no new field allowlist can omit deletion/redaction state.
- Active runtime/task remains on the prior reviewed migration57 contract and lock. No install or lock advancement was performed during prep.
- A fresh encrypted **DB57** checkpoint plus exact isolated comparison remains mandatory immediately before the actual production migration. This preparation did not create a redundant production checkpoint. After a healthy release, exact **DB58** checkpoints/recovery must preserve tombstones and history.

## Required release order and rollback boundary

Only execute after separate owner production approval:

1. Fresh preflight: exact live old SHA; DB57; unchanged security; healthy reminders/Cron; idle backup lock57.
2. Fresh encrypted DB57 checkpoint using the reviewed direct checkpoint entry point, without manually starting the permanent task. Exact isolated restore and matching source fingerprints; retain encrypted artifact and checksum.
3. Install and verify only approved independent backup tooling `c504ab1...`. Confirm full task definition unchanged.
4. Disable the idle permanent backup task with the reviewed helper/UAC if required; verify Disabled / idle / lock57.
5. **Keep reminders ON and Cron unchanged.** The exact old worker and atomic transition compatibility are verified. Prefer starting between natural five-minute sweeps to reduce contention. Use finite lock/statement deadlines; abort/reconcile any migration failure rather than blindly retrying or manually invoking a sweep.
6. Verify migration58 SHA-256, then apply it **once**, atomically with ledger insertion. Expect DB58 / `20261028120000`.
7. Immediate fingerprint postflight: only reviewed DDL, seven functions/row guards, 39 function-body guards and ledger change; operational/Auth data and activation/baseline unchanged. Exact110 policy, PUBLIC0, no new worker/runner admin privileges. Observe natural sweeps; no forced send.
8. Advance only the **disabled** backup-task lock57 ->58. Verify disabled/idle and every unrelated task setting unchanged.
9. Deploy the exact final application candidate. Require hosted guarded Next16.2.7 receipt before Turbopack compilation, Production / Ready and exact canonical alias/SHA.
10. Non-mutating production navigation/Calendar/Volunteers/Profile/Edit/Comms/Quick View/volunteer smoke; do not delete a real volunteer or send a communication to prove the release.
11. Final catalogue/data/activity reconciliation, natural reminder health, retained original baseline, Cloudflare unchanged. Re-enable backup at lock58 with daily03:15 unchanged; never manually start it.

**Safe order: DB57 + old app -> DB58 + old app -> DB58 + new app. Never new app on DB57.**

Before a real deletion, rollback to the tested old app may be considered while retaining DB58, subject to fresh compatibility/state checks. After the first real deletion, **no automatic pre12.62 application rollback**: use a reviewed forward fix or exact DB58 recovery. Never use a schema downgrade/older identity snapshot to reconstruct scrubbed PII, revoked tokens, removed assignment memberships, or access. No destructive down migration is supplied.

## Final local gates and evidence

- Confirmation browser suite: 320/390/430/768/1440/1920; no accessibility violations or overflow; zero-assignment case; current/future impact; human-readable nearest start; real overnight start at17:00; browser timezone Pacific/Auckland; dirty Edit -> Delete; Cancel/Escape; contained focus; retry; stale review; blocked dismissal during pending delete; preserved directory state.
- Migration58 source/catalogue parity: all46 bodies exact; exact110 function-policy regression; PUBLIC0; previous57 migration files unchanged.
- TypeScript, full ESLint (zero warnings), git diff --check, generated DB58 type parity and credential/client-secret scans passed.
- Guarded Next16.2.7 Webpack and Turbopack production builds passed. Both printed `Project Local: verified guarded Next.js 16.2.7 router source` before compilation.
- Existing unchanged implementation/security proofs remain applicable; no unrelated suites or product changes were introduced.

Synthetic screenshots and results: `previews/12-62-release-prep/`. Private preflight/build/transition/tooling logs: `2026-10-29/project-local-12-62-release-prep` in the established Codex evidence directory. No production PII is included in tracked screenshots.

Remaining boundaries: fresh checkpoint/restore and hosted-build receipt are release-time gates, not completed production actions; no automatic old-app rollback after deletion; previously documented artificial-delay Calendar inspector limitation and SEC-12.57-01 remain separate. Current normal-latency Calendar editing passed. No unresolved local release-prep blocker remains.
