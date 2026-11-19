import { expect, test, type Page } from '@playwright/test';
import { validateConfigurationState, type ConfigurationState, type ConfigurationRequest, type ConfigurationSnapshot } from '../src/api/validation';

const firstId = '11111111-1111-4111-8111-111111111111';
const secondId = '22222222-2222-4222-8222-222222222222';
const now = '2026-11-18T12:00:00Z';
function job(id = firstId, state: ConfigurationRequest['state'] = 'pending', order = 1): ConfigurationRequest {
 return { request_id: id, request_order: order, state, created_at: now, deadline_at: '2026-11-18T12:02:00Z', claimed_at: state === 'pending' ? null : now, profile_id: 'configuration-v1' };
}
function snapshot(status: ConfigurationSnapshot['data_status'] = 'complete', id = firstId, order = 1): ConfigurationSnapshot {
 return { request_id: id, request_order: order, capture_started_at: now, capture_finished_at: now, received_at: now, accepted_at: now, data_status: status,
  decoded: { data_status: status, fields: [{ code: 'test_voltage', label_uk: 'Поріг напруги', raw_hex: '0CE4', value: status === 'complete' ? 3.312345 : null, candidate_value: null, unit: 'V', status: status === 'complete' ? 'verified' : 'raw', source: 'FA', address: '12' }], slots: [], issues: [] } };
}
function initial(): ConfigurationState { return { revision: 0, server_time: now, request: null, latest: null, previous_complete: null }; }
async function stream(page: Page) {
 await page.addInitScript(() => {
  Object.defineProperty(window, 'EventSource', { value: class extends EventTarget {
   configuration = (event: Event) => { if (event instanceof CustomEvent) this.dispatchEvent(new MessageEvent('configuration.updated.v1', { data: JSON.stringify(event.detail) })); };
   open = () => this.dispatchEvent(new Event('open'));
   constructor() { super(); document.documentElement.dataset.streamCount = String(Number(document.documentElement.dataset.streamCount ?? 0) + 1); window.addEventListener('configuration-message', this.configuration); window.addEventListener('configuration-open', this.open); }
   close() { document.documentElement.dataset.streamCount = String(Math.max(0, Number(document.documentElement.dataset.streamCount ?? 0) - 1)); window.removeEventListener('configuration-message', this.configuration); window.removeEventListener('configuration-open', this.open); }
  } });
 });
}
async function emit(page: Page, revision: number) {
 await page.evaluate(value => window.dispatchEvent(new CustomEvent('configuration-message', { detail: { configuration_revision: value, server_time: '2026-11-18T12:00:00Z' } })), revision);
}
const panel = (page: Page) => page.getByRole('region', { name: 'Налаштування батареї', exact: true });

for (const trigger of ['open', 'visible', 'coalesced'] as const) {
 test(`a held bootstrap recovers configuration changed before ${trigger} without an SSE replay`, async ({ page }) => {
  await stream(page); await page.clock.install();
  const old = initial();
  const complete: ConfigurationState = { ...old, revision: 1, request: job(firstId, 'completed'), latest: snapshot() };
  let heldReads = 0; let freshReads = 0; let released = false; let release = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/v1/battery/configuration', async route => {
   const held = !released;
   if (held) { heldReads++; await gate; } else freshReads++;
   await route.fulfill({ json: held ? old : complete });
  });
  await page.goto('/#configuration');
  await expect(page.locator('html')).toHaveAttribute('data-stream-count', '1');
  await expect.poll(() => heldReads).toBeGreaterThan(0);
  await expect(panel(page)).toContainText('Стан запитів ще не отримано');
  await page.evaluate(mode => {
   const visible = () => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); };
   if (mode === 'open') window.dispatchEvent(new Event('configuration-open'));
   else if (mode === 'visible') visible();
   else { visible(); window.dispatchEvent(new Event('configuration-open')); visible(); window.dispatchEvent(new Event('configuration-open')); }
  }, trigger);
  released = true; release();
  await expect(panel(page)).toContainText('Результат отримано');
  await expect.poll(() => freshReads).toBe(1);
  await page.clock.runFor(30000); expect(freshReads).toBe(1);
  await expect(page.locator('html')).toHaveAttribute('data-stream-count', '1');
 });
}

