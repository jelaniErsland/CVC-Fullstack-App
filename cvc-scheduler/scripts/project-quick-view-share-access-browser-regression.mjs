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
const assignedContactMode = process.env.SHARED_ASSIGNED_CONTACT_ONLY === "1";
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
const presetId = randomUUID();
const dayIds = [randomUUID(), randomUUID()];
const assignedVolunteerId = randomUUID();
const assignedAssignmentId = randomUUID();
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
async function privacyCapture(page, name) {
  if (process.env.WRITE_ASSIGNMENT_INSTRUCTIONS_SCREENSHOTS !== "1") return;
  const directory = path.join(root, "docs", "previews", "assignment-instructions");
  await mkdir(directory, {recursive:true});
  await page.screenshot({path:path.join(directory,name),fullPage:false});
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
function responseMediaType(response) {
  return (response.headers()["content-type"] ?? "").split(";", 1)[0].trim().toLowerCase();
}
function notificationFingerprint() {
  return runPsql(`select jsonb_agg(jsonb_build_object('table',name,'count',n,'digest',digest) order by name) from (
    ${['assignment_notification_deliveries', 'volunteer_welcome_deliveries', 'communication_operations', 'communication_recipients'].map(name => `select '${name}' name,count(*) n,md5(coalesce(string_agg(to_jsonb(t)::text,'|' order by to_jsonb(t)::text),'')) digest from public.${name} t`).join(' union all ')}
  ) fingerprints;`);
}
async function cleanup() {
  if (!containerName) return;
  runPsql(`
    delete from public.project_quick_view_access_tokens where workspace_id = '${workspaceId}'::uuid;
    delete from public.calendar_assignments where workspace_id = '${workspaceId}'::uuid;
    delete from public.volunteer_profiles where workspace_id = '${workspaceId}'::uuid;
    delete from public.project_days where workspace_id = '${workspaceId}'::uuid;
    delete from public.calendar_items where workspace_id = '${workspaceId}'::uuid;
    delete from public.task_presets where workspace_id = '${workspaceId}'::uuid;
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
  assert(!process.env.ASSIGNMENT_NOTIFICATION_EMAIL_TRANSPORT?.trim() && !process.env.RESEND_API_KEY?.trim(), 'Real email providers must be disabled for the bearer browser regression.');
  const notificationsBefore = notificationFingerprint();
  secrets.add(anonKey);
  const authUserId = await createAuth();
  runPsql(`
    insert into public.workspaces (id, workspace_key, display_name, lifecycle, timezone, starts_on, ends_on)
    values ('${workspaceId}'::uuid, ${sqlText(namespace)}, 'Gallatin Valley Build', 'active', 'America/Denver', '2026-08-01', '2030-09-30');
    insert into public.project_contacts (id, auth_user_id, status) values ('${contactId}'::uuid, '${authUserId}'::uuid, 'active');
    insert into public.workspace_contact_grants (id, workspace_id, project_contact_id, role, capabilities, status, valid_from)
    values ('${grantId}'::uuid, '${workspaceId}'::uuid, '${contactId}'::uuid, 'main_contact', array['workspace.read','calendar.view','calendar.edit','tasks.view','assignments.view','volunteers.view']::text[], 'active', now() - interval '1 day');
    insert into public.project_days (id, workspace_id, project_date, expected_on_site_count, created_by_project_contact_id, updated_by_project_contact_id) values
      ('${dayIds[0]}'::uuid, '${workspaceId}'::uuid, '2026-09-02', 47, '${contactId}'::uuid, '${contactId}'::uuid),
      ('${dayIds[1]}'::uuid, '${workspaceId}'::uuid, '2026-09-03', 0, '${contactId}'::uuid, '${contactId}'::uuid);
    insert into public.calendar_items (id, workspace_id, title_snapshot, task_type_snapshot, schedule_kind, start_date, start_time, end_time, timezone, needed_count, schedule_notes, publication_state, published_at, published_by_project_contact_id) values
      ('${itemIds[0]}'::uuid, '${workspaceId}'::uuid, 'General Help', 'general', 'timed', '2026-09-02', '07:30', '17:00', 'America/Denver', 4, 'private note', 'published', now(), '${contactId}'::uuid),
      ('${itemIds[1]}'::uuid, '${workspaceId}'::uuid, 'Lunch', 'food', 'timed', '2026-09-02', '12:00', '12:30', 'America/Denver', 1, 'private lunch note', 'published', now(), '${contactId}'::uuid),
      ('${itemIds[2]}'::uuid, '${workspaceId}'::uuid, 'Restricted security post', 'security', 'timed', '2026-09-02', '08:00', '09:00', 'America/Denver', 2, 'restricted location', 'published', now(), '${contactId}'::uuid);
  `);

  runPsql(`
    insert into public.task_presets (id, workspace_id, name, description, task_type, default_needed_count)
    values ('${presetId}'::uuid, '${workspaceId}'::uuid, 'General Help instructions', 'Current synthetic preset instructions.', 'general', 4);
    update public.calendar_items set task_preset_id='${presetId}'::uuid, custom_values='{"reporting_point":"Synthetic entrance"}'::jsonb where id='${itemIds[0]}'::uuid;
  `);

  runPsql(`update public.calendar_items set meal_kind='lunch',meal_provider='Synthetic meal team',meal_contact='Synthetic meal contact',meal_menu='Vegetable soup',meal_total=47 where id='${itemIds[1]}'::uuid;`);
  if (assignedContactMode) runPsql(`
    insert into public.volunteer_profiles (id,workspace_id,full_name,email,phone,congregation,profile_notes,profile_source,manual_created_by_project_contact_id,manual_created_at,availability_snapshot,skills_help_snapshot)
    values ('${assignedVolunteerId}'::uuid,'${workspaceId}'::uuid,'Synthetic Contact Volunteer','quick-view-fixture@example.invalid','+1 555 120 1100','Synthetic Congregation','private profile marker','manual','${contactId}'::uuid,now(),'{}','{}');
    insert into public.calendar_assignments (id,workspace_id,calendar_item_id,volunteer_profile_id)
    values ('${assignedAssignmentId}'::uuid,'${workspaceId}'::uuid,'${itemIds[0]}'::uuid,'${assignedVolunteerId}'::uuid);
  `);
  const browser = await chromium.launch(browserExecutable ? { executablePath: browserExecutable } : {});
  try {
    const admin = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ["clipboard-read", "clipboard-write"] });
    await applyAuth(admin);
    const adminPage = await admin.newPage();
    adminPage.setDefaultTimeout(8_000);
    const adminErrors = watchErrors(adminPage);
    await adminPage.goto(createPreviewUrl(baseUrl, `/admin/quick-view?project=${encodeURIComponent(namespace)}&date=2026-09-02`), { waitUntil: "networkidle" });
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
    await adminPage.goto(createPreviewUrl(baseUrl, `/admin/quick-view?project=${encodeURIComponent(namespace)}&date=2026-09-02`), { waitUntil: "networkidle" });
    const reloadedAdminText = await adminPage.locator("body").innerText();
    assert(reloadedAdminText.includes("Create new link"), "Reloaded admin share state did not distinguish existing hash-only links.");
    assert(reloadedAdminText.includes("1 active link."), "Reloaded admin share state did not report its one active link.");
    assert.doesNotMatch(await adminPage.locator("body").innerText(), /\/qv\/access\/[A-Za-z0-9_-]{43}/, "Reloaded admin control reconstructed a raw bearer.");
    assert.equal(adminErrors.length, 0, adminErrors.join("\n"));

    await adminPage.goto(createPreviewUrl(baseUrl, '/admin/quick-view?project='+encodeURIComponent(namespace)+'&date=2026-09-02&view=day&item='+itemIds[0]), {waitUntil:'networkidle'});
    const authorizedInspector = adminPage.getByRole('dialog', {name:'Calendar item inspector',exact:true});
    await authorizedInspector.getByText('private note', {exact:true}).waitFor();
    await authorizedInspector.getByText('Current synthetic preset instructions.', {exact:true}).waitFor();
    await authorizedInspector.getByText('Synthetic entrance', {exact:true}).waitFor();
    await privacyCapture(adminPage,'privacy-admin-desktop.png');
    await adminPage.keyboard.press('Escape');
    // Same actor after losing edit authority is a generic schedule viewer.
    // Recheck the live database grant, not the role label or a client flag.
    runPsql(`update public.workspace_contact_grants set capabilities=array['workspace.read','calendar.view','tasks.view','assignments.view','volunteers.view']::text[] where id='${grantId}'::uuid;`);
    for (const route of ['/admin/quick-view','/admin/calendar']) {
      await adminPage.goto(createPreviewUrl(baseUrl, route+'?project='+encodeURIComponent(namespace)+'&date=2026-09-02&view=day&item='+itemIds[0]), {waitUntil:'networkidle'});
      await adminPage.getByRole('dialog', {name:'Calendar item inspector',exact:true}).waitFor();
      assert(!/private note|private lunch note|restricted location|Current synthetic preset instructions|Synthetic entrance/.test(await adminPage.content()), 'Authenticated read-only serialized page leaked instructions.');
      if (route === '/admin/calendar') await privacyCapture(adminPage,'privacy-read-only-desktop.png');
    }
    await adminPage.setViewportSize({width:390,height:844});
    await adminPage.goto(createPreviewUrl(baseUrl, '/admin/calendar?project='+encodeURIComponent(namespace)+'&date=2026-09-02&view=day&item='+itemIds[0]), {waitUntil:'networkidle'});
    await adminPage.getByRole('dialog', {name:'Calendar item inspector',exact:true}).waitFor();
    assert(!/private note|Current synthetic preset instructions|Synthetic entrance/.test(await adminPage.content()), 'Mobile authenticated read-only payload leaked instructions.');
    await noOverflow(adminPage,'Mobile authenticated read-only inspector');
    await privacyCapture(adminPage,'privacy-read-only-mobile.png');
    await adminPage.setViewportSize({width:1440,height:1000});
    runPsql(`update public.workspace_contact_grants set capabilities=array['workspace.read','calendar.view','calendar.edit','tasks.view','assignments.view','volunteers.view']::text[] where id='${grantId}'::uuid;`);
    const mobileAdmin = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ["clipboard-read", "clipboard-write"] });
    await applyAuth(mobileAdmin);
    const mobileAdminPage = await mobileAdmin.newPage();
    mobileAdminPage.setDefaultTimeout(8_000);
    await mobileAdminPage.goto(createPreviewUrl(baseUrl, `/admin/quick-view?project=${encodeURIComponent(namespace)}&date=2026-09-02`), { waitUntil: "networkidle" });
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
    // Keep an independent reader on the actual Flight fetch. The framework can
    // cancel its consumer after decoding enough to navigate, before network EOF.
    // Draining a clone preserves the original response and sends no extra request.
    // Successful requestfinished + full Playwright body reads remain mandatory.
    await recipient.addInitScript(() => {
      const fetch = window.fetch;
      window.fetch = async (...args) => {
        const response = await fetch(...args);
        const url = new URL(response.url);
        if (url.origin === location.origin && url.pathname === '/qv'
          && response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() === 'text/x-component') {
          response.clone().arrayBuffer().catch(() => {});
        }
        return response;
      };
    });
    const recipientPage = await recipient.newPage();
    recipientPage.setDefaultTimeout(8_000);
    const recipientErrors = watchErrors(recipientPage);
    const payloadChecks = [];
    // Inspect completed responses. Next may cancel superseded RSC prefetches;
    // those have no readable completed body and must not count as inspected.
    recipientPage.on('requestfinished', request => {
      payloadChecks.push(request.response().then(async response => {
        if (!response) return {safe:false,kind:'missing response'};
        const type = responseMediaType(response);
        if ((response.status() >= 300 && response.status() < 400) || !['text/html','text/x-component','application/json'].includes(type)) return {safe:true,kind:'ignored'};
        const body = await response.text();
        return {safe: !/private note|private lunch note|restricted location|Current synthetic preset instructions|Synthetic entrance/.test(body),kind:type,status:response.status(),characters:body.length};
      }).catch(() => ({safe:false,kind:'completed body unavailable'})));
    });
    await recipientPage.goto(shareUrl, { waitUntil: "networkidle" });
    assert(new URL(recipientPage.url()).pathname === "/qv", "Bearer did not exchange to a clean URL.");
    const cookies = await recipient.cookies();
    const quickViewCookie = cookies.find((cookie) => cookie.name === "pl-project-quick-view");
    assert(quickViewCookie?.httpOnly && quickViewCookie.sameSite === "Lax" && quickViewCookie.path === "/qv");
    await recipientPage.goto(createPreviewUrl(baseUrl, "/qv?date=2026-09-02"), { waitUntil: "networkidle" });
    await recipientPage.getByText("LDC Gallatin Valley Build", { exact: true }).waitFor();
    const recipientText = await recipientPage.locator("body").innerText();
    await recipientPage.getByRole('region', {name:/Meal headcounts/}).getByText('47', {exact:true}).waitFor();
    for (const forbidden of ["Overview", "private note", workspaceId, contactId, bearer]) {
      assert(!recipientText.includes(forbidden), `Recipient view leaked ${forbidden}.`);
    }
    await capture(recipientPage, "05-desktop-recipient-quick-view.png");
    await capture(recipientPage, "08-recipient-populated-schedule.png");
    // The established 12.47 contract renders the shared Calendar, including
    // published security tasks, without the retired expected-on-site panel.
    // URL/DOM changes can precede the streamed response's EOF. Register before
    // the real Day click and wait for requestfinished, before another navigation
    // can supersede the stream. Cached, redirected or canceled bodies cannot pass.
    const completedDayRsc = recipientPage.waitForEvent('requestfinished', {
      timeout: 10_000,
      predicate: async request => {
        const url = new URL(request.url());
        if (url.origin !== new URL(baseUrl).origin || url.pathname !== '/qv'
          || url.searchParams.get('view') !== 'day' || url.searchParams.get('date') !== '2026-09-02'
          || request.resourceType() !== 'fetch' || request.headers().rsc !== '1'
          || request.headers()['next-router-prefetch']) return false;
        const response = await request.response();
        return response?.status() === 200 && responseMediaType(response) === 'text/x-component';
      },
    });
    const [dayRscRequest] = await Promise.all([
      completedDayRsc,
      recipientPage.getByRole('button',{name:'Day',exact:true}).filter({visible:true}).click(),
    ]);
    const dayRscResponse = await dayRscRequest.response();
    assert(dayRscResponse && await dayRscResponse.finished() === null, 'Day navigation RSC response did not complete.');
    assert((await dayRscRequest.allHeaders()).cookie?.includes(`${quickViewCookie.name}=${quickViewCookie.value}`), 'Day RSC request did not use the established bearer session.');
    const dayRscBody = await dayRscResponse.text();
    assert(!/private note|private lunch note|restricted location|Current synthetic preset instructions|Synthetic entrance/.test(dayRscBody), 'Completed bearer RSC body leaked private instructions.');
    for (const operational of ['Gallatin Valley Build', 'General Help', '2026-09-02', '07:30', '17:00', 'Lunch', 'Synthetic meal contact', 'Synthetic meal team', 'Vegetable soup']) {
      assert(dayRscBody.includes(operational), `Completed bearer RSC body omitted operational ${operational}.`);
    }
    assert(dayRscBody.includes('"neededCount":4') && dayRscBody.includes(`"filledCount":${assignedContactMode ? 1 : 0}`), 'Completed bearer RSC body omitted staffing data.');
    if (assignedContactMode) assert(!dayRscBody.includes('quick-view-fixture@example.invalid') && !dayRscBody.includes('+1 555 120 1100'), 'Contact details loaded before opening the card.');
    assert(dayRscBody.includes('"total":47'), 'Completed bearer RSC body omitted the meal headcount.');
    assert(dayRscBody.includes(itemIds[0]) && dayRscBody.includes(itemIds[1])
      && dayRscBody.includes('"publicationState":"published"'), 'Completed bearer RSC body omitted the actual published fixture records.');
    console.log(`Completed bearer Day-navigation RSC privacy proof: PASS (${Buffer.byteLength(dayRscBody)} bytes; exact workspace, schedule, staffing and meal data; private sentinels absent).`);
    await recipientPage.waitForURL(url=>url.searchParams.get('view')==='day');
    await recipientPage.getByRole('button',{name:/General Help/}).first().click();
    const inspector=recipientPage.getByRole('dialog',{name:'Calendar item inspector'});
    await inspector.waitFor();
    assert.equal(new URL(recipientPage.url()).pathname,'/qv');
    assert.equal(await inspector.getByText('Schedule notes', {exact:true}).count(), 0);
    for (const privateText of ['private note', 'Current synthetic preset instructions.', 'Synthetic entrance']) {
      assert.equal(await inspector.getByText(privateText, {exact:true}).count(), 0);
    }
    await privacyCapture(recipientPage,'privacy-bearer-desktop.png');
    const serializedPage = await recipientPage.content();
    assert(!/private note|private lunch note|restricted location|Current synthetic preset instructions|Synthetic entrance/.test(serializedPage), "Bearer serialized HTML/RSC payload leaked private instructions.");
    assert.equal(await inspector.getByRole('button',{name:/^(Assign|Publish|Send|Remove|Save)/}).count(),0);
    if (assignedContactMode) {
      await inspector.getByRole('button',{name:'Contact Synthetic Contact Volunteer'}).click();
      const contactCard = recipientPage.getByRole('dialog',{name:'Assigned volunteer contact'});
      await contactCard.getByText('quick-view-fixture@example.invalid',{exact:true}).waitFor();
      await contactCard.getByText('+1 555 120 1100',{exact:true}).waitFor();
      await contactCard.getByText('Synthetic Congregation',{exact:true}).waitFor();
      assert(!/private profile marker|private note|Emergency|Response to this assignment|Other assignments/.test(await contactCard.innerText()), 'Shared contact card exposed private or admin-only fields.');
      assert(await contactCard.getByRole('link',{name:'Call'}).count()===1 && await contactCard.getByRole('link',{name:'Text'}).count()===1 && await contactCard.getByRole('link',{name:'Email'}).count()===1);
      await contactCard.getByRole('button',{name:'Close volunteer contact'}).click();
      await inspector.getByRole('button',{name:'Contact Synthetic Contact Volunteer'}).waitFor();
    }
    await recipientPage.keyboard.press('Escape');await inspector.waitFor({state:'hidden'});
    await recipientPage.getByRole('button',{name:/Lunch/}).first().click();
    await inspector.getByText('Daily headcount',{exact:true}).waitFor();
    await inspector.getByText('47',{exact:true}).waitFor();
    await inspector.getByText('Synthetic meal contact',{exact:true}).waitFor();
    assert(!/filled|assigned|private lunch note|Schedule notes/.test(await inspector.innerText()), 'Meal inspector must preserve its operational contract without staffing or instruction prose.');
    await recipientPage.keyboard.press('Escape'); await inspector.waitFor({state:'hidden'});
    await recipientPage.getByRole('button',{name:'Next day',exact:true}).click();
    await recipientPage.waitForURL(url=>url.searchParams.get('date')==='2026-09-03');
    await recipientPage.waitForLoadState('networkidle');
    assert.equal(new URL(recipientPage.url()).pathname,'/qv');
    await recipientPage.getByRole('button',{name:'Next day',exact:true}).click();
    await recipientPage.waitForURL(url=>url.searchParams.get('date')==='2026-09-04');
    await recipientPage.waitForLoadState('networkidle');
    assert.equal(recipientErrors.length, 0, recipientErrors.join("\n"));

    await recipientPage.setViewportSize({ width: 390, height: 844 });
    await recipientPage.goto(createPreviewUrl(baseUrl, "/qv?date=2026-09-02"), { waitUntil: "networkidle" });
    await recipientPage.getByText("LDC Gallatin Valley Build", { exact: true }).waitFor();
    await noOverflow(recipientPage, "390px recipient Quick View");
    await capture(recipientPage, "06-mobile-recipient-quick-view.png");
    await recipientPage.setViewportSize({ width: 360, height: 800 });
    await noOverflow(recipientPage, "360px recipient Quick View");
    await capture(recipientPage, "07-narrow-360-recipient-quick-view.png");

    await recipientPage.goto(createPreviewUrl(baseUrl, '/qv?date=2026-09-02&view=day&item='+itemIds[0]), {waitUntil:'networkidle'});
    const mobileInspector = recipientPage.getByRole('dialog', {name:'Calendar item inspector',exact:true});
    await mobileInspector.waitFor();
    assert(!/private note|Current synthetic preset instructions|Synthetic entrance/.test(await recipientPage.content()), 'Mobile deep link leaked instructions.');

    assert.equal(await mobileInspector.getByRole('button',{name:/^(Assign|Publish|Send|Remove|Save)/}).count(),0);
    if (assignedContactMode) {
      await mobileInspector.getByRole('button',{name:'Contact Synthetic Contact Volunteer'}).click();
      const mobileCard=recipientPage.getByRole('dialog',{name:'Assigned volunteer contact'});
      await mobileCard.getByText('quick-view-fixture@example.invalid',{exact:true}).waitFor();
      assert(!/private profile marker|private note|Emergency|Response to this assignment/.test(await mobileCard.innerText()),'Mobile shared contact card exposed private fields.');
      await noOverflow(recipientPage,'Mobile shared contact card');
      await mobileCard.getByRole('button',{name:'Close Assigned volunteer contact'}).click();
    }
    await noOverflow(recipientPage, 'Mobile bearer inspector');
    await privacyCapture(recipientPage,'privacy-bearer-mobile.png');
    await recipientPage.keyboard.press('Escape');
    await mobileInspector.waitFor({state:'hidden'});

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
    await recipientPage.reload({ waitUntil: "networkidle" });
    await recipientPage.getByRole("heading", { name: "This project view is no longer available.", exact: true }).waitFor();
    assert(!((await recipientPage.locator("body").innerText()).includes("Gallatin Valley Build")), "Revoked session retained project identity.");
    await capture(recipientPage, "13-recipient-unavailable.png");

    const checkedPayloads = await Promise.all(payloadChecks);
    assert(checkedPayloads.some(result => result.kind.startsWith('text/html')), 'No completed HTML payload inspected.');
    assert(checkedPayloads.some(result => result.kind.startsWith('text/x-component')), 'No completed RSC payload inspected.');
    assert(checkedPayloads.every(result => result.safe), 'Bearer payload review failed: '+JSON.stringify(checkedPayloads.filter(result => !result.safe)));
    console.log('Completed bearer payload inspection counts: '+JSON.stringify(Object.fromEntries(['text/html','text/x-component','application/json'].map(type => [type,checkedPayloads.filter(result => result.kind === type).length]))));
    assert.equal(notificationFingerprint(), notificationsBefore, 'Opening/navigating Quick View changed notification or communication ledgers.');
    console.log('Notification/communication fingerprints unchanged; real providers disabled.');
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
