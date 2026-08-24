import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const expectedProject = "project-local";
const expectedOrigin = "https://projectlocal.app";
const expectedSupabaseRef = "wdlaauzknfggoqldolmx";
const forbiddenStagingRef = "kfuujcfxoayukywvtaeh";
const expectedMigration = "20260812123430";
const optInName = "RUN_PRODUCTION_DEPLOYMENT_SMOKE_VALIDATION";
const expectedOptIn = `${expectedProject}|${expectedOrigin}|${expectedSupabaseRef}|${expectedMigration}`;

const forbiddenBodyPatterns = [
  /supabase_migrations/i,
  /postgres(?:ql)?:\/\//i,
  /\bselect\s+\*\s+from\b/i,
  /\bSQL\b/,
  /\bstack trace\b/i,
  /\bworkspace_contact_grants\b/i,
  /\bcapabilit(?:y|ies)\b/i,
  /\bservice[_-]?role\b/i,
  /\baccess[_-]?token\b/i,
  /\brefresh[_-]?token\b/i,
  /\bbearer\b/i,
  /\bverifier\b/i,
  /\bgrant[_-]?id\b/i,
  /\bapi[_-]?key\b/i,
  /password\s*[=:]/i,
  /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/,
];

function command(commandName, args, options = {}) {
  return spawnSync(commandName, args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true,
    ...options,
  });
}

function gitStatusShort() {
  const result = command("git", ["status", "--short"]);
  if (result.status !== 0) throw new Error("Could not inspect git status.");
  return result.stdout.trim();
}

function assertHttpsApprovedOrigin(origin) {
  const parsed = new URL(origin);
  assert.equal(parsed.protocol, "https:", "Production smoke origin must use HTTPS.");
  assert.equal(parsed.origin, expectedOrigin, "Production smoke origin must be the approved canonical production origin.");
  assert(!/localhost|127\.0\.0\.1|\[::1\]/i.test(parsed.hostname), "Production smoke origin must not be loopback.");
  assert(!/preview|git-|vercel\.app\/.+/i.test(origin.replace(expectedOrigin, "")), "Dynamic preview origins are not approved for this gate.");
}

function verifyEnvironment() {
  assert.equal(
    process.env[optInName],
    expectedOptIn,
    `Refusing production deployment smoke without ${optInName}=${expectedOptIn}.`,
  );
  assertHttpsApprovedOrigin(expectedOrigin);
  assert.notEqual(expectedSupabaseRef, forbiddenStagingRef, "Production smoke Supabase ref must never equal staging ref.");
  assert(!process.env.RUN_PRODUCTION_FIXTURES, "Production fixture flags are forbidden.");
  assert(!process.env.SEED_PRODUCTION_DATA, "Production seed flags are forbidden.");
  assert(!process.env.RUN_HOSTED_BOZEMAN_BETA_E2E_VALIDATION, "Hosted fixture E2E opt-in must not be set during production smoke.");
  assert(!process.env.RUN_HOSTED_ASSIGNMENT_NOTIFICATION_EMAIL_VALIDATION, "Hosted fixture email opt-in must not be set during production smoke.");
  assert(!process.env.ASSIGNMENT_NOTIFICATION_EMAIL_TRANSPORT?.trim(), "Email transport must be disabled for production smoke.");
  assert(!process.env.ASSIGNMENT_NOTIFICATION_RECORDING_PATH?.trim(), "Recording transport path must be absent for production smoke.");
  assert(!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(), "Service-role runtime configuration must be absent for production smoke.");
  assert.equal(gitStatusShort(), "", "Production deployment smoke requires a clean committed worktree.");
}

async function verifyStaticBoundaries() {
  const [
    packageJson,
    proxy,
    deploymentStatus,
    deploymentRunbook,
    environmentInventory,
    goNoGo,
  ] = await Promise.all([
    readFile(path.join(root, "package.json"), "utf8"),
    readFile(path.join(root, "proxy.ts"), "utf8"),
    readFile(path.join(root, "docs", "PRODUCTION_DEPLOYMENT_STATUS.md"), "utf8"),
    readFile(path.join(root, "docs", "PRODUCTION_DEPLOYMENT_RUNBOOK.md"), "utf8"),
    readFile(path.join(root, "docs", "PRODUCTION_ENVIRONMENT_INVENTORY.md"), "utf8"),
    readFile(path.join(root, "docs", "BOZEMAN_BETA_GO_NO_GO.md"), "utf8"),
  ]);

  assert(packageJson.includes("test:production-deployment-smoke"), "Production deployment smoke package command is missing.");
  assert(proxy.includes('pathname === "/v/schedule"'), "Proxy must cover /v/schedule privacy headers.");
  assert(proxy.includes('pathname.startsWith("/v/access/")'), "Proxy must cover /v/access privacy headers.");
  assert(proxy.includes('X-Robots-Tag", "noindex, nofollow"'), "Proxy must preserve noindex header.");
  assert(deploymentStatus.includes(expectedProject) && deploymentStatus.includes(expectedOrigin), "Production deployment status must record approved project/origin.");
  assert(deploymentStatus.includes("manual magic-link sign-in passed"), "Production deployment status must record manual Auth evidence.");
  assert(deploymentRunbook.includes(expectedOrigin), "Deployment runbook must record approved canonical production origin.");
  assert(environmentInventory.includes(expectedOrigin), "Environment inventory must record approved canonical production origin.");
  assert(goNoGo.includes("NO-GO"), "GO/NO-GO doc must remain honest.");
}

