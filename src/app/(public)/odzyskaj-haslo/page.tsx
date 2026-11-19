import Link from "next/link";

import { requestPasswordReset } from "@/features/auth/actions";
import { AuthScreen, buttonClass, EmailField, linkClass, readNotice, type StatusSearch } from "@/features/auth/ui";

const messages = {
  invalid: { text: "Wpisz poprawny adres e-mail.", error: true },
  unavailable: { text: "Usługa odzyskiwania hasła jest chwilowo niedostępna. Spróbuj ponownie.", error: true },
  sent: { text: "Jeśli konto jest zarejestrowane, otrzymasz link do zmiany hasła." },
};

export default async function RecoveryPage({ searchParams }: { searchParams: StatusSearch }) {
  const { status } = await searchParams;
  return (
    <AuthScreen title="Odzyskaj hasło" notice={readNotice(status, messages)}>
      {status !== "sent" && (
        <form action={requestPasswordReset} className="grid gap-4">
          <EmailField />
          <button type="submit" className={buttonClass}>Wyślij link</button>
        </form>
      )}
      <Link href="/logowanie" className={linkClass}>Wróć do logowania</Link>
    </AuthScreen>
  );
}
