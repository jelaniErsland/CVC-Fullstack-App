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

The production boundary and unresolved migration rules are summarized in
[`CALENDAR_DATA_MODEL_READINESS.md`](./CALENDAR_DATA_MODEL_READINESS.md).
Creation drafts remain local UI state; they are not Calendar item records.
Future assignment rows should be the source of volunteer response and coverage
truth rather than the current mock item counters and volunteer id arrays.

Future Calendar work should support day/week/month views, a Filter button with
a drawer/sheet, task search, helper coverage filters, drag/drop placement,
copy/paste, repeatable tasks, bulk creation, simple edit mode, and custom
one-day tasks.

Future Calendar UX should move closer to a minimal time-grid interaction model:
clean empty areas, subtle time/day separators, and no repeated visible "Add
task" buttons throughout the grid. Clicking or tapping empty space may suggest
a date or starting context, but it should not force a predefined time window.
The creation flow should let admins choose or adjust start time, end
time/time window, task preset, helper count, and notes. The `Plan project work`
surface should become lighter and less intrusive over time, especially
on desktop.

Future desktop Calendar should support drag/drop scheduling, moving calendar
work items, possibly dragging task presets onto the calendar, and possibly resizing
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

- Public Project Local entry at `/` now leads with one account-free volunteer access flow instead of an admin dashboard. The Belgrade project context is integrated into the lookup card, Alex Rivera is the explicit sample identity, the keyboard-accessible submit opens `/v/demo`, and the questionnaire remains the quiet secondary action. Copy states that the preview neither creates an account nor searches real volunteer information.
- Mock remembered-volunteer home at `/v/demo` identifies Alex and the Belgrade project, emphasizes Material staging as the next assignment, and presents Drywall crew, Lunch support, and Site cleanup as a flat linked Upcoming schedule. Every row carries date/time, location, helper coverage, response state, and an accessible detail name without becoming a calendar or admin table; questionnaire, lunch, and project updates remain secondary.
- The reusable `/v/demo/assignments/[assignmentId]` preview renders all four listed assignments from one shared public-preview schedule source. Each detail includes person/project context, work purpose, date/time, location/check-in, crew coverage, contact, preparation and lunch guidance, a schedule back path, and shared local-only response controls initialized from the assignment’s preview state. Unknown ids retain the calm recovery view.
- Deterministic `/v/demo/no-assignments` shows the same remembered person/project context without treating an empty schedule as an error or rejection. It explains that availability may still be under review, keeps account-free return guidance plain, offers real questionnaire and lookup links, and avoids a fake refresh action.
- Normal and empty volunteer schedule states share a compact divided project-information rail. The normal schedule includes questionnaire status, the next relevant lunch, a dated concise project update, and check-in help; the empty state removes duplicate questionnaire and irrelevant lunch sections, leaving only the project update and help guidance.
- Public response controls now use a reversible three-state preview. `Needs reply` exposes Confirm and Can’t make it; either choice becomes a calm `Confirmed` or `Can’t make it` result with one `Change response` action. An `aria-live` region announces the state copy, and every state plainly says that nothing is sent and the choice resets when the volunteer leaves.
- Deterministic `/v/demo/reminder/[assignmentId]` demonstrates the focused page a future email/text reminder could open for any of the four assignments. It includes person/project context, date/time, location/check-in, crew coverage, the shared response controls, schedule/detail links, explicit no-account language, and clear warnings that the link is neither secure nor sent. Unknown reminder ids receive a calm recovery state.
- The 10.1–10.7 public volunteer sequence is now stable for mock-prototype handoff. The audited loop covers account-free lookup, remembered schedule, empty schedule, four reusable details, four reminder previews, calm unknown recovery, reversible local responses, questionnaire access, Special access separation, and desktop/full-page 390px QA. Future public work should begin from persistence/security readiness rather than another general UI expansion.
- Volunteer foundation with mock volunteer questionnaire/profile data.
- Project/workspace admin foundation.
- Project-aware and module-aware `AdminNav`.
- Shared admin shell with simplified desktop primary navigation for Overview, Calendar, Tasks, Volunteers, Communications, and Settings; mobile keeps the 5-tab bottom navigation with a grouped More sheet for secondary destinations.
- Mobile bottom navigation is shared across the checked admin routes, including Dashboard, Calendar, Tasks, Volunteers, Volunteer detail, Settings, Communications, Reminder templates, Questionnaires, Needs Attention, Workspaces, Food/Security prototypes, and the legacy Schedule route.
- Overview/navigation/Communications visual QA completed with refreshed preview screenshots, renamed Communications preview filenames, and mobile More screenshot stabilization so the closed sheet does not appear in default full-page captures.
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
- Mock Calendar scheduling foundation at `/admin/calendar` with Belgrade project-work items, a stabilized full-width desktop week layout, mobile day groups, an app-like item inspector drawer/sheet, Lunch menu display, and placeholder-only scheduling actions.
- Calendar view controls now live with the calendar workspace, not the page hero. Day/Week/Month/List switching is functional mock UI: Week remains the broad planning view, Day has a 24-hour vertical timeline foundation, Month is a clean full-cell creation grid with compact event chips, and List is a compact week-based scanning companion.
- Calendar filtering is functional local mock UI with a desktop drawer and mobile bottom sheet. Filters include task-name search, coverage/confirmation states, and high-level task type filters for General Volunteers, Food, and Security.
- Calendar task type filtering rolls construction, cleanup, gate attendant, drywall, concrete, room signage, water/coffee, and similar project work into General Volunteers. Food covers Lunch and food-related calendar items. Security covers night watch, site checks, unlock/check-in, and security-related items.
- Calendar empty date/time areas now open a mock scheduled-task creation surface. Desktop uses a lighter right-side creation inspector; mobile uses a bottom sheet. The mock flow can choose a reusable task preset, adjust local-only date/start/end fields, preview task type/default needed count/custom fields, adjust needed count, add notes, switch to a one-off custom task, and see disabled preview-only actions.
- Existing scheduled Calendar items still open the Calendar item inspector. Empty slots open the separate creation surface. Neither path saves data.
- Calendar overlays are mutually exclusive through a single active surface model. Opening filters, mobile More, empty-slot creation, or an existing-item inspector closes the other Calendar surfaces, and Escape/close controls return the Calendar to a clean base state.
- Calendar controls now expose consistent calm keyboard focus rings, grouped pressed-state semantics for Day/Week/Month/List, and descriptive accessible names for creation surfaces, event buttons, List rows, Month overflow, and project-context/date-based controls. Event names include date or project-window timing and helper coverage for assistive technology without overloading compact grid bars.
- Calendar filter, creation, and inspector surfaces now use dialog semantics, move focus to their close control when opened, close with Escape, and return focus to the control that launched them. Hidden filter UI is removed from the keyboard and accessibility trees while closed.
- Mobile More coordinates with Calendar surfaces so More, Filter, Create, and Inspect do not stack on narrow layouts. Calendar actions also close the mobile More sheet or drawer before opening their own panel.
- Calendar interaction direction remains Google Calendar-inspired without visual cloning: Week keeps days across the x-axis and time down the y-axis, full clickable 24-hour day columns, a subtle two-hour time gutter, hourly separators, duration-based block heights, and deterministic side-by-side lanes for overlapping work. A compact desktop `Project context` band remains between the Week headers and timed grid. Day uses a full 24-hour timeline with quiet clickable hour rows instead of repeated visible "Add task" or "Plan" buttons.
- Calendar date navigation is local mock UI. Previous/next shifts by one day, week, or month according to the active view; List follows the Week period. Project week resets the anchor to Jan 13, 2026 and its Jan 12-18 project week. Navigated empty periods retain their normal Day, Week, or Month surfaces or a calm one-line List state without large empty cards.
- Calendar date controls now use a compact two-row workspace header on mobile and a balanced title/control layout on desktop. Previous/next and Project week keep 44px touch targets, while Day/Week/Month/List and Filters share one calm row without horizontal overflow at 390px.
- Every visible Month date uses a full-cell background creation target with separate event-chip siblings above it. Month creation seeds the clicked visible date at 09:00-10:00, including dates that already contain calendar items. Month now uses skinny 16px event rows and shows up to six rows on screens 640px and wider and three below 640px, with a quiet `+N` only for rows truly hidden at that breakpoint.
- The Calendar now uses a native-calendar visual direction: a compact page title, no dashboard summary-card strip, a flat divider-based workspace toolbar, subtle slate grid lines, and direct Week/Day/Month/List work surfaces without nested glass-card shadows or redundant inner view headings.
- Compact Week, Day, mobile Week, and Month events now use a deterministic restrained palette derived from stable task/item identity rather than broad category alone. Count-first typography is smaller and consistent across views, and bars continue to show only task name and volunteer fraction/count where space permits; richer details remain in the inspector.
- The Week `Project context` band recognizes explicit compatibility `allDay` items, `All day` mock time windows, or untimed items; supports optional `endDate` project-window spans; shows up to two compact lanes; and provides a quiet per-day `+N` overflow action that focuses the existing Day view. A controlled mock validation set covers Site support week, Preconstruction prep, Concrete prep window, Materials receiving, and Safety coverage.
- Project-context span placement is calculated from the actual Monday week boundary. The validation set produces a six-day bar, a three-day bar, a single-day item, and deterministic Wednesday `+2` plus Thursday/Friday `+1` overflow. Day keeps a hard-capped 32px `Project context` strip with one intersecting date-based/project-window item plus `+N`, while Week, Month, and the inspector carry fuller context.
- Each desktop Week project-context day column has a quiet full-background creation target behind the event and overflow controls. It opens the existing preview-only `Plan project work` surface with `No specific time` selected for that date; foreground bars and `+N` remain separate sibling controls.
- Calendar creation drafts can switch locally between timed and no-specific-time modes. No-specific-time mode hides start/end times, keeps Date editable, exposes an optional End date clamped to Date, and changes the context copy to `Project window` when the range spans dates. Switching back restores the clicked timed suggestion or the calm 09:00-10:00 default. The internal compatibility field remains `allDay`.
- The creation panel now gives Date its own full desktop row with Start/End paired beneath it, preventing the End field from clipping inside the existing drawer width. Mobile retains the same readable single-column sheet.
- Creation validation remains local and calm: timed End must be later than Start, a no-specific-time End date cannot precede Date, Needed is clamped to 1-99, and custom one-day mode requires a non-empty name. Field messages use `aria-invalid`/descriptions, while the fixed footer explains that Schedule, Save draft, and Assign helpers remain unavailable in this preview.
- Calendar model readiness is now documented separately from the UI implementation. Local draft types are explicitly named as preview state, Calendar timing is classified through one deterministic helper, and shared date/range intersection helpers keep all-day and multi-day selection rules consistent without adding persistence.
- Supabase, authentication, persistence, and real-data migration readiness is documented in [`SUPABASE_AUTH_PERSISTENCE_READINESS.md`](./SUPABASE_AUTH_PERSISTENCE_READINESS.md). Iteration 11.3 adds an invite-only project-contact magic-link shell, cookie callback/session handling, POST sign-out, and an optional admin proxy boundary. `ADMIN_AUTH_MODE=review` remains the default so current mock admin routes stay reviewable; `enforced` requires a verified Auth identity but does not itself grant project access. [`SUPABASE_LOCAL_SETUP.md`](./SUPABASE_LOCAL_SETUP.md) documents setup and redirect configuration.
- Iteration 11.4 adds the first product schema boundary: one `public.workspaces` table for immutable workspace id, stable key, display name, lifecycle, timezone, optional date range, public-intake configuration, and timestamps. Its UUID is the canonical project scope key for every later project-owned row. A server-only reader can query identity by UUID or stable key with the caller's session, while all existing product routes continue using deterministic mocks.
- Iteration 11.5 adds `project_contacts` and `workspace_contact_grants`, read-only authenticated RLS, and server-only current-user grant/workspace readers. Workspace visibility requires the Auth user to map to an active contact and an active, unrevoked, currently valid grant containing `workspace.read`. Auth identity, contact existence, and role name alone are insufficient. The existing Auth login shell may report grant status; no mock workspace or product route imports the real readers. `npm run test:grants` checks policy structure, isolation fixtures, and the route-import boundary. Real two-user database execution still requires a configured Supabase instance.
- Iteration 11.6 adds one immutable `questionnaire_submissions` table keyed by `workspaces.id`, a controlled public submission function, versioned runtime payload validation, and a server-only review reader. Anon receives no submission table privileges; the function accepts only structurally valid version-1 answers for active workspaces with `public_intake_enabled`. Authenticated reads require an effective workspace grant containing `questionnaires.review`. The existing public questionnaire and admin review routes remain mock-only and import none of these boundaries.
- Iteration 11.7 adds one project-scoped `volunteer_profiles` table, `volunteers.view` RLS, and an authenticated provenance-only conversion function. Conversion accepts only a submission UUID, requires one effective grant containing both `questionnaires.review` and `volunteers.edit`, derives workspace/profile values from a still-`submitted` version-1 source, creates an `active`/`ready` snapshot, and never changes the source submission. One source can create only one profile. Emergency-contact answers are deliberately not copied into the profile. Server-only conversion/read helpers remain unused by every route.
- Iteration 11.8 adds one workspace-scoped `task_presets` table for reusable work definitions, `tasks.view` RLS, and authenticated `tasks.edit` create/archive functions. Presets store high-level type, default needed count, future volunteer visibility, system identity, lifecycle, and bounded custom-field definitions only. Ordinary creation cannot forge system presets; the schema can represent a trusted Lunch system preset with `system_key = 'lunch'` and a required `menu` field. No preset column or command stores scheduling, Calendar placement, assignments, coverage, recurrence, or responses. Existing Tasks routes remain mock-only.
- Iteration 11.9 adds one workspace-scoped `calendar_items` table, `calendar.view` RLS, and authenticated `calendar.edit` create/archive functions. Each item references an active same-workspace task preset or carries a validated one-off title/type snapshot. The persisted schedule union supports `timed`, `date_based`, `multi_day_window`, and `milestone`; timezone is copied from and constrained to the workspace. Needed count is planned demand only, never coverage truth. Existing Calendar and Tasks routes remain mock-only and import none of these boundaries.
- The audit treats `filledCount`, assigned volunteer id arrays, coverage labels, repeat/copy labels, and deterministic colors as mock or derived fields rather than a proposed storage contract. Future assignment records must become the source of confirmation, denial, and coverage truth.
- The future scheduling contract distinguishes `timed`, `date_based`, `multi_day_window`, and `milestone`. Visible Calendar language now uses `Plan project work`, `Project context`, `No specific time`, and `Project window`; the current `allDay` flag and mock `All day` time-window values remain internal preview compatibility only.
- Coverage is planned as an explicit capability rather than something inferred from schedule kind. Timed and date-based work may require helpers, multi-day project windows are informational by default, and milestones are informational only.
- Month density now exposes more useful schedule context without changing the flat calendar direction. Current timed and compatibility date-based/multi-day items use the shared date-intersection helper, so range items appear on each relevant Month date as compact rows without adding complex horizontal spans.
- List groups the visible week by item date, places date-based/no-specific-time work before timed rows, and sorts timed rows chronologically. Each project window appears once with its full range instead of becoming misleading per-day shift rows; every native row opens the existing inspector. The flat hierarchy now makes task name primary, schedule/window secondary, type/context a quiet tertiary label, and helper coverage a stable trailing chip. Desktop uses three column-like zones with 56px minimum rows; mobile uses a name/helper line followed by full-width schedule and type lines with a 72px minimum, allowing long project windows to wrap without horizontal overflow.
- Calendar is now in a stable mock-prototype handoff state after the interaction, keyboard, focus-containment, and List hierarchy passes. The production regression run covers view switching, local navigation/reset, filtering, inspector and creation flows, mobile More coordination, trigger restoration, Day/Month/Week arrow behavior, sibling-control semantics, browser errors, and 390px overflow; future Calendar work should begin from an explicit product or persistence requirement rather than another general polish pass.
- Future Calendar review should treat true all-day events as rare: full-day work can usually remain a normal timed block spanning the visible workday. The Project context band may eventually become collapsible, exceptional, or unnecessary. Every visible `+N` must lead somewhere useful—Month/Week may open Day or a fuller List, while Day must expand or open a filtered fuller view rather than navigate back to itself.
- Future List styling may make day boundaries more obvious with subtly tinted date headers, slightly more space between groups, an optional quiet left accent rail, or a stronger date divider. Keep that treatment at the day-group level: rows should stay calm and flat, without a card wall or item-level color that competes with task, schedule, and helper hierarchy.
- Creation context copy derives from the editable draft, so it continues to say “Suggested” and stays accurate as dates, times, `No specific time`, or a `Project window` change.
- A future Timeline / Work Plan view may be useful for dense construction or multi-day work, with date/time on the x-axis and tasks, groups, or days on the y-axis. That remains a later companion view and does not replace the standard Week calendar or the scanning-focused List companion.
- Empty-slot creation now treats the clicked/tapped area as suggested calendar context rather than a fixed time window. Day hour rows and Week grid clicks seed specific editable start/end defaults, day-only clicks seed editable date/time defaults, and the flow remains preview-only.
- A clean production build/preview QA pass confirmed that `/admin/calendar` hydrates without warnings. The Week background click surfaces and event buttons render as stable siblings in the initial DOM; the earlier mismatch did not reproduce after rebuilding and restarting the preview.
- Mobile admin primary navigation now uses five bottom tabs: Overview, Tasks, emphasized Calendar, Volunteers, and More. Calendar is the center action, and secondary admin destinations live in More.
- Mobile More is grouped into Communications, Follow-up, Workspace, and Prototype / legacy sections so reminder templates, Needs Attention, Questionnaires, Project Workspaces, Legacy Schedule, Food prototype, and Security prototype remain reachable without feeling like primary modules.

