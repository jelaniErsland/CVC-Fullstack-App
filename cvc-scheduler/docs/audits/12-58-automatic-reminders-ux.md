# 12.58 — Automatic reminders UX implementation and local verification

Implementation baseline: `b878f1d85e0b7df19508fb7c78fbc0cd1676ff91`.
Candidate: the commit containing this report; exact SHA is returned to the owner
after the clean commit. No deployment or production migration is authorized here.

## Live observations / scope

The read-only before-state inspection showed Automatic reminders On. Its initial
loaded page represented 100 assignments (74 with recorded reminders, 26 excluded)
and 368 Scheduled records under a combined history view. This limited projection
was not proof of project-wide absence of actual sends/failures. The shared Delivery
history still covered Welcome and Schedule, with manual mutation controls.

The owner approved one additive read-only admin RPC after review established that
the old 100-assignment/future-only read plus a separate 200-row due-date history
slice could not provide complete actual history or an authoritative next batch.

Production was not mutated or deployed. Production delivery/baseline, provider,
Worker, Cron, HMAC, runner credentials, roles and backup task were untouched.
No Worker/Cron invocation, real provider call, send, or production assignment/
response change was performed. All inserted data and activation changes in tests
were disposable local fixtures; the local singleton finished Off/NULL.

## Migration and authority

- Migration **57**: `20261026120000_assignment_reminder_workspace_read.sql`.
- Canonical LF SHA-256: `01d0ac0ed62dd86d8ecf87e7cc74a58aa249573dc0e6770dccdcaed74ffd168f`.
- Additive rollback: `supabase/rollback/20261026120000_assignment_reminder_workspace_read.sql`.
- Rollback canonical LF SHA-256: `594d797b3234502ba71983ad1c33762a3179288cfe37eb8a41a0a40371e7c953`.
- Exact signature: `public.read_assignment_reminder_workspace(uuid,text,text,jsonb,integer) returns jsonb`.
- Arguments: workspace, view default summary, optional search, optional cursor,
  limit default 25. Fixed views: summary/upcoming/history/why_not.
- Owner postgres; STABLE SECURITY DEFINER; empty search_path. Explicit table/schema
  qualification, fixed SQL branches; no dynamic SQL.
- `communication_actor(workspace)` precedes private reads. The existing active
  user/contact/workspace/grant/capability rules remain authoritative.
- EXECUTE only authenticated and service_role, both requiring a valid actor.
  PUBLIC/anon/worker/runner have no EXECUTE. No direct reminder-table grants.
- Limit 1–50, search trimmed with raw input maximum 100 characters and literal
  name/task matching only. Empty search becomes NULL. Cursor maximum 512 bytes,
  exact view-specific keys/types, finite ISO timestamp plus UUID as appropriate;
  malformed/extra/unknown input fails closed. No caller clock or SQL fragments.
- Existing 102 privilege classifications unchanged; exact policy now **103**:
  10 shared anonymous, 1 anonymous-only, 60 authenticated, 31 internal, 1 system-only.
  PUBLIC execute **0**. Old function definitions/owners/ACLs and infrastructure
  functions remain exact. No new table/index/type/trigger/default/RLS policy.

The existing `read_assignment_reminders` API remains intact. The new API never
calls the old policy-planning report or sync/enroll/claim/finalize/activation/worker
helpers. It reads persisted state and existing assignment start semantics only.

Summary is a coherent project-wide result within one stable call: enabled state,
server observation time/timezone, earliest recorded outstanding due batch and its
full count, latest actual activity, persisted failed/unknown outcome counts.
It ignores list search/page state. Independently requested pages are later reads,
not a claimed shared transaction snapshot. On is not scheduler-health evidence.

Upcoming uses persisted outstanding records, ascending (due_at,id). History uses
actual processing/result activity, descending (activity_at,id), including old,
canceled and archived work. Future Scheduled records without activity are absent.
Each history row represents the latest actual outcome for a logical reminder,
with its recorded start/due/activity timestamps and attempt information. Labels
use authorized assignment/volunteer context; this is not an email-body archive.
No raw recipient email, instructions, coworkers, tokens or provider internals are
returned. No volunteer directory is exposed by search; every match joins assigned
work in the authorized project. Shared addresses never group identities.

## Implemented hierarchy

Main panel: heading + textual On/Off/Unavailable, short purpose, full next batch,
latest actual activity or truthful no-activity state, restrained recorded-problem
banner, View reminders and Refresh summary. No KPI grid. Status failure stays
Unavailable, never false Off. The normal page no longer needs the worker status
connection: it reads the same authorized workspace summary.

