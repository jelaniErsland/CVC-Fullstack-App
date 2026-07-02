-- Iteration 11.7: project-scoped volunteer profiles and explicit conversion only.
-- Assignment, scheduling, communication, token, and route cutovers remain out of scope.

alter table public.questionnaire_submissions
  add constraint questionnaire_submissions_workspace_id_id_unique
  unique (workspace_id, id);

create table public.volunteer_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  source_submission_id uuid not null,
  lifecycle text not null default 'active',
  readiness_status text not null default 'ready',
  full_name text not null,
  email text,
  phone text,
  congregation text,
  preferred_contact_method text,
  availability_snapshot jsonb not null,
  skills_help_snapshot jsonb not null,
  profile_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint volunteer_profiles_workspace_id_id_unique unique (workspace_id, id),
  constraint volunteer_profiles_source_submission_unique unique (source_submission_id),
  constraint volunteer_profiles_source_workspace_fk foreign key (
    workspace_id,
    source_submission_id
  ) references public.questionnaire_submissions (workspace_id, id) on delete restrict,
  constraint volunteer_profiles_lifecycle_known check (
    lifecycle in ('active', 'inactive', 'archived')
  ),
  constraint volunteer_profiles_readiness_known check (
    readiness_status in ('ready', 'on_hold')
  ),
  constraint volunteer_profiles_name_present check (
    full_name = btrim(full_name)
    and char_length(full_name) between 1 and 160
  ),
  constraint volunteer_profiles_email_bounded check (
    email is null or (email = btrim(email) and char_length(email) between 3 and 254)
  ),
  constraint volunteer_profiles_phone_bounded check (
    phone is null or (phone = btrim(phone) and char_length(phone) between 7 and 40)
  ),
  constraint volunteer_profiles_contact_present check (
    email is not null or phone is not null
  ),
  constraint volunteer_profiles_congregation_bounded check (
    congregation is null
    or (congregation = btrim(congregation) and char_length(congregation) between 1 and 160)
  ),
  constraint volunteer_profiles_contact_method_known check (
    preferred_contact_method is null
    or preferred_contact_method in ('Text', 'Phone', 'Email')
  ),
  constraint volunteer_profiles_availability_object check (
    jsonb_typeof(availability_snapshot) = 'object'
    and octet_length(availability_snapshot::text) <= 32768
  ),
  constraint volunteer_profiles_skills_help_object check (
    jsonb_typeof(skills_help_snapshot) = 'object'
    and octet_length(skills_help_snapshot::text) <= 32768
  ),
  constraint volunteer_profiles_notes_bounded check (
    char_length(profile_notes) <= 4000
  )
);

create index volunteer_profiles_workspace_name_idx
  on public.volunteer_profiles (workspace_id, full_name);

comment on table public.volunteer_profiles is
  'Approved project-scoped volunteer truth derived explicitly from, but separate from, immutable questionnaire submissions.';
comment on column public.volunteer_profiles.source_submission_id is
  'Immutable provenance. One questionnaire submission can create at most one profile in this slice.';
comment on column public.volunteer_profiles.availability_snapshot is
  'Schedule-readiness snapshot copied during explicit conversion; the source submission remains unchanged.';
comment on column public.volunteer_profiles.skills_help_snapshot is
  'Skills and other-help snapshot copied during explicit conversion; not the raw questionnaire row.';
comment on column public.volunteer_profiles.profile_notes is
  'Profile-owned notes. Conversion initializes this empty and no application update command exists in 11.7.';

create function public.set_volunteer_profile_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_volunteer_profile_updated_at
before update on public.volunteer_profiles
for each row
execute function public.set_volunteer_profile_updated_at();

alter table public.volunteer_profiles enable row level security;

revoke all on table public.volunteer_profiles from anon, authenticated;
grant select on table public.volunteer_profiles to authenticated;

create policy volunteer_profiles_select_with_view_capability
on public.volunteer_profiles
for select
to authenticated
using (
  exists (
    select 1
    from public.workspace_contact_grants as grant_row
    join public.project_contacts as contact
      on contact.id = grant_row.project_contact_id
    where grant_row.workspace_id = volunteer_profiles.workspace_id
      and contact.auth_user_id = (select auth.uid())
      and contact.status = 'active'
      and grant_row.status = 'active'
      and grant_row.revoked_at is null
      and grant_row.valid_from <= now()
      and (grant_row.valid_until is null or grant_row.valid_until > now())
      and grant_row.capabilities @> array['volunteers.view']::text[]
  )
);

-- The function accepts only provenance. Workspace and profile values are
-- derived from the immutable source submission inside one authorized command.
create function public.convert_questionnaire_submission_to_volunteer_profile(
  p_submission_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_user_id uuid;
  source_submission public.questionnaire_submissions%rowtype;
  created_profile_id uuid;
begin
  caller_user_id := auth.uid();

  if caller_user_id is null then
    raise exception 'Volunteer profile conversion is unavailable.' using errcode = '42501';
  end if;

  select submission.*
  into source_submission
  from public.questionnaire_submissions as submission
  where submission.id = p_submission_id
    and submission.status = 'submitted'
    and submission.questionnaire_version = 1
    and exists (
      select 1
      from public.workspace_contact_grants as grant_row
      join public.project_contacts as contact
        on contact.id = grant_row.project_contact_id
      where grant_row.workspace_id = submission.workspace_id
        and contact.auth_user_id = caller_user_id
        and contact.status = 'active'
        and grant_row.status = 'active'
        and grant_row.revoked_at is null
        and grant_row.valid_from <= now()
        and (grant_row.valid_until is null or grant_row.valid_until > now())
        and grant_row.capabilities @> array[
          'questionnaires.review',
          'volunteers.edit'
        ]::text[]
    );

  if not found then
    raise exception 'Volunteer profile conversion is unavailable.' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.volunteer_profiles as existing_profile
    where existing_profile.source_submission_id = source_submission.id
  ) then
    raise exception 'Questionnaire submission already has a volunteer profile.' using errcode = '23505';
  end if;

  insert into public.volunteer_profiles (
    workspace_id,
    source_submission_id,
    lifecycle,
    readiness_status,
    full_name,
    email,
    phone,
    congregation,
    preferred_contact_method,
    availability_snapshot,
    skills_help_snapshot,
    profile_notes
  )
  values (
    source_submission.workspace_id,
    source_submission.id,
    'active',
    'ready',
    btrim(source_submission.answers #>> '{aboutYou,name}'),
    nullif(btrim(source_submission.answers #>> '{aboutYou,email}'), ''),
    nullif(btrim(source_submission.answers #>> '{aboutYou,phone}'), ''),
    nullif(btrim(source_submission.answers #>> '{aboutYou,congregation}'), ''),
    nullif(btrim(source_submission.answers #>> '{aboutYou,preferredContactMethod}'), ''),
    source_submission.answers -> 'availability',
    jsonb_build_object(
      'skillsExperience', source_submission.answers -> 'skillsExperience',
      'otherWaysToHelp', source_submission.answers -> 'otherWaysToHelp'
    ),
    ''
  )
  returning id into created_profile_id;

  return created_profile_id;
end;
$$;

revoke all on function public.convert_questionnaire_submission_to_volunteer_profile(uuid)
  from public;
grant execute on function public.convert_questionnaire_submission_to_volunteer_profile(uuid)
  to authenticated;

