# Calendar Data-Model Readiness

This note records the production boundary behind the current mock Calendar. Iterations 11.9–11.10 implement isolated Calendar item, assignment, and current-response schemas/server commands, while every Calendar and volunteer route remains local, preview-only UI.

## Canonical product alignment (2026-07-05)

[`PROJECT_LOCAL_PRODUCT_REQUIREMENTS.md`](./PROJECT_LOCAL_PRODUCT_REQUIREMENTS.md) now controls future product behavior where older sketches differ. The Calendar remains the primary scheduling surface, and one unified scheduled-item concept covers volunteer tasks, crew blocks, Security, food-support work, informational blocks, and custom one-offs. The schedule kinds below are temporal representations within that concept, not separate task/event models.

Every created item has explicit Calendar placement: timed work has date/start/end, while date-based context has an explicit date or range. Draft means saved private/unpublished, never floating or unscheduled. There is no V1 draft tray; unscheduled ideas remain task templates.

Needed count is non-negative and may be zero. Use `0/0 assigned` for informational items and **assigned** language everywhere; do not use “spots.” Pending plus confirmed assignments form the active assigned count, while denied/removed assignments do not. Every item also needs a Follow-up Contact, inherited from its template when available and otherwise defaulted to its creator.

Meals/Breakfast/Lunch are special Calendar-owned entries in the unified model, not a permanent Food mini-app or a Lunch-only system-preset assumption. Their detailed schema remains future work. Current migrations and mock routes are unchanged by this planning alignment.

## 12.2 Persisted Calendar Read Model Contract

Iteration 12.2 adds a server-only, route-unused persisted Calendar read model contract in `lib/calendar/readModelContract.server.ts`. It is not a query implementation, not a Calendar route cutover, not UI integration, not a write command, not an assignment picker, not delivery, and not response-link activation.

The future read model is scoped to authenticated project contacts inside one workspace. It requires explicit capability checks, explicit bounded date ranges, workspace timezone behavior, and no anonymous read, service-role path, seed data, mock fallback, or broad raw table exposure. The contract is suitable for future Day, Week, Month, and List read data, but `/admin/calendar` remains deterministic mock UI after this slice.

Calendar item shells require `calendar.view`. Assignment-derived coverage counts use the stricter current-safe rule requiring both `calendar.view` and `assignments.view` until a later permissions review relaxes that rule. Broad volunteer labels/contact values are not part of the Calendar list read model.

Coverage truth must be derived from `calendar_assignments` and current `assignment_responses`, not Calendar item counters, mock `filledCount`, assigned volunteer id arrays, or client-calculated coverage. The contract defines assigned, confirmed, denied, unassigned, waiting-on-confirmation, has-denied, all-assigned-helpers-denied, coverage-state, and assigned-fraction values. Pending/`needs_response` plus confirmed assignments count toward assigned count; denied and removed assignments do not. Zero-needed informational items use `0/0 assigned`.

`multi_day_window` and `milestone` items default to zero-needed/non-assignable unless a later reviewed child-occurrence model exists. Aggregate volunteer count on a multi-day window remains forbidden for now.

Future Calendar inspectors must stay inside the same read-model boundary and must not expose response-link URLs, public tokens, verifiers, token ids, audit ids, questionnaire answers, emergency contact details, raw grant/capability arrays, unrelated volunteer rows, broad assignment directories, helper contact values, or assignment-detail route links unless a later slice separately reviews those surfaces.

Mock-to-real rules remain strict: one route may not silently combine mock and persisted Calendar items, a route may not read persisted Calendar data and fall back to mock data in the same user-facing truth source, and the existing mock Calendar regression remains the product UI behavior reference until a separate cutover slice.

## 12.3 Route-Unused Calendar Read Model Helper

Iteration 12.3 adds `lib/calendar/readModel.server.ts` as a server-only, route-unused helper/query-shape module. It is not a live product query, not a Calendar route cutover, not UI integration, not a mutation boundary, not an assignment picker, not delivery, and not response-link activation.

The helper normalizes the future read input shape: workspace id, actor/contact id, explicit start/end date range, trusted workspace timezone, period kind, optional safe filters, and capabilities. It rejects invalid dates, end-before-start ranges, ranges broader than the bounded guard, invalid timezones, and missing/invalid caller scope. There is no unbounded workspace-wide Calendar read shape.

The main coverage-bearing query shape requires `calendar.view` and `assignments.view`. Missing `calendar.view` fails before item shell projection, and missing `assignments.view` fails closed instead of producing misleading zero coverage. This preserves the 12.2 stricter current-safe capability rule.

The query-shape plan names only safe future sources: Calendar item shell rows, optional task-preset label/type data, and assignment/current-response aggregate rows. It explicitly forbids volunteer contact rows, questionnaire answers, emergency contacts, response-token rows, reveal/audit rows, broad grant/capability arrays, and unrelated workspace rows.

The pure coverage function follows the contract rules: active `needs_response` plus `confirmed` assignments count toward assigned count; active denied/declined assignments count toward denied but not assigned; removed/canceled/archived assignments do not count toward assigned; unassigned count never drops below zero; zero-needed informational items use `0/0 assigned`; and multi-day windows/milestones remain non-assignable until a later child-occurrence model is reviewed.

The row mapper projects only safe Calendar read-model fields and does not carry volunteer contact values, emergency contact details, questionnaire answers, response URLs, bearer/verifier/token/audit ids, credentials, SQL/RPC details, raw grants/capability arrays, provider dumps, stack traces, raw exception messages, or unrelated rows.

## 12.4 Route-Unused Calendar Read Model Helper QA Harness

Iteration 12.4 adds `scripts/calendar-read-model-helper-qa-regression.mjs` and `npm run test:calendar-read-model-helper:qa` as a focused QA harness for the 12.3 helper. It is not a Calendar route cutover, not UI integration, not live product query integration, not local disposable database validation, not hosted validation, not Calendar mutation, not an assignment picker, not delivery, and not response-link activation.

The harness uses in-memory database-shaped fixtures only. It proves `lib/calendar/readModel.server.ts` remains server-only, route-unused, unimported by app routes/components, and free of Supabase client creation, `.from`, `.rpc`, service-role/config paths, mock Calendar data imports, response-token/reveal/product-action imports, and app-route loaders.

The QA coverage exercises the helper's workspace/contact/timezone/date-range/capability guard behavior, including invalid dates, end-before-start ranges, broader-than-bounded ranges, rejected unknown filter values, and the strict `calendar.view` plus `assignments.view` rule for coverage-bearing output. Role/title strings alone still do not imply read authority.