## 5. Current Routes

- `/`: Project Local volunteer-first entry with integrated Belgrade context, sample identity lookup, questionnaire access, and separate Special access for project contacts.
- `/v/demo`: Remembered-volunteer schedule preview for Alex Rivera with one focused next assignment, three quieter upcoming assignments, local response controls, and other project information.
- `/v/demo/no-assignments`: Reassuring deterministic schedule state for a found volunteer who has no assignments yet, with questionnaire/lookup actions and concise project guidance.
- `/v/demo/assignments/[assignmentId]`: Reusable public detail preview for Material staging, Drywall crew, Lunch support, and Site cleanup; unknown ids show a calm recovery state.
- `/v/demo/reminder/[assignmentId]`: Deterministic non-secure reminder-link preview for the same four assignments, with local response controls and unknown-id recovery.
- `/admin`: Redirects to the default active Belgrade workspace dashboard.
- `/admin/dashboard`: Mock Overview page inside Belgrade Major Remodel 2026 with compact project context, this-week Calendar rows, calm follow-up summary, quick links to Questionnaires/Calendar/Tasks/Communications, and light role-aware guidance.
- `/admin/calendar`: Mock Calendar scheduling surface where task presets become dated/time-windowed scheduled instances with helpers, filled counts, status, notes, local filters, Day/Week/Month/List mock views, a full-surface clickable Week grid direction, a page-scrolling 24-hour Day timeline, a compact List companion, a click/tap-open item inspector for existing items, and a click/tap-open scheduled-task creator for empty grid slots. Desktop uses right-side inspector/filter/create panels; mobile uses bottom sheets. Calendar overlays are mutually exclusive, including coordination with mobile More.
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

