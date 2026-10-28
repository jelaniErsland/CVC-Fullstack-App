# 12.61 — Volunteer directory and profile refinement (app-only)

This report supersedes the unshipped structured-skills direction. Starting candidate: `3025e6a3c5f483c49139d345189304b5b1d0d23f`. Expected production remains application `87df898725e6ce909810c263d67ac732909bafd6`, database57 / `20261026120000`. Production was not accessed, modified or deployed during this work.

## Removed architecture and database compatibility

Migration58 `20261027120000_volunteer_structured_skills.sql` is removed from the release. The migration directory contains exactly57 files, terminal `20261026120000`, and is byte-for-byte unchanged from production Git state. No new migration, table, column, constraint, RPC, grant or RLS change remains pending.

The abandoned column, profile property, generated column types, registry/validator, structured write-contract extensions, ten-button Add/Edit editor and database tests were removed. Existing questionnaire scheduler facets were restored exactly to production57 source behavior. The three production mutation/conversion functions receive no release change; local verification restored their predecessor bodies and removed only the unshipped local fixture column/ledger entry. Function owner/ACL/search_path/SECURITY DEFINER metadata and all retained profile fields remained unchanged during that local reset.

The final app runs on the local DB57 fixture with no abandoned column. Add, Edit, conversion/persistence, directory reads, CSV, Filters, Sort and Profile/Edit pass. Database types were regenerated using the repository’s standard local generation contract; its normalized whole-file comparison passes. The existing authorized single-profile reread remains for server-confirmed Edit reconciliation; it uses the existing table projection and project boundary, not a new write API.

## Exact searchable sources

Only these existing authorized profile fields enter the Skills & experience index:

| Priority | Existing source | UI label |
| --- | --- | --- |
| 1 | `skills_experience` | Experience note |
| 2 | `skills_help_snapshot.skillsExperience.details` | Questionnaire experience response |
| 3 | String labels in `skills_help_snapshot.skillsExperience.categories` | Historical questionnaire categories |

No new persisted interpretation exists. No raw questionnaire table read was added. Duplicate source text is shown once, preferring current editable prose. Snapshot contents and original submissions are not changed by editing the current prose.

The experience filter does not search profile notes, other-support notes, physical-work notes, availability notes, emergency/private fields, assignment instructions or authentication data. Broad main search preserves its already-authorized name/contact/congregation/status/readiness/profile-note/other-support discovery fields, and includes the three experience sources. Match excerpts always come only from the explicit experience allowlist, even when broad search finds another field.

## Text matching and filter UX

The roster is indexed locally when it changes. Text is case-folded with en-US lowercase. Each trimmed term uses literal substring matching. Multiple terms must all be present in the aggregate skill-related content. There is no AI, fuzzy search, synonym expansion, qualification inference, score or automatic category conversion. For example `elect` can find Electrical/electrician text; it does not expand to wiring. `electrical` is not silently expanded to the different word electrician.

Filters retains the approved warm right-side sheet, tinted sections, result footer and category hierarchy. Skills & experience now accepts terms via Enter or Add and displays removable violet chips. Duplicate terms are rejected case-insensitively. Inputs are bounded to120 characters and10 simultaneous terms, with clear feedback. Long unbroken chips wrap within narrow sheets and active-filter rows. Removing terms works by keyboard and returns focus to entry.

Congregation remains a searchable structured multi-select. `bel` narrows to Belgrade; multiple selected congregations use OR. Status and recorded weekdays also use OR within their categories. Across categories the result is AND, with AND across experience terms. Filter badges still count active categories, not values. The combined fixture Active + (Belgrade/Bozeman) + (Monday/Wednesday) + electrical + framing returns exactly Alex Morgan and Jordan Smith, sorted correctly by congregation.

## Match context and long responses

Ordinary unfiltered rows remain compact. Active experience filters show a restrained violet source-context area beneath each matching identity row. An experience-only main-search match also exposes useful context; identity/contact matches do not add redundant context automatically.

Source priority explains every selected term with as few source blocks as needed. Historical labels are clearly historical. Matching text uses semantic marks, underline and stronger weight, capped at six highlights per source block. Literal punctuation and markup-like text remain escaped React text; no raw HTML rendering is used.

The negative sentence “I don't have electrical experience, but I'd like to learn.” still matches electrical and is shown as written. No language asserts a qualification. Short responses appear in full; longer sources use an approximately230-character excerpt around a useful first match, retaining nearby negative context and ellipses. Show full response expands the exact trimmed recorded source locally inside the result, with Show less to restore the excerpt. No fetch or profile request is triggered.

