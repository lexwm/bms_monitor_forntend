import { expect, test, type Page, type APIRequestContext } from '@playwright/test';
import { validateState, validateEvent, type StreamState, type RawHistorySeries } from '../src/api/validation';

async function initialState(request: APIRequestContext): Promise<StreamState> {
 const raw: unknown = await (await request.get('/api/v1/telemetry/state')).json();
 if (!validateState(raw) || raw.latest?.battery == null) throw new Error('Expected local fixture');
 const now = new Date().toISOString();
 return { ...raw, server_time: now, latest: { ...raw.latest, state: 'fresh', valid: true, stale: false, reason: null, last_valid: null, mode: 'discharge', received_at: now, server_time: now, age_seconds: 0, battery: raw.latest.battery } };
}
function sampleHistory(): RawHistorySeries {
 const to = Date.now(); const stamp = (offset: number) => new Date(to + offset).toISOString();
 return { kind:'raw', range:'10m', resolution_seconds:0, aggregate_revision:0, prepared_at:null, processing_status:'ready', prepared_coverage_seconds:600, from: stamp(-600000), to: stamp(0), source_revision: 1, period_seconds: 600, observed_coverage_seconds: 10, gaps: [{ from: stamp(-590000), to: stamp(0) }], points: [0, 5000].map(offset => ({ received_at: stamp(-600000 + offset), boot_id: 'ffffffffffff0001', sequence: offset, valid: true, current_a: -0.04, power_w: -1, soc_percent: 58 })) };
}
async function streamStub(page: Page) {
 await page.addInitScript(() => {
  Object.defineProperty(window, 'EventSource', { value: class extends EventTarget {
   message = (event: Event) => { if (event instanceof CustomEvent) this.dispatchEvent(new MessageEvent('telemetry.updated.v1', { data: JSON.stringify(event.detail) })); };
   error = () => this.dispatchEvent(new Event('error'));
   constructor() { super(); window.addEventListener('layout-message', this.message); window.addEventListener('layout-error', this.error); }
   close() { window.removeEventListener('layout-message', this.message); window.removeEventListener('layout-error', this.error); }
  } });
 });
}
async function emit(page: Page, state: StreamState) {
 const event = { schema: 1, revision: state.revision, server_time: state.server_time, latest: state.latest, history_changed: true };
 expect(validateEvent(event)).toBe(true);
 await page.evaluate(data => window.dispatchEvent(new CustomEvent('layout-message', { detail: data })), event);
 await page.waitForTimeout(30);
}
const panels = '.hero,.metric,.cells,.temps,.history,.current-history,.quality';
async function geometry(page: Page) {
 return page.locator(panels).evaluateAll(nodes => nodes.map(node => { const box = node.getBoundingClientRect(); return { x: box.x, y: box.y + window.scrollY, width: box.width, height: box.height }; }));
}
async function expectStable(page: Page, baseline: Awaited<ReturnType<typeof geometry>>) {
 const actual = await geometry(page);
 expect(actual).toHaveLength(baseline.length);
 actual.forEach((box, index) => { const before = baseline[index]; if (!before) throw new Error('Missing box'); for (const key of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(box[key] - before[key]), `${index}:${key}`).toBeLessThanOrEqual(0.6); });
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

for (const width of [320, 390, 600, 1440]) {
 test(`live numbers and data states keep fixed geometry at ${width}px`, async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Explicit viewports are covered once');
  await page.setViewportSize({ width, height: 900 }); await page.emulateMedia({ reducedMotion: 'reduce' }); await streamStub(page);
  let state = await initialState(request); let failApi = false;
  await page.route('**/api/v1/telemetry/state', route => route.fulfill(failApi ? { status: 503, json: { error: { code: 'database_unavailable', message: 'Unavailable' } } } : { json: state }));
  await page.route('**/api/v1/battery/history/series?*', route => route.fulfill({ json: sampleHistory() }));
  await page.goto('/'); await expect(page.getByTestId('history-segment')).toHaveCount(2);
  await expect(page.getByRole('img', { name: 'Заряд 58 відсотків' })).toHaveAccessibleDescription(/Розряджання/);
  const baseline = await geometry(page);
  const unitX = await page.locator('.metric .unit').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().x));
  const cellUnits = await page.locator('.cell-unit').evaluateAll(nodes => nodes.map(node => { const rect = node.getBoundingClientRect(); return { x: rect.x, y: rect.y + window.scrollY }; }));
  const percentX = await page.locator('.soc small').evaluate(node => node.getBoundingClientRect().x);
  const originalBattery = state.latest?.battery;
  if (!state.latest || !originalBattery) throw new Error('Missing fixture');
  for (const [index, value] of [0.04, -0.04, 0, 9.99, -100.01, 999.9, -9999.9, -999999.9, 1e12, Number.MAX_VALUE, -Number.MAX_VALUE].entries()) {
   const latest = state.latest;
   if (!latest) throw new Error('Missing latest');
   const revision = state.revision + 1;
   state = { ...state, revision, latest: { ...latest, revision, battery: { ...originalBattery, current_a: value, power_w: value, soc_percent: [0, 9, 10, 99, 100][index % 5] ?? 58 } } };
   await emit(page, state); await expectStable(page, baseline);
   if (index < 2) await expect(page.getByTestId('current-value')).toContainText(value < 0 ? '-0,04' : '0,04');
   expect(await page.locator('.metric .unit').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().x))).toEqual(unitX);
   expect(await page.locator('.soc small').evaluate(node => node.getBoundingClientRect().x)).toBeCloseTo(percentX, 1);
   expect(await page.locator('.reading-number').evaluateAll(nodes => nodes.every(node => node.scrollWidth <= node.clientWidth + 1))).toBe(true);
  }
  for (const value of [0, 100, 999999.9, Number.MAX_VALUE]) {
   if (!state.latest) throw new Error('Missing latest');
   const revision = state.revision + 1;
   state = { ...state, revision, latest: { ...state.latest, revision, battery: { ...originalBattery, voltage_v: value, remaining_ah: value, cell_min_v: value, cell_max_v: value, cells_v: Array.from({ length: 8 }, () => value) } } };
   await emit(page, state); await expectStable(page, baseline);
   expect(await page.locator('.cell-unit').evaluateAll(nodes => nodes.map(node => { const rect = node.getBoundingClientRect(); return { x: rect.x, y: rect.y + window.scrollY }; }))).toEqual(cellUnits);
   expect(await page.locator('.cell-reading').evaluateAll(nodes => nodes.every(node => node.scrollWidth <= node.clientWidth + 1))).toBe(true);
  }
  expect(await page.locator('.temp-top .reading-update').evaluate(node => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(30);
  for (const count of [0, 3, 16, 2]) {
   if (!state.latest) throw new Error('Missing latest'); const revision = state.revision + 1;
   state = { ...state, revision, latest: { ...state.latest, revision, battery: { ...originalBattery, temperatures_c: Array.from({ length: count }, (_, index) => 20 + index) } } };
   await emit(page, state); await expectStable(page, baseline);
  }
  if (!state.latest) throw new Error('Missing latest');
  let revision = state.revision + 1;
  state = { ...state, revision, latest: { ...state.latest, revision, received_at: new Date(Date.now() - 60000).toISOString(), battery: originalBattery } };
  await emit(page, state); await expect(page.getByRole('status')).toContainText('Немає нових вимірювань'); await expectStable(page, baseline);
  await page.evaluate(() => window.dispatchEvent(new Event('layout-error'))); await expect(page.getByText('Канал оновлень відновлюється.', { exact: false })).toBeVisible(); await expectStable(page, baseline);
  failApi = true; await page.getByRole('button', { name: 'Оновити знімок' }).evaluate(button => { if (button instanceof HTMLButtonElement) button.click(); });
  await expect(page.getByRole('status')).toContainText('База даних недоступна'); await expectStable(page, baseline);
  revision = state.revision + 1; state = { ...state, revision, latest: null };
  await emit(page, state); await expect(page.getByRole('img', { name: 'Заряд невідомий' })).toBeVisible(); await expectStable(page, baseline);
 });
}

