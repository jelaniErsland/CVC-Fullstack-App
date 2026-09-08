-- 12.46B: explicit operational volunteer profile fields. Historical questionnaire
-- JSON remains immutable; missing legacy answers deliberately map to unknown.

alter table public.volunteer_profiles
  add column date_of_birth date,
  add column emergency_contact_name text,
  add column emergency_contact_phone text,
  add column emergency_contact_relationship text,
  add column housing_option text not null default 'unknown',
  add column after_hours_security_availability text not null default 'unknown',
  add column builder_assistant_communication text not null default 'unknown',
  add column available_work_days text[] not null default '{}'::text[],
  add column available_two_plus_days text not null default 'unknown',
  add column skills_experience text,
  add column other_support text;

alter table public.volunteer_profiles
  add constraint volunteer_profiles_housing_option_known check (housing_option in ('yes','no','unknown')),
  add constraint volunteer_profiles_after_hours_security_known check (after_hours_security_availability in ('yes','no','unknown')),
  add constraint volunteer_profiles_builder_assistant_known check (builder_assistant_communication in ('yes','no','unknown')),
  add constraint volunteer_profiles_two_plus_days_known check (available_two_plus_days in ('yes','no','unknown')),
  add constraint volunteer_profiles_available_work_days_known check (available_work_days <@ array['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']::text[]),
  add constraint volunteer_profiles_private_text_bounded check (
    (emergency_contact_name is null or char_length(emergency_contact_name) <= 160)
    and (emergency_contact_relationship is null or char_length(emergency_contact_relationship) <= 160)
    and (emergency_contact_phone is null or char_length(emergency_contact_phone) between 7 and 40)
    and (skills_experience is null or char_length(skills_experience) <= 4000)
    and (other_support is null or char_length(other_support) <= 4000)
  );

drop function public.create_manual_volunteer_profile(uuid,text,text,text,text,text,text,text);
drop function public.update_volunteer_profile_manual_fields(uuid,text,text,text,text,text,text,text,text);

