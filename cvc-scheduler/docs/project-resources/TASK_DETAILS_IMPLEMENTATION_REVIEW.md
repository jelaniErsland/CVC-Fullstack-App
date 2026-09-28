# Simplified task details — final release verification

Reviewed September 27, 2026 on `codex/simplified-task-details`, starting at `36005b7`, with the final blocker pass continuing from `0b529f8`. **Development only: no merge, production migration, deployment, real email, or backup configuration change. Site-map upload remains disabled.** The refreshed full Calendar browser and local security gates pass. Release still requires the explicit bearer instruction-audience decision below and final owner approval. This report does not authorize release.

## Baseline and diff

`git ls-remote --heads origin` confirmed production/master at `ca54020ef3f8e8ecc55bcd46f7fedf1331a56923`. This branch descends from it through Batch 2 documentation/test closeout (`b7c0e96`, `e2eeed8`), original architecture (`edd1114`), approved simplification (`0248eec`), and implementation (`36005b7`). Those earlier documents and safe previews remain intentionally included; generated preview archives are absent from the tracked diff.

Actual available performance fixes are **`9ddd492` (authenticated admin read waterfall)** and **`09e242d` (Calendar critical path)**. Both are ancestors of production and this branch. `49ff482` is earlier investigation documentation, not the only available performance work. No newer local/remote performance branch or alternate worktree was discoverable. Compare any subsequently supplied performance commit before release.

Application changes against production remain the Tasks route/editor, instruction helpers/types, approval field in the existing Calendar preset selector, occurrence-editor wording, volunteer disclosure, and pending instruction migration. Verified admin context, Calendar read-query parallelism, assignment response actions, notification delivery, photo/storage and backup scripts have no feature diff. The final blocker pass adds a seven-call native-history correction in Calendar: pass null to Next.js-backed replaceState so router refresh/reload retains the selected item and close clears it. No query/performance helper or authorization contract changes accompany that correction. The verified migration ACL corrections remain intact; no migration is added or altered in this final pass.

Preexisting untracked release-check and 12.47/Batch 1 preview directories remain untouched and excluded. No unrelated work is included.

## Approved behavior retained

- Authorized `tasks.edit` contacts edit the existing 2,000-character description. Gray multiline questions are placeholder suggestions, never saved content. Exact preset versions guard saves; legacy descriptions are not silently approved for copying.
- New non-meal occurrences copy approved instructions into `schedule_notes`. Nonblank exceptions survive. Existing occurrences are not backfilled or changed by preset saves. Existing Calendar editing supports individual instructions up to 4,000 characters with its original concurrency guard.
- Future apply previews exact occurrences and prior text, requires `tasks.edit` plus `calendar.edit`, current preset/item versions, and dates after today in the project timezone. Manual exceptions, history, unrelated workspaces/presets and other contacts' drafts are excluded. A stale later target rolls back earlier targets; unselected items remain unchanged.
- Private revisions preserve prior wording and whether an occurrence was published. Soft archive preserves history. Instruction operations never send notifications; urgent communications remain a separate reviewed workflow.
- Nonblank saved occurrence text appears under the native shared Assignment details disclosure in the existing volunteer dialog. Paragraphs and response controls remain intact. Empty text adds no panel. No map upload is activated.

## Executed checks

All database/browser suites used loopback Supabase, Docker fixtures, pinned CLI **2.111.0**, and disabled real provider credentials. Checked-in tests ran without temporary modifications. Notification provider errors/success logs are simulated or recording cases, not real outgoing email.