The script captures the public Project Local landing, full schedule, no-assignment state, representative detail, and reminder link on desktop/mobile, plus key admin routes and states from `http://127.0.0.1:3000` by default. Public captures fail on console/page errors, nested controls, or overflow; audits exercise lookup, detail/unknown recovery, the full Confirm → Change → Can’t make it → Change loop, empty-state semantics, reminder exits, and unknown reminders. Mobile schedule, empty, detail, and reminder captures are full-page for complete 390px review. Set `PREVIEW_BASE_URL` to override the base URL.

The 10 public previews remain the intentional handoff matrix: landing, schedule, empty schedule, representative assignment detail, and reminder entry at desktop and mobile widths. The 10.7 audit regenerated all 10 without visual diffs and did not touch Calendar or admin screenshots.

The mobile admin screenshots use viewport-sized captures so closed off-canvas sheets do not appear in clean preview states. The clean mobile Calendar capture focuses the Calendar workspace header so date navigation and the bottom tab navigation are visible together. Focused open states cover the legacy mobile drawer, mobile More, Calendar filters, and Calendar creation.

Calendar view captures wait for the client interaction to be ready, verify that the requested Day/Week/Month/List control is pressed, and allow the shared control transition to settle before capturing.

Calendar interaction regression coverage is available through `npm run test:calendar` while an app preview is already running. The focused Playwright script checks desktop and 390px mobile keyboard activation for view switching, Week/List navigation, Day/Week/Month arrow movement and creation, Food filtering, inspector and creation focus/Escape restoration, dialog descriptions and Tab/Shift+Tab containment, Week/Month sibling semantics, List row count/nesting/mobile overflow, mobile bottom navigation/More, overlay exclusivity, browser errors, and hydration warnings. It first checks that the target is reachable, then reports scoped step timing plus URL, viewport, pressed-view, focus, and dialog context when an interaction fails.