test('history loading, missing series and errors retain the same chart scaffold', async ({ page, request }, testInfo) => {
 await page.emulateMedia({ reducedMotion: 'reduce' }); await streamStub(page);
 const state = await initialState(request); const history = sampleHistory(); let failure = false; let empty = false;
 let release = () => {}; const gate = new Promise<void>(resolve => { release = resolve; });
 await page.route('**/api/v1/telemetry/state', route => route.fulfill({ json: state }));
 await page.route('**/api/v1/battery/history/series?*', async route => { await gate; await route.fulfill(failure ? { status: 503, json: { error: { code: 'database_unavailable', message: 'Unavailable' } } } : { json: empty ? { ...history, points: [], observed_coverage_seconds: 0, gaps: [{ from: history.from, to: history.to }] } : history }); });
 await page.goto('/'); await expect(page.getByText('Завантажуємо історію…', { exact: true })).toHaveCount(2);
 await expect(page.getByRole('img', { name: 'Заряд 58 відсотків' })).toBeVisible(); const baseline = await geometry(page);
 release(); await expect(page.getByTestId('history-segment')).toHaveCount(2); await expectStable(page, baseline);
 empty = true; await page.getByRole('button', { name: 'Оновити знімок' }).evaluate(button => { if (button instanceof HTMLButtonElement) button.click(); });
 await expect(page.getByText('Немає значень показника за цей період', { exact: true })).toHaveCount(2); await expectStable(page, baseline);
 failure = true; await page.getByRole('button', { name: 'Оновити знімок' }).evaluate(button => { if (button instanceof HTMLButtonElement) button.click(); });
 await expect(page.getByText('Не вдалося оновити історію. Збережений знімок може бути застарілим.', { exact: true })).toBeVisible(); await expectStable(page, baseline);
 await page.screenshot({ path: testInfo.outputPath('stable-dashboard.png'), fullPage: true });
});