Coverage QA uses scoped in-memory assignment/current-response rows and proves `needs_response` plus `confirmed` count toward assigned, denied/declined count toward denied but not assigned, removed/canceled/archived rows do not count, other-workspace and other-calendar-item rows do not bleed into an item summary, unassigned never drops below zero, zero-needed informational items remain `0/0 assigned`, and multi-day windows/milestones remain non-assignable. The helper also exposes a pure route-unused filter/sort helper so task-name, type, coverage, lifecycle, and stable date/kind/time/label/id ordering can be checked without touching `/admin/calendar`.

The QA harness keeps `/admin/calendar` mock-only and behaviorally unchanged. It proves no route mixes mock Calendar data with persisted Calendar truth, no route links to `/admin/assignments/[assignmentId]`, no Calendar writes, assignment picker, assignment mutation, delivery, public lookup, remembered-device behavior, seed data, service-role usage, local disposable DB validation, hosted validation, response-link activation, or mock-to-real mixing was added. If 12.4 remains clean, the recommended next slice is `12.5 Route-Unused Calendar Read Model Disposable Local Data Validation`; otherwise revise 12.4 first.

## 12.5 Route-Unused Calendar Read Model Disposable Local Data Validation

Iteration 12.5 adds `scripts/calendar-read-model-local-data-validation.mjs` and `npm run test:calendar-read-model:local` as local-only validation for the route-unused read model helper. It is not a Calendar route cutover, not UI integration, not hosted validation, not production data validation, not Calendar mutation, not an assignment picker, not delivery, and not response-link activation.

The validation harness refuses non-loopback Supabase URLs and uses disposable `qa-12-5-*` local fixtures only. It creates a local workspace, project-contact grants, task presets, timed/date-based/multi-day/milestone/one-off Calendar items, volunteer profiles, assignments, and current responses, then translates the real local row shapes into the existing pure helper inputs. The helper remains server-only, route-unused, and unimported by `/admin/calendar` or any app route/component.

Local validation proves the stricter current-safe capability rule against persisted grant rows: `calendar.view` plus `assignments.view` is required for coverage-bearing read models; missing `calendar.view` fails before item shells; missing `assignments.view` fails before assignment-derived coverage; and role/title strings alone do not authorize projection.

Coverage validation proves real local `calendar_assignments` and current `assignment_responses` rows drive assigned, confirmed, denied, waiting, unassigned, and assigned-fraction values. `needs_response` and `confirmed` count toward assigned; `declined` counts toward denied but not assigned; canceled rows do not count; wrong-workspace and wrong-calendar-item rows do not bleed; zero-needed informational items remain `0/0 assigned`; and multi-day windows/milestones remain non-assignable.

Safe projection validation proves output excludes volunteer contact values, emergency contacts, questionnaire answers, public/redacted response URLs, bearer/verifier/token/audit ids, credentials, SQL/RPC details, raw grants/capabilities, unrelated rows, provider dumps, stack traces, and raw exceptions. Cleanup runs in `finally` and verifies zero residue for the local fixture namespace. If 12.5 remains clean, the recommended next slice is `12.6 Route-Unused Calendar Read Model Query Helper Readiness`; otherwise revise 12.5 first.

## 12.6 Route-Unused Calendar Read Model Query-Helper Readiness

Iteration 12.6 adds `lib/calendar/readModelQuery.server.ts` and `npm run test:calendar-read-model-query-helper` as a server-only, route-unused query-helper readiness seam. It is not a Calendar route cutover, not UI integration, not hosted validation, not production data validation, not Calendar mutation, not an assignment picker, not delivery, and not response-link activation.

The query helper is dependency-injected. It accepts a reviewed Supabase-like client from a future server boundary but does not create a Supabase client, import `lib/supabase/server.ts`, read cookies, read route params, import from `app/`, use service-role credentials, or expose a product route loader/React hook/client helper. No app route/component imports it, and `/admin/calendar` remains mock-only.

The helper reuses the 12.3 normalization, bounded date-range, filter, capability, coverage, and projection helpers. It validates `workspaceId`, `actorContactId`, trusted workspace timezone, explicit `rangeStart`/`rangeEnd`, period kind, filters, and the strict `calendar.view` plus `assignments.view` coverage rule before any injected client read. Missing `calendar.view`, missing `assignments.view`, invalid dates, end-before-start, and broader-than-bounded ranges fail closed before reads.

The only allowed table concepts are `calendar_items`, `task_presets`, `calendar_assignments`, and `assignment_responses`. Every selector is explicit; no `select("*")` is used. The helper does not query volunteer profiles/contact values, questionnaire submissions, emergency contact data, response-token tables, reveal/audit tables, project contacts/grants, auth/storage tables, diagnostics, broad assignment directories, or raw capability arrays.

The helper translates persisted rows into the existing safe read-model row inputs and returns only safe Calendar read-model fields: Calendar item id, stable display reference, task/source label, display type, schedule kind, date/range/time fields, timezone, needed count, lifecycle/publication state, safe schedule notes, task-preset or one-off labels, assignment-derived coverage summary, and assigned-fraction label. It does not return raw database rows or raw Supabase errors.

`npm run test:calendar-read-model:local` now also exercises the query helper against the same disposable local `qa-12-5-*` fixture flow. The local harness proves real local `calendar_assignments` and current `assignment_responses` row shapes drive coverage through the query seam, missing assignment visibility still fails closed, wrong-workspace/wrong-item rows do not bleed, unsafe fields are not projected, and cleanup still verifies zero residue.

If 12.6 remains clean, the recommended next slice is `12.7 Calendar Route Cutover Readiness Review`. That should still be a readiness/review slice defining route entry conditions, unavailable/empty states, browser proof, and rollback boundaries before any actual `/admin/calendar` persisted-data cutover.

## 12.7 Calendar Route Cutover Readiness Review

Iteration 12.7 adds `lib/calendar/routeCutoverReadiness.server.ts` and `npm run test:calendar-route-cutover-readiness` as route-unused planning/static guardrails for a later `/admin/calendar` persisted read cutover. It is not a route cutover implementation, not UI integration, not hosted validation, not production data validation, not Calendar mutation, not an assignment picker, not delivery, and not response-link activation.

