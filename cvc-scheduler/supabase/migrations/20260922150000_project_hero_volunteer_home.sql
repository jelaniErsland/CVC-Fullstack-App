begin;
create table public.workspace_project_photos (
  workspace_id uuid primary key references public.workspaces(id) on delete restrict,
  asset_id uuid,
  desktop_x integer not null default 50 check(desktop_x between 0 and 100),
  desktop_y integer not null default 50 check(desktop_y between 0 and 100),
  mobile_x integer not null default 50 check(mobile_x between 0 and 100),
  mobile_y integer not null default 50 check(mobile_y between 0 and 100),
  version bigint not null default 0,
  uploads_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
comment on column public.workspace_project_photos.uploads_enabled is
  'Production disabled: independent object-file backup and restore must be approved before this flag can be enabled. No application role can modify it.';
create table public.volunteer_away_periods (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  volunteer_profile_id uuid not null,
  starts_on date not null,
  ends_on date not null check(ends_on>=starts_on and ends_on-starts_on<=366),
  created_at timestamptz not null default now(),
  foreign key(volunteer_profile_id,workspace_id) references public.volunteer_profiles(id,workspace_id) on delete restrict
);
alter table public.workspace_project_photos enable row level security;
alter table public.workspace_project_photos force row level security;
alter table public.volunteer_away_periods enable row level security;
alter table public.volunteer_away_periods force row level security;
revoke all on public.workspace_project_photos,public.volunteer_away_periods from public,anon,authenticated;

-- Internal, non-executable helper centralizes the existing schedule-token checks.
create function public.volunteer_home_identity(p_token text)
returns table(workspace_id uuid,volunteer_id uuid) language sql stable set search_path='' as $$
  select t.workspace_id,t.volunteer_profile_id from public.volunteer_schedule_access_tokens t
  join public.workspaces w on w.id=t.workspace_id
  join public.volunteer_profiles v on v.id=t.volunteer_profile_id and v.workspace_id=t.workspace_id
  where length(p_token)=43 and p_token ~ '^[A-Za-z0-9_-]{43}$'
    and t.token_verifier_hash=extensions.digest(p_token,'sha256') and t.purpose='volunteer_schedule_access'
    and t.token_version=1 and t.revoked_at is null and t.expires_at>now()
    and w.lifecycle='active' and v.lifecycle='active' and v.readiness_status='ready' limit 1;
$$;
create function public.read_workspace_project_photo(p_workspace_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.project_contacts c join public.workspace_contact_grants g on g.project_contact_id=c.id
    join public.workspaces w on w.id=g.workspace_id where c.auth_user_id=auth.uid() and c.status='active'
      and g.workspace_id=p_workspace_id and w.lifecycle='active' and g.status='active' and g.revoked_at is null
      and g.valid_from<=now() and (g.valid_until is null or g.valid_until>now()) and g.capabilities @> array['workspace.read'])
  then raise exception 'Project photo unavailable.' using errcode='42501'; end if;
  return coalesce((select to_jsonb(p)-'workspace_id'-'updated_at' from public.workspace_project_photos p where workspace_id=p_workspace_id),
    jsonb_build_object('asset_id',null,'version',0,'uploads_enabled',false,'desktop_x',50,'desktop_y',50,'mobile_x',50,'mobile_y',50));
end $$;
create function public.save_workspace_project_photo(p_workspace_id uuid,p_asset_id uuid,p_crop jsonb,p_expected_version bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare current_photo public.workspace_project_photos%rowtype;
begin
  perform public.read_workspace_project_photo(p_workspace_id);
  if not exists(select 1 from public.project_contacts c join public.workspace_contact_grants g on g.project_contact_id=c.id
    where c.auth_user_id=auth.uid() and c.status='active' and g.workspace_id=p_workspace_id and g.status='active'
      and g.revoked_at is null and g.valid_from<=now() and (g.valid_until is null or g.valid_until>now())
      and g.capabilities @> array['workspace.read','calendar.edit']) then raise exception 'Photo editing unavailable.' using errcode='42501'; end if;
  select * into current_photo from public.workspace_project_photos where workspace_id=p_workspace_id for update;
  if not found or not current_photo.uploads_enabled then raise exception 'Photo uploads are disabled pending asset recovery approval.' using errcode='42501'; end if;
  if p_expected_version is null or current_photo.version<>p_expected_version then raise exception 'Project photo changed. Review the latest version.' using errcode='40001'; end if;
  if jsonb_typeof(p_crop) is distinct from 'object' or (p_crop-array['desktopX','desktopY','mobileX','mobileY'])<>'{}'
    or not p_crop ?& array['desktopX','desktopY','mobileX','mobileY'] then raise exception 'Invalid crop.' using errcode='22023'; end if;
  update public.workspace_project_photos set asset_id=p_asset_id,
    desktop_x=(p_crop->>'desktopX')::integer,desktop_y=(p_crop->>'desktopY')::integer,
    mobile_x=(p_crop->>'mobileX')::integer,mobile_y=(p_crop->>'mobileY')::integer,version=version+1,updated_at=now()
    where workspace_id=p_workspace_id;
  return public.read_workspace_project_photo(p_workspace_id);
end $$;

create function public.read_volunteer_home(p_token text,p_week date) returns jsonb
language plpgsql security definer set search_path='' as $$
declare identity record; week_start date; meals jsonb; away jsonb; photo jsonb;
begin
  select * into identity from public.volunteer_home_identity(p_token);
  if not found or p_week is null then return null; end if;
  week_start:=date_trunc('week',p_week::timestamp)::date;
  select coalesce(jsonb_agg(jsonb_build_object('date',i.start_date,'kind',i.meal_kind,'provider',i.meal_provider,
    'menu',i.meal_menu,'startTime',i.start_time,'endTime',i.end_time) order by i.start_date,i.start_time),'[]') into meals
    from public.calendar_items i where i.workspace_id=identity.workspace_id and i.lifecycle='active' and i.publication_state='published'
    and i.meal_kind is not null and i.start_date between week_start and week_start+6;
  select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'start',a.starts_on,'end',a.ends_on) order by a.starts_on),'[]') into away
    from public.volunteer_away_periods a where a.workspace_id=identity.workspace_id and a.volunteer_profile_id=identity.volunteer_id;
  select (to_jsonb(p)-'workspace_id'-'uploads_enabled'-'updated_at') || jsonb_build_object('asset_scope',p.workspace_id) into photo from public.workspace_project_photos p where p.workspace_id=identity.workspace_id;
  return jsonb_build_object('week',week_start,'meals',meals,'away',away,'photo',photo);
