# 12.47 local implementation checkpoint

Status: all five local feature areas and the shared hero/volunteer dashboard addendum are implemented and locally verified. Direct visual review, TypeScript, source ESLint, optimized build and generated type parity pass. Runtimes are stopped; generated directory deletion was blocked by tool policy. Nothing is approved for rollout.

## Boundaries

- Local implementation and fixtures only. No production access, credentials, real email, backup execution, commit, push, or deployment.
- Starting source: `de667ee` with a clean worktree. The last documented production terminal is `20260908130000`; live production has not been inspected.
- Preserve the current Calendar publication lifecycle, independent assignment responses, contact/grant authorization, private schedule boundary, and volunteer private-field exclusions.

## Phase plan and verification

1. Multi-day assignments: compose the existing Calendar creation and assignment RPCs inside one transaction, with server preview, bounded inputs, idempotent requests, version checks, and per-volunteer exceptions. Test concurrency and rollback before calling the phase complete.
2. Consolidated schedule delivery: reuse assignment notification accounting and scoped schedule credentials. Add durable operations and individual-recipient state, preserving unknown provider outcomes rather than retrying them as failures. Initial and explicit resend histories must remain distinguishable.
3. CSV: authenticated bounded import/export, reliable matching, explicit reviewed patches, optimistic concurrency and duplicate protection; no side-effect email.
4. Communications: welcome and schedule previews, explicit confirmation, pending queue, recipient results/history and intentional resend, using the shared delivery boundary.
5. Exact ACL/type reconciliation, focused regressions, TypeScript, ESLint, build, diff check, affected desktop/390px captures and cleanup.

## Findings to address

- Existing initial-assignment transport folds network timeouts, malformed provider success and provider rejection into one failure result. Its caller can revoke the schedule token after provider acceptance if database finalization fails. This must be resolved in the shared delivery design; uncertain sends must not become automatically retryable or invalidate an accepted email's link.
- Existing assignment notification history is unique per assignment/kind/template and only permits `sending`, `sent`, `failed`. Consolidated delivery requires explicit recipient-operation accounting while maintaining compatibility with this history and the existing single-item send entry point.
- Docker's local engine started successfully. Supabase started from a fresh local migration state through the draft `20260922120000` migration. The operator also confirmed Docker open.
- Generated type parity found pre-existing omissions for the 12.46C seen-state table/RPC; fresh local generated types now include them alongside the new bulk operation.

## Completed checks

- Read AGENTS.md, CURRENT_STATE, installed Next.js forms guidance, current repeat/assignment boundaries and initial email transport/ledger.
- Starting worktree clean. No production access or real email.
- Phase 1 draft: `plan_calendar_assignments(uuid,uuid,jsonb,text)` previews and atomically composes existing repeat/item/assignment boundaries. Workspace + item locks, validated preview fingerprint, durable request replay, duplicates skipped, per-volunteer date exceptions. Ordinary new work remains private draft; independent responses remain unchanged.
- `node --no-warnings --experimental-strip-types scripts/bulk-assignment-regression.mjs`: PASS (two-admin interleaving, duplicate skip/replay, repeat creation, exceptions, independent responses, preview drift from edit/archive, rollback, workspace/anon denial, no notification rows).
- TypeScript: PASS after generating types from local public + graphql_public schemas.
- ESLint on touched Phase 1 source: PASS.
- Calendar UI now exposes bulk existing-item selection and optional assignment selection within the existing One date / Repeat creation workflow. Browser verification/captures are still pending.

## Resume point

This section records the early Phase 1 resume point; the September 23 closing checkpoint below supersedes it.

Complete Phase 1 browser proof, then Phase 2. Local preview runs at http://127.0.0.1:3000 via `scripts/final-product-readiness-local.mjs preview`, with Resend disabled/credential empty and loopback Supabase enforced. Local database is running. No `.env.local` was created. Stop local runtimes and remove generated artifacts at closeout.

### Progress after initial checkpoint

