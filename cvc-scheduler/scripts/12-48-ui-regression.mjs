import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import {chromium} from 'playwright';import {resolvePreviewBrowserExecutable} from './preview-config.mjs';
const output=path.resolve('..','previews','12.48-batch-1','after');fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({executablePath:resolvePreviewBrowserExecutable(),headless:true});
const context=await browser.newContext();await context.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const go=p=>page.goto('http://127.0.0.1:3148'+p,{waitUntil:'networkidle'});
const shot=(name,fullPage=true)=>page.screenshot({path:path.join(output,name+'.png'),fullPage});
const cookie=(name,value)=>context.addCookies([{name,value,domain:'127.0.0.1',path:'/'}]);
try{
 for(const width of [1440,1024,768,390,320]){
  await page.setViewportSize({width,height:width<500?844:1000});await go('/admin/dashboard');
  assert.equal(await page.getByRole('main').count(),1);assert.equal(await page.getByRole('heading',{level:1}).count(),1);
  await page.keyboard.press('Tab');assert.equal(await page.locator(':focus').textContent(),'Skip to main content');
  await page.keyboard.press('Enter');assert.equal(await page.locator(':focus').getAttribute('id'),'main-content');
  await page.keyboard.press('Tab');assert.match(await page.locator(':focus').textContent(),/New task/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  if(width===390){const up=await page.getByRole('region',{name:'Upcoming work'}).boundingBox(),bar=await page.getByRole('navigation',{name:'Primary admin navigation'}).boundingBox();assert(up.y<bar.y,'Next up heading reaches the first 390px viewport');}
  assert.equal(await page.getByRole('region',{name:'Quick actions'}).count(),0);
  assert.equal(await page.getByRole('link',{name:'New task',exact:true}).getAttribute('href'),'/admin/tasks?create=1');
  assert.equal(await page.getByRole('link',{name:/Lunch/}).first().innerText().then(t=>t.includes('0/0')),false);
  if(width<1024){
   const nav=page.getByRole('navigation',{name:'Primary admin navigation'});
   assert.deepEqual(await nav.getByRole('link').allTextContents(),['Overview','Calendar','Volunteers','Attention']);
   await page.getByRole('button',{name:'Open more admin navigation'}).click();const more=page.getByRole('dialog',{name:'More admin navigation'});await more.waitFor();
   for(const label of ['Task library','Communications','Project Quick View','Contact Guide']) await more.getByRole('link',{name:label,exact:true}).waitFor();
   await shot('more-'+width,false);await page.keyboard.press('Escape');await more.waitFor({state:'hidden'});
   assert.equal(await page.locator(':focus').getAttribute('aria-label'),'Open more admin navigation');
   await page.getByRole('button',{name:'Open more admin navigation'}).click();await more.getByRole('link',{name:'Task library',exact:true}).click();await page.waitForURL('**/admin/tasks');
   assert.equal(await page.getByRole('dialog',{name:'More admin navigation'}).count(),0);await go('/admin/dashboard');
  }
  await shot('overview-viewport-'+width,false);
  // Browser default font/text size doubled; rem-based layouts and bottom navigation reflow.
  await page.addStyleTag({content:'html {font-size:200% !important}'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'200% text reflow '+width);
  if(width>=1024){
   const aside=await page.locator('aside').boundingBox();
   const links=await page.locator('aside nav a').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {right:r.right,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth}}));
   assert(links.every(r=>r.right<=aside.x+aside.width&&r.scrollWidth<=r.clientWidth),'Sidebar labels must remain inside the sidebar at 200% text');
   assert(await page.locator('aside [aria-label^="Current project:"]').evaluate(e=>e.scrollHeight<=e.clientHeight),'Project context card contains its text at 200%');
   if(width===1440){const panels=await page.locator('main section[aria-label="Review summary"],main section[aria-label="Upcoming work"]').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().top));assert(panels[1]>panels[0]+100,'Overview stacks when 200% text leaves insufficient column width');}
  }
  if(width<1024){
   const nav=page.getByRole('navigation',{name:'Primary admin navigation'});
   const bounds=await nav.locator('a,button').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom}}));
   assert(bounds.every(r=>r.x>=0&&r.right<=width));
   if(width===320){assert.deepEqual(await nav.getByRole('link').allTextContents(),['Overview','Calendar']);const labels=await nav.locator('.pl-nav-label').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right}}));assert(labels.every((r,i)=>i===0||r.left>=labels[i-1].right),'Compact nav labels do not overlap');}
   const last=page.getByRole('main').getByRole('link').last();await last.focus();await last.scrollIntoViewIfNeeded();
   const lastBox=await last.boundingBox(),navBox=await nav.boundingBox();assert(lastBox.y+lastBox.height<=navBox.y,`Focused final action clear of nav: ${JSON.stringify({width,lastBox,navBox,scroll:await page.evaluate(()=>({y:scrollY,height:document.documentElement.scrollHeight,innerHeight}))})}`);
  }
  await page.evaluate(()=>scrollTo(0,0));await shot('overview-text-200-'+width,false);
  if(width<1024){
   await page.getByRole('button',{name:'Open more admin navigation'}).click();
   const close=page.getByRole('button',{name:'Close more admin navigation',exact:true});
   const rect=await close.boundingBox();assert(rect.x>=0&&rect.x+rect.width<=width&&rect.y>=0&&rect.y+rect.height<844,'More close reachable at 200% text');
   const more=page.getByRole('dialog',{name:'More admin navigation'});
   assert(await more.locator('a').evaluateAll(es=>es.every(e=>e.scrollWidth<=e.clientWidth)),'More labels must wrap at 200% text');
   const lastMore=more.getByRole('link',{name:'Contact Guide'});await lastMore.focus();await lastMore.scrollIntoViewIfNeeded();
   const reach=await lastMore.evaluate(e=>{const r=e.getBoundingClientRect(),s=e.closest('[data-overlay-scroll]').getBoundingClientRect();return r.top>=s.top&&r.bottom<=s.bottom});assert(reach,'Last More destination reachable by scrolling');
   await shot('more-text-200-'+width,false);await page.keyboard.press('Escape');
  }
  await go('/foundation');assert.equal(await page.getByText('Enter a task name.',{exact:true}).count(),0);
  await page.getByRole('button',{name:'Check form',exact:true}).click();
  assert.equal(await page.locator(':focus').getAttribute('id'),'task-name');
  assert.equal(await page.getByLabel('Task name (required)').getAttribute('aria-invalid'),'true');
  assert.match(await page.getByLabel('Task name (required)').getAttribute('aria-describedby'),/task-name-hint task-name-error/);
  await page.getByText('Choose at least one day.',{exact:true}).waitFor();await shot('form-validation-'+width);
  await page.getByLabel('Task name (required)').fill('Site preparation');await page.getByLabel('Monday').check();await page.getByRole('button',{name:'Check form',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'Checking…'}).isDisabled(),true);
  await cookie('fixture-empty','1');await go('/admin/dashboard');await shot('overview-empty-'+width);await cookie('fixture-empty','0');
  console.log('PASS: '+width+' navigation, More, skip/main, direct task creation route, empty, form associations/pending, 200% text.');
 }
 for(const role of ['main','assistant','on-site']){
  await cookie('fixture-role',role);await page.setViewportSize({width:1440,height:1000});await go('/admin/dashboard');
  const nav=page.getByRole('navigation',{name:'Workspace navigation'});
  assert.equal(await nav.getByRole('link',{name:'Communications',exact:true}).count(),role==='on-site'?0:1);
  await go('/admin/calendar?date=2026-10-05&view=list');
  assert.equal(await page.getByRole('button',{name:'Create item',exact:true}).count(),role==='on-site'?0:1);
  await go('/admin/quick-view?date=2026-10-05&view=list');
  assert.equal(await page.getByRole('button',{name:'Create item',exact:true}).count(),0);
  console.log('PASS: '+role+' capability-prop fixture navigation/edit affordances (not authenticated role proof).');
 }
 await cookie('fixture-role','main');await go('/admin/dashboard');
 // Delay a client navigation to verify that feedback preserves the current screen.
 let release;const held=new Promise(resolve=>{release=resolve;});let intercepted=false;
 const handler=async r=>{const u=new URL(r.request().url());if(u.pathname==='/admin/tasks'&&(u.searchParams.has('_rsc')||r.request().headers().rsc)){intercepted=true;await held;}await r.continue();};
 await page.route('**/*',handler);
 await page.getByRole('navigation',{name:'Workspace navigation'}).getByRole('link',{name:'Task library',exact:true}).click();
 await page.locator('[data-navigation-pending="true"]').first().waitFor();assert(intercepted);
 await page.getByRole('heading',{name:'Overview',exact:true}).waitFor();await shot('navigation-pending',false);release();await page.waitForURL('**/admin/tasks');await page.unroute('**/*',handler);await go('/admin/dashboard');
 const contrast=await page.evaluate(()=>{
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d',{willReadFrequently:true});
  const color=s=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=s;ctx.fillRect(0,0,1,1);const a=[...ctx.getImageData(0,0,1,1).data];return [a[0],a[1],a[2],a[3]/255]}; // Browser resolves Tailwind OKLCH/OKLAB into sRGB.
  const blend=(a,b)=>[0,1,2].map(i=>a[i]*a[3]+b[i]*(1-a[3]));
  const bg=e=>{if(!e)return [255,255,255];const c=color(getComputedStyle(e).backgroundColor);return blend(c,bg(e.parentElement));};
  const lum=c=>c.map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4).reduce((v,n,i)=>v+n*[.2126,.7152,.0722][i],0);
  return [...document.querySelectorAll('main *,aside *')].filter(e=>e.checkVisibility()&&[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())).map(e=>{const c=getComputedStyle(e), b=bg(e);const l=[lum(blend(color(c.color),b)),lum(b)].sort((a,b)=>b-a);return {text:e.textContent.trim().slice(0,45),ratio:(l[0]+.05)/(l[1]+.05)};});
 });
 assert(contrast.every(c=>c.ratio>=4.5),JSON.stringify(contrast.filter(c=>c.ratio<4.5)));
 fs.writeFileSync(path.join(output,'rendered-contrast.json'),JSON.stringify(contrast,null,2));
 await page.emulateMedia({reducedMotion:'reduce'});await go('/foundation');
 assert.equal(await page.locator('.animate-pulse').evaluate(e=>getComputedStyle(e).animationDuration),'1e-05s');
 assert.deepEqual(errors,[]);console.log('PASS: rendered informative text contrast >=4.5:1; reduced-motion; no page errors.');
}finally{await browser.close();}
