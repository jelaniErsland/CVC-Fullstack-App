# 12.56 — Admin command palette and keyboard shortcuts

Baseline: `a21a2a0e2e8b28b538546c2e1b229d4557146ee1` (12.55C).
App-only implementation. No deployment, production requests/mutations, notifications, backup-task operations, or migrations were performed. Database baseline remains migration 52 / `20261015120000`; this batch does not change SQL.

## 1. Palette design

A compact elevated dialog, centered on desktop and placed near the bottom on narrow screens. Search, a restrained selected row, scrollable results, small key hints, concise no-match state, and an explicit close control. Native modal semantics plus the existing focus-containment and scroll-lock helpers are used. No new dependency.

## 2. Commands

Eight destinations: Overview, Calendar, Volunteers, Needs Attention, Task library, Communications, Quick View, Contact Guide.

Four workflow entries: Create Calendar item, Assign volunteers, Add volunteer, Send schedules / Communications. Create opens the existing form; repeated opens on the current Calendar use its existing Create control. Assign opens Calendar so the admin can choose the actual item. Add opens Volunteers with the existing Add control available. Send schedules opens the Schedule deliveries section. These entries never select volunteers, save, review recipients, or send.

## 3. Shortcut map

| Keys | Behavior |
| --- | --- |
| Cmd/Ctrl K | Open / close commands |
| G O | Overview |
| G C | Remembered Calendar view/date |
| G V | Volunteers |
| G A | Needs Attention |
| G T | Task library |
| G M | Communications |
| G Q | Quick View |
| G H | Contact Guide |
| / | Existing primary search; otherwise commands |
| F | Existing filters where available |
| T | Existing Today action, only on `/admin/calendar` |
| Escape | Close the local palette or cancel the G sequence; never navigate |

G mode expires after 1.2 seconds without a timer, popup, or focus change. Pointer use/window blur cancels it. No recents or query persistence.

## 4. Typing safety

Single-key shortcuts yield to inputs of every type, textarea, select, forms, editable content, textbox/searchbox/combobox/listbox/option/spinbutton/menu roles, dialogs, and inert content. Visible dialogs block global single-key operation even when focus is on a button. Composition, handled events, repeat keys, and modifier combinations are guarded. Cmd/Ctrl K intentionally works in an ordinary search field but does not stack over another editor/modal.

## 5–7. Search, filters, Today

Search uses a tiny case-insensitive per-word subsequence matcher over static labels/keywords. Prefixes such as `cal`, `vol`, `task`, and abbreviated `clndr` work. Matching cannot accidentally span unrelated keyword words to select a different workflow.

Volunteers and Tasks focus their existing search and filter select. Attention reveals its existing mobile filter disclosure before focusing search/When. Calendar opens its existing filter surface and focuses Task name for `/`; F opens the normal filter surface. Communications has no invented search: `/` opens commands; F reveals Delivery history or focuses its Type filter. Pages without filters safely do nothing for F.

Today clicks the existing Calendar control. Browser coverage verifies the correct date, retained view, and subsequent remembered Calendar return. No date/scheduling logic is copied.

## 8–10. Discovery, mobile, accessibility

Desktop has a compact Jump to… trigger above project context, with `Ctrl K` or `⌘ K`. Mobile has a 44px command button in the existing header; bottom navigation and More are unchanged. Keyboard shortcuts is a searchable command opening a compact reference.

Checked at 320, 390, 430, 768, 1280, and 1920px, including screenshots and no horizontal overflow. Dialog focus enters search, arrow keys select, Enter activates, Escape closes, Tab/Shift-Tab remain contained, and close restores the originating control. Active-descendant/listbox names and selected state supplement visual emphasis. Reduced-motion works without animations. Mac platform hint and Meta K were exercised using a MacIntel browser-platform fixture; this was not physical macOS testing.

## 11–12. Routing and Quick View

Palette rows and G destinations activate the existing `AdminNavigationLink` native Next Link path. No second router, history repair, URL replay, global data cache, or added prefetch is introduced. Static command links explicitly disable prefetch. Calendar uses the existing workspace-scoped remembered return href.

Primary handoff, monotonic ownership, commit markers, persistent shell, finite failure/retry, and guarded Next queue correction are unchanged. Quick View remains outside the six-route immediate-handoff whitelist. Contact Guide remains the existing static guide. Both use existing navigation behavior; no scope expansion to their loading architecture.

## 13. Local performance

Measured in the production Webpack build, with capture-phase key timestamps and the next animation frame. These are local feedback observations, not production speed claims or complete data-load timings.

| Condition | Palette visible next frame (desktop / mobile) | Primary G destination visible next frame |
| --- | --- | --- |
| Normal reads / normal prefetch | 7.6 / 8.6 ms | 2.7–10.4 ms, 20 transitions |
| 250 ms per read / blocked prefetch | 8.7 / 13.9 ms | 1.3–6.8 ms, 16 transitions |

All sampled primary destination frames agreed with intent. Opening, typing searches, and viewing shortcut help made **zero RSC/action/server requests**. The restricted-command no-op sample is excluded from the navigation timing ranges. No additional backend stage or private-data read is introduced, whether used or unused. No N+1 or database command search.

## 14–15. Collision and mutation audit

