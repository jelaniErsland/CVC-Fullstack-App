# 12.47 local review

Local implementation and fixture verification only. No production access, real email, live backup, commit, push or deployment. Last documented production terminal is `20260908130000`; it was not reverified. This document is not rollout authorization.

## Architecture and migrations

| Pending migration | Purpose |
| --- | --- |
| `20260922120000_bulk_calendar_assignments.sql` | Durable idempotent bulk operation; composes existing independent repeat/item/assignment RPCs atomically, serializes concurrent saves, previews versions/duplicates/conflicts, supports date exceptions. |
| `20260922130000_communication_delivery_operations.sql` | Durable operations, individual recipient claims/outcomes, per-assignment coverage and separate welcome campaign state. Integrates the existing assignment notification ledger and private schedule credentials. |
| `20260922140000_volunteer_csv_import.sql` | Bounded transactional import, request replay, workspace serialization, existing JSONB profile boundaries with optimistic versions. No Auth/grant/assignment import. |
| `20260922150000_project_hero_volunteer_home.sql` | One workspace photo reference/focal points; uploads disabled by default; own away periods and credential-scoped posted weekly menus. Adds away warnings to the shared bulk preview. |

All four migrations apply on a fresh local reset. No applied historical migration was edited. Generated public + graphql_public types match the fresh local catalog, including the previously omitted 12.46C seen-state types.

Calendar retains independent items, publication/capacity rules and independent per-assignment responses. Scheduling never sends email. New bulk work remains private until the existing publish operation. Existing assignments are skipped, not recreated. Confirmation checks the current preview and rolls back every write on a failure, including a failure after item insertion.

Communications uses the existing contact/grant capabilities: all of `workspace.read`, `volunteers.view`, `volunteers.edit`, `calendar.view`, `assignments.view`, `assignments.edit` are required to review, confirm, dispatch, retry or read history. Calendar and volunteer resend entry points lead to this same workspace. Welcome eligibility is derived from current profiles and successful campaign delivery, so manually created, imported and converted profiles become pending without side-effect sends.

Each recipient receives one email with only their assignments. Stable operation/recipient/attempt keys support provider idempotency; database reservations independently prevent duplicate initial delivery beyond the provider's retention window. Explicit resends retain assignments/responses and coverage history. Known rejection can be retried individually; timeout, ambiguous response, or lost finalization retains an unknown/pending state and valid schedule link, with no automatic retry. An excluded, never-dispatched reservation requires fresh review before transfer to a new operation. Shared email identities and changed welcome email addresses require review. `sent` means provider acceptance, not inbox receipt.

CSV supports comma/semicolon/tab, quoted spreadsheet fields, mapping, normalized email/phone/weekdays and tri-state answers. Reliable ID/email/phone matching takes precedence; ambiguous names never merge. New profiles are the default selection. Matched profiles require individual field selection and current versions, with blank cells preserving values. Formula-like input is rejected, output is spreadsheet-escaped, private values are masked in previews, and private exports require edit authorization plus explicit warning acknowledgment.

Volunteer home reuses the existing schedule renderer and response actions. Desktop uses a wide assignment column and a narrow lunch/availability column; mobile puts the compact hero, next assignment, lunch, availability and concise agenda in that order. Menus contain only persisted published Breakfast/Lunch kind/date/time/provider/menu, including days without assignments. Away periods are session-owner scoped and advisory; saving them does not decline or cancel assignments.

## Security policy

Fresh local proof: **72 functions / 10 anonymous / 47 authenticated / 15 internal**. PUBLIC EXECUTE and default EXECUTE grants are zero. All 57 SECURITY DEFINER functions have `postgres` ownership and empty pinned `search_path`; all 15 internal functions deny direct application execution. The two new anonymous RPCs require a valid existing volunteer schedule credential. Exact signature classifications and caller evidence are in [FUNCTION_PRIVILEGE_POLICY.md](./FUNCTION_PRIVILEGE_POLICY.md).