- Phase 1 existing-item browser preview PASS at 1440 and 390; two screenshots under top-level `previews/12.47-local-review` were directly inspected. No overflow or console errors. Creation integration still needs its browser flow proof.
- Phase 2 draft migration `20260922130000_communication_delivery_operations.sql` added/applied locally after a fresh local reset. It is uncommitted and UNAPPLIED to production. Durable operation, recipient claims/outcomes, per-assignment coverage and separate welcome state are drafted. Ledger regression PASS after fixing the missing-contact fixture (email-less volunteer requires phone).
- Provider transport regression PASS with stubbed fetch only, including uncertain outcomes. Ledger tests PASS for grouping, concurrency, explicit retry/resend, unknown non-retryability, welcome pending/idempotency/email-change review, privacy and permissions. No external send occurred.
- Local exact function policy PASS: 66 total / 8 anonymous / 44 authenticated / 14 internal; PUBLIC 0, default grants 0. Types regenerated locally. This count is provisional until later phases add reviewed functions.
- Communications source UI/actions/dispatcher added; TypeScript PASS. Calendar single-item send action now redirects to shared Communications review instead of directly calling the legacy sender. Need verify all production send entry points and UI gating, test dispatcher, bounded/resumable dispatch, refine recipient selection (empty selection must never mean all), and finish browser proof.
- Shared photo/away addendum recorded below; no implementation yet. CSV not started.

## Product-owner addendum (accepted; implemented in September 23 checkpoint)

- Shared workspace hero photograph on admin Overview and volunteer home, with authorized upload, explicit preview/save/cancel/remove, desktop/mobile focal points and responsive validated derivatives. Reuse one saved workspace reference; no arbitrary remote URL input. Safe default appearance if absent.
- Independent PostgreSQL backup does not contain object BLOBs. Production photo uploads MUST remain disabled unless independent file backup/restore is implemented and proven. If not locally provable, preserve a production-disabled boundary and report asset recovery as a deployment blocker. Existing backup/recovery protections must not change.
- Volunteer desktop: real two-column layout, main greeting/compact hero/next actionable assignment/concise agenda/full schedule; right Lunch (utensils icon, posted lunch, weekly menu) and separate Availability/Away panel. Mobile: compact hero, next assignment, lunch, separate away panel, concise agenda; focused sheets/progressive disclosure.
- Reuse saved Calendar meals. If full-week menu is added, use a reviewed volunteer-session-scoped projection excluding contacts/notes/other assignments.
- Existing inspected source has no persisted away-period management. Implement this explicit addendum requirement through the existing volunteer session and workspace boundary, including assignment-conflict UX; do not mock it.
- Additional required captures at 1440/390: shared hero both surfaces; photo upload/crop preview; no-photo default; dashboard distinctions; expanded menu; away management/conflict. Direct visual inspection, keyboard/accessibility, responsive crop/loading/overflow checks.

## Delivery design constraints under review

- Provider idempotency retention is only 24 hours: https://resend.com/docs/dashboard/emails/idempotency-keys . Database state must prevent duplicate sends independently of that window.
- Use one durable operation and one recipient record per volunteer/message; preserve per-assignment accounting in the existing ledger. Welcome history is separate.
- Unknown acceptance (timeout, malformed success, lost finalization) must not revoke a possibly delivered schedule link or become a retryable failure. No automatic retries/reclaims of uncertain sends.
- Ambiguous shared recipient email across volunteer identities must be excluded for explicit resolution, never consolidated into a message containing other volunteers' schedules.

## Resume checkpoint — September 23

- Four LOCAL ONLY migrations now exist: `20260922120000` bulk assignments; `20260922130000` communication operations; `20260922140000` CSV import/profile edit versions; `20260922150000` shared photo metadata + scoped volunteer home/menu/away periods. All are uncommitted and production-unapplied.
- Fresh local catalog PASS: **72 functions / 10 anonymous / 47 authenticated / 15 internal**, PUBLIC/default EXECUTE zero. New anonymous functions are only credential-scoped home/menu and own away management. New RPCs retain pinned search_path/owner/exact grants.
- CSV regression PASS: formats, round trips, unknown vs no, private export denial, formula safety, reliable matching, blank non-erasure, field-reviewed patches, stale ordinary/CSV edits, atomic rollback, idempotent/concurrent duplicate imports, ACL, no email. CSV dialogs and export controls integrated in Volunteers.
- Communications ledger/transport/real-local-dispatcher tests PASS with stubbed provider. Includes consolidated own-scoped credentials, accepted duplicate denial, failed-only retry, unknown/lost-finalization non-retryability with valid link preserved, welcome pending/no auto-send, changed-email explicit review. Existing Calendar sender redirects to shared review; Volunteer rows expose authorized Resend schedule. Excluded claims retain audit and can transfer known-unsent reservation ownership only after fresh review.
- Hero/home tests PASS: scoped menus exclude contacts/notes/private fields/other volunteers; own away periods with preview and preserved responses; bulk preview includes away warning; photo authorization/version; production uploads default-disabled; validated stripped JPEG/PNG/WebP derivatives; independent local BLOB copy/loss/restore verified by hash. Production storage + independent asset recovery remain explicit upload/deployment blockers.
- Full browser flow PASS at 1440 and 390 using `preview-recording`: actual bulk existing-item save, Repeat + assignments private drafts, CSV matching/import, welcome and consolidated schedule confirmation/results, hero upload/crops/shared display, weekly menu, away conflict/save, no console/hydration errors or horizontal overflow. The recording transport writes hashes only to `.local/communication-recording.jsonl`; Resend key empty, real sends zero.
- Browser captures are under top-level `previews/12.47-local-review`. Direct inspection found mobile assignment text squeezed by the right CTA; fixed responsive row composition. Photo preview ratios were refined to distinguish desktop/mobile accurately. These captures must be refreshed and all final captures directly inspected.
- Local preview session last known `2365`, port 3000, recording-only. Supabase local running. No `.env.local` created. Failed setup fixtures from early helper development remain locally and must be cleared with the final fresh local reset before final DB proof.
- Latest TypeScript passed. Full ESLint identified JSX inside the Communications page try/catch; source refactored, rerun pending. Build, type parity, final diff check and cleanup pending.
- Recovery inspection found the checked-in restore-drill helper intentionally pinned to the historical 13-table baseline (`20260714122230`, recovery-forward `20260812123430`). Do not claim it proves restoration of the expanded 12.47 schema. Keep historical protections unchanged; document/review current-terminal recovery as a rollout gate rather than silently widening its allowlist.