The readiness contract names `/admin/calendar` as the only eligible route for this specific future read cutover. When connected to persisted data later, the route must remain dynamic/no-store, execute persisted reads only from a server boundary, derive workspace/contact/capability/timezone context from reviewed authenticated server helpers, and call only reviewed server-only Calendar read seams. It may not create a browser Supabase client for Calendar product data, trust browser-provided workspace ids/capabilities/actor ids/selectors, call `.from` or `.rpc` directly, use service-role credentials, query broad tables, render raw errors, or expose secrets/internal policy details.

The required future data path is: verified project-contact session, active workspace/contact grant resolution, explicit `calendar.view`, explicit `assignments.view` for coverage-bearing output, trusted workspace id, trusted contact/actor id, trusted workspace timezone, server-derived bounded Day/Week/Month/List date range, the 12.6 dependency-injected query helper or reviewed successor, and the 12.3 pure read-model projection or reviewed successor.

The route-readiness rules keep the mock-to-real boundary strict. A future route may not silently combine mock Calendar items with persisted Calendar items, may not read persisted data and fall back to mock data in the same user-facing truth source, and must have one truth source per execution path. Existing mock Calendar regression remains the UI behavior reference until an actual cutover succeeds. Mock `filledCount`, assigned volunteer id arrays, deterministic colors, and local creation drafts are not production truth.

Future unavailable, empty, and error states must cover unauthenticated, unauthorized/no workspace access, missing `calendar.view`, missing `assignments.view`, no items in range, local configuration issues, query helper safe failures, invalid period/range, and inactive/archived workspace contexts where applicable. These states must be calm and non-disclosing, must not render raw database/provider errors or stack traces, must not reveal unrelated workspace/project/volunteer existence, and must not fall back to mock data unless the route remains explicitly mock-only.

The later cutover must be read-only first. Calendar create/edit/archive/delete persistence, draft saving, drag/drop/resize/copy/repeat persistence, assignment picker/create/cancel, Calendar assignment response mutation, assignment-detail entry links, response-link generation, copy UI, delivery, public lookup, remembered devices, seed data, and service-role usage remain blocked.

Browser proof for a later actual cutover must show desktop and 390px mobile Calendar safety, Day/Week/Month/List switching, filter behavior, non-stacking creation/inspector surfaces, calm empty and unavailable persisted states, no mock/persisted mix, no raw ids/capabilities/errors/secrets, no response-link or assignment-detail entry behavior, no unexpected response-token/reveal/diagnostic/write network calls, and redirected/redacted preview logs.

If 12.7 remains clean, the recommended next slice is `12.8 Calendar Route Cutover Dry-Run Harness`. That dry-run should still avoid changing `/admin/calendar` behavior while proving the future route entry conditions, state rendering expectations, browser preview setup, and rollback boundary are practical before any persisted-data route integration.

## 12.8 Calendar Route Cutover Dry-Run Harness

Iteration 12.8 adds `lib/calendar/routeCutoverDryRun.server.ts` and `npm run test:calendar-route-cutover-dry-run` as a route-unused dry-run harness for the future `/admin/calendar` persisted read path. It is not a route cutover implementation, not UI integration, not hosted validation, not production data validation, not Calendar mutation, not an assignment picker, not delivery, and not response-link activation.

The dry-run accepts only dependency-injected inputs: an injected Supabase-like client, trusted workspace/contact/grant context, trusted workspace timezone, a requested Day/Week/Month/List period, an anchor date, optional safe filters, and explicit `dryRun` execution mode. It does not create a Supabase client, import `lib/supabase/server.ts`, read cookies or route params, import from `app/`, render JSX, return React components, call product routes, call `.from` directly, call `.rpc`, use service-role credentials, read hosted/production data, expose raw rows, or expose raw errors.

The dry-run models the future server-side route chain: verified project-contact session, resolved workspace/contact/grant context, trusted workspace id, trusted actor/contact id, trusted workspace timezone, explicit reviewed capabilities, server-derived bounded period range, the 12.6 dependency-injected query helper, and the 12.3 pure read-model projection. It does not trust browser-provided workspace ids, actor ids, capability arrays, timezones, selectors, table names, raw ranges, or Supabase configuration.

The route-unused range helper derives bounded dry-run ranges for Day, Week, Month, and List. Day uses the selected local date as a bounded one-day dry-run range, Week uses the visible Monday-start week, Month uses the bounded calendar month, and List uses a bounded 42-day range. Invalid dates, invalid timezones, unsupported periods, end-before-start, and broader-than-policy ranges fail closed before query.

Dry-run state output is deliberately small and safe: `ready`, `empty`, `unauthenticated`, `unauthorized`, `missing-calendar-view`, `missing-assignments-view`, `invalid-range`, `workspace-unavailable`, `query-unavailable`, or `safe-error`. Successful dry-run output may include safe projected read-model items and summary counts, but never raw grants/capabilities, raw Supabase errors, provider dumps, stack traces, SQL/RPC detail, response links, tokens, volunteer contact details, questionnaire answers, emergency contact values, or unrelated row data.

The existing disposable local validation now also exercises the dry-run against local persisted row shapes and keeps zero-residue cleanup. It proves `needs_response` plus confirmed assignments count toward assigned, declined/denied and canceled/removed rows do not count toward assigned, wrong-workspace/wrong-item rows do not bleed, zero-needed informational items remain `0/0 assigned`, and Calendar counters/mock `filledCount`/assigned volunteer arrays are not production truth.

If 12.8 remains clean, the recommended next slice is `12.9 Calendar Route Cutover Final Preflight`; otherwise revise 12.8 first. Do not implement `/admin/calendar` persisted reads until that preflight explicitly confirms the remaining route state, browser, and rollback boundaries.

## 12.9 Calendar Route Cutover Final Preflight

Iteration 12.9 adds `lib/calendar/routeCutoverFinalPreflight.server.ts` and `npm run test:calendar-route-cutover-final-preflight` as a server-only, route-unused final preflight for a later `/admin/calendar` persisted read implementation slice. It is not a route cutover implementation, not UI integration, not hosted validation, not production data validation, not Calendar mutation, not an assignment picker, not delivery, and not response-link activation.

The preflight answers only whether a later reviewed implementation can be small, read-only, reversible, and covered by the existing dry-run/browser/static guardrails. The only candidate scope is `/admin/calendar` persisted read-only display items. Calendar writes, assignment mutations, assignment picker, assignment-detail links, response-link activation, delivery, public volunteer lookup, remembered devices, seed data, service-role usage, hosted validation, production data validation, and mock-to-real mixing remain blocked.

