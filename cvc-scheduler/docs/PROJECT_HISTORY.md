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

## Iteration 09.25 - Calendar Event Duration and Overlap Foundation

Summary:
- Added approximate Week event heights derived from existing mock start/end times, with a calm minimum height for short items.
- Added deterministic overlap clusters and side-by-side lanes so simultaneous work remains readable while non-overlapping items keep the normal day-column width.
- Added a narrow Week time gutter with subtle two-hour labels aligned to the existing 24-hour canvas and hourly separators.
- Preserved broad empty-column creation, click-position one-hour defaults, separate event buttons, minimal task-name/count blocks, and richer inspector details.

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
- Duration heights and overlap lanes are visual approximations over mock data.
- No drag/drop, resizing, persistence, assignment workflow, conflict resolution, scheduling engine, advanced collision behavior, or calendar library was added.
- No Supabase, auth, real saves, or Calendar mutations were added.

Next recommended step:
- 09.26 Calendar date navigation foundation.

## Iteration 09.26 - Calendar Date Navigation Foundation

Summary:
- Added compact previous, next, and Project week reset controls to the Calendar workspace header.
- Added a local Jan 13, 2026 anchor that moves by day, week, or month according to the active Calendar view.
- Updated visible counts, summaries, Week groups, mobile Week groups, Day dates, and Month dates to derive from the selected period.
- Preserved clickable empty Day/Week/Month grids so navigated periods without mock items still seed creation with visible date/time context.
- Expanded Month grids to six rows only when a navigated month requires them.

Changed files:
- `app/admin/calendar/page.tsx`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`

Verification:
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.
- Browser QA checked date navigation, reset, empty-period creation, overlays, and `/admin/calendar` on desktop and at 390px mobile width with no hydration warnings or horizontal overflow.

Limitations:
- Date navigation is local UI state and resets on refresh.
- Mock scheduled items still exist only in the fixed project dataset; navigation does not query, save, route, or mutate Calendar data.
- No persistence, Supabase, auth, drag/drop, resizing, assignment workflow, scheduling engine, or calendar library was added.

Next recommended step:
- 09.27 Calendar date navigation visual QA and polish.

## Iteration 09.27 — Calendar Date Navigation Visual QA and Polish

Summary:
- Rebalanced the Calendar workspace header so the period, previous/next controls, Project week reset, view switcher, and Filters remain calm and predictable across desktop and mobile.
- Kept previous/next and Project week at comfortable 44px touch targets, tightened title/summary spacing, and placed Day/Week/Month beside Filters on one compact mobile row.
- Added pressed-state semantics to the Day/Week/Month switcher without changing its local date-context behavior.
- Confirmed Week time-gutter/header alignment, simple task-name/count event blocks, usable empty calendar space, bottom-navigation clearance, and the existing mutually exclusive filter/create/inspect surfaces.
- Focused the clean mobile Calendar preview on the workspace header and refreshed only the default desktop Week and mobile Calendar captures.

Changed files:
- `app/admin/calendar/page.tsx`
- `scripts/capture-previews.mjs`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`
- `docs/previews/latest/calendar.jpg`
- `docs/previews/latest/mobile-calendar.jpg`

Verification:
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed after allowing the configured Google font fetch.
- `npm.cmd run preview` started the production server successfully.
- `npm.cmd run preview:screenshots` passed against the clean production preview.
- A production-browser regression checked previous/next movement in Week, Day, and Month, Project week reset, view-context preservation, and exact empty Week/Day/Month creation seeds.
- Production preview captures checked Week, Day, and Month on desktop plus Calendar Week/Day at 390px; the workflow found no Calendar console/page errors or 390px horizontal overflow.

Limitations:
- Date navigation remains local UI state and resets on refresh.
- No persistence, Supabase, auth, URL date routing, drag/drop, resizing, assignment workflow, scheduling engine, calendar library, or Calendar mutations were added.

Next recommended step:
- 09.28 Calendar keyboard and screen-reader interaction QA.

## Iteration 09.28 — Calendar Month View Cleanup + Full-Cell Creation Pass

Summary:
- Replaced the empty-day-only Month creation affordance with a full-cell background button on every visible date.
- Kept event chips as separate foreground sibling buttons so selecting an event opens the inspector without nesting interactive controls or blocking the rest of the day.
- Limited Month cells to one visible event chip plus a quiet `+N` remainder, preserving broad creation space on dates with multiple scheduled items.
- Kept desktop chips to task name plus volunteer fraction/count; narrow mobile chips prioritize the truncated task name when both values do not fit cleanly.
- Preserved the existing 09:00-10:00 Month creation default, local date navigation, view switching, filters, mutually exclusive overlays, mobile More coordination, and preview-only behavior.

Changed files:
- `app/admin/calendar/page.tsx`
- `scripts/capture-previews.mjs`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`
- `docs/previews/latest/calendar-month.jpg`
- `docs/previews/latest/mobile-calendar-month.jpg`

Verification:
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.
- `npm.cmd run preview` started a clean production server successfully.
- `npm.cmd run preview:screenshots` passed against the production preview.
- Production-browser regression checks clicked the background of a multi-event Month date on desktop and at 390px, confirmed the exact visible date and 09:00-10:00 creation seed, and independently opened/closed the foreground event inspector.
- Desktop and mobile Month captures confirmed clean chip truncation, usable day-cell space, bottom-navigation clearance, no horizontal overflow, and no Calendar console/page or hydration errors.

Limitations:
- Month intentionally exposes one event chip per date; additional items are summarized with `+N` and remain available through Day and Week views.
- Month creation remains preview-only and local; it does not save or mutate scheduling data.
- No persistence, Supabase, auth, URL date routing, drag/drop, resizing, assignment workflow, scheduling engine, calendar library, or Calendar mutations were added.

Next recommended step:
- 09.29 Calendar keyboard and screen-reader interaction QA.

## Iteration 09.29 — Calendar Visual Reset Toward Native Calendar Feel

Summary:
- Tightened the Calendar page title and removed the dashboard-style summary-card strip so the active date controls and calendar grid appear immediately.
- Replaced the glass-card Calendar toolbar with a flat divider-based control area and removed redundant Day timeline and Month preview headings.
- Flattened Week, Day, Month, and mobile Week surfaces into direct calendar workspaces with subtle slate grid lines, quiet white backgrounds, and no nested glass shadows.
- Replaced compact event side rails, outlines, and card shadows with restrained filled category bars. Event content remains limited to task name and volunteer fraction/count where space permits.
- Preserved Month full-cell creation, one-chip-plus-`+N` density, Week time positioning and overlap lanes, Day page scrolling, filters, date navigation, inspector/creation surfaces, overlay exclusivity, and mobile More coordination.
- Added a short post-view-switch settle to the screenshot workflow so Day and Month captures do not freeze the control transition mid-frame.

Changed files:
- `app/admin/calendar/page.tsx`
- `scripts/capture-previews.mjs`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`
- `docs/previews/latest/calendar.jpg`
- `docs/previews/latest/calendar-day.jpg`
- `docs/previews/latest/calendar-month.jpg`
- `docs/previews/latest/calendar-filter-open.jpg`
- `docs/previews/latest/calendar-create-open.jpg`
- `docs/previews/latest/mobile-calendar.jpg`
- `docs/previews/latest/mobile-calendar-day.jpg`
- `docs/previews/latest/mobile-calendar-month.jpg`
- `docs/previews/latest/mobile-calendar-filter-open.jpg`
- `docs/previews/latest/mobile-calendar-create-open.jpg`

Verification:
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.
- `npm.cmd run preview` started the production preview successfully.
- `npm.cmd run preview:screenshots` passed against the production preview.
- Production-browser regression checks confirmed Week navigation/reset, Day empty-hour creation and event inspection, Month multi-event full-cell creation and event inspection on desktop and at 390px, and exact visible date/time creation seeds.
- Desktop and mobile Week/Day/Month captures confirmed the flatter grid hierarchy, filled event treatment, bottom-navigation clearance, no horizontal overflow, and no Calendar console/page or hydration errors.

Limitations:
- This is a visual and interaction-stability reset over mock data; it does not add real calendar persistence or scheduling behavior.
- Week duration/overlap layout and Day placement remain approximate visual foundations.
- Mobile Week remains a compact day-group view rather than a seven-column time grid.
- No persistence, Supabase, auth, URL date routing, drag/drop, resizing, assignment workflow, scheduling engine, calendar library, or Calendar mutations were added.

Next recommended step:
- 09.30 Calendar keyboard and screen-reader interaction QA.

## Iteration 09.30 — Calendar Week Density + All-Day Band Foundation

Summary:
- Kept the familiar Week model with days across the x-axis and time down the y-axis.
- Added a compact desktop all-day/multi-day band between the day headers and timed grid without moving or reclassifying current timed mock work.
- Added data-safe band recognition for future explicit all-day items, `All day` time windows, and untimed items, plus optional `endDate` spans across multiple day columns.
- Added deterministic two-lane band layout and quiet per-day `+N` overflow that focuses the existing local Day view for that date.
- Standardized compact events around smaller count-first typography while preserving task name plus volunteer fraction/count as the only grid metadata.
- Replaced broad category-based event colors with a deterministic stable-id/task-id hash over a restrained palette. No random or per-render color values are used.
- Documented a future Timeline / Work Plan companion view for construction-style dense and multi-day work without changing or replacing Week.

Changed files:
- `app/admin/calendar/page.tsx`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`
- `docs/previews/latest/calendar.jpg`
- `docs/previews/latest/calendar-day.jpg`
- `docs/previews/latest/calendar-month.jpg`
- `docs/previews/latest/calendar-filter-open.jpg`
- `docs/previews/latest/calendar-create-open.jpg`
- `docs/previews/latest/mobile-calendar.jpg`
- `docs/previews/latest/mobile-calendar-day.jpg`
- `docs/previews/latest/mobile-calendar-month.jpg`
- `docs/previews/latest/mobile-calendar-filter-open.jpg`
- `docs/previews/latest/mobile-calendar-create-open.jpg`

Verification:
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.
- `npm.cmd run preview` started the production preview successfully.
- `npm.cmd run preview:screenshots` passed against the production preview.
- Production-browser regression checks confirmed Week event inspection and navigation/reset, Day empty-hour creation and event inspection, Month multi-event full-cell creation and event inspection on desktop and at 390px, and exact visible date/time creation seeds.
- Desktop Week capture confirmed the quiet empty all-day band, retained time gutter/timed positioning/overlap lanes, deterministic task-level colors, and count-first event typography.
- Mobile Week and Month captures confirmed compact tap targets, bottom-navigation clearance, no horizontal overflow, and no Calendar console/page or hydration errors.

Limitations:
- Current mock Calendar items all have start/end times, so the all-day band is intentionally empty and its multi-day/overflow rendering remains a prepared foundation.
- The all-day band is desktop-only; mobile Week continues to use compact day groups.
- Timed overlap lanes remain approximate and are not capped into a separate dense-event disclosure flow.
- The future Timeline / Work Plan view is documented only and was not implemented.
- No persistence, Supabase, auth, URL date routing, drag/drop, resizing, assignment workflow, scheduling engine, calendar library, or Calendar mutations were added.

Next recommended step:
- 09.31 Calendar keyboard and screen-reader interaction QA.

## Iteration 09.31 — Calendar Keyboard and Screen-Reader Interaction QA

Summary:
- Added consistent visible-but-calm focus treatment across Calendar navigation, view switching, filters, creation targets, event controls, Month overflow, and panel form controls.
- Added descriptive accessible names to Week, Day, and Month creation targets; timed event buttons now announce task, volunteer coverage, date, and time while preserving minimal visible event content.
- Prepared the all-day/multi-day band as a named region, with date-span-aware item names and clear Day-view behavior for future `+N` overflow controls.
- Kept Week, Day, and Month background targets and foreground event/overflow buttons as sibling layers, with no nested interactive controls.
- Added dialog semantics and initial focus for Filters, Create, and Inspect; Escape and close actions now restore focus to the launching control when it remains available.
- Kept closed filter UI inert and hidden from assistive technology, preserved overlay exclusivity and mobile More coordination, and retained the 09.29/09.30 visual direction.
- Updated the two Calendar creation selectors in the screenshot workflow to match the improved accessible names; capture scope and runtime remain unchanged.

Changed files:
- `app/admin/calendar/page.tsx`
- `scripts/capture-previews.mjs`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`

Verification:
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.
- `npm.cmd run preview` started the production preview successfully.
- `npm.cmd run preview:screenshots` passed against the production preview with the updated Calendar selectors.
- Production-browser keyboard checks covered filter/create/inspect initial focus and Escape focus restoration, Week keyboard creation at 09:00-10:00, Day/Week/Month pressed states and accessible names, Month keyboard-accessible `+N`, and absence of nested Calendar interactive controls.
- Production-browser mobile QA at 390px confirmed creation-sheet focus and restoration, one visible Calendar surface, no horizontal overflow, and no console, page, or hydration errors.

Limitations:
- Calendar keyboard traversal uses normal document tab order; specialized arrow-key grid navigation and a full modal focus trap were intentionally not added in this small, safe pass.
- Current mock Calendar data remains entirely timed, so live all-day/multi-day item and overflow semantics are prepared but not exercised by normal UI data.
- No persistence, Supabase, auth, URL date routing, drag/drop, resizing, assignment workflow, scheduling engine, calendar library, or Calendar mutations were added.

Next recommended step:
- 09.32 Calendar all-day/multi-day mock-data validation and overflow QA.

## Iteration 09.32 — Calendar All-Day/Multi-Day Mock-Data Validation and Overflow QA

Summary:
- Added five clearly mock-only Belgrade Calendar validation items: Site support week, Preconstruction prep, Concrete prep window, Materials receiving, and Safety coverage.
- Extended the shared Calendar item type with optional `allDay` and `endDate` fields while keeping the examples as one-off Calendar instances rather than reusable task presets.
- Corrected all-day span placement to calculate columns from the actual Monday week start instead of the selected Tuesday anchor.
- Validated two visible all-day lanes with a six-day span, a three-day span, a single-day item, Wednesday `+2` overflow, and Thursday/Friday `+1` overflow.
- Added a compact Day-view all-day section so overflow focus reveals every all-day or spanning item active on that date without placing untimed work misleadingly at 9 AM.
- Updated inspector schedule presentation to use `All day · date` or `Multi-day · start through end`; compact bars remain count-first and visually limited to task name plus volunteer coverage.
- Preserved deterministic item colors, timed Week placement and overlap lanes, broad timed creation, Month full-cell creation, overlay exclusivity, Escape behavior, and trigger-focus restoration.
- Refreshed the ten existing desktop/mobile Calendar previews; the screenshot script and capture scope did not change.

Changed files:
- `lib/mockData.ts`
- `app/admin/calendar/page.tsx`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`
- `docs/previews/latest/calendar.jpg`
- `docs/previews/latest/calendar-day.jpg`
- `docs/previews/latest/calendar-month.jpg`
- `docs/previews/latest/calendar-filter-open.jpg`
- `docs/previews/latest/calendar-create-open.jpg`
- `docs/previews/latest/mobile-calendar.jpg`
- `docs/previews/latest/mobile-calendar-day.jpg`
- `docs/previews/latest/mobile-calendar-month.jpg`
- `docs/previews/latest/mobile-calendar-filter-open.jpg`
- `docs/previews/latest/mobile-calendar-create-open.jpg`

Verification:
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.
- `npm.cmd run preview` started the production preview successfully.
- `npm.cmd run preview:screenshots` passed against the production preview.
- Production-browser QA verified exact Monday-Saturday and Tuesday-Thursday grid spans, two visible lanes, Wednesday `+2`, Thursday/Friday `+1`, keyboard overflow activation into Day view, and all four items active on the focused Wednesday.
- Inspector QA verified useful all-day/multi-day accessible names, clear multi-day schedule text, initial focus, Escape dismissal, and trigger-focus restoration.
- Regression checks covered timed Week events and 09:00 keyboard creation, Day hour targets, Month full-cell creation and `+N`, filters, and non-stacked mobile surfaces.
- Visual review confirmed a compact desktop band, readable Day all-day section, sensible mobile day-group representation, no 390px horizontal overflow, and no console, page, or hydration errors.

Limitations:
- The five all-day/multi-day entries are prototype validation data and do not represent confirmed production schedules.
- Mobile Week continues to use compact day groups rather than the desktop seven-column all-day band.
- Empty all-day-band space does not start an all-day draft; all-day creation and editable date spans remain future work.
- No persistence, Supabase, auth, URL date routing, drag/drop, resizing, assignment workflow, scheduling engine, calendar library, or Calendar mutations were added.

Next recommended step:
- 09.33 Calendar all-day creation interaction foundation.

## Iteration 09.33 — Calendar All-Day Creation Interaction Foundation

Summary:
- Added one quiet background creation target per desktop Week all-day day column without adding visible repeated CTA text.
- Kept all-day background targets, existing event bars, and `+N` overflow as stable sibling layers; foreground controls remain independently clickable and keyboard accessible.
- Extended the local creation slot/draft model with an all-day flag and editable end date while keeping all behavior preview-only.
- Added a compact All day checkbox in the existing Date and time section. All-day band clicks default it on; timed Week, Day, and Month creation defaults it off.
- All-day drafts hide start/end time fields, use date-range context language, and clamp End date so it cannot precede Date. Switching All day off restores the clicked timed suggestion or 09:00-10:00 defaults.
- Preserved existing all-day/multi-day inspection, overflow-to-Day behavior, timed event placement, deterministic colors, filters, overlay exclusivity, Escape dismissal, and trigger-focus restoration.
- Refreshed the existing desktop and mobile Calendar creation-open previews; the screenshot script and capture selectors did not change.

Changed files:
- `app/admin/calendar/page.tsx`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`
- `docs/previews/latest/calendar-create-open.jpg`
- `docs/previews/latest/mobile-calendar-create-open.jpg`

Verification:
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.
- `npm.cmd run preview` started the production preview successfully.
- `npm.cmd run preview:screenshots` passed against the production preview.
- Production-browser QA opened the Sunday all-day target, confirmed All day was checked with Date/End date and no time inputs, toggled back to 09:00-10:00, and confirmed initial close-button focus plus Escape restoration to the exact day launcher.
- Timed regression checks confirmed a pointer-selected Week one-hour draft and an exact 09:00-10:00 Day-hour draft with All day off.
- Existing Site support inspection still showed its multi-day schedule; Wednesday `+2` still focused Day view with all four spanning items; Filters still received initial focus.
- Mobile QA at 390px confirmed existing all-day items in Day view, the creation-sheet All day toggle, hidden time fields when enabled, no horizontal overflow, and no console, page, or hydration errors.

Limitations:
- All-day and multi-day creation remains a local draft preview; no Calendar item is saved or rendered from the draft.
- Mobile intentionally has no new all-day creation launcher; its existing timed/day creation paths can toggle All day inside the sheet.
- End-date handling only prevents an end before the start date; production-grade validation, persistence, and scheduling rules remain future work.
- No Supabase, auth, URL date routing, drag/drop, resizing, assignment workflow, scheduling engine, calendar library, or Calendar mutations were added.

Next recommended step:
- 09.34 Calendar draft validation and creation-surface polish.

## Iteration 09.34 — Calendar Draft Validation and Creation-Surface Polish

