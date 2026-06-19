# Roadmap

## 1. Development Strategy

- Belgrade Remodel remains the production Sheets/App Script workflow.
- The full-stack app is being built in parallel.
- Belgrade is the research/testing blueprint.
- The goal is to be ready for the next project after Belgrade.
- Do not rush the full-stack app into the live Belgrade remodel unless a narrow slice becomes safe.

## 2. Real-World Readiness Plan

Rough phases:

- Mock prototype foundation.
- Real-data alpha.
- Practical MVP for next project.
- Multi-module platform version.

## 3. Near-Term Roadmap

- 05B.1 Questionnaire data model/helpers. Completed.
- 05B.2 Public questionnaire form shell. Completed.
- 05B.3 Admin questionnaire review queue. Completed.
- 05B.4 Questionnaire detail/review page. Completed.
- 05B.5 Questionnaire-to-volunteer profile readiness. Completed.
- 05B.6 Questionnaire review workflow states. Completed.
- 05B.7 Intake flow stabilization / visual QA. Completed.
- 06.1 Scheduling data model + mock schedule view. Completed.
- 06.5 Role Landing Page UX Alignment. Completed.
- 06.6 Role-home visual QA/stabilization. Completed.
- 07.1 Needs Attention data model + calm overview. Completed.
- 07.2 Conflict/coverage detail patterns. Completed.
- 07.3 Needs Attention visual QA/stabilization. Completed.
- 08.1 Emails and Announcements data model + admin overview. Completed.
- 08.2 Announcement detail/preview page. Completed.
- 08.3 Reminder templates. Completed.
- 08.4 Emails/Announcements visual QA and stabilization. Completed.
- 08.5 Preview Screenshot Refresh + Visual Review Coverage. Completed.
- 09.1 Food module foundation. Completed.
- 09.2 Food detail/day view. Completed.
- 09.3 Food visual/icon density stabilization. Completed.
- 09.4 Security module foundation. Completed.
- 09.5 Security detail/day view. Completed.
- 09.6 Unified Tasks + Calendar + Navigation Realignment. Completed.
- 09.7 Task presets foundation. Completed.
- 09.8 Calendar scheduling foundation. Completed.
- 09.9 Calendar visual/stability pass. Completed.
- 09.10 Calendar item inspector drawer. Completed.
- 09.11 Mobile 5-tab navigation direction. Completed.
- 09.11.1 Mobile nav coverage stabilization. Completed.
- 09.12 Calendar view controls + filter drawer / day-month foundation. Completed.
- 09.13 Calendar empty-slot creation mock. Completed.
- 09.14 Calendar Overlay + Mobile Interaction Stabilization. Completed.
- 09.15 Overview realignment. Completed.
- 09.16 Admin navigation simplification + Communications alignment. Completed.
- 09.17 Communications detail/template copy alignment. Completed.
- 09.18 Overview/navigation/Communications visual QA + preview refresh. Completed.
- 09.19 Calendar minimal grid visual direction pass. Completed.
- 09.20 Calendar creation detail refinement. Completed.
- 09.21 Calendar Day View 24-Hour Timeline Foundation. Completed.
- 09.22 Calendar Simplicity + Full-Surface Grid Interaction Pass. Completed.
- 09.23 Calendar Hydration Fix + Visual QA + Screenshot Refresh. Completed.
- 09.24 Calendar Week Time-Positioning Foundation. Completed.
- 09.25 Calendar Event Duration and Overlap Foundation. Completed.
- 09.26 Calendar Date Navigation Foundation. Completed.
- 09.27 Calendar Date Navigation Visual QA and Polish. Completed.
- 09.28 Calendar Month View Cleanup + Full-Cell Creation Pass. Completed.
- 09.29 Calendar Visual Reset Toward Native Calendar Feel. Completed.
- 09.30 Calendar Week Density + All-Day Band Foundation. Completed.
- 09.31 Calendar keyboard and screen-reader interaction QA. Next recommended step.

## 4. Mid-Term Roadmap