Cmd/Ctrl F/R/C/V/Z/Y/L/T/W remain uncanceled. Alt/browser history is untouched. G timeout/Escape, all destination keys, ordinary and date/time typing, editable content, forms, dialogs, and native selection controls are covered. All commands resolve only to navigation or existing non-mutating UI controls. The module has no submit/requestSubmit, server action, Supabase, fetch, private-data storage, or operational mutation calls.

## 16. Browser and functional regressions

Passed:

- Dedicated command browser suite: desktop/mobile, normal reads/prefetch and 250 ms/read with blocked prefetch; permission-hidden commands; Mac hints/Meta K; mouse/Enter/arrows, no-match, local search, focus return/trap, reduced motion, viewports, all shortcuts and all workflow entries.
- Four command-driven rapid patterns per desktop/mobile in each latency condition, observing settled URL/heading/active nav for 2.6 seconds. Includes current-page return and the long Tasks → Overview ending. No late takeover.
- Existing route-ownership suite: six patterns on desktop and mobile at 250 ms/read with normal prefetch (12 cycles), keyboard/pointer, 2.5-second settled observation, persistent shell, and Back/Forward during pending navigation.
- Streaming navigation/privacy suite: actual prefetched frames, palette opened before grant revocation, revoked destination fails closed, fresh account/project isolation, rapid interruption, history and mobile.
- Standard Overview, Tasks management, Volunteer profile management, Needs Attention browser regressions.
- Full normal-latency Calendar suite: Day/Week/Month/List, Today/date controls, saved return/no Month flash, filters, inspector, persisted item create/edit, assignment picker and assignment save/cancel, mobile More/exclusivity/focus, narrow screens. Dedicated assigned-contact browser regression also passes.
- Communications mobile review/selection/resend browser regression. Real providers disabled; sends zero. Its initial invocation used the wrong local port; the unchanged script passed against its required localhost:3000 server.

Test fixtures were disposable local data and cleaned by their existing harnesses. No production response/assignment/notification action occurred.

## 17. Security/privacy

Passed verified-admin-context, project/grant authorization, table privileges, assigned-contact authorization/privacy, Quick View function privileges and bearer isolation/revocation, instruction security, communication ledger/dispatcher/batches, and Quick View browser serialized/RSC payload checks. Notification/communication fingerprints remained unchanged in the read-only privacy browser test.

Instruction security ran unchanged against a canonical Git export with `core.autocrlf=false`; the raw Windows/CRLF export reproduced the established text-normalization false failure. The assertion was neither weakened nor skipped. There are no candidate changes to this test or its migration inputs.

Exact function policy: 93 classified functions, PUBLIC execute zero, denied anonymous direct mutation before execution, hardened defaults, target changes zero, triggers preserved, residue zero. Server authorization remains unchanged. A palette left open before grant revocation does not authorize a fresh destination.

## 18. Build/static/guard

TypeScript, full ESLint, staged/unstaged whitespace checks, tracked credential scanner (`assignment-detail-route-regression`), static command regression, exact installed Next queue regression, and build-entry guard regression pass. Next remains 16.2.7. Dependency versions/lockfile/config, guarded framework correction, and verifier are unchanged.

The supported Webpack production build passes and prints `Project Local: verified guarded Next.js 16.2.7 router source` before compilation. Guard regression covers both source inputs, unknown/changed/missing source, wrong version, expected corrected output, repeat invocation and rejection of double patching.

Turbopack was not rerun in this checkout: its external node_modules junction is the documented pre-existing local limitation. No dependency/source-guard change was made to bypass it. A clean hosted Turbopack build remains a release-prep check, including its mandatory pre-compilation receipt.

## 19. Migration

None. No SQL, RLS, grants, function, notification transport, production configuration, volunteer-facing schedule behavior, or scheduling semantics changed. No backup task or migration-lock operation.

## 20. Files

- `app/admin/(workspace)/layout.tsx`: authorized capability names for presentation.
- `components/AdminCommands.tsx`: palette, triggers, safe local target adapter, shortcut controller.
- `components/AdminShell.tsx`: one provider/trigger pair in the existing persistent shell.
- `components/CalendarClient.tsx`: semantic targets on existing search/filter/Today/Create controls only.
- `components/VolunteerDirectory.tsx`, `TaskPresetManagement.tsx`, `NeedsAttentionInbox.tsx`, `CommunicationsWorkspace.tsx`: semantic targets on existing controls only.
- `lib/adminCommands.ts`: static authorized command metadata, lightweight matching, typing guard.
- `scripts/admin-commands-regression.mjs`, `admin-commands-browser-regression.mjs`: focused proof.
- `scripts/overview-browser-regression.mjs`: reuse the isolated admin fixture for command mode and verify revocation through an already-open palette.
- This report.

## 21–22. Remaining limits and release identity

Quick View/Guide retain their prior loading behavior. Assign/Add intentionally open their existing pages rather than inventing an assignment context or persisting a form. No recents or transient G popup. No production timing claim; authorized content still waits for real reads. Native macOS/browser-assistive-technology hardware testing remains a manual release-prep option.

Local evidence is retained outside the repository at `C:\Users\mtfis\Documents\Codex\2026-10-20\12-56-evidence` and `12-56-*.log`. A source-only canonical security export remains at `...\12-56-security-export`; automatic approval review rejected its cleanup command as “blocked by policy.” It contains public source/migrations, not a database dump or backup credential.

The exact committed candidate SHA is supplied in the completion response. Tree cleanliness and no migration/dependency/guard/volunteer-side changes are checked after committing. Nothing is pushed or deployed.
