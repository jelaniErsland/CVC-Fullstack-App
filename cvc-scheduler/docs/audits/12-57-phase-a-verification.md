# 12.57 Phase A verification

Implementation and verification completed locally on 2026-10-21. Baseline application: `17fc942aff4b749ec29bb6690d124d97c63301b5`. Production baseline supplied by owner: 52 migrations / `20261015120000`; it was not queried or changed in this implementation phase. This document belongs to the final candidate commit reported to the owner.

**Real provider calls: ZERO. Real emails: ZERO. Production mutations: NONE. No deployment, production Cron, Vault secrets, worker credentials or backup-task changes. Reminder delivery remains disabled.**

## Architecture and delivery boundary

- Reviewed scheduler template: Supabase Cron every five minutes, pg_net POST to the authenticated private `/internal/reminders` endpoint, request secret from Vault. Template only; no job installed. Local worker/RPC and template contracts tested directly; hosted Cron/Vault execution still requires release verification.
- Worker credential must be a finite, unexpired JWT for `project_local_reminder_worker`; ordinary admin/service-role credentials are rejected before network access. Server verifies JWT authenticity. Worker role has only schema usage and execution of one reminder dispatcher; no direct tables, broad admin RPCs or activation capability.
- Delivery defaults false, activation baseline null, no enrollment or delivery occurrence is created by migration. Hosted Phase A code has **no provider adapter**. Only explicit local simulator injection exercises sending. Phase B requires separate owner approval, deliberate wiring to the existing single-recipient transport, infrastructure verification and prospective activation.
- Reuses `communication_operations` / `communication_recipients` and their ready/sending/sent/failed/unknown outcomes. Four new relations hold activation/cursors, enrollment, durable occurrences and append-only events. Workspace-scoped composite FKs protect identity. There is no second provider state machine.
- One migration: `20261021120000_assignment_reminders_phase_a.sql` (local migration 53). Empty-phase rollback is provided separately and refuses to remove enrollment/delivery history. No destructive backfill.

## Policy and controlled-clock results

| Requirement | Local result |
| --- | --- |
| Pending cadence | First successful initial delivery +3 project-local calendar days; subsequent three-day ordinals. Intentional resend does not reset the stored anchor. Existing assignments use activation baseline +3 days. Before/exact due and later ordinal tests passed. |
| Confirmed thresholds | 30/14/7/3/1 local calendar days before actual start; only thresholds strictly after confirmation/enrollment and activation. Exact instants and adjacent-second checks passed. Confirmation five days before start enrolled only 3-day and 1-day. |
| Response cutoff | Pending continues inside 48 hours; copy permits Confirm and redirects changed plans to an approved Follow-up Contact. None is invented when absent. At/after start no reminder. Existing Confirm/decline server-cutoff regressions passed. |
| Response changes | Claim-time and final pre-dispatch validation rejects changed response, cancellation, inactive profile/item and changed schedule. Confirmed work uses threshold reminders rather than pending cadence. Existing admin reset to needs_response resumes the original pending anchor prospectively. |
| Reschedule | Recompute unsent future timing, append old schedule/attempt history, preserve sent/sending/unknown threshold identity. Sent threshold was not reopened after moving the assignment. |
| Timezone / overnight | Authoritative workspace timezone; local-calendar arithmetic before conversion. Spring/fall DST, nonexistent/repeated local times and overnight actual-start cases passed. PostgreSQL's timezone resolution applies to DST gaps/folds. |
| Shared household | Two volunteers sharing one address had two independent identities/claims. No aggregation, email deduplication or new bearer credentials. |
| Start / exclusions | Declined, canceled, inactive/unready volunteer, archived/unpublished/non-actionable items excluded by live context. Meal items excluded. No use of overnight end as a second target. |

## Concurrency, retry and audit

Two simultaneous real local PostgreSQL workers contended for the same occurrence: **one claim and one claimed event**, hence one provider opportunity. Duplicate scheduler invocation cannot reclaim a sent/sending/unknown identity. Uniqueness is workspace + assignment + volunteer + kind + occurrence, never email.

