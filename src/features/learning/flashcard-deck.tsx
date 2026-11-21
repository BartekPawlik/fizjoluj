import Link from "next/link";

import { buttonClass, linkClass, Notice } from "@/features/auth/ui";
import { StudentPageIntro } from "@/features/catalog/student-catalog";
import { FlashcardSession } from "@/features/learning/flashcard-session";
import { flashcardModeHref, type FlashcardMode, type SessionFlashcard } from "@/features/learning/validation";

export function sectionFlashcardsHref(subjectId: string, sectionId: string) {
  return `/panel/przedmioty/${subjectId}/dzialy/${sectionId}/fiszki`;
}

export function FlashcardModeLinks({ href }: { href: string }) {
  return (
    <div role="group" aria-label="Tryby fiszek" className="flex flex-wrap gap-2">
      <Link href={flashcardModeHref(href, "learn")} prefetch={false} className={buttonClass}>
        Fiszki do nauki
      </Link>
      <Link href={flashcardModeHref(href, "practice")} prefetch={false}
        className="inline-flex min-h-11 items-center justify-center rounded-md border bg-card px-4 py-2 font-medium text-primary hover:bg-secondary">
        Sprawdź się
      </Link>
    </div>
  );
}

export function FlashcardDeck({ assessmentId, backHref, backLabel, subtitle, cards, mode = null }: {
  assessmentId: string | null;
  backHref: string;
  backLabel: string;
  subtitle?: string;
  cards: SessionFlashcard[] | null;
  mode?: FlashcardMode | null;
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
        <FlashcardSession key={mode ?? "choose"} assessmentId={assessmentId} cards={cards} initialMode={mode} />
      ) : (
        <p className="rounded-2xl border bg-card p-5 text-muted-foreground">
          {assessmentId ? "W tym zaliczeniu nie ma jeszcze opublikowanych fiszek." : "W tym zagadnieniu nie ma jeszcze opublikowanych fiszek."}
        </p>
      )}
    </main>
  );
}
