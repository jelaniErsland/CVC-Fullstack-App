# 12.57 — Pre-activation reminder preview correction

Baseline NO-GO candidate: `bc9555012745c143e58aa06682060100bbf85160`. This correction is local only. No production query, schema mutation, deployment, Cron/Vault/worker credential setup, activation or real provider call was performed during this fix.

## Root cause and corrected contract

The old read selected only materialized reminder occurrences. Migration 53 correctly creates none and leaves activation NULL, so six real assignments produced zero preview rows. The earlier browser fixture set an activation baseline before testing history; it did not cover pre-activation planning.

`read_assignment_reminders(workspace, after?)` now returns two distinct projections in one authorized read:

- `prospective`: hypothetical server time/timezone, scope, inspected count, continuation cursor, and assignment classifications with prospective or existing reminder entries.
- `rows`: additional recorded occurrence history. Identities already included in the planning page are removed from this history list; their outcome/attempt/event information appears inline instead. No second hypothetical copy of an existing logical occurrence is generated.

The normal public RPC always supplies `statement_timestamp()` to internal `assignment_reminder_report(workspace, clock, after?)`. There is no client clock/baseline argument. Controlled-clock tests call that owner-only helper. Both functions are STABLE; the helper contains only reads and local computations. The UI sends only an optional UUID cursor and reauthorizes the current workspace on every call. No private dataset or baseline is stored in browser storage.

The UI says **Preview if activated now**, **Hypothetical planning**, **Would enroll** and **Excluded**. It explicitly says results are not enrolled when the real baseline is NULL. Actual assignment start and proposed reminder due times are distinct, in authoritative project timezone. No schedule/send/activation control exists. The section remains collapsed initially, reads once when opened, retains its result when closed/reopened, and has finite loading, error/Retry and request-ownership handling.

## Policy calculations

- Unenrolled existing pending assignment: hypothetical T +3 project-local calendar days, then every three local days until start. Show the first prospective occurrence and cadence explanation. Exclude it if that first occurrence is at/after start; do not use historical notification cadence for activation backfill.
- Existing pending enrollment: retain its real immutable pending anchor and advance to its next future ordinal. No reset or catch-up.
- Confirmed: local-calendar 30/14/7/3/1-day thresholds strictly after T and strictly before actual start. Five days before start yields only 3-day and 1-day. A matching existing logical identity uses the recorded due/status, even if sent/failed/unknown/superseded, rather than proposing another one.
- Exclusions: canceled/inactive assignment/item/project, draft, meal/info-only, declined/missing actionable response, inactive/on-hold volunteer, invalid destination, already started, no remaining pending occurrence/confirmed threshold.
- Overnight timing uses actual START. Spring/fall DST conversion is shared with the actual reminder engine. No browser-local arithmetic.

## Bounds and pagination

One workspace per authorized request. Scope is assignment Calendar start dates **today or later in that workspace's timezone**; prior-date history is outside the planning page. An assignment already started earlier today is included as excluded. An overnight shift that started on a previous date is not a new reminder target.

Indexed future-item discovery uses existing workspace/date and workspace/item assignment indexes. A page reads 100 assignment contexts plus one assignment-ID sentinel; a UUID keyset cursor continues within the same workspace. Each page uses fresh server time, explicitly shown in the UI. Refresh/First page starts over; Next assignments replaces the page. Concurrent operational changes can alter pages; this is a planning view, not a frozen activation commitment.

Maximum response: 100 assignment rows, up to five reminder entries each (500), plus up to 200 additional recent history occurrences. Each existing occurrence's audit list caps at 25 events. Current page/history overlap is deduplicated by occurrence ID. No global total is claimed without visiting pages. No unbounded historical assignment scan or per-card network request.

History is limited before calculating live context/audit. Added `assignment_reminder_history(workspace_id,due_at DESC,id)` is supported by a 10,000-history-row before/after plan. Existing discovery, initial-anchor and due-queue indexes remain intact.

## Database / security boundary

Revised the **undeployed migration 53** `20261021120000_assignment_reminders_phase_a.sql`; no migration 54. The four scheduling relations and provider/delivery state machine are unchanged. Delivery remains false, activation NULL, and migration creates zero enrollments/occurrences.

Existing internal report and authorized read signatures gained only an optional assignment cursor. The system worker's unused `preview` command was removed: worker identity has no access to this admin planning projection. Grant categories still total **102 functions** (10 shared anonymous, 1 anonymous-only, 59 authenticated, 31 internal, 1 system-only), PUBLIC execute **0**. RLS/FORCE RLS, table privileges and workspace composite FKs remain intact. Rollback drops the revised signatures and retains its history-preservation refusal.

Projection exposes authorized assignment/volunteer names, response, start/due times, classification/reason, redacted destination, and recorded reminder outcomes/audit metadata. No raw email, bearer/worker credentials, email body, instructions or private profile fields. Shared-inbox people remain separate assignment identities. `SEC-12.57-01` is unchanged and separate.

