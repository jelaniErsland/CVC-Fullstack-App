# Task Details production release — 2026-09-28

**Status: LOCAL RELEASE-HARNESS PREPARATION COMPLETE; PRODUCTION RELEASE NOT RESUMED.** The first attempt was blocked before production changes. The product owner approved application candidate `6aeb38275e8bf9fc2d78c5dcb7b3c391185eb583` on `codex/simplified-task-details` and the ordered migrations `20260926120000_assignment_instructions.sql`, then `20260927120000_instruction_privacy.sql`. Neither migration was applied to production. No release push, deployment, backup-task mutation, real email or product-data write occurred in this release attempt.

## Essential release gate failure

At the stopped attempt, the checked-in and installed backup runtime used `scripts/production-backup/ProjectLocalProductionMigrationContract.ps1`, contract `20260922150000-transition-v1`. Its approved terminals and exact adjacent lock transitions stop at `20260922150000`. Neither new migration terminal is supported, and the approved application diff contains no backup-contract update.

Both the isolated fixture and the actual read-only `ValidateExpectedMigrationTransition` command for `20260922150000 -> 20260926120000` failed with:

> Only an explicit reviewed production backup-lock transition is supported.

Deploying now would leave the established backup/recovery tooling unable to recognize the new database terminal or safely advance and re-enable its migration lock. The production release was stopped under the owner's essential-gate rule. No force flag, alternate backup task, manual backup or relaxed migration allowlist was used.

At that attempt, the public deployment-smoke harness also locked its opt-in metadata to `20260922150000`; it is not prepared to identify the requested post-release terminal. This is a release-harness dependency, not an instruction-policy decision.

## Verified observations

| Check | Result |
| --- | --- |
| Candidate and ancestry | Local branch and HEAD match the approved full candidate. `ca54020ef3f8e8ecc55bcd46f7fedf1331a56923` is an ancestor. Live `origin/master` still points to that production baseline. |
| Exact diff | Baseline-to-candidate inventory contains 96 paths, including the approved implementation, tests, architecture documentation and synthetic previews. Only the two requested migrations are new. No backup migration-contract change is included. The isolated architecture previews are outside Vercel's application root; no site-map upload implementation was introduced. Final deployment scope and all remaining gates must be rechecked after tooling preparation. |
| Working tree | Application and other tracked files were clean before this report. Preexisting untracked release-check/12.47/Batch 1 preview directories were preserved and excluded. This attempt adds only release documentation and updates CURRENT_STATE. |
| Production preflight | Existing read-only production preflight passed for `project-local-production` / `wdlaauzknfggoqldolmx`, terminal `20260922150000`. There are 43 migration records; photo uploads remain disabled. |
| Backup task | Enabled/Ready, daily 03:15, StartWhenAvailable, Interactive current-operator principal, failure notifications enabled and no secret-bearing arguments. Last recorded execution: September 28, 10:38:53 MDT, result 0. Next scheduled execution: September 29, 03:15 MDT. The task was not started or changed by this release attempt. |
| Encrypted artifact | `project-local-production-20260928T163915Z-efce08db.zip.age`, 320,669 bytes. Safe status reports success at `2026-09-28T16:39:15.4889754Z`. Independently recomputed SHA-256: `fe92863a7eeeba6824537fd3efe5a8c698385b1c9c19cdf2d89855af94e48d75`, matching status. |
| Manifest and residue | Decryption into memory verified the six-member archive and each manifest dump length. Manifest terminal is `20260922150000`. No decrypted archive or SQL was persisted. Backup destination had zero SQL, ZIP, partial or temporary residue. This is artifact integrity evidence, not a new disposable recovery rehearsal. |
| Fingerprint observation | Existing repeatable-read fingerprint query captured 11 operational/contact/grant/photo/delivery tables to ignored `.local/task-details-release-blocked-production.json`. Assignment-notification ledger count is 168. This is a current observation, not the full future migration-window baseline or a comparison to historical roster counts. |

No Vercel deployment was initiated or freshly verified, and no authorized production UI smoke was performed after the blocker. The previously deployed application remains the Batch 2 baseline. The full quality, database/security, browser, notification and responsive gates were **not rerun in this release attempt** after the essential tooling gate failed. Their prior candidate results remain documented in [the implementation review](TASK_DETAILS_IMPLEMENTATION_REVIEW.md); they must be rerun for the resumed controlled release. No successful release or post-release data comparison is claimed.

## Original next-step plan (now implemented locally)

Prepare and review a narrow operational release-tooling correction, separate from the approved application candidate:

1. Support exactly the adjacent transitions `20260922150000 -> 20260926120000 -> 20260927120000`. Classify `20260926120000` as a coordinated-release intermediate where backup execution/enablement remains denied; only the final terminal may resume the task. Preserve wrong-source, wrong-target, skipped, downgrade, arbitrary-future, running-task and unexpected-task denials.
2. Prove both transitions and intermediate/final recovery classification with checked-in local fixtures. Prepare exact production preflight/apply/postflight checks for these two migration files and their final function/RLS/sequence/trigger policy; do not reuse the historical bootstrap or pre-provisioning gate against live data.
3. Update public-smoke terminal metadata to the reviewed final terminal while retaining every existing privacy, redirect, no-email and no-fixture assertion. Preserve task cadence, principal, destination, encryption, retention and notifications.
4. Rerun all required release gates serially where fixtures share a database/server; refresh scheduled-backup evidence and capture complete production fingerprints immediately before the controlled window. Ready the compatible application release path before either migration, then execute the approved order and deploy the exact application SHA. Verify final task lock, Vercel Production/Ready, authorized read-only smoke and all pre/post fingerprints.

