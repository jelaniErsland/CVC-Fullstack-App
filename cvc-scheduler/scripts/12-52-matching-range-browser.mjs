import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { resolvePreviewBrowserExecutable } from './preview-config.mjs';

const root = process.cwd();
const fixture = path.join(os.tmpdir(), 'project-local-12-48-fixture');
const output = path.resolve('..', 'previews', '12.52-matching-dates');
fs.mkdirSync(output, { recursive: true });
execFileSync(process.execPath, ['scripts/12-48-preview.mjs'], { cwd: root, stdio: 'inherit' });
const route = path.join(fixture, 'app', 'admin', 'range-1252', 'page.tsx');
fs.mkdirSync(path.dirname(route), { recursive: true });
fs.writeFileSync(route, `
import { AdminShell } from '@/components/AdminShell';
import { BulkAssignmentPlanner } from '@/components/BulkAssignmentPlanner';
import { destinations } from '@/fixture';
const id=(n:number)=>'55555555-5555-4555-8555-'+String(n).padStart(12,'0');
const matches=[
  {id:id(11),date:'2026-10-31',endDate:'2026-11-01',title:'Night Watch',startTime:'17:00',endTime:'05:00'},
  {id:id(12),date:'2026-11-01',endDate:'2026-11-02',title:'Night Watch',startTime:'17:00',endTime:'05:00'},
  {id:id(13),date:'2026-11-20',endDate:'2026-11-21',title:'Night Watch',startTime:'17:00',endTime:'05:00'},
  {id:id(14),date:'2026-12-03',endDate:'2026-12-04',title:'Night Watch',startTime:'17:00',endTime:'05:00'},
];
async function matchingDates(form:FormData){
  'use server';
  const month=String(form.get('month'));
  if(form.get('sourceId')!==id(10)||form.get('sourceDate')!=='2026-10-05')return {kind:'unavailable' as const};
  return {kind:'ready' as const,month,items:matches.filter(item=>item.date.startsWith(month)),nextCursor:month==='2026-12'?null:{month:month==='2026-10'?'2026-11':'2026-12',offset:0}};
}
async function preview(form:FormData){
  'use server';
  const plan=JSON.parse(String(form.get('plan')||'{}'));
  const selected=plan.itemIds.map((itemId:string)=>itemId===id(10)?{id:id(10),date:'2026-10-05',endDate:'2026-10-06',title:'Night Watch',startTime:'17:00',endTime:'05:00'}:matches.find(item=>item.id===itemId));
  return {kind:'preview' as const,preview:{saved:false as const,fingerprint:'fixture',items:selected.map((item:any)=>({...item,neededCount:4,assignedCount:0,publication:'published'})),volunteers:plan.volunteers.map((person:{id:string})=>({id:person.id,name:'Halli Johnson',version:'fixture'})),existingAssignments:[],sameDayWork:[]}};
}
export default async function Page(){
  return <AdminShell active="calendar" destinations={await destinations()} workspaceName="Community remodel · Fixture"><main className="mx-auto max-w-2xl px-3 py-5 sm:px-6"><h1 className="text-2xl font-bold">Assign across project dates</h1><p className="mt-1 text-sm text-slate-600">Synthetic October–December work. Nothing is saved or sent.</p><BulkAssignmentPlanner action={preview} matchingItemsAction={matchingDates} volunteers={[{id:id(1),displayName:'Halli Johnson',congregation:'Belgrade',lifecycle:'active',readinessStatus:'ready'}]} primaryItem={{id:id(10),date:'2026-10-05',endDate:'2026-10-06',title:'Night Watch',startTime:'17:00',endTime:'05:00'}} /></main></AdminShell>;
}
`);
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/(SUPABASE|RESEND|EMAIL|TRANSPORT|TOKEN|SECRET)/i.test(key)));
Object.assign(env, { NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:1', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture-only', ADMIN_AUTH_MODE: 'enforced', ASSIGNMENT_NOTIFICATION_EMAIL_TRANSPORT: '' });
const server = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', '3154'], { cwd: fixture, env, stdio: 'ignore', windowsHide: true });
const base = 'http://127.0.0.1:3154';
async function waitForServer() { for (let n = 0; n < 90; n++) { try { if ((await fetch(base + '/admin/range-1252')).ok) return; } catch {} await new Promise(resolve => setTimeout(resolve, 1000)); } throw new Error('Fixture server did not start'); }
const browser = await chromium.launch({ headless: true, executablePath: resolvePreviewBrowserExecutable() });
try {
  await waitForServer();
  for (const [label, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/admin/range-1252', { waitUntil: 'networkidle' });
    const picker = page.getByRole('region', { name: 'Assign volunteers' });
    await picker.getByRole('checkbox', { name: 'Also assign on other dates' }).check();
    await picker.getByRole('heading', { name: 'October 2026' }).waitFor();
    await picker.getByRole('checkbox', { name: /Oct 31.*Night Watch/ }).check();
    await picker.getByRole('button', { name: 'Load more dates' }).click();
    await picker.getByRole('heading', { name: 'November 2026' }).waitFor();
    await picker.getByRole('checkbox', { name: /Nov 1.*Night Watch/ }).check();
    await picker.getByRole('button', { name: 'Load more dates' }).click();
    await picker.getByRole('heading', { name: 'December 2026' }).waitFor();
    await picker.getByRole('checkbox', { name: /Dec 3.*Night Watch.*Dec 4/ }).check();
    assert(await picker.getByText('3 additional dates selected').isVisible());
    assert(await picker.getByRole('checkbox', { name: /Oct 31.*Night Watch/ }).isChecked());
    assert(await picker.getByRole('checkbox', { name: /Nov 1.*Night Watch/ }).isChecked());
    await picker.getByRole('checkbox', { name: 'Select Halli Johnson from Belgrade' }).check();
    await picker.getByText(/4 selected items/).first().waitFor();
    await picker.getByText('Reached the project end date.').waitFor();
    await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); });
    await page.addStyleTag({ content: '.skip-link { visibility: hidden !important }' });
    if (label === 'mobile') await page.evaluate(() => window.scrollTo(0, 180));
    else await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(output, `${label}-three-months.png`), fullPage: label === 'desktop' });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'no horizontal overflow');
    assert.deepEqual(errors, []);
    console.log(`PASS ${label}: Oct/Nov/Dec selection retained, overnight date, bounded month loading, layout`);
    await context.close();
  }
} finally { await browser.close(); server.kill(); }
