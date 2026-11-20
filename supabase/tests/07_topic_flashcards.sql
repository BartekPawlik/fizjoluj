begin;

select '1..5';

create or replace function private.current_academic_year_start()
returns integer language sql stable set search_path = '' as $$ select 2026 $$;

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
values
  ('17000000-0000-4000-8000-000000000001', 'topic-cards-admin@example.test', now(), '{}'),
  ('17000000-0000-4000-8000-000000000002', 'topic-cards-student@example.test', now(), '{}');
update public.profiles set role = 'admin' where user_id = '17000000-0000-4000-8000-000000000001';

set local role authenticated;
set local request.jwt.claim.sub = '17000000-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"sub":"17000000-0000-4000-8000-000000000001","role":"authenticated"}';
do $$
declare
  biology_id uuid := (select id from public.study_subjects where name = 'Biologia medyczna');
  topics uuid[];
  assessment uuid;
  revision record;
begin
  perform public.grant_student_access('17000000-0000-4000-8000-000000000002',
    (select id from public.locations where name = 'Poznań'), (select id from public.cohorts where start_year = 2026));
  select array_agg(topic.id order by topic.position) into topics
  from public.study_topics as topic
  join public.study_sections as section on section.id = topic.section_id
  where section.subject_id = biology_id and section.name = 'Komórka i metabolizm';
  perform public.publish_study_topic_draft((select id from public.study_topic_revisions where topic_id = topics[1]), 0);
  perform public.publish_study_topic_draft((select id from public.study_topic_revisions where topic_id = topics[2]), 0);
  assessment := public.save_study_assessment(biology_id, null, 0, 'Test fiszek tematu', array[topics[1]], '[]');
  perform public.publish_study_assessment(biology_id, assessment, 0);
  perform set_config('fizjoluj_test.topic_assessment', assessment::text, true);
  perform set_config('fizjoluj_test.topic_semester', (select semester_id::text from public.study_subjects where id = biology_id), true);
  for revision in
    select id, topic_id, flashcards->0->>'id' as card_id, array_position(topics, topic_id) as position
    from public.study_topic_revisions where topic_id = any(topics[1:3])
  loop
    perform set_config('fizjoluj_test.topic_scope' || revision.position, revision.topic_id::text, true);
    perform set_config('fizjoluj_test.topic_revision' || revision.position, revision.id::text, true);
    perform set_config('fizjoluj_test.topic_card' || revision.position, revision.card_id, true);
  end loop;
end;
$$;

create function pg_temp.rate_topic_card(
  assessment_id uuid, topic_position integer, chosen_rating public.study_flashcard_rating, version integer
)
returns integer language sql as $$
  select public.rate_study_flashcard(
    assessment_id,
    current_setting('fizjoluj_test.topic_scope' || topic_position)::uuid,
    current_setting('fizjoluj_test.topic_revision' || topic_position)::uuid,
    current_setting('fizjoluj_test.topic_card' || topic_position)::uuid,
    chosen_rating, version
  );
$$;

set local request.jwt.claim.sub = '17000000-0000-4000-8000-000000000002';
set local request.jwt.claims = '{"sub":"17000000-0000-4000-8000-000000000002","role":"authenticated"}';
do $$
begin
  if pg_temp.rate_topic_card(null, 2, 'review', 0) is distinct from 1
    or pg_temp.rate_topic_card(null, 2, 'review', 0) is distinct from 1 then
    raise exception 'The student could not rate a topic that has no assessment';
  end if;
  if (select count(*) from public.study_flashcard_progress where rating = 'review' and edit_version = 1) <> 1 then
    raise exception 'A direct rating or its retry wrote an unexpected number of records';
  end if;
end;
$$;
select 'ok 1 - an available topic can be rated without an assessment and retries remain idempotent';

do $$
declare
  assessment uuid := current_setting('fizjoluj_test.topic_assessment')::uuid;
  topic uuid := current_setting('fizjoluj_test.topic_scope1')::uuid;
begin
  if pg_temp.rate_topic_card(null, 1, 'review', 0) is distinct from 1 then
    raise exception 'The topic rating failed';
  end if;
  if pg_temp.rate_topic_card(assessment, 1, 'known', 1) is distinct from 2 then
    raise exception 'The assessment could not update progress from the topic';
  end if;
  if (
    select count(*) from public.study_flashcard_progress
    where topic_id = topic and rating = 'known' and edit_version = 2
  ) <> 1 then
    raise exception 'Progress was not shared by the topic and assessment';
  end if;
end;
$$;
select 'ok 2 - rating the same card from a topic and assessment updates one shared record';

do $$
begin
  begin
    perform pg_temp.rate_topic_card(current_setting('fizjoluj_test.topic_assessment')::uuid, 2, 'known', 1);
    raise exception 'An explicitly addressed assessment lost its scope check';
  exception when insufficient_privilege then null;
  end;
  begin
    perform pg_temp.rate_topic_card(null, 3, 'known', 0);
    raise exception 'A direct rating accepted a draft topic';
  exception when insufficient_privilege then null;
  end;
end;
$$;
select 'ok 3 - direct sessions require publication and assessment sessions still enforce scope';

do $$
begin
  begin
    perform public.rate_study_flashcard(null, current_setting('fizjoluj_test.topic_scope1')::uuid,
      current_setting('fizjoluj_test.topic_revision2')::uuid, current_setting('fizjoluj_test.topic_card1')::uuid, 'review', 2);
    raise exception 'A revision from a different topic could be rated';
  exception when serialization_failure then null;
  end;
  begin
    perform pg_temp.rate_topic_card(null, 1, 'review', 1);
    raise exception 'A stale direct rating replaced the current rating';
  exception when serialization_failure then null;
  end;
end;
$$;
select 'ok 4 - direct reviews validate publication identity and preserve version conflict protection';

set local request.jwt.claim.sub = '17000000-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"sub":"17000000-0000-4000-8000-000000000001","role":"authenticated"}';
select public.set_study_semester_visibility(
  current_setting('fizjoluj_test.topic_semester')::uuid,
  (select id from public.cohorts where start_year = 2026), false
);
set local request.jwt.claim.sub = '17000000-0000-4000-8000-000000000002';
set local request.jwt.claims = '{"sub":"17000000-0000-4000-8000-000000000002","role":"authenticated"}';
do $$
begin
  if exists (select 1 from public.study_flashcard_progress) then
    raise exception 'The student could read progress from a hidden semester';
  end if;
  begin
    perform pg_temp.rate_topic_card(null, 1, 'review', 2);
    raise exception 'A direct rating could bypass semester visibility';
  exception when insufficient_privilege then null;
  end;
end;
$$;
select 'ok 5 - hiding a semester removes direct access to its topic ratings';

rollback;
