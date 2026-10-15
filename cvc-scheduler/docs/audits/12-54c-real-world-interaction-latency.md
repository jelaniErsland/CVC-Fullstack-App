# 12.54C real-world interaction latency

Baseline: production application `084ed7feb600a2a8dbb8e84e86736b459bf3c00e`, observed 2026-10-15. This is an application-only change. No production data was written, no notification was sent, and no migration was added.

## Measurement limits

The authenticated production browser allowed DOM and URL observation, but its Performance and Resource Timing APIs were unavailable. The times below are tool-mediated wall times from click to observed result, including a roughly 270–340 ms click bridge. They are not native browser timings. Server/function/database stage durations could not be extracted from that browser. The local call-graph harness is cited separately and is not presented as a production waterfall. Repeated samples use the median; single samples are labeled.

| Approximate rank | Production interaction | Click to useful/result (ms) | Samples |
| --- | --- | ---: | ---: |
| 1 | Volunteers → Calendar | 2,929 | 1 URL-verified |
| 2 | Overview → Calendar, including saved-view redirect | 2,037 | 1 traced |
| 3 | Overview → Calendar | 1,777 | 2, provisional route observations |
| 4 | Calendar → Needs Attention | 1,587 | 3 |
| 5 | Week → Month | 1,480 | 2 |
| 6 | Day → Week | 1,219 | 2 |
| 7 | Communications → Volunteers | 898 | 2 |
| 8 | Today | 807 | 1 |
| 9 | Month → Day | 777 | 2 |
| 10 | Needs Attention → Communications | 763 | 3 |

Other observations: next date 477/692/982 ms (median 692); Calendar item opening 451/537 ms (median 494); assigned-volunteer contact sheet opened with a loading state in 353 ms and details were settled at the next 64 ms observation; recipient review finished in 1,897 ms with the Communications page already useful; picker search changed the visible list in one 275 ms tool-mediated action. The live Needs Attention Food filter changed its pressed state after a 282 ms tool-mediated click, with no route change. No production selection was saved.

## Root cause and change

The desktop and mobile Calendar navigation links pointed to bare `/admin/calendar`. The server correctly defaults that route to Month. After hydration, the Calendar client read the user's remembered view and issued `router.replace` to it. In a traced Overview → Calendar return, Month was visible for about 850 ms, and the browser made a second Calendar navigation before Day became useful at 2,037 ms.

The app now stores only `{view,date}` under a validated project-key storage key when an authorized Calendar is rendered or its view/date changes. Desktop and mobile navigation links use that route hint for the same project. The destination still performs its normal authorized server read. If storage is unavailable, the original bare link remains the fallback. Direct bare Calendar URLs retain their Month default and remembered-view behavior. Calendar view/date controls now show “Updating Calendar…” inside the existing schedule panel while a server navigation is pending; the prior schedule remains visible.

The route hint contains no contact details, assignments, grants, tokens, or authorization decision. Project keys separate presentation state. No server data was cached across requests or users.

## Before/after evidence

| Interaction | Production before | Local after | Claim |
| --- | --- | --- | --- |
| Return to Calendar from Overview | 2,037 ms to Day; wrong Month visible about 850 ms; two Calendar route reads | Desktop 252 ms and mobile 220 ms for the local away-and-return regression; direct saved-view link and no Month state | One unnecessary Calendar route read removed; wrong-view exposure 850 → 0 ms in the tested journey. Cross-environment total times are not a speed percentage. |
| Calendar next date | Median 692 ms | Pending acknowledgement 27 ms while a 700 ms local response delay was injected; full test step 1,742 ms including setup and reset | Input is acknowledged before the server reply. No full-result speed claim. |
| Month → Day / Day → Week / Week → Month | 777 / 1,219 / 1,480 ms medians | Existing server navigation retained; pending feedback added | Full-result latency remains to be measured on a deployed build. |
| Assignment picker first searchable roster / availability | Live roster and search were available on opening the item; availability had settled by later observation | Existing 12.54B synthetic 300-person fixture: first useful 161 ms, availability 737 ms at 50 ms request latency | No 12.54C change; no production after comparison. |
| Assigned-volunteer contact | Sheet with loading state in 353 ms, details at next 64 ms observation | Existing progressive authorized sheet retained; dedicated local browser gate passed | No 12.54C change. |
| Needs Attention support filter | State changed after a 282 ms tool-mediated click | Existing local presentation filter retained | No 12.54C change. |
| Needs Attention → Calendar | Not independently timed in production | Saved-view route is used by the local tested navigation link | No comparable end-to-end timing. |
| Communications navigation | Median 763 ms from Attention | Existing progressive page retained | No 12.54C change. |
| Recipient review | 1,897 ms live tool-mediated, on demand | Existing server-authoritative review retained | No 12.54C change. |

