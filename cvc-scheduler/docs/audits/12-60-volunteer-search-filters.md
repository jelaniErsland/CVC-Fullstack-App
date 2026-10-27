# 12.60 — Volunteer search and filters

The approved initial candidate is refined by [the final polish amendment](12-60-final-polish.md), with updated action placement, contextual copy, experience-match explanations and review evidence. This document retains the original architecture and design-review record.

Local candidate based on production `551d786b07476bf3b132b5ee4ba85ef4457b43eb` (12.59). App-only. No deployment, production access/mutation, messages, reminder changes or migration.

## Architecture and approval gate

The authenticated Volunteers route verifies the project contact and effective workspace capability before reading `volunteer_profiles`. Existing RLS and explicit workspace predicates remain authoritative. The existing profile projection already supplies congregation, lifecycle, current weekday preferences, miscellaneous support criteria, and `skills_help_snapshot`.

No new API, read model, grant, field, function or SQL is needed. The current full-profile directory payload is unchanged; this work does not fetch additional private data to filter. Schedule details still load only when explicitly opening a volunteer.

The old directory used a single PostgREST read and local single-value congregation/status/weekday selectors, plus miscellaneous Advanced filters. That read could silently truncate at the platform row cap. It now reuses the existing authorized CSV page reader: stable ID order, 500 rows/request, maximum 5,000, explicit error instead of partial counts on failure/overflow. Names are then sorted with ID tie-breaking. Current-scale 309 profiles still require one read. Tests prove matches past row 1,000 and errors on partial/oversized reads. Future server-side directory pagination beyond 5,000 remains a separate architecture decision.

## Skills authority and limitations

Structured choices come only from the existing validated questionnaire registry at `skills_help_snapshot.skillsExperience.categories`. The existing projection rejects malformed/unknown/duplicate choices. No AI, prose inference, proficiency or mock data.

The actual registry includes **Electrical assist**, Framing, Painting, Demo, Finish work, Plumbing assist, General cleanup, Check-in desk, Food service and Security. `Electrical`/`elec` searches match Electrical assist. Forklift occurs in mock data, not this stored structured contract, and is not invented as a live filter option. Tests use Electrical assist + Framing to exercise the same required match-all semantics.

Manual profiles currently store free-text skills/experience and an empty structured snapshot. Their notes remain searchable but do not become asserted qualifications or selected skill matches. Options are derived from structured skills actually present in the authorized roster. An empty catalogue explains that no structured skills are recorded. Adding structured skill editing or a broader catalogue is outside this batch and would require a separately approved data contract.

## Interaction and design

- One search: existing name/contact/congregation/status/readiness/note/support search plus recorded skill names; case-insensitive substring matching.
- One Filters entry. Count measures active categories, never selected values.
- Full-height 440 px desktop drawer; full-width mobile sheet. Fixed title/footer, independently scrolling body, one blue Show N volunteers closing action. Selections update locally and immediately; closing/Escape retains them.
- Status, congregation and weekdays use any selected value. Skills require every selected recorded skill. Categories combine together. Security, housing and 2+ days/week remain available, with Yes/No/Not recorded choices and category clearing.
- Searchable congregation and skill options; semantic pressed buttons rather than native selects, multi-selects or a checkbox wall.
- Up to six removable category-tinted chips plus a +N more entry to the same filter surface. Individual/category/all clearing. Exact result count in the directory and accessible live count in the drawer.
- Search precedes Add/CSV utilities. The entire route uses an intentional 1280 px maximum composition. The 12.59 navy/blue, warm near-white, tinted icon wells, teal/amber/violet selection cues, soft depth and restrained borders are carried through.
- Matched structured skills come first in directory rows, with at most three tags and an additional-count indicator. A dedicated Skills section in the existing profile drawer shows recorded choices and existing experience notes. Edit stays explicit; rows never expand inline.
- Calm no-match state with useful guidance and a Clear filters action. It describes recorded data, never a person's real-world abilities.

## State, accessibility and reliability

Search and selections are component-local presentation state. They survive profile view/edit/close without routing, and clear when the authorized workspace key changes. No private data or search text is written into browser storage, URLs or a global cache. Normal browser history is not intercepted or padded with fake filter entries. Cross-route/reload preference persistence is deliberately not promised.

The filter dialog has a labelled modal role, focus containment, Escape/backdrop dismissal and focus return to its trigger. Enter/Space and the existing F shortcut work; search uses the existing / target. Selected state is programmatic and includes a checkmark, not color alone. New filter controls have at least 44 px targets. Reduced-motion settings remove the 130 ms entrance animation. No async request or loading state is added to filtering. Directory load failures retain the existing finite route timeout/error behavior; a failed page never publishes a partial roster.

## Verification

Production-mode local fixture browser matrix: **320, 390, 430, 768, 1280, 1440, 1920, 2560 px**. No overflow, correctly sized full-height sheet/drawer and sticky footer. All eight widths passed semantic selections, partial/case-insensitive skill search, combined filters, chips, category/all clear, zero results, same-name/shared-household separation, profile Skills, retained detail-return state, keyboard Enter/Space/F/Escape and focus containment/return.

**24 axe WCAG 2 A/AA and 2.1 AA audits passed**, covering directory, filter surface and selected filter state at every width. No page errors or external requests. Search/filter/chip interactions generated zero server actions. Full contracted public/Auth fingerprints were unchanged across each read-only browser case. Profile detail uses only the existing authorized schedule read.

Local pure filtering, median of 20 runs after one index construction:

| Roster | Index construction | Filter calculation |
|---:|---:|---:|
| 100 | 0.27 ms | 0.022 ms |
| 300 | 0.70 ms | 0.035 ms |
| 1,000 | 0.83 ms | 0.084 ms |
| 5,000 | 4.24 ms | 0.275 ms |

These are local calculation timings, not production click-to-paint measurements. No added N+1/profile/skill requests. The index is rebuilt only when the authorized roster changes.

Passed existing local regressions: volunteer profile management (including read-only/foreign/no-view grants), persisted Add/Edit/reload and mobile browser flow, project table/default privileges, assigned-contact privacy, Quick View privilege/bearer isolation, instruction privacy and exact function policy. The instruction test ran unchanged from canonical Git source identical to this candidate for all tested files, avoiding the known Windows CRLF false failure. No assertions weakened. Exact mutation/validation functions and protected database/auth/notification/infrastructure/dependency paths are checked by the scope regression.

TypeScript, full ESLint, whitespace and credential/client-secret scan pass. Supported Webpack and Turbopack production builds pass, both printing the guarded Next.js 16.2.7 verification before compilation. No dependency changes.

Evidence gallery: `previews/12-60-volunteers/README.md` at repository root. All screenshots use explicitly synthetic LOCAL FIXTURE data. Raw browser/a11y results accompany them. Other logs are retained privately in `C:\Users\mtfis\Documents\Codex\2026-10-27\project-local-12-60-verification`.

Automatic approval review blocked removal of the disposable `canonical-instruction-proof` source folder and adjacent ZIP in that private evidence directory. They contain tracked source only; no credentials or production data. They are outside the candidate tree.

No migration. Production, live reminders, Cron and the backup task were untouched. SEC-12.57-01 remains separate.