The required future implementation path is: dynamic/no-store `/admin/calendar` server boundary, verified project-contact session, reviewed workspace/contact/grant resolution, trusted workspace id, trusted actor/contact id, trusted workspace timezone, explicit `calendar.view`, explicit `assignments.view` for coverage-bearing output, server-derived bounded period range, 12.8 dry-run-equivalent state contract, the 12.6 dependency-injected query helper or reviewed successor, the 12.3 safe projection helper or reviewed successor, and one user-facing truth source per route execution.

The go/no-go checklist requires local disposable validation, dry-run harness, route cutover readiness, query-helper regression, Calendar browser regression, assignment-detail/response-link guardrails, no migration/type change requirement, hosted validation only if DB/RPC/type/hosted behavior changes, rollback path, empty/unavailable states, route import plan, mock-to-real non-mixing rule, safe error rendering rule, and preview/browser proof.

The future route state contract must cover unauthenticated, unauthorized/no workspace access, missing `calendar.view`, missing `assignments.view`, invalid period/range, workspace unavailable/inactive/archived where applicable, query unavailable/safe error, empty range/no Calendar items, and ready with projected Calendar items. These states must remain calm, non-disclosing, credential-free, not raw-provider-error based, not stack-trace based, not mock fallback states, and not mixed with persisted partial data.

The UI preservation contract requires Day/Week/Month/List controls, filters, inspector behavior, preview-only creation, mobile More/Filter/Create/Inspect stacking safety, desktop and 390px overflow safety, compact task-name plus assigned-fraction blocks, calm empty/unavailable states, and no raw ids/capabilities/errors/secrets. Safe mapping remains limited to Calendar item/display reference, task/source label, display type/category, schedule kind, date/range/time fields, timezone, needed count, lifecycle/publication state, safe schedule notes, task preset or one-off labels, assignment-derived coverage summary, and assigned-fraction label.

The future route must not map volunteer contact values, emergency contacts, questionnaire answers, response URLs, bearer/verifier/token/audit ids, access/refresh tokens, passwords, API keys, service-role keys, SQL/RPC detail, raw grants/capability arrays, unrelated rows, provider dumps, stack traces, or raw exception messages. Mock `filledCount`, assigned volunteer id arrays, deterministic mock colors, and mock Calendar item data remain non-production truth.

If 12.9 remains clean, the recommended next slice is `12.10 Calendar Route Cutover Empty/Unavailable State Prototype`; otherwise revise 12.9 first. Do not implement `/admin/calendar` persisted reads until the future empty/unavailable state prototype proves the user-facing state boundary without mixing persisted and mock truth.

## 12.10 Calendar Route Cutover Empty/Unavailable State Prototype

Iteration 12.10 adds `lib/calendar/routeCutoverStatePrototype.server.ts` and `npm run test:calendar-route-cutover-state-prototype` as a server-only, route-unused UI-state prototype for the future `/admin/calendar` persisted read cutover. It is not the actual Calendar route cutover, not UI integration into `/admin/calendar`, not a product route loader, not a live product query, not hosted validation, not Calendar mutation, not an assignment picker, not delivery, and not response-link activation.

The prototype defines four explicit future route states:

- `ready_with_items`: a successful authorized persisted read with one or more projected Calendar items. The future route should continue rendering the normal Day, Week, Month, and List Calendar experience with minimal event blocks.
- `ready_empty`: a successful authorized persisted read with zero Calendar items in the selected bounded range. Empty is not unavailable and not an error. The future route should preserve the Calendar shell, view controls, date navigation, filters, and preview-only creation behavior while showing calm copy that there are no scheduled items in the selected range.
- `unavailable`: an intentional fail-closed prerequisite state for missing or unavailable server-side access/workspace/capability/range conditions. It remains distinct from unexpected errors and must not expose raw Auth, grant, workspace, Supabase, SQL, RPC, policy, or capability details.
- `error`: an unexpected persisted-read failure after prerequisites were satisfied. It remains distinct from unavailable and must render only generic, non-technical, credential-free copy.

Every state prohibits silent mock fallback, mock/persisted mixing, raw internal diagnostics, raw provider errors, stack traces, table/policy/query details, tokens, response URLs, volunteer contact values, questionnaire answers, emergency contact values, and unrelated row data. Empty/unavailable/error handling is required to fit inside the existing Calendar page rather than replacing it with an unrelated full-page design.

`/admin/calendar` remains mock-backed and behaviorally unchanged after 12.10. The 12.6 query helper, 12.8 dry-run harness, 12.9 final preflight, and 12.10 state prototype all remain route-unused. Response-link activation remains paused after 11.50.

If 12.10 remains clean, the recommended next slice is `12.11 Calendar Persisted Read Route Cutover Implementation`, limited to a narrow read-only route cutover that uses the existing static/dry-run/browser guardrails. If 12.10 reveals any readiness issue, revise the state prototype before touching the route.

## 12.11 Calendar Persisted Read Route Cutover Implementation

Iteration 12.11 performs the first actual `/admin/calendar` persisted-read cutover. The route now reads persisted Calendar display items through a server-owned, dynamic/no-store route boundary instead of using mock Calendar items as its user-facing item truth source. This is a read cutover only: no Calendar writes, assignment picker/mutations, assignment-detail entry links, response-link activation, copy UI, delivery, public lookup, remembered devices, service-role usage, seed data, hosted validation, production data validation, generated type change, migration, or mock/persisted mixing was added.

The implementation preserves the reviewed 12.7-12.10 route chain. `/admin/calendar` derives a verified project-contact session, authenticated contact id, active workspace/grant context, trusted workspace timezone, and explicit capabilities server-side. Coverage-bearing output still requires both `calendar.view` and `assignments.view`. The route uses a bounded initial Calendar read range and calls the 12.6 dependency-injected query helper only through `lib/calendar/routeRead.server.ts`; it does not create a Supabase client in a Client Component, trust browser-provided workspace/capability values, call `.from` or `.rpc` in the route, use service-role credentials, or render raw database/provider errors.

The existing Calendar UI was moved behind `components/CalendarClient.tsx` and continues to provide Day, Week, Month, List, date navigation, filters, inspector behavior, mobile behavior, and preview-only creation controls. Persisted read-model items are mapped into a narrow safe presentation shape: Calendar id/date/time labels, task/source label, type/category, schedule kind, timezone, needed count, lifecycle/publication state, safe notes, task preset/one-off labels, assignment-derived coverage, and assigned-fraction labels. The route does not map volunteer contact values, emergency contacts, questionnaire answers, response URLs, bearer/verifier/token/audit ids, access/refresh tokens, passwords, API keys, service-role keys, SQL/RPC detail, raw grants/capabilities, unrelated rows, provider dumps, stack traces, or raw exception messages.

