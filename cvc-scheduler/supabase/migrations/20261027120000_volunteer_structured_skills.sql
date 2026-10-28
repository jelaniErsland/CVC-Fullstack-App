-- 12.61: current profile state; historical snapshots and questionnaire answers stay intact.
-- Apply atomically with the migration ledger in the controlled release runner.
alter table public.volunteer_profiles add column structured_skill_categories text[] not null default '{}'::text[];
alter table public.volunteer_profiles add constraint volunteer_profiles_structured_skills_valid check (
    cardinality(structured_skill_categories)<=10
    and (cardinality(structured_skill_categories)=0 or array_ndims(structured_skill_categories)=1)
    and array_position(structured_skill_categories,null) is null
    and structured_skill_categories <@ array['Painting','Demo','Framing','Finish work','Electrical assist','Plumbing assist','General cleanup','Check-in desk','Food service','Security']::text[]
    and cardinality(array_positions(structured_skill_categories, 'Painting')) <= 1
    and cardinality(array_positions(structured_skill_categories, 'Demo')) <= 1
    and cardinality(array_positions(structured_skill_categories, 'Framing')) <= 1
    and cardinality(array_positions(structured_skill_categories, 'Finish work')) <= 1
    and cardinality(array_positions(structured_skill_categories, 'Electrical assist')) <= 1
    and cardinality(array_positions(structured_skill_categories, 'Plumbing assist')) <= 1
    and cardinality(array_positions(structured_skill_categories, 'General cleanup')) <= 1
    and cardinality(array_positions(structured_skill_categories, 'Check-in desk')) <= 1
    and cardinality(array_positions(structured_skill_categories, 'Food service')) <= 1
    and cardinality(array_positions(structured_skill_categories, 'Security')) <= 1
);
comment on column public.volunteer_profiles.structured_skill_categories is 'Current explicitly recorded structured skills, independent of questionnaire snapshots and free-text experience.';
-- Seeding is a profile update and retains the existing updated_at trigger; no snapshots are rewritten.
do $seed$
declare missing_count bigint; invalid_count bigint; seeded_count bigint;
begin
  select count(*) filter(where raw is null),count(*) filter(where raw is not null and not valid) into missing_count,invalid_count
  from (
    select raw,case when jsonb_typeof(raw)='array' then jsonb_array_length(raw)<=10
      and not exists(select 1 from jsonb_array_elements(raw) x where jsonb_typeof(x)<>'string' or not ((x#>>'{}')=any(array['Painting','Demo','Framing','Finish work','Electrical assist','Plumbing assist','General cleanup','Check-in desk','Food service','Security']::text[])))
      and (select count(*)=count(distinct x) from jsonb_array_elements(raw) x) else false end valid
    from (select skills_help_snapshot#>'{skillsExperience,categories}' raw from public.volunteer_profiles) s
  ) checked;
  update public.volunteer_profiles v set structured_skill_categories=array(select skill from jsonb_array_elements_text(v.skills_help_snapshot#>'{skillsExperience,categories}') skill order by skill collate "C")
  where case when jsonb_typeof(v.skills_help_snapshot#>'{skillsExperience,categories}')='array' then
    jsonb_array_length(v.skills_help_snapshot#>'{skillsExperience,categories}') between 1 and 10
    and not exists(select 1 from jsonb_array_elements(v.skills_help_snapshot#>'{skillsExperience,categories}') x where jsonb_typeof(x)<>'string' or not ((x#>>'{}')=any(array['Painting','Demo','Framing','Finish work','Electrical assist','Plumbing assist','General cleanup','Check-in desk','Food service','Security']::text[])))
    and (select count(*)=count(distinct x) from jsonb_array_elements(v.skills_help_snapshot#>'{skillsExperience,categories}') x)
    else false end;
  get diagnostics seeded_count=row_count;
  raise notice '12.61 structured skill seed: % profiles seeded, % missing, % invalid (not salvaged).',seeded_count,missing_count,invalid_count;
end;
$seed$;
do $contract$
declare definition text; needle text; replacement text;
begin
select pg_get_functiondef('public.create_manual_volunteer_profile(uuid,jsonb)'::regprocedure) into definition;
needle := $old$perform 1 from public.workspaces$old$;
replacement := $new$if p_profile ? 'structuredSkills' then
  if jsonb_typeof(p_profile->'structuredSkills') is distinct from 'array' then
    raise exception 'Structured skills are invalid.' using errcode='22023';
  end if;
  if jsonb_array_length(p_profile->'structuredSkills') > 10
    or exists(select 1 from jsonb_array_elements(p_profile->'structuredSkills') choice where jsonb_typeof(choice) <> 'string' or not ((choice #>> '{}') = any(array['Painting','Demo','Framing','Finish work','Electrical assist','Plumbing assist','General cleanup','Check-in desk','Food service','Security']::text[])))
    or (select count(*) <> count(distinct choice) from jsonb_array_elements(p_profile->'structuredSkills') choice) then
    raise exception 'Structured skills are invalid.' using errcode='22023';
  end if;
  end if;
perform 1 from public.workspaces$new$;
if (length(definition)-length(replace(definition,needle,'')))/length(needle) <> 1 then raise exception '12.61 predecessor contract mismatch: create_manual_volunteer_profile(uuid,jsonb)'; end if;
definition := replace(definition,needle,replacement);
needle := $old$skills_experience,other_support)$old$;
replacement := $new$skills_experience,other_support,structured_skill_categories)$new$;
if (length(definition)-length(replace(definition,needle,'')))/length(needle) <> 1 then raise exception '12.61 predecessor contract mismatch: create_manual_volunteer_profile(uuid,jsonb)'; end if;
definition := replace(definition,needle,replacement);
needle := $old$nullif(btrim(p_profile->>'otherSupport'),'')) returning$old$;
replacement := $new$nullif(btrim(p_profile->>'otherSupport'),''),array(select skill from jsonb_array_elements_text(coalesce(p_profile->'structuredSkills','[]'::jsonb)) skill order by skill collate "C")) returning$new$;
if (length(definition)-length(replace(definition,needle,'')))/length(needle) <> 1 then raise exception '12.61 predecessor contract mismatch: create_manual_volunteer_profile(uuid,jsonb)'; end if;
definition := replace(definition,needle,replacement);
execute definition;
select pg_get_functiondef('public.update_volunteer_profile_manual_fields(uuid,jsonb)'::regprocedure) into definition;
needle := $old$  perform 1 from public.workspaces$old$;
replacement := $new$if p_profile ? 'structuredSkills' then
  if jsonb_typeof(p_profile->'structuredSkills') is distinct from 'array' then
    raise exception 'Structured skills are invalid.' using errcode='22023';
  end if;
  if jsonb_array_length(p_profile->'structuredSkills') > 10
    or exists(select 1 from jsonb_array_elements(p_profile->'structuredSkills') choice where jsonb_typeof(choice) <> 'string' or not ((choice #>> '{}') = any(array['Painting','Demo','Framing','Finish work','Electrical assist','Plumbing assist','General cleanup','Check-in desk','Food service','Security']::text[])))
    or (select count(*) <> count(distinct choice) from jsonb_array_elements(p_profile->'structuredSkills') choice) then
    raise exception 'Structured skills are invalid.' using errcode='22023';
  end if;
  end if;
  perform 1 from public.workspaces$new$;
if (length(definition)-length(replace(definition,needle,'')))/length(needle) <> 1 then raise exception '12.61 predecessor contract mismatch: update_volunteer_profile_manual_fields(uuid,jsonb)'; end if;
definition := replace(definition,needle,replacement);
needle := $old$other_support=nullif(btrim(p_profile->>'otherSupport'),'') where$old$;
replacement := $new$other_support=nullif(btrim(p_profile->>'otherSupport'),''),structured_skill_categories=case when p_profile ? 'structuredSkills' then array(select skill from jsonb_array_elements_text(p_profile->'structuredSkills') skill order by skill collate "C") else structured_skill_categories end where$new$;
if (length(definition)-length(replace(definition,needle,'')))/length(needle) <> 1 then raise exception '12.61 predecessor contract mismatch: update_volunteer_profile_manual_fields(uuid,jsonb)'; end if;
definition := replace(definition,needle,replacement);
execute definition;
select pg_get_functiondef('public.convert_questionnaire_submission_to_volunteer_profile(uuid)'::regprocedure) into definition;
needle := $old$perform 1 from public.workspaces$old$;
replacement := $new$if jsonb_typeof(coalesce(source_submission.answers#>'{skillsExperience,categories}','[]'::jsonb)) is distinct from 'array' then
    raise exception 'Structured skills are invalid.' using errcode='22023';
  end if;
  if jsonb_array_length(coalesce(source_submission.answers#>'{skillsExperience,categories}','[]'::jsonb)) > 10
    or exists(select 1 from jsonb_array_elements(coalesce(source_submission.answers#>'{skillsExperience,categories}','[]'::jsonb)) choice where jsonb_typeof(choice) <> 'string' or not ((choice #>> '{}') = any(array['Painting','Demo','Framing','Finish work','Electrical assist','Plumbing assist','General cleanup','Check-in desk','Food service','Security']::text[])))
    or (select count(*) <> count(distinct choice) from jsonb_array_elements(coalesce(source_submission.answers#>'{skillsExperience,categories}','[]'::jsonb)) choice) then
    raise exception 'Structured skills are invalid.' using errcode='22023';
  end if;
perform 1 from public.workspaces$new$;
if (length(definition)-length(replace(definition,needle,'')))/length(needle) <> 1 then raise exception '12.61 predecessor contract mismatch: convert_questionnaire_submission_to_volunteer_profile(uuid)'; end if;
definition := replace(definition,needle,replacement);
needle := $old$skills_experience,other_support)$old$;
replacement := $new$skills_experience,other_support,structured_skill_categories)$new$;
if (length(definition)-length(replace(definition,needle,'')))/length(needle) <> 1 then raise exception '12.61 predecessor contract mismatch: convert_questionnaire_submission_to_volunteer_profile(uuid)'; end if;
definition := replace(definition,needle,replacement);
needle := $old$source_submission.answers#>>'{otherWaysToHelp,notes}')),'')) returning$old$;
replacement := $new$source_submission.answers#>>'{otherWaysToHelp,notes}')),''),array(select skill from jsonb_array_elements_text(coalesce(source_submission.answers#>'{skillsExperience,categories}','[]'::jsonb)) skill order by skill collate "C")) returning$new$;
if (length(definition)-length(replace(definition,needle,'')))/length(needle) <> 1 then raise exception '12.61 predecessor contract mismatch: convert_questionnaire_submission_to_volunteer_profile(uuid)'; end if;
definition := replace(definition,needle,replacement);
execute definition;
end;
$contract$;
