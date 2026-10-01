-- 12.49: preserve distinct volunteer identities and fail closed for shared public contacts.
-- Applied only through the reviewed production release gate.
begin;
create or replace function public.import_volunteer_profiles(p_workspace_id uuid,p_request_id uuid,p_rows jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  actor uuid; previous public.volunteer_csv_import_operations%rowtype; payload_hash text;
  entry jsonb; patch jsonb; current_profile public.volunteer_profiles%rowtype; merged jsonb;
  new_count integer:=0; update_count integer:=0; profile_id uuid; touched uuid[]:='{}';
  result jsonb; key text; candidate_email text; candidate_phone text;
begin
  select c.id into actor from public.project_contacts c join public.workspace_contact_grants g on g.project_contact_id=c.id
    join public.workspaces w on w.id=g.workspace_id where c.auth_user_id=auth.uid() and c.status='active'
      and w.id=p_workspace_id and w.lifecycle='active' and g.status='active' and g.revoked_at is null
      and g.valid_from<=now() and (g.valid_until is null or g.valid_until>now())
      and g.capabilities @> array['workspace.read','volunteers.view','volunteers.edit']::text[];
  if actor is null then raise exception 'Import unavailable.' using errcode='42501'; end if;
  if p_request_id is null or jsonb_typeof(p_rows) is distinct from 'array'
    or jsonb_array_length(p_rows) not between 1 and 500 or octet_length(p_rows::text)>1048576 then
    raise exception 'Invalid import.' using errcode='22023'; end if;
  perform 1 from public.workspaces where id=p_workspace_id for update;
  payload_hash:=encode(extensions.digest(p_rows::text,'sha256'),'hex');
  select * into previous from public.volunteer_csv_import_operations where workspace_id=p_workspace_id and request_id=p_request_id;
  if found then
    if previous.actor_id<>actor or previous.payload_hash<>payload_hash then raise exception 'Import request already used.' using errcode='22023'; end if;
    return previous.result;
  end if;
  -- Lock reviewed existing profiles in stable order before applying any patch.
  perform 1 from public.volunteer_profiles v where v.workspace_id=p_workspace_id
    and v.id in(select (e->>'profileId')::uuid from jsonb_array_elements(p_rows) e)
    order by v.id for update;
  for entry in select value from jsonb_array_elements(p_rows) loop
    patch:=entry->'patch';
    if jsonb_typeof(entry)<>'object' or (entry-array['profileId','expectedUpdatedAt','patch'])<>'{}'
      or jsonb_typeof(patch) is distinct from 'object'
      or (patch-array['fullName','email','phone','congregation','preferredContactMethod','lifecycle','readinessStatus','profileNotes',
        'dateOfBirth','emergencyContactName','emergencyContactPhone','emergencyContactRelationship','housingOption',
        'afterHoursSecurityAvailability','builderAssistantCommunication','availableWorkDays','availableTwoPlusDays','skillsExperience','otherSupport'])<>'{}'
    then raise exception 'Invalid import fields.' using errcode='22023'; end if;
    for key in select jsonb_object_keys(patch) loop
      if patch->key='null'::jsonb or (jsonb_typeof(patch->key)='string' and btrim(patch->>key)='')
        or octet_length((patch->key)::text)>16002 then
        raise exception 'Blank CSV fields cannot erase profile information.' using errcode='22023'; end if;
    end loop;
    profile_id:=(entry->>'profileId')::uuid;
    if profile_id is null then
      if entry->>'expectedUpdatedAt' is not null then raise exception 'Invalid new row.' using errcode='22023'; end if;
      merged:=patch;
    else
      if profile_id=any(touched) then raise exception 'Duplicate profile in import.' using errcode='22023'; end if;
      select * into current_profile from public.volunteer_profiles where id=profile_id and workspace_id=p_workspace_id;
      if not found then raise exception 'Profile unavailable.' using errcode='42501'; end if;
      if entry->>'expectedUpdatedAt' is null or current_profile.updated_at<>(entry->>'expectedUpdatedAt')::timestamptz then
        raise exception 'This profile changed. Review the latest version.' using errcode='40001'; end if;
      merged:=jsonb_build_object('fullName',current_profile.full_name,'email',current_profile.email,'phone',current_profile.phone,
        'congregation',current_profile.congregation,'preferredContactMethod',current_profile.preferred_contact_method,
        'lifecycle',current_profile.lifecycle,'readinessStatus',current_profile.readiness_status,'profileNotes',current_profile.profile_notes,
        'dateOfBirth',current_profile.date_of_birth,'emergencyContactName',current_profile.emergency_contact_name,
        'emergencyContactPhone',current_profile.emergency_contact_phone,'emergencyContactRelationship',current_profile.emergency_contact_relationship,
        'housingOption',current_profile.housing_option,'afterHoursSecurityAvailability',current_profile.after_hours_security_availability,
        'builderAssistantCommunication',current_profile.builder_assistant_communication,'availableWorkDays',current_profile.available_work_days,
        'availableTwoPlusDays',current_profile.available_two_plus_days,'skillsExperience',current_profile.skills_experience,'otherSupport',current_profile.other_support)
        || patch || jsonb_build_object('expectedUpdatedAt',current_profile.updated_at);
    end if;
    candidate_email:=lower(nullif(btrim(merged->>'email'),''));
    candidate_phone:=nullif(regexp_replace(coalesce(merged->>'phone',''),'[^0-9]','','g'),'');
    if candidate_email is not null and candidate_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Invalid email.' using errcode='22023'; end if;
    -- Only an internal profile ID authorizes an update. Contact methods may be shared.
    -- A new row with an existing name still requires individual review.
    if profile_id is null and exists(select 1 from public.volunteer_profiles v
      where v.workspace_id=p_workspace_id
        and lower(btrim(regexp_replace(v.full_name,'[[:space:]]+',' ','g')))=lower(btrim(regexp_replace(merged->>'fullName','[[:space:]]+',' ','g')))) then
      raise exception 'Matching volunteer changed. Review the import again.' using errcode='40001'; end if;
    if profile_id is null then
      profile_id:=public.create_manual_volunteer_profile(p_workspace_id,merged);
      new_count:=new_count+1;
    else
      perform public.update_volunteer_profile_manual_fields(profile_id,merged);
      update_count:=update_count+1;
    end if;
    touched:=array_append(touched,profile_id);
  end loop;
  result:=jsonb_build_object('created',new_count,'updated',update_count,'profileIds',touched);
  insert into public.volunteer_csv_import_operations(workspace_id,request_id,actor_id,payload_hash,result)
    values(p_workspace_id,p_request_id,actor,payload_hash,result);
  return result;
end $$;
alter function public.import_volunteer_profiles(uuid,uuid,jsonb) owner to postgres;
revoke all on function public.import_volunteer_profiles(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.import_volunteer_profiles(uuid,uuid,jsonb) to authenticated,service_role;

create or replace function public.verify_volunteer_schedule_lookup(
  p_full_name text,
  p_contact text,
  p_project_choice text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_last_name text;
  normalized_contact text;
  contact_is_email boolean;
  name_bucket text;
  limiter public.volunteer_lookup_attempts%rowtype;
  name_attempts integer;
  matches jsonb;
  selected_match jsonb;
  bearer text;
  expires timestamptz;
begin
  select * into limiter from public.volunteer_lookup_attempts where bucket = 'global' for update;
  if not found or limiter.secret is null then return '{"status":"unverified"}'::jsonb; end if;
  if limiter.window_started_at <= now() - interval '15 minutes' then
    update public.volunteer_lookup_attempts set attempts = 0, window_started_at = now() where bucket = 'global';
    limiter.attempts := 0;
  end if;
  if limiter.attempts >= 200 then return '{"status":"unverified"}'::jsonb; end if;
  update public.volunteer_lookup_attempts set attempts = attempts + 1 where bucket = 'global';
  delete from public.volunteer_lookup_attempts where bucket <> 'global' and window_started_at <= now() - interval '15 minutes';

  if p_full_name is null or p_contact is null or octet_length(p_full_name) > 640 or octet_length(p_contact) > 1024 then return '{"status":"unverified"}'::jsonb; end if;
  normalized_last_name := lower(btrim(regexp_replace(p_full_name, '[[:space:]]+', ' ', 'g')));
  normalized_contact := lower(btrim(p_contact));
  if char_length(normalized_last_name) not between 1 and 160 or char_length(normalized_contact) not between 3 and 254 then return '{"status":"unverified"}'::jsonb; end if;

  -- Keep the existing serialized, keyed rate-limit design. The bucket is not a readable name hash.
  name_bucket := encode(extensions.hmac(convert_to(normalized_last_name, 'UTF8'), limiter.secret, 'sha256'), 'hex');
  insert into public.volunteer_lookup_attempts (bucket, attempts) values (name_bucket, 1)
    on conflict (bucket) do update set attempts = least(public.volunteer_lookup_attempts.attempts + 1, 7)
    returning attempts into name_attempts;
  if name_attempts > 6 then return '{"status":"unverified"}'::jsonb; end if;

  contact_is_email := position('@' in normalized_contact) > 0;
  if not contact_is_email then
    if normalized_contact !~ '^\+?[0-9() .-]+$' then return '{"status":"unverified"}'::jsonb; end if;
    normalized_contact := regexp_replace(normalized_contact, '[^0-9]', '', 'g');
    if char_length(normalized_contact) not between 7 and 15 then return '{"status":"unverified"}'::jsonb; end if;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('workspace_id', w.id, 'name', w.display_name, 'volunteer_id', v.id) order by w.display_name, w.id), '[]'::jsonb)
  into matches
  from public.volunteer_profiles v join public.workspaces w on w.id = v.workspace_id
  where v.lifecycle = 'active' and v.readiness_status = 'ready' and w.lifecycle = 'active'
    and regexp_replace(lower(btrim(regexp_replace(v.full_name, '[[:space:]]+', ' ', 'g'))), '^.* ', '') = normalized_last_name
    and ((contact_is_email and lower(btrim(v.email)) = normalized_contact)
      or (not contact_is_email and btrim(v.phone) ~ '^\+?[0-9() .-]+$' and regexp_replace(v.phone, '[^0-9]', '', 'g') = normalized_contact));

  -- A shared contact plus a public surname does not establish which household
  -- member is present. Keep individual links and a separately held phone path.
  if exists (
    select 1 from jsonb_array_elements(matches) m
    where exists (
      select 1 from public.volunteer_profiles other
      where other.workspace_id=(m->>'workspace_id')::uuid
        and other.lifecycle='active'
        and other.id<>(m->>'volunteer_id')::uuid
        and ((contact_is_email and lower(btrim(other.email))=normalized_contact)
          or (not contact_is_email and btrim(other.phone) ~ '^\+?[0-9() .-]+$'
            and regexp_replace(other.phone, '[^0-9]', '', 'g')=normalized_contact))
    )
  ) then return '{"status":"unverified"}'::jsonb; end if;

  if jsonb_array_length(matches) = 0 or jsonb_array_length(matches) > 20 or exists (select 1 from jsonb_array_elements(matches) m group by m->>'workspace_id' having count(*) > 1) then return '{"status":"unverified"}'::jsonb; end if;
  if p_project_choice is null and jsonb_array_length(matches) > 1 then
    return jsonb_build_object('status', 'choose_project', 'projects', (select jsonb_agg(jsonb_build_object('choice', encode(extensions.hmac(convert_to('choice:' || (m->>'workspace_id') || ':' || normalized_last_name || ':' || normalized_contact, 'UTF8'), limiter.secret, 'sha256'), 'hex'), 'name', m->>'name')) from jsonb_array_elements(matches) m));
  end if;
  select m into selected_match from jsonb_array_elements(matches) m where p_project_choice is null or encode(extensions.hmac(convert_to('choice:' || (m->>'workspace_id') || ':' || normalized_last_name || ':' || normalized_contact, 'UTF8'), limiter.secret, 'sha256'), 'hex') = p_project_choice;
  if selected_match is null then return '{"status":"unverified"}'::jsonb; end if;
  bearer := rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');
  expires := now() + interval '24 hours';
  insert into public.volunteer_schedule_access_tokens (workspace_id, volunteer_profile_id, token_verifier_hash, expires_at) values ((selected_match->>'workspace_id')::uuid, (selected_match->>'volunteer_id')::uuid, extensions.digest(bearer, 'sha256'), expires);
  return jsonb_build_object('status', 'verified', 'bearer_token', bearer, 'expires_at', expires);
end;
$$;
revoke all on function public.verify_volunteer_schedule_lookup(text, text, text) from public, anon, authenticated;
grant execute on function public.verify_volunteer_schedule_lookup(text, text, text) to anon, authenticated;
comment on function public.verify_volunteer_schedule_lookup(text, text, text) is 'Public exact last-name/contact verification only. Six attempts/name and 200 total per 15 minutes; generic failures; no directory or schedule data. Project selection re-verifies contact.';

-- The legacy Initial email path issues a bearer link. It must not dispatch that
-- credential to an inbox shared by multiple active volunteers in a workspace.
-- Preserve its assignment-keyed ledger and existing provider retry rules.
do $$
declare definition text; original text;
begin
  select pg_get_functiondef('public.claim_initial_assignment_notification_deliveries(uuid)'::regprocedure) into definition;
  original := definition;
  definition := replace(definition,
    $old$    elsif not candidate.has_follow_up_contact then$old$,
    $new$    elsif exists (
      select 1 from public.volunteer_profiles household
      where household.workspace_id=target_workspace_id
        and household.id<>candidate.volunteer_profile_id
        and household.lifecycle='active'
        and lower(btrim(household.email))=normalized_recipient_email
    ) then
      candidate_status := 'not_eligible';
      candidate_failure := 'not_eligible';
    elsif not candidate.has_follow_up_contact then$new$);
  if definition=original then raise exception 'Initial notification shared-contact guard could not be installed.'; end if;
  execute definition;

  select pg_get_functiondef('public.read_initial_assignment_notification_summaries(uuid[])'::regprocedure) into definition;
  original := definition;
  definition := replace(definition,
    $old$      lower(nullif(btrim(volunteer.email), '')) as recipient_email,$old$,
    $new$      lower(nullif(btrim(volunteer.email), '')) as recipient_email,
      exists (
        select 1 from public.volunteer_profiles household
        where household.workspace_id=item.workspace_id
          and household.id<>volunteer.id and household.lifecycle='active'
          and lower(btrim(household.email))=lower(btrim(volunteer.email))
      ) as shared_contact,$new$);
  if definition=original then raise exception 'Initial notification summary contact guard could not be installed.'; end if;
  original := definition;
  definition := replace(definition,
    $old$and scope.recipient_email is not null$old$,
    $new$and scope.recipient_email is not null and not scope.shared_contact$new$);
  if definition=original then raise exception 'Initial notification eligibility guard could not be installed.'; end if;
  execute definition;
end $$;

-- One operation may legitimately have two distinct volunteer recipients at the
-- same address. Identity and idempotency remain keyed by volunteer/assignment.
alter table public.communication_recipients
  drop constraint communication_recipients_operation_id_email_key;

do $$
declare definition text; original text;
begin
  select pg_get_functiondef('public.communication_preview(uuid,jsonb)'::regprocedure) into definition;
  original := definition;
  definition := replace(definition,
    $old$  previous_email text; busy boolean; new_count integer; old_count integer;$old$,
    $new$  previous_email text; busy boolean; shared_contact boolean; new_count integer; old_count integer;$new$);
  if definition=original then raise exception 'Communication preview variable could not be installed.'; end if;
  original := definition;
  definition := replace(definition,
    $old$    reason:=null; entries:='[]'; previous_email:=null;$old$,
    $new$    reason:=null; entries:='[]'; previous_email:=null;
    select exists(select 1 from public.volunteer_profiles household
      where household.workspace_id=p_workspace and household.id<>person.id
        and household.lifecycle='active' and lower(btrim(household.email))=person.email)
      into shared_contact;$new$);
  if definition=original then raise exception 'Communication preview shared-contact check could not be installed.'; end if;
  original := definition;
  definition := replace(definition,
    $old$    elsif exists(select 1 from public.volunteer_profiles v where v.workspace_id=p_workspace and v.id<>person.id
      and v.lifecycle='active' and lower(btrim(v.email))=person.email) then reason:='shared_email_requires_review';$old$,
    $new$    $new$);
  if definition=original then raise exception 'Communication shared-contact exclusion could not be removed.'; end if;
  original := definition;
  definition := replace(definition,
    $old$      'excludedAssignments',excluded_count,'emailChanged',$old$,
    $new$      'excludedAssignments',excluded_count,'sharedContact',shared_contact,'emailChanged',$new$);
  if definition=original then raise exception 'Communication preview snapshot could not be installed.'; end if;
  execute definition;

  select pg_get_functiondef('public.claim_communication_recipient(uuid,boolean)'::regprocedure) into definition;
  original := definition;
  definition := replace(definition,
    $old$    and v.id<>row.volunteer_id and v.lifecycle='active' and lower(btrim(v.email))=row.email) then valid:=false; end if;$old$,
    $new$    and v.id<>row.volunteer_id and v.lifecycle='active' and lower(btrim(v.email))=row.email)
    and coalesce((row.snapshot->>'sharedContact')::boolean,false)=false then valid:=false; end if;$new$);
  if definition=original then raise exception 'Communication claim shared-contact guard could not be installed.'; end if;
  execute definition;
