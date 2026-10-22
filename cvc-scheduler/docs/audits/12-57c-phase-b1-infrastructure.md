# 12.57C Phase B1 — stopped before production provisioning

Production remains application `fb4a54a974d9124dd92143ae6545146b6168afc1`, database 54 / `20261021130000`. No production migration, application deployment, Cron, secret, worker credential, provider wiring, activation or operational mutation was performed. Real reminder emails/provider calls: ZERO.

## Fresh hosted inspection

Read-only production inspection verified the expected application Production/Ready, all ten retained catalogue/security fingerprints, exact 102-public-function policy, PUBLIC execute zero, four reminder tables RLS/FORCE RLS, disabled delivery, NULL baseline and zero reminder enrollment/occurrence/event/Communication records. The independent backup task remains Enabled/Ready/idle, migration54 lock and daily03:15 with its full definition unchanged.

Actual hosted capabilities: pg_cron 1.6.4 and pg_net 0.20.4 are available, neither installed; Vault 0.3.1 is installed. Both modules are preloaded and listed in the hosted privileged-extension configuration. No billing/plan change was made. The normal production postgres identity is not superuser and cannot SET ROLE supabase_admin. Ordinary anon/authenticated/worker roles cannot read Vault's decrypted view. The pre-existing privileged service_role has Vault read access; no secret was placed there by this work.

The owner restored dashboard sign-in. Metadata shows current ECC/P-256 signing and a previous still-accepted HS256 legacy key. The legacy secret was never revealed, copied or persisted. The reviewed finite custom-role JWT could use that existing accepted signing key without a project-wide key rotation. No token was issued.

## Blocking security finding

**Do not install the proposed migration with the ordinary postgres release connection.**

An isolated local test with the same available extension versions and Supabase extension-management hooks reproduced extension objects owned by supabase_admin. After installation, net.http_request_queue and net._http_response were SELECT-accessible to PUBLIC/application roles, and net schema/function grants were broader than the required worker boundary. A queued HTTP request contains its Authorization header, so the reviewed reusable Vault request bearer must not be provisioned into that queue while these grants remain.

The ordinary postgres role's REVOKEs produced warnings without removing owner-issued grants. Testing effective privileges caught this; checking only SQL success would have missed it. The migration now explicitly checks effective schema/table privileges and extension PUBLIC EXECUTE and raises a clear security-review error inside the migration transaction. A test proved that this refusal leaves ledger54, public data/functions, reminder state and extension installation unchanged.

This is a local reproduction of an unsafe managed-extension default, **not** a claim that absent production net tables already expose credentials. Hosted metadata confirms the normal release connection cannot assume the managed object-owner role. The remaining requirement is a supported, reviewed way to establish the required hosted extension ACLs before secrets are provisioned. Production extensions were not installed experimentally.

### Concrete architecture review needed

The preferred path retains Supabase Cron → pg_net → private worker and the existing narrow JWT role. It requires a Supabase-supported managed-owner operation that:

1. Installs the reviewed extension versions under the controlled migration/recovery protocol.
2. Removes PUBLIC/anon/authenticated/service_role/worker access to Cron/network schemas, functions, tables and sequences, including request headers/responses; grants only the required execution/diagnostic rights to the owner scheduler identity.
3. Verifies effective privileges rather than accepting REVOKE warnings.
4. Does not give the app, worker or ordinary coordinator supabase_admin/superuser privileges.
5. Preserves existing Vault and application security boundaries.

If a managed installation has to precede the normal ledger transaction, that platform step and migration55's reviewed-preinstalled-extension checks need separate explicit review; the current draft deliberately rejects unexpected preinstalled extensions. Do not bypass its guard. If Supabase cannot provide a supported grant-hardening path, an alternate invocation architecture must be approved before implementation. No fallback, extra privileged credential or project-wide signing-key change was silently substituted.

## Local implementation prepared (not deployed)

The runtime uses the existing server-only single-recipient transport and stable operation/recipient/attempt idempotency key. No independent provider stack is introduced. Database status false makes the engine return after a single SELECT-only status RPC, before sync/cursor writes, enrollment, due reads, claim, revalidation or provider dispatch. When enabled later, existing atomic claim and fresh database revalidation still precede provider invocation. Definite rejection and unknown/timeout/malformed acceptance retain existing outcome semantics.

The proposed migration55 `20261022120000_assignment_reminder_infrastructure.sql` installs extensions only if the effective grant gate can pass; adds one owner-only technical invocation relation and two owner-only functions in a separate, unexposed application infrastructure schema. That schema is included by the existing backup's non-managed-schema dump contract. No public function signature, table grant or existing RLS policy changes. The new relation uses RLS/FORCE RLS, stores only request ID/server time, has no sequence and bounds diagnostics retention to seven days. It contains no volunteer data or credentials.

