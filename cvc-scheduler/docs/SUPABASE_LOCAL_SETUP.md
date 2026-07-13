# Supabase Local Setup Skeleton

Iteration 11.2 added environment/client boundaries, 11.3 added the invite-only project-contact Auth/session shell, 11.4 added workspace identity, 11.5 added project-contact/workspace grants, 11.6 added questionnaire submissions, 11.7 added volunteer-profile conversion, 11.8 added reusable task presets, 11.9 added Calendar items, 11.10 added assignments/current responses, and 11.11 adds assignment-scoped public response bearer authorization. Product route data cutovers are not enabled.

## Local environment

1. Copy `.env.example` to `.env.local`.
2. In the Supabase project API settings, copy the project URL into `NEXT_PUBLIC_SUPABASE_URL`.
3. Copy the anon or publishable key into `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Keep `ADMIN_AUTH_MODE=review` while the mock admin must remain openly reviewable. Use `enforced` only when Auth is configured and admin routes should require a session.
5. Leave `SUPABASE_SERVICE_ROLE_KEY` empty. Add it only when a reviewed server-only operation explicitly requires elevated access.
6. Add `http://localhost:3000/admin/auth/callback` and each deployed equivalent to the Supabase Auth redirect allow list.
7. Invite or create approved project-contact identities in Supabase Auth administration. The app uses `shouldCreateUser: false`, so entering an unknown email cannot create an account.
8. Restart the development or preview server after changing environment values.

`.env.local` is ignored by Git. `.env.example` contains names and placeholders only and is intentionally committed.

## Environment boundary

| Variable | Browser-visible | Current use |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Lazy client configuration and the explicit smoke check. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Auth client configuration and the explicit smoke check. It is not a service secret; future product-data safety still depends on reviewed RLS. |
| `ADMIN_AUTH_MODE` | No | `review` leaves mock admin routes open; `enforced` requires a verified Auth user. Defaults to `review`. |
| `RESPONSE_LINK_BASE_URL` | No | Trusted server-side application origin for the unlinked 11.15 response-link diagnostic. Use loopback HTTP locally and HTTPS when deployed; never accept it from a browser form. |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Typed server-only placeholder. No current client or route consumes it for privileged access. |

Never prefix a service-role key, database password, provider secret, webhook secret, or token-signing secret with `NEXT_PUBLIC_`. Never import `lib/supabase/server.ts` from a Client Component. Never log keys or commit a populated environment file.

Deployment values belong in the deployment platform's encrypted environment settings. Use separate Supabase projects and credentials for local/development, preview, and production environments once those environments exist.

Operational diagnostics after 11.47:

- Do not print raw Supabase CLI/status/start output in a transcript when it may include generated keys, JWTs, access tokens, refresh tokens, database URLs, or local connection strings.
- Redirect Supabase start/status output to a temporary file when startup diagnostics are needed.
- Redact key-like values before displaying diagnostics.
- Prefer Docker/container status, port checks, and health endpoints for local troubleshooting instead of full Supabase environment blocks.
- Do not store diagnostic output files in the repository, docs, fixtures, screenshots, or test artifacts.

## Client boundary

- `lib/supabase/browser.ts` creates the cookie-compatible client used only by the contact sign-in form.
- `lib/supabase/server.ts` is protected by `server-only` and provides the cookie-aware client used by callback, sign-out, and server session inspection.
- `proxy.ts` refreshes/verifies the user only when `ADMIN_AUTH_MODE=enforced`; review mode makes no Auth request for admin pages.
- `lib/supabase/config.ts` validates required public values and keeps the optional service-role value typed and server-only.
- Reviewed generated public-schema types live in `lib/supabase/database.types.ts` and parameterize the shared Supabase clients and isolated persistence helpers. Runtime validation remains in place at helper boundaries.

