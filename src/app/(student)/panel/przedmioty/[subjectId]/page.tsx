import Link from "next/link";
import { notFound } from "next/navigation";

import { SubjectTabs } from "@/features/assessments/student-assessments";
import { Notice } from "@/features/auth/ui";
import { isUuid } from "@/features/auth/validation";
import { readSubjectCatalog } from "@/features/catalog/queries";
import { StudentPageIntro } from "@/features/catalog/student-catalog";
import { SubjectMaterials } from "@/features/catalog/subject-materials";

export default async function SubjectPage({ params }: { params: Promise<{ subjectId: string }> }) {
  const { subjectId } = await params;
  if (!isUuid(subjectId)) notFound();
  const result = await readSubjectCatalog(subjectId);
  if (result.status === "missing") notFound();

  return (
    <main className="mx-auto grid max-w-5xl gap-5 px-4 py-6 sm:gap-7 sm:px-6 sm:py-10">
      <Link href="/panel" className="inline-flex min-h-11 w-fit items-center gap-2 rounded-lg px-2 text-sm font-medium text-primary hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
        <span aria-hidden="true">←</span> Wróć do przedmiotów
      </Link>
      {result.status === "failed" ? (
        <>
          <StudentPageIntro title="Przedmiot" />
          <Notice content={{ text: "Nie udało się pobrać przedmiotu. Odśwież stronę.", error: true }} />
        </>
      ) : (
        <>
          <StudentPageIntro title={result.subject.name} />
          <SubjectTabs subjectId={subjectId} current="topics" />
          <SubjectMaterials sections={result.sections} />
        </>
      )}
    </main>
  );
}
