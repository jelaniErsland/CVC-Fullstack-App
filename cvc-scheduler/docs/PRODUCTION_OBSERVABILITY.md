# Production Observability

Iteration 12.32 establishes Project Local's application observability foundation. Iteration 12.32.1 records August 11, 2026 operator evidence that those events reach the actual Vercel Production runtime logs and can be reviewed safely. Iteration 12.33 adds the minimum authenticated stale-delivery read, reuses the existing detector, exposes an unlinked Notification Health operator check, and proves the contract locally and on approved non-production staging. Runtime visibility, ownership, action conditions, deployment/build review, the controlled production-safe observation, and the initial-beta operator monitoring architecture are now proven. Production execution of the new read is deliberately not claimed. Launch remains `NO-GO` for separate application-email, backup/restore, provisioning, and pilot blockers.

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

## Stale-delivery read and detector

`public.read_assignment_notification_delivery_health()` is a no-argument, `stable`, `SECURITY DEFINER` RPC with an empty search path. It derives the caller from `auth.uid()`, requires exactly one active workspace reached through an active contact and active, current, non-revoked grant, and requires `workspace.read`, `calendar.view`, `assignments.view`, and `assignments.edit`. No eligible workspace and multiple eligible workspaces both fail closed. Execution is revoked from public/anon and granted only to `authenticated`; direct authenticated access to `assignment_notification_deliveries` remains revoked under FORCE RLS.

The RPC returns only `delivery_id`, `delivery_state`, and `sending_expires_at` for rows currently in `sending` state in the derived workspace. Results are ordered by earliest expiration and bounded to 100. It exposes no recipient, volunteer, provider, token, URL, raw error, grant, or capability data and performs no mutation.

`lib/observability/assignmentNotificationHealth.server.ts` calls only that RPC, validates the exact safe projection, and passes it to `lib/observability/staleAssignmentDeliveries.server.ts`. The existing detector remains the one stale definition: an expired `sending` lease is stale relative to the check clock. One operator check emits at most one existing `assignment_email.stale_delivery_detected` signal, even if multiple rows are stale. Neither helper retries, reclaims, finalizes, resends, revokes credentials, schedules work, or mutates the ledger.

The unlinked `/admin/diagnostics/notification-health` server route is dynamic/no-store and requires the existing Initial Email workspace/capability boundary. It shows only a calm healthy state, a stale count requiring review, or an unavailable state. It displays no delivery UUID or sensitive row detail.

## 12.32.1 operator evidence now proven

On August 11, 2026, the operator verified:

- Vercel project `project-local` exposes live production request/runtime entries under Vercel -> `project-local` -> Logs.
- Production Logs support search, warn/error/fatal severity filters, and route/request/environment/status filters.
- Deployment and build failures are reviewed under Vercel -> `project-local` -> Deployments and the selected deployment's build status/logs.
- The Project Local product/operator owner is the primary alert owner and incident-response owner. The owner may use Codex or engineering assistance to investigate or implement a repair; that assistance does not transfer operational ownership.
- A controlled GET to `https://projectlocal.app/v/access/not-a-real-token` produced the expected redirect/unavailable behavior, created no product data, and sent no email.
- Vercel Production Logs showed the corresponding structured event with `event=schedule_access.exchange_failure`, `severity=warn`, `category=schedule_access`, `stage=exchange`, and `outcome=failure`.
- The observed entry contained no volunteer name/email, bearer or token, full URL, Auth/session credential, provider payload, raw provider/Supabase error, SQL, grants or capability arrays, API key, or environment secret.

This is one narrow safe production-log proof. It does not prove all failure paths, automated alert delivery, or production execution of the 12.33 stale-delivery RPC.

## Operator action policy now recorded

Investigate immediately when any of the following occurs:

- a `fatal` event;
- repeated `error` events;
- repeated Auth, Calendar, Volunteer, assignment, schedule-access, or volunteer-response failures that impede normal operation;
- any assignment-email provider or finalization failure after Project Local application email is later enabled.
- any stale assignment-email `sending` delivery reported by Notification Health.

Pause affected operations immediately for:

- cross-workspace data exposure;
- wrong-volunteer schedule exposure;
- bearer/token/full-URL leakage;
- duplicate external assignment email;
- corrupted Confirm/Deny truth;
- an unrecoverable production mutation;
- provider or security misconfiguration.

Assignment-email failures must be reconciled against the authoritative `assignment_notification_deliveries` ledger before retry or operator disposition. Project Local application email remains disabled, so this policy does not authorize enabling the transport or sending a test email.

## Notification Health cadence and escalation

While Project Local application email is disabled, no routine stale-delivery check is required because the application cannot create a new `sending` lease.

Once application email is enabled for an authorized controlled test or pilot, the named operator must:

- check Notification Health after each controlled email test or batch;
- check before manually retrying any failed assignment email; and
- check at the end of each active scheduling day in which Project Local application email was used.

If any stale delivery exists, investigate immediately and reconcile it against authoritative `assignment_notification_deliveries` truth before any retry. Do not blindly resend. If stale deliveries repeat, or if more than one unresolved stale delivery is present, pause Project Local application email sending until the cause is diagnosed.

For the initial tiny controlled beta, this explicit operator check, the proven Vercel runtime-log workflow, the documented cadence, and named incident ownership are a sufficient practical manual notification mechanism. Automated stale-delivery alerting is not required at that scale and is not claimed as proven. Revisit automated notification if batch size, sending frequency, repeated stale leases, or operator response performance makes the manual cadence inadequate.

Overall application and operator observability architecture is therefore proven for the initial controlled-beta design. The later reviewed production migration/provisioning and controlled pilot must still record one production Notification Health execution. Real production Bozeman workspace/grant behavior and observation of a real production stale row remain unproven; 12.33 did not access production.

## Local validation

`npm run test:production-observability` proves the event boundary, exact bounded shape, privacy rejection rules, logging-failure isolation, email stage distinction and sent outcome, non-mutating stale detection, representative beta-critical route instrumentation, no Client Component import, and absence of a service-role observability path.

`npm run test:assignment-notification-health` additionally proves migration/type parity, authenticated/capability authorization, role-only denial, unique workspace derivation, ambiguity denial, wrong-workspace isolation, revoked/expired/inactive denial, sending-only minimal projection, the 100-row oldest-first bound, fresh/stale/empty detector states, one bounded event, direct table denial, no mutation, unlinked safe output, and local zero residue.

The opt-in hosted staging gate proves the same database boundary on `project-local-staging` (`kfuujcfxoayukywvtaeh`) through migration `20260811123300`, with exact-run and namespace residue both zero. No email was sent. Production was not accessed. The focused email, Calendar, Volunteer, schedule-access, response, readiness, lint, TypeScript, build, and diff checks remain the supporting regression set.
