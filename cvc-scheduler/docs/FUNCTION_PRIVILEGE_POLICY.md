# Project Local function EXECUTE policy — local 12.45

Status: the September 5 migrations are deployed according to the approved production record. The 12.45 migration 20260906120000 is local and UNAPPLIED to production. No production access occurs in this review.

## Evidence and severity

Read-only production identity matched project-local-production / wdlaauzknfggoqldolmx and terminal 20260904130000. Catalog-only audit ran with default_transaction_read_only=on and BEGIN READ ONLY, then ROLLBACK. No product RPC, user-data query, backup, task mutation, or email was performed. Sanitized before-state inventory: [function-privilege-audit-before.json](function-privilege-audit-before.json).

Both schemas had 38 unexpected effective anon functions: 26 authenticated SECURITY DEFINER RPCs and 12 internal SECURITY INVOKER trigger/helpers. Eight trigger functions also had PUBLIC EXECUTE. Local had 54 functions including lookup; production had 53 without lookup. All are owned by postgres and have an empty, pinned search_path. No unsafe SECURITY DEFINER search path was found.

Token issuance, notification claims (which return contact details), audited response-link reveal, and Calendar/volunteer mutations are particularly sensitive. Review of each definition finds auth.uid(), live contact/grant/capability checks and workspace joins before protected results/mutations; authenticated reads similarly constrain their scope. This is a real excessive EXECUTE defect. There is no demonstrated anonymous authorization bypass or evidence of a breach. The patch adds the missing outer permission boundary while retaining those internal checks.

## 12.45 additions

- save_calendar_meal(uuid,uuid,text,date,time without time zone,time without time zone,text,text,text,integer,text) requires Auth, an active project/contact/live grant and workspace.read + calendar.edit. It creates or updates only one scoped active meal, validates fields, and uses the existing creation/publication commands atomically.
- duplicate_calendar_item(uuid,date,time without time zone,time without time zone) requires the same live identity with workspace.read, calendar.view, and calendar.edit; private sources additionally require creator ownership. It locks the source and inserts one independent definition, never assignment/response/delivery rows.
- Both new RPCs are owned by postgres, SECURITY DEFINER with empty search_path, with PUBLIC/anon denied and exact authenticated/service_role grants. No new anonymous RPC or internal helper is introduced. The existing volunteer schedule signature adds only explicit safe meal fields to its result; its credential/response checks remain unchanged.
- Exact local inventory: 8 anonymous, 36 authenticated-only, 12 internal; 44 SECURITY DEFINER functions. Production inventory remains the prior 54 until rollout.

## Current policy

Exact test data: [function-privilege-policy.mjs](../scripts/function-privilege-policy.mjs). All 56 local-source signatures must be classified; extra/missing functions or different owners fail. PUBLIC execution is denied on every Project Local function. Service-role access on the existing application RPCs is retained; internal helpers lose service_role as well as anon/authenticated. There is no service-role-only product RPC in the reviewed inventory, and the application introduces no service-role secret.

### A — intentional anonymous RPCs (8)

Each retains exact anon and authenticated grants; the existing service_role privilege is preserved. The public table ACL policy is unchanged.

