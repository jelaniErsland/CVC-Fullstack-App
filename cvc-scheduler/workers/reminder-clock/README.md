# Project Local reminder clock

Standalone Cloudflare Worker source in the application repository. Its own package/lockfile pins Wrangler 4.152.0; the app adds the separately pinned pg 8.23.1 driver. Vercel imports only the small, platform-neutral HMAC protocol. Neither deployment invokes the other.

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

The E2E requires the named local Supabase stack and a Wrangler dry-run bundle in `dist/`. It uses actual local workerd, intercepts ALL outbound traffic to the exact application handler, and accesses only local PostgREST with the passwordless-at-install runner provisioned only in local fixture memory. No real provider is available. The Node loopback test separately exercises real redirects and a stalled response. Set `WRANGLER_SEND_METRICS=false` for local tooling.

## Restricted database transport (replaces the rejected JWT plan)

Vercel uses only server-only `REMINDER_DATABASE_URL` plus `REMINDER_SCHEDULER_HMAC_SECRET`. No worker JWT, signing key, service_role or broad API secret is used. Cloudflare receives only the HMAC secret.

The canonical host was read from the hosted project Connect / Transaction pooler panel, not inferred from region: `aws-1-us-west-2.pooler.supabase.com`, port `6543`, database `postgres`, username `project_local_reminder_runner.<project-ref>`. Public reports can redact the project suffix. The driver rejects other host/port/user/database, URL query/startup options, and empty passwords. It explicitly supplies the public Supabase CA from authenticated Database Settings, requires certificate and hostname validation, and never falls back to plaintext or rejectUnauthorized:false. Public CA download SHA256: `700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7`.

Migration55 adds only `project_local_reminder_runner LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 2 PASSWORD NULL`, membership in the existing NOLOGIN worker with INHERIT=false, SET=true, ADMIN=false, and the private owner-only atomic ignition support. No direct business grants. A passwordless identity cannot authenticate. Password provisioning is a separate owner-controlled release step. Migrations53/54 remain unchanged.

The runner assumes the worker only inside each transaction: BEGIN, SET LOCAL ROLE, LOCAL statement/lock/idle timeouts, one parameterized call to run_assignment_reminder_worker, COMMIT, release. Claims commit BEFORE provider work; finalization uses a later transaction. Never hold one transaction around an external send. An ambiguous command/commit failure is not automatically retried. The existing durable claim/unknown/provider-idempotency design remains authoritative.

node-postgres uses one process-scoped pool (max1), 5s connect/acquire timeout, 10s client-query timeout, 8s LOCAL statement timeout, 3s lock timeout, 5s idle-in-transaction timeout, 1s idle socket expiry and 60s max connection lifetime. No named prepared statements, pipelining, user authorization cache or session-state dependency. Connections are released in finally; failed transactions are rolled back and their sockets discarded. Idle socket errors log generic metadata only.

Explicit owner-approved raw-Postgres exceptions: system catalogue metadata/function source is readable and temporary tables can be created. Permanent business-schema creation, business reads/writes, unrelated RPC execution, Auth/Vault access, activation and role escalation remain denied. NOINHERIT does not remove PUBLIC privileges. No shared catalogue/default privilege changes were made to disguise these exceptions.

## Password provisioning, rotation and emergency revocation

Future release only: generate a unique random password with at least32 random bytes in an owner-controlled secure local process. Do not put it in SQL source, arguments, terminal history, chat, files or reports. Provision via an encrypted owner administrative connection using an interactive password operation (for example psql password prompt with SCRAM), then submit the percent-encoded runner URL to Vercel Production through protected stdin/interactive secret entry. The administrative/backup credential is NEVER an application transport credential. Store the derived runner URL only in Vercel's sensitive server environment. New environment values require deployment of the same approved SHA. Source contains only the public CA.

Rotate with delivery Off and Cron disabled; replace the runner password once and update the Vercel secret/redeploy the same SHA. Supavisor can briefly cache credentials: allow bounded reconnect/recheck, no rapid retry loop or repeated password changes. The next five-minute invocation can retry connection establishment; an unknown database/provider operation must not be replayed blindly. A/B runner roles are deferred. Password changes and NOLOGIN do not terminate already-authenticated pooled backends.

