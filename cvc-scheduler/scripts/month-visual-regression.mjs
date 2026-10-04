import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { resolvePreviewBrowserExecutable } from './preview-config.mjs';

const phase = process.argv[2];
assert(['before', 'after'].includes(phase), 'Pass before or after');
const root = process.cwd();
const fixture = path.join(os.tmpdir(), 'project-local-12-48-fixture');
const output = path.resolve('..', 'previews', 'month-calendar-cleanup', phase);
fs.mkdirSync(output, { recursive: true });
execFileSync(process.execPath, ['scripts/12-48-preview.mjs'], { cwd: root, stdio: 'inherit' });
if (phase === 'before') fs.writeFileSync(path.join(fixture, 'components', 'CalendarClient.tsx'), execFileSync('git', ['show', '0f97bf36ef1b50b12ccba73edfe1d08d912b0fd8:cvc-scheduler/components/CalendarClient.tsx'], { cwd: root }));
const fixtureFile = path.join(fixture, 'fixture.ts');
let source = fs.readFileSync(fixtureFile, 'utf8');
assert(source.includes('  items,canEdit:!readOnly'), 'Calendar fixture shape changed');
source = source.replace('  items,canEdit:!readOnly', '  items:denseMonthItems,canEdit:!readOnly');
source += `
const denseMonthItems = [
  ...([
    ['2026-10-05','Kitchen Attendant AM','orange',2,3],
    ['2026-10-05','Gate Attendant','blue',3,3],
    ['2026-10-05','Electrical Demo','violet',1,4],
    ['2026-10-05','General Help','emerald',2,5],
    ['2026-10-05','Kitchen Attendant PM','coral',0,3],
    ['2026-10-05','Site Safety Briefing','slate',4,4],
    ['2026-10-05','Materials Sorting','yellow',1,3],
    ['2026-10-05','Night Watch','indigo',1,2],
    ['2026-10-06','Kitchen Attendant AM','orange',2,3],
    ['2026-10-06','Gate Attendant','blue',1,3],
    ['2026-10-06','General Help','emerald',4,5],
    ['2026-10-06','Window Framing','teal',2,4],
    ['2026-10-06','Drywall Preparation','violet',0,3],
    ['2026-10-06','Night Watch','indigo',2,2],
    ['2026-10-07','Electrical Demo','violet',3,4],
    ['2026-10-07','Kitchen Attendant PM','coral',2,3],
    ['2026-10-07','Gate Attendant','blue',2,3],
    ['2026-10-07','General Help','emerald',5,5],
    ['2026-10-07','Equipment Setup','slate',1,2],
    ['2026-10-08','Kitchen Attendant AM','orange',1,3],
    ['2026-10-08','Gate Attendant','blue',3,3],
    ['2026-10-08','General Help','emerald',0,5],
    ['2026-10-08','Electrical Demo','violet',2,4],
    ['2026-10-08','Night Watch','indigo',0,2],
    ['2026-10-09','Kitchen Attendant PM','coral',2,3],
    ['2026-10-09','Materials Sorting','yellow',2,3],
    ['2026-10-09','General Help','emerald',3,5],
    ['2026-10-09','Gate Attendant','blue',3,3],
    ['2026-10-09','Night Watch','indigo',1,2],
    ['2026-10-12','Gate Attendant','blue',2,3],
    ['2026-10-14','Kitchen Attendant AM','orange',1,3],
    ['2026-10-16','General Help','emerald',3,5],
    ['2026-10-20','Electrical Demo','violet',3,4],
    ['2026-10-20','Gate Attendant','blue',3,3],
    ['2026-10-22','Window Framing','teal',2,4],
    ['2026-10-23','Community Materials Intake and Safety Check','slate',1,3],
    ['2026-10-23','Gate Attendant','blue',2,3],
    ['2026-10-23','General Help','emerald',3,5],
    ['2026-10-23','Night Watch','indigo',1,2],
    ['2026-10-23','Materials Sorting','yellow',2,3],
    ['2026-10-26','Site Safety Briefing','slate',4,4],
    ['2026-10-29','Kitchen Attendant AM','orange',2,3],
  ] as const).map(([date,title,colorKey,filledCount,neededCount],index)=>({
    ...items[2],id:'77777777-7777-4777-8777-'+String(index+1).padStart(12,'0'),
    date,displayName:title,colorKey,filledCount,neededCount,
    oneOffTask:{...items[2].oneOffTask,name:title,neededCount},
    startTimeValue:title.startsWith('Community Materials')?'06:00':index%3===0?'07:30':index%3===1?'09:00':'13:00',
    startTime:title.startsWith('Community Materials')?'6:00 AM':index%3===0?'7:30 AM':index%3===1?'9:00 AM':'1:00 PM',
    endTimeValue:index%3===0?'11:30':index%3===1?'12:00':'17:00',
    endTime:index%3===0?'11:30 AM':index%3===1?'12:00 PM':'5:00 PM',
    publicationState:index===21?'draft':'published',
  })),
  ...([
    ['2026-10-05','breakfast',45],['2026-10-05','lunch',60],
    ['2026-10-06','lunch',55],['2026-10-07','breakfast',42],
    ['2026-10-08','lunch',58],['2026-10-09','lunch',62],
    ['2026-10-14','lunch',30],
  ] as const).map(([date,kind,total],index)=>({
    ...items[kind==='breakfast'?0:1],id:'88888888-8888-4888-8888-'+String(index+1).padStart(12,'0'),
    date,displayName:kind==='breakfast'?'Breakfast':'Lunch',
    meal:{...items[kind==='breakfast'?0:1].meal!,kind,total},
  })),
];
`;
fs.writeFileSync(fixtureFile, source);
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/(SUPABASE|RESEND|EMAIL|TRANSPORT|TOKEN|SECRET)/i.test(key)));
Object.assign(env, { NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:1', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture-only', ADMIN_AUTH_MODE: 'enforced', ASSIGNMENT_NOTIFICATION_EMAIL_TRANSPORT: '' });
const server = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', '3153'], { cwd: fixture, env, stdio: 'ignore', windowsHide: true });
const base = 'http://127.0.0.1:3153';
async function waitForServer() { for (let n = 0; n < 90; n++) { try { if ((await fetch(base + '/admin/calendar?view=month&date=2026-10-05')).ok) return; } catch {} await new Promise(resolve => setTimeout(resolve, 1000)); } throw new Error('Fixture server did not start'); }
const browser = await chromium.launch({ headless: true, executablePath: resolvePreviewBrowserExecutable() });
try {
  await waitForServer();
  for (const width of [1440, 1024, 1920]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/admin/calendar?view=month&date=2026-10-05', { waitUntil: 'networkidle' });
    const month = page.locator('[data-calendar-arrow-group="month-dates"]');
    await month.getByRole('button', { name: /Kitchen Attendant AM/ }).first().waitFor();
    const shot = name => page.screenshot({ path: path.join(output, `${width}-${name}.png`), fullPage: true });
    await shot('dense-month');
    const cell = date => page.locator(`[data-calendar-month-cell="${date}"]`);
    const rowShot = async (date, name) => {
      const first = await cell(date).boundingBox();
      assert(first);
      await page.screenshot({ path: path.join(output, `${width}-${name}.png`), clip: { x: first.x, y: first.y, width: first.width * 7, height: first.height } });
    };
    await rowShot('2026-10-12', 'sparse-week');
    await rowShot('2026-10-05', 'heavy-week');
    const target = cell('2026-10-05').getByRole('button', { name: /Kitchen Attendant AM/ });
    await target.hover();
    await target.focus();
    await rowShot('2026-10-05', 'hover-focus');
    const more = cell('2026-10-05').getByRole('button', { name: /more calendar items/ });
    assert(await more.isVisible(), 'overflow affordance visible');
    await rowShot('2026-10-05', 'overflow');
    if (phase === 'after') {
      const buttons = cell('2026-10-05').getByRole('button', { name: /volunteers|Headcount|Draft awaiting review/ });
      const expectedCapacity = width === 1024 ? 2 : width === 1440 ? 3 : 4;
      assert.equal(Number(await cell('2026-10-05').getAttribute('data-calendar-month-capacity')), expectedCapacity, `${width}px Month capacity`);
      assert.equal(await buttons.count(), expectedCapacity, `${width}px dense day shows its readable event capacity`);
      const cellHeight = (await cell('2026-10-05').boundingBox()).height;
      assert(cellHeight <= 145, `${width}px Month cell keeps its existing height (measured ${cellHeight}px)`);
      assert.equal(Number(await cell('2026-10-23').getAttribute('data-calendar-month-capacity')), width === 1920 ? 3 : 2, `${width}px long title reduces capacity rather than truncating`);
      if (width !== 1024) {
        const longTitle = await cell('2026-10-23').getByRole('button', { name: /Community Materials Intake and Safety Check/ }).locator('[data-calendar-month-title]').evaluate(element => ({ height: element.scrollHeight, visibleHeight: element.clientHeight }));
        assert(longTitle.height <= longTitle.visibleHeight + 1, `${width}px long title remains readable`);
      }
      for (const [date, name] of [['2026-10-05', 'Kitchen Attendant AM'], ['2026-10-05', 'General Help'], ['2026-10-07', 'Kitchen Attendant PM'], ['2026-10-08', 'Electrical Demo'], ['2026-10-09', 'Gate Attendant']]) {
        const title = await cell(date).getByRole('button', { name: new RegExp(name) }).locator('[data-calendar-month-title]').evaluate(element => ({ width: element.scrollWidth, client: element.clientWidth, height: element.scrollHeight, visibleHeight: element.clientHeight }));
        assert(title.width <= title.client + 1 && title.height <= title.visibleHeight + 1, `${name} is fully readable at ${width}px`);
      }
      assert.equal(await cell('2026-10-05').locator('button[style*="border-color"]').count(), 0, 'no colored row borders');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'no tablet/desktop overflow');
      await more.click();
      await page.waitForURL(/view=day/);
    }
    assert.deepEqual(errors, [], 'no browser errors');
    console.log(`PASS ${phase} ${width}: dense month, sparse/heavy weeks, focus, overflow${phase === 'after' ? ', Day navigation and readability' : ''}`);
    await context.close();
  }
} finally { await browser.close(); server.kill(); }