No service-role runtime path. New ledger/import/photo/away tables have RLS and no direct anon/authenticated write grants. Quick View management remains authenticated; its existing trusted bearer projection remains read-only and excludes private volunteer profile fields. CSV export is same-origin, bounded and workspace-scoped. Image reads require an authorized admin or the current volunteer session and the current saved asset reference.

## Verification

| Check | Result |
| --- | --- |
| Fresh local migration reset | PASS through `20260922150000` |
| Bulk assignment regression | PASS: two-admin overlap, duplicates/replay, exceptions, private Repeat creation, independent responses, edit/archive drift, cross-workspace/anon denial, forced mid-write rollback, no email |
| Transport regression | PASS: mocked provider, one recipient, stable idempotency, rejection/unknown/malformed acceptance/timeouts/disabled transport |
| Communication ledger regression | PASS: concurrent operations/claims, grouping, initial/resend history, failed-only retry, unknown blocked, changed email, pending welcome, authorization, excluded reservation transfer |
| Confirmed-operation batching | PASS: one confirmation continues only that operation's ready recipients, stops on error/stalled progress, never implicitly retries failed/unknown messages. Real 390px browser proof: six recorded recipients, two server batches, one click/operation, no duplicates. |
| Real local dispatcher regression | PASS: actual local RPC/credential ledger with stubbed provider, scoped consolidated links, lost-finalization preservation, failed-only retry, no real email |
| CSV regression | PASS: formats/round trips, sparse/unknown values, matching, field review, atomicity, concurrent duplicate imports, stale edits, private export denial, formula safety |
| Home/photo regression | PASS: full-week menu without assignment, privacy/revocation, own away/conflict/replay, response preservation, photo authorization/version/default-disabled boundary, responsive metadata-stripped files, independent local BLOB loss/restore hash |
| Function policy and Quick View privilege regression | PASS: exact 72 catalog, default deny/future creator test, anonymous mutation denial, existing recipient exchange preserved |
| Browser 1440 / 390 | PASS: existing and Repeat assignment save, CSV import/export privacy, explicit recorded welcome/schedule delivery and failed-only retry, shared hero save/cancel/remove, focus restoration, menus/away conflict, no console/hydration errors or overflow |
| TypeScript / project-source ESLint | PASS on final source |
| Production build / generated type parity | PASS locally on final source/migrations |
| `git diff --check` / cleanup | PASS; preview/Supabase stopped, fixtures removed, staged 0. Tool policy blocked generated directory deletion; see checkpoint. |

Transport tests stub provider calls; browser tests use only the loopback recording adapter, storing recipient/content hashes without emails or bearer URLs. Browser fixtures and upload files are removed after each run. No real person or production credential is used.

## Visual evidence

Folder: top-level `previews/12.47-local-review/`. Each stem below has both `-1440.png` and `-390.png`. The hero image is a synthetic uploaded JPEG fixture, not a photograph of the actual project.

| Area | Capture stems |
| --- | --- |
| Bulk assignments | `multi-day-assignment-preview`, `repeat-create-assignment-preview` |
| CSV | `csv-import-match-preview`, `csv-export-controls` |
| Communications | `communications-pending-introductions`, `welcome-preview-confirmation`, `welcome-delivery-results`, `consolidated-schedule-preview`, `delivery-history-resend`, `delivery-failure-retry-confirmation` |
| Shared/default hero | `overview-default`, `overview-shared-hero`, `volunteer-home-default`, `volunteer-home-shared-hero`, `shared-photo-crop-preview` |
| Volunteer menu/availability | `volunteer-weekly-menu`, `away-period-management`, `away-assignment-conflict` |

Direct visual review found and corrected a squeezed mobile assignment title, inaccurate crop-preview proportions, file-input dialog crowding and white-on-white away-save styling. Final inspection checks both dialog and document overflow, readable text/focus, distinct lunch/availability/agenda, visible confirmation counts and explicit retry.

## Bounds and rollout concerns

