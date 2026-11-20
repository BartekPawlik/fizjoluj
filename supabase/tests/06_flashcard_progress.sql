begin;

select '1..8';

create or replace function private.current_academic_year_start()
returns integer language sql stable set search_path = '' as $$ select 2026 $$;

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
values
  ('16000000-0000-4000-8000-000000000001', 'flashcard-admin@example.test', now(), '{}'),
  ('16000000-0000-4000-8000-000000000002', 'flashcard-first@example.test', now(), '{}'),
  ('16000000-0000-4000-8000-000000000003', 'flashcard-second@example.test', now(), '{}');
update public.profiles set role = 'admin' where user_id = '16000000-0000-4000-8000-000000000001';

set local role authenticated;
set local request.jwt.claim.sub = '16000000-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"sub":"16000000-0000-4000-8000-000000000001","role":"authenticated"}';

do $$
declare
  biology_id uuid := (select id from public.study_subjects where name = 'Biologia medyczna');
  cohort_id uuid := (select id from public.cohorts where start_year = 2026);
  location_id uuid := (select id from public.locations where name = 'Poznań');
  topics uuid[];
  first_assessment uuid;
  second_assessment uuid;
  draft_assessment uuid;
  revision record;
begin
  perform public.grant_student_access('16000000-0000-4000-8000-000000000002', location_id, cohort_id);
  perform public.grant_student_access('16000000-0000-4000-8000-000000000003', location_id, cohort_id);
  select array_agg(topic.id order by topic.position) into topics
  from public.study_topics as topic
  join public.study_sections as section on section.id = topic.section_id
  where section.subject_id = biology_id and section.name = 'Komórka i metabolizm';

  perform public.publish_study_topic_draft((select id from public.study_topic_revisions where topic_id = topics[1]), 0);
  perform public.publish_study_topic_draft((select id from public.study_topic_revisions where topic_id = topics[2]), 0);
  first_assessment := public.save_study_assessment(biology_id, null, 0, 'Test fiszek', array[topics[1], topics[3]], '[]');
  second_assessment := public.save_study_assessment(biology_id, null, 0, 'Powtórzenie fiszek', array[topics[1]], '[]');
  draft_assessment := public.save_study_assessment(biology_id, null, 0, 'Szkic zestawu', array[topics[1]], '[]');
  perform public.publish_study_assessment(biology_id, first_assessment, 0);
  perform public.publish_study_assessment(biology_id, second_assessment, 0);

  for revision in
    select id, topic_id, flashcards->0->>'id' as card_id, array_position(topics, topic_id) as position
    from public.study_topic_revisions where topic_id = any(topics[1:3])
  loop
    perform set_config('fizjoluj_test.flashcard_topic' || revision.position, revision.topic_id::text, true);
    perform set_config('fizjoluj_test.flashcard_revision' || revision.position, revision.id::text, true);
    perform set_config('fizjoluj_test.flashcard_id' || revision.position, revision.card_id, true);
  end loop;
  perform set_config('fizjoluj_test.flashcard_assessment1', first_assessment::text, true);
  perform set_config('fizjoluj_test.flashcard_assessment2', second_assessment::text, true);
  perform set_config('fizjoluj_test.flashcard_draft', draft_assessment::text, true);
end;
$$;

-- The role and assessment checks still run through the production RPC.
create function pg_temp.rate_test_flashcard(
  assessment_setting text, topic_position integer, chosen_rating public.study_flashcard_rating, version integer
)
returns integer language sql as $$
  select public.rate_study_flashcard(
    current_setting('fizjoluj_test.' || assessment_setting)::uuid,
    current_setting('fizjoluj_test.flashcard_topic' || topic_position)::uuid,
    current_setting('fizjoluj_test.flashcard_revision' || topic_position)::uuid,
    current_setting('fizjoluj_test.flashcard_id' || topic_position)::uuid,
    chosen_rating, version
  );
$$;

do $$
begin
  begin
    perform pg_temp.rate_test_flashcard('flashcard_assessment1', 1, 'known', 0);
    raise exception 'Administrator wrote student progress';
  exception when insufficient_privilege then null;
  end;
end;
$$;
select 'ok 1 - only an eligible student can submit personal flashcard progress';

set local request.jwt.claim.sub = '16000000-0000-4000-8000-000000000002';
set local request.jwt.claims = '{"sub":"16000000-0000-4000-8000-000000000002","role":"authenticated"}';
do $$
begin
  if pg_temp.rate_test_flashcard('flashcard_assessment1', 1, 'review', 0) is distinct from 1
    or pg_temp.rate_test_flashcard('flashcard_assessment1', 1, 'review', 0) is distinct from 1 then
    raise exception 'The first rating or its replay did not return the same version';
  end if;
  if (select count(*) from public.study_flashcard_progress where rating = 'review' and edit_version = 1) <> 1 then
    raise exception 'The rating was not stored once';
  end if;
end;
$$;
select 'ok 2 - recording or retrying a rating stores one progress row';

