import { test, expect } from '@playwright/test';
import { validateState, validateHistorySeries, type HistorySeries } from '../src/api/validation';
import { mockHistory, series, pendingBin, readyBin, noOverflow, requested, knownRange, knownSet } from './support';

// The dashboard keeps current readings only; history charts and completeness live on the history page.
test('dashboard has no charts, links cells to their history and keeps the approved responsive layout', async ({ page }, testInfo) => {
 const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
 const { calls } = await mockHistory(page);
 await page.goto('/');
 await expect(page.locator('.hero')).toBeVisible();
 await expect(page.locator('.history-chart')).toHaveCount(0);
 await expect(page.getByText('Повнота історії', { exact: true })).toHaveCount(0);
 await expect(page.locator('svg.chart')).toHaveCount(0);
 await expect(page.getByRole('button', { name: 'Оновити знімок' })).toBeVisible();
 await expect(page.getByTestId('day-range-cells')).toHaveText('За 24 год: мін. 3,29 В · макс. 3,317 В · найбільша Δ 11 мВ');
 expect(await noOverflow(page)).toBe(true);
 const heroBox = await page.locator('.hero').boundingBox();
 const currentBox = await page.getByRole('region', { name: 'Струм батареї', exact: true }).boundingBox();
 if (!heroBox || !currentBox) throw new Error('Expected visible cards');
 if (testInfo.project.name === 'desktop') expect(currentBox.x).toBeGreaterThan(heroBox.x + heroBox.width);
 else expect(currentBox.y).toBeGreaterThanOrEqual(heroBox.y + heroBox.height);
 await page.getByRole('button', { name: 'Відкрити меню', exact: true }).click();
 await expect(page.getByRole('navigation', { name: 'Головне меню' }).getByRole('link')).toHaveText(['Огляд', 'Історія', 'Налаштування батареї']);
 await page.keyboard.press('Escape');
 await expect(page.getByRole('navigation', { name: 'Головне меню' })).toBeHidden();
 await expect(page.getByRole('button', { name: 'Відкрити меню', exact: true })).toBeFocused();
 await page.emulateMedia({ reducedMotion: 'reduce' });
 expect(await page.locator('.soc-arc').first().evaluate(el => getComputedStyle(el).transitionDuration)).toBe('0s');
 expect(await page.locator('.reading-update').first().evaluate(el => getComputedStyle(el).animationName)).toBe('none');
 await page.screenshot({ path: testInfo.outputPath('dashboard.png'), fullPage: true });
 // Requests of the dashboard: the 10-minute window and the two 24-hour summaries, nothing for the charts.
 expect([...new Set(calls)].sort()).toEqual(['10m:basic', '24h:cells', '24h:overview']);
 const cell = page.getByRole('link', { name: /^Комірка 03:/ });
 await cell.click();
 await expect(page).toHaveURL(/#history\/cells\/3$/);
 await expect(page.getByRole('navigation', { name: 'Вибір комірки' }).getByRole('link', { name: 'Комірка 3' })).toHaveAttribute('aria-current', 'page');
 expect(errors).toEqual([]);
});

test('24-hour range shows lowest and highest values of all cells and sensors, a dash without values and «готується» while pending', async ({ page }) => {
 let mode: 'ready' | 'empty' | 'pending' = 'ready';
 await mockHistory(page, (range, set) => {
  if (range !== '24h') return series(range, set);
  const base = series('24h', set);
  if (base.kind !== 'aggregate') throw new Error('Expected aggregate');
  const bins = mode === 'pending' ? [readyBin(0, 300, set), pendingBin(300, 600, set, 'detail')] : mode === 'empty' ? [{ ...readyBin(0, 300, 'basic'), detail_status: 'ready' as const, detail: null }] : base.bins;
  const value: HistorySeries = { ...base, bins };
  expect(validateHistorySeries(value)).toBe(true);
  return value;
 });
 await page.goto('/');
 await expect(page.getByTestId('day-range-cells')).toContainText('мін. 3,29 В · макс. 3,317 В · найбільша Δ 11 мВ');
 await expect(page.getByTestId('day-range-temperatures')).toHaveText('За 24 год: мін. 23 °C · макс. 27 °C');
 mode = 'pending'; await page.getByRole('button', { name: 'Оновити знімок' }).click();
 await expect(page.getByTestId('day-range-cells')).toHaveText('За 24 год: готується');
 await expect(page.getByTestId('day-range-temperatures')).toHaveText('За 24 год: готується');
 mode = 'empty'; await page.getByRole('button', { name: 'Оновити знімок' }).click();
 await expect(page.getByTestId('day-range-cells')).toHaveText('За 24 год: —');
 await expect(page.getByTestId('day-range-temperatures')).toHaveText('За 24 год: —');
});

test('missing readings never appear as zero measurements', async ({ page, request }) => {
 const response = await request.get('/api/v1/telemetry/state'); const state: unknown = await response.json();
 if (!validateState(state) || !state.latest?.battery) throw new Error('Expected fixture');
 const empty = { ...state, latest: { ...state.latest, battery: { ...state.latest.battery, soc_percent: null, current_a: null, power_w: null, cells_v: null, temperatures_c: null } } };
 expect(validateState(empty)).toBe(true);
 await page.route('**/api/v1/telemetry/state', route => route.fulfill({ json: empty }));
 await mockHistory(page);
 await page.goto('/');
 await expect(page.getByRole('img', { name: 'Заряд невідомий' })).toBeVisible();
 await expect(page.getByTestId('power-value')).toContainText('—');
 await expect(page.getByTestId('current-value')).toContainText('—');
 await expect(page.locator('.cell-fill')).toHaveCount(0);
 await expect(page.getByRole('link', { name: 'Комірка 01: немає даних. Історія комірки' })).toBeVisible();
 await expect(page.getByText('Немає показань температури', { exact: true })).toBeVisible();
 expect(await noOverflow(page)).toBe(true);
});

test('a failed 24-hour refresh keeps the snapshot and says it was not updated', async ({ page }) => {
 let failed = false;
 await page.route('**/api/v1/battery/history/series?*', route => { const { range, set } = requested(route); return route.fulfill(failed && range === '24h' ? { status: 503, json: { error: { code: 'database_unavailable', message: 'Unavailable' } } } : { json: series(knownRange(range), knownSet(set)) }); });
 await page.goto('/'); await expect(page.getByTestId('day-range-cells')).toContainText('мін. 3,29 В');
 failed = true; await page.getByRole('button', { name: 'Оновити знімок' }).click();
 await expect(page.getByTestId('day-range-cells')).toContainText('мін. 3,29 В');
 await expect(page.getByTestId('day-range-cells')).toContainText('не оновлено');
});
