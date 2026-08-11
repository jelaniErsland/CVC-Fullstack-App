# Production Observability

Iteration 12.32 establishes Project Local's application observability foundation. Iteration 12.32.1 records August 11, 2026 operator evidence that those events reach the actual Vercel Production runtime logs and can be reviewed safely. Runtime visibility, ownership, action conditions, deployment/build review, and one controlled production-safe observation are now proven. The overall observability launch gate remains blocking because stale-delivery monitoring and a practical notification mechanism are not yet proven. Launch remains `NO-GO`.

## Application foundation now proven

- `lib/observability/server.ts` is server-only and emits one-line structured JSON through normal server runtime logging, which is compatible with Vercel runtime logs.
- Event names, severity, category, stage, outcome, and allowed failure codes come from a fixed catalog. Callers cannot attach arbitrary fields.
- Timestamps come from the runtime unless a deterministic clock is injected for tests.
- The only optional correlation value is a validated UUID. It does not expose a bearer, URL, email address, or browser-visible identifier.
- Logging failures are swallowed; the original product operation and authoritative database ledger remain unchanged.
- Tests use an injected capture sink and fake email HTTP responses. No external telemetry or provider call is involved.

The stable event shape is:

```text
schemaVersion
event
severity
category
stage
outcome
timestamp
failureCode?   # allowlisted for the selected event
correlationId? # UUID only
```

The bounded event catalog covers:

- Auth callback failure.
- Calendar, Volunteer, and assignment mutation failure.
- Volunteer schedule-access exchange failure.
- Individual volunteer response and Confirm All failure.
- Assignment-email configuration, claim, schedule-access, provider, and finalization failure.
- Assignment-email sent as a high-value success outcome.
- Stale assignment-email `sending` delivery detection.

The user-facing error contract is unchanged. UI responses remain calm, credential-free, and non-technical.

## Privacy and security contract

Operational events must never contain:

- database passwords or service-role credentials;
- Resend API keys or authorization headers;
- Supabase access/refresh tokens, Auth codes, magic-link values, or session cookies;
- volunteer schedule or assignment-response bearers, verifiers, or hashes;
- full schedule URLs;
- recipient email, volunteer name, questionnaire answers, emergency-contact data, or arbitrary domain rows;
- arbitrary request bodies or `FormData`;
- raw provider/Supabase payloads, raw `Error` objects, SQL, environment dumps, grants, capability arrays, or stack traces.

The emitter accepts only the fixed input keys `event`, `failureCode`, and `correlationId`. Unknown keys, unknown events/codes, raw `Error` values, URLs, bearer-shaped correlations, and invalid timestamps are rejected. IDs are used only for operational correlation when already available inside a trusted server boundary; no ID is added to browser output for logging.

## Assignment-email stage model

The `assignment_notification_deliveries` ledger remains authoritative. Structured logging neither replaces nor mutates it.

The send boundary emits distinct safe stages for configuration, claim, schedule-access issuance/revocation, provider delivery, ledger finalization, and successful finalized delivery. It never emits the recipient, volunteer, provider request/response, provider message id, schedule bearer, full URL, API key, or raw exception.

## Stale-delivery seam

`lib/observability/staleAssignmentDeliveries.server.ts` is a server-only, route-unused, non-mutating detector. It accepts an injected bounded projection containing only delivery UUID, `sending` state, and expiration timestamp; identifies expired `sending` rows relative to an injected clock; and can emit a safe stale-delivery event.

It does not create a Supabase client, query a table, call an RPC, use service-role access, retry a delivery, send email, schedule a cron job, or mutate the ledger. A later reviewed operator slice must decide the authorized read path and check cadence.

## 12.32.1 operator evidence now proven

On August 11, 2026, the operator verified:

- Vercel project `project-local` exposes live production request/runtime entries under Vercel -> `project-local` -> Logs.
- Production Logs support search, warn/error/fatal severity filters, and route/request/environment/status filters.
- Deployment and build failures are reviewed under Vercel -> `project-local` -> Deployments and the selected deployment's build status/logs.
- The Project Local product/operator owner is the primary alert owner and incident-response owner. The owner may use Codex or engineering assistance to investigate or implement a repair; that assistance does not transfer operational ownership.
- A controlled GET to `https://projectlocal.app/v/access/not-a-real-token` produced the expected redirect/unavailable behavior, created no product data, and sent no email.
- Vercel Production Logs showed the corresponding structured event with `event=schedule_access.exchange_failure`, `severity=warn`, `category=schedule_access`, `stage=exchange`, and `outcome=failure`.
- The observed entry contained no volunteer name/email, bearer or token, full URL, Auth/session credential, provider payload, raw provider/Supabase error, SQL, grants or capability arrays, API key, or environment secret.

This is one narrow safe proof. It does not prove all failure paths, automated alert delivery, or stale-delivery monitoring.

## Operator action policy now recorded

Investigate immediately when any of the following occurs:

- a `fatal` event;
- repeated `error` events;
- repeated Auth, Calendar, Volunteer, assignment, schedule-access, or volunteer-response failures that impede normal operation;
- any assignment-email provider or finalization failure after Project Local application email is later enabled.

Pause affected operations immediately for:

- cross-workspace data exposure;
- wrong-volunteer schedule exposure;
- bearer/token/full-URL leakage;
- duplicate external assignment email;
- corrupted Confirm/Deny truth;
- an unrecoverable production mutation;
- provider or security misconfiguration.

Assignment-email failures must be reconciled against the authoritative `assignment_notification_deliveries` ledger before retry or operator disposition. Project Local application email remains disabled, so this policy does not authorize enabling the transport or sending a test email.

## Operator observability still required

Before the overall observability launch gate can pass, operators must still document and prove:

1. An authorized production read path for stale `assignment_notification_deliveries` that exposes only the minimum safe operational projection.
2. A stale-delivery review cadence.
3. A threshold and escalation procedure demonstrated in an operator workflow.
4. A practical notification or alert mechanism beyond manual Vercel Hobby log review, if manual review cannot meet the agreed response expectation.

The 12.32 stale detector remains route-unused, injected, non-mutating, and does not query production. No paid service, Vercel alert, Resend webhook, Supabase hook, telemetry backend, browser tracking, analytics, cron, background job, production environment change, or new hosted operation was added in 12.32.1.

## Local validation

`npm run test:production-observability` proves the server boundary, exact bounded shape, privacy rejection rules, logging-failure isolation, email stage distinction and sent outcome, non-mutating stale detection, representative beta-critical route instrumentation, no Client Component import, and absence of service-role/database observability behavior.

The focused email, Calendar, Volunteer, schedule-access, response, readiness, lint, TypeScript, build, and diff checks remain the supporting regression set. Application instrumentation, runtime-log visibility, ownership, action conditions, deployment/build review, and the single controlled event may be marked proven. Overall operator observability must remain blocking until the stale-delivery and practical-notification evidence above exists.
