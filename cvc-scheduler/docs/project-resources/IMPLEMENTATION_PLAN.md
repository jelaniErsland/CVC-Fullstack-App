# Implementation plan — gated, not started
Each stage requires review before the next. Architecture acceptance is not production authorization. Missing source PDFs, audience decisions, storage/processing choice and complete recovery proof are hard dependencies.

## Stage 0 — finish architecture approval
Receive the private source package; render/read all pages privately, prepare the actual invitation extraction, compare both maps, identify blank templates and sensitive differences, and obtain exact version/audience approval. Resolve D1–D8. Complete cost quote and source-size/3 MiB delivery feasibility. Synthetic previews remain separate from the source.

## Stage 1 — metadata and authorization foundation, disabled
Design additive migrations for information/instruction revisions, resources/versions/typed references, audit and upload intents; add composite workspace FKs, bounded fields, optimistic concurrency and exact RPC ACL/RLS. Review each signature against current privilege policy. New capabilities require explicit provisioning; no implicit privilege from role/category/email. No published UI or object upload yet. Test all matrix cells against real local Auth and bearer identities with disposable workspaces. Stage 1 can land independently of Batch 3/5.

## Stage 2 — private objects and quarantine, disabled
Provision only separately approved nonproduction buckets/credentials. Implement provider adapter, one-key upload intents, immutable validation promotion and sandboxed worker. Prove scanner failure, malicious/polyglot/oversized files, PDF active-content rejection, metadata stripping, readable map text, source/derivative hashes and private bucket boundaries. Confirm Vercel size limits and no direct object URL leakage. An acceptable scan is not publication approval. No production storage until Stage 3 passes.

## Stage 3 — complete backup/recovery
Build v2 snapshot/manifest/object capture using independent age encryption and safe failure status; preserve v1 compatibility. Disposable complete restore must validate metadata, every required byte hash, ACLs, grants, revocations and authorized/forbidden delivery. Test concurrency, missing objects, interrupted runs, retention, plaintext cleanup and operator failure notification. Gate: complete-feature recovery evidence, owner custody confirmation and approved operational cost. Only a separately approved rollout may later update production task tooling/locks while preserving its autonomous schedule; never manually trigger it as a convenience.

## Stage 4 — general project information and resources
Implement server DTOs, contextual Overview admin entry, existing drawer/sheet editor, publish preview and reference impact. Add volunteer home card, structured arrival page, accessible document cards/viewer and all empty/error states. Every read evaluates live auth; no browser-only enforcement. Start with approved C0/C1 content. Validate two independent projects and household identities before expanding classes.

## Stage 5 — assignment instructions and restricted access
Add preset drafts, occurrence overrides, immutable published snapshots and explicit future-item update preview. Preserve recurring occurrence IDs and historical audit. C2 uses exact assignment predicates; C3 requires explicit scoped grant; C4 waits for individually bound strong identity implementation and approval. Batch 3 reuses the read-only instruction/document blocks inside the existing inspector. No Calendar layout or gesture refactor is necessary.

## Stage 6 — narrow email integration
Add allowlisted destination handling and Batch 5 copy hooks with the exact help phrase. Keep existing send/claim/fingerprint/idempotency flows. No resource-triggered automatic send. Record local zero-send tests and actual unchanged response behavior. Do not combine a broader Communications redesign into this stage.

## Stage 7 — separately approved release
Review exact candidate diff, approved migration sequence and privilege policy; run build/lint/TypeScript, full affected local role/bearer/storage/backup/notification/browser suites. Verify latest scheduled complete backup, recovery prerequisites, production preflight and read-only data/delivery fingerprints under the established runbook. Explicit deployment approval is required. Publish only coordinator-approved sanitized resources after storage/recovery gates. Post-release read-only smoke and fingerprint comparison; no live fixture writes/emails.

## Estimated migration and test scope
Roughly 12 new metadata/audit/operational tables including optional strong-identity binding, plus composite FKs and indexes, published pointers, new narrowly authorized RPC families, versioned backup format and private bucket policy/IAM configuration. This is substantial authorization/recovery work despite compact UI. No SQL is supplied in this approval package. Do not alter existing schema fields merely to save a new table.

Test complexity is high at the access/delivery/restore boundary and moderate at UI composition. Important cross-products: principal × class × lifecycle × workspace × credential family; each includes direct retrieval, not only hidden buttons. Build a pairwise matrix plus explicit high-risk full cases rather than multiplying every visual permutation.

Required existing regression preservation: all four Calendar views, 320/390/768/1024/1440 and enlarged text, mobile selected-day agenda/Open Day, day-number/Week-heading routes, desktop single/double-click separation, filters/history, exact inspector item, List time alignment, stable arrows, roster/status icons, meals missing/zero/positive and contacts, volunteer drawer view/edit/unsaved changes/schedule links, response cutoffs and notification no-send paths. New UI checks include keyboard viewer zoom/page navigation, focus return, safe areas, accessible PDF alternative, real scroll reachability, preview draft isolation and denied-document indistinguishability.

## Proposed reusable UI contracts
Use existing ActionMenu, DisclosureSection and IconButton with exactly one disclosure indicator. New future components: ProjectInformationSections, AssignmentInstructions, AuthorizedResourceCard and DocumentViewerShell. These accept server-authorized DTOs, not raw rows or client capability claims. Existing Calendar selection, volunteer drawer and response-control components remain owners of navigation/edit/respond behavior. Do not fork the inspector into a second application.

## Rollback
Feature flags fail closed for metadata/UI/upload/publishing/delivery independently. Roll back application UI while keeping additive schema, immutable objects, audit and backup readability. Revoke retrieval if necessary; do not restore old public access through cached/signed URLs. No destructive down migration after real documents exist. Preserve future old-version reader compatibility until retention ends. Restore drills and production release checks must distinguish application rollback from data recovery.

## Architecture review evidence
Only documentation and standalone synthetic preview assets are authorized in this stage. Gallery and responsive checks are design evidence, not working authorization or storage proof. No production session, upload, database mutation, email, backup-task run or deployment is part of this task.
