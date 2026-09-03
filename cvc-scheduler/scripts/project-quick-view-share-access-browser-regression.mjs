import nextEnv from "@next/env";
import { createBrowserClient } from "@supabase/ssr";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { chromium } from "playwright";

import {
  createPreviewUrl,
  resolvePreviewBaseUrl,
  resolvePreviewBrowserExecutable,
} from "./preview-config.mjs";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const root = process.cwd();
let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
let anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const baseUrl = resolvePreviewBaseUrl();
const browserExecutable = resolvePreviewBrowserExecutable();
const captureDir = path.resolve(root, "..", "previews", "beta-review", "iteration-12-44e3-shared-quick-view");
const writeCaptures = process.env.WRITE_ITERATION_12_44E3_CAPTURES === "1";
const refreshedAdminCaptures = new Set([
  "01-desktop-admin-share-control.png",
  "02-desktop-admin-created-link.png",
  "03-mobile-admin-share-control.png",
  "04-mobile-admin-created-link.png",
]);
const namespace = `qa-shared-qv-browser-${randomUUID()}`;
const workspaceId = randomUUID();
const contactId = randomUUID();
const grantId = randomUUID();
const itemIds = [randomUUID(), randomUUID(), randomUUID()];
const dayIds = [randomUUID(), randomUUID()];
const authUserIds = [];
const authCookies = new Map();
const secrets = new Set();
let authAccessToken;
let containerName;
let cleanupDone = false;

function loopback(value) {
  try { return ["127.0.0.1", "localhost", "[::1]", "::1"].includes(new URL(value).hostname); }
  catch { return false; }
}
function command(name, args, options = {}) {
  return spawnSync(name, args, { cwd: root, encoding: "utf8", windowsHide: true, maxBuffer: 20 * 1024 * 1024, ...options });
}
function sqlText(value) { return `'${String(value).replaceAll("'", "''")}'`; }
function redact(value) {
  let message = value instanceof Error ? value.stack ?? value.message : String(value);
  for (const secret of secrets) if (secret) message = message.replaceAll(secret, "[redacted]").replaceAll(encodeURIComponent(secret), "[redacted]");
  return message.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted-jwt]").slice(0, 2000);
}
function runPsql(sql) {
  const result = command("docker", ["exec", "-i", containerName, "psql", "--no-psqlrc", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], { input: sql });
  if (result.status !== 0) throw new Error(result.stderr || "Shared Quick View browser fixture SQL failed.");
  return result.stdout.trim();
}
async function resolveContainer() {
  if (!supabaseUrl || !anonKey) {
    const status = command("npx", ["supabase", "status", "--output", "json"], { shell: process.platform === "win32" });
    assert.equal(status.status, 0, "Local Supabase status is unavailable.");
    const localConfig = JSON.parse(status.stdout);
    supabaseUrl = localConfig.API_URL;
    anonKey = localConfig.ANON_KEY;
  }
  const config = await readFile(path.join(root, "supabase", "config.toml"), "utf8");
  const projectId = config.match(/^project_id\s*=\s*"([a-zA-Z0-9_-]+)"/m)?.[1];
  assert(projectId);
  const candidate = `supabase_db_${projectId}`;
  const inspect = command("docker", ["inspect", "--format", "{{.State.Running}}", candidate]);
  assert(inspect.status === 0 && inspect.stdout.trim() === "true", "Local Supabase must be running.");
  return candidate;
}
async function createAuth() {
  const email = `${namespace}@example.invalid`;
  const password = `${randomBytes(24).toString("base64url")}aA1!`;
  secrets.add(email); secrets.add(password);
  const jar = new Map();
  const client = createBrowserClient(supabaseUrl, anonKey, {
    isSingleton: false,
    cookies: {
      getAll: () => [...jar.values()].map(({ name, value }) => ({ name, value })),
      setAll: (values) => values.forEach((cookie) => cookie.value ? jar.set(cookie.name, cookie) : jar.delete(cookie.name)),
    },
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: true },
  });
  const signup = await client.auth.signUp({ email, password });
  assert(!signup.error && signup.data.user);
  let session = signup.data.session;
  if (!session) session = (await client.auth.signInWithPassword({ email, password })).data.session;
  assert(session && jar.size > 0);
  authAccessToken = session.access_token;
  const verified = await client.auth.getUser();
  assert(!verified.error && verified.data.user?.id === signup.data.user.id, "Disposable browser Auth user did not verify.");
  authUserIds.push(signup.data.user.id);
  secrets.add(session.access_token); secrets.add(session.refresh_token);
  for (const cookie of jar.values()) { authCookies.set(cookie.name, cookie); secrets.add(cookie.value); }
  return signup.data.user.id;
}
async function applyAuth(context) {
  const target = new URL(baseUrl);
  await context.addCookies([...authCookies.values()].map((cookie) => ({
    domain: target.hostname,
    httpOnly: false,
    name: cookie.name,
    path: "/",
    sameSite: "Lax",
    secure: target.protocol === "https:",
    value: cookie.value,
  })));
}
async function capture(page, name) {
  if (!writeCaptures || !refreshedAdminCaptures.has(name)) return;
  await mkdir(captureDir, { recursive: true });
  await page.screenshot({ path: path.join(captureDir, name), fullPage: false });
}
async function noOverflow(page, label) {
  const values = await page.evaluate(() => ({ body: document.body.scrollWidth, viewport: document.documentElement.clientWidth }));
  assert(values.body <= values.viewport + 1, `${label} overflowed horizontally.`);
}
function watchErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(redact(error)));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("/_next/webpack-hmr")) errors.push(redact(message.text()));
  });
  return errors;
}
async function cleanup() {
  if (!containerName) return;
  runPsql(`
    delete from public.project_quick_view_access_tokens where workspace_id = '${workspaceId}'::uuid;
    delete from public.project_days where workspace_id = '${workspaceId}'::uuid;
    delete from public.calendar_items where workspace_id = '${workspaceId}'::uuid;
    delete from public.workspace_contact_grants where id = '${grantId}'::uuid;
    delete from public.project_contacts where id = '${contactId}'::uuid;
    delete from public.workspaces where id = '${workspaceId}'::uuid;
    ${authUserIds.map((id) => `delete from auth.users where id = '${id}'::uuid;`).join("\n")}
  `);
  const residue = Number(runPsql(`select (select count(*) from public.workspaces where workspace_key like ${sqlText(`${namespace}%`)}) + (select count(*) from auth.users where email like ${sqlText(`${namespace}%`)});`));
  assert.equal(residue, 0); cleanupDone = true;
}

