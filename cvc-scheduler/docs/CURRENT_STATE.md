# Current State

This is the authoritative present-state context for Project Local. Historical implementation evidence is recorded in [PROJECT_HISTORY.md](./PROJECT_HISTORY.md) and Git history.

## Production snapshot

- Production Supabase terminal: `20260905130000`.
- The permanent `Project Local Production Backup` task is Enabled, Ready, and not running. Its lock is `20260905130000`; its daily 03:15 schedule and `StartWhenAvailable` setting remain in place.
- Recovery validation is GREEN. The 12.44G rollout created controlled manual checkpoints at `20260904130000` and `20260905120000`; this does not claim a new autonomous backup.
- Bozeman is the active production project in `America/Denver`. Its persisted project window is `2026-09-29` through `2026-12-04`.
- Application email transport is DISABLED. This rollout sent no email.

## Security invariants

The lookup migration `20260905120000_volunteer_schedule_lookup.sql` and function-privilege migration `20260905130000_harden_public_function_execute_privileges.sql` are live.

- Function EXECUTE is deny-by-default for Project Local functions created by `postgres`. `PUBLIC` has no application-function EXECUTE, and the `postgres` global and `public` default ACL contexts deny implicit PUBLIC, `anon`, and `authenticated` function execution.
- Exactly eight reviewed anonymous RPCs are executable: the explicit list and caller evidence are maintained in [FUNCTION_PRIVILEGE_POLICY.md](./FUNCTION_PRIVILEGE_POLICY.md). Unexpected anonymous EXECUTE is `0`; unexpected PUBLIC EXECUTE is `0`.
- Authenticated application RPCs retain their explicit grants. Internal trigger and validation helpers have no direct application-role grant.
- All 42 reviewed SECURITY DEFINER functions retain the `postgres` owner and pinned empty `search_path`. The privilege review found no demonstrated authorization bypass or breach.
- Direct anonymous reads of volunteer-directory, lookup-rate-limit, and schedule-credential tables are denied. Lookup returns generic failures for invalid input, uses opaque project-choice handles, keeps schedule credentials hash-only server-side, and sets the browser credential only as an HttpOnly session cookie.

## Current product architecture

Project Local is a Calendar-first volunteer coordination product. Reusable Tasks define work; Calendar items place that work in time; assignments and their current responses are the source of assigned/coverage truth. Draft items remain private; published items are available to the permitted project context and assigned volunteers.

Project contacts authenticate through Supabase Auth and receive access from active, contact-scoped workspace grants and capabilities. Server-side route loaders and mutation boundaries derive this context independently; direct application table writes remain denied where an approved RPC is the authority boundary. The application has no service-role runtime path.

Volunteer schedule access is account-light. A personalized `/v/access/[token]` link exchanges a server-verified bearer for the clean `/v/schedule` route; the schedule is limited to that volunteer's published assignments. The public lookup flow uses the same schedule-session boundary without exposing workspace or volunteer UUIDs to the browser.

## Current real routes

| Route | Present behavior |
| --- | --- |
| `/` | Public Find your schedule entry point. Name collection alone exposes no schedule data. |
| `/v/lookup` | Same-origin JSON POST lookup endpoint. It verifies name/contact through the reviewed anonymous RPC and returns only generic failure, project choice, or the HttpOnly session handoff. |
| `/v/access/[token]` | Personalized schedule-access exchange; invalid or expired links resolve to the contained unavailable state. |
| `/v/schedule` | Volunteer-only published schedule, assignment detail, Confirm, Can't make it, Confirm All, and explicit leave-session behavior. |
| `/admin/dashboard` | Persisted Overview of current project work, activity, and attention signals. |
| `/admin/calendar` | Persisted Day/Week/Month/List Calendar with bounded server ranges, project dates, custom/preset items, repeat creation, drafting/publishing, assignment management, and inspector workflows subject to capabilities. |
| `/admin/tasks` | Persisted reusable task definitions, including create/archive and custom-field support subject to capabilities. |
| `/admin/needs-attention` | Persisted staffing and response follow-up signals, grouped for operational review. |
| `/admin/volunteers` | Persisted volunteer profiles with authorized manual create/edit and safe lifecycle handling. |
| `/admin/assignments/[assignmentId]` | Authorized, read-only persisted assignment detail. |
| `/admin/quick-view` | Authenticated persisted project Quick View and its reviewed share-access boundary. |
| `/admin/settings` | Intentionally contained beta-unavailable surface; it is not project settings truth. Project date editing is on Calendar. |

