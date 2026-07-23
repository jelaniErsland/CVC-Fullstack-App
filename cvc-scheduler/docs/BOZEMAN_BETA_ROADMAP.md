# Bozeman Scheduling Beta Roadmap Re-baseline

This document supersedes the previous mechanical post-12.13 next-step assumption for near-term work. It does not erase historical sequencing; it re-baselines the current repository against the new target: a small, production-safe Project Local beta for real Bozeman volunteer scheduling, ideally ready by mid-August 2026.

The governing principle is: **Cut features, not integrity.**

Belgrade remains on the existing Google Sheets/App Script workflow and is the operational fallback. Do not migrate active Belgrade operations as part of the Bozeman beta milestone.

## Concise current-state summary

- Workspace, project-contact grant, questionnaire submission, volunteer profile, task preset, Calendar item, Calendar assignment/current response, public response-token, response route, and assignment-detail foundations exist.
- `/admin/calendar` is already cut over to persisted Calendar item reads and now supports the first narrow persisted one-off timed item create/edit path. It is server-owned, dynamic/no-store, bounded by server-derived Day/Week/Month/List ranges, workspace/contact/capability scoped, and free of mock/persisted item mixing.
- The Calendar read states remain ready with items, ready empty, unavailable, and error; the beta roadmap does not change those state semantics.
- `/admin/volunteers` is now cut over to persisted volunteer-profile truth for the narrow manual Add/Edit path. `/admin/tasks`, `/admin/announcements`, Needs Attention, and the public `/v/demo` volunteer portal remain mock/prototype surfaces.
- `lib/tasks/readModelContract.server.ts` defines the future persisted Tasks read-model contract, but `/admin/tasks` is not cut over.
- Calendar task-preset selection, the first Calendar volunteer assignment picker/create/cancel path, and the draft/private versus published/live Calendar visibility boundary are implemented and hosted-validated through 12.19.1. Secure account-light volunteer schedule access is implemented locally through 12.20 and awaits its required hosted staging gate. Initial assignment email delivery, Communications persistence, public lookup, remembered devices, Confirm/Deny schedule integration, and response-link admin reveal/copy activation remain unimplemented or intentionally paused.
- The approved visual direction is represented by the existing prototype work and `sample mockup images`; beta-critical surfaces must launch with that polished Project Local direction, not a utilitarian developer/admin interface.

## Bozeman Beta launch gate

The Bozeman beta may launch only when the narrow scheduling loop is production-safe end to end:

1. A real Bozeman workspace exists and authorized project contacts/helpers have correct capability-scoped access.
2. Jelani and trusted helpers can add or import permanent volunteer profiles.
3. Authorized schedulers can create and edit real Calendar scheduled items.
4. Scheduled items can be created from reusable task presets or first-class one-off custom definitions.
5. Volunteers can be assigned to scheduled items.
6. Draft/private versus published/live visibility is correct and does not depend on email success.
7. Assigned volunteers can securely access their own schedules without normal user accounts.
8. Volunteers can Confirm or Deny assignments.
9. Authorized project contacts can see accurate response state from assignment/current-response truth.
10. Basic initial assignment notification email can be sent reliably.
11. Beta-critical admin and volunteer surfaces use the approved Project Local UI direction.
12. Production Supabase, deployment, auth, email provider, domain/base URL, hosted validation, observability, backup/recovery, mobile/browser proof, and rollback/fallback planning are complete.

Belgrade Sheets/App Script remains the fallback if this gate is not safely met.

## Dependency-based critical path

1. `12.14 Bozeman Workspace Access and Provisioning Readiness`
   - Completed as the permanent operator provisioning boundary for workspaces, approved Auth identities, project contacts, and explicit grants. It does not create real Bozeman data automatically.
   - Unblocks: the first real Bozeman workspace, contact identities, grants, and all later beta admin access.
2. `12.15 Manual Volunteer Profile Add/Edit Permanent Path`
   - Completed as the permanent persisted `/admin/volunteers` manual Add/Edit path. It unblocks the first real Bozeman volunteer record and the future assignment picker source.
3. `12.15.1 Hosted Staging Migration + Volunteer Profile Management Validation Gate`
   - Completed against non-production `project-local-staging` (`kfuujcfxoayukywvtaeh`). Staging advanced from `20260705000000` to `20260714121500`, and the hosted gate passed migration/RPC/provenance, generated-type, RLS/capability, isolation, direct-table-denial, safe-error, and zero-residue checks.
