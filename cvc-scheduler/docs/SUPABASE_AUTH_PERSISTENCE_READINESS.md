# Supabase, Auth, and Persistence Readiness

This document is the implementation-readiness bridge between the stable Project Local mock prototype and a future real-data phase. It records proposed boundaries, sequencing, and decisions that must be resolved before code is connected to Supabase.

Iteration 11.11 implements only an assignment-scoped opaque bearer foundation and narrow public verification/response commands. It is not a public volunteer, reminder, Calendar, or Volunteers route cutover; it adds no lookup, email, delivery, remembered-device behavior, coverage counter, or broad schedule access.

## 11.11 public volunteer response authorization boundary

`public.assignment_response_tokens` stores one workspace, assignment, volunteer profile, fixed `assignment_response` purpose, expiry/revocation/use timestamps, and a unique 32-byte SHA-256 verifier. The raw 256-bit base64url bearer is generated inside PostgreSQL, returned once from authenticated issuance, and never stored. A composite foreign key binds token scope to the assignment's actual workspace and volunteer.

Issuance and revocation require an active contact/grant containing `assignments.edit`; adjacent roles or `workspace.read`, `calendar.view`, and `volunteers.view` are insufficient. Token rows have RLS enabled, no policies, and no anon/authenticated table privileges, so even authorized contacts cannot broadly select verifier hashes. The server helper never logs the returned bearer and no route imports it.

The anon-executable verification function accepts only a correctly shaped bearer and returns workspace display name, opaque assignment reference, task title snapshot, schedule kind/date/time/timezone, and current response status. It returns no volunteer identity/contact data, questionnaire/emergency data, roster, notes, grants, verifier, or unrelated schedule rows.

The separate public response command accepts only bearer, `confirmed`/`declined`, and a bounded note. It re-resolves the unexpired, unrevoked, correct-purpose token plus active assignment, volunteer, Calendar item, and workspace; locks the token/response rows; records source `public_token`; and updates `last_used_at`. It does not invoke the project-contact command. Bearers remain credentials until expiry/revocation and forwarded links carry the same authority. No delivery or public route exists yet.

## 11.10 assignment and response boundary

`public.calendar_assignments` links one active `timed` or `date_based` Calendar item to one active, ready volunteer profile in the same workspace. Composite foreign keys enforce the workspace relationship in the database, and a partial unique index prevents duplicate active assignment of the same volunteer to the same item. The create command accepts only Calendar item id, volunteer profile id, and an optional bounded note; workspace and actor are derived server-side. Different Calendar items are not conflict-checked in this slice.

`public.assignment_responses` holds exactly one current row per assignment with `needs_response`, `confirmed`, or `declined`. Assignment creation initializes `needs_response`. Authenticated project contacts can apply explicit transitions in either direction using `assignments.edit`; source is fixed to `project_contact`, timestamps/actor are server-owned, and a compare-and-set predicate rejects concurrent overwrites. Assignment cancellation changes assignment lifecycle but preserves its last response row.

Anon has no table or function access. Authenticated reads of either table require `assignments.view`; creation, cancellation, and response changes require `assignments.edit`. `workspace.read`, `calendar.view`, `volunteers.view`, or a grant role alone is insufficient. Direct application table writes are denied, and the isolated helpers are imported by no route.

Future account-free responses require a separate server-owned bearer-token boundary. A token must be high-entropy, stored hashed, expiring, revocable, and scoped to one assignment/volunteer action; successful verification may authorize only the permitted response transition. Name/email lookup, remembered-device state, and current reminder URL shapes are not authorization and must never call the contact-only command directly.

## 11.9 Calendar item boundary

`public.calendar_items` stores workspace-scoped scheduled work and deliberate project-context items. An item has exactly one task source: an active same-workspace task-preset reference whose name/type are snapshotted at creation, or a validated one-off name/type snapshot that does not create a preset. `calendar.view` authorizes RLS reads and `calendar.edit` authorizes the server-owned create/archive functions; roles and `workspace.read` alone authorize neither.

The schedule is an explicit union of `timed`, `date_based`, `multi_day_window`, and `milestone`. The database derives and enforces the workspace timezone instead of accepting it from a caller. This first slice stores local dates/times and intentionally rejects overnight timed ranges; a future slice must add an unambiguous instant/end-date model before overnight work is accepted. Multi-day windows require a later end date and are informational. Milestones and windows carry a zero planned needed count, while timed/date-based items accept 1–99.

