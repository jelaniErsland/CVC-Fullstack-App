> HISTORICAL / SUPERSEDED: The owner abandoned the unshipped structured-skills model. This evidence describes an earlier local candidate, not the current release contract. Do not apply migration58. The current app-only direction is documented in `12-61-app-only.md` and `previews/12-61-app-only/README.md`.

# 12.61 — Structured skills management

Implemented locally from approved production application `87df898725e6ce909810c263d67ac732909bafd6`, production database57 / `20261026120000`. No production access, migration, deployment, volunteer mutation, communication, reminder/Cron or backup action performed.

## Data contract and migration

Migration: `20261027120000_volunteer_structured_skills.sql` (migration58).

SHA-256: `e22566bfb41f3f5518dff70a9e6658fd40149bea422e904a32f9e5159a6937c1`.

Adds exactly one column to volunteer_profiles: `structured_skill_categories text[] NOT NULL DEFAULT '{}'::text[]`. It is current, explicitly maintained profile state. The constraint bounds cardinality to10, rejects multidimensional/noncanonical/null/duplicate elements, and allows empty arrays. The existing ten categories remain unchanged: Painting, Demo, Framing, Finish work, Electrical assist, Plumbing assist, General cleanup, Check-in desk, Food service, Security.

No new table, role, RPC signature, index, grant, RLS policy, trigger or taxonomy. No provider/notification/reminder changes. Registry parity is tested against questionnaire validation, the live database constraint and the three deployed local function bodies, rather than relying solely on UI choices.

Seeding copies only wholly valid snapshot category arrays, sorted deterministically. Missing categories remain empty. Invalid/duplicate/unknown/malformed snapshots are reported and never partially salvaged. Neither snapshots nor prose are rewritten. The existing updated_at trigger records a profile update for a nonempty seed; profiles without a valid nonempty seed are not updated. Fresh production release prep must recheck the expected zero existing structured categories.

The three changed existing function bodies are:

- `create_manual_volunteer_profile(uuid,jsonb)`
- `update_volunteer_profile_manual_fields(uuid,jsonb)`
- `convert_questionnaire_submission_to_volunteer_profile(uuid)`

Create omission and explicit empty arrays produce no skills. Update omission preserves current skills; explicit empty arrays clear them; valid arrays replace them. Both application and database boundaries reject null/scalar/nested/coerced/unknown/duplicate values. SQL replacements assert exact predecessor fragments so they fail closed on an unreviewed body. Owners, ACLs, SECURITY DEFINER/search_path, capability checks and existing locks remain intact.

Questionnaire conversion initializes current categories while preserving the original submission and conversion snapshot. Later edits affect current skills only. `skills_experience` and other support remain separate, searchable prose. No automatic conversion or qualification inference exists.

## Add/Edit and authoritative refresh

One Skills editor serves Add and Edit. Ten semantic pressed buttons use restrained violet selection/check cues, a selected count, Clear skills, a two-column layout where space permits,44px targets and visible keyboard focus. There is no skill search, custom label or proficiency UI.

The existing server action and RPC remain authoritative. A successful Edit reloads one authorized profile using the existing bounded admin projection, returns that confirmed row, updates the open profile, and refreshes the RSC dataset without replacing the route. Search/filter/sort and directory position survive. Temporary edited-row reconciliation is component-local and respects PostgreSQL microsecond version precision; it is not browser storage or an authorization cache.

Existing workspace/profile locks and expectedUpdatedAt checking continue to reject stale changes with SQLSTATE40001. Rejected/failed saves retain the draft. A25-second confirmation deadline has honest unknown-outcome guidance and does not fabricate success or retry automatically. Pending writes cannot be dismissed. Returning from a conflict to Profile shows the latest refreshed record.

Ordinary edits still have updated_at and creation provenance, not a new per-field audit subsystem. Existing CSV operation audit/idempotency behavior is unchanged.

## Shared volunteer sheets and profile hierarchy

Filters, Details and Edit now use VolunteerSideSheet. It uses a native modal dialog, body-level portal, inert background, focus containment/return, scroll locking, one close-request boundary, consistent warm surface/navy heading/blue icon treatment, bounded440px Filters and620px Profile/Edit widths, and reduced-motion-aware130ms motion. Mobile uses a near-full-height sheet and safe-area padding. Other application drawers were not refactored.

The portal preserves direct structural adjacency between the filter summary and results; a closed dialog never interrupts discovery flow. Closing a read-only profile by backdrop, Escape or X works, while interior interaction does not dismiss it. Focus returns without scrolling; if its row has ceased to exist, search is the fallback.

All Edit close paths share the same pristine/dirty/pending guard. Dirty requests show a concise accessible Keep editing / Discard changes confirmation. Profile→Edit→Cancel returns to that profile; Save returns to its updated profile. Existing beforeunload protection remains. The final polish amendment replaces touched-only state with normalized initial/current equality and separates scrolling controls from the opaque fixed action row. Save is primary blue, Cancel quiet, and Delete remains a separate quiet action in the scrolling body. See `12-61-final-polish.md` for the amendment and reconciled evidence.

