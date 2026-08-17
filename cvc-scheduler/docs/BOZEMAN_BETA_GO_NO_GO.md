# Bozeman Beta Go/No-Go

Conclusion: NO-GO

The persisted beta scheduling loop is technically proven through focused local gates, focused hosted staging gates, and the 12.23.1 integrated hosted end-to-end loop. Iteration 12.30 was functionally validated but rejected in product-owner visual review. Iteration 12.30.1 is explicitly product-owner approved by Jelani: the corrected beta-critical UI direction and all six desktop/390px review captures were reviewed and accepted. Iteration 12.31 selects Resend and adds a validated server-only production adapter. August 10, 2026 operator evidence proves the Resend domain/sender/key configuration and direct provider-level Gmail inbox delivery, but not Project Local application-driven delivery through the Initial email action and ledger. Iteration 12.33 now proves the bounded operator Notification Health architecture, manual cadence/escalation policy, and hosted staging behavior; production execution remains later controlled-pilot evidence. Iterations 12.35.11 and 12.35.12 complete the scheduled backup/recovery gate and safely enable the permanent daily task. The application transport is currently disabled. The UI, initial-beta observability, and backup/recovery gates are proven and no longer blocking, but production launch prerequisites remain unresolved. An honest NO-GO means the launch gate is doing its job; it does not mean the implementation failed.

## Decision matrix

| Gate | Status | Evidence | Owner/action | Blocking |
| --- | --- | --- | --- | --- |
| Workspace/contact/grant provisioning | Operator required | 12.14 boundary and local validation exist | Provision real Bozeman workspace and approved contacts through reviewed operator procedure | Yes |
| Volunteer Add/Edit | Proven | `/admin/volunteers`, 12.15.1 hosted gate, local/browser regressions | Pilot with approved Bozeman volunteer data | No |
| Calendar create/edit/source/assignment/publish | Proven | 12.16 through 12.19.1 hosted gates; `npm run test:calendar` | Controlled pilot spot checks | No |
| Volunteer schedule and Confirm/Deny | Proven | 12.20/12.20.1 and 12.21/12.21.1 hosted gates | Final mobile pilot | No |
| Initial assignment email boundary | Application proof required | 12.22.1 hosted ledger/recording gate passed through `20260714122230`; 12.31 validated the Resend adapter; August 10 operator evidence proves `projectlocal.app`, the verified sender, restricted Vercel-held key, privacy settings, and direct provider-level Gmail inbox delivery only. No app Initial email or production ledger round trip occurred, and application transport is disabled | After backup/recovery and provisioning prerequisites permit a reviewed controlled test, prove the real Initial email claim/provider/finalize round trip, duplicate behavior, schedule link, retry/failure operations, and monitoring | Yes |
| Integrated hosted beta loop | Proven | 12.23.1 ran one continuous disposable namespace through Volunteer Add/Edit, Calendar scheduling, assignment, publication, recording-only email, secure schedule access, Confirm/Deny/Confirm All, admin response truth, negative paths, and zero residue | Repeat before final launch review if staging/schema changes | No |
| Hosted staging state | Proven | `project-local-staging` (`kfuujcfxoayukywvtaeh`) validated through `20260812123430`; generated-type parity, exact direct/default privilege metadata, all-table RLS, exact FORCE RLS, focused Notification Health authorization/isolation/no-mutation proof, future-table default behavior, and zero fixture/Auth/object residue passed. Historical launch/E2E evidence at `20260811123300` remains valid because `20260812123430` changes only table/default ACL posture and the focused hosted compatibility gate passed | Rerun directly affected hosted gates before final launch review if later schema/runtime assumptions change | No |
| Beta-critical UI | Proven | 12.30 was visually rejected despite functional validation. Jelani explicitly product-owner approved the corrected 12.30.1 shared shell, real Calendar, real Volunteers, and secure volunteer schedule against [`design/approved-project-local-ui`](./design/approved-project-local-ui/), and reviewed and accepted all six real-route desktop/390px captures in [`previews/beta-review`](./previews/beta-review/) | Preserve the approved baseline; any later visual direction change requires separate explicit review | No |
| Production deployment/domain/Auth | Proven | Vercel project `project-local` is live at canonical origin `https://projectlocal.app`; temporary Vercel alias `https://project-local-one.vercel.app` remains available; `ADMIN_AUTH_MODE` is enforced; Supabase Auth Site URL and exact final-domain callback are configured; temporary Vercel callback remains allowlisted; manual magic-link sign-in passed on the final domain; no-grant admin routes failed closed; commit `082c960` was pushed to `origin/master`, the Vercel Production deployment sourced from `082c960` reached Ready, and the exact final-domain production smoke passed before push and after deployment with exit code `0` | Rerun the public smoke only after deployment/domain/Auth/environment changes | No |
| Production environment readiness | Partial | Production deployment/domain/Auth is proven; production Supabase remains recorded at `20260714122230`; provider/domain/sender configuration, initial-beta observability, and complete backup/recovery are proven. 12.35.11 passed the controlled scheduled-host production backup/checksum/retention path, and 12.35.12 safely enabled the permanent daily task without catch-up execution | Separately review production migrations/Notification Health execution, prove application-driven email, provision real Bozeman, and complete the pilot | Yes |
| Production Supabase schema | Proven | 12.25 ran the initial/bootstrap empty-production `npm run test:production-supabase-schema` gate against `project-local-production` (`wdlaauzknfggoqldolmx`); production is migrated through `20260714122230`, generated-type parity passed, product/Auth/storage counts were zero before Auth setup, public Supabase connectivity passed, and structural RLS/security checks passed | Keep Project Local product rows/storage empty until reviewed operator provisioning; use a separately reviewed established-production migration gate for future live-state migrations | No |
| Application observability foundation | Proven | 12.32 adds a server-only bounded event schema, representative beta-critical instrumentation, credential-free assignment-email stage/sent outcomes, a non-mutating stale-`sending` detector, and deterministic privacy/failure-isolation regression proof | Preserve the event/privacy contract and proven Vercel workflow | No |
| Operator observability | Proven for initial controlled-beta architecture | [`PRODUCTION_OBSERVABILITY.md`](./PRODUCTION_OBSERVABILITY.md) records Vercel runtime/deployment visibility, named ownership/action conditions, the controlled safe event, and 12.33's bounded authenticated read, unlinked Notification Health route, local/staging proof, after-batch/before-retry/end-of-active-day cadence, and pause-on-repeat policy. Manual notification is sufficient for the initial tiny beta; automated alerting and production RPC execution are not claimed | Apply 12.33 to production only in a separate reviewed change, then record the first production check during the controlled pilot; revisit automation if manual response becomes inadequate | No |
| Backup/recovery | Proven / complete | [`PRODUCTION_BACKUP_RECOVERY_RUNBOOK.md`](./PRODUCTION_BACKUP_RECOVERY_RUNBOOK.md) records that 12.34 produced the first six-file age-encrypted production backup; 12.34.1-12.34.3 proved managed-role handling, exact source ACL reconstruction, and full disposable recovery-forward. 12.35 proved the human-visible safe notification and named ownership. 12.35.11 passed one controlled scheduled-host production preflight, all five native dumps, six-file package, age encryption, `62622`-byte daily/weekly publication, matching SHA-256, retention, and plaintext cleanup. 12.35.12 proved no catch-up-on-enable on this host and enabled the unchanged permanent daily `03:15` task without execution | Preserve the task, encrypted artifacts, status/checksum, periodic disposable recovery drill, notification, and named ownership. Supabase Auth platform configuration and Storage object BLOB recovery remain outside the logical package | No |
| Real Bozeman pilot | Pilot required | No real Bozeman records created by tests | Run controlled pilot with approved data | Yes |
| Deferred non-blocking features | Deferred non-blocking | Response-link reveal/copy, public lookup, remembered devices, Communications, `/admin/tasks`, `/v/demo`, import, reminders remain out of scope | Keep out of launch unless separately reviewed | No |

