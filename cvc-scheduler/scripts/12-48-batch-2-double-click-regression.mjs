import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { resolvePreviewBrowserExecutable } from './preview-config.mjs';

// Isolated synthetic fixture. Start with `node scripts/12-48-preview.mjs --serve`.
const browser = await chromium.launch({ executablePath: resolvePreviewBrowserExecutable(), headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
await context.addCookies([{ name: 'fixture-assignments', value: '1', domain: '127.0.0.1', path: '/' }]);
const page = await context.newPage();
const go = route => page.goto(`http://127.0.0.1:3148${route}`, { waitUntil: 'networkidle' });
const planner = () => page.getByRole('dialog', { name: /Plan project work/ });
const inspector = () => page.getByRole('dialog', { name: 'Calendar item inspector' });
const routeState = () => { const url = new URL(page.url()); return { path: url.pathname, view: url.searchParams.get('view'), date: url.searchParams.get('date'), item: url.searchParams.get('item') }; };
const monthEmpty = date => page.locator(`[data-calendar-month-cell="${date}"] [data-calendar-arrow-target="month-date"]`);
const weekTimed = index => page.locator('[data-calendar-arrow-target="week-timed-day"]').nth(index);
const weekContext = index => page.locator('[data-calendar-arrow-target="week-context-day"]').nth(index);

try {
  await go('/admin/calendar?view=month&date=2026-10-05');
  await monthEmpty('2026-10-08').dblclick({ delay: 90 });
  await page.waitForURL(/view=day.*date=2026-10-08/);
  await page.waitForTimeout(360);
  assert.deepEqual(routeState(), { path: '/admin/calendar', view: 'day', date: '2026-10-08', item: null });
  assert.equal(await planner().count(), 0, 'First click of Month double-click opened creation');
  await page.goBack({ waitUntil: 'networkidle' });
  assert.equal(routeState().view, 'month', 'Double-click Day navigation did not preserve browser history');
  assert.equal(routeState().date, '2026-10-05');

  await go('/admin/calendar?view=month&date=2026-10-05');
  await monthEmpty('2026-10-09').click();
  await planner().waitFor();
  assert.equal(await planner().getByLabel('Date', { exact: true }).inputValue(), '2026-10-09');
  assert.equal(routeState().view, 'month');
  await page.keyboard.press('Escape');
  await planner().waitFor({ state: 'hidden' });

  await page.locator('[data-calendar-month-cell="2026-10-05"]').getByRole('button', { name: /Food-service shift/ }).click();
  await inspector().waitFor();
  assert.equal(routeState().item, '22222222-2222-4222-8222-000000000003');
  await page.waitForTimeout(360);
  assert.equal(await planner().count(), 0, 'Existing Month event opened creation');
  assert.equal(routeState().view, 'month', 'Existing Month event navigated to Day');

  await go('/admin/calendar?view=month&date=2026-10-05');
  await page.evaluate(() => {
    document.querySelector('[data-calendar-month-cell="2026-10-08"] [data-calendar-arrow-target="month-date"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    document.querySelector('[data-calendar-month-cell="2026-10-05"] button[aria-label*="Food-service shift"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
  });
  await inspector().waitFor();
  await page.waitForTimeout(360);
  assert.equal(await planner().count(), 0, 'Selecting an event did not cancel a pending empty-cell click');

  await go('/admin/calendar?view=month&date=2026-10-05');
  await monthEmpty('2026-10-10').focus();
  await page.keyboard.press('Enter');
  await planner().waitFor();
  assert.equal(routeState().view, 'month', 'Keyboard creation changed views');

  await go('/admin/calendar?view=week&date=2026-10-05');
  await weekTimed(3).dblclick({ delay: 90, position: { x: 35, y: 240 } });
  await page.waitForURL(/view=day.*date=2026-10-08/);
  await page.waitForTimeout(360);
  assert.equal(await planner().count(), 0, 'First click of Week time-grid double-click opened creation');

  await go('/admin/calendar?view=week&date=2026-10-05');
  await weekContext(3).dblclick({ delay: 90 });
  await page.waitForURL(/view=day.*date=2026-10-08/);
  await page.waitForTimeout(360);
  assert.equal(await planner().count(), 0, 'First click of Week context double-click opened creation');

  await go('/admin/calendar?view=week&date=2026-10-05');
  await weekTimed(4).click({ position: { x: 35, y: 240 } });
  await planner().waitFor();
  assert.equal(await planner().getByLabel('Date', { exact: true }).inputValue(), '2026-10-09');
  assert.equal(routeState().view, 'week');
  await page.keyboard.press('Escape');
  await planner().waitFor({ state: 'hidden' });

  await weekContext(2).click();
  await planner().waitFor();
  assert.equal(await planner().getByLabel('Date', { exact: true }).inputValue(), '2026-10-07');
  assert.equal(routeState().view, 'week');
  await page.keyboard.press('Escape');
  await planner().waitFor({ state: 'hidden' });

  await page.locator('[data-week-event-id="22222222-2222-4222-8222-000000000003"]').getByRole('button').click();
  await inspector().waitFor();
  assert.equal(routeState().item, '22222222-2222-4222-8222-000000000003');
  await page.waitForTimeout(360);
  assert.equal(await planner().count(), 0, 'Existing Week event opened creation');
  assert.equal(routeState().view, 'week', 'Existing Week event navigated to Day');

  await go('/admin/calendar?view=month&date=2026-10-05');
  await page.getByRole('button', { name: 'Open calendar filters' }).click();
  await page.getByLabel('Task name', { exact: true }).filter({ visible: true }).fill('Lunch');
  await page.getByRole('button', { name: /Show results/ }).filter({ visible: true }).click();
  await monthEmpty('2026-10-08').dblclick({ delay: 90 });
  await page.waitForURL(/view=day.*date=2026-10-08/);
  await page.getByRole('button', { name: 'Open calendar filters' }).click();
  assert.equal(await page.getByLabel('Task name', { exact: true }).filter({ visible: true }).inputValue(), 'Lunch', 'Day navigation lost the active filter');

  await go('/admin/calendar?view=day&date=2026-10-08');
  await page.getByRole('button', { name: /Plan project work on .* at 9 AM/ }).click();
  await planner().waitFor();
  assert.equal(routeState().view, 'day', 'Day empty-slot creation changed views');

  await go('/admin/quick-view?view=month&date=2026-10-05&project=fixture-project');
  assert.equal(await monthEmpty('2026-10-08').count(), 0);
  await page.locator('[data-calendar-month-cell="2026-10-08"]').dblclick({ position: { x: 90, y: 48 }, delay: 90 });
  await page.waitForTimeout(360);
  assert.equal(routeState().view, 'month');
  assert.equal(await planner().count(), 0);
  await page.locator('[data-calendar-month-cell="2026-10-08"]').getByRole('button', { name: 'Open October 8, 2026 in Day view' }).click();
  await page.waitForURL(/view=day.*date=2026-10-08/);
  assert.equal(new URL(page.url()).searchParams.get('project'), 'fixture-project');

  await page.setViewportSize({ width: 390, height: 844 });
  await go('/admin/calendar?view=month&date=2026-10-05');
  await page.getByTestId('calendar-mobile-month').getByRole('button', { name: /Select Wednesday, Oct 7/ }).click();
  await page.waitForURL(/date=2026-10-07/);
  assert.equal(routeState().view, 'month');
  assert.equal(await planner().count(), 0);
  console.log('PASS: desktop Month/Week single-click creation and double-click Day routing remain separate; events select inspectors, Day keeps creation, mobile keeps selection, and Quick View stays read-only. Synthetic fixture only.');
} finally {
  await browser.close();
}
