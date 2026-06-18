# Current State

## 1. App Overview

CVC Scheduler is the full-stack successor to the Belgrade Remodel Sheets/App Script tool. It is being built as a project-centered workspace system where each workspace is centered around one real-world CVC project.

The current target admin mental model is:

Admin user/account -> assigned project workspace -> one real-world project -> enabled modules inside that workspace.

The product model is being realigned around:

- Overview: role-aware project home and follow-up summary.
- Tasks: reusable predefined blocks/presets.
- Calendar: scheduled instances of task presets.
- Volunteers: people, questionnaires, readiness.
- Communications: announcements, emails, reminders, templates.
- Settings: project/workspace/module setup.

Tasks and Calendar are separate things. A task preset is a reusable block. A
calendar item is a scheduled instance of a task preset.

Belgrade Major Remodel 2026 is the current blueprint and case study. The current app is a mock/prototype foundation only; it does not use real production data yet.

## 2. Product Principles

- Preserve the "easy feeling" of the current Belgrade app.
- Keep the volunteer experience simple.
- Make the admin UI calm, premium, and Apple-clean.
- Design for older and low-tech congregation contacts.
- Be role-aware without feeling overwhelming.
- Use color meaningfully for status, warnings, roles, and module accents, not as decoration.
- Volunteer intake should feel like a simple questionnaire, not profile creation.
- Never punish someone for wanting to help.
- Belgrade is the research/testing blueprint; the target is readiness for the next project.

## 3. Mental Model

Admin user/account
-> assigned project workspace
-> one real-world project
-> enabled modules inside that workspace

"Projects" should not feel like a peer feature beside Volunteers, Calendar,
Tasks, Communications, or Settings. The selection layer should generally use
visible language such as Workspace, Workspaces, or Project Workspaces.

"Project" is still acceptable when referring to the actual real-world project, such as Belgrade Major Remodel 2026, project contacts, project dates, or project type.

The `/admin/projects` route can remain for now, but visible UI language should stay workspace-centered.

## 3A. Tasks + Calendar Model

Task preset = reusable block.

Calendar item = scheduled instance of a task preset.

Tasks do not include the calendar. Calendar does not replace Tasks. They are
separate entities that work together to create the full project schedule.

Task presets may include:

- Task id.
- Workspace/project id.
- Task name.
- Category/type such as general, lunch, security, cleanup, construction, or custom.
- Needed count.
- Visibility settings.
- Optional custom fields with name/label/type.
- Duplicate/source info.
- System preset flag.

Task presets do not include date, time, assigned volunteers, scheduled status,
or calendar placement.

Task duplication should append a number suffix to the original task name, such
as Night watch, Night watch (1), Night watch (2).

Lunch is a predefined/system task preset. Lunch has one predefined field:
Menu. Lunch may also have custom fields below that. The reason Lunch is special
is so the system can later recognize it and generate a volunteer-facing lunch
schedule/menu view.

Calendar items may include:

- Task preset id.
- Date.
- Time/window.
- Assigned volunteers/helpers.
- Filled count such as 0/3, 1/3, or 2/2.
- Schedule-specific notes.
- Repeat rule.
- Copy/paste/bulk creation metadata.
- Optional one-off custom task data when the user drops in a task that does not need to become a reusable preset.

Future Calendar work should support day/week/month views, a Filter button with
a drawer/sheet, task search, helper coverage filters, drag/drop placement,
copy/paste, repeatable tasks, bulk creation, simple edit mode, and custom
one-day tasks.

Future Calendar UX should move closer to a minimal time-grid interaction model:
clean empty areas, subtle time/day separators, and no repeated visible "Add
task" buttons throughout the grid. Clicking or tapping empty space may suggest
a date or starting context, but it should not force a predefined time window.
The creation flow should let admins choose or adjust start time, end
time/time window, task preset, helper count, and notes. The "New scheduled
task" surface should become lighter and less intrusive over time, especially
on desktop.

