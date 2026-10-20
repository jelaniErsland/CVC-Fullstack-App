# 12.55B — admin navigation

Baseline application: `5a99763208837018a5387060e7e041709a7ffedf`.
Database boundary: 52 migrations, terminal `20261015120000`; no database change.
This is local implementation and verification, not a production release.

## Findings and change

The persistent admin shell already survived sibling navigation. Its destination
pages still awaited the complete authorized route state before returning any
content, and none of the six primary routes had a `loading.tsx` boundary. A small
Link pending dot responded immediately, but the destination itself appeared only
after the server read chain. This explains the difference between acknowledging a
click and feeling that the requested page has arrived.

Each primary route now has a lightweight, public presentation frame: title,
neutral control/search shapes, and an explicit loading status. These contain no
workspace data, counts, selected Calendar date/view, permissions, or private rows.
Normal Next Link prefetch can retain the frame, while every actual destination
read still performs authorization. There is no custom full-page prefetch, global
cache, client permission decision, or retained private dataset. Calendar's frame
does not select Month, so it cannot introduce a saved-view Month flash.

The existing shell, sidebar, mobile navigation, badge provider, URLs, and Calendar
navigation architecture remain. Before a destination frame is available, Next
keeps the previous content and the existing pending acknowledgement. Once the
frame is available it clearly identifies the new route as loading. It never
presents previous private rows as newly loaded destination data.

Overview starts the photo read alongside its operational read, but now awaits the
photo inside a separate Suspense boundary. The project identity fallback is real
authorized context. Today/Next up and Needs Attention no longer wait for an
optional photograph. With a deliberately stalled photo RPC, useful Overview
content appeared in 425 ms on a fresh local document load, while that RPC was
still pending. This is a controlled local proof, not a production timing claim.

Communications authorizes before mounting its real tabs, date/recipient controls,
and history filters. Its existing history read now streams as a promise instead
of blocking the entire workspace. Review and all sending-related commands remain
gated until history is ready. Failure is distinct from empty history and offers
a retry. Late initial history cannot overwrite a newer request; component state
is keyed by verified contact/workspace. Recipient review, resend confirmation,
eligibility, delivery transport, and server action authority are unchanged.

Calendar coverage already supplies assignment response states. Previously picker
support queried those same responses again after reading its assignment/profile
projection. The picker now accepts that same-request coverage snapshot, matching
workspace, item, active assignment, and response status against its independently
authorized assignment rows. Missing/new/mismatched rows receive the existing
fresh response query. No snapshot comes from browser input or survives a request.
This removes one response request and one dependent stage on the representative
populated Calendar path. Coverage and visible assignment status use one coherent
snapshot. The picker roster, assignment identities, contact boundary, and filters
still arrive together: separating those further would require a larger Calendar
contract change and could show misleading staffing/filter information.

## Measurement method

Production was observed read-only through the existing signed-in browser. Three
warm sequences used the same seven sidebar transitions. The browser tool could
observe a destination heading, but not exact paint acknowledgement, internal DB
calls, hydration, or reliable fully-settled timing. These numbers include tool
overhead; they must not be compared with local results as percentages.

| Production transition | Heading observed samples (ms) | Median (ms) |
| --- | --- | ---: |
| Overview → Calendar | 1439, 1347, 1196 | 1347 |
| Calendar → Needs Attention | 1513, 1442, 1281 | 1442 |
| Needs Attention → Communications | 730, 717, 495 | 717 |
| Communications → Volunteers | 1062, 1240, 928 | 1062 |
| Volunteers → Calendar | 1667, 1270, 1392 | 1392 |
| Calendar → Task library | 979, 490, 507 | 507 |
| Task library → Overview | 733, 685, 833 | 733 |

Local before/after used production-mode Webpack builds, loopback Supabase,
equivalent disposable populated fixtures, three warm samples per transition, and
100 ms added to each server Supabase fetch. The server preload is a test-only
script that rejects non-loopback Supabase targets and logs paths/timing only.
Browser rAF sampling starts from the actual captured click event, independently
records URL/frame changes, and distinguishes visible loading frames from loaded
content. Hidden retained route DOM is excluded. Frame numbers are DOM/rAF
observations, not precision display-hardware paint measurements. Useful content
means schedule/list content or usable Communications presentation controls;
Communications review may still await history. Fully settled page timing is not
claimed; server RSC completion and secondary actions are separate from this metric.

### Comparable controlled local medians (ms)

