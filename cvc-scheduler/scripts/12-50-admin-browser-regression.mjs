import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { fixture, q, value } from './12-47-local-fixtures.mjs';
import { resolvePreviewBrowserExecutable } from './preview-config.mjs';

const base = process.env.PREVIEW_BASE_URL || 'http://127.0.0.1:3100';
assert.equal(new URL(base).hostname, '127.0.0.1');
const f = await fixture(true);
let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: resolvePreviewBrowserExecutable() });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.route('**/*', route => ['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
  await context.addCookies([...f.admin.jar.values()].map(c => ({ name: c.name, value: c.value, domain: '127.0.0.1', path: '/', sameSite: 'Lax' })));
  const page = await context.newPage();
  const errors=[];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}/admin/calendar?view=day&date=${f.dayAt(10)}`, { waitUntil: 'networkidle' });
  await page.getByRole('link', { name: 'Review drafts' }).click();
  await page.getByRole('heading', { name: 'Drafts to review' }).waitFor();
  await page.getByText('No drafts need review.').waitFor();
  await page.goto(`${base}/admin/calendar?view=day&date=${f.dayAt(10)}`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  let create = page.getByRole('dialog', { name: 'Plan project work' });
  await create.getByLabel('Date', { exact: true }).fill(f.dayAt(10));
  await create.getByLabel('Task preset', { exact: true }).selectOption(f.preset);
  await create.getByRole('button', { name: 'Create item', exact: true }).click();
  await page.getByText('Calendar item saved').waitFor();
  assert.equal(value(`select count(*) from public.calendar_items where workspace_id=${q(f.ws)} and start_date=${q(f.dayAt(10))} and publication_state='published'`), '1');
  assert.equal(value(`select count(*) from public.communication_operations where workspace_id=${q(f.ws)}`), '0');
  await page.goto(`${base}/admin/calendar?view=day&date=${f.dayAt(11)}`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  create = page.getByRole('dialog', { name: 'Plan project work' });
  await create.getByLabel('Date', { exact: true }).fill(f.dayAt(11));
  await create.getByLabel('Task preset', { exact: true }).selectOption(f.preset);
  await create.getByRole('button', { name: 'Save as draft' }).click();
  try { await page.getByText('Draft saved').waitFor({ timeout: 10000 }); }
  catch (error) {
    console.error('Draft browser state', page.url(), (await page.locator('body').innerText()).slice(0,1300));
    console.error('Local draft state', value(`select publication_state || '|' || explicit_draft from public.calendar_items where workspace_id=${q(f.ws)} and start_date=${q(f.dayAt(11))}`));
    throw error;
  }
  const draft=value(`select id from public.calendar_items where workspace_id=${q(f.ws)} and start_date=${q(f.dayAt(11))} and publication_state='draft'`);
  assert(draft);
  await page.goto(`${base}/admin/calendar/drafts`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Drafts to review' }).waitFor();
  await page.getByRole('link', { name: /Site preparation/ }).click();
  const inspector=page.getByRole('dialog', { name: 'Calendar item inspector' });
  await inspector.getByRole('button', { name: 'Activate draft' }).click();
  await inspector.getByRole('button', { name: 'Activate draft' }).last().click();
  await page.getByText('Draft activated').waitFor();
  assert.equal(value(`select publication_state from public.calendar_items where id=${q(draft)}`), 'published');
  assert.equal(value(`select count(*) from public.communication_operations where workspace_id=${q(f.ws)}`), '0');
  await page.goto(`${base}/admin/announcements?kind=schedule`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Review recipients' }).click();
  await page.getByText(/will receive · .*will not receive/).waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS browser: mobile Calendar operational save, explicit draft review/activation, Communications recipient counts, no email operation.');
} finally {
  if (browser) await browser.close();
  await f.cleanup();
}
