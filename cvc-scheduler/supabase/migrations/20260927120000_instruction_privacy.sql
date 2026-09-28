-- Approved instruction privacy: forward-only; no instruction data changes.
-- Read-only projections retain operational fields, never arbitrary private prose.

create function public.can_view_calendar_item_operations(p_workspace_id uuid, p_item_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.calendar_items item
    join (select g.project_contact_id, g.capabilities from public.workspace_contact_grants g
  join public.project_contacts c on c.id=g.project_contact_id
  join public.workspaces w on w.id=g.workspace_id
  where g.workspace_id=p_workspace_id and c.auth_user_id=(select auth.uid())
    and c.status='active' and g.status='active' and g.revoked_at is null
    and g.valid_from<=now() and (g.valid_until is null or g.valid_until>now())
    and w.lifecycle='active') actor on actor.capabilities @> array['calendar.view']::text[]
    where item.workspace_id=p_workspace_id and item.id=p_item_id
      and (item.publication_state='published' or item.created_by_project_contact_id=actor.project_contact_id));
$$;

create function public.read_authorized_calendar_items(
  p_workspace_id uuid, p_range_start date default null, p_range_end date default null
) returns setof public.calendar_items language sql stable security definer set search_path = '' as $$
  select (jsonb_populate_record(null::public.calendar_items, to_jsonb(item) ||
    case when actor.capabilities @> array['calendar.edit']::text[] then '{}'::jsonb
      else jsonb_build_object('schedule_notes',null,'custom_values','{}'::jsonb) end)).*
  from public.calendar_items item
  join (select g.project_contact_id, g.capabilities from public.workspace_contact_grants g
  join public.project_contacts c on c.id=g.project_contact_id
  join public.workspaces w on w.id=g.workspace_id
  where g.workspace_id=p_workspace_id and c.auth_user_id=(select auth.uid())
    and c.status='active' and g.status='active' and g.revoked_at is null
    and g.valid_from<=now() and (g.valid_until is null or g.valid_until>now())
    and w.lifecycle='active') actor on actor.capabilities @> array['calendar.view']::text[]
  where item.workspace_id=p_workspace_id
    and (item.publication_state='published' or item.created_by_project_contact_id=actor.project_contact_id)
    and (p_range_end is null or item.start_date<=p_range_end)
    and (p_range_start is null or item.end_date is null or item.end_date>=p_range_start);
$$;

create function public.read_authorized_task_presets(p_workspace_id uuid)
returns setof public.task_presets language sql stable security definer set search_path = '' as $$
  select (jsonb_populate_record(null::public.task_presets, to_jsonb(preset) ||
    case when actor.capabilities && array['tasks.edit','calendar.edit']::text[] then '{}'::jsonb
      else jsonb_build_object('description',null,'custom_field_definitions','[]'::jsonb) end)).*
  from public.task_presets preset
  join (select g.project_contact_id, g.capabilities from public.workspace_contact_grants g
  join public.project_contacts c on c.id=g.project_contact_id
  join public.workspaces w on w.id=g.workspace_id
  where g.workspace_id=p_workspace_id and c.auth_user_id=(select auth.uid())
    and c.status='active' and g.status='active' and g.revoked_at is null
    and g.valid_from<=now() and (g.valid_until is null or g.valid_until>now())
    and w.lifecycle='active') actor on actor.capabilities @> array['tasks.view']::text[]
  where preset.workspace_id=p_workspace_id;
$$;

-- Direct REST/GraphQL reads must not bypass the safe projections. Preserve
-- the existing view gates, adding only instruction-authority requirements.
alter policy calendar_items_select_with_view_capability
on public.calendar_items
using (
  exists (
    select 1
    from public.workspace_contact_grants as grant_row
    join public.project_contacts as contact
      on contact.id = grant_row.project_contact_id
    where grant_row.workspace_id = calendar_items.workspace_id
      and contact.auth_user_id = (select auth.uid())
      and contact.status = 'active'
      and grant_row.status = 'active'
      and grant_row.revoked_at is null
      and grant_row.valid_from <= now()
      and (grant_row.valid_until is null or grant_row.valid_until > now())
      and grant_row.capabilities @> array['calendar.view','calendar.edit']::text[]
      and (
        calendar_items.publication_state = 'published'
        or calendar_items.created_by_project_contact_id = contact.id
      )
  )
);

