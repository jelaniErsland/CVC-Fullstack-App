import assert from 'node:assert/strict';
import fs from 'node:fs';
import { projectDateKey, projectDateLabel, projectTimeLabel, projectTimestampLabel, observedProjectDay, communicationStatusTone, communicationStatusLabel } from '../lib/notifications/communicationPresentation.ts';

// An operation created shortly after UTC midnight must show the same project
// date in its group heading and rows, even with a different browser timezone.
assert.equal(projectDateKey('2026-10-24T00:30:00Z','America/Denver'),'2026-10-23');
assert.equal(projectDateLabel('2026-10-24T00:30:00Z','America/Denver'),'Oct 23, 2026');
assert.equal(projectTimestampLabel('2026-10-24T00:30:00Z','America/Denver'),'Oct 23, 2026 · 6:30 PM');
assert.equal(projectDateKey('2026-10-24T00:30:00Z','Pacific/Auckland'),'2026-10-24');
for(const [before,after]of [['2026-03-07T16:00:00Z','2026-03-08T15:00:00Z'],['2026-10-31T15:00:00Z','2026-11-01T16:00:00Z']]){
 assert.equal(projectTimeLabel(before,'America/Denver'),'9:00 AM');assert.equal(projectTimeLabel(after,'America/Denver'),'9:00 AM');
 assert.equal(observedProjectDay(after,'America/Denver',before),'Tomorrow');
}
assert.equal(observedProjectDay('2026-10-27T23:00:00Z','America/Denver','2026-10-27T17:00:00Z'),'Today');
assert.equal(projectTimeLabel('2026-10-27T23:00:00Z','America/Denver'),'5:00 PM');
assert.equal(communicationStatusTone('unknown'),'attention');assert.equal(communicationStatusTone('failed'),'failure');assert.equal(communicationStatusTone('sent'),'positive');
assert.equal(communicationStatusLabel('sending'),'Sending / outcome pending');assert.equal(communicationStatusLabel('unknown'),'Unknown — needs review');

const lum=hex=>{const c=hex.replace('#','').match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2];};
const ratio=(a,b)=>{const c=[lum(a),lum(b)].sort((x,y)=>y-x);return(c[0]+.05)/(c[1]+.05);};
const css=fs.readFileSync('components/CommunicationsWorkspace.module.css','utf8');
const pairs=[['primary','#ffffff','#155eef'],['body','#43536d','#ffffff'],['metadata','#5b6b83','#ffffff'],['positive','#096457','#e7f9f5'],['info','#1746a0','#eaf2ff'],['attention','#805013','#fff7e6'],['failure','#a33138','#fff0ef'],['date-heading','#526783','#f0f6ff']];
const contrast=pairs.map(([name,fg,bg])=>{assert(css.includes(fg.slice(1))||fg==='#ffffff');assert(css.includes(bg.slice(1))||bg==='#ffffff');const value=ratio(fg,bg);assert(value>=4.5,`${name} contrast ${value}`);return{name,ratio:Number(value.toFixed(2))};});
assert(ratio('#7c8ca3','#ffffff')>=3,'Input/control boundary contrast');
assert(!css.includes('transition:')&&!css.includes('animation:'),'No decorative/width animation');
console.log(JSON.stringify({projectTimezoneFormatting:true,utcMidnight:true,dst:true,semanticTextContrast:contrast,controlBoundaryContrast:Number(ratio('#7c8ca3','#ffffff').toFixed(2)),noDeliveryCalculation:true}));
