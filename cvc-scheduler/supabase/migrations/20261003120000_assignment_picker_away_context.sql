-- 12.52: bounded, project-authorized away context for the admin assignment picker.
-- The existing planner remains authoritative for assignment overlap and writes.
begin;

create function public.read_assignment_picker_away_periods(
  p_workspace_id uuid,
  p_volunteer_ids uuid[],
  p_from date,
  p_through date
) returns table (volunteer_profile_id uuid, starts_on date, ends_on date)
language plpgsql security definer stable set search_path = '' as $$
declare actor uuid;
begin
  if auth.uid() is null or p_workspace_id is null or p_volunteer_ids is null
    or cardinality(p_volunteer_ids) not between 1 and 1000
    or array_position(p_volunteer_ids,null) is not null
    or cardinality(p_volunteer_ids) <> (select count(distinct id) from unnest(p_volunteer_ids) id)
    or p_from is null or p_through is null or p_through < p_from
    or p_through - p_from > 373
  then raise exception 'Assignment picker context unavailable.' using errcode='22023'; end if;

  select c.id into actor from public.project_contacts c
  join public.workspace_contact_grants g on g.project_contact_id=c.id
  join public.workspaces w on w.id=g.workspace_id
  where c.auth_user_id=auth.uid() and c.status='active' and w.lifecycle='active'
    and g.workspace_id=p_workspace_id and g.status='active' and g.revoked_at is null
    and g.valid_from<=now() and (g.valid_until is null or g.valid_until>now())
    and g.capabilities @> array['workspace.read','calendar.view','assignments.view','assignments.edit','volunteers.view']::text[]
  limit 1;
  if actor is null or (select count(*) from public.volunteer_profiles v
      where v.id=any(p_volunteer_ids) and v.workspace_id=p_workspace_id
        and v.lifecycle='active' and v.readiness_status='ready') <> cardinality(p_volunteer_ids)
  then raise exception 'Assignment picker context unavailable.' using errcode='42501'; end if;

  return query select a.volunteer_profile_id,a.starts_on,a.ends_on
    from public.volunteer_away_periods a
    where a.workspace_id=p_workspace_id and a.volunteer_profile_id=any(p_volunteer_ids)
      and a.starts_on<=p_through and a.ends_on>=p_from
    order by a.volunteer_profile_id,a.starts_on,a.id;
end $$;

revoke all on function public.read_assignment_picker_away_periods(uuid,uuid[],date,date)
  from public,anon,authenticated,service_role;
grant execute on function public.read_assignment_picker_away_periods(uuid,uuid[],date,date)
  to authenticated,service_role;
comment on function public.read_assignment_picker_away_periods(uuid,uuid[],date,date) is
  'Read-only, bounded away dates for currently authorized Calendar assignment admins. No contact or private profile fields.';

commit;