test('request, claim and partial outcome appear independently in two browsers', async ({ page, context }) => {
 let state = initial(); expect(validateConfigurationState(state)).toBe(true);
 const other = await context.newPage();
 for (const browser of [page, other]) { await stream(browser); await browser.route('**/api/v1/battery/configuration', route => route.fulfill({ json: state })); }
 await page.route('**/api/v1/battery/configuration/requests', async route => {
  const body: unknown = route.request().postDataJSON();
  if (!body || typeof body !== 'object' || !('request_id' in body) || typeof body.request_id !== 'string') throw new Error('Expected request UUID');
  const request = job(body.request_id); state = { ...state, revision: 1, request };
  await route.fulfill({ status: 201, json: request });
 });
 await Promise.all([page.goto('/#configuration'), other.goto('/#configuration')]);
 await expect(panel(other)).toContainText('Запитів на оновлення ще не було');
 await panel(page).getByRole('button', { name: 'Оновити налаштування' }).click();
 await emit(other, 1);
 for (const browser of [page, other]) await expect(panel(browser)).toContainText('Очікуємо на збирач даних');
 state = { ...state, revision: 2, request: state.request ? { ...state.request, state: 'running', claimed_at: now } : null };
 await Promise.all([emit(page, 2), emit(other, 2)]);
 for (const browser of [page, other]) await expect(panel(browser)).toContainText('Збирач отримує налаштування');
 state = { ...state, revision: 3, request: state.request ? { ...state.request, state: 'completed' } : null, latest: snapshot('partial', secondId, 2), previous_complete: snapshot() };
 await Promise.all([emit(page, 3), emit(other, 3)]);
 for (const browser of [page, other]) {
  await expect(panel(browser)).toContainText('Частковий знімок');
  await expect(panel(browser).getByTestId('configuration-latest')).toContainText('Невідомо');
  await expect(panel(browser).getByTestId('configuration-latest')).not.toContainText('3,312');
  await panel(browser).getByText('Попередній повний знімок', { exact: true }).click();
  await expect(panel(browser).getByTestId('configuration-previous')).toContainText('3,312 В');
  await expect(panel(browser).getByTestId('configuration-previous')).toContainText('Попередній повний знімок · прочитано');
  await expect(browser.locator('html')).toHaveAttribute('data-stream-count', '1');
  expect(await browser.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
 }
 // The choice of an old snapshot does not come back by itself with a later partial result.
 const thirdId = '33333333-3333-4333-8333-333333333333';
 state = { ...state, revision: 4, latest: snapshot('complete', secondId, 2), previous_complete: null };
 await emit(page, 4);
 await expect(panel(page).getByTestId('configuration-latest')).toContainText('Повний знімок');
 state = { ...state, revision: 5, latest: snapshot('partial', thirdId, 3), previous_complete: snapshot('complete', secondId, 2) };
 await emit(page, 5);
 await expect(panel(page).getByTestId('configuration-latest')).toContainText('Частковий знімок');
 await expect(panel(page).getByTestId('configuration-previous')).toHaveCount(0);
});

test('deadline uses server clock once and retains the last received snapshot', async ({ page }) => {
 await stream(page); await page.clock.install();
 let state: ConfigurationState = { ...initial(), revision: 1, request: job(), latest: snapshot() };
 let reads = 0;
 await page.route('**/api/v1/battery/configuration', route => { reads++; return route.fulfill({ json: state }); });
 await page.goto('/#configuration'); await expect(panel(page)).toContainText('Очікуємо на збирач даних');
 const baseline = reads;
 await page.clock.runFor(119000); expect(reads).toBe(baseline);
 state = { ...state, server_time: '2026-11-18T12:02:00Z', request: job(firstId, 'expired') };
 await page.clock.runFor(1100);
 await expect(panel(page)).toContainText('Час очікування минув');
 await expect.poll(() => reads).toBe(baseline + 1);
 await expect(panel(page).getByTestId('configuration-latest')).toContainText('3,312 В');
 await expect(panel(page).getByRole('button', { name: 'Оновити налаштування' })).toBeEnabled();
 await page.clock.runFor(300000); expect(reads).toBe(baseline + 1);
});

test('newer revision prevents an old HTTP reply from restoring a running request', async ({ page }) => {
 await stream(page);
 const old: ConfigurationState = { ...initial(), revision: 1, request: job(firstId, 'running') };
 const complete: ConfigurationState = { ...old, revision: 2, request: job(firstId, 'completed'), latest: snapshot() };
 let reads = 0; let heldReads = 0; let phase: 'bootstrap' | 'held' | 'complete' = 'bootstrap'; let release = () => {};
 const gate = new Promise<void>(resolve => { release = resolve; });
 await page.route('**/api/v1/battery/configuration', async route => {
  reads++; const held = phase === 'held'; const data = phase === 'complete' ? complete : old;
  if (held) { heldReads++; await gate; }
  await route.fulfill({ json: data });
 });
 await page.goto('/#configuration'); await expect(panel(page)).toContainText('Збирач отримує налаштування');
 const baseline = reads; phase = 'held';
 await page.evaluate(() => window.dispatchEvent(new Event('configuration-open')));
 await expect.poll(() => heldReads).toBe(1);
 await emit(page, 2); phase = 'complete'; release();
 await expect(panel(page)).toContainText('Результат отримано');
 await expect(panel(page)).not.toContainText('Збирач отримує налаштування');
 expect(reads).toBe(baseline + 2);
 await emit(page, 1); expect(reads).toBe(baseline + 2);
});

test('an uncertain creation retries the same UUID and conflict reconnects existing request', async ({ page }) => {
 await page.addInitScript(() => Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: undefined }));
 await stream(page); let state = initial(); const ids: string[] = [];
 await page.route('**/api/v1/battery/configuration', route => route.fulfill({ json: state }));
 await page.route('**/api/v1/battery/configuration/requests', async route => {
  const body: unknown = route.request().postDataJSON();
  if (!body || typeof body !== 'object' || !('request_id' in body) || typeof body.request_id !== 'string') throw new Error('Expected UUID');
  ids.push(body.request_id);
  if (ids.length === 1) await route.abort('failed');
  else { state = { ...state, revision: 1, request: job(secondId, 'running') }; await route.fulfill({ status: 409, json: { error: { code: 'active_request', message: 'Існує активний запит', active_request: secondId } } }); }
 });
 await page.goto('/#configuration'); await expect(panel(page)).toContainText('Запитів на оновлення ще не було');
 await panel(page).getByRole('button', { name: 'Оновити налаштування' }).click();
 await expect(panel(page)).toContainText('Не вдалося оновити налаштування');
 await panel(page).getByRole('button', { name: 'Оновити налаштування' }).click();
 await expect(panel(page)).toContainText('Збирач отримує налаштування');
 expect(ids).toHaveLength(2); expect(ids[0]).toBe(ids[1]);
 expect(ids[0]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
 await expect(panel(page)).not.toContainText('Не вдалося оновити налаштування');
});

