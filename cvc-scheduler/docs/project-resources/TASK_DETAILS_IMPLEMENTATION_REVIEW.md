# Simplified task details — final release verification

Reviewed September 27, 2026 on `codex/simplified-task-details`, starting at `36005b7`. **Development only: no merge, production migration, deployment, real email, or backup configuration change. Site-map upload remains disabled.** Targeted instruction verification passes; the older complete Calendar browser harness is not green. This report does not authorize release.

## Baseline and diff

`git ls-remote --heads origin` confirmed production/master at `ca54020ef3f8e8ecc55bcd46f7fedf1331a56923`. This branch descends from it through Batch 2 documentation/test closeout (`b7c0e96`, `e2eeed8`), original architecture (`edd1114`), approved simplification (`0248eec`), and implementation (`36005b7`). Those earlier documents and safe previews remain intentionally included; generated preview archives are absent from the tracked diff.

Actual available performance fixes are **`9ddd492` (authenticated admin read waterfall)** and **`09e242d` (Calendar critical path)**. Both are ancestors of production and this branch. `49ff482` is earlier investigation documentation, not the only available performance work. No newer local/remote performance branch or alternate worktree was discoverable. Compare any subsequently supplied performance commit before release.

Application changes against production remain the Tasks route/editor, instruction helpers/types, approval field in the existing Calendar preset selector, occurrence-editor wording, volunteer disclosure, and pending instruction migration. Verified admin context, Calendar read-query parallelism, date navigation, assignment response actions, notification delivery, photo/storage and backup scripts have no feature diff. This verification adds tests, evidence, documentation and narrow ACL corrections to the unapplied migration, with no further application behavior.

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
| `tasks-management-regression.mjs` | PASS: real Auth/RLS; view-only, role-only, revoked, expired, inactive, cross-workspace and anonymous denial; history/exception/unselected preservation; preset and item conflicts; atomic multi-target rollback; cleanup. Latest 30-item bounded local month read **111 ms**. |
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
| `project-quick-view-share-access-regression.mjs` | PASS: real bearer retrieval, isolation/expiry/revocation/draft exclusion; existing published-note visibility explicitly asserted. |
| `project-quick-view-privilege-regression.mjs` | PASS: sharing/admin mutations denied to recipients. |
| `assignment-notification-email-regression.mjs` | PASS: claim/finalize ledger, explicit send, deduplication/retry/eligibility, recording transport and cleanup. |
| `resend-initial-assignment-email-regression.mjs` | PASS: disabled/recording/fake-provider paths, idempotency and credential-safe failures. |
| `assignment-notification-health-regression.mjs` | PASS: authenticated bounded read, isolation, no ledger access/mutation, generated type/schema parity, cleanup. |
| `verified-admin-context-regression.mjs` | PASS: request client/Auth reuse, parallel RLS reads, fresh mutation Auth. |
| `admin-navigation-performance-harness.mjs` | PASS after matching the fixture to production-established automatic Breakfast/Lunch presets and deleting its own seeded presets on cleanup. Exact call/stage assertions unchanged: helper Calendar 8 remote calls/5 critical stages at simulated 100/250/400 ms delay. |
| Complete `calendar-regression.mjs` | **FAIL: obsolete picker workflow**. Fresh production preview passes auth denial, default Month, all four views/navigation, filters, inspector focus, Day/Month creation focus, List selection and real create/edit/publish/reload. Then expects 51 candidates in retired `data-picker-scroll`, while production already uses `BulkAssignmentPlanner`. Later mobile sections did not execute. No failing section was removed/skipped. |

Creation selectors in the older Calendar test were reconciled to production's existing **Create item** label and this stage's occurrence-details label, preserving persistence/focus assertions. Replacing its entire retired picker test is a separate harness task; application behavior was not altered to make the old test pass. Its current failure is reported, not counted as a successful gate.

Reproduce build/browser proof: `npm run test:task-details-release`. This checked-in runner refuses an occupied port, builds fresh, owns a loopback production preview on 3001, runs five full Tasks journeys plus the complete volunteer-response test, and stops its server in `finally`. The broader Calendar harness was executed separately; it is not hidden inside a green combined result. Security: `npm run test:assignment-instructions-security`. Data suites: `node scripts/final-product-readiness-local.mjs --conditions=react-server --no-warnings --experimental-strip-types scripts/<suite>.mjs`.

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

**Existing bearer visibility needs explicit review acknowledgement.** Production's `read_project_quick_view_by_token` already returns published `schedule_notes` and preset descriptions. New instructions reuse those fields, so a valid project bearer link can read published operational text under that existing contract. Drafts, private revisions, editing and other projects remain inaccessible. The architecture's “no new instruction projection” shorthand must not be interpreted as assignee-only text privacy. If assignment-only confidentiality is required, deliberately narrow and test that existing projection before release. No product-policy change was made here.

## Visual comparison and evidence

Compared editor/preview and volunteer dialog against approved simplified synthetic previews and previous implementation captures. Typography, restrained borders, paragraph spacing, the single disclosure chevron, alignment and response hierarchy remain consistent. Desktop retains its modal; mobile retains its sheet with pinned close/header and one internal scroll region. No duplicate indicator, overflowing title, squeezed response controls or unreachable close/focus target was found. At maximum length, responses remain below the instructions and are reachable by scrolling/keyboard; they are not a fixed footer. The deferred site-map link is absent from application UI.

Old generated QA titles made captures artificially tall. Capture fixtures now use readable synthetic task names; no application layout change was needed. The [screenshot gallery](../previews/assignment-instructions/README.md) contains desktop/mobile editor, preview/apply and closed/open/max-length response states, including 320px. People, contacts and instructions are fictional.

## Remaining release requirements

1. Refresh the complete older Calendar browser harness for the established bulk planner, retaining assignment persistence, isolation, response and notification assertions, and rerun all desktop/mobile sections before claiming that gate green.
2. Acknowledge current bearer visibility of published instructions, or require a reviewed narrowing before release.
3. Retain unresolved dev-transport and production-performance limitations. **111 ms for 30 local items and artificial-delay helper tests do not resolve reported production slowness** or measure a real busy production month. Reconcile any newer performance ref supplied later.
4. Production migration, release-lock/backup compatibility, pre/post fingerprints, scheduled backup health and authorized smoke are future approval-gated release steps, not executed or implied here. Map activation separately requires the exact approved file and encrypted disposable restore proof: [integration readiness](SITE_MAP_INTEGRATION_READINESS.md).
