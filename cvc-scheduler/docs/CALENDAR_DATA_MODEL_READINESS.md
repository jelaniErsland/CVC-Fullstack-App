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
- Start date, optional end date, preview `allDay` compatibility flag, and timed start/end values.
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

## Scheduling semantics

The recommended production vocabulary is deliberately small:

| Kind | Meaning | Typical examples | Coverage expectation |
| --- | --- | --- | --- |
| `timed` | Work with an exact start and end instant. It may cross midnight and remains timed work when it does. | Gate attendant shift, lunch service, night watch | May require helpers. |
| `date_based` | Work tied to one project date with no meaningful clock time. It does not mean a 24-hour shift. | Flexible cleanup day, materials receiving day | May require helpers when the whole item has one headcount target. |
| `multi_day_window` | A date range that communicates an ongoing project phase, availability window, or constraint. It is not an aggregate volunteer shift. | Concrete cure window, site-support week, access restriction | Informational by default. Create child timed or date-based work when volunteers need distinct assignments. |
| `milestone` | A dated project marker or context item with no work duration. | Inspection, delivery deadline, phase handoff | Informational only. |

`note` should not be a scheduling kind in the first contract. Schedule notes belong on an item, while a standalone dated project fact can use `milestone`. A separate project-note entity can be considered later if real use cases require undated or richer context.

`ongoing` is a display state derived when today or the focused date intersects a `multi_day_window`; it is not a stored scheduling kind.

### Current mock mapping implications

The controlled validation records were designed to exercise the current band, not settle production meaning. They must be classified deliberately rather than converted from `allDay` by date-span shape alone:

- Preconstruction prep and Materials receiving are plausible `date_based` work if they have one date and one item-level helper target.
- Concrete prep window and Site support week are plausible `multi_day_window` context. If volunteers actually work distinct days or shifts within them, keep the window informational and create related timed/date-based work.
- Safety coverage is semantically ambiguous. A broad safety phase is a `multi_day_window`; actual coverage duties should be split into assignable timed or date-based items.

### UI language recommendation

Do not center the production UI on **All day**. In CVC work it can incorrectly imply a 24-hour commitment. Prefer **Timed** and **Date-based** as creation modes, with **No specific time** as optional supporting copy for low-tech users. When a date range is present, present the item as **Project window** or **Multi-day**. Inspectors can use concise schedules such as `Date-based · Mon Jan 12`, `Project window · Jan 12–17`, or `Milestone · Jan 16`.

The current mock `allDay` flag and visible **All day** copy remain unchanged for this iteration. Treat them as preview and calendar-compatibility language that will later translate to `date_based` or `multi_day_window`; do not persist `allDay` beside an authoritative scheduling kind. External calendar interoperability may still require technical all-day event semantics at an adapter boundary.

### Calendar view behavior

| View | `timed` | `date_based` | `multi_day_window` | `milestone` |
| --- | --- | --- | --- | --- |
| Day | Positioned in the time grid. | Shown in the quiet date-based band above the grid. | Shown in the band on every intersecting date with its full range available to assistive technology. | Shown as a compact informational marker above the grid. |
| Week | Positioned by start/end time with overlap handling. | One-day bar in the band. | Spanning bar across intersecting day columns. | Compact marker in the relevant day column. |
| Month | Compact row within its date cell. | Compact row within its date cell. | Compact continuation/spanning treatment across the range where practical. | Compact marker on its date. |
| Mobile Week groups | Sorted within the relevant date group with time visible in its accessible/expanded detail. | Shown in its date group without a fake time. | Represented on intersecting dates with concise ongoing/range context; avoid implying a shift. | Shown once in its date group as informational. |
| Future List | One chronological row using start instant. | One row using project date. | One row using the full date range, not one duplicate per day. | One dated informational row. |
| Future Timeline / Work Plan | Duration bar on the time/date axis. | One-date bar or marker. | Natural multi-day phase/window bar. | Point marker. |

Day and Week remain the operational scheduling views. A future List view should favor scanning and filtering, while a future Timeline / Work Plan should favor construction phases, dependencies, and multi-day context. Neither future view should replace the familiar Week calendar.

### Month view implications

Month originally showed one chip plus a quiet `+N` per date. That protected full-cell creation during the interaction foundation, but it was too restrictive for the mature Calendar.

Iteration 09.37 applies the first Month-density step:

- Larger screens show up to three compact item rows; screens below 640px show two.
- A quiet `+N` represents only true breakpoint-specific overflow and focuses Day view for that date.
- The full-cell creation target remains behind foreground item and overflow sibling controls.
- Date-intersection helpers allow current compatibility range items to appear on relevant dates without implementing horizontal Month spans.

Future Month work should refine visual density and the terminology/treatment for date-based items, project windows, and milestones without making the grid noisy.

## Recommended schedule rules