4. `12.16 Calendar Create/Edit Scheduled Item Implementation`
   - Completed as the first narrow persisted Calendar item create/edit path: one-off timed items only, defaulting Follow-up Contact to the authenticated scheduler.
5. `12.16.1 Hosted Staging Calendar Item Management Validation Gate`
   - Completed against non-production `project-local-staging` (`kfuujcfxoayukywvtaeh`). Staging advanced from `20260714121500` to `20260714121600`, and the hosted gate passed generated-type parity, one-off timed create/edit, Follow-up Contact, zero-needed/read-model, RLS/capability, isolation, direct-table-denial, malformed/source-validation, existing-row compatibility, safe-output, and zero-residue checks.
6. `12.17 Calendar Task Preset Selector and One-Off Definition Path`
   - Completed locally and hosted-validated through 12.17.1: preset-derived and one-off scheduled item creation without requiring the full `/admin/tasks` cutover first.
7. `12.18 Volunteer Assignment Picker and Create/Cancel Commands`
   - Completed locally and hosted-validated through 12.18.1: `/admin/calendar` can assign ready persisted volunteers and cancel active assignments through reviewed persisted boundaries.
8. `12.18.1 Hosted Staging Assignment Management Validation Gate`
   - Completed: non-production staging is validated at `20260714121800` with generated type parity, picker projection, atomic create, cancellation, coverage truth, direct-write-denial, isolation, and zero-residue proof.
9. `12.19 Draft/Private Versus Published/Live Calendar Visibility`
   - Completed locally: new Calendar items are private drafts owned by the creating project contact, published items become visible to authorized same-workspace contacts, and publication remains separate from email/volunteer schedule access/response-link activation.
10. `12.19.1 Hosted Staging Calendar Publication Visibility Validation Gate`
   - Completed against non-production `project-local-staging` (`kfuujcfxoayukywvtaeh`). Staging advanced from `20260714121800` to `20260714121900` during the gate after a safe unapplied migration comment typo fix, and the final hosted validation passed generated-type parity, publication defaults, draft/published read privacy, publish authorization, assignment/token/public-response gating, direct-table-denial, isolation, safe-output, and zero-residue checks.
11. `12.20 Secure Account-Light Volunteer Schedule Access`
   - Completed locally: authorized schedulers can issue/revoke dedicated hash-only volunteer schedule access tokens, `/v/access/[token]` exchanges the bearer for a session-only HttpOnly cookie, and `/v/schedule` reads only that volunteer's published assignments. Hosted validation is required before relying on this boundary in staging or beta.
12. `12.20.1 Hosted Staging Volunteer Schedule Access Validation Gate`
   - Required next: validate migration `20260714122000`, generated public-schema types, token issuance/revocation/read RPCs, public route behavior, cookie/session handling, isolation, direct-table denial, and zero residue against non-production `project-local-staging` (`kfuujcfxoayukywvtaeh`).
13. `12.21 Volunteer Confirm/Deny Round Trip`
   - Unblocks: first real Confirm/Deny round trip and admin-visible response state.
14. `12.22 Initial Assignment Notification Email Boundary`
   - Unblocks: first real assignment notification email with duplicate-send prevention and observable failures.
15. `12.23 Bozeman Beta UI Polish, Hosted Validation, and Launch Gate`
    - Unblocks: beta launch candidate review.

## Repository-grounded beta blockers

