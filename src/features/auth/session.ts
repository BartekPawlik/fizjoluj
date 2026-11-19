import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { createSupabaseClient } from "@/lib/supabase/server";

export async function requireAuthClient() {
  const supabase = await createSupabaseClient();
  if (!supabase) redirect("/logowanie?status=setup");
  return supabase;
}

export const requireSession = cache(async () => {
  const supabase = await requireAuthClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (!user) {
    const unavailable = error && (error.name === "AuthRetryableFetchError" || (error.status ?? 0) >= 500);
    redirect(unavailable ? "/logowanie?status=unavailable" : "/logowanie");
  }
  return { supabase, user };
});

export const requireProfile = cache(async () => {
  const { supabase, user } = await requireSession();
  const { data: profile, error } = await supabase.from("profiles")
    .select("email, role, email_confirmed_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) redirect("/logowanie?status=unavailable");
  return { supabase, user, profile };
});

export async function requireAdministrator() {
  const { supabase, profile } = await requireProfile();
  if (profile?.role !== "admin" || !profile.email_confirmed_at) redirect("/panel?status=forbidden");
  return supabase;
}