`needed_count` records planned demand only. There are no assigned-volunteer ids, filled/confirmed/denied/waiting/open counters, or response states on Calendar items. Future assignment and response rows must become coverage truth. Direct application writes are denied, no recurrence/copy metadata is stored, and the isolated helpers are imported by no route.

## 11.8 task preset boundary

`public.task_presets` stores workspace-scoped reusable work definitions: name/description, high-level `general`/`food`/`security`/`custom` type, default needed count, future volunteer-visibility configuration, trusted system identity, bounded custom-field definitions, lifecycle, and timestamps. It intentionally contains no date, start/end time, Calendar placement, assigned volunteer, filled count, confirmation, recurrence, or response fields.

The schema can represent Lunch as a future trusted system preset using `system_key = 'lunch'`, `task_type = 'food'`, and a required `menu` field definition. Ordinary application creation always sets `is_system_preset = false` and cannot supply a system key. This slice creates no seed preset and no lunch menu, scheduling, or volunteer-facing behavior.

Anon has no table or function access. Authenticated reads require an effective grant containing `tasks.view`; workspace visibility alone is insufficient. Direct application writes are denied. The authenticated security-definer create/archive functions verify `auth.uid()`, active workspace/contact/grant validity, and `tasks.edit`. Create accepts only validated reusable-definition fields. Archive accepts only a preset UUID and refuses system presets. General updates remain deferred.

The server-only validator rejects unknown input keys—including scheduling/assignment-shaped keys—plus invalid names, types, needed counts, duplicate fields/options, unsupported custom-field shapes, and oversized definitions. Read/create/archive helpers remain unused by `/admin/tasks` and all other routes, so persisted presets are not mixed with mock Tasks or Calendar data.

`npm run test:tasks` checks schema/column scope, category/default/custom-field constraints, `tasks.view`/`tasks.edit` predicates, direct-write denial, system-preset boundaries, strict validation, Lunch representability, deterministic authorization fixtures, service-role absence, and route isolation. Without configured Supabase this is a contract regression, not a live task read/write RLS claim.

## 11.7 volunteer profile boundary

`public.volunteer_profiles` is approved project-scoped volunteer truth keyed by the canonical `workspaces.id`. It stores one immutable source-submission reference, active/inactive/archived lifecycle, ready/on-hold readiness, basic contact/congregation fields, availability and skills/help snapshots, profile-owned notes, and timestamps. It is deliberately not a broad person identity shared across projects.

Questionnaire truth remains separate and unchanged. The conversion snapshot copies only accepted name/contact/congregation, availability, skills, and other-help sections. Emergency-contact answers remain exclusively in the questionnaire boundary because `volunteers.view` is broader than sensitive questionnaire review. The composite source/workspace foreign key proves same-workspace provenance, and the unique source constraint permits at most one profile per submission in this slice.

Direct profile inserts, updates, and deletes are denied to anon/authenticated roles. The authenticated-only `convert_questionnaire_submission_to_volunteer_profile` function accepts only a submission UUID; callers cannot supply workspace ids or profile values. It verifies `auth.uid()`, source status/version, active contact/grant validity, and both `questionnaires.review` and `volunteers.edit` for the source workspace. A still-`submitted` version-1 source is the only usable conversion state because 11.6 intentionally has no status-mutation workflow. The explicit command is the approval/conversion decision, creates an `active`/`ready` snapshot, and does not update the submission.

Authenticated profile reads require an effective grant containing `volunteers.view`; workspace visibility or `questionnaires.review` alone is insufficient. The server-only conversion and current-contact read helpers remain unused by `/admin/volunteers`, volunteer detail, questionnaire queue, and questionnaire detail routes, so mock and real data are not mixed.

`npm run test:volunteers` checks schema scope, provenance/duplicate constraints, capability predicates, source status/version, Auth verification, sensitive-field separation, direct-write denial, parser behavior, conversion fixtures, and route isolation. Without configured Supabase this is a contract regression, not a live conversion or live two-user RLS claim.

## 11.6 questionnaire submission boundary

`public.questionnaire_submissions` stores one required `workspaces.id`, controlled status/source, questionnaire version, a bounded JSON answer snapshot, and submission timestamps. The answer JSON preserves the accepted original intake truth in versioned sections; sensitive answers are not copied onto workspace, schedule, or grant rows. A later volunteer profile must be a separate record created through an explicit authorized review/conversion workflow, never an alias for or mutation of the original submission.

