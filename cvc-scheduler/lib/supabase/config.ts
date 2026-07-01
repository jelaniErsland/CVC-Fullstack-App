export type SupabasePublicConfig = Readonly<{
  url: string;
  anonKey: string;
}>;

export type SupabaseServerConfig = SupabasePublicConfig &
  Readonly<{
    serviceRoleKey: string | null;
  }>;

type PublicEnvironment = Readonly<{
  url: string | undefined;
  anonKey: string | undefined;
}>;

type ServerEnvironment = PublicEnvironment &
  Readonly<{
    serviceRoleKey: string | undefined;
  }>;

function requireValue(value: string | undefined, name: string) {
  const normalized = value?.trim();

  if (!normalized) {
    throw new Error(
      `Missing ${name}. Copy .env.example to .env.local and add the Supabase project value.`,
    );
  }

  return normalized;
}

function requireHttpUrl(value: string | undefined) {
  const normalized = requireValue(value, "NEXT_PUBLIC_SUPABASE_URL");

  try {
    const url = new URL(normalized);

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("Unsupported protocol");
    }
  } catch {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL must be a valid http or https URL.",
    );
  }

  return normalized.replace(/\/$/, "");
}

export function readSupabasePublicConfig(
  environment: PublicEnvironment,
): SupabasePublicConfig {
  return {
    url: requireHttpUrl(environment.url),
    anonKey: requireValue(
      environment.anonKey,
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ),
  };
}

export function readSupabaseServerConfig(
  environment: ServerEnvironment,
): SupabaseServerConfig {
  return {
    ...readSupabasePublicConfig(environment),
    serviceRoleKey: environment.serviceRoleKey?.trim() || null,
  };
}