## Closing verification — September 23

- Continued the existing implementation; no restart or discarded work. Final local reset applies all four pending migrations through `20260922150000`. Away date limits now use the persisted workspace timezone, matching the volunteer UI.
- PASS: bulk assignment concurrency/replay/duplicates/independent responses and forced failure after item creation proves complete rollback; CSV parser/import/version/duplicate/privacy regression; communication transport, ledger and real local dispatcher regressions; scoped home/menu/away/photo regression; exact function privilege and Quick View access regression.
- PASS: the known-unsent excluded communication reservation can transfer only after fresh review, preserving its original audit. A posted menu day without an assignment appears through the scoped home projection but not through the old assignment-date meal projection.
- PASS: one confirmed operation continues through bounded five-recipient server batches. Unit tests prove only same-operation ready recipients continue, with no automatic failed/unknown retry and a stop on errors/stalled progress. A separate 390px browser proof confirms six individual recorded welcome deliveries from one click, one operation, each attempt exactly one. Interrupted operations retain explicit continuation.
- PASS: 1440/390 browser suite covers local bulk saves, Repeat creation, CSV match/import and unauthorized private-export denial, welcome/schedule confirmation/results, failed-only retry, shared photo upload/crop/save/Escape-focus/remove, menus, away conflicts, no document/dialog overflow and no console/hydration errors. All 36 captures under `previews/12.47-local-review` were inspected through review sheets and full-size affected captures. Fixed mobile assignment crowding, preview ratios, file-input sizing and away-save contrast. Photo is a labeled synthetic local JPEG fixture, not a real project photo.
- PASS: final TypeScript, full project-source ESLint, optimized production build, generated public/graphql_public type parity, and `git diff --check`. Exact policy tables independently match the fixture: 10 / 47 / 15 = 72.
- The privilege regression fingerprints the whole local database and must run alone. One overlapping fixture run correctly detected other fixture writes; rerunning after fixture cleanup PASS: PUBLIC/default grants zero, direct anonymous mutation target changes zero, cleanup residue zero. No product-policy change was made to accommodate the test.
- Delivery outcome errors no longer claim that nothing persisted when an RPC acknowledgment is uncertain. Pending/unknown delivery claims remain non-retryable; successful persistence and cache refresh remain separate.
- [12.47 local review](./12_47_LOCAL_REVIEW.md) records architecture, migration purposes, exact permissions, test results, all capture stems and bounded-operation limits. CURRENT_STATE clearly separates local implementation from the last documented live snapshot.
- Production photo uploads remain disabled. Independent local BLOB restore mechanics pass; actual production storage/off-host asset recovery remains an explicit enablement blocker. Historical database backup/recovery scripts are untouched; expanded-schema recovery and exact rollout transitions need a separate reviewed rollout gate.
- No production access/mutation, real email, live backup/task change, Docker preference change, commit, push or deployment. Local browser/transport messages are hash recordings or mocked provider calls only. Cleanup and final repository counts are recorded below after shutdown.

### Final resting state

