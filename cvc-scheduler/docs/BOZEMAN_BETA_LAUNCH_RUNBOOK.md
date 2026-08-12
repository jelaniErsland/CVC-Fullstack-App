# Bozeman Beta Launch Runbook

This runbook is the operational checklist for a future Bozeman Project Local beta launch. It is not permission to launch production. Belgrade Sheets/App Script remains the fallback.

Principle: **Cut features, not integrity.**

Current launch conclusion: `NO-GO`.

## Environment inventory

### Local

- Loopback Supabase only.
- Loopback production preview only for browser validation.
- Disabled by default; recording transport only for normal local/QA delivery-ledger validation, with fake-network Resend adapter regression.
- Disposable QA fixtures only.

### Staging

- Approved target: `project-local-staging` (`kfuujcfxoayukywvtaeh`).
- Required health: `ACTIVE_HEALTHY`.
- Current approved staging migration level for this gate: `20260811123300`. Historical 12.23/12.23.1 integrated evidence originally passed at `20260714122230`.
- Hosted validation must use exact opt-ins and disposable `qa-*` fixtures only.

### Production candidate

Production is partially configured but not launch-approved:

- Production Supabase exists as `project-local-production` (`wdlaauzknfggoqldolmx`) and is migrated through `20260714122230`.
- Vercel project `project-local` is live at canonical origin `https://projectlocal.app`; temporary Vercel alias `https://project-local-one.vercel.app` remains available.
- `ADMIN_AUTH_MODE` is enforced.
- Supabase Auth Site URL `https://projectlocal.app` and exact callback `https://projectlocal.app/admin/auth/callback` are configured; the temporary Vercel callback remains allowlisted for fallback.
- Manual magic-link sign-in passed on the final production origin.
- Commit `082c960` was pushed to `origin/master`, the Vercel Production deployment sourced from `082c960` reached Ready, and the exact final-domain `npm run test:production-deployment-smoke` gate passed after deployment with exit code `0`.
- Production Supabase is on the Free plan; Supabase-managed scheduled backups and restore-to-new-project are unavailable on that plan; PITR is unavailable and intentionally not required for the initial beta.
- 12.29 adds the preferred independent encrypted backup automation foundation; 12.34 proves its first read-only age-encrypted production backup, checksum/status, and retention behavior. 12.34.1 solves the managed-role boundary but stops full recovery on 26 unsafe restored `TRUNCATE` grants. 12.31 selects Resend, 12.32 proves the privacy-safe event foundation, and 12.33 proves the bounded Notification Health architecture/cadence through staging `20260811123300`. Application-driven email, full restore/post-restore proof, recurring backup scheduling/failure notification, real workspace provisioning, production Notification Health execution, and controlled pilot remain incomplete. Application transport is disabled, Supabase Pro remains optional, and Jelani's approved 12.30.1 UI remains non-blocking.
- Launch remains `NO-GO`.

Do not store secrets in documentation.

Production-readiness handoff docs:

- [`PRODUCTION_ENVIRONMENT_INVENTORY.md`](./PRODUCTION_ENVIRONMENT_INVENTORY.md)
- [`PRODUCTION_DEPLOYMENT_RUNBOOK.md`](./PRODUCTION_DEPLOYMENT_RUNBOOK.md)
- [`PRODUCTION_BACKUP_RECOVERY_RUNBOOK.md`](./PRODUCTION_BACKUP_RECOVERY_RUNBOOK.md)
- [`JELANI_PRODUCTION_SETUP_CHECKLIST.md`](./JELANI_PRODUCTION_SETUP_CHECKLIST.md)

## Auth and access

1. Create or invite approved project-contact identities through Supabase Auth administration.
2. Provision the Bozeman workspace/contact/grant rows through the reviewed 12.14 operator procedure.
3. Use only explicit capability sets.
4. Validate sign-in through normal app Auth.
5. Validate grants with the workspace provisioning and grant regressions.
6. Revoke access by revoking/expiring the relevant workspace grant or disabling the contact.