`invoke_worker()` is owner-only SECURITY INVOKER with empty search_path. It reads one specifically named Vault request secret, targets the fixed HTTPS production endpoint, queues a 10-second HTTP POST and records only request ID/time. The source-controlled scheduler installer, not the migration, installs exactly one `*/5 * * * *` job after the healthy authenticated disabled-worker gate. Cron contains only the owner-only function call, no credential or volunteer data. Neither function nor installer was invoked in production.

### Future activation contract — not called in production

`project_local_reminder_infrastructure.activate_delivery(text)` is owner-only SECURITY INVOKER, empty search_path, inaccessible to anon/authenticated/service_role/worker. It requires the exact explicit owner-confirmation phrase, locks the singleton activation row, refuses an existing baseline/enrollment/occurrence/event/reminder-operation history and writes statement_timestamp() plus delivery=true atomically. It accepts no caller-supplied clock. A raised error rolls both fields back. No enrollment/send happens inside the activation function; the next bounded scheduled sweep performs prospective synchronization.

Existing pending assignments then anchor at the activation local date with first reminder +3 days at09:00. Confirmed assignments enroll only strictly future 30/14/7/3-day09:00 thresholds and previous-day17:00 final threshold. Existing sent/unknown history is not reset. Repeated activation refuses rather than changing the baseline. Only disposable local transactions tested activation; all were rolled back.

### Credential/storage plan — unprovisioned

Planned credentials are a dedicated 256-bit opaque request secret in Vault and server-only Vercel Secret, plus a finite custom-role JWT held only in a server-only Vercel Secret. The app would not hold a broad service-role credential or JWT signing key. Proposed JWT lifetime is seven days; record issue/expiry metadata only, rotate at least48hours before expiry using the same restricted role, deploy updated server secret, verify disabled/authenticated execution, then retire the old token. Do not rotate project-wide signing keys to rotate this token. Final TTL/operational rotation ownership remains for review; no actual expiration exists because no token was issued.

## Verification at the stop

- Fresh hosted preflight and unchanged security/function/backup state: PASS.
- Existing live unauthenticated worker POST:401, no dispatcher/provider call.
- Local private-endpoint requests without the dedicated secret, including admin/volunteer/Quick View cookie shapes and wrong-role bearer shapes: denied before RPC.
- Wrong-role/expired server worker JWT, unreachable RPC,401/5xx RPC, malformed JSON/status: fail closed with generic finite failure.
- Database false plus a production-shaped adapter and eligible fixture: only status called; zero provider calls.
- Accepted/rejected/unknown/timeout/malformed provider outcomes, stable provider key, overlapping claim ownership and changed eligibility: injected tests PASS, no external network/provider.
- Existing full reminder SQL regression (cadence, cutoff, thresholds, concurrency, retry, reschedule, privacy, DST and bounded plans): PASS locally; generated older EXPLAIN artifacts were restored rather than added to this diff.
- Normal-role migration installation: expected fail-closed grant blocker; atomic rollback PASS.
- Separate explicitly privileged local fixture: forced failure, clean apply, empty rollback/replay, owner-only infrastructure grants, unchanged public102-function policy/data, activation denial/atomic rollback: PASS. Local postgres privilege restored and local database returned to migration54 afterward. This privileged fixture does not represent an available production release credential.

The small UI draft retains the semantic Automatic reminders heading as screen-reader-only and removes the duplicate visible title/status inside the selected tab's card. The tab remains the visible status source. It is not deployed; final desktop/mobile review and production smoke are deferred at the security stop. No infrastructure terminology is added to normal admin UI.

## Remaining release steps — not performed

Managed grant-hardening architecture approval/proof; reviewed backup transition54→55; fresh encrypted54 checkpoint/exact isolated restore; controlled task-disable/migration/postflight/lock/deployment/re-enable; scoped secret/JWT provisioning; private endpoint authorized disabled proof; actual provider-configuration-only validation; scheduler installation and at least three genuine five-minute Cron runs; live preview/SELECT-only reconciliation and full production smoke. None may be represented as completed.

SEC-12.57-01 stays OPEN / SEPARATE. No bulk Communications household bearer-link behavior changed. Reminders still use public lookup links.

## Proposed final ignition checklist (future separate approval)

1. Refresh and review all live preview counts and project-local times.
2. Verify three healthy scheduled disabled executions, effective grants, valid/not-near-expiry worker credential and initialized production transport (no test mail).
3. Verify delivery=false, baseline=NULL, zero reminder state; capture fingerprints.
4. Obtain explicit owner approval for activation and real delivery.
5. Call the single owner-only activation operation once; verify its server baseline and delivery=true atomically.
6. Observe the next scheduled sweep, reconcile eligibility/claims/provider outcomes and durable history; stop on anomaly.

Steps4–6 are not authorized or performed in Phase B1. No manual reminder send is proposed.

**STOPPED BEFORE IGNITION**
