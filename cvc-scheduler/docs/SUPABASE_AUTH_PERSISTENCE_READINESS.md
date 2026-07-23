# Supabase, Auth, and Persistence Readiness

This document is the implementation-readiness bridge between the stable Project Local mock prototype and a future real-data phase. It records proposed boundaries, sequencing, and decisions that must be resolved before code is connected to Supabase.

Iteration 11.21 adds the credential-free audit persistence boundary required by the 11.20 reveal policy. It is not product UI, credential reveal, deletion, background cleanup, or delivery and adds no lookup, email, remembered-device behavior, Calendar/Volunteers/Communications/Needs Attention cutover, seed data, or broad schedule access.

## Bozeman beta re-baseline after 12.13

The near-term production-readiness target is now a narrow Bozeman scheduling beta, ideally ready by mid-August 2026. Belgrade remains on the existing Google Sheets/App Script workflow and is the operational fallback. The principle for the beta is **Cut features, not integrity**.

`lib/readiness/bozemanBetaRoadmap.server.ts` and `docs/BOZEMAN_BETA_ROADMAP.md` record the repository-grounded dependency map. This re-baseline does not change Supabase schema, RLS, RPCs, generated types, hosted behavior, route behavior, email behavior, response-link activation, service-role usage, production data access, or mock/persisted truth boundaries.

The beta launch gate requires permanent workspace/contact/grant foundations for Bozeman, volunteer profile entry/import on the existing `volunteer_profiles` architecture, Calendar create/edit/write boundaries on top of the stabilized persisted Calendar read route, assignment commands and picker UI, publication visibility truth, secure account-light volunteer schedule access, Confirm/Deny persistence and admin response visibility, a minimal initial assignment email boundary, approved Project Local UI integration on beta-critical surfaces, and production environment/hosted validation/observability/backup/rollback proof.

## 12.16 Calendar item management

12.16 adds the first narrow Calendar write boundary on top of the stabilized persisted `/admin/calendar` read route. Mutations remain server-owned and capability-checked. Reads still require `calendar.view` plus `assignments.view` for coverage-bearing output; create/edit requires effective `calendar.edit` for the deterministic authenticated project-contact workspace context. Role/title strings do not authorize, and the browser cannot provide trusted workspace id, actor id, capability arrays, timezone, Follow-up Contact, source provenance, arbitrary columns, or RPC names.

The only supported product write path in 12.16 is persisted one-off timed scheduled items. The UI does not persist mock task presets, all-day/date-based authoring, multi-day windows, milestones, recurrence, drag/drop, resize, copy, archive/delete, publication, assignment picker/mutations, delivery, public lookup, remembered-device behavior, or response-link actions.

Migration `20260714121600_calendar_item_management.sql` adds nullable `calendar_items.follow_up_project_contact_id`, allows timed/date-based `needed_count` values from `0` to `99`, replaces `create_calendar_item` to derive Follow-up Contact from the authenticated scheduler, and adds `update_calendar_item_one_off_timed` for an allowlisted edit field set. Existing rows are preserved; edits preserve Follow-up Contact and assignment truth.

Application/product code still uses no service-role path and grants no direct broad table insert/update/delete to authenticated users. Local disposable validation (`npm run test:calendar-item-management`) and browser preview validation (`npm run test:calendar`) passed locally.

`npm run test:calendar-item-management:hosted` is the 12.16.1 hosted non-production gate for the same Calendar item-management migration/RPC behavior. It is locked to `project-local-staging` (`kfuujcfxoayukywvtaeh`) by the opt-in `RUN_HOSTED_CALENDAR_ITEM_MANAGEMENT_VALIDATION=project-local-staging:kfuujcfxoayukywvtaeh`. The gate passed after staging advanced from `20260714121500` to `20260714121600`: hosted generated public-schema types match the committed generated types, and hosted disposable validation proves one-off timed create/edit, server-derived Follow-up Contact, needed-count `0` with `0/0 assigned` read-model output, protected-field preservation, view-only and missing-`calendar.edit` denial, cross-contact/cross-workspace isolation, revoked/expired/inactive grants, role/title non-authorization, direct table-write denial, malformed schedule/source rejection, fake preset rejection, existing preset-backed source compatibility, legacy nullable Follow-up Contact compatibility, safe output, and exact-run plus namespace zero-residue cleanup. The gate narrowed a static false-positive around service-role readiness flag names without adding application service-role behavior.

## 12.17 Calendar source selection

12.17 locally adds the Calendar task-preset selector and preset-backed timed edit boundary. The selector reads `task_presets` only from a server boundary, only for the deterministic active Calendar workspace, and only when the authenticated project contact's own effective grants include `tasks.view`. It uses explicit columns and returns safe active preset options; it does not query Calendar assignments, volunteer profiles, questionnaire answers, raw grants, response tokens, or mock data.

Calendar mutations still require effective `calendar.edit`. Preset-backed creation uses the existing `create_calendar_item` RPC with a real same-workspace active `task_preset_id`; custom one-off creation remains supported. The new `update_calendar_item_preset_timed` RPC edits only occurrence timing, needed count, notes, and custom values for active preset-backed timed items. It preserves workspace, preset source, Follow-up Contact, lifecycle, protected provenance, and assignment truth, and rejects cross-contact/cross-workspace/missing-capability/role-only attempts.

This slice adds migration `20260714121700_calendar_source_selection.sql`, generated type updates, and `npm run test:calendar-source-selection`. 12.17.1 completed hosted non-production validation against `project-local-staging` (`kfuujcfxoayukywvtaeh`): the project was `ACTIVE_HEALTHY`, staging was verified at migration `20260714121700` before and after the successful run, hosted generated public-schema types matched committed types, and hosted disposable Auth/RLS/RPC validation proved selector authorization/projection/scoping, missing-`tasks.view` fail-closed behavior, preset-backed create/edit, source immutability, one-off continuity, capability and workspace/contact isolation, revoked/expired/inactive grant denial, role/title non-authorization, direct table-write denial, malformed input rejection, read-model compatibility, safe output, exact-run cleanup, namespace zero residue, and hosted disposable residue count `0`.

## 12.18 Calendar assignment management

12.18 locally adds the first assignment-management route integration on `/admin/calendar`. The route still resolves Auth user, project contact, deterministic workspace, and effective capabilities server-side. Calendar item reads still require `calendar.view` plus `assignments.view`; volunteer picker choices require `volunteers.view`; assignment create/cancel requires `assignments.edit`. Role/title strings do not authorize, browser-provided workspace/contact/capability values remain untrusted, and contacts cannot borrow capabilities across contacts or workspaces.

The picker projects only safe volunteer display fields and current assignment response status. It does not expose raw grant/capability arrays, volunteer email/phone/profile notes, questionnaire data, response tokens, response URLs, SQL/RPC details, provider dumps, or unrelated rows. Create goes through `create_calendar_assignments_batch`, which atomically creates active assignment rows and `needs_response` current responses for same-workspace active ready volunteers. Cancel continues through `cancel_calendar_assignment`.

Application/product code still uses no service-role path and grants no direct broad table insert/update/delete to authenticated users. Local disposable validation (`npm run test:calendar-assignment-management`) passed locally and proves capability enforcement, wrong-contact/wrong-workspace isolation, revoked/expired/inactive grant denial, role/title non-authorization, direct table-write denial, no response-token creation, and zero-residue cleanup.

12.18.1 completed hosted non-production validation for migration `20260714121800_calendar_assignment_management.sql`, RPC `create_calendar_assignments_batch`, cancellation compatibility, and generated type parity against `project-local-staging` (`kfuujcfxoayukywvtaeh`). The target was `ACTIVE_HEALTHY` and validated at migration `20260714121800`; hosted disposable proof covered picker authorization/projection, atomic assignment create, duplicate/retry and malformed-input denial, over-assignment, response initialization, cancellation, assignment/current-response coverage truth, capability/contact/workspace/grant lifecycle isolation, role/title non-authorization, direct table-write denial, blank-note normalization, no response-token/email/publication side effects, safe output, exact-run cleanup, namespace zero residue, and hosted disposable residue count `0`. One generated type entry was narrowed to match hosted generation; no product/runtime code changed during the hosted gate.

## 12.15 manual volunteer profile management

Local migration `20260714121500_manual_volunteer_profiles.sql` extends `volunteer_profiles` with explicit provenance for legitimate manual records while preserving questionnaire-derived provenance. `source_submission_id` is nullable only for `profile_source = 'manual'`; questionnaire profiles keep their same-workspace source submission. Manual rows record the server-derived project contact and timestamp that created them. No fake questionnaire submission is manufactured.

Authenticated project contacts still receive no direct table insert/update/delete privileges. Manual creation and editing go through `create_manual_volunteer_profile` and `update_volunteer_profile_manual_fields`, both security-definer RPCs that verify `auth.uid()`, active project-contact status, active workspace lifecycle, effective grant validity/revocation, and `volunteers.edit` for the relevant workspace. Reads continue to require `volunteers.view` through RLS.

`/admin/volunteers` is now the approved persisted volunteer-management route. It is dynamic/no-store, resolves the active project-contact workspace server-side, fails closed when no deterministic `volunteers.view` workspace is available, and exposes edit controls only when the same trusted context has `volunteers.edit`. It does not use mock volunteer rows as fallback and does not link persisted profiles into the old mock detail route.

`npm run test:volunteer-profile-management` applies the migration to local Supabase if needed, creates disposable Auth/workspace/grant fixtures, validates persisted create/edit/read-back behavior, view-only behavior, missing-view failure, wrong-contact/wrong-workspace isolation, malformed/protected input rejection, questionnaire compatibility, no service-role dependency, no secret output, and zero-residue cleanup. Because this slice adds migration/RPC/generated-type changes, hosted validation is required before applying it to any hosted target.

`npm run test:volunteer-profile-management:hosted` is the 12.15.1 hosted non-production gate for the same migration/RPC/provenance behavior. It is locked to `project-local-staging` (`kfuujcfxoayukywvtaeh`) by the opt-in `RUN_HOSTED_VOLUNTEER_PROFILE_MANAGEMENT_VALIDATION=project-local-staging:kfuujcfxoayukywvtaeh`. The gate now passes after the approved staging project was reactivated and verified as `ACTIVE_HEALTHY`: staging advanced from `20260705000000` to `20260714121500`, hosted generated public-schema types match the committed generated types, and hosted disposable validation proves manual create/edit, questionnaire provenance compatibility, `volunteers.view`/`volunteers.edit`, cross-contact/cross-workspace isolation, revoked/expired/inactive grants, role/title non-authorization, direct table-write denial, malformed/protected input, safe errors, and exact-run plus namespace zero-residue cleanup. The resume refreshed committed generated types from hosted output, aligned optional volunteer RPC args with generated typing, and narrowed a static service-role guard without adding application service-role behavior.

The old `12.14 Route-Unused Persisted Tasks Read Model Helper / Query-Shape Review` recommendation is moved/modified. A full Tasks helper remains useful, but the immediate persistence/auth readiness blocker is `12.14 Bozeman Workspace Access and Provisioning Readiness`. A narrower task-preset selector seam can be reviewed when Calendar create/edit needs it. Response-link activation remains paused after 11.50.

Hosted validation for the 12.15 volunteer profile migration/RPC change is complete on the approved non-production staging target. No hosted production data or real Bozeman/Belgrade rows were used.

## 12.14 Bozeman workspace access and provisioning readiness

Iteration 12.14 establishes the smallest permanent provisioning path for the Bozeman beta access foundation without creating a product workspace-administration UI. Approved project-contact Auth identity creation remains an explicit operator step through Supabase Auth administration. Unknown public users still cannot create project-contact accounts through the normal admin sign-in flow because `AdminContactSignIn` uses `shouldCreateUser: false`.

`lib/workspaces/provisioning.server.ts` validates operator-provided workspace/contact/grant input and builds a deterministic transaction against the existing `workspaces`, `project_contacts`, and `workspace_contact_grants` tables. It uses the existing workspace key/display name/lifecycle/timezone/date-range/public-intake fields, requires an existing Auth user id before associating a project contact, and creates explicit workspace-scoped grants only with existing capability names. Role/title strings do not grant authority, and `workspace.read` remains required.

The provisioning boundary is idempotent only when existing rows match the requested input. It fails closed on conflicting duplicate workspace keys, missing approved Auth users, conflicting contact status, conflicting grants, malformed input, unknown capabilities, invalid dates/timezones, missing `workspace.read`, or revoked-grant creation. It does not use `SUPABASE_SERVICE_ROLE_KEY`, create a service-role client, send email, seed data, insert real Bozeman rows, or expose a browser-accessible creation path.

`scripts/provision-workspace-access.mjs` is the operator command. It can emit reviewed SQL from an uncommitted JSON input file or execute against local Supabase for validation. `npm run test:bozeman-workspace-provisioning` uses disposable local Auth users and local database fixtures to prove intended access, explicit grant behavior, under-capability failure, wrong-contact isolation, wrong-workspace isolation, revoked grant failure, role/title non-authorization, duplicate/idempotency and conflict behavior, no service-role dependency, no secret output, and zero-residue cleanup.

Hosted validation is not required because 12.14 adds no migration, RPC, generated type change, hosted script, hosted behavior change, or product route behavior change. The actual future Bozeman production execution remains an explicit operator procedure after approved Auth identities exist.

## 12.13 Persisted Tasks read-model contract

Iteration 12.13 is a route-unused persisted Tasks read-model contract for a future `/admin/tasks` cutover. It does not cut over `/admin/tasks`, import the contract into any app route/component, add a Tasks route loader, add client-side Supabase Tasks reads, add a query helper, add Tasks create/edit/archive UI behavior, add Calendar writes, activate response links, add delivery/public lookup/remembered devices, use service-role credentials, add seed data, add migrations, change generated Supabase types, run hosted validation, or mix mock and persisted task presets.

The contract defines `tasks.view` as the required read capability. A future route must derive the authenticated project contact id, deterministic active workspace context, and capability scope server-side, following the 12.12 contact-scoped grant-selection principles. Role/title strings alone do not authorize reads, and browser-provided workspace ids, contact ids, capability arrays, role names, selectors, table names, or query fragments remain untrusted.

The safe read projection is limited to current `task_presets` reusable-definition data: preset id, workspace scope, name, description/instructions where present, high-level General/Food/Security/Custom type, default needed count, volunteer visibility, lifecycle, bounded custom-field definitions, safe system/trusted identity, and timestamps only if the Tasks UI genuinely needs them. Future product concepts such as default duration, area/location, congregation preference, skill text, age/driver/equipment/safety notes, richer default publication behavior, and default Follow-up Contact are documented as schema gaps rather than fabricated fields.

Tasks presets remain separate from Calendar occurrences. The Tasks read model must not project scheduled date/time/range, Calendar placement, Calendar item ids as preset state, assignment rows, assignment responses, assigned/confirmed/denied counts, coverage state, occurrence-specific notes, occurrence-specific Follow-up Contact, recurrence instances, times scheduled, upcoming occurrence counts, volunteer contact data, questionnaire answers, response-token/reveal rows, raw grants/capabilities, SQL/RPC detail, provider dumps, stack traces, service-role material, or unrelated workspace rows.

The future route states are ready with presets, ready empty, unavailable, and error. Empty is a successful zero-preset read, unavailable is a calm fail-closed prerequisite/capability/workspace state, and error is an unexpected safe failure without raw provider details. Mock fallback and mock/persisted mixing are prohibited after a future cutover.

