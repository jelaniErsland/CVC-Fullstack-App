# Roadmap

## 1. Development Strategy

- Belgrade Remodel remains the production Sheets/App Script workflow.
- The full-stack app is being built in parallel.
- Belgrade is the research/testing blueprint.
- The near-term beta target is now Bozeman volunteer scheduling, ideally ready by mid-August 2026.
- Do not rush the full-stack app into the live Belgrade remodel unless a narrow slice becomes safe.
- Belgrade remains the operational fallback while Bozeman proves Project Local in a smaller real beta.
- Near-term principle: **Cut features, not integrity**.

## 2. Real-World Readiness Plan

[`PROJECT_LOCAL_PRODUCT_REQUIREMENTS.md`](./PROJECT_LOCAL_PRODUCT_REQUIREMENTS.md) is the canonical product-planning baseline as of 2026-07-05. Earlier prototype notes remain implementation history; where they conflict, the canonical requirements control. The practical MVP must preserve volunteer schedule lookup, Confirm/Deny, calendar-first scheduling/admin, and enough Communications/reminders to notify volunteers and track responses.

Rough phases:

- Mock prototype foundation.
- Real-data alpha.
- Practical Bozeman scheduling beta.
- Multi-module platform version.

## Bozeman Scheduling Beta Re-baseline

The repository-grounded beta plan is recorded in [`BOZEMAN_BETA_ROADMAP.md`](./BOZEMAN_BETA_ROADMAP.md) and protected by `lib/readiness/bozemanBetaRoadmap.server.ts` plus `npm run test:bozeman-beta-roadmap`.

The Bozeman Beta launch gate requires one production-safe scheduling loop: authorized Bozeman workspace access, permanent volunteer profile entry/import, real Calendar scheduled item create/edit, task-preset or one-off scheduled item creation, volunteer assignment, draft/private versus published/live visibility, secure account-light volunteer schedule access, Confirm/Deny persistence, admin-visible response state, reliable initial assignment email, approved Project Local UI polish on beta-critical surfaces, production environment readiness, hosted validation where required, browser/mobile proof, observability, backup/recovery, and Belgrade Sheets fallback.

Critical path from the post-12.13 state:

1. `12.14 Bozeman Workspace Access and Provisioning Readiness`
   - Completed: operator provisioning boundary and local validation exist.
2. `12.15 Manual Volunteer Profile Add/Edit Permanent Path`
   - Completed: `/admin/volunteers` now reads persisted profiles and supports authorized manual create/edit through narrow authenticated RPCs.
3. `12.16 Calendar Create/Edit Scheduled Item Implementation`
4. `12.17 Calendar Task Preset Selector and One-Off Definition Path`
5. `12.18 Volunteer Assignment Picker and Create/Cancel Commands`
6. `12.19 Draft/Private Versus Published/Live Calendar Visibility`
7. `12.20 Secure Account-Light Volunteer Schedule Access`
8. `12.21 Volunteer Confirm/Deny Round Trip`
9. `12.22 Initial Assignment Notification Email Boundary`
10. `12.23 Bozeman Beta UI Polish, Hosted Validation, and Launch Gate`

The old next step, `12.14 Route-Unused Persisted Tasks Read Model Helper / Query-Shape Review`, is moved and modified. It remains useful, but it is not the immediate beta blocker. A narrower task-preset selector/read seam can be reviewed when Calendar create/edit needs it, and the full `/admin/tasks` cutover can wait unless it becomes directly beta-critical.

Features explicitly deferred behind the beta gate include Belgrade migration, full `/admin/tasks` cutover if not needed for Calendar creation, full public questionnaire cutover, manual public lookup, remembered devices, assignment-detail response-link admin reveal/copy activation, full Communications authoring, automatic reminders, delivery analytics, advanced availability/conflict engine, drag/drop/resize/recurrence Calendar persistence, Food/Security restoration as separate modules, Needs Attention persistence, and broad assignment directory/search.

Response-link activation remains paused after 11.50.

## 3. Near-Term Roadmap

