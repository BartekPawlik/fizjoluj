import Link from "next/link";

import { buttonClass, linkClass, Notice } from "@/features/auth/ui";
import { StudentPageIntro } from "@/features/catalog/student-catalog";
import { FlashcardSession } from "@/features/learning/flashcard-session";
import type { SessionFlashcard } from "@/features/learning/validation";

export function TopicFlashcardsLink({ subjectId, topicId }: { subjectId: string; topicId: string }) {
  return (
    <Link href={`/panel/przedmioty/${subjectId}/tematy/${topicId}/fiszki`} prefetch={false} className={`${buttonClass} w-fit`}>
      Fiszki tematu
    </Link>
  );
}

export function FlashcardDeck({ assessmentId, backHref, backLabel, subtitle, cards }: {
  assessmentId: string | null;
  backHref: string;
  backLabel: string;
  subtitle?: string;
  cards: SessionFlashcard[] | null;
}) {
  return (
    <main className="mx-auto grid max-w-5xl gap-5 px-4 py-6 sm:gap-7 sm:px-6 sm:py-10">
      <Link href={backHref} className={`${linkClass} w-fit`}>← {backLabel}</Link>
      <StudentPageIntro title="Fiszki">
        {subtitle && <p className="text-sm text-white/85">{subtitle}</p>}
      </StudentPageIntro>
      {cards === null ? (
        <Notice content={{ text: "Nie udało się pobrać fiszek. Odśwież stronę.", error: true }} />
      ) : cards.length > 0 ? (
        <FlashcardSession assessmentId={assessmentId} cards={cards} />
      ) : (
        <p className="rounded-2xl border bg-card p-5 text-muted-foreground">
          {assessmentId ? "W tym zaliczeniu nie ma jeszcze opublikowanych fiszek." : "W tym temacie nie ma jeszcze opublikowanych fiszek."}
        </p>
      )}
    </main>
  );
}
