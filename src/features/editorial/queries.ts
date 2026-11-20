import "server-only";

import { requireAdministrator, requireProfile } from "@/features/auth/session";
import { readFlashcards, readQuestions } from "@/features/editorial/validation";

type EditorialClient = Awaited<ReturnType<typeof requireAdministrator>>;
const materialFields = "id, notes, mnemonic, correction, source_label, source_url";

async function readTopicContext(supabase: EditorialClient, topicId: string, subjectId?: string) {
  const topic = await supabase.from("study_topics").select("id, name, section_id").eq("id", topicId).maybeSingle();
  if (topic.error) return { status: "failed" } as const;
  if (!topic.data) return { status: "missing" } as const;

  const sectionQuery = supabase.from("study_sections").select("id, name, subject_id").eq("id", topic.data.section_id);
  const section = await (subjectId ? sectionQuery.eq("subject_id", subjectId) : sectionQuery).maybeSingle();
  if (section.error) return { status: "failed" } as const;
  if (!section.data) return { status: "missing" } as const;

  const subject = await supabase.from("study_subjects").select("id, name, semester_id").eq("id", section.data.subject_id).maybeSingle();
  if (subject.error) return { status: "failed" } as const;
  if (!subject.data) return { status: "missing" } as const;
  return { status: "ready", topic: topic.data, section: section.data, subject: subject.data } as const;
}

function queryAssets(supabase: EditorialClient) {
  return supabase.from("study_topic_revision_assets").select("*")
    .order("created_at").order("id");
}

export async function readTopicForEditor(topicId: string) {
  const supabase = await requireAdministrator();
  const context = await readTopicContext(supabase, topicId);
  if (context.status !== "ready") return context;

  const revisions = await supabase.from("study_topic_revisions").select("*")
    .eq("topic_id", topicId).in("state", ["draft", "published"]);
  if (revisions.error) return { status: "failed" } as const;
  const draft = revisions.data.find((revision) => revision.state === "draft");
  const published = revisions.data.find((revision) => revision.state === "published");
  if (!draft) return { ...context, published, draft: null } as const;

  const [quiz, assets] = await Promise.all([
    supabase.from("study_topic_revision_quizzes").select("items").eq("revision_id", draft.id).maybeSingle(),
    queryAssets(supabase).eq("revision_id", draft.id),
  ]);
  if (quiz.error || assets.error) return { status: "failed" } as const;

  const flashcards = readFlashcards(draft.flashcards);
  const questions = readQuestions(quiz.data?.items ?? []);
  if (!flashcards || !questions) return { status: "failed" } as const;
  return { ...context, published, draft: { revision: draft, flashcards, questions, assets: assets.data } } as const;
}

export async function readSubjectDrafts(subjectId: string) {
  const supabase = await requireAdministrator();
  const [subject, sections] = await Promise.all([
    supabase.from("study_subjects").select("id, name, semester_id").eq("id", subjectId).maybeSingle(),
    supabase.from("study_sections").select("id, name").eq("subject_id", subjectId).order("position").order("name"),
  ]);
  if (subject.error || sections.error) return { status: "failed" } as const;
  if (!subject.data) return { status: "missing" } as const;

  const topics = sections.data.length
    ? await supabase.from("study_topics").select("id, section_id, name")
      .in("section_id", sections.data.map(({ id }) => id)).order("position").order("name")
    : { data: [], error: null };
  if (topics.error) return { status: "failed" } as const;

  const drafts = topics.data.length
    ? await supabase.from("study_topic_revisions").select("id, topic_id, edit_version")
      .in("topic_id", topics.data.map(({ id }) => id)).eq("state", "draft")
    : { data: [], error: null };
  if (drafts.error) return { status: "failed" } as const;

  const draftsByTopic = new Map(drafts.data.map((draft) => [draft.topic_id, draft]));
  const groups = sections.data.map((section) => ({
    ...section,
    topics: topics.data.filter((topic) => topic.section_id === section.id).flatMap((topic) => {
      const draft = draftsByTopic.get(topic.id);
      return draft ? [{ id: topic.id, name: topic.name, draft }] : [];
    }),
  })).filter(({ topics }) => topics.length > 0);
  return { status: "ready", subject: subject.data, sections: groups } as const;
}

export async function readPublishedTopic(topicId: string, subjectId: string) {
  const { supabase } = await requireProfile();
  const context = await readTopicContext(supabase, topicId, subjectId);
  if (context.status !== "ready") return context;

  const revision = await supabase.from("study_topic_revisions")
    .select(materialFields)
    .eq("topic_id", topicId).eq("state", "published").maybeSingle();
  if (revision.error) return { status: "failed" } as const;
  if (!revision.data) return { status: "missing" } as const;

  const assets = await queryAssets(supabase).eq("revision_id", revision.data.id);
  if (assets.error) return { status: "failed" } as const;
  return { ...context, material: revision.data, assets: assets.data } as const;
}

export async function readPublishedTopicMaterials(supabase: EditorialClient, topicIds: string[]) {
  const revisions = topicIds.length
    ? await supabase.from("study_topic_revisions")
      .select(`topic_id, ${materialFields}`).in("topic_id", topicIds).eq("state", "published")
    : { data: [], error: null };
  if (revisions.error) return null;

  const assets = revisions.data.length
    ? await queryAssets(supabase).in("revision_id", revisions.data.map(({ id }) => id))
    : { data: [], error: null };
  if (assets.error) return null;

  return new Map(revisions.data.map((material) => [
    material.topic_id,
    { material, assets: assets.data.filter((asset) => asset.revision_id === material.id) },
  ]));
}
