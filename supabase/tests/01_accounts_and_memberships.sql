begin;

select '1..6';

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
values
  ('11111111-1111-4111-8111-111111111111', 'student-a@example.test', now(), '{"role":"admin"}'),
  ('22222222-2222-4222-8222-222222222222', 'student-b@example.test', now(), '{}'),
  ('33333333-3333-4333-8333-333333333333', 'admin@example.test', now(), '{}'),
  ('44444444-4444-4444-8444-444444444444', 'pending@example.test', null, '{}');

update public.profiles set role = 'admin' where user_id = '33333333-3333-4333-8333-333333333333';

insert into public.institutions (id, slug, name)
values ('55555555-5555-4555-8555-555555555555', 'second-test-institution', 'Test institution');
insert into public.cohorts (id, institution_id, start_year)
values ('66666666-6666-4666-8666-666666666666', '55555555-5555-4555-8555-555555555555', 2026);

set local role anon;
do $$
begin
  begin
    perform email from public.profiles;
    raise exception 'Anonymous profile read was allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.revoke_student_access('11111111-1111-4111-8111-111111111111');
    raise exception 'Anonymous membership change was allowed';
  exception when insufficient_privilege then null;
  end;
end;
$$;
select 'ok 1 - anonymous role has no account or membership access';

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
do $$
begin
  if (select count(*) from public.profiles) <> 1
    or not exists (select 1 from public.profiles where email = 'student-a@example.test' and role = 'student')
    or exists (select 1 from public.locations)
    or private.is_admin() then
    raise exception 'Student should see only their own profile without an active membership';
  end if;
  begin
    update public.profiles set role = 'admin' where user_id = auth.uid();
    raise exception 'Student role escalation was allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.grant_student_access(auth.uid(), gen_random_uuid(), gen_random_uuid());
    raise exception 'Student was allowed to grant access';
  exception when insufficient_privilege then null;
  end;
end;
$$;
select 'ok 2 - pending student is isolated and cannot change roles or memberships';

set local request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';
set local request.jwt.claims = '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}';
do $$
declare
  poznan_id uuid := (select id from public.locations where name = 'Poznań');
  szczecin_id uuid := (select id from public.locations where name = 'Szczecin');
  pilot_intake uuid := (select cohort.id from public.cohorts as cohort
    join public.institutions as institution on institution.id = cohort.institution_id
    where institution.slug = 'fizjoluj-pilot');
begin
  if not private.is_admin() or (select count(*) from public.profiles where email like '%@example.test') <> 4 then
    raise exception 'Admin must be able to read student accounts';
  end if;
  perform public.grant_student_access('11111111-1111-4111-8111-111111111111', poznan_id, pilot_intake);
  perform public.grant_student_access('11111111-1111-4111-8111-111111111111', poznan_id, pilot_intake);
  perform public.grant_student_access('22222222-2222-4222-8222-222222222222', szczecin_id, pilot_intake);
  begin
    perform public.grant_student_access('11111111-1111-4111-8111-111111111111', poznan_id, '66666666-6666-4666-8666-666666666666');
    raise exception 'Mismatched institution was accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.grant_student_access('44444444-4444-4444-8444-444444444444', poznan_id, pilot_intake);
    raise exception 'Unconfirmed student was accepted';
  exception when invalid_parameter_value then null;
  end;
end;
$$;
select 'ok 3 - admin can assign a valid scope and invalid scopes are rejected';

set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
do $$
begin
  if not private.has_study_access()
    or (select array_agg(name) from public.locations) is distinct from array['Poznań']
    or (select count(*) from public.memberships) <> 1
    or (select array_agg(start_year) from public.cohorts) is distinct from array[2026] then
    raise exception 'Poznan student should see only their own active placement';
  end if;
end;
$$;
select 'ok 4 - Poznan student sees only their active placement';

set local request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
do $$
begin
  if not private.has_study_access()
    or (select array_agg(name) from public.locations) is distinct from array['Szczecin']
    or (select array_agg(email) from public.profiles) is distinct from array['student-b@example.test'] then
    raise exception 'Szczecin student should see only their own profile and location';
  end if;
end;
$$;
select 'ok 5 - Szczecin student is isolated from the first student';

set local request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';
set local request.jwt.claims = '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}';
do $$
begin
  perform public.revoke_student_access('11111111-1111-4111-8111-111111111111');
  perform public.revoke_student_access('11111111-1111-4111-8111-111111111111');
end;
$$;

set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
do $$
begin
  if private.has_study_access()
    or exists (select 1 from public.locations)
    or exists (select 1 from public.institutions)
    or not exists (select 1 from public.memberships where not active) then
    raise exception 'Revoked student retained access or lost access to their own status';
  end if;
end;
$$;
select 'ok 6 - membership revocation applies with the same student JWT';

rollback;
