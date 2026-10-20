# 12.55C stale route takeover correction

Verified locally on 2026-10-20 against frozen candidate
`5c363a3a6ed146177cbc1e9b9cf5dcb6296e1a8c`. This report supersedes that
candidate's navigation-ownership acceptance; it does not replace the original
12.55C handoff performance baseline. No deployment or production mutation.

## Reproduced cause

The installed Next 16.2.7 mutable action queue loses ownership during overlapping
navigations and server actions. A discarded action's completion invokes
`runRemainingActions`, which advances the CURRENT `pending` node, rather than
the discarded node. A live newer navigation can therefore leave the queue while
still running. Subsequent clicks cannot mark that detached navigation discarded.
Its late result can overwrite Next's internal canonical route. A later badge
server action can then publish that stale route to the actual browser URL/UI.

The frozen-build trace reproduced the owner's sequence. Representative times
are relative local trace times, not a production latency measurement:

1. At 1281 ms, Communications navigation 7 starts.
2. At 1291 ms, discarded Attention navigation 5 finishes and advances live
   navigation 7 to queued badge action 6, starting that badge from Calendar.
3. Tasks navigation 8 starts at 1409 ms. Communications 7 finishes at 1427 ms
   without being discarded, consuming pending navigation 8.
4. Final Overview intent 7 / router navigation 9 starts at 1548 ms and resolves
   at 1550 ms. Tasks 8 resolves at 1574 ms, still not marked discarded, and
   changes the internal canonical route to Tasks.
5. A badge action starts at 1724 ms from Tasks. Overview is visibly correct at
   1727 ms. The badge result at 2512 ms republishes Tasks; Tasks becomes visible
   at 2521 ms without another click.

Router action IDs and user-intent IDs are separate sequences. Instrumentation
was outside product UI, using the frozen build's browser response; shared
`node_modules` files were not modified. Raw evidence is in
`C:\Users\mtfis\Documents\Codex\2026-10-20\project-local-12-55c-race-fix`
(`baseline-router-trace.log`, `race-sequence.json`, `trace-frozen.mjs`).

## Correction and routing semantics

- A narrow build-input loader corrects the exact installed Next queue. A result
  may publish/advance only while its action owns the pending node. Discarded
  success/rejection cannot consume a newer navigation. Priority navigation owns
  the tail when no queued tail remains. Discarded server-action revalidation is
  preserved and flushed when the queue actually becomes idle.
- The loader requires Next 16.2.7 AND one of two exact LF-normalized source hashes
  (CJS/ESM). Unknown, upgraded, or already-transformed input fails the build.
  Webpack uses a pre-loader; matching Turbopack rules are configured, but only
  the supported Webpack path was verified. Shared dependencies remain untouched.
- Ordinary clicks use native Next Link navigation. `onNavigate` only records
  presentation intent. No click interception, custom history entries, automatic
  URL repair, navigation replay, or fake client router.
- Each mounted shell owns its synchronous presentation store and increasing
  intent IDs. Only the current ID can settle, fail, or clear that intent. It
  contains static route identity, never permissions or private datasets.
- Arrival requires both pathname and a real content/loading/error commit marker.
  The client handoff frame cannot certify its own arrival. Ownership-checked
  marker cleanup invalidates hidden/unmounted Suspense/Activity content without
  letting an old cleanup invalidate a newer route.
- A current-page return A-B-A remains a fresh intent and native navigation.
  Capture-phase popstate records a new history intent before Next restores it;
  it never pushes/replaces history or forces an obsolete click destination.
- Pending state has a fixed 30-second deadline, useful failure, and explicit
  fresh Retry. No automatic retry loop. Nonprimary links/forms release primary
  presentation ownership. Real authorization/loading/error boundaries remain.

The built browser chunk `8586-4e5df6de1bb5c5b3.js` contains the ownership guard.
Original normalized dependency hashes remained:

- CJS: `3143533797e0339ffc9f7d70772f3b6fd04e7268a7d396788b4641a47d482570`
- ESM: `34eee1e7ca47d2980794df475c2068e909b19adf19fbc41ebc712f5a507276d8`

Rejected approaches: pathname-only clearing could expose retained older content;
URL-repair navigation left stale internal state and disturbed history; wrapping
every click in another React transition could leave presentation pending. The
final implementation corrects queue ownership rather than hiding physical stale
navigation. A marker-cleanup omission found during testing was corrected before
the final acceptance runs.

## Stress and handoff measurements

All 72 final rapid-navigation cycles passed: six patterns, two viewports, two
prefetch modes, and three read-delay levels (100/250/500 ms). Patterns cover the
reported seven-destination sequence, A-B-C, A-B-A, A-B-C-A, A-B-C-B, A-B-A-B-A.
Desktop/sidebar and 390 px mobile/More include mouse and keyboard activation.
Every cycle checks newest destination presentation while settling, then checks
actual URL, visible heading, and active nav every animation frame for 2500 ms
AFTER actual nonprefetch RSC/actions settle plus 200 ms quiet. No late takeover.
Twelve additional pending-navigation Back/Forward cases passed. Shell retained;
mobile active state correct, no horizontal overflow or browser errors.

