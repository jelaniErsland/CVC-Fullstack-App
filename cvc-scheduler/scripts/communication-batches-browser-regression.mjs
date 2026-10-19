import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { fixture, q, sql, value } from './12-47-local-fixtures.mjs';
import { resolvePreviewBrowserExecutable } from './preview-config.mjs';

// Local fixture and preview only. Never enable a delivery transport in this test.
const f = await fixture(true);
let browser;
try {
  const added = [];
  for (let i = 0; i < 3; i++) {
    added.push(value(f.auth(`select public.create_manual_volunteer_profile(${q(f.ws)},${q(JSON.stringify({ fullName: `Batch fixture ${i}`, email: `batch-${i}-${f.ws}@example.invalid`, phone: `+1202555011${i}` }))})`)));
  }
  sql(`update public.volunteer_profiles set email=null where id=${q(added[0])};
    update public.volunteer_profiles set email=${q(`batch-2-${f.ws}@example.invalid`)} where id=${q(added[1])};`);

  const plan = (mode, volunteerIds = []) => ({ kind: 'welcome', mode, volunteerIds });
  const review = selection => JSON.parse(value(f.auth(`select public.review_communications(${q(f.ws)},${q(JSON.stringify(selection))}::jsonb)`)));
  const initial = review(plan('new'));
  assert(initial.recipients.length > 0 && initial.exclusions.length > 0);
  assert(initial.exclusions.some(row => row.reason === 'missing_email'));
  assert.equal(initial.recipients.filter(row => row.sharedContact).length, 2);
  const operations = () => Number(value(`select count(*) from public.communication_operations where workspace_id=${q(f.ws)}`));
  const recipients = () => Number(value(`select count(*) from public.communication_recipients where workspace_id=${q(f.ws)}`));
  assert.equal(operations(), 0);

  browser = await chromium.launch({ executablePath: resolvePreviewBrowserExecutable(), headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
  await context.route('**/*', route => ['localhost', '127.0.0.1'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
  await context.addCookies([...f.admin.jar.values()].map(cookie => ({ name: cookie.name, value: cookie.value, domain: 'localhost', path: '/', sameSite: 'Lax' })));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('http://localhost:3000/admin/announcements', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Review recipients', exact: true }).click();
  const preview = page.getByRole('region', { name: 'Delivery preview' });
  await preview.getByRole('heading', { name: `${initial.recipients.length} will receive · ${initial.exclusions.length} will not receive` }).waitFor();
  assert.equal(await preview.locator('input[type=checkbox]').count(), initial.recipients.length);
  assert.equal((await preview.textContent()).includes('Add a valid email address'), true);
  assert.equal((await preview.textContent()).includes('Shared contact'), true);
  assert.equal(await page.getByText('Email transport is disabled. Preview only; no email will be sent.').count(), 1);
  assert.equal(await page.getByRole('button', { name: /^Confirm send to \d+ recipients?$/ }).isDisabled(), true);
  assert.equal(operations(), 0);

  await preview.locator('input[type=checkbox]').first().uncheck();
  const selectedIds = initial.recipients.slice(1).map(row => row.volunteerId);
  await page.getByText(`${selectedIds.length} selected`).waitFor();
  await page.getByText('Selection changed. Review recipients again before confirming.').waitFor();
  assert.equal(await page.getByRole('button', { name: /^Confirm send to/ }).count(), 0);
  const reduced = review(plan('new', selectedIds));
  await page.getByRole('button', { name: 'Review recipients', exact: true }).click();
  await preview.getByRole('heading', { name: `${reduced.recipients.length} will receive · ${reduced.exclusions.length} will not receive` }).waitFor();
  assert.equal(await preview.locator('input[type=checkbox]').count(), reduced.recipients.length);

  await page.getByLabel('Recipients').selectOption('resend');
  await page.getByText('Review this intentional resend. The earlier welcome delivery remains recorded.').waitFor();
  assert.equal(await page.getByRole('button', { name: /^Confirm intentional resend to/ }).count(), 0);
  const resend = review(plan('resend', selectedIds));
  await page.getByRole('button', { name: 'Review recipients', exact: true }).click();
  await preview.getByRole('heading', { name: `${resend.recipients.length} will receive · ${resend.exclusions.length} will not receive` }).waitFor();
  assert.equal(await page.getByRole('button', { name: /^Confirm intentional resend to \d+ recipients?$/ }).isDisabled(), true);
  assert.equal(await preview.getByText('0 already received this communication').count(), 0);
  assert.notEqual(sql(f.auth(`select public.review_communications(${q(f.ws)},${q(JSON.stringify(plan('resend')))}::jsonb)`), true).status, 0);
  await page.getByLabel('Recipients').selectOption('new');
  await page.getByRole('button', { name: 'Clear selection' }).click();
  await page.getByLabel('Recipients').selectOption('resend');
  await page.getByText('Choose a previous delivery in Delivery history and select Review resend.', { exact: false }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Review recipients', exact: true }).isDisabled(), true, 'Empty resend must not reach server review');
  assert.equal(operations(), 0);
  assert.equal(recipients(), 0);
  assert.deepEqual(errors, []);
  console.log('PASS: server-authoritative eligible/excluded review, selection refresh, intentional resend protection, and zero sends/provider calls in the local mobile browser fixture.');
} finally {
  if (browser) await browser.close();
  await f.cleanup();
}
