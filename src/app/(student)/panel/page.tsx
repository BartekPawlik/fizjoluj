import { redirect } from "next/navigation";

import { requireProfile } from "@/features/auth/session";
import { Notice, readNotice, type StatusSearch } from "@/features/auth/ui";
import { readStudentCatalog } from "@/features/catalog/queries";
import { StudentCatalog, StudentPageIntro } from "@/features/catalog/student-catalog";

const messages = {
  forbidden: { text: "Panel administratora wymaga odpowiednich uprawnień.", error: true },
  "signout-failed": { text: "Wylogowanie się nie powiodło. Spróbuj ponownie.", error: true },
  "password-changed": { text: "Hasło zostało zmienione. Możesz ponownie spróbować się wylogować." },
};

export default async function StudentPanel({ searchParams }: { searchParams: StatusSearch }) {
  const { supabase, user, profile } = await requireProfile();
  const { status } = await searchParams;
  const notice = readNotice(status, messages);
  if (profile?.role === "admin" && profile.email_confirmed_at) {
    redirect(status === "signout-failed" || status === "password-changed"
      ? `/admin?status=${status}` : "/admin");
  }

  const { data: membership, error: membershipError } = await supabase.from("memberships")
    .select("active, location_id, cohort_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const placement = membership?.active && profile?.email_confirmed_at
    ? await Promise.all([
      supabase.from("locations").select("name").eq("id", membership.location_id).maybeSingle(),
      supabase.from("cohorts").select("start_year").eq("id", membership.cohort_id).maybeSingle(),
    ])
    : null;
  const location = placement?.[0].data;
  const cohort = placement?.[1].data;
  const catalog = location && cohort ? await readStudentCatalog() : undefined;
  const subjectCount = catalog?.reduce((total, semester) => total + semester.subjects.length, 0);

  return (
    <main className="mx-auto grid max-w-5xl gap-7 px-4 py-6 sm:gap-9 sm:px-6 sm:py-10">
      <StudentPageIntro title="Panel studenta" summary={subjectCount !== undefined && (
        <dl className="flex w-fit flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-white/20 bg-white/8 px-4 py-3 sm:grid sm:gap-1 sm:px-5">
          <dt className="text-sm text-white/85">Dostępne przedmioty</dt>
          <dd className="text-2xl leading-none font-semibold tabular-nums sm:row-start-1 sm:text-4xl">{subjectCount}</dd>
        </dl>
      )}>
        {membershipError || placement?.some((result) => result.error) ? (
          <p role="alert" className="text-white/85">Nie udało się odczytać dostępu. Odśwież stronę i spróbuj ponownie.</p>
        ) : location && cohort ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 font-medium">
              <span aria-hidden="true" className="size-2 rounded-full bg-lime-200" />
              Dostęp aktywny
            </span>
            <span className="text-white/85">{location.name} · rocznik {cohort.start_year}</span>
          </div>
        ) : membership && !membership.active ? (
          <p className="max-w-lg text-white/85">Administrator cofnął dostęp do nauki. Skontaktuj się z administratorem, jeśli chcesz go odzyskać.</p>
        ) : (
          <p className="text-white/85">Twoje konto oczekuje na przydzielenie dostępu przez administratora.</p>
        )}
      </StudentPageIntro>
      <Notice content={notice} />
      {catalog !== undefined && <StudentCatalog catalog={catalog} />}
    </main>
  );
}