Role or title strings never authorize access.

## Bozeman workspace

Required metadata:

- Stable workspace key.
- Display name.
- Lifecycle.
- Trusted timezone.
- Optional project date range where supported.
- Public-intake configuration where supported.

Rollback/deactivation:

- Prefer deactivating/revoking workspace grants first.
- If necessary, archive/deactivate the workspace through reviewed operator procedure.
- Do not delete production records as a casual rollback.

## Volunteers

Minimum manual data-entry path:

- Open `/admin/volunteers`.
- Add permanent manual volunteer profile.
- Enter name plus at least one supported contact method.
- Set supported lifecycle/readiness fields.
- Save, reload, and spot-check persisted truth.

Controlled import remains unresolved and must not be improvised through unsafe SQL.

## Calendar operating loop

1. Open `/admin/calendar`.
2. Create a one-off timed draft or create from an active persisted task preset.
3. Edit supported date/time/needed-count/notes fields if needed.
4. Assign ready persisted volunteers.
5. Publish explicitly when the item should become visible.
6. Verify volunteer schedule visibility.
7. Review response state and coverage from assignment/current-response truth.
8. Use the Initial email action only during a separately reviewed controlled app-driven proof or later explicitly approved sending state; provider-level approval alone is insufficient.

Publishing is not emailing. Assigning is not emailing. Email failure does not unpublish an assignment.

## Email

Resend is the selected production provider and its server-only application transport is validated. August 10, 2026 operator evidence proves:

- `projectlocal.app` is verified and ready as the Resend sending domain.
- `Project Local <notifications@projectlocal.app>` is the verified sender.
- A restricted Sending-access key scoped to `projectlocal.app` is stored only as server-side `RESEND_API_KEY` in encrypted Vercel Production settings.
- `ASSIGNMENT_NOTIFICATION_BASE_URL=https://projectlocal.app` and the verified `ASSIGNMENT_NOTIFICATION_FROM` value are configured.
- `ASSIGNMENT_NOTIFICATION_RECORDING_PATH` is absent from production.
- Resend open and click tracking are disabled.
- A direct Resend-dashboard message reached an approved Gmail inbox, proving provider/domain/sender/basic inbox deliverability only.
- `ASSIGNMENT_NOTIFICATION_EMAIL_TRANSPORT` is currently absent after a temporary no-send enablement and removal; the resulting production deployment is Ready/Latest, so Project Local application email is disabled.

Still required before the Initial Assignment Email gate can pass:

- Backup/recovery and provisioning prerequisites sufficient for a reviewed controlled production-data test.
- An approved app-driven test recipient and explicit test procedure.
- Delivery through Project Local's actual Initial email action and `assignment_notification_deliveries` claim/provider/finalize boundary.
- Duplicate-send proof with real Resend.
- Schedule-access link proof from the app-generated assignment email.
- First production execution of the proven failure/stale-delivery monitoring path during the controlled app-driven test, plus real retry/failure procedure proof.

Do not log credentials, tokens, full schedule URLs, or raw provider payloads.

The validated boundary supports disabled, recording, and Resend transports. The 12.31 Resend regression uses injected fake HTTP responses, not the real provider network. The later direct dashboard message proves provider configuration/basic inbox delivery but does not prove the application boundary. Unknown transports and incomplete Resend configuration fail closed with no fallback. Keep production application transport absent/disabled until a separately reviewed controlled test is authorized.

## Observability

Application foundation proven in 12.32:

- Server-only, one-line structured runtime events with catalog-derived severity/category/stage/outcome and allowlisted failure codes.
- Representative Auth, Calendar, Volunteer, assignment, schedule-access, volunteer-response, and assignment-email instrumentation.
- Distinct assignment-email claim, schedule-access, provider, finalization, and sent outcomes.
- Route-unused, non-mutating stale-`sending` detection over an injected minimal projection.
- Deterministic capture tests, strict privacy rejection, and logging-failure isolation.

