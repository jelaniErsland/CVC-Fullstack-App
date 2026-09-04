-- Keep Quick View share management behind authenticated admin authorization.
-- Supabase's public-schema function defaults grant anon directly, so revoking
-- PUBLIC alone is insufficient for these admin-side RPCs.

revoke all on function public.issue_project_quick_view_access(uuid) from PUBLIC;
revoke execute on function public.issue_project_quick_view_access(uuid) from anon;
grant execute on function public.issue_project_quick_view_access(uuid) to authenticated;

revoke all on function public.read_project_quick_view_share_state(uuid) from PUBLIC;
revoke execute on function public.read_project_quick_view_share_state(uuid) from anon;
grant execute on function public.read_project_quick_view_share_state(uuid) to authenticated;

revoke all on function public.revoke_project_quick_view_access(uuid) from PUBLIC;
revoke execute on function public.revoke_project_quick_view_access(uuid) from anon;
grant execute on function public.revoke_project_quick_view_access(uuid) to authenticated;

-- Anonymous execution remains intentional for the no-account bearer exchange.
revoke all on function public.read_project_quick_view_by_token(text, date) from PUBLIC;
grant execute on function public.read_project_quick_view_by_token(text, date) to anon, authenticated;