- 05B.1 Questionnaire data model/helpers. Completed.
- 05B.2 Public questionnaire form shell. Completed.
- 05B.3 Admin questionnaire review queue. Completed.
- 05B.4 Questionnaire detail/review page. Completed.
- 05B.5 Questionnaire-to-volunteer profile readiness. Completed.
- 05B.6 Questionnaire review workflow states. Completed.
- 05B.7 Intake flow stabilization / visual QA. Completed.
- 06.1 Scheduling data model + mock schedule view. Completed.
- 06.5 Role Landing Page UX Alignment. Completed.
- 06.6 Role-home visual QA/stabilization. Completed.
- 07.1 Needs Attention data model + calm overview. Completed.
- 07.2 Conflict/coverage detail patterns. Completed.
- 07.3 Needs Attention visual QA/stabilization. Completed.
- 08.1 Emails and Announcements data model + admin overview. Completed.
- 08.2 Announcement detail/preview page. Completed.
- 08.3 Reminder templates. Completed.
- 08.4 Emails/Announcements visual QA and stabilization. Completed.
- 08.5 Preview Screenshot Refresh + Visual Review Coverage. Completed.
- 09.1 Food module foundation. Completed.
- 09.2 Food detail/day view. Completed.
- 09.3 Food visual/icon density stabilization. Completed.
- 09.4 Security module foundation. Completed.
- 09.5 Security detail/day view. Completed.
- 09.6 Unified Tasks + Calendar + Navigation Realignment. Completed.
- 09.7 Task presets foundation. Completed.
- 09.8 Calendar scheduling foundation. Completed.
- 09.9 Calendar visual/stability pass. Completed.
- 09.10 Calendar item inspector drawer. Completed.
- 09.11 Mobile 5-tab navigation direction. Completed.
- 09.11.1 Mobile nav coverage stabilization. Completed.
- 09.12 Calendar view controls + filter drawer / day-month foundation. Completed.
- 09.13 Calendar empty-slot creation mock. Completed.
- 09.14 Calendar Overlay + Mobile Interaction Stabilization. Completed.
- 09.15 Overview realignment. Completed.
- 09.16 Admin navigation simplification + Communications alignment. Completed.
- 09.17 Communications detail/template copy alignment. Completed.
- 09.18 Overview/navigation/Communications visual QA + preview refresh. Completed.
- 09.19 Calendar minimal grid visual direction pass. Completed.
- 09.20 Calendar creation detail refinement. Completed.
- 09.21 Calendar Day View 24-Hour Timeline Foundation. Completed.
- 09.22 Calendar Simplicity + Full-Surface Grid Interaction Pass. Completed.
- 09.23 Calendar Hydration Fix + Visual QA + Screenshot Refresh. Completed.
- 09.24 Calendar Week Time-Positioning Foundation. Completed.
- 09.25 Calendar Event Duration and Overlap Foundation. Completed.
- 09.26 Calendar Date Navigation Foundation. Completed.
- 09.27 Calendar Date Navigation Visual QA and Polish. Completed.
- 09.28 Calendar Month View Cleanup + Full-Cell Creation Pass. Completed.
- 09.29 Calendar Visual Reset Toward Native Calendar Feel. Completed.
- 09.30 Calendar Week Density + All-Day Band Foundation. Completed.
- 09.31 Calendar keyboard and screen-reader interaction QA. Completed.
- 09.32 Calendar all-day/multi-day mock-data validation and overflow QA. Completed.
- 09.33 Calendar all-day creation interaction foundation. Completed.
- 09.34 Calendar draft validation and creation-surface polish. Completed.
- 09.35 Calendar production data-model readiness review. Completed.
- 09.36 Calendar scheduling semantics + persistence contract planning. Completed.
- 09.37 Calendar Month Density + Overflow Behavior. Completed.
- 09.38 Calendar Month Density + Day View Date-Based Cleanup. Completed.
- 09.39 Calendar Terminology Cleanup. Completed.
- 09.40 Calendar List View Foundation. Completed.
- 09.41 Calendar List View Visual QA + Density Polish. Completed.
- 09.42 Calendar Interaction Regression Test Foundation. Completed.
- 09.43 Calendar Regression Harness Stabilization + CI Readiness. Completed.
- 09.44 Calendar Keyboard Navigation + Accessibility QA. Completed.
- 09.45 Calendar Dialog Focus Containment + Screen Reader QA. Completed.
- 09.46 Calendar Grid Arrow-Key Navigation Foundation. Completed.
- 09.47 Calendar Week Keyboard Navigation Evaluation. Completed.
- 09.48 Calendar List Information Hierarchy Cleanup. Completed.
- 09.49 Calendar Stabilization + Handoff Review. Completed.
- 10.1 Public Volunteer Portal Foundation / Project Local Volunteer Home Direction. Completed.
- 10.2 Volunteer Schedule Lookup / Remembered Volunteer Home Mock. Completed.
- 10.3 Volunteer Confirmation Flow Mock / Assignment Detail Surface. Completed.
- 10.4 Volunteer Schedule List / Multiple Assignments Mock. Completed.
- 10.5 Volunteer Schedule Empty/No Assignment States + Project Updates Polish. Completed.
- 10.6 Volunteer Schedule Response State Polish / Reminder Link Preview. Completed.
- 10.7 Public Volunteer Portal Stabilization + Handoff Review. Completed.
- 11.1 Supabase/Auth/Persistence Readiness Planning. Completed.
- 11.2 Supabase Project Setup + Environment Skeleton. Completed; tooling and environment boundaries only, with no product-data integration.
- 11.3 Auth Shell for Project Contacts. Completed; identity/session boundary only, with no project grants or product-data authorization.
- 11.4 Workspace Persistence Foundation. Completed; one deny-by-default workspace identity table and an unused server-owned read boundary, with no route cutover or project grants.
- 11.5 Project Contact Grants + Workspace Authorization. Completed; active contact/grant RLS and server-only readers, with no product-route cutover.
- 11.6 Questionnaire Submission Persistence. Completed; immutable public intake boundary and `questionnaires.review` reads, with no route cutover or profile conversion.
- 11.7 Volunteer Profile Persistence. Completed; explicit capability-authorized conversion and project-scoped reads, with no route cutover.
- 11.8 Task Preset Persistence. Completed; capability-scoped reusable definitions and create/archive commands, with no route or Calendar cutover.
- 11.9 Calendar Item Persistence. Completed; explicit schedule kinds, preset-or-one-off snapshots, workspace timezone enforcement, and capability-scoped create/read/archive with no route, assignment, or response cutover.
- 11.10 Assignment + Volunteer Response Persistence. Completed; same-workspace assignment truth, one current response row, capability-scoped contact commands, and no Calendar counters or route cutover.
- 11.11 Public Volunteer Response Authorization Foundation. Completed; database-generated opaque bearers, hash-only storage, expiry/revocation, narrow public verification/response RPCs, and no route or delivery cutover.
- Post-11.11 gate. Completed 2026-07-02 locally and against hosted non-production `project-local-staging` (`kfuujcfxoayukywvtaeh`) through migration `20260701070000`. All 16 hosted live RLS/RPC groups passed, including one-winner/one-`40001`-loser concurrency with final truth matching the winner; cleanup completed and reviewed generated types remained structurally unchanged. This validation-only milestone does not connect routes to persisted data. Route cutovers, public lookup, remembered devices, email/reminder delivery, Communications persistence, and Needs Attention persistence remain later slices.
- 11.12 Public Assignment Response Route Shell. Completed; `/respond/[token]` verifies one bearer and submits only `confirmed`/`declined` through the 11.11 public helpers. It is not linked from or mixed into the mock volunteer portal and adds no lookup, remembered devices, email/reminder delivery, Calendar/Volunteers cutover, Communications/Needs Attention persistence, or admin assignment UI.
- 11.13 Public Response Route Valid-Token QA Gate. Completed; a local-only disposable harness opens the real production-preview route, submits `confirmed`, verifies safe projection plus `public_token`/`last_used_at` persistence, passes on repeated fresh runs, and proves complete fixture/Auth cleanup. It adds no delivery, lookup, remembered-device, admin generation, route cutover, seed, or integration behavior.
- 11.14 Project Contact Response Link Issuance Preview Boundary. Completed; an unused server-only helper performs authorized 11.11 issuance and builds one validated `/respond/[token]` URL with expiration metadata and redacted diagnostics. The disposable local QA passed twice. No visible UI, delivery, lookup, remembered device, route cutover, persistence expansion, seed, or service-role path was added.
- 11.15 Response Link Admin Diagnostic Preview. Completed; the unlinked `/admin/diagnostics/response-link` route requires a verified contact, accepts only assignment id/TTL, derives its trusted origin server-side, and displays only assignment id, expiration, and `/respond/[redacted]`. It is developer/admin QA—not product UI or delivery—and no other route links to it.
- 11.16 Response Token Cleanup and Revocation Readiness Guardrail. Completed; diagnostic-issued tokens are immediately revoked through the existing authorized helper, retained hash-only for audit, and rejected by public verification/response. Live QA covers denied/authorized revocation and no deletion, UI, delivery, cron, or service-role path was added.
- 11.17 Response Link Product Lifecycle Policy. Completed; future product links default to 72 hours with a 168-hour maximum, replacement requires atomic same-assignment/purpose revocation, revocation failure fails closed, and only a future explicit audited product surface may reveal a full link. Diagnostic issuance stays fixed at one hour, redacted-only, and immediately revoked.
- 11.18 Atomic Response Link Replacement RPC. Completed locally; authenticated `assignments.edit` replacement revokes older same-assignment/purpose tokens and issues one hash-only replacement atomically. Assignment-row locking makes concurrent calls leave exactly one usable token. Full-link UI, delivery, lookup, route cutover, deletion, jobs, and service-role access remain absent.
- 11.19 Hosted Staging Migration + Atomic Replacement Validation Gate. Completed against non-production `project-local-staging` (`kfuujcfxoayukywvtaeh`) through `20260702000000`; two disposable runs passed authorization, rollback, replacement, public verification/submission, TTL, hash-only storage, concurrency, and zero-residue checks. This validation does not connect product routes or add delivery/UI.
- 11.20 Audited Response Link Reveal Boundary Planning. Completed; a server-only fail-closed policy defines the sole future reveal surface, required Auth/capability/replacement/origin/POST/no-store/TTL/audit conditions, and a credential-free audit-event contract. Audit persistence was supplied by 11.21; copy-link UI and delivery remain blocked and every current route remains ineligible.
- 11.21 Response Link Reveal Audit Persistence. Completed locally; command-only `assignment_response_link_reveal_events` and its authenticated `assignments.edit` RPC persist bounded credential-free audit metadata for a live matching token. Direct table access is denied and live QA covers Auth/capability/scope/lifecycle/bounds. Reveal, copy UI, and delivery remain blocked pending an explicit transactional product surface; hosted migration validation is a later gate.
- 11.22 Hosted Staging Migration + Reveal Audit Validation Gate. Completed against non-production `project-local-staging` (`kfuujcfxoayukywvtaeh`) through `20260703000000`; two disposable runs passed table-denial, Auth/capability, token scope/lifecycle, metadata bounds, credential-free persistence, replacement-compatibility, and zero-residue checks. Product reveal remains blocked; no route cutover, copy UI, or delivery was added.
- 11.23 Audited Product Reveal Server Action Contract. Completed locally through `20260704000000`; transactional `reveal_assignment_response_link` couples capability-checked replacement and credential-free audit before one bearer return, with an unused trusted-origin server helper. Current routes remain ineligible and product-surface readiness remains false. Copy UI/delivery are blocked; hosted validation is a later gate.
- 11.24 Hosted Staging Migration + Audited Reveal Validation Gate. Completed against non-production `project-local-staging` (`kfuujcfxoayukywvtaeh`) through `20260704000000`; two disposable runs passed rollback, Auth/capability, atomic replacement/audit coupling, public use, concurrency, credential-free persistence, compatibility, and zero-residue checks. Product reveal remains blocked; no UI, delivery, or route cutover was added.
- 11.25 Response Link Product Surface Readiness Review. Completed as planning/static guardrails only. The first future eligible surface is a persisted project-contact assignment-detail POST action using the transactional audited-reveal boundary, trusted server origin, dynamic/no-store response, explicit action, expiry/warning copy, and post-success-only manual copy. Current routes remain ineligible and product-surface availability remains false. Next slice: build the persisted assignment-detail context and separately review its server action/UI before enabling reveal.
- 11.26 Persisted Assignment Detail Context Readiness. Completed locally through `20260705000000`; narrow authenticated `read_assignment_detail_context` supplies one safe active assignment projection under `assignments.view` without requiring broad Calendar/Volunteers capabilities. The server-only helper and disposable QA are route-unused, token/intake-free, fail closed for unavailable context, and expose edit only as a boolean. Product reveal remains false; hosted validation is a later gate.
- 11.27 Hosted Staging Migration + Assignment Detail Context Validation Gate. Completed against non-production `project-local-staging` (`kfuujcfxoayukywvtaeh`) through `20260705000000`; two disposable runs passed Auth/capability/workspace/inactive isolation, assignments-only safe projection, edit boolean, forbidden-field, route-isolation, and zero-residue checks. Product reveal and route integration remain blocked.
- 11.28 Response Link Product Action Readiness Review. Completed as server-only contract/static guardrails. The future action is assignment-detail-context-only, explicit POST, dynamic/no-store, trusted-origin, no-prefetch, and one audited-reveal boundary; browser input is assignment id plus optional TTL only. Implementation/UI/reveal flags remain false. Recommended next slice: plan the persisted assignment-detail route surface before implementing the still-unlinked action.
- 11.29 Persisted Assignment Detail Route Surface Readiness Review. Completed as route-unused planning/static guardrails. The future route is `/admin/assignments/[assignmentId]`, reads only the persisted assignment-detail context under `assignments.view`, uses dynamic/no-store rendering, and presents the same unavailable state for missing, unauthorized, cross-workspace, canceled, archived, inactive, or unavailable context. No route or navigation link was added; action implementation/UI, product-surface implementation, reveal availability, and navigation linkage remain false. Next slice: an unlinked persisted assignment-detail route shell with no response-link action.
- 11.30 Unlinked Persisted Assignment Detail Route Shell. Completed as the first read-only persisted admin route at `/admin/assignments/[assignmentId]`. It is dynamic/no-store, requires a verified contact plus RPC-enforced `assignments.view`, reads only the validated detail-context helper, and presents one non-disclosing unavailable state. No product surface links to it; it has no mock fallback, response-link action, copy UI, delivery, or mutation behavior. Route implementation readiness is true while navigation, product-action implementation/UI, product-surface implementation, and reveal availability remain false.
- 11.31 Assignment Detail Route Visual/Behavior QA. Completed locally with disposable Auth/product fixtures and a cookie-backed production-preview browser gate. Sign-in, safe success, unavailable, desktop, and 390px states pass with no overflow, browser errors, unsafe-field leakage, unrelated-row leakage, or residue. The pass fixed the response timestamp’s runtime-only formatter failure and refined reference/unavailable/disabled-area copy without adding action or navigation behavior. Hosted validation was unnecessary because DB/RPC/types did not change.
- 11.32 Assignment Detail Product Action Server Boundary. Completed as a server-only, route-unused boundary for the future assignment-detail response-link action. It validates assignment id plus bounded TTL only, reads the persisted detail context before reveal, requires `canEditAssignment`, derives origin/mode/audit metadata server-side, and calls the audited reveal helper exactly once. Product action implementation/UI, product-surface implementation, reveal availability, navigation linkage, and visible copy UI remain false. Hosted validation is unnecessary because no DB/RPC/type/hosted behavior changed.
- 11.33 Assignment Detail Product Action UI Readiness Review. Completed as planning/static guardrails only. The future UI contract requires the unlinked assignment-detail route, deliberate click/tap, assignment-specific credential warning, visible expiration, no implicit reveal from render/GET/page-load/prefetch/hover/focus/effects, no automatic clipboard write, and post-success-only manual copy. No UI, button, route import, navigation link, reveal availability, delivery, or route cutover was added. Next slice should still keep any action/UI wiring unavailable until separately reviewed.
- 11.34 Assignment Detail Inert Product Action UI Shell. Completed as a visible but inert readiness panel on `/admin/assignments/[assignmentId]`. The route still imports only `readAssignmentDetailContext` for persisted data and no product-action/reveal/token helper; the panel has no form, enabled button, hidden action metadata, clipboard behavior, URL, bearer, verifier, token id, or delivery. Product-action UI implementation, copy affordance, product-surface implementation, reveal availability, and navigation linkage remain false. Next slice may review still-unavailable action wiring or route-entry planning without enabling reveal.
- 11.35 Assignment Detail Action Wiring Readiness Review. Completed as route-unused planning/static guardrails. The new wiring policy says future route execution must be explicit POST/server-action only, never render/GET/page-load/prefetch, accept only assignment id plus optional bounded TTL, call only the 11.32 product-action boundary, and allow the full URL only in a successful explicit action response. Route wiring implementation, product-action UI, copy affordance, product-surface implementation, reveal availability, and navigation linkage remain false. No route import, form, server action, clipboard behavior, URL generation, delivery, or migration was added.
- 11.36 Assignment Detail Route Entry Readiness Review. Completed as route-unused planning/static guardrails. Future entry points may come only from persisted authorized Calendar assignment context, admin volunteer assignment context, Needs Attention staffing/response rows, or Communications/reminder preview context, and hrefs may carry only `/admin/assignments/[assignmentId]`. Public volunteer routes, `/respond/[token]`, diagnostics, mock-only routes, anonymous pages, arbitrary typed ids, and broad assignment search/directories remain ineligible. Calendar/Volunteers/Needs Attention/Communications/public/diagnostic/response-token entry linkage remains false; no links, navigation, UI, reveal, delivery, or migration were added.
- 11.37 Assignment Detail Enablement Checklist Review. Completed as route-unused planning/static guardrails. A server-only checklist now groups the remaining route, entry, action, UI, credential/log, browser-proof, and product-owner prerequisites for any future activation. Active reveal, copy, and entry-linking flags remain false, and the checklist is not imported by `/admin/assignments/[assignmentId]`; the route stays read-only, unlinked, inert-panel-only, and persisted-context-only.
- 11.38 Assignment Detail Disabled Action Adapter. Completed as route-unused disabled plumbing only. The adapter accepts assignment id plus optional bounded TTL, rejects forbidden browser fields, checks the 11.37 checklist, and keeps the 11.32 product-action boundary behind a hard false final-approval flag. Current disabled states return no URL, bearer, verifier, token id, credential, SQL detail, sensitive intake, or unrelated row data. No route imports the adapter and no UI, link, copy affordance, delivery, navigation, migration, or hosted behavior changed.
- 11.39 Assignment Detail Disabled Adapter Unit Harness. Completed as a focused local test-harness slice. `npm run test:assignment-detail-action-adapter` runs without preview, hosted Supabase, or service-role credentials and proves the disabled adapter is credential-free, rejects malformed/forbidden input, honors TTL bounds, keeps final approval false, and never calls the product-action boundary on current paths. No route, UI, navigation, delivery, migration, or hosted behavior changed.
- 11.40 Assignment Detail Server-Action Shape Readiness Review. Completed as route-unused planning/static guardrails. A server-only policy defines the future server-action shape as `/admin/assignments/[assignmentId]` only, explicit POST/server-action submit/click/tap only, route-derived assignment id plus optional bounded TTL only, and execution through the 11.38 disabled adapter or reviewed successor only. Render/GET/page-load/prefetch/hover/focus/effect/hydration reveal, direct audited reveal/RPC/token/replacement calls, credential-bearing errors/logs, automatic clipboard writes, route imports, forms, enabled controls, product navigation, delivery, migration, and hosted behavior remain absent. Route server-action implementation, final approval, active reveal/copy, route wiring, product-action UI, copy affordance, product-surface implementation, reveal availability, and entry/navigation linkage remain false.
- 11.41 Route-Unused Disabled Assignment Response Link Server Action Stub. Completed as the first executable seam and still disabled by default. `createDisabledAssignmentResponseLinkServerAction` has a server-action directive, accepts only route-derived assignment id plus optional bounded TTL FormData, rejects unknown/forbidden browser fields, delegates only to the 11.38 disabled adapter, and currently returns only credential-free disabled/not-approved/malformed/error states. `npm run test:assignment-detail-server-action` proves no product-action/reveal/RPC/token/replacement helper is called directly and no full URL, bearer, verifier, token/audit id, credential, SQL detail, sensitive intake, or unrelated row data is returned; after 11.43 it also proves the reviewed route import does not invoke or bind the stub. Product-action UI, copy affordance, product surface, reveal availability, final approval, active route server-action implementation, entry linkage, and navigation remain false.
- 11.42 Assignment Detail Disabled Route Wiring Readiness Review. Completed as route-unused planning/static guardrails. A server-only policy defines how a later disabled route-wiring slice may connect `/admin/assignments/[assignmentId]` to the 11.41 server-action stub without enabling reveal: dynamic/no-store, persisted-context-only, deliberate submit/click/tap only, route-derived assignment id plus optional bounded TTL only, and route calls limited to `createDisabledAssignmentResponseLinkServerAction`. It forbids render/GET/page-load/prefetch/hover/focus/effect/hydration/unavailable-state execution, hidden/browser metadata, direct adapter/product-action/reveal/RPC/token/replacement/diagnostic/service-role route calls, credential-bearing disabled/error UI, active copy, navigation, migration, and hosted behavior. Disabled route-wiring implementation and all active reveal/copy/product/navigation flags remain false.
- 11.43 Assignment Detail Disabled Route Wiring Implementation. Completed as disabled route wiring only. `/admin/assignments/[assignmentId]` now imports `createDisabledAssignmentResponseLinkServerAction` as the only response-link route wiring import, but it does not call it, bind it to a form, render hidden fields, accept browser assignment metadata, or add any submit/copy affordance. The route remains dynamic/no-store, unlinked, persisted-context-only, and reads assignment data only through `readAssignmentDetailContext`; unavailable states remain non-disclosing. Disabled route-wiring/import flags are true, while final approval, active reveal/copy, route server-action implementation, product-action UI, copy affordance, product surface, reveal availability, and entry/navigation linkage remain false. No migration or hosted validation was required.
- 11.44 Disabled Route Wiring Browser/Security Hardening Review. Completed as hardening only. Static checks now prove the inert 11.41 route import is not called, bound, passed to JSX/action/client props, hidden in metadata, or accompanied by response-link form/submit/URL/copy/redirect/revalidation/cookie behavior. Browser QA now verifies the authorized response-link panel is visible but disabled, absent from unavailable states, has no form/hidden metadata/generated URL/copy affordance, and that click/hover/focus/tab interactions do not navigate, submit, reveal, copy, POST, hit `/respond/`, hit diagnostics, or produce response-link/reveal/copy/audit/token-like network traffic. Active reveal, active copy, final approval, route server-action implementation, product-action UI, copy affordance, product surface, reveal availability, entry linkage, and navigation remain false.
- 11.45 Disabled Route Action Binding Readiness Review. Completed as route-unused planning/static guardrails. A server-only policy defines the future disabled action-binding contract between the authorized assignment-detail response-link panel and `createDisabledAssignmentResponseLinkServerAction`: `/admin/assignments/[assignmentId]` only, dynamic/no-store, persisted context via `readAssignmentDetailContext` only, deliberate click/tap/submit only, route/server-derived assignment id only, optional bounded TTL only, and credential-free disabled/error states. It forbids render/GET/page-load/prefetch/hover/focus/effect/hydration/panel-mount/tab-navigation execution, hidden/browser assignment metadata, hidden ambiguous TTL, direct route calls/imports to adapter/product-action/reveal/RPC/token/replacement/diagnostic/service-role/policy paths, URL reveal, copy behavior, and automatic clipboard writes. Action-binding implementation and all active reveal/copy/product/navigation flags remain false.
- 11.46 Disabled Route Action Binding Implementation. Completed as disabled binding only, not activation. `/admin/assignments/[assignmentId]` now creates exactly one route-derived disabled binding to the 11.41 server-action stub and keeps it non-submittable from normal UI: no form, action prop, enabled submit, hidden assignment id/TTL/action metadata, result renderer, URL field, copy button, clipboard behavior, delivery, or navigation link was added. The route still imports no disabled adapter, product-action boundary, reveal/RPC/token/replacement/diagnostic/service-role/policy module and still reads assignment data only through `readAssignmentDetailContext`. Disabled action-binding implementation is true; final approval, active reveal/copy, active route server-action implementation, product-action UI, copy affordance, product surface, reveal availability, and entry/navigation linkage remain false.
- 11.47 Disabled Action Binding Security Regression Review. Completed as hardening only. Static/browser checks now lock down the 11.46 state: exactly one route-derived disabled binding, no rendered form/action prop/hidden metadata/submit path/result/URL/copy behavior, no direct adapter/product-action/reveal/RPC/token/replacement/diagnostic/service-role path, authorized-only panel visibility, and no response-link capability detail in unavailable states. Operational setup docs now require redirected/redacted Supabase diagnostics, and the static gate scans tracked files for actual-looking Supabase keys, JWTs, and credentialed database URLs. No migration, activation, product navigation, delivery, or hosted behavior changed.
- 11.48 Disabled Action Result-State Contract Review. Completed as route-unused planning/static guardrails only. A server-only policy defines the future disabled result-state contract for the assignment-detail response-link panel: `/admin/assignments/[assignmentId]` only, dynamic/no-store, persisted context via `readAssignmentDetailContext` only, result source limited to the 11.41 disabled server-action stub or reviewed successor, and currently allowed output limited to credential-free disabled/not-approved/checklist-blocked/malformed/unavailable/action-error/impossible-success-reduced states. Full/redacted URLs, bearer/verifier/token/audit ids, credentials/secrets, SQL/RPC details, sensitive intake, emergency contacts, questionnaire answers, raw grants/capabilities, stack traces, provider dumps, raw exceptions, copy/send/delivery implications, and hidden-token existence leaks remain forbidden. No result renderer, active reveal, copy affordance, product surface, navigation, migration, or hosted behavior was added.
- 11.49 Disabled Result Renderer Readiness Review. Completed as route-unused planning/static guardrails only. A server-only policy defines the future disabled renderer contract: `/admin/assignments/[assignmentId]` only, dynamic/no-store, persisted context via `readAssignmentDetailContext` only, input limited to already-sanitized 11.48 disabled/error-like state, and fixed allowlisted copy keyed by safe state codes. It forbids raw action results, arbitrary error strings, provider payloads, Supabase/RPC exceptions, thrown exceptions, stack traces, buttons, links, retry/reveal/download/open/send/copy affordances, generated URL fields, URL-shaped strings, `/respond/`, `[redacted]`, token/hash/audit/diagnostic identifiers, hidden metadata, and route imports of renderer/result policies. Disabled/active/active-success renderer implementations, active reveal/copy, product surface, navigation, migration, and hosted behavior remain false/unmodified.
- 11.50 Assignment Response Link Activation Checkpoint Review. Completed as checkpoint/static guardrails only. A server-only route-unused checkpoint inventories proven foundations, remaining blockers before active reveal, safe next implementation options, and current non-negotiables. `/admin/assignments/[assignmentId]` remains the only reviewed future product reveal surface and stays dynamic/no-store, unlinked, persisted-context-only, and limited to `readAssignmentDetailContext`; activation approval, final approval, active reveal/copy, route server-action implementation, disabled/active/active-success renderer implementations, product-action UI, copy affordance, product surface, reveal availability, entry/navigation linkage, delivery, public lookup, and remembered-device availability remain false.
- 12.1 MVP Real-Data Cutover Sequencing Review. Completed as route-unused planning/static guardrails only. A server-only checkpoint inventories available persisted foundations, current mock-only routes, non-negotiable cutover rules, and a recommended cutover sequence. All Calendar/Tasks/Volunteers/Public Volunteer/Communications route cutovers, reminder delivery, response-link activation reopening, mock-to-real mixing, service-role cutover, migration, hosted behavior, seed data, and product route changes remain false/unmodified. Next recommended slice: `12.2 Persisted Calendar Read Model Contract`, still route-unused and without cutting over `/admin/calendar`.
- 12.2 Persisted Calendar Read Model Contract. Completed as route-unused planning/static guardrails only. A server-only Calendar contract defines future workspace-scoped, authenticated project-contact, capability-checked, explicit date-range reads for Day/Week/Month/List data without adding queries or route imports. Calendar item shells require `calendar.view`; assignment-derived coverage counts use the stricter current-safe rule requiring both `calendar.view` and `assignments.view`. Counts must derive from assignment/current-response rows, not Calendar item counters, assigned volunteer id arrays, mock `filledCount`, or client calculations. `/admin/calendar` remains mock-only and behaviorally unchanged; Calendar writes, assignment picker/create/cancel, assignment-detail entry links, response-link activation, delivery, public lookup, remembered devices, seed data, service-role usage, hosted validation, and mock-to-real mixing remain blocked. Next recommended slice: `12.3 Route-Unused Calendar Read Model Helper or Query-Shape Review` only if this contract passes cleanly.
- 12.3 Route-Unused Calendar Read Model Helper or Query-Shape Review. Completed as route-unused helper/query-shape work only. A server-only helper module adds pure input normalization, explicit bounded date-range validation, trusted workspace-timezone validation, strict capability evaluation, a future selector/query-shape plan, assignment-derived coverage summarization, and safe row projection without adding live Supabase reads or route imports. The coverage-bearing shape requires both `calendar.view` and `assignments.view`; missing assignment visibility fails closed. Coverage comes from assignment/current-response rows, not Calendar counters, assigned volunteer id arrays, mock `filledCount`, or client calculations. `/admin/calendar` remains mock-only and behaviorally unchanged; Calendar writes, assignment picker/create/cancel, assignment-detail links, response-link activation, delivery, public lookup, remembered devices, seed data, service-role usage, hosted validation, and mock-to-real mixing remain blocked.
- 12.4 Route-Unused Calendar Read Model Helper QA Harness. Completed as route-unused QA harness work only. A new in-memory fixture harness exercises the 12.3 helper without live Supabase, local disposable database data, hosted validation, route imports, or Calendar UI changes. It proves module/route boundaries, no Supabase client/`.from`/`.rpc`, strict workspace/contact/date-range/timezone/capability guards, assignment-derived coverage scoped by workspace and item, safe projections, pure filter/sort behavior, mock-to-real separation, false cutover/write/assignment-picker/detail-link/response-link/service-role/seed flags, the 12.1 cutover plan, and the 11.47/11.50 response-link safety checkpoints. Next recommended slice: `12.5 Route-Unused Calendar Read Model Disposable Local Data Validation` only if 12.4 remains clean; otherwise revise 12.4 before any local DB validation.
- 12.5 Route-Unused Calendar Read Model Disposable Local Data Validation. Completed as route-unused local validation only. A disposable `qa-12-5-*` harness validates that real local persisted Calendar item, task preset, assignment, and current-response rows can be translated into the existing pure helper without importing it into `/admin/calendar` or any route/component. The command refuses non-loopback Supabase URLs, uses no service-role key, cleans fixtures in `finally`, checks zero residue, and prints only safe summaries. It proves the strict `calendar.view` plus `assignments.view` rule, role/title non-authorization, wrong-workspace/wrong-item non-bleed, assignment-derived counts from persisted rows rather than counters/mock `filledCount`, safe projection, and false cutover/write/assignment-picker/detail-link/response-link/service-role/seed flags. `/admin/calendar` remains mock-only and unchanged; hosted validation, production data validation, delivery, public lookup, remembered devices, response-link activation, and mock-to-real mixing remain blocked. Next recommended slice: `12.6 Route-Unused Calendar Read Model Query Helper Readiness` only if 12.5 remains clean; otherwise revise 12.5 first.
- 12.6 Route-Unused Calendar Read Model Query Helper Readiness. Completed as route-unused query-helper readiness only. A new server-only dependency-injected query seam can consume a reviewed Supabase-like client, validate the existing 12.3 input/range/capability shape before reading, use explicit table/selector allowlists for Calendar item shells, task-preset labels, Calendar assignments, and current responses, and pass translated rows through the existing safe read-model helper. It creates no Supabase client, reads no cookies or route params, imports no app route/component, uses no service-role path, exposes no raw database rows/errors, and uses no `select("*")`. The disposable local validation now also exercises the query helper against local `qa-12-5-*` fixtures and keeps zero-residue cleanup. `/admin/calendar` remains mock-only and unchanged; no product route query, Calendar write, assignment picker/create/cancel, assignment-detail entry link, response-link activation, delivery, public lookup, remembered devices, seed data, hosted validation, service-role usage, or mock-to-real mixing was added. Next recommended slice: `12.7 Calendar Route Cutover Readiness Review` only if 12.6 remains clean; otherwise revise 12.6 first.
- 12.7 Calendar Route Cutover Readiness Review. Completed as route-unused planning/static guardrails only. A new server-only readiness module defines the future `/admin/calendar` persisted read cutover conditions without importing the policy or query helper into the route. It requires dynamic/no-store route behavior, server-only execution, reviewed Auth/workspace/contact/capability/timezone derivation, explicit bounded Day/Week/Month/List ranges, strict `calendar.view` plus `assignments.view` coverage authorization, single-truth-source mock-to-real separation, calm unavailable/empty/error states, browser/preview proof, and rollback boundaries. `/admin/calendar` remains mock-only and behaviorally unchanged; no route imports persisted Calendar read seams, no product route query, Calendar write, assignment picker/create/cancel, assignment-detail link, response-link activation, delivery, public lookup, remembered devices, seed data, hosted validation, service-role usage, or mock-to-real mixing was added. Next recommended slice: `12.8 Calendar Route Cutover Dry-Run Harness` only if 12.7 remains clean; otherwise revise 12.7 first.
- 12.8 Calendar Route Cutover Dry-Run Harness. Completed as route-unused dry-run harness work only. A new server-only dry-run module simulates the future `/admin/calendar` persisted read data path with injected client/context, trusted workspace/contact/grant/timezone values, server-derived bounded Day/Week/Month/List ranges, the 12.6 query helper, and safe 12.3 projection. It fails closed before query for missing Auth/workspace/capabilities, never trusts browser workspace/actor/capability/timezone/selector input, returns only safe dry-run state/items/summary, and exposes no raw grants/capabilities/provider errors/database rows. The disposable local validation now also runs the dry-run against local fixtures with zero residue. `/admin/calendar` remains mock-only and unchanged; no route imports the dry-run harness or query helper, no product route query, Calendar write, assignment picker/create/cancel, assignment-detail link, response-link activation, delivery, public lookup, remembered devices, seed data, hosted validation, service-role usage, or mock-to-real mixing was added. Next recommended slice: `12.9 Calendar Route Cutover Final Preflight` only if 12.8 remains clean; otherwise revise 12.8 first.
- 12.9 Calendar Route Cutover Final Preflight. Completed as route-unused final preflight only. A new server-only preflight module defines the exact go/no-go conditions for a later read-only `/admin/calendar` persisted read implementation slice: candidate scope, required server route chain, checklist, calm empty/unavailable/error states, current UI preservation requirements, safe mapping allowlist, unsafe field denylist, single-truth-source mock-to-real boundary, and rollback plan. `/admin/calendar` remains mock-only and unchanged; no route imports the final preflight, dry-run harness, readiness policy, or query helper; no product route query, Calendar write, assignment picker/create/cancel, assignment-detail link, response-link activation, delivery, public lookup, remembered devices, seed data, hosted validation, production data validation, service-role usage, or mock-to-real mixing was added. Next recommended slice: `12.10 Calendar Route Cutover Empty/Unavailable State Prototype` only if 12.9 remains clean; otherwise revise 12.9 first.
- 12.10 Calendar Route Cutover Empty/Unavailable State Prototype. Completed as route-unused UI-state prototype/readiness work only. A new server-only state prototype module defines the future persisted-read route states `ready_with_items`, `ready_empty`, `unavailable`, and `error`, plus safe user-facing presentation copy. Ready with items preserves the existing Day/Week/Month/List surface; ready empty is an authorized successful zero-item state, not an error; unavailable is a distinct fail-closed prerequisite/access/workspace/capability state; and error is a distinct unexpected safe failure after prerequisites. All states preserve the Calendar shell/controls where safe and prohibit mock fallback, mock/persisted mixing, raw diagnostics, unsafe fields, and response-link behavior. `/admin/calendar` remains mock-only and unchanged; no route imports the state prototype, final preflight, dry-run harness, readiness policy, or query helper. Next recommended slice: `12.11 Calendar Persisted Read Route Cutover Implementation` only if 12.10 remains clean and the cutover stays narrow/read-only/reversible; otherwise revise 12.10 first.
- 12.11 Calendar Persisted Read Route Cutover Implementation. Completed as the first actual `/admin/calendar` persisted-read route cutover. The route is now dynamic/no-store and server-owned, derives Auth/contact/workspace/grant/capability/timezone context through reviewed server boundaries, requires the strict `calendar.view` plus `assignments.view` rule for coverage-bearing output, calls the dependency-injected 12.6 query helper through a narrow route read adapter, and maps safe persisted read-model items into the existing Calendar UI. `/admin/calendar` no longer uses mock Calendar items as the user-facing item truth source and does not fall back to or mix mock/persisted items. The four reviewed states (`ready_with_items`, `ready_empty`, `unavailable`, `error`) are implemented. Calendar writes, assignment picker/mutations, assignment-detail links, response-link activation/copy/delivery, public lookup, remembered devices, service-role usage, seed data, migrations, generated type changes, hosted validation, and production data validation remain absent. Next recommended slice: `12.12 Calendar Persisted Read Cutover Stabilization`, still read-only, before any Calendar writes or broader route cutovers.
- 12.12 Calendar Persisted Read Cutover Stabilization. Completed as a read-only stabilization pass for the first persisted Calendar route cutover. Calendar Day/Week/Month/List navigation now uses server-backed `view` and `date` query parameters that derive a fresh explicit bounded range before each persisted read, preventing false `ready_empty` states for periods that were never queried. Workspace selection is now deterministic and contact-scoped: only the authenticated project contact's effective active grants are unioned, revoked/expired/inactive grants are ignored, exactly one eligible workspace with both `calendar.view` and `assignments.view` is required, cross-contact/cross-workspace capability borrowing is rejected, and ambiguous multiple-workspace eligibility fails closed. `/admin/calendar` remains persisted-item-backed, read-only, dynamic/no-store, and free of mock fallback/mixing, writes, assignment picker/mutations, assignment-detail links, response-link activation, delivery, public lookup, remembered devices, service-role usage, seed data, migrations, generated type changes, hosted validation, or broader route cutovers. Recommended next slice: `12.13 Persisted Tasks Read Model Contract` if the final 12.12 validation remains clean; otherwise perform a narrow Calendar read-cutover stabilization follow-up.
- 12.13 Persisted Tasks Read Model Contract. Completed as route-unused, server-only readiness for a future `/admin/tasks` persisted read cutover. The contract keeps `/admin/tasks` mock/prototype, requires `tasks.view` plus server-derived authenticated contact and deterministic active workspace context, and defines a safe allowlisted task-preset projection from the current `task_presets` schema: preset id, workspace scope, name, description, type/category, default needed count, volunteer visibility, lifecycle, bounded custom-field definitions, safe system identity, and timestamps only when needed. It documents future schema gaps instead of inventing fields, keeps system/trusted preset identity controlled, and separates Tasks presets from Calendar occurrences by forbidding schedule date/time/range, Calendar placement, assignment/response rows, assigned/confirmed/denied counts, coverage state, occurrence notes, Follow-up Contact overrides, recurrence instances, and times-scheduled/upcoming-occurrence aggregates. Mock fallback/mixing, route cutover, query helper implementation, Tasks writes, Calendar writes, response-link activation, delivery, public lookup, remembered devices, service-role usage, seed data, migrations, generated type changes, and hosted validation remain absent. Recommended next slice: `12.14 Route-Unused Persisted Tasks Read Model Helper / Query-Shape Review`; do not cut over `/admin/tasks` from 12.13 alone.
- Bozeman Scheduling Beta Roadmap Re-baseline. Completed as audit/dependency-mapping/documentation only. A server-only route-unused readiness artifact and canonical roadmap doc identify Bozeman as the initial Project Local beta target, ideal mid-August 2026 readiness, Belgrade Sheets as fallback, and **Cut features, not integrity** as the near-term principle. The beta-critical path now prioritizes Bozeman workspace access, volunteer Add/Edit/import, Calendar writes, task-preset/one-off scheduled item creation, assignment picker/commands, publication visibility, secure volunteer schedule access, Confirm/Deny, initial assignment email, UI polish, and production gates. The previous `12.14 Route-Unused Persisted Tasks Read Model Helper / Query-Shape Review` is moved/modified, not deleted: use a narrower task-preset selector seam when Calendar create/edit needs it. No product implementation, migration, hosted validation, email sending, response-link activation, service-role usage, production data access, or mock/persisted mixing was added. Next recommended slice: `12.14 Bozeman Workspace Access and Provisioning Readiness`.
- 12.14 Bozeman Workspace Access and Provisioning Readiness. Completed as the first executable beta-readiness slice after the re-baseline. Added a server-only validated provisioning boundary and operator CLI for creating/reusing matching `workspaces`, `project_contacts`, and `workspace_contact_grants` rows after the approved Auth user exists. The boundary uses only existing schema/capabilities, fails closed on malformed input, missing Auth users, duplicate conflicts, unknown capabilities, and missing `workspace.read`, and remains outside all product routes/components. Local disposable validation proves intended access, under-capability failure, wrong-contact/wrong-workspace isolation, revoked grant failure, role/title non-authorization, idempotent duplicate behavior, no service-role dependency, no secret output, and zero-residue cleanup. No real Bozeman data, Belgrade migration, route cutover, product UI, Calendar write, volunteer Add/Edit UI, assignment picker, public lookup, remembered device, response-link activation, email sending, seed data, migration, generated type change, hosted validation, or service-role path was added. Next recommended slice: `12.15 Manual Volunteer Profile Add/Edit Permanent Path`.

