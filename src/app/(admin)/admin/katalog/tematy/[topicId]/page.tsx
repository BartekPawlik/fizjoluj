import Link from "next/link";
import { notFound } from "next/navigation";

import { buttonClass, inputClass, linkClass, Notice, readNotice } from "@/features/auth/ui";
import { isUuid } from "@/features/auth/validation";
import { catalogEditorHref } from "@/features/catalog/validation";
import { publishDraft, removeStudyAsset, startDraft, uploadStudyAsset, withdrawPublication } from "@/features/editorial/actions";
import { DraftEditor } from "@/features/editorial/draft-editor";
import { readTopicForEditor } from "@/features/editorial/queries";
import { StudyItemsPreview, TopicContent } from "@/features/editorial/topic-content";
import type { StudyTopicAsset, StudyTopicRevision } from "@/types/database";

const messages = {
  opened: { text: "Szkic jest gotowy do edycji." },
  saved: { text: "Szkic zapisany." },
  published: { text: "Temat został opublikowany." },
  withdrawn: { text: "Publikacja została wycofana." },
  conflict: { text: "Od czasu otwarcia tej strony inna operacja zmieniła materiał. Sprawdź bieżącą wersję i spróbuj ponownie.", error: true },
  invalid: { text: "Sprawdź dane. Opublikować można temat zawierający materiał.", error: true },
  failed: { text: "Operacja nie powiodła się. Spróbuj ponownie.", error: true },
  "asset-invalid": { text: "Wybierz poprawny PNG, JPEG, WebP lub PDF do 4 MB. Do obrazu dodaj opis alternatywny.", error: true },
  "asset-failed": { text: "Nie udało się przesłać pliku. Spróbuj ponownie.", error: true },
  "asset-saved": { text: "Załącznik dodany do szkicu." },
  "asset-removed": { text: "Załącznik odłączony od szkicu." },
};

export default async function AdminTopicPage({ params, searchParams }: {
  params: Promise<{ topicId: string }>;
  searchParams: Promise<{ podglad?: string | string[]; status?: string | string[] }>;
}) {
  const [{ topicId }, query] = await Promise.all([params, searchParams]);
  if (!isUuid(topicId)) notFound();
  const result = await readTopicForEditor(topicId);
  if (result.status === "missing") notFound();

  if (result.status === "failed") {
    return (
      <main className="mx-auto grid max-w-5xl gap-4 px-4 py-8 sm:px-6">
        <Link href="/admin/katalog" className={linkClass}>Wróć do katalogu</Link>
        <h1 className="text-3xl font-semibold">Materiał tematu</h1>
        <Notice content={{ text: "Nie udało się pobrać materiału. Odśwież stronę.", error: true }} />
      </main>
    );
  }

  const { topic, published, draft, subject, section } = result;
  const preview = query.podglad === "1";
  const editorHref = `/admin/katalog/tematy/${topicId}`;
  const backHref = catalogEditorHref({ semesterId: subject.semester_id, subjectId: subject.id, sectionId: section.id });
  return (
    <main className="mx-auto grid max-w-5xl gap-5 px-4 py-8 sm:px-6">
      <Link href={backHref + "#dzial"} className={`${linkClass} w-fit`}>← Wróć do katalogu</Link>
      <header className="grid gap-2 rounded-2xl border bg-card p-5 sm:p-7">
        <p className="text-sm text-muted-foreground">{subject.name} · {section.name}</p>
        <h1 className="text-3xl font-semibold tracking-tight wrap-anywhere">{topic.name}</h1>
        <div className="flex flex-wrap items-center gap-3">
          {draft && <span className="rounded-full bg-secondary px-3 py-1 text-sm font-medium">Szkic wersji {draft.revision.revision_number}</span>}
          <span className="text-sm text-muted-foreground">
            {published ? `Opublikowana wersja ${published.revision_number}` : "Czeka na pierwszą publikację"}
          </span>
        </div>
      </header>
      <Notice content={readNotice(query.status, messages)} />

      {!draft ? (
        <section className="grid gap-4 rounded-2xl border bg-card p-5">
          <h2 className="text-xl font-semibold">Edycja materiału</h2>
          <form action={startDraft.bind(null, topicId)}>
            <button type="submit" className={buttonClass}>{published ? "Utwórz nową wersję" : "Utwórz szkic"}</button>
          </form>
        </section>
      ) : preview ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4">
            <Link href={editorHref} className={linkClass}>Wróć do edycji</Link>
            <form action={publishDraft.bind(null, topicId)}>
              <DraftFields revision={draft.revision} />
              <button type="submit" className={buttonClass}>Opublikuj temat</button>
            </form>
          </div>
          <TopicContent material={draft.revision} assets={draft.assets} />
          <StudyItemsPreview flashcards={draft.flashcards} questions={draft.questions} />
        </>
      ) : (
        <>
          <Link href={editorHref + "?podglad=1"} className={`${linkClass} w-fit`}>Podejrzyj zapisany szkic</Link>
          <DraftEditor key={`${draft.revision.id}:${draft.revision.edit_version}`} topicId={topicId}
            revision={draft.revision} flashcards={draft.flashcards} questions={draft.questions} />
          <AssetEditor topicId={topicId} revision={draft.revision} assets={draft.assets} />
        </>
      )}

      {published && !preview && (
        <form action={withdrawPublication.bind(null, topicId)} className="rounded-2xl border bg-card p-4">
          <input type="hidden" name="revisionId" value={published.id} />
          <button type="submit" className="min-h-11 px-2 font-medium text-destructive underline underline-offset-4">
            Wycofaj opublikowaną wersję
          </button>
        </form>
      )}
    </main>
  );
}