Hosted validation is not required because no database, RPC, generated type, hosted script, hosted behavior, or route behavior changed. Recommended next slice: `12.14 Route-Unused Persisted Tasks Read Model Helper / Query-Shape Review`; 12.13 alone does not authorize the `/admin/tasks` route cutover.

## 12.12 Calendar persisted read cutover stabilization

Iteration 12.12 stabilizes the first `/admin/calendar` persisted-read route cutover. It remains read-only and does not add Calendar writes, assignment picker/create/cancel UI, assignment-detail entry links, response-link activation, copy UI, email/reminder delivery, public lookup, remembered-device behavior, seed data, service-role usage, migrations, generated type changes, hosted validation, production data validation, broader route cutovers, or mock/persisted mixing.

The persisted Calendar route now treats Day/Week/Month/List navigation as server-backed navigation through validated `view` and `date` query parameters. Each navigation derives a fresh explicit bounded range from trusted server context before reading persisted rows, so the route does not silently show `ready_empty` for an unqueried period. `ready_empty` remains a successful authorized zero-row read for the actual selected range.

Workspace/grant selection is deterministic and contact-scoped. The route resolves the authenticated project contact, filters grants to that contact, ignores revoked/expired/inactive grants, unions same-contact capabilities only within the same active workspace, and requires exactly one eligible workspace containing both `calendar.view` and `assignments.view`. Same-workspace contacts cannot borrow each other's capabilities, cross-workspace grants do not combine into one authorization, and multiple eligible workspaces fail closed instead of selecting an arbitrary workspace.

The strict capability rule remains unchanged: `calendar.view` is required for item shells, and `calendar.view` plus `assignments.view` are required for the current coverage-bearing output. Missing `assignments.view` does not produce misleading zero coverage. Raw workspace ids, grant ids, capability arrays, provider errors, and database details remain out of the client presentation boundary.

Hosted validation is not required because no migration, generated type, RPC, hosted script, hosted behavior, or production-data behavior changed. Local disposable and browser proof cover the stabilized route behavior. Recommended next slice: if 12.12 remains clean, `12.13 Persisted Tasks Read Model Contract`; otherwise perform a narrow Calendar read-cutover stabilization follow-up.

## 12.11 Calendar persisted read route cutover implementation

Iteration 12.11 is the first actual `/admin/calendar` persisted-read route cutover. It is read-only and does not add Calendar writes, assignment picker/create/cancel UI, assignment-detail entry links, response-link activation, copy UI, email/reminder delivery, public lookup, remembered-device behavior, seed data, service-role usage, migrations, generated type changes, hosted validation, production data validation, or mock/persisted mixing.

The route is dynamic/no-store and server-owned. It derives the verified project-contact Auth session, authenticated project contact id, active workspace/contact grant context, trusted workspace timezone, and explicit reviewed capabilities server-side. The strict rule remains unchanged: `calendar.view` is required for Calendar item shells, and `calendar.view` plus `assignments.view` are required for coverage-bearing output. Role/title strings alone do not authorize reads, missing prerequisites fail closed, and raw grant/capability arrays are not rendered.

`/admin/calendar` now uses the 12.6 dependency-injected query helper through a narrow route read adapter and maps only safe persisted read-model fields into the existing Calendar UI. It does not call `.from` or `.rpc` directly in the route, does not use service-role credentials, does not create a client-side Supabase reader, and does not expose raw Supabase/database/provider errors.

The four route states are implemented: `ready_with_items`, `ready_empty`, `unavailable`, and `error`. Empty is successful zero-item data, not failure. Unavailable is a fail-closed prerequisite/capability/workspace state. Error is an unexpected safe failure after prerequisites. None of the states falls back to mock Calendar items or mixes mock and persisted item truth.

Hosted validation is not required because no migration, generated type, RPC, hosted script, hosted behavior, or production-data behavior changed. Local disposable validation and browser proof cover the cut-over route. Recommended next slice: `12.12 Calendar Persisted Read Cutover Stabilization`, still read-only and still blocking Calendar writes, delivery, public lookup, remembered devices, and response-link activation.

## 12.10 Calendar route cutover empty/unavailable state prototype

Iteration 12.10 is Calendar route cutover UI-state prototype/readiness only. It does not cut over `/admin/calendar`, change Calendar production data behavior, import the query helper, dry-run harness, final preflight, readiness policy, or state prototype into the route, add a product route loader, add React hooks/client helpers, add hosted validation, add production data validation, add Calendar create/edit/delete UI, add assignment picker/create/cancel UI, add assignment-detail entry links, activate response-link generation, add email/reminder delivery, add public volunteer lookup, add remembered-device behavior, add seed data, add service-role usage, or mix mock and persisted data.

`lib/calendar/routeCutoverStatePrototype.server.ts` is server-only and route-unused. It defines a typed future route state model for `ready_with_items`, `ready_empty`, `unavailable`, and `error`, with safe user-facing presentation copy for each state. Ready empty is a successful authorized zero-item state, not an unavailable/error state. Unavailable is a distinct fail-closed prerequisite/access/workspace/capability state. Error is a distinct unexpected persisted-read failure after prerequisites.

The future state presentation boundary preserves the Calendar shell, Day/Week/Month/List structure, date navigation, view controls, filters, and preview-only creation behavior where safe. No state may silently fall back to mock data, mix mock and persisted data, render raw internal diagnostics, expose raw Auth/grant/workspace/capability/Supabase/SQL/RPC/policy details, reveal stack traces/provider dumps, expose tokens/response URLs, or disclose volunteer contact values, questionnaire answers, emergency contact values, or unrelated rows.

The strict capability rule remains unchanged. `calendar.view` is required for Calendar item shells, and `calendar.view` plus `assignments.view` are required for coverage-bearing output. Assignment-derived counts remain based on `calendar_assignments` and current `assignment_responses`, not Calendar item counters, mock `filledCount`, assigned volunteer id arrays, or client-side mock counters.

Hosted validation is not required because no migration, generated type, RPC, hosted script, hosted behavior, product route query, or route cutover changed. If 12.10 remains clean, the recommended next slice is `12.11 Calendar Persisted Read Route Cutover Implementation`; otherwise revise 12.10 first.

## 12.9 Calendar route cutover final preflight

Iteration 12.9 is Calendar route cutover final preflight only. It does not cut over `/admin/calendar`, change Calendar UI behavior, import the query helper, dry-run harness, readiness policy, or final preflight module into the route, add a product route loader, add React hooks/client helpers, add hosted validation, add production data validation, add Calendar create/edit/delete UI, add assignment picker/create/cancel UI, add assignment-detail entry links, activate response-link generation, add email/reminder delivery, add public volunteer lookup, add remembered-device behavior, add seed data, add service-role usage, or mix mock and persisted data.

`lib/calendar/routeCutoverFinalPreflight.server.ts` is server-only and route-unused. It defines the final go/no-go conditions for a later reviewed `/admin/calendar` persisted read implementation slice: candidate read-only scope, required dynamic/no-store server route chain, local/dry-run/readiness/query-helper/browser/assignment-detail guardrail prerequisites, future empty/unavailable/error states, UI preservation requirements, safe mapping allowlist, unsafe field denylist, single-truth-source mock-to-real boundary, and rollback requirements.

The strict capability rule remains unchanged. `calendar.view` is required for Calendar item shells, and `calendar.view` plus `assignments.view` are required for coverage-bearing output. Missing Auth/workspace/contact/grant, missing `calendar.view`, and missing `assignments.view` must fail closed before revealing item existence or producing misleading zero coverage. Role/title strings alone still do not authorize reads, and raw grant/capability arrays must not be rendered.

Hosted validation is not required because no migration, generated type, RPC, hosted script, hosted behavior, product route query, or route cutover changed. If 12.9 remains clean, the recommended next slice is `12.10 Calendar Route Cutover Empty/Unavailable State Prototype`; otherwise revise 12.9 first.

## 12.8 Calendar route cutover dry-run harness

Iteration 12.8 is a Calendar route cutover dry-run harness only. It does not cut over `/admin/calendar`, change Calendar UI behavior, import the query helper or dry-run harness into the route, add a product route loader, add React hooks/client helpers, add hosted validation, add Calendar create/edit/delete UI, add assignment picker/create/cancel UI, add assignment-detail entry links, activate response-link generation, add email/reminder delivery, add public volunteer lookup, add remembered-device behavior, add seed data, add service-role usage, or mix mock and persisted data.

`lib/calendar/routeCutoverDryRun.server.ts` is server-only and route-unused. It simulates the future server-side `/admin/calendar` persisted read data path with dependency-injected inputs, trusted workspace/contact/grant context, trusted workspace timezone, explicit reviewed capabilities, server-derived bounded Day/Week/Month/List ranges, the 12.6 dependency-injected query helper, and the 12.3 safe projection. It returns only safe dry-run states, projected items, and summary counts.

The dry-run fails closed before query for missing Auth/session, missing workspace/contact/grant context, missing `calendar.view`, missing `assignments.view`, invalid period/range, invalid timezone, and workspace-unavailable states. Missing assignment visibility still does not silently produce misleading zero coverage, and role/title strings alone do not authorize reads. Raw grant/capability arrays are not returned.

The dry-run does not create a Supabase client, import `lib/supabase/server.ts`, read cookies or route params, import from `app/`, render JSX, call product routes, call `.from` directly, call `.rpc`, use service-role credentials, read hosted/production data, expose raw database rows, or expose raw provider errors. The existing disposable local validation now also exercises the dry-run against local fixtures and keeps zero-residue cleanup.

Hosted validation is not required because no migration, generated type, RPC, hosted script, hosted behavior, product route query, or route cutover changed. If 12.8 remains clean, the recommended next slice is `12.9 Calendar Route Cutover Final Preflight`; otherwise revise 12.8 first.

## 12.7 Calendar route cutover readiness review

Iteration 12.7 is Calendar route cutover readiness review only. It does not cut over `/admin/calendar`, change Calendar UI behavior, import the query helper into the route, add a product route loader, add React hooks/client helpers, add hosted validation, add Calendar create/edit/delete UI, add assignment picker/create/cancel UI, add assignment-detail entry links, activate response-link generation, add email/reminder delivery, add public volunteer lookup, add remembered-device behavior, add seed data, add service-role usage, or mix mock and persisted data.

`lib/calendar/routeCutoverReadiness.server.ts` is server-only and route-unused. It defines the future cutover conditions for `/admin/calendar`: dynamic/no-store persisted rendering, server-boundary-only reads, reviewed authenticated workspace/contact/grant/capability/timezone derivation, explicit bounded Day/Week/Month/List ranges, and use of the 12.6 dependency-injected query helper plus 12.3 pure projection or later reviewed successors.

The strict capability rule remains unchanged. `calendar.view` is required for Calendar item shells, and `calendar.view` plus `assignments.view` are required for coverage-bearing read models. Missing Auth, missing workspace/contact/grant, missing `calendar.view`, and missing `assignments.view` must fail closed without revealing Calendar item existence or silently producing misleading zero assignment coverage. Role/title strings alone still do not authorize reads, and raw grants/capability arrays must not be rendered.

The readiness review also defines calm unavailable/empty/error states, single-truth-source mock-to-real rules, browser/preview proof requirements, and rollback boundaries for a later actual cutover. It keeps Calendar writes, draft persistence, drag/drop/resize/copy/repeat persistence, assignment picker/create/cancel, assignment responses from Calendar UI, assignment-detail entry links, response-link generation/copy, delivery, public lookup, remembered devices, seed data, hosted cutover validation, and service-role reads blocked.

Hosted validation is not required because no migration, generated type, RPC, hosted script, hosted behavior, product route query, or route cutover changed. If 12.7 remains clean, the recommended next slice is `12.8 Calendar Route Cutover Dry-Run Harness`; otherwise revise 12.7 first.

## 12.6 route-unused Calendar read model query-helper readiness

Iteration 12.6 is route-unused Calendar read model query-helper readiness only. It does not cut over `/admin/calendar`, change Calendar UI behavior, import persisted Calendar helpers into routes, add a product route loader, add React hooks/client helpers, add hosted validation, add Calendar create/edit/delete UI, add assignment picker/create/cancel UI, add assignment-detail entry links, activate response-link generation, add email/reminder delivery, add public volunteer lookup, add remembered-device behavior, add seed data, add service-role usage, or mix mock and persisted data.

`lib/calendar/readModelQuery.server.ts` is server-only and dependency-injected. It accepts a reviewed Supabase-like client from a future server boundary, but it does not create a Supabase client, import `lib/supabase/server.ts`, read cookies or route params, import from `app/`, query grants for raw capabilities, or use service-role credentials. Capability resolution remains outside the helper; the helper consumes explicit reviewed capability values and fails closed before reads when `calendar.view` or `assignments.view` is missing for coverage-bearing output.

The helper uses the existing 12.3 pure helper for input normalization, date/range validation, capability validation, filter normalization, coverage summarization, and safe projection. Its live query surface is narrow and route-unused: it may read only `calendar_items`, `task_presets`, `calendar_assignments`, and `assignment_responses`; every selector is explicit; no `select("*")` is used; and token/reveal/audit/questionnaire/emergency/contact/grant/auth/storage/diagnostic tables remain outside the seam.

The query result is safe and generic. It projects only the allowed Calendar read-model fields and never returns raw database rows, raw Supabase error objects, volunteer contact values, emergency contact details, questionnaire answers, response URLs, bearer/verifier/token/audit ids, access/refresh tokens, passwords, API keys, service-role keys, SQL/RPC detail, raw grants/capabilities, provider dumps, stack traces, raw exception messages, or unrelated rows.

The 12.5 local validation command now also exercises the query helper against disposable local `qa-12-5-*` fixtures. It remains loopback-only, service-role-free, redirected/redacted for Supabase diagnostics, and zero-residue. Hosted validation is not required because no migration, generated type, RPC, hosted script, hosted behavior, or route cutover changed. If 12.6 remains clean, the recommended next slice is `12.7 Calendar Route Cutover Readiness Review`; otherwise revise 12.6 first.

## 12.5 route-unused Calendar read model disposable local data validation

Iteration 12.5 is route-unused disposable local validation only. It does not cut over `/admin/calendar`, change Calendar UI behavior, import persisted Calendar helpers into routes, add a product route loader, add live product query integration, add hosted validation, add Calendar create/edit/delete UI, add assignment picker/create/cancel UI, add assignment-detail entry links, activate response-link generation, add email/reminder delivery, add public volunteer lookup, add remembered-device behavior, add seed data, add service-role usage, or mix mock and persisted data.

`scripts/calendar-read-model-local-data-validation.mjs` and `npm run test:calendar-read-model:local` create local-only `qa-12-5-*` Auth/product fixtures. The harness refuses non-loopback Supabase URLs, requires the local public anon configuration, does not read a service-role key, does not print raw Supabase CLI/status/start output, and prints only safe summary lines. Fixture setup and row reads happen inside the test script; the 12.3 helper remains pure and route-unused.

The local validation creates one workspace, project contacts/grants, General and Food task presets, timed/date-based/multi-day/milestone/one-off Calendar items, volunteer profiles, assignments, and current responses. It translates real local `calendar_items`, `task_presets`, `calendar_assignments`, and `assignment_responses` row shapes into the helper's safe row inputs, then verifies assignment-derived projections without adding app-route loaders, React hooks, client helpers, Calendar UI imports, product mutations, or service-role clients.

