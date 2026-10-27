# 12.59 — Communications visual and layout refinement

Local UI-only candidate based on production a42782a82ce867308f4083b3caef34d850504464. No production mutation/deployment, schema migration, delivery-state/configuration change, worker/Cron/provider invocation, or real email is authorized/performed in this batch.

## Reproduction and root cause

Live all-four-tab inspection at 2,560px reproduced the entire workspace/tab row shrinking when Automatic reminders was selected. Welcome/Schedule occupied 2,272px; Automatic reminders occupied 896px. The conditional `activeTab === 'reminders' ? 'max-w-4xl' : ''` on the outer CommunicationsWorkspace div constrained the tablist as well as the panel. AssignmentReminderHistory independently also had max-w-4xl. Other tabs occupied the available shell width; their long history could introduce a small extra scrollbar-width difference.

This diagnosis and live measurements were recorded before product edits. A frozen-production production-mode Webpack baseline and matched local synthetic screenshots were then captured before changes.

## Presentation decisions

- One centered 1,280px maximum frame wraps PageHeader and all four sections. The form column is capped at 832px. Natural available width is used on smaller screens. A Communications-scoped stable scrollbar gutter prevents the long History panel moving the frame.
- Shared compact 2×2 mobile/four-column larger-screen tab geometry, full labels, softly tinted icon wells, blue underline/selected surface, keyboard/ARIA semantics preserved.
- Owner amendment: remove the redundant On/Off pill from the navigation tab. The authoritative On/Off/Status unavailable display remains in the panel; no status read or decision is removed. Existing browser assertions move to the real panel status and also assert the plain navigation label.
- Navy text, blue primary actions, dark teal success, amber unknown/review, coral failure, neutral Sending/eligibility-changed states. White surfaces, subtle tints, crisp boundaries and light existing-system shadows. No gradients, motion, decorative charts or analytics.
- Next-batch date/time/count remain from the authoritative 12.58 projection. Next and latest activity are two restrained internal columns on desktop, stacked on mobile. No unsupported recent-send count or reminder-type aggregate is invented. Today/Tomorrow uses the existing server observation and project calendar day, with an absolute date available.
- Upcoming retains exact due-time grouping, ordering, pagination and data. Tinted headers distinguish batch due time; volunteer/task/type/start hierarchy remains scanable. Page counts explicitly say shown on this page.
- Reminder History retains actual outcomes/newest-first order, with semantic pills and native details. Sending is not labeled unhealthy; Sent still means provider acceptance. No automatic-reminder resend action was added.
- Broader Delivery history retains operation grouping, source timestamps, order, filters, resend/retry/confirmation workflows. It gains aligned rows/statuses/tinted group headers and project-timezone display. UTC slicing/browser-local display was replaced only for visible dates; eligibility/filter predicates are unchanged.
- Welcome/Schedule retain their exact handlers and workflow, with narrower forms, stronger section/icon hierarchy, readable help, and one blue primary action. Review becomes secondary while the confirmed-send action is present. Refresh and resend review stay visually secondary.
- Mobile has no added page-description stack; icons are omitted only at 320px where needed for full labels. All interactive controls retain 44px targets. Browser sizing was restored after live review.

## Functional boundary

The scope regression parses the two components and compares their event handlers and run/refreshSummary/load/changeView functions exactly to the approved 12.58 Git blobs. It also rejects changes to SQL, server actions, server reads, reminder projection, engine/infrastructure, build guard and dependencies. This passed. The only new timezone prop comes from the already-authorized workspace; no extra data read is introduced.

## Evidence

Before/after screenshots and full tab-switch geometry: `../../../previews/12-59-communications/before/` and `../../../previews/12-59-communications/after/`.

At desktop widths the matched local panel-width comparison is:

| Viewport | Before Welcome | Before reminders | After all four panels | After horizontal shift |
| --- | ---: | ---: | ---: | ---: |
|1280|992|896|977|0|
|1440|1152|896|1137|0|
|1920|1632|896|1280|0|
|2560|2272|896|1280|0|

The 15px narrower available area at smaller widths is the intentionally reserved stable scrollbar gutter. 320/390/430/768 also passed with unchanged panel x/width, tab geometry and heading alignment across all four selections. The fixtures use the same local production-mode data shape before and after; no cross-environment speed comparison is claimed.

Axe WCAG 2 A/AA and 2.1 AA checks found zero scoped violations in 48 audits: all four tabs plus expanded Upcoming and reminder History across eight viewport sizes. Keyboard arrows/Home/End, selected-panel association, project timezone with an Auckland browser, 44px targets, no horizontal overflow, and public/Auth no-write fingerprints passed. Text contrast pairs range 5.33:1–7.79:1; primary white-on-blue is 5.41:1; control boundaries are 3.42:1. Native disclosures/focus states and existing reduced-motion behavior are preserved. UTC-midnight and spring/fall DST presentation tests pass.

## Verification closeout

Passed TypeScript, full ESLint, git diff --check, credential scans, and both guarded Next.js 16.2.7 Webpack/Turbopack builds. Each build visibly verified the guarded router before compilation. Production-mode geometry/screenshots passed on Webpack and again on Turbopack; the latter includes all 48 scoped accessibility audits.

Existing regressions passed: Communications transport (mock provider), bounded batching, recipient-review/selection/intentional-resend mobile browser flow, local ledger concurrency/idempotency/permission checks, dispatch/privacy/unknown-outcome behavior with a stubbed provider, authoritative reminder status, reminder read-model contract, grants authorization, and the six-width reminder read-only/error/retry/stale-request/permission suite. The local database still satisfies the exact 103-function privilege policy with PUBLIC execute zero.

Verification receipts: [layout comparison](12-59-evidence/layout-comparison.json), [contrast and timezone](12-59-evidence/presentation-results.json), [gate summary](12-59-evidence/verification-results.json). [Before/after gallery](../../../previews/12-59-communications/README.md). Test-only failures/unknowns were created exclusively in the local fixture database. Real provider calls: zero. Production mutations/deployment: none. No migration, dependency/lockfile change, engine change or configuration change.

The candidate commit SHA is returned with the final review response so the committed audit does not require a self-referential hash. Product-owner visual acceptance remains a separate review; this is not deployment approval.

## Deliberately deferred

No workflow merge, analytics, settings editor, transport change, new reminder authority, routing architecture change, admin-shell redesign or volunteer-side change. Production has no manufactured failure/unknown fixture. SEC-12.57-01 remains open/separate and unchanged.
