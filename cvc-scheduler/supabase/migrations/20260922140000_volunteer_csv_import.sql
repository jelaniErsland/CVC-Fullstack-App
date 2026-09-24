begin;
create table public.volunteer_csv_import_operations (
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  request_id uuid not null,
  actor_id uuid not null references public.project_contacts(id) on delete restrict,
  payload_hash text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key(workspace_id,request_id)
);
alter table public.volunteer_csv_import_operations enable row level security;
alter table public.volunteer_csv_import_operations force row level security;
revoke all on public.volunteer_csv_import_operations from public,anon,authenticated;

-- Ordinary editors participate in the same optimistic concurrency contract as
-- reviewed CSV patches. Signature remains the existing (uuid,jsonb) boundary.
do $$ declare definition text; needle text; replacement text; begin
  select pg_get_functiondef('public.update_volunteer_profile_manual_fields(uuid,jsonb)'::regprocedure) into definition;
  needle:='select workspace_id into target_workspace_id from public.volunteer_profiles where id=p_profile_id;';
  replacement:='select workspace_id into target_workspace_id from public.volunteer_profiles where id=p_profile_id;';
  if position(needle in definition)=0 then raise exception 'Expected volunteer update definition not found.'; end if;
  definition:=replace(definition,needle,replacement);
  needle:='update public.volunteer_profiles set lifecycle=';
  replacement:='
  perform 1 from public.workspaces where id=target_workspace_id for update;
  perform 1 from public.volunteer_profiles where id=p_profile_id for update;
  if p_profile->>''expectedUpdatedAt'' is null or not exists(select 1 from public.volunteer_profiles where id=p_profile_id and updated_at=(p_profile->>''expectedUpdatedAt'')::timestamptz) then
    raise exception ''This profile changed. Review the latest version.'' using errcode=''40001'';
  end if;
  update public.volunteer_profiles set lifecycle=';
  if position(needle in definition)=0 then raise exception 'Expected volunteer update definition not found.'; end if;
  execute replace(definition,needle,replacement);
end $$;

-- Serialize imported identities with ordinary create/conversion and edits.
-- Keep existing capabilities, provenance and questionnaire conversion behavior.
do $$ declare definition text; signature text; needle text; workspace_expression text; begin
  foreach signature in array array['public.create_manual_volunteer_profile(uuid,jsonb)',
    'public.convert_questionnaire_submission_to_volunteer_profile(uuid)'] loop
    select pg_get_functiondef(signature::regprocedure) into definition;
    needle:='insert into public.volunteer_profiles(';
    workspace_expression:=case when signature like '%create_manual%' then 'p_workspace_id' else 'source_submission.workspace_id' end;
    if position(needle in definition)=0 then raise exception 'Expected volunteer creation definition not found.'; end if;
    execute replace(definition,needle,'perform 1 from public.workspaces where id='||workspace_expression||' for update; '||needle);
  end loop;
end $$;

create function public.import_volunteer_profiles(p_workspace_id uuid,p_request_id uuid,p_rows jsonb) returns jsonb
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
    if exists(select 1 from public.volunteer_profiles v where v.workspace_id=p_workspace_id
      and (profile_id is null or v.id<>profile_id)
      and ((candidate_email is not null and lower(btrim(v.email))=candidate_email)
        or (candidate_phone is not null and regexp_replace(coalesce(v.phone,''),'[^0-9]','','g')=candidate_phone)
        or (profile_id is null and lower(btrim(v.full_name))=lower(btrim(merged->>'fullName'))))) then
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
commit;