Calendar keyboard behavior uses native buttons/links with calm focus-visible rings. View and filter/task-source toggles expose pressed state; mobile bottom navigation exposes the current page. Filters, Plan project work, Inspector, and Mobile More use one visibility-aware focus-containment helper: initial focus remains on Close, Tab/Shift+Tab wrap within the active desktop drawer or mobile sheet, Escape closes, and focus restores to the trigger. Each modal has a concise screen-reader description; the inspector description includes selected task/date/coverage context. Persistently mounted closed filters remain `inert`.

Day and Month now have a narrow arrow-key foundation without roving focus or changed Tab order. Day hour creation targets support ArrowUp/ArrowDown plus Home/End. Month date creation targets support ArrowLeft/ArrowRight, one-week ArrowUp/ArrowDown, and Home/End across the visible five- or six-week grid. Enter/Space retain existing creation defaults and modal focus restoration. Month event chips and `+N` controls remain independent siblings and are excluded from date-target arrow movement.

Week evaluation found two safe day-level background groups but no honest hour-level keyboard targets. Desktop timed-day backgrounds now support ArrowLeft/ArrowRight plus Home/End across Monday-Sunday while keeping the existing 9 AM keyboard default. Project context day backgrounds use a separate horizontal/Home/End group and retain No specific time creation. Timed events, project-window bars, and `+N` overflow remain normal native sibling controls outside arrow movement. Up/Down and a full Week ARIA grid remain intentionally deferred.

