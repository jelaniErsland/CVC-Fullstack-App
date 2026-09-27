# Authorization matrix — proposed, deny by default
All rules are server/database enforced. Workspace selection is never authority. Existing Supabase Auth contact grants remain the admin foundation; existing schedule bearer lookup remains the ordinary volunteer foundation. New capabilities and grants below are proposals, not active permissions.

## Classes and view policy
C0 = published general project information; C1 = general project documents; C2 = assignment-specific documents; C3 = sanitized restricted after-hours logistics; C4 = security operations/contact documents; D = unpublished drafts including originals/quarantine.

| Principal | C0 | C1 | C2 | C3 | C4 | D |
| --- | --- | --- | --- | --- | --- | --- |
| Main administrator | resource.view | resource.view | resource.view | resource.restricted.view | security.resources.view + strong identity | matching draft-view capability |
| Authorized contact/assistant | explicitly granted resource.view | same | same | explicitly granted resource.restricted.view | explicitly granted security.resources.view + strong identity | resource.edit, or restricted edit as appropriate |
| Ordinary verified volunteer | active/ready profile + active workspace + valid schedule session | same, general published only | No unless assignment condition below | No | No | No |
| Volunteer with relevant assignment | C0 | C1 | exact active own assignment, active published item, non-declined response, allowed time window, attachment match | C2 plus explicit person/workspace after-hours grant | Not from assignment alone | No |
| Explicit security personnel | C0/C1 only if separately eligible | same | only own relevant assignment or separately authorized contact | exact scoped grant and assignment | explicit security resource grant + individually bound fresh Supabase Auth identity; assignment binding if grant requires it | No unless separate restricted editing capability |
| Authenticated on-site read-only contact | resource.view if explicitly granted | same | general operational documents only if explicitly granted resource.view | separate restricted view grant | no automatic security access | No |
| Bearer Quick View recipient | No new resource projection | No | No | No | No | No |
| Anonymous, expired or revoked session | No | No | No | No | No | No |

“Main” and “assistant” labels do not bypass capabilities. Existing contact roles do not already contain these new capabilities. General resource.view authorizes C0–C2 admin oversight in that workspace, not C3/C4. A draft retains its intended classification, so resource.edit cannot inspect a security draft.

## Management authority
| Operation | General C0–C2 | C3 after-hours | C4 security |
| --- | --- | --- | --- |
| View/manage draft metadata | resource.edit | resource.restricted.edit | security.resources.edit + strong identity |
| Upload/create/edit | resource.edit | resource.restricted.edit | security.resources.edit |
| Preview validated bytes | matching view/edit capability; never quarantine original in browser | same restricted boundary | same security boundary |
| Approve/publish/promote replacement | resource.publish | resource.restricted.publish | security.resources.publish, approved audience and exact derivative |
| Unpublish/archive/revoke | matching publish capability (urgent revoke permitted) | matching restricted publish | matching security publish |
| Grant readers | not needed beyond ordinary policy | resource.grants.manage | security.grants.manage; cannot self-elevate |
| Purge retained bytes | separate resource.purge plus reviewed retention eligibility; never ordinary editor | same | same with security authority |

Proposed onboarding defaults (D1): main coordinator receives general edit/publish through explicit provisioning; assistants may draft with explicit edit, publication requires a designated publisher. C3/C4 publication requires a second authorized reviewer distinct from author. No implicit migration grants based on string role. Grant management itself requires existing authorized provisioning plus reviewed new capability; no public self-enrollment.

Every C4 management operation, including upload, replacement, publishing, grant changes and purge, also requires the individually verified fresh Auth context. Capabilities do not waive this assurance requirement. A publisher cannot approve their own C3/C4 submission by holding two roles; the second reviewer must be a different verified individual.

## Exact volunteer predicates
Resolve profile/workspace from credential hash server-side, recheck token version/expiry/revocation, active workspace and active/ready profile on every metadata, thumbnail, page/range and download request. Compare workspace on every parent/child join. Active assignment means calendar_assignments.lifecycle active, exact volunteer_profile_id/item_id/workspace_id, item active/published and response pending or confirmed. Declined assignees retain response help but lose C2/C3/C4 assignment-conditioned resources.

Proposed C2/C3 window: once published and assigned, through item end in workspace timezone; date-based/multi-day uses the final date's local end of day. No synthetic midnight in UTC. C4 can be explicitly assignment-bound with the same window, or a separately approved operational grant with its own expiry. A bounded earlier access time can be set; expiry is the earliest of grant, session and item/window end. Past/archive history can preserve non-sensitive own assignment facts; private documents are unavailable to former assignees. Admin audit history remains behind capability checks.

C0/C1 stay available after the last assignment while profile remains active/ready and workspace active (D3). Project completion/archive or volunteer access removal ends availability. No forever access merely because an old email exists.

Cancellation/reassignment/revocation takes effect on the next request, including direct object retrieval through the gateway. In-flight response bytes and existing downloads cannot be recalled. Never authorize by title, category, email alone, filename, UUID secrecy, URL possession, browser state or client-supplied role. Resource publication alone does not override audience.

## Shared-household and stronger security identity
The current lookup is knowledge-based and household members can know each other's contact details. Even a personalized bearer sent to a shared inbox can be read by others. Exact profile IDs prevent accidental inheritance but cannot prove which human holds that bearer. Do not claim otherwise.

Recommended D2: C3 contains only coordinator-approved low-sensitivity logistics; no operational plan/contact sheet. C4 requires an explicitly bound individual Supabase Auth account using a nonshared identity channel, recent verified authentication (proposed 15-minute step-up) and scoped grant. Account/profile binding is coordinator-approved and audited; never join by matching email alone. If a nonshared verified identity is unavailable, C4 access is denied and the coordinator uses an approved offline channel. Reusing admin Auth primitives avoids inventing a volunteer password system, but an individual security-person binding and assurance check are **new implementation dependencies** requiring approval. Ordinary sign-in stays unchanged.

A person in two projects has independent profiles/grants. Switching projects re-establishes the matching scoped session and never unions grants. C4 access in project A says nothing about project B. A response-token holder can receive only that assignment's permitted summary through its existing identity scope; it cannot receive security files or a general schedule credential without separately reviewed verification.

## Tests required
Real local Auth/RLS and storage tests: every principal/class/action cell; active/expired/revoked/inactive grant and contact; foreign workspace IDs in all joins; guessed resource/version/object IDs; version substitution and mismatched attachment parent; same household/contact with different profiles; ambiguous duplicate matches; authenticated contact whose own volunteer identity differs; missing and forged assurance proof; canceled/reassigned/declined/past assignments; live revocation during range reads; direct private bucket URLs and old signed upload URLs; drafts in lists/search/thumbnails; URL traversal; no redirect to arbitrary object key; Quick View RPC unchanged; cookie/CSRF/cache/referrer boundaries. No production fixtures.