Final receipts: `accepted-ownership-{100,250,500}-prefetch-{0,1}.log` in the evidence
directory. Prefetch value 1 means blocked. All six processes exited zero.

Equivalent local production-mode handoff measurements, same fixture/helper and
read-delay model; these are ranges across the six-transition sequence, not
production claims. Acknowledgement, old-content disappearance and destination
frame were equal within each recorded sample:

| Read delay / prefetch | Samples | Prior frame | Corrected frame | Prior useful maximum | Corrected useful range |
| --- | ---: | ---: | ---: | ---: | ---: |
| 100 ms / blocked | 18 | 3-6 ms | 3-7 ms | 989 ms | 460-958 ms |
| 100 ms / normal | 18 | 3-7 ms | 2-8 ms | 975 ms | 390-988 ms |
| 250 ms / blocked | 6 | 3-8 ms | 3-6 ms | 2202 ms | 911-2154 ms |
| 500 ms / blocked | 6 | 3-8 ms | 2-8 ms | 4192 ms | 1617-4159 ms |

Prior 100/250 receipts: sibling `project-local-12-55c-release-prep/measurement-*.log`.
Prior 500 receipt: sibling `project-local-12-55c-evidence/candidate-cold-500.log`.
Final receipts: `verified-measurement-{cold-100,warm-100,cold-250,cold-500}.log`.
No meaningful fresh-data speed improvement is claimed. Immediate acknowledgement
is preserved; reliable final destination is the change. Data still waits on
authorized reads. The impatient-user exercise remained coherent through repeated
interruptions with no observed stale takeover or need to double-click.

## Regression and safety results

Passed on the final production-mode build:

- Immediate handoff, desktop/mobile, cold/warm, reduced motion, hidden/inert old
  content, retained shell, current-page return, interrupted navigation/history.
- Standard Overview, pending mode, streaming/prefetch mode; 98 safe prefetched
  frames, revoked grant fails closed, fresh account/project isolation.
- Full normal-latency Calendar suite, Day/Week/Month/List, saved return,
  dates/filters, assignment journeys, contact cards, mobile More/focus/overlays.
- Tasks, Volunteers, Needs Attention, Communications desktop/mobile suites;
  authoritative recipient review/resend safeguards and zero sends/provider calls.
- Separate assigned-contact browser regression; Quick View bearer payload,
  isolation, revocation, and privilege regressions.
- Forced Volunteers failure and progressive Communications-history failure show
  honest finite errors and successful fresh retries. Stalled optional project
  photo does not block useful Overview (743 ms locally while photo still pending).
- Request context, project grants, table privileges, instruction security,
  Calendar query helper/response reuse, Communications ledger/dispatch/batches.
- Exact function privilege regression run alone after all fixture/browser tests:
  93 functions, PUBLIC execute 0, hardened defaults/future functions, direct anon
  mutation denial, target changes 0, triggers preserved, residue 0.
- Exact unchanged instruction-security assertions ran with frozen Git SQL
  LF-normalized in memory, guarded against any content difference, avoiding the
  known Windows CRLF false failure without editing migrations or assertions.
- TypeScript, full ESLint, supported Webpack production build, credential scanner,
  staged and unstaged whitespace checks. New queue regression first proves the
  original fails, then proves corrected success/rejection/history/queued actions
  and deferred revalidation; unknown/double-patched sources rejected.

The pre-existing artificial-delay Calendar inspector issue is separate: the same
bulk-planner/close/single-assignment journey fails at a missing assignment-link
assertion on frozen baseline builds too. Full normal-latency Calendar passes.
No Calendar mutation logic or its existing assertions were changed in this fix.

## Scope and release boundary

Changed product/build files: `components/AdminRouteHandoff.tsx`,
`lib/adminRouteHandoff.ts`, `components/AdminShell.tsx`,
`components/AdminRouteLoading.tsx`, `app/admin/(workspace)/error.tsx`,
`next.config.ts`, `scripts/next-navigation-ownership-loader.cjs`.

Changed regression/report files: `scripts/admin-route-handoff-browser-regression.mjs`,
`scripts/admin-route-handoff-regression.mjs`,
`scripts/admin-route-ownership-browser-regression.mjs`,
`scripts/next-navigation-ownership-regression.mjs`,
`scripts/overview-browser-regression.mjs`, and this report.

No migration, schema/RLS/grant/function, notification transport, volunteer
schedule, credential, or dependency version change. No production mutation,
notification, deployment, or push. Test mutations used disposable local fixtures.

Remaining maintenance risk: the framework-source correction must be reviewed or
removed on a Next upgrade. Its exact-source fail-closed guard makes that explicit.
Fresh reads/secondary badges and initial authorization/hydration still take time;
the correction does not globally cache authenticated data. Production release
prep must verify the newly returned commit; this is not deployment approval.
