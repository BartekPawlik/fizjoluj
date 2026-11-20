begin;

select '1..8';

-- Keep rollout tests deterministic as the academic year changes.
create or replace function private.current_academic_year_start()
returns integer language sql stable set search_path = '' as $$ select 2026 $$;

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
values
  ('10000000-0000-4000-8000-000000000001', 'catalog-admin@example.test', now(), '{}'),
  ('10000000-0000-4000-8000-000000000002', 'catalog-poznan@example.test', now(), '{}'),
  ('10000000-0000-4000-8000-000000000003', 'catalog-szczecin@example.test', now(), '{}'),
  ('10000000-0000-4000-8000-000000000004', 'catalog-other-cohort@example.test', now(), '{}'),
  ('10000000-0000-4000-8000-000000000005', 'catalog-pending@example.test', now(), '{}');

update public.profiles set role = 'admin' where user_id = '10000000-0000-4000-8000-000000000001';

insert into public.institutions (id, slug, name)
values ('20000000-0000-4000-8000-000000000001', 'catalog-test-other', 'Druga uczelnia testowa');
insert into public.cohorts (id, institution_id, start_year)
values ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 2026);
insert into public.cohorts (id, institution_id, start_year)
select '30000000-0000-4000-8000-000000000002', id, 2025
from public.institutions where slug = 'fizjoluj-pilot';

do $$
begin
  if (select count(*) from public.study_subjects as subject
    join public.study_semesters as semester on semester.id = subject.semester_id
    join public.institutions as institution on institution.id = semester.institution_id
    where institution.slug = 'fizjoluj-pilot' and semester.semester_number = 1) <> 16 then
    raise exception 'Expected the sixteen approved semester-one subjects';
  end if;
end;
$$;
select 'ok 1 - approved semester-one subjects are seeded once';

set local role anon;
do $$
begin
  begin
    perform name from public.study_subjects;
    raise exception 'An anonymous session could read the catalog';
  exception when insufficient_privilege then null;
  end;
end;
$$;
select 'ok 2 - anonymous catalog access is denied';

set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}';
do $$
declare
  pilot_id uuid := (select id from public.institutions where slug = 'fizjoluj-pilot');
  cohort_2026 uuid := (select id from public.cohorts where institution_id = pilot_id and start_year = 2026);
  poznan_id uuid := (select id from public.locations where institution_id = pilot_id and name = 'Poznań');
  szczecin_id uuid := (select id from public.locations where institution_id = pilot_id and name = 'Szczecin');
  semester_one uuid := (select id from public.study_semesters where institution_id = pilot_id and semester_number = 1);
  hidden_semester uuid := '40000000-0000-4000-8000-000000000002';
  future_semester uuid := '40000000-0000-4000-8000-000000000003';
  anatomy_id uuid := (select id from public.study_subjects where semester_id = semester_one and position = 1);
  visible_revision uuid;
