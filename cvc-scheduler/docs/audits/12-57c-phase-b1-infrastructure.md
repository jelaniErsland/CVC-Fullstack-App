# 12.57C revised Phase B1 — external Cloudflare clock

Implementation only. Production remains application fb4a54a974d9124dd92143ae6545146b6168afc1 / DB54 (20261021130000), delivery Off, baseline NULL. No production Worker, Cron, secret, JWT, provider wiring, migration or deployment is authorized by this document.

## Final architecture

Cloudflare Workers Free scheduled() -> one canonical HTTPS POST with HMAC-SHA256 -> Vercel server-only handler -> restricted finite worker JWT -> existing narrow status RPC -> disabled immediate return. Cloudflare owns no eligibility, recipient, timezone, claim or provider logic.

The shared Web Crypto protocol, bounded Worker, independent Wrangler package and exact provisioning/rotation/kill-switch runbook are in [workers/reminder-clock/README.md](../../workers/reminder-clock/README.md). Both rejected database HTTP architectures are removed from the migration and installation path. The historical pg_net candidate79b008d is not deployable.

## Scope and state

- Migration55 now creates ONE private schema and ONE owner-only, SECURITY INVOKER activation function with empty search_path. No extensions, diagnostics tables, scheduler, Vault state or delivery backfill. It refuses anything except exact54 and disabled/NULL/empty reminder history.
- Existing read/write table grants, RLS, public functions, worker role and narrow RPC remain unchanged; contracted public function policy remains102 with PUBLIC EXECUTE0. New private function has no PUBLIC/application/worker EXECUTE and no application schema USAGE.
- True activation atomicity cannot be supplied by two independent PostgREST writes: the private SQL function locks the singleton, validates explicit owner confirmation and empty history, and writes statement_timestamp baseline + true in one transaction. It sends/enrolls nothing. It is never called in production by B1.
- Worker scheduled requests have no body and contain no shared secret value. v1 signature binds timestamp, method, canonical hostname and path. Exact HTTPS origin/path/method and no query string are required. ±120s clock skew allowed; older/further-future signatures rejected. Same valid signature may be replayed within this window; durable database/provider idempotency remains authoritative.
- All 301/302/303/307/308 are rejected with redirect:manual. One invocation <=one request, no retries, 10-second deadline including body consumption, <=4096-byte response, no public HTTP trigger. Logs are strictly operational metadata.
- Provider configuration/adapter initialization is lazy AFTER authoritative status. Off performs only status; On without valid provider config returns honest503 before writes. Existing provider abstraction and accepted/rejected/unknown/stable-key behavior retained.
- Small Communications duplicate-heading cleanup retained: visible tab owns heading/Off badge; card retains accessible sr-only heading and normal human copy. No activation control or infrastructure jargon.

## Account/platform review

Read-only authenticated Cloudflare dashboard inspection: Workers Free is Current plan; no Workers/projects exist; requests today0/100000. Account's displayed Free limits:100 Workers,5 Cron Triggers,50 subrequests per invocation,10ms CPU. No upgrade/payment details requested during inspection, and no Create/Deploy action performed. One Worker/Cron,288 polls/day fits documented limits. Hosted CPU/account deployment acceptance must be confirmed during the later approved release; stop if a paid-plan/payment requirement appears. No paid subscription was accepted.

Current canonical production route responds405 to HEAD without redirect (no Location). Current unsigned POST must fail authentication; the revised signed path is tested locally before later production setup.

## Test evidence

- Standard HMAC compared with an independent Node crypto result; wrong signature/secret/method/host/path/query/protocol, malformed timestamp and ±120s boundaries fail correctly. No cookie/admin/volunteer/Quick View/bearer substitute. No raw scheduler secret transmitted.
- Real loopback redirect matrix: exactly1 source request each; second origin receives0. Stalled HTTP body terminates around10002ms, no retry. DNS/connection failure,401/403/404/429/500, malformed/oversized JSON tested with injected/local transports only.
- Wrangler4.152.0 dry build: ~3.7KiB source/~1.6KiB gzip. Actual local workerd scheduled handler verifies the same redirect matrix. First disabled event: one outbound intercepted canonical request, one REAL local restricted-role PostgREST status read,0 provider initialization/writes. Public/Auth and sequence fingerprints match exactly. Two overlapping disabled events likewise remain read-only.
- Existing local reminder suite passes cadence/local09:00/day-before17:00/future-only/DST/overnight/shared household/privacy/reschedule/retry/backoff/unknown outcome/15min windows. Simultaneous DB workers obtain one claim/provider opportunity. Added emergency-Off test rejects and invalidates a claimed dispatch.
- Migration54->55 forced failure, clean apply, empty rollback/replay, unsafe baseline/history refusal, owner/ACL/search_path, public/Auth/RLS/policy/default grants unchanged, exact102-function policy pass. Activation tests execute only inside disposable LOCAL transactions that roll back; no baseline persists. No HTTP/Cron extensions installed even locally.
- TypeScript/full ESLint/whitespace pass. Main guarded Webpack passes with Next16.2.7 verification receipt before compile. Canonical Turbopack, canonical instruction-privacy and final build receipts are recorded in the final release-prep evidence/report.