function DraftFields({ revision }: { revision: StudyTopicRevision }) {
  return (
    <>
      <input type="hidden" name="revisionId" value={revision.id} />
      <input type="hidden" name="editVersion" value={revision.edit_version} />
    </>
  );
}

function AssetEditor({ topicId, revision, assets }: { topicId: string; revision: StudyTopicRevision; assets: StudyTopicAsset[] }) {
  return (
    <section className="grid gap-4 rounded-2xl border bg-card p-5 sm:p-7">
      <h2 className="text-xl font-semibold">Załączniki</h2>
      {assets.length > 0 && (
        <ul className="divide-y divide-border">
          {assets.map((asset) => (
            <li key={asset.id} className="flex flex-wrap items-center justify-between gap-x-4 py-2">
              <a href={`/panel/materialy/${asset.id}`} target="_blank" rel="noreferrer" className={linkClass}>{asset.title}</a>
              <form action={removeStudyAsset.bind(null, topicId)}>
                <DraftFields revision={revision} />
                <input type="hidden" name="assetId" value={asset.id} />
                <button type="submit" className="min-h-11 text-sm font-medium text-destructive underline">Odłącz plik</button>
              </form>
            </li>
          ))}
        </ul>
      )}
      <form action={uploadStudyAsset.bind(null, topicId)} className="grid gap-3">
        <DraftFields revision={revision} />
        <p className="text-sm text-muted-foreground">Przed dodaniem pliku zapisz zmiany w treści szkicu.</p>
        <label className="grid gap-2 text-sm font-medium">
          Plik (PNG, JPEG, WebP lub PDF do 4 MB)
          <input type="file" name="file" accept="image/png,image/jpeg,image/webp,application/pdf" required className={inputClass} />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Tytuł załącznika
          <input name="title" required maxLength={200} className={inputClass} />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Opis alternatywny obrazu
          <input name="alt" maxLength={300} className={inputClass} />
        </label>
        <button type="submit" className={`${buttonClass} w-fit`}>Dodaj załącznik</button>
      </form>
    </section>
  );
}
