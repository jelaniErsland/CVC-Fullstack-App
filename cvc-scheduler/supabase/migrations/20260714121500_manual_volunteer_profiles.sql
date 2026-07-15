-- Iteration 12.15: manual volunteer profile provenance and narrow
-- authenticated create/update commands.
--
-- This migration does not add seed data and does not broaden direct table
-- write privileges. Questionnaire-derived profiles keep their source
-- submission provenance; manually entered profiles are represented as
-- first-class permanent profiles without fake questionnaire submissions.

alter table public.volunteer_profiles
  alter column source_submission_id drop not null;

alter table public.volunteer_profiles
  add column if not exists profile_source text not null default 'questionnaire',
  add column if not exists manual_created_by_project_contact_id uuid
    references public.project_contacts (id) on delete restrict,
  add column if not exists manual_created_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'volunteer_profiles_provenance_known'
      and conrelid = 'public.volunteer_profiles'::regclass
  ) then
    alter table public.volunteer_profiles
      add constraint volunteer_profiles_provenance_known check (
        (
          profile_source = 'questionnaire'
          and source_submission_id is not null
          and manual_created_by_project_contact_id is null
          and manual_created_at is null
        )
        or
        (
          profile_source = 'manual'
          and source_submission_id is null
          and manual_created_by_project_contact_id is not null
          and manual_created_at is not null
        )
      );
  end if;
end;
$$;

comment on column public.volunteer_profiles.profile_source is
  'Permanent provenance class. Questionnaire profiles keep source_submission_id; manual profiles are created by an authorized project contact without manufacturing questionnaire submissions.';
comment on column public.volunteer_profiles.manual_created_by_project_contact_id is
  'Project contact that created a manual profile through the authenticated volunteer edit command. Null for questionnaire-derived profiles.';
comment on column public.volunteer_profiles.manual_created_at is
  'Manual profile creation timestamp. Null for questionnaire-derived profiles.';
comment on column public.volunteer_profiles.source_submission_id is
  'Immutable questionnaire provenance when profile_source is questionnaire. Null for legitimate manual profiles.';

