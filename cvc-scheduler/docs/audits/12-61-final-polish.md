# 12.61 final polish / evidence pass

Approved parent: `8d38b085c093f2473fa7d380078ac2fc9e0b8500`. This amendment changes volunteer form presentation/equality only. All work and fixtures were local; production was not accessed or changed. No deployment, push, SQL apply, reminder/Cron/backup action, or email/provider call occurred.

## Fixes

The footer overlap was real. Add/Edit previously placed sticky action content inside the scrolling form. A form-specific variant of the existing shared sheet now gives the form a bounded scrolling controls pane and a separate non-scrolling action row. Actions retain an opaque warm surface, divider and safe-area padding. Delete remains a quiet, separate action inside the controls pane. No new sheet framework or legacy-control redesign was introduced.

Bottom reachability passed at320/390/430/768/1440, with all form disclosures expanded. Five scroll positions per form were checked for a non-overlapping pane/footer boundary. Congregation, preferred contact, emergency relationship and final notes can each sit completely above the footer. Final-field measured clearance was38.66–39.45px for Add and132.45px for Edit. See the evidence gallery for all ten bottom screenshots and exact measurements.

Touched-only dirty detection was also real. The form now captures its initial normalized editable values once per mount and compares current values. Names, boundary whitespace and textarea line endings normalize consistently; skills/weekdays compare as sets ordered for equality, while duplicate invalid entries remain distinguishable. Hidden metadata is excluded. Native input/change events cover ordinary controls; an observer notices custom Skills hidden-input changes after commit. Disabled controls remain included in equality while saving. Comparison does not validate, authorize, modify submitted data or persist private data.

At every requested width: focus without editing, text restored exactly, and a skill selected then deselected all dismiss without warning through backdrop/Escape/X/Cancel. A nonempty initial skills set restored after toggling also returns to pristine. Genuine changes remain protected on every close path. Keep editing preserves drafts; Discard returns to the correct profile. Pending saves remain protected; stale-save conflicts and interrupted requests retain honest failure guidance/drafts. No automatic retry or fake Save success was added.

Profile header now owns name/congregation. The body’s first section contains actual contact/preference/lifecycle/readiness information, without repeating identity. The rest of Profile, its Calendar links, instructions/privacy and explicit Edit behavior remain intact.

Sort was unchanged. Desktop1440/mobile390 captures show all seven approved options: Name A–Z, Name Z–A, Congregation A–Z, Recently added, Oldest added, Schedule-ready first and Active first. All options were exercised at all five widths; counts and server calls remained unchanged. No surname sorting.

## Evidence and verification

Updated gallery: [previews/12-61-final-polish/README.md](../../../previews/12-61-final-polish/README.md). It includes43 screenshots and a checksum index.

Historical accessibility147 is exactly83 Skills/sheet audits +64 full-filter audits. Both original JSON files are included unchanged, with hashes and original locations. The amendment’s70 audits are reported separately; zero violations. Repeated checks were used for correctness/geometry, not to inflate the historical count.

The focused production-mode browser pass covers Add/Edit skill selection/clear/Save, updated Profile, free-text and snapshot preservation, search, match-all Skills filters, Sort, active-filter/search/sort retention, all close paths, focus containment/return, long Profile, pending/conflict/interrupted Save states, and deep-directory position. Position remained3767px before and after opening/closing a deep profile. No horizontal overflow or page errors at any width. All non-profile public-table fingerprints stayed exact; only intended disposable profile fixtures changed. Zero external/provider requests.

The standard persisted Add/Edit/reload browser regression also passed, including Add with Electrical assist + Framing, mobile editor and view-only access. The pure normalized-state regression passed. Prior architecture, SQL, registry, authorization/isolation and privacy proofs remain applicable because none of their implementation changed.

Required final gates: TypeScript, full ESLint (zero errors/warnings), git diff whitespace check, source/client credential scans, exact function policy and both guarded Next16.2.7 Webpack and Turbopack builds passed. Each build printed `Project Local: verified guarded Next.js 16.2.7 router source` before compilation. Exact local function policy:103 functions, PUBLIC execute0, defaults denied, direct anonymous mutation denied, no target/residual changes. Static/guard logs are retained privately outside the repository.

## Unchanged database/release boundary

Migration58 `20261027120000_volunteer_structured_skills.sql` is byte-for-byte unchanged from the approved parent, SHA-256:

`e22566bfb41f3f5518dff70a9e6658fd40149bea422e904a32f9e5159a6937c1`

No SQL, types/data contract, server write API, grant/RLS/function, dependency/lockfile, navigation/Sort semantics or delivery-authority change is part of this amendment. The already-approved migration58 still requires separate controlled production release prep; it was not applied to production.

Legacy availability controls and broader form visual consistency remain deliberately deferred. Automated axe checks do not substitute for an assistive-technology user study. No additional product/design blocker was found.

The preexisting untracked screenshot ZIP was preserved outside the repo rather than deleted: `C:\Users\mtfis\Documents\Codex\2026-10-27\project-local-12-61-final-polish\12-61-volunteer-skills.zip`, SHA-256 `111d024bd8f4ee982edcdfca091ae515aaed4ff7d6341b6ee0265893ce5f4934`.

READY FOR 12.61 STRUCTURED SKILLS RELEASE PREP
