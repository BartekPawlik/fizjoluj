import type { readSubjectCatalog } from "@/features/catalog/queries";
import { TopicContent } from "@/features/editorial/topic-content";
import { TopicFlashcardsLink } from "@/features/learning/flashcard-deck";

type SubjectSections = Extract<Awaited<ReturnType<typeof readSubjectCatalog>>, { status: "ready" }>["sections"];

const summaryClass = "cursor-pointer list-none rounded-xl px-4 py-3 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden";
const chevronClass = "size-2 shrink-0 -rotate-45 border-r-2 border-b-2 border-primary";

export function SubjectMaterials({ sections, flashcardSubjectId }: { sections: SubjectSections; flashcardSubjectId?: string }) {
  const publishedSections = sections.filter(({ topics }) => topics.length > 0);

  return (
    <section aria-labelledby="subject-materials-title" className="grid gap-4">
      <h2 id="subject-materials-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Materiały do nauki
      </h2>
      {publishedSections.length === 0 ? (
        <p role="status" className="rounded-2xl border bg-card p-5 text-muted-foreground">
          Materiały nie zostały jeszcze opublikowane.
        </p>
      ) : (
        <div className="grid gap-3">
          {publishedSections.map((section) => (
            <details key={section.id} className="group/section min-w-0 rounded-2xl border bg-card shadow-xs">
              <summary className={`${summaryClass} hover:bg-secondary/70 sm:px-6 sm:py-4`}>
                <h3 className="flex min-h-6 items-center justify-between gap-4 text-lg font-semibold wrap-anywhere sm:text-xl">
                  {section.name}
                  <span aria-hidden="true" className={`${chevronClass} group-open/section:rotate-45`} />
                </h3>
              </summary>
              <ul className="divide-y divide-border border-t">
                {section.topics.map((topic) => (
                  <li key={topic.id}>
                    <details className="group/topic">
                      <summary className={`${summaryClass} hover:bg-secondary/50 sm:px-6`}>
                        <h4 className="flex min-h-6 items-center justify-between gap-4 font-medium wrap-anywhere">
                          {topic.name}
                          <span aria-hidden="true" className={`${chevronClass} group-open/topic:rotate-45`} />
                        </h4>
                      </summary>
                      <div className="grid gap-3 px-3 pb-4 sm:px-6">
                        {flashcardSubjectId && <TopicFlashcardsLink subjectId={flashcardSubjectId} topicId={topic.id} />}
                        <TopicContent material={topic.material} assets={topic.assets} heading="h5" />
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