Public creation uses the narrowly executable `submit_questionnaire_submission` database function. Anon has no table privileges or submission RLS policy, so it cannot list, read, update, delete, or directly choose status/source/timestamps. The function fixes those fields, validates version/basic structure and size, and inserts only when the stable workspace key resolves to an active workspace with `public_intake_enabled = true`. The server-only application boundary performs stricter field, choice, length, email, duplicate, and payload-size validation before invoking it.

Authenticated contacts may select submissions only when an active, unrevoked, currently valid workspace grant contains `questionnaires.review` for that submission's workspace. `workspace.read` alone is insufficient. There is no insert/update/delete table privilege for authenticated application sessions, no review command, and no automatic `approved` transition. Status values beyond `submitted` are read-model preparation only.

`submitPublicQuestionnaire` and `readCurrentContactQuestionnaireSubmissions` are isolated `server-only` boundaries. No application route imports them: `/questionnaire/[projectId]`, `/admin/questionnaires`, and questionnaire detail pages retain their deterministic mock behavior, preventing hidden mock/real mixing.

`npm run test:questionnaires` validates payload behavior, migration/function constraints, anon table denial, intake-open rules, `questionnaires.review` predicates, deterministic grant isolation, service-role absence, and the no-route-import boundary. Without a configured Supabase database this remains a contract regression, not a live public insert or two-user review-isolation claim.

## 11.5 project-contact grant boundary

`public.project_contacts` maps one Supabase Auth user to one application contact lifecycle record. `public.workspace_contact_grants` links that contact to the canonical `workspaces.id`, records one of the existing contact-role labels, requires `workspace.read`, and carries active/inactive/revoked plus validity timestamps. Neither table has an authenticated write policy; provisioning remains a trusted setup/admin concern outside the browser.

Workspace RLS now permits `select` only to `authenticated`, and only when `auth.uid()` resolves through an active contact to an active, unrevoked, currently valid grant for that exact workspace. Anon has no workspace table privilege or policy. The contact and grant tables expose only the signed-in user's own contact row and currently effective grants. Expired, future, inactive, and revoked grants do not authorize a workspace read.

`loadProjectContactGrants` verifies that its explicit user id matches `auth.getUser()` and reads only RLS-visible grants. `readCurrentUserGrantedWorkspaces` lists workspace identities allowed by RLS, while the 11.4 lookup-by-id/key reader automatically inherits the same policy. These boundaries are `server-only`; no mock product/workspace route imports them. The existing `/admin/login` Auth shell is the sole route allowed to display grant status, and it does not use persisted workspace data.

The authorization layers are deliberately distinct:

- **Supabase Auth identity:** proves which invited user owns the cookie-backed session. It grants no workspace by itself.
- **Project-contact record:** maps that Auth user into the application and can deactivate the contact globally. Its existence grants no workspace by itself.
- **Workspace grant:** scopes one active contact to one `workspaces.id`, role label, capability array, and validity window.
- **Capability authorization:** implemented capabilities are `workspace.read`, `questionnaires.review`, `volunteers.view`, conversion-only `volunteers.edit`, `tasks.view`, and `tasks.edit`. A role label or arbitrary future capability name has no implemented product effect.
- **Future product-data authorization:** each later project-owned table must carry the canonical workspace UUID and add its own RLS plus server-owned capability/business validation. Workspace visibility must never become blanket access to questionnaires, volunteers, tasks, Calendar, assignments, communications, or other data.

`npm run test:grants` statically checks the migration/policies/read boundaries and evaluates deterministic anon, no-grant, user-A, user-B, expired, revoked, inactive-grant, and inactive-contact fixtures. This is a focused contract regression, not a live Postgres RLS exercise. Real cross-user isolation still must be run against a configured local or linked Supabase database before production claims are made.

## 11.4 workspace persistence boundary

`public.workspaces` is now the canonical scope root for one real-world project. Its immutable UUID is the project scope key that later questionnaire submissions, volunteer profiles, task presets, Calendar items, assignments, communications, grants, and other project-owned rows must reference through a foreign key. `workspace_key` is the stable human-readable lookup key; `display_name` is presentation and may change. Neither a key nor a UUID is proof of access.

The table is deliberately small: identity, display name, `draft`/`active`/`archived` lifecycle, timezone, optional project dates, a public-intake configuration flag, and timestamps. No contact, grant, questionnaire, volunteer, task, Calendar, assignment, response, communication, reminder, or follow-up table is part of this migration. The flag is configuration only and does not expose a public intake read or submission path.

