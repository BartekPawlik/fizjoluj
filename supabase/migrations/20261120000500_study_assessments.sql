begin;

create table public.study_assessments (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.study_subjects (id),
  name text not null check (char_length(btrim(name)) between 1 and 250),
  edit_version integer not null default 0 check (edit_version >= 0),
  published_at timestamptz,
  unique (subject_id, name)
);

create table public.study_assessment_topics (
  assessment_id uuid not null references public.study_assessments (id) on delete cascade,
  topic_id uuid not null references public.study_topics (id),
  primary key (assessment_id, topic_id)
);

create table public.study_assessment_dates (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.study_assessments (id) on delete cascade,
  cohort_id uuid not null references public.cohorts (id),
  location_id uuid references public.locations (id),
  scheduled_on date not null check (scheduled_on between date '0001-01-01' and date '9999-12-31'),
  unique nulls not distinct (assessment_id, cohort_id, location_id)
);

create function private.can_read_study_assessment(target_assessment_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.study_assessments as assessment
    join public.study_subjects as subject on subject.id = assessment.subject_id
    where assessment.id = target_assessment_id
      and assessment.published_at is not null
      and private.can_read_study_semester(subject.semester_id)
  );
$$;

alter table public.study_assessments enable row level security;
alter table public.study_assessment_topics enable row level security;
alter table public.study_assessment_dates enable row level security;

revoke all on public.study_assessments, public.study_assessment_topics, public.study_assessment_dates
  from public, anon, authenticated;
grant select on public.study_assessments, public.study_assessment_topics, public.study_assessment_dates
  to authenticated;

create policy study_assessments_read on public.study_assessments for select to authenticated
  using ((select private.is_admin()) or private.can_read_study_assessment(id));

create policy study_assessment_topics_read on public.study_assessment_topics for select to authenticated
  using (
    (select private.is_admin())
    or (private.can_read_study_assessment(assessment_id) and private.can_read_published_study_topic(topic_id))
  );

create policy study_assessment_dates_read on public.study_assessment_dates for select to authenticated
  using (
    (select private.is_admin())
    or (
      private.can_read_study_assessment(assessment_id)
      and exists (
        select 1 from public.memberships as membership
        where membership.user_id = (select auth.uid())
          and membership.active
          and membership.cohort_id = study_assessment_dates.cohort_id
          and (study_assessment_dates.location_id is null or membership.location_id = study_assessment_dates.location_id)
      )
    )
  );

create function public.save_study_assessment(
  target_subject_id uuid, target_assessment_id uuid, expected_version integer, assessment_name text,
  scope_topic_ids uuid[], assessment_dates jsonb
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  subject_institution_id uuid;
  saved_id uuid;
  current_publication timestamptz;
begin
  perform private.require_study_editor();

  if expected_version is null or expected_version < 0
    or coalesce(char_length(btrim(assessment_name)), 0) not between 1 and 250
    or scope_topic_ids is null
    or jsonb_typeof(assessment_dates) is distinct from 'array' then
    raise invalid_parameter_value using message = 'Invalid assessment';
  end if;

  select semester.institution_id into subject_institution_id
  from public.study_subjects as subject
  join public.study_semesters as semester on semester.id = subject.semester_id
  where subject.id = target_subject_id;
  if not found then
    raise invalid_parameter_value using message = 'Unknown assessment subject';
  end if;

  if (
    select count(*) from public.study_topics as topic
    join public.study_sections as section on section.id = topic.section_id
    where section.subject_id = target_subject_id and topic.id = any(scope_topic_ids)
  ) <> cardinality(scope_topic_ids) then
    raise invalid_parameter_value using message = 'Invalid assessment topics';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(assessment_dates) as entry(cohort_id uuid, location_id uuid, scheduled_on date)
    left join public.cohorts as cohort on cohort.id = entry.cohort_id and cohort.institution_id = subject_institution_id
    left join public.locations as location on location.id = entry.location_id and location.institution_id = subject_institution_id
    where cohort.id is null or (entry.location_id is not null and location.id is null)
      or entry.scheduled_on is null or entry.scheduled_on not between date '0001-01-01' and date '9999-12-31'
  ) then
    raise invalid_parameter_value using message = 'Invalid assessment dates';
  end if;

  if target_assessment_id is null then
    if expected_version <> 0 then
      raise invalid_parameter_value using message = 'Invalid initial version';
    end if;
    insert into public.study_assessments (subject_id, name)
      values (target_subject_id, btrim(assessment_name)) returning id into saved_id;
  else
    update public.study_assessments set name = btrim(assessment_name), edit_version = edit_version + 1
    where id = target_assessment_id and subject_id = target_subject_id and edit_version = expected_version
    returning id, published_at into saved_id, current_publication;
    if not found then
      raise serialization_failure using message = 'Assessment has changed';
    end if;
    if current_publication is not null and cardinality(scope_topic_ids) = 0 then
      raise invalid_parameter_value using message = 'A published assessment must have topics';
    end if;
  end if;

  delete from public.study_assessment_topics where assessment_id = saved_id;
  insert into public.study_assessment_topics (assessment_id, topic_id)
    select saved_id, topic_id from unnest(scope_topic_ids) as scope(topic_id);

  delete from public.study_assessment_dates where assessment_id = saved_id;
  insert into public.study_assessment_dates (assessment_id, cohort_id, location_id, scheduled_on)
    select saved_id, entry.cohort_id, entry.location_id, entry.scheduled_on
    from jsonb_to_recordset(assessment_dates) as entry(cohort_id uuid, location_id uuid, scheduled_on date);

  return saved_id;
end;
$$;

create function public.publish_study_assessment(
  target_subject_id uuid, target_assessment_id uuid, expected_version integer
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_study_editor();

  update public.study_assessments set published_at = now(), edit_version = edit_version + 1
    where id = target_assessment_id and subject_id = target_subject_id
      and edit_version = expected_version and published_at is null;
  if not found then
    raise serialization_failure using message = 'Assessment has changed';
  end if;
  if not exists (select 1 from public.study_assessment_topics where assessment_id = target_assessment_id) then
    raise invalid_parameter_value using message = 'An assessment must have topics';
  end if;
end;
$$;

revoke all on function private.can_read_study_assessment(uuid) from public, anon, authenticated;
grant execute on function private.can_read_study_assessment(uuid) to authenticated;

revoke all on function public.save_study_assessment(uuid, uuid, integer, text, uuid[], jsonb),
  public.publish_study_assessment(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.save_study_assessment(uuid, uuid, integer, text, uuid[], jsonb),
  public.publish_study_assessment(uuid, uuid, integer) to authenticated;

notify pgrst, 'reload schema';

commit;
