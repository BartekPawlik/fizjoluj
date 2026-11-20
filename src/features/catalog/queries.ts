import "server-only";

import { requireAdministrator, requireProfile } from "@/features/auth/session";
import type { CatalogSelection } from "@/features/catalog/validation";
import { readPublishedTopicMaterials } from "@/features/editorial/queries";

export async function readStudentCatalog() {
  const { supabase } = await requireProfile();
  const [semesters, subjects] = await Promise.all([
    supabase.from("study_semesters").select("id, semester_number").order("semester_number"),
    supabase.from("study_subjects").select("id, semester_id, name").order("position").order("name"),
  ]);
  if (semesters.error || subjects.error) return null;

  return semesters.data.map((semester) => ({
    ...semester,
    subjects: subjects.data.filter((subject) => subject.semester_id === semester.id),
  })).filter((semester) => semester.subjects.length > 0);
}

export async function readSubjectTopicGroups(
  supabase: Awaited<ReturnType<typeof requireAdministrator>>,
  subjectId: string,
  scopeTopicIds?: string[],
) {
  const sections = await supabase.from("study_sections").select("id, name")
    .eq("subject_id", subjectId).order("position").order("name");
  if (sections.error) return null;
  if (sections.data.length === 0 || scopeTopicIds?.length === 0) return [];

  const query = supabase.from("study_topics").select("id, section_id, name")
    .in("section_id", sections.data.map(({ id }) => id)).order("position").order("name");
  const topics = await (scopeTopicIds ? query.in("id", scopeTopicIds) : query);
  if (topics.error) return null;

  return sections.data.map((section) => ({
    ...section,
    topics: topics.data.filter((topic) => topic.section_id === section.id),
  }));
}

export async function readSubjectCatalog(subjectId: string, scopeTopicIds?: string[]) {
  const { supabase } = await requireProfile();
  const subject = await supabase.from("study_subjects").select("id, name").eq("id", subjectId).maybeSingle();
  if (subject.error) return { status: "failed" } as const;
  if (!subject.data) return { status: "missing" } as const;

  const sections = await readSubjectTopicGroups(supabase, subjectId, scopeTopicIds);
  if (!sections) return { status: "failed" } as const;

  const materials = await readPublishedTopicMaterials(supabase, sections.flatMap(({ topics }) => topics.map(({ id }) => id)));
  if (!materials) return { status: "failed" } as const;

  return {
    status: "ready",
    subject: subject.data,
    sections: sections.map((section) => ({
      ...section,
      topics: section.topics.flatMap((topic) => {
        const publication = materials.get(topic.id);
        return publication ? [{ ...topic, ...publication }] : [];
      }),
    })),
  } as const;
}

export async function readAdminCatalog(selection: CatalogSelection) {
  const supabase = await requireAdministrator();
  const [institutions, semesters] = await Promise.all([
    supabase.from("institutions").select("id, name").order("name"),
    supabase.from("study_semesters").select("id, institution_id, semester_number, study_year").order("semester_number"),
  ]);
  if (institutions.error || semesters.error) return null;

  const semester = semesters.data.find(({ id }) => id === selection.semesterId) ?? semesters.data[0];
  if (!semester) return { institutions: institutions.data, semesters: semesters.data, current: null };

  const [cohorts, offerings, subjects] = await Promise.all([
    supabase.from("cohorts").select("id, start_year").eq("institution_id", semester.institution_id).order("start_year"),
    supabase.from("study_semester_offerings").select("cohort_id, is_visible").eq("semester_id", semester.id),
    supabase.from("study_subjects").select("id, name, position")
      .eq("semester_id", semester.id).order("position").order("name"),
  ]);
  if (cohorts.error || offerings.error || subjects.error) return null;

  const subject = subjects.data.find(({ id }) => id === selection.subjectId);
  const sections = subject
    ? await supabase.from("study_sections").select("id, name, position")
      .eq("subject_id", subject.id).order("position").order("name")
    : { data: [], error: null };
  if (sections.error) return null;

  const section = sections.data.find(({ id }) => id === selection.sectionId);
  const topics = sections.data.length
    ? await supabase.from("study_topics").select("id, name, position, section_id")
      .in("section_id", sections.data.map(({ id }) => id)).order("position").order("name")
    : { data: [], error: null };
  if (topics.error) return null;

  const draftRows = topics.data.length
    ? await supabase.from("study_topic_revisions").select("topic_id")
      .in("topic_id", topics.data.map(({ id }) => id)).eq("state", "draft")
    : { data: [], error: null };
  if (draftRows.error && draftRows.error.code !== "PGRST205") return null;
  const drafts = new Set((draftRows.data ?? []).map(({ topic_id }) => topic_id));

  return {
    institutions: institutions.data,
    semesters: semesters.data,
    current: {
      semester,
      cohorts: cohorts.data.map((cohort) => ({
        ...cohort,
        academicYear: cohort.start_year + semester.study_year - 1,
        visible: offerings.data.some((offering) => offering.cohort_id === cohort.id && offering.is_visible),
      })),
      subjects: subjects.data,
      subject,
      sections: sections.data.map((entry) => ({
        ...entry,
        draftCount: topics.data.filter((topic) => topic.section_id === entry.id && drafts.has(topic.id)).length,
      })),
      draftCount: drafts.size,
      section,
      topics: topics.data.filter((topic) => topic.section_id === section?.id)
        .map((topic) => ({ ...topic, hasDraft: drafts.has(topic.id) })),
    },
  };
}
