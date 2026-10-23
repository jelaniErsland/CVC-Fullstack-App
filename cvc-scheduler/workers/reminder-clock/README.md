# Project Local reminder clock

Standalone Cloudflare Worker source in the application repository. Its own package/lockfile pins Wrangler 4.152.0; the Vercel app dependency graph is unchanged. Vercel imports only the small, platform-neutral HMAC protocol. Neither deployment invokes the other.

**Implementation/review only. Do not deploy, provision production secrets, or activate reminders without the separate owner release approval.**

## Clock and authentication

The production Cron expression is `*/5 * * * *` (UTC polling only; all reminder policy stays in the existing database/project timezone).

Each `scheduled()` event signs these UTF-8 lines with standard Web Crypto HMAC-SHA256:

```text
v1
<Unix timestamp in whole seconds>
POST
projectlocal.app
/internal/reminders
```

`X-Project-Local-Timestamp` contains the timestamp; `X-Project-Local-Signature` contains `v1=` followed by 64 lowercase hex characters. The signing secret is 32 random bytes encoded as 64 lowercase hex characters, stored as `REMINDER_SCHEDULER_HMAC_SECRET` in Cloudflare secrets and Vercel Production server configuration only. It is never sent in the request. No Authorization bearer fallback or cookie authentication is accepted.

The endpoint requires the exact HTTPS origin/path/method and no query parameters, accepts at most 120 seconds of clock skew in either direction (inclusive), and uses Web Crypto verification. It ignores request bodies; no body can specify an assignment, recipient, command, or workspace. An accepted request within that window can be replayed: there is deliberately no new persistent replay database. Existing occurrence keys, atomic claims, revalidation, and provider idempotency remain authoritative. Requests outside that window fail before any database operation.

One scheduled event makes at most one POST, with `redirect: manual`, a 10-second signal covering fetch/body consumption, and a maximum 4096-byte response. Every 3xx is failure and is never followed. There is no Worker-side retry. A timeout is an **unknown server outcome**, not proof the sweep did not execute. Public HTTP invocation returns 404 and never starts work. Logs contain only event/time/status class/duration/classification, never credentials, signatures, bodies, names, or assignments.

The authenticated Vercel handler reads authoritative activation status before provider configuration or initialization. Off means exactly one read and no synchronization, enrollment, occurrence, event, claim, or provider operation. Cloudflare receives only aggregate results; never the database JWT or volunteer data.

## Local checks (no Cloudflare login or hosted provisioning)

```text
npm ci --ignore-scripts
npm run check
node ../../scripts/reminder-clock-regression.mjs
node --conditions=react-server --experimental-strip-types ../../scripts/reminder-clock-local-e2e.mjs
```

The E2E requires the named local Supabase stack and a Wrangler dry-run bundle in `dist/`. It uses actual local workerd, intercepts ALL outbound traffic to the exact application handler, and accesses only local PostgREST with a locally signed restricted-role token. No real provider is available. The Node loopback test separately exercises real redirects and a stalled response. Set `WRANGLER_SEND_METRICS=false` for local tooling.

## Restricted database credential: future provisioning only

`REMINDER_DATABASE_JWT` exists only in Vercel server configuration, not Cloudflare, Vault, source, fixtures, logs or docs. Claims must contain the exact `project_local_reminder_worker` role and a finite expiry. Initial lifetime: 7 days; replace at least 48 hours before expiration. Record only issued/expiry/rotation-deadline metadata, never token contents.

Use an owner-authorized offline signer and an already accepted project signing mechanism; validate role/expiry metadata locally and test only the narrow status RPC after installation. Never put the project signing key in Vercel or Cloudflare. Current hosted metadata has an active ECC signing key and an accepted previous HS256 key, but no signing secret has been revealed in this batch. Hosted asymmetric private keys cannot be exported; do not pretend they can sign a custom token locally. A legacy signer is a separate sensitive release step requiring review of current acceptance, not a reason to rotate project-wide keys here.

