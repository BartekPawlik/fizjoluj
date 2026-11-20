begin;

select '1..8';

create or replace function private.current_academic_year_start()
returns integer language sql stable set search_path = '' as $$ select 2026 $$;

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
values
  ('13000000-0000-4000-8000-000000000001', 'bulk-admin@example.test', now(), '{}'),
  ('13000000-0000-4000-8000-000000000002', 'bulk-student@example.test', now(), '{}');
update public.profiles set role = 'admin' where user_id = '13000000-0000-4000-8000-000000000001';

do $$
declare
  biology_id uuid := (select id from public.study_subjects where name = 'Biologia medyczna');
  genetics_id uuid := (select id from public.study_subjects where name = 'Genetyka');
  other_section uuid;
  other_topic uuid;
  other_draft uuid;
  ids uuid[];
  versions integer[];
begin
  insert into public.study_sections (subject_id, name, position)
  values (genetics_id, 'Test section', 1) returning id into other_section;
  insert into public.study_topics (section_id, name, position)
  values (other_section, 'Test topic', 1) returning id into other_topic;
  insert into public.study_topic_revisions (topic_id, revision_number, notes)
  values (other_topic, 1, array['Test notes']) returning id into other_draft;

  select array_agg(revision.id order by topic.id), array_agg(revision.edit_version order by topic.id)
    into ids, versions
    from public.study_sections as section
    join public.study_topics as topic on topic.section_id = section.id
    join public.study_topic_revisions as revision on revision.topic_id = topic.id and revision.state = 'draft'
    where section.subject_id = biology_id;
  if cardinality(ids) is distinct from 47 then
    raise exception 'Expected 47 biology drafts';
  end if;
  perform set_config('fizjoluj_test.bulk_subject', biology_id::text, true);
  perform set_config('fizjoluj_test.bulk_other_draft', other_draft::text, true);
  perform set_config('fizjoluj_test.bulk_ids', ids::text, true);
  perform set_config('fizjoluj_test.bulk_versions', versions::text, true);
end;
$$;

set local role anon;
do $$
begin
  begin
    perform public.publish_study_subject_drafts(
      current_setting('fizjoluj_test.bulk_subject')::uuid,
      current_setting('fizjoluj_test.bulk_ids')::uuid[],
      current_setting('fizjoluj_test.bulk_versions')::integer[]
    );
    raise exception 'A guest could publish a batch';
  exception when insufficient_privilege then null;
  end;
end;
$$;
select 'ok 1 - guests cannot publish a batch';

set local role authenticated;
set local request.jwt.claim.sub = '13000000-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"sub":"13000000-0000-4000-8000-000000000001","role":"authenticated"}';
select public.grant_student_access(
  '13000000-0000-4000-8000-000000000002',
  (select id from public.locations where name = 'Poznań'),
  (select id from public.cohorts where start_year = 2026)
);

set local request.jwt.claim.sub = '13000000-0000-4000-8000-000000000002';
set local request.jwt.claims = '{"sub":"13000000-0000-4000-8000-000000000002","role":"authenticated"}';
do $$
begin
  begin
    perform public.publish_study_subject_drafts(
      current_setting('fizjoluj_test.bulk_subject')::uuid,
      current_setting('fizjoluj_test.bulk_ids')::uuid[],
      current_setting('fizjoluj_test.bulk_versions')::integer[]
    );
    raise exception 'A student could publish a batch';
  exception when insufficient_privilege then null;
  end;
  if exists (select 1 from public.study_topic_revisions) then
    raise exception 'The unpublished materials became visible to the student';
  end if;
end;
$$;
select 'ok 2 - an active student cannot read drafts or publish a batch';

set local request.jwt.claim.sub = '13000000-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"sub":"13000000-0000-4000-8000-000000000001","role":"authenticated"}';
do $$
declare
  subject_id uuid := current_setting('fizjoluj_test.bulk_subject')::uuid;
  ids uuid[] := current_setting('fizjoluj_test.bulk_ids')::uuid[];
  versions integer[] := current_setting('fizjoluj_test.bulk_versions')::integer[];
  other_draft uuid := current_setting('fizjoluj_test.bulk_other_draft')::uuid;
  swapped_ids uuid[] := ids;
  last_index integer := cardinality(ids);