- Bulk assignment operations: at most 100 items and 25 volunteers; bounded date range and per-volunteer exceptions. Away availability is advisory, not an automatic cancellation or scheduling prohibition.
- Communications: at most 500 considered profiles in a preview, 200 recipients per operation, five dispatched per server action. One confirmation continues that operation in bounded batches; interruption requires explicit continuation of remaining queued recipients. History currently reads the latest 1,000 recipient records; older audit rows remain stored. Larger-workspace pagination is not implemented. Unknown/provider-pending outcomes deliberately need external outcome investigation before any future recovery tool; there is no automatic reclaim or resend.
- CSV: 512 KB, 500 rows, 50 columns and 4,000 characters per field; up to 5,000 workspace profiles for matching/export. Split larger imports. Import does not resolve ambiguous shared identifiers automatically. Explicit field review includes hidden private-field presence, never private values in the preview.
- **Production photo uploads blocked:** database flag defaults false, has no application mutation path, and the storage adapter permits only loopback Supabase and rejects Vercel. JPEG/PNG/WebP input is limited to 6 MB / 24 MP and re-encoded to desktop/mobile WebP without EXIF/GPS/ICC. Local independent BLOB copy/loss/restore/hash proof passes, but production object storage and a low-cost independent off-host backup/restore procedure still require implementation and approval before enabling uploads. The no-photo default remains usable.
- **Recovery rollout gate:** historical PostgreSQL restore drills are pinned to their reviewed historical schema/table ACL baseline. They were not broadened, and this iteration does not claim current-terminal restore or new lock-transition readiness. Review/test exact transitions and expanded-schema recovery before any authorized rollout. No production backup/task/configuration changed.
- Automated reminders, arbitrary Communications authoring, bulk marketing, automatic welcomes and new recurrence series remain outside this release.

No rollout should infer current production state from this local evidence. Read-only production preflight, an authorized checkpoint, reviewed migration transitions and production delivery proof require a separately authorized rollout.

Final repository: 101 dirty paths (36 captures included), staged 0, original HEAD unchanged. `.env.local` absent. Generated `.next`, `supabase/.temp` and `.local` remain ignored because the cleanup tool rejected recursive removal (`blocked by policy`). Both local runtimes are stopped. No production/email/backup/source-release action occurred.

## Subsequent local UX consolidation

The product-owner-approved backend and four pending migrations remain unchanged. The standalone Calendar bulk-assignment panel is removed. The same assignment composer now lives in the Calendar creation sheet and item inspector, with an automatically refreshed server preview and one final save action. Creating one or repeated items can assign volunteers in the same atomic transaction; existing items default to their own date and offer explicit matching loaded occurrences plus per-person date exceptions. Neither path sends email.

Communications has Welcome, Schedule and Delivery history tabs. Calendar's Send schedules link preserves the selected period. Welcome previews show introduction status instead of assignment counts; the template mentions the posted lunch menu and self-service away dates. A single confirmed send action replaces a redundant acknowledgment checkbox. History groups recipients by operation and discloses attempts/failure details on demand. Overview avoids an unsupported all-clear claim; the volunteer weekly menu uses a focused dialog; reviewed away periods no longer require a second acknowledgment checkbox; private CSV export starts unchecked on every opening.

Focused 1440px and 390px captures are in top-level `previews/12.47-ux-consolidation/`: `existing-multi-date-inspector`, `repeat-create-inspector`, `communications-welcome-tab`, `communications-schedule-tab`, `communications-history-tab`, `communications-resend`, `welcome-preview`, `overview`, `volunteer-weekly-menu-sheet`, and `away-conflict-without-extra-ack`. These supersede only the affected earlier visual captures; unchanged hero/CSV screens remain in the original folder. Local browser proof covers one-date create, Repeat create with an exception, existing single- and multi-date assignment, date-range handoff, tab and privacy controls, menu/away dialogs, overflow and console errors. The bulk transactional regression still proves duplicate skipping, stale previews, concurrency, capacity-related review, independent responses and rollback.
