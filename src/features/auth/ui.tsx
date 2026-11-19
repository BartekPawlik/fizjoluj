import Link from "next/link";
import type { ReactNode } from "react";

import { signOut } from "@/features/auth/actions";
import { MIN_PASSWORD_LENGTH } from "@/features/auth/validation";
import { getSupabaseConfig } from "@/lib/supabase/config";

export type NoticeContent = { text: string; error?: boolean };

export const inputClass = "w-full rounded-md border border-input bg-card px-3 py-2 text-base";
export const buttonClass = "inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90";
export const linkClass = "font-medium text-primary underline underline-offset-4";

export function Notice({ content }: { content?: NoticeContent }) {
  if (!content) return null;
  return (
    <p role={content.error ? "alert" : "status"} className={content.error
      ? "rounded-md bg-destructive/8 px-4 py-3 text-destructive"
      : "rounded-md bg-secondary px-4 py-3 text-secondary-foreground"}>
      {content.text}
    </p>
  );
}

export function AuthScreen({ title, notice, children }: {
  title: string;
  notice?: NoticeContent;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-lg content-center gap-4 px-4 py-8 sm:px-6">
      <Link href="/" className="w-fit text-lg font-semibold text-primary">Fizjoluj</Link>
      <section className="grid gap-5 rounded-xl border bg-card p-5 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {getSupabaseConfig() ? (
          <>
            <Notice content={notice} />
            {children}
          </>
        ) : (
          <Notice content={{ text: "Logowanie będzie dostępne po skonfigurowaniu połączenia z Supabase." }} />
        )}
      </section>
    </main>
  );
}

export function EmailField() {
  return (
    <label className="grid gap-2 text-sm font-medium">
      Adres e-mail
      <input type="email" name="email" autoComplete="email" maxLength={254} required className={inputClass} />
    </label>
  );
}

export function PasswordField({ fresh = false, confirm = false }: { fresh?: boolean; confirm?: boolean }) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {confirm ? "Powtórz hasło" : "Hasło"}
      <input
        type="password"
        name={confirm ? "passwordConfirmation" : "password"}
        autoComplete={fresh ? "new-password" : "current-password"}
        minLength={fresh ? MIN_PASSWORD_LENGTH : undefined}
        required
        className={inputClass}
      />
    </label>
  );
}

export function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="text-xl font-semibold text-primary">Fizjoluj</Link>
          <form action={signOut}>
            <button className="min-h-11 px-2 font-medium text-primary underline underline-offset-4" type="submit">
              Wyloguj się
            </button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}

export type StatusSearch = Promise<{ status?: string | string[] }>;

export function readNotice(status: string | string[] | undefined, messages: Record<string, NoticeContent>) {
  return typeof status === "string" && Object.hasOwn(messages, status) ? messages[status] : undefined;
}