| Exact signature | Boundary and minimal result | Definition and caller |
| --- | --- | --- |
| `confirm_all_volunteer_schedule_assignments(text)` | Verified schedule bearer; volunteer + workspace scoped; published active future assignments only; bounded count result. | [20260714122100_volunteer_schedule_responses.sql:480](../supabase/migrations/20260714122100_volunteer_schedule_responses.sql); [lib/volunteerScheduleAccess/server.ts](../lib/volunteerScheduleAccess/server.ts) |
| `read_assignment_response_by_token(text)` | Hashed, unexpired, unrevoked assignment bearer; matching assignment, volunteer, workspace, published item; narrow schedule/response projection. | [20260714121900_calendar_publication_visibility.sql:1197](../supabase/migrations/20260714121900_calendar_publication_visibility.sql); [lib/responseTokens/server.ts](../lib/responseTokens/server.ts) |
| `read_project_quick_view_by_token(text,date)` | Hashed project bearer; active project and expiry/date gate; trusted published Calendar projection includes Security, assigned names, operational notes, typed meal contacts and safe custom values; excludes profile contacts/notes and credentials. Pre-12.45 links are revoked on migration, preserving their audit records. | [20260902120000_project_quick_view_share_access.sql:260](../supabase/migrations/20260902120000_project_quick_view_share_access.sql); [lib/projectQuickViewAccess/server.ts](../lib/projectQuickViewAccess/server.ts) |
| `read_volunteer_schedule(text)` | Hashed schedule bearer; active/ready volunteer and workspace; published active assignments scoped to that volunteer; no directory. | [20260714122200_initial_assignment_notifications.sql:804](../supabase/migrations/20260714122200_initial_assignment_notifications.sql); [lib/volunteerScheduleAccess/server.ts](../lib/volunteerScheduleAccess/server.ts) |
| `submit_assignment_response_by_token(text,text,text)` | Assignment bearer with exact scope; start/48-hour response locks, concurrency guards; narrow response result. | [20260714122100_volunteer_schedule_responses.sql:595](../supabase/migrations/20260714122100_volunteer_schedule_responses.sql); [lib/responseTokens/server.ts](../lib/responseTokens/server.ts) |
| `submit_questionnaire_submission(text,jsonb,integer)` | Public intake explicitly enabled on active workspace key; bounded validated answers/version; returns newly created submission reference, no existing data. | [20260701020000_questionnaire_submissions.sql:78](../supabase/migrations/20260701020000_questionnaire_submissions.sql); [lib/questionnaires/server.ts](../lib/questionnaires/server.ts) |
| `submit_volunteer_schedule_assignment_response(text,uuid,text,text)` | Verified schedule bearer and exact assignment/volunteer/workspace join; start/48-hour locks; narrow response result. | [20260714122100_volunteer_schedule_responses.sql:335](../supabase/migrations/20260714122100_volunteer_schedule_responses.sql); [lib/volunteerScheduleAccess/server.ts](../lib/volunteerScheduleAccess/server.ts) |
| `verify_volunteer_schedule_lookup(text,text,text)` | Exact normalized name/contact; active/ready gates; duplicate fail closed; opaque HMAC project choices; DB serialized limiter; hash-only stored bearer. Route exchanges bearer into existing HttpOnly cookie. | [20260905120000_volunteer_schedule_lookup.sql:14](../supabase/migrations/20260905120000_volunteer_schedule_lookup.sql); [app/v/lookup/route.ts](../app/v/lookup/route.ts) |

### B — authenticated application RPCs (36)

Each denies anon/PUBLIC, explicitly grants authenticated, preserves the existing service_role ACL, and remains SECURITY DEFINER with search_path=''. Every row below has verified identity and live grant/capability/workspace checks. Capabilities listed are the source predicates (read_assignment_detail_context requires view and reports edit separately).

