# Architecture review evidence — 2026-09-26

## Branch and scope

Verified `e2eeed8` contains `test: refresh post-release safety harnesses`, follows `b7c0e96` release documentation and descends from deployed `ca54020ef3f8e8ecc55bcd46f7fedf1331a56923`. Created `codex/project-resources-architecture` from that development commit. The Batch 2 branch, release reports, existing untracked previews and harmless release-check junction remain untouched.

The architecture diff is restricted to this documentation directory, the directly relevant CURRENT_STATE entry and `previews/project-resources/`. No application, migration, dependency, notification, authentication, storage policy or backup executable/configuration changes are included. No production session, database, task scheduler or provider configuration was accessed for this stage.

## Checks actually performed

- Repository source, latest overriding migrations and current documentation inspected. Corrected the source inventory to cite the current last-name/contact lookup, superseding the older full-name migration. Product requirements were treated as planning, not proof of implementation.
- Local Markdown link resolution and both preview JavaScript syntax checks passed.
- Eight isolated synthetic pages measured at 320, 390, 768, 1024 and 1440px: 40 checks, no document-level horizontal overflow, one primary heading per page. [Raw measurements](../../../previews/project-resources/screenshots/responsive-checks.json).
- Native disclosure opened with Enter. Map zoom changed its labeled pressed state and expanded only its scrollable region; Fit page reset it. Secondary-action disclosure opened. These are mock interactions, not the production shared components.
- At 390 × 844, the home information entry is reachable in the first viewport; keyboard navigation reached the last link at the actual scroll end (216px of scroll in that capture). No fixed overlay masks content. The gallery's taller mobile images show full content, not a claim that all content fits one viewport.
- Desktop/mobile screenshots cover all eight concepts, plus expanded states and an ordinary phone viewport. Inspected the rendered gallery and representative full-size layouts.
- Official R2, Supabase and Vercel documentation checked for storage costs/access tradeoffs and payload limits. Actual account quotas and worker pricing are unverified.

## Visual comparison and corrections

Compared with the [12.48 shared foundation](../design/12_48_SHARED_FOUNDATION.md): corrected the preliminary green accent palette to the application's blue/canvas/ink/control-border tokens; aligned heading sizes and panel/control radii; retained readable 16px body text, explicit status words and a single disclosure indicator. The isolated system font and illustrative icons approximate Geist/Lucide; implementation must use actual shared components.

Moved the site-map card ahead of optional visit disclosures on mobile, with matching DOM reading order. Kept essentials and map top-aligned on desktop. Corrected the mobile preset contact field so the fictional name and email are readable across two lines. Document links have title-specific accessible names. Viewer controls wrap without page overflow and preserve a written map alternative.

The browser's initial full-page capture distorted some narrow images despite correct layout measurements. Replaced those images using a taller capture canvas and a screenshot clip to rendered content, then inspected the resulting files. Retained a separate ordinary 390 × 844 viewport image so capture dimensions are transparent.

## Not tested or established

No full application build or database/browser regression suite was rerun: there is no application implementation change. No new authorization, malware scanner, provider credential, signed upload, delivery gateway, migration or complete object recovery exists yet. Their required real local tests are acceptance gates in IMPLEMENTATION_PLAN, not claimed results. Enlarged-text/PDF accessibility certification awaits actual components and approved documents.

All five private Belgrade PDFs were absent from the workspace and Codex attachments. No extraction, real map comparison, security-content assessment, document size/legibility result or actual publishable derivative could be verified. DOCUMENT_CLASSIFICATION is a pending review framework. Request the private package before finalizing those deliverables; do not approve source versions from filenames.

Status: **architecture draft ready for review; source-specific completion and policy approval pending. Implementation stopped.**