The four reviewed route states are implemented:

- `ready_with_items`: authorized persisted read with one or more safe Calendar items rendered in the existing Calendar shell.
- `ready_empty`: authorized successful zero-item range with calm “no scheduled items in this range” treatment, not unavailable and not error.
- `unavailable`: fail-closed prerequisite/workspace/contact/grant/capability state with non-disclosing user copy.
- `error`: unexpected safe failure after prerequisites, kept distinct from unavailable and rendered without raw diagnostics.

Mock-to-real boundaries remain strict. `/admin/calendar` does not combine persisted items with mock Calendar items and does not fall back to mock items on empty/unavailable/error. Assignment-derived counts remain based on `calendar_assignments` and current `assignment_responses`; Calendar item counters, mock `filledCount`, assigned volunteer arrays, deterministic mock colors, and client-side mock counters remain non-production truth.

`npm run test:calendar-route-cutover` proves the route read adapter, state mapping, no direct broad route query, no `select("*")`, no mock fallback/mixing, false write/picker/detail-linking/response-link/service-role/seed flags, and response-link pause. The Calendar browser regression now creates disposable local persisted fixtures, authenticates project contacts, verifies persisted success/empty/unavailable states, Day/Week/Month/List interactions, filters, inspector behavior, 390px layout, no unsafe leakage, no mock Calendar item leakage, and cleanup.

Hosted validation is not required because no migration, generated type, RPC, hosted script, hosted behavior, or production-data behavior changed. The rollback path is small and reversible: remove the route read adapter integration and restore the prior mock item source rather than weakening Auth, capability, query-helper, projection, or safe-state rules.

Recommended next slice was `12.12 Calendar Persisted Read Cutover Stabilization`, still read-only. Do not move into Calendar writes, assignment picker/mutations, delivery, public lookup, remembered devices, response-link activation, or other route cutovers until the first persisted read cutover remains clean.

## 12.12 Calendar Persisted Read Cutover Stabilization

Iteration 12.12 stabilizes the first actual `/admin/calendar` persisted-read cutover without adding new product behavior. The route remains read-only, dynamic/no-store, server-owned, and persisted-item-backed. No Calendar create/edit/archive/delete persistence, assignment picker, assignment mutation, assignment-detail entry link, response-link activation, copy UI, delivery, public lookup, remembered-device behavior, service-role usage, seed data, hosted validation, production data validation, generated type change, migration, Tasks/Volunteers/Public Volunteer/Communications cutover, or mock/persisted mixing was added.

The main stabilization closes the false-empty risk from combining a bounded server read with client-only date navigation. Calendar view/date changes now use validated `view` and `date` query parameters and a server-derived bounded range for Day, Week, Month, and List. The client no longer advances to an unqueried period locally; each navigation requests a new persisted read. `ready_empty` therefore means a real successful authorized read returned zero items for the selected bounded range, not that the user navigated outside a previously loaded horizon.

Workspace selection is now deterministic and contact-scoped. The route resolves the authenticated project contact, filters grants to that actual contact, ignores revoked/expired/inactive grants, unions capabilities only within the same active workspace for that same contact, and requires exactly one eligible workspace with both `calendar.view` and `assignments.view`. A contact cannot borrow another contact's capabilities in the same workspace, cannot borrow a capability from another workspace grant, and multiple eligible workspaces fail closed rather than selecting an arbitrary first workspace. Role/title strings remain non-authorizing.

The strict coverage rule is unchanged: `calendar.view` is required for Calendar item shells and `assignments.view` is also required for the current coverage-bearing read model. Missing `assignments.view` does not produce misleading zero coverage. Assignment-derived counts remain based on `calendar_assignments` and current `assignment_responses`, not Calendar item counters, assigned-volunteer arrays, mock `filledCount`, or client calculations.

The existing Calendar UI structure is preserved. Day/Week/Month/List, date navigation, filters, inspector behavior, mobile interactions, keyboard behavior, and preview-only creation surfaces remain the same except that navigation now refreshes the route through the bounded server read seam. Preview-only creation remains non-persistent and does not authorize writes. Local/browser validation now includes a real empty queried period, a real persisted item in a later navigated period, a same-workspace under-capability contact, wrong-workspace rows, and zero-residue cleanup.

Recommended next slice: if 12.12 validation remains clean, `12.13 Persisted Tasks Read Model Contract` is a safe next step in the MVP cutover sequence. If any range/navigation or workspace-selection issue remains, do a narrow Calendar read-cutover stabilization follow-up before broader route cutovers or any Calendar write work.

## 12.16 Calendar Create/Edit Scheduled Item Implementation

Iteration 12.16 adds the first narrow persisted Calendar write path while preserving the 12.11/12.12 read architecture. `/admin/calendar` remains dynamic/no-store, server-owned, bounded by server-derived Day/Week/Month/List ranges, workspace/contact scoped, and free of mock/persisted Calendar item mixing.

The supported create/edit surface is one-off timed scheduled items only. The route does not persist mock task presets, fake preset ids, all-day/date-based authoring, multi-day windows, milestones, recurrence, drag/drop, resize, copy, archive/delete, assignment selection, publication, email, reminders, response links, public lookup, remembered devices, or seed data. Existing historical persisted items of other readable schedule kinds remain readable.

12.16 adds `calendar_items.follow_up_project_contact_id` as a real project-contact relationship for Follow-up Contact. New creates derive this value from the authenticated scheduler server-side; the browser cannot forge it. Existing rows are preserved because the column is nullable until a reviewed backfill exists. Edits preserve the current legitimate Follow-up Contact rather than replacing it with the editor.

The migration also changes timed/date-based needed count validation to allow `0..99`, preserving `0/0 assigned` informational behavior. Assignment rows and current responses remain the only staffing/coverage truth; no Calendar item counters, mock `filledCount`, or assigned-volunteer arrays were added.

Create uses the reviewed Calendar server boundary and `create_calendar_item` RPC with server-derived authenticated project-contact/workspace/capability context and effective `calendar.edit`. Edit uses the new allowlisted `update_calendar_item_one_off_timed` RPC and validates the same narrow field set: title, high-level one-off task type, date, start time, end time, needed count, notes, and empty custom values. Protected provenance, workspace, assignment truth, lifecycle, and Follow-up Contact are not browser-controlled.