| Exact signature | Capability predicates | Definition / application caller |
| --- | --- | --- |
| `save_calendar_meal(uuid,uuid,text,date,time without time zone,time without time zone,text,text,text,integer,text)` | 'workspace.read', 'calendar.edit' | [20260906120000_on_site_food_calendar_operations.sql](../supabase/migrations/20260906120000_on_site_food_calendar_operations.sql); [lib/calendar/operations.actions.ts](../lib/calendar/operations.actions.ts) |
| `duplicate_calendar_item(uuid,date,time without time zone,time without time zone)` | 'workspace.read', 'calendar.view', 'calendar.edit'; own draft or published source | [20260906120000_on_site_food_calendar_operations.sql](../supabase/migrations/20260906120000_on_site_food_calendar_operations.sql); [lib/calendar/operations.actions.ts](../lib/calendar/operations.actions.ts) |
| `archive_calendar_item(uuid)` | 'calendar.edit' | [20260714121900_calendar_publication_visibility.sql:521](../supabase/migrations/20260714121900_calendar_publication_visibility.sql); [lib/calendar/server.ts](../lib/calendar/server.ts) |
| `archive_task_preset(uuid)` | 'tasks.edit' | [20260701040000_task_presets.sql:266](../supabase/migrations/20260701040000_task_presets.sql); [lib/tasks/server.ts](../lib/tasks/server.ts) |
| `cancel_calendar_assignment(uuid)` | 'assignments.edit' | [20260714121900_calendar_publication_visibility.sql:825](../supabase/migrations/20260714121900_calendar_publication_visibility.sql); [lib/assignments/server.ts](../lib/assignments/server.ts) |
| `claim_initial_assignment_notification_deliveries(uuid)` | 'assignments.edit' | [20260714122200_initial_assignment_notifications.sql:346](../supabase/migrations/20260714122200_initial_assignment_notifications.sql); [lib/calendar/assignmentNotifications.server.ts](../lib/calendar/assignmentNotifications.server.ts) |
| `convert_questionnaire_submission_to_volunteer_profile(uuid)` | 'questionnaires.review', 'volunteers.edit' | [20260701030000_volunteer_profiles.sql:129](../supabase/migrations/20260701030000_volunteer_profiles.sql); [lib/volunteers/server.ts](../lib/volunteers/server.ts) |
| `create_calendar_assignment(uuid,uuid,text)` | 'assignments.edit' | [20260714121900_calendar_publication_visibility.sql:569](../supabase/migrations/20260714121900_calendar_publication_visibility.sql); [lib/assignments/server.ts](../lib/assignments/server.ts) |
| `create_calendar_assignments_batch(uuid,uuid[],text)` | 'assignments.edit' | [20260714121900_calendar_publication_visibility.sql:673](../supabase/migrations/20260714121900_calendar_publication_visibility.sql); [lib/assignments/server.ts](../lib/assignments/server.ts) |
| `create_calendar_item(uuid,uuid,text,text,text,date,date,time without time zone,time without time zone,integer,text,jsonb)` | 'calendar.edit' | [20260714121900_calendar_publication_visibility.sql:139](../supabase/migrations/20260714121900_calendar_publication_visibility.sql); [lib/calendar/server.ts](../lib/calendar/server.ts) |
| `create_current_workspace_repeated_calendar_items(uuid,uuid,text,text,date,date,smallint[],time without time zone,time without time zone,integer,text,jsonb)` | 'workspace.read', 'calendar.edit' | [20260904120000_operational_usability.sql:160](../supabase/migrations/20260904120000_operational_usability.sql); [lib/calendar/repeat.server.ts](../lib/calendar/repeat.server.ts) |
| `create_manual_volunteer_profile(uuid,text,text,text,text,text,text,text)` | 'volunteers.edit' | [20260714121500_manual_volunteer_profiles.sql:55](../supabase/migrations/20260714121500_manual_volunteer_profiles.sql); [lib/volunteers/server.ts](../lib/volunteers/server.ts) |
| `create_task_preset(uuid,text,text,text,integer,boolean,jsonb)` | 'tasks.edit' | [20260701040000_task_presets.sql:185](../supabase/migrations/20260701040000_task_presets.sql); [lib/tasks/server.ts](../lib/tasks/server.ts) |
| `delete_history_free_volunteer_profile(uuid)` | 'volunteers.edit' | [20260904120000_operational_usability.sql:85](../supabase/migrations/20260904120000_operational_usability.sql); [lib/volunteers/server.ts](../lib/volunteers/server.ts) |
| `finalize_initial_assignment_notification_delivery(uuid,text,text,text)` | 'assignments.edit' | [20260714122200_initial_assignment_notifications.sql:709](../supabase/migrations/20260714122200_initial_assignment_notifications.sql); [lib/calendar/assignmentNotifications.server.ts](../lib/calendar/assignmentNotifications.server.ts) |
| `issue_assignment_response_token(uuid,integer,text)` | 'assignments.edit' | [20260714121900_calendar_publication_visibility.sql:975](../supabase/migrations/20260714121900_calendar_publication_visibility.sql); [lib/responseTokens/server.ts](../lib/responseTokens/server.ts) |
| `issue_project_quick_view_access(uuid)` | 'workspace.read', 'calendar.edit' | [20260902120000_project_quick_view_share_access.sql:59](../supabase/migrations/20260902120000_project_quick_view_share_access.sql); [lib/projectQuickViewAccess/server.ts](../lib/projectQuickViewAccess/server.ts) |
| `issue_volunteer_schedule_access(uuid,integer)` | 'assignments.edit' | [20260714122000_volunteer_schedule_access.sql:72](../supabase/migrations/20260714122000_volunteer_schedule_access.sql); [lib/calendar/assignmentNotifications.server.ts](../lib/calendar/assignmentNotifications.server.ts), [lib/volunteerScheduleAccess/server.ts](../lib/volunteerScheduleAccess/server.ts) |
| `publish_calendar_item(uuid)` | 'calendar.edit' | [20260714121900_calendar_publication_visibility.sql:300](../supabase/migrations/20260714121900_calendar_publication_visibility.sql); [lib/calendar/server.ts](../lib/calendar/server.ts) |
| `read_assignment_detail_context(uuid)` | 'assignments.edit'; 'assignments.view' | [20260714121900_calendar_publication_visibility.sql:1529](../supabase/migrations/20260714121900_calendar_publication_visibility.sql); [lib/assignments/detailContext.server.ts](../lib/assignments/detailContext.server.ts) |
| `read_assignment_notification_delivery_health()` | 'workspace.read', 'calendar.view', 'assignments.view', 'assignments.edit' | [20260811123300_stale_assignment_notification_delivery_health.sql:5](../supabase/migrations/20260811123300_stale_assignment_notification_delivery_health.sql); [lib/observability/assignmentNotificationHealth.server.ts](../lib/observability/assignmentNotificationHealth.server.ts) |
| `read_initial_assignment_notification_summaries(uuid[])` | 'assignments.edit' | [20260714122200_initial_assignment_notifications.sql:169](../supabase/migrations/20260714122200_initial_assignment_notifications.sql); [lib/calendar/assignmentNotifications.server.ts](../lib/calendar/assignmentNotifications.server.ts) |
| `read_project_quick_view_share_state(uuid)` | 'workspace.read', 'calendar.edit' | [20260902120000_project_quick_view_share_access.sql:164](../supabase/migrations/20260902120000_project_quick_view_share_access.sql); [lib/projectQuickViewAccess/server.ts](../lib/projectQuickViewAccess/server.ts) |
| `record_assignment_response_link_reveal_event(uuid,uuid,text,text,timestamp with time zone,jsonb)` | 'assignments.edit' | [20260703000000_response_link_reveal_audit.sql:106](../supabase/migrations/20260703000000_response_link_reveal_audit.sql); [lib/responseTokens/revealAudit.server.ts](../lib/responseTokens/revealAudit.server.ts) |
| `replace_assignment_response_token(uuid,integer)` | 'assignments.edit' | [20260714121900_calendar_publication_visibility.sql:1080](../supabase/migrations/20260714121900_calendar_publication_visibility.sql); [lib/responseTokens/replacement.server.ts](../lib/responseTokens/replacement.server.ts) |
| `reveal_assignment_response_link(uuid,integer,text,jsonb)` | 'assignments.edit' | [20260714121900_calendar_publication_visibility.sql:1357](../supabase/migrations/20260714121900_calendar_publication_visibility.sql); [lib/responseTokens/auditedReveal.server.ts](../lib/responseTokens/auditedReveal.server.ts) |
| `revoke_assignment_response_token(uuid)` | 'assignments.edit' | [20260701070000_assignment_response_tokens.sql:185](../supabase/migrations/20260701070000_assignment_response_tokens.sql); [lib/responseTokens/server.ts](../lib/responseTokens/server.ts) |
| `revoke_project_quick_view_access(uuid)` | 'workspace.read', 'calendar.edit' | [20260902120000_project_quick_view_share_access.sql:216](../supabase/migrations/20260902120000_project_quick_view_share_access.sql); [lib/projectQuickViewAccess/server.ts](../lib/projectQuickViewAccess/server.ts) |
| `revoke_volunteer_schedule_access(uuid)` | 'assignments.edit' | [20260714122000_volunteer_schedule_access.sql:162](../supabase/migrations/20260714122000_volunteer_schedule_access.sql); [lib/calendar/assignmentNotifications.server.ts](../lib/calendar/assignmentNotifications.server.ts), [lib/volunteerScheduleAccess/server.ts](../lib/volunteerScheduleAccess/server.ts) |
| `set_current_project_day_expected_on_site(date,integer)` | 'workspace.read', 'calendar.edit' | [20260829130000_project_day_operational_foundation.sql:75](../supabase/migrations/20260829130000_project_day_operational_foundation.sql); [lib/operations/projectDay.server.ts](../lib/operations/projectDay.server.ts) |
| `update_assignment_response(uuid,text,text)` | 'assignments.edit' | [20260714121900_calendar_publication_visibility.sql:877](../supabase/migrations/20260714121900_calendar_publication_visibility.sql); [lib/assignments/server.ts](../lib/assignments/server.ts) |
| `update_calendar_item_one_off_timed(uuid,text,text,date,time without time zone,time without time zone,integer,text,jsonb)` | 'calendar.edit' | [20260714121900_calendar_publication_visibility.sql:364](../supabase/migrations/20260714121900_calendar_publication_visibility.sql); [lib/calendar/server.ts](../lib/calendar/server.ts) |
| `update_calendar_item_preset_timed(uuid,date,time without time zone,time without time zone,integer,text,jsonb)` | 'calendar.edit' | [20260714121900_calendar_publication_visibility.sql:446](../supabase/migrations/20260714121900_calendar_publication_visibility.sql); [lib/calendar/server.ts](../lib/calendar/server.ts) |
| `update_current_project_contact_volunteer_facing_details(uuid,text,text,text)` | 'workspace.read' | [20260824123500_follow_up_contact_self_edit.sql:6](../supabase/migrations/20260824123500_follow_up_contact_self_edit.sql); [lib/projectContacts/volunteerFacingDetails.server.ts](../lib/projectContacts/volunteerFacingDetails.server.ts) |
| `update_current_workspace_project_dates(date,date)` | 'workspace.read', 'calendar.edit' | [20260904120000_operational_usability.sql:22](../supabase/migrations/20260904120000_operational_usability.sql); [lib/operations/projectDates.server.ts](../lib/operations/projectDates.server.ts) |
| `update_volunteer_profile_manual_fields(uuid,text,text,text,text,text,text,text,text)` | 'volunteers.edit' | [20260714121500_manual_volunteer_profiles.sql:189](../supabase/migrations/20260714121500_manual_volunteer_profiles.sql); [lib/volunteers/server.ts](../lib/volunteers/server.ts) |