- Real Bozeman workspace provisioning is now repeatable through the reviewed operator boundary, but real production execution remains an explicit operator step after approved Auth identities exist.
- Controlled volunteer import does not exist; manual persisted volunteer Add/Edit now exists through `/admin/volunteers`.
- `/admin/calendar` has a narrow one-off timed create/edit path, and its 12.16 migration/RPC/type changes have passed the required hosted staging validation gate.
- 12.17 is implemented and hosted-validated as the Calendar task-preset selector and one-off definition path: `/admin/calendar` now reads active persisted `task_presets` for the resolved workspace when the same contact has `tasks.view`, can create preset-backed timed scheduled items through the existing create RPC, keeps custom one-off timed creation, and can edit preset-backed timed occurrences through a new allowlisted RPC without changing their source. 12.17.1 completed hosted staging validation on non-production `project-local-staging` (`kfuujcfxoayukywvtaeh`) through migration `20260714121700`.
- Draft/private versus published/live visibility is implemented and hosted-validated through 12.19.1. Staging is validated at `20260714121900`; draft/private reads, published/live reads, publication authorization, assignment preparation privacy, response-token/public-response gating, generated-type parity, direct-write denial, and zero-residue cleanup passed on non-production `project-local-staging` (`kfuujcfxoayukywvtaeh`).
- 12.18 and 12.18.1 are complete. The first Calendar volunteer assignment picker/create/cancel path uses persisted volunteer profiles and assignment/current-response truth, and the `20260714121800` migration/RPC/generated-type boundary has passed hosted non-production validation before hosted beta use.
- Secure account-light volunteer schedule access is locally implemented in 12.20. `/v/demo` remains mock and separate; `/respond/[token]` remains single-assignment. The 12.20 migration/RPC/generated-type boundary must still pass 12.20.1 hosted staging validation before beta use.
- Confirm/Deny exists for a tokenized single assignment but is not integrated into a persisted volunteer schedule.
- Basic initial assignment email delivery has no provider boundary, recipient resolution, duplicate-send prevention, or delivery observability.
- Beta-critical UI polish is not yet integrated across create/edit Calendar, volunteer picker, Add/Edit Volunteer, volunteer schedule, response states, and safe empty/unavailable/error states.
- Production Supabase/deployment/auth/email/domain/observability/backup/hosted-validation gates are not complete.

## Non-blocking features deferred behind the beta gate

- Belgrade migration from Sheets.
- Full `/admin/tasks` route cutover if not needed for Calendar creation.
- Full public questionnaire workflow.
- Manual public volunteer lookup.
- Remembered-device behavior.
- Assignment-detail response-link admin reveal/copy activation.
- Full Communications authoring, automatic reminder cadence, announcement blasts, delivery analytics.
- Advanced availability/conflict engine.
- Drag/drop, resize, recurrence, copy/paste Calendar persistence.
- Food and Security as separate restored modules.
- Needs Attention persistence.
- Broad assignment directory/search.

## Decision on old 12.14

Old recommendation: `12.14 Route-Unused Persisted Tasks Read Model Helper / Query-Shape Review`.

Decision: move and modify it. A full `/admin/tasks` read helper remains useful, but it is not the highest-priority Bozeman beta unblocker. Calendar writes can safely proceed with a narrower reviewed task-preset selector/read seam, while the immediate critical path starts with Bozeman workspace access and permanent volunteer data entry.

Immediate next recommended slice: `12.14 Bozeman Workspace Access and Provisioning Readiness`.

Return to the Tasks helper as either:

- a scoped Calendar task-preset selector seam before or during Calendar create/edit work; or
- the full `/admin/tasks` helper after beta-critical scheduling is safe.

## Safest shortest path to first real-world moments

- First real Bozeman volunteer record: use the 12.14 operator boundary to provision Bozeman workspace/contact/grants after approved Auth identities exist, then create one volunteer through the persisted `/admin/volunteers` manual Add/Edit path.
- First real persisted scheduled item created from product UI: keep the current persisted `/admin/calendar` read route, add a reviewed `calendar.edit` server action for a narrow create/edit path, then refresh the persisted route.
- First real volunteer assignment: add a volunteer picker read seam and `assignments.edit` create command for one active volunteer/item pair with duplicate prevention.
- First published volunteer-visible assignment: define publication visibility truth before email; visibility must not depend on delivery success.
- First real Confirm/Deny round trip: connect secure account-light volunteer schedule or token route to current `assignment_responses` without reopening unrelated assignment-detail response-link copy UI.
- First real assignment notification email: send a basic initial assignment email with resolved recipient, secure schedule/action link, duplicate-send prevention, safe failure observability, and no broad Communications feature expansion.

## Validation gates before beta launch

- Static regressions for every new server boundary and route integration.
- Local disposable validation for volunteer, Calendar write, assignment, public response, and email boundaries where useful.
- Hosted validation for any migration, RPC, generated type, hosted script, or hosted behavior change.
- Desktop and 390px mobile browser validation for beta-critical admin and volunteer routes.
- No raw Supabase/status/start output in transcripts; diagnostics remain redirected/redacted.
- No mock/persisted truth mixing.
- No unsafe field leakage: credentials, tokens, bearer/verifier, raw grants/capabilities, SQL/RPC detail, provider dumps, stack traces, questionnaire/emergency contact details, unrelated rows.
- Production environment review for Supabase, deployment, auth, domain/base URL, email provider, secrets, logging, backups, and recovery.
- Pilot test with disposable or approved Bozeman data.
- Explicit rollback/fallback plan with Belgrade remaining on Sheets.

