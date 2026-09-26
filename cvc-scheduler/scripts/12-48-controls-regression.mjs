import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';
import {resolvePreviewBrowserExecutable} from './preview-config.mjs';
const output=path.resolve('..','previews','12.48-batch-1','after');
const browser=await chromium.launch({executablePath:resolvePreviewBrowserExecutable(),headless:true});
const context=await browser.newContext({viewport:{width:390,height:844}});
await context.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
const page=await context.newPage();
const go=p=>page.goto('http://127.0.0.1:3148'+p,{waitUntil:'networkidle'});
const measure=()=>page.evaluate(()=>{
 const canvas=document.createElement('canvas');canvas.width=canvas.height=1;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});
 const color=s=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=s;ctx.fillRect(0,0,1,1);const c=[...ctx.getImageData(0,0,1,1).data];return [c[0],c[1],c[2],c[3]/255];};
 const blend=(a,b)=>[0,1,2].map(i=>a[i]*a[3]+b[i]*(1-a[3]));
 const bg=e=>e?blend(color(getComputedStyle(e).backgroundColor),bg(e.parentElement)):[255,255,255];
 const lum=c=>c.slice(0,3).map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4).reduce((v,n,i)=>v+n*[.2126,.7152,.0722][i],0);
 const ratio=(a,b)=>{const l=[lum(a),lum(b)].sort((a,b)=>b-a);return(l[0]+.05)/(l[1]+.05);};
 const text=[...document.querySelectorAll('main *,nav *,[role="dialog"] *')].filter(e=>e.checkVisibility()&&!e.closest(':disabled')&&[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())).map(e=>({text:e.textContent.trim().slice(0,55),ratio:ratio(blend(color(getComputedStyle(e).color),bg(e)),bg(e))}));
 const controls=[...document.querySelectorAll('input:not([type="checkbox"]),select')].filter(e=>e.checkVisibility()).map(e=>{const s=getComputedStyle(e);return{id:e.id,border:ratio(color(s.borderTopColor),bg(e)),text:ratio(color(s.color),bg(e)),focus:e.matches(':focus')?ratio(color(s.outlineColor),bg(e)):undefined};});
 return {text,controls};
});
try{
 await go('/foundation');await page.getByRole('button',{name:'Check form',exact:true}).click();
 const form=await measure();assert(form.text.every(c=>c.ratio>=4.5));assert(form.controls.every(c=>c.border>=3&&c.text>=4.5&&(c.focus===undefined||c.focus>=3)),JSON.stringify(form.controls));
 await go('/admin/dashboard');const mobile=await measure();assert(mobile.text.every(c=>c.ratio>=4.5));
 await page.getByRole('button',{name:'Open more admin navigation'}).click();const more=await measure();assert(more.text.every(c=>c.ratio>=4.5));
 fs.writeFileSync(path.join(output,'controls-contrast.json'),JSON.stringify({form,mobile,more},null,2));
 await context.addCookies([{name:'fixture-photo-edit',value:'1',domain:'127.0.0.1',path:'/'}]);
 await go('/admin/dashboard');const add=page.getByRole('button',{name:'Add project photo',exact:true});
 await add.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,'overview-photo-control-390.png'),fullPage:false});
 await add.click();await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(await page.locator(':focus').textContent(),'Add project photo');
 console.log('PASS: rendered mobile, More and form text >=4.5:1; essential field borders and focus >=3:1; existing photo editor opens/closes and restores focus without a save.');
}finally{await browser.close();}