RLS was enabled and forced with no allow policy in 11.4. Iteration 11.5 replaces that initial authenticated deny-all posture with the narrow active-grant policy above; table owners, superusers, and bypass-RLS roles remain outside its claim. The application uses no service-role client.

`lib/workspaces/read.ts` is a `server-only` boundary that selects the identity/config columns by validated UUID or stable key using the caller's cookie-aware Supabase client. It now inherits the 11.5 grant policy. No route imports it.

No generated database types were available from a linked/local Supabase schema during implementation. The boundary therefore validates the returned row at runtime and keeps its narrow application type in `lib/workspaces/identity.ts`; it does not pretend that handwritten types are generated. The generation workflow is documented in [`SUPABASE_LOCAL_SETUP.md`](./SUPABASE_LOCAL_SETUP.md).

## 11.3 contact Auth boundary

Invited project contacts can request a Supabase Auth magic link; unknown emails cannot self-register. The callback exchanges the one-time code for a cookie-backed session, sign-out clears that local session, and the Next.js proxy can require a verified Auth user when `ADMIN_AUTH_MODE=enforced`. The default `review` mode leaves existing mock admin routes open and makes no per-route Auth request.

Authentication proves only an identity. The 11.5 grant reader separately resolves active workspace access; the enforced proxy remains a session boundary, not final product authorization. Public volunteer/questionnaire routes remain outside Supabase Auth.

## 11.2 setup boundary

The repository now includes `@supabase/supabase-js`, lazy browser and server client factories, typed runtime environment validation, `.env.example`, and `npm run supabase:check`. The check calls only the Supabase Auth health endpoint; it does not sign in, create a session, or read a product table. Current builds and mock routes do not require Supabase variables because no application route imports either client factory.

Local setup and secret-handling rules live in [`SUPABASE_LOCAL_SETUP.md`](./SUPABASE_LOCAL_SETUP.md). `SUPABASE_SERVICE_ROLE_KEY` is an optional typed server-only placeholder and has no privileged client factory or current consumer. Reviewed public-schema types generated from the local 11.11 schema are available in `lib/supabase/database.types.ts` and parameterize the shared browser/server/proxy clients and isolated persistence helpers without replacing runtime validation or enabling a route cutover.

## 1. Current mock-prototype boundary

### Public volunteer surfaces

The following routes are deterministic public previews:

- `/`: volunteer-first Project Local entry; the lookup always opens Alex Rivera's sample.
- `/v/demo`: remembered-volunteer schedule with four sample assignments.
- `/v/demo/no-assignments`: fixed empty-schedule variant.
- `/v/demo/assignments/[assignmentId]`: reusable sample details and calm unknown-id recovery.
- `/v/demo/reminder/[assignmentId]`: non-secure reminder-link preview and calm unknown-id recovery.
- `/questionnaire/[projectId]`: local-only public questionnaire flow for enabled sample projects.

`lib/volunteerPreview.ts` supplies the public schedule, person, project-information, assignment-detail, and reminder-preview content. `lib/mockData.ts` supplies the broader project, questionnaire, volunteer, task, Calendar, communications, and admin preview records.

Public lookup does not resolve an identity. Reminder paths have no token or security. `VolunteerConfirmationPreview` stores response state only in React component memory; it sends nothing, does not synchronize between routes, and resets on navigation or reload. The existing questionnaire route submission remains local-only; the 11.6 persistence boundary is intentionally unused by routes.

### Admin surfaces

The admin prototype includes Overview, Calendar, Tasks, Volunteers, Communications, Settings, questionnaire review, Needs Attention, workspace/project setup, legacy `/admin/schedule`, and Food/Security research surfaces. Admin login and role-aware pages are presentation previews; they do not authenticate or enforce authorization.

Calendar creation, inspection, filtering, view state, date navigation, response counts, and assignment coverage remain mock UI. The isolated 11.9 Calendar item boundary is not connected to those routes. Calendar-specific persistence assumptions are recorded in [`CALENDAR_DATA_MODEL_READINESS.md`](./CALENDAR_DATA_MODEL_READINESS.md).

### Boundary rule

Mock display strings, counters, local form state, filter state, visual colors, launcher context, and disabled preview actions are not storage contracts. Real persistence should begin behind explicit server-owned commands and project-scoped authorization, not by replacing mock arrays with direct table reads one page at a time.

## 2. Proposed core entities

Names below are conceptual. Final table names, columns, constraints, and indexes belong in a later schema-design/migration step.