- 06 Scheduling foundation.
- 06.5 Role Landing Page UX Alignment for Primary CVC, Assistant CVC, Primary Food Contact, Primary Security Contact, and possible On-site Contact homes.
- 06.6 Role-home visual QA/stabilization.
- 07 Needs Attention / Conflicts.
- 07.2 Conflict/coverage detail patterns.
- 07.3 Needs Attention visual QA/stabilization.
- 08 Emails and announcements.
- 08.1 Emails and Announcements data model + admin overview.
- 08.2 Announcement detail/preview page.
- 08.3 Reminder templates.
- 08.4 Emails/Announcements visual QA and stabilization.
- 08.5 Preview Screenshot Refresh + Visual Review Coverage.
- 09.1 Food module foundation.
- 09.2 Food detail/day view.
- 09.3 Food visual/icon density stabilization.
- 09.4 Security module foundation.
- 09.5 Security detail/day view.
- 09.6 Unified Tasks + Calendar + Navigation Realignment.
- 09.7 Task presets foundation.
- 09.8 Calendar scheduling foundation.
- 09.9 Calendar visual/stability pass.
- 09.10 Calendar item inspector drawer.
- 09.11 Mobile 5-tab navigation direction.
- 09.11.1 Mobile nav coverage stabilization.
- 09.12 Calendar view controls + filter drawer / day-month foundation.
- 09.13 Calendar empty-slot creation mock.
- 09.14 Calendar Overlay + Mobile Interaction Stabilization.
- 09.15 Overview realignment.
- 09.16 Admin navigation simplification + Communications alignment.
- 09.17 Communications detail/template copy alignment.
- 09.18 Overview/navigation/Communications visual QA + preview refresh.
- 09.19 Calendar minimal grid visual direction pass.
- 09.20 Calendar creation detail refinement.
- 09.21 Calendar Day View 24-Hour Timeline Foundation.
- 09.22 Calendar Simplicity + Full-Surface Grid Interaction Pass.
- 09.23 Calendar Hydration Fix + Visual QA + Screenshot Refresh.
- 09.24 Calendar Week Time-Positioning Foundation.
- 09.25 Calendar Event Duration and Overlap Foundation.
- 09.26 Calendar Date Navigation Foundation.
- 09.27 Calendar Date Navigation Visual QA and Polish.
- 09.28 Calendar Month View Cleanup + Full-Cell Creation Pass.
- 09.29 Calendar Visual Reset Toward Native Calendar Feel.
- 09.30 Calendar Week Density + All-Day Band Foundation.
- 09.31 Calendar keyboard and screen-reader interaction QA.
- 09 Tasks + Calendar model.
- 10 Public volunteer portal.

## 5. Later Roadmap

- 11 Supabase/auth/persistence.
- 12 Platform admin.
- Copy previous project/workspace.
- Archive completed projects.
- Multi-workspace management.
- More complete permissions.

## 6. Real-World MVP Definition

For the next project, the app should eventually support:

- Create project workspace.
- Configure modules.
- Invite/add primary contacts.
- Send volunteer questionnaire link.
- Review questionnaire submissions.
- Create volunteer profiles.
- Create reusable task presets.
- Schedule task presets onto the calendar as dated work.
- Let volunteers confirm/deny.
- Show needs-attention items.
- Send reminder emails.
- Support lunch, security, cleanup, construction, and custom work as task categories and calendar filters.
- Archive project when done.

## 7. Build Discipline

- Keep Codex prompts small.
- Prefer vertical slices.
- Stabilize before adding large new features.
- Keep mock flow feeling right before database work.
- Do not connect Supabase too early if the user flow is still changing.
- Every future iteration should update the docs.

## 8. Questionnaire Intake Notes

05B.3 added a mock admin questionnaire review queue at `/admin/questionnaires`.
It uses existing questionnaire submission data plus review helpers to show new,
needs-review, incomplete, and reviewed submissions with calm card-first filtering.

05B.4 added a focused mock detail review page at
`/admin/questionnaires/[submissionId]` with full questionnaire answers,
review flags, section completion cues, linked volunteer context, and
placeholder-only review actions.

05B.5 added a mock-only volunteer profile preview/readiness layer that shows
how a reviewed questionnaire could become a schedule-ready volunteer record.
It does not create records or mutate state.

