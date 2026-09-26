# Current State

This is the authoritative present-state context for Project Local. Historical implementation evidence is recorded in [PROJECT_HISTORY.md](./PROJECT_HISTORY.md) and Git history.

## 12.48 Batch 1 production closeout — 2026-09-26

**Deployed and verified:** `1447bb926dfb65cbc77c071bab5d33879d8c46c5` is Ready on Vercel Production and served at `https://projectlocal.app`. Batch 1 and the Day/List assignment-visibility enhancement shipped together through the normal fast-forward of `master`; the development checkout remains `codex/12.48-batch-1`. Real local role/bearer/photo checks and authorized production Overview, Calendar, assignment, Quick View, navigation and desktop/mobile smoke passed. All 11 production operational/contact/photo/delivery table counts and row fingerprints matched before and after release. No volunteer data changed or delivery was created by these checks. The schema remains `20260922150000`, photo uploads remain disabled, and backup/security/notification safeguards are unchanged. See the [release report](12_48_BATCH_1_RELEASE.md) for evidence and limitations. No Batch 2 work began.

## 12.47 production closeout — 2026-09-24

Historical closeout: release `5bb1cf6a0609285c7c4c53d4e3516727b67adbac` was deployed on September 24 and is now superseded by 12.48 above. During 12.47, Vercel Authentication was restored from the temporary All Deployments gate to its original **Standard Protection** setting. The public site and canonical `/guide` responded normally; `/guide/` and `/guide/index.html` redirected to `/guide`.

Production has all four 12.47 migrations, in order, ending at `20260922150000` (43 migration records). The permanent backup task is Enabled, Ready and not running with the matching `20260922150000` lock; recovery preflight is GREEN. All 26 public tables and the exact 72-function policy (10 anonymous, 47 authenticated-only, 15 internal) passed live ACL/RLS checks. The frozen pre-migration data fingerprints and operational relationships were preserved. The temporary public-schema write restriction was removed and effective application grants matched the saved pre-freeze state exactly.

One controlled encrypted current-terminal checkpoint, `project-local-production-20260924T222318Z-01e8579b.zip.age`, passed execution, independent SHA-256 and manifest checks. Its exact artifact was restored in a fresh disconnected pinned Supabase target with application data, essential Auth users/identities and current empty Storage metadata. All 26 public table fingerprints, application ACL/RLS and contact/grant relationships matched production; the target and decrypted temporary material were removed. Pre-disaster sessions remain outside the recovery contract. Photo uploads remain disabled; no bulk/welcome/schedule email was sent during rollout. No volunteer schedule bearer URL was available for a safe direct live smoke, so that route remains supported by the prior synthetic browser/privacy regressions rather than a production browser visit.

The pre-release observations below are retained as historical review evidence and are no longer statements of the current production terminal or deployment state.

## Historical pre-release 12.47 source review

The current workspace implements bulk Calendar assignments, explicit consolidated schedule and welcome delivery, volunteer CSV import/export, a shared project hero, the volunteer home/menu/away experience, and the owner-supplied public Contact Guide. These changes are local only. Fresh 2026-09-24 read-only database, ACL, backup-task and artifact observations are recorded in [12.47 production readiness](./12_47_PRODUCTION_READINESS.md); the production sections below record the last deployed rollout and must be freshly reverified during a separately authorized quiet window. The owner confirmed the Production-scoped Vercel variable names, Supabase/Resend settings and account/MFA/domain/DNS/credential/age-key custody arrangements. The Vercel Production/Ready screenshot showed the deployed `de667ee` prefix from master; its full deployed SHA and hidden key-to-consumer mapping were not independently demonstrated. Separate rollout authorization is still required.