Summary:
- Reworked timed creation layout so Date uses a full desktop row and Start/End share a readable second row inside the existing drawer width; mobile remains a single-column bottom sheet.
- Added local timed-range validation for missing times and End values that are not later than Start.
- Preserved all-day date clamping, added accessible date-range validation safeguards, and kept time fields hidden while All day is active.
- Clamped Needed to a local 1-99 range and added a concise range cue beside the preset default.
- Added a required-name state for Custom one-day mode with calm field styling, `aria-invalid`, and uniquely generated description ids across desktop/mobile panel copies.
- Replaced launch-slot-dependent context sentences with live Suggested date/time or date-range copy that stays accurate as the draft changes.
- Simplified the fixed disabled actions to Schedule, Save draft, and Assign helpers with one polite status line explaining preview-only unavailability or the first field issue.
- Refreshed the existing desktop and mobile Calendar creation-open previews; screenshot selectors and capture scope did not change.

Changed files:
- `app/admin/calendar/page.tsx`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`
- `docs/previews/latest/calendar-create-open.jpg`
- `docs/previews/latest/mobile-calendar-create-open.jpg`

Verification:
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.
- `npm.cmd run preview` started the production preview successfully.
- `npm.cmd run preview:screenshots` passed against the production preview.
- Production-browser QA confirmed the full-width Date row, paired Start/End row, no desktop clipping, accurate live Suggested copy, all-day field switching, initial focus, Escape restoration, Filters focus, and existing all-day inspection.
- Draft regression checks confirmed invalid timed ranges and their accessible descriptions, validation clearing, 1-99 Needed clamping, required custom-name messaging, disabled-action reasons, all-day End-date clamping, and unique ids across the two responsive panel copies.
- Mobile QA at 390px confirmed readable creation fields, one visible Calendar sheet, no horizontal overflow, and preserved all-day item representation.
- No console, page, or hydration errors were reported.

Limitations:
- Validation is local UI state only and does not save, render, or mutate Calendar items.
- Timed drafts currently require End later than Start on the same date; overnight timed ranges are not modeled.
- Disabled actions remain intentional preview placeholders; helper assignment and persistence are not connected.
- No Supabase, auth, URL date routing, drag/drop, resizing, assignment workflow, scheduling engine, calendar library, or Calendar mutations were added.

Next recommended step:
- 09.35 Calendar production data-model readiness review.

## Iteration 09.35 — Calendar Production Data-Model Readiness Review

Summary:
- Audited the mock Calendar item, task preset, local creation draft, assignment, coverage, copy/repeat, custom-field, and deterministic-color boundaries without adding persistence or changing the visible Calendar.
- Added a focused readiness note describing recommended future entities, production-shaped fields, mock-only conveniences, schedule invariants, the draft-to-item boundary, and migration risks.
- Renamed the local creation slot/draft types to make their preview-only scope explicit and documented `CalendarItem` as a partially persistence-shaped mock scheduled instance.
- Added deterministic timing classification plus date/range intersection helpers, then reused them across Calendar selection paths so all-day and multi-day inclusion rules have one safer boundary.
- Clarified that coverage filters are derived preview vocabulary and that denied coverage cannot be authoritative until assignment-response records exist.

Changed files:
- `lib/mockData.ts`
- `app/admin/calendar/page.tsx`
- `docs/CALENDAR_DATA_MODEL_READINESS.md`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`

Verification:
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.
- Production-browser QA confirmed Week, Day, and Month rendering; timed and all-day creation; existing-item inspection; Filters; and 390px mobile layout without horizontal overflow.
- No console, page, hydration, or browser errors were reported.
- Screenshot workflow was not changed because the review produced no visible UI or selector changes.

Limitations:
- This is a readiness review, not a database schema, persistence contract, or migration implementation.
- Current assignment ids/counts, coverage status, repeat/copy labels, and menu data remain denormalized mock conveniences.
- Timezone, overnight scheduling, recurrence, preset versioning/snapshots, assignment response truth, audit history, concurrency, authorization, and idempotency remain unresolved before real mutations.
- No Supabase, auth, database calls, real create/update/delete behavior, drag/drop, resizing, assignments, reminders, routes, or Calendar redesign were added.

Next recommended step:
- 09.36 Calendar Scheduling Semantics + Persistence Contract Planning.

## Iteration 09.36 — Calendar Scheduling Semantics + Persistence Contract Planning

Summary:
- Defined the recommended production scheduling vocabulary as `timed`, `date_based`, `multi_day_window`, and `milestone`, with standalone notes intentionally excluded from the first scheduling-kind contract.
- Recommended moving future visible UI away from All day toward Timed, Date-based/No specific time, Project window/Multi-day, and Milestone language while retaining the current All day wording as unchanged preview compatibility behavior.
- Documented how each kind should appear in Day, Week, Month, mobile Week groups, a future List view, and a future Timeline / Work Plan view.
- Added a discriminated persistence-contract sketch covering workspace scope, preset-or-one-off task source, scheduling values, timezone, coverage mode, needed count, notes, custom values, lifecycle, structured copy/recurrence/bulk source metadata, and record-level audit/version needs.
- Reaffirmed assignment rows as the source of filled, confirmed, denied, waiting, open-spot, and volunteer-response truth rather than Calendar item counters.
- Documented the next Month direction: more compact rows when space allows, true-overflow `+N` focusing Day, and preserved full-cell creation with sibling foreground controls.
- Renamed the current timing helper/type as preview-specific and added a future schedule-kind vocabulary type without changing mock records or visible Calendar behavior.

Changed files:
- `lib/mockData.ts`
- `app/admin/calendar/page.tsx`
- `docs/CALENDAR_DATA_MODEL_READINESS.md`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`

Verification:
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.
- Production-browser QA confirmed Week, Day, and Month rendering; timed and current all-day/date-based creation; existing-item inspection; Filters; and 390px mobile layout without horizontal overflow.
- No console, page, hydration, or browser errors were reported.
- Screenshot workflow was not changed because no visible UI or selector behavior changed.

Limitations:
- The persistence contract is a planning sketch, not a schema, migration, API, or mutation implementation.
- Current mock data and visible UI still use the compatibility `allDay` flag/wording; no record migration or UI terminology change was made.
- Coverage-mode enforcement, recurrence editing, preset snapshot rules, overnight work, timezone conversion, List/Timeline views, and denser Month rendering remain future work.
- No Supabase, auth, database calls, real create/update/delete, assignments, confirmations, communications, drag/drop, resizing, route, or scheduling-engine behavior was added.

Next recommended step:
- 09.37 Calendar Month Density + Overflow Behavior.

## Iteration 09.37 — Calendar Month Density + Overflow Behavior

Summary:
- Increased Month density from one visible item to a fixed responsive limit: three compact rows on larger screens and two rows below 640px.
- Kept `+N` only for true breakpoint-specific overflow and preserved its keyboard-accessible Day-view focus behavior with descriptive date/count labels.
- Reused the shared date-intersection helper so current compatibility all-day/multi-day validation items appear as compact rows on each relevant Month date without adding complex horizontal spans.
- Preserved deterministic event colors, minimal task-name/coverage content, the flat calendar grid, and richer item details in the inspector.
- Preserved the full-cell background creation target and kept event/overflow controls as separate foreground siblings with no nested interactive controls.
- Refreshed the existing desktop and mobile Month previews; screenshot selectors and capture scope did not change.

Changed files:
- `app/admin/calendar/page.tsx`
- `docs/CALENDAR_DATA_MODEL_READINESS.md`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`
- `docs/previews/latest/calendar-month.jpg`
- `docs/previews/latest/mobile-calendar-month.jpg`

Verification:
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.
- `npm.cmd run preview:screenshots` passed against the production preview.
- Desktop production-browser QA confirmed three visible rows, true overflow counts, `+N` focus to Day, item inspection, and populated-cell creation at the existing 09:00-10:00 default.
- Week, Day, Filters, creation, Escape dismissal, and focus behavior remained functional.
- Mobile QA at 390px confirmed two visible rows, breakpoint-correct overflow counts, populated-cell creation, one active sheet at a time, bottom-navigation clearance, and no horizontal overflow.
- No nested buttons, console errors, page errors, or hydration warnings were found.

Limitations:
- Month uses compact per-date rows rather than horizontal multi-day spans; range items repeat on intersecting dates for now.
- The row limits are fixed responsive rules rather than measurements of dynamic cell height.
- Current All day compatibility terminology and mock scheduling semantics were not redesigned.
- No persistence, Supabase, auth, mutations, drag/drop, resizing, assignment workflow, List view, Timeline / Work Plan, schema, or scheduling engine was added.

Next recommended step:
- 09.38 Calendar Month Density Visual QA + Terminology Review.

## Iteration 09.38 — Calendar Month Density + Day View Date-Based Cleanup

Summary:
- Reduced Month event rows to 16px with tighter padding, 10px typography, deterministic item colors, and the existing minimal task-name plus optional volunteer-count content.
- Increased the fixed responsive Month limits to six visible rows on screens 640px and wider and three below 640px; `+N` continues to represent only true breakpoint overflow.
- Preserved the full-cell Month creation layer behind event-chip and overflow sibling controls, including the existing 09:00-10:00 populated-date default, item inspection, keyboard labels, and Day-focus overflow behavior.
- Removed the large Day all-day/date-based section and replaced it with a hard-capped 32px `Project context` strip showing one intersecting compatibility item plus `+N` without assigning fake times.
- Preserved the desktop Week all-day/date-based band, its two visible lanes, per-day overflow, background all-day creation targets, and unchanged timed grid.
- Refreshed only the intentionally changed desktop/mobile Day and Month previews.

Changed files:
- `app/admin/calendar/page.tsx`
- `docs/CALENDAR_DATA_MODEL_READINESS.md`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`
- `docs/previews/latest/calendar-day.jpg`
- `docs/previews/latest/calendar-month.jpg`
- `docs/previews/latest/mobile-calendar-day.jpg`
- `docs/previews/latest/mobile-calendar-month.jpg`

Verification:
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.
- `npm.cmd run preview:screenshots` passed against the restarted production preview.
- Desktop production-browser QA confirmed six readable Month rows, compact Day project context, Month item inspection, Week's unchanged two-lane band with `+2`/`+1`/`+1` overflow, seven timed creation surfaces, filters, creation, and inspector behavior.
- Mobile QA at 390px confirmed three visible Month rows, true `+1`/`+3` overflow, populated-date creation at 09:00-10:00, item inspection, overflow focus to the correct Day, a roughly 32px project-context strip, and no horizontal overflow.
- Escape restored focus to the launching Month background, event chip, Day hour, and Filters control; Mobile More displayed with no Calendar dialog stacked; no nested interactive controls were found.
- No console, page, or hydration errors were reported.

Limitations:
- Month uses fixed six/three row limits rather than dynamically measuring each date cell, and multi-day windows still repeat in intersecting cells instead of spanning horizontally.
- Day's `+N` project-context summary is intentionally informational rather than an expander; Week, Month, and the inspector provide fuller date-based context.
- The mock `allDay` compatibility field and remaining Week/creation/inspector terminology are not migrated to scheduling kinds in this pass.
- No persistence, Supabase, auth, mutations, drag/drop, resizing, assignment workflow, List view, Timeline / Work Plan, schema, or scheduling engine was added.

Next recommended step:
- 09.39 Calendar terminology cleanup or Calendar List View Foundation, depending on how the compact Day context feels in continued use.

## Iteration 09.39 — Calendar Terminology Cleanup

Summary:
- Replaced visible Calendar `All day` language with CVC-specific scheduling terms without changing the mock timing model: `Project context` for Week/Day aggregate surfaces, `No specific time` for one-date untimed work, and `Project window` for date ranges.
- Renamed the creation surface and its launch labels from `New scheduled task` to `Plan project work`, and updated nearby draft, notes, helper, empty-state, and filter-summary copy to speak about project work or calendar items.
- Kept `Project week` as the reset-control label because it still accurately describes the current anchor behavior.
- Updated Week-band, Day-context, Month, creation, overflow, and inspector accessible names so screen-reader terminology matches the visible product language.
- Preserved the internal `allDay` compatibility flag, mock `All day` time-window values, timing classification, data intersections, Week band layout, Day strip, Month density, and all interaction behavior.
- Updated screenshot selectors for the new creation labels, added a short filter/create transition settle so open-sheet captures are reliable, and refreshed the ten affected desktop/mobile Calendar previews.

Changed files:
- `app/admin/calendar/page.tsx`
- `lib/mockData.ts`
- `scripts/capture-previews.mjs`
- `docs/CALENDAR_DATA_MODEL_READINESS.md`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`
- `docs/previews/latest/calendar.jpg`
- `docs/previews/latest/calendar-day.jpg`
- `docs/previews/latest/calendar-month.jpg`
- `docs/previews/latest/calendar-filter-open.jpg`
- `docs/previews/latest/calendar-create-open.jpg`
- `docs/previews/latest/mobile-calendar.jpg`
- `docs/previews/latest/mobile-calendar-day.jpg`
- `docs/previews/latest/mobile-calendar-month.jpg`
- `docs/previews/latest/mobile-calendar-filter-open.jpg`
- `docs/previews/latest/mobile-calendar-create-open.jpg`

Verification:
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.
- `npm.cmd run preview:screenshots` passed against the restarted production preview with the updated creation selectors.
- Production-browser QA confirmed the Week `Project context` band, two visible lanes, `+2`/`+1`/`+1` overflow, no-specific-time creation, 09:00-10:00 timed defaults, correct Day overflow focus, and `Project window` inspector copy.
- Desktop Month retained six 16px rows on Jan 14; mobile at 390px retained three rows plus true `+3` overflow with no horizontal overflow.
- Planner, inspector, and filter dialogs received initial focus; close/Escape restored the launching control; Mobile More displayed with no Calendar dialog stacked.
- No nested interactive controls, console errors, page errors, or hydration warnings were found.

Limitations:
- This is a terminology cleanup only. Internal `allDay` compatibility fields and mock time-window strings remain until a future schedule-kind migration.
- `No specific time` still maps to the current compatibility checkbox rather than an authoritative `date_based` schedule kind.
- `Project window` is inferred from the existing optional end date for presentation only; milestones are not introduced or inferred.
- No persistence, Supabase, auth, mutations, drag/drop, resizing, route changes, List view, Timeline / Work Plan, schema, or scheduling engine was added.

Next recommended step:
- 09.40 Calendar List View Foundation.

## Iteration 09.40 — Calendar List View Foundation

Summary:
- Added List as the fourth pressed-state Calendar view alongside Day, Week, and Month without changing their layouts or interaction behavior.
- Added a compact week-based List surface with date-group headers and flat inspector-opening rows for task name, schedule wording, high-level type, and helper fraction.
- Kept no-specific-time/date-based work near the top of each date group and sorted timed work chronologically.
- Represented each project window once with its full 09.39 range wording instead of duplicating it into per-day shift rows.
- Reused the existing filtered mock item set, item inspector, active-surface exclusivity, previous/next Week navigation, and Project week reset.
- Added calm List empty-period copy, clear row accessible names, and a responsive 390px layout without horizontal overflow.
- Added desktop/mobile List preview captures and optional `PREVIEW_CAPTURE_FILES` workflow filtering so intentional screenshots can be refreshed without clearing unrelated previews.

Changed files:
- `app/admin/calendar/page.tsx`
- `scripts/capture-previews.mjs`
- `docs/CALENDAR_DATA_MODEL_READINESS.md`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`
- `docs/previews/latest/calendar-list.jpg`
- `docs/previews/latest/mobile-calendar-list.jpg`

Verification:
- `npm run lint` passed.
- `npm run build` passed.
- `npx tsc --noEmit` and `node --check scripts/capture-previews.mjs` passed.
- Desktop browser QA confirmed 15 rows across six date groups, no-specific-time/project-window rows before chronological timed work, one row per project window, Food filtering, Week navigation/reset, and inspector opening.
- Existing Day, Week, and Month checks confirmed 24 Day time rows, seven Week columns plus project context, and 35 Month cells.
- Inspector and filter surfaces received initial focus, closed with Escape, and restored trigger focus; mobile More and Filters remained mutually exclusive.
- Mobile QA at 390px confirmed 57px-wide view controls, thumb-friendly rows, no nested interactive controls, and no document or List horizontal overflow.
- No console errors, page errors, or hydration warnings were reported.

Limitations:
- List is local mock presentation only. It does not add persistence, URL state, routes, mutations, drag/drop, resizing, or production scheduling logic.
- List follows Week-period navigation and groups a project window once at its start date, or at the visible Week boundary when it began earlier; this is not a production query contract.
- The current helper fractions and schedule-kind classification still come from denormalized mock compatibility fields.
- List has no empty-row creation affordance; creation remains on the existing Day, Week, and Month grid surfaces.

Next recommended step:
- 09.41 Calendar List View Visual QA + Density Polish.

## Iteration 09.41 — Calendar List View Visual QA + Density Polish

Summary:
- Flattened the List surface by removing its enclosing rounded-card treatment and retaining only quiet top/bottom framing and row dividers.
- Reduced date headers to 36px and desktop rows to 48px so dense weeks scan as a list rather than a card stack.
- Replaced desktop type pills with plain compact type text while preserving name, schedule, type, and helper columns.
- Tightened mobile secondary typography and spacing to consistent 68px rows while keeping the task name prominent, all metadata readable, and the full row thumb-friendly.
- Preserved the 09.40 grouping, sorting, one-row project-window rule, accessible names, filters, Week navigation, inspector behavior, and overlay exclusivity.
- Hardened Calendar screenshot capture so it verifies the requested view is pressed and waits for the shared control transition before capture.
- Refreshed only the desktop and mobile List previews through the targeted production screenshot workflow.

Changed files:
- `app/admin/calendar/page.tsx`
- `scripts/capture-previews.mjs`
- `docs/CALENDAR_DATA_MODEL_READINESS.md`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`
- `docs/previews/latest/calendar-list.jpg`
- `docs/previews/latest/mobile-calendar-list.jpg`

Verification:
- `npm run lint` passed.
- `npm run build` passed.
- Targeted production `npm run preview:screenshots` passed for `calendar-list.jpg` and `mobile-calendar-list.jpg`.
- Desktop QA confirmed 36px headers, 48px rows, no outer radius, plain type labels, 15 unchanged rows, and no document/List overflow.
- Mobile QA at 390px confirmed consistent 68px rows, four complete rows plus the next date header in the initial viewport, 57px-wide view controls, and no document/List overflow.
- Food filtering returned the expected four rows; next/Project week navigation, Day/Week/Month/List switching, inspector opening, Escape/focus restoration, and mobile More exclusivity remained intact.
- No nested interactive controls, console errors, page errors, or hydration warnings were reported in the application QA browser.

Limitations:
- This is visual density polish only; List remains local mock presentation with Week-period navigation and no List-based creation affordance.
- Secondary mobile metadata uses compact 11px text to keep three readable lines within the 68px row; continued device testing may justify a small typography adjustment.
- The production data/query, timezone, assignment truth, and schedule-kind limitations documented in 09.40 remain unchanged.
- No persistence, Supabase, mutations, URL state, routes, drag/drop, resizing, Timeline view, schema, or production scheduling logic was added.

Next recommended step:
- 09.42 Calendar Interaction Regression Test Foundation.

## Iteration 09.42 — Calendar Interaction Regression Test Foundation