Future desktop Calendar should support drag/drop scheduling, moving scheduled
tasks, possibly dragging task presets onto the calendar, and possibly resizing
scheduled blocks to adjust time. Mobile drag/drop should be considered
carefully; prefer tap/hold, edit mode, or simpler bottom-sheet controls if
direct drag/drop is too fiddly. The Calendar should stay powerful but visually
quiet so the grid does not look cluttered before the user takes action.

Future Calendar filters should support search by task name, unfilled tasks,
filled tasks, tasks waiting on some confirmations, tasks with all helpers
confirmed, and tasks with some/all helpers denied. Task type filters should use
only three high-level types: General Volunteers, Food, and Security.
Construction, cleanup, gate attendant, drywall, concrete, and similar work
should roll up under General Volunteers rather than becoming top-level filter
types.

## 3B. Navigation Direction

Target desktop sidebar:

- Overview.
- Calendar.
- Tasks.
- Volunteers.
- Communications.
- Settings.

Desktop should keep the persistent left sidebar. Do not replace desktop
navigation with bottom navigation.

Communications should absorb Emails and Announcements. Needs Attention and
Conflicts should become Overview/Calendar follow-up concepts rather than
permanent top-level sidebar siblings. Food and Security should become task
categories/presets/calendar filters rather than permanent top-level sidebar
siblings.

Target mobile 5-tab bottom navigation:

- Overview / Home.
- Tasks.
- Calendar.
- Volunteers.
- More.

Calendar should be the emphasized center tab/action on mobile. More should
contain secondary destinations such as Communications, Settings, Workspaces,
Needs Attention/follow-ups if not surfaced on Overview, and other admin/support
tools as needed.

Mobile can still use a drawer or More menu for secondary links, but the
long-term primary mobile navigation should be the 5-tab bottom bar.

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
- Mobile should feel app-like, with the 5-tab bottom nav as the long-term target.
- Desktop should keep the sidebar, but the sidebar should be simplified.

## 4. Current Implemented Areas