| Entity | Responsibility | Key relationships and authority |
| --- | --- | --- |
| Auth identities / users | Authenticated people who may enter special-access surfaces | Supabase Auth identity maps to one application user. Volunteers do not require one. Authentication identity must remain separate from project role grants. |
| Project workspaces | One real-world project, lifecycle, locale, scheduling timezone, and public-intake settings | Current product direction is one workspace per project. If that changes, split `workspace` and `project` before persistence rather than using the ids interchangeably. |
| Project contacts | A person/contact associated with a project | May reference an authenticated user, but an invited contact can exist before account activation. Store project-specific contact details deliberately; do not assume auth email is the public contact email. |
| Contact role / permission grants | Project-scoped authorization | Links a user/contact to a project, role, optional congregation scope, capability set, validity period, and inviter. This is the source of admin access—not a role string on the user. |
| Congregations | Project-relevant congregation identity | Project contacts and volunteer profiles may reference one. Assistant scope can restrict rows to a congregation where the workflow supports it. |
| Questionnaire submissions | Immutable-ish intake answers and review workflow | Belongs to one project; may later link to one volunteer profile. Keep submission truth separate from the approved profile snapshot. |
| Volunteer profiles | Project-approved volunteer identity, contact, availability, skills, limitations, and readiness | Project-scoped unless a later cross-project person model is explicitly designed. Sensitive fields require stricter access than schedule summaries. |
| Task presets | Reusable work definitions and defaults | Project-scoped definition with type/category, default needed count, visibility, and custom-field definitions. It contains no schedule placement or volunteer assignment. |
| Calendar items / scheduled work | A scheduled occurrence or deliberate project context item | Belongs to a project and references one preset or one one-off snapshot. Stores schedule, lifecycle, needed count, notes, and source metadata. It does not own authoritative filled/confirmed counters. |
| Assignment rows | Relationship between scheduled work and a volunteer | The assignment plus its current response relation is the source of staffing and response truth. Enforce project consistency and deliberate uniqueness/overbooking rules. |
| Volunteer responses | Volunteer decision for an assignment | Likely one current response per assignment plus response timestamps/source, with changes preserved through audit events or response history. Client-calculated status is never authoritative. |
| Communications / message drafts | Prepared project updates, reminders, and announcements | Project-scoped content, audience definition, author, lifecycle, and related item/assignment references. Draft state is separate from delivery state. |
| Reminder deliveries / events | Planned, attempted, delivered, failed, opened, or acted-on delivery facts | References a communication and optionally assignment/volunteer. Provider ids and delivery status do not belong on Calendar items. |
| Needs-attention / follow-up items | Actionable exceptions or manually tracked follow-up | Prefer deriving coverage/response issues from authoritative rows. Persist only when dismissal, ownership, notes, or manual lifecycle must survive recomputation. |
| Audit events / activity history | Who did what, when, and in which project | Append-oriented history for role grants, questionnaire review, profile creation, schedule edits, assignments, responses, communications, and sensitive access. |

### Shared entity rules

- Every project-owned row needs an unambiguous project/workspace scope.
- Server-generated ids, created/updated timestamps, actor/source metadata, and concurrency/version strategy should be consistent.
- Soft deletion/archive behavior must be chosen per entity; do not use one blanket rule.
- Food, Security, construction, cleanup, and general work remain task types, filtered views, and permission capabilities inside the unified task/Calendar model—not separate scheduling databases.
- Sensitive questionnaire/profile values should not be copied into broadly readable schedule rows.

## 3. Access model

### Public volunteer access without an account

No account should be required for ordinary volunteers. Name/email can remain a friendly discovery prompt, but production lookup must not return schedules merely because input text matches a person. A safe first production pattern is:

1. Accept project plus name/email without confirming whether a matching volunteer exists.
2. Send or reissue an opaque, scoped link through a verified channel when a match is eligible.
3. Open only the schedule/profile slice authorized by that link.
4. Optionally remember the authorized device through a revocable, expiring opaque credential—not stored volunteer PII.

The current direct Alex lookup is therefore a UI demonstration, not the proposed security flow.

### Questionnaire links

Public questionnaire access can be project-specific without exposing admin data. A public intake identifier/configuration should reveal only the questionnaire form and minimal project display context. Submission creation may be anonymous, but reading, reviewing, approving, or linking submissions requires authorized project access.

### Project contacts

