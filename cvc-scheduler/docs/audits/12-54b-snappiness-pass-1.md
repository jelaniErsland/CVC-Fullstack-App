# Project Local 12.54B — Snappiness Pass 1

Implementation and verification: 2026-10-10 through 2026-10-11. Baseline: `43229f52b938c198baaf65fdfb24e1222be846e4`, using the findings in `12-54-performance-architecture-audit.md`. Branch: `codex/12-54b-snappiness`.

**NOT READY for performance release prep:** implementation and the principal regressions are complete, but the dedicated assigned-contact browser gate remains unexecuted because the local Docker database engine stopped and now fails to start. The broader authenticated browser suite also stopped at a photo-upload timeout after its Calendar/auth checks passed. Neither incomplete suite is represented as a pass. No deployment, production migration, production mutation, or real notification send occurred.

The final implementation SHA is supplied in the accompanying delivery manifest and final response; recording a commit's own hash inside that commit is not possible.

## 1. Calendar range root cause

`read_authorized_calendar_items` and the application read-model filter accepted `end_date IS NULL` independently of the lower date bound. Null means a same-day item in this schema. Consequently, every earlier same-day item could pass a later range, causing unnecessary assignment/response expansion before the route applied true overlap filtering.

The audit's production aggregate was 289 versus 0 for a later empty month. Its exact dates were not recorded. This batch did not rerun that comparison against production; it reproduced the defect with a controlled local fixture and explicit dates.

## 2. Calendar fix

The authorized SQL now uses `COALESCE(item.end_date, item.start_date) >= p_range_start`. The matching PostgREST filter uses `(end_date IS NULL AND start_date >= rangeStart) OR end_date >= rangeStart`. The existing upper bound and authorization remain intact.

SQL retains its inclusive date endpoint; the existing route converts to its own exclusive display boundary as before. Explicit overnight and multi-day ends are unchanged. Recurrence, assignments, staffing, Quick View, volunteer-home SQL, and the on-demand contact privacy boundary are unchanged.

## 3. Calendar before/after measurements

| Same local fixture and range | Before | After |
|---|---:|---:|
| 289 null-end items dated 2030-01-01 through 2030-10-16; requested 2031-02-01 through 2031-03-01, inclusive SQL endpoint | 289 rows | 0 rows |
| Historical rows unnecessarily retrieved | 289 | 0 |

This is a 100% reduction in erroneous selected rows for that empty range, not a measured 100% reduction in route latency. A real local PostgREST regression also emulated the old permissive RPC and verified that the corrected application filter eliminated history before expansion: one empty-range item read, zero assignment/response/preset expansion reads. SQL and application filters agreed on the existing inclusive endpoint.

The range regression covers same-day inclusion, historical/future exclusion, both overnight dates, every day of an explicit multi-day interval, gaps and both interval boundaries, other-project denial, instruction redaction, function/policy preservation, exact rollback, and forced-failure rollback. Existing recurrence and all-view overnight regressions passed.

## 4. Assignment picker optimization

The existing planner validates a maximum of 25 volunteers per request in both application and SQL. Increasing this limit would change the RPC contract and require another migration. Instead, the existing bounded batches run in waves of at most four. The maximum roster is still 1,000 candidates; conflict enrichment uses 120-ID chunks with the same concurrency cap. Ordered merging preserves candidate order despite out-of-order completion. A failed wave returns unavailable, cancels its remaining requests, and starts no later waves.

The unnecessary 350 ms client delay was removed. Search and congregation filtering remain local. Availability, conflicts, away periods, work-day preference, current item/date recalculation, cross-month matching, selection persistence and administrator overrides continue through their existing rules and authoritative mutation preview.

## 5. Picker measurements

Actual server helper with mocked 50 ms per remote request, identical no-conflict fixture. Counts include the away-period read. Timer scheduling and local work are included in measured elapsed times. These are synthetic round-trip measurements, not production latency percentiles.

| Volunteers | Requests before → after | Sequential stages before → after | Context time before → after | Reduction |
|---:|---:|---:|---:|---:|
| 100 | 5 → 5 | 5 → 2 | 295 → 120 ms | 59.3% |
| 300 | 13 → 13 | 13 → 4 | 806 → 251 ms | 68.9% |
| 500 | 21 → 21 | 21 → 6 | 1,313 → 378 ms | 71.2% |
| 1,000 | 41 → 41 | 41 → 11 | 2,544 → 692 ms | 72.8% |