Summary:
- Added a focused Playwright Calendar regression script without introducing a new test runner or framework migration.
- Added desktop coverage for clean loading, Day/Week/Month/List pressed states, List week navigation/reset, Food filtering, inspector focus/Escape restoration, Day creation defaults, populated Month-cell creation plus event inspection, List inspector reuse, nested controls, overflow, and browser errors.
- Added 390px mobile coverage for the emphasized bottom Calendar tab, four fitting view controls, Mobile More and filter exclusivity, inspector and creation sheets, focus/Escape restoration, overflow, nested surfaces, and browser errors.
- Reused the screenshot workflow's browser executable and `PREVIEW_BASE_URL` conventions; the script assumes the app is already running.
- Added named step output and scoped failure messages so broken Calendar behavior is identifiable without a large test framework.
- Made no Calendar product or selector changes, so screenshot previews were not refreshed.

Changed files:
- `package.json`
- `scripts/calendar-regression.mjs`
- `docs/CALENDAR_DATA_MODEL_READINESS.md`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`

Verification:
- `npm run lint` passed.
- `npm run build` passed.
- `npm run test:calendar` passed against the production preview at `http://localhost:3002`.
- All 16 named desktop/mobile regression steps passed, including exact 13:00-14:00 Day and 09:00-10:00 Month creation defaults.
- The harness reported no console errors, page errors, hydration warnings, nested List controls, stacked mobile surfaces, or desktop/390px horizontal overflow.
- The screenshot workflow was not run because no visible Calendar state or selector changed.

Limitations:
- The script uses one Chromium-family browser and deterministic Belgrade mock data; it is not a cross-browser, visual-diff, load, or accessibility-audit suite.
- The app/production preview must already be running. Server lifecycle and CI orchestration are intentionally not part of this foundation.
- Accessible names are deliberately part of the regression contract; intentional product-language changes must update the assertions.
- No persistence, Supabase, mutations, URL state, routes, schema, drag/drop, resizing, Timeline view, or production scheduling logic was added or tested.

Next recommended step:
- 09.43 Calendar Regression Harness Stabilization + CI Readiness.

## Iteration 09.43 — Calendar Regression Harness Stabilization + CI Readiness

Summary:
- Added shared preview configuration so Calendar regression and screenshot capture use the same validated `PREVIEW_BASE_URL`, default host, and Chrome/Edge discovery rules.
- Added a five-second availability preflight with actionable start/override guidance before browser launch.
- Improved failures with desktop/mobile scope, step timing, URL, viewport, pressed view, active focus, and open-dialog context.
- Strengthened deterministic checks for exclusive Day/Week/Month/List pressed state, both Week and List navigation/reset, semantic mobile Calendar current state, and Month background clicking that adapts around foreground event controls.
- Added `aria-current="page"` to the active mobile admin tab as a nonvisual accessibility/selector stabilization; no Calendar behavior or visible copy changed.
- Kept `npm run test:calendar` as the single local/future-CI command. CI remains responsible for starting and stopping its production preview.

Changed files:
- `components/AdminShell.tsx`
- `scripts/calendar-regression.mjs`
- `scripts/capture-previews.mjs`
- `scripts/preview-config.mjs`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`

Verification:
- `node --check` passed for the regression, screenshot, and shared preview-config scripts.
- The unavailable-preview preflight exited nonzero with the expected actionable message.
- `npm run lint` passed.
- `npm run build` passed with all 63 static pages generated.
- `npm run test:calendar` passed all 16 named checks against a production preview at `http://127.0.0.1:3011`.
- Independent 390px browser QA confirmed four fitting view controls, `aria-current="page"` on Calendar, List pressed state, no document/List overflow, no nested List controls, and no browser warning/error logs.
- Targeted Calendar screenshot capture passed. Preview files remain unchanged because the selector stabilization has no visual effect.
- No console errors, page errors, hydration warnings, stacked mobile surfaces, or Calendar product behavior changes were found.

Limitations:
- The harness still uses one Chromium-family browser and deterministic Belgrade mock data; it is not a cross-browser, visual-diff, load, or full accessibility-audit suite.
- The app must already be running. No GitHub Actions workflow, CI provider configuration, port management, or start/wait/stop orchestration was added.
- Accessible names remain deliberate test contracts; intentional product-language changes must update the assertions.
- No persistence, Supabase, mutations, URL state, routes, schema, drag/drop, resizing, Timeline view, or production scheduling logic was added or tested.

Next recommended step:
- 09.44 Calendar Keyboard Navigation + Accessibility QA.

## Iteration 09.44 — Calendar Keyboard Navigation + Accessibility QA

Summary:
- Audited Day/Week/Month/List controls, date navigation, filters, inspector, creation, Month sibling controls, List rows, mobile bottom navigation, and Mobile More without changing Calendar product direction or visible copy.
- Added explicit pressed state to filter and creation task-source toggles.
- Stabilized Mobile More as a labelled modal dialog with `aria-controls`, `aria-expanded`, `aria-haspopup`, initial close-button focus, Escape dismissal, and trigger-focus restoration.
- Added calm focus-visible treatment to mobile bottom-navigation links, More, and its close button while preserving Calendar's semantic current-page state.
- Extended the Calendar regression harness to activate core paths by keyboard, verify previous/next/reset in Week and List, closed-filter `inert`, toggle state, form error descriptions, Month sibling/overflow behavior, List Space activation, and mobile More focus/Escape/exclusivity.
- Kept normal document tab order; no specialized grid arrow-key model or full modal focus trap was introduced.

Changed files:
- `app/admin/calendar/page.tsx`
- `components/AdminShell.tsx`
- `scripts/calendar-regression.mjs`
- `docs/previews/latest/mobile-more-menu-open.jpg`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`

Verification:
- `node --check scripts/calendar-regression.mjs` passed.
- `npm run lint` passed.
- `npm run build` passed with all 63 static pages generated.
- `npm run test:calendar` passed all 16 desktop/mobile steps against the production preview at `http://127.0.0.1:3012`.
- Production browser QA verified a visible desktop view-control focus ring, semantic List/Month controls, Mobile More dialog/expanded relationships, initial focus, Escape restoration, current Calendar tab state, and no 390px overflow.
- Targeted Calendar/mobile-More screenshot capture passed; only the intentional mobile More focused preview was refreshed.
- No console errors, page errors, hydration warnings, nested List controls, nested Month controls, or stacked mobile surfaces were found.

Limitations:
- Calendar grids use normal Tab order rather than arrow-key grid navigation, and modal surfaces do not yet implement full focus containment.
- The harness uses one Chromium-family browser and deterministic Belgrade mock data; it is not a cross-browser or full assistive-technology audit.
- No persistence, Supabase, mutations, URL state, routes, schema, drag/drop, resizing, Timeline view, visual redesign, or production scheduling logic was added.

Next recommended step:
- 09.45 Calendar Dialog Focus Containment + Screen Reader QA.

## Iteration 09.45 — Calendar Dialog Focus Containment + Screen Reader QA

Summary:
- Added one reusable, visibility-aware focus-containment hook for Calendar Filters, Plan project work, Inspector, and Mobile More only.
- Preserved existing initial close-button focus, Escape dismissal, trigger-focus restoration, single-surface coordination, and closed-filter `inert` behavior.
- Added concise `aria-describedby` content to all four modal surfaces; inspector context derives from the selected item’s task, date, schedule, and coverage label.
- Kept disabled creation preview actions outside the focus loop while preserving their availability descriptions.
- Extended `npm run test:calendar` with deterministic Tab/Shift+Tab boundary wrapping on desktop Filters, creation, inspector, Mobile More, and a mobile filter sheet.
- Preserved view/toggle/current-page semantics plus Month/List sibling-control and accessible-name coverage without changing visible Calendar UI.

Changed files:
- `hooks/useFocusContainment.ts`
- `app/admin/calendar/page.tsx`
- `components/AdminShell.tsx`
- `scripts/calendar-regression.mjs`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`

Verification:
- `node --check scripts/calendar-regression.mjs` passed.
- `npm run lint` passed.
- `npm run build` passed with all 63 static pages generated.
- `npm run test:calendar` passed all 16 desktop/mobile steps against the production preview at `http://127.0.0.1:3013`.
- Production browser QA verified desktop Filters and 390px Mobile More descriptions, initial focus, backward/forward boundary wrapping, Escape restoration, current-page state, and zero horizontal overflow.
- No console errors, page errors, hydration warnings, nested interactive controls, or stacked mobile surfaces were found.
- Screenshot capture was not run because the pass changed only nonvisual focus and accessibility semantics.

Limitations:
- Calendar grids continue to use normal Tab order; arrow-key grid traversal and roving focus are not implemented.
- Validation used Chromium accessibility semantics and automated/browser inspection, not a full NVDA, JAWS, VoiceOver, TalkBack, or cross-browser matrix.
- Focus containment is intentionally scoped to the four existing modal surfaces and is not applied to normal Calendar grids or non-modal UI.
- No persistence, Supabase, mutations, URL state, routes, schema, drag/drop, resizing, Timeline view, visual redesign, or production scheduling logic was added.

Next recommended step:
- 09.46 Calendar Grid Arrow-Key Navigation Foundation.

## Iteration 09.46 — Calendar Grid Arrow-Key Navigation Foundation

Summary:
- Added one small index-based arrow handler for native Day hour and Month date creation buttons without changing their normal Tab stops.
- Day supports ArrowUp/ArrowDown and Home/End across all 24 hour targets; Enter and Space retain the selected hour’s draft defaults.
- Month supports ArrowLeft/ArrowRight, one-week ArrowUp/ArrowDown, and Home/End across the visible date grid; Enter and Space retain 09:00-10:00 creation.
- Scoped Month movement to background date targets through stable local data attributes, leaving event chips and `+N` overflow as separate keyboard-reachable sibling controls.
- Preserved 09.45 modal containment and trigger restoration when creation opens from an arrow-focused Day or Month target.
- Left Week and List keyboard models unchanged and made no visible Calendar changes.

Changed files:
- `app/admin/calendar/page.tsx`
- `scripts/calendar-regression.mjs`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`

Verification:
- `node --check scripts/calendar-regression.mjs` passed.
- `npm run lint` passed.
- `npm run build` passed with all 63 static pages generated.
- `npm run test:calendar` passed all 16 desktop/mobile steps against the production preview at `http://127.0.0.1:3014`.
- Production Playwright QA covered all requested Day/Month arrow keys, Enter/Space creation defaults, post-arrow modal containment, focus restoration, Month sibling controls, mobile overflow, and 390px no-overflow behavior.
- No console errors, page errors, hydration warnings, nested interactive controls, broken focus containment, or stacked mobile surfaces were found.
- Screenshot capture was not run because layout, copy, colors, and screenshot-relevant states did not change.

Limitations:
- Week retains its current normal-Tab keyboard behavior; no hour-by-hour Week arrow model was attempted.
- Day/Month keep every native Tab stop and do not implement roving `tabIndex`, ARIA grid roles, selection state, or cross-month date loading.
- The independent in-app browser backend was unavailable during final QA; the production Playwright desktop/mobile run completed successfully.
- No persistence, Supabase, mutations, URL state, routes, schema, drag/drop, resizing, Timeline view, visual redesign, or production scheduling logic was added.

Next recommended step:
- 09.47 Calendar Week Keyboard Navigation Evaluation.

## Iteration 09.47 — Calendar Week Keyboard Navigation Evaluation

Summary:
- Evaluated the desktop Week DOM before implementation: timed work exposes one full-column background target per day with a 9 AM keyboard default, while Project context exposes seven separate no-specific-time day backgrounds.
- Added only ArrowLeft/ArrowRight and Home/End across the seven timed-day backgrounds; Up/Down remains unimplemented because Week has no hour-level keyboard targets.
- Added a separate horizontal/Home/End group for Project context day backgrounds without including project-window bars or overflow controls.
- Preserved every native Tab stop, event inspection, Enter/Space creation, 9 AM timed defaults, No specific time context defaults, modal containment, and trigger-focus restoration.
- Kept timed events, Project context bars, and `+N` overflow as independent sibling controls; no ARIA grid or roving `tabIndex` was introduced.
- Extended the regression harness with deterministic Week arrow, Enter/Space, sibling, normal-Tab, creation-default, containment, restoration, and event-inspection coverage.

Decision:
- Implement the small horizontal Week helper. It improves day-to-day keyboard movement without pretending the full-column backgrounds expose hourly positions. A vertical or production ARIA-grid model remains premature for the current mock structure.

Changed files:
- `app/admin/calendar/page.tsx`
- `scripts/calendar-regression.mjs`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`

Verification:
- `node --check scripts/calendar-regression.mjs` passed.
- `npm run lint` passed.
- `npm run build` passed with all 63 static pages generated.
- `npm run test:calendar` passed all 17 desktop/mobile steps against the production preview at `http://127.0.0.1:3015`.
- Production Playwright QA covered timed and Project context Left/Right/Home/End movement, Enter/Space defaults, modal containment/restoration, event inspection, sibling controls, and 390px behavior.
- No console errors, page errors, hydration warnings, nested interactive controls, broken focus containment, stacked mobile surfaces, or horizontal overflow were found.
- Screenshot capture was not run because the pass changed only nonvisual keyboard selectors and behavior.

Limitations:
- Week ArrowUp/ArrowDown is intentionally unavailable; the current timed background has one target per day rather than hour-level targets.
- Week remains a native-control composition, not an ARIA grid, and retains all normal Tab stops rather than roving focus.
- The independent in-app browser backend was unavailable during final QA; the production Playwright desktop/mobile run completed successfully.
- No persistence, Supabase, mutations, URL state, routes, schema, drag/drop, resizing, Timeline view, visual redesign, or production scheduling logic was added.

Next recommended step:
- 09.48 Calendar List Information Hierarchy Cleanup.

## Iteration 09.48 — Calendar List Information Hierarchy Cleanup

Summary:
- Reworked only the existing List row presentation so task name is primary, schedule/window is secondary, and type/context is a quieter tertiary label.
- Consolidated desktop rows from four competing metadata columns into three stable zones: task/type, schedule, and trailing helper coverage.
- Added a calm helper-fraction chip as the consistent trailing value on desktop and mobile.
- Reflowed mobile rows into a name/helper first line with full-width schedule and type lines beneath it, preserving complete project-window wording at 390px.
- Kept the flat divider-based List surface, date grouping, no-specific-time-before-timed sorting, one-row project windows, native inspector buttons, accessible names, filters, navigation, and focus restoration unchanged.
- Added a durable mobile regression audit for 15 List rows, nested controls, and List-local horizontal overflow without asserting pixel heights.

Changed files:
- `app/admin/calendar/page.tsx`
- `scripts/calendar-regression.mjs`
- `docs/previews/latest/calendar-list.jpg`
- `docs/previews/latest/mobile-calendar-list.jpg`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`

Verification:
- `node --check scripts/calendar-regression.mjs` passed.
- `npm run lint` passed.
- `npm run build` passed with all 63 static pages generated.
- `npm run test:calendar` passed all 17 desktop/mobile steps against the production preview at `http://127.0.0.1:3016`.
- Targeted screenshot capture refreshed only `calendar-list.jpg` and `mobile-calendar-list.jpg`.
- Rendered preview QA confirmed clear desktop column alignment, full mobile project-window wording, comfortable rows, stable helper chips, and no 390px List/document overflow.
- No console errors, page errors, hydration warnings, nested interactive controls, broken focus containment, stacked mobile surfaces, or behavior regressions were found.

Limitations:
- List remains mock presentation with Week-period navigation and no List-specific creation affordance.
- Mobile type/context remains compact 10px tertiary text; device and assistive-technology testing may justify future typography adjustment.
- The independent in-app browser backend was unavailable during final QA; production Playwright and rendered screenshot QA completed successfully.
- No persistence, Supabase, mutations, URL state, routes, schema, drag/drop, resizing, Timeline view, or production scheduling logic was added.

Next recommended step:
- 09.49 Calendar Stabilization + Handoff Review.

## Iteration 09.49 — Calendar Stabilization + Handoff Review

Summary:
- Audited the Calendar implementation and its 17-step regression harness across Day, Week, Month, List, navigation, filtering, inspection, creation, mobile overlays, focus containment/restoration, arrow navigation, sibling semantics, and responsive overflow.
- Found no Calendar product bug or meaningful automation gap, so no UI, behavior, selector, or regression-script changes were made.
- Documented the Calendar as a mature mock-prototype handoff and recorded a future List direction that strengthens day-group separation without turning rows into a card wall.
- Moved the roadmap out of Calendar work and into the public volunteer experience.

Changed files:
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`

Verification:
- `node --check scripts/calendar-regression.mjs` passed.
- `npm run lint` passed.
- `npm run build` passed with all 63 static pages generated.
- `npm run test:calendar` passed all 17 desktop/mobile steps against the production preview at `http://127.0.0.1:3017`.
- Production Playwright QA covered desktop and 390px mobile view switching, navigation/reset, Food filtering, inspector and creation flows, More/sheet exclusivity, modal containment, trigger restoration, Day/Month/Week arrows, List row semantics, error capture, and horizontal overflow.
- No console errors, page errors, hydration warnings, nested interactive controls, broken focus containment, stacked mobile surfaces, or horizontal overflow were found.
- Screenshot capture was intentionally skipped because no visible UI or screenshot-relevant behavior changed.

Limitations:
- Calendar remains mock-only: no persistence, Supabase, mutations, URL date state, drag/drop, resizing, Timeline view, or production scheduling logic was added.
- Week intentionally has no hour-level Up/Down traversal, and the native-control arrow helpers are not a full ARIA-grid or roving-focus model.
- The regression harness assumes a separately running preview and is not a cross-browser, visual-diff, or multi-screen-reader/device matrix.
- The independent in-app browser backend was unavailable during final QA; the production Playwright desktop/mobile run completed successfully.
- `CALENDAR_DATA_MODEL_READINESS.md` was not changed because this review did not alter scheduling or persistence readiness.

Next recommended step:
- 10.1 Public Volunteer Portal Foundation / Project Local Volunteer Home Direction.

## Iteration 10.1 — Public Volunteer Portal Foundation / Project Local Volunteer Home Direction

Summary:
- Reframed `/` as the Project Local volunteer entry with the product line “Coordinate volunteers, tasks, schedules, and updates in one place.”
- Made account-free volunteer access the obvious default through an active Belgrade project example, clearly labeled preview lookup, sample schedule, and direct questionnaire link.
- Reworked the existing `/v/demo` route into a simple remembered-volunteer home with Alex’s next assignment, later status previews, lunch, project update, and questionnaire access.
- Kept special-access roles separate through a compact, accessibly named control linked to the existing admin login; admin and Calendar behavior were not changed.
- Added targeted desktop/mobile public previews and public-capture checks for console/page errors and horizontal overflow.

