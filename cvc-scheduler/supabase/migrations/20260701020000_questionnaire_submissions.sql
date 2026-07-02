-- Iteration 11.6: immutable questionnaire intake plus grant-authorized review reads.
-- Volunteer profiles, review mutations, and every other product table are out of scope.

create table public.questionnaire_submissions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  status text not null default 'submitted',
  source text not null default 'public_web',
  questionnaire_version integer not null default 1,
  answers jsonb not null,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint questionnaire_submissions_status_known check (
    status in ('submitted', 'in_review', 'needs_follow_up', 'approved', 'rejected')
  ),
  constraint questionnaire_submissions_source_known check (
    source in ('public_web', 'paper_entry', 'admin_entry')
  ),
  constraint questionnaire_submissions_version_positive check (
    questionnaire_version between 1 and 1000
  ),
  constraint questionnaire_submissions_answers_object check (
    jsonb_typeof(answers) = 'object'
  ),
  constraint questionnaire_submissions_answers_sections check (
    answers ?& array[
      'aboutYou',
      'availability',
      'skillsExperience',
      'emergencyContact',
      'otherWaysToHelp'
    ]
  ),
  constraint questionnaire_submissions_answers_size check (
    octet_length(answers::text) <= 65536
  )
);

create index questionnaire_submissions_workspace_submitted_idx
  on public.questionnaire_submissions (workspace_id, submitted_at desc);

comment on table public.questionnaire_submissions is
  'Versioned original questionnaire intake snapshots; not volunteer profiles.';
comment on column public.questionnaire_submissions.answers is
  'Accepted submission truth preserved as a versioned JSON object. Review/profile data must remain separate.';
comment on column public.questionnaire_submissions.status is
  'Read-model lifecycle only in 11.6; no application review mutation is implemented.';

alter table public.questionnaire_submissions enable row level security;

revoke all on table public.questionnaire_submissions from anon, authenticated;
grant select on table public.questionnaire_submissions to authenticated;

create policy questionnaire_submissions_select_with_review_capability
on public.questionnaire_submissions
for select
to authenticated
using (
  exists (
    select 1
    from public.workspace_contact_grants as grant_row
    join public.project_contacts as contact
      on contact.id = grant_row.project_contact_id
    where grant_row.workspace_id = questionnaire_submissions.workspace_id
      and contact.auth_user_id = (select auth.uid())
      and contact.status = 'active'
      and grant_row.status = 'active'
      and grant_row.revoked_at is null
      and grant_row.valid_from <= now()
      and (grant_row.valid_until is null or grant_row.valid_until > now())
      and grant_row.capabilities @> array['questionnaires.review']::text[]
  )
);

-- This is the sole public creation surface. Anon receives no table privileges,
-- so status/source/timestamps cannot be selected or supplied through PostgREST.
create function public.submit_questionnaire_submission(
  p_workspace_key text,
  p_answers jsonb,
  p_questionnaire_version integer default 1
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid;
  submission_id uuid;
begin
  if p_questionnaire_version <> 1 then
    raise exception 'Questionnaire submission is invalid.' using errcode = '22023';
  end if;

  if jsonb_typeof(p_answers) is distinct from 'object'
    or octet_length(p_answers::text) > 65536
    or not p_answers ?& array[
      'aboutYou',
      'availability',
      'skillsExperience',
      'emergencyContact',
      'otherWaysToHelp'
    ]
    or jsonb_typeof(p_answers -> 'aboutYou') is distinct from 'object'
    or jsonb_typeof(p_answers -> 'availability') is distinct from 'object'
    or jsonb_typeof(p_answers -> 'skillsExperience') is distinct from 'object'
    or jsonb_typeof(p_answers -> 'emergencyContact') is distinct from 'object'
    or jsonb_typeof(p_answers -> 'otherWaysToHelp') is distinct from 'object'
    or jsonb_typeof(p_answers #> '{availability,weekdays}') is distinct from 'array'
    or jsonb_typeof(p_answers #> '{availability,preferredTimes}') is distinct from 'array'
    or jsonb_typeof(p_answers #> '{skillsExperience,categories}') is distinct from 'array'
    or jsonb_typeof(p_answers #> '{skillsExperience,maintenanceTaskCards}') is distinct from 'boolean'
    or coalesce(char_length(btrim(p_answers #>> '{aboutYou,name}')), 0) not between 1 and 160
    or coalesce(char_length(btrim(p_answers #>> '{aboutYou,congregation}')), 0) not between 1 and 160
    or coalesce(char_length(btrim(p_answers #>> '{aboutYou,phone}')), 0) not between 7 and 40
    or coalesce(char_length(btrim(p_answers #>> '{emergencyContact,name}')), 0) not between 1 and 160
    or coalesce(char_length(btrim(p_answers #>> '{emergencyContact,phone}')), 0) not between 7 and 40
  then
    raise exception 'Questionnaire submission is invalid.' using errcode = '22023';
  end if;

  select workspace.id
  into target_workspace_id
  from public.workspaces as workspace
  where workspace.workspace_key = p_workspace_key
    and workspace.lifecycle = 'active'
    and workspace.public_intake_enabled = true;

  if target_workspace_id is null then
    raise exception 'Questionnaire submission is unavailable.' using errcode = '22023';
  end if;

  insert into public.questionnaire_submissions (
    workspace_id,
    status,
    source,
    questionnaire_version,
    answers
  )
  values (
    target_workspace_id,
    'submitted',
    'public_web',
    p_questionnaire_version,
    p_answers
  )
  returning id into submission_id;

  return submission_id;
end;
$$;

revoke all on function public.submit_questionnaire_submission(text, jsonb, integer) from public;
grant execute on function public.submit_questionnaire_submission(text, jsonb, integer)
  to anon, authenticated;

