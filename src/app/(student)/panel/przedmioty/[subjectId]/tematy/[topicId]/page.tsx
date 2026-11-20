import Link from "next/link";
import { notFound } from "next/navigation";

import { requireProfile } from "@/features/auth/session";
import { linkClass, Notice } from "@/features/auth/ui";
import { isUuid } from "@/features/auth/validation";
import { StudentPageIntro } from "@/features/catalog/student-catalog";
import { readPublishedTopic } from "@/features/editorial/queries";
import { TopicContent } from "@/features/editorial/topic-content";
import { TopicFlashcardsLink } from "@/features/learning/flashcard-deck";

export default async function TopicPage({ params }: { params: Promise<{ subjectId: string; topicId: string }> }) {
  const { subjectId, topicId } = await params;
  if (!isUuid(subjectId) || !isUuid(topicId)) notFound();
  const [result, { profile }] = await Promise.all([readPublishedTopic(topicId, subjectId), requireProfile()]);
  if (result.status === "missing") notFound();
  return (
    <main className="mx-auto grid max-w-5xl gap-5 px-4 py-6 sm:gap-7 sm:px-6 sm:py-10">
      <Link href={`/panel/przedmioty/${subjectId}`} className={`${linkClass} w-fit`}>← Wróć do przedmiotu</Link>
      {result.status === "failed" ? (
        <>
          <StudentPageIntro title="Temat" />
          <Notice content={{ text: "Nie udało się pobrać tematu. Odśwież stronę.", error: true }} />
        </>
      ) : (
        <>
          <StudentPageIntro title={result.topic.name}>
            <p className="text-sm text-white/85">{result.subject.name} · {result.section.name}</p>
          </StudentPageIntro>
          {profile?.role === "student" && <TopicFlashcardsLink subjectId={subjectId} topicId={topicId} />}
          <TopicContent material={result.material} assets={result.assets} />
        </>
      )}
    </main>
  );
}