test('battery states explain available evidence and all interface text is Ukrainian', async ({ page, request }, testInfo) => {
 await streamStub(page); await page.emulateMedia({ reducedMotion: 'reduce' });
 let state = await initialState(request);
 let apiError: string | null = null;
 await page.route('**/api/v1/telemetry/state', route => route.fulfill(apiError ? { status: 503, json: { error: { code: apiError, message: 'This server message must never be displayed' } } } : { json: state }));
 await page.route('**/api/v1/battery/history/series?*', route => route.fulfill({ json: sampleHistory() }));
 await page.goto('/');
 await expect(page.locator('html')).toHaveAttribute('lang', 'uk');
 await expect(page).toHaveTitle('Монітор батареї');
 await expect(page.locator('.mode-label')).toHaveText('↘ Розряджання');
 const baseline = await geometry(page);
 const latest = state.latest;
 if (!latest?.battery) throw new Error('Missing fixture');
 async function checkLanguage() {
  const text = await page.locator('main').evaluate(root => [root.textContent, ...Array.from(root.querySelectorAll('[aria-label],[title]')).flatMap(node => [node.getAttribute('aria-label'), node.getAttribute('title')])].join(' '));
  // Celsius and scientific notation are measurement symbols, not interface language.
  expect(text.replaceAll('°C', '').replace(/E[+-]?\d+/g, '')).not.toMatch(/[a-zыэъё]/i);
 }
 for (const [mode, label, detail] of [
  ['charge', '↗ Заряджання', 'Батарея накопичує енергію.'],
  ['discharge', '↘ Розряджання', 'Батарея віддає енергію.'],
  ['idle', 'Від мережі / без заряджання', 'Струм батареї дорівнює нулю.'],
  ['unknown', 'Напрям струму невідомий', 'Сервер не визначив напрям струму.'],
 ] as const) {
  const revision = state.revision + 1;
  state = { ...state, revision, latest: { ...latest, revision, mode, battery: { ...latest.battery, current_a: mode === 'idle' ? 0 : mode === 'discharge' ? -0.04 : 0.04 } } };
  await emit(page, state);
  await expect(page.locator('.mode-label')).toHaveText(label);
  await expect(page.locator('.current .metric-sub')).toContainText(detail);
  await expect(page.getByRole('img', { name: 'Заряд 58 відсотків' })).toHaveAccessibleDescription(label);
  await expectStable(page, baseline); await checkLanguage();
  if (mode === 'idle') await page.screenshot({ path: testInfo.outputPath('ukrainian-idle.png'), fullPage: true });
  expect(await page.locator('.mode-label').evaluate(node => node.scrollHeight <= node.clientHeight + 1 && node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  expect(await page.locator('.current .metric-sub').evaluate(node => node.scrollHeight <= node.clientHeight + 1)).toBe(true);
 }
 await page.screenshot({ path: testInfo.outputPath('ukrainian-unknown.png'), fullPage: true });
 let revision = state.revision + 1;
 state = { ...state, revision, latest: { ...latest, revision, mode: 'unknown', battery: { ...latest.battery, current_a: null } } };
 await emit(page, state); await expect(page.locator('.mode-label')).toHaveText('Немає даних про струм'); await checkLanguage();
 revision = state.revision + 1;
 state = { ...state, revision, latest: { ...latest, revision, mode: 'charge', received_at: new Date(Date.now() - 60000).toISOString() } };
 await emit(page, state); await expect(page.locator('.mode-label')).toHaveText('Немає поточних даних'); await checkLanguage();
 for (const code of ['database_unavailable', 'invalid_source_data', 'incompatible_response', 'no_measurements_yet', 'unknown_error']) {
  apiError = code;
  const response = page.waitForResponse('**/api/v1/telemetry/state');
  await page.getByRole('button', { name: 'Оновити знімок' }).click(); await response;
  await expect(page.locator('.mode-label')).toHaveText('Немає поточних даних'); await checkLanguage();
 }
});

test('fractional charge stays inside the fixed indicator', async ({ page, request }, testInfo) => {
 await streamStub(page); await page.emulateMedia({ reducedMotion: 'reduce' });
 let state = await initialState(request);
 await page.route('**/api/v1/telemetry/state', route => route.fulfill({ json: state }));
 await page.route('**/api/v1/battery/history/series?*', route => route.fulfill({ json: sampleHistory() }));
 await page.goto('/'); await expect(page.getByRole('img', { name: 'Заряд 58 відсотків' })).toBeVisible();
 const baseline = await geometry(page);
 const percentX = await page.locator('.soc small').evaluate(node => node.getBoundingClientRect().x);
 for (const value of [0.04, 0.0001, Number.MIN_VALUE, 0.99, 99.99]) {
  const latest = state.latest;
  if (!latest?.battery) throw new Error('Missing fixture');
  const revision = state.revision + 1;
  state = { ...state, revision, latest: { ...latest, revision, battery: { ...latest.battery, soc_percent: value } } };
  await emit(page, state);
  if (value === 0.04 || value === Number.MIN_VALUE) await page.screenshot({ path: testInfo.outputPath(`fractional-${value}.png`), fullPage: true });
  expect(await page.locator('.soc>.reading-update').evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  expect(await page.locator('.soc small').evaluate(node => node.getBoundingClientRect().x)).toBeCloseTo(percentX, 1);
  await expectStable(page, baseline);
 }
});

test('last valid time follows a valid latest reading and the invalid fallback', async ({ page, request }) => {
 await streamStub(page);
 let state = await initialState(request);
 const latest = state.latest;
 if (!latest?.battery) throw new Error('Missing fixture');
 const lastValidAt = new Date(Date.parse(latest.received_at) - 60000).toISOString();
 await page.route('**/api/v1/telemetry/state', route => route.fulfill({ json: state }));
 await page.route('**/api/v1/battery/history/series?*', route => route.fulfill({ json: sampleHistory() }));
 await page.goto('/'); await expect(page.getByRole('img', { name: 'Заряд 58 відсотків' })).toBeVisible();
 await page.getByText('Про дані та час вимірювань', { exact: true }).click();
 const note = page.locator('.data-details .notice');
 const currentTime = await page.locator('.data-details dd').first().textContent();
 await expect(note).toHaveText(`Останнє коректне вимірювання: ${currentTime}.`);
 let revision = state.revision + 1;
 state = { ...state, revision, latest: { ...latest, revision, state: 'stale', stale: true, mode: 'unknown', reason: 'data_stale' } };
 await emit(page, state); await expect(note).toHaveText(`Останнє коректне вимірювання: ${currentTime}.`);
 revision = state.revision + 1;
 state = { ...state, revision, latest: { ...latest, revision, state: 'invalid', valid: false, mode: 'unknown', reason: 'invalid_measurement', battery: null, last_valid: { received_at: lastValidAt, battery: latest.battery } } };
 await emit(page, state);
 const expected = new Date(lastValidAt).toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' });
 await expect(note).toHaveText(`Останнє коректне вимірювання: ${expected}.`);
 revision = state.revision + 1; state = { ...state, revision, latest: null };
 await emit(page, state); await expect(note).toHaveText('Останнє коректне вимірювання: —.');
});

test('tooltips and chart descriptions preserve Ukrainian numeric values', async ({ page, request }) => {
 await streamStub(page);
 const initial = await initialState(request); const latest = initial.latest;
 if (!latest?.battery) throw new Error('Missing fixture');
 let state: StreamState = { ...initial, latest: { ...latest, mode: 'charge', battery: { ...latest.battery, current_a: 0.04, cells_v: Array.from({ length: 8 }, () => 3.31234), temperatures_c: [22.567] } } };
 const original = sampleHistory();
 let history = { ...original, points: original.points.map((point, index) => ({ ...point, power_w: index === 0 ? -50 : 20, current_a: null })) };
 await page.route('**/api/v1/telemetry/state', route => route.fulfill({ json: state }));
 await page.route('**/api/v1/battery/history/series?*', route => route.fulfill({ json: history }));
 await page.goto('/');
 await expect(page.getByTestId('current-value').locator('.numeric-reading')).toHaveAttribute('title', '0,04 А');
 await expect(page.locator('.cell-reading').first()).toHaveAttribute('title', '3,312 В');
 await expect(page.locator('.temp-row strong').first()).toHaveAttribute('title', '22,567 °C');
 await expect(page.locator('.temp-top .numeric-reading')).toHaveAttribute('title', '22,567 °C');
 await expect(page.getByRole('img', { name: 'Історія потужності. Виміряних точок: 2. Потужність, Вт: від -50 до 20. Проміжків без вимірювань: 1' })).toBeVisible();
 await expect(page.getByRole('img', { name: 'Історія струму. Виміряних точок: 0. Немає значень показника за цей період. Проміжків без вимірювань: 1' })).toBeVisible();
 const currentLatest = state.latest;
 if (!currentLatest?.battery) throw new Error('Missing fixture');
 state = { ...state, latest: { ...currentLatest, battery: { ...currentLatest.battery, current_a: 1.23456789e-19 } } };
 await page.getByRole('button', { name: 'Оновити знімок' }).click();
 await expect(page.getByTestId('current-value').locator('.numeric-reading')).toHaveAttribute('title', /1,235[ЕE]-19 А/);
 history = { ...history, points: [] };
 await page.getByRole('button', { name: 'Оновити знімок' }).click();
 await expect(page.getByRole('img', { name: 'Історія потужності. Виміряних точок: 0. Немає значень показника за цей період. Проміжків без вимірювань: 1' })).toBeVisible();
});

test('horizontal cells use two rows of four with stable centered readings inside', async ({ page, request }, testInfo) => {
 await streamStub(page); await page.emulateMedia({ reducedMotion: 'reduce' });
 let state = await initialState(request);
 const latest = state.latest;
 if (!latest?.battery) throw new Error('Missing fixture');
 state = { ...state, latest: { ...latest, battery: { ...latest.battery, cells_v: [3.3, 3.301, 3.298, 3.3, 3.304, 3.3, 3.299, 3.3] } } };
 await page.route('**/api/v1/telemetry/state', route => route.fulfill({ json: state }));
 await page.route('**/api/v1/battery/history/series?*', route => route.fulfill({ json: sampleHistory() }));
 await page.goto('/');
 await expect(page.locator('.cell-reading strong').first()).toContainText('3,3');
 await expect(page.locator('.cell-body > .cell-reading')).toHaveCount(8);
 const cells = await page.locator('.cell-body').evaluateAll(nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }));
 for (const [index, cell] of cells.entries()) {
  expect(cell.width).toBeGreaterThan(cell.height);
  expect(cell.y).toBeCloseTo(cells[index < 4 ? 0 : 4]?.y ?? NaN, 1);
  if (index >= 4) expect(cell.x).toBeCloseTo(cells[index - 4]?.x ?? NaN, 1);
 }
 expect(cells[4]?.y ?? 0).toBeGreaterThan((cells[0]?.y ?? 0) + (cells[0]?.height ?? 0));
 const centers = await page.locator('.cell').evaluateAll(nodes => nodes.map(node => {
  const body = node.querySelector('.cell-body'); const number = node.querySelector('.cell-reading strong'); const unit = node.querySelector('.cell-unit');
  if (!body || !number || !unit) throw new Error('Missing cell reading');
  const bodyBox = body.getBoundingClientRect();
  const range = document.createRange(); range.selectNodeContents(number); const valueBox = range.getBoundingClientRect();
  range.selectNodeContents(unit); const unitBox = range.getBoundingClientRect();
  return { body: bodyBox.x + bodyBox.width / 2, text: (valueBox.left + unitBox.right) / 2, unit: unitBox.x };
 }));
 for (const center of centers) expect(Math.abs(center.body - center.text)).toBeLessThanOrEqual(1.5);
 await expect(page.locator('.cell-reading strong')).toHaveText(['3,300', '3,301', '3,298', '3,300', '3,304', '3,300', '3,299', '3,300']);
 const revision = state.revision + 1;
 state = { ...state, revision, latest: { ...latest, revision, battery: { ...latest.battery, cells_v: [3, 3.1, 3.12, 3.123, 0, 3.4, 3.45, 3.456] } } };
 await emit(page, state);
 await expect(page.locator('.cell-reading strong')).toHaveText(['3,000', '3,100', '3,120', '3,123', '0,000', '3,400', '3,450', '3,456']);
 const updated = await page.locator('.cell-unit').evaluateAll(nodes => nodes.map(node => { const range = document.createRange(); range.selectNodeContents(node); return range.getBoundingClientRect().x; }));
 updated.forEach((x, index) => expect(x).toBeCloseTo(centers[index]?.unit ?? NaN, 1));
 await page.locator('.cells').screenshot({ path: testInfo.outputPath('centered-cells.png') });
});
