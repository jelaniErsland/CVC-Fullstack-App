# 12.62 — Volunteer deletion and lifecycle implementation

Local implementation only, based on application `19fe6a29d5b59941bb0612cf9e18fe85a080f474` and DB57 / `20261026120000`. Production was not accessed or mutated. No deployment, push, real provider call, reminder activation, Cron change, or backup change was performed.

## Schema and migration

Migration58: `20261028120000_volunteer_deletion_lifecycle.sql`.

Canonical SHA-256: `9a32dde49b26ad3f71cd8a7925edbf768103059f4ca069e445facb7a8af7b89e`.

DDL affects six existing tables, with seven added columns:

| Table | Change |
|---|---|
| volunteer_profiles | deleted_at, deleted_by; conditional live-contact constraint; strict scrubbed-tombstone constraint |
| calendar_assignments | removal_reason; only volunteer_deleted on canceled memberships |
| questionnaire_submissions | personal_data_redacted_at and exact empty-answer-section constraint |
| communication_recipients | recipient_redacted_at; destination nullable only with redaction metadata |
| volunteer_welcome_deliveries | same privacy-safe nullable destination contract |
| assignment_notification_deliveries | recipient_redacted_at; sent truth can survive destination redaction |

No new table, index, custom type, role, capability, CASCADE conversion, table grant, RLS policy, or default privilege. deleted_by has a non-cascading actor FK. Six narrow live-reference triggers backstop assignment membership, schedule/response token issuance, away state, recipient creation, and reminder enrollment. The existing profile timestamp trigger rejects all ordinary updates to a tombstone.

Seven functions are added: review_volunteer_deletion, delete_volunteer_profile, revalidate_volunteer_dispatch, lock_live_volunteer_profile, guard_live_volunteer_reference, volunteer_assignment_end_at, and volunteer_deletion_impact. The first three follow the existing authenticated function policy; the other four are private helpers. All use an empty search_path. Existing owners, ACLs, SECURITY DEFINER/INVOKER flags, and search_path settings remain unchanged. Thirty-nine existing function bodies receive the required eligibility, concurrency, redaction, and historical-read guards. The retired history-free hard-delete RPC remains present for compatibility but always fails closed.

The exact policy is110 public functions / PUBLIC execute0. The worker and permanent runner gain no deletion or dispatch RPC access.

## Retained identity and scrubbed information

The tombstone retains ID, workspace, historical name, deleted timestamp/actor, existing creation/update timestamps, and existing provenance/FK metadata (profile source, source submission reference, manual creator/time). lifecycle=archived and readiness=on_hold are compatibility flags; deleted_at is the separate authoritative deletion boundary. There is no Deleted option in normal directory filters.

Email, phone, congregation, preferred contact method, DOB, all emergency-contact fields, private notes, availability and skills snapshots, work-day preferences, skills/experience prose, and other-support prose are cleared. Tri-state profile preferences become unknown. The database constraint enforces this minimum projection, rather than merely hiding a complete profile.

A linked questionnaire keeps its submission metadata but its five required answer sections become empty objects. Individual assignment notes, response notes, response-token internal notes, and redundant bulk-plan assignment-note inputs are scrubbed. Other volunteers’ actual assignment instructions remain intact. A saved bulk plan containing a deleted identity cannot be replayed as an active scheduling operation. Response status/source/time remain historical facts.

All of this volunteer's communication snapshots are rebuilt using a small whitelist: historical name/project, reminder identity/due context, and own assignment IDs, titles, dates, times, and response context. Contact information, private fields, instruction copies, and other arbitrary snapshot fields are removed. Recorded email destinations become NULL with explicit redaction metadata; no fake replacement addresses are used. Provider IDs, outcomes, attempts, and audit timestamps remain truthful. Late accepted welcome finalization cannot restore an email address.

Shared Calendar items, task instructions and their revision history, common bulk-operation scheduling context, other workers' information, project contacts, and Auth identities are not deleted. These are separate shared operational records, not hidden copies of this volunteer profile. CSV operation payload hashes remain existing whole-operation idempotency records; no contact-recognition hash was added.

## Transaction and assignment withdrawal

Review returns the current profile version and a deterministic assignment-impact fingerprint. Deletion reauthorizes, takes a workspace lock and conflicting profile lock, locks related items/memberships in stable order, then recomputes impact. A changed profile or impact aborts the entire transaction. A lost acknowledgement can safely be checked/retried against the same identity; an already-deleted result does not repeat withdrawal.

Active memberships whose actual effective end is later than the transaction's checked clock are canceled with removal_reason=volunteer_deleted. This includes in-progress overnight and future work, including confirmed/declined memberships. Completed memberships remain. Calendar items, other volunteers, historical responses, and manually maintained expected-on-site totals remain intact. Normal staffing calculations see the withdrawn positions as open. Null end_date means the item's actual starting date; explicit overnight/multi-day ends are respected.

