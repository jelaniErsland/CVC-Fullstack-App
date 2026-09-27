# Simplified task details — implementation review

**Status:** Development branch only. No merge, deployment, site-map upload, production migration, email send, or backup configuration change.

**Baseline:** Started from approved architecture `0248eec`, which descends from the verified deployed application `ca54020ef3f8e8ecc55bcd46f7fedf1331a56923`. At review, `origin/master` still pointed to `ca54020`. Commit `49ff482` records an earlier admin-navigation performance investigation and is already an ancestor of this branch; it changes documentation only. No separate local/remote performance-fix branch or worktree was discoverable. This stage is isolated on `codex/simplified-task-details`; compare any subsequently supplied performance-fix ref before release review.

## Resulting behavior

- Authorized `tasks.edit` contacts can review and save a preset’s existing multiline description as Assignment details. The gray questions are a placeholder only. Existing legacy descriptions are not approved for automatic copying until saved. Preset saves require the exact persisted `updated_at`; stale or unauthorized edits fail closed and the editor retains unsaved text.
- New preset-based Calendar items copy approved instructions into their own `schedule_notes` at insert time, including repeat and bulk creation. An explicit nonblank occurrence note is preserved instead. Existing item text is unchanged by migration or later preset edits. Calendar’s normal occurrence editor can replace or clear only that item’s text and retains its existing `updated_at` guard.
- The Tasks inspector offers a bounded, dated preview of future items whose text is provably an inherited preset snapshot. The admin selects exact occurrences; apply requires both `tasks.edit` and `calendar.edit`, the current preset version, every selected item version, the active workspace, and future date. Manually edited exceptions and legacy items are excluded. The action does not send notifications. If instructions are changed urgently, coordinators still use the established, separately reviewed communication workflow.
- Changed preset and item wording is recorded in a private append-only instruction-revision table, including whether an edited occurrence was already published. Ordinary authenticated clients have no direct table access. Existing soft-archived records retain history; fixture-only hard deletions cascade their corresponding history.
- The existing volunteer assignment dialog shows nonblank saved occurrence text under the shared **Assignment details** disclosure. Paragraphs and line breaks remain readable; empty text adds no panel. Confirmation and decline controls are unchanged.

## Local verification

| Gate | Result |
| --- | --- |
| Local migration | Applied through pinned Supabase CLI 2.111.0 to loopback Docker Postgres; no production application. |
| TypeScript, targeted ESLint and production build | Passed. A separate loopback-only production preview completed the desktop/mobile edit, future preview and selected apply journey twice. |
| Tasks persistence/Auth/RLS | Passed: editor, view-only, anonymous and cross-project, stale versions, old/published snapshots, individual exceptions, selected future apply, private history, zero notification deliveries and zero fixture residue. |
| Busy-month data | Passed: 30 repeated November items retained independent snapshots; authorized November reads took 24–54 ms in the local test environment. This is a local measurement, not a production latency claim. |
| Volunteer schedule access | Passed: real local token projection returns own stored instruction text, preserves cross-volunteer filtering, revocation and direct-table denial. |
| Calendar edit/source/publication and concurrent-edit regressions | Passed after updating the older concurrency fixture to use the current JSONB volunteer-create RPC; conflict assertions remain intact. |
| Tasks desktop/mobile browser regression | Passed at 1280px and 390px; its now-full-height mobile sheet is closed via its reachable labeled close control. A real local browser journey also saved instructions, previewed prior and replacement text, selected a dated future occurrence and verified the applied database snapshot. |
| Volunteer assignment disclosure browser proof | Passed at 1280px and 390px using a real local access token. Confirmed collapsed/open states, preserved Confirm control, no horizontal overflow, zero response or delivery changes, and fixture cleanup. |
| Tasks route/read-model contract | Passed after replacing an obsolete CURRENT_STATE wording assertion with the current stage marker; existing route and RPC allowlists remain explicit. |
| Notification health and table privilege regressions | Passed in the loopback-only environment. |

The older full volunteer-response browser script expects the retired stand-alone schedule heading; unmodified, it stops before its older UI assertions. The focused instruction-disclosure browser mode exercises the current volunteer home and passed. The legacy full-harness assumption should be refreshed separately without weakening response and notification assertions. The long-running local Next development server intermittently returned an incomplete Server Action response during repeated preview/apply browser runs. The same fixture passed twice consecutively against a fresh local production build and loopback Supabase. No production service was contacted.

## Visual evidence

The screenshots use synthetic local fixtures. They show the task editor and the volunteer disclosure at desktop and mobile widths:

- [Task editor, desktop](../previews/assignment-instructions/task-editor-desktop.png) and [mobile](../previews/assignment-instructions/task-editor-mobile.png)
- [Future-occurrence preview](../previews/assignment-instructions/task-preview-desktop.png), [selected apply action](../previews/assignment-instructions/task-preview-selection-desktop.png), and [mobile preview](../previews/assignment-instructions/task-preview-mobile.png)
- [Volunteer disclosure, desktop](../previews/assignment-instructions/volunteer-disclosure-desktop.png) and [mobile](../previews/assignment-instructions/volunteer-disclosure-mobile.png)

## Release boundary and remaining checks

Review the exact branch diff against the active performance investigation once its ref is identified. Review the migration’s exact function grants, RLS and table access before deployment. Applying the local migration does not authorize applying it to production. The site map remains at [integration preparation](SITE_MAP_INTEGRATION_READINESS.md), blocked on the approved file and encrypted disposable restore proof.
