-- Restore the authenticated-only execution boundary for Assignment Detail.

revoke execute on function public.read_assignment_detail_context(uuid) from anon;
revoke execute on function public.read_assignment_detail_context(uuid) from PUBLIC;
grant execute on function public.read_assignment_detail_context(uuid) to authenticated;