create or replace function public.create_manual_volunteer_profile(
  p_workspace_id uuid,
  p_full_name text,
  p_email text default null,
  p_phone text default null,
  p_congregation text default null,
  p_preferred_contact_method text default null,
  p_readiness_status text default 'ready',
  p_profile_notes text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_user_id uuid;
  actor_contact_id uuid;
  normalized_full_name text;
  normalized_email text;
  normalized_phone text;
  normalized_congregation text;
  normalized_contact_method text;
  normalized_readiness_status text;
  normalized_profile_notes text;
  created_profile_id uuid;
begin
  caller_user_id := auth.uid();

  if caller_user_id is null then
    raise exception 'Volunteer profile management is unavailable.' using errcode = '42501';
  end if;

  normalized_full_name := btrim(coalesce(p_full_name, ''));
  normalized_email := nullif(btrim(coalesce(p_email, '')), '');
  normalized_phone := nullif(btrim(coalesce(p_phone, '')), '');
  normalized_congregation := nullif(btrim(coalesce(p_congregation, '')), '');
  normalized_contact_method := nullif(btrim(coalesce(p_preferred_contact_method, '')), '');
  normalized_readiness_status := btrim(coalesce(p_readiness_status, 'ready'));
  normalized_profile_notes := btrim(coalesce(p_profile_notes, ''));

  if char_length(normalized_full_name) not between 1 and 160
    or (
      normalized_email is not null
      and (
        char_length(normalized_email) not between 3 and 254
        or normalized_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
      )
    )
    or (
      normalized_phone is not null
      and (
        char_length(normalized_phone) not between 7 and 40
        or normalized_phone !~ '^[0-9A-Za-z()+.\-\s]+$'
      )
    )
    or (normalized_email is null and normalized_phone is null)
    or (
      normalized_congregation is not null
      and char_length(normalized_congregation) not between 1 and 160
    )
    or (
      normalized_contact_method is not null
      and normalized_contact_method not in ('Text', 'Phone', 'Email')
    )
    or normalized_readiness_status not in ('ready', 'on_hold')
    or char_length(normalized_profile_notes) > 4000
  then
    raise exception 'Volunteer profile input is invalid.' using errcode = '22023';
  end if;

  select contact.id
  into actor_contact_id
  from public.workspace_contact_grants as grant_row
  join public.project_contacts as contact
    on contact.id = grant_row.project_contact_id
  join public.workspaces as workspace
    on workspace.id = grant_row.workspace_id
  where grant_row.workspace_id = p_workspace_id
    and workspace.lifecycle = 'active'
    and contact.auth_user_id = caller_user_id
    and contact.status = 'active'
    and grant_row.status = 'active'
    and grant_row.revoked_at is null
    and grant_row.valid_from <= now()
    and (grant_row.valid_until is null or grant_row.valid_until > now())
    and grant_row.capabilities @> array['volunteers.edit']::text[]
  order by contact.id
  limit 1;

  if actor_contact_id is null then
    raise exception 'Volunteer profile management is unavailable.' using errcode = '42501';
  end if;

  insert into public.volunteer_profiles (
    workspace_id,
    source_submission_id,
    profile_source,
    manual_created_by_project_contact_id,
    manual_created_at,
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
    p_workspace_id,
    null,
    'manual',
    actor_contact_id,
    now(),
    'active',
    normalized_readiness_status,
    normalized_full_name,
    normalized_email,
    normalized_phone,
    normalized_congregation,
    normalized_contact_method,
    '{}'::jsonb,
    '{}'::jsonb,
    normalized_profile_notes
  )
  returning id into created_profile_id;

  return created_profile_id;
end;
$$;

create or replace function public.update_volunteer_profile_manual_fields(
  p_profile_id uuid,
  p_full_name text,
  p_email text default null,
  p_phone text default null,
  p_congregation text default null,
  p_preferred_contact_method text default null,
  p_lifecycle text default 'active',
  p_readiness_status text default 'ready',
  p_profile_notes text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_user_id uuid;
  target_workspace_id uuid;
  normalized_full_name text;
  normalized_email text;
  normalized_phone text;
  normalized_congregation text;
  normalized_contact_method text;
  normalized_lifecycle text;
  normalized_readiness_status text;
  normalized_profile_notes text;
begin
  caller_user_id := auth.uid();

  if caller_user_id is null then
    raise exception 'Volunteer profile management is unavailable.' using errcode = '42501';
  end if;

  select profile.workspace_id
  into target_workspace_id
  from public.volunteer_profiles as profile
  where profile.id = p_profile_id;

  if target_workspace_id is null then
    raise exception 'Volunteer profile management is unavailable.' using errcode = '42501';
  end if;

  normalized_full_name := btrim(coalesce(p_full_name, ''));
  normalized_email := nullif(btrim(coalesce(p_email, '')), '');
  normalized_phone := nullif(btrim(coalesce(p_phone, '')), '');
  normalized_congregation := nullif(btrim(coalesce(p_congregation, '')), '');
  normalized_contact_method := nullif(btrim(coalesce(p_preferred_contact_method, '')), '');
  normalized_lifecycle := btrim(coalesce(p_lifecycle, 'active'));
  normalized_readiness_status := btrim(coalesce(p_readiness_status, 'ready'));
  normalized_profile_notes := btrim(coalesce(p_profile_notes, ''));

  if char_length(normalized_full_name) not between 1 and 160
    or (
      normalized_email is not null
      and (
        char_length(normalized_email) not between 3 and 254
        or normalized_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
      )
    )
    or (
      normalized_phone is not null
      and (
        char_length(normalized_phone) not between 7 and 40
        or normalized_phone !~ '^[0-9A-Za-z()+.\-\s]+$'
      )
    )
    or (normalized_email is null and normalized_phone is null)
    or (
      normalized_congregation is not null
      and char_length(normalized_congregation) not between 1 and 160
    )
    or (
      normalized_contact_method is not null
      and normalized_contact_method not in ('Text', 'Phone', 'Email')
    )
    or normalized_lifecycle not in ('active', 'inactive', 'archived')
    or normalized_readiness_status not in ('ready', 'on_hold')
    or char_length(normalized_profile_notes) > 4000
  then
    raise exception 'Volunteer profile input is invalid.' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.workspace_contact_grants as grant_row
    join public.project_contacts as contact
      on contact.id = grant_row.project_contact_id
    join public.workspaces as workspace
      on workspace.id = grant_row.workspace_id
    where grant_row.workspace_id = target_workspace_id
      and workspace.lifecycle = 'active'
      and contact.auth_user_id = caller_user_id
      and contact.status = 'active'
      and grant_row.status = 'active'
      and grant_row.revoked_at is null
      and grant_row.valid_from <= now()
      and (grant_row.valid_until is null or grant_row.valid_until > now())
      and grant_row.capabilities @> array['volunteers.edit']::text[]
  ) then
    raise exception 'Volunteer profile management is unavailable.' using errcode = '42501';
  end if;

  update public.volunteer_profiles
  set lifecycle = normalized_lifecycle,
      readiness_status = normalized_readiness_status,
      full_name = normalized_full_name,
      email = normalized_email,
      phone = normalized_phone,
      congregation = normalized_congregation,
      preferred_contact_method = normalized_contact_method,
      profile_notes = normalized_profile_notes
  where id = p_profile_id
    and workspace_id = target_workspace_id;

  if not found then
    raise exception 'Volunteer profile management is unavailable.' using errcode = '42501';
  end if;

  return p_profile_id;
end;
$$;

revoke all on function public.create_manual_volunteer_profile(
  uuid, text, text, text, text, text, text, text
) from public;
grant execute on function public.create_manual_volunteer_profile(
  uuid, text, text, text, text, text, text, text
) to authenticated;

revoke all on function public.update_volunteer_profile_manual_fields(
  uuid, text, text, text, text, text, text, text, text
) from public;
grant execute on function public.update_volunteer_profile_manual_fields(
  uuid, text, text, text, text, text, text, text, text
) to authenticated;
