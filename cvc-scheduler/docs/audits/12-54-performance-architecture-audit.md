# Project Local 12.54A — performance and architecture audit

**Date:** 2026-10-10. **Scope:** diagnosis only. **Live application:** `6fb061a596c27db324cfac47aa60b849f9d1e91e`, Vercel Production / Ready. **Production ledger:** 50 migrations, terminal `20261009120000`. The checked-out branch contains no application diff from that SHA. No production configuration, data, schema, application behavior, or deployment was changed for this audit.

## Executive assessment

Project Local is functional at its current scale, but several common actions do not feel immediate. The most concrete problem is a Calendar range predicate that pulls historical same-day items into later date windows. At the current one-project scale this can multiply Calendar rows by 2–20 times, depending on the chosen range, before application code discards them. The assignment picker has a sequential network-call pattern: a modeled 50 ms round trip produces about 0.7 seconds of context loading at 250 volunteers and 2.6 seconds at 1,000. Communications calculates a relatively expensive recipient preview before its page renders. The shared admin shell also performs a Needs Attention badge read that can repeat Calendar work on navigation.

The first scale pressure is likely network round trips and read amplification, followed by long-project Needs Attention scans and Communications preview work. There is no evidence that React rendering, RLS itself, or a missing database index is currently the dominant problem. One targeted database migration is justified to correct Calendar range semantics while preserving security and overnight intervals. Other improvements should be measured and staged around the 12.54 UX work.

**Verdict: OPTIMIZATION WORK RECOMMENDED BEFORE 12.54.** Fix the Calendar range read and the most visible picker delay before adding polish that depends on these paths.

## Baseline and measurement limits

| Source | Observed baseline | Limit |
|---|---|---|
| Production, read-only | Vercel Production / Ready at the exact live SHA; migration ledger 50 / `20261009120000` | Vercel function-duration/log connector returned 403; no historical platform trace was available. |
| Production, read-only `pg_stat_statements` | Calendar RPC 2,097 calls, 226.3 ms mean, 732.5 ms max; Communications review 159 calls, 542.7 ms mean, 1,432.3 ms max; volunteer schedule 953 calls, 49.4 ms mean | Statistics accumulated since 2026-07-15. These are database execution times, not recent p50/p95 or browser latency; function-name matching can overlap query categories. |
| Production inventory | Estimated 355 Calendar items, 391 assignments, 301 volunteers, one workspace; exactly 42 communication operations, 415 recipients and 440 assignment coverage rows | `pg_stat_user_tables` row counts are estimates except the three communication counts. No PII was extracted. |
| Local authenticated browser, warm webpack dev, small synthetic project | Three runs of selected clicks, 1440 × 900. Timing tables below use approximate medians. | Local dev and tiny fixture are not production. Browser harness did not reliably catch the transient route pending indicator. No production click timings or p95 claims. |
| Local picker simulation | Real server batching code with mocked RPC responses; 100–1,000 synthetic candidates and 0/50 ms per-call delay | Models round-trip sensitivity; does not measure production query execution or rendering. |
| Local build artifact | Calendar and shared Quick View first-load JavaScript ~750 KB raw / 206 KB gzip; Volunteers ~589/168 KB; Communications ~559/162 KB; Needs Attention ~551/159 KB; volunteer schedule ~549/158 KB; Overview ~547/158 KB | Build artifact is from current source checkout, but is not a verified browser transfer trace for the live deployment. |

### Ten slowest measured local interactions

These are ranked by **click to useful UI update** for actions with a valid marker. Acknowledgement was directly observed only where noted; “not captured” must not be read as no acknowledgement. Values are approximate medians of three warm local runs. Targets are UX goals to test after implementation, not promised gains.

