# Authorization matrix — two scoped features

The following are proposed checks, not current permissions. Each request derives actor, workspace and volunteer profile on the server. An item ID, map URL, client role flag or shared email address never grants access.

| Actor | Preset details: view / edit | Occurrence details: view / edit | Current map: view / replace / remove |
| --- | --- | --- | --- |
| Main project contact | Existing task view; edit only with active `tasks.edit` grant in this workspace | Existing Calendar view; edit only with active `calendar.edit` grant | Existing project overview view; manage with active `calendar.edit` grant (same proposal as project photo), subject to owner decision D1 |
| Assistant or authorized project contact | Same explicit capability checks; role label alone is insufficient | Same | Same; no implicit approval from assistant title |
| Authenticated on-site read-only contact | Existing task/Calendar read projections only | Existing published read projection only | Read only if existing server authorization permits the selected project's operational view; no manage action |
| Verified volunteer in this project | No draft/preset-management view | Read only the resolved published details on that person's actual authorized assignment | Read the project's current approved map while the active/ready profile, active workspace and valid `/v` session hold |
| Verified volunteer in another project, including same household address | None for this project | None for this project | None for this project |
| Bearer Quick View recipient | No new projection | No new instruction projection | No map access |
| Anonymous, expired or revoked session | None | None | None |

Admin updates use the current verified Supabase Auth contact, active grant, correct workspace and optimistic version. A new narrow task-text update operation is required because today's Tasks page only creates presets, changes color and archives them. The existing Calendar operations already edit item notes; any new audit operation must retain the same `calendar.edit` check and conflict semantics. Map management may use the existing `calendar.edit` capability; approving that choice is D1. Do not invent a client-side publisher role.

Volunteer details are scoped to the exact assignment and Calendar item in the verified `/v` projection. Recheck assignment/profile/workspace lifecycle and publication under the existing schedule access contract. A declined response retains the already-authorized assignment view/response controls under the current contract; do not recast it as an active staffing count. Former, canceled or reassigned volunteers get only what the existing schedule projection permits. The map can remain available after the last assignment while the volunteer's verified profile is still active/ready in an active workspace; remove it as soon as project access is revoked (D2).

Map bytes are private database content. The volunteer endpoint checks a valid schedule credential, active/ready profile, matching workspace, current map pointer and nonremoved status on each request, including range/zoom image requests. Admin previews require the manager grant. No direct anonymous table select, public bucket URL, redirect to a storage key, or bearer Quick View extension. Serve with `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`, restrictive PDF/image rendering and no token in URL/log/referrer. A user who already downloaded a copy can keep it; revocation controls future server retrieval.

## Required local tests

Exercise main/assistant/on-site/no-grant contacts; active/expired/revoked grants and schedule sessions; two workspaces and same-household profiles; guessed map IDs and cross-workspace paths; stale replacement and removal; assignment cancellation/reassignment; published/draft/past item details; direct database/table/API retrieval; unchanged Quick View bearer projection and volunteer response links. Test actual forbidden responses, not only hidden UI controls. No production volunteer fixture is required.
