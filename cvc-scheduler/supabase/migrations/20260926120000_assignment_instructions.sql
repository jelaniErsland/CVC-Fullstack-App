begin;

-- Existing descriptions are deliberately unapproved. Reviewing and saving one
-- makes it available to new occurrences; old occurrences are never backfilled.
alter table public.task_presets
  add column assignment_details_approved_at timestamptz;
alter table public.calendar_items
  add column instruction_source text not null default 'manual',
  add column instruction_preset_updated_at timestamptz,
  add constraint calendar_item_instruction_source_check
    check (instruction_source in ('manual', 'preset')),
  add constraint calendar_item_instruction_version_check
    check ((instruction_source = 'preset') = (instruction_preset_updated_at is not null));

create index calendar_items_future_preset_instructions_idx
  on public.calendar_items (workspace_id, task_preset_id, start_date, id)
  where instruction_source = 'preset' and lifecycle = 'active';

create table public.assignment_instruction_revisions (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  task_preset_id uuid references public.task_presets(id) on delete cascade,
  calendar_item_id uuid references public.calendar_items(id) on delete cascade,
  previous_text text,
  new_text text,
  actor_auth_user_id uuid,
  item_was_published boolean,
  changed_at timestamptz not null default now(),
  constraint instruction_revision_one_owner check (
    (task_preset_id is not null) <> (calendar_item_id is not null)
  )
);
create index instruction_revisions_preset_idx on public.assignment_instruction_revisions(task_preset_id, changed_at);
create index instruction_revisions_item_idx on public.assignment_instruction_revisions(calendar_item_id, changed_at);
alter table public.assignment_instruction_revisions enable row level security;
revoke all on public.assignment_instruction_revisions from public, anon, authenticated;
-- Supabase grants public-schema sequences separately from table defaults.
revoke all on sequence public.assignment_instruction_revisions_id_seq from public, anon, authenticated;

create function public.prepare_assignment_instruction_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare approved_text text; preset_version timestamptz;
begin
  if tg_table_name = 'task_presets' then
    if new.description is not null and not new.is_system_preset then
      new.assignment_details_approved_at := now();
    end if;
    return new;
  end if;
  if new.task_preset_id is not null and new.meal_kind is null and new.schedule_notes is null then
    select preset.description, preset.updated_at into approved_text, preset_version
    from public.task_presets preset
    where preset.id = new.task_preset_id
      and preset.workspace_id = new.workspace_id
      and preset.lifecycle = 'active'
      and preset.assignment_details_approved_at is not null;
    if approved_text is not null then
      new.schedule_notes := approved_text;
      new.instruction_source := 'preset';
      new.instruction_preset_updated_at := preset_version;
    end if;
  end if;
  return new;
end;
$$;
create trigger prepare_task_assignment_instructions before insert on public.task_presets
for each row execute function public.prepare_assignment_instruction_insert();
create trigger prepare_calendar_assignment_instructions before insert on public.calendar_items
for each row execute function public.prepare_assignment_instruction_insert();
alter function public.prepare_assignment_instruction_insert() owner to postgres;
revoke all on function public.prepare_assignment_instruction_insert() from public, anon, authenticated, service_role;

create function public.track_assignment_instruction_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.schedule_notes is distinct from old.schedule_notes then
    -- Ordinary Calendar editing creates an individual exception. The reviewed
    -- apply RPC supplies a new preset version and retains preset provenance.
    if new.instruction_preset_updated_at is not distinct from old.instruction_preset_updated_at then
      new.instruction_source := 'manual';
      new.instruction_preset_updated_at := null;
    end if;
  end if;
  return new;
end;
$$;
create trigger track_calendar_assignment_instruction_update before update on public.calendar_items
for each row execute function public.track_assignment_instruction_update();
alter function public.track_assignment_instruction_update() owner to postgres;
revoke all on function public.track_assignment_instruction_update() from public, anon, authenticated, service_role;

create function public.audit_assignment_instruction_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'task_presets' then
    if new.description is distinct from old.description then
      insert into public.assignment_instruction_revisions
        (workspace_id, task_preset_id, previous_text, new_text, actor_auth_user_id)
      values (new.workspace_id, new.id, old.description, new.description, auth.uid());
    end if;
    return null;
  end if;
  if new.schedule_notes is distinct from old.schedule_notes then
    insert into public.assignment_instruction_revisions
      (workspace_id, calendar_item_id, previous_text, new_text, actor_auth_user_id, item_was_published)
    values (new.workspace_id, new.id, old.schedule_notes, new.schedule_notes, auth.uid(),
      old.publication_state = 'published');
  end if;
  return null;
end;
$$;
create trigger audit_task_assignment_instruction_update after update on public.task_presets
for each row execute function public.audit_assignment_instruction_update();
create trigger audit_calendar_assignment_instruction_update after update on public.calendar_items
for each row execute function public.audit_assignment_instruction_update();
alter function public.audit_assignment_instruction_update() owner to postgres;
revoke all on function public.audit_assignment_instruction_update() from public, anon, authenticated, service_role;

