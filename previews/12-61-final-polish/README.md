> HISTORICAL / SUPERSEDED: The owner abandoned the unshipped structured-skills model. This evidence describes an earlier local candidate, not the current release contract. Do not apply migration58. The current app-only direction is documented in `12-61-app-only.md` and `previews/12-61-app-only/README.md`.

# 12.61 final polish evidence

All screenshots use synthetic local fixtures in a production-mode build. No production access or provider calls.

## Accessibility reconciliation

The original **147** passing audit records were two suites, not one:

| File in this bundle | Original suite | Records | Violations |
| --- | --- | ---: | ---: |
| [prior-skills-browser-results.json](prior-skills-browser-results.json) | Eight-width Skills/sheets browser suite | 83 | 0 |
| [prior-filter-browser-results.json](prior-filter-browser-results.json) | Eight-width complete filter browser suite | 64 | 0 |

Both files are byte-for-byte copies of the original passing evidence. Their original paths and SHA-256 values are in [prior-evidence-index.json](prior-evidence-index.json). **83 + 64 = 147**. These suites were not rerun to change that historical number.

The amendment has **70 separate** passing axe WCAG 2 A/AA and 2.1 AA audits, zero violations, in [browser-results.json](browser-results.json). They are not presented as additional distinct coverage in the historical 147. This file also records all five widths, bottom-field clearance, no overflow/page errors/external requests, protected-table fingerprints, and deep-directory scroll retention (3767px before and after).

[evidence-index.json](evidence-index.json) provides screenshot checksums and separates historical and amendment audits.

## Review the amendments

| Evidence | Desktop | Mobile |
| --- | --- | --- |
| All seven approved Sort choices | [1440px](sort-options-1440.png) | [390px](sort-options-390.png) |
| Profile identity/contact hierarchy and backdrop | [1440px](profile-backdrop-1440.png) | [390px](profile-backdrop-390.png) |
| Pristine Edit immediately before successful backdrop dismissal | [1440px](pristine-edit-before-backdrop-1440.png) | [390px](pristine-edit-before-backdrop-390.png) |
| Genuine edit discard guard | [1440px](dirty-discard-1440.png) | [390px](dirty-discard-390.png) |
| Skills selections | [1440px](edit-selected-skills-1440.png) | [390px](edit-selected-skills-390.png) |
| Profile after confirmed Save | [1440px](profile-saved-skills-1440.png) | [390px](profile-saved-skills-390.png) |
| Filter using saved skills | [1440px](filtered-saved-skills-1440.png) | [390px](filtered-saved-skills-390.png) |

The pristine screenshot is a before-dismiss image; the automated test separately verifies successful dismissal without a discard dialog. Profile backdrop/Escape/X and Edit backdrop/Escape/X/Cancel are verified in the browser results.

## Bottom-of-form proof

All Availability, Experience and Private info disclosure sections were expanded. At five scroll positions per form the controls pane ends at or above the opaque footer. Congregation, preferred contact, emergency relationship and the final notes control can each scroll fully above the footer.

| Width | Add final-field clearance | Edit final-field clearance | Add screenshot | Edit screenshot |
| --- | ---: | ---: | --- | --- |
| 320 | 38.66px | 132.45px | [Add](add-bottom-320.png) | [Edit](edit-bottom-320.png) |
| 390 | 39.45px | 132.45px | [Add](add-bottom-390.png) | [Edit](edit-bottom-390.png) |
| 430 | 39.45px | 132.45px | [Add](add-bottom-430.png) | [Edit](edit-bottom-430.png) |
| 768 | 39.45px | 132.45px | [Add](add-bottom-768.png) | [Edit](edit-bottom-768.png) |
| 1440 | 39.45px | 132.45px | [Add](add-bottom-1440.png) | [Edit](edit-bottom-1440.png) |

The two form sections occupy separate flex layout rows: the footer does not overlay scrolling controls. The larger Edit clearance also includes the separate quiet Delete action. Existing legacy availability/select controls intentionally remain unchanged.

## Reproduction

Run from cvc-scheduler after the guarded production build, with the existing local Supabase fixture environment:

- `node --experimental-strip-types scripts/12-61-form-state-regression.mjs`
- `node scripts/12-61-final-polish-browser.mjs`

The browser script enforces a local database, blocks non-loopback browser requests, disables email transport, uses disposable fixtures and cleans them up. Do not run it against production or concurrently with another mutating fixture suite.