The harness validates the strict current-safe capability rule: a contact with `calendar.view` plus `assignments.view` can validate a coverage-bearing read model; a `calendar.view`-only contact fails closed for assignment-derived coverage; an `assignments.view`-only contact fails closed for item shells; and role/title strings alone do not authorize projection. Grant/capability arrays are not projected into Calendar output.

Coverage validation uses real local rows and proves `needs_response` plus `confirmed` count toward assigned, `declined` counts toward denied but not assigned, canceled assignments do not count toward assigned, wrong-workspace and wrong-calendar-item rows do not bleed into the summarized item, unassigned never drops below zero, zero-needed informational items produce `0/0 assigned`, multi-day windows and milestones remain non-assignable, and assigned-fraction labels use assigned language. Calendar item counters, mock `filledCount`, assigned volunteer id arrays, and client-side mock counters are not production truth.

Safe projection validation proves output contains only Calendar item id, stable display reference, task/source label, display type, schedule kind, date/range/time fields, timezone, needed count, lifecycle, safe schedule notes, task-preset/one-off labels, assignment-derived coverage summary, and assigned-fraction label. It excludes volunteer contact values, emergency contacts, questionnaire answers, public or redacted response URLs, bearer/verifier/token/audit ids, access/refresh tokens, passwords, API keys, service-role keys, SQL/RPC detail, raw grants/capability arrays, unrelated rows, provider dumps, stack traces, and raw exception messages.

Cleanup runs in `finally` and removes assignment responses, calendar assignments, calendar items, task presets, volunteer profiles, questionnaire submissions, grants, project contacts, workspaces, and disposable Auth users for the exact run. A namespace zero-residue check verifies no `qa-12-5-*` fixture data remains. Hosted validation is not required because no migration, RPC, generated type, hosted script, or hosted behavior changed. If 12.5 remains clean, the recommended next slice is `12.6 Route-Unused Calendar Read Model Query Helper Readiness`; otherwise revise 12.5 first.

## 12.4 route-unused Calendar read model helper QA harness

Iteration 12.4 is a route-unused Calendar read model helper QA harness only. It does not cut over `/admin/calendar`, change Calendar UI behavior, import persisted Calendar helpers into routes, add live Supabase product queries, add disposable local database validation, add hosted validation, add Calendar create/edit/delete actions, add assignment picker/create/cancel UI, add assignment-detail entry links, activate response-link generation, add email/reminder delivery, add public volunteer lookup, add remembered-device behavior, add seed data, add service-role usage, or mix mock and persisted data.

`scripts/calendar-read-model-helper-qa-regression.mjs` exercises `lib/calendar/readModel.server.ts` with in-memory database-shaped fixtures only. It proves the helper remains server-only and route-unused, no app route/component imports it, `/admin/calendar` remains mock-only, and the helper creates no Supabase client, calls no `.from` or `.rpc`, imports no service-role/config paths, imports no mock Calendar data, and imports no response-token/reveal/assignment-detail product-action paths.

The QA harness verifies workspace id, actor/contact id, workspace timezone, explicit start/end date range, bounded range, period kind, filter normalization, and capability behavior. Missing `calendar.view` fails before item-shell projection; missing `assignments.view` fails closed rather than producing misleading zero assignment coverage; role/title strings alone do not imply authority; and caller capabilities are not projected into Calendar output.

Coverage QA uses scoped assignment/current-response rows. Active `needs_response` plus `confirmed` count toward assigned, active denied/declined count toward denied but not assigned, removed/canceled/archived rows do not count, other-workspace and other-calendar-item rows do not bleed into a summary, unassigned never drops below zero, zero-needed items produce `0/0 assigned`, and multi-day windows/milestones remain zero-needed/non-assignable. A small pure filter/sort helper is now covered for task-name, type, coverage, lifecycle, and stable date/kind/time/label/id ordering without touching the Calendar route.

Output QA proves the safe projection excludes volunteer contact values, emergency contacts, questionnaire answers, public or redacted response URLs, bearer/verifier/token/audit ids, access/refresh tokens, passwords, API keys, service-role keys, SQL/RPC detail, raw grants/capability arrays, unrelated rows, provider dumps, stack traces, and raw exception messages. Calendar route cutover, writes, assignment picker, assignment-detail linking, response-link activation reopening, service-role reads, seed data, hosted validation, local disposable DB validation, and mock-to-real mixing remain false.

Hosted validation is not required because no migration, RPC, generated type, hosted script, or hosted behavior changed. If this in-memory QA harness remains clean, the recommended next slice is `12.5 Route-Unused Calendar Read Model Disposable Local Data Validation`; otherwise revise 12.4 before touching local disposable data.

## 12.3 route-unused Calendar read model helper/query-shape review

Iteration 12.3 is a route-unused Calendar read model helper/query-shape review only. It does not cut over `/admin/calendar`, change Calendar UI behavior, import persisted Calendar helpers into routes, add live product queries, add Calendar create/edit/delete actions, add assignment picker/create/cancel UI, add assignment-detail entry links, activate response-link generation, add email/reminder delivery, add public volunteer lookup, add remembered-device behavior, add seed data, add service-role usage, or mix mock and persisted data.

`lib/calendar/readModel.server.ts` is server-only and route-unused. It provides pure input normalization, explicit bounded date-range validation, trusted workspace-timezone validation, strict capability evaluation, a future selector/query-shape plan, assignment-derived coverage summarization, and safe row-to-read-model projection. It does not create a Supabase client, call `.from`, call `.rpc`, expose an app-route loader, provide a React hook, or read hosted data.

The helper requires workspace id, actor/contact id, explicit range start/end, workspace timezone, period kind, optional safe filters, and explicit capabilities. `calendar.view` is required for item shells. The main coverage-bearing read shape follows the stricter current-safe rule and requires both `calendar.view` and `assignments.view`; missing `assignments.view` fails closed rather than silently projecting misleading zero coverage.

Coverage summarization uses in-memory assignment/current-response row shapes only. Active `needs_response` and `confirmed` assignments count toward assigned count; active denied/declined assignments count toward denied but not assigned; removed/canceled/archived assignments do not count toward assigned. Unassigned count never drops below zero. Zero-needed informational items use `0/0 assigned`; `multi_day_window` and `milestone` items remain zero-needed/non-assignable until a later reviewed child-occurrence model exists, and aggregate volunteer counts on multi-day windows remain forbidden.

The projection returns only safe Calendar read-model fields: item id, stable display reference, task/source label, display type, schedule kind, date/range/time fields, timezone, needed count, lifecycle, safe schedule notes, one-off/task-preset labels, assignment-derived coverage, and assigned fraction. It does not project volunteer contact values, emergency contact details, questionnaire answers, public or redacted response URLs, bearer, verifier, token id, audit id, access/refresh token, password, API key, service-role key, SQL/internal RPC detail, raw grants/capability arrays, unrelated rows, provider dumps, stack traces, or raw exception messages.

Calendar read model helper and query-shape availability are true, while live query availability, Calendar route persisted read cutover, mock-to-real mixing, Calendar persisted writes, assignment picker cutover, assignment-detail linking, response-link activation reopening, service-role reads, and seed data remain false. Hosted validation is not required because no database, RPC, generated type, hosted script, or hosted behavior changed.

## 12.2 persisted Calendar read model contract

Iteration 12.2 is a persisted Calendar read model contract only. It does not cut over `/admin/calendar`, change Calendar UI behavior, add route database queries, add route links to `/admin/assignments/[assignmentId]`, activate response-link generation, add Calendar create/edit/delete actions, add assignment picker/create/cancel UI, add email/reminder delivery, add public volunteer lookup, add remembered-device behavior, add seed data, add service-role usage, or mix mock and persisted data.

`lib/calendar/readModelContract.server.ts` is server-only and route-unused. It defines future workspace-scoped, authenticated project-contact, capability-checked Calendar period/list reads suitable for Day, Week, Month, and List view data. Future reads must use an explicit bounded date range, workspace timezone, reviewed server-only helpers, and no anonymous read, service-role path, seed data, mock fallback, or raw broad table exposure.

The contract allows only safe Calendar display projection fields: Calendar item identity, internal workspace scope only when needed, task/source labels, task type/category display value, schedule kind, start/end date, start/end time, timezone, needed count, lifecycle/publication state, safe schedule notes, one-off or task-preset labels, stable display reference, assignment-derived counts, and safe inspector fields for project-contact Calendar context. Broad volunteer/contact values are not part of this list read model.

Assignment-derived coverage counts must come from `calendar_assignments` and current `assignment_responses`, not Calendar item counters, mock `filledCount`, assigned volunteer id arrays, or client calculations. The contract defines assigned, confirmed, denied, unassigned, waiting-on-confirmation, has-denied, all-assigned-helpers-denied, coverage-state, and assigned-fraction fields. Pending/`needs_response` plus confirmed assignments count toward assigned count; denied and removed assignments do not. Zero-needed items use `0/0 assigned`. `multi_day_window` and `milestone` items default to zero-needed/non-assignable unless a later reviewed child-occurrence model is added; aggregate volunteer counts on multi-day windows remain forbidden.

The current safe capability rule is strict: `calendar.view` is required for Calendar item shells, and assignment-derived coverage counts require both `calendar.view` and `assignments.view` until a later product permissions review relaxes that rule. Volunteer labels, contact details, questionnaire answers, emergency contacts, raw grants/capability arrays, public token data, response-link URLs, verifiers, token ids, audit ids, unrelated rows, and broad assignment directory data remain out of scope for Calendar list reads and inspectors.

`/admin/calendar` remains mock-only after this slice, and no current route/component imports the new contract or persisted Calendar helpers. Future cutovers must not silently combine mock Calendar items with persisted Calendar items or read persisted Calendar data with a mock fallback in the same user-facing truth source. The existing mock Calendar regression remains the product UI behavior reference until a separate route cutover slice.

Calendar read model implementation, Calendar route persisted read cutover, mock-to-real mixing, Calendar persisted writes, assignment picker cutover, assignment-detail linking, response-link activation reopening, service-role reads, and seed data remain false. Hosted validation is not required because no database, RPC, generated type, hosted script, or hosted behavior changed. The recommended next slice is `12.3 Route-Unused Calendar Read Model Helper or Query-Shape Review` only if this contract passes cleanly.

## 12.1 MVP real-data cutover sequencing review

Iteration 12.1 is a real-data cutover sequencing review only. It does not cut over any current mock route to persisted data, change Calendar UI behavior, change public volunteer behavior, add assignment-detail route links, activate response-link generation, add email/reminder delivery, add public lookup, add remembered-device behavior, add seed data, add service-role usage, or mix mock and persisted data.

`lib/readiness/mvpRealDataCutoverPlan.server.ts` is server-only and route-unused. It records the current available persisted foundations: workspace identity, contact grants, questionnaire submissions, volunteer profiles, task presets, calendar items, calendar assignments/current responses, public response tokens, assignment-detail context, and response-link infrastructure boxed behind false activation flags.

The checkpoint also records the current mock-only prototype surfaces: `/admin/calendar`, `/admin/tasks`, `/admin/volunteers`, `/admin/announcements` and reminder templates, `/v/demo`, `/v/demo/assignments/[assignmentId]`, `/v/demo/reminder/[assignmentId]`, public lookup on `/`, Food/Security prototype surfaces, and the legacy Schedule prototype route. These routes remain mock/prototype surfaces; no product route was converted to persisted data in 12.1.

The recommended cutover sequence is: route-scoped persisted Calendar read model; persisted task preset read model; persisted volunteer profile read model for admin scheduling contexts; persisted assignment coverage/read model for Calendar inspectors and assignment counts; Calendar creation/edit command readiness; assignment picker/create/cancel command readiness; volunteer schedule lookup/read model; public volunteer Confirm/Deny/Confirm All integration through the already-reviewed response-token route or a separately reviewed lookup route; Communications/reminder queue persistence and review/send workflow; and automatic reminder engine/history only after Communications persistence is reviewed.

Non-negotiable cutover rules remain: one route may not silently mix mock and persisted truth, mock routes must stay clearly mock/prototype, persisted routes must use reviewed server-only helpers plus explicit capability checks, route cutovers must be incremental and separately reviewed, unavailable/empty states must be defined before data exposure, Calendar assignment counts must come from assignment rows, volunteer response truth must come from assignment/current-response rows, Communications/reminders must not send before review/send/delivery boundaries exist, public lookup must not leak project or volunteer existence, response-link work remains paused after 11.50 unless a later explicit slice reopens it, service-role usage remains blocked unless separately reviewed, seed data/mock-to-real bridging remain blocked, and no broad assignment directory/search route exists without review.

The recommended next implementation slice is `12.2 Persisted Calendar Read Model Contract`: define a route-unused, server-only read model for Calendar list/detail data using persisted `calendar_items`, assignment-derived counts, and safe workspace/contact grants, without cutting over `/admin/calendar`.

MVP route cutover implementation, Calendar/Tasks/Volunteers/Public Volunteer/Communications cutover, reminder delivery, response-link activation reopening, mock-to-real mixing, and service-role cutover remain false. Hosted validation is not required unless database, RPC, generated type, hosted script, or hosted behavior changes. The 11.47 redirected/redacted Supabase diagnostic guardrail remains intact.

Response-link activation remains paused after 11.50.

## 11.50 assignment response link activation checkpoint review

Iteration 11.50 is an activation checkpoint review only. It does not activate response-link generation, add a result renderer, result component, `useActionState`, `useFormState`, form, action prop, submit control, hidden action metadata, URL reveal, generated URL field, copy behavior, route entry link, delivery, route cutover, migration, hosted validation, or service-role path.

`lib/responseTokens/productActionActivationCheckpoint.server.ts` is server-only and route-unused. It names `/admin/assignments/[assignmentId]` as the only currently reviewed future product reveal surface and records that the route must remain dynamic/no-store, unlinked, persisted-context-only, and limited to `readAssignmentDetailContext`. The route does not import the checkpoint or any planning/policy module.

The checkpoint separates proven foundations from remaining blockers. Proven foundations include the locally/hosted validated public response token tables/RPCs, atomic replacement, reveal audit persistence, transactional audited reveal, persisted assignment-detail context, the unlinked read-only assignment-detail route, exactly one route-derived disabled binding to the 11.41 server-action stub, the disabled-by-default credential-free stub, route-unused disabled result-state/result-renderer policies, and static/browser/server-action guards proving no active route behavior, URL, copy, form, result renderer, hidden metadata, or delivery exists.

Remaining blockers before active reveal include explicit product-owner/final approval, a reviewed active server-action decision, active-success result-state and renderer contracts, URL-bearing success renderer implementation, post-success manual copy UI, browser proof that no URL appears before success and only after deliberate action, log/output proof for credentials and sensitive values, no-prefetch/no-render/no-hover/no-focus/no-hydration execution proof, unavailable-state non-disclosure proof, an entry-link decision from persisted authorized contexts only, abuse/recovery/rate-limit/operational policy, separate blocked delivery/public lookup/remembered-device policy, and hosted validation only if database/RPC/generated-type/hosted behavior changes.

Safe next implementation options are listed without authorizing them: a disabled result renderer that remains non-interactive and credential-free, route-unused active-success result-state or renderer readiness contracts, route-entry re-review from persisted Calendar/Volunteers/Needs Attention/Communications contexts, or pausing response-link work to return to higher-priority MVP scheduling and assignment flows.

