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

This 11.14/11.16 command does not require a preview server. It refuses non-loopback Supabase and response-link base URLs, authenticates a disposable local project contact, exercises authorized issuance, and verifies route shape, redacted diagnostics, hash-only storage, denied revocation without `assignments.edit`, authorized revocation, and rejection of revoked public verification/response. It then removes all fixtures and checks for zero residue. `RESPONSE_LINK_BASE_URL` may override the default loopback origin for this local QA command, but the harness still rejects non-loopback values. No full response URL, bearer, verifier, password, or access token is printed.

The unlinked 11.15 route at `/admin/diagnostics/response-link` requires both a verified project-contact session and `RESPONSE_LINK_BASE_URL`. Use `http://127.0.0.1:3000` for local preview; deployed values must be HTTPS origins without credentials, paths, queries, or fragments. The browser supplies only assignment id and the fixed one-hour diagnostic TTL. The route displays `/respond/[redacted]`, expiration, and assignment id; it never displays or copies the full link, sends nothing, and immediately revokes the discarded diagnostic credential through the existing authorized helper. The 11.17 product policy does not make this a usable link surface.

## Workspace migration and type generation

The migrations are `supabase/migrations/20260701000000_workspace_identity.sql` through `supabase/migrations/20260702000000_atomic_response_token_replacement.sql`. Review them before applying them in timestamp order. The token migrations use `pgcrypto` from Supabase's `extensions` schema for secure random bytes and SHA-256 verification. With the Supabase CLI authenticated and this repository linked to the intended non-production project, run:

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

The hosted non-production gate passed on 2026-07-02 against `project-local-staging` (`kfuujcfxoayukywvtaeh`) through migration `20260701070000`. It exercised all 16 live RLS/RPC groups with disposable records and removed every fixture and temporary helper afterward. That project is for validation only, contains no real Belgrade production data, and must not be treated as a route-integration or production target.

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