## Approved UI integration sequence

1. Preserve the current Calendar shell while adding polished create/edit inspector behavior.
2. Integrate the volunteer picker and manual Add/Edit Volunteer surfaces.
3. Integrate the volunteer schedule home, assignment detail, and response states.
4. Integrate the initial email review/send/status surfaces.
5. Normalize empty/loading/unavailable/error states across beta-critical routes.
6. Run a focused beta visual consolidation against the approved prototype direction and `sample mockup images`.

Do not schedule a giant full-app redesign after backend work. UI quality is part of beta readiness, but only beta-critical surfaces need launch polish before the initial Bozeman beta.

## Integrity constraints retained

Response-link activation remains paused after 11.50. Do not activate assignment-detail reveal/copy merely because token infrastructure exists. No service-role shortcut, seed data, production data access, real email sending, or mock/persisted fallback mixing was added by this re-baseline.

## 12.14 provisioning mechanism

12.14 establishes a narrow executable operator boundary rather than a product workspace-creation UI.

- Auth identity remains an operator step: create or invite the approved project-contact user through Supabase Auth administration first. The app's sign-in flow remains invite-only (`shouldCreateUser: false` for normal project-contact sign-in).
- `lib/workspaces/provisioning.server.ts` validates the permanent workspace/contact/grant input and builds a deterministic transaction against the existing `workspaces`, `project_contacts`, and `workspace_contact_grants` architecture.
- `scripts/provision-workspace-access.mjs` can emit the reviewed SQL from an operator-provided JSON file or execute it against local Supabase for validation. It does not read `SUPABASE_SERVICE_ROLE_KEY`.
- `npm run test:bozeman-workspace-provisioning` creates disposable local Auth users, provisions workspace/contact/grant fixtures through the reviewed boundary, verifies RLS-visible access and fail-closed behavior, and cleans up with zero residue.

The provisioning transaction is idempotent only when existing workspace/contact/grant rows match the requested input. It fails closed on conflicting duplicate workspace keys, missing approved Auth users, conflicting contact status, conflicting grants, malformed input, unknown capabilities, or missing `workspace.read`.

Current Bozeman beta capability sets use only existing capability names:

- Main scheduler: `workspace.read`, `questionnaires.review`, `volunteers.view`, `volunteers.edit`, `tasks.view`, `tasks.edit`, `calendar.view`, `calendar.edit`, `assignments.view`, `assignments.edit`.
- Volunteer data entry helper: `workspace.read`, `questionnaires.review`, `volunteers.view`, `volunteers.edit`.
- Scheduling read-only helper: `workspace.read`, `volunteers.view`, `tasks.view`, `calendar.view`, `assignments.view`.

Safe operator procedure for later real Bozeman provisioning:

1. Create or invite the approved project-contact Auth user in Supabase Auth administration.
2. Prepare a local, uncommitted JSON input file with the Bozeman workspace key/display name/lifecycle/timezone/date range/public-intake setting, the approved Auth user id, and the explicit capability set.
3. Run `node --conditions=react-server --no-warnings --experimental-strip-types scripts/provision-workspace-access.mjs --input <file.json> --emit-sql` and review the generated transaction.
4. Apply the reviewed transaction through the approved operator database channel for the target environment.
5. Validate with the normal app Auth sign-in path and the relevant access/regression checks.

No real Bozeman production rows, migrations, generated Supabase type changes, hosted validation, service-role path, seed data, email sending, Calendar writes, volunteer Add/Edit UI, assignment picker, public volunteer lookup, remembered-device behavior, Belgrade migration, or response-link activation was added in 12.14.

## 12.15 manual volunteer Add/Edit path

12.15 establishes the first permanent volunteer-management product path for the Bozeman beta.

