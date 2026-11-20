begin;

create type public.study_revision_state as enum ('draft', 'published', 'archived');

create table public.study_topic_revisions (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.study_topics (id),
  revision_number integer not null check (revision_number > 0),
  edit_version integer not null default 0 check (edit_version >= 0),
  state public.study_revision_state not null default 'draft',
  notes text[] not null default '{}' check (cardinality(notes) <= 100),
  mnemonic text not null default '' check (char_length(mnemonic) <= 4000),
  correction text not null default '' check (char_length(correction) <= 4000),
  source_label text not null default '' check (char_length(source_label) <= 200),
  source_url text not null default '' check (char_length(source_url) <= 2048),
  flashcards jsonb not null default '[]',
  published_at timestamptz,
  check ((source_label = '' and source_url = '') or
    (btrim(source_label) <> '' and source_url ~ '^https://[^[:space:]/]+[^[:space:]]*$')),
  unique (topic_id, revision_number)
);

create unique index study_topic_one_draft on public.study_topic_revisions (topic_id) where state = 'draft';
create unique index study_topic_one_publication on public.study_topic_revisions (topic_id) where state = 'published';

create table public.study_topic_revision_quizzes (
  revision_id uuid primary key references public.study_topic_revisions (id) on delete cascade,
  items jsonb not null default '[]'
);

create table public.study_topic_revision_assets (
  id uuid primary key default gen_random_uuid(),
  revision_id uuid not null references public.study_topic_revisions (id) on delete cascade,
  object_path text not null,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  alt_text text not null default '' check (char_length(alt_text) <= 300),
  content_type text not null check (content_type in ('image/png', 'image/jpeg', 'image/webp', 'application/pdf')),
  check (content_type = 'application/pdf' or btrim(alt_text) <> ''),
  created_at timestamptz not null default now(),
  unique (revision_id, object_path)
);
create index study_topic_assets_object on public.study_topic_revision_assets (object_path);

create function private.valid_study_items(items jsonb, quiz boolean)
returns boolean language plpgsql immutable set search_path = '' as $$
declare
  item jsonb;
  option_value jsonb;
  seen_ids text[] := '{}';
