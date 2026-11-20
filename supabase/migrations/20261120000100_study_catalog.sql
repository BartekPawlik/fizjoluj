begin;

create table public.study_semesters (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id),
  semester_number integer not null check (semester_number between 1 and 10),
  study_year integer generated always as ((semester_number + 1) / 2) stored,
  unique (institution_id, semester_number),
  unique (institution_id, id)
);

create table public.study_semester_offerings (
  institution_id uuid not null,
  semester_id uuid not null,
  cohort_id uuid not null,
  is_visible boolean not null default false,
  primary key (semester_id, cohort_id),
  foreign key (institution_id, semester_id) references public.study_semesters (institution_id, id),
  foreign key (institution_id, cohort_id) references public.cohorts (institution_id, id)
);

create table public.study_subjects (
  id uuid primary key default gen_random_uuid(),
  semester_id uuid not null references public.study_semesters (id),
  name text not null check (char_length(btrim(name)) between 1 and 250),
  position integer not null default 0 check (position between 0 and 9999),
  unique (semester_id, name)
);

create table public.study_sections (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.study_subjects (id),
  name text not null check (char_length(btrim(name)) between 1 and 250),
  position integer not null default 0 check (position between 0 and 9999),
  unique (subject_id, name)
);

create table public.study_topics (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.study_sections (id),
  name text not null check (char_length(btrim(name)) between 1 and 250),
  position integer not null default 0 check (position between 0 and 9999),
  unique (section_id, name)
);

create function private.current_academic_year_start()
returns integer language sql stable set search_path = '' as $$
  select extract(year from (current_timestamp at time zone 'Europe/Warsaw') - interval '9 months')::integer;
$$;

revoke all on function private.current_academic_year_start() from public, anon, authenticated;

create function private.can_read_study_semester(target_semester_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select private.has_study_access()) and exists (
    select 1
    from public.memberships as membership
    join public.cohorts as cohort on cohort.id = membership.cohort_id
    join public.study_semester_offerings as offering
      on offering.institution_id = membership.institution_id and offering.cohort_id = membership.cohort_id
    join public.study_semesters as semester on semester.id = offering.semester_id
    where membership.user_id = (select auth.uid())
      and semester.id = target_semester_id
      and offering.is_visible
      and cohort.start_year + semester.study_year - 1 <= private.current_academic_year_start()
  );
$$;

revoke all on function private.can_read_study_semester(uuid) from public, anon, authenticated;
grant execute on function private.can_read_study_semester(uuid) to authenticated;

alter table public.study_semesters enable row level security;
alter table public.study_semester_offerings enable row level security;
alter table public.study_subjects enable row level security;
alter table public.study_sections enable row level security;
alter table public.study_topics enable row level security;

revoke all on public.study_semesters, public.study_semester_offerings, public.study_subjects,
  public.study_sections, public.study_topics from public, anon, authenticated;
grant select, insert on public.study_semesters, public.study_semester_offerings, public.study_subjects,
  public.study_sections, public.study_topics to authenticated;
grant update (is_visible) on public.study_semester_offerings to authenticated;
grant update (name, position) on public.study_subjects, public.study_sections, public.study_topics to authenticated;

create policy study_semesters_admin on public.study_semesters for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy study_offerings_admin on public.study_semester_offerings for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy study_subjects_admin on public.study_subjects for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy study_sections_admin on public.study_sections for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy study_topics_admin on public.study_topics for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy study_semesters_student_read on public.study_semesters for select to authenticated
  using (private.can_read_study_semester(id));
create policy study_subjects_student_read on public.study_subjects for select to authenticated
  using (exists (select 1 from public.study_semesters as semester where semester.id = semester_id));
create policy study_sections_student_read on public.study_sections for select to authenticated
  using (exists (select 1 from public.study_subjects as subject where subject.id = subject_id));
create policy study_topics_student_read on public.study_topics for select to authenticated
  using (exists (select 1 from public.study_sections as section where section.id = section_id));

create function public.set_study_semester_visibility(
  target_semester_id uuid, target_cohort_id uuid, visible boolean
)
returns void language plpgsql set search_path = '' as $$
begin
  if not private.is_admin() then
    raise insufficient_privilege using message = 'Administrator access required';
  end if;

  insert into public.study_semester_offerings (institution_id, semester_id, cohort_id, is_visible)
  select semester.institution_id, semester.id, cohort.id, visible
  from public.study_semesters as semester
  join public.cohorts as cohort on cohort.institution_id = semester.institution_id
  where semester.id = target_semester_id and cohort.id = target_cohort_id
  on conflict (semester_id, cohort_id) do update set is_visible = excluded.is_visible;

  if not found then
    raise invalid_parameter_value using message = 'The semester and cohort must belong to the same institution';
  end if;
end;
$$;

revoke all on function public.set_study_semester_visibility(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.set_study_semester_visibility(uuid, uuid, boolean) to authenticated;

-- The supplied curriculum is shared by both campuses for the 2026 cohort.
insert into public.study_semesters (institution_id, semester_number)
select id, 1 from public.institutions where slug = 'fizjoluj-pilot';

insert into public.study_semester_offerings (institution_id, semester_id, cohort_id, is_visible)
select semester.institution_id, semester.id, cohort.id, true
from public.study_semesters as semester
join public.institutions as institution on institution.id = semester.institution_id
join public.cohorts as cohort on cohort.institution_id = semester.institution_id and cohort.start_year = 2026
where institution.slug = 'fizjoluj-pilot' and semester.semester_number = 1;

insert into public.study_subjects (semester_id, name, position)
select semester.id, subject.name, subject.position
from public.study_semesters as semester
join public.institutions as institution on institution.id = semester.institution_id
cross join (values
  ('Anatomia (prawidłowa, funkcjonalna, rentgenowska, palpacyjna)', 1),
  ('Biologia medyczna', 2),
  ('Genetyka', 3),
  ('Biofizyka', 4),
  ('Pierwsza pomoc przedmedyczna z BHP', 5),
  ('Biochemia', 6),
  ('Język obcy zawodowy', 7),
  ('Psychologia (psychologia ogólna z elementami psychologii klinicznej, psychoterapii i komunikacji klinicznej)', 8),
  ('Demografia i epidemiologia', 9),
  ('Historia fizjoterapii', 10),
  ('Zdrowie publiczne', 11),
  ('Fizjoterapia ogólna', 12),
  ('Kształcenie ruchowe i metodyka nauczania ruchu', 13),
  ('Teoria i pracownia masażu', 14),
  ('Szkolenie BHP', 15),
  ('Zajęcia biblioteczne', 16)
) as subject(name, position)
where institution.slug = 'fizjoluj-pilot' and semester.semester_number = 1;

notify pgrst, 'reload schema';

commit;
