# 12.57B — Reminder timing and admin preview

Baseline application: `ee103d8c75b081f8fd8f286aecf32c39deee492d`; production baseline supplied by the owner: migration 53 / `20261021120000`. This implementation uses local Docker and disposable fixtures only. No production connection, deployment, task change, reminder activation, infrastructure setup or real provider call is part of this batch.

## Timing and migration boundary

Timing is implemented in PostgreSQL, not browser code. Migration **54**, `20261021130000_assignment_reminder_local_delivery_times.sql`, replaces only the body of the existing internal `assignment_reminder_local_offset(timestamptz,text,integer)` function. Both real scheduling and SELECT-only prospective preview already call that helper. Deployed migration 53 is unchanged.

The helper constructs a date in the authoritative workspace timezone, applies the local calendar-day offset, then attaches **09:00** (pending and 30/14/7/3-day confirmed) or **17:00** (the -1/day-before confirmed offset), and converts to an instant. It does not retain activation, notification or assignment clock time. No UTC-day arithmetic or browser-local calculation is used.

| Example, America/Denver | Previous behavior | New behavior |
| --- | --- | --- |
| Pending anchor Oct 21, 21:48 +3 days | Oct 24, 21:48 | Oct 24, 09:00 |
| Nov 15, 07:30 assignment, 7-day threshold | Nov 8, 07:30 | Nov 8, 09:00 |
| Same assignment, day-before reminder | Nov 14, 07:30 | Nov 14, 17:00 |

Existing future-only activation/confirmation/enrollment checks, immutable pending anchor, response cutoff, actual-start stopping, occurrence uniqueness, claiming/retry, rescheduling and history protection are retained. Already scheduled occurrences may mature normally within the existing 15-minute dispatch window; this is not permission to enroll missed thresholds or backfill an activation after the nominal time.

The migration refuses activated/active/history-bearing reminder state. This matches the installed disabled/NULL/empty release boundary and prevents silently retiming existing history. It performs no data backfill. Empty rollback restores the original helper body and removes only its own ledger entry; rollback refuses if history, activation or later migrations exist. No table, index, grant, RLS policy, function signature, function owner or privilege classification changes. Exact function policy remains 102/PUBLIC0.

## Admin presentation

The single existing Communications reminder component now presents **Automatic reminders / Off**, plain-language explanation and a real **Preview reminders** button. There is no activation, cadence editor or manual-send action. The heading no longer contains development phases.

Opening performs one authorized preview read; initial render performs none. Closing/reopening reuses the current in-memory result. No browser storage or private global cache is added. Refresh/pagination remains authorized on the server, uses fresh server time and retains its 100-assignment page bound. Counts explicitly describe the current page, not all project assignments.

The preview separates Still need to respond, Confirmed assignments, exclusions and recorded history. Dates include project-local clock and timezone context. Technical enrollment/baseline/occurrence terminology and machine keys are not shown. The cadence explanation is a small disclosure. Empty history reads “No reminders have been sent yet.” Recorded statuses, attempts, due/result times and progressive audit details remain truthful; sending/unknown outcomes explain that automatic retry is paused pending review.

The same component can render a future **On** state from trusted server-supplied initial state or the authorized report; it exposes no state-changing control. This presentation support does not authorize activation. Loading has a finite timeout/error/Retry, previous preview remains visible after failed refresh, stale request ownership is retained, and controls use semantic buttons, expanded-state association, focus styles and touch targets.

## Deterministic verification

New timing regression covers local morning/evening/midnight anchors; +3/+6/+9-day pending cadence; all confirmed thresholds; 08:59/09:00/09:01 and 16:59/17:00/17:01 enrollment and preview boundaries; no late catch-up; spring/fall DST; other project timezones; actual overnight start; 48-hour behavior; rescheduling/sent identity/history preservation; atomic migration failure and exact empty rollback/replay. Before/after snapshots include every public table, contracted Auth users/identities and public/Auth sequence value/called state. Repeated read-only previews preserve those snapshots.

Existing engine and preview regressions were updated for the intentional new clock policy, retaining concurrency, provider-uncertainty, bounded retries, initial-delivery anchor, intentional resend, shared-household and authorization assertions. Prior 12.57 evidence is retained; new plans are written under `12-57b-evidence/`.

Historical-heavy local fixture: preview discovery 0.484 ms; recent history 1.808 → 0.105 ms with the existing index; full preview 31.970 ms; pages 100 + 11 unique assignments; 30 SELECT-only reads. Engine discovery 0.196 ms, due queue 0.062 ms, claim 6.303 ms. These are local fixture measurements, not production latency claims. No query shape, additional fetch or N+1 behavior is introduced.

Responsive/browser, static and guarded-build results are recorded after final validation. Screenshots/evidence are retained outside the repository at `C:\Users\mtfis\Documents\Codex\2026-10-21\project-local-12-57b-evidence`.

## Release boundary

Migration 54 and application deployment require separate release preparation and approval. Production remains untouched by this implementation. Sending stays disabled, baseline NULL, no enrollment or occurrences after local fixture cleanup. No Cron, Vault secret, worker credential, provider adapter or activation action is provisioned. **SEC-12.57-01 remains OPEN / SEPARATE**. Real provider calls/emails: ZERO.