Compromise: (1) database delivery=false, preserving history; (2) same Worker disabled config with explicit crons=[]; (3) owner ALTER ROLE project_local_reminder_runner NOLOGIN; (4) revoke its worker membership and terminate only its identified pooled backend sessions if immediate credential isolation is needed; (5) rotate password, inspect audit/unknown outcomes, then explicitly restore narrow membership/login after review. Auth keys, postgres password and normal users do not need rotation. Never recall an already accepted provider request or manually trigger the independent backup task.

## Hosted proof boundary — not yet approved

Read-only dashboard + official Supabase documentation confirm shared transaction pooling and custom-role username support. IPv4 DNS and a pre-authentication TLS1.3 handshake with the downloaded CA were verified, without any database authentication. This is NOT a Vercel custom-login proof.

Before claiming release readiness, obtain explicit permission for a disposable production role and a protected, status-only Vercel probe. Proposed scope: temporarily create the exact passwordless runner at DB54, grant only the worker SET membership, separately provision a high-entropy short-lived password (20-minute VALID UNTIL), store it only in the protected probe environment, test one transaction/role assumption/status Off/reset with no arbitrary command input or provider configuration, capture fingerprints, remove probe credentials/deployment and DROP the temporary role before migration55. No migration ledger, business data, production application, Worker or Cron change. Owner permission is mandatory because creating a role is a production mutation. A postgres/service_role connection is not a substitute. Upstream pooler-to-DB TLS also needs separate observation/contract confirmation; client-to-pooler verification alone does not prove that hop.

## Later production B1 release — do not execute

1. Resolve hosted proof above, complete release prep, obtain owner release approval; reconfirm Free account and exact candidates.
2. Fresh production preflight; fresh encrypted DB54 checkpoint + exact isolated restore of contracted public/Auth/security state.
3. Install approved independent backup54→55 tooling; disable the idle task, verify lock54/schedule; apply migration55 once atomically WITHOUT password; verify role graph, unchanged public102-function policy, Off/NULL/empty; advance only disabled lock55.
4. Create the reviewed Worker INERT using `wrangler deploy --config wrangler.disabled.jsonc --env production`. Both configs identify the SAME Worker and explicit crons=[] avoids/removes triggers. No public HTTP trigger.
5. Generate matching HMAC secret and provision Cloudflare using interactive `wrangler secret put REMINDER_SCHEDULER_HMAC_SECRET --config wrangler.disabled.jsonc --env production`; provision Vercel sensitive Production HMAC through protected stdin/interactive entry. No secrets as command arguments. Cloudflare never receives the runner password or URL.
6. Separately provision the runner password and Vercel-only REMINDER_DATABASE_URL as above. Verify exact host/user/port, CA/hostname validation, and tiny pool. No broad/signing credential in runtime.
7. Deploy exact approved application SHA via controlled non-force Git/Vercel path; require hosted guarded Next16.2.7 receipt before compilation; wait Production/Ready and exact served SHA.
8. Signed canonical endpoint while Off: one transaction/status read, no reminder mutation or provider work. Compare fingerprints.
9. Deploy SAME reviewed Worker via `wrangler deploy --config wrangler.jsonc --env production`; verify exactly one */5 Cron. Keep deliveryfalse/baselineNULL.
10. Re-enable independent backup at55, normal03:15 unchanged; never start it manually. Observe at least THREE NATURAL Cron invocations, each authenticating and returning disabled; reminder state unchanged, provider0, Free usage healthy. STOP for separate owner ignition approval.

Official references: [Supabase connection/custom-role contract](https://supabase.com/docs/guides/database/connecting-to-postgres), [rotation cache behavior](https://supabase.com/kb/troubleshooting/supavisor-error-password-authentication-failed-after-password-rotation), [node-postgres pools](https://node-postgres.com/apis/pool), [Cloudflare explicit Cron removal](https://developers.cloudflare.com/workers/configuration/cron-triggers/).