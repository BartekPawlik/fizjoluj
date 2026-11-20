"use client";

import { useActionState, useState } from "react";

import { saveDraft } from "@/features/editorial/actions";
import { STUDY_ITEM_LIMIT, type StudyFlashcard, type StudyQuestion } from "@/features/editorial/validation";
import type { StudyTopicRevision } from "@/types/database";

const field = "w-full rounded-md border border-input bg-card px-3 py-2 text-base";
const primary = "min-h-11 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-55";
const secondary = "min-h-11 rounded-md border bg-secondary px-4 py-2 font-medium text-secondary-foreground hover:bg-accent disabled:opacity-55";

export function DraftEditor({ topicId, revision, flashcards, questions }: {
  topicId: string;
  revision: StudyTopicRevision;
  flashcards: StudyFlashcard[];
  questions: StudyQuestion[];
}) {
  const [state, action, pending] = useActionState(saveDraft.bind(null, topicId), {});
  const [notes, setNotes] = useState(revision.notes.join("\n"));
  const [mnemonic, setMnemonic] = useState(revision.mnemonic);
  const [correction, setCorrection] = useState(revision.correction);
  const [sourceLabel, setSourceLabel] = useState(revision.source_label);
  const [sourceUrl, setSourceUrl] = useState(revision.source_url);
  const [cards, setCards] = useState(flashcards);
  const [quiz, setQuiz] = useState(questions);

  function updateCard(id: string, change: Partial<StudyFlashcard>) {
    setCards((current) => current.map((card) => card.id === id ? { ...card, ...change } : card));
  }
  function updateQuestion(id: string, change: Partial<StudyQuestion>) {
    setQuiz((current) => current.map((question) => question.id === id ? { ...question, ...change } : question));
  }

  return (
    <form action={action} className="grid gap-5">
      <input type="hidden" name="revisionId" value={revision.id} />
      <input type="hidden" name="editVersion" value={revision.edit_version} />
      <input type="hidden" name="flashcards" value={JSON.stringify(cards)} />
      <input type="hidden" name="questions" value={JSON.stringify(quiz)} />

      <section className="grid gap-4 rounded-2xl border bg-card p-5 sm:p-7" aria-labelledby="draft-notes-title">
        <h2 id="draft-notes-title" className="text-xl font-semibold">Treść tematu</h2>
        <label className="grid gap-2 font-medium">
          Notatki
          <span className="text-sm font-normal text-muted-foreground">Każdą myśl wpisz w osobnym wierszu.</span>
          <textarea name="notes" rows={10} value={notes} onChange={(event) => setNotes(event.target.value)} className={field} />
        </label>
        <label className="grid gap-2 font-medium">
          Skojarzenie
          <textarea name="mnemonic" rows={3} maxLength={4000} value={mnemonic} onChange={(event) => setMnemonic(event.target.value)} className={field} />
        </label>
        <label className="grid gap-2 font-medium">
          Uwaga do źródła
          <textarea name="correction" rows={3} maxLength={4000} value={correction} onChange={(event) => setCorrection(event.target.value)} className={field} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium">
            Nazwa źródła
            <input name="sourceLabel" maxLength={200} value={sourceLabel} onChange={(event) => setSourceLabel(event.target.value)} className={field} />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Adres źródła (HTTPS)
            <input name="sourceUrl" type="url" maxLength={2048} value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} className={field} />
          </label>
        </div>
      </section>

      <section className="grid gap-4 rounded-2xl border bg-card p-5 sm:p-7" aria-labelledby="draft-flashcards-title">
        <h2 id="draft-flashcards-title" className="text-xl font-semibold">Fiszki</h2>
        {cards.map((card, index) => (
          <fieldset key={card.id} className="grid min-w-0 gap-3 rounded-lg border p-4">
            <legend className="px-1 font-medium">Fiszka {index + 1}</legend>
            <label className="grid gap-2 text-sm font-medium">
              Pytanie lub temat fiszki
              <input required maxLength={1000} value={card.prompt} onChange={(event) => updateCard(card.id, { prompt: event.target.value })} className={field} />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Odpowiedź na fiszce
              <textarea required rows={4} maxLength={8000} value={card.answer} onChange={(event) => updateCard(card.id, { answer: event.target.value })} className={field} />
            </label>
            <button type="button" className="min-h-11 w-fit px-2 text-sm font-medium text-destructive underline underline-offset-4"
              onClick={() => setCards((current) => current.filter(({ id }) => id !== card.id))}>
              Usuń fiszkę {index + 1}
            </button>
          </fieldset>
        ))}
        <button type="button" className={secondary + " w-fit"} disabled={cards.length >= STUDY_ITEM_LIMIT}
          onClick={() => setCards((current) => [...current, { id: crypto.randomUUID(), prompt: "", answer: "" }])}>
          Dodaj fiszkę
        </button>
      </section>

      <section className="grid gap-4 rounded-2xl border bg-card p-5 sm:p-7" aria-labelledby="draft-quiz-title">
        <h2 id="draft-quiz-title" className="text-xl font-semibold">Pytania quizowe</h2>
        {quiz.map((question, index) => (
          <fieldset key={question.id} className="grid min-w-0 gap-3 rounded-lg border p-4">
            <legend className="px-1 font-medium">Pytanie {index + 1}</legend>
            <label className="grid gap-2 text-sm font-medium">
              Treść pytania
              <textarea required rows={2} maxLength={1000} value={question.prompt} onChange={(event) => updateQuestion(question.id, { prompt: event.target.value })} className={field} />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              {question.options.map((option, optionIndex) => (
                <label key={optionIndex} className="grid gap-2 text-sm font-medium">
                  Odpowiedź {"ABCD"[optionIndex]}
                  <input required maxLength={1000} value={option} className={field}
                    onChange={(event) => updateQuestion(question.id, {
                      options: question.options.map((text, i) => i === optionIndex ? event.target.value : text),
                    })} />
                </label>
              ))}
            </div>
            <label className="grid gap-2 text-sm font-medium">
              Poprawna odpowiedź
              <select value={question.correctOption} onChange={(event) => updateQuestion(question.id, { correctOption: Number(event.target.value) })} className={field}>
                {["A", "B", "C", "D"].map((option, i) => <option key={option} value={i}>{option}</option>)}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Wyjaśnienie odpowiedzi
              <textarea rows={3} maxLength={4000} value={question.explanation}
                onChange={(event) => updateQuestion(question.id, { explanation: event.target.value })} className={field} />
            </label>
            <button type="button" className="min-h-11 w-fit px-2 text-sm font-medium text-destructive underline underline-offset-4"
              onClick={() => setQuiz((current) => current.filter(({ id }) => id !== question.id))}>
              Usuń pytanie {index + 1}
            </button>
          </fieldset>
        ))}
        <button type="button" className={secondary + " w-fit"} disabled={quiz.length >= STUDY_ITEM_LIMIT}
          onClick={() => setQuiz((current) => [...current, {
            id: crypto.randomUUID(), prompt: "", options: ["", "", "", ""], correctOption: 0, explanation: "",
          }])}>
          Dodaj pytanie
        </button>
      </section>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-4">
        {state.message && <p role="alert" className="basis-full text-sm text-destructive">{state.message}</p>}
        <button type="submit" className={primary} disabled={pending}>{pending ? "Zapisywanie…" : "Zapisz szkic"}</button>
        <button type="submit" name="next" value="preview" className={secondary} disabled={pending}>Zapisz i podejrzyj</button>
      </div>
    </form>
  );
}
