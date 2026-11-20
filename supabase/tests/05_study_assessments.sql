begin;

select '1..8';

create or replace function private.current_academic_year_start()
returns integer language sql stable set search_path = '' as $$ select 2026 $$;

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
values
  ('15000000-0000-4000-8000-000000000001', 'assessment-admin@example.test', now(), '{}'),
  ('15000000-0000-4000-8000-000000000002', 'assessment-poznan@example.test', now(), '{}'),
  ('15000000-0000-4000-8000-000000000003', 'assessment-szczecin@example.test', now(), '{}');
update public.profiles set role = 'admin' where user_id = '15000000-0000-4000-8000-000000000001';

set local role authenticated;
set local request.jwt.claim.sub = '15000000-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"sub":"15000000-0000-4000-8000-000000000001","role":"authenticated"}';

do $$
declare
  biology_id uuid := (select id from public.study_subjects where name = 'Biologia medyczna');
  cohort_id uuid := (select id from public.cohorts where start_year = 2026);
  poznan_id uuid := (select id from public.locations where name = 'Poznań');
  szczecin_id uuid := (select id from public.locations where name = 'Szczecin');
  first_topic uuid := (select id from public.study_topics where name = 'Rola związków organicznych');
  second_topic uuid := (select id from public.study_topics where name = 'Składniki plazmatyczne i nieplazmatyczne');
  assigned_topics uuid[] := array[first_topic, second_topic];
  assigned_dates jsonb := jsonb_build_array(
    jsonb_build_object('cohort_id', cohort_id, 'location_id', null, 'scheduled_on', '2026-12-15'),
    jsonb_build_object('cohort_id', cohort_id, 'location_id', poznan_id, 'scheduled_on', '2026-12-10'),
    jsonb_build_object('cohort_id', cohort_id, 'location_id', szczecin_id, 'scheduled_on', '2026-12-17')
  );
  saved_id uuid;
  undated_id uuid;
  empty_id uuid;
begin
  perform public.grant_student_access('15000000-0000-4000-8000-000000000002', poznan_id, cohort_id);
  perform public.grant_student_access('15000000-0000-4000-8000-000000000003', szczecin_id, cohort_id);
  perform public.publish_study_topic_draft(
    (select id from public.study_topic_revisions where topic_id = first_topic and state = 'draft'), 0
  );

  saved_id := public.save_study_assessment(biology_id, null, 0, 'Zaliczenie testowe', assigned_topics, assigned_dates);
  undated_id := public.save_study_assessment(biology_id, null, 0, 'Zaliczenie bez daty', array[first_topic], '[]');
  empty_id := public.save_study_assessment(biology_id, null, 0, 'Pusty szkic', '{}', '[]');
  if (select count(*) from public.study_assessment_topics where assessment_id = saved_id) <> 2
    or (select count(*) from public.study_assessment_dates where assessment_id = saved_id) <> 3
    or exists (select 1 from public.study_assessments where published_at is not null) then
    raise exception 'Saving the assessment did not create a private draft with its complete scope and dates';
  end if;

  perform set_config('fizjoluj_test.assessment', saved_id::text, true);
  perform set_config('fizjoluj_test.undated_assessment', undated_id::text, true);
  perform set_config('fizjoluj_test.empty_assessment', empty_id::text, true);
  perform set_config('fizjoluj_test.assessment_subject', biology_id::text, true);
  perform set_config('fizjoluj_test.assessment_topics', assigned_topics::text, true);
  perform set_config('fizjoluj_test.assessment_dates', assigned_dates::text, true);
end;
$$;
select 'ok 1 - administrators save an assessment draft with its scope and dates';

set local request.jwt.claim.sub = '15000000-0000-4000-8000-000000000002';
set local request.jwt.claims = '{"sub":"15000000-0000-4000-8000-000000000002","role":"authenticated"}';
do $$
begin
  if exists (select 1 from public.study_assessments)
    or exists (select 1 from public.study_assessment_topics)
    or exists (select 1 from public.study_assessment_dates) then
    raise exception 'Student read an assessment draft, its scope, or its dates';
  end if;
  begin
    perform public.publish_study_assessment(
      current_setting('fizjoluj_test.assessment_subject')::uuid,
      current_setting('fizjoluj_test.assessment')::uuid, 0
    );
    raise exception 'Student published an assessment';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.save_study_assessment(
      current_setting('fizjoluj_test.assessment_subject')::uuid, null, 0, 'Student entry', '{}', '[]'
    );
    raise exception 'Student wrote to the shared assessments';
  exception when insufficient_privilege then null;
  end;
end;
$$;
select 'ok 2 - students cannot publish, write or read an assessment draft';

set local request.jwt.claim.sub = '15000000-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"sub":"15000000-0000-4000-8000-000000000001","role":"authenticated"}';
do $$
declare
  subject_id uuid := current_setting('fizjoluj_test.assessment_subject')::uuid;
  target_id uuid := current_setting('fizjoluj_test.assessment')::uuid;
  target_topics uuid[] := current_setting('fizjoluj_test.assessment_topics')::uuid[];
