# Instruction privacy — approved policy and enforcement

Reviewed September 27, 2026 on `codex/simplified-task-details`, continuing from `cbb35c5`. **The product-owner decision is resolved and implemented locally.** Detailed instructions belong to the volunteer's own authorized assignment and appropriately authorized administrators. Bearer Quick View and generic authenticated schedule viewers receive operational data without detailed instructions. No production migration or deployment has occurred.

## Enforcement boundaries

The new forward migration is [20260927120000_instruction_privacy.sql](../../supabase/migrations/20260927120000_instruction_privacy.sql). No deployed migration is edited. It changes no instruction data, snapshots, history, notification operation or volunteer credential function.

| Retrieval path | Enforcement |
| --- | --- |
| `read_project_quick_view_by_token(text,date)` | `schedule_notes` and `task_description` are JSON null; `custom_values` is an empty object. Enforcement precedes server rendering and serialization. |
| `read_authorized_calendar_items(uuid,date,date)` | Auth identity, active contact/workspace/live grant, `calendar.view`, publication/creator ownership and optional existing date-window predicates. Saved notes and custom values require `calendar.edit`; otherwise notes are null and custom values empty. |
| `read_authorized_task_presets(uuid)` | Auth identity, active contact/workspace/live grant and `tasks.view`. Description and custom-field definitions require `tasks.edit` or `calendar.edit`; otherwise description is null and definitions empty. |
| Direct Task/Calendar table REST or GraphQL reads | Existing SELECT RLS is tightened to the corresponding existing view + edit authority. Generic view grants cannot recover sensitive columns by bypassing the RPCs. Table privileges and default privileges are unchanged. |
| Assignment/response table reads | Existing assignments-view, Calendar-view, workspace, publication and creator gates remain. A narrowly scoped boolean `can_view_calendar_item_operations(uuid,uuid)` helper avoids losing staffing rows when raw instruction-row RLS is tightened. It returns no text or profile data. |
| Personal volunteer assignment access | Existing `read_volunteer_schedule` remains unchanged: matching hashed schedule credential, person/workspace/profile/assignment/publication/lifecycle checks and saved occurrence instructions. A project Quick View bearer cannot substitute for that credential. |
| Notification composition | Existing authorized claim still receives saved occurrence notes; existing recipient, confirmation, ledger, idempotency and resend rules remain. No application delivery code changes. |
| Private instruction history | Existing RLS with zero client policies and revoked table/sequence access; no new history retrieval route. |

No new role or capability is introduced. A role label, task name, client flag, guessed ID or household email does not establish instruction authority. Authenticated Quick View remains read-only even for an administrator allowed to see instructions; generic read-only/on-site contacts do not gain text merely by authenticating.

All seven existing server read boundaries now use the authorized projections: Calendar read model, item reader, task selector, Tasks reader, future-instruction preview, volunteer-directory schedule and the legacy operational Quick View reader. Explicit selectors, ordering, date/context filters, bounded Calendar range and existing parallel read groups remain. There is no unsafe raw-read fallback or runtime service-role credential.

## Exact bearer operational contract retained

Top-level fields remain `access_state`, `workspace_display_name`, `workspace_timezone`, `project_date`, `project_starts_on`, `project_ends_on`, `token_expires_at`, `expected_on_site_count` (currently null), and `schedule_sources`.

| Item fields retained | Purpose |
| --- | --- |
| `id`, `workspace_id`, `task_preset_id`, `title_snapshot`, `task_type_snapshot`, `schedule_kind` | Exact identity/classification and selection. |
| `start_date`, `end_date`, `start_time`, `end_time`, `timezone` | Date/time and recurrence context. |
| `needed_count`, `task_preset_label`, `task_preset_color_key`, `assignments` | Staffing and existing presentation. Active assignment objects retain assignment/item/profile IDs, permitted volunteer display name and response status. Declined is distinct from active staffing. |
| `meal_kind`, `meal_provider`, `meal_contact`, `meal_menu`, `meal_total` | Existing meal operational information; missing, recorded zero and positive counts remain distinct. Meal entries retain headcount/contact presentation rather than volunteer rosters. |
| `lifecycle`, `publication_state`, `published_at` | Existing active/published boundary. |
| `schedule_notes`, `task_description`, `custom_values` | Keys retained for compatibility; values are null, null and {} respectively. |

