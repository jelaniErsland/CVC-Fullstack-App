# Bozeman Scheduling Beta Roadmap Re-baseline

This document supersedes the previous mechanical post-12.13 next-step assumption for near-term work. It does not erase historical sequencing; it re-baselines the current repository against the new target: a small, production-safe Project Local beta for real Bozeman volunteer scheduling, ideally ready by mid-August 2026.

The governing principle is: **Cut features, not integrity.**

Belgrade remains on the existing Google Sheets/App Script workflow and is the operational fallback. Do not migrate active Belgrade operations as part of the Bozeman beta milestone.

## Concise current-state summary

- Workspace, project-contact grant, questionnaire submission, volunteer profile, task preset, Calendar item, Calendar assignment/current response, public response-token, response route, and assignment-detail foundations exist.
- `/admin/calendar` is already cut over to persisted Calendar item reads. It is server-owned, dynamic/no-store, bounded by server-derived Day/Week/Month/List ranges, workspace/contact/capability scoped, read-only, and free of mock/persisted item mixing.
- The Calendar read states remain ready with items, ready empty, unavailable, and error; the beta roadmap does not change those state semantics.
- `/admin/volunteers` is now cut over to persisted volunteer-profile truth for the narrow manual Add/Edit path. `/admin/tasks`, `/admin/announcements`, Needs Attention, and the public `/v/demo` volunteer portal remain mock/prototype surfaces.
- `lib/tasks/readModelContract.server.ts` defines the future persisted Tasks read-model contract, but `/admin/tasks` is not cut over.
- Calendar writes, assignment picker UI, publication lifecycle, persisted volunteer schedule access, initial assignment email delivery, Communications persistence, public lookup, remembered devices, and response-link admin reveal/copy activation remain unimplemented or intentionally paused.
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
   - Pending. The opt-in hosted gate exists and is locked to `project-local-staging` (`kfuujcfxoayukywvtaeh`), but that approved staging project currently reports `INACTIVE`, so hosted DB/RLS/RPC validation has not passed yet.
4. `12.16 Calendar Create/Edit Scheduled Item Implementation`
   - Unblocks: first real persisted scheduled item created from the product UI.
5. `12.17 Calendar Task Preset Selector and One-Off Definition Path`
   - Unblocks: preset-derived and one-off scheduled item creation without requiring the full `/admin/tasks` cutover first.
6. `12.18 Volunteer Assignment Picker and Create/Cancel Commands`
   - Unblocks: first real volunteer assignment.
7. `12.19 Draft/Private Versus Published/Live Calendar Visibility`
   - Unblocks: first published volunteer-visible assignment.
8. `12.20 Secure Account-Light Volunteer Schedule Access`
   - Unblocks: volunteers seeing only their own published assignments.
9. `12.21 Volunteer Confirm/Deny Round Trip`
   - Unblocks: first real Confirm/Deny round trip and admin-visible response state.
10. `12.22 Initial Assignment Notification Email Boundary`
   - Unblocks: first real assignment notification email with duplicate-send prevention and observable failures.
11. `12.23 Bozeman Beta UI Polish, Hosted Validation, and Launch Gate`
    - Unblocks: beta launch candidate review.

## Repository-grounded beta blockers

- Real Bozeman workspace provisioning is now repeatable through the reviewed operator boundary, but real production execution remains an explicit operator step after approved Auth identities exist.
- Controlled volunteer import does not exist; manual persisted volunteer Add/Edit now exists through `/admin/volunteers`.
- Calendar create/edit/archive/publication mutations are not connected to `/admin/calendar`.
- Draft/private versus published/live visibility truth is unresolved.
- Volunteer assignment picker and assignment create/cancel UI are missing.
- Secure account-light volunteer schedule access is missing; `/v/demo` is mock, while `/respond/[token]` is single-assignment.
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

12.15 adds a migration and generated type updates for manual provenance and the two narrow RPCs. Hosted validation is required before this migration is trusted by any hosted beta dependency. No real Bozeman production volunteer records, controlled import UI, assignment picker, Calendar write, public volunteer lookup, email sending, remembered-device behavior, service-role usage, seed data, Belgrade migration, or response-link activation was added.

## 12.15.1 hosted staging volunteer profile gate

12.15.1 adds `npm run test:volunteer-profile-management:hosted` as the narrow hosted non-production validation gate for the 12.15 migration/RPC/provenance design.

The command is explicitly locked to the existing approved staging project, `project-local-staging` (`kfuujcfxoayukywvtaeh`), and refuses to run without:

```powershell
$env:RUN_HOSTED_VOLUNTEER_PROFILE_MANAGEMENT_VALIDATION='project-local-staging:kfuujcfxoayukywvtaeh'
```

When staging is active and migrated through `20260714121500`, the gate validates hosted generated types, manual profile create/edit RPCs, questionnaire-derived provenance compatibility, `volunteers.view` and `volunteers.edit` enforcement, cross-contact and cross-workspace isolation, revoked/expired/inactive grant behavior, role/title non-authorization, direct table-write denial, malformed/protected input rejection, and disposable hosted cleanup with zero residue.

This gate has not passed yet: project discovery confirmed the expected staging ref/name, but the approved staging project currently reports `INACTIVE`, and hosted database login-role creation times out before migration/RPC validation can run. Do not begin 12.16 against hosted assumptions until staging is active and this gate passes cleanly.
