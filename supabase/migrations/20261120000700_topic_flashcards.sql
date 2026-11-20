begin;

create or replace function public.rate_study_flashcard(
  target_assessment_id uuid, target_topic_id uuid, target_revision_id uuid,
  target_flashcard_id uuid, target_rating public.study_flashcard_rating, expected_version integer
)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  current_student_id uuid := auth.uid();
  saved_version integer;
begin
  perform 1 from public.memberships where user_id = current_student_id and active for share;
  if not found then
    raise insufficient_privilege using message = 'Study access required';
  end if;
  if target_rating is null or expected_version is null or expected_version not between 0 and 2147483646 then
    raise invalid_parameter_value using message = 'Invalid flashcard rating';
  end if;

  if target_assessment_id is not null then
    if not private.can_read_study_assessment(target_assessment_id) then
      raise insufficient_privilege using message = 'Assessment access required';
    end if;
    -- Hold the assessment scope stable while recording a rating from an assessment.
    perform 1 from public.study_assessments where id = target_assessment_id for share;
    if not exists (
      select 1 from public.study_assessment_topics
      where assessment_id = target_assessment_id and topic_id = target_topic_id
    ) then
      raise insufficient_privilege using message = 'Flashcard is outside the assessment scope';
    end if;
  elsif not private.can_read_published_study_topic(target_topic_id) then
    raise insufficient_privilege using message = 'Published topic access required';
  end if;

  perform 1 from public.study_topics where id = target_topic_id for share;
  if not exists (
    select 1 from public.study_topic_revisions as revision
    cross join lateral jsonb_array_elements(revision.flashcards) as flashcard(item)
    where revision.id = target_revision_id and revision.topic_id = target_topic_id and revision.state = 'published'
      and (flashcard.item ->> 'id')::uuid = target_flashcard_id
  ) then
    raise serialization_failure using message = 'Flashcard publication has changed';
  end if;

  if expected_version = 0 then
    insert into public.study_flashcard_progress (student_id, topic_id, flashcard_id, rating)
      values (current_student_id, target_topic_id, target_flashcard_id, target_rating)
      on conflict (student_id, topic_id, flashcard_id) do nothing
      returning edit_version into saved_version;
  else
    update public.study_flashcard_progress
    set rating = target_rating, edit_version = edit_version + 1, reviewed_at = now()
    where student_id = current_student_id and topic_id = target_topic_id and flashcard_id = target_flashcard_id
      and edit_version = expected_version
    returning edit_version into saved_version;
  end if;

  if saved_version is null then
    -- Replaying an already applied rating leaves the version and review date unchanged.
    select edit_version into saved_version from public.study_flashcard_progress
    where student_id = current_student_id and topic_id = target_topic_id and flashcard_id = target_flashcard_id
      and edit_version = expected_version + 1 and rating = target_rating;
  end if;
  if saved_version is null then
    raise serialization_failure using message = 'Flashcard progress has changed';
  end if;
  return saved_version;
end;
$$;

revoke all on function public.rate_study_flashcard(uuid, uuid, uuid, uuid, public.study_flashcard_rating, integer)
  from public, anon, authenticated;
grant execute on function public.rate_study_flashcard(uuid, uuid, uuid, uuid, public.study_flashcard_rating, integer)
  to authenticated;

notify pgrst, 'reload schema';

commit;
