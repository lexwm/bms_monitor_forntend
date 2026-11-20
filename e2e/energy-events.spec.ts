import { test, expect, type Page } from '@playwright/test';
import { validateBatteryEventPage, validateEnergyDaily, type BatteryEvent, type BatteryEventPage, type EnergyDaily } from '../src/api/validation';
import { emit, energy, mockHistory, noEvents, noOverflow, preparedSignal, requested, stubStream, ukrainianOnly } from './support';

const warning = 'Струми, менші приблизно за 2,5 А, можуть реєструватися як 0, тому значення можуть бути заниженими';
const day = (date: string, status: EnergyDaily['days'][number]['status'], coverage: number, charged: number | null = null, discharged: number | null = null) => ({ date, day_seconds: 86400 as const, observed_coverage_seconds: coverage, charged_wh: charged, discharged_wh: discharged, status });
function daily(range: EnergyDaily['range']): EnergyDaily {
 return energy(range, { days: [
  day('2026-11-14', 'ready', 0), day('2026-11-15', 'outside', 0), day('2026-11-16', 'ready', 86400, 1234.5, 2000),
  day('2026-11-17', 'partial', 25200, 300, 400), day('2026-11-18', 'partial', 0), day('2026-11-19', 'partial', 43200, 0.4, 5150.25), day('2026-11-20', 'partial', 36900, 120, 80),
 ] });
}
const row = (page: Page, date: string) => page.locator(`[data-testid="energy-day"][data-date="${date}"]`);

test('energy shows registered kWh per Kyiv day with D3 labels, coverage and the permanent warning', async ({ page }, testInfo) => {
 await mockHistory(page);
 const asked: string[] = [];
 await page.unroute('**/api/v1/battery/energy/daily?*');
 await page.route('**/api/v1/battery/energy/daily?*', route => { const range = requested(route).range === '1y' ? '1y' : requested(route).range === '3mo' ? '3mo' : '30d'; asked.push(range); const value = daily(range); expect(validateEnergyDaily(value)).toBe(true); return route.fulfill({ json: value }); });
 await page.goto('/#history/energy');
 const panel = page.getByRole('region', { name: 'Зареєстрована енергія', exact: true });
 await expect(panel.getByTestId('energy-warning')).toHaveText(warning);
 await expect(panel.getByRole('heading')).toHaveText('Зареєстрована енергія по днях');
 await expect(panel.locator('.micro')).toHaveText('30 днів · вибраний період 10 хв коротший за 30 днів');
 expect(asked.at(-1)).toBe('30d');
 await expect(row(page, '2026-11-20')).toContainText('сьогодні, станом на 12:15');
 await expect(row(page, '2026-11-20').locator('.energy-bar')).toHaveCount(2);
 await expect(row(page, '2026-11-19')).toContainText('готується');
 await expect(row(page, '2026-11-19')).toContainText('Заряджено 0,00 кВт·год');
 await expect(row(page, '2026-11-19')).toContainText('Віддано 5,15 кВт·год');
 await expect(row(page, '2026-11-19')).toContainText('покриття 50 %');
 await expect(row(page, '2026-11-18')).toContainText('готується');
 await expect(row(page, '2026-11-18').locator('.energy-bar')).toHaveCount(0);
 await expect(row(page, '2026-11-17')).toContainText('частково');
 await expect(row(page, '2026-11-17').locator('.energy-bar')).toHaveCount(2);
 await expect(row(page, '2026-11-16')).toContainText('Заряджено 1,23 кВт·год');
 await expect(row(page, '2026-11-16')).toContainText('покриття 100 %');
 await expect(row(page, '2026-11-16').locator('.energy-label')).toHaveCount(0);
 for (const date of ['2026-11-15', '2026-11-14']) {
  await expect(row(page, date)).toContainText('немає даних');
  await expect(row(page, date).locator('.energy-bar')).toHaveCount(0);
 }
 await expect(page.locator('[data-testid="energy-day"]').first()).toHaveAttribute('data-date', '2026-11-20');
 await page.getByRole('group', { name: 'Період історії' }).getByRole('button', { name: 'Квартал' }).click();
 await expect(panel.locator('.micro')).toHaveText('Квартал'); expect(asked.at(-1)).toBe('3mo');
 await expect(panel.getByTestId('energy-warning')).toHaveText(warning);
 expect(await noOverflow(page)).toBe(true); expect(await ukrainianOnly(page)).toBe(true);
 await page.screenshot({ path: testInfo.outputPath('energy.png'), fullPage: true });
});

