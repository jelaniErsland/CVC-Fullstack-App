# Current State

## 1. App Overview

CVC Scheduler is the full-stack successor to the Belgrade Remodel Sheets/App Script tool. It is being built as a project-centered workspace system where each workspace is centered around one real-world CVC project.

The main admin mental model is:

Admin user/account -> assigned project workspace -> one real-world project -> enabled modules inside that workspace.

Modules inside a workspace may include Volunteers, Schedule, Food, Security, Announcements, Emails, Needs Attention, Conflicts, and Settings.

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

"Projects" should not feel like a peer feature beside Volunteers, Schedule, Food, Security, or other modules. The selection layer should generally use visible language such as Workspace, Workspaces, or Project Workspaces.

"Project" is still acceptable when referring to the actual real-world project, such as Belgrade Major Remodel 2026, project contacts, project dates, or project type.

The `/admin/projects` route can remain for now, but visible UI language should stay workspace-centered.

## 4. Current Implemented Areas

- Volunteer foundation with mock volunteer questionnaire/profile data.
- Project/workspace admin foundation.
- Project-aware and module-aware `AdminNav`.
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
- Mock role-home foundation for `/admin/dashboard`, currently showing a stabilized Primary CVC home with preview patterns for Assistant CVC, Food, Security, and On-site Contact roles.
- Mock Needs Attention foundation with calm grouped follow-up rows and dashboard next-action integration.
- Mock conflict/coverage detail patterns for Needs Attention items, including coverage gaps, possible overlaps, denied assignments, and missing information before scheduling.

## 5. Current Routes

- `/admin`: Redirects to the default active Belgrade workspace dashboard.
- `/admin/dashboard`: Mock role-aware admin home inside Belgrade Major Remodel 2026, currently centered on the Primary CVC experience.
- `/admin/needs-attention`: Mock Needs Attention overview for project follow-ups, open coverage, and setup notes.
- `/admin/needs-attention/[itemId]`: Mock conflict/coverage detail page with suggested next step, related assignments/people, and placeholder-only actions.
- `/admin/schedule`: Mock schedule view for the active Belgrade workspace with compact day groups and expandable assignment rows.
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

Use `npm run preview:screenshots` after starting the app locally with `npm run dev`.

The script captures key admin routes, the admin questionnaire queue, a questionnaire detail page, and the Belgrade public questionnaire from `http://127.0.0.1:3000` by default. Set `PREVIEW_BASE_URL` to override the base URL.

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
- Role homes are preview/mock-only and do not enforce permissions yet.
- Food, Security, and On-site role homes are compact preview patterns, not full modules.
- No platform owner/admin home yet.
- No public volunteer portal yet.
- Intake flow screenshots are still prototype QA artifacts, not product approvals.
- Current data is mock-only.
- Belgrade remains the production workflow in Sheets/App Script for now.

## 9. Next Recommended Step

07.3 Needs Attention visual QA/stabilization.
