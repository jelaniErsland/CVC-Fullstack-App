# 12.48 Batch 1 coordinated release readiness

Prepared September 25, 2026 (local time), with refreshed September 26 UTC validation, on `codex/12.48-batch-1`.

**Release status: authorized for deployment — pre-release checks passed.** The user established the existing authorized production session and confirmed Overview/Calendar. Both were independently verified in the correct workspace. Batch 1 and the assignment enhancement form one release candidate; deployment and post-release results will be appended here. No Batch 2 work began.

## Candidate and scope

Base commit: `5bb1cf6a0609285c7c4c53d4e3516727b67adbac`. A fresh `git ls-remote origin refs/heads/master` returned that hash. The authorized Vercel project dashboard independently confirms Production/Ready at that exact full commit, deployment `FimEmup6H3obRsseCytNfi6qZ7v4`, with `master` as the production branch. There is no 12.48 deployed version or release commit yet.

The candidate includes the approved shared foundation, navigation, Overview/photo identity, grouped-row routing, disclosure chevron, Quick View route repair and meal presentation, plus the focused Day/List assignment display. The [review report](12_48_BATCH_1_REVIEW.md), [foundation contract](design/12_48_SHARED_FOUNDATION.md), [gallery](../../previews/12.48-batch-1/index.html) and [source/test diff](../../previews/12.48-batch-1/source-diff.patch) form the review package.

The full source diff was reviewed across page composition, shared controls/tokens, capability-derived navigation, Overview aggregation, Calendar routing, project photos and read-only presentation. The final addition uses only the existing item-scoped assignment projection. Repeated work remains separate by `calendarItemId`; the component never matches people by task title or preset. The existing coverage model supplies the fraction and excludes declined responses from assigned staffing. Confirmed and Awaiting reply remain distinct visible labels.

Day cards and List rows show the first three assigned people immediately, followed by an accessible native disclosure for remaining names. Empty, unavailable and unauthorized assignment projections have separate behavior. No interactive control is nested inside the task-selection button. Meals retain headcount/contact treatment and never receive a volunteer roster. Ordinary food-service shifts use the normal roster.

Authenticated Quick View displays the same roster only when the existing server state permits volunteer viewing. Its read-only adapter now preserves an assignment-query failure rather than disguising it as an empty successful roster. Private-field stripping is unchanged. The bearer `/qv` surface does not gain this new roster UI; its existing RPC, projection and inspector permissions are unchanged.

No server action, migration, schema, RLS policy, authentication code, notification safeguard, backup schedule, recovery implementation, deployment setting or production photo-upload setting was changed. The pre-existing 12.47 closeout documentation edits in this working tree must remain historical documentation; they are not new release operations. Temporary frontend fixtures remain outside the product app and do not appear in the production build.

## Executed checks

| Check | Result and meaning |
| --- | --- |
| ESLint | Passed with no warnings on the final source. |
| TypeScript and production build | Passed; Next.js 16.2.7 built successfully with 76 static pages. |
| Overview regression | Passed, including two distinct records with identical displayed context and single/group link behavior. |
| Calendar model contract/helper | Passed, including capability boundaries and confirmed/pending/declined coverage rules. |
| Verified admin context | Passed the existing authorization/call-graph regressions; this is not a live authenticated browser journey. |
| Navigation, route and foundation contracts | Passed, including 36 route cases and private-field stripping/read-only authority. |
| Assignment visibility browser fixture | Day/List, admin/authenticated-Quick-View presentation, 1440/390/320px, zero/one/mixed/many assignments, expansion, exact item/date selection, repeated-task dates, read-only affordances, hidden/error states, meal exception and no new bearer roster. Uses synthetic component state, not real Auth/RLS. |
| Real local Auth/RLS browser | Passed main, assistant and on-site contact Day/List journeys through the actual app/server routes. Mixed-response roster, expansion, item/date selection, read-only controls, missing-volunteer capability and foreign-workspace item isolation passed. Authenticated Quick View default Month exposed meal counts without an inspector. |
| Real project photo route/storage | Passed local upload, replacement, old-asset invalidation, stale-version rejection, scoped delivery, signed-out/foreign-user denial, and read-only-contact display with mutation denial. Disposable files and Auth/workspace records were cleaned up. |
| Photo database and storage regression | Passed permissions, version/default-disabled boundary, volunteer scoping, responsive image validation and independent local BLOB restore checksum. Production photo uploads remain disabled. |
| Real bearer credential/RPC/browser | Passed issuance, scoped projection, invalid/expired/revoked isolation, browser cookie exchange/privacy headers, clean route selection, read-only inspector and mobile layout. |
| Existing Batch 1 browser/UI review | Passed all 15 route/viewport journeys, five-width navigation/text reflow, photo/menu/disclosure and meal-state checks. Rendered controls/contrast and the standalone photo contract also passed. |
| Production backup database preflight | Passed read-only against terminal `20260922150000`; no backup execution or database mutation. |
| Fresh scheduled encrypted backup | Existing unchanged task was started and completed with result 0, returned to Ready, and produced a 234,041-byte encrypted artifact. Independent SHA-256 matched. |