| Transition | Ack before → after | Frame before → after | Useful before → after |
| --- | ---: | ---: | ---: |
| Overview → Calendar | 3 → 5 | 970 → 15 | 970 → 851 |
| Calendar → Needs Attention | 3 → 6 | 938 → 17 | 938 → 949 |
| Needs Attention → Communications | 3 → 5 | 488 → 15 | 488 → 416 |
| Communications → Volunteers | 3 → 6 | 493 → 16 | 493 → 512 |
| Volunteers → Calendar | 4 → 5 | 948 → 14 | 948 → 840 |
| Calendar → Task library | 3 → 5 | 491 → 15 | 491 → 512 |
| Task library → Overview | 3 → 5 | 720 → 15 | 720 → 730 |

Calendar useful content improved 12.3% from Overview and 11.4% from Volunteers in
this controlled run. Communications presentation improved 14.8%. The remaining
primary read timings show no demonstrated improvement; small increases are not
presented as gains. The main measured change is that every destination frame is
available before these reads complete.

With no injected latency, after-change frame medians were 10–17 ms and useful
content medians 96–110 ms (individual useful samples 88–325 ms). These are local
results and do not predict production latency.

### Reads and dependent stages

The representative actual server trace includes the proxy and page checks. Each
navigation has two Auth calls and three parallel RLS context reads. React cache
continues to share the page's context with its layout within that request. The
proxy session boundary remains separate. No authorization/context call is removed
or cached across requests.

| Destination | Remote calls before → after | Primary dependent stages before → after | Remaining wait |
| --- | ---: | ---: | --- |
| Overview | 9 → 9 | 6 → 6 | range/coverage; optional photo now independent |
| Calendar | 12 → 11 | 8 → 7 | range, coverage, picker identities/roster |
| Needs Attention | 11 → 11 | 8 → 8 | range/coverage plus volunteer search enrichment |
| Communications | 6 → 6 | 4 → 3 | history becomes secondary; full stream still 4 stages |
| Volunteers | 6 → 6 | 4 → 4 | authorized roster |
| Task library | 6 → 6 | 4 → 4 | authorized presets |

These populated fixture counts differ from the older empty/helper-only audit
counts. Within Calendar's data helpers, the five-stage chain becomes four stages
when all response rows are reusable. A focused 100 ms/read picker test measured
three requests/two stages/224 ms versus two requests/one stage/114 ms and identical
results. Real local read-model/picker comparison also returned identical data.

Every private route first requires fresh verified Auth, effective capabilities,
and deterministic RLS workspace selection (category A). The page-await review
classified the remaining work as follows:

| Route | Primary content dependency (B) | Secondary work (C) and treatment |
| --- | --- | --- |
| Overview | authorized range and coverage summary | photo streams independently; badge remains separate |
| Calendar | range, item labels, coverage, assignment identities/names used by cards and filters | preset editing selector already runs beside the range read; optional notification detail stays on demand |
| Needs Attention | range, coverage, reviewed IDs, issue derivation | volunteer search/detail enrichment still completes the current single inbox-state contract; frame no longer waits |
| Communications | authorized context is sufficient for real presentation controls | delivery history streams; review/send stay gated; recipient eligibility remains on demand |
| Volunteers | authorized roster supplies rows and congregation choices | counts derive locally from those same rows; no extra stats read |
| Tasks | authorized presets | instruction-application preview is explicit deep-link/action work, absent from ordinary navigation |

Independent grants/contact/workspace reads, Calendar labels/coverage, and the
Calendar selector/range were already parallel before this batch and stay so. No
gain is attributed to redoing that earlier work. Deferring Needs Attention's
enrichment or independently mounting Calendar editing state would need additional
client-state contracts; those broader changes were not necessary for early frames.

There is still one destination RSC request per ordinary warm transition. Early
transitions also fetch module/frame prefetch resources. One secondary badge
server action per navigation remains; it is shared by desktop/mobile but still
repeats authorized attention work. This batch does not claim fewer total
navigation RSC requests or badge work. Counts above exclude that separate badge
request. Moving it to a carefully bounded freshness/event policy is future work.

## Prefetch and bundle findings

The installed Next 16.2.7 guide documents dynamic-route prefetch through loading
boundaries. Actual automatic/intent prefetch was inspected, including header
variants `next-router-prefetch: 1` and `2` and segment prefetch. A local privacy
gate completed the actual prefetched responses through Playwright's network API
to avoid Chromium discarding speculative response bodies. Fixture names, email,
and scheduled work were absent. Revoking a grant after prefetch denied the next
roster read. The server trace of frame prefetch performed proxy Auth checks but
no private table/RPC reads.