Operator evidence proven August 11, 2026:

- Runtime events are reviewed in Vercel -> `project-local` -> Logs, with search, severity, route/request/environment/status filtering.
- Deployment/build failures are reviewed in Vercel -> `project-local` -> Deployments and deployment build status/logs.
- The Project Local product/operator owner owns alerts and incident response and may use Codex or engineering assistance without transferring ownership.
- A controlled invalid schedule-access token request produced expected unavailable behavior, no data/email, and a searchable privacy-safe `schedule_access.exchange_failure` warning.
- Immediate-investigation and immediate-pause conditions are recorded in [`PRODUCTION_OBSERVABILITY.md`](./PRODUCTION_OBSERVABILITY.md).

Operator monitoring procedure:

- Preserve the 12.33 Notification Health cadence: after every controlled test/batch, before manual retry, and at the end of each active email day. Investigate any stale row immediately; pause sending for repetition or more than one unresolved stale row.
- Treat the manual check plus Vercel logs and named ownership as sufficient for the initial tiny beta. Revisit automated notification only if scale or response performance makes the manual cadence inadequate.

Monitor:

- Auth/sign-in failure.
- Calendar mutation failure.
- Volunteer Add/Edit failure.
- Assignment mutation failure.
- Volunteer schedule-access failure.
- Confirm/Deny mutation failure.
- Initial email failure state.
- Stale `sending` delivery rows.
- Unexpected server errors.
- Deployment health.

Logs must not include credentials, tokens, full schedule URLs, raw provider payloads, raw Supabase/provider errors, SQL, stack traces with secrets, grants, or capability arrays.

The canonical event/privacy/cadence contract is in [`PRODUCTION_OBSERVABILITY.md`](./PRODUCTION_OBSERVABILITY.md). The August 11 evidence proves the real-log workflow and 12.33 proves the stale-delivery architecture on local/staging. Production execution must wait for the reviewed production migration and controlled pilot.

## Backup and recovery

Detailed backup/recovery/rollback procedure is recorded in [`PRODUCTION_BACKUP_RECOVERY_RUNBOOK.md`](./PRODUCTION_BACKUP_RECOVERY_RUNBOOK.md). Before launch:

- Verify Supabase backup availability and retention.
- Define any manual export procedure needed for pilot data.
- Perform or schedule a restore test.
- Document app deployment rollback.
- Document migration-forward posture.
- Document workspace/grant deactivation fallback.
- Confirm email transport can be disabled quickly.
- Keep Belgrade Sheets/App Script available as operational fallback.

## Pilot

Run a small controlled pilot with disposable or explicitly approved Bozeman data:

- One workspace.
- One scheduler.
- One helper if needed.
- A small volunteer set.
- A small number of scheduled items.
- At least one assignment notification to an approved test recipient.
- Confirm/Deny verification on mobile.

Do not insert real Bozeman data automatically from tests.

## Stop conditions

Pause or roll back if any of these occur:

- Cross-workspace leakage.
- Wrong volunteer schedule exposure.
- Duplicate external email.
- Confirm/Deny corruption.
- Token or full schedule URL leakage.
- Broken mobile scheduling or response workflow.
- Unrecoverable data mutation.
- Production provider misconfiguration.
- Missing backup/recovery fallback.

## Validation commands

Use the current package scripts for focused validation, including:

- `npm run test:bozeman-beta-launch-gate`
- `npm run test:bozeman-beta-ui`
- `npm run test:bozeman-beta-launch:hosted`
- `npm run test:bozeman-beta-e2e:hosted`
- `npm run test:production-deployment-smoke`
- `npm run test:production-environment-readiness`
- `npm run test:production-supabase-schema`
- `npm run test:calendar`
- `npm run test:volunteer-profile-management:browser`
- `npm run test:volunteer-schedule-responses:browser`
- `npm run test:assignment-notification-email:hosted`
- `npm run test:assignment-notification-email:resend`

Hosted launch verification requires:

