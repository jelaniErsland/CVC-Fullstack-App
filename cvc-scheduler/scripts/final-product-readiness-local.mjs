// Local-only entry point: never loads .env files or prints credentials.
import { spawnSync, spawn } from "node:child_process";
import assert from "node:assert/strict";

const status = spawnSync("supabase", ["status", "-o", "env"], { encoding: "utf8", windowsHide: true, shell: process.platform === "win32" });
assert.equal(status.status, 0, "Local Supabase must be running.");
const get = (key) => status.stdout.match(new RegExp(`^${key}="([^"\\r\\n]+)"`, "m"))?.[1];
const url = get("API_URL");
assert(url && ["127.0.0.1", "localhost"].includes(new URL(url).hostname), "Only loopback Supabase is allowed.");
const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: get("ANON_KEY"), ADMIN_AUTH_MODE: "enforced", ASSIGNMENT_NOTIFICATION_EMAIL_TRANSPORT: "", RESEND_API_KEY: "", SUPABASE_SERVICE_ROLE_KEY: "", RESPONSE_LINK_BASE_URL: "http://127.0.0.1:3000", PREVIEW_BASE_URL: "http://127.0.0.1:3000" };
assert(env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const args = process.argv.slice(2);
const child = spawn(process.execPath, args[0] === "preview" ? ["node_modules/next/dist/bin/next", "dev", "--webpack", "--hostname", "127.0.0.1"] : args, { stdio: "inherit", env, windowsHide: true });
child.on("exit", (code) => { process.exitCode = code ?? 1; });