Current non-negotiables remain no active reveal, no active copy, no product-surface availability, no navigation/entry linkage, no delivery, no public lookup, no remembered-device behavior, no service-role usage, no mock-to-real mixing, no route import of policy/checkpoint modules, and no direct route import/call of the disabled adapter, product-action boundary, audited reveal/RPC, token helper, replacement helper, diagnostic helper, token-table/direct Supabase helper, or service-role path.

Activation approval, final approval, active reveal, active copy, route server-action implementation, disabled result renderer implementation, active result renderer implementation, active success renderer implementation, product-action UI, copy affordance, product surface, reveal availability, entry linkage, navigation, delivery, public lookup, and remembered-device availability remain false. The 11.47 redirected/redacted Supabase diagnostic guardrail remains intact.

## 11.49 disabled result renderer readiness review

Iteration 11.49 is a disabled result-renderer readiness review only. It does not add a result renderer, result component, `useActionState`, `useFormState`, form, action prop, submit control, hidden action metadata, URL reveal, generated URL field, copy behavior, route link, delivery, route cutover, migration, hosted validation, or service-role path.

`lib/responseTokens/productActionDisabledResultRendererPolicy.server.ts` is server-only and route-unused. It limits any future disabled result renderer to `/admin/assignments/[assignmentId]`, dynamic/no-store rendering, persisted assignment data read only through `readAssignmentDetailContext`, and already-sanitized disabled/error-like state from the 11.48 disabled result-state contract. The current assignment-detail route does not import this policy or the 11.48 result-state policy.

Future disabled rendering must use a fixed allowlisted copy map keyed by safe state codes only. It may not call the server action, accept raw action result objects from unreviewed sources, or render arbitrary error strings, stack traces, provider payloads, Supabase error objects, RPC exceptions, or thrown exception messages. Allowed state codes remain disabled, not approved, checklist blocked, malformed input, unavailable, action error, and impossible success reduced to disabled.

Future disabled result copy must stay credential-free, calm, generic, and non-disclosing. It must not distinguish unauthorized, missing, cross-workspace, inactive, canceled, archived, stale, malformed, or unavailable contexts, and it must not imply that a usable link was generated or suggest copying, sending, emailing, texting, delivering, sharing, opening, or testing a generated link.

The renderer contract forbids buttons, links, retry/reveal/download/open-link/email/text/send/copy affordances, hidden interactive fallbacks, aria-live success announcements for link generation, generated URL fields, URL-shaped strings, `/respond/`, `[redacted]`, bearer-like values, token-like values, hash-like values, audit ids, diagnostic ids, and hidden metadata carrying assignment id, TTL, action data, URL, token, audit, bearer, verifier, workspace, volunteer, actor, grant/capability, redirect/return path, or copy mode.

Disabled result renderer implementation, active result renderer implementation, active success renderer implementation, route server-action implementation, final approval, active reveal, active copy, product-action UI, copy affordance, product surface, reveal availability, entry linkage, and navigation remain false.

## 11.48 disabled action result-state contract review

Iteration 11.48 is a disabled result-state contract review only. It does not add a result renderer, form, action prop, hidden action metadata, submit control, URL reveal, copy behavior, route entry link, delivery, route cutover, migration, hosted validation, or service-role path.

`lib/responseTokens/productActionDisabledResultStatePolicy.server.ts` is server-only and route-unused. It limits any future disabled result renderer to `/admin/assignments/[assignmentId]`, dynamic/no-store rendering, persisted assignment data read only through `readAssignmentDetailContext`, and result state driven only by the 11.41 disabled server-action stub or a reviewed successor. The current assignment-detail route does not import this policy.

The policy allows only credential-free disabled/error-like result states for now: disabled, not approved, checklist blocked, malformed input, unavailable, action error, and impossible success reduced to disabled. It forbids full or redacted response URLs, bearers, verifiers, token ids, audit ids, access or refresh tokens, passwords, API keys, service-role keys, local/hosted secrets, database URLs, SQL or RPC detail, sensitive intake values, emergency contact details, questionnaire answers, raw grants or capability arrays, unrelated rows, provider dumps, stack traces, and raw exception messages.

Result copy must stay generic and non-disclosing for unavailable, unauthorized, cross-workspace, inactive, canceled, archived, missing, malformed, and stale contexts. It may refer only to the already authorized assignment-detail context and general readiness state, and it must not imply that a usable link was generated or suggest copying, sending, emailing, texting, or delivering a link. Any URL-bearing success state and manual copy UI remain reserved for later separately reviewed active-success and post-success slices after final approval, audited reveal, browser/log proof, and product-owner approval.

Disabled result renderer implementation, active result renderer implementation, route server-action implementation, final approval, active reveal, active copy, product-action UI, copy affordance, product surface, reveal availability, entry linkage, and navigation remain false.

## 11.47 disabled action binding security regression review

Iteration 11.47 is a security regression/hardening review only. It does not activate response-link generation, add a form, render an action prop, add hidden action metadata, expose a submit path, reveal a URL, add copy behavior, or link the assignment-detail route from product navigation.

The static route gate now proves `/admin/assignments/[assignmentId]` still creates exactly one route-derived disabled binding to the 11.41 server-action stub and remains the only app route importing that stub. The binding is not rendered as a form action, JSX `action`, `formAction`, callback prop, client component prop, hidden input, data attribute, or browser metadata. The route remains dynamic/no-store, unlinked, persisted-context-only, and reads assignment data only through `readAssignmentDetailContext`.

The browser gate continues to prove the response-link panel appears only in the authorized safe assignment state, may mention the reviewed disabled binding, and remains unavailable. It fails on rendered forms, discoverable action props, enabled or disabled wired submit controls, hidden assignment/TTL/action/token/audit/URL/capability metadata, generated URL fields, copy buttons, clipboard behavior, response-link network requests, credentials, sensitive intake values, unrelated rows, console/page errors, and 390px overflow.

The operational safety guardrail is now documented and statically checked: future local Supabase troubleshooting must use redirected and redacted Supabase diagnostics, prefer Docker/container status, port checks, and health endpoints, and avoid raw CLI/start/status output that can include local keys, JWTs, connection strings, database passwords, access tokens, refresh tokens, or service-role material. The guardrail also scans tracked text files for actual-looking Supabase keys, JWTs, and credentialed Postgres URLs.

## 11.46 disabled route action-binding implementation

Iteration 11.46 adds the first reviewed disabled action binding on `/admin/assignments/[assignmentId]`, but it does not activate response-link generation. The route creates one route-derived binding to `createDisabledAssignmentResponseLinkServerAction` only after the authorized persisted assignment context is available. It does not render that binding as a form/action prop or expose a normal user-submittable path.

The assignment id remains server/route-derived from `/admin/assignments/[assignmentId]`; there is no browser assignment id input, query-provided id, hidden assignment id, hidden TTL, hidden action metadata, workspace/volunteer/actor/token/origin/audit/capability/copy metadata, result renderer, generated URL field, copy button, clipboard behavior, redirect, revalidation, cookie mutation, email/reminder delivery, navigation link, or background work. The route still reads assignment data only through `readAssignmentDetailContext` and imports no disabled adapter, product-action boundary, audited reveal helper/RPC, token helper, replacement helper, diagnostic helper, token-table/direct Supabase mutation helper, service-role path, route-entry policy, enablement checklist, server-action shape policy, disabled route-wiring policy, or action-binding policy.

The 11.41 server-action stub is no longer route-unused because it is route-imported and route-bound in this disabled way. It remains disabled by default, adapter-only, and credential-free, and normal user interaction cannot submit it. Disabled action-binding implementation is true; route server-action implementation, final approval, active reveal, active copy, product-action UI, copy affordance, product surface, reveal availability, entry linkage, and navigation remain false.

`npm run test:assignment-detail-route`, `npm run test:assignment-detail-server-action`, and `npm run test:assignment-detail-route:browser` now distinguish the reviewed disabled binding from activation: they allow the route-derived binding, but continue to fail on rendered forms/action props, hidden fields, enabled submit controls, URL/copy output, forbidden imports, direct reveal/token/service-role paths, response-link network traffic, credentials, sensitive values, or unavailable-state capability leakage.

## 11.45 disabled route action-binding readiness review

Iteration 11.45 does not add a form, action prop, submit control, result renderer, URL reveal, copy behavior, or active product feature. It adds `lib/responseTokens/productActionDisabledRouteActionBindingPolicy.server.ts` as a server-only, route-unused readiness policy for a later reviewed disabled binding between the authorized `/admin/assignments/[assignmentId]` response-link panel and the 11.41 disabled server-action stub.

The policy keeps the eligible route limited to `/admin/assignments/[assignmentId]`, requires dynamic/no-store rendering, keeps assignment data reads limited to `readAssignmentDetailContext`, and names `createDisabledAssignmentResponseLinkServerAction` as the only future callable route seam. It forbids route code from calling or importing the disabled adapter, 11.32 product-action boundary, audited reveal helper/RPC, token helper, replacement helper, diagnostic helper, token-table/direct Supabase mutation helper, service-role path, route-entry policy, enablement checklist, server-action shape policy, disabled route-wiring policy, or the action-binding policy directly.

Any later disabled binding must require deliberate click/tap/submit only. Render, GET, page load, prefetch, hover, focus, client effect, hydration, unavailable-state rendering, panel mount, and tab navigation remain forbidden execution triggers. Assignment id must be server-derived from the route segment or same-route reviewed server binding, never from browser input, query params, hidden fields, arbitrary typed ids, client component props, data attributes, or metadata. Optional TTL remains the only possible browser-controlled value and must stay bounded by existing response-link TTL policy; hidden TTL is prohibited when ambiguous, and server defaults must be used when no user TTL control exists.

Disabled/not-approved/checklist-blocked/malformed/action-error result states must remain credential-free and non-disclosing beyond the already authorized assignment-detail context. Full response URLs and manual copy remain reserved for later separately reviewed active-success and post-success slices after audited success and explicit approval. Automatic clipboard writes remain forbidden.

The route still does not import this new policy. Disabled action-binding implementation, route server-action implementation, final approval, active reveal, active copy, product-action UI, copy affordance, product surface, reveal availability, entry linkage, and navigation remain false.

## 11.44 disabled route wiring browser/security hardening review

Iteration 11.44 does not activate response-link reveal. It hardens the reviewed 11.43 route import state for `/admin/assignments/[assignmentId]`.

`npm run test:assignment-detail-route` now proves the assignment-detail route remains the only app route importing `createDisabledAssignmentResponseLinkServerAction`, and that the import is not called, bound to a form/action, passed as a JSX/action/client prop, hidden in metadata, or paired with response-link form markup, submit controls, hidden assignment id/TTL/action metadata, generated URL fields, copy affordances, redirects, revalidation, cookie mutation, direct adapter/product-action/reveal/RPC/token/replacement/diagnostic/service-role paths, or product navigation links.

`npm run test:assignment-detail-route:browser` now also monitors the authorized response-link panel in production preview. It verifies the safe persisted projection at desktop and 390px mobile widths, confirms the response-link panel is visible only in the authorized state and absent from unavailable states, and proves click, hover, focus/tab interaction does not submit, navigate, reveal, copy, POST to the assignment route, request `/respond/`, request diagnostics, or emit response-link/reveal/copy/audit/token-like network traffic. The browser gate continues to fail on full URLs, bearers, verifiers, token/audit ids, access/refresh tokens, passwords, API keys, service-role keys, SQL/internal RPC detail, sensitive intake values, unrelated rows, console/page errors, or mobile overflow.

Disabled route-wiring/import flags remain true from 11.43. Final approval, active reveal, active copy, route server-action implementation, product-action UI, copy affordance, product surface, reveal availability, entry linkage, and navigation remain false.

## 11.43 assignment-detail disabled route wiring implementation

`/admin/assignments/[assignmentId]` now imports `createDisabledAssignmentResponseLinkServerAction` from `lib/responseTokens/productActionServerAction.server.ts` as the first reviewed route import of the disabled server-action seam. The route uses it only as an inert reviewed-seam reference in the authorized response-link panel; there is no form, action prop, enabled or disabled wired submit control, hidden metadata, generated URL field, copy button, clipboard behavior, redirect, revalidation, cookie mutation, email, reminder, or navigation generation.

The route still reads persisted assignment data only through `readAssignmentDetailContext`, remains dynamic/no-store and unlinked, and keeps missing, unauthorized, cross-workspace, inactive, or otherwise unavailable states non-disclosing. It does not import the disabled adapter, the 11.32 product-action boundary, audited reveal helper/RPC, token helper, replacement helper, diagnostic helper, service-role path, route-entry policy, enablement checklist, server-action shape policy, disabled route-wiring policy, or token-table/direct Supabase mutation path.

The only browser-visible response-link state remains disabled/unavailable and credential-free. No full response URL, bearer, verifier, token id, audit id, access/refresh token, password, API key, service-role key, SQL/internal RPC detail, sensitive intake value, or unrelated row data is rendered or returned. Disabled route-wiring/import flags are now true; final approval, active reveal, active copy, route server-action implementation, product-action UI, copy affordance, product surface, reveal availability, entry linkage, and product navigation remain false.

No migration, hosted validation, delivery, public lookup, remembered-device behavior, route cutover, seed data, cron/background job, service-role usage, or mock-to-real mixing was added.

## 11.42 assignment-detail disabled route wiring readiness review

`lib/responseTokens/productActionDisabledRouteWiringPolicy.server.ts` records the future disabled wiring contract between `/admin/assignments/[assignmentId]` and the 11.41 server-action stub. It is server-only, route-unused, and not imported by the assignment-detail route or any current route/component.

The policy says a later disabled wiring slice may only use the existing dynamic/no-store assignment-detail route, keep reading persisted assignment data through `readAssignmentDetailContext`, and invoke only `createDisabledAssignmentResponseLinkServerAction` after a deliberate submit/click/tap. Assignment id must come from the same route segment or reviewed same-route server binding; the only optional browser-controlled field is bounded TTL.

Render, GET, page load, prefetch, hover, focus, client effect, hydration, unavailable-state execution, hidden/browser metadata, workspace/volunteer/actor/token/bearer/verifier/origin/URL/audit/capability/copy-mode/service-role/redirect/return fields, direct route calls to the disabled adapter/product-action/audited reveal/RPC/token/replacement/diagnostic/service-role paths, manual replacement-plus-audit sequencing, and credential-bearing disabled/error UI remain prohibited.

Disabled route-wiring implementation, route server-action implementation, final approval, active reveal, active copy, product-action UI, copy affordance, product surface, reveal availability, entry/navigation linkage, and product navigation remain false. This slice adds no migration, route wiring, form, submit control, copy behavior, delivery, route cutover, or hosted validation requirement.

## 11.41 disabled assignment response link server action stub

`lib/responseTokens/productActionServerAction.server.ts` adds the first executable server-action seam for future assignment-detail response-link wiring. It remains disabled by default and returns only credential-free disabled states while final approval is false. Iteration 11.43 later imports it into `/admin/assignments/[assignmentId]` as an inert reviewed seam without calling or binding it.

The exported `createDisabledAssignmentResponseLinkServerAction` accepts only a route-derived assignment id plus optional `expiresInHours` FormData. Workspace, volunteer, actor, response/token ids, bearer, verifier, origin, full/redacted URL, audit id/metadata, response-link metadata, capability/grant data, copy mode, service-role/client input, redirect/return paths, arbitrary hidden metadata, and unknown fields fail closed before the adapter can run.

