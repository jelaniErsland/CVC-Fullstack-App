# 12.55C — Immediate admin route handoff

Implementation and local verification only. Production remains application
`28714fd206af598563f5a9b97a77a8a80c58710d`; no deployment or migration is included.
The database baseline is 52 migrations / `20261015120000`.

## Cause of the old-page linger

12.55B selects navigation from the committed pathname. Its Link pending indicator
acknowledges intent, but React keeps the previous route content during the router
transition. A loading.tsx fallback cannot appear before it is available in the
client. When its prefetch is missing/incomplete, the first authorized/proxy/RSC
response still delays both the destination identity and the pathname commit.
Adding more loading.tsx files cannot independently close this pre-response gap.

The installed Next 16.2.7 Link implementation calls onNavigate before its router
transition. The new layer uses that event for urgent presentation state and then
delegates the single real navigation to Next's router inside useTransition.

## Handoff architecture

The persistent AdminShell owns one volatile intent: a generation, a whitelisted
primary destination/href, the origin pathname and failure state. There is no
private dataset, project identity, permission decision or storage cache in it.
Six primary destinations are covered: Overview, Calendar, Volunteers, Attention,
Communications and Tasks.

On ordinary primary activation:

1. Select the intended destination immediately, including aria-current.
2. Hide and make the previous content inert and aria-hidden without unmounting it.
3. Render the existing neutral AdminRouteLoading presentation locally.
4. Perform one real router.push inside a transition.
5. Hand off to the matching committed server segment/loading frame, then the
   fresh authorized page. A superseded pathname cannot release a newer mask.

Returning to the current pathname while another destination is in flight keeps
the latest intent until the owned router transition settles. An early version
treated that activation as a no-op; rapid tests exposed the gap and it was fixed.

Next Link remains the anchor/prefetch owner. onNavigate excludes modified,
external and download clicks; Ctrl-click was verified to open a separate tab
without changing the original. Mobile primary links and More destinations use
the same small wrapper. Page-internal controls and Calendar date/view transitions
retain their existing behavior.

Native popstate records presentation intent only. It does not manufacture history
entries or issue a duplicate push. Direct entry/refresh starts with no pending
intent. Back/forward follow real browser history.

Client and server frames reuse the same visual component. The client version
does not claim an authorized view/date, expose stale private rows, or offer fake
working controls. It has one polite opening announcement; the server fallback
retains its existing loading status. Focus remains on navigation rather than
being forced into skeletons. Old hidden content is excluded from accessibility
and interaction. The new handoff has no animation to disable for reduced motion.

## Finite failure and interruption

An unresolved handoff has a 30-second deadline, a destination-specific error and
explicit Retry navigation. The failed state reconciles selected navigation with
the actual pathname. Retry performs fresh router work; there are no automatic
retry loops. Timers are canceled/scope-checked by generation. An unnecessary
presentation-only dismiss action was removed because it could not cancel a
pending router request safely.

The existing server route error boundary now retains the destination title and
its real retry action. Existing 20-second read deadlines/progressive reads stay
in place. Forced stalled Volunteers reads and Communications history reached
honest errors and recovered with the shell retained. A stalled optional photo
did not block Overview operational regions (599 ms local observation).

Three consecutive cold desktop/mobile stress runs passed: held RSC responses,
Calendar → Volunteers → Calendar → Attention, return-to-current cancellation,
late response isolation, keyboard activation, native modified click, no fake
handoff history entries, back/forward, refresh, 30-second simulated timeout and
successful retry. A separate fast-human sequence included Calendar, Volunteers,
Attention, Communications, Tasks and Overview with 90 ms pauses between clicks.
It acknowledged each latest destination without requiring a second click.

## Comparable before/after measurements

Frozen 12.55B and the candidate used the same local Supabase fixtures, host,
Webpack production mode, browser and measurement logic. Three samples per route
at 100 ms added latency per authorized read. Cold means useful prefetch requests
were blocked. These are local results, not production speed claims.

A/B/C are separately sampled at animation frames: nav selection, previous heading
no longer visible, and destination heading/frame visible. They coincide in these
samples. D is useful destination content, excluding loading/handoff frames. E is
observed completion of non-prefetch RSC/action requests followed by 100 ms quiet;
it excludes unrelated image/analytics traffic and is not a paint measurement.

Cold medians, milliseconds:

| Transition | A/B/C before | A/B/C after | D before | D after | E before | E after |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Overview → Calendar | 161 / 161 / 161 | 4 / 4 / 4 | 932 | 890 | 1039 | 1007 |
| Calendar → Volunteers | 169 / 169 / 169 | 4 / 4 / 4 | 547 | 516 | 1061 | 963 |
| Volunteers → Calendar | 160 / 160 / 160 | 4 / 4 / 4 | 858 | 883 | 1015 | 1000 |
| Calendar → Attention | 161 / 161 / 161 | 5 / 5 / 5 | 959 | 970 | 1064 | 1071 |
| Attention → Communications | 167 / 167 / 167 | 4 / 4 / 4 | 471 | 468 | 1012 | 988 |
| Communications → Overview | 158 / 158 / 158 | 4 / 4 / 4 | 774 | 765 | 995 | 1005 |