alter policy task_presets_select_with_view_capability
on public.task_presets
using (
  exists (
    select 1
    from public.workspace_contact_grants as grant_row
    join public.project_contacts as contact
      on contact.id = grant_row.project_contact_id
    where grant_row.workspace_id = task_presets.workspace_id
      and contact.auth_user_id = (select auth.uid())
      and contact.status = 'active'
      and grant_row.status = 'active'
      and grant_row.revoked_at is null
      and grant_row.valid_from <= now()
      and (grant_row.valid_until is null or grant_row.valid_until > now())
      and grant_row.capabilities @> array['tasks.view']::text[]
      and grant_row.capabilities && array['tasks.edit','calendar.edit']::text[]
  )
);

alter policy calendar_assignments_select_with_view_capability
on public.calendar_assignments
using (
  exists (
    select 1
    from public.workspace_contact_grants as grant_row
    join public.project_contacts as contact
      on contact.id = grant_row.project_contact_id
    where grant_row.workspace_id = calendar_assignments.workspace_id
      and contact.auth_user_id = (select auth.uid())
      and contact.status = 'active'
      and grant_row.status = 'active'
      and grant_row.revoked_at is null
      and grant_row.valid_from <= now()
      and (grant_row.valid_until is null or grant_row.valid_until > now())
      and grant_row.capabilities @> array['assignments.view']::text[]
      and public.can_view_calendar_item_operations(calendar_assignments.workspace_id, calendar_assignments.calendar_item_id)
  )
);


alter policy assignment_responses_select_with_view_capability
on public.assignment_responses
using (
  exists (
    select 1
    from public.workspace_contact_grants as grant_row
    join public.project_contacts as contact
      on contact.id = grant_row.project_contact_id
    join public.calendar_assignments as assignment
      on assignment.id = assignment_responses.assignment_id
      and assignment.workspace_id = assignment_responses.workspace_id
    where grant_row.workspace_id = assignment_responses.workspace_id
      and contact.auth_user_id = (select auth.uid())
      and contact.status = 'active'
      and grant_row.status = 'active'
      and grant_row.revoked_at is null
      and grant_row.valid_from <= now()
      and (grant_row.valid_until is null or grant_row.valid_until > now())
      and grant_row.capabilities @> array['assignments.view']::text[]
      and public.can_view_calendar_item_operations(assignment_responses.workspace_id, assignment.calendar_item_id)
  )
);


