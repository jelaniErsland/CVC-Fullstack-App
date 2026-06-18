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

## Documentation Maintenance Rules

- Every future Codex iteration should update `PROJECT_HISTORY.md` with a concise entry.
- Include changed files, summary, verification, limitations, and next recommended step.
- Do not paste entire source files.
- Prefer architectural notes over code dumps.
