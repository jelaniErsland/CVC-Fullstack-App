# Task Details production release — 2026-09-28

**Status: LOCAL RSC PRIVACY-HARNESS REPAIR VERIFIED; PRODUCTION RELEASE NOT RESTARTED.** The stopped attempt and its evidence are retained below. The capture-only fix is committed separately as `49a1fa54434904ca949f2ebfc44010876580597b`; five consecutive isolated passes and the complete Task Details runner now pass. Neither migration was applied; no release push, deployment, permanent backup-task mutation, real email or production product-data write occurred. Production remains `ca54020ef3f8e8ecc55bcd46f7fedf1331a56923`, database terminal `20260922150000` with 43 migrations. A future separately resumed release must refresh all release gates and live evidence.

## Bearer RSC capture repair — 2026-09-28

### Diagnosis and bounded repair

The finish-only collector was installed **before** bearer exchange and navigation. Diagnostic response headers showed actual same-origin `/qv` fetches with `RSC: 1`, HTTP 200 and `text/x-component`, with no router-prefetch flag. Full `page.goto`/reload requests were correctly classified as HTML, but the existing Day/arrow buttons also caused real client-side Flight requests. This was not absence of an RSC request, a late listener, a charset-parameter parsing failure, a redirect being mistaken for data, or a cached response being counted.

The decisive failure was response lifecycle: the browser reported `requestfailed / net::ERR_ABORTED` for navigation streams before `requestfinished`, even in an experiment that paused after the Day click. URL/render readiness and `networkidle` did not guarantee a readable completed Flight body. The old collector correctly excluded those aborted streams, leaving no completed RSC evidence. Diagnostic instrumentation sometimes changed timing enough to allow one stream to complete; that accidental pass was not accepted as the deterministic repair. No specific internal garbage-collection/cancellation stack or the separate development Server Action transport root cause is claimed.

The test-only recipient context now observes native `window.fetch` responses and drains `response.clone().arrayBuffer()` for exact same-origin `/qv` RSC responses. It returns the original response to Next unchanged. This supplies an independent full-body consumer before the application receives the stream; no additional request, mocked response, synthetic payload, production change, new route or application interaction is introduced. Actual request traces with the observer show successful completion rather than the earlier aborted requests.

Before the **existing user-visible Day button click**, the test registers a bounded `requestfinished` wait for the exact date/view, same origin, fetch resource, `RSC: 1`, non-prefetch, HTTP 200 and exact media type. It then requires `response.finished()` to succeed and reads the full body through Playwright. It positively verifies that the request carried the already-established HttpOnly bearer cookie. Failure of the clone reader cannot satisfy any privacy gate: successful network completion, full readable body and all negative/positive assertions remain mandatory. No arbitrary sleep was added to the browser journey.

The full Day body must exclude **all five existing private sentinels** (ordinary/meal notes, restricted location, preset description and arbitrary custom reporting prose) and include the actual fixture item IDs, project name, published state, date, both work times, staffing counts, meal total, contact, provider and menu. Empty/unrelated payloads therefore cannot pass. The passive collector still reads every completed HTML/RSC/JSON body and fails on private text or an unreadable completed body. Exact normalized media types handle parameters and cannot accept a lookalike MIME type. Rendered UI, desktop/mobile inspector, admin positive, generic read-only negative, clean URL/session and revocation assertions are retained unchanged.

### Five consecutive isolated proof runs

Each run used the final tracked browser script without temporary changes, a **new local production build**, a newly started owned loopback preview, new browser contexts/fixtures and disabled real providers. The proof finished at `2026-09-28T18:19:48.577Z`; ignored local evidence is `.local/rsc-capture-five-build-proof.json`.

| Run | Fresh build | Browser exit | Populated completed Day RSC | Completed HTML / RSC / JSON bodies | Notifications and cleanup |
| --- | --- | --- | --- | --- | --- |
| 1 | PASS | 0 | 7,578 bytes; all assertions PASS | 5 / 3 / 0 | Four ledger fingerprints unchanged; zero fixture residue |
| 2 | PASS | 0 | 7,578 bytes; all assertions PASS | 5 / 3 / 0 | Same |
| 3 | PASS | 0 | 7,578 bytes; all assertions PASS | 5 / 3 / 0 | Same |
| 4 | PASS | 0 | 7,578 bytes; all assertions PASS | 5 / 3 / 0 | Same |
| 5 | PASS | 0 | 7,578 bytes; all assertions PASS | 5 / 3 / 0 | Same |