end $$;

-- Assigning a volunteer is the ordinary operational save boundary. Publish a
-- new private draft in the same transaction only when its creator still has
-- calendar.edit; leave old drafts and unassigned planning items untouched.
create function public.publish_draft_on_assignment()
returns trigger language plpgsql security definer set search_path='' as $$
declare draft_creator uuid;
begin
  if new.lifecycle <> 'active' or auth.uid() is null then return new; end if;
  select item.created_by_project_contact_id into draft_creator
    from public.calendar_items item
    where item.id=new.calendar_item_id and item.workspace_id=new.workspace_id
      and item.lifecycle='active' and item.publication_state='draft';
  if draft_creator is null then return new; end if;
  if exists(select 1 from public.project_contacts c
    join public.workspace_contact_grants g on g.project_contact_id=c.id
    join public.workspaces w on w.id=g.workspace_id
    where c.id=draft_creator and c.auth_user_id=auth.uid() and c.status='active'
      and w.id=new.workspace_id and w.lifecycle='active'
      and g.status='active' and g.revoked_at is null and g.valid_from<=now()
      and (g.valid_until is null or g.valid_until>now())
      and g.capabilities @> array['calendar.edit','assignments.edit']::text[])
  then perform public.publish_calendar_item(new.calendar_item_id); end if;
  return new;
end $$;
alter function public.publish_draft_on_assignment() owner to postgres;
revoke all on function public.publish_draft_on_assignment() from public,anon,authenticated,service_role;
create trigger calendar_assignment_publish_draft
  after insert on public.calendar_assignments
  for each row execute function public.publish_draft_on_assignment();

commit;
