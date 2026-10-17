# Project Local 12.54D — admin navigation and Fellow workers

Local implementation and verification only. The owner supplied application
`0b608fb3e8a0736bad579f83fe7afb9ec7c4ff60` and migration 51 as the
production baseline. No production mutation or deployment was performed in
this batch; current production state was not re-queried for this local work.

## Admin navigation findings and changes

The six primary admin pages each instantiated `AdminShell`, so the sidebar,
mobile navigation, badge provider, and header remounted on every sibling route
transition. The new `(workspace)` route-group layout keeps that shell mounted
while the route content changes. URLs are unchanged. Selected navigation uses
the current pathname. Page reads and mutations still perform their existing
authorization; the layout context supplies navigation presentation. Calendar's
mobile More callbacks are registered by its page wrapper and still reach the
persistent shell.

`resolveVerifiedAdminContext` is memoized with React `cache()` for one server
request. The proxy and page each still verify the user: they are separate
request/security boundaries and were not collapsed. No cross-request or global
authorization cache was added. Overview project photo and primary state now
begin together. Needs Attention seen state and Calendar source read now begin
together after authorization. Communications history still depends on its
authorized workspace context. Calendar picker data still depends on visible
item IDs; no unsafe Calendar dependency was removed.

Default Next.js Link prefetch behavior remains. No custom hover/touch prefetch
was added, because there was no measured benefit that justified retaining
private RSC payloads longer across grant changes. The existing route pending
indicator now remains visible in the persistent shell while the previous
route content remains labeled as the previous route. No full-screen loading
state was added.

### Matched warm local browser sample

The same fixture, browser, machine, and production build mode were used against
the frozen 12.54C baseline and the 12.54D candidate. One matched traversal was
recorded; these are local observations, not a production speed claim. Times
are milliseconds from click. The shell remounted on every baseline transition
and remained connected on every candidate transition.

| Route | Useful baseline | Useful candidate | Change | Visible acknowledgement baseline → candidate | URL baseline → candidate |
| --- | ---: | ---: | ---: | ---: | ---: |
| Overview → Calendar | 353 | 327 | -7% | 18 → 25 | 309 → 291 |
| Calendar → Needs Attention | 256 | 215 | -16% | 12 → 22 | 246 → 207 |
| Needs Attention → Communications | 192 | 155 | -19% | 14 → 16 | 185 → 151 |
| Communications → Volunteers | 204 | 174 | -15% | 13 → 14 | 196 → 166 |
| Volunteers → Calendar | 255 | 255 | 0% | 19 → 20 | 232 → 228 |
| Calendar → Task library | 183 | 175 | -4% | 17 → 14 | 175 → 166 |
| Task library → Overview | 273 | 175 | -36% | 19 → 18 | 266 → 170 |

Settled times in this sample were the same as useful times to within 1 ms.
A later warmed candidate run produced 89–164 ms useful content across these
routes, but it is not used for the percentages because its cache state differed.
The authenticated pending-navigation browser test held the destination RSC
response: the pending indicator appeared while Overview and the same shell
remained visible, then cleared after Tasks arrived. Rapid clicks, browser
back/forward, desktop/mobile navigation, and 390 px overflow checks passed.

The request-local call graph still has two Auth calls per navigation (proxy
and page), plus three parallel authorized context reads. Tasks and Volunteers
remain at six remote helper calls/four core stages; Overview at eight/four;
Calendar at eight/five. The layout does not add a second page Auth call because
its context read shares the request cache. Needs Attention's secondary seen
read and Overview's photo read no longer add serial dependency after their
authorized context is available. A separate Communications stage count was
not instrumented; its authorized history read remains dependent on context.
The remaining Calendar five-stage chain is dominated by the authorized range
read and subsequent picker context; changing that contract would exceed this
batch. First entry into the admin group still waits for verified navigation
context. Sibling transitions are the measured improvement.

## Fellow workers

