import Link from "next/link";
import { notFound } from "next/navigation";

import { readStudentAssessment } from "@/features/assessments/queries";
import { AssessmentDate, SubjectTabs } from "@/features/assessments/student-assessments";
import { linkClass, Notice } from "@/features/auth/ui";
import { isUuid } from "@/features/auth/validation";
import { StudentPageIntro } from "@/features/catalog/student-catalog";
import { SubjectMaterials } from "@/features/catalog/subject-materials";

export default async function StudentAssessmentPage({ params }: {
  params: Promise<{ subjectId: string; assessmentId: string }>;
}) {
  const { subjectId, assessmentId } = await params;
  if (!isUuid(subjectId) || !isUuid(assessmentId)) notFound();
  const result = await readStudentAssessment(subjectId, assessmentId);
  if (result.status === "missing") notFound();

  return (
    <main className="mx-auto grid max-w-5xl gap-5 px-4 py-6 sm:gap-7 sm:px-6 sm:py-10">
      <Link href={`/panel/przedmioty/${subjectId}/zaliczenia`} className={`${linkClass} w-fit`}>← Wróć do zaliczeń</Link>
      {result.status === "failed" ? (
        <Notice content={{ text: "Nie udało się pobrać zakresu zaliczenia. Odśwież stronę.", error: true }} />
      ) : (
        <>
          <StudentPageIntro title={result.assessment.name}>
            <p className="text-sm text-white/85"><AssessmentDate scheduledOn={result.assessment.scheduledOn} /></p>
          </StudentPageIntro>
          <SubjectTabs subjectId={subjectId} current="assessments" />
          <SubjectMaterials sections={result.sections} />
        </>
      )}
    </main>
  );
}