Authentication answers which Supabase user is signed in. `loadProjectContactGrants` verifies that session identity and reads only active grants exposed by RLS. A matching `project_contacts` row still grants nothing by itself; workspace access requires a current `workspace_contact_grants` row containing `workspace.read`. Future product tables need their own capability policies and server validation.

## Contact auth behavior

- `/admin/login` requests a magic link only for an already invited Auth identity.
- `/admin/auth/callback` exchanges the one-time code for a cookie-backed session and accepts only sanitized local admin return paths.
- `/admin/auth/sign-out` is POST-only and clears the local Auth session.
- `review` mode preserves the current mock admin experience and offers a Prototype review entry.
- `enforced` mode redirects anonymous admin requests to sign-in. The proxy checks identity only; individual real-data boundaries must still enforce grants/capabilities.
- Public volunteer and questionnaire routes do not import or use this Auth boundary. Volunteers still do not create accounts.

## Connectivity smoke check

With a populated `.env.local`, run:

```powershell
npm run supabase:check
```

The script loads the same local environment convention as Next.js and requests the Supabase Auth health endpoint with the public key. A successful result proves that the URL, public key, network path, and environment loading are wired. It does not sign in a user, create a session, query a product table, validate RLS, or prove that privileged credentials work.

Missing or invalid variables fail with a setup-oriented message. The command must be run deliberately; builds and current mock routes do not require Supabase configuration.

## Public response route QA

The 11.13 positive route gate requires the local Supabase stack, local public values in `.env.local`, Docker, and a current production preview. In one terminal run:

```powershell
npm run build
npm run preview
```

Then, in another terminal, run:

```powershell
npm run test:response-route
```

The command refuses non-loopback Supabase and preview URLs. It creates disposable local Auth and product fixtures, issues one response bearer through the reviewed authenticated RPC, verifies the real route and `public_token` response persistence, and removes every fixture in `finally` with a zero-residue check. It does not read a service-role key, print a bearer or credential, create seed data, or target hosted projects. Run it again to confirm a fresh fixture set also passes.

## Response-link issuance QA

With local Supabase running and the local public values in `.env.local`, run:

```powershell
npm run test:response-link
```

This 11.14–11.23 command does not require a preview server. It refuses non-loopback Supabase and response-link base URLs, authenticates a disposable local project contact, and verifies issuance/replacement, redacted diagnostics, hash-only storage, revocation, public verification/response, credential-free reveal-audit persistence, and transactional replacement-plus-audit reveal. Checks cover direct-table denial, real Auth and `assignments.edit`, rollback, token scope/lifecycle, metadata allowlisting/bounds, concurrent single-active-token state, safe stored fields, and zero residue. `RESPONSE_LINK_BASE_URL` may override the default loopback origin for this local QA command, but the harness still rejects non-loopback values. No full response URL, bearer, verifier, password, or access token is printed.

The unlinked 11.15 route at `/admin/diagnostics/response-link` requires both a verified project-contact session and `RESPONSE_LINK_BASE_URL`. Use `http://127.0.0.1:3000` for local preview; deployed values must be HTTPS origins without credentials, paths, queries, or fragments. The browser supplies only assignment id and the fixed one-hour diagnostic TTL. The route displays `/respond/[redacted]`, expiration, and assignment id; it never displays or copies the full link, sends nothing, and immediately revokes the discarded diagnostic credential through the existing authorized helper. The 11.17 product policy does not make this a usable link surface.

## Assignment-detail context QA

With local Supabase running, run:

```powershell
npm run test:assignment-detail-context
```

The 11.26 command creates disposable local contacts in separate workspaces and proves that `assignments.view` alone can read one safe active assignment projection while under-capability, cross-workspace, missing, and canceled contexts return no row. It verifies edit is a boolean, product reveal remains false, no token/intake fields exist in the result, only the approved 11.30 route may import the helper, and cleanup leaves zero residue. It uses no service-role client and prints no credentials.

After 11.30, run the route-isolation guardrail as well:

```powershell
npm run test:assignment-detail-route
```

