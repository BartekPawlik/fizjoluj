create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create type public.app_role as enum ('student', 'admin');

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  email_confirmed_at timestamptz,
  role public.app_role not null default 'student'
);

create table public.institutions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id),
  name text not null,
  unique (institution_id, name),
  unique (institution_id, id)
);

create table public.cohorts (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id),
  start_year integer not null check (start_year between 2000 and 9999),
  unique (institution_id, start_year),
  unique (institution_id, id)
);

create table public.memberships (
  user_id uuid primary key references public.profiles(user_id) on delete cascade,
  institution_id uuid not null,
  location_id uuid not null,
  cohort_id uuid not null,
  active boolean not null,
  foreign key (institution_id, location_id) references public.locations(institution_id, id),
  foreign key (institution_id, cohort_id) references public.cohorts(institution_id, id)
);

create function private.sync_auth_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if nullif(new.email, '') is not null then
    insert into public.profiles (user_id, email, email_confirmed_at)
    values (new.id, new.email, new.email_confirmed_at)
    on conflict (user_id) do update
    set email = excluded.email, email_confirmed_at = excluded.email_confirmed_at;
  else
    update public.profiles
    set email_confirmed_at = null
    where user_id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function private.sync_auth_profile() from public, anon, authenticated;

create trigger sync_auth_profile
  after insert or update of email, email_confirmed_at on auth.users
  for each row execute function private.sync_auth_profile();

insert into public.profiles (user_id, email, email_confirmed_at)
select id, email, email_confirmed_at from auth.users where nullif(email, '') is not null
on conflict (user_id) do update
set email = excluded.email, email_confirmed_at = excluded.email_confirmed_at;

create function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles as profile
    where profile.user_id = (select auth.uid())
      and profile.role = 'admin'
      and profile.email_confirmed_at is not null
  );
$$;

create function private.has_study_access()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships as membership
    join public.profiles as profile using (user_id)
    where membership.user_id = (select auth.uid())
      and membership.active
      and profile.role = 'student'
      and profile.email_confirmed_at is not null
  );
$$;

revoke all on function private.is_admin(), private.has_study_access()
  from public, anon, authenticated;
grant execute on function private.is_admin(), private.has_study_access()
  to authenticated;

alter table public.profiles enable row level security;
alter table public.institutions enable row level security;
alter table public.locations enable row level security;
alter table public.cohorts enable row level security;
alter table public.memberships enable row level security;

revoke all on public.profiles, public.institutions, public.locations, public.cohorts, public.memberships
  from public, anon, authenticated;
grant select on public.profiles, public.institutions, public.locations, public.cohorts, public.memberships
  to authenticated;

create policy profiles_read on public.profiles for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

create policy memberships_read on public.memberships for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

create policy institutions_read on public.institutions for select to authenticated
  using (
    (select private.is_admin())
    or ((select private.has_study_access()) and id in (
      select institution_id from public.memberships where user_id = (select auth.uid())
    ))
  );

create policy locations_read on public.locations for select to authenticated
  using (
    (select private.is_admin())
    or ((select private.has_study_access()) and id in (
      select location_id from public.memberships where user_id = (select auth.uid())
    ))
  );

create policy cohorts_read on public.cohorts for select to authenticated
  using (
    (select private.is_admin())
    or ((select private.has_study_access()) and id in (
      select cohort_id from public.memberships where user_id = (select auth.uid())
    ))
  );

create function public.grant_student_access(student_id uuid, campus_id uuid, intake_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    raise insufficient_privilege using message = 'Administrator access required';
  end if;

  if not exists (
    select 1 from public.profiles as profile
    where profile.user_id = student_id and profile.role = 'student' and profile.email_confirmed_at is not null
  ) then
    raise invalid_parameter_value using message = 'A verified student profile is required';
  end if;

  insert into public.memberships (user_id, institution_id, location_id, cohort_id, active)
  select student_id, location.institution_id, location.id, cohort.id, true
  from public.locations as location
  join public.cohorts as cohort on cohort.institution_id = location.institution_id
  where location.id = campus_id and cohort.id = intake_id
  on conflict (user_id) do update set
    institution_id = excluded.institution_id,
    location_id = excluded.location_id,
    cohort_id = excluded.cohort_id,
    active = true;

  if not found then
    raise invalid_parameter_value using message = 'The location and cohort must belong to the same institution';
  end if;
end;
$$;

create function public.revoke_student_access(student_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    raise insufficient_privilege using message = 'Administrator access required';
  end if;

  update public.memberships set active = false where user_id = student_id and active;
end;
$$;

revoke all on function public.grant_student_access(uuid, uuid, uuid), public.revoke_student_access(uuid)
  from public, anon, authenticated;
grant execute on function public.grant_student_access(uuid, uuid, uuid), public.revoke_student_access(uuid)
  to authenticated;

insert into public.institutions (slug, name) values ('fizjoluj-pilot', 'Uczelnia pilotażowa');

insert into public.locations (institution_id, name)
select id, campus.name from public.institutions
cross join (values ('Poznań'), ('Szczecin')) as campus(name)
where slug = 'fizjoluj-pilot';

insert into public.cohorts (institution_id, start_year)
select id, 2026 from public.institutions where slug = 'fizjoluj-pilot';
