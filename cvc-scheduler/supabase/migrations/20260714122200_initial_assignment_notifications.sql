-- Iteration 12.22: initial assignment notification email boundary.
-- This adds a narrow delivery ledger and authenticated claim/finalize RPCs for
-- explicit admin-triggered initial assignment schedule emails. It does not add
-- automatic sending, publication side effects, volunteer lookup, response-link
-- reveal/copy activation, broad Communications persistence, or service-role
-- application behavior.

alter table public.project_contacts
  add column volunteer_facing_display_name text,
  add column volunteer_facing_email text,
  add column volunteer_facing_phone text;

alter table public.project_contacts
  add constraint project_contacts_volunteer_facing_display_name_bounded check (
    volunteer_facing_display_name is null
    or char_length(btrim(volunteer_facing_display_name)) between 1 and 160
  ),
  add constraint project_contacts_volunteer_facing_email_bounded check (
    volunteer_facing_email is null
    or (
      char_length(btrim(volunteer_facing_email)) between 3 and 254
      and btrim(volunteer_facing_email) ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    )
  ),
  add constraint project_contacts_volunteer_facing_phone_bounded check (
    volunteer_facing_phone is null
    or char_length(btrim(volunteer_facing_phone)) between 7 and 40
  );

comment on column public.project_contacts.volunteer_facing_display_name is
  'Optional project-contact name safe to show to assigned volunteers as a Follow-up Contact. Not Auth metadata and not browser-authoritative.';
comment on column public.project_contacts.volunteer_facing_email is
  'Optional project-contact email safe to show to assigned volunteers as a Follow-up Contact. Required by the 12.22 email boundary for newly sent initial assignment notifications.';
comment on column public.project_contacts.volunteer_facing_phone is
  'Optional project-contact phone safe to show to assigned volunteers as a Follow-up Contact.';

create table public.assignment_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  calendar_item_id uuid not null,
  calendar_assignment_id uuid not null,
  volunteer_profile_id uuid not null,
  notification_kind text not null default 'initial_assignment',
  template_version text not null default 'initial-assignment.v1',
  delivery_state text not null,
  attempt_count integer not null default 1,
  recipient_email_snapshot text,
  provider_message_id text,
  safe_failure_code text,
  idempotency_key text not null,
  initiated_by_project_contact_id uuid references public.project_contacts (id) on delete set null,
  sending_started_at timestamptz,
  sending_expires_at timestamptz,
  sent_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint assignment_notification_deliveries_assignment_fk foreign key (
    workspace_id,
    calendar_assignment_id
  ) references public.calendar_assignments (
    workspace_id,
    id
  ) on delete restrict,
  constraint assignment_notification_deliveries_item_fk foreign key (
    workspace_id,
    calendar_item_id
  ) references public.calendar_items (
    workspace_id,
    id
  ) on delete restrict,
  constraint assignment_notification_deliveries_volunteer_fk foreign key (
    workspace_id,
    volunteer_profile_id
  ) references public.volunteer_profiles (
    workspace_id,
    id
  ) on delete restrict,
  constraint assignment_notification_deliveries_kind_known check (
    notification_kind = 'initial_assignment'
  ),
  constraint assignment_notification_deliveries_template_known check (
    template_version = 'initial-assignment.v1'
  ),
  constraint assignment_notification_deliveries_state_known check (
    delivery_state in ('sending', 'sent', 'failed')
  ),
  constraint assignment_notification_deliveries_attempt_count_bounded check (
    attempt_count between 1 and 25
  ),
  constraint assignment_notification_deliveries_recipient_email_bounded check (
    recipient_email_snapshot is null
    or (
      char_length(recipient_email_snapshot) between 3 and 254
      and recipient_email_snapshot = lower(btrim(recipient_email_snapshot))
      and recipient_email_snapshot ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    )
  ),
  constraint assignment_notification_deliveries_provider_message_bounded check (
    provider_message_id is null or char_length(provider_message_id) between 1 and 200
  ),
  constraint assignment_notification_deliveries_failure_code_known check (
    safe_failure_code is null
    or safe_failure_code in (
      'missing_recipient_email',
      'missing_follow_up_contact',
      'not_eligible',
      'provider_config_unavailable',
      'provider_send_failed',
      'schedule_access_issue_failed',
      'schedule_access_revoke_failed',
      'finalize_unavailable'
    )
  ),
  constraint assignment_notification_deliveries_idempotency_bounded check (
    char_length(idempotency_key) between 1 and 220
  ),
  constraint assignment_notification_deliveries_state_metadata_valid check (
    (
      delivery_state = 'sending'
      and sending_started_at is not null
      and sending_expires_at is not null
      and sent_at is null
      and failed_at is null
      and safe_failure_code is null
    )
    or (
      delivery_state = 'sent'
      and sent_at is not null
      and failed_at is null
      and safe_failure_code is null
      and recipient_email_snapshot is not null
    )
    or (
      delivery_state = 'failed'
      and failed_at is not null
      and safe_failure_code is not null
    )
  ),
  constraint assignment_notification_deliveries_assignment_kind_unique unique (
    calendar_assignment_id,
    notification_kind,
    template_version
  )
);