The recipient route made **no separate browser `application/json` response**: its client props are serialized in HTML/Flight, whose full bodies were inspected. The collector retains JSON inspection for any such response; the direct bearer RPC regression additionally verifies the actual JSON server projection. No fake JSON request was introduced to inflate browser evidence. No privacy assertion is skipped or removed. Providers are disabled by environment and an explicit test guard; complete fingerprints of assignment deliveries, welcome deliveries and communication operations/recipients remain unchanged in every isolated run. The script's finally-cleanup asserts zero workspace/Auth residue; each owned preview exits. All five runs also report no production-build Server Action transport error.

### Additional fresh verification and release SHA reconciliation

- **PASS:** complete checked-in `task-details-release-verification.mjs` from clean committed fix `49a1fa5`, including fresh build, complete desktop/mobile Calendar/Bulk, Project Day/authenticated Quick View, five actually persisted edit/preview/apply journeys, full volunteer responses/max-length dialogs and the repaired bearer/admin/generic browser boundaries. Owned server/fixtures are cleaned.
- **PASS, serial real local database suites:** assignment-instructions security; bearer share-access/privacy and privilege; volunteer schedule access and responses; function privilege. These preserve exact 80-function policy, admin positive/generic negative/raw-table denial, cross-workspace/anonymous/expired/revoked bearer denial, own saved volunteer instructions, response controls, meal null/zero/positive operational fields and permitted staffing names/statuses.
- **PASS:** assignment-notification email claim/finalize/composition, resend fake-network safety and notification health. Recording/fake providers exercise expected disposable test behavior; there is zero real provider traffic/email and fixture cleanup passes. These are distinct from the five browser runs' unchanged notification fingerprints.
- **PASS:** ESLint, TypeScript, exact approved-content release contract and diff whitespace. No application screenshot change is needed; the capture mechanism leaves the approved UI intact.
- Approved payload **`6aeb38275e8bf9fc2d78c5dcb7b3c391185eb583`**, reviewed harness **`f4821e8dbe81722ac149b349f5e15a66ff6525e2`**, and test-fix HEAD **`49a1fa54434904ca949f2ebfc44010876580597b`** have **identical** `app/`, `components/`, `lib/`, `proxy.ts` and both feature migrations. The fix commit changes one browser-test file only. Its LF-canonical SHA-256 is `5836eb87b7a2ce7fc55591d9071ea3c34c46e241dccbe403f39972a5408f3fe2`.

The final documentation HEAD is identified with its full SHA in the repair handoff as the potential eventual release candidate; it changes evidence only, not approved application behavior. No commit was fast-forwarded to master or deployed. Fresh `git ls-remote` still reports `ca54020`. This task deliberately does **not** restart the full production release, refresh production preflight/backup artifacts or manipulate the backup task. The prior 43-migration/old-lock production evidence remains historical; the permanent task must be left Enabled/Ready at that lock. All known limitations below remain, including development transport, reported production latency, assigned-person ellipsis and disabled site-map uploads.

## Historical stopped release verification — 2026-09-28

The intended production application SHA was explicitly reconciled as **`f4821e8dbe81722ac149b349f5e15a66ff6525e2`**. `git diff 6aeb382 f4821e8 -- app components lib proxy.ts supabase/migrations` is empty, and the checked-in release-contract verification passes: approved application ancestry, both exact LF-canonical migration hashes, 45-file repository ledger and precisely two ordered pending migrations. The reviewed final contract is `20260927120000-transition-v1`. This SHA was **not pushed or deployed**. Any subsequent documentation commit is release evidence, not a new deployed application or automatically approved release SHA.

Fresh `git ls-remote` before checks and after the stop both reported the expected `origin/master` baseline. The tracked checkout was clean at gate entry. The exact baseline-to-reviewed-HEAD inventory has 110 paths: approved instructions/privacy/Calendar history correction, tests, harness, documentation and synthetic design evidence. Architecture previews are outside the Vercel application root; there are no generated preview archives, enabled map uploads or Batch 3 application changes. The known sibling release-check/preview directories remain untracked and excluded. One screenshot regenerated by the failed runner was restored to its reviewed version; no test or application source was changed to obtain a pass.

