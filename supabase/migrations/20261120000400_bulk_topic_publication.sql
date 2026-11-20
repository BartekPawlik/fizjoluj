begin;

create or replace function public.publish_study_subject_drafts(
  target_subject_id uuid, expected_revision_ids uuid[], expected_edit_versions integer[]
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  expected_count integer := cardinality(expected_revision_ids);
  published_count integer := 0;
  draft record;
begin
  perform private.require_study_editor();
  if target_subject_id is null
    or coalesce(expected_count, 0) = 0
    or cardinality(expected_edit_versions) is distinct from expected_count
    or exists (
      select 1 from unnest(expected_revision_ids, expected_edit_versions) as submitted(revision_id, edit_version)
      where submitted.revision_id is null or submitted.edit_version is null or submitted.edit_version < 0
    )
    or exists (
      select 1 from unnest(expected_revision_ids) as submitted(revision_id)
      group by submitted.revision_id having count(*) > 1
    ) then
    raise invalid_parameter_value using message = 'Invalid draft list';
  end if;

  -- Use the single-topic checks and acquire topic locks in the same order for every batch.
  for draft in
    select revision.id, submitted.edit_version
    from public.study_sections as section
    join public.study_topics as topic on topic.section_id = section.id
    join public.study_topic_revisions as revision on revision.topic_id = topic.id and revision.state = 'draft'
    left join unnest(expected_revision_ids, expected_edit_versions) as submitted(revision_id, edit_version)
      on submitted.revision_id = revision.id
    where section.subject_id = target_subject_id
    order by topic.id
  loop
    if draft.edit_version is null then
      raise serialization_failure using message = 'Draft list has changed';
    end if;
    perform public.publish_study_topic_draft(draft.id, draft.edit_version);
    published_count := published_count + 1;
  end loop;

  if published_count <> expected_count then
    raise serialization_failure using message = 'Draft list has changed';
  end if;
end;
$$;

revoke all on function public.publish_study_subject_drafts(uuid, uuid[], integer[]) from public, anon, authenticated;
grant execute on function public.publish_study_subject_drafts(uuid, uuid[], integer[]) to authenticated;

notify pgrst, 'reload schema';

commit;
