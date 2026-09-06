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

## Local 12.45 implementation (UNDEPLOYED)

The current uncommitted workspace implements the approved on-site/Food slice. Migration 20260906120000_on_site_food_calendar_operations.sql is tested locally and **UNAPPLIED to production**. Production remains at 20260905130000; this iteration does not access production, mutate its backup task, or send email. See [12.45 implementation and review](./ON_SITE_FOOD_OPERATIONS_12_45.md).

- Breakfast and Lunch are ordinary Food Calendar occurrences with independent nullable totals, provider/group, contact and menu fields. Meal detail lives in the shared Calendar inspector; Quick View has no separate meal dashboard/cards.
- Historical project_days.expected_on_site_count values remain intact in schema/data. 12.45 retires their editing/display surfaces from active operations. They are never migrated into either meal total. There is no combined operational total or old Quick View Planned staffing summary.
- Both authenticated and bearer Quick View entry points reuse the same read-only Calendar and published operational content model, including assigned names. Bearer expiry/revocation/project scope remain enforced. Existing pre-12.45 links will be revoked by the unapplied migration because their original audience projection was narrower; trusted links require explicit reissuance.
- Duplicate creates an independent saved definition with zero assignments, responses or deliveries. Ordinary work starts as a private draft; meal copies follow immediate-visible meal creation semantics. No series is created.
- Project navigation derives only from persisted workspace start dates; unavailable starts disable Project navigation. General uses cyan, Food amber/yellow, Security lavender and Custom neutral slate, with text labels and focus states.
- Volunteer meal data is projected only for that volunteer's assignment dates: kind, provider, menu and time. Trusted meal contacts and operational notes are excluded from this meal projection.

## Current product architecture

Project Local is a Calendar-first volunteer coordination product. Reusable Tasks define work; Calendar items place that work in time; assignments and their current responses are the source of assigned/coverage truth. Draft items remain private; published items are available to the permitted project context and assigned volunteers.

Project contacts authenticate through Supabase Auth and receive access from active, contact-scoped workspace grants and capabilities. Server-side route loaders and mutation boundaries derive this context independently; direct application table writes remain denied where an approved RPC is the authority boundary. The application has no service-role runtime path.

Volunteer schedule access is account-light. A personalized `/v/access/[token]` link exchanges a server-verified bearer for the clean `/v/schedule` route; the schedule is limited to that volunteer's published assignments. The public lookup flow uses the same schedule-session boundary without exposing workspace or volunteer UUIDs to the browser.

## Current source routes (12.45 local; not deployed)

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
- The local 12.45 changes have not been committed, pushed or deployed. Production still lacks this slice until a separately authorized rollout.
- Advanced Calendar interactions, including drag/resize, richer collision handling, and broader recurrence editing, remain deferred.
- The Windows scheduled-backup missed-run/catch-up behavior remains an operational reliability concern to monitor; do not claim a catch-up run occurred without fresh evidence.

## Approved UX and product direction

The product remains calm and Calendar-first: low text density, clear typography, progressive disclosure, and focused inspectors rather than overloaded forms. Preserve one unified scheduled-item model across volunteer work, security, food, and custom Calendar items. Do not fork public and private Quick View variants or create a second Calendar model for on-site work.

Breakfast and Lunch are distinct operational totals. The historical general Project Day total remains in storage but is retired from the local 12.45 operational UI. Quick View has no combined total or old Planned staffing summary.

## Next step

Complete product review of local 12.45, then obtain a separately authorized commit/rollout instruction. Preserve the exact recovery transition 20260905130000 -> 20260906120000; do not skip intermediate terminals or update the live backup lock during product review.

Local verification is complete, including the isolated privilege regression and inspected desktop/mobile captures. The implementation is ready for product review, with results and cleanup recorded in [12.45 implementation and review](./ON_SITE_FOOD_OPERATIONS_12_45.md). This is not rollout authorization; migration 20260906120000 remains UNAPPLIED to production.

## Canonical references

- [FUNCTION_PRIVILEGE_POLICY.md](./FUNCTION_PRIVILEGE_POLICY.md) — exact RPC classifications, creator/default ACL scope, and privilege evidence.
- [BOZEMAN_BETA_ROADMAP.md](./BOZEMAN_BETA_ROADMAP.md) — roadmap and historical launch-gate analysis; read its current summary before relying on older iteration sections.
- [PROJECT_LOCAL_PRODUCT_REQUIREMENTS.md](./PROJECT_LOCAL_PRODUCT_REQUIREMENTS.md) — future product requirements; it is planning, not an implementation claim.
- [PROJECT_HISTORY.md](./PROJECT_HISTORY.md) — historical implementation and rollout evidence.
- [PRODUCTION_BACKUP_RECOVERY_RUNBOOK.md](./PRODUCTION_BACKUP_RECOVERY_RUNBOOK.md) — backup/recovery procedures and historical checkpoints.
