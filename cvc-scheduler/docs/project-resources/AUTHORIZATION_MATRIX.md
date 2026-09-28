# Authorization matrix — implemented task details and deferred site map

Instruction privacy is approved and enforced locally as of September 27, 2026. Project-map rules remain design proposals; uploads are disabled. Every request derives actor, workspace and volunteer identity on the server. An item ID, client role flag, task name, shared email or project bearer never grants personal instruction access.

| Actor | Preset instructions | Occurrence instructions | Operational schedule |
| --- | --- | --- | --- |
| Main/assistant/other authorized project administrator | Read with live `tasks.view` plus `tasks.edit` or `calendar.edit`; edit with `tasks.edit` | Read/edit with live `calendar.view` + `calendar.edit` and publication/creator rules | Existing workspace/view/assignment/profile gates. |
| Generic authenticated read-only/on-site contact | Description null; custom definitions empty | Notes null; custom values empty; no edit | Safe authenticated RPCs retain exact scheduled rows, dates/times, meal fields and permitted staffing/responses. |
| Personal verified assigned volunteer | No preset-management projection | Own saved occurrence instructions through existing personal assignment access only; no instruction edit | Existing own schedule/response workflow, including relevant declined assignments; declined does not count as active staffing. |
| Same-household or other volunteer | No inferred access | Only assignments belonging to the identity in their own verified credential; shared email does not transfer rights | Existing identity/token isolation. |
| Bearer Quick View recipient | Description null | Notes null; custom values empty | Existing published operational projection, meal counts/contact and permitted staffing identities/statuses. Always read-only. |
| Foreign-project, anonymous without valid credential, expired/revoked session | None | None | Existing denial/unavailable result; no cross-project fallback. |

Existing administrative notification capabilities authorize composition of assigned-volunteer details through the protected claim RPC; recipient review, confirmation, idempotency and delivery guards are unchanged. No generic viewer can claim/send a notification or use that RPC to read instructions. Private revisions remain inaccessible to application roles.

## Database and route enforcement

Forward migration `20260927120000_instruction_privacy.sql` masks the bearer fields, introduces two authenticated safe projections and tightens raw Task/Calendar SELECT RLS to instruction-authorized administrators. Assignment/response publication and ownership checks use a boolean operational visibility helper so generic viewers retain staffing. No new capability, broader table grant, default privilege or credential projection is added. The existing three trigger-only instruction helpers stay uncallable directly, including by service_role.

Safe RPCs recheck Auth identity, active workspace/contact/grant, revocation and grant date boundaries; no server service-role fallback. Raw table reads cannot bypass the edit-capability gate. Calendar reads preserve current date/context/filter/deep-link behavior. The read-only custom allowlist is explicitly empty; required operational columns remain as inventoried in [privacy review](QUICK_VIEW_INSTRUCTION_PRIVACY_REVIEW.md).

## Site map remains deferred

The proposed project map is separate from assignment details and is not implemented. Its manager capability (D1), exact approved file, access duration (D2), sensible measured size limit and independently encrypted byte/metadata disposable restore proof remain prerequisites. No bearer Quick View map access or public URL is proposed. Personal map access must use the exact active/ready verified project volunteer, not household email. Downloaded copies cannot be recalled.

## Executed and future tests

Executed task-detail checks include actual administrator/edit and generic-view Auth/RLS, own-volunteer credential retrieval, cross-person/project denial, raw table/API bypass attempts, bearer null/masked projections and expired/revoked/anonymous denial, browser HTML/RSC payload checks, publication/ownership, stale conflicts, immutable historical/manual exceptions, complete Calendar/Bulk interactions and volunteer responses. Notification claim/composition/safety tests use disabled/recording/mocked providers; no real email is sent. See [implementation report](TASK_DETAILS_IMPLEMENTATION_REVIEW.md).

Future map tests must additionally cover guessed identifiers/ranges, cross-project retrieval, replacement/removal, expired personal sessions and independently restored bytes. Those are not claimed as executed implementation tests.