| Rank | Interaction | Click → first observed feedback | Click → useful | Dominant cause / confidence | Recommended fix | Target to validate |
|---:|---|---:|---:|---|---|---|
| 1 | Navigate to Calendar | Pending state not captured | 567 ms | Full server route read; high architectural confidence, local timing only | Correct range read, preserve shell, show immediate route pending state | Immediate visible feedback; useful ~300 ms where practical |
| 2 | Needs Attention support filter | Useful update was first observed feedback | 427 ms | Local filter/render or test action settling; cause unprofiled | React profile before changing memoization; keep local response | <100 ms if truly local |
| 3 | Select Calendar volunteer filter | Useful update was first observed feedback | 312 ms | Client filter/Calendar rerender likely; not profiled | Profile dense Month and filter-derived work | <100 ms if wholly local |
| 4 | Switch Calendar Day | Pending state not captured | 355 ms median of 252/355/858 ms | URL-driven RSC navigation | Pending feedback; reduce server read | Immediate feedback; useful ~300 ms |
| 5 | Switch Calendar Month | Pending state not captured | 243 ms | URL-driven RSC navigation | Same route-read optimization | Immediate feedback; useful ~300 ms |
| 6 | Switch Calendar Week | Pending state not captured | 232 ms | URL-driven RSC navigation | Same route-read optimization | Immediate feedback; useful ~300 ms |
| 7 | Switch Calendar List | Pending state not captured | 235 ms | URL-driven RSC navigation | Same route-read optimization | Immediate feedback; useful ~300 ms |
| 8 | Navigate to Volunteers | 21 ms | 160 ms | Full route navigation; no current bottleneck established | Keep existing feedback; remeasure in production | Preserve or improve |
| 9 | Generate Communications review | 25 ms | 111 ms | Server-authoritative action; production DB history suggests larger real cost | Keep action confirmation; avoid blocking initial page on preview | Progressive result, no false success |
| 10 | Reset Needs Attention filters | 20 ms | 20 ms | Local state, healthy | No optimization | Preserve |

Calendar filter opening (~46 ms), volunteer search (~12 ms), and Communications history tab (~16 ms) were also fast. Changing Calendar date was excluded because the harness only observed URL change, not updated Calendar content. An assigned-contact sheet appeared in ~36 ms, but the local fixture did not yield a useful-detail marker; its end-to-end latency remains unmeasured. A direct Needs Attention page load of ~174–246 ms was a `page.goto`, not a click, and is excluded from the ranking. The picker simulation below exposes a more important slow path than several table entries but is not ranked as a measured browser click.

## Prioritized findings