- `/admin/volunteers` is now a dynamic/no-store persisted route. It derives the authenticated project contact, deterministic active workspace, and effective grants server-side, requires `volunteers.view` for reads, and requires `volunteers.edit` for manual create/update actions.
- The route no longer uses mock volunteer rows as its user-facing truth source. It renders persisted profiles, a true empty state, a calm unavailable state, and a safe error state without mock fallback or mock/persisted mixing.
- Manual volunteers are legitimate `volunteer_profiles` rows with `profile_source = 'manual'`, null `source_submission_id`, and protected server-derived manual provenance. The browser cannot forge workspace, contact, capability, lifecycle authority outside the allowed form choices, source, or questionnaire provenance.
- Questionnaire-derived profiles remain compatible: `profile_source = 'questionnaire'` preserves `source_submission_id`, and ordinary edits do not erase that provenance.
- Manual create/update goes through authenticated RPCs (`create_manual_volunteer_profile`, `update_volunteer_profile_manual_fields`) that re-check the caller's active project-contact grant and `volunteers.edit` capability. Direct authenticated table insert/update/delete privileges remain denied.
- `npm run test:volunteer-profile-management` performs disposable local validation for create, edit, read-back persistence, view-only behavior, missing-view failure, cross-contact/cross-workspace isolation, malformed/protected input, questionnaire compatibility, no service-role dependency, no secret output, and zero-residue cleanup.

12.15 adds a migration and generated type updates for manual provenance and the two narrow RPCs. 12.15.1 has now completed the required hosted staging validation before any hosted beta dependency relies on that behavior. No real Bozeman production volunteer records, controlled import UI, assignment picker, Calendar write, public volunteer lookup, email sending, remembered-device behavior, service-role usage, seed data, Belgrade migration, or response-link activation was added.

## 12.15.1 hosted staging volunteer profile gate

12.15.1 adds `npm run test:volunteer-profile-management:hosted` as the narrow hosted non-production validation gate for the 12.15 migration/RPC/provenance design.

The command is explicitly locked to the existing approved staging project, `project-local-staging` (`kfuujcfxoayukywvtaeh`), and refuses to run without:

```powershell
$env:RUN_HOSTED_VOLUNTEER_PROFILE_MANAGEMENT_VALIDATION='project-local-staging:kfuujcfxoayukywvtaeh'
```

12.15.1 resumed after the approved staging project was reactivated. Project discovery verified the exact staging ref/name and `ACTIVE_HEALTHY` status, staging was confirmed at `20260705000000` before applying the reviewed pending migration, then advanced cleanly to `20260714121500`. The hosted gate passed hosted generated type comparison, manual profile create/edit RPCs, questionnaire-derived provenance compatibility, `volunteers.view` and `volunteers.edit` enforcement, cross-contact and cross-workspace isolation, revoked/expired/inactive grant behavior, role/title non-authorization, direct table-write denial, malformed/protected input rejection, safe-error checks, and disposable hosted cleanup with exact-run plus namespace zero residue.

The resume required no schema redesign, no service-role application path, no product route change, and no real Bozeman or Belgrade data. The committed generated public-schema types were refreshed from the hosted schema, the volunteer RPC caller was aligned with the generated optional-argument typing, and the hosted gate's static service-role guard was narrowed so false capability/readiness flag names do not fail the test while real service-role usage remains forbidden.

## 12.16 Calendar create/edit scheduled item implementation

12.16 establishes the first permanent scheduled-item write path from the actual `/admin/calendar` product UI. The route remains server-owned, dynamic/no-store, and persisted-truth-only. A contact with the effective `calendar.edit` capability can create and edit a supported one-off timed Calendar item; a contact with only read coverage can still view the Calendar but cannot use working create/edit controls.

The supported 12.16 source path is deliberately narrow: persisted one-off/custom timed items only. The UI does not persist mock task presets, fake preset ids, all-day/date-based authoring, multi-day windows, milestones, recurrence, drag/drop, resize, copy, assignment picker actions, publication, delivery, or response links. 12.17 owns the polished persisted task-preset selector and broader one-off source path.

12.16 adds migration `20260714121600_calendar_item_management.sql`, adds `calendar_items.follow_up_project_contact_id`, relaxes timed/date-based `needed_count` to `0..99`, replaces `create_calendar_item` so new rows derive the Follow-up Contact from the authenticated scheduler, and adds the allowlisted `update_calendar_item_one_off_timed` RPC. Existing Calendar rows are preserved because the Follow-up Contact column is nullable until a reviewed backfill exists. Update preserves the existing Follow-up Contact and assignment truth.

Local validation now includes `npm run test:calendar-item-management`, which proves authorized create/edit persistence, Follow-up Contact, zero-needed timed items, malformed input failure, wrong-contact/wrong-workspace isolation, missing `calendar.edit` failure, direct table-write denial, safe read-model visibility, and zero residue. `npm run test:calendar` now also exercises a browser create -> reload -> edit -> reload round trip against disposable local persisted fixtures.