### C — internal functions (12)

No anon, PUBLIC, authenticated, or service_role EXECUTE. postgres owner access remains. Existing triggers execute through PostgreSQL's trigger mechanism; their invoker bodies run in the initiating SQL context, normally the RPC owner. No trigger is converted to SECURITY DEFINER. CHECK/helper evaluations inside definer RPCs inherit owner context. Timestamp/validation/Calendar/Task/volunteer/Project Day preservation tests exercise these paths.

| Exact signature | Actual internal caller |
| --- | --- |
| `calendar_assignment_response_start_at(text,date,time without time zone,text)` | Called within owner-executed response/notification/schedule RPCs; no app caller. [Definition](../supabase/migrations/20260714122100_volunteer_schedule_responses.sql) |
| `calendar_custom_values_are_valid(jsonb)` | Calendar CHECK constraint and owner-executed Calendar RPC validation; app table writes already denied. [Definition](../supabase/migrations/20260701050000_calendar_items.sql) |
| `enforce_calendar_item_workspace_timezone()` | Installed table trigger; no app RPC caller. [Definition](../supabase/migrations/20260701050000_calendar_items.sql) |
| `response_link_reveal_metadata_is_valid(jsonb)` | Audit CHECK constraint and owner-executed audited-reveal RPC validation; no app caller. [Definition](../supabase/migrations/20260703000000_response_link_reveal_audit.sql) |
| `set_assignment_updated_at()` | Installed table trigger; no app RPC caller. [Definition](../supabase/migrations/20260701060000_assignment_responses.sql) |
| `set_calendar_item_updated_at()` | Installed table trigger; no app RPC caller. [Definition](../supabase/migrations/20260701050000_calendar_items.sql) |
| `set_project_authorization_updated_at()` | Installed table trigger; no app RPC caller. [Definition](../supabase/migrations/20260701010000_project_contact_grants.sql) |
| `set_project_day_updated_at()` | Installed table trigger; no app RPC caller. [Definition](../supabase/migrations/20260829130000_project_day_operational_foundation.sql) |
| `set_task_preset_updated_at()` | Installed table trigger; no app RPC caller. [Definition](../supabase/migrations/20260701040000_task_presets.sql) |
| `set_volunteer_profile_updated_at()` | Installed table trigger; no app RPC caller. [Definition](../supabase/migrations/20260701030000_volunteer_profiles.sql) |
| `set_workspace_updated_at()` | Installed table trigger; no app RPC caller. [Definition](../supabase/migrations/20260701000000_workspace_identity.sql) |
| `task_custom_field_definitions_are_valid(jsonb)` | Tasks CHECK constraint and owner-executed Task RPC validation; app table writes already denied. [Definition](../supabase/migrations/20260701040000_task_presets.sql) |