```powershell
$env:RUN_HOSTED_BOZEMAN_BETA_LAUNCH_VALIDATION='project-local-staging:kfuujcfxoayukywvtaeh'
npm run test:bozeman-beta-launch:hosted
Remove-Item Env:RUN_HOSTED_BOZEMAN_BETA_LAUNCH_VALIDATION
```

Hosted end-to-end beta loop validation requires:

```powershell
$env:RUN_HOSTED_BOZEMAN_BETA_E2E_VALIDATION='project-local-staging:kfuujcfxoayukywvtaeh'
npm run test:bozeman-beta-e2e:hosted
Remove-Item Env:RUN_HOSTED_BOZEMAN_BETA_E2E_VALIDATION
```

The 12.23.1 gate uses one disposable `qa-12-23-1-*` namespace and validates the continuous hosted staging loop across Auth/session, Volunteers Add/Edit, Calendar scheduling, assignment, publication, recording-only Initial email, secure schedule handoff, Confirm/Deny/Confirm All, admin response truth, negative paths, safe output, screenshot capture/removal, and zero residue. It does not send real email or target production.

Production Supabase schema validation is separate and passed in 12.25 as the initial/bootstrap empty-production gate against `project-local-production` (`wdlaauzknfggoqldolmx`) through migration `20260714122230`:

```powershell
$env:RUN_PRODUCTION_SUPABASE_SCHEMA_VALIDATION='project-local-production:wdlaauzknfggoqldolmx'
npm run test:production-supabase-schema
Remove-Item Env:RUN_PRODUCTION_SUPABASE_SCHEMA_VALIDATION
```

This production command is no-fixture and must refuse uncommitted worktrees, staging ref `kfuujcfxoayukywvtaeh`, enabled email transport, service-role runtime configuration, fixture flags, and wrong target identity. The 12.25 run confirmed generated-type parity, empty product/Auth/storage counts before Auth setup, public Supabase connectivity, and structural RLS/security checks; it did not create real data, send email, deploy, configure DNS, or configure Auth redirects.

After 12.26 manual Auth evidence, one or more approved Auth identities may legitimately exist. Do not delete or alter those identities to satisfy the historical bootstrap zero-Auth assertion. Future production migrations after Auth identities or real product data exist require a separately reviewed established-production migration/schema gate that verifies the intended live before/after state.

Production deployment smoke validation is retargeted in 12.27 for the canonical production origin:

```powershell
$env:RUN_PRODUCTION_DEPLOYMENT_SMOKE_VALIDATION='project-local|https://projectlocal.app|wdlaauzknfggoqldolmx|20260714122230'
npm run test:production-deployment-smoke
Remove-Item Env:RUN_PRODUCTION_DEPLOYMENT_SMOKE_VALIDATION
```

This production smoke command uses public unauthenticated GET requests only. It verifies the landing page, anonymous `/admin` redirect to `/admin/login`, safe login page render, invalid volunteer access redirect, unauthenticated `/v/schedule` unavailable state, same-origin redirects, volunteer-route no-store/noindex/no-referrer headers, and absence of raw internal/credential-like details. It does not request magic links, create Auth users, create fixtures, mutate data, call Vercel APIs, call Supabase APIs, configure email, or configure DNS/Auth redirects.

During 12.27 implementation, the command's refusal paths passed and the same public HTTP assertions passed against `https://projectlocal.app` through a separate non-mutating diagnostic. After commit `082c960` was pushed to `origin/master`, the Vercel Production deployment sourced from `082c960` reached Ready, and the exact final-domain production deployment smoke passed again with exit code `0`. Rerun the command after future deployment, domain, Auth redirect, or production environment changes.

Manual operator Auth evidence is recorded separately in `docs/PRODUCTION_DEPLOYMENT_STATUS.md`: an approved existing Auth email received a magic link, returned through `https://projectlocal.app/admin/auth/callback`, opened the admin shell, and then failed closed on `/admin/calendar` and `/admin/volunteers` because no Project Local workspace/contact/grant exists yet.