end $$;

create function public.manage_volunteer_away(p_token text,p_command text,p_id uuid,p_start date,p_end date,p_expected_preview text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare identity record; conflicts jsonb; fingerprint text; previous public.volunteer_away_periods%rowtype; project_today date;
begin
  select * into identity from public.volunteer_home_identity(p_token);
  if not found then raise exception 'Schedule unavailable.' using errcode='42501'; end if;
  -- Use the bulk-scheduling lock order; never mutate assignments or responses.
  select (now() at time zone w.timezone)::date into project_today from public.workspaces w where w.id=identity.workspace_id for update;
  perform 1 from public.volunteer_profiles where id=identity.volunteer_id for update;
  if p_command='remove' then
    delete from public.volunteer_away_periods where id=p_id and volunteer_profile_id=identity.volunteer_id and workspace_id=identity.workspace_id;
    return jsonb_build_object('kind','removed');
  end if;
  if p_command is null or p_command not in ('preview','save') or p_start is null or p_end is null
    or p_end<p_start or p_end-p_start>366 or p_start<project_today or p_end>project_today+730 or p_id is null then
    raise exception 'Invalid away period.' using errcode='22023'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'date',i.start_date,'title',i.title_snapshot,'response',r.response_status)
    order by i.start_date,a.id),'[]') into conflicts
    from public.calendar_assignments a join public.calendar_items i on i.id=a.calendar_item_id and i.workspace_id=a.workspace_id
    left join public.assignment_responses r on r.assignment_id=a.id
    where a.workspace_id=identity.workspace_id and a.volunteer_profile_id=identity.volunteer_id and a.lifecycle='active'
      and i.lifecycle='active' and i.publication_state='published' and coalesce(r.response_status,'needs_response')<>'declined'
      and i.start_date<=p_end and coalesce(i.end_date,i.start_date)>=p_start;
  fingerprint:=md5(jsonb_build_object('start',p_start,'end',p_end,'conflicts',conflicts)::text);
  if p_command='preview' then return jsonb_build_object('kind','preview','conflicts',conflicts,'fingerprint',fingerprint); end if;
  if p_expected_preview is distinct from fingerprint then raise exception 'Assignments changed. Review this away period again.' using errcode='40001'; end if;
  select * into previous from public.volunteer_away_periods where id=p_id;
  if found then
    if previous.workspace_id<>identity.workspace_id or previous.volunteer_profile_id<>identity.volunteer_id or previous.starts_on<>p_start or previous.ends_on<>p_end
    then raise exception 'Away request unavailable.' using errcode='42501'; end if;
    return jsonb_build_object('kind','saved');
  end if;
  if (select count(*) from public.volunteer_away_periods where volunteer_profile_id=identity.volunteer_id)>=50
    or exists(select 1 from public.volunteer_away_periods where volunteer_profile_id=identity.volunteer_id and starts_on<=p_end and ends_on>=p_start)
  then raise exception 'Review existing away periods.' using errcode='22023'; end if;
  insert into public.volunteer_away_periods(id,workspace_id,volunteer_profile_id,starts_on,ends_on) values(p_id,identity.workspace_id,identity.volunteer_id,p_start,p_end);
  return jsonb_build_object('kind','saved');
