import Link from "next/link";
import { notFound } from "next/navigation";

import { buttonClass, linkClass, Notice, readNotice, type StatusSearch } from "@/features/auth/ui";
import { isUuid } from "@/features/auth/validation";
import { catalogEditorHref } from "@/features/catalog/validation";
import { publishSubjectDrafts } from "@/features/editorial/actions";
import { readSubjectDrafts } from "@/features/editorial/queries";

const messages = {
  published: { text: "Szkice zostały opublikowane." },
  conflict: { text: "Lista lub treść szkiców się zmieniła. Sprawdź aktualny zestaw i potwierdź ponownie.", error: true },
  invalid: { text: "Sprawdź, czy każdy szkic zawiera materiał, i spróbuj ponownie.", error: true },
  setup: { text: "Publikacja zbiorcza wymaga aktualizacji bazy danych.", error: true },
  failed: { text: "Nie udało się opublikować szkiców. Spróbuj ponownie.", error: true },
};

export default async function SubjectPublicationPage({ params, searchParams }: {
  params: Promise<{ subjectId: string }>;
  searchParams: StatusSearch;
}) {
  const [{ subjectId }, { status }] = await Promise.all([params, searchParams]);
  if (!isUuid(subjectId)) notFound();
  const result = await readSubjectDrafts(subjectId);
  if (result.status === "missing") notFound();

  const backHref = result.status === "ready"
    ? catalogEditorHref({ semesterId: result.subject.semester_id, subjectId }) + "#przedmiot"
    : "/admin/katalog";

  return (
    <main className="mx-auto grid max-w-5xl gap-5 px-4 py-8 sm:px-6">
      <Link href={backHref} className={`${linkClass} w-fit`}>← Wróć do katalogu</Link>
      <header className="grid gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">Publikacja szkiców</h1>
        {result.status === "ready" && <p className="text-muted-foreground wrap-anywhere">{result.subject.name}</p>}
      </header>
      {result.status === "failed" ? (
        <Notice content={{ text: "Nie udało się pobrać szkiców. Odśwież stronę.", error: true }} />
      ) : (
        <>
          <Notice content={readNotice(status, messages)} />
          {result.sections.length > 0 ? (
            <DraftPublicationForm sections={result.sections} subjectId={subjectId} />
          ) : (
            status !== "published" && <p className="text-muted-foreground">Ten przedmiot nie ma szkiców do publikacji.</p>
          )}
        </>
      )}
    </main>
  );
}

type DraftSections = Extract<Awaited<ReturnType<typeof readSubjectDrafts>>, { status: "ready" }>["sections"];

function DraftPublicationForm({ sections, subjectId }: { sections: DraftSections; subjectId: string }) {
  const count = sections.reduce((total, section) => total + section.topics.length, 0);
  return (
    <form action={publishSubjectDrafts.bind(null, subjectId)} className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-4 sm:p-5">
        <div className="grid gap-1">
          <h2 className="text-xl font-semibold">Tematy do publikacji ({count})</h2>
          <p className="text-sm text-muted-foreground">Po potwierdzeniu studenci z dostępem do semestru zobaczą te materiały.</p>
        </div>
        <button type="submit" className={buttonClass}>Potwierdź publikację</button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {sections.map((section) => (
          <section key={section.id} className="min-w-0 rounded-xl border bg-card p-4 sm:p-5">
            <h3 className="text-lg font-semibold wrap-anywhere">{section.name}</h3>
            <ul className="mt-2 divide-y divide-border">
              {section.topics.map((topic) => (
                <li key={topic.id} className="py-2.5 wrap-anywhere">
                  <input type="hidden" name="revisionId" value={topic.draft.id} />
                  <input type="hidden" name="editVersion" value={topic.draft.edit_version} />
                  <Link href={`/admin/katalog/tematy/${topic.id}?podglad=1`} prefetch={false} className={linkClass}>
                    {topic.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </form>
  );
}