New Supabase secret API keys map to broad elevated access; they are not an acceptable shortcut for a restricted worker identity. A new OIDC/signing integration would be a separate architecture change. If the accepted narrow-token issuance route is no longer available, stop before provisioning. Wrong role, expired credential or database rejection fails closed. No service_role fallback.

Rotation: create a replacement finite token through the same reviewed signer, update Vercel's server-only secret, deploy the same approved application SHA so the running process receives it, verify disabled status and expiry metadata, then retire the superseded local handling material. Replacing a token does not invalidate a stolen still-valid JWT; its narrow grants and short lifetime limit exposure. Emergency compromise: turn database delivery Off, disable Cron, rotate the HMAC secret, and use an owner-reviewed role/privilege or signing-key revocation plan if early JWT invalidation is needed. Do not broadly rotate project signing keys casually.

## Emergency stops

1. **Primary owner database stop:** in one transaction set `public.assignment_reminder_activation.delivery_enabled=false` for the singleton; preserve baseline/history. Future status checks exit immediately, claims and dispatch revalidation also fail closed. Already accepted/in-flight provider requests cannot be recalled; reconcile unknown outcomes rather than retrying them blindly.
2. **Independent clock stop:** remove the Cron Trigger in Cloudflare, or deploy the same approved Worker using `wrangler.disabled.jsonc` with environment `production`. That file explicitly sets `triggers.crons=[]` for BOTH scopes and the SAME Worker name. Merely deleting/commenting out Cron configuration leaves deployed triggers intact. Allow for Cloudflare schedule propagation; database Off is the immediate safety boundary.

Neither stop requires the permanent independent database backup task to be disabled or manually triggered.

## Future free B1 setup, ONLY after owner approval

1. Reconfirm the Cloudflare account remains Workers Free and has capacity (implementation review: Free current plan, zero Workers, zero requests). One Worker and one Cron are within Free limits (100 Workers, 5 Cron triggers, 100000 requests/day); five-minute polling is 288 events/day. Network wait is not CPU time. No payment/upgrade was requested during read-only inspection; if setup later requires payment or a paid plan, STOP.
2. Fresh Vercel/app/DB54/backup54/security preflight. Fresh encrypted DB54 checkpoint + exact isolated restore; install approved separate backup54->55 tooling; disable the idle backup; apply55 once atomically; verify only private activation support/ledger changed; advance only the disabled lock55; keep delivery false/baseline NULL.
3. Create the exact Worker code INERT using `wrangler.disabled.jsonc` / `production`, no public routes and no Cron. This creates the secret's destination without scheduling anything.
4. Through reviewed secret handling, provision matching HMAC secrets in Cloudflare and Vercel Production; provision the finite restricted JWT ONLY in Vercel. Never paste secrets into chat or command arguments. Configure before the app build that consumes the new server variables.
5. Deploy the exact approved application SHA through the controlled non-force Git/Vercel path. Require the hosted guarded Next16.2.7 receipt BEFORE compilation. Confirm Production/Ready, exact served SHA, and an authenticated disabled check with read-only fingerprints unchanged.
6. Enable only the reviewed Cron using `wrangler.jsonc` / `production`, deploying the SAME reviewed Worker source. Verify the actual trigger is exactly `*/5 * * * *`, not duplicated. No activation call.
7. Re-enable the independent backup at55 after successful postflight, normal03:15 intact; never trigger it manually.
8. Observe at least THREE NATURAL Cron runs. Each must authenticate and return disabled, with unchanged reminder fingerprints, zero provider operations and baseline NULL. Account CPU/free usage must remain healthy. STOP for separate owner ignition review.

Source references: [Cloudflare limits](https://developers.cloudflare.com/workers/platform/limits/), [Cron configuration/removal](https://developers.cloudflare.com/workers/configuration/cron-triggers/), [pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Supabase API key privileges](https://supabase.com/docs/guides/getting-started/api-keys), [signing keys](https://supabase.com/docs/guides/auth/signing-keys).
