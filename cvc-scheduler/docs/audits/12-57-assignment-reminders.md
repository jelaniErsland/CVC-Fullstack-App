# 12.57 Assignment reminders — Phase A

Delivery is disabled in the database by default AND no production provider adapter is wired to the worker in this phase. Deploying/migrating cannot send a reminder. No production Cron job, Vault secret or worker credential is provisioned. Production remains untouched.

## Architecture

Supabase Cron's reviewed five-minute SQL template calls the authenticated private POST `/internal/reminders` worker. Vault supplies the request secret; the worker separately uses a short-lived server-held JWT whose database role is `project_local_reminder_worker`. That non-login, non-inheriting, non-bypass-RLS role has only schema USAGE and EXECUTE on one system-only dispatcher RPC. It cannot query tables, call ordinary admin functions, activate delivery or impersonate a human coordinator. The database authenticates the JWT; an additional local check rejects accidentally configured admin/service-role credentials. Setup/rotation and hosted Cron verification remain owner-controlled release work.

Official scheduler semantics: https://supabase.com/docs/guides/functions/schedule-functions (pg_cron + pg_net + Vault). The template is NOT an applied migration. Local tests exercise its contract directly because local Docker does not have hosted Cron extensions installed.

Reuse `communication_operations` and `communication_recipients` for typed system reminder deliveries, existing states, attempt count, claim identity, provider outcome, and private audit snapshots. New tables hold activation, assignment enrollment, unique scheduled occurrences, and append-only schedule/attempt events; they do not duplicate provider delivery state. Composite workspace FKs, RLS/FORCE RLS and no direct application-role table access protect these records. Existing admin claim/finalize functions explicitly reject reminder recipients. Reminders are excluded from manual send/resend history and appear in a separate progressive section within the SAME Communications page.

## Cadence / activation

Activation baseline starts null; delivery defaults false. There is no activation RPC or admin toggle. An owner-reviewed later setup establishes the baseline while disabled, verifies previews and infrastructure, and separately authorizes Phase B delivery code. Existing assignments anchor pending cadence at that baseline, first reminder +3 project-local days; no activation storm. New assignments anchor at their first successful initial delivery, preserving the first observed anchor across intentional resend. Successful initial Communications coverage supplements the legacy ledger to preserve the earliest successful notification time.

Pending occurrences are +3 local calendar days, not UTC-day durations. They stop on response/cancel/inactive/start; inside the absolute 48-hour cutoff Confirm remains possible and decline is not offered. Email directs changed plans to a real assigned Follow-up Contact or explicitly says none is listed, with existing elders/project congregation volunteer contact guidance.

Confirmed thresholds: 30/14/7/3/1 local days before START; only due instants strictly later than confirmation/enrollment AND activation are enrolled. Local arithmetic precedes timezone conversion. Exactly at a threshold is eligible; at/after actual start is not. Overnight end never creates another target. Rescheduling moves unsent future thresholds, logs supersession, and preserves prior recipient snapshots/attempts. A sent/sending/unknown threshold is NEVER reopened, even after rescheduling. Confirmed→needs_response is an existing admin response operation: it resumes the original pending anchor without historical catch-up and starts only upcoming applicable occurrences.

Five-minute sweeps support a **15-minute lateness window**, including retry delay. Beyond it, pending occurrences expire rather than generating catch-up bursts; confirmed occurrences outside the queue window are not sent. This deliberately favors no backfill over guaranteed eventual delivery after an outage. Real dispatch is on the next successful sweep, not second-accurate. A third retry fits only when its due window remains open.

## Claim / failure / race model

Atomic row locking/SKIP LOCKED plus workspace/assignment/volunteer/type/occurrence uniqueness grants one claimant. Provider idempotency is additional defense, not the durable proof. Only definite rejection can retry (5-minute then 10-minute delays, at most 3 attempts). Unknown/timeout/malformed acceptance/lost finalization/process interruption remain reserved and require reconciliation. Never convert uncertain acceptance to retryable failure.

