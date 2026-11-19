import "server-only";

import { requireAdministrator } from "@/features/auth/session";

export const ADMIN_PAGE_SIZE = 25;

export async function readStudentAccessPage(page: number) {
  const supabase = await requireAdministrator();
  const first = (page - 1) * ADMIN_PAGE_SIZE;
  const [profiles, institutions, locations, cohorts] = await Promise.all([
    supabase.from("profiles").select("user_id, email, email_confirmed_at", { count: "exact" })
      .eq("role", "student").order("email").order("user_id").range(first, first + ADMIN_PAGE_SIZE - 1),
    supabase.from("institutions").select("id, name"),
    supabase.from("locations").select("id, institution_id, name").order("name"),
    supabase.from("cohorts").select("id, institution_id, start_year").order("start_year", { ascending: false }),
  ]);
  if (profiles.error || institutions.error || locations.error || cohorts.error) return null;

  const profileIds = profiles.data.map((profile) => profile.user_id);
  const memberships = profileIds.length
    ? await supabase.from("memberships").select("user_id, location_id, cohort_id, active").in("user_id", profileIds)
    : { data: [], error: null };
  if (memberships.error) return null;

  const institutionNames = new Map(institutions.data.map(({ id, name }) => [id, name]));
  const membershipByUser = new Map(memberships.data.map((membership) => [membership.user_id, membership]));
  return {
    total: profiles.count ?? 0,
    students: profiles.data.map((profile) => ({
      ...profile,
      membership: membershipByUser.get(profile.user_id),
    })),
    locations: locations.data.map(({ id, name, institution_id }) => ({
      id,
      label: institutions.data.length > 1 ? `${name} (${institutionNames.get(institution_id) ?? ""})` : name,
    })),
    cohorts: cohorts.data.map(({ id, start_year, institution_id }) => ({
      id,
      label: institutions.data.length > 1
        ? `${start_year} (${institutionNames.get(institution_id) ?? ""})`
        : String(start_year),
    })),
  };
}