`test:calendar` and `preview:screenshots` share `scripts/preview-config.mjs`, including the default `http://127.0.0.1:3000`, validated `PREVIEW_BASE_URL` handling, and local Chrome/Edge discovery. For future CI, build and start the production preview as a separately managed job/process, set `PREVIEW_BASE_URL`, and run the existing `npm run test:calendar`; this repository does not yet add CI or server-lifecycle orchestration.

Latest generated screenshots are written to `docs/previews/latest/`. A normal run clears and recreates the folder. Set `PREVIEW_CAPTURE_FILES` to a comma-separated filename list to refresh only intentional previews without removing the rest.

## 7. Current Mock Workspaces

- Belgrade Major Remodel 2026: active workspace and current blueprint/case study.
- Bozeman sample/draft project: draft workspace with limited modules.
- Helena sample/archive project: archived workspace for reference.

## 8. Current Limitations

- Supabase Auth identity is separate from project authorization. Workspace identity reads now have grant-backed RLS, but no authenticated product route is cut over.
- The persisted schema boundaries are workspace identity, project contacts/grants, immutable questionnaire truth, volunteer profile snapshots, reusable task presets, and Calendar item snapshots. They include no seed data or browser-side table writes.
- Generated database types and live schema validation remain pending a configured linked/local Supabase database.
- Capability enforcement additionally covers `tasks.view` / `tasks.edit` and `calendar.view` / `calendar.edit`; roles and extra capability names do not authorize future product data.
- The broader 11.1 readiness plan remains proposed. Volunteer token strategy, downstream schema constraints, product capabilities, and mock-to-real cutover remain unresolved until their dedicated slices.
- Task preset persistence has no route cutover, general update command, Calendar placement, scheduling mutation, assignment behavior, or custom-field values.
- No email sending.
- No real announcement sending, recipient resolution, reminder scheduling, template-to-draft creation, unsubscribe/suppression logic, notification delivery, or delivery tracking.
- No real food persistence, food ordering, inventory tracking, helper assignment mutations, or production food workflows.
- No real security persistence, helper assignment mutations, live alerts, GPS/location tracking, camera systems, access control, incident reporting workflows, or production security workflows.
- The mock Tasks route has no real create/edit/duplicate actions. The isolated persistence boundary supports validated create and non-system archive only; general updates, duplication, drag/drop, repeat rules, copy/paste, bulk creation, and Calendar persistence remain unimplemented.
- Calendar UI and all existing Calendar routes remain mock-only. The isolated persistence boundary can create/read/archive validated Calendar item records, but no route saves them and no real placement edit, volunteer assignment, response, drag/drop, recurrence, coverage calculation, scheduled job, or email behavior is implemented.
- Calendar Day/Week/Month/List switching, filters, and date navigation are local mock UI. They do not persist state, route dates, or mutate scheduling data.
- Empty-slot scheduled-item creation is preview-only. It opens a mock creation surface but does not create, save, or mutate Calendar items or task presets.
- Calendar overlay stabilization is UI-only. It does not add persistence, Supabase, real scheduling mutations, drag/drop, or assignment workflows.
- Calendar creation detail refinement is local UI-only. Editable date/start/end fields, helper count, preset choice, one-off task fields, and notes update only the temporary creation draft; they do not create, save, persist, or mutate Calendar data.
- The first Calendar schema and mutation contract now stores local schedule fields with the workspace timezone, snapshots preset name/type, and rejects same-record overnight timed ranges. Overnight instants, recurrence, assignment response truth, audit history, general edits, and concurrent updates remain later design work.
- Scheduling semantics and a contract sketch are documented, but the current mock records have not migrated from `allDay` compatibility data to explicit schedule kinds. List is presentation-only; no Timeline view, schema, or persistence implementation exists yet.
- Calendar Day and Week timeline placement remains approximate. Week blocks now use start/end times for proportional visual height and deterministic overlap lanes, but this is still a visual-only foundation without editing, drag/drop, resizing, advanced collision rules, or production scheduling layout logic. Compact event blocks remain intentionally minimal in the grid.
- The seven-column `Project context` band remains desktop-only. Mobile Week represents the same controlled date-based/project-window validation items in its compact day groups, while Day uses the same hard-capped `Project context` strip on desktop and mobile.
- The five date-based/project-window examples are explicitly mock validation data, not production project truth. No-specific-time creation is preview-only and does not add or mutate Calendar items. Mobile exposes the `No specific time` toggle in its creation sheet but intentionally has no project-context-band launcher.
- Week retains every normal Tab stop and has no hour-by-hour Up/Down model because each timed background is one full-day column with a 9 AM keyboard default. Day/Week/Month movement remains a local focus helper, not a complete ARIA calendar-grid or roving-focus implementation. List remains a normal button list, and automated semantic QA is not a substitute for a multi-screen-reader/device audit.
- Month intentionally caps visible density at six skinny rows on screens 640px and wider and three below 640px. Additional items use a keyboard-accessible `+N` that focuses Day view; complex cross-week range spanning remains future work.
- The Calendar regression script assumes the app is already running and exercises the deterministic Belgrade mock data/accessibility labels. It has no CI configuration or managed server lifecycle and is not a cross-browser matrix, visual-diff suite, persistence test, or substitute for production scheduling tests.
- `/admin/login` is the project-contact Auth shell; `/admin/auth/callback` and the POST-only `/admin/auth/sign-out` handle session lifecycle. `/admin/onboarding` remains a mock non-workspace surface; workspace admin routes continue using the shared admin shell.
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
- The public volunteer portal is a mock foundation only. Lookup always opens Alex’s deterministic schedule; empty and reminder routes are fixed variants rather than lookup/email outcomes. Response state remains component-local and resets on navigation. Reminder paths have no token or identity verification, send no email/text, and public schedule/update content does not sync with admin Calendar or Communications. Auth, Supabase, real identity resolution, secure links, and mutations are not implemented.
- Some non-workspace routes such as `/admin/login` and `/admin/onboarding` intentionally remain outside the shared workspace admin shell.
- Intake flow screenshots are still prototype QA artifacts, not product approvals.
- Existing application-route data remains mock-only. The persisted workspace schema/read foundation is intentionally not connected to a route.
- Belgrade remains the production workflow in Sheets/App Script for now.

## 9. Next Recommended Step

11.10 Assignment + Volunteer Response Persistence, if separately approved. Keep assignment/response truth separate from Calendar item planned demand, and design the public authorization/token boundary before exposing any account-free mutation.