const event = (kind: BatteryEvent['kind'], sequence: number, changes: Partial<BatteryEvent> = {}): BatteryEvent => ({ occurred_at: `2026-11-20T10:${String(59 - sequence).padStart(2, '0')}:00.000000Z`, boot_id: 'ffffffffffff0001', sequence, kind, bit: kind.startsWith('protection') ? 0 : null, label: kind.startsWith('protection') ? 'Захист: висока напруга комірки' : kind.startsWith('charge') ? 'Зарядний ключ' : 'Розрядний ключ', severity: 'info', after_gap: false, ...changes });

test('the journal words events by kind, marks gaps and loads older pages by cursor', async ({ page }) => {
 await mockHistory(page);
 const first: BatteryEventPage = noEvents({ latest_important_at: '2026-11-20T10:58:00.000000Z', next_before: 'cursor~1', events: [event('protection_cleared', 1), event('protection_set', 2, { severity: 'important', after_gap: true }), event('charge_mos_off', 3), event('protection_set', 4, { bit: 12, label: 'Програмне блокування ключів' })] });
 const second: BatteryEventPage = noEvents({ events: [event('discharge_mos_on', 5)] });
 expect(validateBatteryEventPage(first) && validateBatteryEventPage(second)).toBe(true);
 const befores: (string | null)[] = [];
 await page.unroute('**/api/v1/battery/events?*');
 await page.route('**/api/v1/battery/events?*', route => { const query = requested(route); if (query.limit === '1') return route.fulfill({ json: first }); befores.push(query.before); return route.fulfill({ json: query.before ? second : first }); });
 await page.goto('/#history/events');
 const journal = page.getByRole('region', { name: 'Журнал подій', exact: true });
 await expect(journal).toContainText('За даними батареї; тлумачення сигналів захисту не підтверджено');
 const items = journal.getByTestId('battery-event');
 await expect(items).toHaveCount(4);
 await expect(items.nth(0)).toContainText('Сигнал зник: Захист: висока напруга комірки');
 await expect(items.nth(0)).toContainText('Інформація');
 await expect(items.nth(1)).toContainText('Сигнал з’явився: Захист: висока напруга комірки');
 await expect(items.nth(1)).toContainText('Важлива подія');
 await expect(items.nth(1)).toContainText('Після проміжку без вимірювань: точний момент невідомий');
 await expect(items.nth(0)).not.toContainText('Після проміжку');
 await expect(items.nth(2)).toContainText('Зарядний ключ вимкнено');
 await expect(items.nth(3)).toContainText('Сигнал з’явився: Програмне блокування ключів');
 await expect(items.nth(3)).toContainText('Інформація');
 await expect(page.getByRole('group', { name: 'Період історії' })).toHaveCount(0);
 await journal.getByRole('button', { name: 'Показати старіші події' }).click();
 await expect(items).toHaveCount(5);
 await expect(items.nth(4)).toContainText('Розрядний ключ увімкнено');
 expect(befores).toContain('cursor~1');
 await expect(journal.getByRole('button', { name: 'Показати старіші події' })).toHaveCount(0);
 expect(await noOverflow(page)).toBe(true); expect(await ukrainianOnly(page)).toBe(true);
});

