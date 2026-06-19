# Project History

## Volunteer Foundation

Summary:
- Added mock volunteers.
- Added volunteer directory page.
- Added volunteer profile pages.
- Added search and filter behavior.
- Added assignment counts.
- Added empty states.
- Added AdminNav volunteer link.
- Added denied status support.

Files involved:
- `lib/mockData.ts`
- `app/admin/volunteers/page.tsx`
- `app/admin/volunteers/[volunteerId]/page.tsx`
- `components/VolunteerCard.tsx`
- `components/VolunteerDirectory.tsx`
- `components/AdminNav.tsx`
- `components/StatusPill.tsx`

Verification:
- `npm run lint` passed.
- `npm run build` passed.
- `/admin/volunteers` and volunteer profile routes loaded.

## Iteration 05A - Project Workspace Admin Foundation

Summary:
- Added mock project/workspace model.
- Added `draft`, `active`, and `archived` status.
- Added enabled modules.
- Added owner, primary contacts, and assistant roles.
- Added supporting congregations.
- Added date range, timezone, and working days.
- Added last-used and last-updated signals.
- Added current mock admin project assignments.
- Added `/admin/projects` workspace landing.
- Added `/admin/projects/new` setup wizard.
- Added `/admin/settings` project settings page.
- Added project-aware AdminNav.
- Added module-aware navigation.
- Added Belgrade active workspace context.

Files involved:
- `lib/mockData.ts`
- `components/AdminNav.tsx`
- `components/StatusPill.tsx`
- `components/CreateProjectWizard.tsx`
- `components/ProjectSettingsPanel.tsx`
- `components/AdminSectionCard.tsx`
- `app/admin/page.tsx`
- `app/admin/dashboard/page.tsx`
- `app/admin/projects/page.tsx`
- `app/admin/projects/new/page.tsx`
- `app/admin/projects/[projectId]/page.tsx`
- `app/admin/settings/page.tsx`

Verification:
- `npm run lint` passed.
- `npm run build` passed.
- Built route sweep passed.
- Wizard advanced in production.
- Basic mobile check passed.

Limitations:
- Mock-only.
- No Supabase/auth/persistence.
- Wizard success does not persist after refresh.
- Some unrelated dirty/untracked files existed and were intentionally not touched.

## Iteration 05A.6 - Stabilization / Review / Commit Prep

Summary:
- Fixed project-card routing so only active Belgrade opens dashboard.
- Draft/archived workspaces open detail/setup instead of pretending to be active.
- Settings status uses shared `StatusPill`.
- Checked module-aware nav behavior.
- Route sweep passed.
- Mobile check passed.
- Produced commit include/do-not-include lists.

Verification:
- `npm run lint` passed.
- `npm run build` passed.
- `git diff --check` passed, only CRLF warnings.
- Manual route check passed.

## Iteration 05A.7 - Workspace Language Cleanup

Summary:
- Changed visible UI language from "Projects" to "Workspaces" / "Project Workspaces" where appropriate.
- Changed sidebar label to Switch Workspace.
- `/admin/projects` now presents as Project Workspaces.
- Actions now say Start New Workspace / Open Workspace where appropriate.
- Wizard language now says Create Project Workspace, Create Draft Workspace, Mock Workspace Created, and Back to Workspaces.
- Dashboard and settings use workspace-centered copy.
- Kept "Project" where referring to the real-world project itself.

Files involved:
- `components/AdminNav.tsx`
- `components/CreateProjectWizard.tsx`
- `components/ProjectSettingsPanel.tsx`
- `app/admin/dashboard/page.tsx`
- `app/admin/projects/page.tsx`
- `app/admin/projects/[projectId]/page.tsx`

Verification:
- `npm run lint` passed.
- `npm run build` passed.
- Manual route check passed with no console errors.

## Preview Screenshot Workflow

Summary:
- Added a lightweight Playwright-based screenshot capture workflow.
- Added `npm run preview:screenshots`.
- Script clears and recreates `docs/previews/latest/` before saving new previews.
- Captures desktop screenshots for key admin routes and one mobile dashboard screenshot.
- Updated current-state docs with usage notes.

