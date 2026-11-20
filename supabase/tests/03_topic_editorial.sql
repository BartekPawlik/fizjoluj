begin;

select '1..10';

create or replace function private.current_academic_year_start()
returns integer language sql stable set search_path = '' as $$ select 2026 $$;

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
values
  ('11000000-0000-4000-8000-000000000001', 'editorial-admin@example.test', now(), '{}'),
  ('11000000-0000-4000-8000-000000000002', 'editorial-student@example.test', now(), '{}');
update public.profiles set role = 'admin' where user_id = '11000000-0000-4000-8000-000000000001';

do $$
declare
  biology uuid := (select id from public.study_subjects where name = 'Biologia medyczna');
  topic uuid := (select id from public.study_topics where name = 'Rola związków organicznych');
  populated integer;
begin
  if (select count(*) from public.study_sections where subject_id = biology) <> 5 then
    raise exception 'Expected five biology sections';
  end if;
  select count(*) into populated
  from public.study_topic_revisions as revision
  join public.study_topics as item on item.id = revision.topic_id
  join public.study_sections as section on section.id = item.section_id
  join public.study_topic_revision_quizzes as quiz on quiz.revision_id = revision.id
  where section.subject_id = biology and revision.state = 'draft'
    and revision.revision_number = 1 and cardinality(revision.notes) > 0
    and jsonb_array_length(revision.flashcards) = 1
    and jsonb_array_length(quiz.items) = 1
    and jsonb_array_length(quiz.items->0->'options') = 4;
  if populated <> 47 or exists (select 1 from public.study_topic_revisions where state = 'published')
    or (select count(*) from public.study_topic_revisions where correction <> '') <> 11
    or (select count(*) from public.study_topic_revisions where source_url <> '') <> 6 then
    raise exception 'The supplied biology was not loaded completely as drafts';
  end if;
  perform set_config('fizjoluj_test.topic', topic::text, true);
end;
$$;
select 'ok 1 - the supplied biology material consists of five sections and 47 drafts';

set local role anon;
do $$
begin
  begin
    perform notes from public.study_topic_revisions;
    raise exception 'Anonymous draft read was allowed';
  exception when insufficient_privilege then null;
  end;
end;
$$;
select 'ok 2 - a guest cannot read editorial content';

set local role authenticated;
set local request.jwt.claim.sub = '11000000-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"sub":"11000000-0000-4000-8000-000000000001","role":"authenticated"}';
do $$
declare
  topic uuid := current_setting('fizjoluj_test.topic')::uuid;
  draft uuid := public.open_study_topic_draft(topic);
  location uuid := (select id from public.locations where name = 'Poznań');
  cohort uuid := (select id from public.cohorts where start_year = 2026);
  upload_path text := draft::text || '/12000000-0000-4000-8000-000000000001.png';
begin
  perform public.grant_student_access('11000000-0000-4000-8000-000000000002', location, cohort);
  if draft is distinct from public.open_study_topic_draft(topic)
    or not exists (select 1 from public.study_topic_revision_quizzes where revision_id = draft and items <> '[]') then
    raise exception 'The administrator could not preview the stored quiz and draft';
  end if;
  insert into storage.objects (bucket_id, name, metadata)
  values ('study-topic-assets', upload_path, '{"mimetype":"image/png"}');
  perform public.attach_study_topic_asset(draft, 0, upload_path, 'Test figure', 'Test alternative text', 'image/png');
  perform set_config('fizjoluj_test.draft1', draft::text, true);
  perform set_config('fizjoluj_test.path', upload_path, true);
  perform set_config('fizjoluj_test.asset1',
    (select id::text from public.study_topic_revision_assets where revision_id = draft), true);
end;
$$;
select 'ok 3 - administrator reopens the seeded draft and attaches a private asset';

set local request.jwt.claim.sub = '11000000-0000-4000-8000-000000000002';
set local request.jwt.claims = '{"sub":"11000000-0000-4000-8000-000000000002","role":"authenticated"}';
do $$
begin
  if exists (select 1 from public.study_topics where id = current_setting('fizjoluj_test.topic')::uuid)
    or exists (select 1 from public.study_topic_revisions)
    or exists (select 1 from public.study_topic_revision_quizzes)
    or exists (select 1 from public.study_topic_revision_assets)
    or exists (select 1 from storage.objects where name = current_setting('fizjoluj_test.path')) then
    raise exception 'An active student could read a draft or draft attachment';
  end if;
  begin
    perform public.publish_study_topic_draft(current_setting('fizjoluj_test.draft1')::uuid, 1);
    raise exception 'Student published a draft';
  exception when insufficient_privilege then null;
  end;
end;
$$;
select 'ok 4 - students cannot read drafts, use draft files, or publish';

set local request.jwt.claim.sub = '11000000-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"sub":"11000000-0000-4000-8000-000000000001","role":"authenticated"}';
do $$
begin
  perform public.publish_study_topic_draft(current_setting('fizjoluj_test.draft1')::uuid, 1);
end;
$$;

set local request.jwt.claim.sub = '11000000-0000-4000-8000-000000000002';
set local request.jwt.claims = '{"sub":"11000000-0000-4000-8000-000000000002","role":"authenticated"}';
do $$
begin
  if not exists (select 1 from public.study_topics where id = current_setting('fizjoluj_test.topic')::uuid)
    or (select array_agg(revision_number) from public.study_topic_revisions) is distinct from array[1]
    or not exists (select 1 from public.study_topic_revision_assets where id = current_setting('fizjoluj_test.asset1')::uuid)
    or not exists (select 1 from storage.objects where name = current_setting('fizjoluj_test.path'))
    or exists (select 1 from public.study_topic_revision_quizzes) then
    raise exception 'The student could not read the publication, or could read its answer key';
  end if;
