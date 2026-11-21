import { notFound, redirect } from "next/navigation";

import { requireProfile } from "@/features/auth/session";
import { isUuid } from "@/features/auth/validation";
import { readSubjectTopicGroups } from "@/features/catalog/queries";
import { FlashcardDeck, sectionFlashcardsHref } from "@/features/learning/flashcard-deck";
import { flashcardModeHref, readFlashcardMode } from "@/features/learning/validation";

export default async function TopicFlashcardsPage({ params, searchParams }: {
  params: Promise<{ subjectId: string; topicId: string }>;
  searchParams: Promise<{ tryb?: string | string[] }>;
}) {
  const [{ subjectId, topicId }, { tryb }] = await Promise.all([params, searchParams]);
  if (!isUuid(subjectId) || !isUuid(topicId)) notFound();
  const { profile, supabase } = await requireProfile();
  if (profile?.role !== "student" || !profile.email_confirmed_at) notFound();
  const sections = await readSubjectTopicGroups(supabase, subjectId, [topicId]);
  if (sections) {
    const section = sections.find(({ topics }) => topics.length > 0);
    if (!section) notFound();
    const href = sectionFlashcardsHref(subjectId, section.id);
    const mode = readFlashcardMode(tryb);
    redirect(mode ? flashcardModeHref(href, mode) : href);
  }

  return (
    <FlashcardDeck assessmentId={null} backHref={`/panel/przedmioty/${subjectId}/tematy/${topicId}`}
      backLabel="Wróć do tematu" cards={null} />
  );
}
