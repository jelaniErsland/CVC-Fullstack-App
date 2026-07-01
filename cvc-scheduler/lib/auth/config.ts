import "server-only";

export type AdminAuthMode = "review" | "enforced";

export function getAdminAuthMode(): AdminAuthMode {
  const value = process.env.ADMIN_AUTH_MODE?.trim().toLowerCase() || "review";

  if (value !== "review" && value !== "enforced") {
    throw new Error('ADMIN_AUTH_MODE must be either "review" or "enforced".');
  }

  return value;
}

export function isSupabaseAuthConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
  );
}