## 4. Mid-Term Roadmap

- 06 Scheduling foundation.
- 06.5 Access Experience Alignment for Main Contacts, scoped Assistant Contacts, separate on-site personnel, and volunteers.
- 06.6 Role-home visual QA/stabilization.
- 07 Needs Attention / Conflicts.
- 07.2 Conflict/coverage detail patterns.
- 07.3 Needs Attention visual QA/stabilization.
- 08 Emails and announcements.
- 08.1 Emails and Announcements data model + admin overview.
- 08.2 Announcement detail/preview page.
- 08.3 Reminder templates.
- 08.4 Emails/Announcements visual QA and stabilization.
- 08.5 Preview Screenshot Refresh + Visual Review Coverage.
- 09.1 Food module foundation.
- 09.2 Food detail/day view.
- 09.3 Food visual/icon density stabilization.
- 09.4 Security module foundation.
- 09.5 Security detail/day view.
- 09.6 Unified Tasks + Calendar + Navigation Realignment.
- 09.7 Task presets foundation.
- 09.8 Calendar scheduling foundation.
- 09.9 Calendar visual/stability pass.
- 09.10 Calendar item inspector drawer.
- 09.11 Mobile 5-tab navigation direction.
- 09.11.1 Mobile nav coverage stabilization.
- 09.12 Calendar view controls + filter drawer / day-month foundation.
- 09.13 Calendar empty-slot creation mock.
- 09.14 Calendar Overlay + Mobile Interaction Stabilization.
- 09.15 Overview realignment.
- 09.16 Admin navigation simplification + Communications alignment.
- 09.17 Communications detail/template copy alignment.
- 09.18 Overview/navigation/Communications visual QA + preview refresh.
- 09.19 Calendar minimal grid visual direction pass.
- 09.20 Calendar creation detail refinement.
- 09.21 Calendar Day View 24-Hour Timeline Foundation.
- 09.22 Calendar Simplicity + Full-Surface Grid Interaction Pass.
- 09.23 Calendar Hydration Fix + Visual QA + Screenshot Refresh.
- 09.24 Calendar Week Time-Positioning Foundation.
- 09.25 Calendar Event Duration and Overlap Foundation.
- 09.26 Calendar Date Navigation Foundation.
- 09.27 Calendar Date Navigation Visual QA and Polish.
- 09.28 Calendar Month View Cleanup + Full-Cell Creation Pass.
- 09.29 Calendar Visual Reset Toward Native Calendar Feel.
- 09.30 Calendar Week Density + All-Day Band Foundation.
- 09.31 Calendar keyboard and screen-reader interaction QA.
- 09.32 Calendar all-day/multi-day mock-data validation and overflow QA.
- 09.33 Calendar all-day creation interaction foundation.
- 09.34 Calendar draft validation and creation-surface polish.
- 09.35 Calendar production data-model readiness review.
- 09.36 Calendar scheduling semantics + persistence contract planning.
- 09.37 Calendar Month Density + Overflow Behavior.
- 09.38 Calendar Month Density + Day View Date-Based Cleanup.
- 09.39 Calendar Terminology Cleanup.
- 09.40 Calendar List View Foundation.
- 09.41 Calendar List View Visual QA + Density Polish.
- 09.42 Calendar Interaction Regression Test Foundation.
- 09.43 Calendar Regression Harness Stabilization + CI Readiness.
- 09.44 Calendar Keyboard Navigation + Accessibility QA.
- 09.45 Calendar Dialog Focus Containment + Screen Reader QA.
- 09.46 Calendar Grid Arrow-Key Navigation Foundation.
- 09.47 Calendar Week Keyboard Navigation Evaluation.
- 09.48 Calendar List Information Hierarchy Cleanup.
- 09.49 Calendar Stabilization + Handoff Review.
- 09 Tasks + Calendar model.
- 10 Public volunteer portal.
- 10.1 Public Volunteer Portal Foundation / Project Local Volunteer Home Direction.
- 10.2 Volunteer Schedule Lookup / Remembered Volunteer Home Mock.
- 10.3 Volunteer Confirmation Flow Mock / Assignment Detail Surface.
- 10.4 Volunteer Schedule List / Multiple Assignments Mock.
- 10.5 Volunteer Schedule Empty/No Assignment States + Project Updates Polish.
- 10.6 Volunteer Schedule Response State Polish / Reminder Link Preview.
- 10.7 Public Volunteer Portal Stabilization + Handoff Review.
- 11.1 Supabase/Auth/Persistence Readiness Planning.
- 11.2 Supabase Project Setup + Environment Skeleton.
- 11.3 Auth Shell for Project Contacts.
- 11.4 Workspace Persistence Foundation.
- 11.5 Project Contact Grants + Workspace Authorization.
- 11.6 Questionnaire Submission Persistence.
- 11.7 Volunteer Profile Persistence.
- 11.8 Task Preset Persistence.
- 11.9 Calendar Item Persistence.