Simulated accepted, unknown, timeout, process interruption and lost-finalization outcomes never became automatic retryable failures. Only definite rejection retries after five then ten minutes, maximum three attempts, and only within the 15-minute due window. The existing transport was tested with an injected fetch fake for accepted/rejected/unknown outcomes and provider idempotency keys. No real provider request occurred.

Assignment/response/version/destination are revalidated immediately before dispatch. An external provider and a database cannot commit atomically; there remains a gap between validation and acceptance. Sending/unknown outcomes require human reconciliation rather than risking duplicate mail. No impossible exactly-once external delivery guarantee is claimed.

Safe sweep aggregates include start/end, evaluated, eligible, claimed, sent, definite failures, unknown, skipped reasons and continuation. No message body, bearer, secret or raw provider error is logged. Missing configuration fails closed with finite HTTP error. Client preview has timeout/retry and invalidates stale responses.

## Communications, preview and email

- Collapsed **Automatic reminders / Delivery disabled · Phase A** section. Initial page makes zero reminder reads; opening makes one authorized read. Existing manual history, recipient review and resend authority are preserved.
- Read-only preview shows volunteer, assignment, response, type/key, due time, eligibility reason, redacted destination, attempt/outcome and audit events. At most 200 occurrences and 25 events per occurrence. Snapshot count remained unchanged by preview. Eligible rows sort before future/history rows. No claim/send control or rule editor.
- No new Needs Attention issue category: existing awaiting-response semantics remain. Invalid destination, exhausted rejection and uncertain outcomes are visible progressively in Communications.
- Pending template and all five confirmed templates rendered at 390 and 1280 px. Exact AM/PM date/time, project/task and lookup action preserved. Confirmed copy never requests reconfirmation. Pending cutoff copy distinguishes the available response options. Approved support contact wording is retained when needed.
- Reminder payload/email omits coworker data, instructions, notes, private profile fields and bearer links. Uses existing public lookup/household chooser, not another access architecture. Multiple assignments remain separate assignment-specific deliveries; no digest system added.
- Browser gates passed at desktop/mobile: lazy read count, read-only state, disabled label, preview failure/retry, private endpoint rejection, no horizontal overflow and no external requests. Latest focused rerun passed after final SQL ordering change.

## Query plans and bounds

All numbers below are **local fixture timings, not production latency claims**. Retained JSON plans are in `12-57-evidence/`.

| Probe | Fixture | Before | Final / after |
| --- | --- | ---: | ---: |
| Discovery | 10,000 historical active assignments + two future rows | 15.030 ms; assignment-first historical walk | 0.196–0.277 ms on final runs; indexed future-item-first bounded lateral read |
| Initial-delivery anchor | 10,000 historical coverage rows | 0.346 ms; sequential coverage probe | 0.023 ms; partial assignment coverage index |
| Due queue | 10,000 expired occurrences | New functionality | 0.049–0.062 ms on final runs; active partial due index |
| Actual atomic claim function | Same historical-heavy fixture | New functionality | 5.901 ms; one delivery claim/event, no provider call |

Discovery pages 200 assignments, ten pages/workspace/run, with persisted continuation cursor. Worker covers at most 20 active workspaces/run and 20 due occurrences/workspace. Preview/audit are bounded. Three evidence-supported indexes: active due queue, occurrence audit history, initial-notification coverage anchor. No full historical assignment scan in the final discovery plan.

## Migration and security proofs

- Forced failure, including migration-ledger insertion in the same transaction: ledger remained 52, existing function definitions/owners/ACLs, public data, RLS/policies/constraints/default grants unchanged; no partial reminder objects survived.
- Clean apply: ledger 53 / `20261021120000`, all pre-existing public rows preserved, default disabled/null baseline/zero occurrences. Empty rollback and replay passed; history-bearing rollback refusal is covered.
- New four tables have RLS + FORCE RLS, no direct PUBLIC/anon/authenticated/service-role/worker access. No existing broad table or RLS access was added.
- Exact function policy: **102 functions** = 10 shared anonymous + 1 anonymous-only + 59 authenticated + 31 internal + 1 system-only. PUBLIC execute **0**; defaults and future postgres-created functions denied. Negative worker-grant drift checks passed. Direct anonymous mutations denied; target changes/residue zero.
- Project/capability grants, Quick View bearer isolation, assigned-contact privacy, volunteer schedule-token isolation, instruction redaction and authoritative Communications review/send regressions passed locally.
- Instruction-security regression had a pre-existing CRLF extraction mismatch even in canonical Git export. Normalized both operands and fixed function terminator extraction; added LF/CRLF equivalence assertion. Existing privacy assertions retained. Exact regression passed in canonical export.