begin
  perform public.grant_student_access('10000000-0000-4000-8000-000000000002', poznan_id, cohort_2026);
  perform public.grant_student_access('10000000-0000-4000-8000-000000000003', szczecin_id, cohort_2026);
  perform public.grant_student_access('10000000-0000-4000-8000-000000000004', poznan_id, '30000000-0000-4000-8000-000000000002');

  insert into public.study_semesters (id, institution_id, semester_number)
  values (hidden_semester, pilot_id, 2), (future_semester, pilot_id, 3);

  perform public.set_study_semester_visibility(hidden_semester, cohort_2026, true);
  perform public.set_study_semester_visibility(hidden_semester, cohort_2026, false);
  perform public.set_study_semester_visibility(future_semester, cohort_2026, true);

  insert into public.study_subjects (id, semester_id, name)
  values ('50000000-0000-4000-8000-000000000002', hidden_semester, 'Ukryty przedmiot'),
    ('50000000-0000-4000-8000-000000000003', future_semester, 'Przedmiot przyszłego roku');
  insert into public.study_sections (id, subject_id, name)
  values ('60000000-0000-4000-8000-000000000001', anatomy_id, 'Dział testowy'),
    ('60000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000002', 'Ukryty dział');
  insert into public.study_topics (id, section_id, name)
  values ('70000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', 'Temat testowy'),
    ('70000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000002', 'Ukryty temat');
  update public.study_topics set name = 'Zmieniony temat testowy', position = 2
  where id = '70000000-0000-4000-8000-000000000001';
  if not found then raise exception 'Administrator could not update a topic'; end if;
  if to_regclass('public.study_topic_revisions') is not null then
    visible_revision := public.open_study_topic_draft('70000000-0000-4000-8000-000000000001');
    perform public.save_study_topic_draft(visible_revision, 0, array['Notatka testowa'], '', '', '', '', '[]', '[]');
    perform public.publish_study_topic_draft(visible_revision, 1);
  end if;

  begin
    perform public.set_study_semester_visibility(semester_one, '30000000-0000-4000-8000-000000000001', true);
    raise exception 'Semester was offered to a different institution';
  exception when invalid_parameter_value then null;
  end;
end;
$$;
select 'ok 3 - admin can manage the hierarchy and availability within the institution';

set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000002';
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}';
do $$
begin
  if (select array_agg(semester_number) from public.study_semesters) is distinct from array[1]
    or (select count(*) from public.study_subjects) <> 16
    or not exists (select 1 from public.study_topics where name = 'Zmieniony temat testowy')
    or exists (select 1 from public.study_subjects where id = '50000000-0000-4000-8000-000000000002')
    or exists (select 1 from public.study_sections where id = '60000000-0000-4000-8000-000000000002')
    or exists (select 1 from public.study_topics where id = '70000000-0000-4000-8000-000000000002') then
    raise exception 'The Poznan student did not see exactly the eligible catalog hierarchy';
  end if;
  begin
    perform public.set_study_semester_visibility('40000000-0000-4000-8000-000000000002', gen_random_uuid(), true);
    raise exception 'Student could change semester visibility';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.study_subjects (semester_id, name)
    select id, 'Niedozwolony zapis' from public.study_semesters where semester_number = 1;
    raise exception 'Student could insert a subject';
  exception when insufficient_privilege then null;
  end;
end;
$$;
select 'ok 4 - Poznan sees the approved hierarchy and hidden IDs cannot be read or written';

set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000003';
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}';
do $$
begin
  if (select count(*) from public.study_subjects) <> 16
    or exists (select 1 from public.study_subjects where id = '50000000-0000-4000-8000-000000000003') then
    raise exception 'Szczecin did not see the shared catalog, or could see the next academic year';
  end if;
end;
$$;
select 'ok 5 - Szczecin sees the same first-year catalog and future offerings stay hidden';

set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000004';
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}';
do $$
begin
  if exists (select 1 from public.study_subjects) then raise exception 'A different cohort could read the catalog'; end if;
end;
$$;
select 'ok 6 - active membership alone does not grant a different cohort access';

set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000005';
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000005","role":"authenticated"}';
do $$
begin
  if exists (select 1 from public.study_subjects) then raise exception 'Pending student could read the catalog'; end if;
end;
$$;
select 'ok 7 - a student awaiting access cannot read the catalog';

set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}';
do $$
begin
  perform public.revoke_student_access('10000000-0000-4000-8000-000000000002');
end;
$$;
set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000002';
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}';
do $$
begin
  if exists (select 1 from public.study_semesters) or exists (select 1 from public.study_subjects)
    or exists (select 1 from public.study_sections) or exists (select 1 from public.study_topics) then
    raise exception 'Revoked membership retained catalog access in the same session';
  end if;
end;
$$;
select 'ok 8 - revocation removes access through all catalog levels for the same JWT';

rollback;
