import { test, expect } from '@playwright/test';
import { validateState, validateHistory, type HistoryResponse } from '../src/api/validation';

function sampleHistory(): HistoryResponse {
 const start = Date.parse('2026-11-17T12:00:00Z');
 const stamp = (seconds: number) => new Date(start + seconds * 1000).toISOString();
 const points: HistoryResponse['points'] = [];
 for (let seconds = 0; seconds < 600; seconds += 5) {
  if (seconds >= 240 && seconds < 300) continue;
  const power = Math.round(180 * Math.sin(seconds / 80) - 130);
  points.push({ received_at: stamp(seconds), boot_id: 'ffffffffffff0001', sequence: seconds, valid: true, power_w: seconds === 400 ? null : power, current_a: power / 26.4, soc_percent: 78 });
 }
 return { from: stamp(0), to: stamp(600), revision: 1, period_seconds: 600, observed_coverage_seconds: 540, points, gaps: [{ from: stamp(240), to: stamp(300) }] };
}

test('dashboard preserves real gaps, metric nulls and approved responsive layout', async ({ page }, testInfo) => {
 const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
 const history = sampleHistory(); expect(validateHistory(history)).toBe(true);
 await page.route('**/api/v1/battery/history?*', route => route.fulfill({ json: history }));
 await page.goto('/');
 const power = page.getByRole('region', { name: 'Історія потужності', exact: true });
 const current = page.getByRole('region', { name: 'Історія струму', exact: true });
 await expect(power.getByTestId('history-segment')).toHaveCount(3);
 await expect(current.getByTestId('history-segment')).toHaveCount(2);
 await expect(power.locator('.chart-gap')).toHaveCount(1);
 await expect(page.locator('.quality-value')).toContainText('90');
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
 const heroBox = await page.locator('.hero').boundingBox();
 const currentBox = await page.getByRole('region', { name: 'Струм батареї', exact: true }).boundingBox();
 if (!heroBox || !currentBox) throw new Error('Expected visible cards');
 if (testInfo.project.name === 'desktop') expect(currentBox.x).toBeGreaterThan(heroBox.x + heroBox.width);
 else expect(currentBox.y).toBeGreaterThanOrEqual(heroBox.y + heroBox.height);
 await page.getByRole('button', { name: 'Відкрити меню', exact: true }).click();
 await expect(page.getByRole('navigation', { name: 'Головне меню' })).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(page.getByRole('navigation', { name: 'Головне меню' })).toBeHidden();
 await expect(page.getByRole('button', { name: 'Відкрити меню', exact: true })).toBeFocused();
 await page.emulateMedia({ reducedMotion: 'reduce' });
 expect(await page.locator('.soc-arc').first().evaluate(el => getComputedStyle(el).transitionDuration)).toBe('0s');
 expect(await page.locator('.reading-update').first().evaluate(el => getComputedStyle(el).animationName)).toBe('none');
 await page.screenshot({ path: testInfo.outputPath('dashboard.png'), fullPage: true });
 expect(errors).toEqual([]);
});

test('missing readings and empty history never appear as zero measurements', async ({ page, request }) => {
 const response = await request.get('/api/v1/telemetry/state'); const state: unknown = await response.json();
 if (!validateState(state) || !state.latest?.battery) throw new Error('Expected fixture');
 const empty = { ...state, latest: { ...state.latest, battery: { ...state.latest.battery, soc_percent: null, current_a: null, power_w: null, cells_v: null, temperatures_c: null } } };
 expect(validateState(empty)).toBe(true);
 await page.route('**/api/v1/telemetry/state', route => route.fulfill({ json: empty }));
 const history = sampleHistory();
 await page.route('**/api/v1/battery/history?*', route => route.fulfill({ json: { ...history, points: [], observed_coverage_seconds: 0, gaps: [{ from: history.from, to: history.to }] } }));
 await page.goto('/');
 await expect(page.getByRole('img', { name: 'Заряд невідомий' })).toBeVisible();
 await expect(page.getByTestId('power-value')).toContainText('—');
 await expect(page.getByTestId('current-value')).toContainText('—');
 await expect(page.locator('.cell-fill')).toHaveCount(0);
 await expect(page.getByText('Немає показань температури', { exact: true })).toBeVisible();
 await expect(page.getByTestId('history-segment')).toHaveCount(0);
 await expect(page.getByText('Немає значень показника за цей період', { exact: true })).toHaveCount(2);
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('history failure retains a clearly labelled snapshot', async ({ page }) => {
 let failed = false;
 await page.route('**/api/v1/battery/history?*', route => route.fulfill(failed ? { status: 503, json: { error: { code: 'database_unavailable', message: 'Unavailable' } } } : { json: sampleHistory() }));
 await page.goto('/'); await expect(page.getByTestId('history-segment')).toHaveCount(5);
 failed = true; await page.getByRole('button', { name: 'Оновити знімок' }).click();
 await expect(page.getByText('Не вдалося оновити історію. Збережений знімок може бути застарілим.', { exact: true })).toBeVisible();
 await expect(page.getByTestId('history-segment')).toHaveCount(5);
});
