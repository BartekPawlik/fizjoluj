import { notFound } from "next/navigation";

import { isUuid } from "@/features/auth/validation";
import { FlashcardDeck } from "@/features/learning/flashcard-deck";
import { readTopicFlashcards } from "@/features/learning/queries";

export default async function TopicFlashcardsPage({ params }: { params: Promise<{ subjectId: string; topicId: string }> }) {
  const { subjectId, topicId } = await params;
  if (!isUuid(subjectId) || !isUuid(topicId)) notFound();
  const result = await readTopicFlashcards(subjectId, topicId);
  if (result.status === "missing") notFound();

  return (
    <FlashcardDeck assessmentId={null} backHref={`/panel/przedmioty/${subjectId}/tematy/${topicId}`}
      backLabel="Wróć do tematu" subtitle={result.status === "ready" ? result.topic.name : undefined}
      cards={result.status === "ready" ? result.cards : null} />
  );
}