12.16.1 completed the required hosted non-production validation gate for the Calendar item-management boundary. The gate is locked to `project-local-staging` (`kfuujcfxoayukywvtaeh`) and requires `RUN_HOSTED_CALENDAR_ITEM_MANAGEMENT_VALIDATION=project-local-staging:kfuujcfxoayukywvtaeh`. It verified `ACTIVE_HEALTHY` staging, advanced from `20260714121500` to `20260714121600`, compared hosted generated public-schema types to committed types, validated one-off timed create/edit, Follow-up Contact integrity, needed-count `0` and `0/0 assigned` read-model behavior, protected-field preservation, capability/RLS isolation, grant lifecycle failure, role/title non-authorization, direct table-write denial, malformed schedule/source rejection, fake preset rejection, existing preset-backed source compatibility, legacy nullable Follow-up Contact compatibility, safe output, and exact-run plus namespace zero residue. No product/runtime code change, extra migration, service-role application path, real data, or Calendar feature expansion was added by the hosted gate.

## 12.17 Calendar task-preset selector and one-off definition path

12.17 locally adds the first persisted task-preset source path to `/admin/calendar` without cutting over `/admin/tasks`. The Calendar route remains server-owned, dynamic/no-store, persisted-truth-only, and workspace/contact scoped. Calendar reads still require `calendar.view` plus `assignments.view`; Calendar create/edit still requires `calendar.edit`; the task-preset selector requires the same deterministic workspace context plus `tasks.view`.

The selector uses a new server-only Calendar seam over `task_presets` with explicit columns and no mock fallback. It returns active same-workspace presets only, preserving bounded custom-field definitions and safe system identity while exposing no Calendar occurrence state, assignments, volunteer contact data, raw grants, or broad rows. If `tasks.view` is missing, preset selection is unavailable but custom one-off timed creation remains available for contacts with `calendar.edit`.

12.17 keeps the supported authoring scope narrow: timed scheduled items only. A scheduler may create from a real persisted task preset or from a first-class custom one-off definition. Preset-backed edits can change only occurrence timing, needed count, notes, and empty supported custom values; they preserve the task preset source, Follow-up Contact, workspace, lifecycle, and assignment truth. One-off edits keep the 12.16 title/type/timing/needed/notes path.

12.17 adds migration `20260714121700_calendar_source_selection.sql` with `update_calendar_item_preset_timed`, updates generated public-schema types, adds `npm run test:calendar-source-selection`, and extends the Calendar browser regression to exercise the real preset selector plus preset-backed create/reload/edit/reload.

12.17.1 completed the hosted staging validation gate on non-production `project-local-staging` (`kfuujcfxoayukywvtaeh`). The gate verified the project as `ACTIVE_HEALTHY`, confirmed migration level `20260714121700` before and after the successful run, compared hosted generated public-schema types to committed types, and validated selector authorization/projection/scoping, active-only lifecycle filtering, missing-`tasks.view` selector unavailability with custom one-off continuity, preset-backed create, source/snapshot semantics, preset-backed edit, source immutability/no conversion, capability and workspace/contact isolation, revoked/expired/inactive grant denial, role/title non-authorization, direct table-write denial for Calendar items and task presets, malformed/source rejection, read-model compatibility, existing one-off compatibility, existing preset-backed row compatibility, safe output, exact-run cleanup, namespace zero residue, and hosted disposable residue count `0`. The only implementation correction during the gate was to the hosted harness's disposable fixture values so they obey existing grant-role and task-preset system-key constraints; no product/runtime/schema behavior changed.

Recommended next slice after the successful hosted gate: `12.18 Volunteer Assignment Picker and Create/Cancel Commands`.

## 12.18 Volunteer assignment picker and create/cancel commands

12.18 locally adds the first permanent volunteer assignment management path to `/admin/calendar`. The Calendar route remains server-owned, dynamic/no-store, bounded by Day/Week/Month/List query ranges, persisted-truth-only, and workspace/contact scoped. Existing Calendar item reads, task-preset source selection, and one-off/preset timed create/edit remain intact.

The route now passes a safe `assignmentPicker` state to the Calendar client. The picker uses `lib/calendar/assignmentPicker.server.ts`, requires the resolved Calendar route context plus `volunteers.view` to show ready volunteer choices, and projects only safe volunteer display fields needed by the inspector: volunteer profile id, display name, and congregation. It does not expose volunteer email, phone, profile notes, questionnaire data, raw grants/capabilities, response tokens, URLs, or provider/database objects.