The stub calls only the 11.38 disabled adapter seam. It does not call the 11.32 product-action boundary directly and does not import reveal/RPC/token/replacement helpers. While final approval remains false, valid input returns only credential-free disabled/not-approved states; malformed, out-of-range, forbidden, checklist-blocked, adapter-error, and impossible success paths are reduced to credential-free disabled states. It never redirects, revalidates, sets cookies, logs, sends email, enqueues reminders, writes clipboard, generates navigation, returns a URL, or exposes token/audit identifiers.

`npm run test:assignment-detail-server-action` is preview-free, hosted-free, and service-role-free. It proves the module is server-only, adapter-only, and credential-free across valid, malformed, out-of-range, forbidden-field, adapter-error, and impossible-success cases, and after 11.43 proves the reviewed route import does not invoke or bind it.

No migration, hosted validation, route wiring, visible control, copy behavior, delivery, route cutover, or product availability flag changed.

## 11.40 assignment-detail server-action shape readiness review

`lib/responseTokens/productActionServerActionPolicy.server.ts` defines the route-unused contract for a future assignment-detail response-link server action. It is not an executable `use server` action and is not imported by `/admin/assignments/[assignmentId]`.

The future shape is limited to the existing dynamic/no-store `/admin/assignments/[assignmentId]` route, explicit POST/server-action submit/click/tap behavior, route-derived assignment id plus optional bounded TTL, and execution through the 11.38 disabled adapter or a later reviewed successor. It explicitly forbids render, GET, page-load, prefetch, hover, focus, client-effect, or hydration reveal.

Browser-shaped input remains tightly bounded. Workspace, volunteer, actor, token, bearer, verifier, origin, full/redacted URL, audit id/metadata, response-link metadata, capability/grant data, copy mode, service-role/client input, redirect/return paths, and arbitrary hidden metadata are forbidden. Disabled/error result states remain credential-free and may not return or log full URLs, bearers, verifiers, token/audit ids, access/refresh tokens, passwords, API keys, service-role keys, SQL/internal RPC details, local/hosted secrets, sensitive intake data, or unrelated row data.

Route server-action implementation, final approval, active reveal, active copy, route wiring, product-action UI, copy affordance, product-surface implementation, reveal availability, assignment-detail entry linkage, and product navigation remain false. This slice adds no migration and needs no hosted validation.

## 11.39 assignment-detail disabled adapter unit harness

`npm run test:assignment-detail-action-adapter` adds a preview-free local unit-style harness for `lib/responseTokens/productActionDisabledAdapter.server.ts`. It does not require hosted Supabase, a service-role key, or a production preview.

The harness proves valid assignment id input and bounded TTLs return credential-free disabled/not-approved results while final approval is false. Malformed assignment ids, unknown fields, forbidden browser-shaped fields, and out-of-range TTLs fail closed. It also verifies checklist-blocked paths remain credential-free and a product-action spy is called zero times while final approval is false.

The harness output is summarized and contains no full response URL, bearer, verifier, token id, access/refresh token, password, service-role key, SQL detail, sensitive intake value, or unrelated row marker. `npm run test:assignment-detail-route` also checks that the harness/package script remain test-only and do not import behavior into `/admin/assignments/[assignmentId]`.

No route, UI, navigation link, response-link action, copy affordance, delivery path, migration, hosted gate, or product-surface flag changed.

## 11.38 assignment-detail disabled action adapter

`lib/responseTokens/productActionDisabledAdapter.server.ts` adds a route-unused, server-only disabled adapter for the future assignment-detail response-link action. It is not imported by `/admin/assignments/[assignmentId]` and does not attach a form, server action, enabled button, copy behavior, or reveal behavior to the visible route.

The adapter accepts only browser-shaped assignment id plus optional bounded TTL. Workspace, volunteer, actor, origin, response/token ids, bearer, verifier, full/redacted URL, audit id/metadata, response-link metadata, capabilities, copy mode, service-role/client input, and unknown fields are rejected before any product-action boundary can run.

The adapter checks the 11.37 enablement checklist and then requires `RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ADAPTER_FINAL_APPROVAL_AVAILABLE`, which remains false. Only after that unavailable approval gate would it call the 11.32 `createAssignmentDetailResponseLinkProductAction` boundary. Current malformed, blocked, not-approved, unavailable, and action-error paths are credential-free and return no full URL, bearer, verifier, token id, access token, password, service-role key, SQL detail, sensitive intake data, or unrelated row data.

`RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ADAPTER_AVAILABLE` is true, while final approval, active reveal, active copy, active route-entry linking, route wiring implementation, product-action UI implementation, copy affordance, product-surface implementation, reveal availability, and navigation linkage remain false. This slice adds no migration and requires no hosted validation.

## 11.37 assignment-detail enablement checklist review

`lib/assignments/detailResponseLinkEnablementChecklist.server.ts` consolidates the remaining prerequisites for any future assignment-detail response-link activation. It is server-only, route-unused, and explicitly records that active reveal, copy, and entry linking remain blocked until every checklist group is satisfied and a later reviewed slice flips active availability.

The checklist groups the blockers by route safety, entry safety, action safety, UI safety, credential/log safety, browser proof, and product-owner checkpoint. It requires the route to stay dynamic/no-store, verified-contact-only, persisted-context-only, non-disclosing, and mock-free; future entries must come from persisted authorized assignment context and carry only `/admin/assignments/[assignmentId]`; future actions must be explicit POST/server-action only and call only the 11.32 product-action boundary; future UI must warn about assignment-specific credential access, show expiration, avoid automatic clipboard writes, and allow manual copy only after audited success.

Credential and log states may not include full URL, bearer, verifier, token id, access/refresh token, password, service-role key, local/hosted secrets, SQL detail, sensitive intake data, or unrelated rows. Browser proof must show no URL before success, no desktop or 390px mobile overflow/errors, and no response-link capability detail in unavailable states. Explicit product-owner approval remains required before any active flag flips.

`ASSIGNMENT_DETAIL_RESPONSE_LINK_ENABLEMENT_CHECKLIST_AVAILABLE` is true. Active reveal, active copy, active route-entry linking, Calendar/Volunteers/Needs Attention/Communications/public/diagnostic/response-token entry linkage, product-action UI, copy affordance, product-surface, reveal availability, and product navigation remain false. The current `/admin/assignments/[assignmentId]` route imports no checklist, route-entry policy, action-wiring policy, product-action boundary, or reveal helper.

## 11.36 assignment-detail route entry readiness review

`lib/assignments/detailRouteEntryPolicy.server.ts` records the future entry-point contract without linking any current route to `/admin/assignments/[assignmentId]`. The assignment-detail route remains a secure direct-access fallback/deep-link surface for verified project contacts; routine assignment details should usually stay contextual in inspectors, drawers, or modals.

Future entry points may come from Calendar item inspectors or assignment lists, admin volunteer assignment contexts, Needs Attention staffing/response rows, and Communications/reminder preview contexts only after those surfaces derive assignment ids from already-authorized persisted data. Public volunteer routes, `/respond/[token]`, diagnostic routes, mock-only routes, anonymous pages, browser-typed arbitrary ids, and broad assignment directory/search surfaces remain ineligible.

Future hrefs may link only to `/admin/assignments/[assignmentId]` with no query string or hash. They may not carry workspace id, volunteer id, response token id, bearer, verifier, full/redacted URL, audit id, response-link metadata, grant, or capability data. Missing, stale, or unauthorized assignments must continue to fall into the route's non-disclosing unavailable state.

`ASSIGNMENT_DETAIL_ROUTE_ENTRY_CONTRACT_AVAILABLE` is true. Calendar, Volunteers, Needs Attention, Communications, public volunteer, response-token route, diagnostic route, product navigation, product-action UI, copy affordance, product-surface, and reveal availability flags remain false.

## 11.35 assignment-detail action wiring readiness review

`lib/responseTokens/productActionWiringPolicy.server.ts` records the future wiring contract without importing it into `/admin/assignments/[assignmentId]` or attaching it to the inert panel. The route render remains credential-free, dynamic/no-store, read-only before any future POST, unlinked from product navigation, and limited to the persisted assignment-detail context.

Future wiring must be explicit POST/server-action only. It may not execute on render, GET, page load, prefetch, hover, focus, or automatic effect. Browser input remains limited to assignment id and optional bounded TTL; workspace, volunteer, actor, origin, token id, bearer, full/redacted URL, verifier, audit metadata, copy mode, and capabilities remain forbidden or server-derived.

If a later slice wires the action, route code may call only `createAssignmentDetailResponseLinkProductAction`; it may not call audited reveal helpers, reveal RPCs, replacement/token helpers, token tables, diagnostics, service-role clients, or manual replacement-plus-audit sequencing. A full URL may appear only in the successful explicit action response. Error and log states may not contain full URL, bearer, verifier, token id, audit internals, SQL detail, access/refresh token, password, service-role key, local/hosted secrets, sensitive intake data, or unrelated row data.

`RESPONSE_LINK_PRODUCT_ACTION_WIRING_CONTRACT_AVAILABLE` is true and `RESPONSE_LINK_PRODUCT_ACTION_ROUTE_WIRING_IMPLEMENTATION_AVAILABLE` is false. Product-action UI implementation, copy affordance, product-surface implementation, reveal-product availability, and navigation linkage remain false; the 11.34 shell stays inert.

## 11.34 assignment-detail inert response-link shell

`/admin/assignments/[assignmentId]` now renders a visible response-link readiness panel only after the verified persisted assignment detail context is available. The route remains force-dynamic/no-store, unlinked, read-only, and limited to `readAssignmentDetailContext`; unavailable assignment states do not show response-link-specific capability details.

The panel is intentionally inert. It explains that a future link would grant response access for this assignment, expire, require an explicit reviewed click/tap action, and allow manual copying only after audited success. It contains no form, enabled button, hidden action metadata, clipboard behavior, generated field, URL, bearer, verifier, token id, audit event id, credential, or server-action binding.

`RESPONSE_LINK_PRODUCT_ACTION_INERT_UI_SHELL_AVAILABLE` is true. Product-action UI implementation, copy affordance, product-surface implementation, reveal-product availability, and product navigation linkage remain false. No route imports the product-action boundary or audited reveal helper, and no email/reminder/public lookup behavior was added.

## 11.33 assignment-detail product-action UI readiness review

`lib/responseTokens/productActionUiPolicy.server.ts` records the future UI contract without rendering or importing it into any route. The only eligible surface is `/admin/assignments/[assignmentId]`, and it remains bound to the persisted assignment-detail context plus the 11.32 server action boundary.

The future control must require a deliberate click/tap. It may not reveal on render, GET, page load, prefetch, hover, focus, or automatic effect. It must warn that the generated credential grants response access for that specific assignment, show expiration before and after the action, avoid automatic clipboard writes, and allow manual copy only after audited success returns a full URL.

Error states may not include a full URL, bearer, verifier, token id, raw audit data, credentials, SQL detail, or sensitive fixture value. The full URL may exist only in the successful explicit action response and only long enough for post-success display/copy. Product-action UI implementation, copy affordance, product-surface implementation, reveal-product availability, and product navigation linkage remain false; the current assignment-detail route still imports no action/UI/reveal helper.

## 11.32 assignment-detail product-action server boundary

`lib/responseTokens/productAction.server.ts` adds the route-unused server-only boundary for a future `/admin/assignments/[assignmentId]` response-link action. The browser-shaped input is limited to assignment id and optional policy-bounded TTL; workspace, volunteer, actor, origin, reveal mode, audit metadata, token id, bearer, verifier, and capability data remain server-derived or forbidden.

The boundary verifies the persisted assignment-detail context before reveal by calling `readAssignmentDetailContext`, requiring the returned assignment id to match and requiring `canEditAssignment` to be true. Only after those checks does it derive `copy_link` mode, credential-free metadata, and `RESPONSE_LINK_BASE_URL`, then call `createAuditedAssignmentResponseLinkReveal` as the single transactional replacement-plus-audit reveal boundary. Invalid, missing, unauthorized, read-only, mismatched, unconfigured, or reveal-error states fail closed without returning a URL.

`RESPONSE_LINK_PRODUCT_ACTION_SERVER_BOUNDARY_AVAILABLE` is true, while product-action implementation/UI, product-surface implementation, reveal-product availability, and assignment-detail route navigation linkage remain false. No current route imports the boundary, no page-load/GET/prefetch reveal exists, and `/admin/assignments/[assignmentId]` remains read-only, unlinked, and free of response-link controls.

## 11.31 assignment-detail route visual/behavior QA

`npm run test:assignment-detail-route:browser` now creates disposable local Auth/workspace/grant/questionnaire/volunteer/task/Calendar/assignment/response fixtures, transfers only that user’s SSR session cookies into a loopback production-preview browser, and cleans every row in `finally`. It refuses non-loopback Supabase/preview targets and prints no credential or sensitive fixture value.

The gate verifies the anonymous sign-in state, one authorized safe projection, the authenticated unavailable state, absence of token/link/audit/intake/credential and unrelated-row content, no actionable buttons or response/diagnostic links, and no horizontal overflow at desktop or 390px. It found and fixed an invalid runtime `Intl.DateTimeFormat` option combination that had caused the authorized route to return 500; the timestamp now uses explicit date/time fields with the safe workspace timezone and UTC fallback.

The route remains dynamic/no-store, unlinked, read-only, and limited to `readAssignmentDetailContext`. Product-action implementation/UI, product-surface implementation, reveal availability, and navigation linkage remain false. No hosted validation was run because schema, RPCs, generated types, and hosted gates are unchanged.

## 11.30 unlinked persisted assignment-detail route shell

`/admin/assignments/[assignmentId]` is now the first read-only persisted admin route. It is force-dynamic/no-store, requires a verified project-contact session, and calls only `readAssignmentDetailContext`; the RPC continues to enforce `assignments.view` and derive all scope server-side. Malformed, missing, unauthorized, cross-workspace, canceled, archived, inactive, and otherwise unavailable contexts share one calm non-disclosing state.

The shell renders only the reviewed assignment/workspace/task/schedule/volunteer-label/current-response projection plus the safe edit boolean. It imports no mock data, token/replacement/reveal/audit helper, service-role path, or delivery boundary. It contains no response-link action or active copy affordance and is not linked from navigation, Calendar, Volunteers, Needs Attention, Communications, Overview, public volunteer pages, or `/respond/[token]`.

`ASSIGNMENT_DETAIL_ROUTE_IMPLEMENTATION_AVAILABLE` is true. `ASSIGNMENT_DETAIL_ROUTE_LINKED_FROM_PRODUCT_NAVIGATION`, product-action implementation/UI, product-surface implementation, and reveal-product availability remain false. The new `npm run test:assignment-detail-route` static gate proves route isolation and the unchanged fail-closed flags.

## 11.29 persisted assignment-detail route-surface contract

The route-unused server-only contract selects `/admin/assignments/[assignmentId]` because an assignment is its own persisted object and may later receive separately reviewed entry points from Calendar, Volunteers, Needs Attention, or Communications. No route or navigation link exists yet. A future route must be dynamic/no-store, require a verified project contact and `assignments.view`, and read only `readAssignmentDetailContext`; it may expose edit readiness only as a boolean.

The route may render only the approved assignment projection. It must not read token rows or render credentials, links, token/audit internals, sensitive volunteer intake data, raw grants, or unrelated rows. Missing, unauthorized, cross-workspace, canceled, archived, inactive, and unavailable context must share one calm unavailable state without existence or SQL-detail leakage. Current mock Calendar, Volunteers, Needs Attention, Communications, diagnostic, public response/volunteer, and validation surfaces remain ineligible.