begin
  if jsonb_typeof(items) is distinct from 'array' then return false; end if;
  if jsonb_array_length(items) > 40 then return false; end if;
  for item in select value from jsonb_array_elements(items) loop
    if jsonb_typeof(item) is distinct from 'object'
      or jsonb_typeof(item->'id') is distinct from 'string'
      or (item->>'id') !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
      or lower(item->>'id') = any(seen_ids)
      or jsonb_typeof(item->'prompt') is distinct from 'string'
      or char_length(btrim(item->>'prompt')) not between 1 and 1000 then
      return false;
    end if;
    seen_ids := array_append(seen_ids, lower(item->>'id'));
    if quiz then
      if jsonb_typeof(item->'options') is distinct from 'array'
        or jsonb_typeof(item->'correctOption') is distinct from 'number'
        or (item->>'correctOption') !~ '^[0-3]$'
        or jsonb_typeof(item->'explanation') is distinct from 'string'
        or char_length(item->>'explanation') > 4000 then return false; end if;
      if jsonb_array_length(item->'options') <> 4 then return false; end if;
      for option_value in select value from jsonb_array_elements(item->'options') loop
        if jsonb_typeof(option_value) is distinct from 'string'
          or char_length(btrim(option_value #>> '{}')) not between 1 and 1000 then return false; end if;
      end loop;
      if (select count(distinct lower(btrim(value))) from jsonb_array_elements_text(item->'options')) <> 4 then
        return false;
      end if;
    elsif jsonb_typeof(item->'answer') is distinct from 'string'
      or char_length(btrim(item->>'answer')) not between 1 and 8000 then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

alter table public.study_topic_revisions
  add check (private.valid_study_items(flashcards, false));
alter table public.study_topic_revision_quizzes
  add check (private.valid_study_items(items, true));

-- This predicate deliberately walks the hierarchy without re-entering the topic policy.
create function private.can_read_published_study_topic(target_topic_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.study_topic_revisions as revision
    join public.study_topics as topic on topic.id = revision.topic_id
    join public.study_sections as section on section.id = topic.section_id
    join public.study_subjects as subject on subject.id = section.subject_id
    where topic.id = target_topic_id
      and revision.state = 'published'
      and private.can_read_study_semester(subject.semester_id)
  );
$$;

drop policy study_topics_student_read on public.study_topics;
create policy study_topics_student_read on public.study_topics for select to authenticated
  using (private.can_read_published_study_topic(id));

alter table public.study_topic_revisions enable row level security;
alter table public.study_topic_revision_quizzes enable row level security;
alter table public.study_topic_revision_assets enable row level security;

revoke all on public.study_topic_revisions, public.study_topic_revision_quizzes, public.study_topic_revision_assets
  from public, anon, authenticated;
grant select on public.study_topic_revisions, public.study_topic_revision_quizzes, public.study_topic_revision_assets
  to authenticated;

create policy study_revisions_read on public.study_topic_revisions for select to authenticated
  using ((select private.is_admin()) or (state = 'published' and private.can_read_published_study_topic(topic_id)));
create policy study_revision_quizzes_read on public.study_topic_revision_quizzes for select to authenticated
  using ((select private.is_admin()));
create policy study_revision_assets_read on public.study_topic_revision_assets for select to authenticated
  using (exists (select 1 from public.study_topic_revisions as revision where revision.id = revision_id));

create function private.require_study_editor()
returns void language plpgsql set search_path = '' as $$
begin
  if not private.is_admin() then
    raise insufficient_privilege using message = 'Administrator access required';
  end if;
end;
$$;

create function private.lock_study_draft(target_revision_id uuid, expected_version integer)
returns public.study_topic_revisions language plpgsql set search_path = '' as $$
declare
  draft public.study_topic_revisions;
begin
  perform private.require_study_editor();
  perform 1 from public.study_topics as topic
    where topic.id = (select revision.topic_id from public.study_topic_revisions as revision where revision.id = target_revision_id)
    for update;
  select * into draft from public.study_topic_revisions where id = target_revision_id;
  if not found or draft.state <> 'draft' or draft.edit_version is distinct from expected_version then
    raise serialization_failure using message = 'Draft has changed';
  end if;
  return draft;
end;
$$;

create function public.open_study_topic_draft(target_topic_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  draft_id uuid;
  previous public.study_topic_revisions;
begin
  perform private.require_study_editor();
  perform 1 from public.study_topics where id = target_topic_id for update;
  if not found then raise no_data_found using message = 'Topic does not exist'; end if;

  select id into draft_id from public.study_topic_revisions where topic_id = target_topic_id and state = 'draft';
  if found then return draft_id; end if;

  select * into previous from public.study_topic_revisions where topic_id = target_topic_id
    order by revision_number desc limit 1;
  insert into public.study_topic_revisions (topic_id, revision_number, notes, mnemonic, correction, source_label, source_url, flashcards)
  values (target_topic_id, coalesce(previous.revision_number, 0) + 1, coalesce(previous.notes, '{}'),
    coalesce(previous.mnemonic, ''), coalesce(previous.correction, ''), coalesce(previous.source_label, ''),
    coalesce(previous.source_url, ''), coalesce(previous.flashcards, '[]'))
  returning id into draft_id;

  insert into public.study_topic_revision_quizzes (revision_id, items)
  values (draft_id, coalesce((select items from public.study_topic_revision_quizzes where revision_id = previous.id), '[]'));
  insert into public.study_topic_revision_assets (revision_id, object_path, title, alt_text, content_type, created_at)
  select draft_id, object_path, title, alt_text, content_type, created_at
  from public.study_topic_revision_assets where revision_id = previous.id;
  return draft_id;
end;
$$;

create function public.save_study_topic_draft(
  target_revision_id uuid, expected_version integer, note_lines text[], memory_hint text,
  source_correction text, reference_label text, reference_url text, cards jsonb, quiz_items jsonb
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.lock_study_draft(target_revision_id, expected_version);
  if note_lines is null or cardinality(note_lines) > 100
    or exists (select 1 from unnest(note_lines) as line where line is null or char_length(btrim(line)) not between 1 and 4000)
    or memory_hint is null or char_length(memory_hint) > 4000
    or source_correction is null or char_length(source_correction) > 4000
    or not private.valid_study_items(cards, false)
    or not private.valid_study_items(quiz_items, true) then
    raise invalid_parameter_value using message = 'Invalid study material';
  end if;

  update public.study_topic_revisions set notes = note_lines, mnemonic = memory_hint, correction = source_correction,
    source_label = reference_label, source_url = reference_url, flashcards = cards,
    edit_version = edit_version + 1 where id = target_revision_id;
  insert into public.study_topic_revision_quizzes (revision_id, items) values (target_revision_id, quiz_items)
    on conflict (revision_id) do update set items = excluded.items;
end;
$$;

create function public.publish_study_topic_draft(target_revision_id uuid, expected_version integer)
returns void language plpgsql security definer set search_path = '' as $$
declare
  draft public.study_topic_revisions;
begin
  draft := private.lock_study_draft(target_revision_id, expected_version);
  if cardinality(draft.notes) = 0 and btrim(draft.mnemonic) = '' and btrim(draft.correction) = ''
    and draft.source_url = ''
    and jsonb_array_length(draft.flashcards) = 0
    and not exists (select 1 from public.study_topic_revision_quizzes where revision_id = draft.id and items <> '[]')
    and not exists (select 1 from public.study_topic_revision_assets where revision_id = draft.id) then
    raise invalid_parameter_value using message = 'Empty material';
  end if;

  update public.study_topic_revisions set state = 'archived' where topic_id = draft.topic_id and state = 'published';
  update public.study_topic_revisions set state = 'published', published_at = now() where id = draft.id;
end;
$$;

create function public.withdraw_study_topic_publication(target_topic_id uuid, published_revision_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_study_editor();
  perform 1 from public.study_topics where id = target_topic_id for update;
  update public.study_topic_revisions set state = 'archived'
    where id = published_revision_id and topic_id = target_topic_id and state = 'published';
  if not found then raise serialization_failure using message = 'Publication has changed'; end if;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('study-topic-assets', 'study-topic-assets', false, 4194304,
  array['image/png', 'image/jpeg', 'image/webp', 'application/pdf']);

create policy study_topic_files_read on storage.objects for select to authenticated
  using (bucket_id = 'study-topic-assets' and ((select private.is_admin()) or exists (
    select 1 from public.study_topic_revision_assets as asset where asset.object_path = storage.objects.name
  )));
create policy study_topic_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'study-topic-assets' and (select private.is_admin())
    and name ~ '^[0-9a-f-]+/[0-9a-f-]+\.(png|jpg|webp|pdf)$'
    and exists (select 1 from public.study_topic_revisions as revision
      where revision.id::text = split_part(storage.objects.name, '/', 1) and revision.state = 'draft'));
create policy study_topic_orphan_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'study-topic-assets' and (select private.is_admin()) and not exists (
    select 1 from public.study_topic_revision_assets as asset where asset.object_path = storage.objects.name
  ));

create function public.attach_study_topic_asset(
  target_revision_id uuid, expected_version integer, asset_path text, asset_title text,
  asset_alt text, asset_content_type text
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.lock_study_draft(target_revision_id, expected_version);
  if split_part(asset_path, '/', 1) is distinct from target_revision_id::text
    or not exists (select 1 from storage.objects as object
      where object.bucket_id = 'study-topic-assets' and object.name = asset_path) then
    raise invalid_parameter_value using message = 'Attachment must belong to this draft';
  end if;
  if (select count(*) from public.study_topic_revision_assets where revision_id = target_revision_id) >= 20 then
    raise invalid_parameter_value using message = 'Attachment limit reached';
  end if;

  insert into public.study_topic_revision_assets (revision_id, object_path, title, alt_text, content_type)
  values (target_revision_id, asset_path, asset_title, asset_alt, asset_content_type);
  update public.study_topic_revisions set edit_version = edit_version + 1 where id = target_revision_id;
end;
$$;

create function public.remove_study_topic_asset(target_revision_id uuid, expected_version integer, target_asset_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  removed_path text;
begin
  perform private.lock_study_draft(target_revision_id, expected_version);
  delete from public.study_topic_revision_assets where id = target_asset_id and revision_id = target_revision_id
    returning object_path into removed_path;
  if not found then raise no_data_found using message = 'Attachment does not exist'; end if;
  update public.study_topic_revisions set edit_version = edit_version + 1 where id = target_revision_id;
  if not exists (select 1 from public.study_topic_revision_assets where object_path = removed_path) then
    return removed_path;
  end if;
  return null;
end;
$$;

revoke all on function private.valid_study_items(jsonb, boolean), private.can_read_published_study_topic(uuid),
  private.require_study_editor(), private.lock_study_draft(uuid, integer) from public, anon, authenticated;
grant execute on function private.can_read_published_study_topic(uuid) to authenticated;

revoke all on function public.open_study_topic_draft(uuid),
  public.save_study_topic_draft(uuid, integer, text[], text, text, text, text, jsonb, jsonb),
  public.publish_study_topic_draft(uuid, integer), public.withdraw_study_topic_publication(uuid, uuid),
  public.attach_study_topic_asset(uuid, integer, text, text, text, text),
  public.remove_study_topic_asset(uuid, integer, uuid) from public, anon, authenticated;
grant execute on function public.open_study_topic_draft(uuid),
  public.save_study_topic_draft(uuid, integer, text[], text, text, text, text, jsonb, jsonb),
  public.publish_study_topic_draft(uuid, integer), public.withdraw_study_topic_publication(uuid, uuid),
  public.attach_study_topic_asset(uuid, integer, text, text, text, text),
  public.remove_study_topic_asset(uuid, integer, uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
