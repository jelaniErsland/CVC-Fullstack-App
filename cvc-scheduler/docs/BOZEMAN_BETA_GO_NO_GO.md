# Bozeman Beta Go/No-Go

Conclusion: NO-GO

The persisted beta scheduling loop is technically proven through focused local gates, focused hosted staging gates, and the 12.23.1 integrated hosted end-to-end loop. Iteration 12.30 was functionally validated but rejected in product-owner visual review. Iteration 12.30.1 is explicitly product-owner approved by Jelani: the corrected beta-critical UI direction and all six desktop/390px review captures were reviewed and accepted. The UI gate is proven and no longer blocking, but production launch prerequisites remain unresolved. An honest NO-GO means the launch gate is doing its job; it does not mean the implementation failed.

## Decision matrix

| Gate | Status | Evidence | Owner/action | Blocking |
| --- | --- | --- | --- | --- |
| Workspace/contact/grant provisioning | Operator required | 12.14 boundary and local validation exist | Provision real Bozeman workspace and approved contacts through reviewed operator procedure | Yes |
| Volunteer Add/Edit | Proven | `/admin/volunteers`, 12.15.1 hosted gate, local/browser regressions | Pilot with approved Bozeman volunteer data | No |
| Calendar create/edit/source/assignment/publish | Proven | 12.16 through 12.19.1 hosted gates; `npm run test:calendar` | Controlled pilot spot checks | No |
| Volunteer schedule and Confirm/Deny | Proven | 12.20/12.20.1 and 12.21/12.21.1 hosted gates | Final mobile pilot | No |
| Initial assignment email boundary | Configuration required | 12.22.1 hosted gate passed through `20260714122230` with recording transport | Approve/configure provider, sender domain, sender identity, secret, base URL, monitoring, and test-recipient policy | Yes |
| Integrated hosted beta loop | Proven | 12.23.1 ran one continuous disposable namespace through Volunteer Add/Edit, Calendar scheduling, assignment, publication, recording-only email, secure schedule access, Confirm/Deny/Confirm All, admin response truth, negative paths, and zero residue | Repeat before final launch review if staging/schema changes | No |
| Hosted staging state | Proven | `project-local-staging` (`kfuujcfxoayukywvtaeh`) validated through `20260714122230`; generated-type parity, focused hosted gates, launch verification, and 12.23.1 integrated zero-residue gate passed | Rerun exact hosted launch/E2E gates before final launch review if needed | No |
| Beta-critical UI | Proven | 12.30 was visually rejected despite functional validation. Jelani explicitly product-owner approved the corrected 12.30.1 shared shell, real Calendar, real Volunteers, and secure volunteer schedule against [`design/approved-project-local-ui`](./design/approved-project-local-ui/), and reviewed and accepted all six real-route desktop/390px captures in [`previews/beta-review`](./previews/beta-review/) | Preserve the approved baseline; any later visual direction change requires separate explicit review | No |
| Production deployment/domain/Auth | Proven | Vercel project `project-local` is live at canonical origin `https://projectlocal.app`; temporary Vercel alias `https://project-local-one.vercel.app` remains available; `ADMIN_AUTH_MODE` is enforced; Supabase Auth Site URL and exact final-domain callback are configured; temporary Vercel callback remains allowlisted; manual magic-link sign-in passed on the final domain; no-grant admin routes failed closed; commit `082c960` was pushed to `origin/master`, the Vercel Production deployment sourced from `082c960` reached Ready, and the exact final-domain production smoke passed before push and after deployment with exit code `0` | Rerun the public smoke only after deployment/domain/Auth/environment changes | No |
| Production environment readiness | Partial | Production deployment/domain/Auth is proven; production Supabase schema is migrated through `20260714122230`; 12.28 documents recovery procedures; 12.28.1 confirms production Supabase is on Free and managed backups/restore-to-new-project are unavailable on that plan | Complete email/provider deliverability, observability, a reviewed independent encrypted backup path or optional Supabase-managed Pro path, restore testing, real provisioning, and pilot evidence | Yes |
| Production Supabase schema | Proven | 12.25 ran the initial/bootstrap empty-production `npm run test:production-supabase-schema` gate against `project-local-production` (`wdlaauzknfggoqldolmx`); production is migrated through `20260714122230`, generated-type parity passed, product/Auth/storage counts were zero before Auth setup, public Supabase connectivity passed, and structural RLS/security checks passed | Keep Project Local product rows/storage empty until reviewed operator provisioning; use a separately reviewed established-production migration gate for future live-state migrations | No |
| Observability and backup/recovery | Configuration required | Runbooks define monitoring and recovery needs; [`PRODUCTION_BACKUP_RECOVERY_RUNBOOK.md`](./PRODUCTION_BACKUP_RECOVERY_RUNBOOK.md) documents rollback, migration-forward policy, operational pause, recovery checks, 12.28.1 Free-plan backup evidence, preferred independent encrypted backups, and optional Supabase-managed Pro backups; 12.29 adds the independent backup automation foundation | Verify logging, alerts, complete operator backup setup, run and record first successful encrypted backup, confirm retention/status/notification, restore-test a reviewed independent encrypted backup path or optional Supabase-managed Pro path, record restore/rollback owners, and preserve Belgrade fallback | Yes |
| Real Bozeman pilot | Pilot required | No real Bozeman records created by tests | Run controlled pilot with approved data | Yes |
| Deferred non-blocking features | Deferred non-blocking | Response-link reveal/copy, public lookup, remembered devices, Communications, `/admin/tasks`, `/v/demo`, import, reminders remain out of scope | Keep out of launch unless separately reviewed | No |

