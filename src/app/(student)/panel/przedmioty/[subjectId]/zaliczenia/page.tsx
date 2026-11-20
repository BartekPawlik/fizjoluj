import Link from "next/link";
import { notFound } from "next/navigation";

import { readSubjectAssessments } from "@/features/assessments/queries";
import { AssessmentDate, SubjectTabs } from "@/features/assessments/student-assessments";
import { linkClass, Notice } from "@/features/auth/ui";
import { isUuid } from "@/features/auth/validation";
import { StudentPageIntro } from "@/features/catalog/student-catalog";

export default async function SubjectAssessmentsPage({ params }: { params: Promise<{ subjectId: string }> }) {
  const { subjectId } = await params;
  if (!isUuid(subjectId)) notFound();
  const result = await readSubjectAssessments(subjectId);
  if (result.status === "missing") notFound();

  return (
    <main className="mx-auto grid max-w-5xl gap-5 px-4 py-6 sm:gap-7 sm:px-6 sm:py-10">
      <Link href="/panel" className={`${linkClass} w-fit`}>← Wróć do przedmiotów</Link>
      <StudentPageIntro title={result.status === "ready" ? result.subject.name : "Zaliczenia"} />
      <SubjectTabs subjectId={subjectId} current="assessments" />
      {result.status === "failed" ? (
        <Notice content={{ text: "Nie udało się pobrać zaliczeń. Odśwież stronę.", error: true }} />
      ) : result.assessments.length ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {result.assessments.map((assessment) => (
            <li key={assessment.id} className="min-w-0">
              <Link href={`/panel/przedmioty/${subjectId}/zaliczenia/${assessment.id}`}
                className="grid h-full gap-2 rounded-2xl border bg-card p-5 shadow-xs hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                <span className="text-lg font-semibold wrap-anywhere">{assessment.name}</span>
                <span className="text-sm text-muted-foreground"><AssessmentDate scheduledOn={assessment.scheduledOn} /></span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border bg-card p-5 text-muted-foreground">Nie ogłoszono jeszcze zaliczeń z tego przedmiotu.</p>
      )}
    </main>
  );
}