- Volunteer foundation with mock volunteer questionnaire/profile data.
- Project/workspace admin foundation.
- Project-aware and module-aware `AdminNav`.
- Shared admin shell with simplified desktop primary navigation for Overview, Calendar, Tasks, Volunteers, Communications, and Settings; mobile keeps the 5-tab bottom navigation with a grouped More sheet for secondary destinations.
- Mobile bottom navigation is shared across the checked admin routes, including Dashboard, Calendar, Tasks, Volunteers, Volunteer detail, Settings, Communications, Reminder templates, Questionnaires, Needs Attention, Workspaces, Food/Security prototypes, and the legacy Schedule route.
- Workspace setup wizard.
- Project settings panel with client-only module toggles.
- Workspace language cleanup so selection language uses Workspace / Project Workspace rather than presenting Projects as a module.
- Lightweight preview screenshot workflow via `npm run preview:screenshots`.
- Questionnaire data model, Belgrade mock submissions, and review helper functions.
- Public project questionnaire shell at `/questionnaire/[projectId]` with local-only mock submission confirmation.
- Admin questionnaire review queue at `/admin/questionnaires` with mock submissions across Belgrade, Bozeman, and Helena, calm filtering, review flags, and linked volunteer profile actions where available.
- Admin questionnaire detail review pages at `/admin/questionnaires/[submissionId]` with full mock answers, section completion cues, review flags/notes, linked volunteer context, and placeholder-only review actions.
- Mock questionnaire-to-volunteer profile preview/readiness layer showing what a volunteer record would look like before real conversion exists.
- Mock questionnaire workflow guidance for new, needs-review, needs-follow-up, missing-info, ready-for-profile, and already-linked submissions.
- Intake flow stabilization pass completed across public questionnaire, admin queue, questionnaire details, linked volunteer profiles, mobile tap targets, and preview screenshot coverage.
- Mock scheduling foundation with assignment data, grouping/count helpers, and a compact admin schedule view.
- Overview realignment at `/admin/dashboard`, now presenting a compact project home for Belgrade Major Remodel 2026 with project context, a this-week Calendar snapshot, calm follow-up rows, quick actions, and lighter role-aware guidance.
- Mock Needs Attention foundation with calm grouped follow-up rows and dashboard next-action integration.
- Mock conflict/coverage detail patterns for Needs Attention items, including coverage gaps, possible overlaps, denied assignments, and missing information before scheduling.
- Mock Communications foundation with announcement/reminder data, counts/grouping helpers, a calm admin overview at `/admin/announcements`, placeholder-only preview/edit/prepare actions, and explicit copy that real sending is inactive.
- Mock Communications detail/preview pages with message body preview, intended audience, recipient explanation, reminder plan, related links, and calm future-action placeholders.
- Mock Communications reminder-template foundation with grouped starting points for schedule reminders, pending confirmations, questionnaire follow-up, food notes, security reminders, project updates, plan changes, and wrap-up thanks.
- Emails/Announcements visual QA and admin mobile sidebar stabilization across the communication overview, template overview, detail preview, dashboard, and settings routes.
- Mock Food module foundation with lunch support, snack support, water/coffee, cleanup, helpers, headcount notes, food contact responsibility, grouped food rows, and placeholder-only actions.
- Mock Food detail/day view with focused headcount, helper, meal note, related item, and same-day support review.
- Food visual/icon density stabilization for the overview/detail pages, plus a compact accessible mobile menu icon in the shared admin shell.
- Mock Security module foundation with night watch coverage, site checks, access notes, assigned helpers, related follow-ups, icon-supported rows, and placeholder-only actions.
- Mock Security detail/day view with focused time window, contact/helper, site note, coverage note, related item, and same-day security review.
- Lightweight mock type scaffolding for future task presets and calendar items.
- Product model realignment toward unified Tasks + Calendar, with Food/Security pages now treated as prototype/research surfaces to fold into that model.
- Mock Tasks preset library at `/admin/tasks` with Belgrade task preset data, category grouping, counts, Lunch system preset handling, duplicate-name guidance, and placeholder-only actions.
- Mock Calendar scheduling foundation at `/admin/calendar` with Belgrade scheduled task instances, a stabilized full-width desktop week layout, mobile day groups, summary counts, an app-like item inspector drawer/sheet, Lunch menu display, and placeholder-only scheduling actions.
- Calendar view controls now live with the calendar workspace, not the page hero. Day/Week/Month switching is functional mock UI: Week remains the richest view, Day is a focused timeline/list preview, and Month is a compact count/chip grid preview.
- Calendar filtering is functional local mock UI with a desktop drawer and mobile bottom sheet. Filters include task-name search, coverage/confirmation states, and high-level task type filters for General Volunteers, Food, and Security.
- Calendar task type filtering rolls construction, cleanup, gate attendant, drywall, concrete, room signage, water/coffee, and similar project work into General Volunteers. Food covers Lunch and food-related calendar items. Security covers night watch, site checks, unlock/check-in, and security-related items.
- Calendar empty date/time areas now open a mock scheduled-task creation surface. Desktop uses a right-side creation inspector; mobile uses a bottom sheet. The mock flow can choose a reusable task preset, preview task type/default needed count/custom fields, adjust needed count, add notes, switch to a one-off custom task, and see disabled preview-only actions.
- Existing scheduled Calendar items still open the Calendar item inspector. Empty slots open the separate creation surface. Neither path saves data.
- Calendar overlays are mutually exclusive through a single active surface model. Opening filters, mobile More, empty-slot creation, or an existing-item inspector closes the other Calendar surfaces, and Escape/close controls return the Calendar to a clean base state.
- Mobile More coordinates with Calendar surfaces so More, Filter, Create, and Inspect do not stack on narrow layouts. Calendar actions also close the mobile More sheet or drawer before opening their own panel.
- Calendar interaction direction remains Google Calendar-inspired without visual cloning: empty date/time areas begin scheduling from the clicked/tapped slot, while the CVC-specific display emphasizes task name, filled count, coverage/confirmation state, and task type.
- Mobile admin primary navigation now uses five bottom tabs: Overview, Tasks, emphasized Calendar, Volunteers, and More. Calendar is the center action, and secondary admin destinations live in More.
- Mobile More is grouped into Communications, Follow-up, Workspace, and Prototype / legacy sections so reminder templates, Needs Attention, Questionnaires, Project Workspaces, Legacy Schedule, Food prototype, and Security prototype remain reachable without feeling like primary modules.