## Creator/default policy and PostgreSQL scope limitation

All current Project Local functions were created by/are owned by postgres, locally and live. Role membership inspection shows postgres is not a member of supabase_admin; anon, authenticated, service_role have no membership elevating them to postgres. supabase_admin is the platform superuser and owns no Project Local function. We do not change its managed defaults or claim to constrain platform-superuser creation. A new migration owner requires explicit security review and a new creator-context proof; inventory regression rejects that drift.

Before: public-schema future-function defaults for both postgres and supabase_admin directly grant anon/authenticated/service_role; built-in global defaults also grant PUBLIC. Revoking only PUBLIC leaves direct anon grants. Revoking only schema defaults cannot remove built-in global PUBLIC: PostgreSQL combines global and per-schema defaults additively.

The migration revokes future PUBLIC/anon/authenticated function defaults for postgres globally and in public. The global PUBLIC revoke is the minimum PostgreSQL mechanism that can achieve deny-by-default in public; it also removes implicit PUBLIC access from future postgres-created functions in other schemas. No existing function outside public, managed-schema-specific default, or other creator's default is modified. Existing explicit storage defaults continue to apply. Future postgres-created functions anywhere needing PUBLIC require an explicit grant. This creator-global effect must be included in security review; a schema-only statement cannot provide the requested guarantee.

