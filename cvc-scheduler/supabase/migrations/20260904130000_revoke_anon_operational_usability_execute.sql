-- Iteration 12.44F.4C: remove Supabase's direct default anonymous EXECUTE
-- grants from the operational-usability RPCs while preserving authenticated use.

revoke execute on function public.update_current_workspace_project_dates(date, date) from anon;
revoke execute on function public.update_current_workspace_project_dates(date, date) from public;
grant execute on function public.update_current_workspace_project_dates(date, date) to authenticated;

revoke execute on function public.delete_history_free_volunteer_profile(uuid) from anon;
revoke execute on function public.delete_history_free_volunteer_profile(uuid) from public;
grant execute on function public.delete_history_free_volunteer_profile(uuid) to authenticated;

revoke execute on function public.create_current_workspace_repeated_calendar_items(
  uuid, uuid, text, text, date, date, smallint[], time without time zone,
  time without time zone, integer, text, jsonb
) from anon;
revoke execute on function public.create_current_workspace_repeated_calendar_items(
  uuid, uuid, text, text, date, date, smallint[], time without time zone,
  time without time zone, integer, text, jsonb
) from public;
grant execute on function public.create_current_workspace_repeated_calendar_items(
  uuid, uuid, text, text, date, date, smallint[], time without time zone,
  time without time zone, integer, text, jsonb
) to authenticated;