Changed files:
- `app/page.tsx`
- `app/v/demo/page.tsx`
- `app/questionnaire/[projectId]/page.tsx`
- `app/q/demo/page.tsx`
- `scripts/capture-previews.mjs`
- `docs/previews/latest/public-home.jpg`
- `docs/previews/latest/volunteer-home.jpg`
- `docs/previews/latest/mobile-public-home.jpg`
- `docs/previews/latest/mobile-volunteer-home.jpg`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`

Verification:
- `node --check scripts/capture-previews.mjs` passed.
- `npm run lint` passed.
- `npm run build` passed with all 63 static pages generated.
- Production route checks returned 200 for `/`, `/v/demo`, `/questionnaire/belgrade-remodel-2026`, `/admin/dashboard`, and `/admin/calendar`.
- Targeted Playwright capture passed for desktop and 390px public/volunteer home previews with no console errors, page errors, hydration warnings, or horizontal overflow.
- `npm run test:calendar` passed all 17 desktop/mobile steps against the same production preview, confirming the public work did not regress Calendar behavior.
- Rendered previews confirmed clear hierarchy, readable form labels, a distinct Special access control, comfortable mobile targets, and no card-wall treatment.
- Existing Calendar previews were not refreshed.

Limitations:
- Name/email lookup, remembered-device identity, schedule confirmation, secure email links, auth, and persistence are not implemented.
- The Belgrade entry and Alex volunteer home use existing deterministic mock data; no real volunteer information is resolved.
- Special access uses the existing placeholder admin login and does not implement role-aware authentication.
- The independent in-app browser backend was unavailable during QA; the production screenshot workflow and rendered preview inspection completed successfully.
- `CALENDAR_DATA_MODEL_READINESS.md` was not changed because Calendar behavior and scheduling readiness did not change.

Next recommended step:
- 10.2 Volunteer Schedule Lookup / Remembered Volunteer Home Mock.

## Iteration 10.2 — Volunteer Schedule Lookup / Remembered Volunteer Home Mock

Summary:
- Removed the detached active-project treatment from `/` and integrated Belgrade project context directly into the single volunteer lookup card.
- Made `Find my volunteer info` a keyboard-accessible mock submit to the existing `/v/demo` route, with Alex Rivera prefilled and explicit no-account/no-real-search guidance.
- Added a quiet remembered-person area to the volunteer home with Alex, the project name, and a `Not you?` path back to lookup.
- Promoted the pending Material staging shift as the next assignment with helper coverage and local-only Confirm / Can’t make it state announced to assistive technology.
- Kept later work, questionnaire, lunch, and project updates subordinate to the next assignment rather than expanding the page into a dense schedule.
- Extended targeted public capture QA to exercise lookup navigation and both confirmation choices before restoring the clean screenshot state.
- Documented future Calendar guidance for rare all-day work, Project context reconsideration, and useful non-self-referential `+N` destinations without changing Calendar code.

Changed files:
- `app/page.tsx`
- `app/v/demo/page.tsx`
- `components/VolunteerConfirmationPreview.tsx`
- `scripts/capture-previews.mjs`
- `docs/previews/latest/public-home.jpg`
- `docs/previews/latest/volunteer-home.jpg`
- `docs/previews/latest/mobile-public-home.jpg`
- `docs/previews/latest/mobile-volunteer-home.jpg`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`

Verification:
- `node --check scripts/capture-previews.mjs` passed.
- `npm run lint` passed.
- `npm run build` passed with all 63 static pages generated.
- Production route checks returned 200 for `/`, `/v/demo`, `/questionnaire/belgrade-remodel-2026`, `/admin/dashboard`, and `/admin/calendar`.
- Targeted Playwright public capture passed on desktop and 390px mobile with no console errors, page errors, hydration warnings, or horizontal overflow.
- Desktop public QA submitted the lookup into `/v/demo`, exercised Confirm and Can’t make it, verified their announced local states, and reloaded to the initial Needs reply state.
- `npm run test:calendar` passed all 17 desktop/mobile checks; Calendar code and screenshots were unchanged.

Limitations:
- Lookup does not resolve the entered identity; it always opens the deterministic Alex Rivera preview.
- Confirmation changes exist only in component memory and reset when the volunteer leaves or reloads the page.
- Remembered-device access, secure links, auth, Supabase, database calls, email, and production schedule mutations are not implemented.
- The independent in-app browser backend was unavailable during QA; the production Playwright workflow and rendered screenshot inspection completed successfully.
- `CALENDAR_DATA_MODEL_READINESS.md` was not changed because this pass only added future product notes and did not change Calendar readiness or implementation.

Next recommended step:
- 10.3 Volunteer Confirmation Flow Mock / Assignment Detail Surface.

## Iteration 10.3 — Volunteer Confirmation Flow Mock / Assignment Detail Surface

Summary:
- Added the deterministic public detail route `/v/demo/assignments/material-staging` for Alex’s next assignment.
- Made the Material staging summary on `/v/demo` clearly openable through an accessible `View details` link while keeping confirmation buttons as separate sibling controls.
- Built one calm assignment surface with project/person context, date/time, location and check-in, work purpose, helper coverage, project contact, PPE/clothing guidance, lunch information, and a clear back path.
- Reused the local-only confirmation component and clarified that preview choices do not send a response and reset on navigation.
- Added a plain unknown-assignment recovery state with a route back to the volunteer schedule.
- Extended public capture QA to cover home-to-detail navigation, both response states, nested controls, desktop/mobile overflow, and two new assignment-detail previews.

Changed files:
- `app/v/demo/page.tsx`
- `app/v/demo/assignments/[assignmentId]/page.tsx`
- `components/VolunteerConfirmationPreview.tsx`
- `scripts/capture-previews.mjs`
- `docs/previews/latest/volunteer-home.jpg`
- `docs/previews/latest/mobile-volunteer-home.jpg`
- `docs/previews/latest/volunteer-assignment-detail.jpg`
- `docs/previews/latest/mobile-volunteer-assignment-detail.jpg`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`

Verification:
- `node --check scripts/capture-previews.mjs` passed.
- `npm run lint` passed.
- `npm run build` passed with all 64 static pages generated.
- Production route checks returned 200 for `/`, `/v/demo`, `/v/demo/assignments/material-staging`, the helpful unknown-assignment state, `/questionnaire/belgrade-remodel-2026`, `/admin/dashboard`, and `/admin/calendar`.
- Targeted Playwright capture passed for all six public desktop/mobile previews with no console errors, page errors, hydration warnings, nested interactive controls, or horizontal overflow.
- Desktop QA opened Material staging from the volunteer home and exercised Confirm and Can’t make it with the expected announced local status before restoring the initial state.
- `npm run test:calendar` passed all 17 desktop/mobile checks; Calendar code and screenshots were unchanged.

Limitations:
- Only Material staging has a dedicated assignment detail; this is not yet a reusable multiple-assignment schedule system.
- Confirmation remains component-local, sends nothing, and resets on navigation or reload.
- Contact, preparation, helper, and lunch details are deterministic preview copy built from existing mock context rather than persisted assignment data.
- No auth, Supabase, database calls, identity resolution, email, secure links, or real schedule mutations were added.
- The independent in-app browser backend was unavailable during QA; the production Playwright workflow and rendered screenshot inspection completed successfully.
- `CALENDAR_DATA_MODEL_READINESS.md` was not changed.

Next recommended step:
- 10.4 Volunteer Schedule List / Multiple Assignments Mock.

## Iteration 10.4 — Volunteer Schedule List / Multiple Assignments Mock

Summary:
- Added one shared public-preview schedule source for Material staging, Drywall crew, Lunch support, and Site cleanup, including summary, detail, response, helper, preparation, lunch, and contact copy.
- Kept Material staging as the emphasized next assignment and expanded `/v/demo` with a flat three-row Upcoming schedule rather than a dense table or card wall.
- Made each upcoming row a single native link with a clear accessible name, visible response state, location, helper coverage, and desktop/mobile `View details` cue.
- Refactored `/v/demo/assignments/[assignmentId]` to render all four assignments from the shared preview source and initialize local confirmation from each assignment’s preview response.
- Preserved calm unknown-assignment recovery and clarified that response state remains page-local and unsent.
- Extended public QA to open Material staging and Drywall crew, verify unknown recovery, exercise both response choices, audit nested controls/errors/overflow, and capture the full 390px volunteer schedule.

Changed files:
- `app/v/demo/page.tsx`
- `app/v/demo/assignments/[assignmentId]/page.tsx`
- `components/VolunteerConfirmationPreview.tsx`
- `lib/volunteerPreview.ts`
- `scripts/capture-previews.mjs`
- `docs/previews/latest/volunteer-home.jpg`
- `docs/previews/latest/mobile-volunteer-home.jpg`
- `docs/previews/latest/volunteer-assignment-detail.jpg`
- `docs/previews/latest/mobile-volunteer-assignment-detail.jpg`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`

Verification:
- `node --check scripts/capture-previews.mjs` passed.
- `npm run lint` passed.
- `npm run build` passed with all 67 static pages generated.
- Production route checks returned 200 for `/`, `/v/demo`, Material staging, Drywall crew, unknown-assignment recovery, `/questionnaire/belgrade-remodel-2026`, `/admin/dashboard`, and `/admin/calendar`.
- Targeted Playwright capture passed for the affected public desktop/full-page mobile previews with no console errors, page errors, hydration warnings, nested interactive controls, or horizontal overflow.
- Public QA opened two assignment details, verified the unknown recovery state, exercised Confirm and Can’t make it, and restored the initial response state.
- `npm run test:calendar` passed all 17 desktop/mobile checks; Calendar code and screenshots were unchanged.

Limitations:
- All four assignments and their details remain deterministic preview content, not persisted or derived from the admin Calendar.
- Response changes do not synchronize between home and detail, send anything, or survive navigation/reload.
- Lookup still always resolves to Alex; there is no remembered-device identity, authentication, secure link, Supabase, database, email, or production scheduling behavior.
- The independent in-app browser backend was unavailable during QA; the production Playwright workflow and rendered screenshot inspection completed successfully.
- `CALENDAR_DATA_MODEL_READINESS.md` was not changed.

Next recommended step:
- 10.5 Volunteer Schedule Empty/No Assignment States + Project Updates Polish.

## Iteration 10.5 — Volunteer Schedule Empty/No Assignment States + Project Updates Polish

Summary:
- Added `/v/demo/no-assignments` as a calm deterministic outcome for a found volunteer whose availability is still being reviewed.
- Kept Alex, Belgrade, the different-person path, account-free guidance, questionnaire access, and project lookup visible without presenting the empty schedule as an error or rejection.
- Avoided a fake refresh action; plain copy explains that new assignments would appear after the project contact finishes scheduling.
- Centralized shared volunteer/person and project-information preview content in `lib/volunteerPreview.ts`.
- Replaced the normal home’s separate filler cards with one compact divided project-information rail covering questionnaire status, next lunch, a dated concise update, and check-in help.
- Configured the empty-state rail to omit duplicate questionnaire and irrelevant lunch sections, keeping only useful update and help guidance.
- Added audited desktop/full-page mobile no-assignment previews and deterministic empty-state semantic checks.

Changed files:
- `app/v/demo/page.tsx`
- `app/v/demo/no-assignments/page.tsx`
- `components/VolunteerProjectInfo.tsx`
- `lib/volunteerPreview.ts`
- `scripts/capture-previews.mjs`
- `docs/previews/latest/volunteer-home.jpg`
- `docs/previews/latest/mobile-volunteer-home.jpg`
- `docs/previews/latest/volunteer-no-assignments.jpg`
- `docs/previews/latest/mobile-volunteer-no-assignments.jpg`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`

Verification:
- `node --check scripts/capture-previews.mjs` passed.
- `npm run lint` passed.
- `npm run build` passed with all 68 static pages generated.
- Production route checks returned 200 for `/`, `/v/demo`, `/v/demo/no-assignments`, Material staging, Drywall crew, unknown-assignment recovery, `/questionnaire/belgrade-remodel-2026`, `/admin/dashboard`, and `/admin/calendar`.
- Targeted Playwright capture passed for the normal and empty schedule states on desktop and full-page 390px mobile with no console errors, page errors, hydration warnings, nested interactive controls, or horizontal overflow.
- Empty-state QA verified the page heading, reassurance copy, and primary questionnaire action; existing public detail and confirmation checks remained green through the volunteer-home audit.
- `npm run test:calendar` passed all 17 desktop/mobile checks; Calendar code and screenshots were unchanged.

Limitations:
- The no-assignment page is a fixed preview route, not the result of real lookup or schedule state.
- Project updates, lunch, contact, and questionnaire status are deterministic public-preview content and do not sync with admin Communications, Calendar, or questionnaire data.
- Responses remain page-local, unsent, and reset after navigation or reload.
- No real identity resolution, schedule lookup, authentication, Supabase, database, email, secure link, remembered-device persistence, or production mutation behavior was added.
- The independent in-app browser backend was unavailable during QA; the production Playwright workflow and rendered screenshot inspection completed successfully.
- `CALENDAR_DATA_MODEL_READINESS.md` was not changed.

Next recommended step:
- 10.6 Volunteer Schedule Response State Polish / Reminder Link Preview.

## Iteration 10.6 — Volunteer Schedule Response State Polish / Reminder Link Preview

Summary:
- Refined the shared response control into a clear reversible loop: Needs reply exposes Confirm / Can’t make it, responded states show one Change response action, and changing returns to the pending choice.
- Updated response copy to describe what each choice would do while stating separately that the preview sends nothing and resets when the volunteer leaves.
- Kept every state in the existing `aria-live` region and preserved large mobile actions without adding synchronization between schedule, detail, or reminder pages.
- Added reusable `/v/demo/reminder/[assignmentId]` previews for all four deterministic assignments with Alex/Belgrade context, schedule summary, response controls, schedule/detail exits, and explicit non-secure/no-reminder-sent guidance.
- Added a calm unknown-reminder recovery page and shared assignment/reminder href helpers.
- Extended screenshot QA through the full response/change loop, valid/unknown reminder routes, reminder navigation links, nested-control checks, browser errors, and 390px overflow.

Changed files:
- `app/v/demo/reminder/[assignmentId]/page.tsx`
- `components/VolunteerConfirmationPreview.tsx`
- `lib/volunteerPreview.ts`
- `scripts/capture-previews.mjs`
- `docs/previews/latest/volunteer-home.jpg`
- `docs/previews/latest/mobile-volunteer-home.jpg`
- `docs/previews/latest/volunteer-assignment-detail.jpg`
- `docs/previews/latest/mobile-volunteer-assignment-detail.jpg`
- `docs/previews/latest/volunteer-reminder.jpg`
- `docs/previews/latest/mobile-volunteer-reminder.jpg`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`

Verification:
- `node --check scripts/capture-previews.mjs` passed.
- `npm run lint` passed.
- `npm run build` passed with all 72 static pages generated.
- Production route checks returned 200 for `/`, `/v/demo`, no-assignments, Material staging, Drywall crew, assignment recovery, Material staging reminder, reminder recovery, the Belgrade questionnaire, admin dashboard, and admin Calendar.
- Targeted Playwright capture passed for the response-bearing schedule/detail pages and new reminder previews on desktop/full-page 390px mobile with no console errors, page errors, hydration warnings, nested controls, or horizontal overflow.
- Public QA exercised Confirm, Change response, Can’t make it, and Change response back to pending; reminder QA verified schedule/detail links, non-secure copy, and unknown recovery.
- `npm run test:calendar` passed all 17 desktop/mobile checks; Calendar code and screenshots were unchanged.

Limitations:
- Reminder routes are deterministic public previews with no secure token parsing, identity verification, real reminder email/text, or delivery state.
- Responses remain local, unsent, unsynchronized between pages, and reset after navigation/reload.
- Lookup still always resolves to Alex; there is no real identity resolution, remembered-device persistence, auth, Supabase, database, email, or secure link behavior.
- Public schedule and reminder content do not sync with admin Calendar or Communications.
- The independent in-app browser backend was unavailable during QA; the production Playwright workflow and rendered screenshot inspection completed successfully.
- `CALENDAR_DATA_MODEL_READINESS.md` was not changed.

Next recommended step:
- 10.7 Public Volunteer Portal Stabilization + Handoff Review.

## Iteration 10.7 — Public Volunteer Portal Stabilization + Handoff Review

Summary:
- Audited the full Project Local public flow across landing, remembered schedule, no-assignment state, four assignment details, four reminder previews, unknown recovery, and the Belgrade questionnaire.
- Confirmed the existing public screenshot harness already covers lookup, two detail routes, assignment/reminder recovery, empty-state semantics, the complete reversible response loop, nested controls, browser errors, hydration warnings, and responsive overflow.
- Found and fixed one concrete copy leak: the public unavailable-questionnaire state now says `open project` instead of the admin-oriented `project workspace`.
- Found no public layout, interaction, recovery, focus-label, duplication, sent/security-language, or 390px overflow defect requiring further product changes.
- Regenerated the complete 10-preview public handoff matrix without visual diffs and left Calendar/admin screenshots untouched.
- Marked the public volunteer portal stable as a mock prototype and moved the next step to persistence/security readiness planning rather than implementation.

Changed files:
- `app/questionnaire/[projectId]/page.tsx`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`

Verification:
- `node --check scripts/capture-previews.mjs` passed.
- `npm run lint` passed.
- `npm run build` passed with all 72 static pages generated.
- Production route checks returned 200 for all 14 requested routes: landing, schedule, empty state, four assignment ids, assignment recovery, two reminder ids, reminder recovery, questionnaire, admin dashboard, and admin Calendar.
- The targeted workflow regenerated all 10 public desktop/mobile previews and passed lookup, detail, recovery, empty-state, response-change, reminder-link, browser-error, hydration, nested-control, and horizontal-overflow checks.
- Rendered desktop/mobile review found no cramped sections, card-wall drift, misleading account/sent/security language, repeated empty-state content, or missing recovery path.
- `npm run test:calendar` passed all 17 desktop/mobile checks; Calendar code and screenshots remained unchanged.
- `git diff --check` passed.

Limitations:
- The portal remains deterministic and mock-only: lookup always opens Alex, empty/reminder routes are fixed variants, and public assignments do not derive from admin Calendar.
- Responses remain component-local, unsent, unsynchronized, and reset after navigation/reload.
- Reminder links have no secure tokens, identity verification, delivery, or real email/text behavior.
- There is no auth, Supabase, database persistence, remembered-device identity, real lookup, secure link, Calendar/Communications integration, or production mutation behavior.
- The independent in-app browser backend was unavailable during QA; the production Playwright workflow and rendered screenshot audit completed successfully.
- `CALENDAR_DATA_MODEL_READINESS.md` was not changed.

Next recommended step:
- 11.1 Supabase/Auth/Persistence Readiness Planning. This should remain a planning/readiness pass unless implementation is explicitly requested.

## Iteration 11.1 — Supabase/Auth/Persistence Readiness Planning

Summary:
- Added a practical readiness document that reconciles the stable Calendar and public-volunteer handoffs before any real backend connection.
- Defined first-pass boundaries for auth identities, projects, contacts, scoped grants, congregations, questionnaires, volunteer profiles, task presets, Calendar items, assignments/responses, communications/deliveries, follow-up, and audit history.
- Documented a unified project capability model for main, assistant, on-site, volunteer, and future platform access without creating Food/Security mini-app permissions.
- Established that volunteers remain account-free but production name/email lookup must not reveal schedules directly; secure access needs opaque, scoped, expiring/revocable credentials and privacy-preserving lookup behavior.
- Carried forward the Calendar contract: presets and scheduled work remain separate, assignment/response rows drive coverage truth, schedule kinds stay explicit, true all-day work is rare, and overflow must reveal useful hidden work.
- Proposed a gated migration order from narrow Supabase setup through contact auth, project isolation, intake, profiles, tasks, Calendar, assignments/responses, communications, follow-up, and finally secure public volunteer access.
- Identified RLS/security boundaries and unresolved auth, token, intake, scheduling, communications, audit, retention, and governance decisions without writing policies or migrations.

Changed files:
- `docs/SUPABASE_AUTH_PERSISTENCE_READINESS.md`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`

Verification:
- `npm run lint` passed.
- `npm run build` passed with all 72 static pages generated.
- `npm run test:calendar` passed all 17 desktop/mobile checks.
- `git diff --check` passed.
- No package, package script, environment variable, Supabase client, auth logic, schema, migration, database call, route behavior, Calendar implementation, or public interaction was changed.