for (const followUpFails of [false, true]) {
 test(`a new configuration revision survives an older failed GET with bounded follow-up (${followUpFails ? 'failure' : 'success'})`, async ({ page }) => {
  await stream(page); await page.clock.install();
  const complete: ConfigurationState = { ...initial(), revision: 2, request: job(firstId, 'completed'), latest: snapshot() };
  let reads = 0; let heldReads = 0; let phase: 'bootstrap' | 'held' | 'follow-up' = 'bootstrap'; let release = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/v1/battery/configuration', async route => {
   reads++; const requestedPhase = phase;
   if (requestedPhase === 'held') { heldReads++; await gate; }
   await route.fulfill(requestedPhase === 'bootstrap' ? { json: { ...initial(), revision: 1 } } : requestedPhase === 'held' || followUpFails ? { status: 503, json: { error: { code: 'database_unavailable', message: 'Недоступно' } } } : { json: complete });
  });
  await page.goto('/#configuration'); await expect(panel(page)).toContainText('Запитів на оновлення ще не було');
  const baseline = reads; phase = 'held';
  await page.evaluate(() => window.dispatchEvent(new Event('configuration-open')));
  await expect.poll(() => heldReads).toBe(1);
  await emit(page, 2); phase = 'follow-up'; release();
  if (followUpFails) await expect(panel(page)).toContainText('База даних недоступна');
  else { await expect(panel(page)).toContainText('Результат отримано'); await expect(panel(page)).not.toContainText('Не вдалося оновити налаштування'); }
  await expect.poll(() => reads).toBe(baseline + 2);
  await page.clock.runFor(30000); expect(reads).toBe(baseline + 2);
 });
}

test('malformed configuration notifications cause one independent resync per connection', async ({ page }) => {
 await stream(page); let reads = 0; let telemetryReads = 0;
 let state: ConfigurationState = { ...initial(), revision: 1 };
 page.on('request', request => { if (new URL(request.url()).pathname === '/api/v1/telemetry/state') telemetryReads++; });
 await page.route('**/api/v1/battery/configuration', route => { reads++; return route.fulfill({ json: state }); });
 await page.goto('/#configuration'); await expect(panel(page)).toContainText('Запитів на оновлення ще не було');
 await expect(page.locator('.time')).not.toHaveText('— · Київ');
 const baseline = reads; const telemetryBaseline = telemetryReads;
 const malformed = () => page.evaluate(() => window.dispatchEvent(new CustomEvent('configuration-message', { detail: { configuration_revision: 'invalid' } })));
 await malformed(); await expect.poll(() => reads).toBe(baseline + 1);
 for (let i = 0; i < 4; i++) await malformed();
 expect(reads).toBe(baseline + 1); expect(telemetryReads).toBe(telemetryBaseline);
 state = { ...state, revision: 2, request: job(firstId, 'completed'), latest: snapshot() };
 await emit(page, 2); await expect(panel(page)).toContainText('Результат отримано');
 expect(reads).toBe(baseline + 2);
 await page.evaluate(() => window.dispatchEvent(new Event('configuration-open')));
 await expect.poll(() => reads).toBe(baseline + 3);
 await expect(panel(page).getByText('Оновлюємо стан налаштувань…', { exact: true })).toHaveCount(0);
 await malformed(); await expect.poll(() => reads).toBe(baseline + 4);
 await expect(page.locator('html')).toHaveAttribute('data-stream-count', '1');
});