- A scheduled item should reference exactly one reusable preset or carry one one-off task snapshot. The create boundary should reject ambiguous records containing both or neither.
- `timed` work uses unambiguous `startsAt` and `endsAt` instants with `endsAt > startsAt`. An overnight shift remains `timed`; it is not a project window.
- `date_based` work uses one date and no clock values.
- `multi_day_window` uses an inclusive project-facing `startDate` and `endDate`, with `endDate > startDate`, and no clock values.
- `milestone` uses one date, no end date, and no clock values.
- Multi-day intersection must be consistent in Week, Day, Month, mobile groups, filters, and counts. Current mock helpers handle date/range intersection, while some view grouping still intentionally follows start date.
- Workspace scheduling timezone must be explicit. Timed instants should be stored unambiguously; date-only values must never be converted through midnight UTC in a way that changes the project date.
- Coverage capability should be explicit and separate from schedule kind. `timed` and `date_based` may use item-level coverage; `multi_day_window` defaults to no coverage; `milestone` never carries coverage.
- Needed count belongs to the scheduled occurrence when it may differ from the preset default. Filled, confirmed, denied, waiting, and open counts are derived from assignments.

## Draft-to-item boundary

The future create operation should translate validated draft values into a narrow command or input object. It should copy only schedule-specific preset defaults that need historical stability, preserve the preset reference, and deliberately snapshot any one-off task data. Form context strings, selected-panel state, local validation messages, and disabled preview actions must not cross that boundary.

A future mutation should create the Calendar item first and assignments separately. It should not accept client-calculated coverage counts as authoritative.

## Persistence contract sketch

This is a contract-level shape, not a migration or final TypeScript API:

```ts
type CalendarSchedule =
  | { kind: "timed"; startsAt: string; endsAt: string; timezone: string }
  | { kind: "date_based"; startDate: string }
  | { kind: "multi_day_window"; startDate: string; endDate: string }
  | { kind: "milestone"; startDate: string };

type CalendarItemInput = {
  workspaceId: string;
  taskSource:
    | { taskPresetId: string; oneOffSnapshot?: never }
    | { taskPresetId?: never; oneOffSnapshot: CalendarOneOffTaskSnapshot };
  schedule: CalendarSchedule;
  coverageMode: "none" | "item";
  neededCount: number | null;
  scheduleNotes?: string;
  customFieldValues?: Record<string, unknown>;
  lifecycleState: "draft" | "published" | "cancelled" | "completed";
  source: {
    kind: "manual" | "copy" | "recurrence" | "bulk";
    copiedFromItemId?: string;
    recurrenceRuleId?: string;
    batchId?: string;
  };
};
```

The persisted record adds a server-generated id, audit fields, and an optimistic-concurrency/version value. The contract should enforce the task-source and schedule unions server-side rather than trusting form visibility. Preset definitions and item custom-field values stay separate: scheduled values may be snapshotted for history, while definitions remain on the preset.

`workspaceId` is the scheduling-scope key in the sketch. If a future workspace can contain more than one real-world project, add a separate `projectId` and enforce that it belongs to the workspace rather than using the two ids interchangeably.

`neededCount` is required and positive when `coverageMode` is `item`; it is `null` when coverage is `none`. A multi-day window should not use one ambiguous aggregate helper count. If the project needs volunteers on several dates or shifts inside a window, create related timed/date-based items or introduce a deliberate child-occurrence model later.

## Assignment and coverage truth

Future `calendar_item_assignments` rows, not Calendar item counters or client calculations, must drive:

- Filled count.
- Confirmed count.
- Denied count.
- Open spots.
- Waiting-on-confirmation state.
- Some/all-denied filter state.
- Each volunteer's invitation, confirmation, denial, cancellation, or completion response state.

Calendar item lifecycle remains separate from assignment response and derived coverage. Assignment changes need their own audit trail and concurrency rules.

## Migration risks to resolve before persistence

- Classify current `allDay` compatibility records explicitly as `date_based`, `multi_day_window`, or `milestone`; do not infer meaning from date span alone. Replace ambiguous visible wording in a later UI pass.
- Support overnight `timed` work with real instants without reclassifying it as a multi-day project window.
- Apply one inclusive date-range convention consistently to multi-day rendering, querying, filtering, counts, and accessibility text.
- Define workspace timezone, daylight-saving, locale, and external-calendar conversion rules before storing timed work.
- Choose structured recurrence, copy, and bulk source records instead of persisting `repeatLabel` or `copyLabel` display strings.
- Decide whether recurring edits affect one occurrence, future occurrences, or the series, and make generated operations idempotent.
- Decide how task preset edits affect scheduled items and which name/category/default/custom-field values are snapshotted for history.
- Keep one-off custom tasks as deliberate snapshots with validation; do not silently create reusable presets from them.
- Unify Lunch/menu and other custom-field values without making Food, Security, and General presentation filters separate scheduling models.
- Keep deterministic colors stable and derived unless explicit user-owned color becomes a requirement.
- Continue refining Month density without blocking full-cell creation or weakening sibling-control semantics; keep `+N` focused on Day.
- Define List sorting/grouping for date-only and range items without duplicating multi-day windows per date.
- Let a future Timeline / Work Plan express project windows and milestones without replacing Week or becoming the source of scheduling truth.
- Decide whether view/date state belongs in the URL before shareable Calendar links are introduced.
- Add audit/history requirements for schedule edits, assignments, status changes, preset snapshots, and communications.
- Define assignment uniqueness, capacity changes, waitlisting/overbooking, authorization, concurrency, and mutation idempotency before create/update/delete actions become real.

## Deliberately out of scope

No schema migration, Supabase client, authentication, persistence, mutation, volunteer assignment workflow, recurrence engine, drag/drop, resizing, URL date routing, Month-density change, List/Timeline UI, or production scheduling engine is introduced by this review.