With all native prefetch requests deliberately blocked, destination frame times
were 145–161 ms under the same 100 ms/read setup, compared with warm prefetched
14–17 ms medians. Prefetch is therefore useful, not just configured. Extra manual
hover/focus/touch router prefetch was rejected as unnecessary duplication; native
Link already supplies intent scheduling. Aggressive full private-page prefetch
and stale private-data retention were rejected because they would expand the
permission-change/cache boundary.

No measured transition had a browser long task over 50 ms. Calendar's first
measured route added about 54 KB of encoded JS resources; subsequent warm visits
added none. Other first route resources were about 7–16 KB. Local resource fetch
durations were single-digit milliseconds. Hydration time was not independently
isolated; the trace does not support blaming bundle parsing for the observed
0.5–1 second controlled waits. No speculative bundle split was added.

## Reliability and regression evidence

Overview, Needs Attention, Volunteers, and Tasks initial reads now have finite
read deadlines. Calendar and Communications retain their existing deadlines.
The workspace error boundary keeps navigation mounted and provides a fresh retry.
Forced stalled Volunteers and history reads reached honest error states at their
deadline and successfully retried. Failed history never appeared as “No deliveries
yet.” The progressive Communications React Flight thenable was normalized with
`Promise.resolve` after the first browser run caught an invalid chained catch;
the corrected path passed browser/failure tests.

Passed current local production-mode browser checks:

- Full desktop/mobile Calendar suite: Day/Week/Month/List, previous/next/Today,
  saved return, remembered/volunteer filters, recurrence, overnight/multi-day,
  meals, assignments/picker, focus, and mobile More/overlay callbacks.
- Dedicated assigned-contact desktop/mobile Calendar and Quick View privacy,
  repeated twice after aligning entry readiness with the streamed-frame contract.
  The heading alone is no longer treated as an authorized, hydrated schedule.
  Contact field, isolation, and zero-data-change assertions are retained.
- Overview, Needs Attention, Communications eligible/excluded authoritative
  review, changed selection, intentional resend protections, Volunteers, Task
  library, and bearer Quick View isolation/revocation/payload privacy.
- Persistent shell and pending-frame modes; rapid seven-route impatient-user
  sequence, interruption with a late response, back/forward, direct entry/reload,
  desktop/390 px mobile, account/project refresh, selected navigation, and no
  horizontal overflow. The new destination acknowledges immediately; loaded data
  still visibly settles later under injected latency. No stale route replaced the
  latest destination and the shell stayed usable.
- Existing request-context/grants, table privileges, assigned-contact, instruction
  privacy, and Quick View security checks. Systemic function policy: 93 exact
  functions, PUBLIC execute 0, defaults denied, anonymous direct mutation changed
  zero rows, residue 0. The global fingerprint privilege test was rerun alone
  after an earlier concurrent-fixture run invalidated its stable-data assumption.
- Real local picker/assignment coverage and snapshot fallback/isolation checks;
  Communications ledger/dispatch/batch simulations with provider stubs, no real
  sends. No notification transport changes.

The legacy Calendar stabilization source assertion expected bare router.push,
although production already uses startCalendarTransition. Its narrow assertion
now checks that existing transition and pending copy; no Calendar UI code was
changed to accommodate it. Pending-navigation tests now require a truthful early
destination frame rather than requiring the old page to remain until all data is
ready. Privacy and loaded-content checks are not relaxed.

Final gates include TypeScript, full ESLint, `git diff --check`, the supported
Webpack production build, tracked-source credential scan, and the exact existing
instruction-security regression through canonical Git/LF content to avoid the
known Windows CRLF comparison issue. No schema, RLS, grants, function definitions,
production configuration, volunteer schedule, or notification authority changed.
No migration is needed. Production activity was read-only: navigation only,
no notifications, assignments, or response submissions; no deployment.

Raw local timing JSON, server path traces, and desktop/mobile loading-frame
screenshots are retained outside the release tree in the October 19
`project-local-12-55b-evidence` folder. Screenshots contain disposable fixture data.

## Remaining limitations

First entry into the authenticated layout still waits for fresh context. The
server/data portion of Volunteers, Tasks, and Needs Attention is unchanged.
Needs Attention volunteer enrichment remains behind its issue read; Calendar
still needs roster/identity support for accurate visible assignment/filter data.
The badge repeats secondary work. Slower real devices, distance to production,
and production row volume can still increase useful-content time. There is no
post-change production speed claim until an owner-approved deployment is tested.