Local validation uses `npm run test:calendar-item-management` for disposable database proof and `npm run test:calendar` for production-preview browser proof, including create -> reload -> edit -> reload.

12.16.1 completes the required hosted non-production validation for this boundary. `npm run test:calendar-item-management:hosted` is locked to `project-local-staging` (`kfuujcfxoayukywvtaeh`) by `RUN_HOSTED_CALENDAR_ITEM_MANAGEMENT_VALIDATION=project-local-staging:kfuujcfxoayukywvtaeh`. The gate advanced staging from `20260714121500` to `20260714121600`, proved hosted generated public-schema type parity, validated one-off timed create/edit, server-derived Follow-up Contact, needed-count `0` and `0/0 assigned` read-model behavior, protected-field preservation, view-only and missing-`calendar.edit` denial, cross-contact/cross-workspace isolation, revoked/expired/inactive grant failure, role/title non-authorization, direct table-write denial, malformed schedule/source rejection, fake preset rejection, existing preset-backed source compatibility, legacy nullable Follow-up Contact compatibility, safe output, and exact-run plus namespace zero residue. No product/runtime route change, extra migration, service-role application path, real data, or Calendar feature expansion was added by the hosted gate.

## Iteration 11.9 persisted boundary

`public.calendar_items` implements only scheduled/project-context item identity, task source snapshots, schedule values, planned needed count, notes/custom values, lifecycle, and timestamps. `calendar.view` gates authenticated reads; `calendar.edit` gates authenticated create/archive commands. A same-workspace composite foreign key prevents a preset from another workspace being referenced, and one-off creation never creates a reusable preset.

The persisted model uses local project dates/times plus a timezone copied from and constrained to the workspace. `timed` currently means a same-date interval with `end_time > start_time`; overnight work is rejected until a future unambiguous instant/end-date model is reviewed. `date_based` uses one date and no times. `multi_day_window` uses an inclusive start/end range with `end_date > start_date`, no times, and zero needed count. `milestone` uses one date, no times, and zero needed count.

Iteration 11.9 itself did not implement assignment truth; 11.10 adds that separate boundary without changing Calendar item rows. Neither slice implements authoritative coverage counters, recurrence/copy behavior, general Calendar edits, drag/drop saves, route reads, or UI conversion from the mock compatibility model. The contract sketch below remains guidance for later extensions where it differs from the implemented boundary.

## Core boundaries

| Concept | Responsibility | Production direction |
| --- | --- | --- |
| Creation draft | Temporary form values, validation, suggested date/time context, and panel state | Keep client-local until an explicit create action exists. Do not persist launcher labels or validation UI state. |
| Task preset | Reusable work definition and defaults | Store workspace scope, name, category, default needed count, system-preset identity, and custom-field definitions. Do not store schedule placement or assignments. |
| Calendar item | One scheduled occurrence | Reference one task preset or contain one deliberate one-off task snapshot, plus workspace scope, schedule, needed count, schedule notes, and structured source metadata. |
| Assignment | Relationship between a calendar item and a volunteer/helper | Make assignment rows the source of truth for responses and coverage. Derive filled/confirmed/denied counts instead of storing volunteer id arrays and counters on the item. |

The current `CalendarCreationDraft` in `app/admin/calendar/page.tsx` is intentionally UI-only. The current `CalendarItem` in `lib/mockData.ts` is partly production-shaped, but several convenience fields are denormalized for the prototype.

## Recommended future entities

- `workspaces` or `projects`: project identity, lifecycle, modules, locale, and scheduling timezone.
- `task_presets`: reusable project work definitions and default custom fields.
- `calendar_items`: scheduled instances with a preset reference or a one-off snapshot.
- `calendar_item_assignments`: item-to-volunteer relationships, response state, role, and assignment history.
- `volunteer_profiles`: durable person/contact and readiness information.
- `questionnaire_submissions`: intake records that remain separate from durable volunteer profiles.
- Communications/reminders later: delivery plans and attempts that reference calendar items or assignments without embedding delivery state in them.

## Current field audit

### Already close to production-shaped

- Stable Calendar item id and workspace/project id.
- Task preset reference and a distinct one-off custom task snapshot.
- Start date, optional end date, preview `allDay` compatibility flag, and timed start/end values.
- Needed count and schedule-specific notes.
- `copiedFromItemId` as a basic provenance reference.
- Stable task/item identity for deterministic display colors.

### Mock or UI conveniences to replace

- `filledCount` and `assignedVolunteerIds` should be derived from assignment rows.
- Current Calendar item `status` mixes item lifecycle, staffing coverage, and confirmation state. Production should keep item lifecycle separate from assignment responses and derived coverage.
- `someDenied` is present in the filter vocabulary but cannot be derived from the current item shape. It needs assignment response data.
- `timeWindow`, `repeatLabel`, and `copyLabel` are display strings rather than authoritative scheduling or recurrence data.
- Category/type filters are derived presentation groupings. Avoid storing competing item and preset categories unless a deliberate historical snapshot is required.
- Deterministic event color is presentation state derived from stable identity. It need not be stored unless admins later receive an explicit color choice.
- Existing Lunch `menuSummary` and preset custom fields overlap. Future Meals should use one authoritative typed breakfast/lunch detail rather than preserve a Lunch-only preset assumption or two implicit sources.

## Scheduling semantics

The recommended production vocabulary is deliberately small:

| Kind | Meaning | Typical examples | Coverage expectation |
| --- | --- | --- | --- |
| `timed` | Work with an exact local date/start/end interval. Iteration 11.9 accepts same-date intervals only; a future instant model must preserve timed semantics for overnight work. | Gate attendant shift, lunch service, night watch | May require helpers. |
| `date_based` | Work tied to one project date with no meaningful clock time. It does not mean a 24-hour shift. | Flexible cleanup day, materials receiving day | May require helpers when the whole item has one headcount target. |
| `multi_day_window` | A date range that communicates an ongoing project phase, availability window, or constraint. It is not an aggregate volunteer shift. | Concrete cure window, site-support week, access restriction | Informational by default. Create child timed or date-based work when volunteers need distinct assignments. |
| `milestone` | A dated project marker or context item with no work duration. | Inspection, delivery deadline, phase handoff | Informational only. |

