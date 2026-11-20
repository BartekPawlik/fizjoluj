import Link from "next/link";
import type { ReactNode } from "react";

import { Notice } from "@/features/auth/ui";
import type { readStudentCatalog } from "@/features/catalog/queries";

export function StudentPageIntro({ title, children, summary }: {
  title: string;
  children?: ReactNode;
  summary?: ReactNode;
}) {
  return (
    <header className="relative isolate grid gap-5 overflow-hidden rounded-3xl bg-primary px-5 py-7 text-primary-foreground sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:px-9 sm:py-10">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-linear-to-br from-primary to-[#163930]" />
      <div aria-hidden="true" className="pointer-events-none absolute -top-36 -right-24 -z-10 hidden size-112 rounded-full border-36 border-white/5 sm:block" />
      <div className="grid min-w-0 gap-3">
        <h1 className="max-w-3xl text-3xl leading-tight font-semibold tracking-tight wrap-anywhere sm:text-4xl lg:text-5xl">
          {title}
        </h1>
        {children}
      </div>
      {summary}
    </header>
  );
}

export function StudentCatalog({ catalog }: { catalog: Awaited<ReturnType<typeof readStudentCatalog>> }) {
  return (
    <section aria-labelledby="student-catalog-title" className="grid gap-5">
      <h2 id="student-catalog-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">Przedmioty</h2>
      {catalog === null ? (
        <Notice content={{ text: "Nie udało się pobrać katalogu. Odśwież stronę i spróbuj ponownie.", error: true }} />
      ) : catalog.length ? catalog.map((semester) => (
        <div key={semester.id} className="grid gap-3">
          <h3 className="w-fit rounded-full border bg-secondary px-3 py-1 text-sm font-semibold text-secondary-foreground">
            Semestr {semester.semester_number}
          </h3>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {semester.subjects.map((subject) => (
              <li key={subject.id} className="min-w-0">
                <Link href={`/panel/przedmioty/${subject.id}`} prefetch={false}
                  className="group flex h-full min-h-24 items-start justify-between gap-3 rounded-2xl border bg-card p-4 shadow-xs transition-colors hover:border-primary/50 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:p-5">
                  <span className="self-center text-base leading-snug font-semibold wrap-anywhere sm:text-lg">{subject.name}</span>
                  <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-secondary-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )) : (
        <p className="rounded-2xl border bg-card p-5 text-muted-foreground">Twój rocznik nie ma jeszcze dostępnych przedmiotów.</p>
      )}
    </section>
  );
}
