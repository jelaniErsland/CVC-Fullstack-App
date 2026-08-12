-- Iteration 12.33: authenticated, workspace-scoped stale assignment-email
-- delivery monitoring. This function is read-only and deliberately returns
-- only the projection consumed by the existing application stale detector.

create function public.read_assignment_notification_delivery_health()
returns table (
  delivery_id uuid,
  delivery_state text,
  sending_expires_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_user_id uuid;
  eligible_workspace_count integer;
  target_workspace_id uuid;
begin
  caller_user_id := auth.uid();

  if caller_user_id is null then
    raise exception 'Assignment notification delivery health is unavailable.' using errcode = '42501';
  end if;

  select
    count(*)::integer,
    (array_agg(eligible.workspace_id order by eligible.workspace_id))[1]
  into eligible_workspace_count, target_workspace_id
  from (
    select grant_row.workspace_id
    from public.workspace_contact_grants as grant_row
    join public.project_contacts as contact
      on contact.id = grant_row.project_contact_id
    join public.workspaces as workspace
      on workspace.id = grant_row.workspace_id
    where contact.auth_user_id = caller_user_id
      and contact.status = 'active'
      and workspace.lifecycle = 'active'
      and grant_row.status = 'active'
      and grant_row.revoked_at is null
      and grant_row.valid_from <= now()
      and (grant_row.valid_until is null or grant_row.valid_until > now())
      and grant_row.capabilities @> array[
        'workspace.read',
        'calendar.view',
        'assignments.view',
        'assignments.edit'
      ]::text[]
    group by grant_row.workspace_id
  ) as eligible;

  if eligible_workspace_count <> 1 or target_workspace_id is null then
    raise exception 'Assignment notification delivery health is unavailable.' using errcode = '42501';
  end if;

  return query
  select
    delivery.id,
    delivery.delivery_state,
    delivery.sending_expires_at
  from public.assignment_notification_deliveries as delivery
  where delivery.workspace_id = target_workspace_id
    and delivery.delivery_state = 'sending'
    and delivery.sending_expires_at is not null
  order by delivery.sending_expires_at asc, delivery.id asc
  limit 100;
end;
$$;

comment on function public.read_assignment_notification_delivery_health() is
  'Returns at most 100 sending assignment-notification delivery lease projections for the caller''s single authorized workspace. Performs no mutation.';

revoke all on function public.read_assignment_notification_delivery_health() from public;
revoke all on function public.read_assignment_notification_delivery_health() from anon, authenticated;
grant execute on function public.read_assignment_notification_delivery_health() to authenticated;