05B.6 added mock-only workflow state helpers and detail-page guidance for new
submissions, needs-review items, needs-follow-up items, missing required info,
ready-for-profile submissions, and already linked/reviewed questionnaires.

05B.7 stabilized the intake surfaces with copy cleanup, mobile tap-target polish,
route checks, visual QA, and expanded preview screenshot coverage for the admin
questionnaire queue and detail review page.

Future questionnaire iterations still need:

- Real approve / needs-follow-up workflow actions.
- Real persistence.
- Role-scoped review views.
- Converting approved questionnaire submissions into schedule-ready volunteer records.
- Scheduling integration after conversion.

## 9. Scheduling Notes

06.1 added mock schedule assignment data, grouping/count helpers, and a first
admin schedule view at `/admin/schedule`. The page shows the active Belgrade
project week as compact day groups with expandable assignment rows, soft
coverage counts, status explanations, and linked volunteer details where
available.

Scheduling is still mock-only. Future scheduling work still needs:

- Unified Calendar model where task presets become scheduled instances.
- Real scheduling engine.
- Assignment creation and editing.
- Conflict and coverage logic.
- Volunteer confirmation / denial workflow.
- Real persistence.
- Role-specific schedule landing pages.

## 10. Role Home Notes

06.5 reshaped `/admin/dashboard` into a mock role-aware landing page. 09.15
then realigned it into the current Overview direction: a compact project home
with Belgrade context, this-week Calendar rows, calm follow-up items, quick
links to common work areas, and lighter role-aware guidance for shared main
contact use.

06.6 stabilized the role home visually with tighter dashboard hierarchy, a
lighter project context panel, more prominent next-action treatment, clearer
preview-only language, and mobile/desktop checks for overflow and tap targets.

Role homes are preview/mock-only. Future role work still needs:

- Real role permissions and scoped data.
- Real persistence.
- Food and Security research surfaces folded into Tasks + Calendar.
- On-site contact workflows.
- Platform owner/admin homes.

## 11. Needs Attention / Conflicts Notes

07.1 added a mock Needs Attention foundation with follow-up items across
questionnaires, schedule, volunteers, food, security, and setup. The new
`/admin/needs-attention` route uses compact grouped rows, expandable details,
soft priority labels, related links, and calm next-step language. The Primary
CVC dashboard now derives its top next action from the Needs Attention helper.

07.2 added mock conflict and coverage detail patterns at
`/admin/needs-attention/[itemId]`, including coverage gaps, denied assignments,
possible overlaps, missing information before scheduling, food detail gaps, and
security/night-watch coverage. These detail pages show calm explanations,
related assignments/people, suggested next steps, related links, and
placeholder-only actions.

Needs Attention is mock-only. Future work still needs:

- Real conflict detection.
- Real resolution actions.
- Notification logic.
- Role-scoped follow-up views.
- Real persistence.

## 12. Emails and Announcements Notes

08.1 added a mock communication foundation for announcements, reminders,
updates, schedule changes, food notes, and security notes. The
`/admin/announcements` route now presents as Communications while keeping the
existing route name; it shows compact summary counts, recent and draft
communication rows, audience/status labels, status/type grouping, and clear
copy that sending is not active yet.

08.2 added focused mock detail/preview pages at
`/admin/announcements/[communicationId]` with message preview, audience and
recipient explanation, dates, author/role, reminder plan where present,
related links, placeholder-only actions, and a helpful not-found state. 09.17
aligned the visible copy so these pages read as Communications previews while
keeping the existing route.

08.3 added a mock reminder-template foundation at
`/admin/announcements/templates`. Templates provide calm starting points for
schedule reminders, pending confirmations, questionnaire follow-up, food
service notes, security/night-watch reminders, project updates, plan changes,
and thank-you/wrap-up notes. They are grouped by module and show suggested
audience, timing, subject suggestions, body previews, and placeholders. 09.17
aligned the page as Reminder templates inside Communications rather than a
separate top-level product area.

