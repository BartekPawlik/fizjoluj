import Link from "next/link";
import { notFound } from "next/navigation";

import { buttonClass, linkClass, Notice, readNotice } from "@/features/auth/ui";
import { isUuid } from "@/features/auth/validation";
import { catalogEditorHref } from "@/features/catalog/validation";
import { AssessmentEditor } from "@/features/assessments/assessment-editor";
import { publishAssessment } from "@/features/assessments/actions";
import { readAssessmentEditor } from "@/features/assessments/queries";
import { assessmentAdminHref } from "@/features/assessments/validation";

const messages = {
  saved: { text: "Zapisano zaliczenie." },
  published: { text: "Zaliczenie zostało opublikowane." },
  conflict: { text: "Zaliczenie się zmieniło. Sprawdź aktualny zakres przed publikacją.", error: true },
  invalid: { text: "Zapisz zakres z co najmniej jednym tematem przed publikacją.", error: true },
  failed: { text: "Nie udało się opublikować zaliczenia. Spróbuj ponownie.", error: true },
};

export default async function AdminAssessmentsPage({ params, searchParams }: {
  params: Promise<{ subjectId: string }>;
  searchParams: Promise<{ zaliczenie?: string | string[]; status?: string | string[] }>;
}) {
  const [{ subjectId }, { zaliczenie, status }] = await Promise.all([params, searchParams]);
  if (!isUuid(subjectId) || (zaliczenie !== undefined && !isUuid(zaliczenie))) notFound();
  const editor = await readAssessmentEditor(subjectId, zaliczenie);
  if (editor.status === "missing") notFound();
  if (editor.status === "failed") {
    return (
      <main className="mx-auto grid max-w-5xl gap-5 px-4 py-8 sm:px-6">
        <Link href="/admin/katalog" className={linkClass}>← Wróć do katalogu</Link>
        <h1 className="text-3xl font-semibold">Zaliczenia</h1>
        <Notice content={{ text: "Nie udało się pobrać zaliczeń. Odśwież stronę.", error: true }} />
      </main>
    );
  }

  const { assessment, assessments, selectedTopicIds, subject } = editor;
  const backHref = catalogEditorHref({ semesterId: subject.semester_id, subjectId }) + "#przedmiot";
  return (
    <main className="mx-auto grid max-w-5xl gap-5 px-4 py-8 sm:px-6">
      <Link href={backHref} className={`${linkClass} w-fit`}>← Wróć do katalogu</Link>
      <header className="grid gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">Zaliczenia</h1>
        <p className="text-muted-foreground wrap-anywhere">{subject.name}</p>
      </header>
      <Notice content={readNotice(status, messages)} />

      {assessments.length > 0 && (
        <nav aria-label="Zaliczenia przedmiotu" className="grid gap-3 rounded-xl border bg-card p-4 sm:p-6">
          <ul className="grid gap-3">
            {assessments.map((item) => (
              <li key={item.id} className="flex flex-wrap items-baseline justify-between gap-2">
                <Link href={assessmentAdminHref(subjectId, item.id)} aria-current={assessment?.id === item.id ? "page" : undefined}
                  className={`${linkClass} wrap-anywhere`}>{item.name}</Link>
                <span className="text-sm text-muted-foreground">{item.published_at ? "Opublikowane" : "Szkic"}</span>
              </li>
            ))}
          </ul>
          {assessment && <Link href={assessmentAdminHref(subjectId)} className={`${linkClass} w-fit`}>Dodaj zaliczenie</Link>}
        </nav>
      )}

      {assessment && !assessment.published_at && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 sm:p-5">
          {selectedTopicIds.length ? (
            <>
              <p className="text-sm text-muted-foreground">Publikacja obejmuje zapisany zakres i terminy.</p>
              <form action={publishAssessment.bind(null, subjectId, assessment.id)}>
                <input type="hidden" name="editVersion" value={assessment.edit_version} />
                <button type="submit" className={buttonClass}>Opublikuj zaliczenie</button>
              </form>
            </>
          ) : <p className="text-sm text-muted-foreground">Zapisz zakres z co najmniej jednym tematem, aby opublikować zaliczenie.</p>}
        </div>
      )}

      <AssessmentEditor key={`${assessment?.id ?? "new"}-${assessment?.edit_version ?? 0}`} editor={editor} />
    </main>
  );
}
