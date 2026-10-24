# 12.57E — enabled reminder worker diagnosis

Production at investigation: `1069b21a1ff91e08581f5dd8332b9cec368e7805`,
database **55 / 20261022120000**, delivery Off, Cron paused. No deployment,
production SQL change, activation, worker invocation, or provider call is authorized
or performed by this batch.

## Root cause and evidence

The natural run at 2026-10-23T20:55:10.315Z reached Vercel, which returned 503
and logged only `worker_unavailable`. All available logs for the request window
contain that one sanitized entry; they do not preserve the underlying exception.

An encrypted production checkpoint taken at 21:23Z restored exactly: all 33
contracted public/Auth relation fingerprints and all ten catalogue/security
categories matched its immediate production snapshot. The original baseline
`2026-10-23T20:05:28.288289Z` was preserved in the copy. The isolated database has
no network, no published ports and no provider credentials.

Running the frozen production application against that copy, with a fake provider
and a disposable restricted runner login, deterministically failed at:

`status → first sync → public.run_assignment_reminder_worker(text,jsonb)`

PostgreSQL returned **SQLSTATE 55000: record "a" is not assigned yet**. The function
declares a loop record `a`, then its loop query also uses SQL alias `a` in
`select a.id ... order by a.id`. PL/pgSQL resolves that reference to the unassigned
record. The first sync transaction rolls back; no enrollment or occurrence commits.
This is a deployed database-function name collision, not a Cloudflare failure or
an assignment-specific privacy/data issue. The original hosted log alone cannot
prove the precise exception retrospectively; the exact restored function and
production-data enabled path reproduce this inevitable first-sync failure.

Previous enabled engine tests exercised direct scheduling helpers and injected
worker RPCs. Hosted/local restricted-transport tests exercised the Off branch.
They did not execute the real enabled `sync` command. The new regression covers it
through the actual local Supavisor transaction pooler, including two workspaces.

## Actual execution and transaction boundaries

| Order | Operation | Effects and failure boundary |
| --- | --- | --- |
| 1 | Verify scheduler method/host/path/timestamp/HMAC | No database/provider activity on denial. |
| 2 | Validate narrow database configuration | No connection yet; configuration failure classified. |
| 3 | Acquire max1 pool connection; BEGIN; SET LOCAL ROLE worker; LOCAL timeouts | Repeated for **each** worker command. Connection/role/settings failures classified. |
| 4 | `status`; COMMIT; release | Reads delivery flag and bounded active-workspace IDs. Off returns immediately, before provider configuration. |
| 5 | Read shared email configuration; construct adapter | Configuration/initialization only; **no provider network**. This happens before sync, not after claim. |
| 6 | `sync`, at most ten pages of 200 assignments per workspace | Each command has its own transaction. Sync discovers assignments, locks activation/cursors, calls scheduling helpers, enrolls/materializes future occurrences, then commits. This was the failing command. |
| 7 | `due`, at most 20 IDs | Read in a separate transaction; commit/release. |
| 8 | `claim` | Atomic durable reservation and delivery records; **commit before returning**. |
| 9 | `revalidate` | Separate transaction; rechecks live assignment/response/Off state; commit/release. |
| 10 | Shared single-recipient provider send | Only after durable claim/revalidation and connection release. Existing idempotency key and outcome handling retained. |
| 11 | `finalize` | Separate transaction commits sent/failed/unknown. Lost commit/finalization never causes blind application retry. |

All command errors can reach the generic 503 handler. The sweep is deliberately
**not** wrapped in one transaction. Pool max1 does not cause nested acquisition:
each RPC releases before the next command or provider request. Two local workers
using separate max1 pools reached at most two active transactions; role reset,
connection release, and runner connection-limit2 behavior passed.

## Candidate correction

Migration **56**, `20261023120000_assignment_reminder_worker_record.sql`, only
renames the PL/pgSQL loop variable from `a` to `assignment_row` and its three uses.
The SQL alias stays unchanged. It requires owner, exact ledger55, delivery Off,
and the exact original function body fingerprint (CRLF/LF normalization only).
Unexpected source refuses the migration. CREATE OR REPLACE preserves the existing
signature, owner, ACL, SECURITY DEFINER and empty search_path.

No table, index, policy, grant, timing, activation, history, provider or scheduler
change is made. The isolated catalogue comparison changes only function-definition
and migration-ledger fingerprints; the other eight categories match exactly.
Atomic forced-failure rollback, empty-state rollback/replay, and refusal to roll
back history-bearing state are tested. Rollback preserves the baseline and never
deletes reminder history. It restores the broken implementation and therefore
must leave delivery Off/Cron paused.

**A schema migration is required. An app-only deployment cannot repair the deployed
SQL body. Stop before production release for explicit review of migration56 and
the controlled recovery release. This candidate does not authorize deployment or
resumption.** Backup tooling still supports/locks55; its reviewed 55→56 transition
and fresh release recovery protocol must be prepared separately before release.