create function public.update_task_preset_description(
  p_preset_id uuid, p_description text, p_expected_updated_at timestamptz
) returns uuid language plpgsql security definer set search_path = '' as $$
declare current_preset public.task_presets%rowtype;
begin
  if auth.uid() is null or p_preset_id is null or p_expected_updated_at is null
    or (p_description is not null and char_length(btrim(p_description)) not between 1 and 2000)
  then
    raise exception 'Task instructions update is unavailable.' using errcode = '42501';
  end if;
  select preset.* into current_preset from public.task_presets preset
  where preset.id = p_preset_id and preset.lifecycle = 'active'
    and not preset.is_system_preset
    and exists (
      select 1 from public.workspace_contact_grants grant_row
      join public.project_contacts contact on contact.id = grant_row.project_contact_id
      join public.workspaces workspace on workspace.id = grant_row.workspace_id
      where grant_row.workspace_id = preset.workspace_id and workspace.lifecycle = 'active'
        and contact.auth_user_id = auth.uid() and contact.status = 'active'
        and grant_row.status = 'active' and grant_row.revoked_at is null
        and grant_row.valid_from <= now()
        and (grant_row.valid_until is null or grant_row.valid_until > now())
        and grant_row.capabilities @> array['tasks.edit']::text[]
    ) for update;
  if current_preset.id is null then
    raise exception 'Task instructions update is unavailable.' using errcode = '42501';
  end if;
  if current_preset.updated_at <> p_expected_updated_at then
    raise exception 'Task preset changed while editing.'
      using errcode = '40001', detail = 'task_preset_edit_conflict';
  end if;
  update public.task_presets preset
  set description = nullif(btrim(p_description), ''),
      assignment_details_approved_at = case when p_description is null then null else now() end
  where preset.id = p_preset_id;
  return p_preset_id;
end;
$$;
alter function public.update_task_preset_description(uuid,text,timestamptz) owner to postgres;
revoke all on function public.update_task_preset_description(uuid,text,timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.update_task_preset_description(uuid,text,timestamptz)
  to authenticated, service_role;

create function public.apply_task_preset_instructions(
  p_preset_id uuid, p_expected_preset_updated_at timestamptz, p_targets jsonb
) returns integer language plpgsql security definer set search_path = '' as $$
declare preset_row public.task_presets%rowtype; target record; item_row public.calendar_items%rowtype;
  target_count integer; actor_contact_id uuid;
begin
  target_count := case when jsonb_typeof(p_targets) = 'array' then jsonb_array_length(p_targets) else 0 end;
  if auth.uid() is null or p_preset_id is null or p_expected_preset_updated_at is null
    or target_count not between 1 and 100 then
    raise exception 'Instruction application is unavailable.' using errcode = '42501';
  end if;
  select preset.* into preset_row from public.task_presets preset
  where preset.id = p_preset_id and preset.lifecycle = 'active'
    and preset.assignment_details_approved_at is not null and preset.description is not null
    and exists (
      select 1 from public.workspace_contact_grants grant_row
      join public.project_contacts contact on contact.id = grant_row.project_contact_id
      join public.workspaces workspace on workspace.id = grant_row.workspace_id
      where grant_row.workspace_id = preset.workspace_id and workspace.lifecycle = 'active'
        and contact.auth_user_id = auth.uid() and contact.status = 'active'
        and grant_row.status = 'active' and grant_row.revoked_at is null
        and grant_row.valid_from <= now()
        and (grant_row.valid_until is null or grant_row.valid_until > now())
        and grant_row.capabilities @> array['tasks.edit','calendar.edit']::text[]
    ) for update;
  if preset_row.id is null then
    raise exception 'Instruction application is unavailable.' using errcode = '42501';
  end if;
  if preset_row.updated_at <> p_expected_preset_updated_at then
    raise exception 'Task preset changed while editing.'
      using errcode = '40001', detail = 'task_preset_edit_conflict';
  end if;
  select contact.id into actor_contact_id
  from public.project_contacts contact
  join public.workspace_contact_grants grant_row on grant_row.project_contact_id = contact.id
  where contact.auth_user_id = auth.uid() and grant_row.workspace_id = preset_row.workspace_id
    and contact.status = 'active' and grant_row.status = 'active'
    and grant_row.revoked_at is null and grant_row.valid_from <= now()
    and (grant_row.valid_until is null or grant_row.valid_until > now())
    and grant_row.capabilities @> array['tasks.edit','calendar.edit']::text[]
  limit 1;
  for target in select * from jsonb_to_recordset(p_targets) as t(id uuid, updated_at timestamptz) loop
    if target.id is null or target.updated_at is null then
      raise exception 'Invalid selected occurrence.' using errcode = '22023';
    end if;
    select item.* into item_row from public.calendar_items item
    where item.id = target.id and item.workspace_id = preset_row.workspace_id
      and item.task_preset_id = preset_row.id and item.lifecycle = 'active'
      and item.meal_kind is null and item.instruction_source = 'preset'
      and item.start_date > (now() at time zone
        (select workspace.timezone from public.workspaces workspace where workspace.id = preset_row.workspace_id))::date
      and (item.publication_state = 'published' or item.created_by_project_contact_id = actor_contact_id)
    for update;
    if item_row.id is null then
      raise exception 'Selected occurrence is unavailable.' using errcode = '42501';
    end if;
    if item_row.updated_at <> target.updated_at then
      raise exception 'Calendar item changed while editing.'
        using errcode = '40001', detail = 'calendar_item_edit_conflict';
    end if;
    if item_row.schedule_notes is distinct from preset_row.description then
      update public.calendar_items item
      set schedule_notes = preset_row.description,
          instruction_source = 'preset',
          instruction_preset_updated_at = preset_row.updated_at
      where item.id = target.id;
    end if;
  end loop;
  return target_count;
end;
$$;
alter function public.apply_task_preset_instructions(uuid,timestamptz,jsonb) owner to postgres;
revoke all on function public.apply_task_preset_instructions(uuid,timestamptz,jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.apply_task_preset_instructions(uuid,timestamptz,jsonb)
  to authenticated, service_role;

commit;
