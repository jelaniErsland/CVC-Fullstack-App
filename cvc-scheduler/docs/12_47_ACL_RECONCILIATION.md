# 12.47 exact historical function-ACL reconciliation

Read-only production catalog snapshot: 2026-09-23. Every row below had a **direct** `service_role EXECUTE` grant in production and lacked it on a fresh local replay before the exact correction. After the correction in the last unapplied 12.47 migration, every row has the grant in local too. PUBLIC, anon and authenticated grants are unchanged.

Root cause: the hosted `postgres` public-schema default grants `service_role EXECUTE` to new functions; the local Supabase default does not. The applied `20260905130000` hardening intentionally revoked PUBLIC/anon/authenticated and left service_role untouched, so replay diverged. The policy in `FUNCTION_PRIVILEGE_POLICY.md` preserves service_role on application RPCs. No Project Local runtime service-role credential exists, so these grants are **not required by the current app**; they are required to reproduce the reviewed live ACL and make recovery/replay exact. A future decision to revoke them in production is a separate policy change, not this repair.

| Exact signature | Production | Fresh local before | Corrected local | Historical definition / last applicable policy | Reviewed caller class |
| --- | --- | --- | --- | --- | --- |
| `archive_calendar_item(uuid)` | yes | no | yes | `20260701050000 → 20260905130000` | authenticated |
| `archive_task_preset(uuid)` | yes | no | yes | `20260701040000 → 20260905130000` | authenticated |
| `cancel_calendar_assignment(uuid)` | yes | no | yes | `20260701060000 → 20260905130000` | authenticated |
| `claim_initial_assignment_notification_deliveries(uuid)` | yes | no | yes | `20260714122200 → 20260905130000` | authenticated |
| `confirm_all_volunteer_schedule_assignments(text)` | yes | no | yes | `20260714122100 → 20260905130000` | credential-scoped anonymous + authenticated |
| `convert_questionnaire_submission_to_volunteer_profile(uuid)` | yes | no | yes | `20260701030000 → 20260905130000` | authenticated |
| `create_calendar_assignment(uuid,uuid,text)` | yes | no | yes | `20260701060000 → 20260905130000` | authenticated |
| `create_calendar_assignments_batch(uuid,uuid[],text)` | yes | no | yes | `20260714121800 → 20260905130000` | authenticated |
| `create_calendar_item(uuid,uuid,text,text,text,date,date,time without time zone,time without time zone,integer,text,jsonb)` | yes | no | yes | `20260701050000 → 20260905130000` | authenticated |
| `create_manual_volunteer_profile(uuid,jsonb)` | yes | no | yes | `20260908120000` | authenticated |
| `delete_history_free_volunteer_profile(uuid)` | yes | no | yes | `20260904120000 → 20260905130000` | authenticated |
| `finalize_initial_assignment_notification_delivery(uuid,text,text,text)` | yes | no | yes | `20260714122200 → 20260905130000` | authenticated |
| `issue_assignment_response_token(uuid,integer,text)` | yes | no | yes | `20260701070000 → 20260905130000` | authenticated |
| `issue_project_quick_view_access(uuid)` | yes | no | yes | `20260902120000 → 20260905130000` | authenticated |
| `issue_volunteer_schedule_access(uuid,integer)` | yes | no | yes | `20260714122000 → 20260905130000` | authenticated |
| `mark_needs_attention_signal_seen(uuid,text)` | yes | no | yes | `20260908130000` | authenticated |
| `publish_calendar_item(uuid)` | yes | no | yes | `20260714121900 → 20260905130000` | authenticated |
| `read_assignment_detail_context(uuid)` | yes | no | yes | `20260705000000 → 20260905130000` | authenticated |
| `read_assignment_notification_delivery_health()` | yes | no | yes | `20260811123300 → 20260905130000` | authenticated |
| `read_assignment_response_by_token(text)` | yes | no | yes | `20260701070000 → 20260905130000` | credential-scoped anonymous + authenticated |
| `read_initial_assignment_notification_summaries(uuid[])` | yes | no | yes | `20260714122200 → 20260905130000` | authenticated |
| `read_project_quick_view_share_state(uuid)` | yes | no | yes | `20260902120000 → 20260905130000` | authenticated |
| `record_assignment_response_link_reveal_event(uuid,uuid,text,text,timestamp with time zone,jsonb)` | yes | no | yes | `20260703000000 → 20260905130000` | authenticated |
| `replace_assignment_response_token(uuid,integer)` | yes | no | yes | `20260702000000 → 20260905130000` | authenticated |
| `reveal_assignment_response_link(uuid,integer,text,jsonb)` | yes | no | yes | `20260704000000 → 20260905130000` | authenticated |
| `revoke_assignment_response_token(uuid)` | yes | no | yes | `20260701070000 → 20260905130000` | authenticated |
| `revoke_project_quick_view_access(uuid)` | yes | no | yes | `20260902120000 → 20260905130000` | authenticated |
| `revoke_volunteer_schedule_access(uuid)` | yes | no | yes | `20260714122000 → 20260905130000` | authenticated |
| `set_current_project_day_expected_on_site(date,integer)` | yes | no | yes | `20260829130000 → 20260905130000` | authenticated |
| `submit_assignment_response_by_token(text,text,text)` | yes | no | yes | `20260701070000 → 20260905130000` | credential-scoped anonymous + authenticated |
| `submit_questionnaire_submission(text,jsonb,integer)` | yes | no | yes | `20260701020000 → 20260905130000` | credential-scoped anonymous + authenticated |
| `submit_volunteer_schedule_assignment_response(text,uuid,text,text)` | yes | no | yes | `20260714122100 → 20260905130000` | credential-scoped anonymous + authenticated |
| `update_assignment_response(uuid,text,text)` | yes | no | yes | `20260701060000 → 20260905130000` | authenticated |
| `update_current_project_contact_volunteer_facing_details(uuid,text,text,text)` | yes | no | yes | `20260824123500 → 20260905130000` | authenticated |
| `update_current_workspace_project_dates(date,date)` | yes | no | yes | `20260904120000 → 20260905130000` | authenticated |
| `update_volunteer_profile_manual_fields(uuid,jsonb)` | yes | no | yes | `20260908120000` | authenticated |
| `verify_volunteer_schedule_lookup(text,text,text)` | yes | no | yes | `20260905120000 → 20260905130000` | credential-scoped anonymous + authenticated |

The correction is an exact 37-signature `GRANT EXECUTE ... TO service_role` section in the **unapplied** `20260922150000_project_hero_volunteer_home.sql`. It is a no-op for the current production grants. It changes neither default ACLs nor any PUBLIC/anon/authenticated privilege. Fresh isolated `supabase db reset --local` and `function-privilege-regression.mjs` pass at 72 = 10 anonymous + 47 authenticated-only + 15 internal; owner/search-path, PUBLIC denial and default PUBLIC/anon/authenticated denial checks pass. A catalog comparison of the 58 old signatures now has zero mismatches.

The different creator defaults remain an environment property. Every future RPC migration must continue to spell out exact `service_role` grants/revokes and prove a fresh replay; this repair does not authorize blanket default-privilege changes.
