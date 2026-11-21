import "server-only";

import { readStudentAssessmentScope } from "@/features/assessments/queries";
import { requireProfile } from "@/features/auth/session";
import { readSubjectTopicGroups } from "@/features/catalog/queries";
import { readFlashcards } from "@/features/editorial/validation";
import { flashcardKey, type SessionFlashcard } from "@/features/learning/validation";

async function readFlashcardsForTopics(
  supabase: Awaited<ReturnType<typeof requireProfile>>["supabase"],
  studentId: string,
  topics: { id: string; name: string }[],
) {
  const topicIds = topics.map(({ id }) => id);
  const cards: SessionFlashcard[] = [];
  if (topicIds.length === 0) return cards;

  const [revisions, progress] = await Promise.all([
    supabase.from("study_topic_revisions").select("id, topic_id, flashcards, mnemonic")
      .in("topic_id", topicIds).eq("state", "published"),
    supabase.from("study_flashcard_progress").select("topic_id, flashcard_id, rating, edit_version")
      .eq("student_id", studentId).in("topic_id", topicIds),
  ]);
  if (revisions.error || progress.error) return null;
  const revisionsByTopic = new Map(revisions.data.map((revision) => [revision.topic_id, revision]));
  const progressByCard = new Map(progress.data.map((entry) => [flashcardKey(entry.topic_id, entry.flashcard_id), entry]));

  for (const topic of topics) {
    const revision = revisionsByTopic.get(topic.id);
    if (!revision) continue;
    const flashcards = readFlashcards(revision.flashcards);
    if (!flashcards) return null;
    for (const flashcard of flashcards) {
      const entry = progressByCard.get(flashcardKey(topic.id, flashcard.id));
      cards.push({
        ...flashcard, topicId: topic.id, topicName: topic.name, revisionId: revision.id,
        memoryHint: revision.mnemonic,
        progress: entry ? { rating: entry.rating, version: entry.edit_version } : null,
      });
    }
  }
  return cards;
}

export async function readAssessmentFlashcards(subjectId: string, assessmentId: string) {
  const { profile, supabase, user } = await requireProfile();
  if (profile?.role !== "student" || !profile.email_confirmed_at) return { status: "missing" } as const;
  const scope = await readStudentAssessmentScope(subjectId, assessmentId);
  if (scope.status !== "ready") return scope;

  const sections = await readSubjectTopicGroups(supabase, subjectId, scope.topicIds);
  if (!sections) return { status: "failed" } as const;
  const cards = await readFlashcardsForTopics(supabase, user.id, sections.flatMap((section) => section.topics));
  if (!cards) return { status: "failed" } as const;
  return { status: "ready", assessment: scope.assessment, cards } as const;
}

export async function readSectionFlashcards(subjectId: string, sectionId: string) {
  const { profile, supabase, user } = await requireProfile();
  if (profile?.role !== "student" || !profile.email_confirmed_at) return { status: "missing" } as const;
  const section = await supabase.from("study_sections").select("id, name")
    .eq("subject_id", subjectId).eq("id", sectionId).maybeSingle();
  if (section.error) return { status: "failed" } as const;
  if (!section.data) return { status: "missing" } as const;

  const topics = await supabase.from("study_topics").select("id, name")
    .eq("section_id", section.data.id).order("position").order("name");
  if (topics.error) return { status: "failed" } as const;
  const cards = await readFlashcardsForTopics(supabase, user.id, topics.data);
  if (!cards) return { status: "failed" } as const;
  return { status: "ready", section: section.data, cards } as const;
}