This static command requires no hosted data or preview server. It verifies the dynamic/no-store route exists, is the only route importing the approved detail-context helper, has no inbound product links, mock fallback, token/reveal/action imports, service-role path, or copy behavior. After 11.32 it also proves the route-unused product-action server boundary fails closed before reveal. After 11.33 it proves the future UI policy requires warning copy, visible expiration, explicit click/tap, no implicit reveal, and post-success-only manual copy while product action UI, copy affordance, and reveal availability remain false. After 11.34 it also proves the visible response-link shell is inert: no form, enabled button, hidden action metadata, clipboard behavior, generated URL field, token-table read, direct reveal RPC, or action binding exists. After 11.35 it proves the future wiring contract is explicit POST/server-action only, post-success-only for full URL/manual copy, route-boundary-only for action calls, and still unavailable for current route wiring. After 11.36 it proves no current Calendar, Volunteers, Needs Attention, Communications, public, diagnostic, response-token, or mock route links to the persisted assignment-detail route, and that future entry hrefs must come from persisted authorized assignment context without token, bearer, verifier, URL, audit, workspace, volunteer, grant, or capability data. After 11.37 it proves the enablement checklist exists, groups route/entry/action/UI/credential-log/browser/product-owner prerequisites, and keeps active reveal, copy, entry-linking, product-surface, reveal, and navigation flags false. After 11.38 it proves the route-unused disabled adapter rejects forbidden browser fields, defaults to credential-free disabled states, keeps final approval false, and does not call the 11.32 product-action boundary on the current path. After 11.40 and 11.41 it proves the server-action shape policy and disabled server-action stub stay adapter-only and credential-free. After 11.42 it also proves the disabled route-wiring policy is route-unused, future route calls are limited to the 11.41 stub, and direct adapter/product-action/reveal/RPC/token/replacement/diagnostic/service-role calls remain prohibited. After 11.43 it proves `/admin/assignments/[assignmentId]` is the only route importing the 11.41 stub, does not call or bind it to a form/action, has no hidden metadata or submit/copy affordance, and keeps final approval, active reveal/copy, product UI/surface, route server-action implementation, and navigation flags false. After 11.44 it also proves the route never passes the inert stub as a JSX/form/action/client prop, never renders hidden assignment id/TTL/action metadata, and adds no redirect, revalidation, cookie mutation, response-link form, generated URL field, copy affordance, or direct mutation/reveal path. After 11.45 it proves the disabled action-binding policy exists, remains route-unused, limits any future callable seam to the 11.41 stub, requires server-derived assignment id plus optional bounded TTL only, forbids hidden/browser metadata, and keeps disabled action-binding implementation plus all active reveal/copy/product/navigation flags false. After 11.46 it proves the assignment-detail route creates exactly one route-derived disabled binding to the 11.41 stub while still rendering no form/action prop, hidden assignment id, hidden TTL, hidden action metadata, submit control, result renderer, URL field, copy affordance, or direct adapter/product-action/reveal/token/service-role path; disabled action-binding implementation is true and all active reveal/copy/product/navigation flags remain false. After 11.48 it proves the disabled result-state contract exists, is server-only and route-unused, limits any future result renderer to credential-free disabled/error-like states from the 11.41 stub or reviewed successor, reserves URL-bearing success/manual copy for later reviewed slices, and keeps disabled/active result renderer implementation plus all active reveal/copy/product/navigation flags false. After 11.49 it proves the disabled result-renderer contract exists, is server-only and route-unused, consumes only sanitized 11.48 states, requires fixed allowlisted copy keyed by safe state codes, rejects raw error/provider/exception display paths, forbids renderer affordances and URL/token-like values, and keeps disabled/active/active-success result renderer implementation plus all active reveal/copy/product/navigation flags false.

After 11.39, run the focused disabled-adapter harness when changing the adapter:

```powershell
npm run test:assignment-detail-action-adapter
```