create index assignment_notification_deliveries_workspace_item_idx
  on public.assignment_notification_deliveries (workspace_id, calendar_item_id);
create index assignment_notification_deliveries_state_idx
  on public.assignment_notification_deliveries (delivery_state, sending_expires_at);

comment on table public.assignment_notification_deliveries is
  'Credential-free initial assignment email delivery ledger. One row per assignment/kind/template version prevents duplicate successful sends.';
comment on column public.assignment_notification_deliveries.recipient_email_snapshot is
  'Normalized destination snapshot needed for delivery audit. This table never stores bearer tokens or full schedule URLs.';
comment on column public.assignment_notification_deliveries.idempotency_key is
  'Deterministic provider idempotency key for the assignment/kind/template version; it is not a bearer token.';

create trigger set_assignment_notification_deliveries_updated_at
before update on public.assignment_notification_deliveries
for each row
execute function public.set_assignment_updated_at();

alter table public.assignment_notification_deliveries enable row level security;
alter table public.assignment_notification_deliveries force row level security;
revoke all on table public.assignment_notification_deliveries from anon, authenticated;

create function public.read_initial_assignment_notification_summaries(
  p_calendar_item_ids uuid[]
)
returns table (
  calendar_item_id uuid,
  active_assignment_count integer,
  eligible_to_send_count integer,
  already_sent_count integer,
  missing_email_count integer,
  missing_follow_up_contact_count integer,
  failed_retryable_count integer,
  sending_count integer,
  ineligible_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_user_id uuid;
begin
  caller_user_id := auth.uid();

  if caller_user_id is null
    or p_calendar_item_ids is null
    or coalesce(cardinality(p_calendar_item_ids), 0) > 100
    or exists (
      select 1
      from unnest(coalesce(p_calendar_item_ids, array[]::uuid[])) as requested(id)
      where requested.id is null
    )
  then
    raise exception 'Initial assignment notification summaries are unavailable.' using errcode = '42501';
  end if;

  return query
  with requested_items as (
    select distinct requested.id as calendar_item_id
    from unnest(p_calendar_item_ids) as requested(id)
  ),
  authorized_items as (
    select item.*, workspace.lifecycle as workspace_lifecycle
    from requested_items
    join public.calendar_items as item
      on item.id = requested_items.calendar_item_id
    join public.workspaces as workspace
      on workspace.id = item.workspace_id
    where exists (
      select 1
      from public.workspace_contact_grants as grant_row
      join public.project_contacts as contact
        on contact.id = grant_row.project_contact_id
      where grant_row.workspace_id = item.workspace_id
        and contact.auth_user_id = caller_user_id
        and contact.status = 'active'
        and workspace.lifecycle = 'active'
        and grant_row.status = 'active'
        and grant_row.revoked_at is null
        and grant_row.valid_from <= now()
        and (grant_row.valid_until is null or grant_row.valid_until > now())
        and grant_row.capabilities @> array['assignments.edit']::text[]
    )
  ),
  item_follow_up as (
    select
      item.id as calendar_item_id,
      (
        follow_contact.id is not null
        and follow_contact.volunteer_facing_display_name is not null
        and follow_contact.volunteer_facing_email is not null
        and exists (
          select 1
          from public.workspace_contact_grants as follow_grant
          where follow_grant.workspace_id = item.workspace_id
            and follow_grant.project_contact_id = follow_contact.id
            and follow_grant.status = 'active'
            and follow_grant.revoked_at is null
            and follow_grant.valid_from <= now()
            and (follow_grant.valid_until is null or follow_grant.valid_until > now())
        )
      ) as has_follow_up_contact,
      public.calendar_assignment_response_start_at(
        item.schedule_kind,
        item.start_date,
        item.start_time,
        item.timezone
      ) as assignment_start_at
    from authorized_items as item
    left join public.project_contacts as follow_contact
      on follow_contact.id = item.follow_up_project_contact_id
      and follow_contact.status = 'active'
  ),
  assignment_scope as (
    select
      item.id as calendar_item_id,
      assignment.id as assignment_id,
      volunteer.lifecycle as volunteer_lifecycle,
      volunteer.readiness_status,
      lower(nullif(btrim(volunteer.email), '')) as recipient_email,
      item.publication_state,
      item.lifecycle as item_lifecycle,
      follow_up.has_follow_up_contact,
      follow_up.assignment_start_at,
      delivery.delivery_state,
      delivery.safe_failure_code,
      delivery.sending_expires_at
    from authorized_items as item
    left join item_follow_up as follow_up
      on follow_up.calendar_item_id = item.id
    left join public.calendar_assignments as assignment
      on assignment.workspace_id = item.workspace_id
      and assignment.calendar_item_id = item.id
      and assignment.lifecycle = 'active'
    left join public.volunteer_profiles as volunteer
      on volunteer.workspace_id = assignment.workspace_id
      and volunteer.id = assignment.volunteer_profile_id
    left join public.assignment_notification_deliveries as delivery
      on delivery.workspace_id = assignment.workspace_id
      and delivery.calendar_assignment_id = assignment.id
      and delivery.notification_kind = 'initial_assignment'
      and delivery.template_version = 'initial-assignment.v1'
  )
  select
    scope.calendar_item_id,
    count(scope.assignment_id)::integer as active_assignment_count,
    count(*) filter (
      where scope.assignment_id is not null
        and scope.publication_state = 'published'
        and scope.item_lifecycle = 'active'
        and scope.assignment_start_at > now()
        and scope.volunteer_lifecycle = 'active'
        and scope.readiness_status = 'ready'
        and scope.recipient_email is not null
        and scope.has_follow_up_contact
        and scope.delivery_state is distinct from 'sent'
        and not coalesce(
          scope.delivery_state = 'sending'
          and scope.sending_expires_at > now(),
          false
        )
    )::integer as eligible_to_send_count,
    count(*) filter (where scope.delivery_state = 'sent')::integer as already_sent_count,
    count(*) filter (
      where scope.assignment_id is not null
        and scope.volunteer_lifecycle = 'active'
        and scope.readiness_status = 'ready'
        and scope.recipient_email is null
    )::integer as missing_email_count,
    count(*) filter (
      where scope.assignment_id is not null
        and scope.publication_state = 'published'
        and not scope.has_follow_up_contact
    )::integer as missing_follow_up_contact_count,
    count(*) filter (
      where scope.delivery_state = 'failed'
        and scope.safe_failure_code not in ('missing_recipient_email', 'missing_follow_up_contact', 'not_eligible')
    )::integer as failed_retryable_count,
    count(*) filter (
      where scope.delivery_state = 'sending'
        and scope.sending_expires_at > now()
    )::integer as sending_count,
    count(*) filter (
      where scope.assignment_id is not null
        and not (
          scope.publication_state = 'published'
          and scope.item_lifecycle = 'active'
          and scope.assignment_start_at > now()
          and scope.volunteer_lifecycle = 'active'
          and scope.readiness_status = 'ready'
        )
    )::integer as ineligible_count
  from assignment_scope as scope
  group by scope.calendar_item_id
  order by scope.calendar_item_id;
end;
$$;

create function public.claim_initial_assignment_notification_deliveries(
  p_calendar_item_id uuid
)
returns table (
  delivery_id uuid,
  calendar_assignment_id uuid,
  volunteer_profile_id uuid,
  recipient_email text,
  volunteer_display_name text,
  workspace_display_name text,
  workspace_timezone text,
  calendar_item_id uuid,
  task_title text,
  task_type text,
  schedule_kind text,
  start_date date,
  end_date date,
  start_time time without time zone,
  end_time time without time zone,
  needed_count integer,
  schedule_notes text,
  follow_up_contact_display_name text,
  follow_up_contact_email text,
  follow_up_contact_phone text,
  send_status text,
  attempt_count integer,
  idempotency_key text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_user_id uuid;
  caller_project_contact_id uuid;
  target_workspace_id uuid;
  item_start_at timestamptz;
  candidate record;
  existing_delivery public.assignment_notification_deliveries%rowtype;
  claimed_delivery public.assignment_notification_deliveries%rowtype;
  normalized_recipient_email text;
  candidate_status text;
  candidate_failure text;
begin
  caller_user_id := auth.uid();

  select item.workspace_id, contact.id,
    public.calendar_assignment_response_start_at(
      item.schedule_kind,
      item.start_date,
      item.start_time,
      item.timezone
    )
  into target_workspace_id, caller_project_contact_id, item_start_at
  from public.calendar_items as item
  join public.workspaces as workspace
    on workspace.id = item.workspace_id
  join public.workspace_contact_grants as grant_row
    on grant_row.workspace_id = item.workspace_id
  join public.project_contacts as contact
    on contact.id = grant_row.project_contact_id
  where item.id = p_calendar_item_id
    and item.lifecycle = 'active'
    and item.publication_state = 'published'
    and workspace.lifecycle = 'active'
    and contact.auth_user_id = caller_user_id
    and contact.status = 'active'
    and grant_row.status = 'active'
    and grant_row.revoked_at is null
    and grant_row.valid_from <= now()
    and (grant_row.valid_until is null or grant_row.valid_until > now())
    and grant_row.capabilities @> array['assignments.edit']::text[]
  limit 1;

  if caller_user_id is null
    or p_calendar_item_id is null
    or target_workspace_id is null
    or caller_project_contact_id is null
    or item_start_at is null
    or item_start_at <= now()
  then
    raise exception 'Initial assignment notification is unavailable.' using errcode = '42501';
  end if;

  for candidate in
    select
      assignment.id as assignment_id,
      assignment.volunteer_profile_id,
      volunteer.full_name as volunteer_display_name,
      lower(nullif(btrim(volunteer.email), '')) as normalized_email,
      volunteer.lifecycle as volunteer_lifecycle,
      volunteer.readiness_status,
      workspace.display_name as workspace_display_name,
      workspace.timezone as workspace_timezone,
      item.id as item_id,
      item.title_snapshot,
      item.task_type_snapshot,
      item.schedule_kind,
      item.start_date,
      item.end_date,
      item.start_time,
      item.end_time,
      item.needed_count,
      item.schedule_notes,
      follow_contact.volunteer_facing_display_name as follow_up_display_name,
      lower(nullif(btrim(follow_contact.volunteer_facing_email), '')) as follow_up_email,
      follow_contact.volunteer_facing_phone as follow_up_phone,
      (
        follow_contact.id is not null
        and follow_contact.volunteer_facing_display_name is not null
        and follow_contact.volunteer_facing_email is not null
        and exists (
          select 1
          from public.workspace_contact_grants as follow_grant
          where follow_grant.workspace_id = item.workspace_id
            and follow_grant.project_contact_id = follow_contact.id
            and follow_grant.status = 'active'
            and follow_grant.revoked_at is null
            and follow_grant.valid_from <= now()
            and (follow_grant.valid_until is null or follow_grant.valid_until > now())
        )
      ) as has_follow_up_contact
    from public.calendar_assignments as assignment
    join public.calendar_items as item
      on item.id = assignment.calendar_item_id
      and item.workspace_id = assignment.workspace_id
    join public.workspaces as workspace
      on workspace.id = assignment.workspace_id
    join public.volunteer_profiles as volunteer
      on volunteer.id = assignment.volunteer_profile_id
      and volunteer.workspace_id = assignment.workspace_id
    left join public.project_contacts as follow_contact
      on follow_contact.id = item.follow_up_project_contact_id
      and follow_contact.status = 'active'
    where assignment.workspace_id = target_workspace_id
      and assignment.calendar_item_id = p_calendar_item_id
      and assignment.lifecycle = 'active'
    order by assignment.created_at asc, assignment.id asc
  loop
    normalized_recipient_email := candidate.normalized_email;
    candidate_status := 'sendable';
    candidate_failure := null;

    select *
    into existing_delivery
    from public.assignment_notification_deliveries as delivery
    where delivery.calendar_assignment_id = candidate.assignment_id
      and delivery.notification_kind = 'initial_assignment'
      and delivery.template_version = 'initial-assignment.v1'
    for update;

    if existing_delivery.id is not null and existing_delivery.delivery_state = 'sent' then
      delivery_id := existing_delivery.id;
      calendar_assignment_id := candidate.assignment_id;
      volunteer_profile_id := candidate.volunteer_profile_id;
      recipient_email := existing_delivery.recipient_email_snapshot;
      volunteer_display_name := candidate.volunteer_display_name;
      workspace_display_name := candidate.workspace_display_name;
      workspace_timezone := candidate.workspace_timezone;
      calendar_item_id := candidate.item_id;
      task_title := candidate.title_snapshot;
      task_type := candidate.task_type_snapshot;
      schedule_kind := candidate.schedule_kind;
      start_date := candidate.start_date;
      end_date := candidate.end_date;
      start_time := candidate.start_time;
      end_time := candidate.end_time;
      needed_count := candidate.needed_count;
      schedule_notes := candidate.schedule_notes;
      follow_up_contact_display_name := candidate.follow_up_display_name;
      follow_up_contact_email := candidate.follow_up_email;
      follow_up_contact_phone := candidate.follow_up_phone;
      send_status := 'already_sent';
      attempt_count := existing_delivery.attempt_count;
      idempotency_key := existing_delivery.idempotency_key;
      return next;
      existing_delivery := null;
      continue;
    end if;

    if existing_delivery.id is not null
      and existing_delivery.delivery_state = 'sending'
      and existing_delivery.sending_expires_at > now()
    then
      delivery_id := existing_delivery.id;
      calendar_assignment_id := candidate.assignment_id;
      volunteer_profile_id := candidate.volunteer_profile_id;
      recipient_email := existing_delivery.recipient_email_snapshot;
      volunteer_display_name := candidate.volunteer_display_name;
      workspace_display_name := candidate.workspace_display_name;
      workspace_timezone := candidate.workspace_timezone;
      calendar_item_id := candidate.item_id;
      task_title := candidate.title_snapshot;
      task_type := candidate.task_type_snapshot;
      schedule_kind := candidate.schedule_kind;
      start_date := candidate.start_date;
      end_date := candidate.end_date;
      start_time := candidate.start_time;
      end_time := candidate.end_time;
      needed_count := candidate.needed_count;
      schedule_notes := candidate.schedule_notes;
      follow_up_contact_display_name := candidate.follow_up_display_name;
      follow_up_contact_email := candidate.follow_up_email;
      follow_up_contact_phone := candidate.follow_up_phone;
      send_status := 'already_sending';
      attempt_count := existing_delivery.attempt_count;
      idempotency_key := existing_delivery.idempotency_key;
      return next;
      existing_delivery := null;
      continue;
    end if;

    if candidate.volunteer_lifecycle <> 'active'
      or candidate.readiness_status <> 'ready'
    then
      candidate_status := 'not_eligible';
      candidate_failure := 'not_eligible';
    elsif normalized_recipient_email is null then
      candidate_status := 'missing_recipient_email';
      candidate_failure := 'missing_recipient_email';
    elsif not candidate.has_follow_up_contact then
      candidate_status := 'missing_follow_up_contact';
      candidate_failure := 'missing_follow_up_contact';
    end if;

    if candidate_status = 'sendable' then
      if existing_delivery.id is null then
        insert into public.assignment_notification_deliveries (
          workspace_id,
          calendar_item_id,
          calendar_assignment_id,
          volunteer_profile_id,
          notification_kind,
          template_version,
          delivery_state,
          attempt_count,
          recipient_email_snapshot,
          idempotency_key,
          initiated_by_project_contact_id,
          sending_started_at,
          sending_expires_at
        )
        values (
          target_workspace_id,
          candidate.item_id,
          candidate.assignment_id,
          candidate.volunteer_profile_id,
          'initial_assignment',
          'initial-assignment.v1',
          'sending',
          1,
          normalized_recipient_email,
          'initial_assignment:initial-assignment.v1:' || candidate.assignment_id::text,
          caller_project_contact_id,
          now(),
          now() + interval '15 minutes'
        )
        returning * into claimed_delivery;
      else
        update public.assignment_notification_deliveries as delivery
        set delivery_state = 'sending',
            attempt_count = least(delivery.attempt_count + 1, 25),
            recipient_email_snapshot = normalized_recipient_email,
            provider_message_id = null,
            safe_failure_code = null,
            initiated_by_project_contact_id = caller_project_contact_id,
            sending_started_at = now(),
            sending_expires_at = now() + interval '15 minutes',
            sent_at = null,
            failed_at = null
        where delivery.id = existing_delivery.id
          and (
            existing_delivery.delivery_state = 'failed'
            or (
              existing_delivery.delivery_state = 'sending'
              and existing_delivery.sending_expires_at <= now()
            )
          )
        returning * into claimed_delivery;
      end if;
    else
      if existing_delivery.id is null then
        insert into public.assignment_notification_deliveries (
          workspace_id,
          calendar_item_id,
          calendar_assignment_id,
          volunteer_profile_id,
          notification_kind,
          template_version,
          delivery_state,
          attempt_count,
          recipient_email_snapshot,
          safe_failure_code,
          idempotency_key,
          initiated_by_project_contact_id,
          failed_at
        )
        values (
          target_workspace_id,
          candidate.item_id,
          candidate.assignment_id,
          candidate.volunteer_profile_id,
          'initial_assignment',
          'initial-assignment.v1',
          'failed',
          1,
          normalized_recipient_email,
          candidate_failure,
          'initial_assignment:initial-assignment.v1:' || candidate.assignment_id::text,
          caller_project_contact_id,
          now()
        )
        returning * into claimed_delivery;
      else
        update public.assignment_notification_deliveries as delivery
        set delivery_state = 'failed',
            recipient_email_snapshot = normalized_recipient_email,
            provider_message_id = null,
            safe_failure_code = candidate_failure,
            initiated_by_project_contact_id = caller_project_contact_id,
            sending_started_at = null,
            sending_expires_at = null,
            sent_at = null,
            failed_at = now()
        where delivery.id = existing_delivery.id
          and delivery.delivery_state <> 'sent'
        returning * into claimed_delivery;
      end if;
    end if;

    if claimed_delivery.id is not null then
      delivery_id := claimed_delivery.id;
      calendar_assignment_id := candidate.assignment_id;
      volunteer_profile_id := candidate.volunteer_profile_id;
      recipient_email := claimed_delivery.recipient_email_snapshot;
      volunteer_display_name := candidate.volunteer_display_name;
      workspace_display_name := candidate.workspace_display_name;
      workspace_timezone := candidate.workspace_timezone;
      calendar_item_id := candidate.item_id;
      task_title := candidate.title_snapshot;
      task_type := candidate.task_type_snapshot;
      schedule_kind := candidate.schedule_kind;
      start_date := candidate.start_date;
      end_date := candidate.end_date;
      start_time := candidate.start_time;
      end_time := candidate.end_time;
      needed_count := candidate.needed_count;
      schedule_notes := candidate.schedule_notes;
      follow_up_contact_display_name := candidate.follow_up_display_name;
      follow_up_contact_email := candidate.follow_up_email;
      follow_up_contact_phone := candidate.follow_up_phone;
      send_status := candidate_status;
      attempt_count := claimed_delivery.attempt_count;
      idempotency_key := claimed_delivery.idempotency_key;
      return next;
    end if;

    existing_delivery := null;
    claimed_delivery := null;
  end loop;
end;
$$;

create function public.finalize_initial_assignment_notification_delivery(
  p_delivery_id uuid,
  p_delivery_state text,
  p_provider_message_id text,
  p_safe_failure_code text
)
returns table (
  delivery_id uuid,
  delivery_state text,
  attempt_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_user_id uuid;
  finalized public.assignment_notification_deliveries%rowtype;
begin
  caller_user_id := auth.uid();

  if caller_user_id is null
    or p_delivery_id is null
    or p_delivery_state not in ('sent', 'failed')
    or (
      p_delivery_state = 'sent'
      and (
        p_provider_message_id is null
        or char_length(btrim(p_provider_message_id)) not between 1 and 200
        or p_safe_failure_code is not null
      )
    )
    or (
      p_delivery_state = 'failed'
      and (
        p_safe_failure_code is null
        or p_safe_failure_code not in (
          'provider_config_unavailable',
          'provider_send_failed',
          'schedule_access_issue_failed',
          'schedule_access_revoke_failed',
          'finalize_unavailable'
        )
      )
    )
  then
    raise exception 'Initial assignment notification finalization is unavailable.' using errcode = '42501';
  end if;

  update public.assignment_notification_deliveries as delivery
  set delivery_state = p_delivery_state,
      provider_message_id = case
        when p_delivery_state = 'sent' then btrim(p_provider_message_id)
        else null
      end,
      safe_failure_code = case
        when p_delivery_state = 'failed' then p_safe_failure_code
        else null
      end,
      sent_at = case when p_delivery_state = 'sent' then now() else null end,
      failed_at = case when p_delivery_state = 'failed' then now() else null end,
      sending_started_at = null,
      sending_expires_at = null
  where delivery.id = p_delivery_id
    and delivery.delivery_state = 'sending'
    and exists (
      select 1
      from public.workspace_contact_grants as grant_row
      join public.project_contacts as contact
        on contact.id = grant_row.project_contact_id
      join public.workspaces as workspace
        on workspace.id = delivery.workspace_id
      where grant_row.workspace_id = delivery.workspace_id
        and contact.auth_user_id = caller_user_id
        and contact.status = 'active'
        and workspace.lifecycle = 'active'
        and grant_row.status = 'active'
        and grant_row.revoked_at is null
        and grant_row.valid_from <= now()
        and (grant_row.valid_until is null or grant_row.valid_until > now())
        and grant_row.capabilities @> array['assignments.edit']::text[]
    )
  returning * into finalized;

  if finalized.id is null then
    raise exception 'Initial assignment notification finalization is unavailable.' using errcode = '42501';
  end if;

  return query
  select finalized.id, finalized.delivery_state, finalized.attempt_count;
end;
$$;

drop function public.read_volunteer_schedule(text);

create function public.read_volunteer_schedule(p_bearer_token text)
returns table (
  schedule_state text,
  workspace_display_name text,
  workspace_timezone text,
  volunteer_display_name text,
  assignment_reference uuid,
  task_title text,
  task_type text,
  schedule_kind text,
  start_date date,
  end_date date,
  start_time time without time zone,
  end_time time without time zone,
  needed_count integer,
  schedule_notes text,
  current_response_status text,
  response_note text,
  can_confirm boolean,
  can_decline boolean,
  response_locked boolean,
  response_lock_reason text,
  active_assigned_count integer,
  confirmed_count integer,
  declined_count integer,
  follow_up_contact_display_name text,
  follow_up_contact_email text,
  follow_up_contact_phone text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  verified_token_id uuid;
  verified_workspace_id uuid;
  verified_volunteer_profile_id uuid;
  valid_assignment_count integer;
begin
  if p_bearer_token is null
    or char_length(p_bearer_token) <> 43
    or p_bearer_token !~ '^[A-Za-z0-9_-]{43}$'
  then
    return query
    select
      'unavailable'::text,
      null::text,
      null::text,
      null::text,
      null::uuid,
      null::text,
      null::text,
      null::text,
      null::date,
      null::date,
      null::time without time zone,
      null::time without time zone,
      null::integer,
      null::text,
      null::text,
      null::text,
      null::boolean,
      null::boolean,
      null::boolean,
      null::text,
      null::integer,
      null::integer,
      null::integer,
      null::text,
      null::text,
      null::text;
    return;
  end if;

  select token.id, token.workspace_id, token.volunteer_profile_id
  into verified_token_id, verified_workspace_id, verified_volunteer_profile_id
  from public.volunteer_schedule_access_tokens as token
  join public.workspaces as workspace
    on workspace.id = token.workspace_id
  join public.volunteer_profiles as volunteer
    on volunteer.id = token.volunteer_profile_id
    and volunteer.workspace_id = token.workspace_id
  where token.token_verifier_hash = extensions.digest(p_bearer_token, 'sha256')
    and token.purpose = 'volunteer_schedule_access'
    and token.token_version = 1
    and token.revoked_at is null
    and token.expires_at > now()
    and workspace.lifecycle = 'active'
    and volunteer.lifecycle = 'active'
    and volunteer.readiness_status = 'ready'
  limit 1;

  if verified_token_id is null then
    return query
    select
      'unavailable'::text,
      null::text,
      null::text,
      null::text,
      null::uuid,
      null::text,
      null::text,
      null::text,
      null::date,
      null::date,
      null::time without time zone,
      null::time without time zone,
      null::integer,
      null::text,
      null::text,
      null::text,
      null::boolean,
      null::boolean,
      null::boolean,
      null::text,
      null::integer,
      null::integer,
      null::integer,
      null::text,
      null::text,
      null::text;
    return;
  end if;

  update public.volunteer_schedule_access_tokens as token
  set last_used_at = now()
  where token.id = verified_token_id;

  select count(*)::integer
  into valid_assignment_count
  from public.calendar_assignments as assignment
  join public.calendar_items as item
    on item.id = assignment.calendar_item_id
    and item.workspace_id = assignment.workspace_id
  join public.workspaces as workspace
    on workspace.id = assignment.workspace_id
  join public.assignment_responses as response
    on response.assignment_id = assignment.id
    and response.workspace_id = assignment.workspace_id
  where assignment.workspace_id = verified_workspace_id
    and assignment.volunteer_profile_id = verified_volunteer_profile_id
    and assignment.lifecycle = 'active'
    and item.lifecycle = 'active'
    and item.publication_state = 'published'
    and item.start_date between
      coalesce(workspace.starts_on, (current_date - interval '365 days')::date)
      and coalesce(workspace.ends_on, (current_date + interval '365 days')::date);

  if valid_assignment_count = 0 then
    return query
    select
      'ready_empty'::text,
      workspace.display_name,
      workspace.timezone,
      volunteer.full_name,
      null::uuid,
      null::text,
      null::text,
      null::text,
      null::date,
      null::date,
      null::time without time zone,
      null::time without time zone,
      null::integer,
      null::text,
      null::text,
      null::text,
      null::boolean,
      null::boolean,
      null::boolean,
      null::text,
      null::integer,
      null::integer,
      null::integer,
      null::text,
      null::text,
      null::text
    from public.workspaces as workspace
    join public.volunteer_profiles as volunteer
      on volunteer.workspace_id = workspace.id
    where workspace.id = verified_workspace_id
      and volunteer.id = verified_volunteer_profile_id;
    return;
  end if;

  return query
  select
    'ready'::text,
    workspace.display_name,
    workspace.timezone,
    volunteer.full_name,
    assignment.id,
    item.title_snapshot,
    item.task_type_snapshot,
    item.schedule_kind,
    item.start_date,
    item.end_date,
    item.start_time,
    item.end_time,
    item.needed_count,
    item.schedule_notes,
    response.response_status,
    response.response_note,
    (
      response.response_status in ('needs_response', 'declined')
      and policy.assignment_start_at > now()
    )::boolean as can_confirm,
    (
      response.response_status in ('needs_response', 'confirmed')
      and policy.assignment_start_at > now()
      and now() < policy.assignment_start_at - interval '48 hours'
    )::boolean as can_decline,
    (
      policy.assignment_start_at <= now()
      or (
        response.response_status in ('needs_response', 'confirmed')
        and now() >= policy.assignment_start_at - interval '48 hours'
      )
    )::boolean as response_locked,
    case
      when policy.assignment_start_at <= now() then 'started'
      when response.response_status in ('needs_response', 'confirmed')
        and now() >= policy.assignment_start_at - interval '48 hours'
        then 'inside_48_hours'
      else null::text
    end as response_lock_reason,
    coverage.active_assigned_count,
    coverage.confirmed_count,
    coverage.declined_count,
    follow_contact.volunteer_facing_display_name,
    lower(nullif(btrim(follow_contact.volunteer_facing_email), '')),
    follow_contact.volunteer_facing_phone
  from public.calendar_assignments as assignment
  join public.calendar_items as item
    on item.id = assignment.calendar_item_id
    and item.workspace_id = assignment.workspace_id
  join public.workspaces as workspace
    on workspace.id = assignment.workspace_id
  join public.volunteer_profiles as volunteer
    on volunteer.id = assignment.volunteer_profile_id
    and volunteer.workspace_id = assignment.workspace_id
  join public.assignment_responses as response
    on response.assignment_id = assignment.id
    and response.workspace_id = assignment.workspace_id
  left join public.project_contacts as follow_contact
    on follow_contact.id = item.follow_up_project_contact_id
    and follow_contact.status = 'active'
    and exists (
      select 1
      from public.workspace_contact_grants as follow_grant
      where follow_grant.workspace_id = item.workspace_id
        and follow_grant.project_contact_id = follow_contact.id
        and follow_grant.status = 'active'
        and follow_grant.revoked_at is null
        and follow_grant.valid_from <= now()
        and (follow_grant.valid_until is null or follow_grant.valid_until > now())
    )
  cross join lateral (
    select public.calendar_assignment_response_start_at(
      item.schedule_kind,
      item.start_date,
      item.start_time,
      item.timezone
    ) as assignment_start_at
  ) as policy
  cross join lateral (
    select
      count(*) filter (
        where current_assignment.lifecycle = 'active'
          and current_response.response_status in ('needs_response', 'confirmed')
      )::integer as active_assigned_count,
      count(*) filter (
        where current_assignment.lifecycle = 'active'
          and current_response.response_status = 'confirmed'
      )::integer as confirmed_count,
      count(*) filter (
        where current_assignment.lifecycle = 'active'
          and current_response.response_status = 'declined'
      )::integer as declined_count
    from public.calendar_assignments as current_assignment
    join public.assignment_responses as current_response
      on current_response.assignment_id = current_assignment.id
      and current_response.workspace_id = current_assignment.workspace_id
    where current_assignment.workspace_id = item.workspace_id
      and current_assignment.calendar_item_id = item.id
  ) as coverage
  where assignment.workspace_id = verified_workspace_id
    and assignment.volunteer_profile_id = verified_volunteer_profile_id
    and assignment.lifecycle = 'active'
    and item.lifecycle = 'active'
    and item.publication_state = 'published'
    and item.start_date between
      coalesce(workspace.starts_on, (current_date - interval '365 days')::date)
      and coalesce(workspace.ends_on, (current_date + interval '365 days')::date)
  order by
    item.start_date asc,
    item.start_time asc nulls first,
    assignment.id asc
  limit 100;
end;
$$;

revoke all on function public.read_initial_assignment_notification_summaries(uuid[]) from public;
grant execute on function public.read_initial_assignment_notification_summaries(uuid[]) to authenticated;
revoke all on function public.claim_initial_assignment_notification_deliveries(uuid) from public;
grant execute on function public.claim_initial_assignment_notification_deliveries(uuid) to authenticated;
revoke all on function public.finalize_initial_assignment_notification_delivery(uuid, text, text, text) from public;
grant execute on function public.finalize_initial_assignment_notification_delivery(uuid, text, text, text) to authenticated;
revoke all on function public.read_volunteer_schedule(text) from public;
grant execute on function public.read_volunteer_schedule(text) to anon, authenticated;