How reminders work is independent of the record list and remains usable before
opening it. Human copy explains the unchanged 3-local-day/9 AM response cadence,
48-hour response options, confirmed stages and day-before 5 PM, future-only rules
and project timezone. No settings/activation control or infrastructure jargon.

Upcoming and History are distinct. Upcoming groups by actual reminder due time,
earliest first; assignment start is visibly secondary. Compact rows show volunteer,
task, human reminder type and supported state. Ordinary scheduled rows have no
redundant disclosure; retry detail appears only when useful. History is newest
actual activity first, with bounded results and optional outcome detail. Sent
means provider acceptance, not Delivered/Received. Sending is neutral. Unknown
warns against blind resend. Revalidation exclusions are Not sent, not failures.
No automatic reminder entry inherits generic resend/retry controls.

Find an assignment provides bounded project-scoped name/task search and truthful
persisted explanations. Unsupported predictions remain an honest limited result;
the UI never recalculates policy or creates speculative reminders. Empty search
results are distinct from failed reads. Summary counts do not change with search.

Mobile Communications navigation is a two-column section grid, with reduced
secondary text/icon density on phones; desktop retains four sections. The reminder
surface and its section navigation share a readable maximum width (56rem).
The persistent shell/bottom navigation and other admin/volunteer surfaces were
not redesigned.

Read requests have finite server/client timeouts, useful errors and explicit
retry, monotonically owned results and unmount invalidation. Current results can
remain marked as previous during refresh. New view/search intent cannot publish
older results. A reproduced search→immediate-tab race was fixed using the latest
submitted intent, independently of the last completed response. No auto retry loop,
private browser storage or global authorization/data cache was introduced.

## Measured local evidence

Matched before/after production-mode builds used the same synthetic shape:
74 assigned identities with **368** scheduled confirmed reminders plus excluded
work, same names/tasks, at **390px**. This is a layout comparison, not a production
latency claim. The old fully expanded assignment/history presentation measured
**43,004 CSS px**. The new default Upcoming page measures **4,458 CSS px**, about
**89.6% shorter**. All 368 remain available through 15 bounded pages; History does
not duplicate future records. Typography was not reduced and controls remain ≥44px.

| Width | Final default Upcoming page height |
| --- | ---: |
| 320 | 4,546 px |
| 390 | 4,458 px |
| 430 | 4,338 px |
| 768 | 4,218 px |
| 1280 | 4,055 px |
| 1920 | 4,055 px |

The separate 11,100-occurrence fixture placed the true next batch after the old
first 100 assignments and older real Sent/Failed/Unknown/Sending/Excluded outcomes
outside future-assignment scope. All outcomes survived keyset paging. All 11,100
Upcoming records traversed in 222 distinct 50-row pages without duplication/loss,
including equal timestamps. The full next batch count was 100, independent of
list search. This is a different fixture from the visual comparison.

| Local EXPLAIN ANALYZE | Execution time |
| --- | ---: |
| Summary, 11,100 records | 96.791 ms |
| Upcoming, same fixture | 80.162 ms |
| History, same fixture | 22.028 ms |
| Assignment context | 4.847 ms |
| Later Upcoming keyset page | 83.476 ms |
| History search | 15.721 ms |
| Newest history, separate 1,000 actual outcomes | 7.386 ms |
| Page 20 history keyset, same 1,000 outcomes | 7.825 ms |

The 1,000-outcome fixture also canceled its assignment and archived its calendar
item; all 20 pages remained visible without duplicates or writes. Existing indexes
were used where the planner chose them; no forced plan or added index. Page output
is bounded; complete summary/history selection still scales with workspace data.
These measured scales did not justify an additional index. Larger real volumes
must be profiled before claiming constant-time behavior.

Raw plans/hashes: `12-58-evidence/read-model-results.json` and `history-scale.json`.
Screenshots and measured heights: `previews/12-58-reminders/` at repository root,
including matched baseline, all six widths, summary, Upcoming, History and errors.

## Verification results

- Local migration56→57 applied cleanly once per controlled proof. Forced failure
  inside migration+ledger transaction left ledger56, no function residue and exact
  old catalogue/security/data. Additive rollback/replay passed; ledger57 terminal
  20261026120000. No production migration was run.
- Repeated SELECTs in READ ONLY transactions preserved every public/Auth relation
  and relevant sequence fingerprint. Browser summary/list/search/history/pagination
  also preserved operational/Auth and event-sequence state. Fixture writes were
  deliberately separated from the no-write measurements.
- Authorized administrator/project contact and service_role-with-valid-actor pass.
  Wrong workspace, revoked/insufficient/expired grant, inactive contact, anonymous,
  missing actor, worker and runner fail closed. PUBLIC execute remains zero.
