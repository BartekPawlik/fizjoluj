import { notFound } from "next/navigation";

import { isUuid } from "@/features/auth/validation";
import { FlashcardDeck } from "@/features/learning/flashcard-deck";
import { readAssessmentFlashcards } from "@/features/learning/queries";
import { readFlashcardMode } from "@/features/learning/validation";

export default async function AssessmentFlashcardsPage({ params, searchParams }: {
  params: Promise<{ subjectId: string; assessmentId: string }>;
  searchParams: Promise<{ tryb?: string | string[] }>;
}) {
  const [{ subjectId, assessmentId }, { tryb }] = await Promise.all([params, searchParams]);
  if (!isUuid(subjectId) || !isUuid(assessmentId)) notFound();
  const result = await readAssessmentFlashcards(subjectId, assessmentId);
  if (result.status === "missing") notFound();

  return (
    <FlashcardDeck assessmentId={assessmentId} backHref={`/panel/przedmioty/${subjectId}/zaliczenia/${assessmentId}`}
      backLabel="Wróć do zaliczenia" subtitle={result.status === "ready" ? result.assessment.name : undefined}
      cards={result.status === "ready" ? result.cards : null} mode={readFlashcardMode(tryb)} />
  );
}