The local regression creates a uniquely named function as postgres, proves effective anon/authenticated/PUBLIC denial, then rolls the transaction back and verifies the function is absent. It also checks global + public default ACL entries using aclexplode rather than matching serialized ACL text. Changing to supabase_admin is neither necessary nor authorized by postgres membership; that platform context is explicitly outside the Project Local migration-creator contract.

## Migration and recovery

Lookup remains separate: 20260905120000_volunteer_schedule_lookup.sql. New forward migration: 20260905130000_harden_public_function_execute_privileges.sql. No product function bodies, table grants, trigger definitions, UI, screenshots, or production state are changed.

The recovery contract retains prior adjacent transitions and adds only 20260905120000 -> 20260905130000. The prior 20260904130000 -> 20260905120000 remains required. Direct 20260904130000 -> 20260905130000, downgrades, malformed/unknown terminals, running/wrong tasks and unsupported runtime contracts are refused. Both adjacent mismatches classify migration_lock_transition_pending.

## Verification commands

Disposable local only: supabase db reset --local, then node scripts/function-privilege-regression.mjs. Workflow scripts run through scripts/final-product-readiness-local.mjs, which supplies loopback configuration and disables real email transport. Generated types match the approved file with Supabase CLI 2.111.0 and gen types typescript --local (public + graphql_public). No type file change is needed for an ACL-only migration.

