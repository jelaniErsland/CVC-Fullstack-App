import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

async function ready(page, pathname, title) {
  await page.waitForURL(url => url.pathname === pathname);
  try { await page.getByRole('heading', { name: title, exact: true }).waitFor(); } catch (error) { console.error(JSON.stringify({ expected: String(title), state: await page.evaluate(() => ({ path:location.pathname, headings:[...document.querySelectorAll('h1')].map(n => ({text:n.textContent,visible:n.getClientRects().length})), handoff:document.querySelector('[data-admin-client-handoff]')?.outerHTML.slice(0,400), dialog:[...document.querySelectorAll('dialog[open]')].map(n=>n.getAttribute('aria-label')) })) })); throw error; }
  await page.waitForFunction(() => ![...document.querySelectorAll('[data-admin-client-handoff], [data-admin-route-loading]')].some(n => n.getClientRects().length));
}
async function unfocus(page) { await page.locator('#main-content').focus(); }
async function go(page, key, pathname, title) {
  console.log('Shortcut G ' + key + ' → ' + pathname); await unfocus(page); await page.keyboard.press('g');
  if (typeof title === 'string' && !pathname.includes('quick-view')) await page.evaluate(({key,title}) => {
    window.__goTiming = null;
    const measure = event => {
      if (event.key !== key) return;
      document.removeEventListener('keydown',measure,true);
      const start = performance.now(); requestAnimationFrame(() => { window.__goTiming = {acknowledgementFrameMs:performance.now()-start,destinationFrame:[...document.querySelectorAll('main h1')].some(n=>n.getClientRects().length&&n.textContent===title)}; });
    }; document.addEventListener('keydown',measure,true);
  },{key,title});
  await page.keyboard.press(key);
  await ready(page, pathname, title);
  if (typeof title === 'string' && !pathname.includes('quick-view')) console.log(JSON.stringify({shortcut:key,...await page.evaluate(()=>window.__goTiming)}));
}
async function open(page, query = '') {
  await page.keyboard.press('Control+k');
  await page.getByRole('dialog', { name: 'Command palette', exact: true }).waitFor();
  await page.getByRole('combobox', { name: 'Search commands' }).fill(query);
}

