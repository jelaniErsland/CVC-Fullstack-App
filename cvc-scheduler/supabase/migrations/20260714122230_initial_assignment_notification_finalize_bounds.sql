-- Iteration 12.22.1: hosted validation fix for delivery finalization bounds.
-- Provider message identifiers are operational metadata, not a raw error/log field.
-- Keep them bounded to a conservative printable identifier shape.

do $$
declare
  definition text;
begin
  select pg_get_functiondef('public.finalize_initial_assignment_notification_delivery(uuid,text,text,text)'::regprocedure)
  into definition;

  definition := replace(
    definition,
    $needle$
        or char_length(btrim(p_provider_message_id)) not between 1 and 200
        or p_safe_failure_code is not null
    $needle$,
    $replacement$
        or char_length(btrim(p_provider_message_id)) not between 1 and 200
        or btrim(p_provider_message_id) !~ '^[A-Za-z0-9._:-]{1,200}$'
        or p_safe_failure_code is not null
    $replacement$
  );

  execute definition;
end;
$$;
