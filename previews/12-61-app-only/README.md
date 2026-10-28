# 12.61 app-only volunteer refinement

This is the current approved product direction. Earlier 12.61 structured-category galleries are historical and superseded.

All screenshots use synthetic local DB57 fixtures and a production-mode build. No production access, provider calls or migrations. The current browser result contains153 axe WCAG2 A/AA +2.1 AA audits, zero violations, across320/390/430/768/1280/1440/1920/2560. These are current scenario scans, not an inflated combination with the old147.

## Desktop and mobile evidence

| Scenario | Desktop1440 | Mobile390 |
| --- | --- | --- |
| One literal term | [View](one-term-1440.png) | [View](one-term-390.png) |
| Multiple terms | [View](multiple-terms-1440.png) | [View](multiple-terms-390.png) |
| Searchable congregation choices | [View](congregation-search-1440.png) | [View](congregation-search-390.png) |
| Combined filters | [View](combined-filters-1440.png) | [View](combined-filters-390.png) |
| Combined results | [View](combined-results-1440.png) | [View](combined-results-390.png) |
| Matching source context | [View](match-context-1440.png) | [View](match-context-390.png) |
| Negative experience context | [View](negative-context-1440.png) | [View](negative-context-390.png) |
| Long excerpt | [View](long-excerpt-1440.png) | [View](long-excerpt-390.png) |
| Full source response | [View](full-response-1440.png) | [View](full-response-390.png) |
| Filters sheet | [View](filters-1440.png) | [View](filters-390.png) |
| Sort options | [View](sort-1440.png) | [View](sort-390.png) |
| Profile sheet | [View](profile-1440.png) | [View](profile-390.png) |
| Edit sheet | [View](edit-1440.png) | [View](edit-390.png) |
| Dirty-discard protection | [View](discard-1440.png) | [View](discard-390.png) |

Bottom-of-form Add/Edit screenshots are included at every tested width. The final control remains fully above the separate opaque action footer.

[browser-results.json](browser-results.json) records current-width outcomes, footer gaps, exact4px identity spacing,44px targets, zero page errors/external requests and read-only discovery fingerprints. [verification-summary.json](verification-summary.json) lists the security/static/build gates and synthetic performance results. [evidence-index.json](evidence-index.json) contains all screenshot checksums.

The browser test verifies Enter/Add and keyboard chip removal, duplicate-term rejection,120-character chips without overflow, category counts, OR within congregation/status/weekday, AND across categories and experience terms, no-match reset, literal punctuation, all seven Sorts, Profile dismissal,96 pristine-dismiss scenarios,32 genuine-dirty close paths, Keep/Discard, saved prose/history separation, filter/search/Sort return, pending-save protection and honest interrupted-save guidance. Source text is escaped React text with semantic marks; no inferred qualification is stored or shown.

Deep-directory Profile → Edit → Cancel → Profile → close also preserves search, Name Z–A, focus and scroll at390/1440. Exact before/after positions are recorded in browser-results.json.
