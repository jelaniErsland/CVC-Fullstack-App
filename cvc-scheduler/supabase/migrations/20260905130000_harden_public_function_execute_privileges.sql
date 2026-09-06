-- 12.44G.8: exact current-function policy and explicit future RPC opt-in.
-- All 54 Project Local functions are created/owned by postgres locally and live.
-- supabase_admin is a platform superuser, not a Project Local migration creator.
-- No role membership, table privilege, function body, or system schema is changed.

-- PostgreSQL combines GLOBAL and per-schema default ACLs additively. Its implicit
-- PUBLIC EXECUTE can only be removed at creator-global scope, not IN SCHEMA.
-- This affects FUTURE postgres-created functions only; other creators' defaults
-- and every existing function outside public remain unchanged. New postgres
-- functions in any schema must explicitly grant PUBLIC if that is intended.
alter default privileges for role postgres revoke execute on functions from PUBLIC, anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from PUBLIC, anon, authenticated;

-- Fail closed if the reviewed inventory or ownership drifted. Never silently
-- sweep a new function into an application grant based on a name pattern.
do $$
declare expected text[] := array[
  'archive_calendar_item(uuid)',
  'archive_task_preset(uuid)',
  'calendar_assignment_response_start_at(text,date,time without time zone,text)',
  'calendar_custom_values_are_valid(jsonb)',
  'cancel_calendar_assignment(uuid)',
  'claim_initial_assignment_notification_deliveries(uuid)',
  'confirm_all_volunteer_schedule_assignments(text)',
  'convert_questionnaire_submission_to_volunteer_profile(uuid)',
  'create_calendar_assignment(uuid,uuid,text)',
  'create_calendar_assignments_batch(uuid,uuid[],text)',
  'create_calendar_item(uuid,uuid,text,text,text,date,date,time without time zone,time without time zone,integer,text,jsonb)',
  'create_current_workspace_repeated_calendar_items(uuid,uuid,text,text,date,date,smallint[],time without time zone,time without time zone,integer,text,jsonb)',
  'create_manual_volunteer_profile(uuid,text,text,text,text,text,text,text)',
  'create_task_preset(uuid,text,text,text,integer,boolean,jsonb)',
  'delete_history_free_volunteer_profile(uuid)',
  'enforce_calendar_item_workspace_timezone()',
  'finalize_initial_assignment_notification_delivery(uuid,text,text,text)',
  'issue_assignment_response_token(uuid,integer,text)',
  'issue_project_quick_view_access(uuid)',
  'issue_volunteer_schedule_access(uuid,integer)',
  'publish_calendar_item(uuid)',
  'read_assignment_detail_context(uuid)',
  'read_assignment_notification_delivery_health()',
  'read_assignment_response_by_token(text)',
  'read_initial_assignment_notification_summaries(uuid[])',
  'read_project_quick_view_by_token(text,date)',
  'read_project_quick_view_share_state(uuid)',
  'read_volunteer_schedule(text)',
  'record_assignment_response_link_reveal_event(uuid,uuid,text,text,timestamp with time zone,jsonb)',
  'replace_assignment_response_token(uuid,integer)',
  'response_link_reveal_metadata_is_valid(jsonb)',
  'reveal_assignment_response_link(uuid,integer,text,jsonb)',
  'revoke_assignment_response_token(uuid)',
  'revoke_project_quick_view_access(uuid)',
  'revoke_volunteer_schedule_access(uuid)',
  'set_assignment_updated_at()',
  'set_calendar_item_updated_at()',
  'set_current_project_day_expected_on_site(date,integer)',
  'set_project_authorization_updated_at()',
  'set_project_day_updated_at()',
  'set_task_preset_updated_at()',
  'set_volunteer_profile_updated_at()',
  'set_workspace_updated_at()',
  'submit_assignment_response_by_token(text,text,text)',
  'submit_questionnaire_submission(text,jsonb,integer)',
  'submit_volunteer_schedule_assignment_response(text,uuid,text,text)',
  'task_custom_field_definitions_are_valid(jsonb)',
  'update_assignment_response(uuid,text,text)',
  'update_calendar_item_one_off_timed(uuid,text,text,date,time without time zone,time without time zone,integer,text,jsonb)',
  'update_calendar_item_preset_timed(uuid,date,time without time zone,time without time zone,integer,text,jsonb)',
  'update_current_project_contact_volunteer_facing_details(uuid,text,text,text)',
  'update_current_workspace_project_dates(date,date)',
  'update_volunteer_profile_manual_fields(uuid,text,text,text,text,text,text,text,text)',
  'verify_volunteer_schedule_lookup(text,text,text)'
];
begin
  if current_user <> 'postgres' then raise exception 'Unreviewed Project Local migration creator'; end if;
  if (select array_agg(p.oid::regprocedure::text order by p.oid::regprocedure::text)
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public')
      is distinct from expected
    or exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and pg_get_userbyid(p.proowner)<>'postgres')
  then raise exception 'Unreviewed public function inventory or owner'; end if;
