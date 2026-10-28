# 12.61.1 — Side-sheet keyboard focus hotfix

Local verification completed October 28, 2026. App-only candidate; no deployment.
Base/live application: `74da0d5d1932ad65449b495be3cd1df3271a8189`.
Database: `57 / 20261026120000`.

## Root cause and correction

`containVolunteerSheetFocus` calculated its first/last controls using a selector
that omitted native disclosure summaries. The last assignment link was therefore
treated as the Profile's last control, and explicit wrapping skipped both visible
disclosures. Reverse wrapping from Edit skipped them too.

The same shared helper now includes `details > summary:first-of-type`. It rejects
disabled controls, hidden/inert ancestors, negative explicit tab indices, invisible
controls, and descendants of closed disclosures other than their own first summary.
The latter is necessary because Chromium can give closed-disclosure controls
nonempty layout rectangles despite excluding them from sequential keyboard focus.
Nested closed disclosures are handled too.

Native dialog semantics remain intact. Intermediate keyboard traversal remains
browser-controlled; only the actual first/last boundaries wrap. No profile-specific
sequence, replacement disclosure control, or competing focus system was added.

## Exact observed traversal

Recorded on the unchanged live product code using disposable local fixtures, at
both 1440px and 390px:

| Direction | Before | After |
| --- | --- | --- |
| Tab | Last assignment → Edit → Close → email → phone | Last assignment → Other support → Other profile details → Edit → Close |
| Shift+Tab | Edit → last assignment → preceding assignment → preceding assignment → Past | Edit → Other profile details → Other support → last assignment |

The complete Profile order after correction is Edit, Close, email, phone, Upcoming,
Past, three separate Calendar assignment links, Other support, Other profile
details, then wrap to Edit. Reverse order is verified across the complete cycle.

## Regression evidence

`scripts/12-61-1-sheet-focus-browser.mjs`:

- Exact forward/reverse element sequence, not just dialog containment.
- Explicitly requires both Profile summaries; BODY/background or unexpected jumps fail.
- Native Enter/Space toggling and visible keyboard focus.
- Complete Edit traversal before/after opening disclosures, including newly revealed
  inputs, selects, and textareas. Native date-input internal segments are accounted
  for with a strict bound; other repeated controls are rejected.
- Filters traversal, congregation search, experience-term entry, Escape and focus return.
- Profile backdrop/X/Escape dismissal and return to the triggering row.
- Discard confirmation exact Keep editing/Discard changes cycles, Escape, Keep
  editing restoration, retained draft, and discard return to Profile.
- Separate boundary fixtures exercise enabled custom controls, disabled fieldsets,
  hidden/inert content, negative tabindex, nested disclosure content and reclosure.
- 1440px and 390px, zero external requests and page errors; eight axe scans,
  zero WCAG A/AA violations.
- Passed against both guarded Webpack and Turbopack production builds.

The existing unmodified `scripts/12-61-directory-browser.mjs` also passed all eight
standard widths (320–2560), 153 axe scans with zero violations, pristine dismissal,
four dirty dismissal paths, failure recovery, pending-save dismissal protection,
local filter/sort retention, Save-to-updated-Profile, and deep scroll/focus restoration.
Its regenerated evidence was retained privately rather than replacing the previous
release's tracked evidence.

`volunteer-profile-management-browser-regression.mjs` passed Add/Edit persistence,
reload, view-only access and mobile checks. The form-state regression passed.

## Static and build gates

- TypeScript `--noEmit`: pass.
- Full ESLint: pass.
- `git diff --check`: pass.
- Credential/source and compiled-client scans: zero findings.
- Next.js exactly 16.2.7 Webpack: pass.
- Next.js exactly 16.2.7 Turbopack: pass.
- Both builds printed guarded-router verification before compilation.

## Production boundary

Read-only observations at 22:23:54Z and 22:26:08Z confirmed `projectlocal.app` still
mapped to the same Production/Ready deployment and exact live SHA above.
Production snapshots at 22:19:39Z and 22:26:04Z confirmed DB57 unchanged, all ten
schema/security catalogue categories unchanged (also equal to the retained release
baseline), exact 103-function policy unchanged, and PUBLIC EXECUTE = 0.
Public sequence and reminder-state snapshots also matched across these reads.

No migration, production write, form submission, send, deployment, reminder/Cron
change, or backup operation was performed. No layout, filter, sort, authorization,
dirty-state, questionnaire/experience, or other product behavior was changed.

## Evidence and scope

Tracked focused evidence: `previews/12-61-1-focus/` at the repository root, containing
before/after sequence JSON and six synthetic-fixture screenshots.
Private verification evidence:
`C:\Users\mtfis\Documents\Codex\2026-10-28\project-local-12-61-1-focus`.

Only runtime change: `lib/volunteers/sheetFocus.ts`.
Other changes: focused regression, this report, and focused synthetic evidence.
Desktop/mobile Chromium is covered; Safari/Firefox were not exercised locally.
The candidate remains undeployed pending owner release approval.

READY FOR 12.61.1 ACCESSIBILITY HOTFIX RELEASE