Limitations:
- The entity map and access model are proposed boundaries, not final SQL, RLS policies, generated types, or mutation contracts.
- Auth method, canonical project/workspace naming, on-site access, assistant congregation rules, volunteer token lifetime, remembered-device behavior, questionnaire/profile transitions, response concurrency, timezone policy, provider selection, audit retention, and cutover strategy still require decisions.
- No Supabase project/client setup, secret handling, connectivity check, persistence, or production data migration exists yet.
- Existing deterministic mocks remain the behavior reference until an explicitly isolated real-data slice replaces them.

Next recommended step:
- 11.2 Supabase Project Setup + Environment Skeleton. Keep it limited to approved tooling, environment handling, client/server boundaries, secret guidance, and a connectivity smoke test; do not combine it with full schema/auth/app migration.

## Iteration 11.2 — Supabase Project Setup + Environment Skeleton

Summary:
- Added `@supabase/supabase-js` as the only new dependency and kept every client factory lazy and unused by application routes.
- Added shared typed validation for the public project URL/key plus an optional server-only service-role value.
- Added separate browser and `server-only` client factories. The server factory uses the public key without cookie/session persistence; no privileged service-role client exists.
- Added `.env.example` and local setup guidance covering browser-visible values, server-only secrets, deployment separation, and intentionally unimplemented work.
- Added `npm run supabase:check`, which loads Next.js-style local environment files and calls only `/auth/v1/health`; it never signs in or queries product data.
- Preserved all existing deterministic mock routes and Calendar behavior.

Changed files:
- `.env.example`
- `.gitignore`
- `package.json`
- `package-lock.json`
- `lib/supabase/config.ts`
- `lib/supabase/browser.ts`
- `lib/supabase/server.ts`
- `scripts/supabase-smoke.mjs`
- `docs/SUPABASE_LOCAL_SETUP.md`
- `docs/SUPABASE_AUTH_PERSISTENCE_READINESS.md`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`

Verification:
- `node --check scripts/supabase-smoke.mjs` passed.
- `npx tsc --noEmit` passed.
- The smoke command's missing-environment failure path and successful Auth-health response path were verified with a disposable local endpoint; a live Supabase connectivity pass still requires real local project values.
- `npm run lint` passed.
- `npm run build` passed with all 72 static pages generated and no Supabase environment configured.
- `npm run test:calendar` passed all 17 desktop/mobile checks.
- `git diff --check` passed.

Limitations:
- No live Supabase project credentials were added, so the health endpoint was not contacted during this iteration.
- There are no product tables, generated database types, migrations, RLS policies, auth UI/session handling, protected routes, service-role operations, or product-data reads/writes.
- No public volunteer security, Calendar persistence, questionnaire persistence, or mock-to-real cutover exists.
- `npm install` reports two moderate dependency-audit findings; no forced/breaking audit remediation was applied in this scoped setup pass.

Next recommended step:
- 11.3 Auth Shell for Project Contacts. Keep it invite-oriented and contact-only; establish session and protected-route boundaries without migrating product data or creating volunteer accounts.

## Iteration 11.3 — Auth Shell for Project Contacts

Summary:
- Added `@supabase/ssr` and converted the 11.2 browser/server factories to cookie-compatible Auth clients without adding product-data access.
- Replaced the decorative admin login with invite-only magic-link sign-in using `shouldCreateUser: false`; volunteers remain outside Auth.
- Added code callback and POST-only local sign-out routes, sanitized admin return paths, and server-side session inspection.
- Added a Next.js proxy boundary. Default `review` mode preserves every mock admin route; explicit `enforced` mode requires a verified Supabase Auth user.
- Added a typed project-contact grant loader that always returns empty `not_implemented` state and performs no database query.
- Documented that authentication proves identity, project grants authorize scope, and future RLS/product commands enforce data access.

Changed files:
- `.env.example`
- `package.json`
- `package-lock.json`
- `proxy.ts`
- `app/admin/login/page.tsx`
- `app/admin/auth/callback/route.ts`
- `app/admin/auth/sign-out/route.ts`
- `components/AdminContactSignIn.tsx`
- `lib/auth/config.ts`
- `lib/auth/redirects.ts`
- `lib/auth/session.ts`
- `lib/auth/project-contact-grants.ts`
- `lib/supabase/browser.ts`
- `lib/supabase/server.ts`
- `lib/supabase/proxy.ts`
- `docs/SUPABASE_LOCAL_SETUP.md`
- `docs/SUPABASE_AUTH_PERSISTENCE_READINESS.md`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`

Verification:
- `npm run lint` passed.
- `npm run build` passed with 74 generated pages/routes and the Next.js proxy boundary.
- `npm run test:calendar` passed all 17 desktop/mobile checks in default review mode.
- `npx tsc --noEmit` passed.
- `git diff --check` passed.
- Review-mode admin and public routes remained reachable without Supabase environment values; enforced mode redirected anonymous admin requests to the Auth shell.
- Sign-out rejected GET with 405, accepted POST with a 303 login redirect, and an incomplete callback recovered to the login surface.

Limitations:
- Live magic-link delivery/callback was not exercised because no project credentials or invited Auth identity were supplied.
- `review` mode is intentionally not access control. `enforced` mode proves identity only and does not load or enforce project, role, congregation, or capability grants.
- There are no schema/migration files, RLS policies, product tables, generated database types, product reads/writes, service-role operations, volunteer Auth/token access, or route-data migrations.
- Calendar, questionnaire, volunteer, communications, and public preview data remain deterministic mocks.

Next recommended step:
- 11.4 Workspace Persistence Foundation. Keep the first persistence slice limited to project/workspace identity, project isolation, and tests; do not combine it with other product-data migrations.

## Iteration 11.4 — Workspace Persistence Foundation

Summary:
- Added one `public.workspaces` migration containing only canonical UUID/key identity, display name, lifecycle, timezone, optional date range, public-intake configuration, and timestamps.
- Made the workspace UUID the canonical scope key for future project-owned rows; stable human-readable lookup uses `workspace_key` and never acts as authorization.
- Enabled and forced RLS without an allow policy. Normal anon/authenticated sessions can select the table at the privilege layer but see zero rows, so Auth identity alone grants nothing.
- Added a server-only, session-owned workspace identity reader by UUID or stable key. No application route imports it and no service-role client is used.
- Added runtime input/row validation and `npm run test:workspace` checks for schema scope, deny-by-default isolation, unchanged grant placeholders, and absence of route cutovers.
- Documented migration application and future generated-type workflow. No invented generated database types were committed because no linked/local generated output was available.

Changed files:
- `package.json`
- `supabase/migrations/20260701000000_workspace_identity.sql`
- `lib/workspaces/identity.ts`
- `lib/workspaces/read.ts`
- `scripts/workspace-persistence-regression.mjs`
- `docs/SUPABASE_LOCAL_SETUP.md`
- `docs/SUPABASE_AUTH_PERSISTENCE_READINESS.md`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`

Verification:
- `npm run test:workspace` passed.
- `npx tsc --noEmit` passed.
- `npm run lint` passed.
- `npm run build` passed with 74 generated pages/routes.
- `npm run test:calendar` passed all 17 desktop/mobile checks.
- `node --check scripts/workspace-persistence-regression.mjs` passed.
- `git diff --check` passed with only Git's existing LF-to-CRLF checkout warnings.
- A live migration/RLS exercise was not run because no `.env.local` or `supabase/config.toml` is present; `npm run test:workspace` validated the checked-in migration contract instead.

Limitations:
- Deny-by-default proves that ordinary sessions currently see no workspace rows; it does not prove real per-user project isolation. That requires persisted grants, membership-backed policies, and cross-user tests.
- The reader is intentionally unused by routes. Existing Calendar, task, volunteer, questionnaire, assignment, communication, Needs Attention, public volunteer, reminder, and mock admin routes remain deterministic mocks.
- `public_intake_enabled` is configuration only. It creates no anonymous read, questionnaire submission, volunteer lookup, or token behavior.
- No service-role operation, seed data, workspace mutation command, grant query, or generated database type was added.

Next recommended step:
- 11.5 Project Contact Grants + Workspace Authorization. Add explicit project membership/grants and prove cross-user workspace isolation before any authenticated product route cutover.

## Iteration 11.5 — Project Contact Grants + Workspace Authorization

Summary:
- Added `project_contacts` as the explicit application mapping to Supabase Auth and `workspace_contact_grants` as the canonical workspace-scoped role/capability grant.
- Added active/inactive/revoked status, validity windows, revocation consistency, `workspace.read`, and foreign keys to `auth.users` and the 11.4 workspace UUID.
- Added authenticated read-only RLS. Anon has no workspace privilege; signed-in users see only their own effective grants and workspaces authorized by those grants.
- Connected `loadProjectContactGrants` narrowly: it verifies the requested user against `auth.getUser()`, relies on RLS, validates rows, and returns no authorization when verification/querying fails.
- Added a server-only current-user granted-workspace list reader. Existing lookup-by-id/key automatically inherits workspace RLS.
- Kept `/admin/login` as the only route that inspects grant status. No mock product/workspace route reads persisted workspaces or grants.
- Added `npm run test:grants` for policy/schema checks, deterministic isolation fixtures, server-only/service-role checks, and route-import isolation.

Changed files:
- `package.json`
- `supabase/migrations/20260701010000_project_contact_grants.sql`
- `lib/auth/grant.ts`
- `lib/auth/project-contact-grants.ts`
- `lib/workspaces/granted.ts`
- `lib/workspaces/read.ts`
- `scripts/grants-authorization-regression.mjs`
- `scripts/workspace-persistence-regression.mjs`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`
- `docs/SUPABASE_AUTH_PERSISTENCE_READINESS.md`
- `docs/SUPABASE_LOCAL_SETUP.md`
- `docs/SUPABASE_LOCAL_SETUP.md`

Verification:
- `npm run test:workspace` passed.
- `npm run test:grants` passed.
- `npx tsc --noEmit` passed.
- `npm run lint` passed.
- `npm run build` passed with 74 generated pages/routes.
- `npm run test:calendar` passed all 17 desktop/mobile checks.
- `node --check scripts/grants-authorization-regression.mjs` passed.
- `git diff --check` passed with only Git's existing LF-to-CRLF checkout warnings.

Limitations:
- No `.env.local` or `supabase/config.toml` is present, so migrations were not applied and real Postgres two-user RLS isolation was not exercised. The regression is a policy/contract check, not a live database claim.
- `workspace.read` authorizes workspace identity/config only. It does not authorize any future product table or mutation.
- There is no grant/invitation management UI, app grant mutation, seed data, generated database type, service-role client, or audit log.
- All Calendar, Task, Volunteer, Questionnaire, Assignment, Communication, Needs Attention, public volunteer, reminder-token, and mock application routes remain on existing behavior/data.

Next recommended step:
- 11.6 Questionnaire Submission Persistence, if approved as a separate slice. Keep anonymous creation and grant-authorized review separate and do not create volunteer profiles automatically.

## Iteration 11.6 — Questionnaire Submission Persistence

Summary:
- Added one `questionnaire_submissions` table keyed to the canonical workspace UUID, with controlled lifecycle/source, questionnaire version, bounded JSON answer truth, and timestamps.
- Added a narrow security-definer public submission function. Anon has no table privileges; the function controls metadata and inserts only for active intake-enabled workspaces after structural validation.
- Added strict version-1 application payload validation for the existing questionnaire field vocabulary without connecting the mock form.
- Added authenticated review RLS requiring an effective workspace grant with `questionnaires.review`; `workspace.read` alone cannot read submissions.
- Added server-only public-submit and current-contact review-read boundaries. No application route imports them.
- Kept submissions immutable to application roles. Review/update/approval actions and volunteer profile conversion remain unimplemented.
- Added `npm run test:questionnaires` covering validation, migration/function scope, public denial/read boundaries, review capability isolation, and route isolation.

Changed files:
- `package.json`
- `supabase/migrations/20260701020000_questionnaire_submissions.sql`
- `lib/questionnaires/payload.ts`
- `lib/questionnaires/server.ts`
- `scripts/questionnaire-persistence-regression.mjs`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`
- `docs/SUPABASE_AUTH_PERSISTENCE_READINESS.md`
- `docs/SUPABASE_LOCAL_SETUP.md`

Verification:
- `npm run test:questionnaires` passed.
- `npx tsc --noEmit` passed.
- `npm run lint` passed.
- `npm run build` passed with 74 generated pages/routes.
- `npm run test:calendar` passed all 17 desktop/mobile checks.
- `npm run test:workspace` passed.
- `npm run test:grants` passed.
- `node --check scripts/questionnaire-persistence-regression.mjs` passed.
- `git diff --check` passed with only Git's existing LF-to-CRLF checkout warnings.

Limitations:
- No `.env.local` or `supabase/config.toml` is present, so the migration/function were not applied and live anon insert or authenticated two-user review isolation was not exercised.
- The existing public questionnaire, admin queue, and detail routes remain deterministic mocks; there is no real-data preview route.
- There is no review mutation, approval action, submission-to-volunteer conversion, volunteer profile table, seed submission, generated database type, service-role client, or audit event.
- Calendar, Task, Assignment, Communication, Needs Attention, public volunteer access, and reminder-token behavior remain unchanged and unpersisted.

Next recommended step:
- 11.7 Volunteer Profile Persistence, if approved separately. Preserve original submission truth and require an explicit authorized conversion workflow.

## Iteration 11.7 — Volunteer Profile Persistence

Summary:
- Added one project-scoped `volunteer_profiles` table for approved/schedule-ready profile truth, separate from immutable questionnaire submissions.
- Added same-workspace composite provenance, one-profile-per-submission uniqueness, lifecycle/readiness, contact/congregation fields, availability and skills/help snapshots, profile notes, and timestamps.
- Kept emergency-contact answers out of the profile so `volunteers.view` does not broaden access to sensitive questionnaire truth.
- Added authenticated `volunteers.view` RLS and denied all anon/profile write access.
- Added an authenticated-only conversion function accepting only a submission UUID. It verifies Auth, a still-`submitted` version-1 source, and one effective grant containing both `questionnaires.review` and `volunteers.edit`.
- Conversion derives workspace and profile values from the source, creates one `active`/`ready` snapshot, and never updates/deletes the submission.
- Added server-only conversion and current-contact profile readers with no route imports.
- Added `npm run test:volunteers` for schema, provenance, duplicate, authorization, conversion, sensitive-field, parsing, and route-isolation checks.

Changed files:
- `package.json`
- `supabase/migrations/20260701030000_volunteer_profiles.sql`
- `lib/volunteers/profile.ts`
- `lib/volunteers/server.ts`
- `scripts/volunteer-persistence-regression.mjs`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`
- `docs/SUPABASE_AUTH_PERSISTENCE_READINESS.md`
- `docs/SUPABASE_LOCAL_SETUP.md`

Verification:
- `npm run test:volunteers` passed.
- `npx tsc --noEmit` passed.
- `npm run lint` passed.
- `npm run build` passed with 74 generated pages/routes.
- `npm run test:calendar` passed all 17 desktop/mobile checks.
- `npm run test:workspace`, `npm run test:grants`, and `npm run test:questionnaires` passed.
- `node --check scripts/volunteer-persistence-regression.mjs` passed.
- `git diff --check` passed with only Git's existing LF-to-CRLF checkout warnings.

Limitations:
- No `.env.local` or `supabase/config.toml` is present, so the migration/function were not applied and live profile conversion or authenticated two-user profile isolation was not exercised.
- The source submission remains `submitted`; the explicit conversion command is the approval decision for this narrow slice. No questionnaire-status mutation or approval UI exists.
- There is no profile edit/archive command, emergency-contact profile field, cross-project person identity, seed profile, generated database type, service-role client, or audit event.
- Existing volunteer/questionnaire routes, Calendar, Task, Assignment, Communication, Needs Attention, public volunteer access, and reminder-token behavior remain unchanged.

Next recommended step:
- 11.8 Task Preset Persistence, if approved separately. Persist reusable work definitions without Calendar placement or assignment behavior.

## Iteration 11.8 — Task Preset Persistence

Summary:
- Added one workspace-scoped `task_presets` table for reusable work definitions only.
- Added high-level task type, description, default needed count, future volunteer visibility, system identity, bounded custom-field definitions, lifecycle, and timestamps.
- Excluded dates, times, Calendar placement, assigned volunteers, filled counts, confirmation state, recurrence, and response data from the schema and commands.
- Added `tasks.view` read RLS and denied direct application writes.
- Added authenticated `tasks.edit` create/archive functions. Create validates and creates non-system presets only; archive accepts only a preset UUID and refuses system presets.
- Added schema support for a future trusted Lunch system preset with a required Menu definition, without seed data or scheduling behavior.
- Added strict server-only validation and read/create/archive helpers with no route imports.
- Added `npm run test:tasks` for schema scope, validation, capabilities, system boundaries, deterministic isolation, and route-cutover checks.

Changed files:
- `package.json`
- `supabase/migrations/20260701040000_task_presets.sql`
- `lib/tasks/preset.ts`
- `lib/tasks/server.ts`
- `scripts/task-persistence-regression.mjs`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`
- `docs/SUPABASE_AUTH_PERSISTENCE_READINESS.md`
- `docs/SUPABASE_LOCAL_SETUP.md`

Verification:
- `npm run test:tasks` passed.
- `npx tsc --noEmit` passed.
- `npm run lint` passed.
- `npm run build` passed with 74 generated pages/routes.
- `npm run test:calendar` passed all 17 desktop/mobile checks.
- `npm run test:workspace`, `npm run test:grants`, `npm run test:questionnaires`, and `npm run test:volunteers` passed.
- `node --check scripts/task-persistence-regression.mjs` passed.
- `git diff --check` passed with only Git's existing LF-to-CRLF checkout warnings.

Limitations:
- No `.env.local` or `supabase/config.toml` is present, so the migration/functions were not applied and live task-preset read/write isolation was not exercised.
- There is no general update command, system-preset provisioning command, seed preset, generated database type, service-role client, or audit event.
- The existing `/admin/tasks` route remains deterministic mock UI and imports no persisted task boundary.
- Calendar, Assignment, Communication, Needs Attention, public volunteer access, and reminder-token behavior remain unchanged and unpersisted.

Next recommended step:
- 11.9 Calendar Item Persistence, if approved separately. Persist scheduled occurrences without assignment or volunteer-response mutations.

## Iteration 11.9 — Calendar Item Persistence

Summary:
- Added one workspace-scoped `calendar_items` table for scheduled work and deliberate project-context items only.
- Added the explicit `timed`, `date_based`, `multi_day_window`, and `milestone` schedule shapes. Timed items use one local project date and a same-date start/end interval in this slice; multi-day windows use a later inclusive end date.
- Added a same-workspace task-preset foreign key. Creation accepts exactly one active preset reference or one validated one-off snapshot, derives preset title/type and workspace timezone in the database, and never creates a reusable preset.
- Added `calendar.view` read RLS and denied direct application writes. Authenticated create/archive functions require an effective `calendar.edit` grant; roles and workspace visibility alone do not authorize Calendar data.
- Kept planned `needed_count` separate from future assignment and response truth. The schema contains no assigned-volunteer ids or filled/confirmed/denied/waiting/open counters.
- Added strict server-only validation and read/create/archive helpers with no route imports.
- Added `npm run test:calendar-items` for schema scope, schedule/source validation, capability isolation, inactive/expired/revoked grants, and route-cutover checks.

Changed files:
- `package.json`
- `supabase/migrations/20260701050000_calendar_items.sql`
- `lib/calendar/item.ts`
- `lib/calendar/server.ts`
- `scripts/calendar-item-persistence-regression.mjs`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`
- `docs/SUPABASE_AUTH_PERSISTENCE_READINESS.md`
- `docs/SUPABASE_LOCAL_SETUP.md`
- `docs/CALENDAR_DATA_MODEL_READINESS.md`