do $$
begin
  if pg_temp.rate_test_flashcard('flashcard_assessment2', 1, 'known', 1) is distinct from 2 then
    raise exception 'The rating in the second assessment did not update the existing row';
  end if;
  if (select count(*) from public.study_flashcard_progress where rating = 'known' and edit_version = 2) <> 1 then
    raise exception 'The same card did not keep its progress across assessments';
  end if;
  begin
    perform pg_temp.rate_test_flashcard('flashcard_assessment1', 1, 'review', 1);
    raise exception 'A concurrent stale rating replaced the current rating';
  exception when serialization_failure then null;
  end;
end;
$$;
select 'ok 3 - both assessments share one progress row and stale writes cannot change it';

do $$
begin
  begin
    perform pg_temp.rate_test_flashcard('flashcard_assessment1', 2, 'known', 0);
    raise exception 'A card from outside the assessment was accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    perform pg_temp.rate_test_flashcard('flashcard_assessment1', 3, 'known', 0);
    raise exception 'An unpublished card was accepted';
  exception when serialization_failure then null;
  end;
  begin
    perform pg_temp.rate_test_flashcard('flashcard_draft', 1, 'known', 0);
    raise exception 'A draft assessment was accepted';
  exception when insufficient_privilege then null;
  end;
end;
$$;
select 'ok 4 - ratings require a published card in the published assessment scope';

set local request.jwt.claim.sub = '16000000-0000-4000-8000-000000000003';
set local request.jwt.claims = '{"sub":"16000000-0000-4000-8000-000000000003","role":"authenticated"}';
do $$
begin
  if exists (select 1 from public.study_flashcard_progress) then
    raise exception 'Second student could read first student progress';
  end if;
  if pg_temp.rate_test_flashcard('flashcard_assessment1', 1, 'review', 0) is distinct from 1 then
    raise exception 'Second student rating did not start at its own version';
  end if;
  if (select count(*) from public.study_flashcard_progress where rating = 'review' and edit_version = 1) <> 1 then
    raise exception 'Second student could not start an independent card review';
  end if;
  begin
    update public.study_flashcard_progress set rating = 'known';
    raise exception 'Direct progress write bypassed the RPC';
  exception when insufficient_privilege then null;
  end;
end;
$$;
select 'ok 5 - both students have isolated, independently persisted ratings';

set local request.jwt.claim.sub = '16000000-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"sub":"16000000-0000-4000-8000-000000000001","role":"authenticated"}';
do $$
declare
  next_revision uuid := public.open_study_topic_draft(current_setting('fizjoluj_test.flashcard_topic1')::uuid);
begin
  if exists (select 1 from public.study_flashcard_progress) then
    raise exception 'Administrator could read student ratings';
  end if;
  perform public.publish_study_topic_draft(next_revision, 0);
  perform set_config('fizjoluj_test.flashcard_next', next_revision::text, true);
end;
$$;
select 'ok 6 - administrator access does not expose personal student progress';

set local request.jwt.claim.sub = '16000000-0000-4000-8000-000000000002';
set local request.jwt.claims = '{"sub":"16000000-0000-4000-8000-000000000002","role":"authenticated"}';
do $$
begin
  begin
    perform pg_temp.rate_test_flashcard('flashcard_assessment1', 1, 'review', 2);
    raise exception 'An archived revision could still be rated';
  exception when serialization_failure then null;
  end;
  if (select rating from public.study_flashcard_progress) is distinct from 'known' then
    raise exception 'The outdated submission changed the existing progress';
  end if;
  if public.rate_study_flashcard(
    current_setting('fizjoluj_test.flashcard_assessment1')::uuid,
    current_setting('fizjoluj_test.flashcard_topic1')::uuid,
    current_setting('fizjoluj_test.flashcard_next')::uuid,
    current_setting('fizjoluj_test.flashcard_id1')::uuid, 'review', 2
  ) is distinct from 3 then
    raise exception 'An unchanged card did not retain its identity in the new publication';
  end if;
end;
$$;
select 'ok 7 - an old publication is rejected and the same card ID retains its progress';

set local request.jwt.claim.sub = '16000000-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"sub":"16000000-0000-4000-8000-000000000001","role":"authenticated"}';
select public.revoke_student_access('16000000-0000-4000-8000-000000000002');
set local request.jwt.claim.sub = '16000000-0000-4000-8000-000000000002';
set local request.jwt.claims = '{"sub":"16000000-0000-4000-8000-000000000002","role":"authenticated"}';
do $$
begin
  if exists (select 1 from public.study_flashcard_progress) then
    raise exception 'Revoked student could read progress from an inaccessible topic';
  end if;
  begin
    perform pg_temp.rate_test_flashcard('flashcard_assessment1', 1, 'known', 3);
    raise exception 'Revoked student could rate a card';
  exception when insufficient_privilege then null;
  end;
end;
$$;
select 'ok 8 - revoked access hides topic progress and prevents rating';

rollback;