## Separate tooling

Backup contract candidate eda22abad6f92f63db0af0ab9fda9434b01afcb4 adds exact54->55 and retains51->52/52->53/53->54. Fixture tests deny skipped/reverse/unknown/no-op/wrong identity/current/target/runtime/Enabled/Running/Queued/Duplicate states. NOT installed. Active permanent task remains Enabled/Ready at54,03:15; never triggered.

## Later production B1 and ignition boundary

Follow the README dependency order: fresh54 checkpoint + exact restore; approved independent backup tooling; disable idle backup, apply55 once, postflight/lock55; deploy inert Worker with explicit empty Cron; provision matching HMAC and Vercel-only finite JWT through reviewed handling; deploy exact application with hosted guard; verify disabled; enable exact five-minute Cron; restore backup Enabled55; observe >=3 NATURAL disabled runs with unchanged reminder fingerprints; STOP for owner ignition approval. No activation during B1.

Primary emergency stop: database delivery=false, preserving baseline/history. Independent stop: Cloudflare Cron deletion or SAME Worker deployment using wrangler.disabled.jsonc (explicit crons=[]; merely omitting the property does not remove triggers). In-flight/accepted provider requests cannot be recalled; unknown outcomes must be reconciled without blind resend.

## Limitations

- No production Cloudflare request or credential has been provisioned; three natural hosted runs and actual hosted CPU measurements belong to the approved release.
- Current hosted signing metadata has an active ECC key and accepted previous HS256 key; no secret revealed. Accepted finite custom-role token issuance must be reconfirmed during provisioning. New broad Supabase secret keys are not a substitute. Rotation>=48h before7-day expiry requires an operational owner; no new credential automation was authorized.
- Local workerd outbound interception models TLS/network routing; the HMAC handler and database RPC are real. A compiled production-mode endpoint check is recorded separately. Local results are not hosted latency claims.
- SEC-12.57-01 remains OPEN / SEPARATE and unchanged.

Real provider calls: ZERO. Production mutations: NONE. Delivery remains OFF; baseline remains NULL.

## Final implementation verification

- Clean canonical Git export + locked install: guarded Next16.2.7 Turbopack and Webpack both PASS; successful guarded-router receipt occurs before compilation. Root application package/lockfile versions unchanged; the standalone Wrangler package has its own intentional lockfile.
- Actual workerd -> local HTTP/TLS-termination fixture -> COMPILED production Next route -> actual local restricted JWT PostgREST status: PASS. Exactly1 request/1 status read on a valid disabled run; unsigned bearer/cookie denied before DB; public/Auth fingerprints exact; no forbidden/provider network. Direct handler test also verifies real PostgREST rejection of a forged JWT, with zero provider initialization/writes.
- Component SSR Off/On fixtures: PASS, accessible hidden heading, no duplicate visible card heading/badge, human copy, no activation/infrastructure controls, preview initially closed and no initial action/read. Optional live visual browser spot-check was blocked by another Chrome extension panel; NOT reported as passed. Disposable local fixture removed and loopback server stopped. Repeat that visual spot-check during release prep.
- Quick View privilege hardening, assigned-contact authorization/privacy, table/default privileges, project/grant isolation and canonical instruction-security regression: PASS. No client-bundle occurrence of the server-only reminder credential environment names.
- TypeScript, full ESLint, whitespace and credential scan: PASS (670 tracked text files at scan time;20 inherited fixture-pattern findings,0 new findings; JSONC included).
- Final read-only production comparison: all10 catalogue/security categories, exact102-function policy and sequences unchanged.31/33 public/Auth relation fingerprints match; volunteer_lookup_attempts changed at the same row count and volunteer_schedule_access_tokens increased567->569. These are access bookkeeping changes consistent with normal volunteer use, not caused by these local tests. Assignment/response/Communications/reminder state fingerprints match. No production volunteer lookup or response submission was performed by this batch.
- Production still fb4a54a974d9124dd92143ae6545146b6168afc1, Vercel Production/READY, DB54/20261021130000. Unsigned canonical POST returns401 without redirect; no HMAC/JWT production env configured. No production Cron/Vault/Worker created. Permanent backup remains Enabled/Ready/idle/lock54/daily03:15 with all other definition fields unchanged.

Candidate is for revised B1 RELEASE PREP only, not deployment or ignition approval. Hosted CPU/three natural Cron runs, finite credential issuance/rotation ownership and the optional browser visual check remain explicit release-prep/setup checks. Real provider calls ZERO; production mutations NONE; delivery OFF and baseline NULL.