begin
  begin
    perform public.publish_study_subject_drafts(subject_id, array[ids[1], ids[1]], array[0, 0]);
    raise exception 'The same draft was accepted twice';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.publish_study_subject_drafts(subject_id, ids, array[0]);
    raise exception 'Unequal arrays were accepted';
  exception when invalid_parameter_value then null;
  end;

  swapped_ids[last_index] := other_draft;
  begin
    perform public.publish_study_subject_drafts(subject_id, swapped_ids, versions);
    raise exception 'A draft from another subject was accepted';
  exception when serialization_failure then null;
  end;
  if exists (select 1 from public.study_topic_revisions where state = 'published') then
    raise exception 'Some drafts were published despite an inconsistent list';
  end if;
end;
$$;
select 'ok 3 - invalid arrays and a draft from a different subject are rejected';

do $$
declare
  subject_id uuid := current_setting('fizjoluj_test.bulk_subject')::uuid;
  ids uuid[] := current_setting('fizjoluj_test.bulk_ids')::uuid[];
  versions integer[] := current_setting('fizjoluj_test.bulk_versions')::integer[];
  last_index integer := cardinality(ids);
begin
  perform public.save_study_topic_draft(ids[last_index], versions[last_index], array['New notes'], '', '', '', '', '[]', '[]');
  begin
    perform public.publish_study_subject_drafts(subject_id, ids, versions);
    raise exception 'A stale preview could publish';
  exception when serialization_failure then null;
  end;
  if exists (select 1 from public.study_topic_revisions where state = 'published') then
    raise exception 'Prior drafts were committed despite a stale draft';
  end if;

  versions[last_index] := versions[last_index] + 1;
  perform public.save_study_topic_draft(ids[last_index], versions[last_index], '{}', '', '', '', '', '[]', '[]');
  versions[last_index] := versions[last_index] + 1;
  begin
    perform public.publish_study_subject_drafts(subject_id, ids, versions);
    raise exception 'An empty draft was published';
  exception when invalid_parameter_value then null;
  end;
  if exists (select 1 from public.study_topic_revisions where state = 'published') then
    raise exception 'Prior drafts were committed despite empty material';
  end if;

  perform public.save_study_topic_draft(ids[last_index], versions[last_index], array['Restored notes'], '', '', '', '', '[]', '[]');
  versions[last_index] := versions[last_index] + 1;
  perform set_config('fizjoluj_test.bulk_versions', versions::text, true);
end;
$$;
select 'ok 4 - changes to a draft after preview cancel the whole batch';
select 'ok 5 - an empty draft cancels the whole batch';

do $$
declare
  subject_id uuid := current_setting('fizjoluj_test.bulk_subject')::uuid;
  ids uuid[] := current_setting('fizjoluj_test.bulk_ids')::uuid[];
  versions integer[] := current_setting('fizjoluj_test.bulk_versions')::integer[];
  other_draft uuid := current_setting('fizjoluj_test.bulk_other_draft')::uuid;
begin
  perform public.publish_study_topic_draft(ids[1], versions[1]);
  begin
    perform public.publish_study_subject_drafts(subject_id, ids, versions);
    raise exception 'A preview that contained an already published draft was accepted';
  exception when serialization_failure then null;
  end;
  if (select count(*) from public.study_topic_revisions where state = 'published') <> 1 then
    raise exception 'The rejected batch changed the previous publication';
  end if;

  perform public.publish_study_subject_drafts(subject_id, ids[2:47], versions[2:47]);
  if (select count(*) from public.study_topic_revisions where id = any(ids) and state = 'published') <> 47
    or (select state from public.study_topic_revisions where id = other_draft) is distinct from 'draft' then
    raise exception 'The wrong set of drafts was published';
  end if;

  begin
    perform public.publish_study_subject_drafts(subject_id, ids[2:47], versions[2:47]);
    raise exception 'The same batch was allowed twice';
  exception when serialization_failure then null;
  end;
end;
$$;
select 'ok 6 - only the remaining drafts of the selected subject are published';
select 'ok 7 - submitting the same confirmation again preserves the result';

set local request.jwt.claim.sub = '13000000-0000-4000-8000-000000000002';
set local request.jwt.claims = '{"sub":"13000000-0000-4000-8000-000000000002","role":"authenticated"}';
do $$
begin
  if (select count(*) from public.study_topics) <> 47
    or (select count(*) from public.study_topic_revisions where state = 'published') <> 47
    or exists (select 1 from public.study_topic_revision_quizzes) then
    raise exception 'The student cannot see the full publication or can see private content';
  end if;
end;
$$;
select 'ok 8 - the student sees the complete material with quiz answers kept private';

rollback;