| Priority | Subsystem / finding | Evidence and user impact | Proposed change and expected benefit | Risk / migration | Batch |
|---|---|---|---|---|---|
| **CRITICAL** | Calendar RPC range overread | A later-month range returned 289 rows while true interval overlap returned 0. Every extra row can incur assignment and response expansion before application filtering. More history makes all Calendar views slower. | Replace null-end test with `coalesce(end_date,start_date)` overlap in the authorized RPC and fallback; keep interval and privacy tests. Removes unnecessary read/processing; quantify again after fix. | Medium; **yes**, one migration to correct RPC | A |
| **HIGH-VALUE** | Picker context serial batches | 25 IDs per sequential RPC; 50 ms RTT model: 685 ms at 250, 1,308 ms at 500, 2,558 ms at 1,000, plus 350 ms initial delay. Admin sees “Checking availability.” | First measure live timings, remove unnecessary fixed delay; consider bounded concurrency or a set-based authorized RPC. Maintain conflicts, away context, overrides and project scope. | Medium; app-only for bounded parallelism, migration only for new RPC | A |
| **HIGH-VALUE** | Communications page waits for recipient review | Review RPC historical mean 543 ms, max 1.43 s; initial page awaits history and review. Opening Communications can wait on preview work that may not be needed. | Render the page/history before on-demand review or stream review separately; retain fresh server-authoritative preview before send. | Medium; no migration for progressive UI | B |
| **HIGH-VALUE** | Needs Attention badge duplicates reads | Badge mounts in admin shell and requests a 14-day inbox count, including Calendar work; local dev showed a POST after Calendar load. Shell lives inside pages rather than persistent admin layout. | Trace requests, then share safe scoped count or make badge endpoint cheaper; avoid stale cross-project cache. | Medium; likely no migration | B |
| **HIGH-VALUE** | Long-project Needs Attention scans | Server loops sequentially over 90-day Calendar windows through project end; Whole Project can grow with project length. | Measure window counts, bound/parallelize carefully or use a summary read preserving exact issue semantics. | Medium/high; perhaps migration if summary RPC is needed | C |
| **HIGH-VALUE** | Loading can remain unresolved on failed dependency | Volunteer lookup fetch and assigned-contact action have no explicit timeout/cancellation or recoverable terminal state for a stalled request. | Add timeout, cancellation and retry/error UI; never fabricate lookup or contact success. | Low/medium; no migration | B |
| **HIGH-VALUE** | Volunteer schedule waits for secondary home data | Schedule page awaits schedule, then awaits home data before rendering. DB means 49.4 and 10.0 ms respectively, plus network RTT. | Stream/use separate boundary for lunch menu and home details after schedule becomes usable; preserve access validation. | Medium; no migration | B |
| **NICE-TO-HAVE** | Large Calendar client route payload | Calendar and `/qv` share ~206 KB gzipped first-load JS; `CalendarClient.tsx` is ~4,790 lines. | Profile parse/hydration and split only route-specific, infrequently used UI with measured bundle win. | Medium/high; no migration | D |
| **DO NOT OPTIMIZE** | Quick View contact on-demand boundary | Contact RPC historical mean 25.7 ms; details fetched only on click. | Keep the separate authorized request and minimal four-field projection. | Privacy-critical | E |
| **DO NOT OPTIMIZE** | Cross-month assignment page bounds | Matching dates load one month and at most 120 items per page, honoring project end. | Preserve bounds; optimize only after a real slow trace. | Low current impact | E |

### Calendar range evidence and safe fix boundary

`supabase/migrations/20261001120000_admin_workflow_activation.sql` uses a range condition equivalent to `end_date IS NULL OR end_date >= requested_start`. In this schema, null `end_date` denotes a same-day item, not an indefinitely continuing item. `lib/calendar/readModelQuery.server.ts` has the same fallback condition. Other interval code uses `coalesce(end_date,start_date)`. `lib/calendar/routeRead.server.ts` filters actual overlap only **after** the authorized read model has fetched and expanded records.

Read-only production aggregate counts, applying the active-item predicate under the same date concept, show the amplification:

| Window | Current predicate | True interval overlap | Historical null-end rows included |
|---|---:|---:|---:|
| This day | 64 | 3 | 61 |
| This week | 93 | 32 | 61 |
| Next month | 264 | 108 | 156 |
| Later month | 289 | 0 | 289 |

The Calendar query plan at current scale uses `calendar_items_workspace_start_idx` and an incremental sort. Correct the predicate and remeasure before proposing a new index. A future index should be considered only for a demonstrated selective overlap query, with write and storage cost included. The migration must preserve same-day, overnight, long interval, draft visibility, authorization and instruction redaction. A failure-path rollback and relevant RLS checks are required before any release.

### Picker scale simulation

`lib/calendar/assignmentPickerContext.server.ts` requests plan context in serial 25-candidate chunks, then away periods. `PickerVolunteerList.tsx` waits 350 ms before requesting the full roster context. With mocked 50 ms per network call and no database work:

| Candidates | RPC calls | Context elapsed at 0 ms RTT | At 50 ms RTT |
|---:|---:|---:|---:|
| 100 | 5 | ~1 ms | 307 ms |
| 250 | 11 | ~1 ms | 685 ms |
| 500 | 21 | ~1 ms | 1,308 ms |
| 1,000 | 41 | ~1 ms | 2,558 ms |

