# Current State

## 1. App Overview

Project Local is the full-stack successor to the Belgrade Remodel Sheets/App Script tool. Belgrade is its primary research case, but the product is a general volunteer/project coordination system rather than a CVC-only application.

The current target admin mental model is:

Admin user/account -> assigned project workspace -> one real-world project -> enabled modules inside that workspace.

The implemented prototype currently exposes several direct admin destinations. The canonical future product model is calendar-first and uses:

- Overview: role-aware project home and follow-up summary.
- Tasks: reusable templates/presets.
- Calendar: the primary scheduling surface for template-derived and custom scheduled items.
- Needs Attention: the main action inbox.
- More: Volunteers, Communications, Settings, Contacts/Roles, project setup, Help, workspace switching, and private Notes.

Templates and scheduled items are separate things. A template is reusable; a
scheduled item is one calendar-placed occurrence created from a template or as
a first-class custom item. Volunteer tasks, crew blocks, Security, food-support
work, and informational blocks share this scheduled-item concept.

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
- Treat [`PROJECT_LOCAL_PRODUCT_REQUIREMENTS.md`](./PROJECT_LOCAL_PRODUCT_REQUIREMENTS.md) as the canonical future-product baseline. It reconciles older prototype decisions without changing current route behavior.

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

Scheduled item = one Calendar occurrence created from a task template or as a first-class custom item.

Tasks do not include the calendar. Calendar does not replace Tasks. They are
separate entities that work together to create the full project schedule.

Task presets may include:

- Task id.
- Workspace/project id.
- Task name.
- Optional category/type: General, Food, or Security. Construction, cleanup, and similar work roll into General.
- Needed count.
- Visibility settings.
- Optional custom fields with name/label/type.
- Duplicate/source info.
- System preset flag.

Task presets do not include date, time, assigned volunteers, scheduled status,
or calendar placement.

Task duplication should append a number suffix to the original task name, such
as Night watch, Night watch (1), Night watch (2).

Earlier mock work explored Lunch as a predefined system preset. Canonical
planning replaces that assumption with Calendar-owned Meals: independently
enabled Breakfast/Lunch entries with typed meal details and a separate
volunteer meal-card presentation. Existing mock Food/Lunch code remains
prototype history until a reviewed implementation slice replaces it.

Calendar items may include:

- Task preset id.
- Date.
- Time/window.
- Assigned volunteers/helpers.
- Assigned count such as `0/3 assigned`, `1/3 assigned`, or `2/2 assigned`, derived from assignment rows.
- Schedule-specific notes.
- Repeat rule.
- Copy/paste/bulk creation metadata.
- Optional one-off custom task data when the user drops in a task that does not need to become a reusable preset.

The production boundary and unresolved migration rules are summarized in
[`CALENDAR_DATA_MODEL_READINESS.md`](./CALENDAR_DATA_MODEL_READINESS.md).
Current creation drafts remain local UI state; they are not Calendar item records.
Future assignment rows should be the source of volunteer response and coverage
truth rather than the current mock item counters and volunteer id arrays.
Future saved drafts are real calendar-placed private/unpublished scheduled
items, not floating ideas or an unscheduled tray.

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
- Tasks.
- Calendar.
- Needs Attention.
- More.

Desktop should keep the persistent left sidebar. Do not replace desktop
navigation with bottom navigation.

Communications absorbs Emails and Announcements. Needs Attention is a primary
action inbox. Food and Security are workflow categories, not permanent
top-level mini-apps. More contains Volunteers, Communications, Settings,
Contacts/Roles, project setup, Help, workspace switching, and private Notes.

Target mobile 5-tab bottom navigation:

- Overview / Home.
- Tasks.
- Calendar.
- Needs Attention.
- More.

Calendar should be the emphasized center tab/action on mobile. More contains
Volunteers, Communications, Settings, Contacts/Roles, project setup, Help,
workspace switching, and Notes.

Mobile can still use a drawer or More menu for secondary links, but the
long-term primary mobile navigation should be the 5-tab bottom bar.