Legacy demo, questionnaire, Communications, Food, onboarding, and administrative prototype routes remain contained unless a route has an explicit persisted boundary. They must not be presented as replacements for the production workflow above.

## Current operational capabilities

- Contacts can create, edit, archive, repeat, publish, and inspect Calendar work within their granted scope; assignment counts derive from live assignment/response truth.
- Authorized contacts can manage reusable Tasks and manual volunteer profiles, assign or cancel volunteers, and use Needs Attention to review staffing and response follow-ups.
- Published assignments are accessible through secure volunteer schedule credentials. Confirm, Deny/Can't make it, and Confirm All persist through credential-scoped response boundaries.
- A controlled initial-assignment email proof exists in history, but the application transport is presently disabled. Normal scheduling, publishing, lookup, and response workflows do not send email while it remains disabled.
- Bozeman project dates are maintained through the authenticated Calendar Project dates workflow.

## Current limitations and intentionally deferred work

- Application email transport is disabled. Automated reminders, broader Communications authoring, and schedule-change delivery remain deferred.
- A successful production lookup smoke using a real volunteer is deferred to the first authorized real use. Invalid-input and boundary proofs are complete; do not manufacture or enumerate volunteers for this check.
- Breakfast and Lunch operational workflows are not implemented.
- Trusted on-site personnel do not yet have a full read-only reuse of the Calendar with assignment names and detail.
- Calendar duplicate/copy-to-date workflow and consistent accessible color coding are not implemented.
- Advanced Calendar interactions, including drag/resize, richer collision handling, and broader recurrence editing, remain deferred.
- The Windows scheduled-backup missed-run/catch-up behavior remains an operational reliability concern to monitor; do not claim a catch-up run occurred without fresh evidence.

## Approved UX and product direction

The product remains calm and Calendar-first: low text density, clear typography, progressive disclosure, and focused inspectors rather than overloaded forms. Preserve one unified scheduled-item model across volunteer work, security, food, and custom Calendar items. Do not fork public and private Quick View variants or create a second Calendar model for on-site work.

Breakfast and Lunch are distinct operational totals. There is no general daily expected-on-site total, and Quick View does not need the old per-trade planned-staffing summary.

## Next recommended slice: 12.45 — Bozeman On-Site / Food Calendar Operations

Planned scope only; do not implement it without a separate approved iteration.

- Add built-in Breakfast and Lunch Calendar task types and workflows with separate totals, provider, contact, and menu.
- Make the trusted Quick View the on-site operational page.
- Reuse the full Admin Calendar in read-only mode, including Day, Week, Month, List, expandable item detail, and assigned volunteer names for trusted on-site viewers.
- Remove mutation controls in the read-only view and enforce view-only access server-side.
- Add Calendar duplicate/copy-to-date and consistent accessible Calendar color coding.

The product decisions are fixed for this slice: one trusted Quick View context, separate Breakfast and Lunch totals, no general expected-on-site total, no old per-trade Quick View summary, and reuse of the real Calendar component/model rather than a fork.

## Canonical references

- [FUNCTION_PRIVILEGE_POLICY.md](./FUNCTION_PRIVILEGE_POLICY.md) — exact RPC classifications, creator/default ACL scope, and privilege evidence.
- [BOZEMAN_BETA_ROADMAP.md](./BOZEMAN_BETA_ROADMAP.md) — roadmap and historical launch-gate analysis; read its current summary before relying on older iteration sections.
- [PROJECT_LOCAL_PRODUCT_REQUIREMENTS.md](./PROJECT_LOCAL_PRODUCT_REQUIREMENTS.md) — future product requirements; it is planning, not an implementation claim.
- [PROJECT_HISTORY.md](./PROJECT_HISTORY.md) — historical implementation and rollout evidence.
- [PRODUCTION_BACKUP_RECOVERY_RUNBOOK.md](./PRODUCTION_BACKUP_RECOVERY_RUNBOOK.md) — backup/recovery procedures and historical checkpoints.