- Four pending forward migrations: `20260922120000` bulk assignments, `20260922130000` communication operations, `20260922140000` CSV import/profile versions, and `20260922150000` project hero/volunteer home. None is applied to production.
- Bulk operations compose existing item, repeat and assignment RPCs in one transaction, retain independent assignments/responses and private draft rules, skip existing assignments, and reject stale previews. Date exceptions and away-period warnings are included.
- The local 12.47 UX consolidation places one shared assignment composer in Calendar creation and the item inspector. One date/Repeat creation saves items and selected assignments together; an existing item defaults to its date and offers explicit matching dates in the loaded Calendar period. Calendar's schedule-send link carries its selected date range into the same Communications review operation.
- `/admin/announcements` is now the local Communications workspace. Welcome and consolidated schedule sends require live contact capabilities, recipient review and explicit confirmation. Durable per-recipient claims and the existing assignment ledger prevent concurrent initial duplicate sends. Failed-only retry and explicit resend preserve assignments/responses; uncertain outcomes remain blocked. Opening Communications, creating/importing profiles and questionnaire conversion never send email automatically.
- CSV stays within the authorized workspace. Imports add new records by default; existing records require explicit field selection and current versions. Blanks do not erase data. DOB/emergency values are masked in previews and omitted from ordinary exports; private exports require edit authorization and explicit acknowledgment.
- The volunteer home retains the private schedule session and response boundaries. Its additional weekly menu projection exposes only saved meal kind/date/time/provider/menu, including posted dates without assignments. Own away periods require conflict review and do not change assignments or responses. Quick View remains the same read-only Calendar projection.
- Overview and volunteer home use the same workspace photo reference and focal points. Production uploads remain disabled in the database and storage adapter. Local responsive image BLOB loss/restore was verified, but this is not proof of independent production asset recovery. Production storage and independent object backup/restore approval are explicit blockers to enabling uploads.
- Fresh local exact function policy: **72 total / 10 anonymous / 47 authenticated / 15 internal**, PUBLIC and default PUBLIC/anon/authenticated EXECUTE zero; 57 SECURITY DEFINER functions with `postgres` ownership and empty pinned search paths. The two added anonymous functions require the existing valid scoped volunteer schedule credential. An exact 37-signature `service_role` replay correction in the last unapplied migration reconciles the hosted/local creator-default difference without changing the four-file migration order.
- Real email remains disabled in all local verification. Browser sends use a loopback-only hash recording transport; provider tests use stubs. Production email configuration is untouched.
- The illustrated Contact Guide is locally served at canonical `/guide` through a static-public rewrite; `/guide/` and `/guide/index.html` redirect there. Signed-in desktop and mobile More navigation link to it. Local production-like browser checks at 1440px and 390px passed asset, navigation, interaction, focus, console and overflow checks. The guide uses fictional review screenshots and does not claim automatic email or enabled custom-photo uploads. The live URL remains untested until deployment. [The exact reviewed release scope](./12_47_RELEASE_SCOPE.md) is kept separate from excluded review captures and runtime files.
- Local backup/lock helpers recognize the four exact 12.47 adjacent transitions while denying backup execution or task enablement at the three intermediate terminals. The existing age identity decrypted the verified real production artifact. A pinned Supabase-initialized target restored real Auth users/identities, Project Local public data and current empty Storage metadata; four migrations preserved all 18 original-table field fingerprints and exact 72-function ACL/RLS checks passed. A separately encrypted expanded package then restored into a second fresh pinned target with all 26 public table and essential Auth fingerprints matching. A separate fresh synthetic-fixture Next.js route smoke passed enforced sign-in routing, seven admin routes and volunteer home without email; it was not a browser test of the restored production-copy database. Prior sensitive bootstrap directories were manually removed and their absence verified; local runtimes were stopped. Pre-disaster sessions are intentionally omitted, so contacts sign in again after separate Auth configuration is restored. Photo BLOB recovery remains unproven and production uploads remain disabled. See [the reduced-scope recovery contract](./12_47_AUTH_STORAGE_RECOVERY.md). The historical empty-data restore script remains outdated. No production backup, permanent-task change, lock transition or migration was performed.

See [12.47 implementation checkpoint](./12_47_IMPLEMENTATION_CHECKPOINT.md) and [local review handoff](./12_47_LOCAL_REVIEW.md) for tests, limits and captures. Routes and limitations below describe the last deployed version unless explicitly labeled local 12.47.

## Last documented production snapshot

