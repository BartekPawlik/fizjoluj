import Link from "next/link";

import { assessmentAdminHref } from "@/features/assessments/validation";
import { buttonClass, inputClass, linkClass } from "@/features/auth/ui";
import { changeSemesterVisibility, createSemester, saveSection, saveSubject, saveTopic } from "@/features/catalog/actions";
import type { readAdminCatalog } from "@/features/catalog/queries";
import { catalogEditorHref, type CatalogSelection } from "@/features/catalog/validation";

type Editor = NonNullable<Awaited<ReturnType<typeof readAdminCatalog>>>;
type Entry = { id: string; name: string; position: number };
type EditorAction = (form: FormData) => Promise<void>;
type EntryField = "przedmiot" | "dział" | "temat";
const surface = "grid gap-4 rounded-xl border bg-card p-5 sm:p-7";

export function CatalogEditor({ editor }: { editor: Editor }) {
  const { institutions, semesters, current } = editor;
  return (
    <>
      <section className={surface}>
        <h2 className="text-xl font-semibold">Semestry</h2>
        {semesters.length > 0 && (
          <nav aria-label="Semestry katalogu">
            <ul className="flex flex-wrap gap-x-4 gap-y-2">
              {semesters.map(({ id, institution_id, semester_number }) => (
                <li key={id}>
                  <Link href={catalogEditorHref({ semesterId: id })} className={linkClass}
                    aria-current={current?.semester.id === id ? "page" : undefined}>
                    Semestr {semester_number}
                    {institutions.length > 1 && ` · ${institutions.find((institution) => institution.id === institution_id)?.name ?? ""}`}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
        <details open={!current} className="rounded-md border p-3">
          <summary className="cursor-pointer font-medium">Dodaj semestr</summary>
          <form action={createSemester} className="mt-4 grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <label className="grid gap-2 text-sm font-medium">
              Uczelnia
              <select name="institutionId" required className={inputClass} defaultValue={current?.semester.institution_id}>
                {institutions.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Numer semestru
              <input name="semesterNumber" type="number" min={1} max={10} required className={inputClass} />
            </label>
            <button type="submit" className={buttonClass}>Utwórz semestr</button>
          </form>
        </details>
      </section>
      {current && <SemesterEditor current={current} />}
    </>
  );
}

function SemesterEditor({ current }: { current: NonNullable<Editor["current"]> }) {
  const { semester, cohorts, subjects, subject, sections, draftCount, section, topics } = current;
  const selection = { semesterId: semester.id, subjectId: subject?.id, sectionId: section?.id };
  return (
    <>
      <section className={surface}>
        <h2 className="text-xl font-semibold">Semestr {semester.semester_number} · rok studiów {semester.study_year}</h2>
        {cohorts.length ? (
          <ul className="grid gap-3">
            {cohorts.map((cohort) => (
              <li key={cohort.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
                <div>
                  <p className="font-medium">Rocznik {cohort.start_year} · {cohort.academicYear}/{cohort.academicYear + 1}</p>
                  <p className="text-sm text-muted-foreground">{cohort.visible ? "Udostępnianie włączone" : "Ukryty"}</p>
                </div>
                <form action={changeSemesterVisibility}>
                  <SelectionFields selection={selection} />
                  <input type="hidden" name="cohortId" value={cohort.id} />
                  <button type="submit" name="visible" value={String(!cohort.visible)} className={buttonClass}>
                    {cohort.visible ? "Ukryj semestr" : "Udostępnij semestr"}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted-foreground">Ta uczelnia nie ma jeszcze roczników.</p>}
      </section>
      <section className={surface}>
        <h2 className="text-xl font-semibold">Przedmioty</h2>
        <EntryLinks entries={subjects} currentId={subject?.id}
          href={(id) => catalogEditorHref({ semesterId: semester.id, subjectId: id }) + "#przedmiot"} />
        <details className="rounded-md border p-3">
          <summary className="cursor-pointer font-medium">Dodaj przedmiot</summary>
          <NameEntryForm action={saveSubject} selection={selection} kind="przedmiot" nextPosition={nextPosition(subjects)} />
        </details>
      </section>
      {subject && (
        <section id="przedmiot" className={surface}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold wrap-anywhere">{subject.name}</h2>
            <Link href={assessmentAdminHref(subject.id)} className={buttonClass}>Zaliczenia</Link>
          </div>
          <NameEntryForm key={subject.id} action={saveSubject} selection={selection} kind="przedmiot" entry={subject} />
          <h3 className="text-lg font-semibold">Działy</h3>
          {draftCount > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">Szkice tematów: {draftCount}</p>
              <Link href={`/admin/katalog/publikacja/${subject.id}`} className={buttonClass}>
                Opublikuj wszystkie szkice
              </Link>
            </div>
          )}
          <EntryLinks entries={sections} currentId={section?.id}
            detail={(entry) => entry.draftCount ? `Szkice: ${entry.draftCount}` : undefined}
            href={(id) => catalogEditorHref({ ...selection, sectionId: id }) + "#dzial"} />
          <details className="rounded-md border p-3">
            <summary className="cursor-pointer font-medium">Dodaj dział</summary>
            <NameEntryForm action={saveSection} selection={selection} kind="dział" nextPosition={nextPosition(sections)} />
          </details>
        </section>
      )}
      {section && (
        <section id="dzial" className={surface}>
          <h2 className="text-xl font-semibold">{section.name}</h2>
          <NameEntryForm key={section.id} action={saveSection} selection={selection} kind="dział" entry={section} />
          <h3 className="text-lg font-semibold">Tematy</h3>
          {topics.length ? (
            <ul className="grid gap-3">
              {topics.map((topic) => (
                <li key={topic.id} className="grid gap-2 rounded-lg border p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <Link href={`/admin/katalog/tematy/${topic.id}`} className={linkClass}>{topic.name}</Link>
                    {topic.hasDraft && <span className="rounded-full bg-secondary px-2 py-1 text-xs font-medium">Szkic</span>}
                  </div>
                  <details className="rounded-md border p-3">
                    <summary className="cursor-pointer text-sm font-medium">Nazwa i kolejność</summary>
                    <NameEntryForm action={saveTopic} selection={selection} kind="temat" entry={topic} />
                  </details>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted-foreground">Lista tematów jest pusta.</p>}
          <details className="rounded-md border p-3">
            <summary className="cursor-pointer font-medium">Dodaj temat</summary>
            <NameEntryForm action={saveTopic} selection={selection} kind="temat" nextPosition={nextPosition(topics)} />
          </details>
        </section>
      )}
    </>
  );
}

function SelectionFields({ selection }: { selection: CatalogSelection }) {
  return Object.entries(selection).map(([name, value]) =>
    value && <input key={name} type="hidden" name={name} value={value} />);
}

function EntryLinks<T extends Entry>({ entries, currentId, detail, href }: {
  entries: T[];
  currentId?: string;
  detail?: (entry: T) => string | undefined;
  href: (id: string) => string;
}) {
  if (!entries.length) return <p className="text-sm text-muted-foreground">Lista jest pusta.</p>;
  return (
    <ul className="grid gap-x-5 gap-y-2 sm:grid-cols-2">
      {entries.map((entry) => {
        const label = detail?.(entry);
        return (
          <li key={entry.id}>
            <Link href={href(entry.id)} aria-current={currentId === entry.id ? "page" : undefined} className={linkClass}>
              {entry.name}
            </Link>
            {label && <p className="text-sm text-muted-foreground">{label}</p>}
          </li>
        );
      })}
    </ul>
  );
}

function NameEntryForm({ selection, action, kind, entry, nextPosition = 1 }: {
  selection: CatalogSelection;
  action: EditorAction;
  kind: EntryField;
  entry?: Entry;
  nextPosition?: number;
}) {
  return (
    <form action={action} className="mt-2 grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_7rem_auto]">
      <SelectionFields selection={selection} />
      {entry && <input type="hidden" name="entryId" value={entry.id} />}
      <label className="grid gap-2 text-sm font-medium">
        Nazwa
        <input name="name" defaultValue={entry?.name} required maxLength={250} className={inputClass} />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        Kolejność
        <input name="position" type="number" min={0} max={9999} defaultValue={entry?.position ?? nextPosition} required className={inputClass} />
      </label>
      <button type="submit" className={buttonClass}>{entry ? "Zapisz" : "Dodaj"} {kind}</button>
    </form>
  );
}

function nextPosition(entries: Entry[]) {
  return Math.min((entries.at(-1)?.position ?? 0) + 1, 9999);
}
