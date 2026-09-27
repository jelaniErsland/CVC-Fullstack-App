# Project Resources & Assignment Details — architecture review
Status: **PROPOSED; source-document review incomplete; implementation not authorized.** Prepared 2026-09-26.

Branch `codex/project-resources-architecture` was created from `e2eeed8`. That commit contains the permanent Batch 2 test-harness corrections and descends from production `ca54020ef3f8e8ecc55bcd46f7fedf1331a56923`. Existing release documentation, Batch 2 branch and unrelated untracked previews were preserved. Only design documents and synthetic previews belong to this branch's new diff.

## Review order
1. [Product specification](PRODUCT_SPEC.md) and [synthetic desktop/mobile gallery](../../../previews/project-resources/index.html).
2. [Decisions requiring approval](DECISIONS_REQUIRED.md).
3. [Authorization matrix](AUTHORIZATION_MATRIX.md), [data/storage](DATA_AND_STORAGE_DESIGN.md), [independent recovery](BACKUP_AND_RECOVERY_DESIGN.md).
4. [Email/deep links](EMAIL_AND_DEEP_LINK_DESIGN.md), [implementation gates](IMPLEMENTATION_PLAN.md).
5. [Document classification](DOCUMENT_CLASSIFICATION.md) and [source evidence](SOURCE_REVIEW.md).
6. [Executed review checks and remaining limits](REVIEW_VALIDATION.md).

The five private Belgrade PDFs were not found in the workspace or Codex attachments. No original document was read, copied, rendered, uploaded or committed. The classification file is a redacted review framework, **not an extraction of those documents**. The preview map is entirely fictional. Exact document versions, redactions, audiences and invitation extraction remain blocked on receiving the private package. Architecture approval cannot substitute for that coordinator review.

Proposed core: project-scoped structured information; immutable published instruction revisions bound to actual Calendar item IDs; resources authorized at each read; private object storage with quarantine and validation; independent encrypted metadata-plus-object recovery. General volunteers keep the existing project-independent lookup. Security operations require an explicit person/workspace grant and stronger identity assurance than knowing a household contact address.

No migration, application component, route, authentication, notification, production data, infrastructure or backup configuration changed. No merge or deployment is authorized by this package.
