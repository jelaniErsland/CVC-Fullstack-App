// Production-mode Next, disposable local Auth/workspace, real restricted status
// RPC through local Supavisor. All external HTTP/TCP/provider traffic is denied.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

if (process.argv.includes('--status-fixture-server')) {
  let fail = false;
  const request = globalThis.fetch;
  globalThis.fetch = (input, options) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    assert(['localhost', '127.0.0.1'].includes(url.hostname), 'No hosted HTTP/provider traffic');
    return request(input, options);
  };
  const connect = net.Socket.prototype.connect;
  net.Socket.prototype.connect = function (...args) {
    const normalized = Array.isArray(args[0]) ? args[0] : args;
    const cfg = typeof normalized[0] === 'object' ? normalized[0] : { host: normalized[1] };
    assert(['localhost', '127.0.0.1', '::1'].includes(cfg.host), 'No hosted TCP traffic');
    return connect.apply(this, args);
  };
  const pg = createRequire(import.meta.url)('pg'), RealPool = pg.Pool;
  pg.Pool = class extends RealPool {
    constructor(config) {
      assert.equal(config.host, 'aws-1-us-west-2.pooler.supabase.com');
      assert.equal(config.user, 'project_local_reminder_runner.wdlaauzknfggoqldolmx');
      assert.equal(config.port, 6543); assert.equal(config.ssl.rejectUnauthorized, true); assert.equal(config.max, 1);
      super({ ...config, host: '127.0.0.1', port: 56543, user: 'project_local_reminder_runner.local-reminder-fixture', ssl: false });
      this.on('connect', client => {
        const query = client.query.bind(client);
        client.query = (text, values) => {
          if (text.startsWith('SELECT public.')) {
            assert.equal(values[0], 'status', 'Communications must perform only narrow status operations');
            console.log('STATUS_READ');
            if (fail) throw new Error('Local simulated status failure');
          }
          return query(text, values);
        };
      });
    }
  };
  const next = (await import('next')).default, app = next({ dev: false, hostname: 'localhost', port: 3000 });
  await app.prepare();
  assert(['localhost', '127.0.0.1'].includes(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname));
  const server = http.createServer(app.getRequestHandler());
  await new Promise(resolve => server.listen(3000, '127.0.0.1', resolve));
  console.log('STATUS_SERVER_READY');
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', async text => {
    if (text.trim() === 'stop') { server.closeAllConnections(); await app.close(); server.close(() => process.exit(0)); }
    else { fail = text.trim() === 'fail'; console.log(fail ? 'STATUS_FAILURE_ON' : 'STATUS_FAILURE_OFF'); }
  });
} else {
  const { chromium } = await import('playwright');
  const { resolvePreviewBrowserExecutable } = await import('./preview-config.mjs');
  const { fixture, sql, value } = await import('./12-47-local-fixtures.mjs');
  const { withLocalReminderRunner } = await import('./reminder-database-local-fixture.mjs');
  const { withLocalSupavisor } = await import('./reminder-supavisor-local-fixture.mjs');
  const output = path.resolve(process.env.REMINDER_EVIDENCE_DIR ?? '../previews/12-57d-reminder-status');
  fs.mkdirSync(output, { recursive: true });
  const reset = () => sql("update public.assignment_reminder_activation set delivery_enabled=false,baseline_at=null,scan_cursors='{}'");
  const fingerprint = () => value(`select md5(jsonb_build_array(
    (select jsonb_agg(to_jsonb(t)) from public.assignment_reminder_activation t),
    (select jsonb_agg(to_jsonb(t)) from public.assignment_reminder_enrollments t),
    (select jsonb_agg(to_jsonb(t)) from public.assignment_reminder_occurrences t),
    (select jsonb_agg(to_jsonb(t)) from public.assignment_reminder_events t),
    (select jsonb_agg(to_jsonb(t) order by id) from public.communication_operations t),
    (select jsonb_agg(to_jsonb(t) order by id) from public.communication_recipients t),
    (select jsonb_agg(jsonb_build_array(last_value,is_called)) from public.assignment_reminder_events_id_seq)
  )::text)`);
  await withLocalReminderRunner(async ({ environment }) => withLocalSupavisor(async () => {
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), '--status-fixture-server'], {
      env: { ...process.env, ...environment, RESEND_API_KEY: 're_local_simulated_only', NODE_ENV: 'production' }, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '', stderr = '', browser, f;
    child.stdout.on('data', x => stdout += x); child.stderr.on('data', x => stderr += x);
    const wait = async (text, from = 0) => {
      const deadline = Date.now() + 30000;
      while (!stdout.slice(from).includes(text)) {
        if (child.exitCode !== null || Date.now() > deadline) throw new Error('Fixture server unavailable: ' + stderr.slice(-1500));
        await new Promise(resolve => setTimeout(resolve, 30));
      }
    };
    const control = async failed => { const from = stdout.length; child.stdin.write(failed ? 'fail\n' : 'okay\n'); await wait(failed ? 'STATUS_FAILURE_ON' : 'STATUS_FAILURE_OFF', from); };
    const manifest = JSON.parse(fs.readFileSync('.next/server/server-reference-manifest.json', 'utf8'));
    const actions = Object.entries({ ...manifest.node, ...manifest.edge });
    const previewIds = new Set(actions.filter(([, e]) => e.exportedName === 'readReminderPreview' || Object.values(e.workers ?? {}).some(w => w.exportedName === 'readReminderPreview')).map(([id]) => id));
    const statusIds = new Set(actions.filter(([, e]) => e.exportedName === 'readReminderStatus' || Object.values(e.workers ?? {}).some(w => w.exportedName === 'readReminderStatus')).map(([id]) => id));
    assert(previewIds.size > 0);
    assert(statusIds.size > 0);
    try {
      await wait('STATUS_SERVER_READY'); f = await fixture(true);
      browser = await chromium.launch({ executablePath: resolvePreviewBrowserExecutable(), headless: true });
      for (const width of process.argv.includes('--security-only') ? [] : [320, 390, 430, 768, 1280, 1920]) {
        const context = await browser.newContext({ viewport: { width, height: 900 } });
        let forbidden = 0, previewReads = 0;
        await context.route('**/*', route => ['localhost', '127.0.0.1'].includes(new URL(route.request().url()).hostname) ? route.continue() : (forbidden++, route.abort()));
        await context.addCookies([...f.admin.jar.values()].map(c => ({ name: c.name, value: c.value, domain: 'localhost', path: '/', sameSite: 'Lax' })));
        const page = await context.newPage(), errors = [];
        page.on('pageerror', e => errors.push(e.message));
        page.on('request', req => { if (previewIds.has(req.headers()['next-action'])) previewReads++; });
        const tab = page.getByRole('tab', { name: /Automatic reminders/ });
        const panel = page.getByRole('region', { name: 'Automatic reminders', exact: true });
        for (const enabled of [false, true]) {
          sql(`update public.assignment_reminder_activation set delivery_enabled=${enabled},baseline_at=${enabled ? 'now()' : 'null'}`);
          const before = fingerprint(), readsBefore = previewReads;
          await page.goto('http://localhost:3000/admin/announcements?kind=reminders', { waitUntil: 'networkidle' });
          assert((await tab.innerText()).endsWith(enabled ? 'On' : 'Off'), 'Fresh page must know true status BEFORE preview');
          assert.equal(previewReads, readsBefore);
          assert.equal(await panel.getByRole('button', { name: enabled ? 'View reminder schedule and history' : 'Preview reminders', exact: true }).getAttribute('aria-expanded'), 'false');
          assert.equal((await panel.innerText()).includes('not currently being sent'), !enabled);
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
          for (const control of [tab, panel.getByRole('button').first()]) assert((await control.boundingBox()).height >= 44);
          await page.screenshot({ path: path.join(output, `${enabled ? 'on' : 'off'}-fresh-${width}.png`), fullPage: true });
          await page.getByRole('tab', { name: 'Delivery history', exact: true }).click(); await tab.click();
          assert((await tab.innerText()).endsWith(enabled ? 'On' : 'Off'));
          await page.reload({ waitUntil: 'networkidle' }); assert((await tab.innerText()).endsWith(enabled ? 'On' : 'Off')); assert.equal(previewReads, readsBefore);
          await page.goto('http://localhost:3000/admin/announcements?kind=history', { waitUntil: 'networkidle' });
          await page.goBack({ waitUntil: 'networkidle' }); assert((await tab.innerText()).endsWith(enabled ? 'On' : 'Off'));
          await page.goForward({ waitUntil: 'networkidle' }); await tab.click(); assert.equal(previewReads, readsBefore);
          await panel.getByRole('button', { name: enabled ? 'View reminder schedule and history' : 'Preview reminders', exact: true }).click();
          await panel.getByRole('button', { name: 'Refresh preview', exact: true }).waitFor();
          assert((await tab.innerText()).endsWith(enabled ? 'On' : 'Off')); assert.equal(previewReads, readsBefore + 1);
          assert.equal(fingerprint(), before, 'Initial status, tabs, history, reload and preview must be SELECT-only');
        }
        await control(true);
        const readsBefore = previewReads, before = fingerprint();
        await page.goto('http://localhost:3000/admin/announcements?kind=reminders', { waitUntil: 'networkidle' }); assert((await tab.innerText()).includes('Unavailable')); assert(!(await tab.innerText()).endsWith('Off'));
        assert((await panel.innerText()).includes('Reminder status unavailable')); assert(!(await panel.innerText()).includes('not currently being sent')); assert.equal(previewReads, readsBefore);
        await page.screenshot({ path: path.join(output, `unavailable-${width}.png`), fullPage: true });
        await control(false); await panel.getByRole('button', { name: 'Retry reminder status', exact: true }).click();
        await tab.filter({ hasText: /On$/ }).waitFor(); assert.equal(previewReads, readsBefore, 'Retry is status-only');
        assert.equal(fingerprint(), before); assert.deepEqual(errors, []); assert.equal(forbidden, 0);
        if (width === 390) {
          await control(true); await page.reload({ waitUntil: 'networkidle' });
          assert((await tab.innerText()).includes('Unavailable'));
          let release, captured;
          const held = new Promise(resolve => release = resolve), fetched = new Promise(resolve => captured = resolve);
          await page.route('**/admin/announcements*', async route => {
            if (!statusIds.has(route.request().headers()['next-action'])) return route.continue();
            const response = await route.fetch(); captured(); await held; await route.fulfill({ response });
          });
          await panel.getByRole('button', { name: 'Retry reminder status', exact: true }).click(); await fetched;
          await control(false); await panel.getByRole('button', { name: 'View reminder details', exact: true }).click();
          // Next queues Server Actions: release the earlier response after the
          // newer UI intent, so the newer authorized read can leave that queue.
          release(); await tab.filter({ hasText: /On$/ }).waitFor(); await page.waitForLoadState('networkidle');
          assert((await tab.innerText()).endsWith('On'), 'Older failed retry must not overwrite a newer authoritative preview');
          await page.unroute('**/admin/announcements*'); assert.equal(fingerprint(), before);
        }
        await context.close(); reset(); console.log(`PASS ${width}px fresh authoritative On/Off before preview, tabs, deep link, refresh/history, unavailable/retry, lazy preview, no writes/overflow`);
      }
      const statusReads = () => (stdout.match(/STATUS_READ/g) ?? []).length;
      const anonymous = await browser.newContext(), anonPage = await anonymous.newPage(), beforeAnonymous = statusReads();
      await anonPage.goto('http://localhost:3000/admin/announcements?kind=reminders', { waitUntil: 'networkidle' });
      assert.equal(statusReads(), beforeAnonymous, 'Unauthenticated navigation cannot use the system status capability');
      await anonymous.close();
      sql(`update public.workspace_contact_grants set status='revoked',revoked_at=now() where workspace_id='${f.ws}'`);
      const denied = await browser.newContext();
      await denied.addCookies([...f.admin.jar.values()].map(c => ({ name: c.name, value: c.value, domain: 'localhost', path: '/', sameSite: 'Lax' })));
      const deniedPage = await denied.newPage(), beforeDenied = statusReads();
      await deniedPage.goto('http://localhost:3000/admin/announcements?kind=reminders', { waitUntil: 'networkidle' });
      assert.equal(statusReads(), beforeDenied, 'Revoked grants fail closed before the system status read');
      await denied.close();
      sql(`update public.workspace_contact_grants set status='active',revoked_at=null where workspace_id='${f.ws}'`);
      console.log('PASS stale status ownership, anonymous denial and revoked Communications grant denial');
      await f.cleanup(); f = null;
      // Retain the full established reminder UI/template/history regression.
      if (!process.argv.includes('--status-only')) {
        const legacy = spawn(process.execPath, ['--no-warnings', '--experimental-strip-types', 'scripts/assignment-reminders-browser.mjs'], { env: { ...process.env, REMINDER_EVIDENCE_DIR: path.join(output, 'existing') }, windowsHide: true, stdio: 'inherit' });
        const code = await new Promise(resolve => legacy.once('exit', resolve)); assert.equal(code, 0);
      }
    } finally {
      await browser?.close(); reset(); await f?.cleanup(); child.stdin.end('stop\n');
      await new Promise(resolve => { const timer = setTimeout(() => { child.kill(); resolve(); }, 5000); child.once('exit', () => { clearTimeout(timer); resolve(); }); });
    }
  }));
  console.log('PASS 12.57D status recovery and existing reminder browser gates; actual local production build; external network denied; zero provider calls');
}
