-- 12.49: explicit local start/end dates for timed work. Existing null end_date
-- remains the same-day representation. No existing Calendar row is rewritten.
begin;

alter table public.calendar_items drop constraint calendar_items_schedule_shape_valid;
alter table public.calendar_items add constraint calendar_items_schedule_shape_valid check (
  (schedule_kind='timed' and start_time is not null and end_time is not null
    and ((end_date is null and end_time>start_time)
      or (end_date is not null and end_date>start_date)))
  or (schedule_kind in ('date_based','milestone') and end_date is null
    and start_time is null and end_time is null)
  or (schedule_kind='multi_day_window' and end_date is not null
    and end_date>start_date and start_time is null and end_time is null)
);

-- PostgreSQL chooses an offset for a fold and adjusts a missing local time.
-- Require each entered wall clock endpoint to map to exactly one UTC instant.
create function public.calendar_local_time_is_unique(p_date date,p_time time without time zone,p_timezone text)
returns boolean language plpgsql stable set search_path='' as $$
declare candidate timestamptz; local_value timestamp; matching integer;
begin
  if p_date is null or p_time is null or p_timezone is null then return false; end if;
  local_value:=p_date+p_time;
  candidate:=local_value at time zone p_timezone;
  if candidate at time zone p_timezone <> local_value then return false; end if;
  select count(*) into matching from generate_series(candidate-interval '4 hours',candidate+interval '4 hours',interval '1 minute') as instant(value)
    where value at time zone p_timezone=local_value;
  return matching=1;
exception when invalid_parameter_value then return false;
end $$;
alter function public.calendar_local_time_is_unique(date,time without time zone,text) owner to postgres;
revoke all on function public.calendar_local_time_is_unique(date,time without time zone,text) from public,anon,authenticated,service_role;

create function public.validate_calendar_timed_interval() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.schedule_kind='timed' and (
    not public.calendar_local_time_is_unique(new.start_date,new.start_time,new.timezone)
    or not public.calendar_local_time_is_unique(coalesce(new.end_date,new.start_date),new.end_time,new.timezone)
  ) then
    raise exception 'Scheduled local time is missing or ambiguous in the project timezone. Choose another time.' using errcode='22023';
  end if;
  return new;
end $$;
alter function public.validate_calendar_timed_interval() owner to postgres;
revoke all on function public.validate_calendar_timed_interval() from public,anon,authenticated,service_role;
create trigger calendar_timed_interval_timezone_check before insert or update of schedule_kind,start_date,end_date,start_time,end_time,timezone
  on public.calendar_items for each row execute function public.validate_calendar_timed_interval();

-- The existing create RPC already accepts end_date. Extend its timed branch
-- without changing its signature or any authorization/other schedule branch.
do $$
declare definition text; original text;
begin
  select pg_get_functiondef('public.create_calendar_item(uuid,uuid,text,text,text,date,date,time without time zone,time without time zone,integer,text,jsonb)'::regprocedure) into definition;
  original:=definition;
  definition:=replace(definition,
    $old$        and p_end_date is null
        and p_start_time is not null
        and p_end_time is not null
        and p_end_time > p_start_time$old$,
    $new$        and p_start_time is not null
        and p_end_time is not null
        and ((p_end_date is null and p_end_time > p_start_time)
          or (p_end_date is not null and p_end_date > p_start_date))$new$);
  if definition=original then raise exception 'Timed create validation drifted.'; end if;
  execute definition;
end $$;