## 5. Current Routes

- `/admin`: Redirects to the default active Belgrade workspace dashboard.
- `/admin/dashboard`: Mock Overview page inside Belgrade Major Remodel 2026 with compact project context, this-week Calendar rows, calm follow-up summary, quick links to Questionnaires/Calendar/Tasks/Communications, and light role-aware guidance.
- `/admin/calendar`: Mock Calendar scheduling surface where task presets become dated/time-windowed scheduled instances with helpers, filled counts, status, notes, local filters, Day/Week/Month mock views, a click/tap-open item inspector for existing items, and a click/tap-open scheduled-task creator for empty slots. Desktop uses right-side inspector/filter/create panels; mobile uses bottom sheets. Calendar overlays are mutually exclusive, including coordination with mobile More.
- `/admin/tasks`: Mock task preset library for reusable project work blocks, separate from Calendar scheduling.
- `/admin/announcements`: Mock Communications overview with announcement and reminder planning rows for draft, ready, scheduled/mock, and sent/mock communication items. The route name remains unchanged for now.
- `/admin/announcements/templates`: Mock reminder templates overview with suggested audience, timing, preview text, placeholders, and placeholder-only actions.
- `/admin/announcements/[communicationId]`: Mock Communications detail/preview page with message, audience, recipient, reminder-plan, related-link, and helpful not-found states for unknown communication ids. The route name remains unchanged for now.
- `/admin/food`: Mock Food module overview for lunch support, helpers, headcount notes, and food contact coordination.
- `/admin/food/[foodItemId]`: Mock Food detail/day page with a helpful not-found state for unknown food item ids.
- `/admin/security`: Mock Security module overview for night watch, site checks, access notes, coverage review, and security contact coordination.
- `/admin/security/[securityItemId]`: Mock Security detail/day page with a helpful not-found state for unknown security item ids.
- `/admin/needs-attention`: Mock Needs Attention overview for project follow-ups, open coverage, and setup notes.
- `/admin/needs-attention/[itemId]`: Mock conflict/coverage detail page with suggested next step, related assignments/people, and placeholder-only actions.
- `/admin/schedule`: Legacy mock schedule prototype for the active Belgrade workspace with compact day groups and expandable assignment rows. It remains intact for route compatibility; `/admin/calendar` is the new primary scheduling surface.
- `/admin/projects`: Workspace selection/list page, visibly presented as Project Workspaces.
- `/admin/projects/new`: Mock project workspace setup wizard.
- `/admin/projects/[projectId]`: Workspace detail/read-only setup overview for specific mock workspaces.
- `/admin/settings`: Settings for the selected Belgrade workspace.
- `/admin/questionnaires`: Admin questionnaire review queue for incoming volunteer intake submissions.
- `/admin/questionnaires/[submissionId]`: Mock questionnaire detail review page with a helpful not-found state for unknown submission ids.
- `/admin/volunteers`: Volunteer review directory for the selected Belgrade workspace.
- `/admin/volunteers/[volunteerId]`: Volunteer questionnaire/profile detail page.
- `/questionnaire/[projectId]`: Public volunteer questionnaire shell for active volunteer-enabled workspaces, currently mock-only.

## 6. Preview Screenshot Workflow

Use `npm run build` and `npm run preview` for a production-like local preview, or `npm run dev` while actively developing. Then run `npm run preview:screenshots` while the app is available locally.