This command requires no preview server, hosted Supabase target, or service-role key. It proves valid assignment id input and bounded TTLs remain disabled/not-approved, malformed ids and forbidden browser-shaped fields fail closed, disabled results are credential-free, active availability flags remain false, and the product-action spy is called zero times while final approval is false.

After 11.41, run the focused disabled server-action harness when changing the route-unused stub:

```powershell
npm run test:assignment-detail-server-action
```

This command requires no preview server, hosted Supabase target, or service-role key. It proves the server-action stub is server-only, accepts only route-derived assignment id plus optional bounded TTL FormData, rejects unknown and forbidden browser-shaped fields, calls only the disabled adapter seam, returns only credential-free disabled states while final approval is false, and does not expose a URL, bearer, verifier, token/audit id, credential, SQL/internal RPC detail, sensitive intake value, or unrelated row marker. After 11.46 it also distinguishes the reviewed route-derived disabled binding from active invocation: the stub is route-bound but remains disabled by default and not normally user-submittable. After 11.48 and 11.49, disabled result rendering remains unimplemented; impossible success is still reduced to credential-free disabled states, and renderer readiness remains route-unused.

For the 11.31 visual/behavior gate, start a local production preview after building, then run:

```powershell
npm run build
npm run preview
# In another local shell:
npm run test:assignment-detail-route:browser
```

The browser command accepts only loopback Supabase and preview URLs. It creates a disposable authenticated contact with `assignments.view`, renders safe success and unavailable states at desktop/mobile widths, checks forbidden fields and unrelated rows, verifies the disabled response-link shell has no browser-submittable form/action markup, submit button, hidden assignment id/TTL/action metadata, generated URL field, or copy affordance and is absent from unavailable states, and removes all Auth/product fixtures in `finally`. After 11.44 it also clicks, hovers, and tabs around the disabled response-link panel while monitoring for forbidden POST, `/respond/`, diagnostics, response-link/reveal/copy/audit/token-like network traffic, navigation, browser errors, and 390px overflow. After 11.46 it verifies the authorized panel may mention the reviewed disabled binding while still exposing no normal submit path. After 11.48 it also fails on browser-visible result-state markup, while unavailable states still expose no response-link action/capability/binding/result detail. After 11.49 it also fails on retry/reveal/download/open-link/send renderer affordances. It writes no screenshot or credential artifact and requires no hosted environment.

To rerun the hosted non-production assignment-detail gate, reconfirm the linked staging project, then use its exact opt-in:

```powershell
$env:RUN_HOSTED_ASSIGNMENT_DETAIL_CONTEXT_VALIDATION='project-local-staging:kfuujcfxoayukywvtaeh'
npm run test:assignment-detail-context:hosted
Remove-Item Env:RUN_HOSTED_ASSIGNMENT_DETAIL_CONTEXT_VALIDATION
```

The command refuses every other target, uses disposable `qa-11-27-*` Auth/product fixtures, validates assignments-only safe projection and unavailable-context handling, and cleans exact-run plus namespace residue in `finally`. It issues no response token or link and outputs no credentials or intake values.

## Workspace migration and type generation

The migrations are `supabase/migrations/20260701000000_workspace_identity.sql` through `supabase/migrations/20260705000000_assignment_detail_context.sql`. Review them before applying them in timestamp order. The token migrations use `pgcrypto` from Supabase's `extensions` schema for secure random bytes and SHA-256 verification. With the Supabase CLI authenticated and this repository linked to the intended non-production project, run:

```powershell
npx supabase db push
npm run test:workspace
npm run test:grants
npm run test:questionnaires
npm run test:volunteers
npm run test:tasks
npm run test:calendar-items
npm run test:assignments
npm run test:response-tokens
```

The second migration creates only `public.project_contacts` and `public.workspace_contact_grants`; neither migration adds seed rows. Anon has no workspace table privilege. An authenticated user sees a workspace only when their active contact has an active, unrevoked, currently valid `workspace.read` grant for it. Authenticated roles receive no insert/update/delete grants.