The bearer function retains its hashed 43-character credential, purpose/version, revocation/expiry, active project/end-date checks, date window (source start before selected date + 42 and end on/after selected date − 31), preset-owned color, security-task inclusion and active assignment/status projection. Retrieval still updates only token last-use metadata. The security regression compares its entire function definition with the last deployed definition after exactly those three approved field substitutions.

## Custom values audit

`custom_values` permits arbitrary administrator-defined scalar fields, including up to 2,000-character strings, without a fixed operational audience. Its preset definitions likewise accept prose labels/options. Allowing all strings, number-shaped strings, arbitrary keys or trusted-looking labels would permit instructions to bypass the policy.

**The explicit read-only custom-value allowlist is empty.** The repository establishes no fixed custom key required by current Quick View. Required operational structure already has dedicated fields in the table above. Current Breakfast/Lunch system presets use empty definitions, and the meal repeat command requires empty custom values. The retired/general project-day expected total is not reinterpreted as a meal headcount. No structured meal/staffing/date field is removed. Administrators retain every original custom value/definition. Adding a future public custom key requires a reviewed typed contract; no implicit free-form prose channel is introduced.

All legacy notes/descriptions, including general wording, are withheld from the restricted audiences because these columns do not distinguish public from private instructions. Approval timestamps, provenance, task type or title are not audience classifiers. This is the owner's approved policy, not an unresolved alternative.

## Executed evidence

- Real local Auth/RPC: bearer null notes/descriptions across linked/unlinked presets, preset changes and meal counts; no custom prose; unchanged mixed confirmed/pending/declined identities; generic viewer safe rows plus direct-table denial; foreign project and anonymous denial; draft exclusion, malformed/expired/ended/revoked bearers.
- Personal credential: assigned volunteer still receives the saved occurrence note and only their assignment. The project bearer fails to recover it through personal schedule/response RPCs. Full personal-access and response suites retain cross-person, same-household, revocation, publication and response persistence checks.
- Browser: actual bearer route and item deep links on desktop/mobile; privileged administrator positive text; live grant downgrade followed by authenticated Calendar/Quick View negative serialized payload checks; mobile read-only check; completed HTML/RSC/JSON network bodies inspected. Superseded, cancelled prefetches do not count as completed payload evidence. Meal summary and inspector retain headcount/contact; no editing action is exposed.
- Editing and notification: five fresh-production save/preview/apply journeys verify DB persistence; full Calendar/Bulk planner and volunteer responses pass. The real authorized notification claim retains saved notes, and mocked-provider HTML/text contains those details and the primary response link. No real provider is enabled or real email sent.
- Exact local catalog: 80 signatures, 10 anonymous, 52 authenticated-only, 18 internal; PUBLIC zero; hardened defaults, private history/sequence, trigger preservation and stale-version checks remain. Three added RPCs/helpers are postgres-owned SECURITY DEFINER with empty search paths, authenticated/service_role EXECUTE only, and server-derived identity checks. No new anonymous grant.

Full commands/results and screenshots: [implementation review](TASK_DETAILS_IMPLEMENTATION_REVIEW.md), [gallery](../previews/assignment-instructions/README.md).

## Release requirements and limits

Privacy is implemented and verified locally; final production release approval is still required. Pending instruction migration `20260926120000` precedes privacy migration `20260927120000`. A coordinated approved release must include the compatible projection-reading application: an old application using raw reads cannot preserve generic viewer operational data after tightened RLS. Do not restore broader grants or roll back privacy to accommodate an old client; use a compatible forward fix. Existing quiet-window, backup, migration/preflight, fingerprint and smoke safeguards remain release gates.

Previously retrieved/downloaded/copied instructions cannot be recalled. Existing private/no-store and credential expiry/revocation govern future app retrieval. Development Server Action transport root cause and production slowness remain unresolved; local timings are not production performance evidence. Site-map upload remains disabled. No merge, production migration, deployment, backup configuration change or Batch 3 work is authorized by this review.