Verification:
- `npm run lint` passed.
- `npm run build` passed with 74 generated pages/routes.
- `npm run test:calendar` passed all 17 desktop/mobile checks.
- `npm run test:workspace`, `npm run test:grants`, `npm run test:questionnaires`, `npm run test:volunteers`, and `npm run test:tasks` passed.
- `npm run test:calendar-items` passed.
- `npx tsc --noEmit` passed.
- `node --check scripts/calendar-item-persistence-regression.mjs` passed.
- `git diff --check` passed.

Limitations:
- No `.env.local` or `supabase/config.toml` is present, so the migration/functions were not applied and live Calendar item read/write isolation was not exercised.
- The first timed shape intentionally rejects overnight ranges until an unambiguous instant/end-date model is reviewed.
- There is no Calendar general-update/cancel command, assignment or response row, coverage calculation, recurrence/copy model, audit event, seed item, generated database type, service-role client, or browser write.
- Existing Calendar and Tasks routes remain deterministic mock UI and import no persisted Calendar boundary. Assignment, volunteer response, Communication, Needs Attention, public volunteer access, reminder-token, drag/drop, and broad mock-route behavior remain unchanged.

Next recommended step:
- 11.10 Assignment + Volunteer Response Persistence, if approved separately. Make assignment/response rows authoritative for coverage and review account-free public authorization before adding any public mutation.

## Iteration 11.10 — Assignment + Volunteer Response Persistence

Summary:
- Added workspace-scoped `calendar_assignments` and `assignment_responses` tables without changing Calendar item coverage columns.
- Enforced the same workspace across active timed/date-based Calendar items, active/ready volunteer profiles, assignments, and responses through composite foreign keys and derived command scope.
- Added a partial unique index preventing duplicate active assignment of one volunteer to one item while deliberately leaving cross-item conflict detection out of scope.
- New assignments create one `needs_response` row. Project contacts can apply explicit `needs_response` / `confirmed` / `declined` transitions; actor/source/timestamps are server-owned, and compare-and-set protects against silent concurrent overwrite.
- Added `assignments.view` read RLS and denied direct application writes. Authenticated create/cancel/response commands require `assignments.edit`; roles and adjacent workspace/Calendar/volunteer capabilities do not authorize assignment access.
- Added strict server-only validators and read/create/cancel/response helpers. Caller input cannot supply workspace scope, response source, scheduling fields, counters, questionnaire/emergency data, or public bearer tokens.
- Added `npm run test:assignments` for schema scope, relationship constraints, capabilities, transition rules, strict input rejection, isolation fixtures, Calendar counter absence, and route-cutover checks.

Changed files:
- `package.json`
- `supabase/migrations/20260701060000_assignment_responses.sql`
- `lib/assignments/assignment.ts`
- `lib/assignments/server.ts`
- `scripts/assignment-persistence-regression.mjs`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`
- `docs/SUPABASE_AUTH_PERSISTENCE_READINESS.md`
- `docs/SUPABASE_LOCAL_SETUP.md`
- `docs/CALENDAR_DATA_MODEL_READINESS.md`

Verification:
- `npm run lint` passed.
- `npm run build` passed with 74 generated pages/routes.
- `npm run test:calendar` passed all 17 desktop/mobile checks.
- `npm run test:workspace`, `npm run test:grants`, `npm run test:questionnaires`, `npm run test:volunteers`, `npm run test:tasks`, and `npm run test:calendar-items` passed.
- `npm run test:assignments` passed.
- `npx tsc --noEmit` passed.
- `node --check scripts/assignment-persistence-regression.mjs` passed.
- `git diff --check` passed.

Limitations:
- No `.env.local` or `supabase/config.toml` is present, so the migration/functions were not applied and live assignment/response RLS isolation was not exercised.
- Only project-contact response mutation exists. There is no public token/verifier, public response source, reminder link authorization, public route, or volunteer account.
- There is no response history, full audit event, assignment general edit/archive command, cross-item conflict check, capacity enforcement, waitlist/overbooking behavior, coverage query, seed row, generated database type, service-role client, or browser write.
- Existing Calendar, Tasks, Volunteers, public volunteer, Communication, and Needs Attention routes remain deterministic mock UI and import no persisted assignment boundary. Drag/drop, recurrence, reminders, and broad mock-route behavior remain unchanged.

Next recommended step:
- 11.11 Public Volunteer Response Authorization Foundation, if approved separately. Design high-entropy, hashed, expiring, revocable, assignment-scoped bearer access before connecting any account-free response route.

## Iteration 11.11 — Public Volunteer Response Authorization Foundation

Summary:
- Added one `assignment_response_tokens` table scoped by workspace, assignment, volunteer profile, and fixed `assignment_response` purpose.
- Added a composite assignment/workspace/volunteer foreign key, 1–720 hour expiry, revocation/use timestamps, bounded internal note, and creator metadata.
- Issuance requires `assignments.edit`, generates 32 random bytes inside PostgreSQL, returns a base64url bearer once, and stores only a unique SHA-256 verifier. Token rows have no anon/authenticated table privileges or read policies.
- Added anon-safe security-definer verification that returns only workspace display name, assignment reference, task title snapshot, schedule fields, timezone, and current response status.
- Added a distinct bearer response command accepting only `confirmed`/`declined` plus a bounded note. It derives all scope from a valid unexpired/unrevoked token, verifies active workspace/item/assignment/volunteer relationships, locks token/response rows, records `public_token`, and updates `last_used_at`.
- Added strict server-only issuance/revocation and public verification/response helpers. Inputs reject unknown keys, caller-supplied hashes/scope/source, lookup/query shapes, sensitive questionnaire/emergency data, and coverage counters.
- Added `npm run test:response-tokens` for hash-only storage, entropy, expiry/revocation, capability issuance, direct-read denial, safe public projection, scoped mutation, validation, and route isolation.

Changed files:
- `package.json`
- `supabase/migrations/20260701070000_assignment_response_tokens.sql`
- `lib/assignments/assignment.ts`
- `lib/responseTokens/token.ts`
- `lib/responseTokens/server.ts`
- `scripts/response-token-persistence-regression.mjs`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`
- `docs/SUPABASE_AUTH_PERSISTENCE_READINESS.md`
- `docs/SUPABASE_LOCAL_SETUP.md`
- `docs/CALENDAR_DATA_MODEL_READINESS.md`

Verification:
- `npm run lint` passed.
- `npm run build` passed with 74 generated pages/routes.
- `npm run test:calendar` passed all 17 desktop/mobile checks.
- `npm run test:workspace`, `npm run test:grants`, `npm run test:questionnaires`, `npm run test:volunteers`, `npm run test:tasks`, `npm run test:calendar-items`, and `npm run test:assignments` passed.
- `npm run test:response-tokens` passed.
- `npx tsc --noEmit` passed.
- `node --check scripts/response-token-persistence-regression.mjs` passed.
- `git diff --check` passed.

Limitations:
- No `.env.local` or `supabase/config.toml` is present, so the migration/functions were not applied and live issuance, verification, revocation, expiry, public mutation isolation, or concurrency was not exercised.
- There is no route consuming a token, link construction/transport, email/text sending, reminder delivery, broad lookup, remembered-device state, response history, rate-limit/abuse boundary, or token metadata UI.
- The bearer remains authority until expiry or revocation and forwarding transfers that authority. Verification does not consume the token; a successful response updates `last_used_at`.
- Existing public volunteer/reminder, Calendar, Volunteers, Communication, and Needs Attention routes remain deterministic mocks and import no token helper. No generated database type, service-role client, seed token, or secret is committed.

Next recommended step:
- Apply migrations 11.4–11.11 to a configured non-production Supabase project and exercise real two-user issuance isolation plus anon verification/response, expiry, revocation, forwarding, and concurrent mutation before any public route or delivery integration.

## Iteration 11.12 — Public Assignment Response Route Shell

Summary:
- Added the dynamic `/respond/[token]` route as the first narrow consumer of the validated 11.11 public-token boundary.
- Verification calls only `readAssignmentResponseByToken`; submission calls only `submitAssignmentResponseByToken` and accepts `confirmed`/`declined` plus the existing bounded optional note. The browser supplies no workspace, assignment, volunteer, source, actor, or scope.
- Added server-only route mapping that projects only workspace display name, task snapshot, schedule kind/date/time/timezone, and current response status. It maps malformed/unavailable links, missing configuration, SQLSTATE `40001` concurrency, success, and unexpected errors to calm non-specific states.
- Added a server action with no direct RPC/table access, no service-role access, and no bearer logging. The page is dynamic, non-indexed, and no-referrer; success remains on the direct response route.
- Expanded `test:response-tokens` to enforce the route/helper boundary, allowed statuses, malformed-token state, safe copy, mock-data isolation, and absence of service-role/sensitive-field imports.
- Kept the existing landing page, volunteer/reminder previews, Calendar, Volunteers, Communications, and Needs Attention routes unchanged and mock-only.

Changed files:
- `app/respond/[token]/actions.ts`
- `app/respond/[token]/page.tsx`
- `lib/responseTokens/publicRoute.ts`
- `lib/responseTokens/publicRouteState.ts`
- `scripts/response-token-persistence-regression.mjs`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`
- `docs/SUPABASE_AUTH_PERSISTENCE_READINESS.md`

Verification:
- `npm run supabase:check` passed against the configured local Auth health endpoint.
- `npm run test:workspace`, `npm run test:grants`, `npm run test:questionnaires`, `npm run test:volunteers`, `npm run test:tasks`, `npm run test:calendar-items`, `npm run test:assignments`, and `npm run test:response-tokens` passed.
- `npm run lint`, `npm run build`, and `npx tsc --noEmit` passed; the build emitted `/respond/[token]` as a dynamic route.
- `npm run test:calendar` passed all 17 desktop/mobile checks against the production preview.
- `git diff --check` passed.

Limitations:
- No link is created, sent, delivered, or added to an existing route. A future delivery slice must separately review transport, abuse/rate limits, operational revocation, and bearer-forwarding risk.
- There is no broad volunteer lookup, remembered-device access, admin assignment UI, response history, coverage workflow, or mock volunteer-portal replacement.
- Calendar, Volunteers, Communications, and Needs Attention remain mock-only and do not import the response route boundary.

Next recommended step:
- Review the smallest safe link-delivery and abuse-control boundary separately before connecting any reminder or Communications workflow. Do not combine that work with broad lookup, remembered devices, or unrelated route cutovers.

## Iteration 11.13 — Public Response Route Valid-Token QA Gate

Summary:
- Added `npm run test:response-route` and a local-only Playwright/PostgreSQL harness for the real `/respond/[token]` route.
- The harness refuses non-loopback Supabase/preview URLs, requires a running local stack and production preview, creates a disposable local Auth identity plus minimum workspace-to-token fixture chain, and uses the reviewed authenticated RPCs for questionnaire conversion, task/Calendar/assignment creation, and token issuance.
- It verifies only safe assignment context is rendered, sensitive/unrelated fixture markers stay hidden, the bearer is absent from visible and non-script markup, route submission records `confirmed` from `public_token`, `last_used_at` is populated, and the calm success state renders.
- Cleanup runs in `finally`, removes token/response/assignment/Calendar/task/volunteer/questionnaire/grant/contact/workspace/Auth rows, and verifies zero residue. Two consecutive fresh-fixture runs passed.
- The gate found two narrow route bugs: bound server-action arguments emitted the bearer in a hidden input, and an untouched note submitted `""` to a validator that requires `null` or non-empty text. The route now uses an encrypted inline server-action closure and normalizes blank notes to `null`.
- No database migration, route link, delivery behavior, lookup, remembered-device behavior, admin generation UI, or mock route integration was added.

Changed files:
- `app/respond/[token]/actions.ts`
- `app/respond/[token]/page.tsx`
- `package.json`
- `scripts/response-route-valid-token-regression.mjs`
- `scripts/response-token-persistence-regression.mjs`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`
- `docs/SUPABASE_AUTH_PERSISTENCE_READINESS.md`
- `docs/SUPABASE_LOCAL_SETUP.md`

Verification:
- `npm run test:response-route` passed twice with fresh disposable fixtures and complete cleanup.
- `npm run supabase:check` passed against the local Auth health endpoint.
- All workspace, grant, questionnaire, volunteer, task, Calendar-item, assignment, and response-token regression commands passed.
- `npm run lint`, `npm run build`, `npm run test:calendar`, `npx tsc --noEmit`, and `git diff --check` passed.

Limitations:
- The harness requires an already running production preview and local Supabase/Docker; it does not start services or target hosted environments.
- No email/reminder delivery, public lookup, remembered-device access, admin link generation, Calendar/Volunteers route cutover, Communications/Needs Attention persistence, seed data, or mock-to-real integration exists.

Next recommended step:
- Review link transport, abuse/rate-limit controls, and operational revocation separately before any delivery integration.

## Iteration 11.14 — Project Contact Response Link Issuance Preview Boundary

Summary:
- Added server-only `issueAssignmentResponseLink` and `issueAssignmentResponseLinkWithClient` helpers that compose the existing reviewed token issuers instead of duplicating RPC calls.
- Added strict runtime validation for assignment id, optional 1–720 hour TTL, and trusted application origin. Loopback HTTP and deployed HTTPS origins are supported; unsafe schemes, non-loopback HTTP, credentials, paths, queries, fragments, whitespace, and unknown fields are rejected.
- The structured result contains one in-memory `/respond/[token]` URL, expiration metadata, and a redacted display URL. It exposes no separate bearer, token id, verifier/hash, workspace, volunteer, actor, source, or purpose and performs no logging or storage.
- Added `npm run test:response-link`. Its local-only disposable harness authenticates a contact with `assignments.edit`, exercises the server-only orchestration, verifies route shape/public verification/hash-only storage, prints only a redacted URL, and proves zero-residue cleanup. Two fresh-fixture runs passed.
- Added the standard `server-only` marker dependency so standalone regression execution can load the exact server-only module under the React server condition used by the QA command.
- Static checks prove no route imports the issuer, the production wrapper makes no direct RPC/table call, diagnostics are redacted, and no service-role path exists.

Changed files:
- `lib/responseTokens/link.ts`
- `lib/responseTokens/link.server.ts`
- `scripts/response-link-issuance-regression.mjs`
- `scripts/response-token-persistence-regression.mjs`
- `package.json`
- `package-lock.json`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`
- `docs/SUPABASE_AUTH_PERSISTENCE_READINESS.md`
- `docs/SUPABASE_LOCAL_SETUP.md`

Verification:
- `npm run test:response-link` passed twice with fresh disposable fixtures and complete cleanup.
- `npm run supabase:check`, every workspace-through-response-token regression, and the existing valid-token route QA passed.
- `npm run lint`, `npm run build`, `npm run test:calendar`, `npx tsc --noEmit`, and `git diff --check` passed.

Limitations:
- No route, component, admin surface, Communications/reminder flow, or template imports the link issuer. Nothing creates or displays a link for a real user.
- No email/reminder delivery, public lookup, remembered-device access, Calendar/Volunteers route cutover, Communications/Needs Attention persistence, seed data, service-role usage, or mock-to-real integration was added.

Next recommended step:
- Review the smallest visible project-contact issuance UX together with audit, abuse/rate-limit, revocation, and delivery boundaries before connecting this helper anywhere.

## Iteration 11.15 — Response Link Admin Diagnostic Preview

Summary:
- Added the dynamic, noindex, unlinked `/admin/diagnostics/response-link` developer/admin QA route.
- The page explicitly requires `readProjectContactSession`; review mode does not bypass this diagnostic identity check, and enforced mode retains the existing proxy check.
- Added `readResponseLinkDiagnosticConfiguration`, `issueResponseLinkDiagnostic`, and `issueResponseLinkDiagnosticAction`. The browser submits only assignment id/TTL; `RESPONSE_LINK_BASE_URL` is read and validated server-side.
- Link creation calls only the 11.14 `issueAssignmentResponseLink` boundary. Database Auth, `assignments.edit`, and server-derived workspace/volunteer/actor/purpose/scope enforcement remain unchanged.
- The mapper strips the full response URL. Success displays only assignment id, expiration, and `/respond/[redacted]`; failures use calm configuration/invalid/unavailable/generic states, and no link is sent.
- Extended static regression coverage for noindex/session/configuration behavior, malformed input, redacted-only output, direct-RPC/service-role absence, and zero links/imports from nav, product, template, public, or mock surfaces.

Changed files:
- `.env.example`
- `app/admin/diagnostics/response-link/actions.ts`
- `app/admin/diagnostics/response-link/page.tsx`
- `lib/responseTokens/diagnostic.server.ts`
- `scripts/response-token-persistence-regression.mjs`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`
- `docs/SUPABASE_AUTH_PERSISTENCE_READINESS.md`
- `docs/SUPABASE_LOCAL_SETUP.md`

Verification:
- `npm run supabase:check`, every workspace-through-response-token regression, the valid-token route QA, and the response-link issuance QA passed.
- `npm run lint`, `npm run build`, `npm run test:calendar`, `npx tsc --noEmit`, and `git diff --check` passed.
- Build output includes `/admin/diagnostics/response-link` as a dynamic route.
- Positive route automation was intentionally skipped because a cookie-backed diagnostic pass would duplicate the 11.13 Auth/browser fixture framework; 11.14 continues to provide the positive live issuance/hash-only/verification/cleanup gate.

Limitations:
- This route is unlinked diagnostic infrastructure, not product UI. It deliberately discards the full link from its response, so it cannot deliver or copy a usable credential.
- Issued-but-undelivered token cleanup/revocation, audit, abuse/rate limits, visible assignment selection, Communications/reminder integration, and product UX remain unresolved.
- No email/reminder delivery, public lookup, remembered-device access, Calendar/Volunteers route cutover, Communications/Needs Attention persistence, seed data, service-role usage, or mock-to-real integration was added.

Next recommended step:
- Design audit and immediate cleanup/revocation semantics for diagnostic-only issuance before considering any product-facing generation or delivery surface.

## Iteration 11.16 — Response Token Cleanup and Revocation Readiness Guardrail

Summary:
- Audited the existing 11.11 revocation helper/RPC and retained it as the only revocation path: authenticated token-id input, active `assignments.edit` grant, `revoked_at` mutation, and no deletion.
- Extended the server-only response-link result with token id solely for lifecycle control. Raw bearer storage and route exposure remain prohibited.
- Tightened `issueResponseLinkDiagnostic` so every diagnostic-issued token is revoked in `finally` before redacted success returns. The mapper still strips token id/full URL from the action and page.
- Extended live local `test:response-link` coverage: revocation is denied without `assignments.edit`, succeeds with it, revoked tokens fail public verification and response, response truth remains unchanged, and the hash-only revoked row remains for audit.
- Added static checks prohibiting token deletion and token-id/verifier/bearer/full-URL exposure from the unlinked 11.15 route.
- Added no helper for deletion/listing, cleanup script, cron, job, product UI, copy-link behavior, delivery, or service-role access.

