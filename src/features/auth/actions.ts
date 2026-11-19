"use server";

import { redirect } from "next/navigation";

import { requireAuthClient, requireSession } from "@/features/auth/session";
import { readConfirmation, readEmail, readNewPassword, readString } from "@/features/auth/validation";

export async function signIn(form: FormData) {
  const email = readEmail(form);
  const password = readString(form, "password");
  if (!email || !password || password.length > 4096) redirect("/logowanie?status=invalid");

  const supabase = await requireAuthClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.code === "email_not_confirmed") redirect("/logowanie?status=unconfirmed");
    redirect("/logowanie?status=failed");
  }
  redirect("/panel");
}

export async function signUp(form: FormData) {
  const email = readEmail(form);
  const password = readNewPassword(form);
  if (!email || !password) redirect("/rejestracja?status=invalid");

  const supabase = await requireAuthClient();
  const { error } = await supabase.auth.signUp({ email, password });
  if (error && error.code !== "user_already_exists" && error.code !== "email_exists") {
    redirect("/rejestracja?status=failed");
  }
  redirect("/rejestracja?status=sent");
}

export async function confirmEmail(form: FormData) {
  const confirmation = readConfirmation(form.get("token_hash"), form.get("type"));
  if (!confirmation) redirect("/auth/potwierdz");

  const supabase = await requireAuthClient();
  const { error } = await supabase.auth.verifyOtp(confirmation);
  if (error) redirect("/auth/potwierdz");

  redirect(confirmation.type === "recovery" ? "/ustaw-haslo" : "/panel");
}

export async function requestPasswordReset(form: FormData) {
  const email = readEmail(form);
  if (!email) redirect("/odzyskaj-haslo?status=invalid");

  const supabase = await requireAuthClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error && (error.name === "AuthRetryableFetchError" || (error.status ?? 0) >= 500)) {
    redirect("/odzyskaj-haslo?status=unavailable");
  }
  redirect("/odzyskaj-haslo?status=sent");
}

export async function updatePassword(form: FormData) {
  const { supabase } = await requireSession();
  const password = readNewPassword(form);
  if (!password) redirect("/ustaw-haslo?status=invalid");

  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect("/ustaw-haslo?status=failed");

  const { error: signOutError } = await supabase.auth.signOut();
  if (signOutError) redirect("/panel?status=password-changed");
  redirect("/logowanie?status=password-changed");
}

export async function signOut() {
  const { supabase } = await requireSession();
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) redirect("/panel?status=signout-failed");
  redirect("/");
}