Useful-data/settling differences are ordinary run variation; no read optimization
or improvement in D is claimed. The improvement is making A/B/C independent of
the first network response.

With normal prefetch, baseline A/B/C medians were already 7–12 ms; the candidate's
were 3–4 ms. Across the candidate's 18 cold 100 ms/read samples, frame observations
were 2–9 ms; the 18 normal-prefetch samples were 2–8 ms. All A/B/C budget assertions
were below 100 ms.

Additional cold six-route samples:

| Added read latency | Baseline frame range | Candidate frame range | Candidate slowest useful content |
| --- | ---: | ---: | ---: |
| 250 ms/read | 304–340 ms | 4–7 ms | 2158 ms |
| 500 ms/read | 560–592 ms | 3–8 ms | 4192 ms |

The loading destination remains clear during those longer waits. The local
impatient-user result is immediate acknowledgement with stable route identity;
there was no apparent reason to click twice. This does not promise instant data
or first-document rendering before hydration.

Raw comparison JSON, traces, screenshots and test receipts are retained in
`C:\Users\mtfis\Documents\Codex\2026-10-20\project-local-12-55c-evidence`.

## Regression and privacy evidence

Passed on the final production-mode candidate:

- Full normal-latency Calendar suite: Day/Week/Month/List, date navigation,
  saved return/no transient Month, filters, picker and assignment editing,
  persisted save/cancel, desktop/mobile focus and More/overlay behavior.
- Separate assigned-contact browser gate and Quick View payload/bearer
  isolation/revocation checks. Contact details remain on demand.
- Overview standard desktop/mobile, held pending-frame, streaming/prefetch and
  project/account-isolation modes; Tasks, Volunteers and Needs Attention suites.
- Communications eligible/excluded authoritative review, selection refresh,
  intentional resend and zero provider sends/calls in the browser fixture.
- 96 actual safe prefetch response bodies; revoked access after prefetch failed
  closed. No global authorization/private-data cache was added. Proxy, request
  verification, page capability checks and RLS remain unchanged.
- Request-context/grants/table privileges, assigned-contact, instruction privacy,
  Calendar response-snapshot/fallback and real assignment management checks;
  Communications ledger/dispatch/batch simulations with disabled real providers.
- Exact function policy run alone: 93 classified functions, PUBLIC execute 0,
  hardened defaults, direct anonymous mutations denied, target changes 0,
  triggers preserved and residue 0.
- Exact instruction regression with frozen Git SQL normalized to LF in memory;
  unchanged assertions and no disposable security export. A guard verifies that
  normalized migration contents still match the frozen baseline.
- TypeScript, full ESLint, supported Webpack production build, tracked-source
  credential scanner and git diff whitespace checks.

The pre-existing delayed Calendar save/refresh issue remains: the inspector can
close after a save following the bulk assignment journey. The narrow 100 ms/read
journey fails at the same missing assignment-link assertion on both an isolated,
clean frozen `28714fd` build and the candidate. The full candidate suite passes
at normal local latency. This is not called a new handoff regression or hidden
by removing the test; the focused mode and both failure receipts are retained.
It remains a separate Calendar mutation/refresh limitation for release review.

The cancellation regression was strengthened: an already-matching notice URL or
a row hidden by streaming cannot substitute for the specific server action's
response. Original database, response preservation, privacy and notification
assertions remain. No Calendar product/mutation code was changed.

## Exact scope and remaining limitations

Product files:

- components/AdminRouteHandoff.tsx
- lib/adminRouteHandoff.ts
- components/AdminShell.tsx
- components/AdminNav.tsx
- components/AdminRouteLoading.tsx
- app/admin/(workspace)/error.tsx

Regression/report files:

- scripts/admin-route-handoff-browser-measurement.mjs
- scripts/admin-route-handoff-browser-regression.mjs
- scripts/admin-route-handoff-regression.mjs
- scripts/overview-browser-regression.mjs
- scripts/calendar-regression.mjs
- docs/audits/12-55c-immediate-route-handoff.md

No migration, schema, RLS, grant, database function, notification transport,
volunteer schedule, production configuration or dependency change. No real
notifications or production mutations. Production remains frozen 12.55B.

Initial authenticated entry still waits for server context/hydration. Fresh data
and secondary badge work retain their existing latency. Non-primary destinations
retain their existing navigation behavior. The delayed Calendar editing issue
above is unchanged from the baseline.

Automatic approval review rejected cleanup of the disposable baseline worktree
with only “blocked by policy.” It remains at
`C:\Users\mtfis\Documents\Codex\2026-10-20\project-local-12-55b-calendar-baseline`.
This is source/local build material, not a production restore/dump. Its dependency
junction must not be traversed to delete the shared dependency target. The
checkout is clean and detached at frozen 12.55B; it is outside the candidate tree.

The final exact candidate SHA is returned with the implementation handoff.

READY FOR 12.55C RELEASE PREP