- **Main contacts:** authenticated, project-scoped access to the capabilities granted for schedule, volunteers, questionnaire review, communications, and settings.
- **Assistant contacts:** authenticated access with explicit capabilities and optional congregation scope. Scope must be enforced in queries/policies, not only hidden in navigation.
- **On-site contacts:** either authenticated users with a narrow grant or a short-lived code/link exchanged for a tightly scoped session. A shared permanent password/code is not a safe default.
- **Platform/project owners:** future authenticated access for project provisioning, support, and cross-project administration. Cross-project access must be explicit and audited.
- **Project switching:** derive the selectable project list from active grants. Changing project must change the server-enforced scope, not just a client filter.

## 4. Role and permission model

Use project-scoped grants and capabilities rather than mini-app roles. A role can provide defaults, but authorization should answer a capability question for a specific project and optional congregation.

| Role direction | Typical scope | Likely capabilities |
| --- | --- | --- |
| Main contact | Whole project | View/edit schedule, manage assignments, review questionnaires, manage volunteers, prepare communications, view follow-up, manage selected project settings. |
| Assistant contact | Whole project or one/more congregations | View schedule; edit permitted work; review/manage volunteers and questionnaires only within granted scope; prepare updates if granted. |
| On-site contact | Narrow project/session window | View today's work and check-in guidance; update limited arrival/completion facts if later approved; no broad profile or settings access. |
| Volunteer | Token-authorized personal slice | View only their project display context and assignments; respond only to assignments in token scope; no other volunteer data. |
| Platform owner/admin | Explicit cross-project support scope | Provisioning and support actions, with strong audit requirements and no implicit volunteer-token behavior. |

Candidate capabilities include `schedule.view`, `schedule.edit`, `assignments.manage`, `questionnaires.review`, `volunteers.view`, `volunteers.edit`, `communications.prepare`, `communications.send`, `follow_up.view`, and `project.settings.manage`.

Food/Security visibility should be expressed through task-type filters and capabilities such as viewing or managing a class of tasks. Do not create unrelated Food Admin and Security Admin data silos unless a real access requirement cannot be represented through scoped grants.

## 5. Public volunteer identity strategy

### Why no volunteer accounts

Most volunteers need occasional, low-friction access to one project. Requiring passwords creates support burden, abandonment, and unnecessary identity storage. Account-free must mean **no password/account setup**, not **no access control**.

### Safe link/token direction

- Use opaque, high-entropy tokens; store only a hash or equivalent verifier server-side.
- Scope a token to one project and one volunteer schedule, or more narrowly to one assignment/response action.
- Give tokens purpose, issued/expiry/revocation timestamps, and last-used metadata.
- Avoid putting email, volunteer id, project role, or predictable ids in a bearer value.
- Reminder links can authorize one assignment view/response; a broader schedule link needs a separate explicit scope.
- Treat forwarded links as bearer credentials. Provide expiration/revocation and avoid displaying sensitive profile data.
- A remembered device should hold an opaque credential in an appropriate secure browser mechanism. Do not put schedule data or personal details in `localStorage`.

### Exposure boundaries

Never expose another volunteer's name, email, phone, birth date, emergency contact, limitations, questionnaire answers, congregation-only notes, or full crew roster through a public lookup/token unless the product deliberately authorizes that exact field. Public assignment pages should favor task, schedule, location, personal response, and generic crew/coverage context.

Use uniform lookup responses to reduce person-enumeration risk. Apply rate limits/abuse controls before public lookup or link reissue becomes real.

## 6. Calendar persistence readiness

The Calendar contract remains:

- A task preset is a reusable work definition.
- A Calendar item is one scheduled occurrence or intentional project-context item.
- Assignment rows and their responses are the source of coverage and response truth.
- Filled, confirmed, denied, waiting, and open counts are derived—not authoritative Calendar item columns.
- Item lifecycle is separate from assignment response and derived coverage.
- Proposed schedule kinds are `timed`, `date_based`, `multi_day_window`, and `milestone`.
- True all-day volunteer events are likely rare. Full-day work normally remains a timed block spanning the visible workday.
- `date_based` means no meaningful time, not a 24-hour commitment.
- Multi-day project windows are informational by default; distinct volunteer shifts need distinct assignable work.
- The Project context band should be reconsidered later and may become rare, collapsible, or removable.
- Every `+N` overflow must reveal useful hidden work. Month/Week may open Day or a fuller List; Day must not navigate to itself.

Iteration 11.9 resolves only the first narrow storage choices: workspace-derived timezone, local date/time fields, inclusive project windows, and immutable name/type snapshots at creation. Overnight work, assignment uniqueness/capacity, response transitions, recurrence/copy provenance, audit history, general edits, and mutation idempotency remain unresolved. Commands must not accept client-derived counters or authorization scope.