08.4 stabilized the communication surfaces and admin shell. The checked admin
routes now use a shared shell that preserves the persistent desktop sidebar and
shows a compact mobile top bar with a collapsible navigation drawer. The drawer
uses the existing admin nav, closes on outside tap or link selection, and keeps
mobile layouts from showing a cramped permanent sidebar.

Communications are mock-only. Future work still needs:

- Real email sending.
- Recipient resolution.
- Scheduled reminders and background jobs.
- Message templates.
- Unsubscribe and suppression logic.
- Delivery tracking.
- Real persistence.

## 13. Food Module Notes

09.1 added a mock Food module foundation at `/admin/food`. The overview shows
upcoming lunch support, water/coffee, snack support, and cleanup items for the
active Belgrade workspace with compact counts, a next suggested food action,
date-grouped rows, headcount notes, food contact/congregation responsibility,
helpers, expandable meal/helper notes, related links, and placeholder-only
actions.

09.2 added focused mock Food detail/day pages at `/admin/food/[foodItemId]`.
The detail page shows one food support item with date/day, service type,
status, headcount, congregation/contact responsibility, helpers, meal notes,
helper/headcount notes, related links, same-day food support, and
placeholder-only actions.

09.3 stabilized Food visual density with consistent icon-supported labels on
the overview and detail pages, shorter related-link language, and a compact
accessible mobile menu icon in the shared admin shell.

Food is mock-only. Future work still needs:

- Fold Food research surfaces into task presets and calendar items.
- Treat lunch as a system task preset with a predefined Menu field.
- Real helper assignment actions through Calendar.
- Real persistence.
- Food contact communication workflows through Communications.

## 14. Security Module Notes

09.4 added a mock Security module foundation at `/admin/security`. The
overview shows night watch coverage, evening site checks, morning
unlock/check-in, and access notes for the active Belgrade workspace with
compact counts, a next suggested security action, date-grouped rows,
icon-supported metadata, related links, and placeholder-only actions.

09.5 added focused mock Security detail/day pages at
`/admin/security/[securityItemId]`. The detail page shows one security item
with date/day, type, status, time window, assigned contact/helpers,
congregation, site/access notes, coverage/helper notes, related links,
same-day security items, and placeholder-only actions.

Security is mock-only. Future work still needs:

- Fold Security research surfaces into task presets and calendar items.
- Real helper assignment actions through Calendar.
- Real persistence.
- Security reminder workflows through Communications.

## 15. Unified Tasks + Calendar Notes

09.6 realigned the product model away from permanent Food/Security top-level
modules and toward a simpler Tasks + Calendar structure.

09.7 added the first mock task preset foundation at `/admin/tasks`. The page
shows reusable task presets only, grouped by category with compact counts,
icon-supported metadata, a focused Lunch system preset panel, duplicate-name
guidance, placeholder-only actions, and explicit copy that dates, times, and
assignments belong on Calendar items later.

Core model:

- Task preset = reusable block.
- Calendar item = scheduled instance of a task preset.
- Tasks and Calendar are separate entities that work together.

Task presets do not include dates, times, assigned volunteers, schedule status,
or calendar placement. A task preset may include:

- Task id.
- Workspace/project id.
- Task name.
- Category/type such as general, lunch, security, cleanup, construction, or custom.
- Needed count.
- Visibility settings.
- Optional custom fields.
- Duplicate/source info.
- System preset flag.

Task duplication should use the original name plus a number suffix:

- Night watch.
- Night watch (1).
- Night watch (2).

Lunch is a predefined/system task preset. Lunch has one predefined field,
Menu, and may also have custom fields below it. This lets the system later
recognize lunch and generate a volunteer-facing lunch schedule/menu view.

Calendar items are scheduled instances. They may include task preset id, date,
time/window, assigned volunteers/helpers, filled count such as 0/3, notes,
repeat rule, copy/paste/bulk creation metadata, and optional one-off custom
task data.

Future Calendar work should continue toward a Google Calendar-inspired
interaction model without copying its visual design directly. Empty date/time
areas should eventually be clickable/tappable to create a scheduled Calendar
item: desktop can open a compact popover or side inspector, while mobile should
open a bottom sheet. The creation flow should choose a reusable task preset,
confirm date/time, use or adjust needed count, add notes, and optionally assign
helpers later.