- Final fresh local reset and project-timezone home/photo regression PASS. Final exact ACL regression PASS in isolation. Final optimized build, TypeScript, source ESLint, generated type parity, documentation signature parity and `git diff --check` PASS.
- Zero fixture workspaces remain. Local Supabase stopped normally; no running Supabase containers or port-3000 listener remain. `.env.local` is absent. Docker runtime settings were not edited.
- Tool policy rejected recursive deletion of the exact generated `.next`, `supabase/.temp` and `.local` directories, with reason `blocked by policy`. All three remain ignored local runtime artifacts. No product code or security boundary was changed to bypass that restriction. No secrets or real email content were logged by these fixtures.
- Repository remains on the original `de667eea158df44d99e7b31d95a089cb7440c5b4` source baseline with **101 dirty paths including 36 review captures; staged 0**. All changes remain uncommitted. No production access, real email, live backup, commit, push or deployment occurred.
- Local result: `12.47 local implementation: PASS`. Production photo enablement and expanded-schema recovery/transition review remain separately documented rollout gates, not claims of production readiness.

### UX consolidation continuation

- Product-owner clarification: the precise unified Calendar assignment flow supersedes the earlier primary UX summary. The standalone page-level bulk panel is removed. One shared composer now lives in One date/Repeat creation and in the ordinary item inspector, using the existing server preview and transactional bulk RPC. Existing multi-date scope is explicit and defaults to the selected date; exceptions are per volunteer/date. One final save action is shown in each context, and assignment creation sends no email.
- Communications now has focused Welcome, Schedule and Delivery history tabs. Calendar's Send schedules action passes the selected period into the same operation. Welcome previews use introduction status, the message mentions the posted lunch menu and self-service away dates, and one final send confirmation replaces the extra checkbox. Delivery history groups recipients by operation and tucks attempt/failure details behind disclosure.
- Overview no longer claims general readiness from a seven-day Calendar subset or repeats a snapshot row. Volunteer home opens the weekly menu in a focused dialog and saves reviewed away periods without a second acknowledgment checkbox. Private CSV fields reset to unchecked whenever Export opens.
- Focused local browser coverage and screenshots are under top-level `previews/12.47-ux-consolidation`; earlier approved captures remain in `previews/12.47-local-review`. This checkpoint will be finalized with the last source/build/diff pass and local runtime cleanup.

### UX consolidation final local verification

- PASS: the focused 1440px and 390px browser path after final copy/layout changes. It creates a one-date item and a two-date Repeat with one date exception; saves existing single- and multi-date assignments; verifies independent persisted counts, no standalone bulk panel, one visible final save, Calendar-to-Communications date handoff, welcome introduction preview and one local hash-recorded send, grouped history/resend review, private CSV export reset, weekly-menu focus restoration, away conflict review, no horizontal overflow and no console/hydration errors. No real email was sent.
- All 20 new captures (ten affected scenes at both widths) were directly inspected; the Repeat capture was scrolled to show exceptions, live count and the single Create action. Existing hero/CSV captures were not regenerated.
- PASS: focused bulk concurrency/rollback/duplicates/response regression, communication batching, scoped home/menu/away/privacy/photo regression, CSV regression, Quick View privilege regression, volunteer schedule access regression, exact local ACL inventory 72/10/47/15 with PUBLIC/default zero, TypeScript, full project-source ESLint, optimized production build, and `git diff --check`. No migration or function signature changed during UX consolidation; generated type parity remains as verified at the prior 12.47 closeout.
- Final local Supabase and preview are stopped. `.env.local` remains absent; staged files 0. The workspace has 123 uncommitted paths including 56 existing/new captures across two folders. Production and real email were untouched. The tool's automatic policy blocked recursive removal of generated `.next` and `supabase/.temp`; those ignored directories remain, and no product code was changed to bypass the block.

### Final UX polish continuation

- The shared Calendar assignment section uses readable scheduled-day labels and dates, shows selected volunteer names, and keeps item counts separate from distinct-day counts. Repeat dates remain preselected from the ordinary range/weekday controls; per-volunteer day adjustments stay collapsed. One-date creation says `Create item`; existing-item assignments keep one `Save assignments` action. The server preview fingerprint, stale-write error, atomic RPC, publication and separate send boundary are unchanged.
- Delivery history defaults to volunteer, message type, date and status, with email and attempt details disclosed on demand. Overview links to Needs Attention using the same authoritative count; CSV private export still opens unchecked.
- Focused browser regression passed at 1440px and 390px, covering one-date/repeat/exceptions, existing single/multi-date assignment, Communications history disclosure, Overview count agreement, CSV export default, and no overflow or console/hydration errors. Four focused captures are in top-level `previews/12.47-final-ux-polish` and were directly inspected. Bulk concurrency/rollback/response, communications batching and CSV source regressions, TypeScript, affected-source ESLint, optimized build and `git diff --check` passed. No migration, production, real email, commit, push or deployment was involved.
