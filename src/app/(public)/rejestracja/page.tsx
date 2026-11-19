import Link from "next/link";

import { signUp } from "@/features/auth/actions";
import { AuthScreen, buttonClass, EmailField, linkClass, PasswordField, readNotice, type StatusSearch } from "@/features/auth/ui";
import { MIN_PASSWORD_LENGTH } from "@/features/auth/validation";

const messages = {
  invalid: { text: "Sprawdź adres e-mail, długość hasła i jego powtórzenie.", error: true },
  failed: { text: "Rejestracja się nie powiodła. Spróbuj ponownie za chwilę.", error: true },
  sent: { text: "Sprawdź skrzynkę e-mail. Jeśli konto już istnieje, zaloguj się lub odzyskaj hasło." },
};

export default async function RegisterPage({ searchParams }: { searchParams: StatusSearch }) {
  const { status } = await searchParams;
  return (
    <AuthScreen title="Załóż konto" notice={readNotice(status, messages)}>
      <p className="text-sm text-muted-foreground">
        Po potwierdzeniu adresu e-mail administrator przydzieli dostęp do nauki.
      </p>
      {status !== "sent" && (
        <form action={signUp} className="grid gap-4">
          <EmailField />
          <PasswordField fresh />
          <PasswordField fresh confirm />
          <p className="text-sm text-muted-foreground">Hasło musi mieć co najmniej {MIN_PASSWORD_LENGTH} znaków.</p>
          <button type="submit" className={buttonClass}>Załóż konto</button>
        </form>
      )}
      <Link href="/logowanie" className={linkClass}>Zaloguj się</Link>
    </AuthScreen>
  );
}