Deletion requires volunteers.edit plus the existing project/profile read permissions. Current/upcoming work additionally requires calendar.view, assignments.view, and assignments.edit. No new delete-specific role or capability is introduced. Nearest-assignment copy is shown only with assignment/calendar viewing permission and only for a published item; the confirmation does not expose another contact's private draft title.

## Dispatch, reminders, and access

Deletion cancels active unsent/retryable reminder scheduling and excludes ready recipients. Sent/sending/unknown/failed delivery truth remains. Existing reminder claims/revalidation and ordinary/legacy dispatch paths take the shared profile guard, serializing the final authorization boundary with deletion. Ordinary email dispatch now performs its final live check immediately before provider transport. The legacy initial-assignment path retains its original assignments.edit authorization contract; a regression caught and corrected an initially over-restrictive permission check.

After deletion commits, no NEW dispatch authorization can be obtained. An already-authorized provider request may complete; its finalization remains truthful and redacted. Tests prove both sides with mocked provider calls. This is not email recall. Unknown outcomes are never blindly retried.

Every profile-specific schedule and response token is revoked. Lookup, schedule, Confirm-all, response, Away, and token issuance reject the identity. A remembered session gets the ordinary public no-access flow, byte-equivalent to invalid access, without a public deletion message. Household siblings and the same contact in another workspace retain their independent tokens and participation.

No reminder policy, activation, Cron, provider configuration, backup configuration, or execution schedule changes are part of this implementation.

## Current and historical UI

Directory, search/filter/sort inputs, counters, CSV export, scheduler facets, assignment candidates, and Communications audiences exclude deleted profiles on the server. Opening a potentially stale profile performs one bounded current-profile verification before exposing details/Edit; it has a finite error/retry state. There is no per-directory-row fetch or new browser-storage cache.

Completed Calendar assignments show plain historical name text with “Deleted volunteer”, with no contact-card button. Historical assignment detail is read-only. Assigned-contact readers reject the tombstone. Quick View keeps its bearer boundary, current/future exclusion, and names-only historical identity. Fellow workers keeps its existing names-only active-profile contract.

Delete remains separated below Edit's main fields. Dirty edits first use the existing explicit discard protection; they are never silently saved with deletion. One deletion confirmation then explains irreversibility, retained history, affected positions, and nearest appropriate work. There is no typed name/DELETE ceremony. Cancel/Escape are safe, focus is contained, and dismissal is blocked while pending. Review errors and uncertain mutation outcomes have honest recovery states. The directory removes a row only after server-confirmed deletion, retaining search/filter/sort/scroll context.

## CSV, re-add, and isolation

Only an explicit imported deleted profile ID is recognized as historical. UUID spelling is normalized so uppercase IDs cannot bypass this review. Review offers an unchecked “Create as new volunteer” choice, passing a narrowly validated previouslyDeletedId marker to the existing import RPC. It never updates/restores the tombstone. If a current same-name profile already exists, the row requires ordinary identity review using its current exported ID. ID-less rows use only current-profile matching. No tombstone recognition by historical name or contact hash is performed.

A deliberate returning volunteer gets a NEW profile ID and fresh project participation. Old history, tokens, reservations, reminder enrollment, assignments, and availability do not transfer. Free-text skills are not inferred or converted. Shared household and cross-workspace identities remain separate.

## Verification evidence

| Gate | Result |
|---|---|
| Ordered DB57 replay and clean atomic migration58 | Pass in a disconnected disposable database; container removed |
| Forced late migration failure + ledger insertion | Exact rollback of catalogue/security/public/Auth fixture state |
| Clean migration data/security comparison | All existing public/Auth values preserved; existing owners/ACLs/security flags/search_path/RLS/policies/default privileges preserved |
| Exact source/catalogue/ledger contract |46 exact function bodies,57 earlier migrations unchanged, DB58 ledger source exact |
| Deletion fixtures | Never assigned, past only, current, future confirmed/declined, overnight, stale version/impact, failed late scrub rollback, re-add, explicit-ID CSV, tokens, household email/phone, cross-workspace |
| Concurrency | Profile edit and assignment creation invalidate stale review; earlier dispatch authorization serializes with deletion; post-delete authorization denied |
| Delivery/reminder history | Ready work suppressed; existing sent/failed/sending/unknown records preserved/redacted; late mocked acceptance finalizes safely |
| Deletion browser |320/390/430/768/1440/1920; safe focus, dirty protection, error/retry, stale impact, pending protection, preserved directory state, no overflow |
| Historical browser | Completed name remains plain text; no contact action; future Calendar omits deleted identity; remembered volunteer session has generic no-access |
| Full directory/filter/edit browser |8 widths through2560;153 accessibility audits,0 violations; local discovery, sort/filter/search preservation, long forms, Add/Edit/save/cancel, scroll/focus return |
| Complete profile/Edit focus suite | Desktop1440/mobile390;8 accessibility audits,0 violations; disclosure traversal and native date segments |
| Full normal-latency Calendar browser | Desktop/mobile Day/Week/Month/List, navigation, saved return, filters, inspector, create/edit, bulk assign, assignment save/cancel, mobile More/focus/overflow |
| Volunteer profile persistence and response/access | Pass; provenance, scope, lookup/token revocation, Confirm/decline semantics;105 Fellow worker names in one local RPC |
| Communications | Ledger concurrency, mock/recording transport, accepted deduplication, failed-only retry, lost acknowledgement, household recipient separation, deletion final-authorization fence |
| Reminders | Controlled cadence/threshold/cutoff/DST/overnight/reschedule/retry/concurrency regression passes; preview remains SELECT-only over public/Auth rows and sequences |
| Quick View/contact/instruction privacy | Bearer isolation/revocation, exact privileges, contact denial, instruction redaction pass |
| Function/table/grant policy |110 exact public functions, PUBLIC execute0; unchanged RLS/table/default grants and project/capability denials |
| Static/build | TypeScript, full ESLint, diff whitespace, generated-type parity, source/client secret scans; guarded Next16.2.7 Webpack and Turbopack production builds |

