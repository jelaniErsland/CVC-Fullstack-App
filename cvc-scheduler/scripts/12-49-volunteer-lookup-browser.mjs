import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { fixture, q, value } from './12-47-local-fixtures.mjs';
import { resolvePreviewBrowserExecutable } from './preview-config.mjs';
const settings={API_URL:process.env.NEXT_PUBLIC_SUPABASE_URL,ANON_KEY:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY};
assert(settings.API_URL&&settings.ANON_KEY,'Local API settings unavailable.');
const f=await fixture();
const base='http://127.0.0.1:3107';
let server=null,browser=null;
try{
  const shared=`household-${f.ws}@example.invalid`;
  value(`update public.volunteer_profiles set email=${q(shared)} where id in (${q(f.volunteers[0])},${q(f.volunteers[1])})`);
  const night=value(f.auth(`select public.create_calendar_item(${q(f.ws)},null,'Night Watch','security','timed',${q(f.dayAt(4))},${q(f.dayAt(5))},'17:00','05:00',1,null,'{}')`));
  value(f.auth(`select public.create_calendar_assignment(${q(night)},${q(f.volunteers[0])},null)`));
  server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p','3107'],{cwd:process.cwd(),env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:settings.API_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY:settings.ANON_KEY},windowsHide:true,stdio:'ignore'});
  let ready=false;
  for(let attempt=0;attempt<40;attempt++){
    if(server.exitCode!==null) break;
    try{const response=await fetch(base,{signal:AbortSignal.timeout(1000)});if(response.ok){ready=true;break;}}catch{}
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  assert(ready,'Local Next server did not start.');
  const leaveProbe=await fetch(`${base}/v/leave`,{method:'POST',headers:{origin:base,'content-type':'application/x-www-form-urlencoded'},body:'mode=switch',redirect:'manual'});
  assert.equal(leaveProbe.status,303,'Switch route must return a local redirect.');
  assert.equal(leaveProbe.headers.get('location'),`${base}/?switch=1`);
  browser=await chromium.launch({headless:true,executablePath:resolvePreviewBrowserExecutable()});
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const page=await context.newPage();
  await page.goto(base);
  await page.getByLabel('Email or phone number').fill(shared);
  await page.getByRole('button',{name:'Open schedule'}).click();
  await page.getByRole('heading',{name:'Who are you?'}).waitFor();
  await page.getByRole('button',{name:/Alex Morgan/}).click();
  await page.waitForURL('**/v/schedule');
  await page.getByText('Welcome, Alex.').waitFor();
  await page.getByRole('button',{name:'View full schedule'}).click();
  await page.getByText('Night Watch').first().waitFor();
  await page.goto(base);
  await page.waitForURL('**/v/schedule');
  await page.getByText('Welcome, Alex.').waitFor();
  const [switchResponse]=await Promise.all([page.waitForResponse(response=>response.url().includes('/v/leave')),page.getByRole('button',{name:'Switch volunteer or project'}).click()]);
  assert.equal(switchResponse.status(),303,'Switch submission failed.');
  await page.waitForURL('**/?switch=1');
  await page.getByLabel('Email or phone number').fill(shared);
  await page.getByRole('button',{name:'Open schedule'}).click();
  await page.getByRole('button',{name:/Casey Jordan/}).click();
  await page.waitForURL('**/v/schedule');
  await page.getByText('Welcome, Casey.').waitFor();
  await page.getByRole('button',{name:'Forget this device'}).click();
  await page.waitForURL('**/?forgot=1');
  const cookiesBeforeReload=await context.cookies(base);
  assert(!cookiesBeforeReload.some(cookie=>cookie.name==='pl-volunteer-schedule'&&cookie.value),`Remembered cookie remained at paths: ${cookiesBeforeReload.filter(cookie=>cookie.name==='pl-volunteer-schedule').map(cookie=>cookie.path).join(',')}`);
  await page.reload();
  await page.getByLabel('Email or phone number').waitFor();
  const cookies=await context.cookies(base);
  assert(!cookies.some(cookie=>cookie.name==='pl-volunteer-schedule'&&cookie.value),'Forget clears the remembered volunteer.');
  console.log('PASS browser: shared-contact chooser, Night Watch schedule, remembered home redirect, switch volunteer, and forget device on mobile viewport.');
}finally{
  if(browser) await browser.close();
  if(server) server.kill();
  await f.cleanup();
}
