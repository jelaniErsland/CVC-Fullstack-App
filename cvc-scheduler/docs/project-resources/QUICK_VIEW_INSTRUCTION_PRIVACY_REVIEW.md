# Bearer Quick View: existing instruction exposure and approval decision

Reviewed September 27, 2026 against deployed source `ca54020ef3f8e8ecc55bcd46f7fedf1331a56923` and development `0b529f8`. This is an investigation and policy proposal. **No application projection, function, grant, migration or production behavior is changed by this review.** All examples/tests use disposable synthetic local data.

## Current boundary

A project bearer is a trusted project-wide read credential, not an individual volunteer identity. `read_project_quick_view_by_token(text,date)` already returns published occurrence notes and the linked preset's current description. The task-details feature reuses those fields. Consequently, the approved instruction snapshots and private revision table do **not** make published instructions assignee-private.

The production function definition is in `supabase/migrations/20260906130000_breakfast_lunch_system_presets.sql`. It is postgres-owned, SECURITY DEFINER, with an empty search path and EXECUTE for anon/authenticated/service_role. It verifies the hashed 43-character bearer, purpose/version, revocation, expiration, active project and project end date; it updates only token `last_used_at` during retrieval. It returns active, published items belonging to that token's workspace, with source dates before selected date + 42 and end dates on/after selected date − 31. This is the loaded source window, not merely the selected day's visible rows. Recurrence expansion happens in the existing read model. A valid bearer can choose another permitted date and retrieve its window.

Neither task type nor assignment ownership restricts this output. Published security-named tasks are included; a task name never establishes security authorization. Draft items, private instruction revisions and other workspaces are excluded. Bearer retrieval must not be described as anonymous access without a credential, but it also must not be described as individually assigned-volunteer access.

## Exact returned fields

Top-level fields: `access_state`, `workspace_display_name`, `workspace_timezone`, `project_date`, `project_starts_on`, `project_ends_on`, `token_expires_at`, `expected_on_site_count` (currently null), `schedule_sources`.

Each `schedule_sources` item contains:

| Group | Existing fields |
| --- | --- |
| Identity/classification | `id`, `workspace_id`, `task_preset_id`, `title_snapshot`, `task_type_snapshot`, `schedule_kind` |
| Date/time | `start_date`, `end_date`, `start_time`, `end_time`, `timezone` |
| Operational text | **`schedule_notes`**, **`task_description`**, **`custom_values`** |
| Staffing/preset presentation | `needed_count`, `task_preset_label`, `task_preset_color_key`, `assignments` |
| Meals | `meal_kind`, `meal_provider`, `meal_contact`, `meal_menu`, `meal_total` |
| Publication/lifecycle | `lifecycle`, `publication_state`, `published_at` |

`schedule_notes` is the saved occurrence text: legacy operational notes, copied instructions or individual exceptions. `task_description` is the linked preset's **current** `description`, without an instruction-approval filter or historical snapshot. Editing a preset can therefore change bearer-visible text even when published occurrence instructions remain untouched. `custom_values` is the existing free-form JSON projection; an administrator could place reporting instructions there as well.

Nested active assignments already include `assignmentId`, `calendarItemId`, `volunteerProfileId`, `volunteerDisplayName`, `responseStatus` (missing response becomes `needs_response`). This review does not broaden or remove those existing identities. Email, phone, congregation, profile notes, assignment-private notes, response notes, contact/grant identities and revision actors are not added to this projection.

## Where text appears

`app/qv/access/[token]/route.ts` verifies access and establishes the existing HttpOnly `/qv` cookie, then redirects to a clean URL. Its metadata parser does not render schedule text. `app/qv/page.tsx` subsequently calls the bearer RPC, passes the result through `lib/calendar/quickView.server.ts::sharedCalendarState` and renders the common `CalendarClient` with `readOnly` and `/qv` route context.

The adapter maps notes to `scheduleNotes` and the preset description to `taskDescription`. The read-only adapter removes editing/directory/private assignment context; it does **not** redact these text fields or custom values. They reach serialized Calendar props regardless of whether an inspector is open. Hiding DOM text would not establish confidentiality.

In `components/CalendarClient.tsx`, the ordinary-task inspector displays:

- A **Schedule notes** heading followed by the occurrence notes (or “No schedule-specific notes.”).
- The current preset description immediately below, if nonblank, with paragraph formatting but no separate heading.
- The existing custom-field name/value list.

