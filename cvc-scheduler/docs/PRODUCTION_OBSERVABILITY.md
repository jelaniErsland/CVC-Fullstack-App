# Production Observability

Iteration 12.32 establishes Project Local's application observability foundation. The code is proven locally; operator-level production visibility and alerting are not yet proven. The overall observability launch gate therefore remains blocking and launch remains `NO-GO`.

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

## Operator observability still required

Before the observability launch gate can pass, operators must document and prove:

1. Where production Vercel runtime events and deployment failures are reviewed.
2. Who owns alerts and incident response.
3. Which Auth, mutation, schedule-access, volunteer-response, email-stage, unexpected-runtime, and deployment failures require action.
4. How assignment-email failures are reconciled with the authoritative ledger.
5. The authorized stale-delivery read path, check cadence, threshold, and escalation procedure.
6. One controlled proof that a production-safe emitted event is visible to the operator without exposing prohibited material.

No Vercel alert, Resend webhook, Supabase hook, third-party monitoring product, custom telemetry backend, production environment change, or hosted access was added in 12.32.

## Local validation

`npm run test:production-observability` proves the server boundary, exact bounded shape, privacy rejection rules, logging-failure isolation, email stage distinction and sent outcome, non-mutating stale detection, representative beta-critical route instrumentation, no Client Component import, and absence of service-role/database observability behavior.

The focused email, Calendar, Volunteer, schedule-access, response, readiness, lint, TypeScript, build, and diff checks remain the supporting regression set. Application instrumentation may be marked proven when those checks pass; operator observability must remain blocking until the separate production evidence above exists.