Changed files:
- `lib/responseTokens/link.ts`
- `lib/responseTokens/diagnostic.server.ts`
- `scripts/response-link-issuance-regression.mjs`
- `scripts/response-token-persistence-regression.mjs`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`
- `docs/SUPABASE_AUTH_PERSISTENCE_READINESS.md`
- `docs/SUPABASE_LOCAL_SETUP.md`

Verification:
- Live local revocation authorization, revoked verification rejection, revoked response rejection, response preservation, retained hash-only row, and fixture cleanup passed.
- `npm run supabase:check`, every workspace-through-response-token regression, valid-token route QA, and response-link QA passed.
- `npm run lint`, `npm run build`, `npm run test:calendar`, `npx tsc --noEmit`, and `git diff --check` passed.

Limitations:
- Immediate revocation applies only to the redacted diagnostic that discards its credential. There is no general expired-token scanner, background cleanup, deletion policy, or UI.
- Product use still needs deliberate full-link display authority, replacement/revocation rules, delivery audit, retention/cleanup policy, abuse controls, and recovery from revocation failure.
- No email/reminder delivery, public lookup, remembered-device behavior, copy-link UI, Calendar/Volunteers route cutover, Communications/Needs Attention persistence, seed data, service-role usage, or mock-to-real integration was added.

Next recommended step:
- Define the product token lifecycle and delivery audit contract before exposing any usable full link.

## Iteration 11.17 — Response Link Product Lifecycle Policy

Summary:
- Added a server-only response-link policy module with a 72-hour product default, 168-hour product maximum, fixed one-hour diagnostic TTL, fail-closed replacement rules, hash-only audit retention, full-link exposure conditions, and delivery prerequisites.
- Applied the product TTL policy to the existing 11.14 link boundary and the fixed diagnostic policy to 11.15. Diagnostic redaction and immediate revocation are unchanged.
- Recorded that product replacement must atomically revoke older active tokens for the same assignment/purpose before issuing one replacement. The current database cannot perform that transaction, so product display/delivery remains blocked pending a future migration/RPC.
- Extended focused regression coverage for TTL bounds/defaults, fail-closed policy, audit fields, diagnostic redaction/revocation, no route policy imports, no copy-link path, no service-role path, and no token deletion.

Changed files:
- `lib/responseTokens/policy.ts`
- `lib/responseTokens/link.ts`
- `lib/responseTokens/diagnostic.server.ts`
- `app/admin/diagnostics/response-link/page.tsx`
- `scripts/response-token-persistence-regression.mjs`
- `tsconfig.json`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`
- `docs/SUPABASE_AUTH_PERSISTENCE_READINESS.md`
- `docs/SUPABASE_LOCAL_SETUP.md`

Verification:
- The full workspace-through-response-token regression matrix, valid-token route QA, response-link issuance/revocation QA, lint, production build, Calendar browser regression, TypeScript check, and diff check passed.
- Live-local QA used disposable fixtures and removed them in `finally`; no bearer, full response URL, verifier, password, or access token was logged.

Limitations:
- No atomic same-assignment/purpose replacement command exists yet. The policy is fail-closed and does not claim product replacement is ready.
- Full-link display/delivery still requires a deliberate future slice with an explicit audited surface, delivery audit, failure recovery, and abuse controls.
- No email/reminder delivery, public lookup, remembered-device behavior, copy-link UI, Calendar/Volunteers route cutover, Communications/Needs Attention persistence, seed data, service-role usage, token deletion, background job, or mock-to-real integration was added.

Next recommended step:
- Add the reviewed atomic replacement migration/RPC before building any usable product reveal or delivery surface.

## Iteration 11.18 — Atomic Response Link Replacement RPC

Summary:
- Added `replace_assignment_response_token(uuid, integer)` as an authenticated security-definer RPC. It requires an active `assignments.edit` grant, derives all scope, revokes older unrevoked same-assignment/purpose tokens, inserts one hash-only replacement, and returns its bearer once in one transaction.
- Replacement locks the target assignment row. Concurrent calls serialize per assignment; a later replacement revokes the earlier replacement, leaving exactly one usable token without global locking.
- Added `replaceAssignmentResponseToken`, `replaceAssignmentResponseTokenWithClient`, `issueReplacementAssignmentResponseLink`, and `issueReplacementAssignmentResponseLinkWithClient` as server-only typed boundaries. No route imports them.
- Updated the 11.17 policy from future-required to atomically enforced while retaining fail-closed behavior, the 72-hour default, 168-hour maximum, hash-only audit retention, and explicit future full-link exposure requirements.
- Extended local live QA to prove authorization rollback, old-token rejection, replacement verification/submission, TTL rejection rollback, hash-only storage, and concurrent single-active-token state. Two fresh disposable runs passed with zero residue.

Changed files:
- `supabase/migrations/20260702000000_atomic_response_token_replacement.sql`
- `lib/responseTokens/replacement.server.ts`
- `lib/responseTokens/replacementLink.server.ts`
- `lib/responseTokens/policy.ts`
- `lib/supabase/database.types.ts`
- `scripts/response-token-persistence-regression.mjs`
- `scripts/response-link-issuance-regression.mjs`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`
- `docs/SUPABASE_AUTH_PERSISTENCE_READINESS.md`
- `docs/SUPABASE_LOCAL_SETUP.md`

Verification:
- Fresh local migrations applied without seed data through `20260702000000`.
- The full workspace-through-response-token regression matrix, valid-token route QA, response-link/replacement QA twice, lint, production build, Calendar browser regression, TypeScript check, and diff check passed.
- No bearer, full response URL, verifier, password, or access token was logged by the QA harnesses.

Limitations:
- The replacement/link helpers remain unused by visible routes. No full-link display, copy control, email/reminder delivery, lookup, route cutover, token deletion, job, or service-role path exists.
- Product link display/delivery still requires a deliberate audited surface, delivery audit/provider boundary, failure recovery, and abuse/rate-limit controls.

Next recommended step:
- Design the explicit audited product reveal and delivery boundary before exposing any usable replacement link.

## Iteration 11.19 — Hosted Staging Migration + Atomic Replacement Validation Gate

Summary:
- Reconfirmed the linked target as healthy non-production `project-local-staging` (`kfuujcfxoayukywvtaeh`) and applied only `20260702000000_atomic_response_token_replacement.sql` without reset or seed data.
- Added explicit-opt-in `npm run test:response-replacement:hosted`. It refuses any other ref/name, verifies hosted migration state, uses disposable `qa-11-19-*` records, redacts credentials, and cleans product/Auth rows in `finally`.
- Two fresh hosted runs proved real Auth/`assignments.edit` authorization, denied-operation rollback, old-token verification/submission rejection, replacement verification/submission, hash-only storage, 169-hour rejection, and concurrent single-active-token state.
- Per-run cleanup and a final namespace audit both reported zero workspace/Auth residue. No temporary database helper, trigger, role, password file, or tracked artifact was created.
- Reviewed hosted generated types. They structurally match the local public schema and replacement RPC; the only difference is remote PostgREST metadata, so the tracked generated file remains unchanged.

Changed files:
- `scripts/hosted-response-replacement-regression.mjs`
- `scripts/response-token-persistence-regression.mjs`
- `package.json`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`
- `docs/SUPABASE_AUTH_PERSISTENCE_READINESS.md`
- `docs/SUPABASE_LOCAL_SETUP.md`

Verification:
- Hosted migration history reports `20260702000000` locally and remotely.
- Hosted replacement validation passed twice with zero residue.
- The complete local Supabase, persistence, route, response-link, lint, build, Calendar browser, TypeScript, and diff baseline passed.

Limitations:
- This is hosted non-production validation only. No route reads staging data, and no usable full-link UI or delivery path exists.
- No email/reminder delivery, public lookup, remembered-device behavior, copy-link UI, Calendar/Volunteers cutover, Communications/Needs Attention persistence, seed data, service-role usage, token deletion, background job, or mock-to-real integration was added.

Next recommended step:
- Keep the hosted gate as an explicit release check while designing the future audited product reveal and delivery boundary separately.

## Iteration 11.20 — Audited Response Link Reveal Boundary Planning

Summary:
- Added server-only `responseLinkRevealPolicy`, `describeResponseLinkRevealPrerequisites`, `canCurrentSurfaceRevealFullResponseLink`, and `evaluateFutureResponseLinkReveal` guardrails.
- Defined the only eligible future surface and its required verified contact, database `assignments.edit`, atomic replacement, trusted server origin, explicit POST action, dynamic/no-store response, bounded TTL, audit-write, logging, and clipboard sequencing rules.
- Added a planned `response_link_revealed` audit-event type/field contract. It retains scope/actor/token ids, surface/mode, expiry/time, and bounded metadata while explicitly prohibiting bearer, full URL, verifier, credentials, and sensitive volunteer data.
- Kept `RESPONSE_LINK_REVEAL_AUDIT_PERSISTENCE_AVAILABLE` false because no audit table/command exists. Even an otherwise-ready future request remains blocked with `audit_persistence_boundary_missing`; every current route/surface returns false.
- Extended focused static checks for no full-link/reveal helper route imports, no unsafe credential output, no clipboard/copy-link UI, diagnostic redaction/immediate revocation, hosted-gate opt-in, no service-role path, and no token deletion.

Changed files:
- `lib/responseTokens/revealPolicy.server.ts`
- `lib/responseTokens/policy.ts`
- `scripts/response-token-persistence-regression.mjs`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`
- `docs/SUPABASE_AUTH_PERSISTENCE_READINESS.md`

Verification:
- The full local Supabase, workspace-through-response-token, valid-token route, response-link, lint, build, Calendar browser, TypeScript, and diff baseline passed.
- Hosted validation was not rerun because 11.20 changes no migration, generated type, replacement RPC, or hosted gate behavior.

Limitations:
- No audit persistence boundary exists, so no current or future runtime path can pass the reveal policy yet.
- No full-link route, copy control, email/reminder delivery, lookup, remembered-device behavior, route cutover, seed, service-role path, token deletion, job, or mock-to-real integration was added.

Next recommended step:
- Design the narrow authenticated audit persistence command and its failure/transaction relationship to replacement before creating any reveal UI.

## Iteration 11.21 — Response Link Reveal Audit Persistence

Summary:
- Added migration `20260703000000_response_link_reveal_audit.sql` with command-only `assignment_response_link_reveal_events`, composite token scope, fixed action/surface/modes, tightly allowlisted metadata, no free-form note, RLS, and no anon/authenticated table privileges.
- Added authenticated security-definer `record_assignment_response_link_reveal_event`. It requires an active `assignments.edit` grant, derives workspace and actor, locks and validates a live matching token/expiry, and returns only credential-free event metadata.
- Added `recordAssignmentResponseLinkRevealAudit` and `recordAssignmentResponseLinkRevealAuditWithClient` with strict runtime input/result validation and no full-link helper import.
- Set audit persistence availability true while adding a separate false product-surface flag. Reveal remains fail-closed with `explicit_product_surface_missing`; current routes remain ineligible.
- Extended local live QA for anon/authenticated table denial, real Auth/capability, wrong-scope/revoked/expired rejection, metadata allowlisting/bounds, exact safe persistence, replacement/public response compatibility, and zero residue.
- Regenerated and reviewed local public-schema types for the new table, validator, and RPC.

Changed files:
- `supabase/migrations/20260703000000_response_link_reveal_audit.sql`
- `lib/responseTokens/revealAudit.server.ts`
- `lib/responseTokens/revealPolicy.server.ts`
- `lib/supabase/database.types.ts`
- `scripts/response-token-persistence-regression.mjs`
- `scripts/response-link-issuance-regression.mjs`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`
- `docs/SUPABASE_AUTH_PERSISTENCE_READINESS.md`
- `docs/SUPABASE_LOCAL_SETUP.md`

Verification:
- Fresh local migrations applied without seed data through `20260703000000`.
- The full local Supabase, workspace-through-response-token, valid-token route, response-link/audit, lint, build, Calendar browser, TypeScript, and diff baseline passed.
- Hosted validation was intentionally deferred; staging remains at the previously validated `20260702000000` until a dedicated 11.21 hosted gate.

Limitations:
- Audit persistence does not reveal, copy, display, email, or send a response link. No current route imports the command.
- A future reviewed product server action must still coordinate atomic replacement, successful audit, and one-time credential response with explicit failure semantics.
- No email/reminder delivery, lookup, remembered-device behavior, copy UI, route cutover, seed, service-role path, token deletion, background job, or mock-to-real integration was added.

Next recommended step:
- Run a dedicated hosted non-production migration/audit validation gate before designing the explicit product reveal transaction.

## Iteration 11.22 — Hosted Staging Migration + Reveal Audit Validation Gate

Summary:
- Reconfirmed healthy non-production `project-local-staging` (`kfuujcfxoayukywvtaeh`) and applied only pending `20260703000000_response_link_reveal_audit.sql`, without reset or seed data.
- Added exact-opt-in `npm run test:response-reveal-audit:hosted`; it refuses every other target, verifies migration state, uses disposable `qa-11-22-*` product/Auth fixtures, suppresses credential output, and cleans in `finally`.
- Two fresh hosted runs proved direct anon/authenticated table denial, Auth plus `assignments.edit`, wrong-assignment/revoked/expired-token rejection, metadata allowlisting/bounds, correctly scoped credential-free event persistence, and existing atomic-replacement compatibility.
- Exact-run and namespace cleanup checks returned zero residue. Hosted generated types matched the local schema structurally; only remote PostgREST metadata differed, so tracked types were not overwritten.

Changed files:
- `scripts/hosted-response-reveal-audit-regression.mjs`
- `scripts/response-token-persistence-regression.mjs`
- `package.json`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`
- `docs/SUPABASE_AUTH_PERSISTENCE_READINESS.md`
- `docs/SUPABASE_LOCAL_SETUP.md`

Verification:
- Hosted migration history reports `20260703000000` locally and remotely.
- The hosted audit gate passed twice with product/Auth residue `0` each time.
- The complete local Supabase, persistence, route, response-link, lint, build, Calendar browser, TypeScript, and diff baseline passed.

Limitations:
- This is hosted non-production validation only. It reveals, copies, displays, emails, and sends no response link, and no route reads staging data.
- Product reveal remains blocked until a future explicit server action coordinates atomic replacement, successful audit persistence, and one-time credential response.
- No delivery, lookup, remembered device, copy UI, route cutover, seed data, app service-role path, token deletion, background job, or mock-to-real integration was added.

Next recommended step:
- Design the explicit transactional product reveal server action separately; keep current routes fail-closed.

## Iteration 11.23 — Audited Product Reveal Server Action Contract

Summary:
- Added `20260704000000_audited_response_link_reveal.sql` with authenticated security-definer `reveal_assignment_response_link`.
- The assignment-scoped transaction derives scope/actor, enforces active `assignments.edit`, revokes older response tokens, creates one hash-only replacement, writes its credential-free audit event, and returns the bearer only after both mutations succeed.
- Added unused server-only `createAuditedAssignmentResponseLinkReveal` / `createAuditedAssignmentResponseLinkRevealWithClient` helpers for policy-bounded TTL, mode/metadata, trusted-origin validation, in-memory URL construction, and redacted diagnostics.
- Added transactional-command policy readiness while preserving false product-surface readiness and the `explicit_product_surface_missing` blocker for every current route.
- Extended live local QA for Auth/capability denial with no mutation, TTL/mode/metadata rollback, old-token revocation, new-token public verification/submission, exact credential-free audit coupling, and concurrent single-active-token behavior.

Changed files:
- `supabase/migrations/20260704000000_audited_response_link_reveal.sql`
- `lib/responseTokens/auditedReveal.server.ts`
- `lib/responseTokens/revealPolicy.server.ts`
- `lib/supabase/database.types.ts`
- `scripts/response-token-persistence-regression.mjs`
- `scripts/response-link-issuance-regression.mjs`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`
- `docs/SUPABASE_AUTH_PERSISTENCE_READINESS.md`
- `docs/SUPABASE_LOCAL_SETUP.md`

Verification:
- Fresh local migrations applied without seed data through `20260704000000`.
- Focused static and disposable live reveal checks passed with zero fixture residue.
- The full local Supabase, persistence, route, response-link, lint, build, Calendar browser, TypeScript, and diff baseline passed.
- Hosted validation was intentionally deferred to a later gate; staging remains at validated `20260703000000`.

Limitations:
- No current route imports the helper or can reveal/copy a full link. The bearer/full URL exists only transiently in the server-only return value and is never stored or logged.
- No delivery, lookup, remembered device, copy UI, route cutover, seed data, app service-role path, token deletion, background job, or mock-to-real integration was added.

Next recommended step:
- Run a dedicated hosted non-production migration and transactional reveal validation gate before designing any explicit product surface.

## Iteration 11.24 — Hosted Staging Migration + Audited Reveal Validation Gate

Summary:
- Reconfirmed healthy non-production `project-local-staging` (`kfuujcfxoayukywvtaeh`) and applied only pending `20260704000000_audited_response_link_reveal.sql`, without reset or seed data.
- Added exact-opt-in `npm run test:response-reveal:hosted`; it refuses every other target, verifies migration state, uses disposable `qa-11-24-*` product/Auth fixtures, suppresses credential output, and cleans in `finally`.
- Two fresh hosted runs proved unauthenticated and missing-capability denial, TTL/mode/metadata rollback without mutation, old-token revocation, one hash-only replacement plus one credential-free audit, public verification/submission, and concurrent single-active-token behavior.
- Existing hosted replacement and reveal-audit checks remained compatible. Exact-run and namespace cleanup checks returned zero residue.
- Hosted generated types matched the local schema structurally; only remote PostgREST metadata differed, so tracked types were not overwritten.

Changed files:
- `scripts/hosted-response-reveal-regression.mjs`
- `scripts/response-token-persistence-regression.mjs`
- `package.json`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`
- `docs/SUPABASE_AUTH_PERSISTENCE_READINESS.md`
- `docs/SUPABASE_LOCAL_SETUP.md`

Verification:
- Hosted migration history reports `20260704000000` locally and remotely.
- The hosted audited-reveal gate passed twice with product/Auth residue `0` each time.
- The complete local Supabase, persistence, route, response-link, lint, build, Calendar browser, TypeScript, and diff baseline passed.

Limitations:
- This is hosted non-production validation only. It reveals, copies, displays, emails, and sends no response link through product UI, and no route reads staging data.
- Product reveal remains blocked until a future explicit reviewed product surface is added.
- No delivery, lookup, remembered device, copy UI, route cutover, seed data, app service-role path, token deletion, background job, or mock-to-real integration was added.

Next recommended step:
- Design any future explicit reveal surface as a separate reviewed product slice; keep current routes fail-closed.

## Iteration 11.25 — Response Link Product Surface Readiness Review

Summary:
- Added a server-only, route-unused product-surface planning contract. It selects a future persisted project-contact assignment-detail action as the first eligible reveal location and keeps implementation availability false.
- Defined the future action as verified-contact, database-`assignments.edit`, POST-only, dynamic/no-store, explicit-action-only, trusted-origin-only, and non-prefetchable. Route code must use the transactional audited-reveal helper as one boundary.
- Restricted browser inputs to assignment id and optional TTL; workspace/actor/volunteer/token/bearer/verifier/origin/mode/audit metadata remain prohibited or server-derived.
- Defined warning, visible-expiry, post-success-only manual-copy, no automatic clipboard, no credential logging, and no render/page-load/prefetch reveal requirements.
- Strengthened static checks for no audited-reveal/replacement-link/RPC use in routes or components, no active copy-link text/clipboard behavior, false product-surface flags, and continued diagnostic isolation.

Changed files:
- `lib/responseTokens/productSurfacePolicy.server.ts`
- `scripts/response-token-persistence-regression.mjs`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`
- `docs/SUPABASE_AUTH_PERSISTENCE_READINESS.md`

