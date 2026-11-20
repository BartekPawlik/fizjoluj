import "server-only";

import { requireAdministrator, requireProfile } from "@/features/auth/session";
import { readSubjectCatalog, readSubjectTopicGroups } from "@/features/catalog/queries";

export async function readAssessmentEditor(subjectId: string, assessmentId?: string) {
  const supabase = await requireAdministrator();
  const [subject, assessments] = await Promise.all([
    supabase.from("study_subjects").select("id, name, semester_id").eq("id", subjectId).maybeSingle(),
    supabase.from("study_assessments").select("id, name, edit_version, published_at").eq("subject_id", subjectId).order("name"),
  ]);
  if (subject.error || assessments.error) return { status: "failed" } as const;
  if (!subject.data) return { status: "missing" } as const;
  const assessment = assessments.data.find(({ id }) => id === assessmentId);
  if (assessmentId && !assessment) return { status: "missing" } as const;

  const [semester, sections, scope, dates] = await Promise.all([
    supabase.from("study_semesters").select("institution_id").eq("id", subject.data.semester_id).maybeSingle(),
    readSubjectTopicGroups(supabase, subjectId),
    assessment
      ? supabase.from("study_assessment_topics").select("topic_id").eq("assessment_id", assessment.id)
      : { data: [], error: null },
    assessment
      ? supabase.from("study_assessment_dates").select("cohort_id, location_id, scheduled_on").eq("assessment_id", assessment.id)
      : { data: [], error: null },
  ]);
  if (semester.error || !semester.data || !sections || scope.error || dates.error) return { status: "failed" } as const;

  const topicIds = sections.flatMap(({ topics }) => topics.map(({ id }) => id));
  const [cohorts, locations, publishedTopics] = await Promise.all([
    supabase.from("cohorts").select("id, start_year").eq("institution_id", semester.data.institution_id)
      .order("start_year", { ascending: false }),
    supabase.from("locations").select("id, name").eq("institution_id", semester.data.institution_id).order("name"),
    topicIds.length
      ? supabase.from("study_topic_revisions").select("topic_id").in("topic_id", topicIds).eq("state", "published")
      : { data: [], error: null },
  ]);
  if (cohorts.error || locations.error || publishedTopics.error) return { status: "failed" } as const;

  return {
    status: "ready",
    subject: subject.data,
    assessments: assessments.data,
    assessment,
    selectedTopicIds: scope.data.map(({ topic_id }) => topic_id),
    publishedTopicIds: publishedTopics.data.map(({ topic_id }) => topic_id),
    sections: sections.filter(({ topics }) => topics.length > 0),
    cohorts: cohorts.data,
    locations: locations.data,
    dates: dates.data,
  } as const;
}

export async function readSubjectAssessments(subjectId: string, assessmentId?: string) {
  const { supabase, user } = await requireProfile();
  const query = supabase.from("study_assessments").select("id, name")
    .eq("subject_id", subjectId).not("published_at", "is", null).order("name");
  const [subject, assessments, membership] = await Promise.all([
    supabase.from("study_subjects").select("id, name").eq("id", subjectId).maybeSingle(),
    assessmentId ? query.eq("id", assessmentId) : query,
    supabase.from("memberships").select("cohort_id, location_id").eq("user_id", user.id).eq("active", true).maybeSingle(),
  ]);
  if (subject.error || assessments.error || membership.error) return { status: "failed" } as const;
  if (!subject.data) return { status: "missing" } as const;

  const dates = membership.data && assessments.data.length
    ? await supabase.from("study_assessment_dates").select("assessment_id, location_id, scheduled_on")
      .in("assessment_id", assessments.data.map(({ id }) => id)).eq("cohort_id", membership.data.cohort_id)
    : { data: [], error: null };
  if (dates.error) return { status: "failed" } as const;

  return {
    status: "ready",
    subject: subject.data,
    assessments: assessments.data.map((assessment) => {
      const terms = dates.data.filter(({ assessment_id }) => assessment_id === assessment.id);
      const term = terms.find(({ location_id }) => location_id === membership.data?.location_id)
        ?? terms.find(({ location_id }) => location_id === null);
      return { ...assessment, scheduledOn: term?.scheduled_on ?? null };
    }),
  } as const;
}

export async function readStudentAssessmentScope(subjectId: string, assessmentId: string) {
  const overview = await readSubjectAssessments(subjectId, assessmentId);
  if (overview.status !== "ready") return overview;
  const assessment = overview.assessments[0];
  if (!assessment) return { status: "missing" } as const;

  const { supabase } = await requireProfile();
  const scope = await supabase.from("study_assessment_topics").select("topic_id").eq("assessment_id", assessment.id);
  if (scope.error) return { status: "failed" } as const;
  return { status: "ready", assessment, topicIds: scope.data.map(({ topic_id }) => topic_id) } as const;
}

export async function readStudentAssessment(subjectId: string, assessmentId: string) {
  const scope = await readStudentAssessmentScope(subjectId, assessmentId);
  if (scope.status !== "ready") return scope;
  const catalog = await readSubjectCatalog(subjectId, scope.topicIds);
  if (catalog.status !== "ready") return catalog;
  return { ...catalog, assessment: scope.assessment } as const;
}