## Evidence commands

- `npm run test:bozeman-beta-launch-gate`
- `npm run test:bozeman-beta-ui`
- `npm run test:bozeman-beta-launch:hosted`
- `npm run test:bozeman-beta-e2e:hosted`
- `npm run test:production-deployment-smoke`
- `npm run test:production-environment-readiness`
- `npm run test:assignment-notification-health`
- `npm run test:production-supabase-schema`
- `npm run test:assignment-notification-email`
- `npm run test:assignment-notification-email:resend`
- `npm run test:assignment-notification-email:hosted`
- `npm run test:calendar`
- `npm run test:volunteer-profile-management:browser`
- `npm run test:volunteer-schedule-responses:browser`

## Blocking actions before launch

1. Apply migrations `20260811123300` and `20260812123430` to production only through separately reviewed established-production migration steps; do not infer that staging proof authorizes production mutation.
2. Provision real Bozeman workspace/contact/grants through the 12.14 operator boundary.
3. As part of a separately reviewed controlled test/pilot, enable `ASSIGNMENT_NOTIFICATION_EMAIL_TRANSPORT=resend` only long enough to prove the Project Local Initial email action, production delivery-ledger claim/provider/finalize flow, duplicate behavior, schedule-access link, retry/failure procedure, and first production Notification Health execution with an approved recipient; disable it again if the reviewed step does not authorize continued sending.
4. Run a small controlled pilot with approved Bozeman data and approved test recipients. Product-owner UI review, initial-beta observability architecture, and backup/recovery are already complete.

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

- Production provider: Resend selected; server-only application adapter validated in 12.31.
- Provider/domain/sender evidence: August 10, 2026 operator evidence confirms `projectlocal.app` is verified and ready in Resend and `Project Local <notifications@projectlocal.app>` is the verified production sender.
- Provider secret: a restricted Sending-access key scoped to `projectlocal.app` is stored only as `RESEND_API_KEY` in encrypted Vercel Production settings; no key value is recorded or committed.
- Production notification values: `ASSIGNMENT_NOTIFICATION_BASE_URL=https://projectlocal.app` and `ASSIGNMENT_NOTIFICATION_FROM=Project Local <notifications@projectlocal.app>` are configured in Vercel Production; `ASSIGNMENT_NOTIFICATION_RECORDING_PATH` is absent.
- Privacy: Resend open tracking and click tracking are both off.
- Provider-level deliverability: a direct Resend-dashboard test from the verified sender arrived in an approved Gmail inbox. This proves provider/domain/sender/basic inbox delivery only.
- Application delivery: not proven. The dashboard test did not use Project Local's Initial email action, `assignment_notification_deliveries`, schedule-access handoff, duplicate protection, or application retry/failure paths.
- Current application state: `ASSIGNMENT_NOTIFICATION_EMAIL_TRANSPORT` is absent after it was temporarily enabled without sending an app email and then removed; the resulting `https://projectlocal.app` deployment is Ready/Latest, so Project Local application email is disabled.
- Data boundary: no production workspace, contact/grant, volunteer, Calendar item, assignment, notification-delivery row, or other real Bozeman product data was created during the provider test.

## Fallback

Belgrade Sheets/App Script remains the operational fallback. If any launch blocker remains unresolved, Bozeman beta should not replace or endanger Belgrade operations.
