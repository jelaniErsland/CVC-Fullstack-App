import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { createBrowserClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';
import { resolvePreviewBrowserExecutable } from './preview-config.mjs';
import { assertEffectiveFunctionPolicy, effectiveFunctionQuery } from './function-privilege-policy.mjs';
import { sharedCalendarState } from '../lib/calendar/quickView.server.ts';
import { parseVolunteerScheduleRows } from '../lib/volunteerScheduleAccess/token.ts';

function run(cmd, args, input) {
  const result = spawnSync(cmd, args, { encoding: 'utf8', windowsHide: true, input, maxBuffer: 8 * 1024 * 1024, shell: cmd === 'npx' && process.platform === 'win32' });
  assert.equal(result.status, 0, result.stderr || 'Local command failed');
  return result.stdout;
}
const config = JSON.parse(run('npx', ['supabase', 'status', '--output', 'json']));
assert.equal(new URL(config.API_URL).hostname, '127.0.0.1', 'Only loopback Supabase is allowed');
const container = 'supabase_db_cvc-scheduler';
function sql(statement) { return run('docker', ['exec', '-i', container, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'], statement).trim(); }
const literal = value => "'" + String(value).replaceAll("'", "''") + "'";
const scope = randomUUID();
const workspace = randomUUID(), otherWorkspace = randomUUID();
const ids = { owner: randomUUID(), viewer: randomUUID(), other: randomUUID(), volunteer: randomUUID(), secondVolunteer: randomUUID() };
const users = [];
let browser;
async function user(name) {
  const jar = new Map();
  const client = createBrowserClient(config.API_URL, config.ANON_KEY, { isSingleton: false, auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: true }, cookies: {
    getAll: () => [...jar.values()], setAll: cookies => cookies.forEach(cookie => cookie.value ? jar.set(cookie.name, cookie) : jar.delete(cookie.name)),
  } });
  const email = 'qa-1245-' + scope + '-' + name + '@example.invalid';
  const password = randomBytes(24).toString('base64url') + 'aA1!';
  const result = await client.auth.signUp({ email, password });
  assert(!result.error && result.data.user, 'Local signup failed');
  users.push({ id: result.data.user.id, client });
  if (!result.data.session) assert(!(await client.auth.signInWithPassword({ email, password })).error);
  return { id: result.data.user.id, client, jar };
}
async function rpc(client, name, args, fail = false) {
  const result = await client.rpc(name, args);
  if (fail) { assert(result.error, name + ' must fail closed'); return; }
  assert(!result.error, name + ': ' + result.error?.message);
  return result.data;
}
const anon = createClient(config.API_URL, config.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
try {
  const owner = await user('owner'), viewer = await user('viewer'), other = await user('other');
  sql("insert into public.workspaces(id,workspace_key,display_name,lifecycle,timezone,starts_on,ends_on) values (" + literal(workspace) + "," + literal('qa-1245-' + scope) + ",'Bozeman Operations Review','active','America/Denver','2026-09-01','2099-12-31'),(" + literal(otherWorkspace) + "," + literal('qa-1245-other-' + scope) + ",'Other project','active','America/Denver','2026-09-01','2099-12-31');");
  for (const [name, actor] of Object.entries({ owner, viewer, other })) {
    const ws = name === 'other' ? otherWorkspace : workspace;
    const caps = name === 'viewer' ? ['workspace.read','calendar.view','assignments.view','volunteers.view','tasks.view'] : ['workspace.read','calendar.view','calendar.edit','assignments.view','assignments.edit','volunteers.view','volunteers.edit','tasks.view'];
    sql('insert into public.project_contacts(id,auth_user_id,status) values (' + literal(ids[name]) + ',' + literal(actor.id) + ",'active'); insert into public.workspace_contact_grants(workspace_id,project_contact_id,role,capabilities,status,valid_from) values (" + literal(ws) + ',' + literal(ids[name]) + ",'on_site_contact',array[" + caps.map(literal).join(',') + "],'active',now()-interval '1 day');");
  }
  for (const [id, name] of [[ids.volunteer, 'James Sample'], [ids.secondVolunteer, 'Daniel Sample']]) sql('insert into public.volunteer_profiles(id,workspace_id,profile_source,lifecycle,readiness_status,full_name,email,availability_snapshot,skills_help_snapshot,profile_notes,manual_created_at,manual_created_by_project_contact_id) values (' + literal(id) + ',' + literal(workspace) + ",'manual','active','ready'," + literal(name) + ",'private-contact@example.invalid','{}','{}','PRIVATE_PROFILE_NOTE',now()," + literal(ids.owner) + ');');
  await rpc(owner.client, 'set_current_project_day_expected_on_site', { p_project_date: '2026-10-06', p_expected_on_site_count: 321 });
  const history = sql('select row_to_json(d) from public.project_days d where workspace_id=' + literal(workspace));
  const mealArgs = { p_workspace_id: workspace, p_calendar_item_id: null, p_meal_kind: 'breakfast', p_date: '2026-10-06', p_start_time: '07:00', p_end_time: '08:00', p_provider: 'Bozeman West congregation', p_contact: 'Meal coordinator · 555-0100', p_menu: 'Eggs, oatmeal and fruit', p_total: 60, p_notes: 'Serve in the fellowship area.' };
  const breakfast = await rpc(owner.client, 'save_calendar_meal', mealArgs);
  const lunch = await rpc(owner.client, 'save_calendar_meal', { ...mealArgs, p_meal_kind: 'lunch', p_start_time: null, p_end_time: null, p_provider: 'Livingston congregation', p_menu: 'Sandwiches, salad and fruit', p_total: 85 });
  assert.equal(sql('select meal_total from public.calendar_items where id=' + literal(breakfast)), '60');
  assert.equal(sql('select meal_total from public.calendar_items where id=' + literal(lunch)), '85');
  for (const client of [viewer.client, other.client, anon]) await rpc(client, 'save_calendar_meal', { ...mealArgs, p_calendar_item_id: breakfast, p_total: 999 }, true);
  for (const changes of [{ p_total: -1 }, { p_meal_kind: 'dinner' }, { p_end_time: null }, { p_start_time: '09:00' }, { p_provider: 'x'.repeat(301) }]) await rpc(owner.client, 'save_calendar_meal', { ...mealArgs, ...changes }, true);
  await rpc(owner.client, 'save_calendar_meal', mealArgs, true); // unique day/kind
  await rpc(owner.client, 'save_calendar_meal', { ...mealArgs, p_calendar_item_id: breakfast, p_total: 0 });
  assert.equal(sql('select meal_total from public.calendar_items where id=' + literal(breakfast)), '0');
  await rpc(owner.client, 'save_calendar_meal', { ...mealArgs, p_calendar_item_id: breakfast, p_total: null });
  assert.equal(sql('select meal_total is null from public.calendar_items where id=' + literal(breakfast)), 't');
  await rpc(owner.client, 'save_calendar_meal', { ...mealArgs, p_calendar_item_id: breakfast });
  async function item(title, type, start, end, published = true) {
    const id = await rpc(owner.client, 'create_calendar_item', { p_workspace_id: workspace, p_task_preset_id: null, p_one_off_title: title, p_one_off_task_type: type, p_schedule_kind: 'timed', p_start_date: '2026-10-06', p_end_date: null, p_start_time: start, p_end_time: end, p_needed_count: 2, p_schedule_notes: 'Check in at the north entrance.', p_custom_values: { zone: 'North' } });
    if (published) await rpc(owner.client, 'publish_calendar_item', { p_calendar_item_id: id });
    return id;
  }
  const general = await item('On-site preparation', 'general', '08:00','11:00');
  const security = await item('Entrance security', 'security','09:00','12:00');
  const privateItem = await item('PRIVATE_DRAFT', 'general','15:00','16:00',false);
  const assignment = await rpc(owner.client, 'create_calendar_assignment', { p_calendar_item_id: general, p_volunteer_profile_id: ids.volunteer, p_assignment_note: null });
  await rpc(owner.client, 'create_calendar_assignment', { p_calendar_item_id: security, p_volunteer_profile_id: ids.secondVolunteer, p_assignment_note: null });
  const duplicate = await rpc(owner.client, 'duplicate_calendar_item', { p_calendar_item_id: general, p_target_date: '2026-10-07', p_start_time: '10:00', p_end_time: '13:00' });
  assert.equal(sql('select count(*) from public.calendar_assignments where calendar_item_id=' + literal(duplicate)), '0');
  assert.equal(sql('select publication_state from public.calendar_items where id=' + literal(duplicate)), 'draft');
  assert.equal(sql('select count(*) from public.assignment_responses r join public.calendar_assignments a on a.id=r.assignment_id where a.calendar_item_id=' + literal(duplicate)), '0');
  assert.equal(sql('select count(*) from public.assignment_notification_deliveries where calendar_item_id=' + literal(duplicate)), '0');
  assert.equal(sql('select count(*) from public.calendar_repeat_creation_requests where workspace_id=' + literal(workspace)), '0');
  for (const col of ['title_snapshot','task_type_snapshot','needed_count','schedule_notes','custom_values']) assert.equal(sql('select ' + col + '::text from public.calendar_items where id=' + literal(duplicate)), sql('select ' + col + '::text from public.calendar_items where id=' + literal(general)));
  const mealCopy = await rpc(owner.client, 'duplicate_calendar_item', { p_calendar_item_id: breakfast, p_target_date: '2026-10-07' });
  assert.equal(sql('select meal_total from public.calendar_items where id=' + literal(mealCopy)), '60');
  assert.equal(sql('select publication_state from public.calendar_items where id=' + literal(mealCopy)), 'published', 'Meals follow immediate-visible meal creation semantics');
  assert.equal(sql('select count(*) from public.calendar_assignments where calendar_item_id=' + literal(mealCopy)), '0');
  for (const client of [viewer.client, other.client, anon]) await rpc(client, 'duplicate_calendar_item', { p_calendar_item_id: general, p_target_date: '2026-10-08' }, true);
  await rpc(other.client, 'duplicate_calendar_item', { p_calendar_item_id: privateItem, p_target_date: '2026-10-08' }, true);
  await rpc(viewer.client, 'publish_calendar_item', { p_calendar_item_id: privateItem }, true);
  await rpc(viewer.client, 'archive_calendar_item', { p_calendar_item_id: general }, true);
  assert.equal(sql('select row_to_json(d) from public.project_days d where workspace_id=' + literal(workspace)), history, 'Historical Project Day row is unchanged');
  const issued = (await rpc(owner.client, 'issue_project_quick_view_access', { p_workspace_id: workspace }))[0];
  const shared = await rpc(anon, 'read_project_quick_view_by_token', { p_bearer_token: issued.bearer_token, p_project_date: '2026-10-06' });
  assert.equal(shared[0].expected_on_site_count, null);
  const json = JSON.stringify(shared);
  for (const forbidden of ['PRIVATE_DRAFT','PRIVATE_PROFILE_NOTE','private-contact@example.invalid']) assert(!json.includes(forbidden));
  assert(json.includes('James Sample') && json.includes('Entrance security') && json.includes('Meal coordinator'));
  for (const view of ['day','week','month','list']) {
    const state = sharedCalendarState(shared, { view, date: '2026-10-06' });
    assert(state && state.canEdit === false && state.canEditAssignments === false && state.items.some(i => i.id === breakfast && i.meal.total === 60));
  }
  const volunteerToken = (await rpc(owner.client, 'issue_volunteer_schedule_access', { p_volunteer_profile_id: ids.volunteer, p_ttl_hours: 24 }))[0];
  const mealAssignment = await rpc(owner.client, 'create_calendar_assignment', { p_calendar_item_id: breakfast, p_volunteer_profile_id: ids.volunteer, p_assignment_note: null });
  const schedule = await rpc(anon, 'read_volunteer_schedule', { p_bearer_token: volunteerToken.bearer_token });
  assert.equal(schedule.find(row => row.assignment_reference === mealAssignment).schedule_notes, null, 'Assigned meal must also omit trusted operational notes');
  assert.equal(schedule[0].meal_details.length, 2);
  assert(!JSON.stringify(schedule[0].meal_details).includes('Meal coordinator'));
  assert.deepEqual(Object.keys(schedule[0].meal_details[0]).sort(), ['kind','provider','menu','startTime','endTime'].sort());
  assert.equal(parseVolunteerScheduleRows(schedule).kind, 'ready');
  assertEffectiveFunctionPolicy(assert, sql(effectiveFunctionQuery).split('\n').filter(Boolean).map(JSON.parse));
  console.log('PASS meals, separate totals, historical preservation, duplicate isolation, trusted/volunteer projections and exact function ACLs');

  if (process.argv.includes('--browser')) {
    const base = 'http://127.0.0.1:3000';
    browser = await chromium.launch({ executablePath: resolvePreviewBrowserExecutable(), headless: true });
    const dir = '../previews/12.45-product-review';
    await mkdir(dir, { recursive: true });
    const errors = [];
    async function contextFor(actor, width) {
      const context = await browser.newContext({ viewport: { width, height: 1000 } });
      await context.route('**/*', route => ['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
      if (actor) await context.addCookies([...actor.jar.values()].map(c => ({ name: c.name, value: c.value, url: base, sameSite: 'Lax' })));
      const page = await context.newPage();
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      return { context, page };
    }
    async function capture(page, name) {
      if (!process.argv.includes('--capture-inspectors-only') || /inspector|duplicate/.test(name)) await page.screenshot({ path: dir + '/' + name + '.png', fullPage: true });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), name + ': horizontal overflow');
    }
    for (const width of [1440,390]) {
      const size = width === 390 ? 'mobile' : 'desktop';
      const { context, page } = await contextFor(null, width);
      await context.addCookies([{ name: 'pl-project-quick-view', value: issued.bearer_token, url: base + '/qv', sameSite: 'Lax', httpOnly: true }]);
      await page.goto(base + '/qv?date=2026-10-06&view=week');
      await page.getByRole('heading', { name: 'Project Quick View', exact: true }).waitFor();
      assert.equal(await page.getByText('Planned staffing', { exact: false }).count(), 0);
      assert.equal(await page.getByText('Expected on site', { exact: false }).count(), 0);
      assert.equal(await page.getByRole('button', { name: /^(Create|Plan project work|Assign |Publish |Archive |Duplicate|Send)/ }).count(), 0);
      assert.equal(await page.getByRole('region', { name: 'Meals for selected day' }).count(), 0);
      assert.equal(await page.locator('[aria-label="Meal details"]').count(), 0);
      await capture(page, 'quick-view-week-' + size);
      for (const view of ['day','week','month','list']) {
        await page.goto(base + '/qv?date=2026-10-06&view=' + view);
        await page.getByRole('button', { name: 'Go to project date', exact: true }).click();
        await page.waitForURL(url => url.searchParams.get('date') === '2026-09-01' && url.searchParams.get('view') === view);
      }
      await page.goto(base + '/qv?date=2026-10-06&view=week');
      await page.getByRole('button', { name: /On-site preparation/ }).first().click();
      await page.getByRole('heading', { name: 'On-site preparation', exact: true }).waitFor();
      await page.getByText('James Sample', { exact: true }).filter({ visible: true }).waitFor();
      await capture(page, 'readonly-calendar-inspector-' + size);
      await page.getByRole('button', { name: 'Close calendar item inspector', exact: true }).click();
      await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label')?.includes('On-site preparation'));
      for (const view of ['day','month','list']) {
        await page.goto(base + '/qv?date=2026-10-06&view=' + view);
        await page.getByRole('heading', { name: 'Project Quick View', exact: true }).waitFor();
        assert.equal(await page.getByRole('button', { name: /^(Create|Plan project work|Assign |Publish |Archive |Duplicate|Send)/ }).count(), 0);
      }
      await page.goto(base + '/qv?date=2026-10-06&view=day');
      await page.getByRole('button', { name: /Breakfast/ }).first().waitFor();
      await page.getByRole('button', { name: /Lunch/ }).first().waitFor();
      await capture(page, 'day-breakfast-lunch-' + size);
      await page.goto(base + '/qv?date=2026-10-06&view=day&item=' + breakfast);
      await page.getByRole('heading', { name: 'Breakfast', exact: true }).last().waitFor();
      await capture(page, 'meal-inspector-' + size);
      await context.close();
      const admin = await contextFor(owner, width);
      for (const start of ['2026-09-29','2026-11-03']) {
        sql('update public.workspaces set starts_on=' + literal(start) + ' where id=' + literal(workspace));
        for (const view of ['day','week','month','list']) {
          for (const route of ['/admin/calendar','/admin/quick-view']) {
            await admin.page.goto(base + route + '?date=2026-10-06&view=' + view);
            await admin.page.getByRole('button', { name: 'Go to project date', exact: true }).click();
            await admin.page.waitForURL(url => url.searchParams.get('date') === start && url.searchParams.get('view') === view);
            if (start === '2026-09-29' && view === 'month' && route === '/admin/calendar' && width === 1440) await capture(admin.page, 'project-start-navigation-desktop');
          }
        }
      }
      sql('update public.workspaces set starts_on=\'2026-09-01\' where id=' + literal(workspace));
      await admin.page.goto(base + '/admin/calendar?date=2026-10-06&view=week&item=' + general);
      await admin.page.getByRole('heading', { name: 'On-site preparation', exact: true }).waitFor();
      await admin.page.getByText('Duplicate', { exact: true }).filter({ visible: true }).click();
      await admin.page.getByLabel('Target date', { exact: true }).filter({ visible: true }).fill('2026-10-08');
      await admin.page.getByRole('button', { name: 'Create duplicate', exact: true }).scrollIntoViewIfNeeded();
      await capture(admin.page, 'duplicate-' + size);
      if (width === 1440) {
        await admin.page.getByRole('button', { name: 'Create duplicate', exact: true }).click();
        await admin.page.getByText('Item duplicated', { exact: true }).waitFor();
        await admin.page.goto(base + '/admin/calendar?date=2026-10-06&view=week');
        await capture(admin.page, 'mixed-category-colors-desktop');
        await admin.page.getByRole('button', { name: 'Create item', exact: true }).click();
        await admin.page.getByRole('button', { name: 'Breakfast / Lunch', exact: true }).click();
        await admin.page.getByLabel('Date', { exact: true }).filter({ visible: true }).fill('2026-10-09');
        await admin.page.getByLabel('Meal total', { exact: true }).filter({ visible: true }).fill('45');
        await admin.page.getByRole('button', { name: 'Save meal', exact: true }).click();
        await admin.page.getByText('Meal saved', { exact: true }).waitFor();
      }
      await admin.context.close();
    }
    const limited = await contextFor(viewer,390);
    await limited.page.goto(base + '/admin/quick-view?date=2026-10-06&view=day');
    await limited.page.getByRole('heading', { name: 'Project Quick View', exact: true }).waitFor();
    assert.equal(await limited.page.getByRole('button', { name: /^(Create|Assign |Publish |Archive |Duplicate|Send)/ }).count(), 0);
    await limited.context.close();
    for (const width of [1440,390]) {
      const volunteer = await contextFor(null, width);
      await volunteer.context.addCookies([{ name: 'pl-volunteer-schedule', value: volunteerToken.bearer_token, url: base + '/v', sameSite: 'Lax', httpOnly: true }]);
      await volunteer.page.goto(base + '/v/schedule');
      const meals = volunteer.page.getByRole('region', { name: 'Meals for 2026-10-06' });
      await meals.getByRole('heading', { name: 'Breakfast', exact: true }).waitFor();
      await meals.getByRole('heading', { name: 'Lunch', exact: true }).waitFor();
      await meals.getByText('Bozeman West congregation', { exact: true }).waitFor();
      await meals.getByText('Sandwiches, salad and fruit', { exact: true }).waitFor();
      const content = await volunteer.page.locator('body').innerText();
      for (const forbidden of ['Meal coordinator', 'PRIVATE_PROFILE_NOTE', 'private-contact@example.invalid', 'Daniel Sample', 'Serve in the fellowship area.']) assert(!content.includes(forbidden), 'Volunteer projection: ' + forbidden);
      assert(await volunteer.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Volunteer mobile overflow');
      await volunteer.context.close();
    }
    const calendarSource = await readFile('components/CalendarClient.tsx', 'utf8');
    assert(!calendarSource.includes('2026-01-13') && !calendarSource.includes('2026-09-29'), 'Project navigation must use persisted dates');
    assert.deepEqual(errors, []);
    console.log('PASS shared/authenticated read-only Calendar, four views, mobile overflow, admin meal/duplicate actions; captures saved');
  }
  await rpc(owner.client, 'revoke_project_quick_view_access', { p_workspace_id: workspace });
  assert.equal((await rpc(anon, 'read_project_quick_view_by_token', { p_bearer_token: issued.bearer_token, p_project_date: '2026-10-06' }))[0].access_state, 'unavailable');
  assert.equal(sql('select count(*) from public.assignment_notification_deliveries where workspace_id=' + literal(workspace)), '0');
  assert(assignment);
} finally {
  if (browser) await browser.close();
  const scopeIds = [workspace, otherWorkspace].map(literal).join(',');
  for (const table of ['project_quick_view_access_tokens','volunteer_schedule_access_tokens','assignment_responses','calendar_assignments','calendar_items','project_days','volunteer_profiles','workspace_contact_grants']) sql('delete from public.' + table + ' where workspace_id in (' + scopeIds + ');');
  sql('delete from public.project_contacts where id in (' + [ids.owner,ids.viewer,ids.other].map(literal).join(',') + '); delete from public.workspaces where id in (' + scopeIds + ');');
  for (const actor of users) { await actor.client.auth.signOut(); sql('delete from auth.users where id=' + literal(actor.id)); }
  console.log('Local fixture cleanup complete');
}