## Existing application and build gates

Passed local application/fixture regressions: Communications transport/ledger/dispatcher/batches (including welcome, initial reviewed schedule, intentional resend and unknown outcome); verified admin context; project grants; table/function policy; volunteer schedule responses/access; Overview persisted; Needs Attention; command definitions; assigned-contact contracts.

Passed production-mode desktop/mobile browser regressions: Overview, Needs Attention, Communications review/resend, Volunteers management, volunteer schedule/details/response cutoff, shared-household lookup/remembered context, full normal-latency Calendar (all views, return, filters, picker, local save/cancel, mobile More/focus), command palette/shortcuts/typing safety/rapid return, Quick View privacy, dedicated assigned-volunteer contact card and shared Quick View contact privacy. Operational fixture writes were local only and cleaned up. No real provider calls.

Final TypeScript, full ESLint and whitespace checks passed. Credential scan found no real credentials; 17 synthetic connection-URI matches in existing backup regressions were reviewed as test false positives, with both files verified unchanged from the approved baseline. Migration ordering passed: 53 unique versions, terminal `20261021120000`. Dependency versions and lockfile are unchanged.

Fresh canonical install used Node 24 and Next **16.2.7** without the external node_modules junction. Both actual build paths passed:

- Webpack: `next build --webpack`, guarded-router receipt before compilation; compile 14.9 s.
- Turbopack: `next build`, guarded-router receipt before compilation; compile 3.4 s.

Logs retained locally at `C:\Users\mtfis\Documents\Codex\2026-10-21\project-local-12-57-webpack.log` and `project-local-12-57-turbopack.log`. Both include the final runtime TS/TSX implementation; subsequent changes were SQL, tests, evidence and documentation, independently reverified. Synthetic browser/email screenshots are retained in `project-local-12-57-validation\previews\12-57-reminders` beside the canonical validation checkout.

## Changed files

- Runtime: `app/internal/reminders/route.ts`; `lib/notifications/assignmentReminders.ts`, `reminderWorker.server.ts`, `reminders.actions.ts`; `lib/supabase/database.types.ts`.
- UI: `components/AssignmentReminderHistory.tsx`, `CommunicationsWorkspace.tsx`.
- Database: migration and empty-phase rollback `20261021120000_assignment_reminders_phase_a.sql`; `supabase/scheduler/assignment-reminders.sql.example`.
- Tests: `scripts/assignment-reminders-regression.mjs`, `assignment-reminders-worker-regression.mjs`, `assignment-reminders-browser.mjs`, `assignment-reminders-anchor-plan.mjs`; exact function policy/regression and instruction-security regression.
- Documentation/config examples: `.env.example` (blank worker settings), `package.json` (test command only), `docs/FUNCTION_PRIVILEGE_POLICY.md`, architecture/verification reports, five EXPLAIN JSON artifacts. No dependency or production configuration change.

## Remaining risks / release-planning prerequisites

1. **Delivery is intentionally not activation-ready in Phase A.** Hosted Cron/Vault/JWT setup, credential rotation, worker endpoint verification, prospective baseline inspection, provider wiring and real delivery require separately approved Phase B work. Migration/deployment never authorizes real sends.
2. Five-minute sweep with 15-minute lateness tolerance deliberately expires missed windows rather than backfilling after long outages. Unknown/sending outcomes require reconciliation. Review these operational tradeoffs before activation.
3. Bounded worker currently supports up to 20 active workspaces; add workspace-level continuation before exceeding that limit. Per-workspace assignment continuation already exists.
4. `SEC-12.57-01` remains **OPEN**: pre-existing bulk Communications shared-household bearer-link discrepancy. New reminders use public lookup and do not copy or alter that behavior. Track remediation separately.
5. Production schema/deployment and backup transition 52→53 require normal controlled release planning; none of that tooling or production state was changed here.

Phase A is ready for release planning, with sending still disabled.