export async function verifyAdminCommands(page, { partial = false, mobile = false } = {}) {
  const palette = page.getByRole('dialog', { name: 'Command palette', exact: true });
  const trigger = page.getByRole('button', { name: 'Open command palette', exact: true }).filter({ visible: true });
  const network = [];
  const record = request => { if (request.method() === 'POST' || request.headers().rsc) network.push(request.url()); };
  await page.waitForLoadState('networkidle');
  page.on('request', record);
  const started = await page.evaluate(() => {
    window.__commandTiming = null;
    document.addEventListener('keydown', function measure(event) {
      if (!event.ctrlKey || event.key !== 'k') return;
      const start = performance.now();
      document.removeEventListener('keydown', measure, true); requestAnimationFrame(() => { window.__commandTiming = performance.now() - start; });
    }, true);
    return performance.now();
  });
  assert(Number.isFinite(started));
  await open(page);
  assert(await page.getByRole('combobox', { name: 'Search commands' }).evaluate(n => n === document.activeElement));
  assert.equal(await palette.getByRole('option', { name: /Go to Calendar/ }).count(), 1);
  if (partial) {
    for (const label of ['Create Calendar item', 'Assign volunteers', 'Add volunteer', 'Send schedules / Communications']) assert.equal(await palette.getByRole('option', { name: new RegExp(label) }).count(), 0);
    assert.equal(await palette.getByRole('option', { name: /Go to Volunteers/ }).count(), 0);
    await page.keyboard.press('Escape');
    await go(page, 'v', '/admin/dashboard', 'Overview');
    console.log('Restricted workflow commands and forbidden G V are absent/inert; permitted read-only Calendar remains available.');
    page.off('request', record);
    return;
  }
  for (const query of ['cal', 'clndr', 'vol', 'attention', 'send', 'task']) {
    await page.getByRole('combobox', { name: 'Search commands' }).fill(query);
    assert(await palette.getByRole('option').count() > 0, query);
  }
  await page.getByRole('combobox', { name: 'Search commands' }).fill('zzzzqqq');
  await palette.getByRole('status').getByText('No commands found.', { exact: false }).waitFor();
  await page.getByRole('combobox', { name: 'Search commands' }).fill('gate attendant');
  assert.equal(new URL(page.url()).pathname, '/admin/dashboard', 'Typing must not execute G A/T.');
  await page.keyboard.press('Control+k');
  assert.equal(await palette.isVisible(), false);
  await trigger.click(); await page.keyboard.press('Escape');
  assert(await trigger.evaluate(n => n === document.activeElement), 'Return focus to trigger.');
  await trigger.click();
  await page.getByRole('combobox', { name: 'Search commands' }).fill('keyboard');
  await page.keyboard.press('Enter');
  await page.getByRole('dialog', { name: 'Keyboard shortcuts', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Back to commands', exact: true }).click();
  assert(await page.getByRole('combobox', { name: 'Search commands' }).evaluate(n => n === document.activeElement));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  assert.equal(network.length, 0, 'Opening/searching/help must make no server/RSC/action requests.');
  page.off('request', record);
  console.log(JSON.stringify({ commandPaletteVisibleNextFrameMs: await page.evaluate(() => window.__commandTiming), mobile, openSearchRequests: network.length }));

  // Native dialog focus trap and responsive layout, including narrow phones.
  const originalViewport = page.viewportSize();
  for (const width of mobile ? [320,390,430,768] : [1280,1920]) {
    await page.setViewportSize({ width, height: 900 }); await trigger.click();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const bounds = await palette.boundingBox(); assert(bounds.x >= 0 && bounds.x + bounds.width <= width + 1);
    await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
    assert(await palette.evaluate(n => n.contains(document.activeElement)), 'Focus must remain in modal.');
    if (process.env.ADMIN_COMMAND_EVIDENCE_DIR) {
      await mkdir(process.env.ADMIN_COMMAND_EVIDENCE_DIR, { recursive: true });
      await page.screenshot({ path: path.join(process.env.ADMIN_COMMAND_EVIDENCE_DIR, `palette-${width}.png`) });
    }
    await page.keyboard.press('Escape');
  }
  await page.setViewportSize(originalViewport);
  await page.emulateMedia({ reducedMotion: 'reduce' }); await open(page); await page.keyboard.press('Escape'); await page.emulateMedia({ reducedMotion: 'no-preference' });

  // Browser shortcuts remain uncanceled; no direct actions in any command.
  const collisions = await page.evaluate(() => ['f','r','c','v','z','y','l','t','w'].flatMap(key => [true,false].map(meta => {
    const event = new KeyboardEvent('keydown', { key, [meta ? 'metaKey' : 'ctrlKey']: true, bubbles: true, cancelable: true });
    document.querySelector('#main-content').dispatchEvent(event); return event.defaultPrevented;
  })));
  assert(collisions.every(value => !value), 'Native browser/editor shortcuts were intercepted.');
  await unfocus(page); await page.keyboard.press('g'); await page.waitForTimeout(1300); await page.keyboard.press('c');
  assert.equal(new URL(page.url()).pathname, '/admin/dashboard');
  await page.keyboard.press('g'); await page.keyboard.press('Escape'); await page.keyboard.press('c');
  assert.equal(new URL(page.url()).pathname, '/admin/dashboard');

  for (const [key, pathname, title] of [['v','/admin/volunteers','Volunteers'], ['a','/admin/needs-attention','Needs Attention'], ['t','/admin/tasks','Tasks'], ['m','/admin/announcements','Communications']]) {
    await go(page, key, pathname, title);
    await unfocus(page); await page.keyboard.press('/');
    if (key === 'm') { await palette.waitFor(); await page.keyboard.press('Escape'); }
    else {
      assert(await page.locator('[data-admin-shortcut="search"]').evaluate(n => n === document.activeElement));
      await page.keyboard.type('gate attendant');
      await page.locator('[data-admin-shortcut="search"]').fill('');
      assert.equal(new URL(page.url()).pathname, pathname);
    }
    await unfocus(page); await page.keyboard.press('f');
    if (key === 'm') await page.getByRole('tabpanel').getByRole('heading', { name: 'Delivery history' }).waitFor();
    else assert(await page.locator('[data-admin-shortcut="filters"]').evaluate(n => n === document.activeElement));
  }
  await go(page, 'c', '/admin/calendar', 'Calendar');
  await unfocus(page); await page.keyboard.press('/');

  await page.waitForFunction(() => document.activeElement?.hasAttribute('data-admin-opened-search'));
  await page.keyboard.type('gate attendant');
  assert.equal(new URL(page.url()).pathname, '/admin/calendar');
  await page.keyboard.press('Escape');
  const viewBeforeToday = new URL(page.url()).searchParams.get('view');
  const today = await page.evaluate(() => { const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Denver',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()); const date=Object.fromEntries(parts.map(p=>[p.type,p.value])); return `${date.year}-${date.month}-${date.day}`; });
  await unfocus(page); await page.keyboard.press('t');
  await page.waitForURL(url => url.searchParams.get('date') === today);
  assert.equal(new URL(page.url()).searchParams.get('view'), viewBeforeToday);
  await go(page, 'v', '/admin/volunteers', 'Volunteers');
  await go(page, 'c', '/admin/calendar', 'Calendar');
  assert.equal(new URL(page.url()).searchParams.get('date'), today, 'Today and remembered Calendar return must converge.');
  await go(page, 'o', '/admin/dashboard', 'Overview');

  // Real typeable controls and modal/form focus must own their characters.
  for (const markup of ['<input>', '<input type="date">', '<input type="time">', '<textarea></textarea>', '<select><option>One</option></select>', '<div contenteditable="true"></div>', '<div role="combobox" tabindex="0"></div>', '<div role="listbox" tabindex="0"></div>', '<form><button type="button">Form control</button></form>', '<section role="dialog" aria-modal="true"><button type="button">Dialog control</button></section>']) {
    await page.evaluate(markup => { const node = document.createElement('div'); node.id = 'shortcut-safety-fixture'; node.innerHTML = markup; document.querySelector('main').append(node); (node.querySelector('input,textarea,select,[contenteditable],[tabindex],button')).focus(); }, markup);
    await page.keyboard.press('g'); await page.keyboard.press('v'); await page.keyboard.press('f'); await page.keyboard.press('t'); await page.keyboard.press('/');
    assert.equal(new URL(page.url()).pathname, '/admin/dashboard');
    assert.equal(await palette.isVisible(), false);
    await page.evaluate(() => document.querySelector('#shortcut-safety-fixture').remove());
  }
  // Palette anchors, Enter selection and workflow entries are ordinary navigation.
  await open(page, 'library'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowUp'); await page.keyboard.press('Enter');
  await ready(page, '/admin/tasks', 'Tasks');
  await open(page, 'create calendar'); await palette.getByRole('option', { name: /^Create Calendar item/ }).click();
  await ready(page, '/admin/calendar', 'Calendar');
  await page.getByRole('dialog', { name: 'Plan project work', exact: true }).first().waitFor();
  await page.keyboard.press('Escape');
  await open(page, 'create calendar'); await page.keyboard.press('Enter');
  await page.getByRole('dialog', { name: 'Plan project work', exact: true }).first().waitFor();
  await page.keyboard.press('Escape');
  await open(page, 'assign volunteers'); await page.keyboard.press('Enter');
  await ready(page, '/admin/calendar', 'Calendar');
  assert.equal(await page.getByRole('dialog', {name:'Calendar item inspector',exact:true}).isVisible(), false);
  await open(page, 'add volunteer'); await page.keyboard.press('Enter');
  await ready(page, '/admin/volunteers', 'Volunteers');
  assert(await page.getByRole('button', {name:'+ Add volunteer',exact:true}).filter({visible:true}).isVisible());
  await open(page, 'send schedules'); await page.keyboard.press('Enter');
  await ready(page, '/admin/announcements', 'Communications');
  assert.equal(await page.getByRole('tab', {name:'Schedule deliveries',exact:true}).getAttribute('aria-selected'),'true');
  assert(await page.getByRole('button', {name:'Review recipients',exact:true}).isVisible());
  await go(page, 'o', '/admin/dashboard', 'Overview');
  await go(page, 'q', '/admin/quick-view', 'Project Quick View');
  await go(page, 'h', '/guide', /A little help for/);
  await page.goBack(); await ready(page, '/admin/quick-view', 'Project Quick View'); await page.waitForLoadState('networkidle');
  await page.goBack(); await ready(page, '/admin/dashboard', 'Overview');
  // Mixed command/sidebar navigation still owns the existing guarded queue.
  for (const keys of [['c','v','c'], ['c','a','c'], ['c','v','a'], ['c','v','a','m','t','o']]) {
    await page.locator('#main-content').focus();
    for (const key of keys) { await page.keyboard.press('g'); await page.keyboard.press(key); }
    const last = keys.at(-1), target = { c:['/admin/calendar','Calendar'], a:['/admin/needs-attention','Needs Attention'], o:['/admin/dashboard','Overview'] }[last];
    await ready(page, ...target);
    const expected = {path:target[0],title:target[1]};
    await page.evaluate(expected => {
      window.__commandStale = []; window.__commandWatch = true;
      const sample = () => {
        const h = [...document.querySelectorAll('main h1')].find(n=>n.getClientRects().length)?.textContent;
        const active = [...document.querySelectorAll('nav a[aria-current="page"]')].filter(n=>n.getClientRects().length).map(n=>new URL(n.href).pathname);
        if (location.pathname !== expected.path || h !== expected.title || !active.length || active.some(path=>path!==expected.path)) window.__commandStale.push({path:location.pathname,h,active});
        if (window.__commandWatch) requestAnimationFrame(sample);
      }; requestAnimationFrame(sample);
    }, expected);
    await page.waitForTimeout(2600);
    assert.deepEqual(await page.evaluate(() => { window.__commandWatch=false; return window.__commandStale; }), [], `Late route takeover after ${keys.join(' → ')}`);
  }
  await go(page, 'o', '/admin/dashboard', 'Overview');
  await page.reload(); await ready(page, '/admin/dashboard', 'Overview');
  console.log(`Command palette, all G destinations, local / F T, workflow navigation, typing/modal guards, timeout, Escape, browser collisions, history, reduced motion and responsive focus passed (${mobile ? 'mobile' : 'desktop'}).`);
}