Profile hierarchy is contact, current Skills plus separately labelled experience, availability, upcoming/past schedule, then other authorized details. Dividers and restrained icon cues replace nested-card clutter. Contact actions and sheet controls have adequate targets; long text wraps. Existing exact Calendar Day/item assignment links and explicit Edit behavior remain.

## Directory density and Sort

The name and congregation now share one44px-or-larger identity button with a measured4px gap and a linked accessible congregation description. Row padding is slightly tighter without compressing contact/status columns.

Sort is a separate custom accessible menu beside Filters. It supports Name A–Z (default), Name Z–A, Congregation A–Z, Recently added, Oldest added, Schedule-ready first and Active first. Search precedes filter predicates, which precede sorting. Result counts and profile identity do not change. Unrecorded congregations sort last; priority sorts use explicit boolean ranking. Ties use Name A–Z then profile ID, including for equal descending names/dates. No surname parsing or surname options.

Sort is component-local and persists through Details/Edit/Save. The existing workspace-keyed directory boundary resets it along with other presentation state. No global persistence or private-data storage was introduced.

## Local verification

- Clean57→58 apply and ledger insertion tested in one transaction. Forced failure rolls back the column, ledger, seed and function changes; predecessor definitions/security metadata remain exact.
- Valid seed copied; two invalid snapshot fixtures were reported and not salvaged. Historical snapshots and questionnaire answers remain exact after later edits.
- Live constraint/RPC/application registry parity and all ten valid categories pass. Null, nested, coerced, duplicate, unknown and over-limit inputs fail. Direct owner fixture writes cannot bypass column constraints.
- Zero/one/multiple/add/remove/clear skills, omitted-update preservation, manual/questionnaire profiles, view-only denial, foreign-project denial and stale version conflict pass.
- Exact103-function policy / PUBLIC execute0, table/default privileges, Quick View, assigned-contact and assignment-instruction privacy regressions pass. Existing owners/ACL/search_path/security flags are unchanged. SEC-12.57-01 remains OPEN / SEPARATE.
- Standard persisted Add/Edit/reload and view-only browser suite passes with the current sheet contract. Add now explicitly exercises skills in that standard test. CSV formats/export privacy/import/identity/concurrency tests pass, including preservation of skills omitted by CSV.
- Eight widths:320/390/430/768/1280/1440/1920/2560. Main suite includes83 axe WCAG2A/AA +2.1AA audits, zero violations, no page errors, and zero external/provider requests. It covers every dirty-dismiss path, pristine dismissal, focus, save/profile/filter/search round trips, conflict/interrupted request recovery, pending-save protection, long profiles and deep-directory scroll/focus retention.
- The inherited full filter browser suite also passes at eight widths with64 axe audits and complete read-only fingerprints: OR status/congregation/weekday, match-all skills, category AND, chips, resets, all contextual zero states, shared-household/same-name identity and CSV action discoverability. Total distinct passing audit cases:147.
- Complete bounded roster reads at0/309/1001/5000 and explicit failure beyond the supported cap remain intact. No N+1 skill/profile reads. Sorting/filtering remain local, with zero extra requests.
- Representative local filter+sort medians:100 profiles ~0.03ms;309 ~0.06ms;1000 ~0.19ms;5000 ~1.0ms. These are synthetic local CPU measurements, not production latency claims.
- TypeScript, full ESLint, whitespace, credential/client-secret scans, and guarded Next16.2.7 Webpack/Turbopack builds pass. The actual guard receipt precedes compilation in both retained build logs.

The checked-in generated types were refreshed from the current local schema, preserving the strict whole-file generation regression; this also incorporates already-existing catalogue objects missing from the old manually extended type file. Old fixtures that used the noncanonical category General now use General cleanup. Stale Quick View test expectations were aligned with its already-existing date fields and authorized RPC path; Quick View product code did not change. The historical12.60 amendment-only diff-boundary test does not apply to an owner-approved12.61 schema/write-contract change; its presentation and privacy behaviors remain covered by current tests.

## Deferred scope, recovery and release boundary

Structured CSV import, bulk entry, custom skills and assisted prose review are not implemented. A later exact-registry CSV contract could reuse internal IDs, preview and version checks. Shared email must never authorize matching. A faster human-review workflow should be assessed after ordinary Add/Edit is in use.

No destructive rollback file is provided: dropping the new column after real administrative edits could erase current skills. Recovery should use the controlled checkpoint/restore or reviewed forward-fix protocol. The forced transaction-failure proof is complete. Production release prep still requires a fresh baseline/backup assessment and separately reviewed backup-tooling57→58 transition; neither backup tooling nor its active lock was changed here.

Screenshots: repository-root `previews/12-61-volunteer-skills/README.md`. All data is synthetic. Private logs: `C:\Users\mtfis\Documents\Codex\2026-10-27\project-local-12-61-verification`.

No application commit is deployed or pushed by this implementation. Production remains outside this local task.