Peak simultaneous planner requests changed from one to four. The request-count reduction is **zero**; the gain is fewer sequential waits. At 300 candidates the ideal latency-only floor changes from 650 to 200 ms. Fixtures containing conflicts require additional bounded enrichment reads; the table does not model their database execution cost.

An isolated browser mounted the actual before/after picker components and called their actual server batching helpers with the same 50 ms mocked requests:

| Volunteers | Open → searchable roster, before → after | Open → availability ready, before → after |
|---:|---:|---:|
| 100 | 55 → 55 ms | 733 → 329 ms |
| 300 | 105 → 80 ms | 1,292 → 628 ms |
| 500 | 94 → 105 ms | 1,805 → 896 ms |
| 1,000 | 164 → 158 ms | 3,132 → 1,642 ms |

One measured sample per size/variant; a second recovery run showed the same general availability improvement. Searchable roster timing is broadly unchanged and noisy. The reliable improvement is earlier availability readiness. The separate desktop/mobile picker regression passed after the final explanatory filter-label change.

## 6. Calendar waterfall changes

Task-preset labels and assignment coverage both depend only on the item read. They now start together. There is no auth bypass, global cache, new index, or new RPC. Separate task-selector and assignment-detail projections remain because consolidating their different authorization and shape contracts is beyond this narrow change.

| Measurement | Before | After |
|---|---:|---:|
| Audit's authorized empty fixture: complete route remote calls / dependent stages | 8 / 5 | 8 / 5 |
| That fixture's latency-only floor at 250 ms | 1,250 ms | 1,250 ms |
| New identical populated fixture: data-helper calls / dependent stages, excluding auth/browser | 8 / 6 | 8 / 5 |
| Populated data-helper latency-only floor at 250 ms | 1,500 ms | 1,250 ms |
| Measured populated data-helper elapsed at 250 ms/request | 1,585 ms | 1,300 ms |
| Local browser Calendar click → usable header, median of 3 warm samples | 326 ms | 242 ms |

The populated helper measurement is an 18.0% elapsed reduction. Browser samples were 347/326/262 ms before and 242/340/225 ms after, approximately 25.8% lower median. These tiny local samples do not establish production improvement or p95. Both browser variants used the corrected local database, so that browser comparison isolates application behavior and does not measure the range migration's benefit. The empty fixture cannot expose the item-dependent label stage, which explains its unchanged 8/5 graph. The older harness's hardcoded populated architecture estimates are not used as measurements here.

Primary Calendar data no longer waits on an independent label read serially. The existing shell/navigation feedback and local presentation filters are retained. Other schedule editing data still participates in route loading; moving it progressively would require a larger client-state and authorization change without enough evidence for this batch.

## 7. Communications changes and measurements

Initial rendering no longer calls `review_communications` just to calculate the welcome tab's count. The page loads authorized context and history, then shows its shell, tabs, filters and review button. The tab says “Review new volunteers when ready.” Recipient eligibility is calculated when the user requests review.

| Actual page module, controlled review 543 ms / history 30 ms | Before | After |
|---|---:|---:|
| Initial review requests per render | 1 | 0 |
| Initial render median, 3 samples | 558 ms | 31 ms |
| Explicit review duration under same model | 544 ms | 545 ms |
| Review blocks useful initial page content | Yes | No |

This isolates the removal of the expensive dependency; it is not a claim that the database review became faster. Actual small local browser navigation medians were 220 → 218 ms, essentially unchanged. Explicit browser review medians were 815 → 216 ms, but simultaneous badge/server-action scheduling confounds that comparison; no SQL speedup is claimed. Production's roughly 543 ms historical database mean is the audit's input, not a new production measurement.

Review/send action implementations were not changed. Server-authoritative recipient review, eligibility, changed assignments, previous delivery, intentional resend, immutable delivery outcomes and sending safeguards remain intact. No client-computed eligibility authorizes sending. Local ledger, dispatch, transport and Communications browser regressions passed; all providers were stubbed or transport disabled.

## 8. Needs Attention badge

Tracing found both desktop and mobile badge instances mounted in the same shell, each making its own 14-day Needs Attention action call. A shell-local provider now performs one read and shares its result with both views. Isolated browser counter: **2 requests before, 1 after** for the same mounted shell. Full navigation POST counts mixed old/new lifecycle requests and are deliberately not used as the deduplication measurement.

The badge remains secondary and loads after the shell. It refreshes on pathname changes, discards obsolete results, and invalidates in-flight responses when attention is marked seen. No module-wide, cross-account, project-wide, or TTL data cache was introduced. The 14-day badge query remains distinct from arbitrary Calendar ranges and the full-project Attention inbox; directly reusing those datasets could change count semantics.

