# 12.48 shared foundation — Batch 1

This is an incremental extension of the existing React/Tailwind primitives. Geist, Lucide, the Project Local pin, server permissions and existing workflow contracts remain in place.

## Tokens

`app/globals.css` is authoritative. All colors below are hexadecimal.

| Purpose | Token / value |
| --- | --- |
| Canvas / surface / subtle surface | `--pl-canvas` F7F9FC / `--pl-surface` FFFFFF / `--pl-surface-subtle` F3F6FA |
| Heading / body / secondary text | `--pl-ink` 0B1733 / `--pl-text` 35435F / `--pl-muted` 5B6B83 |
| Primary / hover / pale selection | `--pl-blue` 155EEF / `--pl-blue-deep` 144BC1 / `--pl-blue-soft` EAF2FF |
| Decorative / essential control border | `--pl-border` DFE6F1 / `--pl-control-border` 7C8CA3 |
| Focus | `--pl-focus` 1646A0, 2px outline with 3px offset; existing ring adapters retained |
| Spacing | 4, 8, 12, 16, 24, 32, 48px |
| Control / panel / overlay radius | .625rem / .75rem / 1rem |
| Shared control minimum height | 2.625rem desktop, 2.75rem below 640px |
| Typography utilities | `pl-page-title` 32/26px; `pl-section-title` 20/18px; `pl-body` 16px; `pl-row-title` 14px; `pl-metadata` 13px |

Sizes above describe a 16px root. Type and controls use rem for text resizing. Ordinary mobile navigation retains five labels. Below 14 root-text units of available width, its labeled Overview / Calendar / More fallback fits one row; Volunteers and Attention move into More. The fallback label scale is 0.625rem so labels do not collide at 320px/200% text. More sheet horizontal padding and icons stay compact when text grows, and its list scrolls above the measured bottom bar and safe area. Decorative borders are not relied on to identify form fields. Semantic badges use darker semantic text on pale surfaces, with explicit words.

## Component interfaces

| Component | Contract |
| --- | --- |
| `Button` | Existing native button/link props; `variant="primary\|secondary\|ghost\|destructive"`; optional `pending`, `pendingLabel`. Pending native buttons disable; pending links render an inert, busy span. Use visible wording for Save, Publish, Send, Archive and Remove. |
| `IconButton` | Required accessible `label`, Lucide child, native button props; primary/secondary/ghost. Minimum 44px, native title tooltip. Utility actions only. |
| `ActionMenu` | Required accessible `label`, array of labeled link or button items, optional `textTrigger`. Ellipsis is the default secondary trigger; a text trigger is available if several working contextual choices justify it. Arrow/Home/End/Escape, focus return and outside dismissal are implemented. Optional `confirm` keeps consequential confirmation within the menu; callers must use explicit action labels. |
| `DisclosureSection` | Native details/summary with an informative `summary` and optional className. One decorative, aria-hidden chevron marks the closed state and rotates when expanded; the native marker is suppressed to prevent a duplicate. Optional content begins collapsed, remains keyboard accessible and reveals full controls/content when opened. |
| `CalendarAssignedVolunteers` | Display-only roster for an exact scheduled item ID, using already-authorized name/response data. Shows three people immediately, then a shared disclosure for the remainder. Explicit status words use the shared status mapping. Hidden, unavailable and empty states stay distinct. Never use on Breakfast/Lunch entries. |
| `Field` | Existing `id`, `label`, native input/select props, optional string `options`; adds `hint`, `error`, `optional`. Native `required` drives the required label. Combines caller `aria-describedby` with hint/error IDs. Caller supplies errors after blur or submit. |
| `FieldGroup` | `id`, `legend`, `children`, optional `hint`, `error`; semantic fieldset and associated group error. |
| `Panel` / `SectionHeader` | Panel accepts section attributes, children and className. Header takes `title`, optional `description`, `action`; wraps instead of forcing narrow columns. |
| `PageHeader` | One h1 `title`; optional `description`, `context`, `primaryAction`, `secondaryActions`. Wraps actions at narrow widths. |
| `StatusBadge` | `status` is a key in `lib/statusDisplay.ts`; display only. Awaiting reply = needs_response; Declined = declined. `StatusPill` remains the compatibility adapter for existing UI strings. |
| `EmptyState` | Existing title/message; optional action and kind: empty, no-results, unavailable, denied, error. Caller must provide accurate state-specific copy. |
| `InlineNotice` | title, children, info/error/warning/success tone. Static by default; `announce` opts into role=status for an asynchronous outcome. |
| `Skeleton` | Loading label and row count; one status announcement and decorative bars. Reduced-motion rules suppress pulse animation. |
| `AdminShell` | Existing props plus optional `destinations` IDs derived from effective server-selected capabilities. Defaults to Overview and Contact Guide when capability context is absent. It applies the idempotent LDC project-name formatter and the measured-width mobile navigation fallback. No permission is established in the browser. |
| `CalendarClient` | Route base is the union /admin/calendar, /admin/quick-view, /qv. Initial selection props still bootstrap old callers; current URL drives subsequent selection/history changes. Optional projectControls/footer slots keep existing Quick View controls within the shell. |

