import { notFound } from "next/navigation";

import { isUuid } from "@/features/auth/validation";
import { FlashcardDeck } from "@/features/learning/flashcard-deck";
import { readSectionFlashcards } from "@/features/learning/queries";
import { readFlashcardMode } from "@/features/learning/validation";

export default async function SectionFlashcardsPage({ params, searchParams }: {
  params: Promise<{ subjectId: string; sectionId: string }>;
  searchParams: Promise<{ tryb?: string | string[] }>;
}) {
  const [{ subjectId, sectionId }, { tryb }] = await Promise.all([params, searchParams]);
  if (!isUuid(subjectId) || !isUuid(sectionId)) notFound();
  const result = await readSectionFlashcards(subjectId, sectionId);
  if (result.status === "missing") notFound();

  return (
    <FlashcardDeck assessmentId={null} backHref={`/panel/przedmioty/${subjectId}`} backLabel="Wróć do tematów"
      subtitle={result.status === "ready" ? result.section.name : undefined}
      cards={result.status === "ready" ? result.cards : null} mode={readFlashcardMode(tryb)} />
  );
}