end;
$$;
select 'ok 5 - publication exposes the topic and file but keeps the quiz answer key private';

set local request.jwt.claim.sub = '11000000-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"sub":"11000000-0000-4000-8000-000000000001","role":"authenticated"}';
do $$
declare
  topic uuid := current_setting('fizjoluj_test.topic')::uuid;
  first uuid := current_setting('fizjoluj_test.draft1')::uuid;
  next_draft uuid := public.open_study_topic_draft(topic);
  original_cards jsonb := (select flashcards from public.study_topic_revisions where id = first);
  original_quiz jsonb := (select items from public.study_topic_revision_quizzes where revision_id = first);
begin
  if not exists (select 1 from public.study_topic_revisions
      where id = next_draft and state = 'draft' and revision_number = 2 and flashcards = original_cards)
    or not exists (select 1 from public.study_topic_revision_assets where revision_id = next_draft)
    or original_quiz is distinct from (select items from public.study_topic_revision_quizzes where revision_id = next_draft) then
    raise exception 'Opening a draft did not clone the publication';
  end if;

  perform public.save_study_topic_draft(next_draft, 0, array['Second version notes'], '', '', '', '', original_cards, original_quiz);
  begin
    perform public.save_study_topic_draft(next_draft, 1, array['Invalid change'], '', '', '', '', '[]', '[{}]');
    raise exception 'An invalid quiz was accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.publish_study_topic_draft(next_draft, 0);
    raise exception 'The old preview was able to publish';
  exception when serialization_failure then null;
  end;
  perform set_config('fizjoluj_test.draft2', next_draft::text, true);
end;
$$;
select 'ok 6 - the next draft copies content and rejects invalid edits and stale publication';

set local request.jwt.claim.sub = '11000000-0000-4000-8000-000000000002';
set local request.jwt.claims = '{"sub":"11000000-0000-4000-8000-000000000002","role":"authenticated"}';
do $$
begin
  if (select array_agg(revision_number) from public.study_topic_revisions) is distinct from array[1]
    or exists (select 1 from public.study_topic_revisions where 'Second version notes' = any(notes)) then
    raise exception 'Editing a draft changed the live student material';
  end if;
end;
$$;
select 'ok 7 - the previously published notes remain visible while editing the second version';

set local request.jwt.claim.sub = '11000000-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"sub":"11000000-0000-4000-8000-000000000001","role":"authenticated"}';
do $$
begin
  perform public.publish_study_topic_draft(current_setting('fizjoluj_test.draft2')::uuid, 1);
  if (select state from public.study_topic_revisions where id = current_setting('fizjoluj_test.draft1')::uuid) <> 'archived' then
    raise exception 'Old publication was not archived';
  end if;
end;
$$;

set local request.jwt.claim.sub = '11000000-0000-4000-8000-000000000002';
set local request.jwt.claims = '{"sub":"11000000-0000-4000-8000-000000000002","role":"authenticated"}';
do $$
begin
  if (select array_agg(revision_number) from public.study_topic_revisions) is distinct from array[2]
    or not exists (select 1 from public.study_topic_revisions where 'Second version notes' = any(notes))
    or exists (select 1 from public.study_topic_revision_assets where id = current_setting('fizjoluj_test.asset1')::uuid)
    or not exists (select 1 from storage.objects where name = current_setting('fizjoluj_test.path')) then
    raise exception 'Publication did not switch to the second version and retain its cloned asset';
  end if;
end;
$$;
select 'ok 8 - publishing switches all student reads to the new revision';

set local request.jwt.claim.sub = '11000000-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"sub":"11000000-0000-4000-8000-000000000001","role":"authenticated"}';
do $$
begin
  perform public.revoke_student_access('11000000-0000-4000-8000-000000000002');
end;
$$;

set local request.jwt.claim.sub = '11000000-0000-4000-8000-000000000002';
set local request.jwt.claims = '{"sub":"11000000-0000-4000-8000-000000000002","role":"authenticated"}';
do $$
begin
  if exists (select 1 from public.study_topic_revisions)
    or exists (select 1 from storage.objects where name = current_setting('fizjoluj_test.path')) then
    raise exception 'Revoked student retained notes or attachments';
  end if;
end;
$$;
select 'ok 9 - membership revocation prevents reads of published text and files';

set local request.jwt.claim.sub = '11000000-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"sub":"11000000-0000-4000-8000-000000000001","role":"authenticated"}';
do $$
declare
  location uuid := (select id from public.locations where name = 'Poznań');
  cohort uuid := (select id from public.cohorts where start_year = 2026);
begin
  perform public.grant_student_access('11000000-0000-4000-8000-000000000002', location, cohort);
  perform public.withdraw_study_topic_publication(current_setting('fizjoluj_test.topic')::uuid,
    current_setting('fizjoluj_test.draft2')::uuid);
end;
$$;

set local request.jwt.claim.sub = '11000000-0000-4000-8000-000000000002';
set local request.jwt.claims = '{"sub":"11000000-0000-4000-8000-000000000002","role":"authenticated"}';
do $$
begin
  if exists (select 1 from public.study_topics where id = current_setting('fizjoluj_test.topic')::uuid)
    or exists (select 1 from public.study_topic_revisions)
    or exists (select 1 from storage.objects where name = current_setting('fizjoluj_test.path')) then
    raise exception 'A withdrawn publication was accessible';
  end if;
end;
$$;
select 'ok 10 - withdrawing a publication hides its topic and files';

rollback;