One earlier route-suite run, concurrent with other browser suites, timed out on the project-day-to-item transition. The complete isolated rerun passed all 15 journeys, including that transition, without a source change. The timeout was not reproduced; its cause is not established. This component result does not replace the blocked real-session release gate.

## Resolved environment and backup gates

The initial Docker blocker was resolved after the user restored Docker Desktop. The existing loopback Supabase project started without a database reset. Tests used disposable workspaces and actual Supabase Auth sessions; the local app enforced authentication with application email transport disabled and no Resend key. Assignment fingerprints remained unchanged during read-only journeys and fixture notification/welcome delivery counts remained zero. Fixture cleanup passed.

The morning backup task had returned `0xC000013A` (interrupted). After checking its exact production/migration locks and Ready state, the existing task was started without changing configuration. It completed successfully at `2026-09-26T05:05:27.9558648Z` (September 25 local), last task result 0, Enabled/Ready, unchanged `20260922150000` lock and next run September 26 at 03:15 local. Artifact: `project-local-production-20260926T050527Z-769e5f56.zip.age`, 234,041 bytes, independently verified SHA-256 `9c0fb7005d9163d237c19d02af817ef38d7583591a8aee6aa68d0a5805d59a90`. No backup schedule, action, destination, recovery implementation or notification safeguard changed. The fresh success establishes current execution health; the original interruption's cause was not established. Existing 12.47 recovery evidence remains applicable; no new restore drill is claimed.

Two legacy test assumptions were corrected: the photo fixture can cross the Monday–Sunday boundary, and the old bearer browser test still expected the retired 12.44 expected-on-site page and a grant lacking the current authenticated route's required view capabilities. Its checks now exercise the established shared Calendar route, while retaining issuance, cookie/header, isolation, read-only, navigation and revocation checks. No product permission was relaxed to make a test pass.

## Production-session gate resolved

The user completed production sign-in and confirmed working Overview/Calendar. Independent browser inspection verified both routes resolve Bozeman Major Remodel. No account, grant, authentication setting or volunteer record was changed to establish this session. The initial unavailable screen is resolved by the authorized session. Vercel still shows Production/Ready at the exact baseline commit. Fresh read-only snapshots cover 11 operational, contact/grant, photo and delivery tables; terminal remains `20260922150000`, and production photo uploads remain disabled.

## Exact next steps

1. Create one exact reviewed release commit containing Batch 1 plus this enhancement. Fast-forward `master` through the established Vercel workflow while retaining the working development branch. No new database migration or 12.47 permission/lock transition is required. Verify Production/Ready at that exact full commit.
2. Perform authorized read-only production smoke for Overview, Calendar Day/List, assigned names/statuses and occurrence dates, authenticated Quick View, project-photo disabled-upload boundary, navigation and mobile layout. Do not create/edit volunteer records or send messages. Compare operational/delivery fingerprints and record the exact deployed version. A bearer production session will be checked only if already safely available; local real-bearer isolation/revocation evidence passed.

## Production effects and limits

There was no deployment and no production volunteer/assignment write or email-send operation in this attempt. Production database operations were the existing read-only backup preflight and logical backup. No post-deployment smoke or release-attributable data/notification comparison can be claimed because a release did not occur. Production photo uploads remain disabled under the established 12.47 boundary. Mobile month-density and the full Calendar/inspector redesign remain later-batch work.