`ASSIGNMENT_DETAIL_ROUTE_CONTRACT_AVAILABLE` is true. Route implementation and product-navigation linkage are false, as are product-action implementation/UI, product-surface implementation, and reveal availability. The next reviewed slice should add only an unlinked assignment-detail route shell with no response-link action; the action and warning/expiry/copy UI remain separate later work.

## 11.28 product-action readiness contract

The route-unused server-only contract selects `future_project_contact_assignment_response_reveal` inside persisted assignment-detail context only. A future action may accept assignment id and optional bounded TTL; workspace, volunteer, actor, response/token ids, bearer/URLs/verifier/origin, copy mode, audit metadata, and grant/capability data are forbidden browser inputs.

The future server sequence must verify a project-contact session, read assignment detail first, require `can_edit_assignment`, use dynamic/no-store explicit POST with no GET/render/prefetch execution, derive `RESPONSE_LINK_BASE_URL` server-side, and call `createAuditedAssignmentResponseLinkReveal` exactly once. Route/action code may not call the RPC directly or manually sequence replacement and audit. Only the successful explicit response may contain the full URL, expiration, and credential warning; URL/bearer/verifier/token id logging or persistence and credential-bearing error states are prohibited.

Future UI must warn that the link grants assignment response access, show expiration, require a click/tap, and permit manual copy only after audited success. Before enablement, the persisted assignment-detail route, reviewed POST action, warning/expiry UI, no-store/no-prefetch proof, log-redaction checks, browser proof that no URL appears before success, and explicit product-owner approval must exist. `RESPONSE_LINK_PRODUCT_ACTION_CONTRACT_AVAILABLE` is true; action implementation, action UI, product-surface implementation, and reveal-product availability remain false. No executable action or UI was added.

## 11.27 hosted staging assignment-detail validation

Non-production `project-local-staging` (`kfuujcfxoayukywvtaeh`) is migrated through `20260705000000`. The exact-opt-in `npm run test:assignment-detail-context:hosted` gate refuses every other project and requires `RUN_HOSTED_ASSIGNMENT_DETAIL_CONTEXT_VALIDATION=project-local-staging:kfuujcfxoayukywvtaeh`.

Two fresh `qa-11-27-*` runs passed unauthenticated execute denial; under-capability, cross-workspace, missing, canceled, archived, inactive-workspace/item/volunteer no-row behavior; and one exact safe active assignment projection for a grant containing only `workspace.read` and `assignments.view`. Adding `assignments.edit` changes only `can_edit_assignment`; product reveal remains false. The projection has no capability array, token/link/verifier/credential, emergency, questionnaire, or sensitive intake field. Exact-run and namespace product/Auth residue are zero.

Hosted generated types are structurally unchanged; only remote PostgREST metadata differs. The gate creates no token and performs no reveal, copy, display, delivery, or route integration. The future reviewed POST action/UI remains a separate blocked slice.

## 11.26 persisted assignment-detail context

Local migration `20260705000000_assignment_detail_context.sql` adds authenticated security-definer `read_assignment_detail_context(assignment_id)`. A narrow command is necessary because safe assignment detail needs selected Calendar and volunteer labels while existing table RLS correctly reserves broad table reads for `calendar.view` and `volunteers.view`. The RPC instead derives one assignment's workspace/item/volunteer/current response server-side and requires an active, valid `assignments.view` grant for that workspace.

Only active assignment, workspace, item, and ready active volunteer context returns. Missing, unauthorized, cross-workspace, canceled, archived, or inactive context produces no row, avoiding existence leaks. The result contains safe identifiers/labels/schedule/response fields, an `assignments.edit` boolean, false product-surface availability, and the planned future surface name. It contains no capability array, token row/id/scope/verifier, link, credentials, emergency contact, questionnaire answers, or unrelated rows.

`readAssignmentDetailContext` and `readAssignmentDetailContextWithClient` are server-only and unused by every route. `RESPONSE_LINK_ASSIGNMENT_DETAIL_CONTEXT_AVAILABLE` is true, while `RESPONSE_LINK_PRODUCT_SURFACE_IMPLEMENTATION_AVAILABLE` and `RESPONSE_LINK_REVEAL_PRODUCT_SURFACE_AVAILABLE` remain false. This adds no route or UI and never calls the audited reveal helper/RPC; the future copy action still requires its own reviewed POST-only product slice. Hosted migration validation is pending.

## 11.25 product-surface readiness review

The first future eligible reveal surface is `future_project_contact_assignment_response_reveal`, located only in a future persisted project-contact assignment-detail action—not the diagnostic, mock Calendar inspector, mock volunteer profile, mock Communications preview, Needs Attention, public response/volunteer routes, or hosted validation gates. This review adds no UI or executable route action.

The future server action must be verified-contact, database-`assignments.edit`, POST-only, dynamic/no-store, explicit-action-only, trusted-origin-only, and non-prefetchable. It may accept only one assignment id and optional bounded TTL from the browser; copy mode, actor/scope, token data, origin, and audit metadata remain server-derived. Route code must call `createAuditedAssignmentResponseLinkReveal` as one boundary and must never manually sequence replacement plus audit. A full URL may return only in that same successful action response, after transactional audit; GET, render, page-load, prefetch, logging, or automatic clipboard reveal is prohibited.

The future interaction must warn that the credential grants response access for that assignment, show expiration, and permit manual copy only after audited success. Before availability can become true, the persisted assignment-detail context, reviewed action, trusted-origin configuration, warning/expiry UI, no-prefetch behavior, targeted browser/security/logging tests, and an explicit enablement review must exist. `RESPONSE_LINK_REVEAL_PRODUCT_SURFACE_AVAILABLE` and the separate planning-module implementation flag remain false; the next slice is the persisted assignment-detail context and reviewed POST action—not Communications or delivery.

## 11.24 hosted staging transactional reveal validation

Non-production `project-local-staging` (`kfuujcfxoayukywvtaeh`) is migrated through `20260704000000`. The exact-opt-in `npm run test:response-reveal:hosted` gate refuses every other project and requires `RUN_HOSTED_AUDITED_RESPONSE_REVEAL_VALIDATION=project-local-staging:kfuujcfxoayukywvtaeh`.

Two fresh `qa-11-24-*` runs passed unauthenticated and missing-capability denial, invalid TTL/mode/metadata rejection with unchanged token/audit state, old-token revocation, one 32-byte hash-only replacement plus one correctly scoped credential-free audit, returned-bearer public verification/submission, concurrent single-active-token behavior, existing replacement/audit compatibility, and exact-run plus namespace zero-residue checks. Hosted generated types are structurally unchanged; only remote PostgREST metadata differs. No product surface reveals, copies, displays, emails, or sends a link, and `RESPONSE_LINK_REVEAL_PRODUCT_SURFACE_AVAILABLE` remains false.

## 11.23 transactional audited reveal contract

Local migration `20260704000000_audited_response_link_reveal.sql` adds authenticated security-definer `reveal_assignment_response_link`. It locks one assignment, derives workspace/volunteer/actor server-side, requires active `assignments.edit`, revokes older same-purpose tokens, stores one SHA-256 verifier, inserts exactly one credential-free reveal audit, and returns the new bearer once only after both writes succeed in the same transaction. Invalid Auth, capability, TTL, mode, or metadata fails without token revocation, issuance, or audit insertion; concurrent calls serialize on the assignment and leave one usable token.

`createAuditedAssignmentResponseLinkReveal` and `createAuditedAssignmentResponseLinkRevealWithClient` are server-only and unused by routes. They validate the 72-hour default/168-hour maximum, allowlisted reveal data, and trusted origin, then construct `/respond/[token]` in memory and return a redacted companion URL. `RESPONSE_LINK_REVEAL_TRANSACTIONAL_COMMAND_AVAILABLE` is true, while `RESPONSE_LINK_REVEAL_PRODUCT_SURFACE_AVAILABLE` remains false. No current user can reveal, copy, display, email, or send a link; a future explicit reviewed product action and hosted migration validation are still required.

## 11.22 hosted staging reveal-audit validation

Non-production `project-local-staging` (`kfuujcfxoayukywvtaeh`) is migrated through `20260703000000`. The exact-opt-in `npm run test:response-reveal-audit:hosted` gate refuses every other project and requires `RUN_HOSTED_RESPONSE_REVEAL_AUDIT_VALIDATION=project-local-staging:kfuujcfxoayukywvtaeh`.

Two fresh `qa-11-22-*` runs passed direct anon/authenticated table denial, unauthenticated and missing-capability RPC denial, wrong-assignment/revoked/expired-token rejection, metadata allowlisting/bounds, one correctly scoped credential-free event, atomic-replacement compatibility, and exact-run plus namespace zero-residue checks for product/Auth fixtures. Hosted generated types are structurally unchanged; only remote PostgREST metadata differs. The gate does not reveal, copy, display, email, or send a link, and current routes remain ineligible until a future explicit server action coordinates atomic replacement, successful audit persistence, and one-time credential response.

## 11.21 response-link reveal audit persistence

`public.assignment_response_link_reveal_events` is an immutable command-only audit table. A composite foreign key binds workspace, assignment, and response-token id to the same token row; actor references the project contact. Action is fixed to `response_link_revealed`, surface is fixed to the planned project-contact reveal surface, and mode is constrained to `copy_link`, `email_delivery`, or `reminder_delivery` without performing any of those actions. Expiry must follow occurrence. There is no free-form note. Metadata permits only `reason_code` (a lowercase 1–50 character code), `delivery_requested` (boolean), and `request_correlation_id` (UUID), with at most three keys and 2,000 serialized bytes.

The schema has no bearer, full URL, verifier, password, access/refresh token, service-role key, emergency-contact, questionnaire-answer, or general volunteer-data column. RLS is enabled with no policies; anon and authenticated receive no table privileges. There is no direct insert/update/delete/read path and no token deletion.

`record_assignment_response_link_reveal_event` is the only write command. It requires real Auth and an active `assignments.edit` grant, derives workspace and actor/project contact, locks and verifies a live unrevoked matching assignment-response token, requires the supplied expiry to match the token, validates the fixed surface/mode and bounds, and returns only safe event references/metadata. `recordAssignmentResponseLinkRevealAudit` and its client variant provide runtime validation and call only that RPC; no route imports them.

Local live QA proves anon/authenticated direct table denial, unauthenticated and under-capability RPC denial, wrong-assignment/revoked/expired rejection, metadata allowlisting/bounds, one valid credential-free event, exact scope/actor/token/expiry persistence, existing replacement/public-response behavior, and zero residue. `RESPONSE_LINK_REVEAL_AUDIT_PERSISTENCE_AVAILABLE` is now true, but `RESPONSE_LINK_REVEAL_PRODUCT_SURFACE_AVAILABLE` remains false. `evaluateFutureResponseLinkReveal` therefore still returns `explicit_product_surface_missing`: persistence is a prerequisite, not permission to reveal.

## 11.20 audited response-link reveal boundary

The sole eligible future surface is `future_project_contact_assignment_response_reveal`. It must be a deliberate project-contact POST/server-action flow with dynamic/no-store output. Before revealing a credential it must have a verified contact session, database-enforced `assignments.edit`, a successful atomic `replace_assignment_response_token` result, a server-configured trusted origin, explicit user action, a bounded 11.17 product TTL, disabled automatic logging, and a successfully persisted audit event. Clipboard access may occur only after that audited response; GET, static, cached, automatic, diagnostic, validation, public-response, Calendar, Volunteers, Communications, Needs Attention, and mock volunteer surfaces are ineligible.

The planned `response_link_revealed` audit event contains workspace, assignment, response-token, and actor/project-contact ids; reveal surface; copy/email/reminder mode; expiration and occurrence timestamps; and tightly allowlisted metadata. It must never contain a free-form note, bearer, full response URL, verifier hash, password, access/refresh token, service-role key, emergency contact, or questionnaire answers. Token rows continue to retain only verifier/lifecycle metadata.

Iteration 11.21 makes `RESPONSE_LINK_REVEAL_AUDIT_PERSISTENCE_AVAILABLE` true. `canCurrentSurfaceRevealFullResponseLink` still returns false for every existing surface, and `evaluateFutureResponseLinkReveal` remains blocked by `explicit_product_surface_missing`. Atomic replacement plus audit persistence are necessary but are not permission to display or deliver a link. Transaction/failure semantics tying replacement, audit success, and one-time credential response together in a later explicit product surface remain required.

Static regression checks prove no route imports the replacement-link or reveal-policy helpers, no current route exposes response URL/bearer/verifier fields, no clipboard/copy-link UI exists, the hosted gate remains explicit opt-in validation, and the diagnostic remains unlinked, redacted-only, fixed at one hour, and immediately revoked. No migration or generated-type change is part of 11.20.

## 11.19 hosted staging replacement validation

`project-local-staging` (`kfuujcfxoayukywvtaeh`) is migrated through `20260702000000`. The explicit-opt-in `npm run test:response-replacement:hosted` gate refuses any other linked ref/name, requires `RUN_HOSTED_RESPONSE_REPLACEMENT_VALIDATION=project-local-staging:kfuujcfxoayukywvtaeh`, uses the linked CLI management query path only for disposable setup/cleanup, and uses an anon-key client plus a disposable real Auth session for RPC behavior. It creates no helper functions, roles, triggers, seed rows, service-role client, or committed secret.

Two fresh hosted runs passed. They prove `assignments.edit` denial preserves the existing token; authorized replacement revokes old verification/submission; the replacement verifies and submits; only a 32-byte verifier is stored; 169 hours is rejected without state change; and overlapping replacements leave exactly one usable token while preserving response truth. Cleanup runs in `finally`, removes all product/Auth fixtures, and exact-run plus namespace residue checks return zero.

Hosted linked type generation matches the reviewed local public schema structurally, including `replace_assignment_response_token`. Its only output difference is remote `__InternalSupabase.PostgrestVersion` metadata, so `lib/supabase/database.types.ts` was not overwritten. No full response URL or bearer is displayed or logged. Full-link display/delivery still requires a future explicit audited product surface and delivery/audit boundary.

## 11.18 atomic response-token replacement

`replace_assignment_response_token(assignment_id, ttl_hours)` accepts only assignment id and a 1–168 hour TTL. It derives workspace, volunteer, actor, fixed `assignment_response` purpose, and scope server-side; requires a real authenticated active contact/grant containing `assignments.edit`; and returns token id, expiration, and one database-generated raw bearer. Only its SHA-256 verifier is stored. The RPC grants execute only to `authenticated` and adds no token-table policy or read privilege.

The function locks the active target assignment row before changing token state. Within that same database transaction it revokes every older unrevoked token for the assignment/purpose, generates 32 random bytes, inserts one replacement verifier, and returns the bearer once. Authorization or TTL failure happens before mutation. Any update/insert failure rolls the transaction back. Concurrent calls serialize on the assignment row; a later call revokes the earlier replacement, so final state contains exactly one active usable token without a global lock.

`replaceAssignmentResponseToken` / `replaceAssignmentResponseTokenWithClient` provide the typed server-only token boundary. `issueReplacementAssignmentResponseLink` / `issueReplacementAssignmentResponseLinkWithClient` compose that boundary with the existing validated URL builder, remain unused by routes, and apply the 72-hour default/168-hour maximum. The diagnostic continues using its one-hour preview path, renders only `/respond/[redacted]`, and immediately revokes its token.

Live local QA passed twice with disposable fixtures. It proves denied replacement preserves the old token, authorized replacement invalidates old verification/submission, the replacement verifies and submits, hash-only storage persists, a 169-hour request changes nothing, and two overlapping replacements leave one usable token and unchanged response truth. Fixture and Auth residue is zero.