create function public.create_manual_volunteer_profile(p_workspace_id uuid, p_profile jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare caller_user_id uuid; actor_contact_id uuid; created_profile_id uuid; p public.volunteer_profiles%rowtype;
begin
  caller_user_id := auth.uid();
  if caller_user_id is null or jsonb_typeof(p_profile) <> 'object' then raise exception 'Volunteer profile management is unavailable.' using errcode='42501'; end if;
  select contact.id into actor_contact_id from public.workspace_contact_grants grant_row join public.project_contacts contact on contact.id=grant_row.project_contact_id join public.workspaces workspace on workspace.id=grant_row.workspace_id where grant_row.workspace_id=p_workspace_id and workspace.lifecycle='active' and contact.auth_user_id=caller_user_id and contact.status='active' and grant_row.status='active' and grant_row.revoked_at is null and grant_row.valid_from<=now() and (grant_row.valid_until is null or grant_row.valid_until>now()) and grant_row.capabilities @> array['volunteers.edit']::text[] limit 1;
  if actor_contact_id is null then raise exception 'Volunteer profile management is unavailable.' using errcode='42501'; end if;
  insert into public.volunteer_profiles(workspace_id,source_submission_id,profile_source,manual_created_by_project_contact_id,manual_created_at,lifecycle,readiness_status,full_name,email,phone,congregation,preferred_contact_method,availability_snapshot,skills_help_snapshot,profile_notes,date_of_birth,emergency_contact_name,emergency_contact_phone,emergency_contact_relationship,housing_option,after_hours_security_availability,builder_assistant_communication,available_work_days,available_two_plus_days,skills_experience,other_support)
  values (p_workspace_id,null,'manual',actor_contact_id,now(),coalesce(nullif(btrim(p_profile->>'lifecycle'),''),'active'),coalesce(nullif(btrim(p_profile->>'readinessStatus'),''),'ready'),btrim(coalesce(p_profile->>'fullName','')),nullif(btrim(p_profile->>'email'),''),nullif(btrim(p_profile->>'phone'),''),nullif(btrim(p_profile->>'congregation'),''),nullif(btrim(p_profile->>'preferredContactMethod'),''),'{}','{}',btrim(coalesce(p_profile->>'profileNotes','')),nullif(p_profile->>'dateOfBirth','')::date,nullif(btrim(p_profile->>'emergencyContactName'),''),nullif(btrim(p_profile->>'emergencyContactPhone'),''),nullif(btrim(p_profile->>'emergencyContactRelationship'),''),coalesce(nullif(p_profile->>'housingOption',''),'unknown'),coalesce(nullif(p_profile->>'afterHoursSecurityAvailability',''),'unknown'),coalesce(nullif(p_profile->>'builderAssistantCommunication',''),'unknown'),array(select jsonb_array_elements_text(coalesce(p_profile->'availableWorkDays','[]'::jsonb))),coalesce(nullif(p_profile->>'availableTwoPlusDays',''),'unknown'),nullif(btrim(p_profile->>'skillsExperience'),''),nullif(btrim(p_profile->>'otherSupport'),'')) returning id into created_profile_id;
  return created_profile_id;
exception when check_violation or invalid_text_representation then raise exception 'Volunteer profile input is invalid.' using errcode='22023'; end;
$$;

create function public.update_volunteer_profile_manual_fields(p_profile_id uuid, p_profile jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare caller_user_id uuid; target_workspace_id uuid;
begin
  caller_user_id := auth.uid();
  if caller_user_id is null or jsonb_typeof(p_profile) <> 'object' then raise exception 'Volunteer profile management is unavailable.' using errcode='42501'; end if;
  select workspace_id into target_workspace_id from public.volunteer_profiles where id=p_profile_id;
  if target_workspace_id is null or not exists (select 1 from public.workspace_contact_grants grant_row join public.project_contacts contact on contact.id=grant_row.project_contact_id join public.workspaces workspace on workspace.id=grant_row.workspace_id where grant_row.workspace_id=target_workspace_id and workspace.lifecycle='active' and contact.auth_user_id=caller_user_id and contact.status='active' and grant_row.status='active' and grant_row.revoked_at is null and grant_row.valid_from<=now() and (grant_row.valid_until is null or grant_row.valid_until>now()) and grant_row.capabilities @> array['volunteers.edit']::text[]) then raise exception 'Volunteer profile management is unavailable.' using errcode='42501'; end if;
  update public.volunteer_profiles set lifecycle=coalesce(nullif(btrim(p_profile->>'lifecycle'),''),'active'),readiness_status=coalesce(nullif(btrim(p_profile->>'readinessStatus'),''),'ready'),full_name=btrim(coalesce(p_profile->>'fullName','')),email=nullif(btrim(p_profile->>'email'),''),phone=nullif(btrim(p_profile->>'phone'),''),congregation=nullif(btrim(p_profile->>'congregation'),''),preferred_contact_method=nullif(btrim(p_profile->>'preferredContactMethod'),''),profile_notes=btrim(coalesce(p_profile->>'profileNotes','')),date_of_birth=nullif(p_profile->>'dateOfBirth','')::date,emergency_contact_name=nullif(btrim(p_profile->>'emergencyContactName'),''),emergency_contact_phone=nullif(btrim(p_profile->>'emergencyContactPhone'),''),emergency_contact_relationship=nullif(btrim(p_profile->>'emergencyContactRelationship'),''),housing_option=coalesce(nullif(p_profile->>'housingOption',''),'unknown'),after_hours_security_availability=coalesce(nullif(p_profile->>'afterHoursSecurityAvailability',''),'unknown'),builder_assistant_communication=coalesce(nullif(p_profile->>'builderAssistantCommunication',''),'unknown'),available_work_days=array(select jsonb_array_elements_text(coalesce(p_profile->'availableWorkDays','[]'::jsonb))),available_two_plus_days=coalesce(nullif(p_profile->>'availableTwoPlusDays',''),'unknown'),skills_experience=nullif(btrim(p_profile->>'skillsExperience'),''),other_support=nullif(btrim(p_profile->>'otherSupport'),'') where id=p_profile_id and workspace_id=target_workspace_id;
  if not found then raise exception 'Volunteer profile management is unavailable.' using errcode='42501'; end if;
  return p_profile_id;
exception when check_violation or invalid_text_representation then raise exception 'Volunteer profile input is invalid.' using errcode='22023'; end;
$$;

create or replace function public.convert_questionnaire_submission_to_volunteer_profile(p_submission_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare caller_user_id uuid; source_submission public.questionnaire_submissions%rowtype; created_profile_id uuid; days text[];
begin
  caller_user_id := auth.uid(); if caller_user_id is null then raise exception 'Volunteer profile conversion is unavailable.' using errcode='42501'; end if;
  select submission.* into source_submission from public.questionnaire_submissions submission where submission.id=p_submission_id and submission.status='submitted' and submission.questionnaire_version=1 and exists (select 1 from public.workspace_contact_grants grant_row join public.project_contacts contact on contact.id=grant_row.project_contact_id where grant_row.workspace_id=submission.workspace_id and contact.auth_user_id=caller_user_id and contact.status='active' and grant_row.status='active' and grant_row.revoked_at is null and grant_row.valid_from<=now() and (grant_row.valid_until is null or grant_row.valid_until>now()) and grant_row.capabilities @> array['questionnaires.review','volunteers.edit']::text[]);
  if not found then raise exception 'Volunteer profile conversion is unavailable.' using errcode='42501'; end if;
  if exists(select 1 from public.volunteer_profiles where source_submission_id=source_submission.id) then raise exception 'Questionnaire submission already has a volunteer profile.' using errcode='23505'; end if;
  select coalesce(array_agg(day), '{}'::text[]) into days from (select distinct value #>> '{}' as day from jsonb_array_elements(coalesce(source_submission.answers#>'{availability,weekdays}','[]'::jsonb)) value where value #>> '{}' in ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday')) safe_days;
  insert into public.volunteer_profiles(workspace_id,source_submission_id,lifecycle,readiness_status,full_name,email,phone,congregation,preferred_contact_method,availability_snapshot,skills_help_snapshot,profile_notes,date_of_birth,emergency_contact_name,emergency_contact_phone,emergency_contact_relationship,housing_option,after_hours_security_availability,builder_assistant_communication,available_work_days,available_two_plus_days,skills_experience,other_support) values(source_submission.workspace_id,source_submission.id,'active','ready',btrim(source_submission.answers#>>'{aboutYou,name}'),nullif(btrim(source_submission.answers#>>'{aboutYou,email}'),''),nullif(btrim(source_submission.answers#>>'{aboutYou,phone}'),''),nullif(btrim(source_submission.answers#>>'{aboutYou,congregation}'),''),nullif(btrim(source_submission.answers#>>'{aboutYou,preferredContactMethod}'),''),coalesce(source_submission.answers->'availability','{}'),jsonb_build_object('skillsExperience',source_submission.answers->'skillsExperience','otherWaysToHelp',source_submission.answers->'otherWaysToHelp'),'',nullif(source_submission.answers#>>'{aboutYou,dateOfBirth}','')::date,nullif(btrim(source_submission.answers#>>'{emergencyContact,name}'),''),nullif(btrim(source_submission.answers#>>'{emergencyContact,phone}'),''),nullif(btrim(source_submission.answers#>>'{emergencyContact,relationship}'),''),case when source_submission.answers#>>'{otherWaysToHelp,housingOption}' in ('yes','no','unknown') then source_submission.answers#>>'{otherWaysToHelp,housingOption}' else 'unknown' end,case when source_submission.answers#>>'{availability,afterHoursSecurityAvailability}' in ('yes','no','unknown') then source_submission.answers#>>'{availability,afterHoursSecurityAvailability}' else 'unknown' end,case when source_submission.answers#>>'{aboutYou,builderAssistantCommunication}' in ('yes','no','unknown') then source_submission.answers#>>'{aboutYou,builderAssistantCommunication}' else 'unknown' end,days,case when source_submission.answers#>>'{availability,availableTwoPlusDays}' in ('yes','no','unknown') then source_submission.answers#>>'{availability,availableTwoPlusDays}' else 'unknown' end,nullif(btrim(concat_ws(E'\n',source_submission.answers#>>'{skillsExperience,details}',source_submission.answers#>>'{skillsExperience,physicalWorkNotes}')),''),nullif(btrim(concat_ws(E'\n',source_submission.answers#>>'{otherWaysToHelp,other}',source_submission.answers#>>'{otherWaysToHelp,notes}')),'')) returning id into created_profile_id;
  return created_profile_id;
exception when check_violation or invalid_text_representation then raise exception 'Volunteer profile conversion is unavailable.' using errcode='22023'; end;
$$;

revoke all on function public.create_manual_volunteer_profile(uuid,jsonb) from public, anon, authenticated;
revoke all on function public.update_volunteer_profile_manual_fields(uuid,jsonb) from public, anon, authenticated;
revoke all on function public.convert_questionnaire_submission_to_volunteer_profile(uuid) from public, anon, authenticated;
grant execute on function public.create_manual_volunteer_profile(uuid,jsonb) to authenticated;
grant execute on function public.update_volunteer_profile_manual_fields(uuid,jsonb) to authenticated;
grant execute on function public.convert_questionnaire_submission_to_volunteer_profile(uuid) to authenticated;
