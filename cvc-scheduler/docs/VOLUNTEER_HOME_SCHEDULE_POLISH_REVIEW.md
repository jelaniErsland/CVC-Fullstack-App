# Volunteer home schedule polish — corrected inline interaction

Status: reviewed and **released as `80203cb77ecd3c02427888958d10d62dd0a6a5f7`**. See [production release verification](VOLUNTEER_HOME_SCHEDULE_POLISH_RELEASE.md). This revision supersedes the unapproved interaction in `8964acf` on `codex/volunteer-home-schedule-polish`. The Task Details production release and its original development branch remain unchanged.

## Corrected experience

The existing Next Assignment card retains **View assignment details →**, the original assignment prioritization and the existing detail sheet.

When Next is the only upcoming assignment, there is no schedule toggle, schedule section or Coming up heading. Lunch follows the card naturally, then Availability. With no upcoming assignments, the existing useful empty state remains; historical assignments do not cause an empty upcoming schedule to appear.

When other upcoming assignments exist, **View full schedule ↓** appears directly beneath Next. Keyboard or pointer activation changes it to **Hide full schedule ↑** and inserts **every remaining upcoming assignment**, without a three-row limit or duplication of Next. Collapsing unmounts those rows. There is one expansion, no lower disclosure and no separate Coming up section.

Each additional assignment is a compact rounded card with the shared calendar icon, task title, existing response-status chip, scheduled date/day and time. It uses the same authorized data and assignment-reference selection as the existing sheet. Distinct records with identical displayed title/date/time are tested using their different saved instructions.

Lunch and Availability now follow the schedule region at every width, moving downward when it expands. Their contents and controls are unchanged. On tablet/desktop those two sections share a row beneath the schedule; on phones they remain stacked.

The existing Next prioritization can choose a later actionable pending assignment ahead of an earlier confirmed assignment. That behavior is preserved. The earlier confirmed assignment remains in the expanded list, in the supplied order. No scheduling semantics or sorting contract changed.

The existing Confirm All action remains available inside the expanded schedule when applicable. Its count uses the complete existing authorized assignment collection, including Next, rather than mistakenly counting only the displayed additional cards. Its server action and safeguards are unchanged. Other consumers of the shared schedule component retain their default presentation and behavior.

## Scroll and accessibility

After React renders the expansion, a cancellable animation-frame callback scrolls to the toggle with up to 160px (or 20% of viewport height) of Next context above it. It uses smooth scrolling normally and an immediate scroll for `prefers-reduced-motion: reduce`. Short pages naturally clamp to the available scroll extent. This is a local expansion, not navigation to another anchor.

Focus stays on the toggle during expansion/collapse. Its visible label, `aria-expanded` and `aria-controls` describe the state and associated region. Collapsed cards are unmounted. Whole-card buttons retain keyboard activation, the existing sheet focus boundary, Escape/close and focus restoration. Controls meet a 44px minimum target.

## Visual review

[Updated screenshot gallery](previews/volunteer-home-schedule/index.html) shows the current one-assignment mobile state, multiple-assignment collapsed and expanded mobile states, and expanded desktop state. Supplemental captures cover 320px, 768px, many assignments and an intentionally unbroken long title. All information is synthetic.

The final comparison checks spacing, alignment, typography, hierarchy and mobile usability. Expanded cards begin directly under the Next toggle; Lunch and Availability follow them, never precede them. The compact cards reuse the icon/chip language, subtle blue surface and border, with 8px gaps. Their title/status wrap at narrow widths without overflow. The named Next action remains aligned with the title. The one-assignment page has no leftover toggle margin or empty Coming up row.

Rendered measurements verify the inline region begins 8px below its toggle (within 2px), Lunch moves downward, all upcoming cards appear, and no second schedule destination exists. Scroll targets and actual clamped browser positions are compared. Smooth and reduced-motion paths are both exercised. These screenshots remain synthetic local evidence; authorized live results are recorded separately in the production release report.

## Executed checks — 2026-09-28

| Check | Result |
| --- | --- |
| `node scripts/volunteer-home-schedule-browser-regression.mjs` | Passed unmodified: one/two/multiple/many/empty/historical-only/long-title/duplicate-reference/priority/same-title states at 320/390/768/1440; all upcoming cards, inline placement, scroll/reduced motion, keyboard/focus, exact selection and zero mutation/provider requests |
| Complete `volunteer-schedule-responses-browser-regression.mjs` | Passed unmodified against a fresh local production build: Confirm/decline, denial notes, Confirm All, reload persistence, maximum-length instructions, narrow/mobile layouts, token safety, anonymous denial and disposable cleanup |
| `volunteer-schedule-access-regression.mjs` | Passed real local issuance, scope/filtering, revocation, direct-table denial and cleanup |
| `volunteer-schedule-responses-regression.mjs` | Passed real local response persistence, isolation, locks and token boundaries |
| `assignment-notification-email-regression.mjs` | Passed claim/finalize, deduplication, retry and recording-transport safety |
| `resend-initial-assignment-email-regression.mjs` | Passed resend safeguards, idempotency and safe-provider checks |
| `volunteer-home-photo-regression.mjs` | Passed local menu/meals, away periods, project isolation and photo boundaries |
| Fresh local production `next build` | Passed after the final application edits |
| `npm run lint` | Passed |
| `npx tsc --noEmit` | Passed |
| `git diff --check` | Passed |

The full response-browser harness was updated only for this changed presentation: its schedule locator now includes Next plus the inline cards, its opener activates the named button, and its obsolete per-row “Review & respond” assertion now requires the existing Needs reply status on each selectable pending card. All actual response, persistence, authorization, maximum-instruction, notification and cleanup assertions remain.

Real database suites ran serially against disposable local Supabase fixtures. The access/response/notification suites used the checked-in `final-product-readiness-local.mjs` wrapper and Node `--conditions=react-server --no-warnings --experimental-strip-types`. The full browser/home suites used the same flags, loopback Supabase and an owned loopback production server. The fresh-build/full-suite receipt is recorded locally at `2026-09-28T23:31:20Z` (rounded to seconds). Real email providers were disabled; notification tests used recording transports. No real email was sent.

The isolated focused browser harness strips credentials/providers, blocks non-loopback requests and asserts no mutation requests. Its temporary fixture app is absent from the production application and navigation; its owned server/browser/dependency junction are cleaned up.

## Boundaries and limitations

Application edits remain confined to `VolunteerHomeDashboard.tsx` and presentation/count context in `VolunteerScheduleClient.tsx`. No authentication, schedule-session credentials, server projections, instruction privacy, response handlers, meals, away actions, email delivery, schema, RPCs, RLS, Quick View, Calendar or storage changes. No site-map or Batch 3 work.

Production was not accessed or changed during the implementation correction; the subsequently authorized release is documented separately. Existing unrelated untracked previews and the release-check directory were preserved. The previously documented development Server Action transport issue, production busy-month latency, desktop assigned-person ellipsis limitation and site-map recovery/upload readiness remain outside this task.