## 9. Perceived responsiveness

Picker search and selection appear without waiting for availability. Context starts immediately instead of after a fixed 350 ms pause. A remembered availability filter is explicitly described as pending while details are missing, and the roster remains searchable; it does not silently label unverified candidates as available. Communications no longer performs recipient review before the user asks for it. Navigation badges share one progressive read. Existing shells, date/tab acknowledgement, local filtering and mutation confirmation remain unchanged. No successful mutation is faked and no broad visual redesign was made.

## 10. Reliability and recovery

Read-only operations use a small timeout helper that clears its timer on success or failure and observes late rejections. Picker work has a 15-second server deadline with request cancellation and a 20-second client deadline. Errors show “Retry availability”; retries are explicit. Effect cleanup/request keys prevent old dates or closed operations from publishing stale results. Zero candidates/dates do not leave an infinite loading message.

The Calendar route and modified read-model queries have a 20-second deadline. Failure produces a useful error and a real Calendar retry link preserving the requested view/date, never an empty-success result. Communications context/history reads have finite deadlines; history failure offers Retry Communications. The badge has a 15-second server and 20-second client deadline; failure displays an unavailable indicator with a recovery direction instead of a false zero. There are no automatic retry loops.

Not every underlying Calendar/auth transport is cancelled by the route timeout; late work cannot replace the returned error state. Picker transports are actively aborted. Existing unrelated async paths were not broadly rewritten.

Focused tests passed for out-of-order completion, exact four-request maximum, partial-failure stop, whole-operation deadline and cancellation. Browser tests passed for a failed picker request followed by successful manual retry, and for a late badge response after a seen event.

## 11. Migration

`supabase/migrations/20261010120000_calendar_range_same_day_end.sql` replaces only the Calendar overlap predicate. The regression compares the replacement function to the prior migration and asserts that this is its sole functional change. No table, index, policy, grant, signature, recipient-review or picker migration was added.

Applied/tested locally only on October 10. Local ledger: 51 migrations, terminal `20261010120000`. The test used a transaction for disposable data, restored the exact original function on rollback, tested a deliberately failing migration, and checked policies, function owner/ACL/security/search path, and table RLS flags. Production remains unapplied by this task.

## 12. Security/privacy verification

Passing checks include project isolation, capability denial, read-only draft privacy, assignment instruction redaction, direct-table write denial, Quick View credential/revocation isolation, volunteer safe projections and responses, exact table grants, and the centralized function privilege policy. The function privilege check classified 93 functions with no PUBLIC execution and hardened defaults. No new anonymous/bearer API was introduced. The assigned-contact privacy/server-action regression passed; its dedicated browser gate is the remaining gap.

The range change retains the complete original authorization join and field redaction. Parallel planner requests still call the same authorized RPC with the same project ID, bounds and preview-only contract. Communications retains all server authorization and review fingerprints. Test browser network access was limited to loopback where implemented; no real provider sends occurred.

## 13. Regression results and limitations

Passed existing targeted suites (36, including corrected pre-existing harness expectations):

- Verified admin context; Calendar read-model contract, helper, helper QA, query helper, route cutover and stabilization; Calendar item/assignment management, publication visibility and edit validation.
- 12.49 overnight (including recurrence, all views, Quick View, DST and conflict boundaries); 12.51B overnight UX; 12.51A picker and volunteer filter; 12.52 picker context, away context and matching range; 12.53 admin workspace.
- Communications batches, ledger, dispatch and transport; Needs Attention; assignment-detail context.
- Assignment instruction security; Quick View privilege and share access; volunteer schedule access and responses; table privileges; operational privilege policy; grants authorization.
- Exact function privilege policy; 12.53 assigned-contact regression; 12.50 workflow regression.

Passed new focused tests: SQL range/security/rollback; real PostgREST fallback; picker concurrency/deadline/reliability; synthetic performance contract; Communications initial-render comparison; isolated badge/picker browser timing and recovery; authenticated before/after navigation comparison.

Passed existing browser coverage:

- Full desktop/mobile Calendar: Day/Week/Month/List, date navigation, Today/Project controls, filters, inspector, persisted create/edit, bulk preview/save/deduplication/cancel, assignment create/cancel, focus and narrow layouts.
- Desktop/mobile picker: 161-person fixture, search, congregation/availability filters, remembered filters and selection, preview, empty results and large roster behavior.
- Cross-month matching: October/November/December, bounded range and paging.
- 12.51A Calendar volunteer filters and picker selections: all views, date navigation, overnight, empty/clear behavior.
- Communications mobile: real authoritative review, exclusions, selection and resend safeguards, no send.
- Broader authenticated browser suite: main/assistant/on-site Calendar Day/List roster, response icons and read-only boundaries passed before the unrelated photo-upload timeout.