## Integration boundaries

Overview is the representative finished screen. Calendar, Tasks, Volunteers and Communications adopt the shared outer header where safe. Specialized bodies, inspector controls, notification workflows and legacy preview pages retain focused adapters. Needs Attention acknowledgment is unchanged.

The final Batch 1 addition puts volunteer names/statuses below Day/List task titles and times. The disclosure is a sibling of the task-selection button, avoiding nested controls. Names wrap within the existing column width. The existing server coverage fraction is retained; declined people remain visibly labeled without increasing active staffing, and pending people are never labeled confirmed. Authenticated Quick View uses the same display with existing volunteer-view permission; the bearer surface gains no new roster UI. The read-only adapter preserves assignment-query errors so an unavailable roster cannot be presented as empty. No private projection or authorization scope is broadened.

All seven primary workspace destinations receive capability-aware navigation from their existing loaders. Generic unavailable/legacy callers without that projection deliberately expose Overview/help; their existing return links remain. Assignment detail retains Back to Calendar. A later authorized data-contract decision would be needed to supply a full capability list there without additional context reads.

Existing saved project photos remain optional. The no-photo Overview has a compact text identity with Add project photo adjacent to it. A saved photo uses the existing protected derivatives and stored desktop/mobile focal coordinates in a shallow panoramic identity banner (150px desktop; 110px mobile); Change project photo is a labeled item in an adjacent ellipsis menu. Existing upload/crop/remove requests are untouched. The isolated visual fixture supplies a generated WebP only for screenshot verification, never product content.

Overview shows two prioritized review groups at ordinary mobile widths, with a View all follow-ups destination, and groups genuinely identical visible schedule rows with an explicit count. A grouped row links to the existing Calendar day so every constituent record is accessible; a single row retains its item-inspector deep link. Its direct New task action opens the already-working task form only when the existing `tasks.edit` capability is present. It does not claim direct Calendar or volunteer creation. A content-driven grid stacks when 200% text leaves inadequate column width.

Quick View meal presentation is distinct from ordinary task staffing. Breakfast/Lunch list and compact calendar entries show `Headcount N` or `Headcount not set` before inspection. The read-only meal inspector shows date/time, headcount and one contact; `null` differs from saved `0`. Its source field is a nullable free-text `meal_contact`, not a validated project-contact relationship. An identity-linked designated contact would need a future data-contract decision. Normal food-service volunteer assignments remain separate. The full Calendar/inspector editing redesign belongs to later batches.

Without a `view` query, the admin Quick View and bearer routes default to Month. Isolated fixtures and the actual authenticated local route show missing, zero and positive meal counts before inspector selection. Desktop meal chips use compact “Breakfast · —” or “Lunch · 0” labels; narrow cells use B/L, count or dash. A visible legend explains the count/dash semantics. Cramped mobile-month presentation, existing three-item/six-item overflow limits and enlarged-text behavior remain Batch 2 Calendar work. Real local Auth/RLS main/assistant/on-site, missing-capability, cross-workspace and bearer tests passed; production smoke still requires a usable authorized project session.

The shared foundation does not certify untouched specialized screens as WCAG conformant. Later batches should adopt common controls, replace remaining low-contrast specialized metadata and reconcile the inspector and Calendar breakpoints. See the Batch 1 review for observed coverage and limitations.
