import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabaseConfig } from "@/lib/supabase/config";
import type { Database } from "@/types/database";

export async function createSupabaseClient() {
  const cookieStore = await cookies();
  const config = getSupabaseConfig();
  if (!config) return null;

  return createServerClient<Database>(config.url, config.key, {
    cookieOptions: config.cookieOptions,
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(updates) {
        try {
          for (const { name, value, options } of updates) cookieStore.set(name, value, options);
        } catch {
          // Proxy persists refreshed cookies when the caller is a Server Component.
        }
      },
    },
  });
}