`note` should not be a scheduling kind in the first contract. Schedule notes belong on an item, while a standalone dated project fact can use `milestone`. A separate project-note entity can be considered later if real use cases require undated or richer context.

`ongoing` is a display state derived when today or the focused date intersects a `multi_day_window`; it is not a stored scheduling kind.

### Current mock mapping implications

The controlled validation records were designed to exercise the current band, not settle production meaning. They must be classified deliberately rather than converted from `allDay` by date-span shape alone:

- Preconstruction prep and Materials receiving are plausible `date_based` work if they have one date and one item-level helper target.
- Concrete prep window and Site support week are plausible `multi_day_window` context. If volunteers actually work distinct days or shifts within them, keep the window informational and create related timed/date-based work.
- Safety coverage is semantically ambiguous. A broad safety phase is a `multi_day_window`; actual coverage duties should be split into assignable timed or date-based items.

### UI language recommendation

Do not center the production UI on **All day**. In CVC work it can incorrectly imply a 24-hour commitment. Prefer normal start/end fields for timed work and **No specific time** for date-based work. When a date range is present, present the item as **Project window**. Inspectors can use concise schedules such as `No specific time · Mon Jan 12`, `Project window · Jan 12–17`, or `Milestone · Jan 16` when milestone semantics are actually supported.

The current mock `allDay` flag and `All day` mock time-window values remain compatibility state, but visible Calendar copy no longer exposes that terminology. Week and Day use **Project context**, creation uses **No specific time**, date ranges and inspector schedules use **Project window**, and creation is framed as **Plan project work**. Do not persist `allDay` beside an authoritative scheduling kind. External calendar interoperability may still require technical all-day event semantics at an adapter boundary.

### Calendar view behavior

| View | `timed` | `date_based` | `multi_day_window` | `milestone` |
| --- | --- | --- | --- | --- |
| Day | Positioned in the time grid. | Represented in a hard-capped `Project context` strip without a fake time. | Represented in the strip on intersecting dates; Week, Month, and the inspector carry fuller range context. | Represented as compact project context when relevant. |
| Week | Positioned by start/end time with overlap handling. | One-day bar in the band. | Spanning bar across intersecting day columns. | Compact marker in the relevant day column. |
| Month | Compact row within its date cell. | Compact row within its date cell. | Compact continuation/spanning treatment across the range where practical. | Compact marker on its date. |
| Mobile Week groups | Sorted within the relevant date group with time visible in its accessible/expanded detail. | Shown in its date group without a fake time. | Represented on intersecting dates with concise ongoing/range context; avoid implying a shift. | Shown once in its date group as informational. |
| List (current mock) | One chronological row using the mock start time. | One row using project date and `No specific time`. | One row using the full date range, not one duplicate per day. | One dated informational row when milestone support exists. |
| Future Timeline / Work Plan | Duration bar on the time/date axis. | One-date bar or marker. | Natural multi-day phase/window bar. | Point marker. |

Day and Week remain the operational scheduling views. The current List companion favors scanning and filtering without replacing the familiar grid, while a future Timeline / Work Plan should favor construction phases, dependencies, and multi-day context.

### Month view implications

Month originally showed one chip plus a quiet `+N` per date. That protected full-cell creation during the interaction foundation, but it was too restrictive for the mature Calendar.

Iteration 09.37 applied the first Month-density step:

- Larger screens show up to three compact item rows; screens below 640px show two.
- A quiet `+N` represents only true breakpoint-specific overflow and focuses Day view for that date.
- The full-cell creation target remains behind foreground item and overflow sibling controls.
- Date-intersection helpers allow current compatibility range items to appear on relevant dates without implementing horizontal Month spans.

Iteration 09.38 applies the denser visual rule:

- Month rows are 16px high with reduced padding and 10px text.
- Screens 640px and wider show up to six rows; smaller screens show up to three.
- The six/three limits keep `+N` tied to true breakpoint overflow while preserving the existing full-cell creation layer and sibling-control structure.
- Day replaces its large compatibility section with one quiet `Project context` row, capped at one item plus `+N`; the Week band remains unchanged.

Iteration 09.39 applies the visible terminology contract without changing the preview model:

- Week and Day aggregate surfaces use `Project context`.
- One-date untimed creation and inspector schedules use `No specific time`.
- Date ranges use `Project window`.
- The creation surface uses `Plan project work`; Calendar summaries use `All project work`.
- `Project week` remains the reset label because it accurately describes the control's current destination.
- Internal `allDay` fields, timing classification, intersection helpers, and mock `All day` values remain compatibility implementation details.

Future terminology work should introduce `Milestone` only with real model support rather than relabeling existing mock items heuristically.

Iteration 09.40 applies that presentation guidance in a mock-only List view:

- List follows the visible Week period and uses the existing filtered item set.
- Date-based/no-specific-time items sort before timed work; timed work sorts by start time.
- A multi-day compatibility item appears once, anchored to its start date or the visible Week boundary, with the full `Project window` range.
- Rows expose the task name, schedule wording, high-level type, helper fraction, and existing inspector action without creating a new entity or schedule kind.
- Grouping and sorting remain presentation helpers. They do not define production queries, timezone behavior, or assignment truth.

Iteration 09.41 keeps the same data presentation while reducing visual weight: date headers are 36px, desktop rows are 48px, mobile rows are 68px, desktop type labels are plain text, and the List uses top/bottom framing instead of a rounded container. These density choices are presentation rules only and must not become schedule-kind or coverage semantics.

Iteration 09.42 adds automated interaction protection for the current mock Calendar contract, including date/range wording, one-row List project windows, creation defaults, and filter/overlay behavior. Passing this UI regression does not validate the future persistence contract, timezone conversion, assignment-derived coverage, recurrence, authorization, concurrency, or migration rules below; those will require separate data and integration tests when implemented.

## Recommended schedule rules

- A scheduled item should reference exactly one reusable preset or carry one one-off task snapshot. The create boundary should reject ambiguous records containing both or neither.
- `timed` work in 11.9 uses one local project date with start/end times and requires end after start. A future instant/end-date extension must keep overnight shifts `timed`; they must not be reclassified as project windows.
- `date_based` work uses one date and no clock values.
- `multi_day_window` uses an inclusive project-facing `startDate` and `endDate`, with `endDate > startDate`, and no clock values.
- `milestone` uses one date, no end date, and no clock values.
- Multi-day intersection must be consistent in Week, Day, Month, mobile groups, filters, and counts. Current mock helpers handle date/range intersection, while some view grouping still intentionally follows start date.
- Workspace scheduling timezone must be explicit. Timed instants should be stored unambiguously; date-only values must never be converted through midnight UTC in a way that changes the project date.
- Coverage capability should be explicit and separate from schedule kind. `timed` and `date_based` may use item-level coverage; `multi_day_window` defaults to no coverage; `milestone` never carries coverage.
- Needed count belongs to the scheduled occurrence when it may differ from the preset default. Filled, confirmed, denied, waiting, and open counts are derived from assignments.

