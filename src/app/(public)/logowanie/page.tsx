import Link from "next/link";

import { signIn } from "@/features/auth/actions";
import { AuthScreen, buttonClass, EmailField, linkClass, PasswordField, readNotice, type StatusSearch } from "@/features/auth/ui";

const messages = {
  invalid: { text: "Wpisz adres e-mail i hasło.", error: true },
  failed: { text: "Logowanie się nie powiodło. Sprawdź dane lub spróbuj ponownie.", error: true },
  unconfirmed: { text: "Potwierdź adres e-mail, korzystając z linku w wiadomości rejestracyjnej.", error: true },
  unavailable: { text: "Usługa logowania jest chwilowo niedostępna.", error: true },
  "password-changed": { text: "Hasło zostało zmienione. Zaloguj się nowym hasłem." },
};

export default async function LoginPage({ searchParams }: { searchParams: StatusSearch }) {
  const { status } = await searchParams;
  return (
    <AuthScreen title="Zaloguj się" notice={readNotice(status, messages)}>
      <form action={signIn} className="grid gap-4">
        <EmailField />
        <PasswordField />
        <button type="submit" className={buttonClass}>Zaloguj się</button>
      </form>
      <div className="flex flex-wrap justify-between gap-3 text-sm">
        <Link href="/odzyskaj-haslo" className={linkClass}>Odzyskaj hasło</Link>
        <Link href="/rejestracja" className={linkClass}>Załóż konto</Link>
      </div>
    </AuthScreen>
  );
}
