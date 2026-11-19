import Link from "next/link";
import { redirect } from "next/navigation";

import { ADMIN_PAGE_SIZE, readStudentAccessPage } from "@/features/auth/admin";
import { StudentAccessCard } from "@/features/auth/student-access-card";
import { linkClass, Notice, readNotice } from "@/features/auth/ui";
import { readPage } from "@/features/auth/validation";

const messages = {
  invalid: { text: "Wybierz lokalizację i rocznik z tej samej uczelni. Konto musi mieć potwierdzony e-mail.", error: true },
  failed: { text: "Nie udało się zmienić dostępu. Odśwież stronę i spróbuj ponownie.", error: true },
  saved: { text: "Przydział został zapisany. Student ma dostęp do nauki." },
  revoked: { text: "Dostęp studenta został cofnięty." },
  "signout-failed": { text: "Wylogowanie się nie powiodło. Spróbuj ponownie.", error: true },
  "password-changed": { text: "Hasło zostało zmienione. Możesz ponownie spróbować się wylogować." },
};

export default async function AdminPage({ searchParams }: {
  searchParams: Promise<{ page?: string | string[]; status?: string | string[] }>;
}) {
  const query = await searchParams;
  const page = readPage(query.page);
  const access = await readStudentAccessPage(page);
  const lastPage = access ? Math.max(1, Math.ceil(access.total / ADMIN_PAGE_SIZE)) : 1;
  if (access && page > lastPage) redirect(`/admin?page=${lastPage}`);

  return (
    <main className="mx-auto grid max-w-5xl gap-5 px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Dostęp studentów</h1>
      <Notice content={readNotice(query.status, messages)} />
      {!access ? (
        <Notice content={{ text: "Nie udało się pobrać listy studentów. Odśwież stronę.", error: true }} />
      ) : access.students.length ? (
        <>
          <ul className="grid gap-4">
            {access.students.map((student) => (
              <StudentAccessCard key={student.user_id} student={student} locations={access.locations} cohorts={access.cohorts} page={page} />
            ))}
          </ul>
          {lastPage > 1 && (
            <nav aria-label="Strony listy studentów" className="flex flex-wrap items-center gap-4 text-sm">
              {page > 1 && <Link href={`/admin?page=${page - 1}`} className={linkClass}>Poprzednia</Link>}
              <span>Strona {page} z {lastPage}</span>
              {page < lastPage && <Link href={`/admin?page=${page + 1}`} className={linkClass}>Następna</Link>}
            </nav>
          )}
        </>
      ) : (
        <p>Brak zarejestrowanych studentów.</p>
      )}
    </main>
  );
}