## 5. Later Roadmap

- 11 Supabase/auth/persistence.
- 12 Platform admin.
- Copy previous project/workspace.
- Archive completed projects.
- Multi-workspace management.
- More complete permissions.

## 6. Real-World MVP Definition

For the next project, MVP/core must support:

- Create project workspace.
- Configure supporting congregations and Main Contacts.
- Send volunteer questionnaire link.
- Review questionnaire submissions.
- Create volunteer profiles.
- Create reusable task templates and first-class custom scheduled items.
- Schedule and publish work from the Calendar as the primary workflow.
- Assign multiple volunteers and derive `0/6 assigned`-style counts from assignments.
- Let volunteers look up their own schedule and Confirm, Deny, or Confirm All under the 48-hour cutoff rules.
- Queue assignment email, send schedule-change email, and run/log automatic reminders.
- Show response/staffing Needs Attention items on the defined three-week/two-week timing.
- Support optional General, Food, and Security workflow categories without separate mini-app models.
- Archive project when done.

V1 then adds Availability Blocks, `.ics` export, broader Communications, Meals, scoped assistant/on-site experiences, richer volunteer management, private Notes, and dismissal/accepted-exception workflows. See the canonical requirements for detailed behavior and explicit later items.

## 7. Build Discipline

- Keep Codex prompts small.
- Prefer vertical slices.
- Stabilize before adding large new features.
- Keep mock flow feeling right before database work.
- Do not connect Supabase too early if the user flow is still changing.
- Every future iteration should update the docs.

