# Email and deep-link design — proposed
No email is sent and no existing notification workflow changes in this stage.

## Current behavior
Welcome Communications currently links to the project-independent site origin. Schedule Communications claims recipients, issues per-volunteer schedule credentials, sends through the existing single-recipient transport and finalizes the ledger; the existing initial-assignment flow also uses personalized schedule access. The /respond/{token} route is a separate single-assignment credential boundary. The older requirement for automatic one-click confirmation is not authorization to introduce it here.

Preserve recipient preview/fingerprint, live claim eligibility, template version, idempotency key, attempt/claim lock, provider deduplication, unknown-outcome treatment, delivery ledger, explicit resend confirmation and local recording tests. Opening a document, project page, drawer or tab never sends.

## Welcome
Keep lookup primary and project-independent. Display the dynamically formatted LDC project name in the email body. Proposed secondary copy: “Once you've verified your details and selected this project, open Before you arrive for current arrival information and documents.” A project-info destination hint is not a grant and must not preselect a workspace before identity verification.

Help wording must use exactly: **your local elders or the project's congregation volunteer contact**. Apply this wording in relevant welcome, assignment, help and verification templates during the narrow Batch 5 presentation change. Do not replace existing safe contact eligibility or invent a public contact list.

## Assignment
Retain the primary **Review assignment & respond** action. It must land on the exact assignment/date/item, preserving response semantics, not a document index. Introduce an allowlisted destination parameter on the existing personalized schedule exchange, e.g. assignment reference plus optional information destination; the server validates ownership after token exchange. No arbitrary return URL. Different occurrences with the same title never share a title-based link.

The current schedule exchange redirects to /v/schedule and does not implement this destination contract. A future narrow route/schema design must bind the destination to the credential's volunteer/workspace and verify active assignment ownership before displaying details. The clean destination can be /v/schedule?assignment={opaqueId}; this is a proposed route, not an existing working link. Item/date is derived from that assignment server-side. A resource card is not an authorization token.

The /respond route can show only that assignment's approved summary after rechecking its response credential. Do not exchange it automatically into broad schedule/project access. Full project pages/general documents require the separately verified schedule session; C4 always requires stronger identity. If product owner wants one-link access across both token families, that is a separate explicit scope-expansion decision, not this feature's default.

## Session and project sequence
1. Existing link issuer chooses the actual volunteer profile, never email-group identity. Tokens remain random, hashed in DB, bounded and revocable.
2. Exchange validates current token/profile/workspace before installing the HttpOnly secure same-site /v cookie; scrub credential from resulting URL.
3. Revalidate assignment/resource eligibility for the selected destination. Wrong-workspace existing browser session is replaced only through the existing verified exchange; no merging of scopes.
4. If expired/revoked, offer the existing neutral verification page. Hold only an allowlisted opaque destination hint; after verification, show it only if it belongs to the resulting identity/project. Do not disclose a foreign assignment title.
5. Multi-project lookup uses the current signed project choices. A valid project hint cannot manufacture a matching identity. Shared household addresses do not union profiles or resource grants.
6. Browsers with current schedule cookies may revisit general information; this is not a new persistent remembered-device system. No new localStorage bearer or “trust this device” implementation.

Link possession has inherent forwarding risk. Do not put restricted document titles/content, storage URLs, security contacts, attachment bytes or stronger-auth credentials in emails. C4 links lead to an authorized app route and fresh individual verification. Email previews must mask credentials, and telemetry/platform logs must not capture bearer URLs.

## Published instruction changes
Preset edits are quiet drafts. Explicit updates to future published occurrence instructions show affected items/volunteers and existing response states; preserve responses. Mark the revised instruction date in-app and keep before/after audit. For urgent changes, offer a **Review affected recipients** handoff to existing Communications, preselecting exact permitted recipients/items but requiring fresh live preview, fingerprint and send confirmation. No new background automatic email scheduler.

If existing Communications cannot express the approved change notice without altering delivery semantics, defer the notice integration to Batch 5 rather than using a direct send shortcut. During the interim, coordinator uses the established authorized schedule resend with explicit review and an approved operational follow-up. Read receipts or document opens are not confirmations or training records.

Template version and instruction revision IDs should participate in future send-preview fingerprints so changed instructions invalidate stale previews where their content/link is represented. Do not duplicate an old delivery automatically when a resource version changes. Unknown provider outcome remains nonretryable until reconciled; maintain existing deduplication and explicit resend reasons.

## Required regression
Email HTML/text escaping, exact help phrase, dynamic single LDC prefix, no forbidden training link, primary response CTA, safe local destination allowlist, preserved project/date/assignment, household identity separation, expired/revoked credentials, wrong project choice, response cutoff and stale-date handling, no token in preview/log/referrer, no send on GET, no mutation on document view, preview invalidation, live recipient exclusion, idempotency/retry/unknown outcomes and zero unexpected deliveries. Use recording transport and disposable local sessions only. Batch 5 owns broader email visual redesign; this feature supplies typed destinations and approved copy, not a parallel delivery system.
