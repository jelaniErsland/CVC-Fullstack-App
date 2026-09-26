import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { resolvePreviewBrowserExecutable } from './preview-config.mjs';

// Run against `node scripts/12-48-preview.mjs --serve`: all people and schedule rows are synthetic.
const output = path.resolve('..', 'previews', '12.48-batch-2', 'implemented');
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ executablePath: resolvePreviewBrowserExecutable(), headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
await context.addCookies([{ name: 'fixture-assignments', value: '1', domain: '127.0.0.1', path: '/' }]);
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const go = route => page.goto(`http://127.0.0.1:3148${route}`, { waitUntil: 'networkidle' });
const screenshot = name => page.screenshot({ path: path.join(output, `${name}.png`), fullPage: false, style: 'nextjs-portal { visibility: hidden; }' });
const mealSummary = () => page.getByTestId('calendar-meal-summary').filter({ visible: true });
const mealCount = kind => mealSummary().locator(`[data-meal-kind="${kind}"] [data-meal-headcount]`).textContent();
const overflow = p => p.evaluate(() => document.documentElement.scrollWidth > innerWidth);

try {
  await go('/admin/calendar?view=month&date=2026-10-05');
  const mobileMonth = page.getByTestId('calendar-mobile-month');
  const agenda = mobileMonth.getByTestId('calendar-month-agenda');
  assert.equal(await mobileMonth.isVisible(), true);
  assert.equal(await agenda.locator('[data-calendar-month-agenda-item]').count(), 6);
  assert.equal(await mobileMonth.getByRole('button', { name: /Select Monday, Oct 5, 6 scheduled items/ }).getAttribute('aria-pressed'), 'true');
  await screenshot('calendar-month-selected-390');
  const firstItem = await agenda.locator('[data-calendar-month-agenda-item]').first().boundingBox();
  assert(firstItem && firstItem.y < 844 - 64, 'The first agenda item is below the initial usable viewport');
  await mobileMonth.getByRole('button', { name: "View day's work" }).click();
  assert.equal(await agenda.evaluate(element => document.activeElement === element), true, 'Agenda jump did not move keyboard focus');
  assert.equal(await agenda.evaluate(element => { const box = element.getBoundingClientRect(); return box.top < innerHeight && box.bottom > 0; }), true);
  await screenshot('calendar-month-agenda-jump-390');
  const foodItem = agenda.locator('[data-calendar-month-agenda-item="22222222-2222-4222-8222-000000000003"]');
  assert.equal(await foodItem.getByText('Jordan Hale').count(), 1);
  assert.equal(await foodItem.getByRole('img', { name: 'Awaiting reply' }).count(), 1);
  assert.equal(await foodItem.getByRole('img', { name: "Can't make it" }).count(), 1);
  await foodItem.getByRole('button', { name: /Food-service shift/ }).click();
  await page.getByRole('dialog', { name: 'Calendar item inspector' }).waitFor();
  assert.equal(new URL(page.url()).searchParams.get('item'), '22222222-2222-4222-8222-000000000003');
  await page.getByRole('dialog', { name: 'Calendar item inspector' }).getByRole('button', { name: 'Close calendar item inspector', exact: true }).click();
  await mobileMonth.getByRole('button', { name: /Select Wednesday, Oct 7, 1 scheduled item/ }).click();
  await page.waitForURL(/date=2026-10-07/);
  assert.equal(new URL(page.url()).pathname, '/admin/calendar');
  assert.equal(new URL(page.url()).searchParams.get('view'), 'month');
  assert.equal(await page.getByTestId('calendar-month-agenda').locator('[data-calendar-month-agenda-item]').count(), 1);
  assert.equal(await page.getByTestId('calendar-month-agenda').getByText('Lunch', { exact: true }).count(), 1);
  await screenshot('calendar-month-selected-positive-390');
  await page.getByTestId('calendar-month-agenda').getByRole('button', { name: 'Open October 7, 2026 in Day view' }).click();
  await page.waitForURL(/view=day.*date=2026-10-07/);

  await go('/admin/quick-view?date=2026-10-05&project=fixture-project');
  assert.equal(new URL(page.url()).searchParams.has('view'), false, 'Default Quick View route unexpectedly forced a view');
  assert.equal(await page.getByRole('button', { name: 'Month', exact: true }).getAttribute('aria-pressed'), 'true');
  assert.equal(await mealCount('breakfast'), 'Not recorded');
  assert.equal(await mealCount('lunch'), '0');
  assert.equal(await mealSummary().getByText('Main contact: Avery Stone').count(), 1);
  assert.equal(await page.getByRole('button', { name: /Create item|Create$/ }).count(), 0);
  await screenshot('quick-view-selected-meals-390');
  await page.getByTestId('calendar-mobile-month').getByRole('button', { name: /Select Wednesday, Oct 7, 1 scheduled item/ }).click();
  await page.waitForURL(/date=2026-10-07/);
  assert.equal(new URL(page.url()).pathname, '/admin/quick-view');
  assert.equal(await mealCount('breakfast'), 'Not scheduled');
  assert.equal(await mealCount('lunch'), '25');
  assert.equal(await mealSummary().getByText('Main contact: Jordan Hale').count(), 1);
  await screenshot('quick-view-positive-meals-390');
  await page.getByTestId('calendar-month-agenda').getByRole('button', { name: /Lunch/ }).click();
  await page.getByRole('dialog', { name: 'Calendar item inspector' }).waitFor();
  assert.equal(new URL(page.url()).pathname, '/admin/quick-view');
  assert.equal(await page.getByRole('dialog', { name: 'Calendar item inspector' }).getByText(/volunteer|helper|vacancy|staffing/i).count(), 0);

  await go('/qv?date=2026-10-05');
  assert.equal(await mealCount('breakfast'), 'Not recorded');
  assert.equal(await mealCount('lunch'), '0');
  assert.equal(await page.getByText('Casey Morgan').count(), 0, 'Bearer Quick View exposed an ordinary volunteer identity');
  assert.equal(await page.getByRole('list', { name: 'Assigned volunteers' }).count(), 0);
  assert.equal(await page.getByRole('button', { name: /Create item|Create$/ }).count(), 0);
  await page.getByTestId('calendar-mobile-month').getByRole('button', { name: /Select Wednesday, Oct 7, 1 scheduled item/ }).click();
  await page.waitForURL(/date=2026-10-07/);
  assert.equal(new URL(page.url()).pathname, '/qv');
  assert.equal(await mealCount('lunch'), '25');
  await screenshot('bearer-quick-view-meals-390');

  await go('/admin/calendar?view=month&date=2026-10-05');
  await page.getByRole('button', { name: 'Open calendar filters' }).click();
  await page.getByLabel('Task name', { exact: true }).filter({ visible: true }).fill('no matching project work');
  await page.getByRole('button', { name: /Show results/ }).filter({ visible: true }).click();
  assert.equal(await page.getByTestId('calendar-month-agenda').getByText('No scheduled items for this day.').count(), 1);
  await page.getByTestId('calendar-mobile-month').getByRole('button', { name: /Select Wednesday, Oct 7, 0 scheduled items/ }).click();
  await page.waitForURL(/date=2026-10-07/);
  assert.equal(await page.getByTestId('calendar-month-agenda').getByText('No scheduled items for this day.').count(), 1);

  for (const view of ['day', 'list']) {
    await go(`/admin/calendar?view=${view}&date=2026-10-05`);
    const food = page.locator('[data-calendar-task-item="22222222-2222-4222-8222-000000000003"]');
    assert.equal(await food.getByText('Avery Stone').count(), 1);
    assert.equal(await food.getByText('Jordan Hale').count(), 1);
    assert.equal(await food.getByText('Casey Morgan').count(), 1);
    for (const label of ['Confirmed', 'Awaiting reply', "Can't make it"]) {
      assert.equal(await food.getByRole('img', { name: label }).count(), 1);
    }
    assert.equal(await page.getByLabel('Assignment response legend').filter({ visible: true }).count(), 1);
    const cleanup = page.locator('[data-calendar-task-item="22222222-2222-4222-8222-000000000004"]');
    await cleanup.getByText('+3 more volunteers').click();
    assert.equal(await cleanup.getByText('Sam Rivera').count(), 1);
    await cleanup.scrollIntoViewIfNeeded();
    await screenshot(`calendar-${view}-expanded-roster-390`);
  }

  await context.addCookies([{ name: 'fixture-assignment-visibility', value: 'unavailable', domain: '127.0.0.1', path: '/' }]);
  await go('/admin/calendar?view=month&date=2026-10-05');
  assert.equal(await page.getByTestId('calendar-month-agenda').getByText('Assignment details unavailable').count() > 0, true);
  await context.addCookies([{ name: 'fixture-assignment-visibility', value: 'available', domain: '127.0.0.1', path: '/' }]);

  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
    await go('/admin/calendar?view=month&date=2026-10-05');
    assert.equal(await overflow(page), false, `Month overflow at ${width}px`);
    if (width < 640) {
      const selected = page.getByTestId('calendar-month-agenda');
      await selected.scrollIntoViewIfNeeded();
      assert.equal(await selected.isVisible(), true, `Agenda unreachable at ${width}px`);
    }
  }
  for (const physicalWidth of [320, 390, 768, 1024, 1440]) {
    const zoomContext = await browser.newContext({ viewport: { width: physicalWidth / 2, height: physicalWidth < 768 ? 350 : 500 }, deviceScaleFactor: 2 });
    await zoomContext.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    await zoomContext.addCookies([{ name: 'fixture-assignments', value: '1', domain: '127.0.0.1', path: '/' }]);
    const zoomPage = await zoomContext.newPage();
    await zoomPage.goto('http://127.0.0.1:3148/admin/calendar?view=month&date=2026-10-05', { waitUntil: 'networkidle' });
    assert.equal(await overflow(zoomPage), false, `Month overflow at ${physicalWidth}px and 200% effective zoom`);
    if (physicalWidth / 2 < 640) {
      const selected = zoomPage.getByTestId('calendar-month-agenda');
      await selected.scrollIntoViewIfNeeded();
      assert.equal(await selected.isVisible(), true, `Agenda unreachable at ${physicalWidth}px and 200% effective zoom`);
    }
    if (physicalWidth === 320) await zoomPage.screenshot({ path: path.join(output, 'calendar-month-text200-320-scrolled.png'), fullPage: false });
    await zoomContext.close();
  }
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
    await go('/admin/calendar?view=month&date=2026-10-05');
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    assert.equal(await overflow(page), false, `Month overflow at ${width}px with 200% root text`);
    if (width < 640) {
      const selected = page.getByTestId('calendar-month-agenda');
      await selected.scrollIntoViewIfNeeded();
      assert.equal(await selected.isVisible(), true, `Agenda unreachable at ${width}px with 200% root text`);
    }
    if (width === 320) await screenshot('calendar-month-root-text200-320-scrolled');
  }
  assert.deepEqual(errors, []);
  console.log('PASS: mobile Month selection/agenda, empty filtered state, exact inspector route, meal null/zero/positive, status icons/legend, roster disclosure, bearer isolation, and 320–1440px normal/enlarged scroll reachability. Synthetic fixture only.');
} finally {
  await browser.close();
}
