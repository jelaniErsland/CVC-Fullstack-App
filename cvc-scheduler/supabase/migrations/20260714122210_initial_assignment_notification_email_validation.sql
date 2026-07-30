-- Iteration 12.22.1: hosted validation fix for initial assignment notification email eligibility.
-- Preserve the already-applied 12.22 migration history and tighten only the hosted-exposed
-- malformed-email seam in the existing notification summary/claim RPC bodies.

do $$
declare
  definition text;
begin
  select pg_get_functiondef('public.read_initial_assignment_notification_summaries(uuid[])'::regprocedure)
  into definition;

  definition := replace(
    definition,
    $needle$
        and scope.recipient_email is not null
        and scope.has_follow_up_contact
    $needle$,
    $replacement$
        and scope.recipient_email is not null
        and scope.recipient_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
        and scope.has_follow_up_contact
    $replacement$
  );

  definition := replace(
    definition,
    $needle$
        and scope.recipient_email is null
    $needle$,
    $replacement$
        and (
          scope.recipient_email is null
          or scope.recipient_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
        )
    $replacement$
  );

  definition := replace(
    definition,
    $needle$
        and follow_contact.volunteer_facing_email is not null
        and exists (
    $needle$,
    $replacement$
        and follow_contact.volunteer_facing_email is not null
        and follow_contact.volunteer_facing_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
        and exists (
    $replacement$
  );

  execute definition;
end;
$$;

do $$
declare
  definition text;
begin
  select pg_get_functiondef('public.claim_initial_assignment_notification_deliveries(uuid)'::regprocedure)
  into definition;

  definition := replace(
    definition,
    $needle$
        and follow_contact.volunteer_facing_email is not null
        and exists (
    $needle$,
    $replacement$
        and follow_contact.volunteer_facing_email is not null
        and follow_contact.volunteer_facing_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
        and exists (
    $replacement$
  );

  definition := replace(
    definition,
    $needle$
    elsif normalized_recipient_email is null then
    $needle$,
    $replacement$
    elsif normalized_recipient_email is null
      or normalized_recipient_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    $replacement$
  );

  execute definition;
end;
$$;
