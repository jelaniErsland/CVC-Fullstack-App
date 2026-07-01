import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

function fail(message) {
  console.error(`Supabase smoke check failed: ${message}`);
  process.exit(1);
}

if (!url || !anonKey) {
  fail(
    "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required. Copy .env.example to .env.local and add project values.",
  );
}

let healthUrl;

try {
  healthUrl = new URL("/auth/v1/health", url);
} catch {
  fail("NEXT_PUBLIC_SUPABASE_URL is not a valid URL.");
}

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 10_000);

try {
  const response = await fetch(healthUrl, {
    headers: {
      apikey: anonKey,
    },
    redirect: "error",
    signal: controller.signal,
  });

  if (!response.ok) {
    fail(
      `Auth health endpoint returned HTTP ${response.status}. Check the project URL and anon/publishable key.`,
    );
  }

  console.log(`Supabase environment wiring is healthy: ${healthUrl.origin}`);
  console.log("Checked Auth health only; no product table or user data was read.");
} catch (error) {
  if (error instanceof Error && error.name === "AbortError") {
    fail("the Auth health request timed out after 10 seconds.");
  }

  fail(error instanceof Error ? error.message : "unknown connection error.");
} finally {
  clearTimeout(timeout);
}