## 8. Questionnaire Intake Notes

05B.3 added a mock admin questionnaire review queue at `/admin/questionnaires`.
It uses existing questionnaire submission data plus review helpers to show new,
needs-review, incomplete, and reviewed submissions with calm card-first filtering.

05B.4 added a focused mock detail review page at
`/admin/questionnaires/[submissionId]` with full questionnaire answers,
review flags, section completion cues, linked volunteer context, and
placeholder-only review actions.

05B.5 added a mock-only volunteer profile preview/readiness layer that shows
how a reviewed questionnaire could become a schedule-ready volunteer record.
It does not create records or mutate state.

05B.6 added mock-only workflow state helpers and detail-page guidance for new
submissions, needs-review items, needs-follow-up items, missing required info,
ready-for-profile submissions, and already linked/reviewed questionnaires.

05B.7 stabilized the intake surfaces with copy cleanup, mobile tap-target polish,
route checks, visual QA, and expanded preview screenshot coverage for the admin
questionnaire queue and detail review page.

Future questionnaire iterations still need:

- Real approve / needs-follow-up workflow actions.
- Real persistence.
- Role-scoped review views.
- Converting approved questionnaire submissions into schedule-ready volunteer records.
- Scheduling integration after conversion.

## 9. Scheduling Notes

