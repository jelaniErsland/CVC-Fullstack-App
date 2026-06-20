# Calendar Data-Model Readiness

This note records the likely production boundary behind the current mock Calendar. It is a readiness guide, not a database schema or an implementation plan. The Calendar remains local, preview-only UI.

## Core boundaries

| Concept | Responsibility | Production direction |
| --- | --- | --- |
| Creation draft | Temporary form values, validation, suggested date/time context, and panel state | Keep client-local until an explicit create action exists. Do not persist launcher labels or validation UI state. |
| Task preset | Reusable work definition and defaults | Store workspace scope, name, category, default needed count, system-preset identity, and custom-field definitions. Do not store schedule placement or assignments. |
| Calendar item | One scheduled occurrence | Reference one task preset or contain one deliberate one-off task snapshot, plus workspace scope, schedule, needed count, schedule notes, and structured source metadata. |
| Assignment | Relationship between a calendar item and a volunteer/helper | Make assignment rows the source of truth for responses and coverage. Derive filled/confirmed/denied counts instead of storing volunteer id arrays and counters on the item. |

The current `CalendarCreationDraft` in `app/admin/calendar/page.tsx` is intentionally UI-only. The current `CalendarItem` in `lib/mockData.ts` is partly production-shaped, but several convenience fields are denormalized for the prototype.

## Recommended future entities

- `workspaces` or `projects`: project identity, lifecycle, modules, locale, and scheduling timezone.
- `task_presets`: reusable project work definitions and default custom fields.
- `calendar_items`: scheduled instances with a preset reference or a one-off snapshot.
- `calendar_item_assignments`: item-to-volunteer relationships, response state, role, and assignment history.
- `volunteer_profiles`: durable person/contact and readiness information.
- `questionnaire_submissions`: intake records that remain separate from durable volunteer profiles.
- Communications/reminders later: delivery plans and attempts that reference calendar items or assignments without embedding delivery state in them.

## Current field audit

### Already close to production-shaped

- Stable Calendar item id and workspace/project id.
- Task preset reference and a distinct one-off custom task snapshot.
- Start date, optional end date, all-day flag, and timed start/end values.
- Needed count and schedule-specific notes.
- `copiedFromItemId` as a basic provenance reference.
- Stable task/item identity for deterministic display colors.

### Mock or UI conveniences to replace

- `filledCount` and `assignedVolunteerIds` should be derived from assignment rows.
- Current Calendar item `status` mixes item lifecycle, staffing coverage, and confirmation state. Production should keep item lifecycle separate from assignment responses and derived coverage.
- `someDenied` is present in the filter vocabulary but cannot be derived from the current item shape. It needs assignment response data.
- `timeWindow`, `repeatLabel`, and `copyLabel` are display strings rather than authoritative scheduling or recurrence data.
- Category/type filters are derived presentation groupings. Avoid storing competing item and preset categories unless a deliberate historical snapshot is required.
- Deterministic event color is presentation state derived from stable identity. It need not be stored unless admins later receive an explicit color choice.
- Lunch `menuSummary` and preset custom fields overlap. Production should choose an authoritative item custom-field value model or a clearly typed meal detail, not both implicitly.

## Recommended schedule rules

- A scheduled item should reference exactly one reusable preset or carry one one-off task snapshot. The create boundary should reject ambiguous records containing both or neither.
- Timed items should use an unambiguous start and end instant with `end > start`. The current same-day local-time form does not model overnight work.
- All-day items should use date-only values and a documented inclusive or exclusive end-date convention. They should not also carry misleading time values.
- Multi-day intersection should be consistent in Week, Day, Month, mobile groups, filters, and counts. Current mock helpers now handle date/range intersection, while some view grouping still intentionally follows start date.
- Workspace timezone must be explicit before persistence. Store timed instants with a clear conversion policy and preserve date-only semantics for all-day work, including daylight-saving transitions.
- Needed count belongs to the scheduled occurrence when it may differ from the preset default. Filled, confirmed, declined, and open counts should be derived from assignments.

## Draft-to-item boundary

The future create operation should translate validated draft values into a narrow command or input object. It should copy only schedule-specific preset defaults that need historical stability, preserve the preset reference, and deliberately snapshot any one-off task data. Form context strings, selected-panel state, local validation messages, and disabled preview actions must not cross that boundary.

A future mutation should create the Calendar item first and assignments separately. It should not accept client-calculated coverage counts as authoritative.

## Migration risks to resolve before persistence

- Define all-day, timed, overnight, and multi-day invariants, including timezone and daylight-saving behavior.
- Choose recurrence, copy, and bulk-creation structures instead of persisting display labels.
- Separate item lifecycle from volunteer invitation, confirmation, denial, cancellation, and coverage states.
- Define assignment uniqueness, capacity changes, waitlisting/overbooking policy, and concurrent updates.
- Decide how task preset edits affect already scheduled occurrences and which values are snapshotted.
- Unify Lunch/menu and other custom-field values without making Food/Security presentation filters separate scheduling models.
- Keep deterministic colors stable without treating presentation color as scheduling truth.
- Decide whether view/date state belongs in the URL before shareable Calendar links are introduced.
- Add audit/history requirements for schedule edits, assignments, status changes, and communications.
- Define idempotency and authorization boundaries before create/update/delete actions become real.

## Deliberately out of scope

No schema migration, Supabase client, authentication, persistence, mutation, volunteer assignment workflow, recurrence engine, drag/drop, resizing, URL date routing, or production scheduling engine is introduced by this review.