The response-token source regression is reconciled to already-approved Assignment Detail navigation, the single reviewed Quick View copy control, and the exact lookup HttpOnly-cookie sink; unrelated credential uses remain rejected. Project Day's parity command uses the same installed CLI/schema set as the approved generated file, avoiding npx's different CLI version/schema projection.


## Completed security review confirmation (12.44G.9)

- Current ACL + default fixture: PASS, 54 classified functions, eight anonymous boundaries, 34 authenticated RPCs, 12 internal helpers, zero unexpected anon/PUBLIC EXECUTE. All 42 SECURITY DEFINER definitions were reviewed; no direct auth bypass was demonstrated. Production remains unhardened at the previously audited terminal; no further production access occurred in this continuation.
- Fresh complete migration chain to 20260905130000: PASS. Public lookup/project choice, personalized schedule and Confirm/Deny/Confirm All, assignment-token contracts, questionnaire, Quick View bearer and admin sharing, Calendar create/edit/archive/assignment/publication, Tasks, Needs Attention, volunteer manual mutations, Project Day/dates, operational usability, beta containment, and recording-only notification claim/finalize: PASS.
- Calendar desktop/mobile browser interaction, focus/accessibility, persistence and overflow checks: PASS, screenshots disabled. Volunteer schedule browser exchange, HttpOnly cookie, leave path, isolation and empty/mobile states: PASS. Browser assertions were reconciled only to approved copy; no app behavior was changed.
- Systemic ACL/default fixture and production-independent recovery regression were confirmed again at completion. Both 20260904130000 -> 20260905120000 and 20260905120000 -> 20260905130000 pass; skipped, arbitrary, malformed, downgraded, wrong-lock and running-task transitions are denied.
- TypeScript, project ESLint, production build, exact generated types using the existing 2.111.0 CLI/schema set, PowerShell syntax/static checks and git diff --check: PASS. Only touched test files required additional lint after copy-assertion reconciliation.
- Backup script review: the current Git diff is +49/-1, not the previously reported +259/-235. All current changes are necessary semantic support or fixtures: two exact adjacent pending classifications, expected-terminal and pending-state fixtures, and their fixture-name registration. The larger historical display count is not reproducible from the current worktree; no whitespace churn or unintended behavioral refactor remains to remove. Backup artifact/encryption/hash/residue/task-lock/invocation paths and prior transitions are unchanged. No cleanup rewrite was needed.
- Audit artifact retained but reduced to 107 lines of exact signatures, SECURITY DEFINER classification and effective privilege booleans; repeated raw ACL/output-schema and platform metadata removed. Both audit documents contain no credentials, user rows, tokens or contact values. CURRENT_STATE records the pending architectural invariant, not a deployed claim.
- Local preview/Supabase stopped; .next, supabase/.temp and .env.local absent. Runtime residue was moved to recoverable external temp quarantine. Docker's single temporary preference is restored; Docker settings and the temporary read-only audit script are outside repository scope. Production mutations, backup runs, task mutations and real emails: zero. No commit/push/deploy; staged zero.

### Final dirty-path inventory

66 paths (33 project source/test/doc/migration files; 33 already-approved capture/index files). Paths are repository-relative. This review did not regenerate captures.

