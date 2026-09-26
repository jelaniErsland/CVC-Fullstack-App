import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { resolvePreviewBrowserExecutable } from './preview-config.mjs';

// Isolated fixture routes only. Run with `node scripts/12-48-preview.mjs --serve`.
const output = path.resolve('..', 'previews', '12.48-batch-2', 'implemented');
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ executablePath: resolvePreviewBrowserExecutable(), headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
await context.addCookies([{ name: 'fixture-assignments', value: '1', domain: '127.0.0.1', path: '/' }]);
const page = await context.newPage();
const go = route => page.goto(`http://127.0.0.1:3148${route}`, { waitUntil: 'networkidle' });
const dayButton = date => page.locator(`[data-calendar-month-cell="${date}"]`).getByRole('button', { name: /in Day view/ });
const routeState = () => { const url = new URL(page.url()); return { pathname: url.pathname, date: url.searchParams.get('date'), view: url.searchParams.get('view'), project: url.searchParams.get('project'), item: url.searchParams.get('item') }; };

try {
  for (const base of ['/admin/calendar', '/admin/quick-view', '/qv']) {
    const project = base === '/qv' ? '' : '&project=fixture-project';
    await go(`${base}?view=month&date=2026-10-05${project}`);
    const day = dayButton('2026-10-07');
    assert.match(await day.getAttribute('aria-label'), /Open October 7, 2026 in Day view/);
    await day.focus();
    if (base === '/admin/calendar') await page.screenshot({ path: path.join(output, 'calendar-month-day-number-focus-1440.png'), fullPage: false });
    await page.keyboard.press('Enter');
    await page.waitForURL(/view=day.*date=2026-10-07/);
    assert.deepEqual(routeState(), { pathname: base, date: '2026-10-07', view: 'day', project: base === '/admin/quick-view' ? 'fixture-project' : null, item: null });
    await page.goBack({ waitUntil: 'networkidle' });
    assert.equal(routeState().view, 'month');
    assert.equal(routeState().date, '2026-10-05');

    const mealCell = page.locator('[data-calendar-month-cell="2026-10-05"]');
    await mealCell.getByRole('button', { name: /Food-service shift/ }).click();
    await page.getByRole('dialog', { name: 'Calendar item inspector' }).waitFor();
    assert.equal(routeState().item, '22222222-2222-4222-8222-000000000003');
    assert.equal(routeState().pathname, base);
    await page.getByRole('dialog', { name: 'Calendar item inspector' }).getByRole('button', { name: 'Close calendar item inspector', exact: true }).click();

    const emptyCell = page.locator('[data-calendar-month-cell="2026-10-08"]');
    if (base === '/admin/calendar') {
      await emptyCell.getByRole('button', { name: /Plan project work on/ }).click();
      await page.getByRole('dialog', { name: /Plan project work/ }).waitFor();
      assert.equal(routeState().pathname, base);
      await page.keyboard.press('Escape');
    } else {
      assert.equal(await emptyCell.getByRole('button', { name: /Plan project work on/ }).count(), 0);
    }
  }

  await go('/admin/calendar?view=week&date=2026-10-05&project=fixture-project');
  await page.getByRole('button', { name: 'Open October 7, 2026 in Day view' }).click();
  await page.waitForURL(/view=day.*date=2026-10-07/);
  assert.equal(routeState().project, null);

  await page.setViewportSize({ width: 390, height: 844 });
  for (const base of ['/admin/calendar', '/admin/quick-view', '/qv']) {
    const project = base === '/qv' ? '' : '&project=fixture-project';
    await go(`${base}?view=month&date=2026-10-05${project}`);
    const month = page.getByTestId('calendar-mobile-month');
    await month.getByRole('button', { name: /Select Wednesday, Oct 7, 1 scheduled item/ }).click();
    await page.waitForURL(/date=2026-10-07/);
    assert.equal(routeState().view, 'month');
    assert.equal(await month.getByTestId('calendar-month-agenda').getByText('Lunch', { exact: true }).count(), 1);
    if (base === '/admin/calendar') {
      await month.getByTestId('calendar-month-agenda').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(output, 'calendar-month-open-day-390.png'), fullPage: false });
    }
    await month.getByTestId('calendar-month-agenda').getByRole('button', { name: 'Open October 7, 2026 in Day view' }).click();
    await page.waitForURL(/view=day.*date=2026-10-07/);
    assert.equal(routeState().pathname, base);
    assert.equal(routeState().project, base === '/admin/quick-view' ? 'fixture-project' : null);
    await page.goBack({ waitUntil: 'networkidle' });
    assert.equal(routeState().view, 'month');
    assert.equal(routeState().date, '2026-10-07');
    assert.equal(await page.getByTestId('calendar-mobile-month').getByRole('button', { name: /Select Wednesday, Oct 7, 1 scheduled item/ }).getAttribute('aria-pressed'), 'true');
  }
  console.log('PASS: desktop Month day-number keyboard route, empty-cell creation, exact event inspector, Week heading, mobile selection/Open Day, read-only Quick View, project context and back navigation. Synthetic fixture only.');
} finally {
  await browser.close();
}