The first meaningful modeled degradation is around 250–500 volunteers. The current production estimate is 301, so this pattern is relevant now, although actual RTT and database cost were not measured for the live picker. Search and congregation filters are already local and should remain immediate. Do not parallelize unboundedly or bypass authoritative eligibility checks merely to reduce wall time.

## Subsystem review

### Database and authorization

Production is small enough that a general index campaign is unsupported. Calendar range semantics are the first query fix. Calendar RPC historical mean is 226 ms; assignment planner 4,784 calls at 6.8 ms mean; away-context RPC 379 calls at 3.4 ms mean. Communication history is bounded at 1,000 records and currently has 415 recipients; its historical database mean is 30.4 ms. Communications review SQL iterates active volunteers and makes multiple per-volunteer eligibility/delivery reads, consistent with its higher measured cost; a set-based redesign may eventually be justified, but would need exact recipient and audit-flow equivalence. `read_project_quick_view_by_token` averaged 32.0 ms; assigned-contact lookup averaged 25.7 ms. No evidence supports weakening authorization or RLS to save these costs.

Future growth will concentrate in Calendar items/assignments, communication recipients/coverage, response history and access tokens. Several simultaneous projects remain isolated by project-scoped queries, but loops proportional to each project’s volunteers or date windows can become expensive. Recommended indexes require a real slow query plan after the predicate fix, not just a filtered column name.

### Next.js, React, navigation and bundles

Only a root `app/layout.tsx` exists; admin shell components are instantiated by pages, so route changes can remount shell work. Calendar view/date selection uses `router.push` and server reads, while local filters/search do not need a server round trip. No presentation-only `router.refresh()` misuse was found; observed refreshes follow successful mutations. The Calendar client component is large, but size alone does not establish rerender cost. The 427 ms Needs Attention support-filter and 312 ms volunteer-filter local samples warrant React Profiler traces with dense fixtures before memoization or a component split. Avoid duplicating route data in client state without a measured reason.

The local build artifact reports first-load JS of roughly 547–750 KB raw (158–206 KB gzip) for major routes. Shared code dominates; Calendar and Quick View are largest. Thirty-eight static chunks total roughly 1.68 MB raw in the artifact, not one route transfer. No verified hydration or long-task profile was captured, so bundle splitting is lower priority than the known network/data issues. Geist fonts are handled through `next/font`; no font latency issue was observed. A guide logo PNG is roughly 485 KB but lives on the separately deployed guide path, not the admin application route. Image/font changes are not justified from this evidence.

### Overview and Needs Attention

The current Overview route reads a bounded seven-day Calendar scope and avoids a full volunteer-directory read. That bound is appropriate. Needs Attention derives grouped signals over 90-day Calendar windows through project end and reads reviewed states plus volunteer summaries. Its local support/issue filters preserve the server result; they should not need fresh database calls. The nav badge independently requests a 14-day unseen count from the shell, creating potential duplicate read work. Quantify badge frequency in a production-equivalent trace before designing a cache. Whole Project mode should be tested against long synthetic projects, including several simultaneous workspaces.

### Calendar and scheduling

Fix range overread first. Then measure month rendering and view changes with a realistic dense Calendar, including overnight items, meals, assignment responses and varied task colors. Day/List assignment expansion uses bounded 120-ID chunks; no unbounded list read was found there. Cross-month matching reads one month at a time and preserves selected dates; its source is reauthorized on each load, which is correct but may cost one extra RPC. Assignment-picker route data includes the active roster and some private profile fields for authorized admins; narrow the payload only after mapping actual UI consumers, and never cache it across users/projects. Date parsing, recurrence, conflict and overnight logic should remain correct before any client optimization.

### Communications

Initial render waits for a fresh review RPC even though the page can show history and controls before review is requested. The expensive SQL loops through volunteers and checks delivery/coverage/assignment state. Keep recipient counts, reasons, changed-assignment state, intentional resend protection and a fresh server-authoritative final preview. No real provider call was made. The 120-second uncertain-delivery handling after send protects against duplicate or misleading success and should not be converted to optimistic success.