| Gate | Final result |
| --- | --- |
| Full quality | PASS: `npm run lint`, `npx tsc --noEmit`, fresh local `next build`, `git diff --check`. |
| Fresh-production browser journeys | PASS: five consecutive complete Tasks browser runs. Postgres verifies preset text/approval, unchanged occurrence before explicit apply, applied text/provenance/version/draft state, zero scoped delivery rows. Desktop 1280px/mobile 390px. |
| Complete volunteer-response browser | PASS, not instruction-only mode: current home/full schedule, actual Confirm, Can't make it plus saved note, Confirm All, reload persistence, 48-hour restriction, token removal, anonymous denial, focus/scroll and cleanup. Final DB responses checked individually; item/assignment fingerprints unchanged and scoped deliveries zero. |
| Maximum instructions | PASS: exact 2,000 and 4,000 characters at 1280×900, 390×844 and 320×640. Keyboard disclosure, internal scrolling/end marker, both response controls reachable/visible when focused, always-visible close, focus wrapping, Escape/restoration, no horizontal overflow. |
| `tasks-management-regression.mjs` | PASS: real Auth/RLS; view-only, role-only, revoked, expired, inactive, cross-workspace and anonymous denial; history/exception/unselected preservation; preset and item conflicts; atomic multi-target rollback; cleanup. Latest 30-item bounded local month read **30 ms**. |
| `assignment-instructions-security-regression.mjs` | PASS: exact catalog/ACL, private RLS history and sequence, denied direct reads/writes, defaults, trigger-only functions, no new anonymous/bearer RPC. |
| `function-privilege-regression.mjs` | PASS: **77 functions: 10 anonymous, 49 authenticated, 18 internal**; PUBLIC zero; defaults/future functions denied; actual anonymous mutation denial; triggers preserved; zero residue. |
| `tasks-read-model-contract-regression.mjs` | PASS: scoped route/RPC contract and no mock fallback. |
| `calendar-read-model-contract-regression.mjs` | PASS: persisted projection and assignment-derived coverage. |
| `calendar-route-cutover-stabilization-regression.mjs` | PASS: bounded navigation/contact/workspace context. |
| `calendar-edit-validation-regression.mjs` | PASS: normalized times/malformed-edit denial. |
| `calendar-item-management-regression.mjs` | PASS: create/edit/archive, isolation/direct-write denial. |
| `calendar-source-selection-regression.mjs` | PASS: preset/custom creation and occurrence editing. |
| `calendar-assignment-management-regression.mjs` | PASS: atomic assignment/cancel/coverage/capabilities. |
| `calendar-publication-visibility-regression.mjs` | PASS: owner-only drafts, publish and assignment/token gating. |
| `volunteer-schedule-access-regression.mjs` | PASS: own instructions, hashed credential, cross-volunteer filtering, revocation/direct-table denial. |
| `volunteer-schedule-responses-regression.mjs` | PASS: persisted responses/notes/bulk confirmation, start/48-hour locks and token parity. |
| `concurrent-admin-safety-regression.mjs` | PASS: one winning edit, duplicate prevention, no archive resurrection. |
| `operational-usability-privilege-regression.mjs` | PASS. |
| `project-local-table-privileges-regression.mjs` | PASS: exact centralized grants/fail-closed defaults. |
| `project-quick-view-share-access-regression.mjs` | PASS: real bearer retrieval, isolation/expiry/revocation/draft exclusion; existing published-note, current-description, post-preset-edit and custom-value visibility explicitly asserted. |
| `project-quick-view-privilege-regression.mjs` | PASS: sharing/admin mutations denied to recipients. |
| `assignment-notification-email-regression.mjs` | PASS: claim/finalize ledger, explicit send, deduplication/retry/eligibility, recording transport and cleanup. |
| `resend-initial-assignment-email-regression.mjs` | PASS: disabled/recording/fake-provider paths, idempotency and credential-safe failures. |
| `assignment-notification-health-regression.mjs` | PASS: authenticated bounded read, isolation, no ledger access/mutation, generated type/schema parity, cleanup. |
| `verified-admin-context-regression.mjs` | PASS: request client/Auth reuse, parallel RLS reads, fresh mutation Auth. |
| `admin-navigation-performance-harness.mjs` | PASS after matching the fixture to production-established automatic Breakfast/Lunch presets and deleting its own seeded presets on cleanup. Exact call/stage assertions unchanged: helper Calendar 8 remote calls/5 critical stages at simulated 100/250/400 ms delay. |
| Complete `calendar-regression.mjs` | PASS: all desktop/mobile sections against the fresh local production build; current Bulk Assignment Planner, 52 active/ready candidates (including the already assigned person), preview/deduplication, multi/single save, actual saved notes/responses, reload/cancel, item context, capability denial, project isolation, editing/publication, focus, body scroll and notification safety. No section skipped. |
| Project Day/authenticated Quick View browser | PASS: the same checked-in Calendar script's separately documented Project Day mode; read-only views, authorized project selection, guessed-project/anonymous denial, route/date context and mobile sheets. |
| Bearer Quick View browser | PASS: actual share/access/cookie/recipient routes, desktop and mobile inspector notes/current preset description/custom values, no editing actions, revocation and clean URL; no audience change. Expiry is exercised by the real bearer data suite. |
| Batch 2 navigation/responsive regressions | PASS: `12-48-batch-2-double-click-regression.mjs`, `12-48-batch-2-day-navigation-regression.mjs`, `12-48-batch-2-regression.mjs`, `12-48-calendar-layout-regression.mjs`. Current copied components in isolated synthetic fixture on 3148; normal/enlarged 320–1440px, agenda reachability, single/double click separation, Day links/history, stable controls/time columns and rosters. These complement actual authenticated/bearer browser tests; they do not substitute for them. |
| `bulk-assignment-regression.mjs` | PASS: actual preview/apply persistence, two-admin concurrency, duplicate/replay prevention, exceptions, response preservation, stale edit/archive rollback, workspace/anonymous denial, zero email. |