## Preserved sheets, editing, density and Sort

The shared VolunteerSideSheet remains. Profile owns identity in its header, with contact metadata, source-labelled experience, availability, exact Calendar Day/item links, upcoming/past assignments and explicit Edit below. No structured selector remains in Add or Edit; the existing Skills and experience textarea stays editable through the original API. The opaque action row remains separate from scrolling controls; every bottom field can sit fully above Save.

Backdrop/Escape/X close read-only Profile. Pristine Edit also closes via Cancel without warning. Focus-only interaction, restored text and restored weekday values return to pristine; genuine edits trigger the same Keep editing / Discard changes guard on all close paths. Pending saves remain protected. Save is server-confirmed, failures retain drafts and existing unknown-outcome guidance, and no automatic retry was added.

The browser pass exposed a real native-dialog edge case: Shift+Tab could move focus to BODY. Small explicit boundary wrapping now covers the sheet and discard confirmation, and mode changes recover focus inside the sheet when the triggering Edit control unmounts. Native inert/background semantics and final trigger-focus return remain intact; browser modifier shortcuts are not intercepted.

All seven Sorts remain: Name A–Z, Name Z–A, Congregation A–Z, Recently added, Oldest added, Schedule-ready first, Active first. No surname parsing. Search → Filter → Sort is unchanged. Same-name/shared-household records remain distinct by identity. Search, filters, Sort and volunteer context survive Profile/Edit/Save/Cancel; workspace-key reset behavior remains unchanged. Name/congregation spacing is measured4px and identity controls remain at least44px.

## Verification and performance

The production-mode responsive suite passes320/390/430/768/1280/1440/1920/2560, with153 current axe WCAG2A/AA +2.1AA audits and zero violations. These current scans replace the old taxonomy UI evidence; they are not added to historical147 to inflate a count. Keyboard term entry/removal, congregation search, highlight semantics, long responses, maximum-length chips, footer reachability, focus wrapping/return, all dismissal paths,96 pristine cases,32 genuine dirty close paths, pending saves, interrupted Save recovery and state retention pass. No horizontal overflow or page errors occurred.

Discovery preserved all public/contracted Auth/sequence fingerprints and made zero server actions. Only intentional disposable profile fixtures were edited in mutation tests. No per-term, per-source or per-card requests were introduced. One existing authorized roster read supplies the data. Synthetic local filter+sort medians were about0.08ms at309,0.39ms at1000 and1.49ms at5000 profiles; indexing was performed once per roster. These are CPU timings, not production latency claims.

The standard persisted Add/Edit/reload browser regression also passes with free-text experience, mobile editing and view-only access. Local regression passes include project isolation, exact103-function policy / PUBLIC execute0, table/default grants, Quick View privilege/bearer isolation, assigned-contact privacy, volunteer schedule access, instruction privacy, profile persistence, CSV preservation, Project Day generation/facets and normalized dirty equality. The instruction regression ran unchanged through a canonical LF source export to avoid the known Windows CRLF comparison artifact.

TypeScript, full ESLint, whitespace checks and credential/client-secret scans pass. Guarded Next16.2.7 Webpack and Turbopack builds pass; each receipt occurs before compilation. Dependencies and lockfile are unchanged. Detailed logs are retained outside the repository in `C:\Users\mtfis\Documents\Codex\2026-10-27\project-local-12-61-app-only`.

## Evidence, limitations and release boundary

Current screenshots, current audit results, performance/security/build summaries and a checksum index: [previews/12-61-app-only/README.md](../../../previews/12-61-app-only/README.md). Earlier galleries remain as historical evidence with superseded banners. Old structured-skill execution scripts were removed or replaced by current literal-text regression entry points.

The matching behavior deliberately cannot distinguish positive statements from negative ones; administrators must read the recorded context. It does not certify qualifications. Legacy availability/form-control redesign remains deferred. Automated axe checks do not substitute for an assistive-technology user study. A separate app-only release preflight is still required before deployment.

Automatic approval review rejected cleanup of the disposable canonical source export with “blocked by policy.” Retained location: `C:\Users\mtfis\Documents\Codex\2026-10-27\project-local-12-61-canonical-security`. It is a source export; no .env files were copied. The rejection does not affect the verified application/database contract.

Production mutations: NONE. Real provider/email calls: ZERO. No deployment, push, production SQL/migration, reminder/Cron action or backup/tooling/lock change.

READY FOR 12.61 APP-ONLY RELEASE REVIEW