Changed files:
- `package.json`
- `package-lock.json`
- `scripts/capture-previews.mjs`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/previews/latest/*.jpg` when generated

Verification:
- `npm run preview:screenshots` passed with the local app running at `http://127.0.0.1:3000`.
- Generated nine JPG screenshots in `docs/previews/latest/`.
- `npm run lint` passed.

Limitations:
- Requires the app to be running before capture.
- Requires Playwright browser binaries to be available in the local environment.

Next recommended step:
- 05B.1 Questionnaire data model/helpers.

## Iteration 05B.1 - Questionnaire Data Model + Mock Review Helpers

Summary:
- Added questionnaire submission types for status, source type, sections, availability, skills, emergency contact, other ways to help, and review notes.
- Added Belgrade mock questionnaire submissions covering needs review, in progress, paper entry, approved-linked, and needs follow-up examples.
- Added questionnaire helper functions for project/status filtering, review counts, status labels/tones, section progress, and linked volunteer lookup.
- Kept this as a data/helper pass with no new questionnaire UI.
- Updated current-state docs so the next recommended step is the public questionnaire form shell.

Changed files:
- `lib/mockData.ts`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`

Verification:
- `npm run lint` passed.
- `npm run build` passed.

Limitations:
- Mock-only.
- No Supabase/auth/persistence.
- No public questionnaire form yet.
- No admin review queue or review detail page yet.
- No real volunteer conversion logic yet.

Next recommended step:
- 05B.2 Public questionnaire form shell.

## Iteration 05B.2 - Public Questionnaire Form Shell

Summary:
- Added `/questionnaire/[projectId]` as the first project-specific public questionnaire route.
- Added a reusable client-only `PublicQuestionnaireForm` with welcome, about you, availability, skills, emergency contact, other help, and review steps.
- Added local-only mock submit confirmation with no persistence.
- Added a calm unavailable questionnaire state for unknown, draft, archived, or volunteer-disabled workspaces.
- Expanded the preview screenshot workflow to capture the Belgrade public questionnaire.
- Updated current-state and roadmap docs so 05B.3 is the next recommended step.

Changed files:
- `app/questionnaire/[projectId]/page.tsx`
- `components/PublicQuestionnaireForm.tsx`
- `scripts/capture-previews.mjs`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`
- `docs/previews/latest/*.jpg` when generated

Verification:
- `npm run lint` passed.
- `npm run build` passed.
- `npm run preview:screenshots` passed with the local app running at `http://127.0.0.1:3000`.

Limitations:
- Mock-only.
- No Supabase/auth/persistence.
- Public questionnaire answers are not saved.
- No admin review queue or review detail page yet.
- No real volunteer conversion logic yet.

Next recommended step:
- 05B.3 Admin questionnaire review queue.

## Iteration 05B.3 - Admin Questionnaire Review Queue

Summary:
- Added mock questionnaire review data across Belgrade, Bozeman, and Helena.
- Added review flags for missing emergency contact, paper questionnaire, limited availability, and needs follow-up.
- Added review queue helpers that translate storage statuses into admin-facing New, Needs Review, Incomplete, and Reviewed labels.
- Added `/admin/questionnaires` with a calm card-first review queue, search, status filter, congregation filter, counts, and helpful empty states.
- Linked queue items to existing volunteer profiles where a linked volunteer exists.
- Added Questionnaires to the admin navigation without changing the single-workspace admin shell.
- Kept the pass mock-only with no database writes, auth, email, approval logic, or volunteer login.

Changed files:
- `lib/mockData.ts`
- `components/AdminNav.tsx`
- `components/StatusPill.tsx`
- `components/QuestionnaireReviewQueue.tsx`
- `app/admin/questionnaires/page.tsx`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`

Verification:
- `npm run lint` passed.
- `npm run build` passed.
- Local route checks passed for `/admin/questionnaires`, `/admin/volunteers`, and a linked volunteer profile from the queue.

Limitations:
- Mock-only.
- No questionnaire detail review page yet.
- No approve / needs-follow-up workflow yet.
- No real persistence.
- No role-scoped review views yet.
- No conversion from approved questionnaire submission to a schedule-ready volunteer record yet.

Next recommended step:
- 05B.4 Questionnaire detail/review page.

## Iteration 05B.4 - Questionnaire Detail / Review Page

Summary:
- Added `/admin/questionnaires/[submissionId]` for focused mock questionnaire review.
- Updated queue cards so the primary action opens the questionnaire detail page.
- Added a review item lookup helper for detail routes.
- Showed volunteer name, congregation, submitted date, status, source type, review flags, review notes, and linked volunteer status where available.
- Added calm section cards for About You, Availability, Skills / Experience, Emergency Contact, Other Ways You Can Help, and Review Notes.
- Added a helpful in-app not-found state for unknown submission ids.
- Kept review actions disabled and clearly labeled as workflow placeholders.

Changed files:
- `lib/mockData.ts`
- `components/QuestionnaireReviewQueue.tsx`
- `app/admin/questionnaires/[submissionId]/page.tsx`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`

Verification:
- `npm run lint` passed.
- `npm run build` passed.
- Local route checks passed for `/admin/questionnaires`, one valid questionnaire detail route, `/admin/questionnaires/not-real`, and one linked volunteer profile from the detail page.

Limitations:
- Mock-only.
- Review actions do not mutate state.
- No real persistence.
- No role-scoped review views yet.
- No conversion from approved questionnaire submission to a schedule-ready volunteer record yet.

Next recommended step:
- 05B.5 Convert questionnaire into volunteer profile.

## Iteration 05B.5 - Questionnaire-to-Volunteer Profile Readiness

Summary:
- Added mock helper logic to derive a volunteer profile preview from a questionnaire submission.
- Added readiness states for Ready for volunteer profile, Needs follow-up first, Missing required info, and Already linked to volunteer profile.
- Derived blockers before scheduling from contact info, emergency contact, availability, skills/help, review status, and linked volunteer state.
- Added a Volunteer Profile Preview section to questionnaire detail pages.
- Clearly shows linked volunteer profiles and avoids implying duplicate profile creation.
- Kept Create volunteer profile and Mark needs follow-up as disabled workflow placeholders.

Changed files:
- `lib/mockData.ts`
- `app/admin/questionnaires/[submissionId]/page.tsx`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`

Verification:
- `npm run lint` passed.
- `npm run build` passed.
- Local route checks passed for `/admin/questionnaires`, one linked questionnaire detail page, one unlinked questionnaire detail page, one incomplete questionnaire detail page, and one linked volunteer profile.

Limitations:
- Conversion is preview/mock-only.
- No real persistence.
- No real approve / needs-follow-up workflow actions.
- No role-scoped review views yet.
- No scheduling integration yet.

Next recommended step:
- 05B.6 Questionnaire review workflow states.

## Iteration 05B.6 - Questionnaire Review Workflow States

Summary:
- Added mock workflow state helpers for new submissions, needs-review items, needs-follow-up items, missing required info, ready-for-profile submissions, and already linked/reviewed questionnaires.
- Added workflow guidance to questionnaire detail pages with a calm suggested next step.
- Reworked the detail-page review action area so actions come from the derived workflow state.
- Kept future mutation actions disabled and labeled as coming next.
- Preserved real links only for existing linked volunteer profiles.

Changed files:
- `lib/mockData.ts`
- `app/admin/questionnaires/[submissionId]/page.tsx`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`

Verification:
- `npm run lint` passed.
- `npm run build` passed.
- Local route checks passed for `/admin/questionnaires`, one ready questionnaire detail page, one needs-follow-up questionnaire detail page, one missing-info questionnaire detail page, and one already-linked questionnaire detail page.

Limitations:
- Workflow states are preview/mock-only.
- No real persistence.
- No real approve / needs-follow-up workflow actions.
- No role-scoped review views yet.
- No scheduling integration yet.

Next recommended step:
- 05B.7 Intake flow stabilization / visual QA.

## Iteration 05B.7 - Intake Flow Stabilization / Visual QA

Summary:
- Reviewed the public questionnaire, admin questionnaire queue, questionnaire detail pages, volunteer profile preview, and linked volunteer profile route.
- Cleaned up public questionnaire copy so it reads as a simple volunteer intake flow rather than account creation or mock data entry.
- Softened placeholder action labels so disabled admin workflow actions read as intentional coming-next affordances.
- Increased admin sidebar row tap targets for more comfortable mobile navigation.
- Expanded the preview screenshot workflow to include the admin questionnaire queue and a questionnaire detail review page.
- Confirmed mobile checks for the public questionnaire, queue, detail pages, and linked volunteer profile did not show horizontal overflow.

Changed files:
- `components/AdminNav.tsx`
- `components/PublicQuestionnaireForm.tsx`
- `app/admin/questionnaires/[submissionId]/page.tsx`
- `lib/mockData.ts`
- `scripts/capture-previews.mjs`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`

Verification:
- `npm run lint` passed.
- `npm run build` passed.
- Local route checks passed for `/questionnaire/belgrade-remodel-2026`, `/admin/questionnaires`, ready, needs-follow-up, missing-info, and already-linked questionnaire detail pages, and `/admin/volunteers/alex-rivera`.
- Browser visual/layout checks passed for desktop public questionnaire and mobile public questionnaire, queue, detail pages, and linked volunteer profile.
- `npm run preview:screenshots` passed and refreshed intake-related previews.

Limitations:
- Intake remains mock-only.
- No real persistence.
- No real approve / needs-follow-up workflow actions.
- No role-scoped review views yet.
- No scheduling integration yet.

Next recommended step:
- 06 Scheduling foundation.

## Iteration 06.1 - Scheduling Data Model + Mock Schedule View

Summary:
- Added mock schedule assignment types, data, and helpers for the active Belgrade workspace.
- Added status/count helpers for open, assigned, confirmed, denied, draft, and needs-attention assignments.
- Added linked volunteer resolution for assigned schedule rows.
- Created `/admin/schedule` with a compact project-week schedule view, summary strip, day grouping, expandable assignment details, and a helpful empty/module-disabled state.
- Updated `AdminNav` so Schedule opens the dedicated schedule route when the scheduling module is enabled.
- Kept all schedule actions as preview-only and avoided drag/drop, editing, confirmation, or persistence logic.

Changed files:
- `lib/mockData.ts`
- `components/StatusPill.tsx`
- `components/ScheduleWeekView.tsx`
- `components/AdminNav.tsx`
- `app/admin/schedule/page.tsx`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`

Verification:
- `npm run lint` passed.
- `npm run build` passed.
- Local route checks returned 200 for `/admin/schedule`, `/admin/dashboard`, `/admin/questionnaires`, and `/admin/volunteers`.

Limitations:
- Scheduling is mock-only.
- No assignment creation/editing workflow yet.
- No real scheduling engine.
- No conflict logic.
- No volunteer confirmation / denial persistence.
- No role-specific schedule landing pages yet.

Next recommended step:
- 06.5 Role Landing Page UX Alignment, unless a smaller schedule detail stabilization pass is needed first.

## Iteration 06.5 - Role Landing Page UX Alignment

Summary:
- Added a mock role-home data/helper layer for Primary CVC, Assistant CVC, Primary Food Contact, Primary Security Contact, and On-site Contact patterns.
- Refactored `/admin/dashboard` from a generic stacked dashboard into a Primary CVC role home for the current mock admin user.
- Added reusable dashboard sections for role header, compact metrics, next best action, week snapshot rows, coordinator focus rows, recent updates, and expandable role pattern previews.
- Kept Assistant CVC conceptually congregation-scoped without implementing real permissions.
- Represented Food, Security, and On-site homes as compact preview/mock-only patterns instead of full dashboards.
- Preserved existing admin navigation and the existing schedule, questionnaire, volunteer, and settings routes.

Changed files:
- `lib/mockData.ts`
- `app/admin/dashboard/page.tsx`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`

Verification:
- `npm run lint` passed.
- `npm run build` passed.

Limitations:
- Role homes are preview/mock-only.
- No real role permissions or scoped data enforcement yet.
- No real persistence.
- Food, Security, and On-site homes are not full modules yet.
- No platform owner/admin home yet.

Next recommended step:
- 06.6 Role-home visual QA/stabilization, unless the role home direction feels stable enough to move into 07 Needs Attention / Conflicts.

## Iteration 06.6 - Role-home Visual QA / Stabilization

Summary:
- Reviewed `/admin/dashboard` on desktop and mobile for role-home hierarchy, scroll length, tap targets, and horizontal overflow.
- Tightened the Primary CVC header sizing and subtitle treatment so the page feels more glanceable.
- Made the next best action visually clearer without turning it into a warning panel.
- Reduced repeated mock/permissions copy in the project context area.
- Kept role previews compact and labeled as preview-only.
- Improved dashboard/sidebar tap targets found during mobile QA.

Changed files:
- `app/admin/dashboard/page.tsx`
- `components/AdminNav.tsx`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`

Verification:
- `npm run lint` passed.
- `npm run build` passed.
- Local route checks returned 200 for `/admin/dashboard`, `/admin/schedule`, `/admin/questionnaires`, `/admin/volunteers`, and `/admin/settings`.
- Browser QA checked desktop and 390px mobile dashboard layouts: no horizontal overflow and no undersized dashboard interactive targets after fixes.

Limitations:
- Role homes remain preview/mock-only.
- No real role permissions or scoped data enforcement yet.
- No real persistence.
- Food, Security, and On-site homes are still compact preview patterns, not full modules.
- Preview screenshots were not regenerated in this pass.

Next recommended step:
- 07 Needs Attention / Conflicts.

## Iteration 07.1 - Needs Attention Data Model + Calm Overview

Summary:
- Added mock Needs Attention types, data, and helpers for active workspace follow-up items.
- Included calm follow-up examples across questionnaires, schedule, volunteers, food, security, and setup.
- Added helper functions for active workspace items, grouped area rows, open/important counts, top next action, and related links.
- Created `/admin/needs-attention` with compact summary counts, grouped rows, expandable details, soft priority labels, and related action links.
- Updated `AdminNav` so Needs Attention opens the dedicated route when the module is enabled.
- Connected the Primary CVC dashboard next action to the Needs Attention helper without making the dashboard louder.

Changed files:
- `lib/mockData.ts`
- `components/AdminNav.tsx`
- `components/NeedsAttentionOverview.tsx`
- `app/admin/needs-attention/page.tsx`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`

Verification:
- `npm run lint` passed.
- `npm run build` passed.
- Local route checks returned 200 for `/admin/needs-attention`, `/admin/dashboard`, `/admin/schedule`, `/admin/questionnaires`, and `/admin/volunteers`.

Limitations:
- Needs Attention is mock-only.
- No real conflict detection yet.
- No real resolution actions or persistence.
- No notification logic.
- No role-scoped follow-up views yet.
- No scheduling engine logic was added.

Next recommended step:
- 07.2 Conflict/coverage detail patterns.

## Iteration 07.2 - Conflict / Coverage Detail Patterns

Summary:
- Extended the Needs Attention mock layer with conflict/coverage detail types, records, and helpers.
- Added detail patterns for open assignments, denied assignments, possible overlapping assignments, missing contact information, food coverage/detail gaps, and security/night-watch coverage.
- Added helper functions to find Needs Attention items by id, find detail patterns by id, derive related assignment/volunteer context, and label issue types calmly.
- Added `/admin/needs-attention/[itemId]` with a calm detail page, suggested next step, affected date/time/module, related assignments, related volunteers, related links, placeholder-only actions, and a helpful not-found state.
- Updated the Needs Attention overview so primary row actions open detail pages when a detail pattern exists.
- Kept dashboard integration light by continuing to use the existing top next action helper.

Changed files:
- `lib/mockData.ts`
- `components/NeedsAttentionOverview.tsx`
- `app/admin/needs-attention/[itemId]/page.tsx`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`

Verification:
- `npm run lint` passed.
- `npm run build` passed.
- Local route checks returned 200 for `/admin/needs-attention`, one valid detail page, `/admin/needs-attention/not-real`, `/admin/dashboard`, and `/admin/schedule`.

Limitations:
- Conflict/coverage details are mock-only patterns.
- No real conflict detection.
- No real resolution actions or persistence.
- No notification logic.
- No role-scoped follow-up views yet.
- No scheduling engine logic was added.

Next recommended step:
- 07.3 Needs Attention visual QA/stabilization.

## Iteration 07.3 - Needs Attention Visual QA / Stabilization

Summary:
- Reviewed Needs Attention overview and detail pages for calm hierarchy, mobile fit, tap targets, and route stability.
- Stabilized follow-up and conflict/coverage copy so mock-only actions stay clear and non-alarming.
- Confirmed the Needs Attention routes stay quiet alongside dashboard, schedule, and settings routes.
- Kept the pass focused on QA and stabilization, with no real detection, resolution, persistence, or notification behavior added.

Changed files:
- `components/NeedsAttentionOverview.tsx`
- `app/admin/needs-attention/page.tsx`
- `app/admin/needs-attention/[itemId]/page.tsx`
- `app/admin/dashboard/page.tsx`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`

Verification:
- `npm run lint` passed.
- `npm run build` passed.
- Local route checks returned 200 for `/admin/needs-attention`, `/admin/dashboard`, `/admin/schedule`, and `/admin/settings`.
- Visual QA checked the Needs Attention overview and detail patterns for desktop and mobile layout stability.

Limitations:
- Needs Attention remains mock-only.
- No real conflict detection.
- No real resolution actions or persistence.
- No notification logic.
- No role-scoped follow-up views yet.

Next recommended step:
- 08.1 Emails and Announcements data model + admin overview.

## Iteration 08.1 - Emails and Announcements Data Model + Admin Overview

Summary:
- Added a mock communication model for announcements, reminders, updates, schedule changes, food notes, and security notes.
- Added communication helpers for active workspace items, status/type grouping, draft/ready/scheduled/mock/sent/mock counts, recent items, and recommended next action.
- Created `/admin/announcements` with compact summary counts, recent/draft rows, audience and status labels, expandable preview/recipient details, and placeholder-only actions.
- Added Announcements to the module-aware admin navigation as a dedicated route.
- Lightly connected the dashboard with one recent announcement row while keeping the Primary CVC home quiet.
- Kept all email and announcement behavior mock-only with clear copy that sending is inactive.

Changed files:
- `lib/mockData.ts`
- `components/AdminNav.tsx`
- `app/admin/announcements/page.tsx`
- `app/admin/dashboard/page.tsx`
- `app/v/demo/page.tsx`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`

Verification:
- `npm run lint` passed.
- `npm run build` passed.
- Local route checks returned 200 for `/admin/announcements`, `/admin/dashboard`, `/admin/needs-attention`, `/admin/schedule`, and `/admin/settings`.

Limitations:
- Announcements and emails are mock-only.
- No Resend, SMTP, Supabase, auth, real persistence, real sending, background jobs, cron reminders, or notification delivery.
- No real recipient resolution, scheduled reminders, templates, unsubscribe/suppression logic, or delivery tracking.

Next recommended step:
- 08.2 Announcement detail/preview page, or 08.3 Reminder templates if detail patterns are not needed yet.

## Iteration 08.2 - Announcement Detail / Preview Page

Summary:
- Added single-communication helpers for lookup, status tone, audience explanation, preview href, not-found href, and per-message suggested next action.
- Added `/admin/announcements/[communicationId]` as a focused mock detail/preview page for prepared announcements and reminders.
- Shows message type, status, audience, recipient explanation, created/updated dates, optional reminder plan, author/role, body preview, related route, and placeholder-only actions.
- Added a helpful not-found state for unknown communication ids.
- Updated `/admin/announcements` so compact overview rows open the detail/preview page instead of duplicating full detail content.
- Kept sending clearly inactive and did not add real delivery, persistence, scheduling, or recipient resolution.

Changed files:
- `lib/mockData.ts`
- `app/admin/announcements/page.tsx`
- `app/admin/announcements/[communicationId]/page.tsx`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`

Verification:
- `npm run lint` passed.
- `npm run build` passed.
- Local route checks returned 200 for `/admin/announcements`, one valid announcement detail route, `/admin/announcements/not-real`, `/admin/dashboard`, and `/admin/settings`.

Limitations:
- Announcements and reminders remain mock-only.
- No Resend, SMTP, Supabase, auth, real persistence, real sending, background jobs, cron reminders, notification delivery, unsubscribe logic, suppression logic, or delivery tracking.
- Placeholder actions do not mutate state.

Next recommended step:
- 08.3 Reminder templates.

## Iteration 08.3 - Reminder Templates

Summary:
- Added mock reminder-template types, data, labels, and helpers for active workspace/module context.
- Included starting points for schedule reminders, pending confirmations, questionnaire follow-up, food service notes, security/night-watch reminders, project updates, plan changes, and thank-you/wrap-up notes.
- Added `/admin/announcements/templates` with grouped template rows, suggested audience, suggested timing, subject suggestions, body previews, placeholders, expandable previews, and placeholder-only actions.
- Lightly linked reminder templates from the announcements overview and announcement detail pages.
- Kept templates as helpful starting points only; they do not create drafts, schedule delivery, resolve recipients, or send anything.

Changed files:
- `lib/mockData.ts`
- `app/admin/announcements/page.tsx`
- `app/admin/announcements/[communicationId]/page.tsx`
- `app/admin/announcements/templates/page.tsx`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`

Verification:
- `npm run lint` passed.
- `npm run build` passed.
- Local route checks returned 200 for `/admin/announcements`, `/admin/announcements/templates`, one valid announcement detail route, `/admin/dashboard`, and `/admin/settings`.

Limitations:
- Reminder templates are mock-only.
- No Resend, SMTP, Supabase, auth, real persistence, real sending, background jobs, cron reminders, notification delivery, unsubscribe logic, suppression logic, delivery tracking, or mutation actions.
- Template actions do not create drafts or save changes.

Next recommended step:
- 08.4 Emails/Announcements visual QA and stabilization.

## Iteration 08.4 - Admin Mobile Sidebar + Communications Visual QA

Summary:
- Added a shared `AdminShell` for the checked admin routes.
- Preserved the persistent desktop sidebar while adding a compact mobile top bar and collapsible navigation drawer.
- Drawer uses the existing admin nav/workspace context, closes on outside tap, and closes after selecting a nav link.
- Swapped the announcements overview, templates overview, announcement detail, dashboard, and settings routes onto the shared shell.
- Lightly stabilized communication surfaces after 08.1-08.3 without adding new sending, persistence, recipient resolution, scheduling, or mutation behavior.

Changed files:
- `components/AdminNav.tsx`
- `components/AdminShell.tsx`
- `app/admin/announcements/page.tsx`
- `app/admin/announcements/templates/page.tsx`
- `app/admin/announcements/[communicationId]/page.tsx`
- `app/admin/dashboard/page.tsx`
- `app/admin/settings/page.tsx`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`

Verification:
- `npm run lint` passed.
- `npm run build` passed.
- Local route checks returned 200 for `/admin/announcements`, `/admin/announcements/templates`, one valid announcement detail route, `/admin/dashboard`, and `/admin/settings`.
- Mobile browser checks around 390px confirmed the drawer opens/closes and checked routes avoid horizontal overflow.
- Desktop browser check confirmed the persistent sidebar remains visible.

Limitations:
- UI/stabilization only.
- No Supabase, auth, persistence, real email sending, recipient resolution, scheduled jobs, background jobs, mutation actions, or new product modules.
- Some admin routes outside the checked communication/dashboard/settings surfaces may still use older local sidebar markup.

Next recommended step:
- 09.1 Food module foundation.

## Iteration 08.5 - Preview Screenshot Refresh + Visual Review Coverage

Summary:
- Refreshed the preview screenshot workflow for the current admin UI after the shared admin shell and mobile drawer work.
- Added communication overview, reminder templates, announcement detail, Needs Attention, Schedule, Settings, questionnaire, and Belgrade public questionnaire coverage.
- Added mobile captures for dashboard, announcements overview, announcement templates, and the admin drawer-open state.
- Kept this as a visual review support pass with no product behavior changes.

Changed files:
- `scripts/capture-previews.mjs`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`
- `docs/previews/latest/*.jpg`

Verification:
- `npm run lint` passed.
- `npm run build` passed.
- `npm run preview:screenshots` passed.
- `docs/previews/latest/` was cleared and refreshed with the current screenshot set.

Limitations:
- Preview screenshots are QA/review artifacts, not product approvals.
- No Supabase, auth, persistence, real email sending, recipient resolution, scheduled jobs, background jobs, mutation actions, or new modules were added.

Next recommended step:
- 09.1 Food module foundation.

## Iteration 09.1 - Food Module Foundation

Summary:
- Added mock food coordination types, data, labels, tones, counts, grouping, lookup, and next-action helpers.
- Included Belgrade food support examples for lunch, water/coffee, snack support, and cleanup with contacts, congregations, helpers, headcount notes, meal notes, and related references.
- Added `/admin/food` using the shared `AdminShell` with compact summary counts, a next suggested food action, grouped food support rows, expandable meal/helper/headcount notes, and placeholder-only actions.
- Updated the Food nav item to open `/admin/food` when the module is enabled.
- Added desktop and mobile Food screenshots to the preview workflow.
- Kept Food mock-only with no ordering, inventory tracking, persistence, sending, recipient resolution, jobs, or mutations.

Changed files:
- `lib/mockData.ts`
- `components/AdminNav.tsx`
- `app/admin/food/page.tsx`
- `scripts/capture-previews.mjs`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`
- `docs/previews/latest/*.jpg`

Verification:
- `npm run lint` passed.
- `npm run build` passed.
- `npm run preview:screenshots` passed.
- Local route checks returned 200 for `/admin/food`, `/admin/dashboard`, `/admin/announcements`, `/admin/needs-attention`, and `/admin/settings`.
- Mobile browser check around 390px confirmed `/admin/food` has no horizontal overflow and the mobile drawer opens/closes.
- Desktop browser check confirmed the persistent sidebar remains visible.

Limitations:
- Food is mock-only.
- No Supabase, auth, persistence, real email sending, recipient resolution, scheduled jobs, background jobs, mutation actions, food ordering, inventory tracking, or production food workflows.
- Placeholder actions do not save changes or assign helpers.

Next recommended step:
- 09.2 Food detail/day view.

## Iteration 09.2 - Food Detail / Day View

Summary:
- Added helper support for Food detail pages, including same-day lookup, related items, detail/not-found hrefs, and single-item next action guidance.
- Added `/admin/food/[foodItemId]` using the shared `AdminShell`.
- The detail page shows date/day, service type, status, headcount, congregation/contact responsibility, helpers, meal notes, helper/headcount notes, related schedule/announcement/follow-up links, same-day food support, and placeholder-only actions.
- Updated `/admin/food` so each compact food row opens the detail/day view.
- Added a helpful not-found state for unknown food item ids.
- Added desktop and mobile Food detail screenshots to the preview workflow.
- Kept Food mock-only with no persistence, food ordering, helper assignment mutations, sending, recipient resolution, scheduled jobs, or production workflows.

Changed files:
- `lib/mockData.ts`
- `app/admin/food/page.tsx`
- `app/admin/food/[foodItemId]/page.tsx`
- `scripts/capture-previews.mjs`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`
- `docs/previews/latest/*.jpg`

Verification:
- `npm run lint` passed.
- `npm run build` passed.
- `npm run preview:screenshots` passed.
- Local route checks returned 200 for `/admin/food`, one valid Food detail route, `/admin/food/not-real`, `/admin/dashboard`, and `/admin/settings`.
- Mobile browser checks around 390px confirmed `/admin/food` and one Food detail page have no horizontal overflow and the mobile drawer opens/closes.
- Desktop browser check confirmed the persistent sidebar remains visible.

Limitations:
- Food detail/day views are mock-only.
- No Supabase, auth, persistence, real email sending, recipient resolution, scheduled jobs, background jobs, mutation actions, food ordering, inventory tracking, helper assignment mutations, or production food workflows.
- Placeholder actions do not save changes or assign helpers.

Next recommended step:
- 09.3 Food visual/icon density stabilization.

## Iteration 09.3 - Food Visual/Icon Density Stabilization

Summary:
- Added consistent lucide-supported labels to Food overview rows and Food detail cards for service type, headcount, congregation, food contact, helpers, status, related items, and same-day support.
- Reduced repeated prose in `/admin/food` rows while keeping critical food contact and helper information visible.
- Shortened noisy related-link and placeholder-action language on Food detail pages.
- Changed the shared mobile admin shell menu affordance to a compact hamburger icon button with an accessible label.
- Refreshed Food and drawer preview screenshots while keeping Food mock-only.

Changed files:
- `package.json`
- `package-lock.json`
- `components/AdminShell.tsx`
- `app/admin/food/page.tsx`
- `app/admin/food/[foodItemId]/page.tsx`
- `scripts/capture-previews.mjs`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`
- `docs/previews/latest/*.jpg`

Verification:
- `npm run lint` passed.
- `npm run build` passed.
- `npm run preview:screenshots` passed.
- Local route checks returned 200 for `/admin/food`, one valid Food detail route, `/admin/dashboard`, and `/admin/settings`.
- Mobile browser checks around 390px confirmed `/admin/food` and one Food detail page have no horizontal overflow and the drawer opens/closes from the accessible menu icon.
- Desktop browser check confirmed the persistent sidebar remains visible.

Limitations:
- UI/stabilization only.
- Food remains mock-only.
- No Supabase, auth, persistence, real email sending, recipient resolution, scheduled jobs, background jobs, mutation actions, food ordering, inventory tracking, helper assignment mutations, or production food workflows.

Next recommended step:
- 09.4 Security module foundation.

## Iteration 09.4 - Security Module Foundation

Summary:
- Added mock security coordination data for Belgrade night watch, evening site checks, morning unlock/check-in, and access notes.
- Added Security helper functions for active-workspace lookup, date/status grouping, counts, readable labels/tones, type labels, item lookup, and next suggested action.
- Added `/admin/security` using the shared `AdminShell` with compact summary counts, a next suggested security action, date-grouped rows, icon-supported metadata, quiet related links, and placeholder-only actions.
- Updated the Security nav item to open `/admin/security` when the module is enabled.
- Added desktop and mobile Security screenshots to the preview workflow.
- Kept Security mock-only with no live alerts, tracking, camera systems, access control, persistence, sending, jobs, mutations, or production workflows.

Changed files:
- `lib/mockData.ts`
- `components/AdminNav.tsx`
- `app/admin/security/page.tsx`
- `scripts/capture-previews.mjs`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`
- `docs/previews/latest/*.jpg`

Verification:
- `npm run lint` passed.
- `npm run build` passed.
- `npm run preview:screenshots` passed.
- `npm run preview` was checked and is not defined in `package.json`.
- Local route checks returned 200 for `/admin/security`, `/admin/food`, `/admin/dashboard`, `/admin/announcements`, and `/admin/settings`.
- Mobile browser check around 390px confirmed `/admin/security` has no horizontal overflow and the drawer opens/closes from the hamburger icon.
- Desktop browser check confirmed the persistent sidebar remains visible.

Limitations:
- Security is mock-only.
- No Supabase, auth, persistence, real email sending, recipient resolution, scheduled jobs, background jobs, mutation actions, live alerts, GPS/location tracking, camera systems, access control, incident reporting workflows, or production security workflows.
- Placeholder actions do not save changes or assign helpers.

Next recommended step:
- 09.5 Security detail/day view.

## Iteration 09.5 - Security Detail / Day View

Summary:
- Added helper support for Security detail pages, including same-day lookup, related items, detail/not-found hrefs, and single-item next action guidance.
- Added `/admin/security/[securityItemId]` using the shared `AdminShell`.
- The detail page shows date/day, type, status, time window, assigned security contact, assigned helpers, congregation, site/access notes, coverage/helper notes, related schedule/announcement/follow-up links, same-day security items, and placeholder-only actions.
- Updated `/admin/security` so each compact security row opens the detail/day view.
- Added a helpful not-found state for unknown security item ids.
- Added desktop and mobile Security detail screenshots to the preview workflow.
- Kept Security mock-only with no persistence, helper assignment mutations, sending, recipient resolution, scheduled jobs, live alerts, tracking, camera systems, access control, incident reporting workflows, or production workflows.

Changed files:
- `lib/mockData.ts`
- `app/admin/security/page.tsx`
- `app/admin/security/[securityItemId]/page.tsx`
- `scripts/capture-previews.mjs`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`
- `docs/previews/latest/*.jpg`

Verification:
- `npm run lint` passed.
- `npm run build` passed.
- `npm run preview:screenshots` passed.
- Local route checks returned 200 for `/admin/security`, one valid Security detail route, `/admin/security/not-real`, `/admin/food`, `/admin/dashboard`, and `/admin/settings`.
- Mobile browser checks around 390px confirmed `/admin/security` and one Security detail page have no horizontal overflow and the mobile drawer opens/closes from the hamburger icon.
- Desktop browser check confirmed the persistent sidebar remains visible.

Limitations:
- Security detail/day views are mock-only.
- No Supabase, auth, persistence, real email sending, recipient resolution, scheduled jobs, background jobs, mutation actions, live alerts, GPS/location tracking, camera systems, access control, incident reporting workflows, or production security workflows.
- Placeholder actions do not save changes or assign helpers.

Next recommended step:
- 09.6 Food/Security role-home alignment.

## Iteration 09.6 - Unified Tasks + Calendar + Navigation Realignment

Summary:
- Realigned the product model around separate Tasks and Calendar concepts.
- Defined task presets as reusable blocks with no dates, times, assigned volunteers, scheduled status, or calendar placement.
- Defined calendar items as scheduled instances of task presets with date/time, assigned helpers, filled counts, notes, repeat/copy metadata, and optional one-off task data.
- Documented Lunch as a system task preset with a predefined Menu field so it can later support a volunteer-facing lunch schedule/menu view.
- Reframed Food and Security pages as prototype/research surfaces that should fold into Tasks + Calendar instead of remaining permanent top-level modules.
- Documented the target desktop sidebar as Overview, Calendar, Tasks, Volunteers, Communications, Settings.
- Documented the target mobile 5-tab navigation as Overview/Home, Tasks, Calendar, Volunteers, More, with Calendar emphasized in the center.
- Clarified that trusted main project contacts should share one main app experience rather than separate Primary CVC, Food Contact, and Security Contact app experiences.
- Added lightweight mock type scaffolding for future task presets and calendar items.

Changed files:
- `lib/mockData.ts`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`

Verification:
- `npm run lint` passed.
- `npm run build` passed.
- No preview screenshot refresh was required because no UI files changed.

Limitations:
- Product architecture and documentation alignment only.
- No Tasks UI, Calendar UI, mobile bottom nav, data migration, production scheduling, persistence, drag/drop, calendar libraries, task duplication behavior, real mutations, Supabase, auth, or production workflows were added.
- Existing Food and Security prototype pages remain in place for research/reference until a future Tasks + Calendar pass folds them in.

Next recommended step:
- 09.7 Task presets foundation.

## Iteration 09.7 - Task Presets Foundation

Summary:
- Added mock task preset data for the active Belgrade workspace, including Lunch, Night watch, Gate attendant, Drywall crew, Cleanup help, Water / coffee station, Morning unlock / check-in, and a custom preset example.
- Kept task presets free of dates, times, assigned volunteers, scheduled status, and calendar placement.
- Added task preset helpers for active-workspace lookup, lookup by id, category grouping/filtering, counts, readable labels, duplicate-name derivation, system preset detection, Lunch detection, and required Lunch Menu field detection.
- Added `/admin/tasks` using the shared `AdminShell` with compact summary counts, grouped preset rows, icon-supported metadata, a focused Lunch system preset panel, duplicate-name guidance, and placeholder-only actions.
- Added Tasks to the admin navigation and relabeled the existing Schedule link as Calendar while keeping existing routes intact.
- Added desktop and mobile Tasks screenshots to the preview workflow.

Changed files:
- `lib/mockData.ts`
- `components/AdminNav.tsx`
- `app/admin/tasks/page.tsx`
- `scripts/capture-previews.mjs`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`
- `docs/previews/latest/*.jpg`

Verification:
- `npm run lint` passed.
- `npm run build` passed.
- `npm run preview:screenshots` passed.
- `npm run preview` was checked and is not defined in `package.json`.
- Local route checks returned 200 for `/admin/tasks`, `/admin/dashboard`, `/admin/settings`, `/admin/volunteers`, `/admin/food`, and `/admin/security`.
- Mobile browser check around 390px confirmed `/admin/tasks` has no horizontal overflow and the drawer opens/closes from the hamburger icon.
- Desktop browser check confirmed the persistent sidebar remains visible.

Limitations:
- Mock-data/UI only.
- No Calendar UI, scheduled instances, real task creation/edit/duplicate mutations, persistence, drag/drop libraries, calendar libraries, scheduled jobs, email sending, assignment workflows, Supabase, auth, or production scheduling behavior.
- Existing Food and Security prototype pages remain in place for research/reference.

Next recommended step:
- 09.8 Calendar scheduling foundation.

## Iteration 09.8 - Calendar Scheduling Foundation

Summary:
- Added mock Calendar item data for the active Belgrade workspace using 09.7 task preset ids for Lunch, Night watch, Gate attendant, Drywall crew, Cleanup help, and Water / coffee station.
- Added a one-off custom scheduled task that does not create or reference a reusable preset.
- Expanded the Calendar item model with date/time windows, assigned helpers, needed/filled counts, category, status/tone, schedule notes, Lunch menu summary, and mock repeat/copy metadata.
- Added Calendar helpers for active-workspace lookup, date/week lookup, day grouping, week range derivation, filled labels, category/status labels, preset resolution, one-off detection, Lunch detection, and summary counts.
- Added `/admin/calendar` using the shared `AdminShell` with compact counts, day/week/month toggle UI, category filter chips, desktop week grid, mobile day groups, selected-item details, Lunch menu display, and disabled placeholder scheduling actions.
- Updated the admin navigation so Calendar points to `/admin/calendar`; `/admin/schedule` remains the legacy schedule prototype route for compatibility.
- Added desktop and mobile Calendar screenshots to the preview workflow.
- Preserved the separation between reusable task presets and scheduled Calendar instances.

Changed files:
- `lib/mockData.ts`
- `components/AdminNav.tsx`
- `app/admin/calendar/page.tsx`
- `package.json`
- `scripts/capture-previews.mjs`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`
- `docs/previews/latest/*.jpg` when generated

Verification:
- `npm run lint` passed via `npm.cmd run lint`.
- `npm run build` passed via `npm.cmd run build`.
- `npm run preview:screenshots` refreshed the latest previews after the app was running locally.
- Route checks covered `/admin/calendar`, `/admin/tasks`, `/admin/schedule`, `/admin/dashboard`, `/admin/settings`, `/admin/volunteers`, `/admin/food`, and `/admin/security`.
- Mobile browser checks around 390px confirmed `/admin/calendar` has no horizontal overflow and the mobile drawer opens/closes.
- Desktop browser check confirmed the persistent sidebar remains visible.

Limitations:
- Mock-data/UI only.
- No Supabase, auth, persistence, real mutations, drag/drop, calendar libraries, calendar item creation/saving, volunteer assignment editing, production scheduling logic, scheduled jobs, email sending, or assignment workflows.
- Day/week/month switching is represented visually only; week view is the functional mock.
- Food and Security prototype pages remain in place temporarily as research/reference surfaces.

Next recommended step:
- 09.9 Calendar visual/stability pass.

## Iteration 09.9 - Calendar Visual / Stability Pass

Summary:
- Polished `/admin/calendar` without changing the Tasks + Calendar model.
- Reworked the desktop Calendar layout so the week grid uses the full content width instead of sharing space with the selected-item panel.
- Increased calendar block padding, tap target height, task-name readability, filled-count visibility, and time-window hierarchy.
- Reduced secondary detail inside grid blocks so the week is more glanceable.
- Moved the selected-item panel below the week/day surface and added category-colored accenting, stronger title hierarchy, visible category/status/filled pills, helper chips, schedule notes, Lunch menu display, and one-off source indication.
- Polished mobile day groups with slightly roomier spacing and the same clearer block hierarchy.
- Tightened Calendar copy while preserving preview-only language and the distinction between Tasks and Calendar.
- Kept `/admin/schedule` intact as the legacy schedule prototype route.

Changed files:
- `app/admin/calendar/page.tsx`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`
- `docs/previews/latest/*.jpg` when generated

Verification:
- `npm run lint` passed via `npm.cmd run lint`.
- `npm run build` passed via `npm.cmd run build`.
- `npm run preview` started successfully for local verification.
- `npm run preview:screenshots` refreshed the latest previews.
- Route checks covered `/admin/calendar`, `/admin/tasks`, `/admin/schedule`, `/admin/dashboard`, `/admin/settings`, and `/admin/volunteers`.
- Mobile browser checks around 390px confirmed `/admin/calendar` has no horizontal overflow and the mobile drawer opens/closes.
- Desktop browser check confirmed the persistent sidebar remains visible.

Limitations:
- UI/UX stabilization only.
- No Supabase, auth, persistence, real mutations, drag/drop, calendar libraries, calendar item creation/saving, volunteer assignment editing, production scheduling logic, scheduled jobs, email sending, copy/paste behavior, repeat behavior, or assignment workflows.
- Day/week/month switching remains visual/mock-only.
- Food and Security prototype pages remain in place temporarily as research/reference surfaces.

Next recommended step:
- 09.10 Calendar item inspector drawer.

## Iteration 09.10 - Calendar Item Inspector Drawer

Summary:
- Replaced the permanent selected-item section on `/admin/calendar` with an app-like Calendar item inspector.
- Calendar blocks now open the inspector when selected, while the calendar grid stays full-width and glanceable.
- Added a desktop right-side inspector panel with a soft backdrop and category-colored accent.
- Added a mobile bottom-sheet inspector with the same selected item content and close behavior.
- Preserved selected block emphasis with a subtle ring/shadow.
- Added close/tuck-away behavior plus a small reopen affordance when an item remains selected and the inspector is closed.
- Inspector content includes task name, category/status/filled pills, time window, helpers, schedule notes, Lunch menu summary, one-off/source preset information, and disabled preview-only actions.
- Kept `/admin/schedule` intact as the legacy schedule prototype route.

Changed files:
- `app/admin/calendar/page.tsx`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`
- `docs/previews/latest/*.jpg` when generated

Verification:
- `npm run lint` passed via `npm.cmd run lint`.
- `npm run build` passed via `npm.cmd run build`.
- `npm run preview` started successfully for local verification.
- `npm run preview:screenshots` refreshed the latest previews.
- Route checks covered `/admin/calendar`, `/admin/tasks`, `/admin/schedule`, `/admin/dashboard`, `/admin/settings`, and `/admin/volunteers`.
- Desktop browser checks confirmed the persistent sidebar remains visible, the calendar grid stays roomy, selecting a block opens the inspector, the inspector closes/reopens, and selected block state is visible.
- Mobile browser checks around 390px confirmed no horizontal overflow, day groups remain readable, selecting a block opens the bottom-sheet inspector, the inspector closes, and the mobile drawer still opens/closes.

Limitations:
- Mock-data/UI only.
- No Supabase, auth, persistence, real mutations, drag/drop, calendar libraries, calendar item creation/saving, volunteer assignment editing, production scheduling logic, scheduled jobs, email sending, copy/paste behavior, repeat behavior, task editing, or assignment workflows.
- Day/week/month switching remains visual/mock-only.
- Food and Security prototype pages remain in place temporarily as research/reference surfaces.

Next recommended step:
- 09.11 Mobile 5-tab navigation direction.

## Iteration 09.11 - Mobile 5-Tab Navigation Direction

Summary:
- Added the long-term mobile primary admin navigation pattern to the shared `AdminShell`.
- Mobile admin routes now show five bottom tabs: Overview, Tasks, emphasized Calendar, Volunteers, and More.
- Calendar is treated as the center action with a raised/filled treatment and visible label.
- Added a mobile More sheet for secondary destinations: Communications, Reminder templates, Settings, Workspaces, Questionnaires, Needs Attention, Legacy Schedule, Food prototype, and Security prototype.
- Kept the persistent desktop sidebar unchanged and hid the bottom navigation on desktop.
- Kept the existing mobile hamburger drawer as a temporary fallback while making bottom tabs the primary mobile navigation.
- Added mobile bottom padding in the shell so page content is not hidden behind the tab bar.
- Added preview screenshot coverage for the new More sheet.
- Preserved `/admin/schedule` as the legacy schedule prototype route and kept Food/Security prototype routes.

Changed files:
- `components/AdminShell.tsx`
- `app/admin/calendar/page.tsx`
- `scripts/capture-previews.mjs`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`
- `docs/previews/latest/*.jpg` when generated

Verification:
- `npm run lint` passed via `npm.cmd run lint`.
- `npm run build` passed via `npm.cmd run build`.
- `npm run preview` started successfully for local verification.
- `npm run preview:screenshots` refreshed the latest previews.
- Route checks covered `/admin/dashboard`, `/admin/calendar`, `/admin/tasks`, `/admin/volunteers`, `/admin/settings`, `/admin/announcements`, and `/admin/schedule`.
- Desktop browser checks confirmed the persistent sidebar remains visible, the bottom nav is hidden, `/admin/calendar` still works, and the Calendar inspector opens/closes.
- Mobile browser checks around 390px confirmed the bottom nav is visible, Overview/Tasks/Calendar/Volunteers tabs navigate, Calendar is emphasized, More opens/closes, no horizontal overflow appears, content is not hidden by the tab bar, and the Calendar inspector bottom sheet still opens/closes.

Limitations:
- UI/navigation only.
- No auth, persistence, route permissions, role enforcement, Supabase, database logic, real scheduling behavior, drag/drop, calendar libraries, production workflows, or Calendar day/month functionality.
- The mobile hamburger drawer remains temporarily as a fallback.
- Calendar Day/Week/Month controls are still visual/mock-only and need a later Calendar view-controls pass.
- The next Calendar pass should add a Filter button and drawer/sheet. Future filters should include task-name search, helper coverage states, and only three high-level task type filters: General Volunteers, Food, and Security. Construction, cleanup, gate attendant, drywall, concrete, and similar work should roll up under General Volunteers.

Next recommended step:
- 09.12 Calendar view controls + filter drawer / day-month foundation.

## Iteration 09.11.1 - Mobile Nav Coverage Stabilization

Summary:
- Stabilized the 09.11 mobile bottom navigation coverage across checked admin routes.
- Confirmed the issue was caused by older admin pages using local `PageShell` + `AdminNav` sidebar markup instead of the shared `AdminShell`.
- Moved Volunteers, Volunteer detail, legacy Schedule, Questionnaires, Questionnaire detail, Needs Attention, Needs Attention detail, Workspaces, Workspace detail, and New Workspace onto the shared `AdminShell`.
- Preserved the persistent desktop sidebar through the shared shell and kept the mobile bottom nav hidden on desktop.
- Kept the existing mobile hamburger drawer as a temporary fallback while the bottom tabs remain the primary mobile navigation.
- Added mobile Volunteers preview screenshot coverage.

Changed files:
- `app/admin/volunteers/page.tsx`
- `app/admin/volunteers/[volunteerId]/page.tsx`
- `app/admin/schedule/page.tsx`
- `app/admin/questionnaires/page.tsx`
- `app/admin/questionnaires/[submissionId]/page.tsx`
- `app/admin/needs-attention/page.tsx`
- `app/admin/needs-attention/[itemId]/page.tsx`
- `app/admin/projects/page.tsx`
- `app/admin/projects/[projectId]/page.tsx`
- `app/admin/projects/new/page.tsx`
- `scripts/capture-previews.mjs`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`
- `docs/previews/latest/*.jpg` when generated

Verification:
- `npm run lint` passed via `npm.cmd run lint`.
- `npm run build` passed via `npm.cmd run build`.
- `npm run preview` started successfully for local verification.
- `npm run preview:screenshots` refreshed the latest previews, including `mobile-volunteers.jpg`.
- Route checks covered `/admin/dashboard`, `/admin/calendar`, `/admin/tasks`, `/admin/volunteers`, `/admin/volunteers/alex-rivera`, `/admin/settings`, `/admin/announcements`, `/admin/announcements/templates`, `/admin/questionnaires`, and `/admin/schedule`.
- Desktop browser checks confirmed the persistent sidebar remains visible, the bottom nav is hidden, and the Calendar inspector still opens/closes.
- Mobile browser checks around 390px confirmed the bottom nav is visible on Dashboard, Tasks, Calendar, Volunteers, and Settings; More opens/closes; content is not hidden behind the bottom nav; and the Calendar inspector bottom sheet still opens/closes.

Limitations:
- UI shell/navigation coverage only.
- No Calendar filter drawer, Day view, Month view, real scheduling behavior, drag/drop, task/calendar mutations, auth, Supabase, persistence, route permissions, or production workflows were added.
- `/admin/login` and `/admin/onboarding` still use simpler non-workspace shells; the checked workspace admin routes use the shared admin shell.
- Calendar Day/Week/Month controls and the future Filter button/drawer remain planned for the next Calendar pass.

Next recommended step:
- 09.12 Calendar view controls + filter drawer / day-month foundation.

## Iteration 09.12 - Calendar View Controls + Filter Drawer / Day-Month Foundation

Summary:
- Moved Calendar Day/Week/Month controls out of the page hero and into the Calendar workspace header near the grid.
- Added functional local mock Day/Week/Month switching. Week remains the richest planning view, Day shows a focused timeline/list preview, and Month shows a compact count/chip grid preview.
- Replaced the top-level category chip direction with a Filter button that opens a desktop drawer or mobile bottom sheet.
- Added functional local mock filtering by task-name search, coverage/confirmation state, and high-level task type.
- Added high-level Calendar task type mapping: General Volunteers, Food, and Security. Construction, cleanup, gate attendant, drywall, concrete, room signage, water/coffee, and similar project work roll up under General Volunteers.
- Preserved existing Calendar item inspector behavior for scheduled items.
- Added subtle preview-only empty-slot affordances that point toward the future Google Calendar-inspired creation model without creating data.
- Added screenshot coverage for the Calendar filter drawer/sheet.

Changed files:
- `app/admin/calendar/page.tsx`
- `lib/mockData.ts`
- `scripts/capture-previews.mjs`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`
- `docs/previews/latest/*.jpg` when generated

Verification:
- `npm run lint` passed via `npm.cmd run lint`.
- `npm run build` passed via `npm.cmd run build`.
- `npm run preview` started successfully for local verification.
- `npm run preview:screenshots` refreshed the latest previews, including `calendar-filter-open.jpg` and `mobile-calendar-filter-open.jpg`.
- Route checks covered `/admin/calendar`, `/admin/tasks`, `/admin/dashboard`, `/admin/volunteers`, `/admin/settings`, `/admin/announcements`, and `/admin/schedule`.
- Desktop browser checks confirmed the persistent sidebar remains visible, the bottom nav is hidden, Calendar controls sit near the Calendar workspace, Day/Week/Month controls switch views, filters open/close and display active filter state, the Calendar item inspector still opens/closes/reopens, and no horizontal overflow appears.
- Mobile browser checks around 390px confirmed the bottom nav remains visible, Calendar remains the emphasized center tab, Calendar controls are usable, the filter bottom sheet opens/closes, Day/Week/Month controls switch views, the Calendar item inspector bottom sheet still opens/closes, More still opens/closes, content is not hidden behind the bottom nav, and no horizontal overflow appears.

Limitations:
- Mock-data/UI only.
- No persistence, real scheduling mutations, drag/drop, task creation, calendar item creation, volunteer assignment editing, Supabase, auth, database logic, calendar libraries, or production workflows were added.
- Day and Month are lightweight mock derived views, not full production calendar views.
- Empty-slot creation is not implemented; the current empty-slot affordance is preview-only.
- Filter state is local-only and does not save.

Next recommended step:
- 09.13 Calendar empty-slot creation mock.

## Iteration 09.13 - Calendar Empty-Slot Creation Mock

Summary:
- Added the first mock empty-slot creation interaction to `/admin/calendar`.
- Empty slot affordances now appear in desktop Week columns, mobile day groups, the Day timeline preview, and empty Month cells.
- Clicking/tapping an empty slot opens a mock "New scheduled task" creation surface.
- Desktop uses a right-side creation inspector that overlays the Calendar without squeezing the grid.
- Mobile uses a bottom sheet creation surface.
- The creation surface can choose an existing task preset, preview the task name/type/default needed count/custom fields, adjust needed count, add schedule notes, and show disabled preview-only actions.
- Added a Custom one-day task mode with custom name, high-level task type, needed count, and notes. It is explicitly represented as a one-off item that would not create a reusable task preset.
- Preserved the existing Calendar item inspector for scheduled items.
- Added single-open behavior for Calendar-owned overlays so opening creation closes filters and the item inspector, opening filters closes creation and the item inspector, and opening an item closes creation and filters.
- Added preview screenshot coverage for the creation inspector/sheet.

Changed files:
- `app/admin/calendar/page.tsx`
- `scripts/capture-previews.mjs`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`
- `docs/previews/latest/*.jpg` when generated

Verification:
- `npm run lint` passed via `npm.cmd run lint`.
- `npm run build` passed via `npm.cmd run build`.
- `npm run preview` started successfully for local verification.
- `npm run preview:screenshots` refreshed the latest previews, including `calendar-create-open.jpg` and `mobile-calendar-create-open.jpg`.
- Route checks covered `/admin/calendar`, `/admin/tasks`, `/admin/dashboard`, `/admin/volunteers`, `/admin/settings`, `/admin/announcements`, and `/admin/schedule`.
- Desktop browser checks confirmed the persistent sidebar remains visible, the bottom nav is hidden, Day/Week/Month still switch views, filters open/close, existing item inspector opens/closes/reopens, empty slot creation opens/closes, Calendar-owned overlays do not stack, and no horizontal overflow appears.
- Mobile browser checks around 390px confirmed the bottom nav remains visible, Calendar remains emphasized, Day/Week/Month still switch views, filters open/close, More opens/closes, existing item inspector opens/closes, empty slot creation opens/closes, Calendar-owned overlays do not stack, content is not hidden behind the bottom nav, and no horizontal overflow appears.

Limitations:
- Mock-data/UI only.
- No persistence, real scheduling mutations, drag/drop, task creation persistence, calendar item creation persistence, volunteer assignment editing, Supabase, auth, database logic, calendar libraries, or production workflows were added.
- Creation controls do not create or save Calendar items.
- Helper assignment remains placeholder-only.

Next recommended step:
- 09.14 Calendar Overlay + Mobile Interaction Stabilization.

## Iteration 09.14 - Calendar Overlay + Mobile Interaction Stabilization

Summary:
- Stabilized Calendar overlay behavior without changing routes or adding real scheduling mutations.
- Calendar now uses a single active surface model: none, filter, more, create, or inspect.
- Opening Filter, empty-slot Create, existing-item Inspect, or mobile More now closes competing Calendar/admin surfaces.
- Calendar actions close the mobile More sheet or drawer before opening their own panel.
- Escape closes the active Calendar surface.
- Closing a surface resets selected item and create draft state.
- Removed the old floating "Open inspector" affordance to avoid stacked mobile controls.
- Preserved empty-slot creation preview, existing item inspection, filters, and mobile More access.

Changed files:
- `app/admin/calendar/page.tsx`
- `components/AdminShell.tsx`

Verification:
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.
- `npm run lint` was blocked by local PowerShell script policy for `npm.ps1`, so `npm.cmd` was used instead.

Limitations:
- Mock-data/UI only.
- No persistence, Supabase, real scheduling mutations, drag/drop, calendar item creation persistence, task preset mutations, volunteer assignment workflow, or production scheduling behavior was added.

Next recommended step:
- 09.15 Overview realignment.

## Iteration 09.15 - Overview Realignment

Summary:
- Realigned `/admin/dashboard` into a calmer Overview page for the main project contact.
- Replaced the dense role-home/prototype dashboard with compact project context, a this-week Calendar snapshot, calm follow-up rows, quick actions, and a lighter role-aware note.
- Used existing mock Calendar helpers for upcoming scheduled items, including task name, day/time, type/status, and filled count.
- Used existing Needs Attention helpers for open follow-ups and linked rows to their review/detail routes.
- Added quick links to Review questionnaires, Open Calendar, Open Tasks, and Prepare communication.
- Kept Food and Security as quiet task/calendar context rather than separate main dashboard sections.
- Preserved the mock-only boundary with no persistence, Supabase, real scheduling, assignment workflow, or mutation logic.

Changed files:
- `app/admin/dashboard/page.tsx`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`

Verification:
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.

Limitations:
- Mock-data/UI only.
- No Supabase, auth, persistence, real scheduling mutations, questionnaire mutations, communication sending, assignment workflow, permissions, or role enforcement was added.
- Role-aware behavior is represented as light guidance only.

Next recommended step:
- 09.16 Admin navigation simplification + Communications alignment.

## Iteration 09.16 - Admin Navigation Simplification + Communications Alignment

Summary:
- Simplified the desktop admin sidebar to the six primary workspace destinations: Overview, Calendar, Tasks, Volunteers, Communications, and Settings.
- Added calm icons to the desktop primary nav and removed Questionnaires, Needs Attention, Food, Security, Emails, Conflicts, and other prototype/legacy concepts from the primary sidebar list.
- Kept mobile bottom tabs as Overview, Tasks, Calendar, Volunteers, and More.
- Reworked mobile More into grouped sections for Communications, Follow-up, Workspace, and Prototype / legacy.
- Kept Reminder templates, Needs Attention, Questionnaires, Project Workspaces, Legacy Schedule, Food prototype, and Security prototype reachable from mobile More.
- Adjusted the communications overview copy so `/admin/announcements` presents as Communications while keeping the existing route intact.
- Preserved all existing legacy/prototype routes and avoided route migrations.

Changed files:
- `components/AdminNav.tsx`
- `components/AdminShell.tsx`
- `app/admin/announcements/page.tsx`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`

Verification:
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.

Limitations:
- Navigation/copy alignment only.
- No route renames, redirects, Supabase, auth, persistence, real messaging, scheduling, assignment workflow, or mutation logic was added.
- Announcement detail and template routes still live under `/admin/announcements`.

Next recommended step:
- 09.17 Communications detail/template copy alignment.

## Iteration 09.17 - Communications Detail/Template Copy Alignment

Summary:
- Aligned `/admin/announcements/[communicationId]` visible copy so detail pages read as Communications previews rather than Announcements as a module.
- Updated not-found, back-link, return-button, header, body-preview, and future-action copy on communication detail pages.
- Aligned `/admin/announcements/templates` as Reminder templates inside Communications.
- Updated template back-link, page intro, inactive-action copy, and empty state language.
- Preserved message type, status, audience, recipient explanation, reminder plan, related links, and placeholder-only future actions.
- Kept existing routes unchanged.

Changed files:
- `app/admin/announcements/[communicationId]/page.tsx`
- `app/admin/announcements/templates/page.tsx`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`

Verification:
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.

Limitations:
- Copy alignment only.
- No route renames, redirects, real sending, persistence, Supabase, auth, recipient resolution, scheduled jobs, templates-to-drafts, or mutation logic was added.

Next recommended step:
- 09.18 Overview/navigation/Communications visual QA + preview refresh.

## Iteration 09.18 - Overview/Navigation/Communications Visual QA + Preview Refresh

Summary:
- Performed focused visual QA on the realigned Overview, simplified desktop navigation, grouped mobile More sheet, and Communications overview/detail/template surfaces.
- Confirmed desktop navigation shows only Overview, Calendar, Tasks, Volunteers, Communications, and Settings.
- Confirmed mobile bottom tabs remain Overview, Tasks, Calendar, Volunteers, and More.
- Confirmed mobile More grouping is readable for Communications, Follow-up, Workspace, and Prototype / legacy.
- Fixed mobile More full-page screenshot leakage by rendering the sheet only while open.
- Increased mobile More sheet usable height so all grouped links are easier to see at the checked mobile size.
- Renamed preview screenshot outputs from Announcements language to Communications language.
- Refreshed the latest preview screenshots.

Changed files:
- `components/AdminShell.tsx`
- `scripts/capture-previews.mjs`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`
- `docs/previews/latest/*.jpg`

Verification:
- Browser QA checked `/admin/dashboard`, `/admin/announcements`, `/admin/announcements/comm-belgrade-ppe-ready`, `/admin/announcements/templates`, `/admin/announcements/not-real`, and mobile More at desktop and mobile widths.
- Checked mobile pages for horizontal overflow at 390px.
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.
- `npm.cmd run preview:screenshots` passed with `PREVIEW_BASE_URL=http://127.0.0.1:3022`.

Limitations:
- Visual QA and screenshot workflow refresh only.
- No route renames, redirects, real sending, persistence, Supabase, auth, scheduling, assignment workflow, or mutation logic was added.

Next recommended step:
- 09.19 Calendar minimal grid visual direction pass.

## Iteration 09.19 - Calendar Minimal Grid Visual Direction Pass

Summary:
- Moved `/admin/calendar` toward a quieter minimal time-grid direction without changing routes or adding real scheduling behavior.
- Made desktop Week view more calendar-like with subtle horizontal time separators, lighter scheduled-item blocks, and quieter empty-space affordances.
- Replaced repeated visible empty-slot "Add task" treatment with calmer "Plan" cues that stay discoverable through hover, focus, and mobile-visible tap targets.
- Updated empty-slot creation context so clicks/taps suggest a day or nearby time without committing to a rigid predefined time window.
- Lightened the desktop "New scheduled task" creation panel and added preview start/end-window fields that remain read-only until real scheduling exists.
- Preserved existing item inspector, filters, Day/Week/Month switching, mobile bottom sheets, and mutually exclusive Calendar overlay behavior.

Changed files:
- `app/admin/calendar/page.tsx`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`

Verification:
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.
- Browser QA checked `/admin/calendar` at desktop and 390px mobile widths, including Week/Day/Month switching, empty-slot creation, existing-item inspection, filters, and mobile horizontal overflow.

Limitations:
- Visual direction and preview-only interaction refinement only.
- No persistence, Supabase, auth, real scheduling mutations, drag/drop, resizing, assignment workflow, calendar library, or production scheduling logic was added.

Next recommended step:
- 09.20 Calendar creation detail refinement.

## Iteration 09.20 - Calendar Creation Detail Refinement

Summary:
- Refined the mock `/admin/calendar` creation surface into a clearer local scheduling draft flow.
- Added local-only editable Date, Start, and End fields to the creation draft.
- Updated timed empty-slot clicks to seed specific one-hour start/end defaults instead of vague nearby-time language.
- Updated day-only empty-slot clicks to seed editable date/time defaults without forcing a fixed appointment.
- Further quieted the Calendar grid by removing repeated visible "Plan" text from empty spaces and using subtle hover/focus affordances.
- Reorganized the creation panel around Calendar context, Task, Date and time, and Helpers and notes.
- Kept task preset selection, one-off custom task mode, helper count, notes, and preview-only disabled actions.

Changed files:
- `app/admin/calendar/page.tsx`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`

Verification:
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.
- Browser QA checked `/admin/calendar` at desktop and 390px mobile widths, including empty-slot creation, editable date/time fields, one-off task mode, existing-item inspection, filters, view switching, and mobile horizontal overflow.

Limitations:
- Local UI refinement only.
- Date/start/end fields, helper count, task choice, one-off fields, and notes update only the temporary creation draft.
- No persistence, Supabase, auth, real scheduling mutations, drag/drop, resizing, assignment workflow, calendar library, or production scheduling logic was added.

Next recommended step:
- 09.21 Calendar Day View 24-Hour Timeline Foundation.

## Iteration 09.21 - Calendar Day View 24-Hour Timeline Foundation

Summary:
- Reframed 09.21 from creation/mobile QA into the Calendar Day View 24-Hour Timeline Foundation pass.
- Replaced the compact Day preview list with a scrollable 24-hour vertical timeline from 12 AM through 11 PM.
- Added subtle hour separators and quiet empty-hour click targets without repeated visible "Plan" or "Add task" buttons.
- Placed existing mock scheduled Calendar items into approximate starting-hour rows using their mock start times.
- Kept task name, time/window, filled count, task type, and status readable inside scheduled item blocks.
- Empty hour rows open the existing preview-only creation flow with specific editable one-hour start/end suggestions.
- Included desktop and mobile QA coverage for creation, filters, inspectors, Day/Week/Month switching, and horizontal overflow.

Changed files:
- `app/admin/calendar/page.tsx`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`

Verification:
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.
- Browser QA checked `/admin/calendar` at desktop and 390px mobile widths, including the 24-hour Day timeline, empty-hour creation, specific editable start/end suggestions, existing-item inspection, filters, Week/Month switching, and mobile horizontal overflow.

Limitations:
- Day timeline placement is approximate.
- Items are placed in their starting-hour rows, but proportional block heights, overlap handling, resizing, drag/drop, persistence, assignment workflow, calendar libraries, and production scheduling logic are not implemented.
- No Supabase, auth, real saves, or Calendar mutations were added.

Next recommended step:
- 09.22 Calendar Simplicity + Full-Surface Grid Interaction Pass.

## Iteration 09.22 - Calendar Simplicity + Full-Surface Grid Interaction Pass

Summary:
- Simplified `/admin/calendar` toward a calmer Google Calendar-inspired scheduling surface without changing routes or adding real scheduling behavior.
- Removed the internal Day timeline scroll container so the page handles vertical scrolling naturally.
- Made Day timeline hour rows thinner while preserving the 24-hour structure and subtle separators.
- Made Day hour rows and Week day columns broad clickable surfaces instead of relying on small empty-slot affordance areas.
- Week grid clicks now seed a specific editable one-hour draft based on the click position in the day column.
- Simplified compact Calendar event blocks to task name plus filled count only.
- Kept richer item type, status, helper, notes, Lunch, and coverage details available in the item inspector.

Changed files:
- `app/admin/calendar/page.tsx`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`

Verification:
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.
- Browser QA checked `/admin/calendar` at desktop and 390px mobile widths, including page-scrolling Day view, full-surface Week creation, specific editable start/end defaults, compact event display, existing-item inspection, filters, Week/Day/Month switching, and mobile horizontal overflow.

Limitations:
- UI simplification only.
- Week click-position time seeding is approximate.
- No persistence, Supabase, auth, real scheduling mutations, drag/drop, resizing, assignment workflow, calendar library, proportional event layout, overlap handling, or production scheduling logic was added.

Next recommended step:
- 09.23 Calendar Hydration Fix + Visual QA + Screenshot Refresh.

## Iteration 09.23 - Calendar Hydration Fix + Visual QA + Screenshot Refresh

Summary:
- Rebuilt and restarted the production preview to investigate the reported `/admin/calendar` hydration mismatch.
- Confirmed that the mismatch did not reproduce after the clean build: Week background click surfaces and event buttons render as stable sibling elements in the initial DOM, with no hydration or console warnings.
- Rechecked Week click-position time seeding, the page-scrolling 24-hour Day view, Month switching, minimal event blocks, empty-space creation, item inspection, filters, creation panels, and mobile layout behavior.
- Expanded the preview workflow with focused desktop Day, desktop Month, and mobile Day Calendar captures.
- Changed mobile previews to viewport-sized captures so closed off-canvas sheets do not appear in clean screenshot states.
- Refreshed the tracked preview screenshots from the clean production preview.

Changed files:
- `scripts/capture-previews.mjs`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`
- `docs/previews/latest/*`

Verification:
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.
- `npm.cmd run preview:screenshots` passed against the clean local production preview.
- Browser QA checked `/admin/calendar` on desktop and at 390px mobile width with no hydration warnings or horizontal overflow.

Limitations:
- No source-level hydration change was needed because the reported mismatch did not reproduce after rebuilding and restarting the preview.
- Week time-position seeding and scheduled-item placement remain approximate.
- No persistence, Supabase, auth, real scheduling mutations, drag/drop, resizing, assignment workflow, calendar library, overlap handling, or production scheduling logic was added.

Next recommended step:
- 09.24 Calendar Week time-positioning foundation.

## Iteration 09.24 - Calendar Week Time-Positioning Foundation

Summary:
- Changed the desktop Week view from top-clustered event rows to a fixed 24-hour time canvas.
- Positioned scheduled blocks by their parsed start hour and minute so morning, lunch, afternoon, and evening work appear in the expected part of each day.
- Added small minimum visual spacing for nearby starts so the current 7:30 AM and 8:00 AM mock items remain readable without adding duration-based sizing or full overlap logic.
- Preserved broad day-column click surfaces, specific one-hour creation defaults, separate event buttons, minimal block content, and richer inspector details.

Changed files:
- `app/admin/calendar/page.tsx`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`

Verification:
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.
- Browser QA checked `/admin/calendar` on desktop and at 390px mobile width with no hydration warnings or horizontal overflow.

Limitations:
- Week placement is a visual foundation based on start time only.
- Nearby starts receive minimum visual spacing, but event duration height, true overlap handling, drag/drop, resizing, persistence, assignment workflow, and production scheduling logic remain future work.
- No Supabase, auth, real saves, Calendar mutations, or calendar library was added.

Next recommended step:
- 09.25 Calendar event duration and overlap foundation.

## Documentation Maintenance Rules

- Every future Codex iteration should update `PROJECT_HISTORY.md` with a concise entry.
- Include changed files, summary, verification, limitations, and next recommended step.
- Do not paste entire source files.
- Prefer architectural notes over code dumps.