-- Preserve the old edit signatures for deployed clients; the new signatures
-- include an explicit end date and retain the existing version/permission lock.
do $$
declare definition text; original text; target text;
begin
  for target in select unnest(array['one_off','preset']) loop
    if target='one_off' then
      select pg_get_functiondef('public.update_calendar_item_one_off_timed(uuid,text,text,date,time without time zone,time without time zone,integer,text,jsonb,timestamp with time zone)'::regprocedure) into definition;
    else
      select pg_get_functiondef('public.update_calendar_item_preset_timed(uuid,date,time without time zone,time without time zone,integer,text,jsonb,timestamp with time zone)'::regprocedure) into definition;
    end if;
    original:=definition;
    definition:=replace(definition,'p_start_date date, p_start_time time without time zone',
      'p_start_date date, p_end_date date, p_start_time time without time zone');
    if definition=original then raise exception 'Timed edit signature drifted.'; end if;
    original:=definition;
    definition:=replace(definition,'    or p_end_time <= p_start_time',
      '    or not ((p_end_date is null and p_end_time > p_start_time) or (p_end_date is not null and p_end_date > p_start_date))');
    if definition=original then raise exception 'Timed edit validation drifted.'; end if;
    original:=definition;
    definition:=replace(definition,'      end_date = null,','      end_date = p_end_date,');
    if definition=original then raise exception 'Timed edit persistence drifted.'; end if;
    execute definition;
  end loop;
end $$;
revoke all on function public.update_calendar_item_one_off_timed(uuid,text,text,date,date,time without time zone,time without time zone,integer,text,jsonb,timestamp with time zone) from public,anon,authenticated,service_role;
grant execute on function public.update_calendar_item_one_off_timed(uuid,text,text,date,date,time without time zone,time without time zone,integer,text,jsonb,timestamp with time zone) to authenticated,service_role;
revoke all on function public.update_calendar_item_preset_timed(uuid,date,date,time without time zone,time without time zone,integer,text,jsonb,timestamp with time zone) from public,anon,authenticated,service_role;
grant execute on function public.update_calendar_item_preset_timed(uuid,date,date,time without time zone,time without time zone,integer,text,jsonb,timestamp with time zone) to authenticated,service_role;

-- Duplication already carries the source day offset forward. Permit its
-- existing time inputs to retain an overnight source interval.
do $$
declare definition text; original text;
begin
  select pg_get_functiondef('public.duplicate_calendar_item(uuid,date,time without time zone,time without time zone)'::regprocedure) into definition;
  original:=definition;
  definition:=replace(definition,
    $old$source.schedule_kind <> 'timed' or p_end_time <= p_start_time$old$,
    $new$source.schedule_kind <> 'timed' or (source.end_date is null and p_end_time <= p_start_time)$new$);
  if definition=original then raise exception 'Timed duplicate validation drifted.'; end if;
  execute definition;
end $$;

-- Recurrence uses endDate as its final *start* date. The offset moves each
-- occurrence's end without changing its weekday, start time, or item count.
do $$
declare definition text; original text;
begin
  select pg_get_functiondef('public.create_current_workspace_repeated_calendar_items(uuid,uuid,text,text,date,date,smallint[],time without time zone,time without time zone,integer,text,jsonb,text,text,text,text,integer)'::regprocedure) into definition;
  original:=definition;
  definition:=replace(definition,'p_end_date date, p_weekdays smallint[]',
    'p_end_date date, p_end_day_offset integer, p_weekdays smallint[]');
  if definition=original then raise exception 'Repeat signature drifted.'; end if;
  original:=definition;
  definition:=replace(definition,'    or p_end_time <= p_start_time',
    $new$    or p_end_day_offset not between 0 and 7
    or (p_end_day_offset=0 and p_end_time <= p_start_time)$new$);
  if definition=original then raise exception 'Repeat validation drifted.'; end if;
  original:=definition;
  definition:=replace(definition,$old$'timed', selected_date, null, p_start_time$old$, $new$'timed', selected_date, case when p_end_day_offset=0 then null else selected_date+p_end_day_offset end, p_start_time$new$);
  if definition=original then raise exception 'Repeat interval persistence drifted.'; end if;
  execute definition;
end $$;
revoke all on function public.create_current_workspace_repeated_calendar_items(uuid,uuid,text,text,date,date,integer,smallint[],time without time zone,time without time zone,integer,text,jsonb,text,text,text,text,integer) from public,anon,authenticated,service_role;
grant execute on function public.create_current_workspace_repeated_calendar_items(uuid,uuid,text,text,date,date,integer,smallint[],time without time zone,time without time zone,integer,text,jsonb,text,text,text,text,integer) to authenticated,service_role;

