import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { resolvePreviewBrowserExecutable } from './preview-config.mjs';

const root = process.cwd();
const fixture = path.join(os.tmpdir(), 'project-local-12-48-fixture');
const output = path.resolve('..', 'previews', '12.51b-overnight-ux');
fs.mkdirSync(output, { recursive: true });
execFileSync(process.execPath, ['scripts/12-48-preview.mjs'], { cwd: root, stdio: 'inherit' });
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/(SUPABASE|RESEND|EMAIL|TRANSPORT|TOKEN|SECRET)/i.test(key)));
Object.assign(env, { NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:1', NEXT_PUBLIC_SUPABASE_ANON_KEY:'fixture-only', ADMIN_AUTH_MODE:'enforced', ASSIGNMENT_NOTIFICATION_EMAIL_TRANSPORT:'' });
const server = spawn(process.execPath, [path.join(root,'node_modules/next/dist/bin/next'),'dev','--webpack','--hostname','127.0.0.1','--port','3152'], { cwd:fixture, env, stdio:'ignore', windowsHide:true });
const base = 'http://127.0.0.1:3152';
async function waitForServer() {
  for (let attempt=0; attempt<90; attempt++) {
    try { if ((await fetch(base+'/admin/calendar?view=day&date=2026-10-05')).ok) return; } catch {}
    await new Promise(resolve=>setTimeout(resolve,1000));
  }
  throw new Error('Isolated Calendar fixture did not start');
}

const browser = await chromium.launch({headless:true,executablePath:resolvePreviewBrowserExecutable()});
try {
  await waitForServer();
  for (const [label,width,height] of [['desktop',1440,900],['mobile',390,844]]) {
    const context = await browser.newContext({viewport:{width,height},deviceScaleFactor:1});
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error=>errors.push(error.message));
    await page.goto(base+'/admin/calendar?view=day&date=2026-10-05',{waitUntil:'networkidle'});
    await page.getByRole('button',{name:label==='mobile'?'Create':'Create item',exact:true}).filter({visible:true}).first().click();
    const panel = page.getByRole('dialog',{name:'Plan project work'}).filter({visible:true});
    const start = panel.getByLabel('Start',{exact:true});
    const end = panel.getByLabel('End',{exact:true});
    const endDay = panel.getByRole('group',{name:'End day'});
    const endDate = panel.locator('input[name="endDate"]');
    const shot = async name => {
      await endDay.scrollIntoViewIfNeeded();
      await page.screenshot({path:path.join(output,`${label}-${name}.png`)});
    };
    assert.equal(await endDate.inputValue(),'2026-10-05');
    assert.equal(await endDay.getByRole('button',{name:'Same day'}).getAttribute('aria-pressed'),'true');
    await shot('same-day');

    await start.fill('19:00');
    await end.fill('05:00');
    assert.equal(await endDate.inputValue(),'2026-10-06');
    await panel.getByText('5:00 AM · Next day').waitFor();
    await shot('overnight-next-day');

    await endDay.getByRole('button',{name:'Next day'}).click();
    assert.equal(await endDay.getByRole('button',{name:'Next day'}).getAttribute('aria-pressed'),'true');
    await shot('explicit-next-day');

    await endDay.getByRole('button',{name:'Later date'}).click();
    await panel.getByLabel('Specific end date').fill('2026-10-09');
    assert.equal(await endDate.inputValue(),'2026-10-09');
    assert.equal(await endDay.getByRole('button',{name:'Later date'}).getAttribute('aria-pressed'),'true');
    await shot('later-date');

    await endDay.getByRole('button',{name:'Next day'}).click();
    await end.fill('21:00');
    assert.equal(await endDate.inputValue(),'2026-10-05','time change clears stale next-day end date');
    assert.equal(await endDay.getByRole('button',{name:'Same day'}).getAttribute('aria-pressed'),'true');
    await panel.getByText('9:00 PM · Same day').waitFor();
    await shot('back-to-same-day');

    await end.fill('19:00');
    assert.equal(await endDate.inputValue(),'2026-10-05','equal times remain same-day and invalid');
    assert.equal(await panel.getByRole('button',{name:'Create item'}).isDisabled(),true);
    await end.fill('05:00');
    await panel.getByRole('button',{name:'Repeat'}).click();
    assert.equal(await panel.locator('input[name="endDayOffset"]').inputValue(),'1','repeat carries the overnight offset');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'no horizontal overflow');
    if (label==='mobile') assert(await page.getByRole('navigation',{name:'Primary admin navigation'}).isVisible());
    assert.deepEqual(errors,[],'no browser exceptions');
    await context.close();
    console.log(`PASS: ${label} same-day, automatic/explicit next day, later date, reset, equal times, repeat, layout`);
  }
} finally {
  await browser.close();
  server.kill();
}
