-- 12.46C: preserve the reviewed lookup boundary while collecting only a last name,
-- and retain each authorized contact's independent Needs Attention review state.

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

create table public.needs_attention_seen_states (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_contact_id uuid not null references public.project_contacts(id) on delete cascade,
  signal_id text not null check (char_length(signal_id) between 1 and 160),
  seen_at timestamptz not null default now(),
  primary key (workspace_id, project_contact_id, signal_id)
);
alter table public.needs_attention_seen_states enable row level security;
revoke all on public.needs_attention_seen_states from public, anon, authenticated;

create policy needs_attention_seen_states_select_own
on public.needs_attention_seen_states
for select
to authenticated
using (
  exists (
    select 1
    from public.project_contacts contact
    join public.workspace_contact_grants grant_row
      on grant_row.project_contact_id = contact.id
    join public.workspaces workspace
      on workspace.id = grant_row.workspace_id
    where contact.id = needs_attention_seen_states.project_contact_id
      and contact.auth_user_id = auth.uid()
      and contact.status = 'active'
      and workspace.id = needs_attention_seen_states.workspace_id
      and workspace.lifecycle = 'active'
      and grant_row.status = 'active'
      and grant_row.revoked_at is null
      and grant_row.valid_from <= now()
      and (grant_row.valid_until is null or grant_row.valid_until > now())
      and grant_row.capabilities @> array['workspace.read','calendar.view','assignments.view']::text[]
  )
);
grant select on public.needs_attention_seen_states to authenticated;

create function public.mark_needs_attention_signal_seen(p_workspace_id uuid, p_signal_id text)
returns void language plpgsql security definer set search_path = '' as $$
declare actor_contact_id uuid;
begin
  if p_workspace_id is null or p_signal_id is null or char_length(p_signal_id) not between 1 and 160 then raise exception 'Needs Attention review is unavailable.' using errcode = '22023'; end if;
  select contact.id into actor_contact_id from public.project_contacts contact join public.workspace_contact_grants grant_row on grant_row.project_contact_id = contact.id join public.workspaces workspace on workspace.id = grant_row.workspace_id where contact.auth_user_id = auth.uid() and contact.status = 'active' and workspace.id = p_workspace_id and workspace.lifecycle = 'active' and grant_row.status = 'active' and grant_row.revoked_at is null and grant_row.valid_from <= now() and (grant_row.valid_until is null or grant_row.valid_until > now()) and grant_row.capabilities @> array['workspace.read','calendar.view','assignments.view']::text[] limit 1;
  if actor_contact_id is null then raise exception 'Needs Attention review is unavailable.' using errcode = '42501'; end if;
  insert into public.needs_attention_seen_states(workspace_id, project_contact_id, signal_id) values (p_workspace_id, actor_contact_id, p_signal_id) on conflict (workspace_id, project_contact_id, signal_id) do update set seen_at = excluded.seen_at;
end;
$$;
revoke all on function public.mark_needs_attention_signal_seen(uuid, text) from public, anon, authenticated;
grant execute on function public.mark_needs_attention_signal_seen(uuid, text) to authenticated;
comment on function public.mark_needs_attention_signal_seen(uuid, text) is 'Records a single authorized contact review without resolving the derived operational issue.';
