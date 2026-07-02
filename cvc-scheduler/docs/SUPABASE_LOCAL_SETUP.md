# Supabase Local Setup Skeleton

Iteration 11.2 added environment/client boundaries, 11.3 added the invite-only project-contact Auth/session shell, and 11.4 adds one workspace identity migration plus an unused server-only reader. Project grants and route data cutovers are not enabled.

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
| `SUPABASE_SERVICE_ROLE_KEY` | No | Typed server-only placeholder. No current client or route consumes it for privileged access. |

Never prefix a service-role key, database password, provider secret, webhook secret, or token-signing secret with `NEXT_PUBLIC_`. Never import `lib/supabase/server.ts` from a Client Component. Never log keys or commit a populated environment file.

Deployment values belong in the deployment platform's encrypted environment settings. Use separate Supabase projects and credentials for local/development, preview, and production environments once those environments exist.

## Client boundary

- `lib/supabase/browser.ts` creates the cookie-compatible client used only by the contact sign-in form.
- `lib/supabase/server.ts` is protected by `server-only` and provides the cookie-aware client used by callback, sign-out, and server session inspection.
- `proxy.ts` refreshes/verifies the user only when `ADMIN_AUTH_MODE=enforced`; review mode makes no Auth request for admin pages.
- `lib/supabase/config.ts` validates required public values and keeps the optional service-role value typed and server-only.
- Generated database types are not committed yet because this repository has no linked/local schema output. The narrow workspace reader validates its result at runtime until real generated types replace the untyped client boundary.

Authentication answers who the contact is. `loadProjectContactGrants` deliberately returns an empty `not_implemented` state; it performs no query. A future grant slice must separately decide which projects and capabilities that identity may use before any product-data request is authorized.

## Contact auth behavior

- `/admin/login` requests a magic link only for an already invited Auth identity.
- `/admin/auth/callback` exchanges the one-time code for a cookie-backed session and accepts only sanitized local admin return paths.
- `/admin/auth/sign-out` is POST-only and clears the local Auth session.
- `review` mode preserves the current mock admin experience and offers a Prototype review entry.
- `enforced` mode redirects anonymous admin requests to sign-in. It checks identity only; it does not assert a project role or grant.
- Public volunteer and questionnaire routes do not import or use this Auth boundary. Volunteers still do not create accounts.

## Connectivity smoke check

With a populated `.env.local`, run:

```powershell
npm run supabase:check
```

The script loads the same local environment convention as Next.js and requests the Supabase Auth health endpoint with the public key. A successful result proves that the URL, public key, network path, and environment loading are wired. It does not sign in a user, create a session, query a product table, validate RLS, or prove that privileged credentials work.

Missing or invalid variables fail with a setup-oriented message. The command must be run deliberately; builds and current mock routes do not require Supabase configuration.

## Workspace migration and type generation

The migration is `supabase/migrations/20260701000000_workspace_identity.sql`. Review it before applying it. With the Supabase CLI authenticated and this repository linked to the intended non-production project, run:

```powershell
npx supabase db push
npm run test:workspace
```

The migration creates only `public.workspaces`; it adds no seed row. RLS is forced with no policy, so normal anon/authenticated reads return zero rows until the grants slice. Applying the migration does not authorize the signed-in contact.

After the migration exists in the linked database, generate real types rather than maintaining a handwritten database schema type:

```powershell
npx supabase gen types typescript --linked --schema public > lib/supabase/database.types.ts
```

For a configured local Supabase stack, use `--local` instead of `--linked`. Review and commit generated output, then parameterize the Supabase clients with `Database` in a dedicated follow-up. Do not generate from production as an ad hoc local workflow, and do not put database passwords or service-role keys in commands or committed files.

## Intentionally unimplemented

- Product tables beyond workspace identity, generated database types, seed data, and allow policies.
- Project-contact grants and membership-backed workspace policies; current workspace RLS intentionally reveals no rows.
- Project-contact invitation management UI, project grants, role/capability enforcement, and persisted authorization.
- Service-role operations.
- Volunteer lookup, secure/reminder tokens, remembered-device behavior, and response writes.
- Questionnaire, task, Calendar, assignment, communication, or follow-up persistence.
- Any mock-to-real route cutover.

The existing deterministic mock application remains the behavior reference. The next slice must not treat a successful health check as permission to query or mutate product data.