Server-only diagnostic changes retain the normal generic response. Failure logs
contain only fixed stage, allowlisted error code, safe class, elapsed milliseconds,
HTTP503, timestamp and random run ID. Database substage distinguishes connection,
BEGIN, SET LOCAL ROLE, settings, command and commit. Worker stages distinguish
status, enrollment sync, due query, claim, revalidation, finalization and provider
configuration/initialization. Malformed bounded status/sync/due results are
classified before use. No raw error messages, stacks, SQL/payloads, workspace or
assignment identifiers, addresses, instructions, secrets or email bodies are logged.

## Reproduction and no-backfill results

Before the missed threshold, the corrected exact-data copy produced **178
enrollments / 622 occurrences**, matching every forecast occurrence key and due
timestamp: 35 pending and 587 confirmed. Zero claims, provider requests or delivery
records. The original code stopped at `status, sync` with SQLSTATE55000.

After 5PM Mountain passed while production stayed stopped, the same clean restored
snapshot and corrected full enabled path produced **178 / 621**, with **zero rows**
for the passed October23 5PM threshold. Earliest remaining due time was October24
at **9AM America/Denver (15:00Z)**. This is an actual materialization check, not
merely a preview assertion. No activation timestamp or pending cadence was reset.

Production continued normal external use while the investigation was paused. A
fresh read-only forecast at 2026-10-24T02:34:24.560435Z therefore contained **182
enrollments / 624 future occurrences**, earliest October24 9AM, **13** reminders
(7-day, 14-day, 3-day), and no passed October23 5PM occurrence. These current counts
are separate from the exact checkpoint reproduction; they are not presented as
unchanged production data or as a new activation promise. Refresh before any future
resume. The deterministic alias defect does not depend on those changed counts.

## Environment and diagnostic limits

The failed hosted request used Node24.x; local tests used Node24.22.1. Next remains
16.2.7; package/lockfile and provider transport are unchanged. Production has all
reviewed server environment keys provisioned. Sensitive values remain hidden by
Vercel; they were not exported into source/evidence. Existing normal Communications
deliveries use the same configuration getter and single-recipient transport.
The restored complete enabled test uses a fake but shape-valid provider config;
it does not claim to test a live provider key. No provider request is necessary or
permitted for diagnosis.

The narrow production status read had already succeeded, establishing working
hosted runner authentication/TLS/role/status. Transport host, transaction port,
runner username format, pinned TLS CA/rejectUnauthorized, pool max1, connection
5s/query10s/statement8s/lock3s limits are unchanged. Local real-Supavisor tests prove
transaction role reset, repeated/concurrent enabled commands, no prepared/session
state dependency, and recovery after a genuine statement timeout. Driver errors
discard the socket after rollback, with no retry of an uncertain commit.

Because the defect reproduced offline, no hosted diagnostic endpoint was added,
deployed or invoked. No production delivery toggle or rollback-write diagnostic
was needed. A future hosted proof must use the reviewed release/resume gates.

## Verification

- Exact checkpoint restore: 33 relation fingerprints / ten catalogue categories.
- Exact original application enabled-path failure, SQLSTATE55000 at first sync.
- Corrected exact-data enabled path, before and after the passed5PM threshold.
- New real local Supavisor enabled test: multiple workspaces, pending/confirmed,
  household identities, repeated/concurrent runs, no duplicate occurrences, max1
  release, role reset, actual8s statement timeout/cancellation and fresh recovery.
- Safe telemetry: connection/role/settings/query/commit failures, no retry, missing
  configuration, malformed worker results, generic HTTP503 and secret-log denial.
- Provider mocks: rejection, unknown/timeout, accepted send, lost finalization;
  durable claim commits/releases before send. Existing unknown/retry rules retained.
- Existing core, timing, preview and clock/HMAC tests; response/reschedule changes,
  cancellation/exclusions, shared households, DST/overnight, cutoff and emergency Off.
- Actual local restricted LOGIN denial matrix and Supavisor rotation/reset tests.
- Production-mode fresh On/Off before Preview, unavailable/retry, lazy Preview,
  stale ownership and authorization denial at320/390/430/768/1280/1920. Existing
  reminder UI/history/template browser suite also passed.
- Guarded Webpack and Turbopack: Next16.2.7 receipt before compilation.
- TypeScript, full ESLint, diff check, changed-file credential-pattern scan and
  compiled-client secret-boundary scan. Final receipts retained outside the repo.

No live provider testing, deployment, production worker/Cron invocation, production
SQL mutation, activation, delivery resumption, or backup task change is performed.
Production remains Off at the exact preserved baseline, zero reminder records,
Cron paused, backup Enabled/Ready/idle at55 and03:15. SEC-12.57-01 remains open and
separate. Candidate SHA and final fresh-state receipts are in the external report.
