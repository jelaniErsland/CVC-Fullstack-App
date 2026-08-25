-- Iteration 12.43B.1: volunteer-facing Follow-up Contact self-edit boundary.
-- The authenticated caller may update only their own three volunteer-facing
-- contact fields through an effective workspace.read grant. Direct table
-- UPDATE remains denied.

create function public.update_current_project_contact_volunteer_facing_details(
  p_workspace_id uuid,
  p_display_name text,
  p_email text,
  p_phone text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_user_id uuid;
  caller_project_contact_id uuid;
  normalized_display_name text;
  normalized_email text;
  normalized_phone text;
begin
  caller_user_id := auth.uid();
  normalized_display_name := nullif(btrim(p_display_name), '');
  normalized_email := lower(nullif(btrim(p_email), ''));
  normalized_phone := nullif(btrim(p_phone), '');

  if caller_user_id is null
    or p_workspace_id is null
    or normalized_display_name is null
    or char_length(normalized_display_name) not between 1 and 160
    or normalized_display_name ~ '[<>]'
    or normalized_display_name ~ '[[:cntrl:]]'
    or normalized_email is null
    or char_length(normalized_email) not between 3 and 254
    or normalized_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    or normalized_email ~ '[<>]'
    or normalized_email ~ '[[:cntrl:]]'
    or (
      normalized_phone is not null
      and (
        char_length(normalized_phone) not between 7 and 40
        or normalized_phone ~ '[<>]'
        or normalized_phone ~ '[[:cntrl:]]'
      )
    )
  then
    raise exception 'Follow-up Contact details are invalid.' using errcode = '22023';
  end if;

  select contact.id
  into caller_project_contact_id
  from public.project_contacts as contact
  join public.workspace_contact_grants as grant_row
    on grant_row.project_contact_id = contact.id
  join public.workspaces as workspace
    on workspace.id = grant_row.workspace_id
  where contact.auth_user_id = caller_user_id
    and contact.status = 'active'
    and workspace.id = p_workspace_id
    and workspace.lifecycle = 'active'
    and grant_row.status = 'active'
    and grant_row.revoked_at is null
    and grant_row.valid_from <= now()
    and (grant_row.valid_until is null or grant_row.valid_until > now())
    and grant_row.capabilities @> array['workspace.read']::text[];

  if caller_project_contact_id is null then
    raise exception 'Follow-up Contact details are unavailable.' using errcode = '42501';
  end if;

  update public.project_contacts as contact
  set volunteer_facing_display_name = normalized_display_name,
      volunteer_facing_email = normalized_email,
      volunteer_facing_phone = normalized_phone
  where contact.id = caller_project_contact_id
    and contact.auth_user_id = caller_user_id
    and contact.status = 'active';

  if not found then
    raise exception 'Follow-up Contact details are unavailable.' using errcode = '42501';
  end if;

  return true;
end;
$$;

revoke all on function public.update_current_project_contact_volunteer_facing_details(
  uuid,
  text,
  text,
  text
) from public;
grant execute on function public.update_current_project_contact_volunteer_facing_details(
  uuid,
  text,
  text,
  text
) to authenticated;