- Production Supabase terminal: `20260908130000`.
- The permanent `Project Local Production Backup` task is Enabled, Ready, and not running. Its lock is `20260908130000`; its daily 03:15 schedule, action, destination, principal, and `StartWhenAvailable` setting remain in place.
- Recovery validation is GREEN. The 12.46C rollout created one controlled encrypted checkpoint at terminal `20260908120000` before migration. The nonzero artifact `project-local-production-20260909T043202Z-298373ef.zip.age` passed an independent SHA-256 comparison with zero plaintext, partial, process-temp, status-temp, or temporary-task residue; the permanent task did not run during the rollout.
- Bozeman is the active production project in `America/Denver`. Its persisted project window is `2026-09-29` through `2026-12-04`.
- Existing application email transport configuration remains enabled and unchanged. The 12.46B rollout sent no email.

## Security invariants

The lookup migration `20260905120000_volunteer_schedule_lookup.sql`, function-privilege migration `20260905130000_harden_public_function_execute_privileges.sql`, on-site Food migration `20260906120000_on_site_food_calendar_operations.sql`, meal-system-preset correction `20260906130000_breakfast_lunch_system_presets.sql`, concurrent-admin edit guards `20260907120000_concurrent_admin_edit_guards.sql`, volunteer-profile expansion `20260908120000_volunteer_profile_questionnaire_expansion.sql`, and volunteer-experience polish migration `20260908130000_volunteer_lookup_last_name_and_attention_seen.sql` are live.

- Function EXECUTE is deny-by-default for Project Local functions created by `postgres`. `PUBLIC` has no application-function EXECUTE, and the `postgres` global and `public` default ACL contexts deny implicit PUBLIC, `anon`, and `authenticated` function execution.
- Exactly eight reviewed anonymous RPCs are executable: the explicit list and caller evidence are maintained in [FUNCTION_PRIVILEGE_POLICY.md](./FUNCTION_PRIVILEGE_POLICY.md). Unexpected anonymous EXECUTE is `0`; unexpected PUBLIC EXECUTE is `0`; PostgreSQL default EXECUTE grants remain `0`.
- The exact live inventory is 58 Project Local public functions: eight anonymous, 38 authenticated, and 12 internal. Unexpected anonymous and PUBLIC EXECUTE are zero, and reviewed default EXECUTE grants are zero.
- Authenticated application RPCs retain their explicit grants. Internal trigger and validation helpers have no direct application-role grant.
- All 46 live SECURITY DEFINER functions retain the `postgres` owner and pinned empty `search_path` in the September 24 read-only catalog. The privilege review found no demonstrated authorization bypass or breach.
- Direct anonymous reads of volunteer-directory, lookup-rate-limit, and schedule-credential tables are denied. Lookup returns generic failures for invalid input, uses opaque project-choice handles, keeps schedule credentials hash-only server-side, and sets the browser credential only as an HttpOnly session cookie.

## 12.46A concurrent admin safety (LIVE)

Calendar item edits, Breakfast/Lunch edits, and Task preset color edits submit the exact persisted `updated_at` version read by the editor. Their authenticated RPCs lock the active row and reject stale versions before mutation, so simultaneous edits cannot silently overwrite an earlier save. The shared conflict message asks the admin to review the latest version before submitting again.

Concurrent assignment creation remains protected by the existing active volunteer/item uniqueness constraint. Archive/edit interleavings remain lifecycle-safe: an archived item cannot be edited back into active use. Migration `20260907120000` replaces only the four affected RPC signatures; the exact public function inventory remains 57 with the existing 8 anonymous, 37 authenticated, and 12 internal classifications.

## 12.46B volunteer profile and questionnaire expansion (LIVE)

Volunteer profiles now persist explicit date-of-birth, emergency-contact, housing, after-hours security, Builder Assistant communication, weekday availability, two-plus-day availability, skills/experience, and other-support fields. Historical questionnaire JSON remains immutable. Questionnaire conversion maps compatible answers into the explicit fields and uses safe `unknown`, empty-array, or nullable values when an older submission has no matching answer.

Authorized manual profile creation and editing use the two reviewed JSONB RPC signatures. Date of birth and emergency-contact details remain private to the authorized volunteer inspector/editor and are excluded from directory cards, Calendar, Quick View, volunteer schedules, public lookup, and assignment email projections. The migration preserved the complete production roster and its history: 42 active profiles including exactly one Jelani Ersland, five assignments, five responses, six schedule credentials, three notification-delivery rows, and all nine contact/grant identities were unchanged across migration.

## 12.46C volunteer experience and management polish (LIVE)

