begin;

-- Existing drafts retain their meaning. Only a deliberate new draft uses this flag.
alter table public.calendar_items
  add column explicit_draft boolean not null default false;

-- An ordinary insert becomes operational before constraints and other triggers run.
-- The draft RPC sets this transaction-local marker only around its own insert.
create function public.calendar_item_operational_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.publication_state = 'draft' and new.created_by_project_contact_id is not null then
    if current_setting('project_local.save_explicit_draft', true) = 'yes' then
      new.explicit_draft := true;
    else
      new.publication_state := 'published';
      new.published_at := coalesce(new.published_at, now());
      new.published_by_project_contact_id := coalesce(new.published_by_project_contact_id, new.created_by_project_contact_id);
    end if;
  end if;
  return new;
end $$;
alter function public.calendar_item_operational_insert() owner to postgres;
revoke all on function public.calendar_item_operational_insert() from public, anon, authenticated, service_role;
create trigger calendar_item_operational_insert
  before insert on public.calendar_items
  for each row execute function public.calendar_item_operational_insert();

create function public.create_calendar_item_draft(
  p_workspace_id uuid, p_task_preset_id uuid, p_one_off_title text,
  p_one_off_task_type text, p_schedule_kind text, p_start_date date,
  p_end_date date, p_start_time time without time zone,
  p_end_time time without time zone, p_needed_count integer,
  p_schedule_notes text, p_custom_values jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare created_id uuid;
begin
  perform set_config('project_local.save_explicit_draft', 'yes', true);
  created_id := public.create_calendar_item(
    p_workspace_id, p_task_preset_id, p_one_off_title, p_one_off_task_type,
    p_schedule_kind, p_start_date, p_end_date, p_start_time, p_end_time,
    p_needed_count, p_schedule_notes, p_custom_values
  );
  perform set_config('project_local.save_explicit_draft', '', true);
  return created_id;
end $$;
alter function public.create_calendar_item_draft(uuid,uuid,text,text,text,date,date,time without time zone,time without time zone,integer,text,jsonb) owner to postgres;
revoke all on function public.create_calendar_item_draft(uuid,uuid,text,text,text,date,date,time without time zone,time without time zone,integer,text,jsonb) from public, anon, authenticated, service_role;
grant execute on function public.create_calendar_item_draft(uuid,uuid,text,text,text,date,date,time without time zone,time without time zone,integer,text,jsonb) to authenticated, service_role;

-- Explicit drafts cannot acquire active assignments, including via batch RPCs.
create function public.guard_explicit_draft_assignment()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.lifecycle = 'active' and exists (
    select 1 from public.calendar_items item
    where item.id = new.calendar_item_id and item.workspace_id = new.workspace_id
      and item.lifecycle = 'active' and item.publication_state = 'draft'
      and item.explicit_draft
  ) then
    raise exception 'Activate the draft before assigning volunteers.' using errcode = '22023';
  end if;
  return new;
end $$;
alter function public.guard_explicit_draft_assignment() owner to postgres;
revoke all on function public.guard_explicit_draft_assignment() from public, anon, authenticated, service_role;
create trigger calendar_assignment_explicit_draft_guard
  before insert or update of lifecycle, calendar_item_id on public.calendar_assignments
  for each row execute function public.guard_explicit_draft_assignment();

-- Only already assigned historical drafts have unambiguous operational intent.
update public.calendar_items item
set publication_state = 'published',
    published_at = coalesce(item.published_at, now()),
    published_by_project_contact_id = item.created_by_project_contact_id
where item.lifecycle = 'active' and item.publication_state = 'draft'
  and item.created_by_project_contact_id is not null
  and exists (select 1 from public.calendar_assignments assignment
    where assignment.calendar_item_id = item.id
      and assignment.workspace_id = item.workspace_id
      and assignment.lifecycle = 'active');

-- Any current calendar editor in the same workspace may activate a legacy draft.
create function public.activate_calendar_item(p_calendar_item_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor_id uuid; target_id uuid;
begin
  select contact.id into actor_id
  from public.calendar_items item
  join public.workspaces workspace on workspace.id = item.workspace_id
  join public.workspace_contact_grants grant_row on grant_row.workspace_id = item.workspace_id
  join public.project_contacts contact on contact.id = grant_row.project_contact_id
  where item.id = p_calendar_item_id and item.lifecycle = 'active'
    and workspace.lifecycle = 'active' and contact.auth_user_id = auth.uid()
    and contact.status = 'active' and grant_row.status = 'active'
    and grant_row.revoked_at is null and grant_row.valid_from <= now()
    and (grant_row.valid_until is null or grant_row.valid_until > now())
    and grant_row.capabilities @> array['calendar.edit']::text[]
  limit 1;
  if actor_id is null then raise exception 'Calendar activation is unavailable.' using errcode = '42501'; end if;
  update public.calendar_items item
  set publication_state = 'published', explicit_draft = false,
      published_at = coalesce(item.published_at, now()),
      published_by_project_contact_id = coalesce(item.published_by_project_contact_id, actor_id)
  where item.id = p_calendar_item_id and item.lifecycle = 'active'
    and item.publication_state in ('draft', 'published')
  returning item.id into target_id;
  if target_id is null then raise exception 'Calendar activation is unavailable.' using errcode = '42501'; end if;
  return target_id;
end $$;
alter function public.activate_calendar_item(uuid) owner to postgres;
revoke all on function public.activate_calendar_item(uuid) from public, anon, authenticated, service_role;
grant execute on function public.activate_calendar_item(uuid) to authenticated, service_role;

create or replace function public.can_view_calendar_item_operations(p_workspace_id uuid, p_item_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.calendar_items item
    join public.workspace_contact_grants g on g.workspace_id = item.workspace_id
    join public.project_contacts c on c.id = g.project_contact_id
    join public.workspaces w on w.id = item.workspace_id
    where item.workspace_id = p_workspace_id and item.id = p_item_id
      and c.auth_user_id = (select auth.uid()) and c.status = 'active'
      and w.lifecycle = 'active' and g.status = 'active' and g.revoked_at is null
      and g.valid_from <= now() and (g.valid_until is null or g.valid_until > now())
      and g.capabilities @> array['calendar.view']::text[]
      and (item.publication_state = 'published'
        or item.created_by_project_contact_id = c.id
        or g.capabilities @> array['calendar.edit']::text[]));
$$;

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
    and (p_range_start is null or item.end_date is null or item.end_date >= p_range_start);
$$;

alter policy calendar_items_select_with_view_capability on public.calendar_items using (
  exists (select 1 from public.workspace_contact_grants g
    join public.project_contacts c on c.id = g.project_contact_id
    where g.workspace_id = calendar_items.workspace_id
      and c.auth_user_id = (select auth.uid()) and c.status = 'active'
      and g.status = 'active' and g.revoked_at is null and g.valid_from <= now()
      and (g.valid_until is null or g.valid_until > now())
      and g.capabilities @> array['calendar.view','calendar.edit']::text[])
);

-- Keep the existing authoritative preview and add a comparison with the last
-- accepted schedule delivery. The preexisting eligibility and fingerprint stay
-- in the same RPC used by review and confirmation.
do $$
declare original text; revised text;
begin
  select pg_get_functiondef('public.communication_preview(uuid,jsonb)'::regprocedure) into original;
  revised := replace(original,
    'workspace_name text; excluded_count integer:=0;',
    'workspace_name text; excluded_count integer:=0; prior_snapshot jsonb; prior_sent_at timestamptz; changed_count integer; removed_count integer;');
  revised := replace(revised,
    'reason:=null; entries:=''[]''; previous_email:=null;',
    'reason:=null; entries:=''[]''; previous_email:=null; prior_snapshot:=null; prior_sent_at:=null; changed_count:=null; removed_count:=null;');
  revised := replace(revised,
    'select count(*) into new_count from jsonb_array_elements(entries) e',
    'select r.snapshot, o.created_at into prior_snapshot, prior_sent_at from public.communication_recipients r join public.communication_operations o on o.id=r.operation_id where r.workspace_id=p_workspace and r.volunteer_id=person.id and o.kind=''schedule'' and r.state=''sent'' order by o.created_at desc,r.id desc limit 1;
      if prior_snapshot is not null then
        select count(*) into changed_count from jsonb_array_elements(entries) current_entry where not exists (select 1 from jsonb_array_elements(coalesce(prior_snapshot->''assignments'',''[]''::jsonb)) previous_entry where previous_entry->>''assignmentId''=current_entry->>''assignmentId'' and previous_entry->>''itemVersion''=current_entry->>''itemVersion'' and previous_entry->>''assignmentVersion''=current_entry->>''assignmentVersion'');
        select count(*) into removed_count from jsonb_array_elements(coalesce(prior_snapshot->''assignments'',''[]''::jsonb)) previous_entry where not exists (select 1 from jsonb_array_elements(entries) current_entry where current_entry->>''assignmentId''=previous_entry->>''assignmentId'');
      end if;
      select count(*) into new_count from jsonb_array_elements(entries) e');
  revised := replace(revised,
    '''excludedAssignments'',excluded_count,''sharedContact'',shared_contact',
    '''excludedAssignments'',excluded_count,''lastSentAt'',prior_sent_at,''changedSinceLastSend'',changed_count,''removedSinceLastSend'',removed_count,''sharedContact'',shared_contact');
  if revised = original or revised not like '%changedSinceLastSend%' or revised not like '%prior_snapshot:=null%' then
    raise exception 'Communication preview comparison source changed; review required.';
  end if;
  execute revised;
end $$;

commit;