The hosted non-production gate passed on 2026-07-02 against `project-local-staging` (`kfuujcfxoayukywvtaeh`) through migration `20260701070000`. Iteration 11.19 validated atomic replacement through `20260702000000`; iteration 11.22 validated reveal-audit persistence through `20260703000000`; iteration 11.24 validated transactional audited reveal through `20260704000000`. That project is for validation only, contains no real Belgrade production data, and must not be treated as a route-integration or production target.

To rerun only the hosted atomic replacement gate, first confirm the linked project name/ref, then set the exact opt-in for the current shell and run:

```powershell
$env:RUN_HOSTED_RESPONSE_REPLACEMENT_VALIDATION='project-local-staging:kfuujcfxoayukywvtaeh'
npm run test:response-replacement:hosted
Remove-Item Env:RUN_HOSTED_RESPONSE_REPLACEMENT_VALIDATION
```

The command refuses any other target, creates uniquely named disposable `qa-11-19-*` Auth/product fixtures, prints only summarized redacted results, and removes fixtures in `finally` with zero-residue checks. Run it twice for repeatability. It does not use a service-role client or write hosted secrets to the repository.

To rerun the hosted reveal-audit gate, reconfirm the linked staging project, then use the separate exact opt-in:

```powershell
$env:RUN_HOSTED_RESPONSE_REVEAL_AUDIT_VALIDATION='project-local-staging:kfuujcfxoayukywvtaeh'
npm run test:response-reveal-audit:hosted
Remove-Item Env:RUN_HOSTED_RESPONSE_REVEAL_AUDIT_VALIDATION
```

This command uses disposable `qa-11-22-*` Auth/product fixtures, validates audit denial and safe persistence plus replacement compatibility, and removes all fixtures in `finally`. Output is summarized and credential-free; exact-run and namespace residue checks must both return zero.

To rerun the hosted transactional audited-reveal gate, reconfirm the linked staging project, then use its separate exact opt-in:

```powershell
$env:RUN_HOSTED_AUDITED_RESPONSE_REVEAL_VALIDATION='project-local-staging:kfuujcfxoayukywvtaeh'
npm run test:response-reveal:hosted
Remove-Item Env:RUN_HOSTED_AUDITED_RESPONSE_REVEAL_VALIDATION
```

This command uses disposable `qa-11-24-*` Auth/product fixtures, proves no-mutation rollback and atomic replacement/audit coupling plus public use and concurrency, and removes all fixtures in `finally`. It outputs only summarized credential-free results; exact-run and namespace residue checks must both return zero.

Provisioning Auth users, contact records, and grants is intentionally an administrator-owned database/setup operation in this slice; there is no browser or admin UI mutation path. Use trusted Supabase administration for a non-production environment, never expose a service-role key to browser code, and record real provisioning/audit workflow requirements before production use.

The questionnaire migration creates one `questionnaire_submissions` table and the `submit_questionnaire_submission` function. Anon/authenticated callers can execute that function, but anon receives no table privileges and cannot list, read, update, or delete submissions. The security-definer function has an empty search path, fixes status/source/timestamps itself, validates the version and basic answer structure, and resolves only an active intake-enabled workspace. Review reads additionally require an effective grant containing `questionnaires.review`. No seed submission is added.

The volunteer migration creates one `volunteer_profiles` table and the authenticated-only `convert_questionnaire_submission_to_volunteer_profile` function. Application roles have no direct insert/update/delete privilege. Conversion accepts only a submission UUID, verifies `auth.uid()`, requires `questionnaires.review` plus `volunteers.edit` on the source workspace, accepts only a still-`submitted` version-1 source, derives every profile/scope value from that row, and leaves it unchanged. A composite foreign key and unique source constraint enforce same-workspace provenance and one conversion per submission. Profile reads require `volunteers.view`. Emergency-contact answers are not copied; they remain protected questionnaire truth.

