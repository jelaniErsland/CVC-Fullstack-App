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

## Documentation Maintenance Rules

- Every future Codex iteration should update `PROJECT_HISTORY.md` with a concise entry.
- Include changed files, summary, verification, limitations, and next recommended step.
- Do not paste entire source files.
- Prefer architectural notes over code dumps.
