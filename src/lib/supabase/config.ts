function isPublicKey(key: string) {
  if (key.startsWith("sb_publishable_")) return true;

  // Older local stacks expose a JWT anon key.
  const [, payload, signature] = key.split(".");
  if (!payload || !signature) return false;
  try {
    const decoded: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof decoded === "object" && decoded !== null && "role" in decoded && decoded.role === "anon";
  } catch {
    return false;
  }
}

export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key || !isPublicKey(key)) return null;

  const endpoint = URL.parse(url);
  const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(endpoint?.hostname ?? "");
  if (!endpoint || (endpoint.protocol !== "https:" && !(isLocal && endpoint.protocol === "http:"))) {
    return null;
  }
  return {
    url,
    key,
    cookieOptions: { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production" },
  };
}