// Bell answers can be held, so a «dark» check is made only after the page has rendered that exact answer.
async function bellSetup(page: Page) {
 await stubStream(page); await mockHistory(page);
 let latest: string | null = null; let bellCalls = 0; let gate: Promise<void> | null = null;
 await page.unroute('**/api/v1/battery/events?*');
 await page.route('**/api/v1/battery/events?*', async route => { if (requested(route).limit === '1') { bellCalls++; await gate; } await route.fulfill({ json: noEvents({ latest_important_at: latest }) }); });
 return {
  set: (value: string | null) => { latest = value; }, calls: () => bellCalls,
  // Triggers one bell request, waits until it is in flight, releases it and waits for its answer on the page.
  async answer(trigger: () => Promise<void>) {
   let release = () => {}; gate = new Promise(resolve => { release = resolve; });
   const calls = bellCalls; await trigger();
   await expect.poll(() => bellCalls).toBeGreaterThan(calls);
   await expect(bell(page)).toHaveAttribute('data-ready', 'false');
   gate = null; release();
   await expect(bell(page)).toHaveAttribute('data-ready', 'true');
  },
 };
}
const bell = (page: Page) => page.getByTestId('bell');
const settled = (page: Page) => expect(bell(page)).toHaveAttribute('data-ready', 'true');

test('the bell stays dark for informational events and has a text state', async ({ page }) => {
 await bellSetup(page);
 await page.goto('/');
 await settled(page);
 await expect(bell(page)).toHaveAccessibleName('Журнал подій');
 await expect(bell(page)).not.toHaveClass(/lit/);
});

test('an important episode lights the bell until the journal is opened, also after reload and repeated responses, and a newer one lights it again', async ({ page }) => {
 const server = await bellSetup(page); server.set('2026-11-20T10:00:00.000000Z');
 const frozenAt = new Date(); await page.clock.install({ time: frozenAt }); await page.clock.pauseAt(new Date(frozenAt.getTime() + 1000));
 await page.goto('/');
 await settled(page);
 await expect(bell(page)).toHaveClass(/lit/);
 await expect(bell(page)).toHaveAccessibleName('Журнал подій. Є нові важливі події');
 await bell(page).click();
 await expect(page).toHaveURL(/#history\/events$/);
 await expect(bell(page)).not.toHaveClass(/lit/);
 // The reload happens on the overview, so only the stored mark can keep the bell dark.
 await page.evaluate(() => { location.hash = '#overview'; });
 await expect(page.locator('.hero')).toBeVisible();
 await page.reload();
 await expect(page.locator('.hero')).toBeVisible();
 await settled(page);
 await expect(page.getByRole('region', { name: 'Журнал подій', exact: true })).toHaveCount(0);
 await expect(bell(page)).not.toHaveClass(/lit/);
 // A later response with the same episode keeps it dark.
 await server.answer(async () => { await preparedSignal(page, 50); await page.clock.runFor(60000); });
 await expect(bell(page)).not.toHaveClass(/lit/);
 // The journal opened while the server has no important episode must not erase the mark:
 // the same episode served again afterwards would light the bell if it had.
 server.set(null);
 await page.evaluate(() => { location.hash = '#history/events'; });
 await expect(page.getByRole('region', { name: 'Журнал подій', exact: true })).toContainText('Подій поки немає.');
 await page.evaluate(() => { location.hash = '#overview'; });
 await expect(page.locator('.hero')).toBeVisible();
 server.set('2026-11-20T10:00:00.000000Z');
 await server.answer(async () => { await preparedSignal(page, 51); await page.clock.runFor(60000); });
 await expect(bell(page)).not.toHaveClass(/lit/);
 server.set('2026-11-20T10:31:00.000000Z');
 await server.answer(async () => { await preparedSignal(page, 52); await page.clock.runFor(60000); });
 await expect(bell(page)).toHaveClass(/lit/);
});

test('the bell works when browser storage is unavailable', async ({ page }) => {
 const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
 await page.addInitScript(() => { Object.defineProperty(window, 'localStorage', { configurable: true, get: () => { throw new Error('Storage is blocked'); } }); });
 const server = await bellSetup(page); server.set('2026-11-20T10:00:00.000000Z');
 await page.goto('/');
 await settled(page);
 await expect(bell(page)).toHaveClass(/lit/);
 await bell(page).click();
 await expect(page.getByRole('region', { name: 'Журнал подій', exact: true })).toBeVisible();
 await expect(bell(page)).not.toHaveClass(/lit/);
 // A recovered stream asks the bell again; the mark kept in memory still holds.
 await server.answer(() => emit(page, 'open'));
 await expect(bell(page)).not.toHaveClass(/lit/);
 expect(errors).toEqual([]);
});