The final pass reran **24 checked-in local data/security suites**, listed above, with zero failures. The source/contract gates retain the same security assertions. Current bearer tests add positive evidence of the existing notes, description and custom-value exposure rather than mistaking their absence from summary rows for privacy.

## Calendar harness reconciliation and narrow repair

The deployed `ca54020` source already uses `BulkAssignmentPlanner`, not the retired search/filter/sort picker. Its eligible list includes assigned volunteers and explicitly skips duplicates in the preview. The regression now selects with keyboard/checkboxes, waits for the server preview (including re-preview after changing a note), verifies that preview writes nothing, and checks persisted new assignments while an existing confirmed response remains byte-for-byte unchanged. Multi-item cancellation waits for the actual row/control removal, avoiding a stale repeated notice URL. Own-run bulk ledger fixtures are removed before their referenced items. Complete journeys also assert zero scoped assignment/welcome deliveries and unchanged foreign-project Calendar/assignment/response/profile fingerprints.

Mobile expectations now match production's Month date-selection agenda and Open Day action, current More wording/destination labels and Create item control. All original relevant focus, response, editing, access and scrolling assertions remain. Desktop search/filter/sort assertions for the retired picker are replaced with current planner selection, preview and persistence coverage; no Batch 3 picker is implemented. The existing mobile assigned-volunteer context sheet retains keyboard-cycle coverage using its actual optional visible description, while Calendar dialog ARIA description checks remain mandatory.

The test exposed a real production-established URL bug: passing `window.history.state` (containing Next.js `__NA`) to `replaceState` bypassed router synchronization. Bulk save's refresh then restored the old canonical URL, dropping the selected item before reload. The seven Calendar native-history calls now pass null, per the installed Next.js guide; Next itself preserves its internal tree and synchronizes the canonical URL. This keeps replacement history semantics, dates/project context and filters, and fixes save/reload and close behavior without adding reads or changing backend logic. The original route-context assertions were retained, not worked around with a forced deep-link reload.

Known baseline limitation: the desktop assigned-person context ellipsis sets a profile surface whose renderer sits inside the retired picker branch, so it does not reveal a panel beside the unified planner. The mobile context sheet still works. This existed in `ca54020`; it is documented rather than claimed as tested desktop context or expanded into a picker/inspector redesign.

One earlier browser attempt failed on Chromium `net::ERR_NO_BUFFER_SPACE` during a resource load. It was not suppressed or counted as a pass. The final fresh-build run reports no browser/server errors. Subsequent test-only timing fixes wait for actual preview/row state rather than arbitrary sleeps.

Reproduce all real production-build browser proof: `npm run test:task-details-release`. This checked-in runner refuses an occupied port, uses pinned CLI 2.111.0, builds fresh, owns a loopback production preview on 3001, clears inherited partial-test flags, runs the complete Calendar, separate Project Day/authenticated Quick View, five full Tasks journeys, complete volunteer-response/max-length test and actual bearer Quick View browser suite, then stops its server in `finally`. No temporary script changes or skipped failing sections are needed. Security: `npm run test:assignment-instructions-security`. Data suites: `node scripts/final-product-readiness-local.mjs --conditions=react-server --no-warnings --experimental-strip-types scripts/<suite>.mjs`.


## Server Action reliability

The existing long-running webpack development server logged `SyntaxError: Unexpected end of JSON input`, followed by an incomplete browser Server Action response, during preview/apply. One trace used the former form-action implementation; another occurred after status-return/refresh changes. The affected development apply did not persist. Logs do not establish whether hot-reload state, development transport or another cause is responsible: **root cause remains unresolved**.