Public schedule lookup now collects contact information before last name while retaining the existing `verify_volunteer_schedule_lookup(text,text,text)` boundary, generic unavailable response, serialized keyed rate limits, opaque project-choice handles, and HttpOnly schedule-session handoff. The production rollout used only invalid-input lookup proof and did not create a schedule credential.

Needs Attention now persists each authorized project contact's independent reviewed/unreviewed state through `mark_needs_attention_signal_seen(uuid,text)`. The table permits authenticated SELECT through owner-scoped RLS and exposes no authenticated table mutation grant; the RPC independently requires the active workspace grant and `workspace.read`, `calendar.view`, and `assignments.view`. Production proof showed one contact could read its rolled-back marker while a second contact could not, with zero residue.

The migration preserved the complete roster and operational history present at its preflight: 40 active profiles including exactly one Jelani Ersland, five assignments, five responses, six schedule credentials, three notification-delivery rows, and all nine contact/grant identities matched their pre-migration counts and identifier/state fingerprints.

## 12.45 on-site Food operations (LIVE)

The approved 12.45 on-site/Food slice and its meal-system-preset correction are live through production migration `20260906130000`. See [12.45 implementation and review](./ON_SITE_FOOD_OPERATIONS_12_45.md) for the reviewed architecture and verification evidence.

Breakfast and Lunch are persistent system task presets in the ordinary `Task preset / Custom` Calendar creation workflow. They retain the shared `One date | Repeat` independent-item scheduling semantics, existing meal occurrences are associated with their presets without changing meal data, and successful persistence is reported independently from post-save cache invalidation.

- Breakfast and Lunch are ordinary Food Calendar occurrences with independent nullable totals, provider/group, contact and menu fields. Meal detail lives in the shared Calendar inspector; Quick View has no separate meal dashboard/cards.
- Historical project_days.expected_on_site_count values remain intact in schema/data. 12.45 retires their editing/display surfaces from active operations. They are never migrated into either meal total. There is no combined operational total or old Quick View Planned staffing summary.
- Both authenticated and bearer Quick View entry points reuse the same read-only Calendar and published operational content model, including assigned names. Bearer expiry/revocation/project scope remain enforced. The migration revoked all pre-12.45 Quick View links because their original audience projection was narrower; trusted links now require explicit reissuance.
- Duplicate creates an independent saved definition with zero assignments, responses or deliveries. Ordinary work starts as a private draft; meal copies follow immediate-visible meal creation semantics. No series is created.
- Project navigation derives only from persisted workspace start dates; unavailable starts disable Project navigation. Reusable Task presets own one validated curated color key, which is shared by Calendar and trusted Quick View; custom one-offs use neutral slate, with text labels and focus states.
- Volunteer meal data is projected only for that volunteer's assignment dates: kind, provider, menu and time. Trusted meal contacts and operational notes are excluded from this meal projection.

## Current product architecture

Project Local is a Calendar-first volunteer coordination product. Reusable Tasks define work; Calendar items place that work in time; assignments and their current responses are the source of assigned/coverage truth. Draft items remain private; published items are available to the permitted project context and assigned volunteers.

Project contacts authenticate through Supabase Auth and receive access from active, contact-scoped workspace grants and capabilities. Server-side route loaders and mutation boundaries derive this context independently; direct application table writes remain denied where an approved RPC is the authority boundary. The application has no service-role runtime path.

Volunteer schedule access is account-light. A personalized `/v/access/[token]` link exchanges a server-verified bearer for the clean `/v/schedule` route; the schedule is limited to that volunteer's published assignments. The public lookup flow uses the same schedule-session boundary without exposing workspace or volunteer UUIDs to the browser.

## Current source routes

