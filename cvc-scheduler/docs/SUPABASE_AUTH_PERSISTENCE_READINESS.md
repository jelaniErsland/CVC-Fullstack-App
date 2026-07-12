# Supabase, Auth, and Persistence Readiness

This document is the implementation-readiness bridge between the stable Project Local mock prototype and a future real-data phase. It records proposed boundaries, sequencing, and decisions that must be resolved before code is connected to Supabase.

Iteration 11.21 adds the credential-free audit persistence boundary required by the 11.20 reveal policy. It is not product UI, credential reveal, deletion, background cleanup, or delivery and adds no lookup, email, remembered-device behavior, Calendar/Volunteers/Communications/Needs Attention cutover, seed data, or broad schedule access.

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