## 11.17 response-link product lifecycle policy

Future usable response links default to 72 hours and are capped at 168 hours. `normalizeResponseLinkTtlHours` enforces those bounds before the 11.14 link issuer is called. Diagnostic issuance has a separate fixed one-hour policy, remains redacted-only, and still revokes the discarded token in `finally` before success returns.

Product replacement policy is conservative: issuing a replacement must atomically revoke every older active `assignment_response` token for the same assignment and purpose, then issue exactly one replacement. Any revocation failure must fail closed without issuing or revealing a new credential. Iteration 11.18 now enforces this through the dedicated replacement RPC; the older preview issuer remains non-product and must not substitute for it.

Hash-only token rows remain the audit record. Retained metadata is token id, workspace/assignment/volunteer scope, purpose, verifier hash, creator, creation/expiry/revocation/use timestamps, and bounded internal note. Raw bearers and full response URLs must never be retained, and no automatic deletion policy is introduced.

Only a future explicit product issuance surface may intentionally reveal a full link, and only after atomic replacement succeeds, with a verified project contact, database-enforced `assignments.edit`, an explicit credential reveal, and automatic logging disabled. Diagnostics and the public response route are not eligible. Before email/reminder delivery, the project still needs an explicit audited reveal surface, a delivery provider boundary and delivery audit, revocation-failure recovery, and rate-limit/abuse controls. Calendar, Volunteers, Communications, and Needs Attention remain mock-only/unconnected.

## 11.16 response-token cleanup and revocation guardrail

The existing 11.11 revocation contract is sufficient: `revokeAssignmentResponseToken` accepts only token id, verifies the authenticated contact, and calls a security-definer RPC that requires an active grant containing `assignments.edit` for the token workspace. It sets `revoked_at`, returns the token id, retains the hash-only row, and exposes no table read or raw bearer. No delete helper, cleanup script, cron, service-role path, or token-listing surface was added.

The server-only `IssuedAssignmentResponseLink` now includes `tokenId` alongside the in-memory full URL so trusted server workflows can revoke what they issue. `issueResponseLinkDiagnostic` uses that id only inside its server boundary and calls the existing revocation helper in `finally`; the route action still receives only assignment id, expiration, and redacted URL. A successful diagnostic state therefore means the discarded credential was revoked before the redirect. Token id, raw bearer, full URL, verifier/hash, workspace, volunteer, actor, purpose, and scope never reach route output.

`npm run test:response-link` now proves live local behavior: removing `assignments.edit` causes revocation to fail with `42501` and leaves the token valid; restoring the capability allows revocation; afterward public verification returns no row, public response fails with `42501`, the assignment remains `needs_response`, and the 32-byte hash-only token row remains with `revoked_at` set. Static checks also prohibit token deletion and keep the 11.15 route unlinked, redacted-only, and free of token ids.

This guardrail solves only discarded diagnostic credentials. Product use still needs explicit decisions for who may reveal a full link, whether replacement issuance revokes earlier links, how delivery/audit events relate to token lifecycle, how expired/revoked metadata is retained or cleaned, and how revocation failures are recovered. Revocation is preferred over deletion for auditability.

## 11.15 response-link admin diagnostic boundary

`/admin/diagnostics/response-link` is dynamic, noindex, no-referrer, and deliberately absent from all navigation, landing, Calendar, Volunteers, Communications, template, and mock volunteer surfaces. The page calls `readProjectContactSession` itself, so a verified Supabase contact identity is required even when general mock admin routes use `ADMIN_AUTH_MODE=review`; enforced mode additionally retains the proxy gate.

The browser can submit only assignment UUID and the fixed one-hour diagnostic TTL. `RESPONSE_LINK_BASE_URL` is a server-side trusted origin and is never a form field. `issueResponseLinkDiagnostic` calls only `issueAssignmentResponseLink`; the 11.14/11.11 layers still verify Auth and `assignments.edit` and derive workspace, volunteer, actor, purpose, source, and scope. Missing configuration, malformed input, unavailable/unauthorized issuance, and unexpected errors map to calm non-secret states.

The mapper strips `responseUrl` and token id before returning to the action. It immediately revokes the diagnostic-issued token before success redirects with assignment/expiration metadata and renders the fixed `/respond/[redacted]` path. No full link, bearer, token id, verifier/hash, volunteer data, or scope data reaches ordinary diagnostic output. The credential is not displayed, copied, logged, or delivered, and its revoked hash-only row is retained for auditability.

Focused regression checks cover the authenticated-session call, server-only configuration, malformed/configuration states, noindex metadata, redacted-only output, no direct RPC/service-role access, and the absence of links/imports outside the route. Positive cookie-backed route automation was intentionally not duplicated: the 11.14 disposable local QA already proves authorized live issuance/hash-only storage/public verification/cleanup, while a full diagnostic route pass would repeat the 11.13 Auth/browser fixture framework.

## 11.14 project-contact response-link issuance boundary

`issueAssignmentResponseLink` uses the cookie-aware `issueAssignmentResponseToken` helper; `issueAssignmentResponseLinkWithClient` uses the existing authenticated-client variant. Neither duplicates a direct RPC. Input is limited at runtime to assignment id, a product-policy TTL of 1–168 hours (72 by default), and an application base origin. The database still derives workspace, volunteer, actor, purpose, and token scope and requires an effective `assignments.edit` grant.

`validateResponseLinkBaseUrl` accepts loopback HTTP for local work and HTTPS origins for deployed callers. It rejects empty/malformed values, unsafe schemes, non-loopback HTTP, embedded credentials, paths, query strings, fragments, and unknown input fields. The server-only structured result contains token id, full in-memory response URL, expiration timestamp, and `redactedUrl`; it does not expose the raw bearer separately, verifier/hash, workspace, volunteer, actor, or source. Token id exists for authorized lifecycle actions and must be stripped before route output. `redactAssignmentResponseLink` never returns an unrecognized input unchanged.

`npm run test:response-link` executes the server-only orchestration under the React server condition, authenticates a disposable local contact with `assignments.edit`, issues and verifies one token, confirms the token table has a 32-byte verifier and no raw-token column, prints only `/respond/[redacted]`, and removes every fixture/Auth row in `finally`. Two fresh-fixture runs passed. The helper is imported by no route, component, Calendar, Volunteers, Communications, Needs Attention, template, or mock surface; no link is displayed or delivered.

## 11.13 public response route valid-token QA boundary

`npm run test:response-route` is a local-only production-preview gate. It refuses non-loopback Supabase and preview URLs, requires the local stack and reviewed public environment values, creates a disposable local Auth contact plus the minimum workspace/grant/questionnaire/volunteer/task/Calendar/assignment/response/token chain, and issues the bearer through the authenticated 11.11 RPC. It never uses or reads a service-role key.

The Playwright pass opens the real `/respond/[token]` route, checks the documented safe assignment projection, rejects sensitive and unrelated fixture markers, verifies the bearer is absent from visible and non-script markup, submits `confirmed` through the route action, and confirms `confirmed` / `public_token` / populated `last_used_at` in PostgreSQL. Cleanup runs in `finally`, deletes every disposable product/Auth row, and verifies zero residue. Two consecutive fresh-fixture runs passed.

The gate found and fixed two route-shell issues without changing the database or RPC contract: plain server-action binding exposed the bearer in a hidden input, so the page now captures it in an encrypted inline server-action closure; an untouched optional note posted an empty string, so the server-only action helper normalizes blank text to `null` before existing validation. This remains QA/test infrastructure only and adds no link creation, link delivery, email/reminder sending, lookup, remembered devices, admin link generation, or route integration.

## 11.12 public assignment response route boundary

`/respond/[token]` treats its path segment as a bearer credential and passes it only through a server-only route mapper. Verification uses `readAssignmentResponseByToken`; mutation uses `submitAssignmentResponseByToken`, never the project-contact command. The page renders only workspace display name, task title snapshot, schedule kind/date/time/timezone, and current response status. It accepts only `confirmed` or `declined` plus the existing bounded optional note; workspace, assignment, volunteer, source, actor, and scope remain server-resolved.

Malformed and unavailable tokens share calm non-specific states. Missing public Supabase configuration, unexpected failures, and SQLSTATE `40001` concurrency receive separate safe copy without internal error details. Successful submission stays on the direct response page. The route is dynamic, non-indexed, carries a no-referrer policy, logs no bearer, and exposes no verifier/hash, volunteer identity/contact data, questionnaire data, roster, grants, or unrelated schedule rows.

This shell is not linked from the landing page, mock volunteer schedule, reminder preview, admin navigation, Communications, or templates. It does not create, send, or deliver links; provide lookup or remembered-device access; replace the mock volunteer portal; or connect Calendar, Volunteers, Communications, or Needs Attention routes to persisted data.

## 11.11 public volunteer response authorization boundary

`public.assignment_response_tokens` stores one workspace, assignment, volunteer profile, fixed `assignment_response` purpose, expiry/revocation/use timestamps, and a unique 32-byte SHA-256 verifier. The raw 256-bit base64url bearer is generated inside PostgreSQL, returned once from authenticated issuance, and never stored. A composite foreign key binds token scope to the assignment's actual workspace and volunteer.

Issuance and revocation require an active contact/grant containing `assignments.edit`; adjacent roles or `workspace.read`, `calendar.view`, and `volunteers.view` are insufficient. Token rows have RLS enabled, no policies, and no anon/authenticated table privileges, so even authorized contacts cannot broadly select verifier hashes. The server helper never logs the returned bearer and no route imports it.

The anon-executable verification function accepts only a correctly shaped bearer and returns workspace display name, opaque assignment reference, task title snapshot, schedule kind/date/time/timezone, and current response status. It returns no volunteer identity/contact data, questionnaire/emergency data, roster, notes, grants, verifier, or unrelated schedule rows.

The separate public response command accepts only bearer, `confirmed`/`declined`, and a bounded note. It re-resolves the unexpired, unrevoked, correct-purpose token plus active assignment, volunteer, Calendar item, and workspace; locks the token/response rows; records source `public_token`; and updates `last_used_at`. It does not invoke the project-contact command. Bearers remain credentials until expiry/revocation and forwarded links carry the same authority. The 11.12 shell is its only route consumer; delivery remains unimplemented.

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

Direct profile inserts, updates, and deletes are denied to anon/authenticated roles. The authenticated-only `convert_questionnaire_submission_to_volunteer_profile` function accepts only a submission UUID; callers cannot supply workspace ids or profile values. It verifies `auth.uid()`, source status/version, active contact/grant validity, and both `questionnaires.review` and `volunteers.edit` for the source workspace. A still-`submitted` version-1 source is the only usable conversion state because 11.6 intentionally has no status-mutation workflow. The explicit command is the approval/conversion decision, creates an `active`/`ready` snapshot, and does not update the submission. Later 12.15 manual Add/Edit commands do not erase this questionnaire provenance.

Authenticated profile reads require an effective grant containing `volunteers.view`; workspace visibility or `questionnaires.review` alone is insufficient. As of 12.15, `/admin/volunteers` is the approved persisted volunteer-management route; questionnaire queue/detail and the old volunteer detail route do not become alternate persisted truth sources.

`npm run test:volunteers` checks schema scope, provenance/duplicate constraints, capability predicates, source status/version, Auth verification, sensitive-field separation, direct-write denial, parser behavior, conversion fixtures, and the approved 12.15 route import boundary. Without configured Supabase this is a contract regression, not a live conversion or live two-user RLS claim.

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

