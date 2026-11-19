import { updatePassword } from "@/features/auth/actions";
import { requireSession } from "@/features/auth/session";
import { AuthScreen, buttonClass, PasswordField, readNotice, type StatusSearch } from "@/features/auth/ui";
import { MIN_PASSWORD_LENGTH } from "@/features/auth/validation";

const messages = {
  invalid: { text: "Sprawdź długość hasła i jego powtórzenie.", error: true },
  failed: { text: "Nie udało się zmienić hasła. Spróbuj ponownie lub poproś o nowy link.", error: true },
};

export default async function UpdatePasswordPage({ searchParams }: { searchParams: StatusSearch }) {
  const { user } = await requireSession();
  const { status } = await searchParams;
  return (
    <AuthScreen title="Ustaw nowe hasło" notice={readNotice(status, messages)}>
      <p className="break-all text-sm text-muted-foreground">{user.email}</p>
      <form action={updatePassword} className="grid gap-4">
        <PasswordField fresh />
        <PasswordField fresh confirm />
        <p className="text-sm text-muted-foreground">Hasło musi mieć co najmniej {MIN_PASSWORD_LENGTH} znaków.</p>
        <button type="submit" className={buttonClass}>Zapisz hasło</button>
      </form>
    </AuthScreen>
  );
}