### Volunteer access and Quick View

Lookup shows “Checking” immediately, but a request that never settles has no explicit timeout or cancel path. The verified result navigates by full document assignment, so browser navigation may add latency; measure that separately before changing cookie/session flow. Shared-contact chooser and remembered sessions are security-sensitive. Volunteer schedule and home/lunch reads are sequential before first render, offering a safe progressive-render opportunity. Quick View bearer validation and on-demand contact lookup are intentional privacy boundaries. Do not put phone/email in the initial Quick View payload, cache bearer results broadly, or expose private instructions. The local contact fixture did not provide a useful-result timing; this is an audit measurement gap, not evidence of a production defect.

### Reliability and error paths

Trace failures separately from slow successful requests. Add recoverable timeout and retry states to lookup and on-demand contact surfaces, with cancellation to avoid stale updates after switching volunteers or closing a sheet. Preserve explicit confirmation for assignment changes, volunteer responses and communications. A slow dependent read should not block unrelated page content; progressive rendering is preferable where authorization has already been established. Do not treat a loading spinner as proof a request is progressing.

### Test-suite health

Three sampled pure regression suites passed in roughly 0.35–0.52 seconds each; the Overview desktop/mobile browser regression passed in 16.15 seconds. The existing picker browser fixture covers about 161 volunteers, but there is no 250/500/1,000-volunteer latency threshold. Several browser checks use fixed 250–1,500 ms sleeps, which can make timing flaky and hide stalls. Prefer observable state and request completion assertions. Some older checks assert exact UI copy; review them for semantics when touched, without weakening authorization, privacy, migration or communication-delivery tests. Add a dedicated performance budget for Calendar range row counts and picker call count after fixes, using synthetic data only.

## Security and privacy constraints on optimization

All caching or deduplication must key by authorized user, project and relevant permission state, and respect operational freshness. Never share a roster or private volunteer field across projects; never retain volunteer lookup tokens, bearer links, Auth data or contact information in performance artifacts. Keep RLS, function grants, admin capabilities, Quick View link validation and assignment-instruction privacy intact. The assigned-contact call remains on demand. Optimistic visual acknowledgement is useful for navigation and local filters; optimistic *success* is inappropriate for assignments, responses, communications or access checks.

## Recommended sequence and release grouping

**A — Before 12.54 polish:** (1) Correct Calendar RPC/fallback range semantics in a narrowly reviewed migration, with exact same-day/overnight/security regression and disposable rollback proof. (2) Instrument picker open/context timing at current roster size; remove the fixed delay if safe, then choose bounded concurrency or set-based context only with preserved eligibility. Remeasure Calendar request count, rows, click-to-useful time and picker open at 100/250/500/1,000 after implementation.

**B — Fold into 12.54 polish:** Show immediate feedback for Calendar route changes; render Communications history/shell before recipient review; make lookup/contact failure states recoverable; progressively reveal volunteer schedule before secondary home data. Measure before/after with browser timings and server traces. Investigate the badge’s duplicate request as part of shell polish.

**C — Future scalability:** Long-project Needs Attention windows; set-based Communications recipient review; multi-project aggregate load; selective indexes only after post-fix plans justify them.

**D — Nice-to-have:** Profile dense Month rerenders and hydration; split the large Calendar/Quick View client surface only with a demonstrated route-bundle or responsiveness benefit; review fixed-wait browser tests.

**E — Do not optimize:** Project authorization/RLS, bearer-link boundaries, on-demand contact privacy projection, bounded cross-month pages, current Overview seven-day bound, or communication send confirmation merely for a faster spinner.

## Audit artifacts and change control

This document is the durable audit artifact. Local synthetic browser and picker scripts were temporary and are removed after review. The production read-only aggregate SQL/output files were temporary and are removed after their sanitized counts are recorded here. No credential, bearer link, contact, Auth row, database dump, or production-derived row-level data is retained in this document. No application or migration file was edited, no production data was changed, and no notification was sent.