TypeScript, ESLint, production build and `git diff --check`: **PASS**.

Five old regression expectations failed identically at the untouched baseline. Harness-only updates align them with already-released component locations, existing read-model fields and 12.50 explicit-draft activation semantics. They were rerun and passed. A frontend browser fixture also needed unavailable-only contact-action stubs to compile current Calendar imports; that fixture never supplies private contacts.

**Outstanding:** the dedicated `ASSIGNED_CONTACT_ONLY=1` Calendar browser gate was not run. On resume Docker could not connect to its engine; startup logged a secrets-engine socket rename failure. No factory reset or destructive repair was attempted. The separate broad authenticated photo-upload timeout also remains unresolved. The latter is outside this performance change, but the suite is recorded as incomplete rather than waived or passed.

## 14. Files changed

Application (13):

- `app/admin/announcements/page.tsx`
- `app/admin/needs-attention/actions.ts`
- `components/AdminShell.tsx`
- `components/CalendarClient.tsx`
- `components/CommunicationsWorkspace.tsx`
- `components/NeedsAttentionUnseenBadge.tsx`
- `components/PickerVolunteerList.tsx`
- `lib/calendar/assignmentPickerContext.server.ts`
- `lib/calendar/readModelQuery.server.ts`
- `lib/calendar/routeRead.server.ts`
- `lib/readTimeout.ts`
- `package.json`
- `supabase/migrations/20261010120000_calendar_range_same_day_end.sql`

New measurement/regression scripts (7): `scripts/12-54b-{browser,calendar-range,communications-performance,performance,range-read-model,reliability-regression,surfaces-browser}.mjs`.

Existing harness repairs (7): `scripts/12-48-preview.mjs`, `scripts/12-51a-browser-regression.mjs`, `scripts/calendar-publication-visibility-regression.mjs`, `scripts/calendar-read-model-contract-regression.mjs`, `scripts/calendar-read-model-helper-qa-regression.mjs`, `scripts/calendar-read-model-helper-regression.mjs`, `scripts/calendar-route-cutover-regression.mjs`.

Documentation/evidence: the unchanged baseline audit is added to version control alongside this report and `12-54b-measurements.json`. Generated screenshots were saved outside the repository and their tracked originals restored. Other pre-existing untracked files were left alone.

## 15. Remaining bottlenecks and rejected approaches

- Planner call count is unchanged. Conflict-rich rosters still need enrichment. Increasing the 25-person SQL limit or introducing a new batched RPC was rejected for this batch because bounded parallelism gave a large current-scale gain without another migration.
- Calendar still has distinct coverage and editing/selector reads. Combining them or broad progressive-loading work was deferred to avoid changing capability/projection contracts without evidence.
- Badge still computes its own 14-day summary once per shell/navigation. Full-project Needs Attention still scans successive 90-day windows. A global cache was rejected because it could expose private data or produce stale counts.
- Recipient review itself is unchanged and can remain expensive. It is now paid when requested; a set-based SQL rewrite would require a separately approved migration and exact eligibility/delivery equivalence testing.
- Month rendering, bundle splitting, fonts, branding, hotkeys, contact boundary and visual polish were not optimized without supporting evidence.
- Production browser timing, query-load behavior under concurrent coordinators and p95 remain unmeasured. Local synthetic gains do not establish production service-level targets.

## 16–17. Release boundary and next verification

The implementation commit is local only; see the final delivery manifest for its SHA. **NOT READY FOR PERFORMANCE RELEASE PREP** until local database availability is restored and the dedicated assigned-contact browser gate passes. Record or resolve the unrelated authenticated photo-upload failure before claiming that broader suite passes. No additional application refactor or database migration is currently justified by the measured findings.

Reproduction entry points are in `package.json`: `test:12-54b-performance`, `test:12-54b-range`, `test:12-54b-range-read-model`, `test:12-54b-reliability`, `test:12-54b-communications-performance`, `test:12-54b-surfaces:browser`, and `test:12-54b-browser-comparison`. Run database tests against the local Supabase container only. `12-54b-calendar-range.mjs --apply-local` is the explicit local-apply option; the ordinary test rolls back. The full browser comparison requires baseline `43229f5` served on localhost:3101 and this application on localhost:3102 against the same local database with email transport disabled. The isolated surfaces script launches its own synthetic app on port 3154 and pins the before sources to that baseline.