Verification:
- The full local Supabase, persistence, route, response-link, lint, build, Calendar browser, TypeScript, and diff baseline passed.
- Hosted validation was intentionally skipped because 11.25 changes no migration, generated type, hosted gate, or database behavior.

Limitations:
- No current route can reveal or copy a full link. `RESPONSE_LINK_REVEAL_PRODUCT_SURFACE_AVAILABLE` remains false.
- No email/reminder delivery, lookup, remembered device, copy UI, route cutover, seed data, app service-role path, token deletion, background job, or mock-to-real integration was added.

Next recommended step:
- Build and review the persisted project-contact assignment-detail context and its POST-only action in a separate slice; do not enable product reveal until its warning, expiry, no-prefetch, logging, and browser-security checks pass.

## Iteration 11.26 — Persisted Assignment Detail Context Readiness

Summary:
- Added `20260705000000_assignment_detail_context.sql` with authenticated security-definer `read_assignment_detail_context(uuid)`.
- The command enforces an active `assignments.view` grant and returns one safe active assignment projection across workspace, Calendar item, volunteer label, and current response without requiring broad `calendar.view` or `volunteers.view`.
- Added server-only `readAssignmentDetailContext` / `readAssignmentDetailContextWithClient` with exact assignment-id input and strict runtime result validation.
- Added `RESPONSE_LINK_ASSIGNMENT_DETAIL_CONTEXT_AVAILABLE = true`; product-surface implementation and reveal availability remain false.
- Added disposable local `npm run test:assignment-detail-context` coverage for Auth, capability, cross-workspace, missing/canceled context, safe field shape, edit boolean, route isolation, and zero residue.
- Regenerated local public-schema types for the new RPC.

Changed files:
- `supabase/migrations/20260705000000_assignment_detail_context.sql`
- `lib/assignments/detailContext.server.ts`
- `lib/responseTokens/productSurfacePolicy.server.ts`
- `lib/supabase/database.types.ts`
- `scripts/assignment-detail-context-regression.mjs`
- `scripts/response-token-persistence-regression.mjs`
- `package.json`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`
- `docs/SUPABASE_AUTH_PERSISTENCE_READINESS.md`
- `docs/SUPABASE_LOCAL_SETUP.md`

Verification:
- Fresh local migrations applied without seed data through `20260705000000`.
- Focused assignment-detail live/static QA passed with zero fixture/Auth residue.
- The complete local Supabase, persistence, route, response-link, lint, build, Calendar browser, TypeScript, and diff baseline passed.
- Hosted validation was intentionally deferred to 11.27 because this slice adds a migration/RPC.

Limitations:
- No route imports the helper; current mock routes remain mock-only. The command reads no response-token or questionnaire table and performs no reveal action.
- No email/reminder delivery, lookup, remembered device, copy UI, route cutover, seed data, app service-role path, token deletion, background job, or mock-to-real integration was added.

Next recommended step:
- Run a dedicated hosted non-production migration and assignment-detail validation gate before designing the separate reviewed reveal POST action/UI.

## Iteration 11.27 — Hosted Staging Migration + Assignment Detail Context Validation Gate

Summary:
- Reconfirmed healthy non-production `project-local-staging` (`kfuujcfxoayukywvtaeh`) and applied only pending `20260705000000_assignment_detail_context.sql`, without reset or seed data.
- Added exact-opt-in `npm run test:assignment-detail-context:hosted`; it refuses every other target, verifies migration state, uses disposable `qa-11-27-*` product/Auth fixtures, suppresses credential output, and cleans in `finally`.
- Two fresh hosted runs proved unauthenticated denial; under-capability, cross-workspace, missing, canceled, archived, and inactive-context no-row behavior; assignments-only safe projection without Calendar/Volunteers capabilities; edit-as-boolean; and forbidden-field exclusion.
- No response token or link was created. Exact-run and namespace cleanup checks returned zero residue.
- Hosted generated types matched the local schema structurally; only remote PostgREST metadata differed, so tracked types were not overwritten.

Changed files:
- `scripts/hosted-assignment-detail-context-regression.mjs`
- `scripts/response-token-persistence-regression.mjs`
- `package.json`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`
- `docs/SUPABASE_AUTH_PERSISTENCE_READINESS.md`
- `docs/SUPABASE_LOCAL_SETUP.md`

Verification:
- Hosted migration history reports `20260705000000` locally and remotely.
- The hosted assignment-detail gate passed twice with product/Auth residue `0` each time.
- The complete local Supabase, persistence, route, response-link, assignment-detail, lint, build, Calendar browser, TypeScript, and diff baseline passed.

Limitations:
- This is hosted non-production validation only. No route reads staging data, and no token/link reveal, copy, display, email, or send action exists.
- Product reveal remains blocked until a future explicit reviewed POST action and UI surface.
- No delivery, lookup, remembered device, copy UI, route cutover, seed data, app service-role path, token deletion, background job, or mock-to-real integration was added.

Next recommended step:
- Design the separate explicit project-contact assignment-detail POST action/UI while keeping reveal availability fail closed until its review passes.

## Iteration 11.28 — Response Link Product Action Readiness Review

Summary:
- Added route-unused server-only `productActionPolicy.server.ts` with true contract availability and false implementation/UI availability.
- Defined the future action as persisted-assignment-detail-only, verified-contact, explicit POST, dynamic/no-store, trusted-origin, and non-prefetchable.
- Limited browser input to assignment id and optional TTL; all workspace/actor/volunteer/response/token/credential/origin/mode/audit/grant data remains forbidden or server-derived.
- Required assignment-detail read and edit boolean before one `createAuditedAssignmentResponseLinkReveal` call; direct RPC or manual replacement/audit sequencing is prohibited.
- Defined success warning/expiration and failure/no-leak behavior plus explicit prerequisites before any availability flag can change.
- Extended route/component static checks for no policy, assignment-detail, audited-reveal, direct-RPC, or copy/clipboard consumption.

Changed files:
- `lib/responseTokens/productActionPolicy.server.ts`
- `scripts/response-token-persistence-regression.mjs`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`
- `docs/SUPABASE_AUTH_PERSISTENCE_READINESS.md`

Verification:
- The complete local Supabase, persistence, response-route/link, assignment-detail, lint, build, Calendar browser, TypeScript, and diff baseline passed.
- Hosted validation was intentionally skipped because 11.28 changes no migration, generated type, RPC, or hosted gate behavior.

Limitations:
- No executable action, route, UI, clipboard behavior, or credential response exists. Implementation, UI, product-surface, and reveal availability remain false.
- No email/reminder delivery, lookup, remembered device, route cutover, seed data, app service-role path, token deletion, background job, or mock-to-real integration was added.

Next recommended step:
- Plan the persisted project-contact assignment-detail route surface, then implement the POST action separately while keeping it unlinked/unavailable until warning, expiry, no-prefetch, redaction, and browser tests pass.

## Iteration 11.29 — Persisted Assignment Detail Route Surface Readiness Review

Summary:
- Added route-unused server-only `detailRoutePolicy.server.ts` and selected `/admin/assignments/[assignmentId]` as the future persisted assignment-detail route.
- Limited the future route to verified project contacts, `assignments.view`, and the existing `readAssignmentDetailContext` projection; edit readiness remains boolean-only.
- Required dynamic/no-store rendering and one calm non-disclosing state for missing, unauthorized, cross-workspace, canceled, archived, inactive, or unavailable context.
- Kept mock Calendar, Volunteers, Needs Attention, Communications, diagnostic, public, and validation surfaces ineligible.
- Extended static checks to prove the route does not exist, no current route imports persisted detail/action/reveal boundaries, no copy UI exists, and all implementation/navigation/reveal flags remain false.

Changed files:
- `lib/assignments/detailRoutePolicy.server.ts`
- `scripts/response-token-persistence-regression.mjs`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`
- `docs/SUPABASE_AUTH_PERSISTENCE_READINESS.md`

Verification:
- The complete local Supabase, persistence, response-route/link, assignment-detail, lint, build, Calendar browser, TypeScript, and diff baseline passed.
- Hosted validation was intentionally skipped because 11.29 changes no migration, generated type, RPC, or hosted gate behavior.

Limitations:
- No route, navigation link, action, UI, clipboard behavior, or credential response was added. Product-action implementation/UI, product-surface implementation, reveal availability, and product-navigation linkage remain false.
- No email/reminder delivery, lookup, remembered device, route cutover, seed data, app service-role path, token deletion, background job, or mock-to-real integration was added.

Next recommended step:
- Add and review an unlinked dynamic/no-store `/admin/assignments/[assignmentId]` route shell that reads only `readAssignmentDetailContext`, presents the uniform unavailable state, and contains no response-link action.

## Iteration 11.30 — Unlinked Persisted Assignment Detail Route Shell

Summary:
- Added the force-dynamic/no-store `/admin/assignments/[assignmentId]` route as the first read-only persisted admin detail shell.
- Kept the route outside `AdminShell` so no mock workspace/navigation data is mixed into the persisted projection.
- Required a verified project-contact session and read assignment data only through `readAssignmentDetailContext`; `assignments.view` remains database-enforced.
- Rendered only safe assignment, workspace label, task, schedule, volunteer label/congregation, response, planned count, and edit-boolean fields.
- Collapsed malformed, missing, unauthorized, cross-workspace, canceled, archived, inactive, and unavailable cases into one calm state.
- Added `npm run test:assignment-detail-route` and updated existing static suites to allow exactly this one approved context importer while preserving every reveal/copy/delivery prohibition.

Changed files:
- `app/admin/assignments/[assignmentId]/page.tsx`
- `lib/assignments/detailRoutePolicy.server.ts`
- `scripts/assignment-detail-route-regression.mjs`
- `scripts/assignment-detail-context-regression.mjs`
- `scripts/response-token-persistence-regression.mjs`
- `package.json`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`
- `docs/SUPABASE_AUTH_PERSISTENCE_READINESS.md`
- `docs/SUPABASE_LOCAL_SETUP.md`

Verification:
- Local Supabase smoke, workspace/grant/questionnaire/volunteer/task/Calendar/assignment/response-token/link/detail-context suites passed.
- The new route-isolation suite, lint, 74-static-page production build with the new route marked dynamic, TypeScript, response-route browser QA, Calendar browser QA, and diff checks passed.
- Hosted validation was intentionally skipped because no migration, RPC, generated type, or hosted validation behavior changed.

Limitations:
- The route is unlinked and read-only. It adds no action, copy control, credential display, email/reminder behavior, mock fallback, service-role access, or product-route cutover.
- Product-action implementation/UI, product-surface implementation, reveal availability, and navigation linkage remain false.

Next recommended step:
- Review the unlinked shell’s visual/unavailable behavior or implement the still-unlinked POST action in a separate fail-closed slice; do not enable navigation, copy UI, or reveal availability yet.

## Iteration 11.31 — Assignment Detail Route Visual/Behavior QA

Summary:
- Added loopback-only `npm run test:assignment-detail-route:browser` using disposable local Auth/product fixtures and the existing production-preview browser utilities.
- Verified anonymous sign-in, authorized safe detail, authenticated unavailable, desktop, and 390px states with no horizontal overflow, browser errors, credential/intake leakage, unrelated-row leakage, active buttons, or response/diagnostic links.
- Hardened unavailable-state copy for anonymous versus already-authenticated contacts, shortened the displayed assignment reference, improved long-label wrapping, and made the future response-link area plainly non-actionable.
- Fixed the authorized route’s runtime-only timestamp failure by replacing an invalid `Intl.DateTimeFormat` option combination with explicit date/time fields and timezone fallback.
- Preserved the route’s dynamic/no-store, read-only, persisted-context-only, unlinked boundary and every fail-closed response-link availability flag.

Changed files:
- `app/admin/assignments/[assignmentId]/page.tsx`
- `scripts/assignment-detail-route-browser-regression.mjs`
- `scripts/assignment-detail-route-regression.mjs`
- `package.json`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`
- `docs/SUPABASE_AUTH_PERSISTENCE_READINESS.md`
- `docs/SUPABASE_LOCAL_SETUP.md`

Verification:
- The complete local Supabase/persistence/response/detail-context/detail-route suite passed.
- The new browser gate passed with zero product/Auth residue, along with lint, dynamic production build, TypeScript, response-route browser QA, Calendar desktop/mobile QA, and diff checks.
- Hosted validation was intentionally skipped because no migration, RPC, generated type, or hosted gate behavior changed.

Limitations:
- No product action, copy/clipboard UI, delivery, mutation, inbound navigation link, mock fallback, service-role client, or route cutover was added.
- The in-app side-by-side browser surface was unavailable in this session; the checked-in local Playwright gate supplied the repeatable render/behavior coverage.

Next recommended step:
- Choose a separate still-unlinked product-action implementation slice or a route-entry planning review; keep action UI, reveal availability, and product navigation false until their own review.

## Iteration 11.32 — Assignment Detail Product Action Server Boundary

Summary:
- Added a server-only, route-unused product-action boundary for the future `/admin/assignments/[assignmentId]` response-link reveal flow.
- The boundary accepts only assignment id and optional policy-bounded TTL, reads `readAssignmentDetailContext` first, requires matching assignment context plus `canEditAssignment`, derives `copy_link` mode, audit metadata, and `RESPONSE_LINK_BASE_URL` server-side, and calls `createAuditedAssignmentResponseLinkReveal` as the one transactional reveal boundary.
- Invalid input, missing configuration, unavailable context, read-only context, mismatched assignment context, and audited-reveal errors all fail closed without returning a URL.
- Product action implementation/UI, product-surface implementation, reveal availability, and navigation linkage remain false. `/admin/assignments/[assignmentId]` remains unlinked, read-only, and does not import the new boundary.

Changed files:
- `lib/responseTokens/productAction.server.ts`
- `lib/responseTokens/productActionPolicy.server.ts`
- `lib/responseTokens/auditedReveal.server.ts`
- `lib/assignments/detailContext.server.ts`
- `lib/supabase/server.ts`
- `lib/supabase/types.ts`
- `scripts/assignment-detail-route-regression.mjs`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`
- `docs/SUPABASE_AUTH_PERSISTENCE_READINESS.md`

Verification:
- The assignment-detail route regression now proves route isolation, no navigation/import cutover, no mock fallback, no token-table/direct-RPC/manual replacement-audit sequencing, and fail-closed product-action boundary behavior.
- The full local verification matrix passed, including Supabase smoke, workspace-through-response-link suites, assignment-detail context/route/browser gates, Calendar regression, lint, TypeScript, production build, and diff checks.
- Hosted validation was intentionally skipped because no migration, generated type, RPC, or hosted gate behavior changed.

Limitations:
- No visible copy-link UI, clipboard action, response-link button, email/reminder delivery, public lookup, remembered-device behavior, route cutover, seed data, cron/background job, service-role usage, or mock-to-real mixing was added.
- The boundary can return a full URL only to a future explicit server action response; no current route renders, logs, stores, or writes it.

Next recommended step:
- Review whether the next slice should wire a still-unavailable POST action into the assignment-detail route without UI, or first plan the warning/expiry/copy interaction. Keep reveal availability and product navigation false until a separate reviewed UI slice.

## Iteration 11.33 — Assignment Detail Product Action UI Readiness Review

Summary:
- Added a server-only, route-unused UI readiness policy for the future assignment-detail response-link control.
- Defined `/admin/assignments/[assignmentId]` as the only eligible surface and preserved the requirement that assignment data comes only from `readAssignmentDetailContext`.
- Required a deliberate click/tap, assignment-specific credential warning, visible expiration before and after success, no reveal on render/GET/page load/prefetch/hover/focus/effects, no automatic clipboard write, and manual copy only after audited success.
- Explicitly prohibited full URL, bearer, verifier, token id, raw audit data, credentials, SQL detail, and sensitive fixture values in error states.
- Kept product-action UI implementation, copy affordance, product-surface implementation, reveal availability, and navigation linkage false. The current route imports no product-action UI, action, or reveal helper.

Changed files:
- `lib/responseTokens/productActionUiPolicy.server.ts`
- `scripts/assignment-detail-route-regression.mjs`
- `docs/CURRENT_STATE.md`
- `docs/PROJECT_HISTORY.md`
- `docs/ROADMAP.md`
- `docs/SUPABASE_AUTH_PERSISTENCE_READINESS.md`
- `docs/SUPABASE_LOCAL_SETUP.md`

Verification:
- The assignment-detail route regression now proves the route remains the only detail-context importer, has no inbound links, no mock fallback, no service-role path, no token/reveal/action/UI imports, no clipboard/copy behavior, and no credential-bearing render fields.
- The full local verification matrix passed, including Supabase smoke, workspace-through-response-link suites, assignment-detail context/route/browser gates, Calendar regression, lint, TypeScript, production build, and diff checks.
- Hosted validation was intentionally skipped because no migration, generated type, RPC, or hosted gate behavior changed.

Limitations:
- No visible response-link control, copy/clipboard UI, delivery, mutation, inbound navigation link, route cutover, seed data, cron/background job, service-role usage, or mock-to-real mixing was added.
- The policy is planning/static guardrail only; the future UI and route action still require their own reviewed slices before reveal availability can change.

Next recommended step:
- Decide whether to implement still-invisible route action wiring or first review the warning/expiry/manual-copy visual pattern; keep UI, reveal, navigation, and delivery unavailable until separately approved.

## Product Planning Alignment — Real-World MVP Requirements (2026-07-05)

Summary:
- Added `PROJECT_LOCAL_PRODUCT_REQUIREMENTS.md` as the canonical planning baseline for Project Local as a general volunteer/project coordination product, not a CVC-only application.
- Defined MVP/core around volunteer schedule lookup, Confirm/Deny/Confirm All, calendar-first scheduling/admin, assignment email, schedule-change email, automatic reminders, and response/staffing follow-up.
- Recorded detailed V1/later contracts for unified scheduled items, templates/custom items, Follow-up Contact, publishing, Availability Blocks, Volunteers, Communications, Meals, Needs Attention, Questionnaire, permissions, on-site personnel, Notes, navigation, and UX.
- Reconciled older planning language: assigned counts replace “spots”; zero-count informational items are valid; Lunch-as-system-preset gives way to Calendar-owned Meals; Needs Attention becomes primary navigation; Volunteers/Communications move under More; and on-site personnel are a separate access type rather than a contact role.
- Preserved current mock routes and implementation history. No UI, route, schema, migration, component, feature code, or product behavior changed.

Changed files:
- `docs/PROJECT_LOCAL_PRODUCT_REQUIREMENTS.md`
- `docs/ROADMAP.md`
- `docs/CURRENT_STATE.md`
- `docs/CALENDAR_DATA_MODEL_READINESS.md`
- `docs/PROJECT_HISTORY.md`

Open questions retained:
- On-site shared access identity versus individual lightweight identity.
- Optional per-item reminder disabling and bulk `.ics` scope.
- Volunteer-specific Follow-up Contact overrides and future Notes sharing.
- Production email provider/deliverability/retry rules.
- Calendar timezone/DST, overnight work, recurrence, and schedule-edit audit details.

Verification:
- Documentation links, headings, conflict markers, and `git diff --check` were reviewed.
- No application test suite was required because this update changes documentation only.

## Documentation Maintenance Rules

- Every future Codex iteration should update `PROJECT_HISTORY.md` with a concise entry.
- Include changed files, summary, verification, limitations, and next recommended step.
- Do not paste entire source files.
- Prefer architectural notes over code dumps.
