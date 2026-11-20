import Image from "next/image";

import { linkClass } from "@/features/auth/ui";
import { isSourceUrl, type StudyFlashcard, type StudyQuestion } from "@/features/editorial/validation";
import type { StudyTopicAsset, StudyTopicRevision } from "@/types/database";

type Material = Pick<StudyTopicRevision, "notes" | "mnemonic" | "correction" | "source_label" | "source_url">;
const card = "grid gap-4 rounded-2xl border bg-card p-5 sm:p-7";

export function TopicContent({ material, assets, heading: Heading = "h2" }: {
  material: Material;
  assets: StudyTopicAsset[];
  heading?: "h2" | "h5";
}) {
  const hasSource = Boolean(material.source_label && isSourceUrl(material.source_url));
  const hasContent = material.notes.length || material.mnemonic || material.correction || hasSource || assets.length;
  return (
    <div className="grid gap-4">
      {!hasContent && <p className={card + " text-muted-foreground"}>Ten temat nie zawiera jeszcze notatek ani załączników.</p>}
      {material.notes.length > 0 && (
        <section className={card}>
          <Heading className="text-xl font-semibold">Notatki</Heading>
          <ul className="list-disc space-y-3 pl-5 leading-relaxed marker:text-primary">
            {material.notes.map((note, index) => <li key={index} className="pl-1 wrap-anywhere">{note}</li>)}
          </ul>
        </section>
      )}
      {material.mnemonic && (
        <section className="grid gap-2 rounded-2xl border bg-secondary p-5 text-secondary-foreground sm:p-7">
          <Heading className="text-lg font-semibold">Zapamiętaj przez skojarzenie</Heading>
          <p className="leading-relaxed whitespace-pre-line wrap-anywhere">{material.mnemonic}</p>
        </section>
      )}
      {(material.correction || hasSource) && (
        <section className={card}>
          <Heading className="text-lg font-semibold">{material.correction ? "Uwaga do materiału źródłowego" : "Źródło"}</Heading>
          {material.correction && <p className="leading-relaxed whitespace-pre-line wrap-anywhere">{material.correction}</p>}
          {hasSource && (
            <a href={material.source_url} target="_blank" rel="noreferrer" className={linkClass}>{material.source_label}</a>
          )}
        </section>
      )}
      {assets.length > 0 && (
        <section className={card}>
          <Heading className="text-xl font-semibold">Materiały pomocnicze</Heading>
          <ul className="grid gap-4 md:grid-cols-2">
            {assets.map((asset) => (
              <li key={asset.id} className="min-w-0 rounded-lg border p-3">
                {asset.content_type === "application/pdf" ? (
                  <a href={`/panel/materialy/${asset.id}`} target="_blank" rel="noreferrer" className={linkClass}>
                    {asset.title} (PDF)
                  </a>
                ) : (
                  <figure className="grid gap-2">
                    <Image unoptimized src={`/panel/materialy/${asset.id}`} alt={asset.alt_text}
                      width={900} height={600} className="h-auto w-full rounded-md" />
                    <figcaption className="text-sm text-muted-foreground">{asset.title}</figcaption>
                  </figure>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function StudyItemsPreview({ flashcards, questions }: { flashcards: StudyFlashcard[]; questions: StudyQuestion[] }) {
  return (
    <>
      {flashcards.length > 0 && (
        <section className={card}>
          <h2 className="text-xl font-semibold">Fiszki</h2>
          <dl className="grid gap-4">
            {flashcards.map((flashcard) => (
              <div key={flashcard.id} className="grid gap-2 rounded-lg border p-4">
                <dt className="font-medium">{flashcard.prompt}</dt>
                <dd className="whitespace-pre-line wrap-anywhere">{flashcard.answer}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      {questions.length > 0 && (
        <section className={card}>
          <h2 className="text-xl font-semibold">Pytania quizowe</h2>
          <ol className="grid gap-4">
            {questions.map((question) => (
              <li key={question.id} className="grid gap-3 rounded-lg border p-4">
                <p className="font-medium">{question.prompt}</p>
                <ol type="A" className="list-[upper-alpha] space-y-1 pl-5">
                  {question.options.map((option, index) => (
                    <li key={option} className={index === question.correctOption ? "font-semibold text-primary" : undefined}>
                      {option}{index === question.correctOption && " (poprawna)"}
                    </li>
                  ))}
                </ol>
                {question.explanation && <p className="whitespace-pre-line text-muted-foreground">{question.explanation}</p>}
              </li>
            ))}
          </ol>
        </section>
      )}
    </>
  );
}
