"use client";

import { useEffect, useRef, useState, useTransition, type PointerEvent } from "react";

import { rateFlashcard } from "@/features/learning/actions";
import { flashcardKey, type SessionFlashcard } from "@/features/learning/validation";
import type { StudyFlashcardRating } from "@/types/database";

type StudyMode = "learn" | "practice";
type Session = { mode: StudyMode; queue: SessionFlashcard[]; position: number; ratings: Map<string, StudyFlashcardRating> };
type RatingError = { text: string; refresh?: boolean };
type TouchStart = { id: number; x: number; y: number; time: number };

const focusClass = "touch-manipulation focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const primary = `min-h-11 rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-55 ${focusClass}`;
const secondary = `min-h-11 rounded-lg border bg-card px-4 py-2 font-semibold text-primary hover:bg-secondary disabled:opacity-55 ${focusClass}`;
const modeButton = `grid gap-2 rounded-2xl border bg-card p-5 text-left shadow-xs hover:border-primary/50 hover:bg-secondary/40 sm:p-6 ${focusClass}`;

export function FlashcardSession({ assessmentId, cards }: { assessmentId: string | null; cards: SessionFlashcard[] }) {
  const [session, setSession] = useState<Session | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<RatingError | null>(null);
  const [pending, startTransition] = useTransition();
  const [progress, setProgress] = useState(() => new Map(cards.flatMap((card) => (
    card.progress ? [[flashcardKey(card.topicId, card.id), card.progress] as const] : []
  ))));
  const submitting = useRef(false);
  const touch = useRef<TouchStart | null>(null);
  const touchFrame = useRef(0);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => () => cancelAnimationFrame(touchFrame.current), []);

  useEffect(() => {
    heading.current?.focus();
  }, [session?.mode, session?.position]);

  function start(mode: StudyMode, queue = cards) {
    move({ mode, queue, position: 0, ratings: new Map() });
  }

  function move(next: Session | null) {
    cancelAnimationFrame(touchFrame.current);
    touch.current = null;
    setSession(next);
    setRevealed(false);
    setError(null);
  }

  function navigate(current: Session, direction: -1 | 1) {
    const position = current.position + direction;
    if (submitting.current || position < 0 || position > current.queue.length) return;
    move({ ...current, position });
  }

  function beginTouch(event: PointerEvent<HTMLElement>) {
    if (event.pointerType !== "touch") return;
    touch.current = event.isPrimary && !submitting.current
      ? { id: event.pointerId, x: event.clientX, y: event.clientY, time: event.timeStamp }
      : null;
  }

  function finishTouch(event: PointerEvent<HTMLElement>, current: Session) {
    const origin = touch.current;
    if (!origin || origin.id !== event.pointerId) return;
    touch.current = null;
    if (submitting.current) return;

    const dx = event.clientX - origin.x;
    const dy = event.clientY - origin.y;
    if (Math.abs(dx) >= 48 && Math.abs(dx) > Math.abs(dy) * 1.35) {
      const direction = dx < 0 ? 1 : -1;
      const position = current.position + direction;
      if (position < 0 || position >= current.queue.length) return;
      // Let the browser finish delivering touchend to the current card before it is removed.
      touchFrame.current = requestAnimationFrame(() => navigate(current, direction));
    } else if (current.mode === "practice" && Math.hypot(dx, dy) <= 10 && event.timeStamp - origin.time < 450) {
      touchFrame.current = requestAnimationFrame(() => setRevealed((value) => !value));
    }
  }

  function rate(card: SessionFlashcard, current: Session, rating: StudyFlashcardRating) {
    if (submitting.current) return;
    submitting.current = true;
    setError(null);
    const key = flashcardKey(card.topicId, card.id);
    startTransition(async () => {
      try {
        const result = await rateFlashcard({
          assessmentId, topicId: card.topicId, revisionId: card.revisionId, flashcardId: card.id, rating,
          expectedVersion: progress.get(key)?.version ?? 0,
        });
        if (result.status === "rated") {
          setProgress((previous) => new Map(previous).set(key, { rating, version: result.version }));
          move({ ...current, position: current.position + 1, ratings: new Map(current.ratings).set(key, rating) });
        } else if (result.status === "conflict") {
          setError({ text: "Fiszka lub jej ocena się zmieniła. Odśwież zestaw przed dalszą nauką.", refresh: true });
        } else if (result.status === "forbidden") {
          setError({ text: "Ta fiszka nie jest teraz dostępna. Odśwież zestaw.", refresh: true });
        } else {
          setError({ text: "Nie udało się zapisać oceny. Spróbuj ponownie." });
        }
      } catch {
        setError({ text: "Nie udało się zapisać oceny. Spróbuj ponownie." });
      } finally {
        submitting.current = false;
      }
    });
  }

  if (!session) {
    const difficult = cards.filter((card) => progress.get(flashcardKey(card.topicId, card.id))?.rating === "review");
    return (
      <section aria-labelledby="flashcard-mode-title" className="grid gap-4">
        <h2 id="flashcard-mode-title" ref={heading} tabIndex={-1} className="text-2xl font-semibold tracking-tight focus:outline-none">
          Wybierz tryb
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={() => start("learn")} className={modeButton}>
            <span className="text-xl font-semibold text-primary">Nauka</span>
            <span className="text-sm text-muted-foreground">Czytaj pytanie i odpowiedź na każdej fiszce.</span>
          </button>
          <button type="button" onClick={() => start("practice")} className={modeButton}>
            <span className="text-xl font-semibold text-primary">Sprawdź się</span>
            <span className="text-sm text-muted-foreground">Odpowiedz z pamięci, odwróć fiszkę i oceń swoją odpowiedź.</span>
          </button>
        </div>
        {difficult.length > 0 && (
          <button type="button" onClick={() => start("practice", difficult)} className={`${secondary} w-fit`}>
            Powtórz trudne ({difficult.length})
          </button>
        )}
      </section>
    );
  }

  const card = session.queue[session.position];
  const learning = session.mode === "learn";
  if (!card) {
    const difficult = session.queue.filter((entry) => session.ratings.get(flashcardKey(entry.topicId, entry.id)) === "review");
    const skipped = session.queue.length - session.ratings.size;
    return (
      <section aria-labelledby="flashcard-results-title" className="grid gap-4 rounded-2xl border bg-card p-5 sm:p-7">
        <h2 id="flashcard-results-title" ref={heading} tabIndex={-1} className="text-2xl font-semibold focus:outline-none">
          {learning ? "Fiszki przejrzane" : "Podsumowanie sesji"}
        </h2>
        {!learning && (
          <dl className="flex flex-wrap gap-6">
            <div><dt className="text-sm text-muted-foreground">Znam</dt><dd className="text-2xl font-semibold">{session.ratings.size - difficult.length}</dd></div>
            <div><dt className="text-sm text-muted-foreground">Do powtórki</dt><dd className="text-2xl font-semibold">{difficult.length}</dd></div>
            {skipped > 0 && <div><dt className="text-sm text-muted-foreground">Pominięte</dt><dd className="text-2xl font-semibold">{skipped}</dd></div>}
          </dl>
        )}
        <div className="flex flex-wrap gap-3">
          {learning && <button type="button" onClick={() => start("practice")} className={primary}>Sprawdź się</button>}
          {!learning && difficult.length > 0 && (
            <button type="button" onClick={() => start("practice", difficult)} className={primary}>
              Powtórz trudne ({difficult.length})
            </button>
          )}
          <button type="button" onClick={() => move(null)} className={secondary}>Wróć do wyboru trybu</button>
        </div>
      </section>
    );
  }

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground">
          {learning ? "Nauka" : "Sprawdź się"} · Fiszka {session.position + 1} z {session.queue.length}
        </p>
        <button type="button" onClick={() => move(null)} disabled={pending} className={secondary}>Zmień tryb</button>
      </div>
      <div className="grid gap-3">
        <article aria-labelledby="flashcard-prompt" style={{ touchAction: "pan-y pinch-zoom" }} onPointerDown={beginTouch}
          onPointerUp={(event) => finishTouch(event, session)} onPointerCancel={() => { touch.current = null; }}
          className={`grid min-h-48 content-center gap-3 rounded-2xl border p-5 shadow-xs sm:p-8 ${revealed ? "bg-secondary" : "bg-card"}`}>
          <p className="text-sm font-medium text-primary wrap-anywhere">{card.topicName}</p>
          <div aria-live="polite" className="grid gap-3">
            <h2 id="flashcard-prompt" ref={heading} tabIndex={-1} className="text-xl font-semibold wrap-anywhere focus:outline-none sm:text-2xl">
              {revealed ? "Odpowiedź" : card.prompt}
            </h2>
            {(learning || revealed) && (
              <div className={learning ? "grid gap-2 border-t pt-3" : ""}>
                {learning && <h3 className="text-sm font-semibold text-muted-foreground">Odpowiedź</h3>}
                <p className="leading-relaxed whitespace-pre-line wrap-anywhere">{card.answer}</p>
              </div>
            )}
          </div>
        </article>
        {(learning || revealed) && card.memoryHint && (
          <aside aria-labelledby="flashcard-memory-title" className="grid gap-2 rounded-2xl border bg-secondary p-4 sm:p-5">
            <h3 id="flashcard-memory-title" className="text-sm font-semibold text-primary">Zapamiętaj przez skojarzenie</h3>
            <p className="leading-relaxed whitespace-pre-line wrap-anywhere">{card.memoryHint}</p>
          </aside>
        )}
      </div>
      <p className="hidden text-sm text-muted-foreground [@media(pointer:coarse)]:block">
        Przesuń palcem po fiszce w lewo lub w prawo, aby przejść dalej lub wstecz.
      </p>

      {!learning && (
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => setRevealed(!revealed)} disabled={pending} className={revealed ? secondary : primary}>
            {revealed ? "Wróć do pytania" : "Odwróć fiszkę"}
          </button>
          {revealed && (
            <>
              <button type="button" onClick={() => rate(card, session, "known")} disabled={pending || error?.refresh}
                className={primary}>Znam</button>
              <button type="button" onClick={() => rate(card, session, "review")} disabled={pending || error?.refresh}
                className={secondary}>Do powtórki</button>
            </>
          )}
        </div>
      )}
      <nav aria-label="Nawigacja fiszek" className="flex flex-wrap justify-between gap-3">
        <button type="button" className={secondary} disabled={pending || session.position === 0}
          onClick={() => navigate(session, -1)}>Wstecz</button>
        <button type="button" className={learning ? primary : secondary} disabled={pending} onClick={() => navigate(session, 1)}>
          {session.position + 1 === session.queue.length ? "Zakończ" : "Dalej"}
        </button>
      </nav>
      {pending && <p role="status" className="text-sm text-muted-foreground">Zapisywanie oceny…</p>}
      {error && (
        <div className="grid gap-2 rounded-lg bg-destructive/8 p-4">
          <p role="alert" className="text-destructive">{error.text}</p>
          {error.refresh && (
            <button type="button" onClick={() => window.location.reload()} className={`${secondary} w-fit`}>Odśwież zestaw</button>
          )}
        </div>
      )}
    </section>
  );
}