This applies to the desktop drawer and mobile sheet, including item deep links. Month/Week/Day/List summary rows do not display these instructions. Read-only Breakfast/Lunch inspectors use their meal-specific path and omit the ordinary instruction section; their raw source/serialized fields are still present. A hidden meal field is not private.

The authenticated `/admin/quick-view` route uses an authorized Calendar read rather than the bearer RPC but shares the renderer. Any restriction proposed here must be explicitly scoped; changing the common item mapper would also affect authorized administrators.

## Consumers to preserve

| Consumer | Dependency |
| --- | --- |
| Real bearer `/qv` route and common inspector | Both text fields and custom values, as above. |
| Authenticated Calendar/Quick View | Occurrence notes and current preset description; existing live workspace/capability checks. |
| Calendar occurrence editing and future-apply preview | Saved notes, versions, preset instructions and provenance; manual exceptions/history must survive. |
| Tasks editor and scheduling defaults | Existing preset description; approved snapshots for newly created non-meal occurrences. |
| Personalized volunteer schedule/dialog | Own authorized `schedule_notes`, rendered in Assignment details; existing individual credential/assignment filtering. |
| Initial assignment/resend email composition | Existing notification claim reads `schedule_notes`; the Details text accompanies the primary Review assignment & respond link. No delivery behavior or recipient safeguards may change accidentally. |
| Private instruction revision/history | Prior wording and publication state, inaccessible through bearer/client reads. |

The older `SharedProjectQuickView`/`ProjectQuickView` components and `lib/operations/projectQuickViewRoute.server.ts` contract remain in the repository/tests but are not the render path imported by the current `/qv` or `/admin/quick-view` page. Their smaller historical projection is not evidence of the live bearer boundary.

## Least disruptive restriction, if approved

For **assigned volunteers and authorized administrators only**, return JSON null for both `schedule_notes` and `task_description` in the **database bearer projection**. Preserve the function signature, JSON keys, token validation, loaded date window, workspace scope, meal data, staffing/identity contract and grants. Keep authenticated administrative reads, the own-volunteer projection, snapshots/history and notification composition unchanged.

This requires one reviewed forward migration replacing the existing function body; no new table, backfill or RLS expansion is needed. Do not edit an already deployed migration or rely on client redaction. Add direct anonymous-RPC tests proving both fields remain null across linked/unlinked presets, preset changes, manual exceptions, meals and dates; retain cross-project/draft/expiry/revocation tests. Add actual desktop/mobile recipient-inspector tests and retain positive administrator/assigned-volunteer tests. Only after approval, omit the instruction block from the bearer inspector rather than implying there are no instructions.

The tradeoff is that **all legacy occurrence notes and preset descriptions disappear from bearer inspectors**, including useful general operational notes. These shared columns do not classify public versus private prose. `instruction_source`, approval timestamp or task name cannot safely distinguish audience: manual exceptions and old notes also contain instructions.

| Alternative | Consequence |
| --- | --- |
| Retain the current contract | Least code/UX disruption; valid project bearers can read published instructions. Requires explicit acceptance of that audience. |
| Null the two bearer text fields | Smallest reliable restriction for these fields; eliminates legacy general notes too. Proposed approach if assignee/admin privacy is required. |
| Add an explicitly public summary separate from private instructions | Retains useful bearer prose, but requires a new classification/schema/editor/migration policy. Defer as separately approved scope. |

There are two additional policy boundaries. First, `custom_values` can carry prose. If “instructions are private” is intended as an absolute guarantee, approve excluding free-form custom values or an explicit public-field allowlist too; redacting only the two named fields cannot make arbitrary text entered elsewhere private. Second, authenticated read-only contacts currently inherit Calendar text under existing server capabilities. Define whether “authorized administrators” includes those contacts. Restricting them would require an additional field-level capability/projection decision, not an incidental bearer fix.

Revocation controls future retrieval. It cannot recall text already copied, cached outside the app or delivered in an existing assignment email. Private/no-store headers and existing link expiry reduce future access, not retrospective disclosure.

## Approval required before release

1. Accept existing project-wide bearer instruction visibility, or approve the narrow forward-migration restriction above.
2. If restricting, decide the treatment of `custom_values` and authenticated read-only contacts.
3. If general bearer notes are still required, approve a separate public-summary design rather than implicit classification of existing text.

No restriction migration is created or applied here. The implementation report records the final executed local regression results. The checked-in bearer data/browser suites now explicitly exercise the current notes, current description and custom-value exposure, while retaining their authorization, read-only and revocation checks.
