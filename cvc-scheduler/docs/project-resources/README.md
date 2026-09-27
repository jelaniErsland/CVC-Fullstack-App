# Project Local: assignment details and one site map

**Revised architecture proposal · 2026-09-26 · implementation not started.** Branch `codex/project-resources-architecture` follows architecture commit `edd1114`. The original broad Project Resources package and gallery remain available at that commit in Git history. This revision replaces the active proposal with exactly two features.

Read [the product specification](PRODUCT_SPEC.md), [authorization matrix](AUTHORIZATION_MATRIX.md), [minimal data/storage design](DATA_AND_STORAGE_DESIGN.md), [independent encrypted recovery design](BACKUP_AND_RECOVERY_DESIGN.md), [implementation plan](IMPLEMENTATION_PLAN.md), [decisions](DECISIONS_REQUIRED.md) and [baseline/validation notes](REVIEW_VALIDATION.md). The [synthetic desktop/mobile preview gallery](../../../previews/project-resources/index.html) shows the five requested moments.

**Recommended architecture:** add an authorized edit path for the existing task-preset description; use existing `calendar_items.schedule_notes` as the resolved per-occurrence instruction snapshot; display nonblank text through the existing volunteer assignment dialog and shared disclosure. Keep exactly one approved map per workspace, with its bytes in private PostgreSQL storage if the actual map is suitable. This keeps map bytes inside the current independently encrypted database backup, but production uploads remain gated on a proven nonempty disposable restore.

The current Tasks page does not edit general preset text, even though its create form has a multiline description. The current volunteer assignment dialog already displays occurrence notes. These are implementation gaps and reusable contracts, respectively; no new feature has shipped from this architecture branch.

Out of scope: project document library, document categories or attachments, security-document distribution, new security accounts, multi-reviewer publishing, invitation extraction, broad email changes and the broken training link. The current assignment response link, session boundaries, Quick View and notification safeguards remain the authority.

The private Belgrade PDFs were absent from the workspace. Only the **exact approved site map** and its accessible directions need private coordinator review for this scope. No source PDF was copied into Git or a preview. No migration, application route, production storage, backup task, email, merge or deployment changed in this stage.