The task migration creates one `task_presets` table, a bounded custom-field validator, and authenticated create/archive functions. Anon has no table/function access; authenticated table access is read-only through `tasks.view`. Create/archive verify `auth.uid()`, active contact/grant validity, and `tasks.edit`. Ordinary create accepts only reusable definition fields and always creates a non-system active preset. Archive applies only to non-system presets. A trusted future Lunch row can use `system_key = 'lunch'` with a required `menu` field, but this migration adds no seed rows or lunch scheduling. No date/time, Calendar, assignment, filled-count, recurrence, confirmation, or response data is stored.

The Calendar migration creates one `calendar_items` table plus authenticated create/archive functions. Anon has no table/function access; authenticated table access is read-only through `calendar.view`, while commands require `calendar.edit`. A composite foreign key enforces same-workspace task-preset references. Create accepts exactly one active preset reference or one validated one-off snapshot, derives preset snapshots and the workspace timezone in the database, and enforces the schedule-kind/date/time and planned-needed-count rules. Direct application writes are denied. No assignments, volunteer responses, confirmation states, coverage counters, recurrence metadata, communication/reminder state, or seed rows are added.

The assignment migration creates `calendar_assignments` and `assignment_responses`. Composite foreign keys derive and enforce one workspace across the Calendar item, active/ready volunteer profile, assignment, and response. Only timed/date-based active items may receive assignments. One volunteer may have at most one active assignment per item, while separate items are not conflict-checked. Creation also creates one `needs_response` row; project contacts can move that current row explicitly among `needs_response`, `confirmed`, and `declined`. Reads require `assignments.view`; create/cancel/response commands require `assignments.edit`. Direct application writes and anon access are denied. No public token, response history, coverage counter, reminder, or seed row is added.

The response-token migrations create one `assignment_response_tokens` table with no direct anon/authenticated table access. Issuance requires `assignments.edit`, resolves workspace and volunteer from an active assignment, creates 32 random bytes in PostgreSQL, returns the base64url bearer once, and stores only its SHA-256 verifier. The database's preview issuer accepts TTLs from 1–720 hours, while replacement applies the stricter 11.17 72-hour product default and 168-hour maximum. The 11.18 replacement RPC locks the assignment and atomically revokes older unrevoked same-assignment/purpose tokens before inserting one replacement. Tokens are revocable and successful public responses update `last_used_at`. No visible product route issues tokens or exposes a full link.

After the migration exists in the linked database, generate real types rather than maintaining a handwritten database schema type:

```powershell
npx supabase gen types typescript --linked --schema public > lib/supabase/database.types.ts
```

For a configured local Supabase stack, use `--local` instead of `--linked`. Review and commit generated output, then parameterize the Supabase clients with `Database` in a dedicated follow-up. Do not generate from production as an ad hoc local workflow, and do not put database passwords or service-role keys in commands or committed files.

## Intentionally unimplemented

- Product tables beyond workspace identity/authorization, questionnaire submissions, volunteer profiles, task presets, Calendar items, assignments/current responses, and assignment-response token verifiers; and seed data.
- Project-contact invitation/grant management UI, browser grant mutations, and audit history.
- Capability enforcement beyond the implemented workspace/questionnaire/volunteer/task/Calendar/assignment capabilities; grant roles do not confer other product permissions.
- Service-role operations.
- Volunteer lookup, reminder delivery/link transport, remembered-device behavior, and public route integration. The isolated assignment-response bearer RPCs are not a lookup or delivered reminder feature.
- Questionnaire status mutations, volunteer profile edits, task preset general updates, Calendar general updates, assignment general edits/response history, communication, or follow-up persistence.
- Any mock-to-real route cutover.

The existing deterministic mock application remains the behavior reference. The next slice must not treat a successful health check as permission to query or mutate product data.
