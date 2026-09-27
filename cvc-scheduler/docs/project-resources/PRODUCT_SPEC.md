# Product specification — proposed
This proposal is conditional on [the decisions](DECISIONS_REQUIRED.md) and missing source review. All example content in previews is synthetic.

## Volunteer experience
Project-independent lookup remains the initial entry. After the server establishes the exact volunteer profile and workspace, the home keeps the next assignment and response controls primary. Add a compact **Before you arrive** card and at most three relevant general documents with **All project documents** as a secondary link. A displayed project switch returns to the existing authorized selection flow; a URL/workspace name cannot switch identity. Use ldcProjectName exactly once throughout.

**Before you arrive** opens a calm project page: project identity, address/location, arrival/reporting, hours and essential PPE first; parking/site map and help next; meals, housing/travel and additional guidance as informative native disclosures. Hide every empty or unpublished section server-side. Display published/reviewed date and project timezone where times occur. No security teaser titles, empty placeholders or global file-browser navigation.

Proposed structured fields:
- Location: site label, postal address lines, city/region/postal code, optional validated HTTPS directions link. The app does not geocode or share location automatically.
- Arrival: short reporting instruction, reporting place, optional typical arrival time.
- Parking/access: concise paragraph, approved map reference, accessible-route alternative.
- Hours: normal start/end and timezone, short exception note; assignment time always wins.
- Clothing/PPE: a bounded list of practical requirements; no training URL or claim that reading this page fulfills required training.
- Meals/breaks: short logistics note plus link to the existing weekly meal menu; never invent daily counts.
- Housing/travel: optional bounded prose and approved resource.
- Help: approved role/display name and specifically publishable contact channels; never copy a full profile/contact row.
- Additional guidance: bounded plain-text paragraphs, optional disclosures and approved documents.

Use 10–120 character section headings, up to 2,000 characters per prose section and small bounded lists (proposed limits, not existing schema). No arbitrary HTML, embedded iframe, pasted scripts or uncontrolled Markdown images. Fields are optional, but published nonempty sections need an explicit visibility decision. A page can publish selected sections atomically; its unpublished revision stays private.

## Assignment details
Open the volunteer's actual assignment from their schedule/email. Header: actual date/time/timezone, title and response status. Retain current Confirm / Can't make it / cutoff/help behavior. Then **What you'll do**, **Where to report**, **Bring with you**, **Your contact**, applicable documents and a compact project-information link. Supplemental instructions disclose progressively. No volunteer roster, security contact directory or generic document search.

Preset instruction fields: brief description, reporting/arrival note, reporting location, designated reporting contact, clothing/equipment list, additional instructions and linked resource versions. Existing description remains intact; migration must not silently treat internal notes/custom values as published volunteer instructions. Initially copy only admin-reviewed content into a new draft revision. Reporting contact and assignment Follow-up Contact are separately labeled if different. Missing reporting contact falls back only to an already authorized Follow-up Contact projection, not a random project contact. Meals retain their existing headcount/free-text-contact model and do not receive staffed-assignment instructions automatically.

Admin preset editing adds **Volunteer instructions** within the existing Tasks edit experience. Fields show **Use preset**, **Override for this date**, or **Hide for this date** at the Calendar occurrence layer. An explicit null override clears inherited content; absent override inherits. Preview renders the volunteer's resolved result without inheritance jargon.

**Proposed update policy (D4):** draft occurrences may refresh from the latest approved preset with a visible review action. Publishing an occurrence captures an immutable resolved instruction revision and exact resource versions. Later preset changes affect new occurrences only. Updating already-published future occurrences requires selection of exact item IDs, a before/after preview, optimistic version checks and explicit approval. A shared instruction revision is referenced by all assignees on that occurrence; reassignment is not instruction ownership. Past occurrence revisions remain historical and admin-auditable. A resource revocation overrides every snapshot, including historical ones.

Date/time, publication, assignment response and staffing remain authoritative in existing Calendar records; do not copy them into editable resource fields. Multiple assignments with matching titles must stay distinct. Duplicate/repeat creates a new occurrence and reviewable instruction snapshot; it does not copy security permissions or assignments. One-off items can author the same instruction structure without creating a preset.

## Administrator resources
Enter **Project information & documents** contextually from Overview/project settings or an authorized More destination; no new primary navigation bar. Existing right drawer/responsive sheet handles resource detail. Resource cards show title, audience, draft/published state, updated date, version and reference count. A compact table on desktop becomes stacked cards on mobile.

Flow: choose project → upload to quarantine → scan/validate → title/description/accessible summary → audience → preview exact processed version → review reference impact → publish. Publish, Replace, Unpublish and Archive retain explicit wording; secondary details use the existing ellipsis menu. Upload completion never publishes. Approval records actor, version/hash, audience, source approval and timestamp. A failed scan cannot be overridden by a browser flag.

Replacement creates a new immutable version. The old published version stays live until explicit promotion. Show all current page/preset/occurrence references and whether they are pinned. Update references only through a previewed transaction; never redirect a restricted revoked version automatically to a broader/new resource. Unpublish revokes retrieval immediately through the gateway; archive hides a resource from new selection and revokes volunteer delivery. Administrative retention is separate from volunteer access. Physical purge requires an authorized retention workflow and confirmation, not an ellipsis one-click delete.

## Documents and site map
A document card has a useful title, short purpose, format/size, reviewed date and Open. The dedicated viewer retains project and back context, a text summary, page controls, zoom in/out, fit width and **Download approved PDF** if permitted. On mobile the map occupies the content width; intentional pan within the viewer does not cause page overflow. Keyboard controls and explicit reset remain available; no pinch-only control. Provide a text route description and accessible equivalent where the map conveys directions. A scanned PDF alone is not an accessibility solution. Preserve useful PDF text/tags through validation; check processing for lost tags. Do not embed third-party viewers.

The preview illustrates viewing a fictional map only. The actual site map, its approval state and any public/restricted split cannot be selected until the originals are compared. Downloads are deliberate user actions; no offline cache or bulk ZIP. Explain that downloaded copies cannot be recalled.

## Empty, error and restriction states
| Condition | Volunteer result |
| --- | --- |
| Information not published | Home entry hidden; a direct authorized page says “Project information isn't available yet” with approved help. |
| No applicable documents | Omit Documents section; direct page says “No documents are available for this project.” |
| Replaced version | If still allowed, offer current approved version with review date; require fresh authorization for both. |
| Revoked/removed or unauthorized | Same generic unavailable state; do not reveal restricted title, audience, reference count or existence. |
| Temporary object failure | Authorized metadata can say “Document temporarily unavailable. Try again”; no raw storage error. |
| Expired identity | Clear restricted state, offer project-independent verification, retain only an allowlisted intended destination. |
| Draft/scan pending | Admin-only progress/error, retry with same upload intent; volunteers see nothing. |

Use 44px touch targets, visible focus, semantic headings, readable 16px body text, non-color status labels, escape/close/focus restoration and content-driven single columns at enlarged text. Proposed UI contracts are described in the implementation plan; previews are isolated, nonfunctional representations.