## Draft-to-item boundary

The future create operation should translate validated draft values into a narrow command or input object. It should copy only schedule-specific preset defaults that need historical stability, preserve the preset reference, and deliberately snapshot any one-off task data. Form context strings, selected-panel state, local validation messages, and disabled preview actions must not cross that boundary.

A future mutation should create the Calendar item first and assignments separately. It should not accept client-calculated coverage counts as authoritative.

## Extended persistence contract sketch

This is guidance for later extensions, not the exact 11.9 migration or final TypeScript API:

```ts
type CalendarSchedule =
  | { kind: "timed"; startsAt: string; endsAt: string; timezone: string }
  | { kind: "date_based"; startDate: string }
  | { kind: "multi_day_window"; startDate: string; endDate: string }
  | { kind: "milestone"; startDate: string };

type CalendarItemInput = {
  workspaceId: string;
  taskSource:
    | { taskPresetId: string; oneOffSnapshot?: never }
    | { taskPresetId?: never; oneOffSnapshot: CalendarOneOffTaskSnapshot };
  schedule: CalendarSchedule;
  coverageMode: "none" | "item";
  neededCount: number;
  scheduleNotes?: string;
  customFieldValues?: Record<string, unknown>;
  lifecycleState: "draft" | "published" | "cancelled" | "completed";
  source: {
    kind: "manual" | "copy" | "recurrence" | "bulk";
    copiedFromItemId?: string;
    recurrenceRuleId?: string;
    batchId?: string;
  };
};
```

The persisted record adds a server-generated id, audit fields, and an optimistic-concurrency/version value. The contract should enforce the task-source and schedule unions server-side rather than trusting form visibility. Preset definitions and item custom-field values stay separate: scheduled values may be snapshotted for history, while definitions remain on the preset.

`workspaceId` is the scheduling-scope key in the sketch. If a future workspace can contain more than one real-world project, add a separate `projectId` and enforce that it belongs to the workspace rather than using the two ids interchangeably.

`neededCount` is required and non-negative. It is zero when `coverageMode` is `none`; positive counts represent assignable work. A multi-day window should not use one ambiguous aggregate volunteer count. If the project needs volunteers on several dates or shifts inside a window, create related timed/date-based items or introduce a deliberate child-occurrence model later.

## Assignment and coverage truth

Iteration 11.10 introduces `calendar_assignments` and one current `assignment_responses` row per assignment. Only active timed/date-based items and active, ready volunteer profiles can be linked. Same-workspace composite foreign keys prevent cross-project relationships, and a partial unique index prevents duplicate active volunteer/item pairs. This slice does not detect overlaps between different items.

New assignments start at `needs_response`. Project contacts with `assignments.edit` may explicitly change the current row among `needs_response`, `confirmed`, and `declined`; concurrent changes are rejected rather than silently overwritten. Cancellation preserves response truth while removing the assignment from future active coverage calculations.

Iteration 11.11 adds assignment-scoped bearer authorization without changing Calendar or assignment coverage fields. Public tokens are opaque 256-bit values returned once, stored only as SHA-256 verifiers, and constrained to the assignment/workspace/volunteer relationship. Valid, unrevoked, unexpired tokens may read a minimal task/schedule/response projection and set only `confirmed` or `declined`; source becomes `public_token`. No route, delivery mechanism, lookup, or response history is included.

Assignment and response rows, not Calendar item counters or client calculations, must drive:

- Assigned count (pending plus confirmed).
- Confirmed count.
- Denied count.
- Unassigned count.
- Waiting-on-confirmation state.
- Some/all-denied filter state.
- Each volunteer's invitation, confirmation, denial, cancellation, or completion response state.

Calendar item lifecycle remains separate from assignment lifecycle, response state, and derived coverage. 11.10 adds actor ids and basic compare-and-set protection but not a full audit/history system. Coverage queries and capacity enforcement remain unimplemented.

## Follow-up persistence risks

- Classify current `allDay` compatibility records explicitly as `date_based`, `multi_day_window`, or `milestone`; do not infer meaning from date span alone. Replace ambiguous visible wording in a later UI pass.
- Support overnight `timed` work with real instants without reclassifying it as a multi-day project window.
- Apply one inclusive date-range convention consistently to multi-day rendering, querying, filtering, counts, and accessibility text.
- Define workspace timezone, daylight-saving, locale, and external-calendar conversion rules before storing timed work.
- Choose structured recurrence, copy, and bulk source records instead of persisting `repeatLabel` or `copyLabel` display strings.
- Decide whether recurring edits affect one occurrence, future occurrences, or the series, and make generated operations idempotent.
- Decide how task preset edits affect scheduled items and which name/category/default/custom-field values are snapshotted for history.
- Keep one-off custom tasks as deliberate snapshots with validation; do not silently create reusable presets from them.
- Unify Lunch/menu and other custom-field values without making Food, Security, and General presentation filters separate scheduling models.
- Keep deterministic colors stable and derived unless explicit user-owned color becomes a requirement.
- Preserve Month's six/three density rule without blocking full-cell creation or weakening sibling-control semantics; keep `+N` focused on Day.
- Preserve the preview List rule of one full-range project-window row while defining production query, timezone, and boundary behavior explicitly; do not derive per-day shifts from a window.
- Let a future Timeline / Work Plan express project windows and milestones without replacing Week or becoming the source of scheduling truth.
- Decide whether view/date state belongs in the URL before shareable Calendar links are introduced.
- Add audit/history requirements for schedule edits, assignments, status changes, preset snapshots, and communications.
- Define cross-item conflict handling, capacity changes, waitlisting/overbooking, public response authorization, history/audit, and command idempotency before routes or automation use these records.

## Deliberately out of scope through 11.11

No route cutover, bearer delivery/reminder path, broad lookup, remembered-device state, response history, coverage-counter persistence, conflict engine, recurrence engine, drag/drop save behavior, resizing mutation, URL date routing, Timeline UI, production List query contract, full audit model, or production scheduling engine is introduced through 11.11.