begin
  begin
    perform public.save_study_assessment(
      (select id from public.study_subjects where name = 'Genetyka'), null, 0, 'Invalid scope', target_topics, '[]'
    );
    raise exception 'A topic from a different subject was accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.save_study_assessment(subject_id, target_id, 0, 'Invalid location', target_topics,
      jsonb_build_array(jsonb_build_object(
        'cohort_id', (select id from public.cohorts where start_year = 2026),
        'location_id', gen_random_uuid(), 'scheduled_on', '2026-12-13'
      )));
    raise exception 'A date with an invalid location was accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.save_study_assessment(subject_id, target_id, 1, 'Stale edit', target_topics, '[]');
    raise exception 'A stale edit was accepted';
  exception when serialization_failure then null;
  end;
  if (select edit_version from public.study_assessments where id = target_id) <> 0
    or (select count(*) from public.study_assessment_dates where assessment_id = target_id) <> 3 then
    raise exception 'A rejected edit changed the assessment';
  end if;
end;
$$;
select 'ok 3 - mismatched topics, invalid locations and stale edits leave the existing assessment intact';

do $$
declare
  subject_id uuid := current_setting('fizjoluj_test.assessment_subject')::uuid;
begin
  begin
    perform public.publish_study_assessment(subject_id, current_setting('fizjoluj_test.empty_assessment')::uuid, 0);
    raise exception 'An assessment with no topics was published';
  exception when invalid_parameter_value then null;
  end;
  perform public.publish_study_assessment(subject_id, current_setting('fizjoluj_test.assessment')::uuid, 0);
  perform public.publish_study_assessment(subject_id, current_setting('fizjoluj_test.undated_assessment')::uuid, 0);
  if (select count(*) from public.study_assessments where published_at is not null and edit_version = 1) <> 2 then
    raise exception 'Publishing failed or exposed the empty draft';
  end if;
end;
$$;
select 'ok 4 - publishing requires a scope, and an assessment may have no scheduled date';

set local request.jwt.claim.sub = '15000000-0000-4000-8000-000000000002';
set local request.jwt.claims = '{"sub":"15000000-0000-4000-8000-000000000002","role":"authenticated"}';
do $$
begin
  if (select count(*) from public.study_assessments) <> 2
    or (select array_agg(scheduled_on order by scheduled_on) from public.study_assessment_dates)
      is distinct from array[date '2026-12-10', date '2026-12-15']
    or (select array_agg(topic_id) from public.study_assessment_topics
      where assessment_id = current_setting('fizjoluj_test.assessment')::uuid)
      is distinct from (current_setting('fizjoluj_test.assessment_topics')::uuid[])[1:1] then
    raise exception 'A Poznan student saw the wrong dates, an unpublished topic or an unpublished assessment';
  end if;
end;
$$;
select 'ok 5 - Poznan sees its campus date and shared date, and only published topics in scope';

set local request.jwt.claim.sub = '15000000-0000-4000-8000-000000000003';
set local request.jwt.claims = '{"sub":"15000000-0000-4000-8000-000000000003","role":"authenticated"}';
do $$
begin
  if (select array_agg(scheduled_on order by scheduled_on) from public.study_assessment_dates)
    is distinct from array[date '2026-12-15', date '2026-12-17']
    or (select array_agg(topic_id) from public.study_assessment_topics
        where assessment_id = current_setting('fizjoluj_test.assessment')::uuid)
      is distinct from (current_setting('fizjoluj_test.assessment_topics')::uuid[])[1:1] then
    raise exception 'A Szczecin student saw the wrong dates or material';
  end if;
end;
$$;
select 'ok 6 - Szczecin sees its campus date with the same published scope';

set local request.jwt.claim.sub = '15000000-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"sub":"15000000-0000-4000-8000-000000000001","role":"authenticated"}';
do $$
declare
  subject_id uuid := current_setting('fizjoluj_test.assessment_subject')::uuid;
  target_id uuid := current_setting('fizjoluj_test.assessment')::uuid;
  target_topics uuid[] := current_setting('fizjoluj_test.assessment_topics')::uuid[];
  target_dates jsonb := current_setting('fizjoluj_test.assessment_dates')::jsonb;
begin
  perform public.save_study_assessment(subject_id, target_id, 1, 'Zmieniony termin', target_topics, target_dates - 1);
  if not exists (select 1 from public.study_assessments
        where id = target_id and edit_version = 2 and published_at is not null)
    or (select count(*) from public.study_assessment_dates where assessment_id = target_id) <> 2 then
    raise exception 'Updating a live assessment did not replace its dates atomically';
  end if;
end;
$$;
select 'ok 7 - administrators can update published scope and dates in a single versioned operation';

select public.revoke_student_access('15000000-0000-4000-8000-000000000002');
set local request.jwt.claim.sub = '15000000-0000-4000-8000-000000000002';
set local request.jwt.claims = '{"sub":"15000000-0000-4000-8000-000000000002","role":"authenticated"}';
do $$
begin
  if exists (select 1 from public.study_assessments)
    or exists (select 1 from public.study_assessment_topics)
    or exists (select 1 from public.study_assessment_dates) then
    raise exception 'A student with revoked access could still see an assessment';
  end if;
end;
$$;
select 'ok 8 - revoking semester access hides all assessment data';

rollback;
