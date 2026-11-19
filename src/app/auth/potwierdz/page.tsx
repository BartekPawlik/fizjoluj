import type { Metadata } from "next";
import Link from "next/link";

import { confirmEmail } from "@/features/auth/actions";
import { AuthScreen, buttonClass, linkClass } from "@/features/auth/ui";
import { readConfirmation } from "@/features/auth/validation";

export const metadata: Metadata = {
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default async function ConfirmPage({ searchParams }: {
  searchParams: Promise<{ token_hash?: string | string[]; type?: string | string[] }>;
}) {
  const { token_hash, type } = await searchParams;
  const confirmation = readConfirmation(token_hash, type);
  const recovery = confirmation?.type === "recovery";
  return (
    <AuthScreen
      title={recovery ? "Potwierdź zmianę hasła" : "Potwierdź adres e-mail"}
      notice={confirmation ? undefined : { text: "Link jest nieprawidłowy lub wygasł.", error: true }}
    >
      {confirmation ? (
        <form action={confirmEmail}>
          <input type="hidden" name="token_hash" value={confirmation.token_hash} />
          <input type="hidden" name="type" value={confirmation.type} />
          <button type="submit" className={buttonClass}>{recovery ? "Przejdź do zmiany hasła" : "Potwierdź adres e-mail"}</button>
        </form>
      ) : (
        <div className="flex flex-wrap gap-4 text-sm">
          <Link href="/logowanie" className={linkClass}>Wróć do logowania</Link>
          <Link href="/odzyskaj-haslo" className={linkClass}>Odzyskaj hasło</Link>
        </div>
      )}
    </AuthScreen>
  );
}
