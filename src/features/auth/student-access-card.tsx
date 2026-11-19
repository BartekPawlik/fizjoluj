import { removeStudentAccess, saveStudentAccess } from "@/features/auth/admin-actions";
import type { readStudentAccessPage } from "@/features/auth/admin";
import { buttonClass, inputClass } from "@/features/auth/ui";

type AccessPage = NonNullable<Awaited<ReturnType<typeof readStudentAccessPage>>>;

export function StudentAccessCard({ student, locations, cohorts, page }: {
  student: AccessPage["students"][number];
  locations: AccessPage["locations"];
  cohorts: AccessPage["cohorts"];
  page: number;
}) {
  const { membership } = student;
  return (
    <li className="grid gap-4 rounded-xl border bg-card p-5">
      <div>
        <h2 className="break-all font-semibold">{student.email}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {getStatus(student)}
        </p>
      </div>
      {student.email_confirmed_at && (
        <form action={saveStudentAccess} className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <input type="hidden" name="studentId" value={student.user_id} />
          <input type="hidden" name="page" value={page} />
          <label className="grid gap-2 text-sm font-medium">
            Lokalizacja
            <select className={inputClass} name="locationId" defaultValue={membership?.location_id ?? ""} required>
              <option value="" disabled>Wybierz lokalizację</option>
              {locations.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Rocznik
            <select className={inputClass} name="cohortId" defaultValue={membership?.cohort_id ?? ""} required>
              <option value="" disabled>Wybierz rocznik</option>
              {cohorts.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
            </select>
          </label>
          <button type="submit" className={buttonClass}>{membership?.active ? "Zapisz przydział" : "Nadaj dostęp"}</button>
        </form>
      )}
      {membership?.active && (
        <form action={removeStudentAccess}>
          <input type="hidden" name="studentId" value={student.user_id} />
          <input type="hidden" name="page" value={page} />
          <button type="submit" className="min-h-11 font-medium text-destructive underline underline-offset-4">Cofnij dostęp</button>
        </form>
      )}
    </li>
  );
}

function getStatus({ email_confirmed_at, membership }: AccessPage["students"][number]) {
  if (!email_confirmed_at) return "Adres e-mail czeka na potwierdzenie";
  if (!membership) return "Oczekuje na przydzielenie dostępu";
  return membership.active ? "Dostęp aktywny" : "Dostęp cofnięty";
}