test('settings failure preserves battery and history and recovers on reconnect and visibility', async ({ page }) => {
 await stream(page); let fail = false; let reads = 0;
 let state: ConfigurationState = { ...initial(), latest: snapshot('unavailable'), revision: 1 };
 await page.route('**/api/v1/battery/configuration', route => { reads++; return route.fulfill(fail ? { status: 503, json: { error: { code: 'database_unavailable', message: 'Not shown' } } } : { json: state }); });
 await page.goto('/#configuration'); await expect(panel(page)).toContainText('Налаштування не отримано');
 fail = true; await emit(page, 2);
 await expect(panel(page)).toContainText('База даних недоступна');
 await page.goto('/#overview'); await expect(page.getByTestId('current-value')).toBeVisible();
 await page.goto('/#configuration');
 await expect(panel(page).getByTestId('configuration-latest')).toBeVisible();
 const before = reads;
 fail = false; state = { ...state, revision: 2 };
 await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('configuration-open')); });
 // The second overlapping trigger keeps one recovery after the current read.
 await expect.poll(() => reads).toBe(before + 2);
 await expect(panel(page)).not.toContainText('Не вдалося оновити налаштування');
 await expect(page.locator('html')).toHaveAttribute('data-stream-count', '1');
});

test('settings are a separate page opened from the menu, grouped into tabs without a long sheet', async ({ page }) => {
 await stream(page);
 const field = (code: string, label_uk: string, value: number, unit: string | null, address: string): ConfigurationSnapshot['decoded']['fields'][number] => ({ code, label_uk, raw_hex: '0000', value, candidate_value: null, unit, status: 'verified', source: 'FA', address });
 const latest = snapshot();
 latest.decoded.fields = [field('parameter_0', 'Номінальна ємність', 200, 'Ah', '0'), field('parameter_20', 'Верхня напруга комірки: захист', 3650, 'mV', '20'), field('parameter_21', 'Верхня напруга комірки: відновлення', 3500, 'mV', '21'), field('parameter_51', 'Затримка захисту: висока напруга комірки', 2, 's', '51'), field('parameter_24', 'Максимальний струм заряджання', 100, 'A', '24'), field('future_code', 'Невідомий показник', 7, null, '999')];
 await page.route('**/api/v1/battery/configuration', route => route.fulfill({ json: { ...initial(), revision: 1, request: job(firstId, 'completed'), latest } }));
 await page.goto('/');
 await expect(panel(page)).toHaveCount(0);
 await page.getByRole('button', { name: 'Відкрити меню' }).click();
 await page.getByRole('navigation', { name: 'Головне меню' }).getByRole('link', { name: 'Налаштування батареї' }).click();
 await expect(panel(page).getByRole('heading', { name: 'Налаштування батареї' })).toBeVisible();
 await expect(page.getByTestId('current-value')).toHaveCount(0);
 await expect(panel(page).getByRole('tab')).toHaveText(['Ємність і заряд', 'Захист', 'Службові']);
 await expect(panel(page).getByRole('tabpanel')).toContainText('200 А·год');
 await panel(page).getByRole('tab', { name: 'Захист' }).click();
 await expect(panel(page).getByRole('row', { name: /Комірка: висока/ })).toHaveText('Комірка: висока3650 мВ3500 мВ2 с');
 await expect(panel(page).getByRole('tabpanel')).not.toContainText('200 А·год');
 const sections = panel(page).locator('.configuration-section');
 const [first, second] = [await sections.nth(0).boundingBox(), await sections.nth(1).boundingBox()];
 if (!first || !second) throw new Error('Expected two protection sections');
 // Two columns on the wide layout, one column on phones.
 expect(second.x > first.x).toBe((page.viewportSize()?.width ?? 0) >= 1000);
 await page.keyboard.press('ArrowRight');
 await expect(panel(page).getByRole('tab', { name: 'Службові' })).toBeFocused();
 await expect(panel(page).getByRole('tabpanel')).toContainText('Невідомий показник');
 await expect(panel(page).getByRole('tabpanel')).toContainText('FA · 999');
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
 await page.getByRole('button', { name: 'Відкрити меню' }).click();
 await page.getByRole('navigation', { name: 'Головне меню' }).getByRole('link', { name: 'Історія', exact: true }).click();
 await expect(page.getByTestId('current-value')).toBeVisible();
 await expect(panel(page)).toHaveCount(0);
 await expect(page.locator('html')).toHaveAttribute('data-stream-count', '1');
});