06.1 added mock schedule assignment data, grouping/count helpers, and a first
admin schedule view at `/admin/schedule`. The page shows the active Belgrade
project week as compact day groups with expandable assignment rows, soft
coverage counts, status explanations, and linked volunteer details where
available.

Scheduling is still mock-only. Future scheduling work still needs:

- Unified scheduled-item model where templates become scheduled instances and custom items remain first-class.
- Calendar-first creation/publication; do not substitute a list/form-only builder.
- Real scheduling engine.
- Assignment creation and editing.
- Conflict and coverage logic.
- Volunteer confirmation / denial workflow.
- Real persistence.
- Role-specific schedule landing pages.

Canonical alignment: created items require explicit calendar placement; drafts are saved private/unpublished items, not floating ideas. Needed count may be zero, coverage uses **assigned** language, and every item receives a Follow-up Contact.

## 10. Role Home Notes

06.5 reshaped `/admin/dashboard` into a mock role-aware landing page. 09.15
then realigned it into the current Overview direction: a compact project home
with Belgrade context, this-week Calendar rows, calm follow-up items, quick
links to common work areas, and lighter role-aware guidance for shared main
contact use.

06.6 stabilized the role home visually with tighter dashboard hierarchy, a
lighter project context panel, more prominent next-action treatment, clearer
preview-only language, and mobile/desktop checks for overflow and tap targets.