This report does not implement or authorize an unreviewed runtime bypass. The application candidate and approved instruction privacy remain unchanged.

## Safe recovery path

Before migrations, production stays on the existing application/database pair. After either migration, prefer a reviewed compatible forward application fix. Once the privacy migration is live, do not roll the application back blindly to `ca54020`: its raw Calendar/Task reads are incompatible with the tightened read-only RLS. Never restore broader grants or instruction visibility to make that old application work. Any database rollback requires explicit review and must preserve approved privacy. Keep the backup task disabled through intermediate migration/lock states and resume only after the reviewed final-terminal validation; never manually start it to satisfy a gate.

## Retained limitations

- The long-running development Server Action transport issue remains unexplained; repeated successful fresh-production journeys are not a root-cause resolution.
- Maya's reported busy-month production latency remains a separate concern; a local 30-item timing is not production latency evidence.
- The existing desktop assigned-person context ellipsis limitation remains deferred to the later inspector/picker work.
- Site-map uploads remain disabled pending the exact approved file and independently encrypted disposable restore proof. No site-map implementation or Batch 3 work began.

## Local harness closeout — 2026-09-28

The tooling-only follow-up implements the exact chain `20260922150000 -> 20260926120000 -> 20260927120000`, contract `20260927120000-transition-v1`. The intermediate remains migration-in-progress and cannot execute or enable ordinary scheduled backups. The final terminal is supported only alongside the reviewed ordered migration contents and compatible application. Unknown/skipped/reversed/malformed terminals, lock-ahead states and unexpected task identity/runtime/state remain denied. Public smoke accepts only the current or final steady-state metadata; its response/security assertions are unchanged. The full boundary trace, hashes and commands are in [TASK_DETAILS_RELEASE_HARNESS](../TASK_DETAILS_RELEASE_HARNESS.md).

| Checked-in test/check | Follow-up result |
| --- | --- |
| Task Details transition regression | PASS: both adjacent moves, current/final/historical acceptance, intermediate execution/enable denial, pending-lock classifications, wrong/skipped/reversed/future/malformed values, task identity/state/runtime and smoke argument guards. |
| Existing 12.47 transition regression | PASS unmodified: every prior four-step transition and intermediate backup/enable guard retained. |
| Complete independent-backup regression with `--native-dump-loopback` | PASS: existing encryption/integrity/manifest, retention/redaction/cleanup, managed-role/source-ACL, historical transition and credential/native-dump boundaries. |
| Task Details encrypted recovery regression | PASS: full 43-migration baseline plus two ordered forwards, historical occurrence text retained, synthetic private revision history, standard six-file native package, temporary age encryption, independently matching Node/.NET SHA-256, exact members/manifest, all 27 table fingerprints, all 80 function grants, owner/search-path/default ACLs, admin text visibility, generic on-site redaction/raw-read denial, bearer projection redaction and sequence continuity. Zero deliveries; owned containers, key and files removed. |
| Recovery-readiness regression | PASS: corrected its stale September 5 current-terminal/deployment-boundary assertions to the verified baseline and pending Task Details contract; historical safety assertions retained. |
| Checkpoint-prestart regression | PASS: stale-marker, principal/action/identity, state, trigger and prior-run denials intact. Its outdated global cleanup assertion now preserves a bounded historical marker naming a removed 12.47 task; unexpected marker content or a live old task still fails. No checkpoint is started, and the actual prestart verifier is unchanged. |
| Public deployment-smoke regression | PASS unmodified after committing, with explicit current-terminal opt-in/argument: five unauthenticated GETs only; canonical-origin redirects, public wording, no cookie creation, no-store/noindex/no-referrer and no data/credential disclosure assertions retained. This did not verify the final database terminal or authenticated production UI. |
| ESLint, TypeScript and diff whitespace | PASS. |

The restore proof initially detected inherited platform defaults reintroducing anonymous function grants. A disposable-target-only preparation clears postgres global/public table/function/sequence defaults before creating restored objects, then native schema replay reinstates source object and final default ACLs. The proof compares exact effective source/restored privileges by role name and function definitions with only native-writer CRLF normalized. No production ACL or backup encryption/publishing path was altered. The historical restore tools retain their strict old-version contracts; no generic future-terminal recovery claim was added.

Application `app/`, `components/`, `lib/`, `proxy.ts` and both migrations are unchanged from `6aeb382`. The follow-up commit contains harness/tests/package test commands and documentation only. Preexisting unrelated untracked directories and the harmless legacy audit marker remain preserved. No production migration, deployment, merge, manual backup, permanent-task change, real email or feature expansion occurred.

Before release, refresh the production baseline, all required application/Auth/RLS/browser/notification/responsive gates, scheduled-artifact/task evidence, exact 43-record preflight and complete repeatable-read fingerprints. Prepare the compatible application path first, then use only the ordered migration/disabled-task-lock procedure and final security postflight. Live transition validation, new-terminal scheduled backup, authorized production smoke, Vercel status and post-release fingerprints remain **unexecuted** in this tooling task. The safe forward-repair rules and all known limitations above remain in force.