Trusted main project contacts should share one main app experience. The app
should still distinguish project/main contacts, assistant contacts, on-site
personnel, and volunteers, but should not split Main Contact, Main Food Service
Contact, and Main Security Contact into separate main-contact sign-in experiences.

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
- Iteration 11.10 adds workspace-scoped `calendar_assignments` and one-current-row `assignment_responses`. Same-workspace foreign keys connect active timed/date-based work to active, ready volunteer profiles; a partial unique index prevents duplicate active volunteer/item pairs. New assignments start at `needs_response`. `assignments.view` gates reads, while authenticated `assignments.edit` commands create/cancel assignments and apply explicit project-contact response transitions. Cancellation preserves response truth. No route imports these boundaries.
- Iteration 11.11 adds `assignment_response_tokens` as an account-free bearer authorization foundation. Issuance generates 256-bit opaque base64url secrets inside PostgreSQL, stores only unique SHA-256 verifiers, derives workspace/volunteer scope from an active assignment, and requires `assignments.edit`. Tokens expire, can be revoked, and are scoped to the `assignment_response` purpose. Narrow anon-executable functions verify safe assignment context or submit only `confirmed`/`declined`; successful responses use `public_token` source and update `last_used_at`.
- Iteration 11.12 adds `/respond/[token]` as the first narrow public-token route shell. A server-only mapper verifies one bearer through the 11.11 public read helper, projects only safe assignment context, and submits only `confirmed` or `declined` through the distinct public-token response helper. Invalid, expired/unavailable, configuration, concurrency, success, and generic error states reveal no internal scope or token data. The route is not linked from existing surfaces and creates or sends no bearer.
- Iteration 11.13 adds a local-only valid-token QA gate at `npm run test:response-route`. It creates disposable Auth/workspace/grant/questionnaire/volunteer/task/Calendar/assignment/response/token fixtures, opens the real production-preview route, submits `confirmed`, verifies `public_token` source and `last_used_at`, and proves cleanup leaves no fixture rows. The gate also moved the bearer from a plain bound action argument into an encrypted server-action closure and normalizes an empty optional note to `null`; no RPC contract or product scope changed.
- Iteration 11.14 adds the unused server-only `issueAssignmentResponseLink` / `issueAssignmentResponseLinkWithClient` boundary. It accepts only assignment id, a policy-bounded TTL, and a validated application origin; authorized issuance still flows through the 11.11 helper and database `assignments.edit` check. The raw bearer exists only in the returned in-memory `/respond/[token]` URL, while diagnostics use `redactedUrl`. `npm run test:response-link` proves authorized local issuance, safe URL validation/redaction, hash-only storage, public verification, and zero-residue cleanup twice.
- Iteration 11.15 adds the unlinked dynamic `/admin/diagnostics/response-link` QA surface. It requires a verified project-contact session even in review mode, accepts only assignment id and TTL, derives `RESPONSE_LINK_BASE_URL` server-side, and calls a server-only mapper over the 11.14 issuer. Success renders assignment id, expiration, and `/respond/[redacted]` only; the full credential is discarded from the diagnostic response and nothing is delivered. Static checks prove no nav/mock/product surface links or imports it and no direct RPC/service-role path exists.
- Iteration 11.16 adds a cleanup/revocation guardrail without adding deletion or UI. The server-only link result now carries token id only so `issueResponseLinkDiagnostic` can revoke every diagnostic-issued token in `finally` through the existing authenticated 11.11 helper before returning redacted success. Live local QA proves revocation fails without `assignments.edit`, succeeds with it, leaves the hash-only row for audit, blocks public verification/submission, and preserves response truth.
- Iteration 11.17 defines the server-only product lifecycle policy: future usable links default to 72 hours and may not exceed 168 hours; diagnostics use a fixed one-hour TTL, remain redacted-only, and are immediately revoked. Product replacement must atomically revoke older active tokens for the same assignment/purpose, fail closed if revocation fails, and retain hash-only lifecycle metadata.
- Iteration 11.18 adds authenticated `replace_assignment_response_token` as that atomic backend command. It locks one assignment, verifies active Auth plus `assignments.edit`, revokes its older unrevoked `assignment_response` tokens, and inserts one hash-only replacement in the same transaction. Concurrent calls serialize on the assignment row and leave one usable token. The raw bearer is returned once; no route imports the replacement helpers or exposes a full URL. Product display/delivery still requires an explicit audited surface, delivery audit, recovery, and abuse controls.
- The audit treats `filledCount`, assigned volunteer id arrays, coverage labels, repeat/copy labels, and deterministic colors as mock or derived fields rather than a storage contract. Persisted assignment/current-response rows are the future source of confirmation, denial, and coverage truth once routes and coverage queries are implemented.
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
- `/admin/assignments/[assignmentId]`: Unlinked, dynamic/no-store persisted assignment-detail shell for verified project contacts. It reads only `readAssignmentDetailContext`, requires `assignments.view`, is read-only, and collapses missing, unauthorized, cross-workspace, canceled, archived, inactive, and unavailable contexts into one calm state. It now includes only an inert response-link readiness panel; it has no form, action import, copy affordance, link reveal, or delivery behavior.
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
- The persisted schema boundaries are workspace identity, project contacts/grants, immutable questionnaire truth, volunteer profile snapshots, reusable task presets, Calendar item snapshots, assignments/current responses, and hashed assignment-response bearer verifiers. They include no seed data, raw stored tokens, or browser-side table writes.
- Local migrations apply through 11.11. The Calendar custom-values validator uses a guarded count over `jsonb_object_keys`, and the 2026-07-02 live gate passes Auth/RLS, capability scoping, Calendar creation, assignments, responses, token hash-only storage, public verification/mutation, expiry, revocation, inactive-state rejection, and controlled public/contact concurrency. Response mutation RPCs lock only the target response row with `NOWAIT`; an overlapping loser receives SQLSTATE `40001` and cannot overwrite winner truth. Reviewed local public-schema types are kept in `lib/supabase/database.types.ts` and parameterize the shared browser/server/proxy clients plus isolated persistence helpers; runtime parsers remain authoritative.
- Hosted non-production validation also passed on 2026-07-02 against `project-local-staging` (`kfuujcfxoayukywvtaeh`) through migration `20260701070000`. All 16 live RLS/RPC validation groups passed; controlled concurrency produced one winner, one SQLSTATE `40001` loser, and final truth matching the winner. Disposable fixtures and validation helpers were removed. Hosted type output differed from the reviewed local types only in remote PostgREST metadata, not schema structure.
- Iteration 11.19 advances that hosted non-production staging project through `20260702000000` and validates atomic response-token replacement twice with fresh `qa-11-19-*` fixtures. Hosted checks prove real Auth plus `assignments.edit`, denied-operation rollback, old-token rejection, replacement verification/submission, hash-only storage, 169-hour rejection, assignment-scoped concurrency with one final usable token, and zero workspace/Auth residue. Hosted generated types add no schema difference beyond the reviewed replacement RPC; remote output still adds only PostgREST metadata. No product route uses hosted data.
- Iteration 11.20 defines the server-only audited reveal boundary without adding persistence or UI. The only eligible future surface is an explicit project-contact assignment-response reveal flow using POST, dynamic/no-store output, trusted server configuration, database-enforced `assignments.edit`, atomic replacement, bounded TTL, explicit action, and a successfully persisted `response_link_revealed` audit event before credential exposure. The diagnostic stays unlinked, one-hour, redacted-only, and immediately revoked; no route imports a full-link or reveal helper.
- Iteration 11.21 adds command-only credential-free audit persistence in `assignment_response_link_reveal_events` plus authenticated `record_assignment_response_link_reveal_event`. Composite token scope enforces workspace/assignment coherence; RLS and revoked table privileges block direct anon/authenticated access. The RPC derives workspace/actor, requires `assignments.edit`, accepts only a live matching response token and allowed surface/mode, and stores only allowlisted `reason_code`, `delivery_requested`, and `request_correlation_id` metadata—no free-form note, bearer, URL, verifier, credentials, or sensitive intake data. Audit persistence is now available, but reveal remains blocked because no explicit product surface atomically coordinates replacement, audit, and credential response.
- Iteration 11.22 advances non-production `project-local-staging` (`kfuujcfxoayukywvtaeh`) through `20260703000000` and validates the reveal-audit table/RPC twice with fresh `qa-11-22-*` fixtures. Hosted checks prove direct-table denial, real Auth plus `assignments.edit`, wrong/revoked/expired-token rejection, metadata allowlisting/bounds, credential-free event scope, atomic-replacement compatibility, and zero product/Auth residue. Hosted types remain structurally equal to local types; remote output adds only PostgREST metadata. No route uses hosted data or reveals/delivers a credential.
- Iteration 11.23 adds local migration `20260704000000_audited_response_link_reveal.sql` and authenticated `reveal_assignment_response_link`. One assignment-scoped transaction verifies Auth/`assignments.edit`, revokes older active tokens, creates one hash-only replacement, writes its credential-free audit event, and only then returns the bearer once. The unused server-only `createAuditedAssignmentResponseLinkReveal` boundary validates policy/origin inputs and builds the full URL in memory. Transactional-command readiness is true, but product-surface readiness remains false: no route imports the helper, reveals/copies a link, or performs delivery. Hosted validation is deferred to a dedicated later gate.
- Iteration 11.24 advances non-production `project-local-staging` (`kfuujcfxoayukywvtaeh`) through `20260704000000` and validates `reveal_assignment_response_link` twice with fresh `qa-11-24-*` fixtures. Hosted checks prove Auth/`assignments.edit`, no-mutation rollback for denied/invalid requests, atomic old-token revocation plus one hash-only replacement and one scoped credential-free audit, public verification/submission, concurrent single-active-token behavior, replacement/audit compatibility, and zero product/Auth residue. Hosted types remain structurally equal to local types; remote output adds only PostgREST metadata. No product route reveals or delivers a link.
- Iteration 11.25 defines—but does not implement—the first eligible product surface as a future persisted project-contact assignment-detail response-link action. Its contract is POST-only, dynamic/no-store, explicit-action-only, trusted-origin-only, non-prefetchable, and limited to the transactional 11.23 reveal boundary; browser input is restricted to assignment id and optional TTL while mode/audit scope remain server-derived. Current diagnostic, mock Calendar/Volunteers/Communications/Needs Attention, public, and validation surfaces remain ineligible. `RESPONSE_LINK_REVEAL_PRODUCT_SURFACE_AVAILABLE` remains false; no route or component imports a reveal/full-link helper or exposes copy UI.
- Iteration 11.26 adds local migration `20260705000000_assignment_detail_context.sql`, authenticated `read_assignment_detail_context`, and server-only `readAssignmentDetailContext` helpers. The command exists because `assignments.view` must safely obtain one active assignment's workspace, task/schedule, volunteer labels, response truth, and edit boolean without broad `calendar.view` or `volunteers.view`; it explicitly capability-checks one assignment and returns no row for missing, unauthorized, cross-workspace, canceled, archived, or inactive context. It reads no token/intake rows, exposes no capability array, and remains unused by routes. Assignment-detail context readiness is true while product-surface implementation/reveal availability remain false. Hosted validation is deferred.
- Iteration 11.27 advances non-production `project-local-staging` (`kfuujcfxoayukywvtaeh`) through `20260705000000` and validates `read_assignment_detail_context` twice with fresh `qa-11-27-*` fixtures. Hosted checks prove assignments-only access without `calendar.view`/`volunteers.view`, no-row handling for unauthenticated, under-capability, cross-workspace, missing, canceled, archived, or inactive context, exact safe fields, edit-as-boolean, false reveal readiness, route isolation, and zero product/Auth residue. Hosted types remain structurally equal to local types; remote output adds only PostgREST metadata. No token/link operation or route cutover occurred.
- Iteration 11.28 defines—but does not implement—the future assignment-detail response-link POST action. The server-only, route-unused contract limits browser input to assignment id and optional TTL; requires verified contact, persisted context first, `can_edit_assignment`, dynamic/no-store explicit POST, trusted server origin, and exactly one audited-reveal helper call; and prohibits GET/render/prefetch execution, manual replacement/audit sequencing, credential logging/persistence, and credential-bearing errors. Warning, expiration, explicit click, and post-success-only manual copy remain future UI requirements. Contract readiness is true, while action implementation, UI, product-surface implementation, and reveal availability remain false.
- Iteration 11.29 defines - but does not implement - the future persisted assignment-detail route as `/admin/assignments/[assignmentId]`. The route contract permits only the existing `readAssignmentDetailContext` boundary under `assignments.view`, requires dynamic/no-store rendering, and collapses missing, unauthorized, cross-workspace, canceled, archived, inactive, and unavailable cases into one calm non-disclosing state. No route exists or imports the context/action/reveal helpers. The action implementation, action UI, product-surface implementation, reveal availability, and product-navigation linkage flags remain false; the recommended next slice is an unlinked assignment-detail route shell with no response-link action.
- Iteration 11.30 implements that route shell without linking it from any product surface. `/admin/assignments/[assignmentId]` verifies the project-contact session, calls only `readAssignmentDetailContext`, renders only the validated assignment/workspace/task/schedule/volunteer-label/response projection, and remains read-only. The route has no mock fallback, token read, response-link action, copy control, email/reminder behavior, or service-role path. Route implementation readiness is true; product-navigation linkage, product-action implementation/UI, product-surface implementation, and reveal availability remain false.
- Iteration 11.31 stabilizes the same unlinked route through local disposable-fixture browser QA. Sign-in, authorized success, authenticated unavailable, desktop, and 390px states pass with no overflow, browser errors, unsafe fields, unrelated rows, or residue. QA shortened the visible assignment reference, separated signed-in unavailable guidance from sign-in guidance, hardened wrapping/copy, and fixed a runtime-only `Intl.DateTimeFormat` option failure in the response-updated timestamp. The route remains dynamic/no-store, persisted-context-only, read-only, and action-free.
- Iteration 11.32 adds a server-only assignment-detail product-action boundary for future response-link reveal. It accepts only assignment id and optional bounded TTL, reads `readAssignmentDetailContext` first, requires the safe `canEditAssignment` boolean, derives reveal mode/audit metadata/trusted origin server-side, and calls `createAuditedAssignmentResponseLinkReveal` as the single transactional boundary. It is not imported by `/admin/assignments/[assignmentId]` or any route, returns safe unavailable/invalid states before reveal, and preserves false product-action implementation/UI, product-surface implementation, and reveal availability flags.
- Iteration 11.33 defines the future assignment-detail response-link UI contract without rendering it. The server-only policy requires `/admin/assignments/[assignmentId]`, a deliberate click/tap, no render/GET/page-load/prefetch/hover/focus/effect reveal, assignment-specific warning copy, visible expiration before and after success, no automatic clipboard write, and post-success-only manual copy. UI implementation, copy affordance, product-surface implementation, reveal availability, and product-navigation linkage remain false; the current route still imports no product-action UI or reveal boundary.
- Iteration 11.34 adds a visible but fully inert response-link readiness panel to `/admin/assignments/[assignmentId]`. The panel explains that a future link would grant assignment response access, expire, require an explicit reviewed action, and allow manual copying only after audited success. It renders no URL, bearer, verifier, token id, audit id, form, hidden action metadata, enabled button, clipboard behavior, or server-action binding. The route remains read-only, unlinked, dynamic/no-store, persisted-context-only, and product-action UI implementation/copy affordance/product-surface/reveal/navigation flags remain false.
- Capability enforcement additionally covers `tasks.view` / `tasks.edit`, `calendar.view` / `calendar.edit`, and `assignments.view` / `assignments.edit`; roles and adjacent read capabilities do not authorize assignment data.
- The broader 11.1 readiness plan remains incremental. The first assignment-scoped token strategy and its live validation gate now pass; delivery/link transport, route integration, downstream schemas, and mock-to-real cutover remain unresolved until separate reviewed slices.
- Task preset persistence has no route cutover, general update command, Calendar placement, scheduling mutation, assignment behavior, or custom-field values.
- No email sending.
- No real announcement sending, recipient resolution, reminder scheduling, template-to-draft creation, unsubscribe/suppression logic, notification delivery, or delivery tracking.
- No real food persistence, food ordering, inventory tracking, helper assignment mutations, or production food workflows.
- No real security persistence, helper assignment mutations, live alerts, GPS/location tracking, camera systems, access control, incident reporting workflows, or production security workflows.
- The mock Tasks route has no real create/edit/duplicate actions. The isolated persistence boundary supports validated create and non-system archive only; general updates, duplication, drag/drop, repeat rules, copy/paste, bulk creation, and Calendar persistence remain unimplemented.
- Calendar UI and all existing Calendar routes remain mock-only. Isolated boundaries can persist Calendar items, assignments, and project-contact-entered response state, but no route reads or writes them and there is no placement edit, public response, drag/drop, recurrence, coverage-counter persistence, scheduled job, or email behavior.
- Calendar Day/Week/Month/List switching, filters, and date navigation are local mock UI. They do not persist state, route dates, or mutate scheduling data.
- Empty-slot scheduled-item creation is preview-only. It opens a mock creation surface but does not create, save, or mutate Calendar items or task presets.
- Calendar overlay stabilization is UI-only. It does not add persistence, Supabase, real scheduling mutations, drag/drop, or assignment workflows.
- Calendar creation detail refinement is local UI-only. Editable date/start/end fields, helper count, preset choice, one-off task fields, and notes update only the temporary creation draft; they do not create, save, persist, or mutate Calendar data.
- The Calendar boundary stores local schedule fields with the workspace timezone, snapshots preset name/type, and rejects same-record overnight timed ranges. Assignment/current-response truth now exists separately with basic concurrent-response protection; overnight instants, recurrence, response history, full audit, capacity/conflict queries, general edits, and broader idempotency remain later design work.
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
- No admin assignment mutation UI, coverage workflow, or conflict detection exists. The unlinked persisted assignment-detail shell is read-only, while `/respond/[token]` handles one persisted public-token response. Existing mock public reminder and assignment pages do not verify or consume persisted tokens.
- Conflict/coverage detail pages are mock patterns only; there is no real detection logic yet.
- Needs Attention is mock-only and does not resolve or save follow-up items yet.
- No real conflict detection yet.
- No notification logic yet.
- No volunteer confirmation / denial persistence yet.
- Overview role-aware guidance is preview/mock-only and does not enforce permissions yet.
- Current Food and Security pages are legacy/prototype module explorations and may be folded into the unified Tasks + Calendar model.
- On-site role homes are compact preview patterns, not full modules.
- No platform owner/admin home yet.
- The public volunteer portal remains a mock foundation. Lookup always opens Alex’s deterministic schedule; empty and reminder routes are fixed variants rather than lookup/email outcomes, and their response state remains component-local. `/respond/[token]` is separate from that portal and exposes only one verified assignment response. It sends no email/text and does not sync Calendar, Volunteers, Communications, or Needs Attention routes. Broad lookup, remembered-device access, delivery, and mock-route cutovers remain unimplemented.
- Some non-workspace routes such as `/admin/login` and `/admin/onboarding` intentionally remain outside the shared workspace admin shell.
- Intake flow screenshots are still prototype QA artifacts, not product approvals.
- Existing product navigation and mock Calendar/Volunteers/Communications/Needs Attention routes remain mock-only. The only narrow persisted route integrations are the isolated public response page and the unlinked read-only assignment-detail shell.
- Belgrade remains the production workflow in Sheets/App Script for now.

## 9. Next Recommended Step

Choose between a still-unlinked product-action implementation with every UI/reveal availability flag false or a separate route-entry planning review. Keep product navigation, copy UI, delivery, and mock-route cutovers disabled until explicitly reviewed.