## Evidence commands

- `npm run test:bozeman-beta-launch-gate`
- `npm run test:bozeman-beta-ui`
- `npm run test:bozeman-beta-launch:hosted`
- `npm run test:bozeman-beta-e2e:hosted`
- `npm run test:production-deployment-smoke`
- `npm run test:production-environment-readiness`
- `npm run test:production-supabase-schema`
- `npm run test:assignment-notification-email`
- `npm run test:assignment-notification-email:hosted`
- `npm run test:calendar`
- `npm run test:volunteer-profile-management:browser`
- `npm run test:volunteer-schedule-responses:browser`

## Blocking actions before launch

1. Provision real Bozeman workspace/contact/grants through the 12.14 operator boundary.
2. Select and configure production email provider.
3. Verify sender domain and sender identity.
4. Configure provider secret and production base URL without committing secrets.
5. Verify logging, alerts, and stale-delivery monitoring.
6. Before real Bozeman data, complete the 12.29 independent backup operator setup or optional Supabase-managed Pro path, run and record the first successful encrypted backup, confirm retention/status/notification, restore-test the chosen path, complete post-restore verification, and record restore/rollback owners using [`PRODUCTION_BACKUP_RECOVERY_RUNBOOK.md`](./PRODUCTION_BACKUP_RECOVERY_RUNBOOK.md).
7. Run a small controlled pilot with approved Bozeman data and approved test recipients. Product-owner UI review is already complete through 12.30.1.

## Non-blocking deferred items

- Belgrade migration.
- Full `/admin/tasks` cutover.
- `/v/demo` cutover.
- Public volunteer lookup.
- Remembered devices.
- Full Communications composer and analytics.
- Automatic reminders.
- Schedule-change emails.
- Response-link reveal/copy activation.
- Assignment-detail entry links.
- Controlled import UI.
- Availability/conflict engine.
- Drag/drop, resize, recurrence, and copy/paste scheduling.
- Needs Attention persistence.

## Production email provider/domain/deployment status

- Production provider: not approved in repository.
- Production sender domain: not verified in repository.
- Sender identity: not configured for production.
- Provider secret: not configured or committed.
- Production base URL/domain: canonical origin `https://projectlocal.app`; final-domain Auth callback passed manual magic-link evidence.
- Production deployment: Vercel project `project-local` is live at `https://projectlocal.app`; temporary Vercel alias `https://project-local-one.vercel.app` remains available.
- Real external email: not sent by 12.23.1.

## Fallback

Belgrade Sheets/App Script remains the operational fallback. If any launch blocker remains unresolved, Bozeman beta should not replace or endanger Belgrade operations.