-- Exact existing bearer signature, validation, dates and operational fields.
create or replace function public.read_project_quick_view_by_token(p_bearer_token text, p_project_date date default null)
returns table (access_state text, workspace_display_name text, workspace_timezone text, project_date date, project_starts_on date, project_ends_on date, token_expires_at timestamptz, expected_on_site_count integer, schedule_sources jsonb)
language plpgsql security definer set search_path = '' as $$
declare verified_token_id uuid; verified_workspace_id uuid; verified_workspace_name text; verified_workspace_timezone text; verified_project_starts_on date; verified_project_ends_on date; verified_token_expires_at timestamptz; selected_date date;
begin
  if p_bearer_token is null or char_length(p_bearer_token) <> 43 or p_bearer_token !~ '^[A-Za-z0-9_-]{43}$' then
    return query select 'unavailable'::text,null::text,null::text,null::date,null::date,null::date,null::timestamptz,null::integer,'[]'::jsonb; return;
  end if;
  select token.id,token.workspace_id,workspace.display_name,workspace.timezone,workspace.starts_on,workspace.ends_on,token.expires_at
  into verified_token_id,verified_workspace_id,verified_workspace_name,verified_workspace_timezone,verified_project_starts_on,verified_project_ends_on,verified_token_expires_at
  from public.project_quick_view_access_tokens token join public.workspaces workspace on workspace.id=token.workspace_id
  where token.token_verifier_hash=extensions.digest(p_bearer_token,'sha256') and token.purpose='project_quick_view_access' and token.token_version=1 and token.revoked_at is null and token.expires_at>now() and workspace.lifecycle='active' and workspace.ends_on is not null and (now() at time zone workspace.timezone)::date<=workspace.ends_on limit 1;
  if verified_token_id is null then return query select 'unavailable'::text,null::text,null::text,null::date,null::date,null::date,null::timestamptz,null::integer,'[]'::jsonb; return; end if;
  selected_date:=coalesce(p_project_date,(now() at time zone verified_workspace_timezone)::date);
  if selected_date>verified_project_ends_on then return query select 'unavailable'::text,null::text,null::text,null::date,null::date,null::date,null::timestamptz,null::integer,'[]'::jsonb; return; end if;
  update public.project_quick_view_access_tokens set last_used_at=now() where id=verified_token_id;
  return query select 'ready'::text,verified_workspace_name,verified_workspace_timezone,selected_date,verified_project_starts_on,verified_project_ends_on,verified_token_expires_at,null::integer,coalesce(schedule.items,'[]'::jsonb)
  from (select 1) anchor left join lateral (
    select jsonb_agg(jsonb_build_object(
      'id',item.id,'workspace_id',item.workspace_id,'task_preset_id',item.task_preset_id,'title_snapshot',item.title_snapshot,'task_type_snapshot',item.task_type_snapshot,'schedule_kind',item.schedule_kind,'start_date',item.start_date,'end_date',item.end_date,'start_time',item.start_time,'end_time',item.end_time,'timezone',item.timezone,'needed_count',item.needed_count,'schedule_notes',null,'meal_kind',item.meal_kind,'meal_provider',item.meal_provider,'meal_contact',item.meal_contact,'meal_menu',item.meal_menu,'meal_total',item.meal_total,'lifecycle',item.lifecycle,'publication_state',item.publication_state,'published_at',item.published_at,'task_preset_label',preset.name,'task_preset_color_key',preset.color_key,'task_description',null,'custom_values','{}'::jsonb,'assignments',coalesce(assigned.rows,'[]'::jsonb)
    ) order by item.start_date,item.start_time nulls last,item.title_snapshot,item.id) items
    from public.calendar_items item left join public.task_presets preset on preset.id=item.task_preset_id and preset.workspace_id=item.workspace_id
    left join lateral (select jsonb_agg(jsonb_build_object('assignmentId',a.id,'calendarItemId',item.id,'volunteerProfileId',v.id,'volunteerDisplayName',v.full_name,'responseStatus',coalesce(r.response_status,'needs_response')) order by v.full_name,a.id) rows from public.calendar_assignments a join public.volunteer_profiles v on v.id=a.volunteer_profile_id and v.workspace_id=item.workspace_id left join public.assignment_responses r on r.assignment_id=a.id and r.workspace_id=item.workspace_id where a.calendar_item_id=item.id and a.workspace_id=item.workspace_id and a.lifecycle='active') assigned on true
    where item.workspace_id=verified_workspace_id and item.lifecycle='active' and item.publication_state='published' and item.start_date<selected_date+42 and coalesce(item.end_date,item.start_date)>=selected_date-31
  ) schedule on true;
end;
$$;
alter function public.read_project_quick_view_by_token(text,date) owner to postgres;
revoke all on function public.read_project_quick_view_by_token(text,date) from public, anon, authenticated, service_role;
grant execute on function public.read_project_quick_view_by_token(text,date) to anon, authenticated, service_role;

alter function public.can_view_calendar_item_operations(uuid,uuid) owner to postgres;
revoke all on function public.can_view_calendar_item_operations(uuid,uuid) from PUBLIC, anon, authenticated, service_role;
grant execute on function public.can_view_calendar_item_operations(uuid,uuid) to authenticated, service_role;
alter function public.read_authorized_calendar_items(uuid,date,date) owner to postgres;
revoke all on function public.read_authorized_calendar_items(uuid,date,date) from PUBLIC, anon, authenticated, service_role;
grant execute on function public.read_authorized_calendar_items(uuid,date,date) to authenticated, service_role;
alter function public.read_authorized_task_presets(uuid) owner to postgres;
revoke all on function public.read_authorized_task_presets(uuid) from PUBLIC, anon, authenticated, service_role;
grant execute on function public.read_authorized_task_presets(uuid) to authenticated, service_role;
