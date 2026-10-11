begin;

-- Null end_date is a same-day item. Preserve inclusive SQL bounds,
-- authorization, redaction, owner and existing execute grants.
create or replace function public.read_authorized_calendar_items(
  p_workspace_id uuid, p_range_start date default null, p_range_end date default null
) returns setof public.calendar_items language sql stable security definer set search_path = '' as $$
  select (jsonb_populate_record(null::public.calendar_items, to_jsonb(item) ||
    case when actor.capabilities @> array['calendar.edit']::text[] then '{}'::jsonb
      else jsonb_build_object('schedule_notes',null,'custom_values','{}'::jsonb) end)).*
  from public.calendar_items item
  join (select g.project_contact_id, g.capabilities from public.workspace_contact_grants g
    join public.project_contacts c on c.id = g.project_contact_id
    join public.workspaces w on w.id = g.workspace_id
    where g.workspace_id = p_workspace_id and c.auth_user_id = (select auth.uid())
      and c.status = 'active' and g.status = 'active' and g.revoked_at is null
      and g.valid_from <= now() and (g.valid_until is null or g.valid_until > now())
      and w.lifecycle = 'active') actor on actor.capabilities @> array['calendar.view']::text[]
  where item.workspace_id = p_workspace_id
    and (item.publication_state = 'published'
      or item.created_by_project_contact_id = actor.project_contact_id
      or actor.capabilities @> array['calendar.edit']::text[])
    and (p_range_end is null or item.start_date <= p_range_end)
    and (p_range_start is null or coalesce(item.end_date, item.start_date) >= p_range_start);
$$;

commit;
