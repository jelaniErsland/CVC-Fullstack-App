# Task details — implementation evidence

Local synthetic fixtures only. These are rendered application captures, not production records. See the [final implementation review](../../project-resources/TASK_DETAILS_IMPLEMENTATION_REVIEW.md) for executed tests, security boundaries and unresolved gates. Site-map uploads remain disabled.

| State | Desktop | Mobile 390px | Narrow 320px |
| --- | --- | --- | --- |
| Preset instruction editor | [Editor](task-editor-desktop.png) | [Editor](task-editor-mobile.png) | — |
| Preview current/replacement text | [Preview](task-preview-desktop.png) | [Preview after apply](task-preview-mobile.png) | — |
| Explicit selected apply | [Selected occurrence](task-preview-selection-desktop.png) | — | — |
| Disclosure closed | [Closed](volunteer-details-closed-desktop.png) | [Closed](volunteer-details-closed-mobile.png) | [Closed](volunteer-details-closed-narrow.png) |
| Maximum 4,000-character instructions open | [Open](volunteer-max-details-desktop.png) | [Open](volunteer-max-details-mobile.png) | [Open](volunteer-max-details-narrow.png) |
| Scrolled to end and response controls | [Response](volunteer-max-response-desktop.png) | [Response](volunteer-max-response-mobile.png) | [Response](volunteer-max-response-narrow.png) |

Both 2,000-character preset and 4,000-character occurrence limits were exercised at every volunteer width. Close stays in the header; response controls are in the scroll region after instructions. Tests verify actual scroll/focus reachability, both responses, Escape and focus restoration rather than inferring usability from full-page images.

Compared with the approved [simplified architecture previews](../../../../previews/project-resources/README.md): the existing modal/sheet and response workflow are retained, instructions use readable paragraph spacing and the single native disclosure indicator, and no site-map link is activated. The maximum-text captures use concise synthetic titles instead of generated QA identifiers. No additional visual correction was needed.

## Approved instruction privacy

Actual loopback Auth/bearer application captures with fictional instructions and meal contact. Administrator detail stays readable; bearer and generic authenticated viewers retain operational details without the instruction block. Compared with the approved Calendar typography, borders, alignment and mobile sheet: removing the empty notes block avoids misleading empty-state wording; no layout redesign was needed.

| Audience | Desktop | Mobile |
| --- | --- | --- |
| Authorized administrator | [Full instructions](privacy-admin-desktop.png) | Existing editor/volunteer captures above |
| Generic authenticated schedule viewer | [Operational inspector](privacy-read-only-desktop.png) | [Operational sheet](privacy-read-only-mobile.png) |
| Bearer Quick View | [Operational inspector](privacy-bearer-desktop.png) | [Operational sheet](privacy-bearer-mobile.png) |

These screenshots supplement direct database and completed HTML/RSC/JSON checks; absence of visible text alone is not treated as privacy proof.