The Calendar should eventually feel closer to a minimal time-grid interaction
model. Empty areas should stay clean, with subtle separating time/day lines
rather than repeated visible "Add task" buttons everywhere. Clicking or
tapping an empty area may suggest a date or starting context, but should not
force a predefined time window. The creation flow should let the admin choose
or adjust start time, end time/time window, task preset, helper count, and
notes. The "New scheduled task" surface should become lighter and less
intrusive over time, especially on desktop.

Future desktop Calendar should support drag/drop scheduling and moving
scheduled tasks. It may also support dragging task presets onto the calendar
and resizing scheduled blocks to adjust time. Mobile drag/drop should be
considered carefully; prefer tap/hold, edit mode, or simpler bottom-sheet
controls if direct drag/drop is too fiddly. Keep the Calendar powerful but
visually quiet: the grid should not look cluttered before the user takes
action.

Calendar now has mock Day/Week/Month view switching and a mock Filter
drawer/sheet. Calendar filters support task-name search, unfilled tasks, filled
tasks, tasks waiting on some confirmations, tasks with all helpers confirmed,
tasks with some/all helpers denied, and high-level task type filters: General
Volunteers, Food, and Security. Construction, cleanup, gate attendant, drywall,
concrete, room signage, water/coffee, and similar work roll up under General
Volunteers rather than becoming top-level filter types.

The Calendar Week view has started moving toward the minimal time-grid
direction: subtler horizontal separators, quieter empty-space affordances, and
lighter scheduled-item blocks. Empty-slot creation now treats clicks/taps as
suggested calendar context rather than a committed predefined time window.
Timed rows seed specific editable start/end defaults, day-only clicks seed
editable defaults, and the creation surface remains preview-only without
saving or mutating data.

Day view now has a 24-hour vertical timeline foundation from 12 AM through
11 PM. Mock scheduled items are placed in approximate starting-hour rows, and
empty hour rows quietly open the existing preview-only creation flow with a
specific editable one-hour time suggestion. Proportional block heights,
overlap handling, resizing, drag/drop, persistence, and production scheduling
logic remain future work.

The Calendar grid has been simplified further: Day view no longer has an
internal scroll container, hour rows are thinner, Week columns are broad
clickable surfaces, and compact event blocks show only task name plus filled
count. Richer type/status/category/helper details remain in the inspector.

Calendar overlays now use a single active-surface interaction model. Filters,
mobile More, empty-slot creation, and existing-item inspection are mutually
exclusive, and mobile Calendar actions close More/drawer controls before
opening their own panel. This remains UI-only and mock-only.

Target desktop sidebar:

- Overview.
- Calendar.
- Tasks.
- Volunteers.
- Communications.
- Settings.

Desktop should keep the persistent left sidebar. Needs Attention and Conflicts
should become Overview/Calendar follow-up concepts. Food and Security should
be task categories/presets/calendar filters. Emails and Announcements should be
absorbed into Communications.

Target mobile bottom navigation:

- Overview / Home.
- Tasks.
- Calendar.
- Volunteers.
- More.

Calendar should be the emphasized center tab/action on mobile. More should
contain Communications, Settings, Workspaces, Needs Attention/follow-ups if
not surfaced on Overview, and other secondary admin/support tools as needed.

Trusted main project contacts should share one main app experience. The app
should still distinguish project/main contacts, assistant contacts, on-site
contacts, and volunteers, but should not split Primary CVC, Primary Food
Contact, and Primary Security Contact into separate main-contact sign-in
experiences.

Upcoming UI direction:

- Less text-heavy.
- Fewer sidebar items.
- Icon-supported where useful.
- Calm, premium, high-end, Apple-clean.
- Avoid giant stacks of cards.
- Show one thing at a time without removing power.
- Prioritize a focused calendar workspace.
- Make task creation feel simple and powerful.
- Keep older/low-tech users in mind.
- Make mobile feel app-like with the 5-tab bottom nav as the long-term target.