async function main() {
  assert(loopback(baseUrl), "Browser regression requires a loopback preview.");
  containerName = await resolveContainer();
  assert(supabaseUrl && anonKey && loopback(supabaseUrl), "Browser regression requires loopback Supabase.");
  secrets.add(anonKey);
  const authUserId = await createAuth();
  runPsql(`
    insert into public.workspaces (id, workspace_key, display_name, lifecycle, timezone, starts_on, ends_on)
    values ('${workspaceId}'::uuid, ${sqlText(namespace)}, 'Gallatin Valley Build', 'active', 'America/Denver', '2026-08-01', '2030-09-30');
    insert into public.project_contacts (id, auth_user_id, status) values ('${contactId}'::uuid, '${authUserId}'::uuid, 'active');
    insert into public.workspace_contact_grants (id, workspace_id, project_contact_id, role, capabilities, status, valid_from)
    values ('${grantId}'::uuid, '${workspaceId}'::uuid, '${contactId}'::uuid, 'main_contact', array['workspace.read','calendar.view','calendar.edit']::text[], 'active', now() - interval '1 day');
    insert into public.project_days (id, workspace_id, project_date, expected_on_site_count, created_by_project_contact_id, updated_by_project_contact_id) values
      ('${dayIds[0]}'::uuid, '${workspaceId}'::uuid, '2026-09-02', 47, '${contactId}'::uuid, '${contactId}'::uuid),
      ('${dayIds[1]}'::uuid, '${workspaceId}'::uuid, '2026-09-03', 0, '${contactId}'::uuid, '${contactId}'::uuid);
    insert into public.calendar_items (id, workspace_id, title_snapshot, task_type_snapshot, schedule_kind, start_date, start_time, end_time, timezone, needed_count, schedule_notes, publication_state, published_at, published_by_project_contact_id) values
      ('${itemIds[0]}'::uuid, '${workspaceId}'::uuid, 'General Help', 'general', 'timed', '2026-09-02', '07:30', '17:00', 'America/Denver', 4, 'private note', 'published', now(), '${contactId}'::uuid),
      ('${itemIds[1]}'::uuid, '${workspaceId}'::uuid, 'Lunch', 'food', 'timed', '2026-09-02', '12:00', '12:30', 'America/Denver', 1, 'private lunch note', 'published', now(), '${contactId}'::uuid),
      ('${itemIds[2]}'::uuid, '${workspaceId}'::uuid, 'Restricted security post', 'security', 'timed', '2026-09-02', '08:00', '09:00', 'America/Denver', 2, 'restricted location', 'published', now(), '${contactId}'::uuid);
  `);

  const browser = await chromium.launch(browserExecutable ? { executablePath: browserExecutable } : {});
  try {
    const admin = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ["clipboard-read", "clipboard-write"] });
    await applyAuth(admin);
    const adminPage = await admin.newPage();
    adminPage.setDefaultTimeout(8_000);
    const adminErrors = watchErrors(adminPage);
    await adminPage.goto(createPreviewUrl(baseUrl, `/admin/quick-view?project=${encodeURIComponent(namespace)}&date=2026-09-02`), { waitUntil: "domcontentloaded" });
    if (await adminPage.getByRole("heading", { name: "Share this Quick View", exact: true }).count() === 0) {
      throw new Error(`Admin share control did not render. Safe page text: ${(await adminPage.locator("body").innerText()).slice(0, 900)}`);
    }
    await adminPage.getByRole("heading", { name: "Share this Quick View", exact: true }).waitFor();
    await adminPage.getByRole("button", { name: "Create share link", exact: true }).waitFor();
    await capture(adminPage, "01-desktop-admin-share-control.png");
    await adminPage.getByRole("button", { name: "Create share link", exact: true }).click();
    await adminPage.getByText("Quick View link created", { exact: true }).waitFor();
    await capture(adminPage, "02-desktop-admin-created-link.png");
    await adminPage.getByRole("button", { name: "Copy link", exact: true }).click();
    await adminPage.goto(createPreviewUrl(baseUrl, `/admin/quick-view?project=${encodeURIComponent(namespace)}&date=2026-09-02`), { waitUntil: "domcontentloaded" });
    const reloadedAdminText = await adminPage.locator("body").innerText();
    assert(reloadedAdminText.includes("Create new link"), "Reloaded admin share state did not distinguish existing hash-only links.");
    assert(reloadedAdminText.includes("1 active link."), "Reloaded admin share state did not report its one active link.");
    assert.doesNotMatch(await adminPage.locator("body").innerText(), /\/qv\/access\/[A-Za-z0-9_-]{43}/, "Reloaded admin control reconstructed a raw bearer.");
    assert.equal(adminErrors.length, 0, adminErrors.join("\n"));

    const mobileAdmin = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ["clipboard-read", "clipboard-write"] });
    await applyAuth(mobileAdmin);
    const mobileAdminPage = await mobileAdmin.newPage();
    mobileAdminPage.setDefaultTimeout(8_000);
    await mobileAdminPage.goto(createPreviewUrl(baseUrl, `/admin/quick-view?project=${encodeURIComponent(namespace)}&date=2026-09-02`), { waitUntil: "domcontentloaded" });
    const mobileShareHeading = mobileAdminPage.getByRole("heading", { name: "Share this Quick View", exact: true });
    await mobileShareHeading.waitFor();
    await mobileShareHeading.scrollIntoViewIfNeeded();
    await noOverflow(mobileAdminPage, "Mobile admin share control");
    await mobileAdminPage.getByRole("button", { name: "Create new link", exact: true }).waitFor();
    await mobileAdminPage.getByText(/1 active link\./).waitFor();
    await capture(mobileAdminPage, "03-mobile-admin-share-control.png");
    await mobileAdminPage.getByRole("button", { name: "Create new link", exact: true }).click();
    await mobileAdminPage.getByText("Quick View link created", { exact: true }).waitFor();
    await mobileAdminPage.getByText(/2 active links\./).waitFor();
    await mobileAdminPage.getByRole("button", { name: "Copy link", exact: true }).waitFor();
    await mobileShareHeading.scrollIntoViewIfNeeded();
    await capture(mobileAdminPage, "04-mobile-admin-created-link.png");

    const issuedResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/issue_project_quick_view_access`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        authorization: `Bearer ${authAccessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ p_workspace_id: workspaceId }),
    });
    assert(issuedResponse.ok, "Disposable recipient credential could not be issued.");
    const issuedPayload = await issuedResponse.json();
    const bearer = issuedPayload?.[0]?.bearer_token;
    assert(typeof bearer === "string" && /^[A-Za-z0-9_-]{43}$/.test(bearer), "Disposable recipient credential was invalid.");
    secrets.add(bearer);
    const shareUrl = createPreviewUrl(baseUrl, `/qv/access/${encodeURIComponent(bearer)}`);
    secrets.add(shareUrl);

    const recipient = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const recipientPage = await recipient.newPage();
    recipientPage.setDefaultTimeout(8_000);
    const recipientErrors = watchErrors(recipientPage);
    const recipientRouteResponse = await recipientPage.request.get(shareUrl, { maxRedirects: 0 });
    assert([302, 303, 307, 308].includes(recipientRouteResponse.status()), "Bearer route did not redirect to the clean recipient URL.");
    assert(recipientRouteResponse.headers()["cache-control"]?.includes("no-store"));
    assert(recipientRouteResponse.headers()["x-robots-tag"] === "noindex, nofollow, noarchive");
    assert(recipientRouteResponse.headers()["referrer-policy"] === "no-referrer");
    await recipientPage.goto(shareUrl, { waitUntil: "domcontentloaded" });
    assert(new URL(recipientPage.url()).pathname === "/qv", "Bearer did not exchange to a clean URL.");
    const cookies = await recipient.cookies();
    const quickViewCookie = cookies.find((cookie) => cookie.name === "pl-project-quick-view");
    assert(quickViewCookie?.httpOnly && quickViewCookie.sameSite === "Lax" && quickViewCookie.path === "/qv");
    await recipientPage.getByRole("heading", { name: "Gallatin Valley Build", exact: true }).waitFor();
    const recipientText = await recipientPage.locator("body").innerText();
    for (const forbidden of ["Admin", "Overview", "Volunteers", "Restricted security", "private note", workspaceId, contactId, bearer]) {
      assert(!recipientText.includes(forbidden), `Recipient view leaked ${forbidden}.`);
    }
    await capture(recipientPage, "05-desktop-recipient-quick-view.png");
    await capture(recipientPage, "08-recipient-populated-schedule.png");
    await capture(recipientPage, "09-recipient-expected-on-site-47.png");
    await recipientPage.getByRole("link", { name: "Next day", exact: true }).click();
    await recipientPage.getByText("0 people", { exact: true }).waitFor();
    await capture(recipientPage, "11-recipient-zero-people.png");
    await capture(recipientPage, "12-recipient-another-date.png");
    await recipientPage.getByRole("link", { name: "Next day", exact: true }).click();
    await recipientPage.getByText("Not set", { exact: true }).waitFor();
    await capture(recipientPage, "10-recipient-not-set.png");
    assert.equal(recipientErrors.length, 0, recipientErrors.join("\n"));

    await recipientPage.setViewportSize({ width: 390, height: 844 });
    await recipientPage.goto(createPreviewUrl(baseUrl, "/qv?date=2026-09-02"), { waitUntil: "domcontentloaded" });
    await recipientPage.getByText("47 people", { exact: true }).waitFor();
    await noOverflow(recipientPage, "390px recipient Quick View");
    await capture(recipientPage, "06-mobile-recipient-quick-view.png");
    await recipientPage.setViewportSize({ width: 360, height: 800 });
    await noOverflow(recipientPage, "360px recipient Quick View");
    await capture(recipientPage, "07-narrow-360-recipient-quick-view.png");

    const revokeResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/revoke_project_quick_view_access`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        authorization: `Bearer ${authAccessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ p_workspace_id: workspaceId }),
    });
    assert(revokeResponse.ok, "Disposable shared access could not be revoked.");
    assert((await revokeResponse.json()) >= 1, "Shared access revocation did not affect an active link.");
    await recipientPage.reload({ waitUntil: "domcontentloaded" });
    await recipientPage.getByRole("heading", { name: "This project view is no longer available.", exact: true }).waitFor();
    assert(!((await recipientPage.locator("body").innerText()).includes("Gallatin Valley Build")), "Revoked session retained project identity.");
    await capture(recipientPage, "13-recipient-unavailable.png");

    await admin.close(); await mobileAdmin.close(); await recipient.close();
  } finally {
    await browser.close();
  }
  console.log("Shared Project Quick View admin and recipient browser regression passed.");
}

try { await main(); }
catch (error) { console.error(redact(error)); process.exitCode = 1; }
finally {
  try { await cleanup(); } catch (error) { console.error(redact(error)); process.exitCode = 1; }
  if (containerName) assert(cleanupDone, "Browser fixture cleanup did not complete.");
}
