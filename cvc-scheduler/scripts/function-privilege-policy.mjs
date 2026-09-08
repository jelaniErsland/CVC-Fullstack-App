// Exact reviewed signatures. Adding an RPC requires a deliberate classification.
// Caller/source evidence and SECURITY DEFINER review: docs/FUNCTION_PRIVILEGE_POLICY.md.
export const anonymousFunctions = Object.freeze([
  "confirm_all_volunteer_schedule_assignments(text)",
  "read_assignment_response_by_token(text)",
  "read_project_quick_view_by_token(text,date)",
  "read_volunteer_schedule(text)",
  "submit_assignment_response_by_token(text,text,text)",
  "submit_questionnaire_submission(text,jsonb,integer)",
  "submit_volunteer_schedule_assignment_response(text,uuid,text,text)",
  "verify_volunteer_schedule_lookup(text,text,text)"
]);
export const authenticatedFunctions = Object.freeze([
  "save_calendar_meal(uuid,uuid,text,date,time without time zone,time without time zone,text,text,text,integer,text,timestamp with time zone)",
  "duplicate_calendar_item(uuid,date,time without time zone,time without time zone)",
  "archive_calendar_item(uuid)",
  "archive_task_preset(uuid)",
  "cancel_calendar_assignment(uuid)",
  "claim_initial_assignment_notification_deliveries(uuid)",
  "convert_questionnaire_submission_to_volunteer_profile(uuid)",
  "create_calendar_assignment(uuid,uuid,text)",
  "create_calendar_assignments_batch(uuid,uuid[],text)",
  "create_calendar_item(uuid,uuid,text,text,text,date,date,time without time zone,time without time zone,integer,text,jsonb)",
  "create_current_workspace_repeated_calendar_items(uuid,uuid,text,text,date,date,smallint[],time without time zone,time without time zone,integer,text,jsonb,text,text,text,text,integer)",
  "create_manual_volunteer_profile(uuid,jsonb)",
  "create_task_preset(uuid,text,text,text,integer,boolean,jsonb,text)",
  "delete_history_free_volunteer_profile(uuid)",
  "finalize_initial_assignment_notification_delivery(uuid,text,text,text)",
  "issue_assignment_response_token(uuid,integer,text)",
  "issue_project_quick_view_access(uuid)",
  "issue_volunteer_schedule_access(uuid,integer)",
  "publish_calendar_item(uuid)",
  "read_assignment_detail_context(uuid)",
  "read_assignment_notification_delivery_health()",
  "read_initial_assignment_notification_summaries(uuid[])",
  "read_project_quick_view_share_state(uuid)",
  "record_assignment_response_link_reveal_event(uuid,uuid,text,text,timestamp with time zone,jsonb)",
  "replace_assignment_response_token(uuid,integer)",
  "reveal_assignment_response_link(uuid,integer,text,jsonb)",
  "revoke_assignment_response_token(uuid)",
  "revoke_project_quick_view_access(uuid)",
  "revoke_volunteer_schedule_access(uuid)",
  "set_current_project_day_expected_on_site(date,integer)",
  "update_assignment_response(uuid,text,text)",
  "update_calendar_item_one_off_timed(uuid,text,text,date,time without time zone,time without time zone,integer,text,jsonb,timestamp with time zone)",
  "update_task_preset_color(uuid,text,timestamp with time zone)",
  "update_calendar_item_preset_timed(uuid,date,time without time zone,time without time zone,integer,text,jsonb,timestamp with time zone)",
  "update_current_project_contact_volunteer_facing_details(uuid,text,text,text)",
  "update_current_workspace_project_dates(date,date)",
  "update_volunteer_profile_manual_fields(uuid,jsonb)"
]);
export const internalFunctions = Object.freeze([
  "calendar_assignment_response_start_at(text,date,time without time zone,text)",
  "calendar_custom_values_are_valid(jsonb)",
  "enforce_calendar_item_workspace_timezone()",
  "response_link_reveal_metadata_is_valid(jsonb)",
  "set_assignment_updated_at()",
  "set_calendar_item_updated_at()",
  "set_project_authorization_updated_at()",
  "set_project_day_updated_at()",
  "set_task_preset_updated_at()",
  "set_volunteer_profile_updated_at()",
  "set_workspace_updated_at()",
  "task_custom_field_definitions_are_valid(jsonb)"
]);
export const migrationCreators = Object.freeze(["postgres"]);

export function assertEffectiveFunctionPolicy(assert, rows) {
  const expected = [...anonymousFunctions, ...authenticatedFunctions, ...internalFunctions].sort();
  assert.deepEqual(rows.map(r => r.signature).sort(), expected, "Every public function must have an exact reviewed classification.");
  for (const row of rows) {
    assert.equal(row.owner, "postgres", row.signature + ": unreviewed creator/owner");
    assert.equal(row.public, false, row.signature + ": PUBLIC EXECUTE");
    assert.equal(row.anon, anonymousFunctions.includes(row.signature), row.signature + ": anon EXECUTE");
    assert.equal(row.authenticated, !internalFunctions.includes(row.signature), row.signature + ": authenticated EXECUTE");
    assert.equal(row.service_role, !internalFunctions.includes(row.signature), row.signature + ": service_role EXECUTE");
    assert.equal(row.definer, !internalFunctions.includes(row.signature), row.signature + ": execution context changed");
    assert.deepEqual(row.config, ['search_path=""'], row.signature + ": unsafe search_path");
  }
}

export const effectiveFunctionQuery = `
select jsonb_build_object(
 'signature',p.oid::regprocedure::text,'owner',pg_get_userbyid(p.proowner),
 'definer',p.prosecdef,'config',p.proconfig,
 'public',exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE'),
 'anon',has_function_privilege('anon',p.oid,'EXECUTE'),
 'authenticated',has_function_privilege('authenticated',p.oid,'EXECUTE'),
 'service_role',has_function_privilege('service_role',p.oid,'EXECUTE'))
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' order by p.oid::regprocedure::text;
`;
