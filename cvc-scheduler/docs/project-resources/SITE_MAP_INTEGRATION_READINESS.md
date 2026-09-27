# Project site map: integration readiness only

The site map is **not implemented or enabled** in this task. The exact coordinator-approved file and accessible directions are still required. No upload route, object bucket, storage policy, map table, volunteer URL, or production storage setting was added.

## Narrow integration points

- Admin: one workspace-scoped site-map card near project identity in Overview, visible only with the approved map-management capability. It should show absent/current version, file title, format, size, approval date, replacement preview, and Remove with confirmation.
- Volunteer: one clear “Open site map” link on the existing project home and a contextual link beside Assignment details. Both resolve through the current selected project and volunteer schedule session. The initial sign-in remains project-independent. Bearer Quick View remains excluded.
- Viewer: server-authorized retrieval of the current approved map, with zoom/pan and a text directions alternative on desktop and mobile. A guessed ID or stale saved URL must not confer access. Responses need private cache headers and safe content disposition.
- Data: one current map per workspace, with prior approved versions retained according to the recovery policy. Map metadata, bytes, hash, reviewer, replacement/removal event and workspace ID must remain transactionally consistent. The earlier [data design](DATA_AND_STORAGE_DESIGN.md) proposes PostgreSQL bytes only if the real map fits a measured upload/view path; it is not a storage authorization.

## Gates before any upload implementation or activation

1. Coordinator provides the **exact** approved map and confirms its intended project audience and text directions. Inspect actual file type, dimensions/pages, byte size, zoom legibility and sensitive markings; filenames and dates cannot establish approval.
2. Choose the size cap from that file with measured headroom. Prove validation, safe rendering, authorization and mobile download behavior in local tests. If PostgreSQL bytes do not fit the real file and runtime limits, return with a separately reviewed private object-storage design.
3. Extend the independent encrypted backup manifest to include actual map bytes, metadata, version and SHA-256. Restore a nonempty map plus its prior version to disposable local infrastructure, verify hashes and cross-project denial, then test replacement/removal and missing-object failure behavior. A metadata-only or database-only assertion is insufficient if bytes live elsewhere.
4. Review migration, access policy, backup growth/cost, key custody and rollback. Keep uploads disabled until the restore proof and a separate release approval are recorded.

The task-instruction migration in this branch does not create a site-map dependency. Its instruction history is ordinary database content and is included in the current database backup stream once deployed; no map recovery claim follows from that.