The local 12.54B harness still shows Calendar at 8 remote calls and 5 dependent stages, or 1,250 ms at a synthetic 250 ms per-stage delay. It also shows two auth calls per ordinary route (proxy and page). 12.54C does not claim to reduce this initial-load waterfall. The return-link fix prevents a second traversal of it when returning to a remembered view.

## Investigated and left unchanged

- Picker names/search already render before availability context completes. Moving more server data into the initial Calendar payload would hurt the primary schedule and broaden private data.
- Assigned-contact details already load inside an open sheet through an authorized action. Moving phone/email into Calendar rows would break the privacy boundary.
- Needs Attention filters are local presentation filters. The observed delay was dominated by the browser-control bridge, so no server/filter rewrite was justified.
- Communications initial content already appears without recipient review; review remains on demand and server authoritative.
- A local Overview fixture showed 98/169/159 ms warm reload-to-useful samples (median 159 ms). Parallelizing its photo read would add concurrent auth work without a measured user benefit.
- Dynamic admin routes do not provide a safe, measured basis for broad prefetching. Cached authorized RSC payloads could become stale after permission changes. A shared loading/layout rewrite or local Calendar data reuse would be broader than this evidence supports.

## Verification

Passed locally: full Calendar desktop/mobile browser suite (Day, Week, Month, List, navigation, filters, editing and assignments); new desktop/mobile return-link checks; delayed server-read pending feedback; dedicated assigned-volunteer contact browser gate; Needs Attention desktop/mobile browser; Quick View desktop/mobile browser and privilege/isolation checks; grant isolation; assignment-picker reliability; 12.54B picker/badge browser synthetic tests; volunteer schedule access and response server regressions; assignment-instruction privacy/function policy; TypeScript; full lint; webpack production build. The full Calendar suite used disposable local Supabase fixtures and left no notification deliveries.

The older admin-navigation-pending browser script expects an obsolete “Tasks” link and has no authenticated fixture; the current UI uses “Task library.” The older volunteer-schedule-access browser script expects an obsolete “Here’s your schedule” heading; the current volunteer home uses a personalized welcome and Next assignment section. Both fail on those outdated selectors, outside the changed code. Current Calendar navigation, contact, Quick View, volunteer server-access and response checks passed. A security script initially failed because this Windows worktree checked historical SQL out with CRLF; it passed after normalizing those two test-input files to the committed LF form. The worktree files were restored and no migration is in the diff.

## Release boundary and remaining latency

No database migration is required. No deployment was made. The remaining ordinary navigation delay is the authenticated dynamic route work (including proxy/page auth and the Calendar read-model stages). View/date changes still perform authorized server navigation; the new status improves response feel but does not shorten that server wait. Production after timings require the later controlled release and cannot be inferred from local fixture timings.

## Files changed

- Route hints and Calendar feedback: `lib/adminViews/calendarReturn.ts`, `components/AdminNav.tsx`, `components/AdminShell.tsx`, `components/CalendarClient.tsx`.
- Authorized project-key projections: `lib/calendar/routeRead.server.ts`, `lib/overview/routeRead.server.ts`, `lib/needsAttention/routeRead.server.ts`, `lib/tasks/routeRead.server.ts`.
- Navigation wiring: `app/admin/dashboard/page.tsx`, `app/admin/volunteers/page.tsx`, `app/admin/needs-attention/page.tsx`, `app/admin/announcements/page.tsx`, `app/admin/tasks/page.tsx`, `app/admin/calendar/drafts/page.tsx`.
- Verification and report: `scripts/calendar-regression.mjs`, `docs/audits/12-54c-real-world-interaction-latency.md`.
