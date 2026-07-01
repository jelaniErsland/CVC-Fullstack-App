# Supabase Local Setup Skeleton

Iteration 11.2 adds environment and client boundaries only. No route imports the clients, no product table exists, and no authentication or persistence behavior is enabled.

## Local environment

1. Copy `.env.example` to `.env.local`.
2. In the Supabase project API settings, copy the project URL into `NEXT_PUBLIC_SUPABASE_URL`.
3. Copy the anon or publishable key into `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Leave `SUPABASE_SERVICE_ROLE_KEY` empty. Add it only when a reviewed server-only operation explicitly requires elevated access.
5. Restart the development or preview server after changing environment values.

`.env.local` is ignored by Git. `.env.example` contains names and placeholders only and is intentionally committed.

## Environment boundary

| Variable | Browser-visible | Current use |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Lazy client configuration and the explicit smoke check. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Lazy client configuration and the explicit smoke check. It is not a service secret; future safety still depends on reviewed RLS. |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Typed server-only placeholder. No current client or route consumes it for privileged access. |

Never prefix a service-role key, database password, provider secret, webhook secret, or token-signing secret with `NEXT_PUBLIC_`. Never import `lib/supabase/server.ts` from a Client Component. Never log keys or commit a populated environment file.

Deployment values belong in the deployment platform's encrypted environment settings. Use separate Supabase projects and credentials for local/development, preview, and production environments once those environments exist.

## Client boundary

- `lib/supabase/browser.ts` is a lazy browser-client factory. It is unused today.
- `lib/supabase/server.ts` is protected by `server-only` and creates an anonymous, session-free server client. It is unused today and is not a substitute for the later authenticated server/session design.
- `lib/supabase/config.ts` validates required public values and keeps the optional service-role value typed and server-only.
- Generated database types do not exist because there is no product schema. Add them with the first reviewed schema slice, not as invented placeholder tables.

Do not create global clients merely to prove configuration. A future feature should choose the appropriate factory at its server/browser boundary and establish its authorization contract before making a product-data request.

## Connectivity smoke check

With a populated `.env.local`, run:

```powershell
npm run supabase:check
```

The script loads the same local environment convention as Next.js and requests the Supabase Auth health endpoint with the public key. A successful result proves that the URL, public key, network path, and environment loading are wired. It does not sign in a user, create a session, query a product table, validate RLS, or prove that privileged credentials work.

Missing or invalid variables fail with a setup-oriented message. The command must be run deliberately; builds and current mock routes do not require Supabase configuration.

## Intentionally unimplemented

- Product tables, generated database types, migrations, seed data, and RLS policies.
- Auth UI, contact invitations, sessions, middleware, protected routes, and project grants.
- Service-role operations.
- Volunteer lookup, secure/reminder tokens, remembered-device behavior, and response writes.
- Questionnaire, task, Calendar, assignment, communication, or follow-up persistence.
- Any mock-to-real route cutover.

The existing deterministic mock application remains the behavior reference. The next slice must not treat a successful health check as permission to query or mutate product data.