-- The bulk planner is the other recurring writer. Its preview and save must
-- use the same explicit offset. Its conflict preview is revised below.
do $$
declare definition text; original text;
begin
  select pg_get_functiondef('public.plan_calendar_assignments(uuid,uuid,jsonb,text)'::regprocedure) into definition;
  original:=definition;
  definition:=replace(definition,$old$'startDate','endDate','weekdays'$old$, $new$'startDate','endDate','endDayOffset','weekdays'$new$);
  if definition=original then raise exception 'Bulk creation allowlist drifted.'; end if;
  original:=definition;
  definition:=replace(definition,
    $old$or (creation->>'endTime')::time <= (creation->>'startTime')::time$old$,
    $new$or coalesce((creation->>'endDayOffset')::integer,0) not between 0 and 7
      or (coalesce((creation->>'endDayOffset')::integer,0)=0 and (creation->>'endTime')::time <= (creation->>'startTime')::time)$new$);
  if definition=original then raise exception 'Bulk creation interval check drifted.'; end if;
  original:=definition;
  definition:=replace(definition,$old$'startTime',creation->>'startTime','endTime'$old$,
    $new$'endDate',case when coalesce((creation->>'endDayOffset')::integer,0)=0 then null else day+((creation->>'endDayOffset')::integer) end,'startTime',creation->>'startTime','endTime'$new$);
  if definition=original then raise exception 'Bulk creation preview drifted.'; end if;
  original:=definition;
  definition:=replace(definition,$old$'startTime',current_item.start_time,'endTime'$old$,
    $new$'endDate',current_item.end_date,'startTime',current_item.start_time,'endTime'$new$);
  if definition=original then raise exception 'Bulk existing item preview drifted.'; end if;
  original:=definition;
  definition:=replace(definition,$old$(creation->>'startDate')::date,(creation->>'endDate')::date,weekdays,$old$,
    $new$(creation->>'startDate')::date,(creation->>'endDate')::date,coalesce((creation->>'endDayOffset')::integer,0),weekdays,$new$);
  if definition=original then raise exception 'Bulk repeat call drifted.'; end if;
  execute definition;
end $$;

-- Keep the planner's warning-only policy, but compare complete half-open
-- intervals. Adjacent shifts have no overlap; a continuation is one item.
do $$
declare definition text; begin_marker text; end_marker text; first_pos integer; last_pos integer;
begin
  select pg_get_functiondef('public.plan_calendar_assignments(uuid,uuid,jsonb,text)'::regprocedure) into definition;
  begin_marker:='  -- Same-day work is a warning, not a new capacity/publication rule.';
  end_marker:='  preview:=jsonb_build_object(';
  first_pos:=position(begin_marker in definition);
  last_pos:=position(end_marker in definition);
  if first_pos=0 or last_pos<=first_pos then raise exception 'Bulk conflict projection drifted.'; end if;
  definition:=substring(definition from 1 for first_pos-1) || $replacement$
  select coalesce(jsonb_agg(to_jsonb(conflict) order by conflict."assignmentId"),'[]'::jsonb) into conflicts_preview
  from (
    select distinct on (a.id) a.volunteer_profile_id as "volunteerId",
      i.start_date as "date", i.title_snapshot as "title", a.id as "assignmentId",
      a.updated_at as "version", i.updated_at as "itemVersion"
    from public.calendar_assignments a
    join public.calendar_items i on i.id=a.calendar_item_id
    join public.workspaces w on w.id=i.workspace_id
    where a.workspace_id=p_workspace_id and a.volunteer_profile_id=any(volunteer_ids)
      and a.lifecycle='active' and i.lifecycle='active'
      and i.schedule_kind in ('timed','date_based') and not i.id=any(item_ids)
      and (i.publication_state='published' or i.created_by_project_contact_id=actor)
      and exists (
        select 1 from jsonb_array_elements(items_preview) selected
        where tstzrange(
          (((selected->>'date')::date + coalesce((selected->>'startTime')::time,time '00:00')) at time zone w.timezone),
          (((coalesce((selected->>'endDate')::date,(selected->>'date')::date)
            + coalesce((selected->>'endTime')::time,time '00:00'))
            + case when selected->>'startTime' is null then interval '1 day' else interval '0' end) at time zone w.timezone),
          '[)') && tstzrange(
          ((i.start_date+coalesce(i.start_time,time '00:00')) at time zone w.timezone),
          (((coalesce(i.end_date,i.start_date)+coalesce(i.end_time,time '00:00'))
            + case when i.schedule_kind='date_based' then interval '1 day' else interval '0' end) at time zone w.timezone),
          '[)')
      )
    order by a.id
  ) conflict;