Local setup and secret-handling rules live in [`SUPABASE_LOCAL_SETUP.md`](./SUPABASE_LOCAL_SETUP.md). `SUPABASE_SERVICE_ROLE_KEY` is an optional typed server-only placeholder and has no privileged client factory or current consumer. Reviewed public-schema types generated from the local 11.11 schema are available in `lib/supabase/database.types.ts` and parameterize the shared browser/server/proxy clients and isolated persistence helpers without replacing runtime validation. Only the narrow 11.12 public response shell consumes persisted product data.

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
- **Post-11.11 validation gate — passed 2026-07-02:** local and hosted non-production migrations apply through `20260701070000`. All 16 hosted live RLS/RPC groups passed against `project-local-staging` (`kfuujcfxoayukywvtaeh`), including target-row concurrency with exactly one winner, one SQLSTATE `40001` loser, and final truth matching the winner. Disposable fixtures, Auth users, helpers, triggers, transient roles, passwords, and temporary files were removed. Hosted generated-type output differed only in remote PostgREST metadata, not schema structure.
- **11.12 Public Assignment Response Route Shell — completed:** `/respond/[token]` uses only the verified public read/mutation helpers, renders their safe projection, and maps success, unavailable, configuration, concurrency, and generic error states without linking or cutting over any mock route.
- **11.13 Public Response Route Valid-Token QA Gate — completed:** the local-only disposable harness passed twice, verified the real route and database mutation, confirmed safe projection/no non-script bearer exposure, and removed all fixture/Auth rows after each run.
- **11.14 Project Contact Response Link Issuance Preview Boundary — completed:** server-only authorized issuance builds one validated response URL with expiration metadata and redacted diagnostics; the local hash-only/verification/cleanup QA passed twice, and no route imports the helper.
- **11.15 Response Link Admin Diagnostic Preview — completed:** the unlinked authenticated route accepts only assignment id/TTL, uses the server-derived 11.14 boundary, and renders redacted diagnostic metadata only; no navigation or product route imports it.
- **11.16 Response Token Cleanup and Revocation Readiness Guardrail — completed:** discarded diagnostic credentials are revoked in `finally` through the existing `assignments.edit` helper; live QA proves denied/authorized revocation, public rejection, retained hash-only audit rows, and unchanged response truth.
- **11.17 Response Link Product Lifecycle Policy — completed:** product TTL, fail-closed replacement, audit retention, full-link exposure, and delivery prerequisites are explicit server-only policy.
- **11.18 Atomic Response Link Replacement RPC — completed locally:** authenticated `assignments.edit` replacement locks one assignment, revokes older unrevoked response tokens, inserts one hash-only replacement atomically, and leaves exactly one usable token under concurrency.
- **11.19 Hosted Staging Migration + Atomic Replacement Validation Gate — passed:** non-production staging is at `20260702000000`; two fresh disposable runs prove authorization, rollback, replacement, public use, TTL rejection, hash-only storage, concurrency safety, and zero residue.
- **11.20 Audited Response Link Reveal Boundary Planning — completed:** fail-closed server policy and a credential-free audit-event contract define the future reveal prerequisites; missing audit persistence keeps every current surface, copy UI, and delivery path blocked.
- **11.21 Response Link Reveal Audit Persistence — completed locally:** credential-free command-only audit storage and an authenticated `assignments.edit` RPC pass live RLS, scope, lifecycle, bounds, safe-shape, and cleanup checks; reveal remains blocked because no product surface coordinates replacement, audit, and credential response.
- **11.22 Hosted Staging Migration + Reveal Audit Validation Gate — passed:** non-production staging is at `20260703000000`; two disposable hosted runs prove table denial, Auth/capability and token lifecycle enforcement, metadata bounds, credential-free persistence, replacement compatibility, and zero residue. No product route or reveal/delivery surface was added.
- **11.23 Audited Product Reveal Server Action Contract — completed locally:** one transactional RPC now couples authorized replacement and audit before returning a bearer once; its trusted-origin server helper is unused by routes. Product-surface readiness remains false and hosted validation through `20260704000000` is pending.
- **11.24 Hosted Staging Migration + Audited Reveal Validation Gate — passed:** non-production staging is at `20260704000000`; two disposable hosted runs prove rollback, Auth/capability enforcement, atomic replacement/audit coupling, public use, concurrency, safe storage, compatibility, and zero residue. No product reveal surface was added.
- **11.25 Response Link Product Surface Readiness Review — completed:** planning/static policy selects a future persisted project-contact assignment-detail POST action and defines its no-store, trusted-origin, explicit-action, audit/logging, warning, expiry, and no-prefetch constraints. Availability remains false and no UI or route consumes reveal helpers.
- **11.26 Persisted Assignment Detail Context Readiness — completed locally:** authenticated `assignments.view` RPC/helper returns one safe active assignment projection, collapses edit to a boolean, reads no token/intake rows, and remains unused by routes. Product reveal stays false; hosted validation through `20260705000000` is pending.
- **11.27 Hosted Staging Migration + Assignment Detail Context Validation Gate — passed:** non-production staging is at `20260705000000`; two disposable hosted runs prove assignments-only safe reads, capability/workspace/lifecycle isolation, edit boolean, forbidden-field exclusion, route isolation, and zero residue. No reveal or product cutover was added.
- **11.28 Response Link Product Action Readiness Review — completed:** route-unused server policy defines the future assignment-detail POST action's inputs, sequence, success/failure, warning/expiry, no-prefetch, and logging constraints. Contract availability is true; implementation, UI, and reveal availability remain false.
- **11.29 Persisted Assignment Detail Route Surface Readiness Review — completed:** route-unused policy selects `/admin/assignments/[assignmentId]`, limits it to the authenticated `assignments.view` detail-context boundary, requires dynamic/no-store and uniform non-disclosing unavailable states, and keeps route implementation, navigation, action/UI, and reveal availability false.
- **11.30 Unlinked Persisted Assignment Detail Route Shell — completed:** one dynamic/no-store read-only route now consumes only the validated detail-context helper. It remains unlinked and has no mock fallback, token/reveal/action imports, copy UI, mutation, or delivery; only route implementation readiness changed to true.
- **11.31 Assignment Detail Route Visual/Behavior QA — completed:** a loopback-only disposable browser gate proves sign-in/success/unavailable behavior, safe fields, desktop/mobile overflow, and zero residue; it also caught and fixed the response timestamp formatter’s runtime-only failure. All action/UI/reveal/navigation flags remain fail closed.
- **11.32 Assignment Detail Product Action Server Boundary — completed:** route-unused server boundary validates assignment id plus bounded TTL, verifies persisted assignment-detail context and edit readiness before reveal, derives origin/mode/metadata server-side, and delegates to the audited reveal helper exactly once. Product action implementation/UI and reveal availability remain false; no route imports it.
- **11.33 Assignment Detail Product Action UI Readiness Review — completed:** route-unused policy defines the future warning/expiration/click/no-prefetch/no-auto-copy UI contract while keeping UI implementation, copy affordance, product-surface implementation, reveal availability, and navigation linkage false.
- **11.34 Assignment Detail Inert Product Action UI Shell — completed:** the unlinked persisted assignment-detail route now shows only an inert response-link readiness panel, with no form/action binding, enabled button, URL, token metadata, clipboard behavior, delivery, or navigation link.
- **11.35 Assignment Detail Action Wiring Readiness Review — completed:** route-unused policy defines future explicit POST/server-action wiring from the inert panel to the 11.32 boundary, including credential-free render, post-success-only URL/copy, no direct reveal/RPC/token route usage, and no secret-bearing logs/errors. Route wiring implementation remains false.
- **11.36 Assignment Detail Route Entry Readiness Review — completed:** route-unused policy defines future persisted authorized entry points from Calendar, Volunteers, Needs Attention, and Communications contexts while keeping public, diagnostic, mock, arbitrary-id, broad directory/search, and response-token surfaces ineligible. All entry/linkage flags remain false.
- **11.37 Assignment Detail Enablement Checklist Review — completed:** route-unused server-only checklist consolidates route, entry, action, UI, credential/log, browser-proof, and product-owner prerequisites. Active reveal, copy, entry-linking, product-action UI, product-surface, reveal, and navigation availability remain false; the current route imports none of these planning/policy modules.
- **11.38 Assignment Detail Disabled Action Adapter — completed:** route-unused server-only adapter accepts only assignment id plus optional bounded TTL, rejects forbidden browser fields, checks the 11.37 checklist, and keeps the 11.32 product-action boundary behind a false final-approval flag. It returns only credential-free disabled states today, and the current route imports no adapter/action/reveal helper.
- **11.39 Assignment Detail Disabled Adapter Unit Harness — completed:** preview-free `npm run test:assignment-detail-action-adapter` proves valid disabled/not-approved behavior, TTL bounds, malformed/forbidden input rejection, credential-free disabled results, false activation flags, and zero product-action boundary calls while final approval is false.
- **11.40 Assignment Detail Server-Action Shape Readiness Review — completed:** route-unused server-only policy defines a future explicit POST/server-action shape for `/admin/assignments/[assignmentId]` only, through the disabled adapter/reviewed successor only, with credential-free disabled/error states and all active implementation/reveal/copy/navigation flags still false.
- **11.41 Route-Unused Disabled Assignment Response Link Server Action Stub — completed:** executable server-action seam accepts only route-derived assignment id plus optional TTL FormData, delegates only to the disabled adapter, returns credential-free disabled states while final approval is false, and is covered by preview-free `npm run test:assignment-detail-server-action`.
- **11.42 Assignment Detail Disabled Route Wiring Readiness Review — completed:** route-unused policy permits only a future disabled `/admin/assignments/[assignmentId]` connection to the 11.41 stub and forbids direct adapter/product-action/reveal/RPC/token/replacement/diagnostic/service-role route calls.
- **11.43 Assignment Detail Disabled Route Wiring Implementation — completed:** the assignment-detail route now imports the 11.41 stub as its only response-link wiring import, but does not call it or bind it to a form/control. Disabled route-wiring/import flags are true; final approval, active reveal/copy, route server-action implementation, product-action UI, copy affordance, product surface, reveal availability, and navigation remain false.
- **11.44 Disabled Route Wiring Browser/Security Hardening Review — completed:** static and browser gates prove the inert route import is not called, passed, bound, hidden, or accompanied by form/submit/copy/URL/redirect/revalidation/cookie behavior, and that panel interactions do not submit, navigate, reveal, copy, or trigger response-link network traffic.
- **11.45 Disabled Route Action Binding Readiness Review — completed:** route-unused policy defines the future disabled action-binding contract while keeping implementation false: only the 11.41 stub may be the route callable seam, route assignment id must be server-derived, optional TTL must stay bounded, disabled/error states remain credential-free, and all active reveal/copy/product/navigation flags remain false.
- **11.46 Disabled Route Action Binding Implementation — completed:** the assignment-detail route now creates one route-derived disabled binding to the 11.41 stub after authorized context is available, but renders no form/action prop, hidden assignment id/TTL/action metadata, submit control, result, URL, or copy affordance. The stub is route-bound but still disabled by default, adapter-only, and credential-free; all active reveal/copy/product/navigation flags remain false.
- **11.47 Disabled Action Binding Security Regression Review — completed:** hardening/static/browser gates now prove the 11.46 binding remains exactly one route-derived disabled binding, is not browser-rendered as a form/action/hidden metadata path, stays unavailable in normal UI, and is absent from unavailable states. The operational docs and static checks now require redirected/redacted Supabase diagnostics and scan tracked files for actual-looking key/JWT/credentialed database URL material.
- **11.48 Disabled Action Result-State Contract Review — completed:** route-unused server-only policy defines the future disabled result renderer contract while keeping render implementation false. Any future result state is limited to the assignment-detail route, persisted `readAssignmentDetailContext` data, the 11.41 disabled server-action stub or reviewed successor, and credential-free disabled/error-like copy. Full/redacted URLs, token/audit ids, credentials/secrets, SQL/RPC details, sensitive intake, emergency contacts, questionnaire answers, raw grants/capabilities, stack traces, provider dumps, raw exceptions, copy/send/delivery implications, and hidden-token/existence leaks remain forbidden; active success and manual copy stay reserved for later reviewed slices.
- **11.49 Disabled Result Renderer Readiness Review — completed:** route-unused server-only policy defines a future disabled renderer that may consume only sanitized 11.48 state and fixed allowlisted copy keyed by safe state codes. It forbids raw action results, arbitrary errors, provider/Supabase/RPC exception payloads, stack traces, buttons, links, retry/reveal/download/open/send/copy affordances, generated URL fields, URL-shaped strings, `/respond/`, `[redacted]`, token/hash/audit/diagnostic identifiers, hidden metadata, and aria-live success announcements. Disabled/active/active-success renderer implementations and all active reveal/copy/product/navigation flags remain false.
- **11.50 Assignment Response Link Activation Checkpoint Review — completed:** server-only route-unused checkpoint inventories proven foundations, remaining blockers before active reveal, safe next options, and non-negotiables. It keeps `/admin/assignments/[assignmentId]` as the only reviewed future product reveal surface, requires dynamic/no-store persisted-context-only reads through `readAssignmentDetailContext`, preserves the 11.47 redirected/redacted diagnostic guardrail, and keeps activation approval, final approval, active reveal/copy, route server-action implementation, disabled/active/active-success renderer implementations, product UI/copy/product surface/reveal availability, entry/navigation linkage, delivery, public lookup, and remembered-device availability false.
- **12.1 MVP Real-Data Cutover Sequencing Review — completed:** server-only route-unused checkpoint pauses the response-link activation ladder and records the safe order for future real-data integration. It lists available persisted foundations, current mock-only prototype routes, non-negotiable cutover rules, and `12.2 Persisted Calendar Read Model Contract` as the next recommended slice. No route cutover, persisted route read, delivery, public lookup, remembered-device behavior, service-role path, seed data, hosted validation, or mock-to-real mixing was added.
- **12.2 Persisted Calendar Read Model Contract — completed:** server-only route-unused contract defines future Calendar period/list/detail read boundaries without cutting over `/admin/calendar`. It requires authenticated project-contact scope, explicit bounded date ranges, `calendar.view` for item shells, and the stricter current-safe `calendar.view` plus `assignments.view` rule for assignment-derived counts. Counts come from assignment/current-response rows, not item counters, assigned volunteer arrays, mock `filledCount`, or client calculations. No Calendar route query, UI behavior change, write action, assignment picker, assignment-detail link, delivery, public lookup, service-role path, seed data, hosted validation, response-link activation, or mock-to-real mixing was added.
- **12.3 Route-Unused Calendar Read Model Helper or Query-Shape Review — completed:** server-only route-unused helper/query-shape module adds pure input/range/timezone/capability guards, selector-plan description, assignment-derived coverage summarization, and safe row projection without app-route imports or live Supabase reads. Coverage-bearing output requires both `calendar.view` and `assignments.view`, fails closed without assignment visibility, derives counts from assignment/current-response rows, and does not project volunteer contact, questionnaire, token, audit, credential, raw grant/capability, SQL/RPC, provider dump, stack trace, raw exception, or unrelated row data.
- **12.4 Route-Unused Calendar Read Model Helper QA Harness — completed:** route-unused in-memory QA harness deepens coverage for the 12.3 helper without route imports, live Supabase calls, local disposable data, hosted validation, or Calendar UI changes. It proves strict input/range/capability guards, scoped assignment-derived coverage math, safe projection, pure filter/sort behavior, no mock-to-real mixing, false Calendar cutover/write/assignment-picker/detail-link/response-link/service-role/seed flags, and preservation of the 12.1 cutover plan plus 11.47/11.50 response-link safety guardrails.
- **12.5 Route-Unused Calendar Read Model Disposable Local Data Validation — completed:** local-only disposable `qa-12-5-*` harness validates real persisted row-shape compatibility for the route-unused helper without Calendar route imports, UI changes, hosted validation, service-role usage, or mock-to-real mixing. It refuses non-loopback Supabase, cleans fixtures with zero residue, proves strict `calendar.view` plus `assignments.view` behavior, validates assignment-derived coverage from local `calendar_assignments`/current `assignment_responses`, and keeps response-link activation paused after 11.50.
- **12.6 Route-Unused Calendar Read Model Query-Helper Readiness — completed:** server-only dependency-injected query helper prepares a future route seam without importing it into routes/components or cutting over `/admin/calendar`. It validates the existing 12.3 input/range/capability shape before reads, uses explicit allowlisted selectors for `calendar_items`, `task_presets`, `calendar_assignments`, and `assignment_responses`, creates no Supabase client, uses no service-role path, exposes no raw database rows/errors, extends disposable local validation through the same zero-residue fixture flow, and keeps response-link activation paused after 11.50.
- **12.7 Calendar Route Cutover Readiness Review — completed:** route-unused readiness policy defines future `/admin/calendar` persisted read cutover conditions without importing the policy or query helper into routes/components. It requires server-only dynamic/no-store reads, reviewed Auth/workspace/contact/capability/timezone derivation, explicit bounded period ranges, strict `calendar.view` plus `assignments.view` coverage authorization, single-truth-source mock-to-real rules, calm unavailable/empty/error states, browser/preview proof, rollback boundaries, and keeps route cutover, writes, assignment picker, assignment-detail links, delivery, public lookup, service-role usage, seed data, hosted validation, and response-link activation false.
- **12.8 Calendar Route Cutover Dry-Run Harness — completed:** route-unused dry-run module simulates the future `/admin/calendar` persisted read data path without importing it into routes/components. It uses injected client/context, trusted workspace/contact/grant/timezone values, server-derived bounded period ranges, strict `calendar.view` plus `assignments.view`, the 12.6 query helper, and safe 12.3 projection; fails closed before query for missing Auth/workspace/capability/range; extends local disposable validation with zero residue; and keeps route cutover, writes, assignment picker, assignment-detail links, delivery, public lookup, service-role usage, seed data, hosted validation, and response-link activation false.
- **12.9 Calendar Route Cutover Final Preflight — completed:** route-unused final preflight policy defines the exact go/no-go conditions for a later read-only `/admin/calendar` persisted read implementation slice. It records the candidate scope, required server route chain, future empty/unavailable/error state contract, UI preservation requirements, safe mapping allowlist, unsafe field denylist, mock-to-real boundary, rollback requirements, and keeps route cutover, writes, assignment picker, assignment-detail links, delivery, public lookup, service-role usage, seed data, hosted validation, production data validation, and response-link activation false.
- **12.10 Calendar Route Cutover Empty/Unavailable State Prototype — completed:** route-unused state prototype defines future user-facing route states for ready with items, ready empty, unavailable, and error without importing it into `/admin/calendar`. Empty is not failure, unavailable is distinct from unexpected error, and all states preserve the Calendar shell/controls where safe while forbidding mock fallback, mock/persisted mixing, raw diagnostics, unsafe fields, route cutover, writes, assignment picker, assignment-detail links, delivery, public lookup, service-role usage, seed data, hosted validation, production data validation, and response-link activation.
- **Later communications/reminder persistence readiness:** drafts, delivery boundary, token issuance/revocation, and provider decision.

The non-production migration and live token/RLS prerequisite is satisfied, but it does not authorize or implement route integration. `project-local-staging` is validation-only, not real Belgrade production data. Communications persistence, email/reminder delivery, Needs Attention persistence, remembered devices, public lookup, and broad route cutovers remain separate later slices.

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