Fresh production builds pass five consecutive save → preview → selected apply journeys with actual DB checks, no corresponding server/browser transport errors, and the complete response test. This distinguishes the observed development failure from the tested build; it does not prove intermittent errors impossible. Further dev-only investigation needs a fresh isolated runtime and request/response diagnostics, without concealing failure behind success UI.

## Migration security review

- New RPCs `update_task_preset_description(uuid,text,timestamptz)` and `apply_task_preset_instructions(uuid,timestamptz,jsonb)` are postgres-owned SECURITY DEFINER with empty pinned search paths. Exact EXECUTE: authenticated/service_role only; PUBLIC/anon denied. Both reject absent `auth.uid()` and recheck active contact, grant, capability and workspace. No runtime service-role credential is added.
- Three exact trigger helpers maintain snapshots/provenance/private history as owner. Direct EXECUTE is revoked from PUBLIC, anon, authenticated **and service_role**. Installed triggers still execute. Inventory allows these three internal definers only; the other 15 internal helpers stay invokers and unknown signatures fail.
- History RLS is enabled with zero client policies. PUBLIC/anon/authenticated table access is revoked. Separate Supabase sequence defaults had granted anon/authenticated access to the new identity sequence: an explicit revoke was added. Inherited service-role EXECUTE on trigger helpers was also removed. These corrections were applied and verified locally only, in the still-unapplied production migration.
- Postgres-created table/function PUBLIC/anon/authenticated defaults stay denied. Ordinary platform sequence defaults are distinct; the protected sequence is explicitly revoked without altering managed global defaults. Privileged owner/service-role maintenance remains possible. Client direct Task/Calendar mutations and history retrieval are denied.
- Exact workspace/preset/item identity, owner-only drafts, date/version checks and locks constrain apply. Historical/manual exceptions are rejected. Stale preset/item errors retain SQLSTATE `40001` and established conflict details; all target/audit changes roll back together.
- No existing RLS, authentication, token RPC or notification function is changed. Anonymous clients cannot invoke new edit/apply RPCs; personalized volunteer access remains scoped to its existing authorized schedule.

**Bearer audience decision remains open.** The [exact exposure and restriction proposal](QUICK_VIEW_INSTRUCTION_PRIVACY_REVIEW.md) inventories raw fields, actual desktop/mobile inspector placement and all active consumers. Production exposes saved notes, current (not snapshotted) preset descriptions and custom values. The smallest restriction would be a reviewed forward migration nulling both text fields only in the bearer RPC, preserving own-volunteer/admin/email consumers. It would remove legacy general notes too. Custom-value prose and authenticated read-only contacts need explicit policy decisions if absolute assignee/admin privacy is intended. No contract or migration was silently changed.

## Visual comparison and evidence

Compared editor/preview and volunteer dialog against approved simplified synthetic previews and previous implementation captures. Typography, restrained borders, paragraph spacing, the single disclosure chevron, alignment and response hierarchy remain consistent. Desktop retains its modal; mobile retains its sheet with pinned close/header and one internal scroll region. No duplicate indicator, overflowing title, squeezed response controls or unreachable close/focus target was found. At maximum length, responses remain below the instructions and are reachable by scrolling/keyboard; they are not a fixed footer. The deferred site-map link is absent from application UI.

Old generated QA titles made captures artificially tall. Capture fixtures now use readable synthetic task names; no application layout change was needed. The [screenshot gallery](../previews/assignment-instructions/README.md) contains desktop/mobile editor, preview/apply and closed/open/max-length response states, including 320px. People, contacts and instructions are fictional.

## Remaining release requirements

1. Approve the current project-wide bearer instruction audience, or approve the proposed narrow restriction and its treatment of custom values/read-only contacts. Until then, privacy readiness is unresolved.
2. Provide final release approval; the complete legacy Calendar/browser gate is now green.
3. Retain unresolved dev-transport and production-performance limitations. **30 ms for 30 local items and artificial-delay helper tests do not resolve reported production slowness** or measure a real busy production month. Reconcile any newer performance ref supplied later.
4. Production migration, release-lock/backup compatibility, pre/post fingerprints, scheduled backup health and authorized smoke are future approval-gated release steps, not executed or implied here. Map activation separately requires the exact approved file and encrypted disposable restore proof: [integration readiness](SITE_MAP_INTEGRATION_READINESS.md).