The standard focus/directory regressions now assert DB58 and wait for the fresh authorized profile check before inspecting profile content. The existing reminder rollback regression compares its exact starting ledger rather than assuming DB54. Behavioral assertions remain intact.

Local representative reminder measurements from the unchanged historical-heavy regression:10,000 historical assignments, discovery0.232ms, due query0.095ms, claim8.008ms. These are local fixture measurements, not production latency claims. Directory discovery remains local with no added requests. All provider interactions in tests were mocked or local recording transport.

## Visual evidence

Synthetic local fixtures only. Evidence lives in `previews/12-62-deletion` alongside the application folder:

- confirmation-390.png — mobile confirmation
- confirmation-1440.png — desktop confirmation
- confirmation-320/430/768/1920.png — additional responsive checks
- historical-calendar-1920.png — retained historical identity without contact action
- deleted-directory-1920.png — server-confirmed removal and preserved search
- results.json / history-results.json / directory-regression.json / sheet-focus-regression.json — browser evidence

Private terminal logs are retained in `C:\Users\mtfis\Documents\Codex\2026-10-28\project-local-12-62-implementation`. Prior-release screenshots/evidence overwritten by standard suites were restored; this batch's evidence is separate.

## Boundaries and remaining limits

Deletion is irreversible through the normal app. A schema downgrade must not be used to restore scrubbed personal data or revive tokens/assignments; any later recovery needs deliberate forward handling. An in-flight provider request already past authorization cannot be recalled. Existing uncertain delivery outcomes remain reviewable rather than being falsely called unsent. A contended operation fails safely and asks for a fresh review; it does not loop indefinitely.

SEC-12.57-01 remains OPEN / SEPARATE. Production state and its autonomous services were not inspected during implementation, so no claim is made about unrelated normal production activity. Production actions performed by this work: NONE. Real provider calls made by implementation/tests: ZERO.

This is an implementation candidate, not production release preparation or deployment approval. The final clean candidate SHA is reported with the delivery message.

## Files changed

- `app/admin/(workspace)/volunteers/page.tsx`
- `components/CalendarAssignedVolunteers.tsx`
- `components/CommunicationsWorkspace.tsx`
- `components/DeleteVolunteerDialog.tsx`
- `components/VolunteerCsvTools.tsx`
- `components/VolunteerDirectory.tsx`
- `docs/audits/12-62-volunteer-deletion.md`
- `lib/calendar/assignedContact.server.ts`
- `lib/calendar/assignmentNotifications.server.ts`
- `lib/calendar/assignmentPicker.server.ts`
- `lib/calendar/quickView.server.ts`
- `lib/calendar/routeRead.server.ts`
- `lib/needsAttention/routeRead.server.ts`
- `lib/notifications/communicationDispatch.server.ts`
- `lib/notifications/communications.ts`
- `lib/questionnaires/schedulerFacets.server.ts`
- `lib/supabase/database.types.ts`
- `lib/volunteers/csv.actions.ts`
- `lib/volunteers/csv.ts`
- `lib/volunteers/deletion.ts`
- `lib/volunteers/routeRead.server.ts`
- `lib/volunteers/schedule.server.ts`
- `lib/volunteers/server.ts`
- `scripts/12-47-local-fixtures.mjs`
- `scripts/12-53-assigned-contact-regression.mjs`
- `scripts/12-61-1-sheet-focus-browser.mjs`
- `scripts/12-61-directory-browser.mjs`
- `scripts/12-62-calendar-browser.mjs`
- `scripts/12-62-deletion-browser.mjs`
- `scripts/12-62-deletion-contract.mjs`
- `scripts/12-62-deletion-migration-regression.mjs`
- `scripts/12-62-deletion-regression.mjs`
- `scripts/12-62-disposable-replay.py`
- `scripts/assignment-reminders-regression.mjs`
- `scripts/communication-dispatch-regression.mjs`
- `scripts/function-privilege-policy.mjs`
- `scripts/volunteer-csv-regression.mjs`
- `supabase/migrations/20261028120000_volunteer_deletion_lifecycle.sql`

Synthetic screenshots and browser-result JSON are added only under `previews/12-62-deletion/`.