Migration `20261015120000_volunteer_fellow_workers.sql` changes only
`read_volunteer_schedule(text)`: it appends `fellow_worker_names text[]` to each
assignment row. The existing bearer token hash verification, expiry,
revocation, volunteer readiness, workspace state, own active published
assignment filtering, and execute grants remain. No table grants or RLS policy
change. The scheduled item IDs visible to the requester are bounded by the
existing 100-row schedule limit. A single set-based aggregation selects active
confirmed or awaiting-response assignments to those exact items in the same
workspace, excludes the requester and inactive profiles, and sorts names
alphabetically. Adjacent overnight items remain separate because matching is
by item ID. The caller receives names only: no coworker ID, response, contact,
congregation, note, profile field, or profile link. Declined requester rows
have an empty fellow-worker array.

The volunteer detail sheet shows “Fellow worker” for one name, “Fellow workers”
for more, and no section for zero. Collapsed schedule cards remain uncluttered.
The browser and database fixtures covered one/none/multiple names, order,
similar and duplicate names, shared household email, requester exclusion,
declined/awaiting coworkers, inactive/canceled coworkers, requester assignment
removed after token issuance, two same-day/same-time items, overnight and
adjacent overnight items, cross-project isolation, and private field absence.
The dense local fixture returned 105 names in one schedule RPC, sampled at
7 ms on the final run (69 ms on a concurrent-build run); no N+1 read was
introduced. These are local fixture timings, not production latency claims.

The migration uses an explicit transaction and was applied only to local
Supabase; the local ledger has 52 migrations, terminal `20261015120000`.
A forced SQL error after a
temporary revoke inside a local transaction left the function definition hash
and anon/authenticated/service-role execute privileges unchanged, confirming
rollback behavior. Invalid/revoked token and direct-table denial tests passed.
Release preparation must apply this migration before deploying the app; the
app parser safely treats a missing field as an empty list during transition.

## Validation

- Production build (`next build --webpack`), TypeScript, and ESLint passed.
  The default Turbopack build cannot resolve this workspace's external
  `node_modules` junction; Webpack built the same production routes.
- Full Calendar desktop/mobile regression passed twice after the shell change:
  Day, Week, Month, List, date/Today, saved view, filters, focus, creation,
  assignment editing, and mobile sheets. Calendar's delayed 700 ms read showed
  pending acknowledgement at 21 ms.
- Authenticated admin navigation, pending response, Overview, Needs Attention,
  Quick View, volunteer token access, response flow, and Fellow workers browser
  fixtures passed. Browser response tests used local recording behavior only.
- Function privilege policy passed: 93 exact functions, no PUBLIC execute,
  default grants denied, direct anon mutation denied, zero residue. Project
  table privileges, contact grants, Quick View privilege, assigned-contact
  privacy, and project isolation regressions passed.
- Assignment notification, Communications ledger/dispatch, and intentional
  resend simulations passed with no real provider send. The local mobile
  Communications browser fixture passed server-authoritative eligible/excluded
  review, selection refresh, and resend protection with zero sends.
  Communications initial render still avoids the expensive
  recipient review; its existing synthetic check measured about 30–37 ms for
  history/shell versus 549–566 ms before that earlier optimization, with the
  543 ms review remaining on demand. 12.54D did not alter send authority.
- The existing picker/badge fixture passed: two badge reads before versus one
  shared read after the earlier change; the picker request failure/retry and
  badge late-result protections still passed. 12.54D did not change those
  contracts.

Older source-snapshot checks for volunteer persistence and the assignment
detail route were updated to the current contracts and now pass. The changes
recognize the existing volunteer CSV route and delete RPC, the current
emergency-contact profile fields, Needs Attention's current inbound link, and
one exact generated loopback database URL in a local recovery test. The
credential scanner remains active for every other URL and tracked file.

No production release is included. The remaining bottlenecks are server and
network latency on route-specific authorized reads, the Calendar picker
dependency, and first-entry layout authorization. Custom prefetch, global
authorization caching, and a broader Calendar rewrite were rejected because
their correctness/security tradeoffs exceeded the measured benefit here.