Role homes are preview/mock-only. Future role work still needs:

- Real role permissions and scoped data.
- Real persistence.
- Food and Security research surfaces folded into Tasks + Calendar.
- A separate on-site personnel access mode; on-site personnel are not a contact role.
- Platform owner/admin homes.

## 11. Needs Attention / Conflicts Notes

07.1 added a mock Needs Attention foundation with follow-up items across
questionnaires, schedule, volunteers, food, security, and setup. The new
`/admin/needs-attention` route uses compact grouped rows, expandable details,
soft priority labels, related links, and calm next-step language. The Primary
CVC dashboard now derives its top next action from the Needs Attention helper.

07.2 added mock conflict and coverage detail patterns at
`/admin/needs-attention/[itemId]`, including coverage gaps, denied assignments,
possible overlaps, missing information before scheduling, food detail gaps, and
security/night-watch coverage. These detail pages show calm explanations,
related assignments/people, suggested next steps, related links, and
placeholder-only actions.

Needs Attention is mock-only. Future work still needs:

- Real conflict detection.
- Real resolution actions.
- Notification logic.
- Role-scoped follow-up views.
- Real persistence.

Canonical timing is three weeks for pending/denied assignments and two weeks for underfilled published items. Needs Attention is a primary-navigation action inbox with per-user dismissal and Main Contact global accepted-exception behavior.

## 12. Emails and Announcements Notes

08.1 added a mock communication foundation for announcements, reminders,
updates, schedule changes, food notes, and security notes. The
`/admin/announcements` route now presents as Communications while keeping the
existing route name; it shows compact summary counts, recent and draft
communication rows, audience/status labels, status/type grouping, and clear
copy that sending is not active yet.

08.2 added focused mock detail/preview pages at
`/admin/announcements/[communicationId]` with message preview, audience and
recipient explanation, dates, author/role, reminder plan where present,
related links, placeholder-only actions, and a helpful not-found state. 09.17
aligned the visible copy so these pages read as Communications previews while
keeping the existing route.

08.3 added a mock reminder-template foundation at
`/admin/announcements/templates`. Templates provide calm starting points for
schedule reminders, pending confirmations, questionnaire follow-up, food
service notes, security/night-watch reminders, project updates, plan changes,
and thank-you/wrap-up notes. They are grouped by module and show suggested
audience, timing, subject suggestions, body previews, and placeholders. 09.17
aligned the page as Reminder templates inside Communications rather than a
separate top-level product area.

08.4 stabilized the communication surfaces and admin shell. The checked admin
routes now use a shared shell that preserves the persistent desktop sidebar and
shows a compact mobile top bar with a collapsible navigation drawer. The drawer
uses the existing admin nav, closes on outside tap or link selection, and keeps
mobile layouts from showing a cramped permanent sidebar.

Communications are mock-only. Future work still needs:

- Real email sending.
- Recipient resolution.
- Scheduled reminders and background jobs.
- Message templates.
- Unsubscribe and suppression logic.
- Delivery tracking.
- Real persistence.

Canonical MVP delivery includes queued assignment batches, one-click Confirm links, date/start/end schedule-change email, automatic pending reminders every three days, confirmed reminders at one month/one week/three days/one day, grouping by volunteer, project-level reminder pause, and Communications history. Deny never appears in email.

## 13. Food Module Notes

09.1 added a mock Food module foundation at `/admin/food`. The overview shows
upcoming lunch support, water/coffee, snack support, and cleanup items for the
active Belgrade workspace with compact counts, a next suggested food action,
date-grouped rows, headcount notes, food contact/congregation responsibility,
helpers, expandable meal/helper notes, related links, and placeholder-only
actions.

09.2 added focused mock Food detail/day pages at `/admin/food/[foodItemId]`.
The detail page shows one food support item with date/day, service type,
status, headcount, congregation/contact responsibility, helpers, meal notes,
helper/headcount notes, related links, same-day food support, and
placeholder-only actions.

09.3 stabilized Food visual density with consistent icon-supported labels on
the overview and detail pages, shorter related-link language, and a compact
accessible mobile menu icon in the shared admin shell.

Food is mock-only. Future product direction is **Meals / Food Menu** inside Calendar rather than a separate heavy Food application. Future work still needs:

- Fold Food research surfaces into special breakfast/lunch Calendar entries within the unified scheduled-item concept.
- Support independent project breakfast/lunch toggles, provider assignment, Menu TBD, and volunteer meal cards.
- Real helper assignment actions through Calendar.
- Real persistence.
- Food contact communication workflows through Communications.

## 14. Security Module Notes

09.4 added a mock Security module foundation at `/admin/security`. The
overview shows night watch coverage, evening site checks, morning
unlock/check-in, and access notes for the active Belgrade workspace with
compact counts, a next suggested security action, date-grouped rows,
icon-supported metadata, related links, and placeholder-only actions.

09.5 added focused mock Security detail/day pages at
`/admin/security/[securityItemId]`. The detail page shows one security item
with date/day, type, status, time window, assigned contact/helpers,
congregation, site/access notes, coverage/helper notes, related links,
same-day security items, and placeholder-only actions.

Security is mock-only. Future work still needs:

- Fold Security research surfaces into task presets and calendar items.
- Real helper assignment actions through Calendar.
- Real persistence.
- Security reminder workflows through Communications.

## 15. Unified Tasks + Calendar Notes

09.6 realigned the product model away from permanent Food/Security top-level
modules and toward a simpler Tasks + Calendar structure.

09.7 added the first mock task preset foundation at `/admin/tasks`. The page
shows reusable task presets only, grouped by category with compact counts,
icon-supported metadata, a focused Lunch system preset panel, duplicate-name
guidance, placeholder-only actions, and explicit copy that dates, times, and
assignments belong on Calendar items later.

Core model:

- Task preset = reusable block.
- Calendar item = scheduled instance of a task preset.
- Tasks and Calendar are separate entities that work together.

Task presets do not include dates, times, assigned volunteers, schedule status,
or calendar placement. A task preset may include:

- Task id.
- Workspace/project id.
- Task name.
- Optional category/type: General, Food, or Security. Construction, cleanup, and similar work roll into General.
- Needed count.
- Visibility settings.
- Optional custom fields.
- Duplicate/source info.
- System preset flag.

Task duplication should use the original name plus a number suffix:

- Night watch.
- Night watch (1).
- Night watch (2).

Earlier prototype work treated Lunch as a predefined system preset. Canonical
planning replaces that future assumption with Calendar-owned Meals supporting
independently enabled Breakfast/Lunch entries and typed meal details. Existing
mock Lunch data remains implementation history until a reviewed slice replaces it.

