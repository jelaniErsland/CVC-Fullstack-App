# Assignment details and one project site map — product proposal

Status: architecture only. The complete earlier Project Resources proposal remains at Git commit `edd1114`; its library, security-document distribution and email redesign are outside this revision.

## Administrator journeys

**Task library.** An authorized contact opens an existing task preset and chooses **Edit task** in its current inspector. Add one optional multiline **Assignment details** field to the existing task form. Its gray placeholder is only guidance and is never submitted as content:

> Who should volunteers report to?
> Where should they check in?
> What time should they arrive?
> What should they bring or wear?
> Are there any special instructions?

The field accepts several plain-text paragraphs, preserves line breaks and has a visible character count near the tested limit. No required subfields, rich-text editor, document attachments or new task category. Save uses the existing `tasks.edit` scope, expected `updated_at` version and the current inspector/drawer interaction. Validation or a failed request leaves the draft dirty and offers the existing conflict resolution; only a confirmed successful save clears it. Task name and other existing editable fields should use the same authorized update path when exposed; do not imply that the current color-only edit already provides this.

**Scheduled occurrence.** The existing Calendar item editor presents the same multiline field with the preset text as the default for a newly scheduled item. The administrator may keep it, replace it for this date, or clear it. The saved item contains the resolved text, so a change to the preset does not silently rewrite already scheduled work. Existing one-off items can use the field directly. Repeat creation produces independent items; each carries its own details and exact date. A future-item update, if wanted, must select exact item IDs, show a before/after count and preserve assignments and responses. It does not silently propagate when a preset is saved.

Existing `schedule_notes` already belongs to the scheduled item and is projected to a volunteer as “Notes.” Migration must retain nonempty notes unchanged and label them accurately as assignment details after coordinator review. Existing `task_presets.description` may contain prior prose; do not automatically republish it to old items. An explicit migration review can copy approved text for newly scheduled work. Breakfast/Lunch keep their separate headcount and meal-contact model; no ordinary staffing field is introduced on meal entries.

**Map management.** The project's administrator sees one **Site map** card near project identity/settings, showing the current approved map, file type, review date and **Upload map**, **Replace map** or **Remove map** as appropriate. A replacement is validated and previewed before it becomes current. A failed replacement leaves the previous map available. A removal revokes new retrieval immediately while retained backup copies follow the approved retention rule. There is no resource library or attachment workflow.

## Volunteer journeys

The existing schedule, selected assignment dialog and Confirm/Decline controls remain the primary workflow. If resolved details contain nonblank text, show one shared `DisclosureSection` titled **Assignment details** within the dialog. Opening it reveals escaped plain text with paragraph breaks and natural wrapping. If details are blank, omit the disclosure. Show the project site-map link alongside the details or in the dialog's practical information area when a map is published, even if no instruction text exists. The link rechecks the verified volunteer's project session; it is not a public file URL or a substitute response link.

On the existing project home, a compact **Site map** card appears when the project has an approved map. Opening it shows a legible page or image, **Zoom in**, **Zoom out**, **Fit page**, keyboard focus, mobile pan confined to the viewer, and text directions or alternative text approved with the map. A PDF download is offered only when its safe approved bytes can be delivered; the original file is not assumed to be accessible by itself. A missing map leaves no empty card. A removed/unavailable map produces a neutral message without serving a stale cached version.

Initial volunteer sign-in remains project-independent. The server uses the verified profile and selected workspace for the map. A volunteer associated with two workspaces never gains one project's map from the other project's session; sharing an email address does not merge identities. Quick View retains its existing read-only and bearer boundaries.

## Instruction update policy

Recommendation for approval: **copy the resolved preset details into each Calendar item when it is created**. A later preset edit affects newly created items only. A scheduled item may be edited explicitly; each published edit records its previous and new text for audit. Past published instructions remain retrievable to authorized administrators as historical revisions, while volunteers see the current permitted item text. Before migration, existing nonempty item notes win; existing blank items stay blank until an administrator reviews them. This avoids pretending the old preset description was already an assignment instruction.

Do not send email when a preset, occurrence or map changes. A coordinator can use the established Communications review/resend workflow separately if an urgent correction must reach volunteers. Existing recipient selection, preview/fingerprint, deduplication, delivery ledger, confirmation and unknown-outcome safeguards remain intact. The current primary assignment email link and response route remain unchanged.

## Boundaries and shared design

Use the existing 12.48 Panel, Field, Button, ActionMenu and `DisclosureSection` with one chevron and native keyboard semantics. Preserve the volunteer dialog's close, Escape, focus return, mobile scroll and safe areas. Batch 3 may reuse the same read-only resolved-details block and authoritative item ID without changing Calendar gestures, meals or assignment editing. These proposals introduce neither security-document access nor new welcome-email flows.
