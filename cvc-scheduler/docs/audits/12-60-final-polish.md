# 12.60 — Final polish amendment

Refines approved candidate `9ed8ba704e6d1161c6bfede0bcae6bc248e3a347`. The approved production baseline remains `551d786b07476bf3b132b5ee4ba85ef4457b43eb`, DB57 / `20261026120000`. Local implementation only: no push, deployment, production read/mutation, send, migration or reminder change.

## Focused changes

- **Management actions:** Add volunteer and a quiet More disclosure now form a page-action row above the discovery surface. More exposes the unchanged Import CSV / Export CSV controls. They remain easy to find, keyboard accessible, and permission-aware. No utility sits between filter state/count and results. The desktop Add form still opens inline, now above discovery; the mobile Add sheet and existing editing flow remain unchanged.
- **Contextual copy:** Search-only counts say “match your search,” with a quoted search heading and Clear search. Filters-only counts say “match your filters,” with Clear filters. Combined counts say “match your search and filters,” with Reset search and filters. Singular results say “matches.” Blank/whitespace search is not treated as active. An empty state has one reset action; its count bar does not duplicate it.
- **Experience matches:** An experience-only search result includes plain secondary text, `Experience note matches “forklift”`. It returns only the searched phrase, never a prose excerpt or hidden note content. It does not create a structured skill chip or interpret the prose as a qualification. Structured/identity matches take priority, avoiding duplicate explanations. Structured matching skills retain their existing priority and chip treatment.
- **More chips:** +N more is a neutral rounded pill with a border, hover state, 44 px target and visible focus. It opens the same selected filter surface as before.
- **Secondary criteria:** Security, 2+ days/week and Housing stay visible in their existing order inside the same surface, under a quiet Other criteria group. Primary sections retain their order, sticky title/footer, independent scrolling and selection controls. No Advanced mode, extra accent color, gradient, heavier shadow or decorative animation was added.

## Mobile flow and responsive review

Production-mode local fixture screenshots and DOM checks cover **320, 390, 430, 768, 1280, 1440, 1920 and 2560 px**. Mobile fixtures use an 844 px height. The two-result combined-filter case places the results immediately after the filter summary:

| Width | Summary-to-results gap | First result top | Visible before scrolling |
|---:|---:|---:|---|
| 320 | 0 px | 549.69 px | Yes |
| 390 | 0 px | 549.69 px | Yes |
| 430 | 0 px | 524.19 px | Yes |

Management actions are above search at every width. Result adjacency is asserted structurally and geometrically. No typography or touch target was shrunk to achieve it. No horizontal overflow. Desktop remains centered at the approved 1280 px maximum; sheet/drawer sizes and behavior remain approved.

Visual comparison is against the retained prior 12.60 gallery, not against a different environment or production timing benchmark. No speed percentage is claimed.

## Regression and accessibility results

- Name, structured skill, experience-note, partial/case-insensitive search pass. Experience note fixture prose contains a private marker; the marker is absent from directory rows. Structured/prose overlap has no duplicate explanation.
- Multi-status/congregation/day, skills match-all, combined categories and search + filters pass unchanged.
- Chip removal, neutral +N more disclosure, category clear and Clear all pass. All three contextual zero states and their exact counts/reset labels pass.
- Profile open/close preserves selections. Same-name/shared-household identities remain separate. Search/filter/chip interactions make no server actions.
- Add/Edit/reload desktop/mobile and view-only browser regressions pass. More opens both original CSV dialogs without submitting, importing or downloading. Escape closes the disclosure and restores its trigger focus. Original CSV handlers/export privacy warnings are byte-for-byte unchanged.
- Eight-width browser matrix: **64 axe WCAG 2 A/AA + 2.1 AA audits, zero violations**, zero page errors/external requests. Includes directory, experience matches, filter surface/selected state, all three zero states and More data actions. Original 44 px targets, keyboard Enter/Space/F/Escape, live counts, focus containment/return and reduced-motion behavior remain intact.
- Full public/contracted Auth fixture fingerprints remain exact across the read-only browser flows. Existing volunteer persistence/no-view/foreign-project authorization, table/default privileges, assigned-contact and Quick View regressions pass. Canonical unchanged instruction-security regression passes against the local database, including exact function policy and anonymous/direct-access denials. Exact 103-function policy / PUBLIC execute zero verified.
- TypeScript, full ESLint, whitespace and credential/client-secret scans pass. Guarded Next.js **16.2.7 Webpack and Turbopack** builds both pass with verification before compilation.

## Preserved boundary

`directoryFilters.ts`, the bounded roster reader, profile projection, skill registry/snapshot authority, all APIs/mutations, CSV implementation, authentication, permissions, schema/migrations, notification/reminder infrastructure and dependencies are unchanged from the approved candidate. A dedicated regression enforces that boundary. The new helper produces display copy only and never participates in filtering or authorization.

The prior persistence choice remains: component-local state survives profile open/close and clears on workspace change; no new stored data, private browser storage, URL/filter-history scheme or cross-user cache. Manual prose remains searchable and never becomes a structured qualification.

No migration or architecture approval is needed. Production, live reminders, Cron and the backup task were untouched. No real provider call or message. The prior canonical source-only test export was reused; no new restore/data export was created.

Updated gallery: `previews/12-60-volunteers-polish/README.md` at repository root. All images use synthetic LOCAL FIXTURE data. Original 12.60 images remain unchanged for direct comparison. Private logs: `C:\Users\mtfis\Documents\Codex\2026-10-27\project-local-12-60-polish-verification`.
