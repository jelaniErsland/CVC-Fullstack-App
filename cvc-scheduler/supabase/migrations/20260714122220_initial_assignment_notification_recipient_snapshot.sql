-- Iteration 12.22.1: hosted validation fix for malformed recipient snapshots.
-- The 12.22.1 email-validation migration correctly classifies malformed volunteer
-- email values as missing-recipient, but the claim RPC must also avoid writing the
-- malformed value into the bounded delivery ledger snapshot.

do $$
declare
  definition text;
begin
  select pg_get_functiondef('public.claim_initial_assignment_notification_deliveries(uuid)'::regprocedure)
  into definition;

  definition := replace(
    definition,
    $needle$
    normalized_recipient_email := candidate.normalized_email;
    candidate_status := 'sendable';
    $needle$,
    $replacement$
    normalized_recipient_email := candidate.normalized_email;
    if normalized_recipient_email is not null
      and normalized_recipient_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      normalized_recipient_email := null;
    end if;
    candidate_status := 'sendable';
    $replacement$
  );

  execute definition;
end;
$$;