$replacement$ || substring(definition from last_pos);
  execute definition;
end $$;

-- Contact-only volunteer access follows Project Local's intentionally light
-- trust model. Choice values identify only rows matching the supplied contact;
-- they are rechecked on selection and never expose direct table access.
create function public.resolve_volunteer_schedule_contact(p_contact text,p_choice text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare normalized_contact text; contact_is_email boolean; limiter public.volunteer_lookup_attempts%rowtype;
  contact_bucket text; contact_attempts integer; matches jsonb; selected jsonb; bearer text; expires timestamptz;
begin
  select * into limiter from public.volunteer_lookup_attempts where bucket='global' for update;
  if not found or limiter.secret is null then return '{"status":"unverified"}'::jsonb; end if;
  if limiter.window_started_at<=now()-interval '15 minutes' then
    update public.volunteer_lookup_attempts set attempts=0,window_started_at=now() where bucket='global';
    limiter.attempts:=0;
  end if;
  if limiter.attempts>=200 then return '{"status":"unverified"}'::jsonb; end if;
  update public.volunteer_lookup_attempts set attempts=public.volunteer_lookup_attempts.attempts+1 where bucket='global';
  delete from public.volunteer_lookup_attempts where bucket<>'global' and window_started_at<=now()-interval '15 minutes';
  if p_contact is null or octet_length(p_contact)>1024 then return '{"status":"unverified"}'::jsonb; end if;
  normalized_contact:=lower(btrim(p_contact));
  if char_length(normalized_contact) not between 3 and 254 then return '{"status":"unverified"}'::jsonb; end if;
  contact_is_email:=position('@' in normalized_contact)>0;
  if contact_is_email then
    if normalized_contact !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return '{"status":"unverified"}'::jsonb; end if;
  else
    if normalized_contact !~ '^\+?[0-9() .-]+$' then return '{"status":"unverified"}'::jsonb; end if;
    normalized_contact:=regexp_replace(normalized_contact,'[^0-9]','','g');
    if char_length(normalized_contact) not between 7 and 15 then return '{"status":"unverified"}'::jsonb; end if;
  end if;
  contact_bucket:=encode(extensions.hmac(convert_to('contact:'||normalized_contact,'UTF8'),limiter.secret,'sha256'),'hex');
  insert into public.volunteer_lookup_attempts(bucket,attempts) values(contact_bucket,1)
    on conflict(bucket) do update set attempts=least(public.volunteer_lookup_attempts.attempts+1,7)
    returning attempts into contact_attempts;
  if contact_attempts>6 then return '{"status":"unverified"}'::jsonb; end if;
  select coalesce(jsonb_agg(jsonb_build_object('volunteer_id',v.id,'workspace_id',w.id,
    'name',v.full_name,'project',w.display_name,'congregation',v.congregation,
    'choice',encode(extensions.hmac(convert_to('volunteer:'||w.id||':'||v.id||':'||normalized_contact,'UTF8'),limiter.secret,'sha256'),'hex'))
    order by w.display_name,v.full_name,v.id),'[]'::jsonb) into matches
  from public.volunteer_profiles v join public.workspaces w on w.id=v.workspace_id
  where v.lifecycle='active' and v.readiness_status='ready' and w.lifecycle='active'
    and ((contact_is_email and lower(btrim(v.email))=normalized_contact)
      or (not contact_is_email and btrim(v.phone)~'^\+?[0-9() .-]+$'
        and regexp_replace(v.phone,'[^0-9]','','g')=normalized_contact));
  if jsonb_array_length(matches)=0 or jsonb_array_length(matches)>20 then return '{"status":"unverified"}'::jsonb; end if;
  if p_choice is null and jsonb_array_length(matches)>1 then
    return jsonb_build_object('status','choose_volunteer','volunteers',
      (select jsonb_agg(jsonb_build_object('choice',m->>'choice','name',m->>'name','project',m->>'project',
        'congregation',m->>'congregation')) from jsonb_array_elements(matches) m));
  end if;
  select m into selected from jsonb_array_elements(matches) m
    where p_choice is null or (m->>'choice')=p_choice;
  if selected is null then return '{"status":"unverified"}'::jsonb; end if;
  bearer:=rtrim(translate(encode(extensions.gen_random_bytes(32),'base64'),'+/','-_'),'=');
  expires:=now()+interval '30 days';
  insert into public.volunteer_schedule_access_tokens(workspace_id,volunteer_profile_id,token_verifier_hash,expires_at)
    values((selected->>'workspace_id')::uuid,(selected->>'volunteer_id')::uuid,extensions.digest(bearer,'sha256'),expires);
  return jsonb_build_object('status','verified','bearer_token',bearer,'expires_at',expires);
end $$;
alter function public.resolve_volunteer_schedule_contact(text,text) owner to postgres;
revoke all on function public.resolve_volunteer_schedule_contact(text,text) from public,anon,authenticated,service_role;
grant execute on function public.resolve_volunteer_schedule_contact(text,text) to anon,authenticated,service_role;
revoke execute on function public.verify_volunteer_schedule_lookup(text,text,text) from anon,authenticated,service_role;

-- Shared inboxes are intentional in the lightweight volunteer trust model.
-- Keep per-assignment delivery reservations, but allow both household members
-- through the original initial-email eligibility and claim paths.
do $$
declare definition text; original text;
begin
  select pg_get_functiondef('public.claim_initial_assignment_notification_deliveries(uuid)'::regprocedure) into definition;
  definition:=replace(definition,E'\r\n',E'\n');
  original:=definition;
  definition:=replace(definition,
    $old$    elsif exists (
      select 1 from public.volunteer_profiles household
      where household.workspace_id=target_workspace_id
        and household.id<>candidate.volunteer_profile_id
        and household.lifecycle='active'
        and lower(btrim(household.email))=normalized_recipient_email
    ) then
      candidate_status := 'not_eligible';
      candidate_failure := 'not_eligible';
    elsif not candidate.has_follow_up_contact then$old$,
    $new$    elsif not candidate.has_follow_up_contact then$new$);
  if definition=original then raise exception 'Initial delivery shared-contact guard drifted.'; end if;
  execute definition;
  select pg_get_functiondef('public.read_initial_assignment_notification_summaries(uuid[])'::regprocedure) into definition;
  original:=definition;
  definition:=replace(definition,'and scope.recipient_email is not null and not scope.shared_contact',
    'and scope.recipient_email is not null');
  if definition=original then raise exception 'Initial delivery summary shared-contact guard drifted.'; end if;
  execute definition;
end $$;

do $$
declare definition text; original text;
begin
  select pg_get_functiondef('public.communication_preview(uuid,jsonb)'::regprocedure) into definition;
  original:=definition;
  definition:=replace(definition,$old$'date',i.start_date,'title',i.title_snapshot,'startTime'$old$,
    $new$'date',i.start_date,'endDate',i.end_date,'title',i.title_snapshot,'startTime'$new$);
  if definition=original then raise exception 'Communication interval projection drifted.'; end if;
  execute definition;
end $$;

commit;