```text
cvc-scheduler/app/admin/dashboard/page.tsx
cvc-scheduler/app/admin/login/page.tsx
cvc-scheduler/app/admin/needs-attention/page.tsx
cvc-scheduler/app/admin/quick-view/page.tsx
cvc-scheduler/app/page.tsx
cvc-scheduler/app/v/schedule/page.tsx
cvc-scheduler/components/CalendarClient.tsx
cvc-scheduler/components/TaskPresetManagement.tsx
cvc-scheduler/docs/CURRENT_STATE.md
cvc-scheduler/lib/supabase/database.types.ts
cvc-scheduler/scripts/assignment-detail-route-regression.mjs
cvc-scheduler/scripts/calendar-regression.mjs
cvc-scheduler/scripts/hosted-calendar-source-selection-regression.mjs
cvc-scheduler/scripts/production-backup/Invoke-ProjectLocalProductionBackup.ps1
cvc-scheduler/scripts/production-backup/ProjectLocalProductionMigrationContract.ps1
cvc-scheduler/scripts/production-independent-backup-regression.mjs
cvc-scheduler/scripts/project-day-persistence-regression.mjs
cvc-scheduler/scripts/project-day-quick-view-regression.mjs
cvc-scheduler/scripts/project-quick-view-privilege-regression.mjs
cvc-scheduler/scripts/response-token-persistence-regression.mjs
cvc-scheduler/scripts/volunteer-schedule-access-browser-regression.mjs
cvc-scheduler/app/v/lookup/route.ts
cvc-scheduler/components/VolunteerLookup.tsx
cvc-scheduler/docs/FUNCTION_PRIVILEGE_POLICY.md
cvc-scheduler/docs/function-privilege-audit-before.json
cvc-scheduler/lib/volunteerScheduleAccess/lookup.ts
cvc-scheduler/scripts/final-product-readiness-browser.mjs
cvc-scheduler/scripts/final-product-readiness-local.mjs
cvc-scheduler/scripts/function-privilege-policy.mjs
cvc-scheduler/scripts/function-privilege-regression.mjs
cvc-scheduler/scripts/volunteer-lookup-regression.mjs
cvc-scheduler/supabase/migrations/20260905120000_volunteer_schedule_lookup.sql
cvc-scheduler/supabase/migrations/20260905130000_harden_public_function_execute_privileges.sql
previews/final-product-readiness/01-landing-desktop.png
previews/final-product-readiness/02-landing-mobile-360.png
previews/final-product-readiness/02-landing-mobile-390.png
previews/final-product-readiness/03-contact-verification-mobile.png
previews/final-product-readiness/04-verification-failure-mobile.png
previews/final-product-readiness/05-rate-limited-state-mobile.png
previews/final-product-readiness/06-project-choice-mobile.png
previews/final-product-readiness/06-volunteer-schedule-mobile-360.png
previews/final-product-readiness/07-volunteer-schedule-mobile-390.png
previews/final-product-readiness/08-volunteer-schedule-desktop.png
previews/final-product-readiness/09-volunteer-assignment-desktop.png
previews/final-product-readiness/10-volunteer-assignment-mobile.png
previews/final-product-readiness/11-overview-desktop.png
previews/final-product-readiness/11-overview-mobile.png
previews/final-product-readiness/12-calendar-desktop.png
previews/final-product-readiness/12-calendar-mobile-360.png
previews/final-product-readiness/12-calendar-mobile.png
previews/final-product-readiness/13-calendar-repeat-desktop.png
previews/final-product-readiness/14-tasks-desktop.png
previews/final-product-readiness/14-tasks-mobile.png
previews/final-product-readiness/15-needs-attention-desktop.png
previews/final-product-readiness/15-needs-attention-mobile.png
previews/final-product-readiness/16-volunteers-desktop.png
previews/final-product-readiness/16-volunteers-mobile.png
previews/final-product-readiness/17-volunteer-edit-desktop.png
previews/final-product-readiness/18-quick-view-desktop.png
previews/final-product-readiness/18-quick-view-mobile.png
previews/final-product-readiness/19-volunteer-edit-mobile.png
previews/final-product-readiness/20-calendar-repeat-mobile-360.png
previews/final-product-readiness/20-calendar-repeat-mobile-390.png
previews/final-product-readiness/21-assignment-detail-mobile.png
previews/final-product-readiness/22-contained-settings-mobile.png
previews/final-product-readiness/capture-index.json
```