- New exact policy + previous 102 entry equivalence, function privileges/defaults,
  centralized table privileges, Quick View privilege preservation and the existing
  exact instruction-security regression pass. The latter ran against canonical LF
  source, preserving its assertion rather than changing it for Windows CRLF.
- All six production-mode browser widths pass: real local On/Off/Unavailable,
  independent help, correct types/outcomes, scoped search, pagination, error/retry,
  rapid view/search changes, no horizontal overflow, ≥44px controls, keyboard
  search/focus, readable wrapping, true empty history vs populated old history.
- A deliberately hung read ends at the 15-second presentation timeout; retry
  recovers after releasing the held request. No spinner/retry loop remains.
- Status unit, presentation/projection contract, timing/no-backfill/DST/overnight,
  simulated Communications dispatcher and provider-transport regressions pass.
  Provider success/rejection/unknown/timeout cases were mocked: real calls zero.
- TypeScript, full ESLint, git diff --check, changed-source credential-pattern scan
  and compiled-client secret-boundary scans pass. Webpack scanned 91 client files;
  Turbopack scanned 43. Zero findings. Dependency versions/lockfile unchanged.
- Canonical LF production builds pass with physical dependencies and Next16.2.7:
  Webpack and Turbopack both print the guarded-router verification receipt BEFORE
  compilation. The existing source guard itself was not modified.
- Established reminder/status browser entry points now delegate to the current
  common read-model suite instead of the intentionally replaced Phase A preview
  contract. Engine/timing tests remain separate. An attempted historical JWT-era
  worker test imports an export already absent at baseline; it is inapplicable to
  current Supavisor infrastructure, not a 12.58 product failure. No worker runtime
  behavior was modified or manually invoked to make it pass.

## Deferred / limitations

- No editable settings, pause/resume, channels, overrides, Send now, resend or
  activation UI. Future project policy/version/preview safeguards are documented
  in `12-58-future-reminder-settings.md`; no storage or policy editor exists.
- Needs Attention integration requires separately reviewed issue/review-state
  semantics. 12.58 exposes only persisted known failures/unknowns in this feature;
  it does not infer scheduler health or create a durable reviewed/resolved state.
- History presents latest actual outcome per logical reminder and bounded context,
  not a complete email transcript or every attempt as a separate top-level row.
  Persisted underlying audit events remain untouched.
- Pages are independently observed; changing live assignment/outcome data can move
  records between reads. Refresh/start from first page for a new observation.
- Full workspace aggregation is not asserted constant time at untested scales.
- SEC-12.57-01 remains OPEN / SEPARATE, unchanged.
- Separate production release review is required, including fresh production
  preflight, recovery/backup-lock planning for migration57 and exact hosted build.

## Changed files / repeatable gates

Runtime: `app/admin/(workspace)/announcements/page.tsx`,
`components/AssignmentReminderHistory.tsx`, `components/CommunicationsWorkspace.tsx`,
`lib/notifications/reminders.actions.ts`, new `reminderWorkspace.ts` and
`reminderWorkspace.server.ts` alongside it, plus the single generated database
function type in `lib/supabase/database.types.ts`. SQL is limited to the migration
and its additive rollback listed above.

Security/tests: `scripts/function-privilege-policy.mjs`,
`scripts/reminder-status-regression.mjs`, the established
`assignment-reminders-browser.mjs` / `reminder-status-browser.mjs` entry points,
and new `reminder-workspace-{regression,history-scale,contract-regression,browser,safety-scan}.mjs`.
Documentation: this report, `12-58-future-reminder-settings.md`,
`docs/FUNCTION_PRIVILEGE_POLICY.md`, two local EXPLAIN evidence JSON files and
the synthetic screenshots/height results at `previews/12-58-reminders/`.

Primary repeatable commands (local Docker and production-mode local build only):

```text
node scripts/reminder-workspace-regression.mjs
node scripts/reminder-workspace-history-scale.mjs
node --no-warnings --experimental-strip-types scripts/reminder-workspace-contract-regression.mjs
node scripts/reminder-workspace-browser.mjs
node scripts/reminder-workspace-browser.mjs --reliability-only
node scripts/function-privilege-regression.mjs
node scripts/assignment-instructions-security-regression.mjs
npx tsc --noEmit
npx eslint
git diff --check
npx next build --webpack
npx next build
node scripts/reminder-workspace-safety-scan.mjs
```

Use canonical LF source for the unchanged instruction-security comparison on
Windows. The browser script starts/stops its own local-only production server;
its `--baseline-only` mode is only for the matched frozen-baseline layout proof.
Do not run DB-mutating fixture suites simultaneously against the same local DB.

Real reminder emails/provider calls by this work: **ZERO**.
Production mutations/deployments: **NONE**.