end;
$$;

-- Reset application access on each reviewed signature; then grant only A/B.
revoke all on function public.archive_calendar_item(uuid) from PUBLIC, anon, authenticated;
revoke all on function public.archive_task_preset(uuid) from PUBLIC, anon, authenticated;
revoke all on function public.calendar_assignment_response_start_at(text,date,time without time zone,text) from PUBLIC, anon, authenticated, service_role;
revoke all on function public.calendar_custom_values_are_valid(jsonb) from PUBLIC, anon, authenticated, service_role;
revoke all on function public.cancel_calendar_assignment(uuid) from PUBLIC, anon, authenticated;
revoke all on function public.claim_initial_assignment_notification_deliveries(uuid) from PUBLIC, anon, authenticated;
revoke all on function public.confirm_all_volunteer_schedule_assignments(text) from PUBLIC, anon, authenticated;
revoke all on function public.convert_questionnaire_submission_to_volunteer_profile(uuid) from PUBLIC, anon, authenticated;
revoke all on function public.create_calendar_assignment(uuid,uuid,text) from PUBLIC, anon, authenticated;
revoke all on function public.create_calendar_assignments_batch(uuid,uuid[],text) from PUBLIC, anon, authenticated;
revoke all on function public.create_calendar_item(uuid,uuid,text,text,text,date,date,time without time zone,time without time zone,integer,text,jsonb) from PUBLIC, anon, authenticated;
revoke all on function public.create_current_workspace_repeated_calendar_items(uuid,uuid,text,text,date,date,smallint[],time without time zone,time without time zone,integer,text,jsonb) from PUBLIC, anon, authenticated;
revoke all on function public.create_manual_volunteer_profile(uuid,text,text,text,text,text,text,text) from PUBLIC, anon, authenticated;
revoke all on function public.create_task_preset(uuid,text,text,text,integer,boolean,jsonb) from PUBLIC, anon, authenticated;
revoke all on function public.delete_history_free_volunteer_profile(uuid) from PUBLIC, anon, authenticated;
revoke all on function public.enforce_calendar_item_workspace_timezone() from PUBLIC, anon, authenticated, service_role;
revoke all on function public.finalize_initial_assignment_notification_delivery(uuid,text,text,text) from PUBLIC, anon, authenticated;
revoke all on function public.issue_assignment_response_token(uuid,integer,text) from PUBLIC, anon, authenticated;
revoke all on function public.issue_project_quick_view_access(uuid) from PUBLIC, anon, authenticated;
revoke all on function public.issue_volunteer_schedule_access(uuid,integer) from PUBLIC, anon, authenticated;
revoke all on function public.publish_calendar_item(uuid) from PUBLIC, anon, authenticated;
revoke all on function public.read_assignment_detail_context(uuid) from PUBLIC, anon, authenticated;
revoke all on function public.read_assignment_notification_delivery_health() from PUBLIC, anon, authenticated;
revoke all on function public.read_assignment_response_by_token(text) from PUBLIC, anon, authenticated;
revoke all on function public.read_initial_assignment_notification_summaries(uuid[]) from PUBLIC, anon, authenticated;
revoke all on function public.read_project_quick_view_by_token(text,date) from PUBLIC, anon, authenticated;
revoke all on function public.read_project_quick_view_share_state(uuid) from PUBLIC, anon, authenticated;
revoke all on function public.read_volunteer_schedule(text) from PUBLIC, anon, authenticated;
revoke all on function public.record_assignment_response_link_reveal_event(uuid,uuid,text,text,timestamp with time zone,jsonb) from PUBLIC, anon, authenticated;
revoke all on function public.replace_assignment_response_token(uuid,integer) from PUBLIC, anon, authenticated;
revoke all on function public.response_link_reveal_metadata_is_valid(jsonb) from PUBLIC, anon, authenticated, service_role;
revoke all on function public.reveal_assignment_response_link(uuid,integer,text,jsonb) from PUBLIC, anon, authenticated;
revoke all on function public.revoke_assignment_response_token(uuid) from PUBLIC, anon, authenticated;
revoke all on function public.revoke_project_quick_view_access(uuid) from PUBLIC, anon, authenticated;
revoke all on function public.revoke_volunteer_schedule_access(uuid) from PUBLIC, anon, authenticated;
revoke all on function public.set_assignment_updated_at() from PUBLIC, anon, authenticated, service_role;
revoke all on function public.set_calendar_item_updated_at() from PUBLIC, anon, authenticated, service_role;
revoke all on function public.set_current_project_day_expected_on_site(date,integer) from PUBLIC, anon, authenticated;
revoke all on function public.set_project_authorization_updated_at() from PUBLIC, anon, authenticated, service_role;
revoke all on function public.set_project_day_updated_at() from PUBLIC, anon, authenticated, service_role;
revoke all on function public.set_task_preset_updated_at() from PUBLIC, anon, authenticated, service_role;
revoke all on function public.set_volunteer_profile_updated_at() from PUBLIC, anon, authenticated, service_role;
revoke all on function public.set_workspace_updated_at() from PUBLIC, anon, authenticated, service_role;
revoke all on function public.submit_assignment_response_by_token(text,text,text) from PUBLIC, anon, authenticated;
revoke all on function public.submit_questionnaire_submission(text,jsonb,integer) from PUBLIC, anon, authenticated;
revoke all on function public.submit_volunteer_schedule_assignment_response(text,uuid,text,text) from PUBLIC, anon, authenticated;
revoke all on function public.task_custom_field_definitions_are_valid(jsonb) from PUBLIC, anon, authenticated, service_role;
revoke all on function public.update_assignment_response(uuid,text,text) from PUBLIC, anon, authenticated;
revoke all on function public.update_calendar_item_one_off_timed(uuid,text,text,date,time without time zone,time without time zone,integer,text,jsonb) from PUBLIC, anon, authenticated;
revoke all on function public.update_calendar_item_preset_timed(uuid,date,time without time zone,time without time zone,integer,text,jsonb) from PUBLIC, anon, authenticated;
revoke all on function public.update_current_project_contact_volunteer_facing_details(uuid,text,text,text) from PUBLIC, anon, authenticated;
revoke all on function public.update_current_workspace_project_dates(date,date) from PUBLIC, anon, authenticated;
revoke all on function public.update_volunteer_profile_manual_fields(uuid,text,text,text,text,text,text,text,text) from PUBLIC, anon, authenticated;
revoke all on function public.verify_volunteer_schedule_lookup(text,text,text) from PUBLIC, anon, authenticated;