## 7. Recommended data migration order

Each step should have an exit gate and rollback strategy. Do not migrate every mock surface at once.

1. **Supabase project/client setup:** environment skeleton, generated types strategy, server/client boundary, local development workflow, secret handling, and connectivity smoke test. No product tables or broad UI migration.
2. **Contact authentication:** invite-only project-contact auth shell, session handling, sign-out, and protected-route boundary. Volunteers remain account-free.
3. **Projects/workspaces:** persist project identity, lifecycle, timezone, and public configuration; prove project isolation.
4. **Contacts, grants, and congregations:** persist project membership, roles/capabilities, assistant scope, invites, and project switching.
5. **Questionnaire submissions:** persist public submission creation first; then authorized review/update with validation, rate limiting, and audit.
6. **Volunteer profiles:** implement explicit approved-submission-to-profile workflow and sensitive-field access rules.
7. **Task presets:** persist unified project work definitions, custom-field definitions, type filters, and visibility.
8. **Calendar items:** implement the explicit schedule union and server-owned create/read paths without assignments first.
9. **Assignments and responses:** make coverage derived from assignment/response rows; add scoped volunteer response mutation and concurrency/audit handling.
10. **Communications and reminders:** persist drafts/plans, then integrate a provider behind a separate delivery boundary; add scoped link issuance/revocation.
11. **Needs Attention:** derive issues from persisted truth; persist only manual workflow state that must survive recomputation.
12. **Public volunteer secure access:** replace deterministic lookup/schedule/reminder previews with token-scoped reads only after volunteer, assignment, response, and abuse boundaries are proven.

Mock and real data should not be silently mixed on one route. Use an explicit slice-level cutover or feature boundary, with deterministic seed/test data for validation.

## 8. Security and RLS planning

Actual policies belong in later reviewed migrations. The policy model should start deny-by-default and cover:

- **Project isolation:** 11.4 denies all normal workspace rows. A future grant policy must allow an authenticated user to read project rows only through an active grant for that project.
- **Role/capability scope:** write access depends on capability, not merely membership. Sensitive volunteer/questionnaire fields have narrower read access than schedule summaries.
- **Assistant congregation scope:** enforce congregation predicates at the data boundary. Decide how cross-congregation assignments and unscoped volunteers behave before enabling it.
- **Platform scope:** cross-project administration requires an explicit platform grant and audit trail; never infer it from a client route.
- **Public questionnaire creation:** permit only minimal validated insert behavior for an open project intake; no anonymous list/read/update.
- **Volunteer bearer access:** token verification resolves a server-owned project/volunteer/assignment scope. Do not expose token tables through normal public queries.
- **Reminder scope:** an assignment reminder may read/respond only to the referenced assignment and volunteer. It must not become an implicit full-project session.
- **Response writes:** allow only valid state transitions for the scoped assignment, with server timestamps, idempotency/concurrency handling, and no arbitrary volunteer/item ids from the client.
- **Contact information:** public schedule results must exclude contact/profile/questionnaire fields not explicitly required.
- **Audit:** log grants, sensitive reads where appropriate, questionnaire review, schedule/assignment mutations, response changes, token issuance/revocation, and communication sends.
- **Privileged keys:** service-role access stays server-only and narrowly used. Browser code never receives service secrets.

RLS is one layer, not the whole authorization design. Server commands still validate project relationships, task source, schedule shape, response transition, and business invariants.

## 9. Open decisions before implementation

### Authentication and roles

- Contact auth: magic link, password, one-time code, invite-only enrollment, or a deliberate combination?
- Must all main/assistant contacts have individual identities, or are any shared identities allowed? Recommended default: individual identities.
- On-site access: individual user, short-lived shared event code, or code exchanged for a named/scoped session?
- Who can invite, revoke, and change grants? Is dual approval needed for platform or owner access?
- Is assistant scope exactly one congregation, many congregations, or capability-dependent?

### Public volunteer access

- Is name/email lookup only a link-reissue request, or can a second factor prove identity immediately?
- Schedule-token and assignment-reminder-token lifetime, rotation, revocation, reuse, and forwarding behavior?
- Does a reminder link grant only response access or also full assignment details?
- Remembered-device storage, expiry, revocation, and shared-device UX?
- Which schedule/contact fields are safe on public token pages?
- Rate limits, bot controls, and privacy-preserving lookup responses?

### Intake and volunteer truth

