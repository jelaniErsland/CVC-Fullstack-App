-- 12.44G: exact-contact public lookup. Local review only; no production apply.
-- A single serialized, persisted limiter covers direct RPC calls as well as the app.
create table public.volunteer_lookup_attempts (
  bucket text primary key,
  window_started_at timestamptz not null default now(),
  attempts integer not null default 0 check (attempts >= 0),
  secret bytea
);
alter table public.volunteer_lookup_attempts enable row level security;
revoke all on public.volunteer_lookup_attempts from public, anon, authenticated;
insert into public.volunteer_lookup_attempts (bucket, secret)
values ('global', extensions.gen_random_bytes(32));

create function public.verify_volunteer_schedule_lookup(
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
  normalized_name text;
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
  -- Never raise on a verification failure: doing so would roll back the limiter.
  select * into limiter from public.volunteer_lookup_attempts
    where bucket = 'global' for update;
  if not found or limiter.secret is null then return '{"status":"unverified"}'::jsonb; end if;
  if limiter.window_started_at <= now() - interval '15 minutes' then
    update public.volunteer_lookup_attempts set attempts = 0, window_started_at = now()
      where bucket = 'global';
    limiter.attempts := 0;
  end if;
  if limiter.attempts >= 200 then return '{"status":"unverified"}'::jsonb; end if;
  update public.volunteer_lookup_attempts set attempts = attempts + 1 where bucket = 'global';
  delete from public.volunteer_lookup_attempts
    where bucket <> 'global' and window_started_at <= now() - interval '15 minutes';

  if p_full_name is null or p_contact is null
    or octet_length(p_full_name) > 640 or octet_length(p_contact) > 1024
  then return '{"status":"unverified"}'::jsonb; end if;
  normalized_name := lower(btrim(regexp_replace(p_full_name, '[[:space:]]+', ' ', 'g')));
  normalized_contact := lower(btrim(p_contact));
  if char_length(normalized_name) not between 1 and 160
    or char_length(normalized_contact) not between 3 and 254
  then return '{"status":"unverified"}'::jsonb; end if;

  -- Keyed hashes prevent routine retention of names or dictionary-readable hashes.
  name_bucket := encode(extensions.hmac(convert_to(normalized_name, 'UTF8'), limiter.secret, 'sha256'), 'hex');
  insert into public.volunteer_lookup_attempts (bucket, attempts) values (name_bucket, 1)
    on conflict (bucket) do update set attempts = least(public.volunteer_lookup_attempts.attempts + 1, 7)
    returning attempts into name_attempts;
  if name_attempts > 6 then return '{"status":"unverified"}'::jsonb; end if;

  contact_is_email := position('@' in normalized_contact) > 0;
  if not contact_is_email then
    -- Only formatting characters may be removed. No suffix/country-code guessing.
    if normalized_contact !~ '^\+?[0-9() .-]+$' then return '{"status":"unverified"}'::jsonb; end if;
    normalized_contact := regexp_replace(normalized_contact, '[^0-9]', '', 'g');
    if char_length(normalized_contact) not between 7 and 15 then return '{"status":"unverified"}'::jsonb; end if;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('workspace_id', w.id, 'name', w.display_name,
    'volunteer_id', v.id) order by w.display_name, w.id), '[]'::jsonb)
  into matches
  from public.volunteer_profiles v join public.workspaces w on w.id = v.workspace_id
  where v.lifecycle = 'active' and v.readiness_status = 'ready' and w.lifecycle = 'active'
    and lower(btrim(regexp_replace(v.full_name, '[[:space:]]+', ' ', 'g'))) = normalized_name
    and ((contact_is_email and lower(btrim(v.email)) = normalized_contact)
      or (not contact_is_email and btrim(v.phone) ~ '^\+?[0-9() .-]+$'
        and regexp_replace(v.phone, '[^0-9]', '', 'g') = normalized_contact));

  -- Duplicate verified profiles in a workspace are ambiguous; never pick a person.
  if jsonb_array_length(matches) = 0 or jsonb_array_length(matches) > 20
    or exists (select 1 from jsonb_array_elements(matches) m
      group by m->>'workspace_id' having count(*) > 1)
  then return '{"status":"unverified"}'::jsonb; end if;

  if p_project_choice is null and jsonb_array_length(matches) > 1 then
    return jsonb_build_object('status', 'choose_project', 'projects',
      (select jsonb_agg(jsonb_build_object(
        'choice', encode(extensions.hmac(
          convert_to('choice:' || (m->>'workspace_id') || ':' || normalized_name || ':' || normalized_contact, 'UTF8'),
          limiter.secret,
          'sha256'
        ), 'hex'),
        'name', m->>'name'
      )) from jsonb_array_elements(matches) m));
  end if;
  select m into selected_match from jsonb_array_elements(matches) m
    where p_project_choice is null or encode(extensions.hmac(
      convert_to('choice:' || (m->>'workspace_id') || ':' || normalized_name || ':' || normalized_contact, 'UTF8'),
      limiter.secret,
      'sha256'
    ), 'hex') = p_project_choice;
  if selected_match is null then return '{"status":"unverified"}'::jsonb; end if;

  bearer := rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');
  expires := now() + interval '24 hours';
  insert into public.volunteer_schedule_access_tokens
    (workspace_id, volunteer_profile_id, token_verifier_hash, expires_at)
    values ((selected_match->>'workspace_id')::uuid, (selected_match->>'volunteer_id')::uuid,
      extensions.digest(bearer, 'sha256'), expires);
  return jsonb_build_object('status', 'verified', 'bearer_token', bearer, 'expires_at', expires);
end;
$$;

-- Supabase's default function ACLs must never decide this boundary's permissions.
revoke all on function public.verify_volunteer_schedule_lookup(text, text, text) from public, anon, authenticated;
grant execute on function public.verify_volunteer_schedule_lookup(text, text, text) to anon, authenticated;
comment on function public.verify_volunteer_schedule_lookup(text, text, text) is
  'Public exact name/contact verification only. Six attempts/name and 200 total per 15 minutes; generic failures; no directory or schedule data. Project selection re-verifies contact.';