end $$;

revoke all on function public.volunteer_home_identity(text) from public,anon,authenticated,service_role;
revoke all on function public.read_workspace_project_photo(uuid),public.save_workspace_project_photo(uuid,uuid,jsonb,bigint) from public,anon,authenticated,service_role;
grant execute on function public.read_workspace_project_photo(uuid),public.save_workspace_project_photo(uuid,uuid,jsonb,bigint) to authenticated,service_role;
revoke all on function public.read_volunteer_home(text,date),public.manage_volunteer_away(text,text,uuid,date,date,text) from public,anon,authenticated,service_role;
grant execute on function public.read_volunteer_home(text,date),public.manage_volunteer_away(text,text,uuid,date,date,text) to anon,authenticated,service_role;

-- Availability is advisory; show it in the existing bulk preview and include it
-- in the preview fingerprint, without changing capacity or response semantics.
do $$ declare definition text; needle text; begin
  select pg_get_functiondef('public.plan_calendar_assignments(uuid,uuid,jsonb,text)'::regprocedure) into definition;
  needle:='''existingAssignments'',existing_preview,';
  if position(needle in definition)=0 then raise exception 'Expected assignment preview not found.'; end if;
  execute replace(definition,needle,'''awayPeriods'',(select coalesce(jsonb_agg(jsonb_build_object(''id'',a.id,''volunteerId'',a.volunteer_profile_id,''start'',a.starts_on,''end'',a.ends_on) order by a.id),''[]''::jsonb)
    from public.volunteer_away_periods a where a.workspace_id=p_workspace_id and a.volunteer_profile_id=any(volunteer_ids)
      and exists(select 1 from jsonb_array_elements(items_preview) i where (i->>''date'')::date between a.starts_on and a.ends_on)), '||needle);
end $$;

-- The hosted creator's historical public-schema default granted service_role
-- EXECUTE, while a fresh local Supabase instance lacks that default. Earlier
-- hardening intentionally preserved those direct grants. Reconcile only the
-- exact surviving application signatures so clean replay matches the reviewed
-- live policy. On production these grants are already present (no ACL change).
grant execute on function
  public.archive_calendar_item(uuid),
  public.archive_task_preset(uuid),
  public.cancel_calendar_assignment(uuid),
  public.claim_initial_assignment_notification_deliveries(uuid),
  public.confirm_all_volunteer_schedule_assignments(text),
  public.convert_questionnaire_submission_to_volunteer_profile(uuid),
  public.create_calendar_assignment(uuid,uuid,text),
  public.create_calendar_assignments_batch(uuid,uuid[],text),
  public.create_calendar_item(uuid,uuid,text,text,text,date,date,time without time zone,time without time zone,integer,text,jsonb),
  public.create_manual_volunteer_profile(uuid,jsonb),
  public.delete_history_free_volunteer_profile(uuid),
  public.finalize_initial_assignment_notification_delivery(uuid,text,text,text),
  public.issue_assignment_response_token(uuid,integer,text),
  public.issue_project_quick_view_access(uuid),
  public.issue_volunteer_schedule_access(uuid,integer),
  public.mark_needs_attention_signal_seen(uuid,text),
  public.publish_calendar_item(uuid),
  public.read_assignment_detail_context(uuid),
  public.read_assignment_notification_delivery_health(),
  public.read_assignment_response_by_token(text),
  public.read_initial_assignment_notification_summaries(uuid[]),
  public.read_project_quick_view_share_state(uuid),
  public.record_assignment_response_link_reveal_event(uuid,uuid,text,text,timestamp with time zone,jsonb),
  public.replace_assignment_response_token(uuid,integer),
  public.reveal_assignment_response_link(uuid,integer,text,jsonb),
  public.revoke_assignment_response_token(uuid),
  public.revoke_project_quick_view_access(uuid),
  public.revoke_volunteer_schedule_access(uuid),
  public.set_current_project_day_expected_on_site(date,integer),
  public.submit_assignment_response_by_token(text,text,text),
  public.submit_questionnaire_submission(text,jsonb,integer),
  public.submit_volunteer_schedule_assignment_response(text,uuid,text,text),
  public.update_assignment_response(uuid,text,text),
  public.update_current_project_contact_volunteer_facing_details(uuid,text,text,text),
  public.update_current_workspace_project_dates(date,date),
  public.update_volunteer_profile_manual_fields(uuid,jsonb),
  public.verify_volunteer_schedule_lookup(text,text,text)
to service_role;
commit;