-- A: intentional public verification/intake/bearer boundaries (also signed in).
grant execute on function public.confirm_all_volunteer_schedule_assignments(text) to anon, authenticated;
grant execute on function public.read_assignment_response_by_token(text) to anon, authenticated;
grant execute on function public.read_project_quick_view_by_token(text,date) to anon, authenticated;
grant execute on function public.read_volunteer_schedule(text) to anon, authenticated;
grant execute on function public.submit_assignment_response_by_token(text,text,text) to anon, authenticated;
grant execute on function public.submit_questionnaire_submission(text,jsonb,integer) to anon, authenticated;
grant execute on function public.submit_volunteer_schedule_assignment_response(text,uuid,text,text) to anon, authenticated;
grant execute on function public.verify_volunteer_schedule_lookup(text,text,text) to anon, authenticated;

-- B: authenticated RPCs retain their existing internal identity/capability checks.
grant execute on function public.archive_calendar_item(uuid) to authenticated;
grant execute on function public.archive_task_preset(uuid) to authenticated;
grant execute on function public.cancel_calendar_assignment(uuid) to authenticated;
grant execute on function public.claim_initial_assignment_notification_deliveries(uuid) to authenticated;
grant execute on function public.convert_questionnaire_submission_to_volunteer_profile(uuid) to authenticated;
grant execute on function public.create_calendar_assignment(uuid,uuid,text) to authenticated;
grant execute on function public.create_calendar_assignments_batch(uuid,uuid[],text) to authenticated;
grant execute on function public.create_calendar_item(uuid,uuid,text,text,text,date,date,time without time zone,time without time zone,integer,text,jsonb) to authenticated;
grant execute on function public.create_current_workspace_repeated_calendar_items(uuid,uuid,text,text,date,date,smallint[],time without time zone,time without time zone,integer,text,jsonb) to authenticated;
grant execute on function public.create_manual_volunteer_profile(uuid,text,text,text,text,text,text,text) to authenticated;
grant execute on function public.create_task_preset(uuid,text,text,text,integer,boolean,jsonb) to authenticated;
grant execute on function public.delete_history_free_volunteer_profile(uuid) to authenticated;
grant execute on function public.finalize_initial_assignment_notification_delivery(uuid,text,text,text) to authenticated;
grant execute on function public.issue_assignment_response_token(uuid,integer,text) to authenticated;
grant execute on function public.issue_project_quick_view_access(uuid) to authenticated;
grant execute on function public.issue_volunteer_schedule_access(uuid,integer) to authenticated;
grant execute on function public.publish_calendar_item(uuid) to authenticated;
grant execute on function public.read_assignment_detail_context(uuid) to authenticated;
grant execute on function public.read_assignment_notification_delivery_health() to authenticated;
grant execute on function public.read_initial_assignment_notification_summaries(uuid[]) to authenticated;
grant execute on function public.read_project_quick_view_share_state(uuid) to authenticated;
grant execute on function public.record_assignment_response_link_reveal_event(uuid,uuid,text,text,timestamp with time zone,jsonb) to authenticated;
grant execute on function public.replace_assignment_response_token(uuid,integer) to authenticated;
grant execute on function public.reveal_assignment_response_link(uuid,integer,text,jsonb) to authenticated;
grant execute on function public.revoke_assignment_response_token(uuid) to authenticated;
grant execute on function public.revoke_project_quick_view_access(uuid) to authenticated;
grant execute on function public.revoke_volunteer_schedule_access(uuid) to authenticated;
grant execute on function public.set_current_project_day_expected_on_site(date,integer) to authenticated;
grant execute on function public.update_assignment_response(uuid,text,text) to authenticated;
grant execute on function public.update_calendar_item_one_off_timed(uuid,text,text,date,time without time zone,time without time zone,integer,text,jsonb) to authenticated;
grant execute on function public.update_calendar_item_preset_timed(uuid,date,time without time zone,time without time zone,integer,text,jsonb) to authenticated;
grant execute on function public.update_current_project_contact_volunteer_facing_details(uuid,text,text,text) to authenticated;
grant execute on function public.update_current_workspace_project_dates(date,date) to authenticated;
grant execute on function public.update_volunteer_profile_manual_fields(uuid,text,text,text,text,text,text,text,text) to authenticated;

-- C: no direct application grants. Existing triggers run via the trigger
-- mechanism; validation/helper calls inside SECURITY DEFINER RPCs run as owner.