| Freshly executed check | Result |
| --- | --- |
| ESLint / `npx tsc --noEmit` | PASS. |
| Release-contract validation | PASS: unchanged approved application and migration contents; exact ordered terminal contract. |
| Fresh local production build | PASS through the checked-in `task-details-release-verification.mjs` runner. |
| Complete Calendar/Bulk Assignment Planner desktop/mobile browser regression | PASS through that runner. |
| Project Day and authenticated Quick View browser boundaries | PASS through that runner. |
| Instruction edit / future preview / selected apply | All five end-to-end journeys PASS, including actual database persistence. |
| Complete volunteer-response browser regression and maximum-length dialogs | PASS, including desktop, 390px and 320px dialogs, response persistence and safeguards. |
| Bearer Quick View browser privacy / completed serialized payload verification | **FAIL:** `project-quick-view-share-access-browser-regression.mjs:370`, `No completed RSC payload inspected.` The full runner exits nonzero. |
| Two isolated repeats of the same checked-in bearer browser script | Both FAIL at the same assertion against the fresh production build. The checked-in script is unmodified; providers are disabled; disposable fixture cleanup completes and the owned preview stops. |
| Remaining required standalone data/Auth/RLS/security/notification/responsive/backup/recovery/public-smoke gates | **NOT freshly rerun after the essential gate failed.** Prior results above/below are historical and cannot substitute for a complete resumed-release pass. |

The bearer test reached the final completed-payload checks after its UI, inspector, meal-operational, admin/read-only and revocation assertions. The HTML-presence assertion passed, but no successfully read completed response was classified as `text/x-component`. This is missing verification evidence, **not a reported instruction leak and not proof that no leak exists**. The subsequent all-payload safety assertion was not reached. The underlying capture/navigation cause remains unverified; do not resolve it by removing the required RSC assertion, counting canceled/unread bodies as inspected or changing the approved Calendar behavior.

**Exact next step:** diagnose and narrowly repair the browser harness so it deliberately obtains and awaits a genuine completed bearer RSC response, retains every instruction/custom-prose, operational, authorization and revocation assertion, and passes unmodified from a clean committed checkout. Review any harness change and reconcile its new HEAD against the unchanged approved payload. Then restart **all** release gates and refresh live evidence before opening the controlled migration window. No application or harness repair was made in this stopped attempt.

### Fresh production/backup evidence and stop validation

- The existing authorized browser session opened production Overview in the correct LDC workspace. This is baseline session evidence only; no post-release smoke or volunteer/bearer production journey is claimed. No email/resend or assignment/response edit was invoked.
- Permanent task `Project Local Production Backup` is Enabled / Ready / not running, exact old lock `20260922150000`, daily 03:15 local with StartWhenAvailable. Last run was `2026-09-28T16:38:53Z`, result `0`; next normal run is `2026-09-29T09:15:00Z`. Exported task XML before/after is identical, preserving action, principal, cadence, destination, retention, encryption and notification arguments. No task disable/enable/update/start occurred.
- Fresh independent verification of `project-local-production-20260928T163915Z-efce08db.zip.age`: **320,669 bytes**, SHA-256 **`fe92863a7eeeba6824537fd3efe5a8c698385b1c9c19cdf2d89855af94e48d75`**, matching safe status timestamp `2026-09-28T16:39:15.4889754Z`. In-memory decryption verifies the standard six members, every manifest dump length, correct project/ref and terminal `20260922150000`; backup destination SQL/ZIP/plaintext/partial/temp residue is zero. No new backup was initiated or claimed.
- Fresh read-only production preflight passes for the validated production Session Pooler/database `postgres`. Repeatable-read snapshots at `2026-09-28T18:00:34.518052Z` and `2026-09-28T18:02:07.298675Z` confirm **43 migrations**, terminal `20260922150000`, **26 public tables**, **72 public functions**, PUBLIC EXECUTE zero, no instruction history table and photo uploads disabled. The metadata-only snapshot contains the original column lists for future schema-aware comparison.
- **All 29 relation counts and full-row fingerprints match:** every public table, `auth.users`, `storage.buckets` and `storage.objects`. Migration ledger, function metadata and policies also match. Assignment-notification deliveries remain **168**, volunteer-welcome deliveries **261**, communication operations **8**, communication recipients **289**. No delivery rows increased and no tracked volunteer, task, Calendar, assignment, response, grant, project or storage data changed during this attempt. Ignored local snapshots contain only metadata/counts/digests, not exported row bodies.
- Production deployment preparation, final migration security postflight, controlled lock transitions, Vercel Production/Ready verification for the candidate and post-release smoke remain **unexecuted**. All retained limitations below remain in force; map uploads stay disabled.

## Historical first-attempt lock failure

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