## Verification

`scripts/assignment-reminders-preview-regression.mjs` covers:

- Original six-assignment, false/NULL/zero-occurrence failure: now six prospective rows.
- Pending +3, <3/start/48h cases; confirmed >30/20/10/5/2/<1 days and exact threshold; exclusions; shared household; spring/fall DST and overnight start.
- Existing active/sent/failed/unknown/sending/superseded states with audit metadata and no duplicate hypothetical identities.
- Admin capability/grant revocation, wrong workspace, anonymous/ordinary unauthorized/service/worker callers, absence of a client-controlled clock, and removal of the worker preview command.
- Thirty SELECT-only reads, each inside a read-only transaction, with before/after counts/full-row fingerprints for **every public table**, contracted Auth users/identities, and public/Auth sequence values/called state. Identical throughout. This includes activation, enrollment, occurrences/events, Communications operations/recipients/coverage, notification deliveries, tokens and audit state.
- Historical-heavy fixture: 10,000 historical assignments, 111 future assignments; pages 100 and 11, unique IDs, correct continuation and no empty trailing page. Ten thousand expired occurrences exercise bounded history.

Retained local-only EXPLAIN (`12-57-evidence/preview-explain.json`): discovery **0.493 ms**, recent history **1.816 → 0.153 ms**, full hypothetical/history read **31.292 ms**. These are fixture measurements, not production latency claims.

Full existing reminder policy/concurrency/unknown/retry tests passed against a clean migration replay, including forced failure with ledger insertion, all-old-data preservation, empty rollback and history-bearing rollback refusal. Exact function/table/grant/instruction/Quick View checks and existing welcome/schedule/resend/unknown Communications and volunteer response/token regressions passed locally.

Desktop 1280 px and mobile 390 px browser gates passed against the final production-mode Turbopack build: initially collapsed/zero preview reads, one read on opening, hypothetical copy, assignment start and proposed due time, eligible/excluded groups, redacted destination, close/reopen, no overflow, finite failure/Retry, missing-auth worker rejection, and actual unknown-outcome history with reconciliation copy. Preview did not change recorded recipient/event counts. External network requests were blocked; provider calls zero. Six email template previews still rendered correctly.

Existing production-mode browser gates passed: server-authoritative Communications review/resend, volunteer schedule/access/Confirm/decline cutoff, Quick View serialized/RSC privacy, full normal-latency Calendar desktop/mobile including local fixture save/cancel, and Overview/command palette/shortcuts/capabilities/typing safety/rapid history navigation. Local command acknowledgement samples were approximately 1.9–5.2 ms; this preview fix makes no production navigation-speed claim.

Final TypeScript, full ESLint and whitespace gates passed. Credential scan covered 658 text files: no unexpected matches, with 17 reviewed synthetic backup-test URIs in files unchanged from the production baseline. No credential was introduced. Exact function policy passed after the revised migration; PUBLIC execute remains zero.

Canonical validation root: `C:\Users\mtfis\Documents\Codex\2026-10-21\project-local-12-57-preview-validation`. Fresh lockfile install, real node_modules directory, local-only configuration, no provider/worker credentials. Final guarded Next 16.2.7 builds both passed, each starting without a prior .next output: Webpack compile **8.5 s** and Turbopack compile **3.6 s**. Both printed `Project Local: verified guarded Next.js 16.2.7 router source` before compilation. Final logs are `project-local-12-57-preview-webpack-final.log` and `project-local-12-57-preview-turbopack-final.log` beside the validation root. Runtime source was unchanged after those builds; subsequent changes are test/evidence/docs only.

Lockfile/dependency versions are unchanged; clean npm install retains 14 inherited dependency-audit advisories, outside this preview correction. Synthetic screenshots/email previews are retained at `C:\Users\mtfis\Documents\Codex\2026-10-21\previews\12-57-reminders`.

Changed files from the NO-GO candidate: `components/AssignmentReminderHistory.tsx`; `lib/notifications/assignmentReminders.ts`, `reminders.actions.ts`; `lib/supabase/database.types.ts`; migration 53 and its rollback; `scripts/function-privilege-policy.mjs`, `assignment-reminders-browser.mjs`, new `assignment-reminders-preview-regression.mjs`; `package.json` (test command); exact function-policy documentation, architecture/correction reports and EXPLAIN evidence. No unrelated product, notification transport, volunteer or framework-guard change.

Final commit SHA and clean-tree confirmation are returned to the owner; no push or deployment is performed.

## Release boundary

This fixes the prospective-preview NO-GO. It does not complete production release prep or authorize deployment. Resume fresh production preflight, migration-52 encrypted checkpoint/isolated restore, backup transition tooling and the remaining controlled-release gates separately. All Phase B exclusions remain: no Cron, Vault/worker credential provisioning, provider wiring, real activation baseline or sending.