The script captures key admin routes, Calendar, Calendar filters open, Calendar create open, Tasks, communication overview/template/detail pages, Food overview/detail pages, Security overview/detail pages, Needs Attention, Schedule, Settings, the admin questionnaire queue, a questionnaire detail page, the Belgrade public questionnaire, and mobile checks for the dashboard, Calendar, Calendar filters open, Calendar create open, Tasks, Volunteers, announcements, templates, Food overview/detail, Security overview/detail, and open admin drawer/menu from `http://127.0.0.1:3000` by default. Set `PREVIEW_BASE_URL` to override the base URL.

The mobile admin screenshots include the bottom tab navigation. The screenshot workflow also captures the legacy mobile drawer open state and the new mobile More sheet open state.

Latest generated screenshots are written to `docs/previews/latest/`. The folder is cleared and recreated each time the script runs.

## 7. Current Mock Workspaces

- Belgrade Major Remodel 2026: active workspace and current blueprint/case study.
- Bozeman sample/draft project: draft workspace with limited modules.
- Helena sample/archive project: archived workspace for reference.

## 8. Current Limitations

- No real auth.
- No real database.
- No Supabase yet.
- No real persistence.
- No email sending.
- No real announcement sending, recipient resolution, reminder scheduling, template-to-draft creation, unsubscribe/suppression logic, notification delivery, or delivery tracking.
- No real food persistence, food ordering, inventory tracking, helper assignment mutations, or production food workflows.
- No real security persistence, helper assignment mutations, live alerts, GPS/location tracking, camera systems, access control, incident reporting workflows, or production security workflows.
- No real task preset creation/edit/duplicate mutations, drag/drop, repeat rules, copy/paste, bulk creation, or calendar persistence yet.
- Calendar scheduling is mock-data/UI only. Calendar item creation, saving, real placement edits, volunteer assignment mutations, drag/drop, calendar libraries, production scheduling logic, scheduled jobs, and email sending are not implemented.
- Calendar Day/Week/Month switching and filters are local mock UI. They do not persist state, navigate real dates, or mutate scheduling data.
- Empty-slot scheduled-item creation is preview-only. It opens a mock creation surface but does not create, save, or mutate Calendar items or task presets.
- Calendar overlay stabilization is UI-only. It does not add persistence, Supabase, real scheduling mutations, drag/drop, or assignment workflows.
- `/admin/login` and `/admin/onboarding` still use their simpler non-workspace shells; the checked workspace admin routes use the shared admin shell.
- No real questionnaire submissions yet; questionnaire form submission is local-only/mock-only.
- Questionnaire workflow states are preview/mock-only and do not save changes.
- No approve / needs-follow-up mutation workflow yet.
- Questionnaire-to-volunteer conversion is preview/mock-only and does not create records.
- No role-scoped questionnaire review views yet.
- No conversion from approved questionnaire submission to schedule-ready volunteer record yet.
- No scheduling integration from questionnaire readiness yet.
- Scheduling is mock-only; there is no scheduling engine yet.
- No assignment creation/editing workflow yet.
- Conflict/coverage detail pages are mock patterns only; there is no real detection logic yet.
- Needs Attention is mock-only and does not resolve or save follow-up items yet.
- No real conflict detection yet.
- No notification logic yet.
- No volunteer confirmation / denial persistence yet.
- Overview role-aware guidance is preview/mock-only and does not enforce permissions yet.
- Current Food and Security pages are legacy/prototype module explorations and may be folded into the unified Tasks + Calendar model.
- On-site role homes are compact preview patterns, not full modules.
- No platform owner/admin home yet.
- No public volunteer portal yet.
- Some non-workspace routes such as `/admin/login` and `/admin/onboarding` intentionally remain outside the shared workspace admin shell.
- Intake flow screenshots are still prototype QA artifacts, not product approvals.
- Current data is mock-only.
- Belgrade remains the production workflow in Sheets/App Script for now.

## 9. Next Recommended Step

09.18 Overview/navigation/Communications visual QA + preview refresh.
