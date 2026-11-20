"use client";

import { useActionState, useState } from "react";

import { saveAssessment } from "@/features/assessments/actions";
import type { readAssessmentEditor } from "@/features/assessments/queries";
import { assessmentDateFieldName } from "@/features/assessments/validation";

type EditorData = Extract<Awaited<ReturnType<typeof readAssessmentEditor>>, { status: "ready" }>;
const inputClass = "w-full min-w-0 rounded-md border border-input bg-card px-3 py-2 text-base";
const selectionClass = "min-h-11 rounded-md border bg-card px-3 text-sm font-medium text-primary hover:bg-secondary";

export function AssessmentEditor({ editor }: { editor: EditorData }) {
  const { assessment, subject, sections, cohorts, locations, dates } = editor;
  const [state, action, pending] = useActionState(saveAssessment.bind(null, subject.id, assessment?.id ?? null), {});
  const [name, setName] = useState(assessment?.name ?? "");
  const [selectedIds, setSelectedIds] = useState(() => new Set(editor.selectedTopicIds));
  const [dateValues, setDateValues] = useState<Record<string, string>>(() => Object.fromEntries(dates.map((date) => [
    assessmentDateFieldName(date.cohort_id, date.location_id ?? undefined),
    date.scheduled_on,
  ])));
  const allTopicIds = sections.flatMap(({ topics }) => topics.map(({ id }) => id));
  const publishedIds = new Set(editor.publishedTopicIds);

  function setTopicSelection(ids: string[], selected: boolean) {
    setSelectedIds((current) => {
      const updated = new Set(current);
      for (const id of ids) {
        if (selected) updated.add(id);
        else updated.delete(id);
      }
      return updated;
    });
  }

  return (
    <form action={action} className="grid gap-6 rounded-xl border bg-card p-4 sm:p-6">
      <input type="hidden" name="editVersion" value={assessment?.edit_version ?? 0} />
      <h2 className="text-xl font-semibold">{assessment ? "Edytuj zaliczenie" : "Dodaj zaliczenie"}</h2>
      <label className="grid gap-2 text-sm font-medium">
        Nazwa zaliczenia
        <input name="name" maxLength={250} required value={name} onChange={(event) => setName(event.target.value)} className={inputClass} />
      </label>

      {cohorts.length > 0 && (
        <fieldset className="grid min-w-0 gap-3">
          <legend className="mb-2 text-lg font-semibold">Terminy</legend>
          <p className="text-sm text-muted-foreground">Data lokalizacji ma pierwszeństwo przed wspólnym terminem rocznika.</p>
          {cohorts.map((cohort) => (
            <details key={cohort.id} open={cohorts.length === 1} className="rounded-lg border">
              <summary className="cursor-pointer px-4 py-3 font-medium">Rocznik {cohort.start_year}</summary>
              <div className="grid gap-3 border-t p-4 sm:grid-cols-2 lg:grid-cols-3">
                {[{ id: undefined, name: "Wspólny termin" }, ...locations].map((location) => {
                  const field = assessmentDateFieldName(cohort.id, location.id);
                  return (
                    <label key={field} className="grid gap-2 text-sm font-medium">
                      {location.name}
                      <input type="date" name={field} value={dateValues[field] ?? ""} className={inputClass}
                        onChange={(event) => setDateValues({ ...dateValues, [field]: event.target.value })} />
                    </label>
                  );
                })}
              </div>
            </details>
          ))}
        </fieldset>
      )}

      <fieldset className="grid min-w-0 gap-3">
        <legend className="mb-2 text-lg font-semibold">Zakres zaliczenia</legend>
        {allTopicIds.length === 0 ? (
          <p className="text-sm text-muted-foreground">Najpierw dodaj tematy w katalogu przedmiotu.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">Wybrane tematy ({selectedIds.size})</p>
              <button type="button" className={selectionClass}
                onClick={() => setTopicSelection(allTopicIds, selectedIds.size !== allTopicIds.length)}>
                {selectedIds.size === allTopicIds.length ? "Odznacz wszystkie" : "Zaznacz wszystkie"}
              </button>
            </div>
            {sections.map((section) => {
              const topicIds = section.topics.map(({ id }) => id);
              const selectedCount = topicIds.filter((id) => selectedIds.has(id)).length;
              return (
                <details key={section.id} open={sections.length === 1} className="min-w-0 rounded-lg border">
                  <summary className="cursor-pointer px-4 py-3 font-medium wrap-anywhere">
                    {section.name} <span className="text-sm text-muted-foreground">({selectedCount}/{topicIds.length})</span>
                  </summary>
                  <div className="grid gap-2 border-t p-3 sm:p-4">
                    <button type="button" className={`${selectionClass} w-fit`}
                      onClick={() => setTopicSelection(topicIds, selectedCount !== topicIds.length)}>
                      {selectedCount === topicIds.length ? "Odznacz cały dział" : "Zaznacz cały dział"}
                    </button>
                    {section.topics.map((topic) => (
                      <label key={topic.id} className="flex min-h-11 items-center gap-3 rounded-md px-2 py-2 hover:bg-secondary/50">
                        <input type="checkbox" name="topicId" value={topic.id} checked={selectedIds.has(topic.id)}
                          onChange={(event) => setTopicSelection([topic.id], event.target.checked)}
                          className="size-4 shrink-0 accent-primary" />
                        <span className="text-sm wrap-anywhere">
                          {topic.name}
                          {!publishedIds.has(topic.id) && <span className="ml-2 text-xs text-muted-foreground">Materiał nieopublikowany</span>}
                        </span>
                      </label>
                    ))}
                  </div>
                </details>
              );
            })}
          </>
        )}
      </fieldset>

      {state.message && <p role="alert" className="rounded-md bg-destructive/8 p-3 text-destructive">{state.message}</p>}
      <button type="submit" disabled={pending} className="min-h-11 w-fit rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-55">
        {pending ? "Zapisywanie…" : assessment?.published_at ? "Zapisz zmiany dla studentów" : "Zapisz szkic"}
      </button>
    </form>
  );
}
