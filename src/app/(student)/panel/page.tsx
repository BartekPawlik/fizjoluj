import { redirect } from "next/navigation";

import { requireProfile } from "@/features/auth/session";
import { Notice, readNotice, type StatusSearch } from "@/features/auth/ui";

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

  return (
    <main className="mx-auto grid max-w-5xl gap-5 px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Panel studenta</h1>
      <Notice content={notice} />
      <section className="grid gap-3 rounded-xl border bg-card p-5 sm:p-7">
        <h2 className="text-xl font-semibold">Dostęp do nauki</h2>
        {membershipError || placement?.some((result) => result.error) ? (
          <p role="alert">Nie udało się odczytać dostępu. Odśwież stronę i spróbuj ponownie.</p>
        ) : placement?.[0].data && placement[1].data ? (
          <p>Masz dostęp do nauki. {placement[0].data.name}, rocznik {placement[1].data.start_year}.</p>
        ) : membership && !membership.active ? (
          <p>Administrator cofnął dostęp do nauki. Skontaktuj się z administratorem, jeśli chcesz go odzyskać.</p>
        ) : (
          <p>Twoje konto oczekuje na przydzielenie dostępu przez administratora.</p>
        )}
      </section>
    </main>
  );
}
