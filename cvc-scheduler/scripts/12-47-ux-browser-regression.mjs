import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { fixture, q, value } from './12-47-local-fixtures.mjs';
import { resolvePreviewBrowserExecutable } from './preview-config.mjs';

const output = path.resolve('..', 'previews', '12.47-final-ux-polish');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: resolvePreviewBrowserExecutable(), headless: true });
try {
  for (const width of [1440, 390]) {
    const f = await fixture(true);
    const errors = [];
    const context = await browser.newContext({ viewport: { width, height: width === 1440 ? 1300 : 1000 } });
    const volunteerContext = await browser.newContext({ viewport: { width, height: 1000 } });
    for (const c of [context, volunteerContext]) await c.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
    await context.addCookies([...f.admin.jar.values()].map(c => ({ name: c.name, value: c.value, domain: '127.0.0.1', path: '/', sameSite: 'Lax' })));
    await volunteerContext.addCookies([{ name: 'pl-volunteer-schedule', value: f.token, domain: '127.0.0.1', path: '/v', httpOnly: true, sameSite: 'Lax' }]);
    const page = await context.newPage(), volunteer = await volunteerContext.newPage();
    for (const p of [page, volunteer]) {
      p.setDefaultTimeout(25000);
      p.on('pageerror', e => errors.push(e.message));
      p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    }
    const go = (p, route) => p.goto('http://127.0.0.1:3000' + route, { waitUntil: route === '/admin/volunteers' ? 'domcontentloaded' : 'networkidle', timeout: 90000 });
    const capture = async (p, name) => {
      if (!['existing-multi-date-inspector', 'repeat-create-inspector'].includes(name)) return;
      if (name === 'existing-multi-date-inspector') await p.locator('section[aria-label="Assign volunteers"]').first().evaluate(element => element.scrollIntoView({ block: 'start' }));
      await p.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, name + ' overflow');
      await p.screenshot({ path: path.join(output, `${name}-${width}.png`), fullPage: false });
    };
    try {
      await go(page, `/admin/calendar?view=week&date=${f.day}`);
      assert.equal(await page.getByText('Assign across Calendar items', { exact: true }).count(), 0);
      await page.getByRole('button', { name: /Published, Site preparation/ }).first().click();
      let inspector = page.getByRole('dialog', { name: 'Calendar item inspector' });
      await inspector.getByLabel('Also assign on other dates').check();
      await inspector.getByRole('button', { name: 'Select all', exact: true }).click();
      await inspector.getByLabel('Select Riley Chen').check();
      await inspector.getByText(/3 new assignments/).waitFor();
      assert.equal(await inspector.getByRole('button', { name: 'Save assignments' }).count(), 1);
      await capture(page, 'existing-multi-date-inspector');
      await inspector.getByRole('button', { name: 'Save assignments' }).click();
      await inspector.getByText(/Saved 3 assignments/).waitFor();
      assert.equal(value(`select count(*) from public.calendar_assignments where volunteer_profile_id=${q(f.volunteers[2])} and calendar_item_id in (${f.items.map(q).join(',')})`), '3');
      if (await page.locator('button[aria-label="Close calendar item inspector"]:visible').count()) await page.locator('button[aria-label="Close calendar item inspector"]:visible').first().click();
      const singleVolunteer = value(f.auth(`select public.create_manual_volunteer_profile(${q(f.ws)},${q(JSON.stringify({ fullName: 'Taylor Reed', email: `taylor-${f.ws}@example.invalid`, phone: '+12025550199' }))})`));
      await go(page, `/admin/calendar?view=week&date=${f.day}`);
      await page.getByRole('button', { name: /Published, Site preparation/ }).first().click();
      inspector = page.getByRole('dialog', { name: 'Calendar item inspector' });
      assert.equal(await inspector.getByLabel('Also assign on other dates').isChecked(), false);
      await inspector.getByLabel('Select Taylor Reed').check();
      await inspector.getByText(/1 new assignment/).waitFor();
      await inspector.getByRole('button', { name: 'Save assignments' }).click();
      await inspector.getByText(/Saved 1 assignment/).waitFor();
      assert.equal(value(`select count(*) from public.calendar_assignments where volunteer_profile_id=${q(singleVolunteer)} and calendar_item_id in (${f.items.map(q).join(',')})`), '1');
      if (await page.locator('button[aria-label="Close calendar item inspector"]:visible').count()) await page.locator('button[aria-label="Close calendar item inspector"]:visible').first().click();

      const createButton = page.getByRole('button', { name: width === 390 ? 'Create' : 'Create item', exact: true });
      await createButton.click();
      let create = page.getByRole('dialog', { name: 'Plan project work' });
      await create.getByLabel('Date', { exact: true }).fill(f.dayAt(10));
      await create.getByLabel('Task preset', { exact: true }).selectOption(f.preset);
      await create.getByLabel('Select Riley Chen').check();
      await create.getByText(/1 new assignment/).waitFor();
      assert.equal(await create.getByRole('button', { name: 'Create item' }).count(), 1);
      await create.getByRole('button', { name: 'Create item' }).click();
      await create.waitFor({ state: 'hidden' });
      assert.equal(value(`select count(*) from public.calendar_assignments a join public.calendar_items i on i.id=a.calendar_item_id where i.workspace_id=${q(f.ws)} and i.start_date=${q(f.dayAt(10))} and a.volunteer_profile_id=${q(f.volunteers[2])}`), '1');

      await createButton.click();
      create = page.getByRole('dialog', { name: 'Plan project work' });
      await create.getByRole('button', { name: 'Repeat', exact: true }).click();
      await create.getByLabel('Start date', { exact: true }).fill(f.dayAt(12));
      await create.getByLabel('End date', { exact: true }).fill(f.dayAt(13));
      await create.getByLabel('Task preset', { exact: true }).selectOption(f.preset);
      for (const day of ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']) {
        const button = create.getByRole('button', { name: day, exact: true });
        if (await button.getAttribute('aria-pressed') === 'false') await button.click();
      }
      await create.getByLabel('Select Riley Chen').check();
      await create.getByText('Adjust individual days (optional)').click();
      await create.getByLabel(/^Skip /).last().check();
      await create.getByText(/2 items · 1 volunteer · 1 new assignment/).waitFor();
      await create.getByText(/2 items · 1 volunteer · 1 new assignment/).scrollIntoViewIfNeeded();
      await capture(page, 'repeat-create-inspector');
      await create.getByRole('button', { name: 'Create 2 items' }).click();
      await create.waitFor({ state: 'hidden' });
      assert.equal(value(`select count(*) from public.calendar_items where workspace_id=${q(f.ws)} and start_date between ${q(f.dayAt(12))} and ${q(f.dayAt(13))} and publication_state='draft'`), '2');
      assert.equal(value(`select count(*) from public.calendar_assignments a join public.calendar_items i on i.id=a.calendar_item_id where i.workspace_id=${q(f.ws)} and i.start_date between ${q(f.dayAt(12))} and ${q(f.dayAt(13))} and a.volunteer_profile_id=${q(f.volunteers[2])}`), '1');

      await go(page, '/admin/dashboard');
      const attentionLink = page.getByRole('link', { name: /follow-ups? need(s)? review/ });
      if (await attentionLink.count()) {
        const count = Number((await attentionLink.innerText()).match(/^\d+/)?.[0]);
        await attentionLink.click();
        assert.equal(Number(await page.locator('header strong').first().textContent()), count, 'Overview count matches Needs Attention');
        await go(page, '/admin/dashboard');
      }
      await capture(page, 'overview');
      await go(page, '/admin/announcements');
      await capture(page, 'communications-welcome-tab');
      await page.getByRole('button', { name: 'Review recipients' }).click();
      await page.getByText(/volunteers awaiting this introduction/).waitFor();
      assert.equal(await page.getByText(/0 assignments · 0 new/).count(), 0);
      await capture(page, 'welcome-preview');
      await page.getByRole('button', { name: /Confirm send to \d+ recipients/ }).click();
      await page.getByText('Delivery details').first().waitFor();
      const historyDetails = page.getByText('Delivery details').first().locator('..');
      assert.equal(await historyDetails.locator('p').first().isVisible(), false, 'Email hidden until delivery details opens');
      await historyDetails.locator('summary').click();
      assert.equal(await historyDetails.locator('p').first().isVisible(), true, 'Email available on demand');
      await historyDetails.locator('summary').click();
      assert.equal(value(`select count(*) from public.communication_recipients r join public.communication_operations o on o.id=r.operation_id where r.workspace_id=${q(f.ws)} and o.kind='welcome' and r.state='sent'`), '4');
      await page.evaluate(() => window.scrollTo(0, 0));
      await capture(page, 'communications-history-tab');
      await page.getByRole('button', { name: 'Review resend' }).first().click();
      await page.evaluate(() => window.scrollTo(0, 0));
      await capture(page, 'communications-resend');
      await page.getByRole('tab', { name: 'Schedule deliveries' }).click();
      await capture(page, 'communications-schedule-tab');
      await go(page, `/admin/calendar?view=day&date=${f.day}`);
      await page.getByRole('link', { name: 'Send schedules' }).click();
      await page.waitForURL('**/admin/announcements?kind=schedule*');
      assert(page.url().includes(`from=${f.day}&through=${f.day}`), page.url());
      assert.equal(await page.getByLabel('From', { exact: true }).inputValue(), f.day);
      assert.equal(await page.getByLabel('Through', { exact: true }).inputValue(), f.day);
      await go(page, '/admin/volunteers');
      await page.waitForTimeout(1000);
      await page.getByRole('button', { name: 'Export CSV' }).click();
      assert.equal(await page.getByLabel('Include private date of birth and emergency fields').isChecked(), false);
      await page.getByLabel('Include private date of birth and emergency fields').check();
      await page.getByRole('button', { name: 'Close CSV' }).click();
      await page.getByRole('button', { name: 'Export CSV' }).click();
      assert.equal(await page.getByLabel('Include private date of birth and emergency fields').isChecked(), false);

      await go(volunteer, '/v/schedule');
      await volunteer.getByRole('button', { name: 'View weekly menu' }).click();
      await capture(volunteer, 'volunteer-weekly-menu-sheet');
      await volunteer.getByRole('button', { name: 'Close weekly menu' }).click();
      assert.equal(await volunteer.getByRole('button', { name: 'View weekly menu' }).evaluate(element => element === document.activeElement), true, 'Menu sheet restores focus');
      await volunteer.getByRole('button', { name: 'Add away period' }).click();
      const away = volunteer.locator('dialog[open]');
      await away.getByLabel('From', { exact: true }).fill(f.day);
      await away.getByLabel('Through', { exact: true }).fill(f.day);
      await away.getByRole('button', { name: 'Review away period' }).click();
      await away.getByText('1 existing assignment conflicts').waitFor();
      assert.equal(await away.getByRole('checkbox').count(), 0);
      await capture(volunteer, 'away-conflict-without-extra-ack');
      assert.deepEqual(errors, [], 'No browser errors');
      console.log(`PASS 12.47 UX ${width}px: unified existing/repeat/one-date assignment, communications, CSV, menu, away, no overflow/errors`);
    } finally { await context.close(); await volunteerContext.close(); await f.cleanup(); }
  }
} finally { await browser.close(); }