Assignment create/cancel uses server actions on `/admin/calendar` plus the existing assignment server boundary. Create uses the new authenticated RPC `create_calendar_assignments_batch`, which atomically assigns `1..25` same-workspace active ready volunteers to one active timed/date-based Calendar item, requires effective `assignments.edit`, prevents duplicates, creates `needs_response` current response rows, and rejects malformed, duplicate, wrong-workspace, inactive, on-hold, revoked/expired/inactive-grant, role/title-only, and under-capability contexts. Cancel reuses `cancel_calendar_assignment`, requires `assignments.edit`, and marks active assignments `canceled`.

The Calendar inspector now shows active persisted assignment names and response states (`needs_response`, confirmed, denied), a searchable ready-volunteer picker for contacts with assignment edit access, calm unavailable/error/read-only states, and a non-blocking over-assignment warning. Coverage remains derived from `calendar_assignments` plus current `assignment_responses`; no Calendar counters, mock volunteer arrays, response links, publication state, volunteer-visible schedules, email, delivery, or assignment-detail links were added.

12.18 adds migration `20260714121800_calendar_assignment_management.sql`, updates generated public-schema types for `create_calendar_assignments_batch`, adds `npm run test:calendar-assignment-management`, and updates the Calendar browser regression expectation through the existing product route. Because this slice changes migration/RPC/generated-type behavior, hosted non-production validation was required before 12.19 and completed in 12.18.1.

## 12.18.1 Hosted staging assignment management validation

12.18.1 validates the assignment-management boundary against non-production `project-local-staging` (`kfuujcfxoayukywvtaeh`) at migration `20260714121800`. The gate proves hosted generated-type parity, picker authorization/projection, workspace and lifecycle filtering, atomic batch create, duplicate/retry rejection, over-assignment behavior, response initialization, cancellation, coverage truth, capability/contact/workspace/grant isolation, role/title non-authorization, direct table-write denial, blank-note normalization, compatibility with existing Calendar/assignment behavior, no response-token/email/publication side effects, exact-run cleanup, namespace zero residue, and hosted disposable residue count `0`.

## 12.19 Draft/private versus published/live Calendar visibility

12.19 locally adds the first publication visibility boundary to persisted `/admin/calendar`. Newly created scheduled items now default to `publication_state = 'draft'`, record the authenticated creator as `created_by_project_contact_id`, and keep `published_at`/`published_by_project_contact_id` empty until an explicit publish action. Legacy pre-12.19 rows default to draft without guessed owner metadata, which intentionally fails closed until a later reviewed backfill/publication decision.

Drafts are private to the creating project contact. The Calendar read model projects only published items plus the caller's own drafts, and the client receives only safe publication state, publish eligibility, and published timestamp fields--not raw contact ids, grant ids, capability arrays, or database errors. Published items remain visible to authorized same-workspace contacts through the existing `calendar.view` plus `assignments.view` coverage-bearing read rule.

Publishing uses the new authenticated `publish_calendar_item` boundary. It requires the same deterministic workspace/contact context and effective `calendar.edit`, is one-way/idempotent for the owning draft creator, and records server-derived published metadata. It does not send email, expose a volunteer schedule, activate response links, create response tokens, or treat delivery success as visibility truth.

Assignment preparation remains admin-only. The creator may prepare/cancel draft assignments with `assignments.edit`; other contacts cannot see or mutate the draft. Response-token issuance, replacement, public response reads/submits, and reveal helpers fail closed for drafts and continue only after publication through their existing reviewed boundaries. Response-link reveal/copy UI remains paused.

Local validation uses `npm run test:calendar-publication-visibility`, which proves draft owner-only reads, publish, published cross-contact visibility, assignment/token gating, direct-write denial, grant lifecycle failure, role/title non-authorization, and zero-residue cleanup.

12.19.1 completed the hosted staging validation gate on non-production `project-local-staging` (`kfuujcfxoayukywvtaeh`). The gate required `RUN_HOSTED_CALENDAR_PUBLICATION_VISIBILITY_VALIDATION=project-local-staging:kfuujcfxoayukywvtaeh`, verified `ACTIVE_HEALTHY` project status, advanced staging from `20260714121800` to `20260714121900` during the first migration application after correcting an unapplied migration comment typo, and the final successful rerun observed `20260714121900` before and after validation. Hosted generated public-schema types now match committed types after a UTF-8-safe refresh.

