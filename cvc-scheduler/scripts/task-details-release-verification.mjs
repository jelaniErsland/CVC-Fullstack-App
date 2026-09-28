// Fresh local production build and repeated real browser journeys. No hosted URL
// or provider credential is accepted; this runner stops its own preview on exit.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { setTimeout as wait } from "node:timers/promises";

const cli = process.platform === "win32" ? "supabase.exe" : "supabase";
const version = spawnSync(cli, ["--version"], { encoding: "utf8", windowsHide: true });
assert.equal(version.stdout.trim(), "2.111.0", "Use the documented pinned Supabase CLI.");
const status = spawnSync(cli, ["status", "-o", "env"], { encoding: "utf8", windowsHide: true });
assert.equal(status.status, 0, "Local Supabase must be running.");
const get = name => status.stdout.match(new RegExp(`^${name}="([^"\\r\\n]+)"`, "m"))?.[1];
const url = get("API_URL"), key = get("ANON_KEY");
assert(url && key && ["127.0.0.1", "localhost"].includes(new URL(url).hostname));
const base = "http://127.0.0.1:3001";
const portProbe = createServer();
await new Promise((resolve, reject) => {
  portProbe.once("error", reject);
  portProbe.listen(3001, "127.0.0.1", () => portProbe.close(resolve));
});
const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: key,
  ADMIN_AUTH_MODE: "enforced", SUPABASE_SERVICE_ROLE_KEY: "", RESEND_API_KEY: "",
  ASSIGNMENT_NOTIFICATION_EMAIL_TRANSPORT: "", ASSIGNMENT_NOTIFICATION_FROM: "",
  RESPONSE_LINK_BASE_URL: base, PREVIEW_BASE_URL: base,
  WRITE_ASSIGNMENT_INSTRUCTIONS_SCREENSHOTS: "1", ASSIGNMENT_INSTRUCTIONS_ONLY: "",
  FINAL_PRODUCT_READINESS_REVIEW: "", PROJECT_DAY_QUICK_VIEW_ONLY: "",
  ARCHIVE_UI_BROWSER_ONLY: "", OPERATIONAL_USABILITY_BROWSER_ONLY: "",
  TASK_COLOR_MOBILE_ONLY: "", WRITE_BETA_REVIEW_SCREENSHOTS: "", WRITE_ITERATION_12_44B5_CAPTURES: "" };
function safe(output) {
  return output.replaceAll(key, "[redacted]").replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted-jwt]");
}
async function run(args, label, overrides = {}) {
  const child = spawn(process.execPath, args, { env: { ...env, ...overrides }, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  child.stdout.on("data", data => { output += data; });
  child.stderr.on("data", data => { output += data; });
  const [code] = await once(child, "exit");
  assert.equal(code, 0, `${label} failed:\n${safe(output).slice(-7000)}`);
  console.log(`${label}: PASS`);
}
await run(["node_modules/next/dist/bin/next", "build"], "Fresh local production build");
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3001"], {
  env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
});
let serverLog = "";
server.stdout.on("data", data => { serverLog = (serverLog + data).slice(-10000); });
server.stderr.on("data", data => { serverLog = (serverLog + data).slice(-10000); });
const flags = ["--conditions=react-server", "--no-warnings", "--experimental-strip-types"];
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    assert(server.exitCode === null, `Local preview exited: ${safe(serverLog)}`);
    try { const response = await fetch(`${base}/admin/tasks`, { signal: AbortSignal.timeout(1000) }); if (response.status < 500) { ready = true; break; } } catch { /* startup */ }
    await wait(250);
  }
  assert(ready, "Local production preview did not start.");
  await run([...flags, "scripts/calendar-regression.mjs"], "Complete desktop/mobile Calendar browser regression");
  await run([...flags, "scripts/calendar-regression.mjs"], "Project Day and authenticated Quick View browser boundaries", { PROJECT_DAY_QUICK_VIEW_ONLY: "1" });
  for (let runNumber = 1; runNumber <= 5; runNumber++) {
    await run([...flags, "scripts/tasks-management-browser-regression.mjs"], `Persisted instruction edit/preview/apply journey ${runNumber}/5`);
  }
  await run([...flags, "scripts/volunteer-schedule-responses-browser-regression.mjs"], "Complete volunteer-response browser regression and maximum-length dialogs");
  await run([...flags, "scripts/project-quick-view-share-access-browser-regression.mjs"], "Existing bearer Quick View contract, desktop/mobile inspectors and revocation");
  assert(!/Unexpected end of JSON input|An unexpected response was received|uncaughtException/.test(serverLog), "Production-like preview emitted a Server Action transport failure.");
  console.log("Fresh loopback production verification passed; real providers disabled; preview stopped; all browser fixtures cleaned.");
} finally {
  server.kill();
  if (server.exitCode === null) await once(server, "exit");
}
