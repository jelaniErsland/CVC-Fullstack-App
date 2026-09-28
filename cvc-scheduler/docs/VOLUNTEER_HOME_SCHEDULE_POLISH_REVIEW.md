# Volunteer home schedule polish

Status: implemented locally, ready for review; not deployed or merged. Development branch: `codex/volunteer-home-schedule-polish`, based on release-closeout commit `c939bb0`. The original Task Details branch is preserved. Production baseline for the visual comparison is `0efa0427e8cc0290ab87d70ecbafb759afdcbf7a`.

## Result

The Next assignment card now says **View assignment details →**, opening the existing assignment sheet. Its secondary **View full schedule** disclosure opens the existing full schedule inline. The awkward count label and bottom schedule footer are removed.

With one upcoming assignment, Coming up is omitted entirely. With additional upcoming assignments, it contains at most three compact date/title/time/status rows and a clearly labeled full-schedule action. That action opens and focuses the same full-schedule disclosure. Assignment identity, rather than title or object identity, excludes Next from the preview and selects the correct sheet.

The existing Next selection prioritizes actionable pending responses over confirmed assignments. This behavior is unchanged: if Next is a later pending assignment, an earlier confirmed upcoming assignment remains available in the preview. Other upcoming items retain the supplied chronological order. The preview does not introduce a partial Confirm All action; the existing complete-schedule action is unchanged.

The useful no-upcoming empty state remains. If there are historical assignments, the full schedule remains accessible beside that state without an empty Coming up section. Lunch and Availability content and behavior are unchanged.

## Visual comparison

[Before/after gallery](previews/volunteer-home-schedule/index.html) uses synthetic information and the actual components. Before captures load the deployed baseline component sources through `git show`; after captures load the working components with identical fixtures.

Reviewed 320px and 390px mobile, 768px tablet and 1440px desktop. The single-assignment page ends naturally after Availability. Additional assignments use thin rows rather than large cards. Existing typography, status colors and sheet hierarchy remain. Long ordinary titles wrap cleanly; an intentionally unbroken title wraps within the card without horizontal overflow.

The comparison identified a 10px desktop offset between the title and new details action. It was corrected. Browser measurements now require their left edges to match within 0.5px at every tested width. Named actions have at least 44px targets. Full-schedule opening, dialog focus containment, Escape/close, focus restoration and visible close controls were checked in the rendered browser, including narrow screens. No extra empty grid row remains when Coming up is omitted.

## Executed verification — 2026-09-28

| Check | Result |
| --- | --- |
| `npm run lint` | Passed |
| `npx tsc --noEmit` | Passed |
| Fresh `next build` with local Supabase environment | Passed; repeated after the final application adjustment |
| `node scripts/volunteer-home-schedule-browser-regression.mjs` | Passed unmodified: one/multiple/empty/past/long/duplicate/priority/same-day fixtures at 320/390/768/1440; exact item selection, bounded preview, keyboard/focus, no overflow and zero mutation/provider requests |
| Same script with `--before` | Captured the deployed component baseline with synthetic fixtures |
| Complete `volunteer-schedule-responses-browser-regression.mjs` | Passed unmodified against a fresh local production build: Confirm/decline, notes, Confirm All, reload persistence, mobile, safe cookies and disposable cleanup |
| `volunteer-schedule-access-regression.mjs` | Passed real local access issuance, filtering, revocation, direct-table denial and cleanup |
| `volunteer-schedule-responses-regression.mjs` | Passed real local response persistence, isolation, lock and response-token boundaries |
| `assignment-notification-email-regression.mjs` | Passed claim/finalize, deduplication, retry and recording-transport checks |
| `resend-initial-assignment-email-regression.mjs` | Passed resend confirmation/idempotency and safe-provider checks |
| `volunteer-home-photo-regression.mjs` | Passed local menu, meals, away-period, project isolation and photo boundaries |
| `git diff --check` | Passed |

Real database suites ran serially against disposable local Supabase fixtures, not production. The access/response/notification suites used the checked-in `final-product-readiness-local.mjs` wrapper with Node `--conditions=react-server --no-warnings --experimental-strip-types`. Browser/home suites used the same Node flags with loopback Supabase and an owned loopback production server. Real email providers were disabled; recording transports were used for notification tests. No real email was sent.

Local verification receipts were captured at `2026-09-28T23:08:11.712Z` for the full real-data set and `2026-09-28T23:11:28.894Z` for the final production build and complete response-browser rerun. Ignored local runner artifacts are excluded from the review commit.

## Scope and limits

Application changes are confined to `VolunteerHomeDashboard.tsx` and presentation variants in `VolunteerScheduleClient.tsx`. No changes to authentication, session credentials, projections, privacy, response handlers, meals, away actions, notifications, schema, RPCs, RLS, Quick View, Calendar or storage. No site-map or Batch 3 work.

The new visual harness creates an isolated temporary app, strips credentials and provider configuration, blocks non-loopback requests and asserts zero mutation requests. Its fixture routes are absent from the application and production navigation. Temporary server, browser and dependency junction are cleaned up.

Production was not accessed or changed for this task. These screenshots demonstrate local rendering, not a production deployment. Existing unrelated untracked previews and release-check directory were preserved. This work does not resolve the previously documented development Server Action transport issue, production busy-month latency, desktop assigned-person ellipsis limitation or site-map upload/recovery readiness.
