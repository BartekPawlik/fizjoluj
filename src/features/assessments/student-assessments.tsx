import Link from "next/link";

export function SubjectTabs({ subjectId, current }: { subjectId: string; current: "topics" | "assessments" }) {
  const subjectHref = `/panel/przedmioty/${subjectId}`;
  return (
    <nav aria-label="Widoki przedmiotu" className="w-fit rounded-xl border bg-card p-1">
      <ul className="flex flex-wrap gap-1">
        {([
          { key: "topics", label: "Tematy", href: subjectHref },
          { key: "assessments", label: "Zaliczenia", href: subjectHref + "/zaliczenia" },
        ] as const).map(({ key, label, href }) => (
          <li key={key}>
            <Link href={href} aria-current={current === key ? "page" : undefined}
              className={`inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${current === key ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-secondary"}`}>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

const dateFormatter = new Intl.DateTimeFormat("pl-PL", { dateStyle: "long", timeZone: "UTC" });

export function AssessmentDate({ scheduledOn }: { scheduledOn: string | null }) {
  if (!scheduledOn) return "Termin do ustalenia";
  return <time dateTime={scheduledOn}>{dateFormatter.format(new Date(`${scheduledOn}T00:00:00Z`))}</time>;
}