The hosted gate validated publication defaults, unknown-owner legacy draft fail-closed behavior, server-derived creator and Follow-up Contact metadata, creator-only draft reads, published same-workspace cross-contact visibility, safe publication projection, publish authorization and idempotency, preservation of assignments/source/Follow-up Contact/provenance, draft edit and assignment privacy, assignment-detail privacy, draft response-token/reveal/public-response denial, existing published token/response compatibility, direct table-write denial, cross-contact/cross-workspace/grant lifecycle/role-title denial, malformed input rejection, no email/delivery/volunteer-schedule/public-lookup/remembered-device coupling, safe output, exact-run cleanup, namespace zero residue, and hosted disposable residue count `0`. No product/runtime code changed during the gate.

Recommended next slice after the successful hosted gate was `12.20 Secure Account-Light Volunteer Schedule Access`.

## 12.20 Secure account-light volunteer schedule access

12.20 locally implements the first permanent volunteer-facing schedule path without cutting over `/v/demo` and without reusing assignment-response tokens. The product path is intentionally narrow: an authorized project contact with effective `assignments.edit` can issue or revoke a dedicated volunteer schedule access credential for a same-workspace active ready volunteer profile; the volunteer opens `/v/access/[token]`; the route validates the bearer, sets a session-only HttpOnly `pl-volunteer-schedule` cookie scoped to `/v`, and lands on the clean `/v/schedule` page.

The credential model is separate from `assignment_response_tokens`. Migration `20260714122000_volunteer_schedule_access.sql` adds `volunteer_schedule_access_tokens` with SHA-256 verifier storage only, purpose/version constraints, default 30-day TTL, 1-hour minimum, 90-day maximum, revocation, and last-used tracking. Raw bearers are returned only once by `issue_volunteer_schedule_access`; the database stores only the verifier hash. Revocation through `revoke_volunteer_schedule_access` is idempotent and does not delete assignments, assignment responses, volunteer profiles, or token history.

`/v/schedule` is read-only. It validates the schedule cookie through `read_volunteer_schedule` using a public server-side RPC client and returns only the token volunteer's own published same-workspace assignments. Draft/private Calendar items, archived/canceled items, assignments for other volunteers, unrelated workspaces, inactive/on-hold volunteer profiles, expired/revoked/unknown bearers, and malformed tokens fail closed or render calm empty/unavailable states. Declined assignments remain visible to the volunteer as historical/current response state, but Confirm/Deny buttons are not active in 12.20.

The browser handoff keeps the bearer out of the clean schedule URL, HTML, localStorage, sessionStorage, and readable cookies. The access route uses a harmless linked handoff state to ensure Chromium/loopback cookie availability before replacing to `/v/schedule`; no bearer is placed in the query string. Cookie attributes are HttpOnly, SameSite=Lax, session-only, Secure on HTTPS, and loopback-compatible for local preview.

Follow-up Contact remains a known projection gap for the volunteer schedule page because the current project-contact schema does not yet contain reviewed volunteer-facing contact display/email/phone fields. The page shows calm copy that project-team contact details will be included in a later beta slice rather than exposing Auth metadata, raw contact rows, grants, capabilities, or private data.

Local validation now includes `npm run test:volunteer-schedule-access` and `npm run test:volunteer-schedule-access:browser`. The local disposable database proof validates hash-only issuance, TTL bounds, safe read filtering, published-only visibility, needs/confirmed/declined response projection, revocation, direct table denial, role/title non-authorization, grant/contact/workspace isolation, malformed/protected input failure, no assignment-response-token coupling, no email/public lookup/remembered-device behavior, no secret output, and zero residue. The browser proof validates the real preview routes, clean bearer exchange, HttpOnly session cookie, persisted schedule display, detail sheet, unavailable/empty states, Not-you cookie clearing, 390px mobile layout, no horizontal overflow, no unsafe leakage, and no `/v/demo` mock leakage.

Because 12.20 adds a migration, RPCs, and generated Supabase public-schema type changes, hosted non-production validation is required before 12.21. Recommended next slice: `12.20.1 Hosted Staging Volunteer Schedule Access Validation Gate` against `project-local-staging` (`kfuujcfxoayukywvtaeh`). Do not begin Confirm/Deny, email, remembered devices, public lookup, response-link reveal/copy activation, or real Bozeman data entry until that gate passes.