Calendar items are scheduled instances from a template or first-class custom definition. They may include task preset id, date,
time/window, assigned volunteers/helpers, assigned count such as `0/3 assigned`, notes,
repeat rule, copy/paste/bulk creation metadata, and optional one-off custom
task data.

Future Calendar work should continue toward a Google Calendar-inspired
interaction model without copying its visual design directly. Empty date/time
areas should eventually be clickable/tappable to create a scheduled Calendar
item: desktop can open a compact popover or side inspector, while mobile should
open a bottom sheet. The creation flow should choose a reusable task preset,
confirm date/time, use or adjust needed count, add notes, and optionally assign
helpers later.

The Calendar should eventually feel closer to a minimal time-grid interaction
model. Empty areas should stay clean, with subtle separating time/day lines
rather than repeated visible "Add task" buttons everywhere. Clicking or
tapping an empty area may suggest a date or starting context, but should not
force a predefined time window. The creation flow should let the admin choose
or adjust start time, end time/time window, task preset, helper count, and
notes. The `Plan project work` surface should become lighter and less
intrusive over time, especially on desktop.

Future desktop Calendar should support drag/drop scheduling and moving
calendar work items. It may also support dragging task presets onto the calendar
and resizing scheduled blocks to adjust time. Mobile drag/drop should be
considered carefully; prefer tap/hold, edit mode, or simpler bottom-sheet
controls if direct drag/drop is too fiddly. Keep the Calendar powerful but
visually quiet: the grid should not look cluttered before the user takes
action.

Calendar now has mock Day/Week/Month/List view switching and a mock Filter
drawer/sheet. Calendar filters support task-name search, unfilled tasks, filled
tasks, tasks waiting on some confirmations, tasks with all helpers confirmed,
tasks with some/all helpers denied, and high-level task type filters: General
Volunteers, Food, and Security. Construction, cleanup, gate attendant, drywall,
concrete, room signage, water/coffee, and similar work roll up under General
Volunteers rather than becoming top-level filter types.

List is a compact companion for dense project weeks. It follows Week-period
navigation, groups visible work by date, keeps no-specific-time/date-based work
near the top, sorts timed rows chronologically, and shows each project window
once with its full range. Rows reuse the existing inspector and filter model;
the view remains local mock UI rather than a new scheduling contract.

The List visual polish keeps that behavior in a flatter scan: 36px date headers,
light dividers, and no enclosing rounded-card treatment. Rows now use a clear
name/schedule/type hierarchy with helper coverage anchored in a trailing chip.
Desktop uses three column-like zones and 56px minimum rows; mobile uses a
name/helper line plus full-width schedule and quiet type lines with a 72px
minimum, retaining full project-window wording and 390px overflow safety.

Calendar is stabilized for mock-prototype handoff after the interaction,
keyboard, focus-containment, and List hierarchy passes. Future List styling may
strengthen day separation with subtly tinted headers, more inter-group space, an
optional quiet left rail, or a stronger divider. Keep emphasis at the day-group
level so individual rows remain flat, calm, and subordinate to the existing
task/schedule/helper hierarchy.

Calendar now has a focused Playwright regression script that assumes a running
preview and checks the core desktop/mobile view, navigation, filter, inspector,
creation, focus-restoration, overlay-exclusivity, overflow, and browser-error
contracts. It intentionally remains a small script rather than a broad test
framework or persistence test suite.

The stabilized harness now shares preview URL/browser resolution with screenshot
capture, rejects invalid or unreachable targets before browser launch, reports
scoped interaction diagnostics, checks Week and List navigation explicitly, and
uses semantic mobile current-page state instead of styling classes. A future CI
job can manage the production preview lifecycle and invoke the existing command;
no CI provider or orchestration is coupled to the repository yet.

The keyboard/accessibility QA pass keeps normal document tab order while making
the current contracts explicit: Calendar controls and rows use native keyboard
activation and focus-visible treatment, toggle buttons announce pressed state,
closed filters are inert, Month background/event/overflow controls remain
siblings, and Mobile More now behaves as an expanded modal dialog with initial
focus, Escape dismissal, and trigger-focus restoration. Specialized grid arrow
keys remain future accessibility work.

Calendar-owned modal surfaces now share practical focus containment. The helper
selects only the visible desktop drawer or mobile sheet, wraps Tab and Shift+Tab
across enabled controls, and leaves normal Calendar grids untouched. Filters,
creation, inspector, and Mobile More retain initial focus, Escape dismissal, and
trigger restoration while exposing concise screen-reader descriptions. A full
ARIA-grid model and broader assistive-technology matrix remain future work.

Day and Month now provide the first grid-arrow foundation while preserving every
native Tab stop. Day moves among hour creation targets vertically; Month moves
among visible date creation targets horizontally, vertically by week, and to
grid boundaries. Enter/Space keep the existing draft defaults and modal focus
containment. Foreground Month events and overflow remain sibling controls outside
the arrow target set. Week's hour-level vertical model remains intentionally pending.

Week keyboard evaluation supports a deliberately smaller model than Day/Month.
The desktop timed grid exposes one full-column background per day, so Left/Right
and Home/End now move among Monday-Sunday while preserving the existing 9 AM
keyboard default; Up/Down would imply hour precision the DOM does not provide.
Project context uses a separate horizontal day-background group. Timed events,
project-window bars, overflow, Tab order, and modal behavior remain independent.

Future Calendar semantics should assume true all-day events are uncommon; most
full-day work can be represented as a normal timed block spanning the visible
workday. Reconsider whether Project context should be rare, collapsible, or
removed. Every `+N` must reveal useful hidden work: Month/Week may open Day or a
fuller List, while Day should expand or open a filtered fuller view rather than
navigate to itself.

The Calendar Week view has started moving toward the minimal time-grid
direction: subtler horizontal separators, quieter empty-space affordances, and
lighter scheduled-item blocks. Empty-slot creation now treats clicks/taps as
suggested calendar context rather than a committed predefined time window.
Timed rows seed specific editable start/end defaults, day-only clicks seed
editable defaults, and the creation surface remains preview-only without
saving or mutating data.

Day view now has a 24-hour vertical timeline foundation from 12 AM through
11 PM. Mock calendar items are placed in approximate starting-hour rows, and
empty hour rows quietly open the existing preview-only creation flow with a
specific editable one-hour time suggestion. Proportional block heights,
overlap handling, resizing, drag/drop, persistence, and production scheduling
logic remain future work.

Day no longer gives date-based/project-window compatibility items a large
section above the timeline. A hard-capped `Project context` strip shows one
intersecting item plus `+N`; Week retains its desktop top band, and Week,
Month, and the inspector remain the fuller date-based context surfaces.

Visible Calendar language now treats that Week top band as `Project context`,
uses `No specific time` for one-date untimed work, uses `Project window` for
date ranges, and frames creation as `Plan project work`. Internal mock
`allDay` compatibility fields remain unchanged until a real schedule-kind
migration is designed.

The Calendar grid has been simplified further: Day view no longer has an
internal scroll container, hour rows are thinner, Week columns are broad
clickable surfaces, and compact event blocks show only task name plus filled
count. Richer type/status/category/helper details remain in the inspector.

Month now uses skinny 16px rows with fixed responsive limits of six visible
items on screens 640px and wider and three below 640px. Breakpoint-specific
`+N` remains true overflow, focuses Day for that date, and stays a foreground
sibling of event chips and the full-cell background creation target.

Calendar overlays now use a single active-surface interaction model. Filters,
mobile More, empty-slot creation, and existing-item inspection are mutually
exclusive, and mobile Calendar actions close More/drawer controls before
opening their own panel. This remains UI-only and mock-only.

Target desktop sidebar:

- Overview.
- Tasks.
- Calendar.
- Needs Attention.
- More.

Desktop should keep a calm persistent sidebar. Needs Attention is a primary
action inbox, not buried under More. Food and Security remain workflow
categories within Tasks/Calendar. More contains Volunteers, Communications,
Settings, Contacts/Roles, project setup, Help, workspace switching, and Notes.

Target mobile bottom navigation:

- Overview / Home.
- Tasks.
- Calendar.
- Needs Attention.
- More.

Calendar should remain the emphasized scheduling action on mobile. More holds
Volunteers, Communications, Settings, Contacts/Roles, project setup, Help,
workspace switching, and Notes.

Trusted main project contacts should share one main app experience. The app
should still distinguish project/main contacts, assistant contacts, on-site
personnel, and volunteers, but should not split Main Contact, Main Food Service
Contact, and Main Security Contact into separate main-contact sign-in experiences.

Upcoming UI direction:

- Less text-heavy.
- Fewer sidebar items.
- Icon-supported where useful.
- Calm, premium, high-end, Apple-clean.
- Avoid giant stacks of cards.
- Show one thing at a time without removing power.
- Prioritize a focused calendar workspace.
- Make task creation feel simple and powerful.
- Keep older/low-tech users in mind.
- Make mobile feel app-like with the 5-tab bottom nav as the long-term target.
