# Bozeman Beta Launch Runbook

This runbook is the operational checklist for a future Bozeman Project Local beta launch. It is not permission to launch production. Belgrade Sheets/App Script remains the fallback.

Principle: **Cut features, not integrity.**

Current launch conclusion: `NO-GO`.

## Environment inventory

### Local

- Loopback Supabase only.
- Loopback production preview only for browser validation.
- Recording email transport only.
- Disposable QA fixtures only.

### Staging

- Approved target: `project-local-staging` (`kfuujcfxoayukywvtaeh`).
- Required health: `ACTIVE_HEALTHY`.
- Required migration level for this gate: `20260714122230`.
- Hosted validation must use exact opt-ins and disposable `qa-*` fixtures only.

### Production candidate

Production is not configured or approved by this runbook. Before launch, record and verify:

- Hosting platform. 12.24 recommends Vercel for the first production deployment based on this Next.js repository shape.
- Production Supabase project.
- Production deployment target.
- Production domain and `ASSIGNMENT_NOTIFICATION_BASE_URL`.
- Auth redirect allowlist.
- Email provider, sender domain, sender identity, and provider secret.
- Logging, alerting, backups, restore testing, and rollback procedure.

Do not store secrets in documentation.

Production-readiness handoff docs:

- [`PRODUCTION_ENVIRONMENT_INVENTORY.md`](./PRODUCTION_ENVIRONMENT_INVENTORY.md)
- [`PRODUCTION_DEPLOYMENT_RUNBOOK.md`](./PRODUCTION_DEPLOYMENT_RUNBOOK.md)
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
8. Use the Initial email action only when provider configuration is approved.

Publishing is not emailing. Assigning is not emailing. Email failure does not unpublish an assignment.

## Email

Required production decisions before launch:

- Provider.
- Verified sender domain.
- Sender identity.
- Provider secret.
- Production base URL.
- Test recipient policy.
- Deliverability verification.
- Failure monitoring.
- Retry and duplicate-send procedure.
- Incident procedure.

Do not log credentials, tokens, full schedule URLs, or raw provider payloads.

The current validated transport is recording-only. Recording validation is not production deliverability proof.

## Observability

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

## Backup and recovery

Before launch:

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
- `npm run test:production-environment-readiness`
- `npm run test:calendar`
- `npm run test:volunteer-profile-management:browser`
- `npm run test:volunteer-schedule-responses:browser`
- `npm run test:assignment-notification-email:hosted`

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
