# 12.48 Batch 1 coordinated release closeout

Prepared September 25, 2026 (local time), with refreshed September 26 UTC validation, on `codex/12.48-batch-1`.

**Release status: DEPLOYED — production smoke passed.** Batch 1 and the assignment-visibility enhancement were released together as commit `1447bb926dfb65cbc77c071bab5d33879d8c46c5`. The existing development checkout remains on `codex/12.48-batch-1`. No Batch 2 work began.

## Production closeout

The established Git workflow fast-forwarded `origin/master` from `5bb1cf6a0609285c7c4c53d4e3516727b67adbac` to the exact release commit. Vercel deployment [eV9vrCF97kQFP5Uw7u7GEYXCBMa7](https://vercel.com/jelanierslands-projects/project-local/eV9vrCF97kQFP5Uw7u7GEYXCBMa7) reports **Production / Ready**, 43-second build, September 25, 2026 at 23:39 MDT (September 26 UTC). Its source link resolves to the full release SHA. The canonical `https://projectlocal.app` serves the new design.

Using the user's existing authorized production account, read-only smoke passed Overview, Calendar Day/List, volunteer-directory navigation, authenticated Quick View, desktop/mobile navigation and More. Actual 1440px and 390px viewports were verified, with no horizontal overflow. Calendar showed existing assigned names and Awaiting reply/Declined wording, separate per-occurrence rows, and correct active-staffing fractions. The read-only Quick View inspector preserved `/admin/quick-view` and had zero Assign/Remove/Save/Publish/Send controls. Its default route, without a forced view parameter, exposed the existing Lunch headcounts before inspection. Meals remained separate from staffing lists. The final mobile list item was scrolled above the fixed navigation. Browser error logs were empty.

Overview correctly used `LDC Bozeman Major Remodel`, compact no-photo identity, review/next-up hierarchy and authorized navigation. No photo-edit controls appeared because production uploads remain disabled. No configured production photo was available to exercise image delivery; the actual local upload/replacement/scoped-image tests supply that evidence. No safe existing production bearer link was available, so none was created for smoke; real local bearer issuance, isolation, privacy-header/cookie and revocation checks passed. Confirmed/many-name expansion and all meal zero/missing/positive combinations were tested locally rather than manufacturing production data.

Read-only repeatable-read snapshots before and after deployment/smoke matched **all 11 table counts and full-row fingerprints**: volunteer profiles, Calendar items, assignments, responses, assignment-notification deliveries, volunteer-welcome deliveries, communication operations/recipients, project photos, contact grants and contacts. There were no production volunteer/assignment edits or new delivery-ledger entries. No email-send operation was issued. The schema terminal remained `20260922150000`, photo uploads remained disabled, and the backup task retained successful result 0 and its unchanged next schedule. Production screenshots were inspected in the connected browser; the distributable gallery retains synthetic records only.

## Candidate and scope

Pre-release baseline: `5bb1cf6a0609285c7c4c53d4e3516727b67adbac`, independently verified against both `origin/master` and Vercel deployment `FimEmup6H3obRsseCytNfi6qZ7v4` before release. The current release is the exact `1447bb9…` commit above.

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

One earlier route-suite run, concurrent with other browser suites, timed out on the project-day-to-item transition. The complete isolated rerun passed all 15 journeys, including that transition, without a source change. The timeout was not reproduced; its cause is not established. Real local authenticated/bearer journeys and production route smoke subsequently passed.

## Resolved environment and backup gates

The initial Docker blocker was resolved after the user restored Docker Desktop. The existing loopback Supabase project started without a database reset. Tests used disposable workspaces and actual Supabase Auth sessions; the local app enforced authentication with application email transport disabled and no Resend key. Assignment fingerprints remained unchanged during read-only journeys and fixture notification/welcome delivery counts remained zero. Fixture cleanup passed.

The morning backup task had returned `0xC000013A` (interrupted). After checking its exact production/migration locks and Ready state, the existing task was started without changing configuration. It completed successfully at `2026-09-26T05:05:27.9558648Z` (September 25 local), last task result 0, Enabled/Ready, unchanged `20260922150000` lock and next run September 26 at 03:15 local. Artifact: `project-local-production-20260926T050527Z-769e5f56.zip.age`, 234,041 bytes, independently verified SHA-256 `9c0fb7005d9163d237c19d02af817ef38d7583591a8aee6aa68d0a5805d59a90`. No backup schedule, action, destination, recovery implementation or notification safeguard changed. The fresh success establishes current execution health; the original interruption's cause was not established. Existing 12.47 recovery evidence remains applicable; no new restore drill is claimed.

Two legacy test assumptions were corrected: the photo fixture can cross the Monday–Sunday boundary, and the old bearer browser test still expected the retired 12.44 expected-on-site page and a grant lacking the current authenticated route's required view capabilities. Its checks now exercise the established shared Calendar route, while retaining issuance, cookie/header, isolation, read-only, navigation and revocation checks. No product permission was relaxed to make a test pass.

## Production-session gate resolved

The user completed production sign-in and confirmed working Overview/Calendar. Independent browser inspection verified both routes resolve Bozeman Major Remodel. No account, grant, authentication setting or volunteer record was changed to establish this session. The initial unavailable screen was resolved by the authorized session. Before deployment, Vercel showed Production/Ready at the exact baseline commit; the release commit was subsequently verified as described above. Read-only snapshots cover 11 operational, contact/grant, photo and delivery tables; terminal remains `20260922150000`, and production photo uploads remain disabled.

## Completed release procedure

One reviewed application release commit was fast-forwarded to `master`, Vercel Production/Ready was verified at that commit, and authorized read-only smoke plus unchanged-data/delivery fingerprint comparison completed. No migration, permission transition, new administrator, substitute session, backup change or notification operation was used. Closeout documentation is retained on the development branch without triggering another production deployment.

## Production effects and limits

One coordinated application deployment occurred. Production database operations were read-only preflight, logical backup and fingerprint checks. No production volunteer/assignment write or email-send operation occurred, and the unchanged operational/delivery fingerprints confirm no observed data or delivery change across the release window. Production photo uploads remain disabled under the established 12.47 boundary. Mobile month-density/overflow and the full Calendar/inspector redesign remain later-batch work.
