-- Forward-only business-conflict repair for PostgREST 14 retry loops.
-- Re-applying this repair is safe. No business rows or privileges are changed.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
do $repair$
declare
  target record;
  signatures text[] := array[
    'public.apply_task_preset_instructions(uuid,timestamp with time zone,jsonb)',
    'public.confirm_communication_operation(uuid,uuid,jsonb,text)',
    'public.delete_volunteer_profile(uuid,uuid,timestamp with time zone,text)',
    'public.import_volunteer_profiles(uuid,uuid,jsonb)',
    'public.manage_volunteer_away(text,text,uuid,date,date,text)',
    'public.plan_calendar_assignments(uuid,uuid,jsonb,text)',
    'public.save_calendar_meal(uuid,uuid,text,date,time without time zone,time without time zone,text,text,text,integer,text,timestamp with time zone)',
    'public.save_workspace_project_photo(uuid,uuid,jsonb,bigint)',
    'public.submit_assignment_response_by_token(text,text,text)',
    'public.submit_volunteer_schedule_assignment_response(text,uuid,text,text)',
    'public.update_assignment_response(uuid,text,text)',
    'public.update_calendar_item_one_off_timed(uuid,text,text,date,date,time without time zone,time without time zone,integer,text,jsonb,timestamp with time zone)',
    'public.update_calendar_item_one_off_timed(uuid,text,text,date,time without time zone,time without time zone,integer,text,jsonb,timestamp with time zone)',
    'public.update_calendar_item_preset_timed(uuid,date,date,time without time zone,time without time zone,integer,text,jsonb,timestamp with time zone)',
    'public.update_calendar_item_preset_timed(uuid,date,time without time zone,time without time zone,integer,text,jsonb,timestamp with time zone)',
    'public.update_task_preset_color(uuid,text,timestamp with time zone)',
    'public.update_task_preset_description(uuid,text,timestamp with time zone)',
    'public.update_volunteer_profile_manual_fields(uuid,jsonb)'
  ];
  previous_definition text;
  replacement_definition text;
  metadata_before jsonb;
  changed integer := 0;
begin
  if exists(select 1 from unnest(signatures) s where to_regprocedure(s) is null) then
    raise exception 'Conflict repair requires the exact DB58 function signatures.';
  end if;
  if (select count(*) from pg_proc p where p.pronamespace='public'::regnamespace and position('40001' in p.prosrc)>0 and not p.oid=any(array(select to_regprocedure(s)::oid from unnest(signatures)s)))<>0 then
    raise exception 'An unreviewed function also raises 40001. Repair aborted.';
  end if;
  for target in select p.oid from pg_proc p where p.oid=any(array(select to_regprocedure(s)::oid from unnest(signatures)s)) order by p.oid loop
    select pg_get_functiondef(p.oid),to_jsonb(p)-array['prosrc','xmin','cmin','xmax','cmax','ctid'] into previous_definition,metadata_before from pg_proc p where p.oid=target.oid;
    if position('40001' in previous_definition)>0 then
      replacement_definition := replace(previous_definition,quote_literal('40001'),quote_literal('PT409'));
      if replacement_definition=previous_definition or position('40001' in replacement_definition)>0 then
        raise exception 'Unrecognized conflict-code spelling. Repair aborted.';
      end if;
      execute replacement_definition;
      if (select to_jsonb(p)-array['prosrc','xmin','cmin','xmax','cmax','ctid'] from pg_proc p where p.oid=target.oid) is distinct from metadata_before then
        raise exception 'Function metadata changed unexpectedly. Repair rolled back.';
      end if;
      if (select pg_get_functiondef(target.oid))<>replacement_definition then
        raise exception 'Function definition changed beyond the exact conflict-code replacement.';
      end if;
      changed := changed+1;
    elsif position('PT409' in previous_definition)=0 then
      raise exception 'Expected conflict handler is missing. Repair aborted.';
    end if;
  end loop;
  if changed not in (0,18) then
    raise exception 'Partial conflict-code rollout detected. Repair aborted.';
  end if;
end
$repair$;
notify pgrst, 'reload schema';
commit;