| Route | Present behavior |
| --- | --- |
| `/` | Public Find your schedule entry point. Name collection alone exposes no schedule data. |
| `/v/lookup` | Same-origin JSON POST lookup endpoint. It verifies name/contact through the reviewed anonymous RPC and returns only generic failure, project choice, or the HttpOnly session handoff. |
| `/v/access/[token]` | Personalized schedule-access exchange; invalid or expired links resolve to the contained unavailable state. |
| `/v/schedule` | Volunteer-only published schedule, assignment detail, Confirm, Can't make it, Confirm All, and explicit leave-session behavior. |
| `/admin/dashboard` | Persisted Overview of current project work, activity, and attention signals. |
| `/admin/calendar` | Persisted Day/Week/Month/List Calendar with bounded server ranges, project dates, custom/preset items, repeat creation, drafting/publishing, assignment management, and inspector workflows subject to capabilities. |
| `/admin/tasks` | Persisted reusable task definitions, including create/archive and custom-field support subject to capabilities. |
| `/admin/needs-attention` | Persisted staffing and response follow-up signals, grouped for operational review. |
| `/admin/volunteers` | Persisted volunteer profiles with authorized manual create/edit, expanded operational fields, private inspector details, advanced filters, and safe lifecycle handling. |
| `/admin/assignments/[assignmentId]` | Authorized, read-only persisted assignment detail. |
| `/admin/quick-view` | Authenticated persisted project Quick View and its reviewed share-access boundary. |
| `/admin/settings` | Intentionally contained beta-unavailable surface; it is not project settings truth. Project date editing is on Calendar. |

Legacy demo, questionnaire, Communications, Food, onboarding, and administrative prototype routes remain contained unless a route has an explicit persisted boundary. They must not be presented as replacements for the production workflow above.

## Current operational capabilities

- Contacts can create, edit, archive, repeat, publish, and inspect Calendar work within their granted scope; assignment counts derive from live assignment/response truth.
- Authorized contacts can manage reusable Tasks and manual volunteer profiles, assign or cancel volunteers, and use Needs Attention to review staffing and response follow-ups.
- Published assignments are accessible through secure volunteer schedule credentials. Confirm, Deny/Can't make it, and Confirm All persist through credential-scoped response boundaries.
- Initial-assignment email transport remains enabled through its existing explicit delivery workflow. The 12.46B migration and deployment do not send email.
- Bozeman project dates are maintained through the authenticated Calendar Project dates workflow.

## Current limitations and intentionally deferred work

- Automated reminders, broader Communications authoring, and schedule-change delivery remain deferred beyond the enabled initial-assignment transport.
- A successful production lookup smoke using a real volunteer is deferred to the first authorized real use. Invalid-input and boundary proofs are complete; do not manufacture or enumerate volunteers for this check.
- Pre-12.45 Quick View links are revoked. Issue replacement trusted links only through the existing authorized Quick View sharing workflow when requested.
- Advanced Calendar interactions, including drag/resize, richer collision handling, and broader recurrence editing, remain deferred.
- The Windows scheduled-backup missed-run/catch-up behavior remains an operational reliability concern to monitor; do not claim a catch-up run occurred without fresh evidence.

## Approved UX and product direction

The product remains calm and Calendar-first: low text density, clear typography, progressive disclosure, and focused inspectors rather than overloaded forms. Preserve one unified scheduled-item model across volunteer work, security, food, and custom Calendar items. Do not fork public and private Quick View variants or create a second Calendar model for on-site work.

Breakfast and Lunch are distinct operational totals. The historical general Project Day total remains in production schema/data but is retired from the 12.45 operational UI. Quick View has no combined total or old Planned staffing summary.

## Next step

Production and the backup-task lock are aligned at `20260908130000` with recovery GREEN. The 12.46C volunteer-experience polish migration is live with its pre-migration roster and history preserved. Replacement trusted Quick View links need deliberate issuance when requested; do not restore or reuse credentials revoked by the earlier 12.45 migration.

## Canonical references

- [FUNCTION_PRIVILEGE_POLICY.md](./FUNCTION_PRIVILEGE_POLICY.md) — exact RPC classifications, creator/default ACL scope, and privilege evidence.
- [BOZEMAN_BETA_ROADMAP.md](./BOZEMAN_BETA_ROADMAP.md) — roadmap and historical launch-gate analysis; read its current summary before relying on older iteration sections.
- [PROJECT_LOCAL_PRODUCT_REQUIREMENTS.md](./PROJECT_LOCAL_PRODUCT_REQUIREMENTS.md) — future product requirements; it is planning, not an implementation claim.
- [PROJECT_HISTORY.md](./PROJECT_HISTORY.md) — historical implementation and rollout evidence.
- [PRODUCTION_BACKUP_RECOVERY_RUNBOOK.md](./PRODUCTION_BACKUP_RECOVERY_RUNBOOK.md) — backup/recovery procedures and historical checkpoints.