- Questionnaire approval states and which transitions require notes/audit?
- When is a volunteer profile created: submission, approval, manual action, or merge with an existing profile?
- Is a volunteer profile project-specific or linked to a separate cross-project person identity?
- Duplicate matching/merge rules for name, email, phone, and congregation?
- Which original answers remain immutable, and which approved values are copied/snapshotted onto the profile?

### Scheduling and responses

- Workspace/project timezone, DST, locale, and date-only conversion policy?
- Assignment uniqueness, capacity decreases, waitlist/overbooking, cancellation, and completion rules?
- Valid response states/transitions and whether a volunteer can change a response after a deadline?
- Optimistic concurrency and idempotency keys for schedule/assignment/response mutations?
- Preset edits versus historical Calendar item snapshots?
- Recurrence/copy/bulk behavior and audit granularity?

### Communications

- Email/text provider boundary and ownership of templates, scheduling, retries, bounces, suppression, and unsubscribe?
- Is a reminder delivery row created at plan time, send time, or per provider attempt?
- How do communication audiences resolve consistently from assignments/responses without storing stale recipient lists?
- Retention requirements for message bodies, delivery metadata, and reminder tokens?

### Governance

- Audit retention, actor attribution, support access, export/deletion, and incident review requirements?
- Data retention for questionnaire submissions, rejected applicants, expired tokens, archived projects, and communications?
- Backup/restore expectations and migration rollback procedure?

## 10. Recommended next 11.x slices

- **11.2 Supabase Project Setup + Environment Skeleton — completed:** installed the approved client, defined lazy environment/client boundaries, and added a table-free connectivity check plus secret-handling guidance. No app route or product data migrated.
- **11.3 Auth Shell for Project Contacts — completed:** invite-only magic-link sign-in, cookie session/callback, POST sign-out, optional enforced admin boundary, and empty placeholder grant loading. No product authorization or data migration.
- **11.4 Workspace Persistence Foundation — completed:** one workspace identity table, deny-by-default RLS, an unused server-only reader, and focused isolation checks.
- **11.5 Project Contact Grants + Workspace Authorization — completed:** active project contacts/grants, workspace-read RLS, server-only readers, and focused authorization contract checks; no product-route migration.
- **11.6 Questionnaire submission persistence — completed:** controlled public creation, immutable answer snapshots, `questionnaires.review` reads, and focused contract checks; no route cutover or profile creation.
- **11.7 Volunteer profile persistence — completed:** explicit capability-authorized conversion, same-workspace provenance, sensitive-field separation, and `volunteers.view` reads; no route cutover.
- **11.8 Task preset persistence — completed:** reusable definitions, bounded custom fields, capability-scoped create/read/archive, and no scheduling fields or route cutover.
- **11.9 Calendar item persistence — completed:** explicit schedule kinds, workspace-derived timezone, preset-or-one-off snapshots, capability-scoped create/read/archive, and no route or assignment cutover.
- **11.10 Assignment/response persistence — completed:** same-workspace assignment truth, one current response row, contact-only capability commands, derived future coverage, and no public token or route cutover.
- **11.11 Public volunteer response authorization — completed:** database-generated opaque bearers, hash-only storage, expiry/revocation, minimal verification, scoped public response mutation, and no route/delivery cutover.
- **Post-11.11 validation gate — passed 2026-07-02:** local migrations apply through 11.11; live RLS, capability, Calendar, assignment, response, token-storage, verification, expiry, revocation, inactive-state, public-scope, and concurrency checks pass. Public/contact overlap is scoped to the target response row, rejects the loser with SQLSTATE `40001`, and preserves only winner truth. Reviewed local public-schema types were generated after the successful gate.
- **Later communications/reminder persistence readiness:** drafts, delivery boundary, token issuance/revocation, and provider decision.

No public route integration should proceed until the full migration chain is applied in a non-production Supabase environment and live token/RLS behavior is exercised. Communications, reminder delivery, Needs Attention, remembered devices, lookup, and broad route cutovers remain separate later slices.

## Readiness exit criteria

Before the first real product-data migration, the team should be able to answer:

- What is the canonical project scope key?
- Which users/roles/capabilities may read and mutate each entity?
- How do volunteers prove access without accounts?
- Which public fields are safe for schedule/reminder views?
- What is authoritative for Calendar schedule, coverage, and responses?
- What timezone and date-range rules are enforced?
- How are mutations audited, retried, and made idempotent?
- How is mock-to-real cutover isolated and reversible?

Until those answers are encoded in reviewed schema/policy/command designs, the existing mock prototype remains the product-behavior reference—not a database contract.
