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

## Documentation Maintenance Rules

- Every future Codex iteration should update `PROJECT_HISTORY.md` with a concise entry.
- Include changed files, summary, verification, limitations, and next recommended step.
- Do not paste entire source files.
- Prefer architectural notes over code dumps.