Immediately before simulated dispatch, reread active assignment/project/profile/response/start, recipient and version tuple. Changed/canceled records are excluded. Database state and an external provider cannot be one transaction: there remains an irreducible gap after final validation and before external acceptance. No exactly-once external delivery claim is made.

The Phase A engine accepts only an explicitly injected simulator. The hosted route never passes one, so it cannot invoke a provider regardless of environment switches or database activation state. Later Phase B must deliberately wire the existing `sendSingleRecipientMessage` abstraction under separate approval; it must retain the same claim/unknown semantics and stable provider key. Existing initial/welcome/manual transport is untouched.

## Privacy / email

Reminder snapshots contain only assigned task/date/time/project, the intended volunteer/destination, approved Follow-up Contact, and internal version/claim metadata. No instructions, notes, coworker details, profile fields or access tokens. Emails link to the existing public lookup entry `/`, not a new bearer, password, code or magic-link architecture. Separate shared-inbox volunteers remain separate occurrences/messages; no email-address deduplication or household aggregation. Exact times reuse existing 12-hour AM/PM formatting without seconds/leading zero.

Response and five confirmed templates distinguish response needed from upcoming confirmed work. Confirmed reminders do not request reconfirmation. Local regression previews exercise all variants and cutoff copy; generated review artifacts must use synthetic recipients only.

## UI / read-only preview

Communications gains a collapsed Automatic reminders section, clearly labeled Delivery disabled · Phase A. Opening it reads authorized history/preview; initial page load makes no reminder read. Refresh has a 15-second finite error state and retry; request ownership invalidates late results after unmount. Preview is SELECT-only: no sync, claim, ledger write or provider call. It prioritizes eligible rows and returns at most 200 occurrences plus 25 recent audit events per occurrence, with redacted destinations. Before an activation baseline is established it explains why nothing is enrolled. No send-reminder button or cadence editor exists.

Human-actionable missing destinations, exhausted failures and sending/unknown reconciliation are visible here. Needs Attention's existing awaiting-response semantics remain unchanged; no new scheduled-reminder noise is introduced.

## Bounds / observability

Discovery pages at 200 future assignments, at most 10 pages/workspace/run. Persistent scan cursors resume after a bounded run so later assignments are not starved. At most 20 active workspaces/run and 20 due occurrences/workspace/run; current deployment is one workspace. More than 20 active workspaces requires expanding the workspace continuation contract before rollout. Existing workspace/start_date indexes bound historical exclusion. Due queue has a partial workspace/due/id index; audit reads have occurrence/id ordering index. Historical-heavy EXPLAIN evidence is retained alongside this document.

Safe aggregate sweep output logs start/end, evaluated/eligible/claimed/sent/rejected/unknown, disabled/changed/claimed-elsewhere skips and continuation. No raw email, body, secret, bearer or raw provider error is logged. Worker errors return a generic finite 503 and diagnostics, not a spinner/retry loop. Expired credentials or missing secrets fail closed.

## Rollback / release boundary

Migration `20261021120000_assignment_reminders_phase_a.sql` is local-only. Empty Phase A rollback restores original constraints/admin functions, removes empty reminder objects and the narrow role, and removes the local ledger entry transactionally. It refuses destruction if any enrollment/delivery audit exists; in that case disable the worker and preserve evidence for forward recovery. No production SQL has been executed.

## Separate security follow-up — OPEN

**SEC-12.57-01: Existing bulk Communications shared-household bearer links.** Household SQL permits independent shared-inbox bulk recipients, but `communicationDispatch.server.ts` unconditionally issues a schedule bearer for each schedule recipient. The legacy initial-email claim instead blocks shared inboxes. This discrepancy predates 12.57 and needs a separately scoped review. It is not silently changed here. The new reminder path does NOT issue or email bearer credentials.

## Verification

Completed local results, test boundaries, changed files and release limitations are recorded in [12-57-phase-a-verification.md](12-57-phase-a-verification.md). The final candidate is the Git commit containing that report. No production deployment, setup, secrets, cron, operational mutation or real provider calls are part of this phase.

The restricted JWT role contract follows PostgREST's documented role impersonation model: https://docs.postgrest.org/en/stable/references/auth.html. No worker JWT was provisioned in production during implementation.