async function request(pathname, options = {}) {
  const url = new URL(pathname, expectedOrigin);
  const response = await fetch(url, {
    method: "GET",
    redirect: "manual",
    headers: {
      "User-Agent": "ProjectLocalProductionSmoke/12.27",
      Accept: "text/html,application/xhtml+xml",
    },
    ...options,
  });
  return response;
}

async function text(response) {
  return response.text();
}

function assertSameOriginLocation(response, expectedPathname) {
  const location = response.headers.get("location");
  assert(location, "Redirect omitted Location header.");
  const target = new URL(location, expectedOrigin);
  assert.equal(target.origin, expectedOrigin, "Redirect escaped the approved production origin.");
  assert.equal(target.pathname, expectedPathname, `Redirect did not target ${expectedPathname}.`);
  return target;
}

function assertSafeBody(body, label) {
  for (const pattern of forbiddenBodyPatterns) {
    assert(!pattern.test(body), `${label} rendered unsafe internal/credential-like detail matching ${pattern}.`);
  }
}

function assertVolunteerPrivacyHeaders(response, label) {
  assert.match(response.headers.get("cache-control") ?? "", /no-store/i, `${label} missing no-store.`);
  assert.match(response.headers.get("x-robots-tag") ?? "", /noindex/i, `${label} missing noindex.`);
  assert.equal(response.headers.get("referrer-policy"), "no-referrer", `${label} missing no-referrer.`);
}

function assertNoCookieSet(response, label) {
  assert(!response.headers.get("set-cookie"), `${label} unexpectedly set a cookie.`);
}

async function main() {
  verifyEnvironment();
  await verifyStaticBoundaries();

  const landing = await request("/");
  assert.equal(landing.status, 200, "Landing page did not return HTTP 200.");
  const landingBody = await text(landing);
  assert(landingBody.includes("Project Local"), "Landing page did not render Project Local.");
  assert(landingBody.includes("Volunteer project access"), "Landing page did not render expected public access surface.");
  assertSafeBody(landingBody, "Landing page");

  const admin = await request("/admin");
  assert([302, 303, 307, 308].includes(admin.status), `Anonymous /admin did not redirect; got ${admin.status}.`);
  const adminTarget = assertSameOriginLocation(admin, "/admin/login");
  assert.equal(adminTarget.searchParams.get("next"), "/admin", "Anonymous /admin redirect did not preserve safe local next path.");

  const login = await request("/admin/login");
  assert.equal(login.status, 200, "/admin/login did not render HTTP 200.");
  const loginBody = await text(login);
  assert(loginBody.includes("Project contact access"), "Login page missing project-contact access copy.");
  assert(loginBody.includes("Sign in"), "Login page missing sign-in copy.");
  assert(loginBody.includes("Volunteers do not need an account"), "Login page missing volunteer account boundary copy.");
  assert(!loginBody.includes("Continue to prototype review"), "Production login should not expose prototype review bypass.");
  assertSafeBody(loginBody, "Login page");

  const invalidAccess = await request("/v/access/not-a-real-token");
  assert([302, 303, 307, 308].includes(invalidAccess.status), `Invalid volunteer access did not redirect; got ${invalidAccess.status}.`);
  assertVolunteerPrivacyHeaders(invalidAccess, "Invalid volunteer access redirect");
  assertNoCookieSet(invalidAccess, "Invalid volunteer access redirect");
  assertSameOriginLocation(invalidAccess, "/v/schedule");

  const schedule = await request("/v/schedule");
  assert.equal(schedule.status, 200, "/v/schedule without cookie did not render HTTP 200.");
  assertVolunteerPrivacyHeaders(schedule, "Unauthenticated volunteer schedule");
  assertNoCookieSet(schedule, "Unauthenticated volunteer schedule");
  const scheduleBody = await text(schedule);
  assert(scheduleBody.includes("This schedule link is unavailable"), "Unauthenticated volunteer schedule did not show safe unavailable state.");
  assert(scheduleBody.includes("Open your latest secure schedule link"), "Unauthenticated volunteer schedule missing safe recovery copy.");
  assert(!scheduleBody.includes("Your assignments"), "Unauthenticated volunteer schedule exposed assignment UI.");
  assert(!scheduleBody.includes("Confirm All"), "Unauthenticated volunteer schedule exposed response action UI.");
  assertSafeBody(scheduleBody, "Unauthenticated volunteer schedule");

  console.log(`Production deployment smoke passed for ${expectedProject} at ${expectedOrigin}.`);
  console.log(`Supabase ref lock: ${expectedSupabaseRef}. Expected migration: ${expectedMigration}.`);
  console.log("Verified landing page, anonymous admin redirect, login page, invalid volunteer access redirect, unauthenticated schedule unavailable state, volunteer privacy headers, and same-origin redirects.");
  console.log("No authenticated flow, magic-link request, fixture, mutation, email, Vercel API, Supabase API, cookie creation, service-role path, DNS change, Auth configuration change, or production data operation was used.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
