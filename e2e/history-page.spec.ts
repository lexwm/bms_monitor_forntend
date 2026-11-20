import { test, expect, type Page } from '@playwright/test';
import { validateHistorySeries, type HistorySeries } from '../src/api/validation';
import { mockHistory, noOverflow, pendingBin, point, preparedSignal, readyBin, series, stamp, stubStream, ukrainianOnly } from './support';

// Six valid points five seconds apart with distinct values, so the cursor position is visible in the text.
function stepped(): HistorySeries {
 const base = series('10m', 'overview');
 if (base.kind !== 'raw') throw new Error('Expected raw');
 return { ...base, points: Array.from({ length: 6 }, (_, index) => point(index * 5, 'overview', { power_w: 100 + index, current_a: index - 2, voltage_v: 26 + index / 10 })) };
}
const charts = (page: Page) => page.locator('.history-chart');
const readout = (page: Page) => page.getByTestId('cursor-readout');
const announced = (page: Page) => page.getByTestId('cursor-announcement');
// Every chart with points is a keyboard slider named by its title; its text description stays available.
const chart = (page: Page, title: string) => page.getByRole('slider', { name: title, exact: true });
const cursorX = (page: Page) => page.getByTestId('chart-cursor').evaluateAll(nodes => nodes.map(node => node.getAttribute('x1')));

test('history overview has exactly five synchronized charts and every tab fits without horizontal scroll', async ({ page }, testInfo) => {
 const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
 await mockHistory(page);
 await page.goto('/#history');
 await expect(charts(page)).toHaveCount(5);
 await expect(page.locator('.history-chart .panel-title')).toHaveText(['Потужність', 'Струм', 'Заряд', 'Напруга батареї', 'Температури']);
 // Explanations are shown once above the charts; each chart keeps only its own line key.
 await expect(page.getByText('Пропуски не замінюються нулями', { exact: false })).toHaveCount(1);
 await expect(page.getByText('Немає вимірювань', { exact: true })).toHaveCount(1);
 await expect(page.locator('.history-chart .legend')).toHaveText(['Потужність, Вт', 'Струм, А', 'Заряд, %', 'Напруга, В', 'Датчик 01Датчик 02']);
 await expect(page.locator('.history-chart', { hasText: 'Знімок' })).toHaveCount(0);
 await expect(page.getByRole('region', { name: 'Повнота історії' })).toBeVisible();
 await expect(page.getByRole('region', { name: 'Повнота історії' }).getByRole('button', { name: 'Оновити знімок' })).toBeVisible();
 const tabs = page.getByRole('navigation', { name: 'Розділи історії' }).getByRole('link');
 await expect(tabs).toHaveText(['Огляд', 'Комірки', 'Енергія', 'Події']);
 for (const [name, hash] of [['Огляд', '#history'], ['Комірки', '#history/cells'], ['Енергія', '#history/energy'], ['Події', '#history/events']] as const) {
  await tabs.filter({ hasText: name }).click();
  await expect(page).toHaveURL(new RegExp(`${hash}$`));
  await expect(tabs.filter({ hasText: name })).toHaveAttribute('aria-current', 'page');
  await page.waitForTimeout(150);
  expect(await noOverflow(page), `${name} overflow`).toBe(true);
  expect(await ukrainianOnly(page), `${name} language`).toBe(true);
  await page.screenshot({ path: testInfo.outputPath(`history-${hash.replaceAll('/', '-').slice(1)}.png`), fullPage: true });
 }
 await page.getByRole('button', { name: 'Відкрити меню' }).click();
 await expect(page.getByRole('navigation', { name: 'Головне меню' }).getByRole('link', { name: 'Історія' })).toHaveAttribute('aria-current', 'page');
 expect(errors).toEqual([]);
});

test('the cursor moves on all charts together by mouse and arrow keys and is read out as text', async ({ page }) => {
 await mockHistory(page, (range, set) => set === 'overview' && range === '10m' ? stepped() : series(range, set));
 await page.goto('/#history'); await expect(chart(page, 'Потужність')).toHaveAccessibleDescription(/^Потужність\. Виміряних точок: 6/);
 await expect(announced(page)).toHaveAttribute('aria-live', 'polite');
 await expect(readout(page)).not.toHaveAttribute('aria-live');
 const power = chart(page, 'Потужність'); await power.scrollIntoViewIfNeeded();
 const box = await power.boundingBox(); if (!box) throw new Error('Expected chart');
 // Points span 0–25 s of a 600 s period; the far left of the plot is nearest to the first point.
 await page.mouse.move(box.x + 0.5, box.y + box.height * .85);
 await expect(page.getByTestId('chart-cursor')).toHaveCount(5);
 const hovered = await cursorX(page); expect(new Set(hovered).size).toBe(1);
 const first = new Date(stamp(0)).toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' });
 const hoverText = `${first} (Київ). Потужність: 100 Вт. Струм: -2 А. Заряд: 50 %. Напруга батареї: 26 В. Температури: датчик 01 24 °C, датчик 02 26 °C.`;
 await expect(readout(page)).toHaveText(hoverText);
 // The slider carries the same text; a mouse hover is not announced.
 await expect(power).toHaveAttribute('aria-valuetext', hoverText);
 await expect(power).toHaveAttribute('aria-valuenow', '0'); await expect(power).toHaveAttribute('aria-valuemax', '5');
 await expect(announced(page)).toHaveText('');
 await power.focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
 await expect(readout(page)).toContainText('Потужність: 102 Вт. Струм: 0 А.');
 // Keys change the focused slider's value text; the live region stays silent, so the value is not read twice.
 await expect(power).toHaveAttribute('aria-valuetext', await readout(page).innerText());
 await expect(announced(page)).toHaveText('');
 await expect(power).toHaveAttribute('aria-valuenow', '2');
 const moved = await cursorX(page); expect(new Set(moved).size).toBe(1); expect(moved[0]).not.toBe(hovered[0]);
 await page.keyboard.press('ArrowLeft');
 await expect(readout(page)).toContainText('Потужність: 101 Вт. Струм: -1 А.');
 // Up and down move like right and left without scrolling the page; Tab still leaves the chart.
 const scrolled = await page.evaluate(() => scrollY);
 await page.keyboard.press('ArrowUp'); await expect(readout(page)).toContainText('Потужність: 102 Вт.');
 await page.keyboard.press('ArrowDown'); await expect(readout(page)).toContainText('Потужність: 101 Вт.');
 expect(await page.evaluate(() => scrollY)).toBe(scrolled);
 await page.keyboard.press('Tab'); await expect(chart(page, 'Струм')).toBeFocused();
 for (let step = 0; step < 10; step++) await page.keyboard.press('ArrowRight');
 await expect(readout(page)).toContainText('Потужність: 105 Вт.');
 await chart(page, 'Температури').focus(); await page.keyboard.press('ArrowLeft');
 await expect(readout(page)).toContainText('Потужність: 104 Вт.');
 await expect(chart(page, 'Температури')).toHaveAttribute('aria-valuetext', /Потужність: 104 Вт\./);
 await expect(announced(page)).toHaveText('');
 // A new period starts without a cursor instead of jumping to the edge of the old data.
 await page.getByRole('group', { name: 'Період історії' }).getByRole('button', { name: '1 год' }).click();
 await expect(page.getByTestId('chart-cursor')).toHaveCount(0);
 await expect(readout(page)).toContainText('Наведіть курсор');
});

test('touch moves the shared cursor', async ({ page }, testInfo) => {
 test.skip(!testInfo.project.use.hasTouch, 'Touch projects only');
 await mockHistory(page, (range, set) => set === 'overview' && range === '10m' ? stepped() : series(range, set));
 await page.goto('/#history'); await expect(chart(page, 'Потужність')).toHaveAccessibleDescription(/^Потужність\. Виміряних точок: 6/);
 const current = chart(page, 'Струм'); await current.scrollIntoViewIfNeeded();
 const box = await current.boundingBox(); if (!box) throw new Error('Expected chart');
 await page.touchscreen.tap(box.x + 0.5, box.y + box.height * .85);
 await expect(page.getByTestId('chart-cursor')).toHaveCount(5);
 expect(new Set(await cursorX(page)).size).toBe(1);
 await expect(readout(page)).toContainText('Потужність: 100 Вт. Струм: -2 А.');
 // Touch has no hover, so the value is announced.
 await expect(announced(page)).toContainText('Потужність: 100 Вт. Струм: -2 А.');
});

test('a cell deep link highlights that cell and dims the others; pending detail is «готується», not zero', async ({ page }) => {
 const value: HistorySeries = { ...series('1y', 'cells'), bins: [readyBin(0, 300, 'cells'), pendingBin(300, 600, 'cells', 'detail')], detail_processing_status: 'pending', detail_prepared_coverage_seconds: 300 };
 expect(validateHistorySeries(value)).toBe(true);
 await mockHistory(page, (range, set) => set === 'cells' && range === '1y' ? value : series(range, set));
 await page.goto('/#history/cells/4');
 const cells = page.getByRole('region', { name: 'Напруга комірок', exact: true });
 await expect(cells.locator('.chart-strong')).toHaveCount(1);
 await expect(cells.locator('.chart-dim')).toHaveCount(7);
 await expect(cells.locator('.chart-strong .chart-line')).toHaveClass(/gold/);
 await expect(page.getByRole('region', { name: 'Різниця напруг комірок', exact: true })).toBeVisible();
 await expect(page.getByRole('navigation', { name: 'Вибір комірки' }).getByRole('link', { name: 'Комірка 4' })).toHaveAttribute('aria-current', 'page');
 await page.getByRole('group', { name: 'Період історії' }).getByRole('button', { name: 'Рік' }).click();
 await expect(cells.locator('.chart-pending')).toHaveCount(1);
 await expect(page.locator('.quality-summary')).toContainText('Додаткові показники готуються');
 const plot = chart(page, 'Напруга комірок'); await plot.focus(); await page.keyboard.press('End');
 await expect(readout(page)).toContainText('Напруга комірок: комірка 1 готується');
 await expect(readout(page)).toContainText('Різниця напруг комірок: готується');
 await page.keyboard.press('ArrowLeft');
 await expect(readout(page)).toContainText('комірка 4 середнє 3,303 В (мін. 3,293, макс. 3,313)');
 await page.getByRole('navigation', { name: 'Вибір комірки' }).getByRole('link', { name: 'Усі' }).click();
 await expect(page).toHaveURL(/#history\/cells$/);
 await expect(cells.locator('.chart-dim')).toHaveCount(0);
});

test('SVG node count does not depend on the number of points: 1500 intervals × 8 lines', async ({ page }) => {
 const build = (count: number): HistorySeries => {
  const base = series('30d', 'cells');
  return { ...base, to: stamp(count * 300), period_seconds: count * 300, observed_coverage_seconds: count * 300, prepared_coverage_seconds: count * 300, bins: Array.from({ length: count }, (_, index) => readyBin(index * 300, (index + 1) * 300, 'cells', index % 7)), detail_prepared_coverage_seconds: count * 300 };
 };
 let count = 2;
 await mockHistory(page, (range, set) => set === 'cells' && range === '30d' ? build(count) : series(range, set));
 await page.goto('/#history/cells/2');
 await page.getByRole('group', { name: 'Період історії' }).getByRole('button', { name: '30 днів' }).click();
 const cells = page.getByRole('region', { name: 'Напруга комірок', exact: true });
 await expect(cells.getByTestId('history-segment')).toHaveCount(8);
 await page.waitForTimeout(300);
 const nodes = () => cells.locator('.chart-layer:not(.chart-outgoing) svg.chart *').count();
 const small = await nodes();
 count = 1500; await page.getByRole('button', { name: 'Оновити знімок' }).click();
 await expect(page.locator('.quality-summary')).toContainText('450 000 із 450 000 секунд');
 await page.waitForTimeout(300);
 expect(await nodes()).toBe(small);
 await expect(cells.getByTestId('history-segment')).toHaveCount(8);
});

test('chart descriptions keep Ukrainian numbers and a missing metric is not drawn as zero', async ({ page }) => {
 const base = stepped(); if (base.kind !== 'raw') throw new Error('Expected raw');
 const value: HistorySeries = { ...base, points: base.points.slice(0, 2).map((item, index) => ({ ...item, power_w: index === 0 ? -50.5 : 20, current_a: null })), gaps: [{ from: stamp(10), to: stamp(600) }] };
 await mockHistory(page, (range, set) => set === 'overview' && range === '10m' ? value : series(range, set));
 await page.goto('/#history');
 await expect(chart(page, 'Потужність')).toHaveAccessibleDescription('Потужність. Виміряних точок: 2. Потужність, Вт: від -50,5 до 20. Проміжків без вимірювань: 1');
 // A chart without points is an image with its text description, not an operable slider.
 await expect(page.getByRole('img', { name: 'Струм. Виміряних точок: 0. Немає значень показника за цей період. Проміжків без вимірювань: 1', exact: true })).toBeVisible();
 await expect(chart(page, 'Струм')).toHaveCount(0);
 await expect(page.getByRole('region', { name: 'Струм', exact: true }).locator('svg.chart')).not.toHaveAttribute('tabindex');
 // Axis labels use digits by scale, the same for all three labels of a chart.
 await expect(page.getByRole('region', { name: 'Потужність', exact: true }).locator('.chart-y span')).toHaveText(['28,5', '-15,2', '-59']);
 await expect(page.getByRole('region', { name: 'Струм', exact: true }).getByTestId('history-segment')).toHaveCount(0);
 await chart(page, 'Потужність').focus(); await page.keyboard.press('ArrowRight');
 await expect(readout(page)).toContainText('Струм: немає значення');
});

test('without history every chart is an image, not a slider, while loading and after an error', async ({ page }) => {
 await mockHistory(page);
 let release = () => {}; const gate = new Promise<void>(resolve => { release = resolve; });
 await page.unroute('**/api/v1/battery/history/series?*');
 await page.route('**/api/v1/battery/history/series?*', async route => { await gate; await route.fulfill({ status: 503, json: { error: { code: 'database_unavailable', message: 'Unavailable' } } }); });
 await page.goto('/#history');
 await expect(page.getByRole('img', { name: 'Потужність. Завантажуємо історію…', exact: true })).toBeVisible();
 await expect(page.getByRole('slider')).toHaveCount(0); await expect(page.locator('svg.chart[tabindex]')).toHaveCount(0);
 release();
 await expect(page.getByRole('img', { name: 'Потужність. Історія недоступна', exact: true })).toBeVisible();
 await expect(page.getByRole('img', { name: /\. Історія недоступна$/ })).toHaveCount(5);
 await expect(page.getByRole('slider')).toHaveCount(0); await expect(page.locator('svg.chart[tabindex]')).toHaveCount(0);
});

test('a new snapshot keeps the focused chart and its keyboard cursor', async ({ page }) => {
 await stubStream(page); await page.emulateMedia({ reducedMotion: 'no-preference' });
 const frozenAt = new Date(); await page.clock.install({ time: frozenAt }); await page.clock.pauseAt(new Date(frozenAt.getTime() + 1000));
 let shift = 0;
 const changed = (): HistorySeries => { const base = stepped(); if (base.kind !== 'raw') throw new Error('Expected raw'); return { ...base, source_revision: 1 + shift, points: base.points.map(item => ({ ...item, power_w: (item.power_w ?? 0) + shift })) }; };
 const { counts } = await mockHistory(page, (range, set) => set === 'overview' && range === '10m' ? changed() : series(range, set));
 await page.goto('/#history');
 const power = chart(page, 'Потужність'); await expect(power).toHaveAccessibleDescription(/^Потужність\. Виміряних точок: 6/);
 await power.focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
 await expect(power).toHaveAttribute('aria-valuenow', '1'); await expect(power).toBeFocused();
 const node = await power.elementHandle(); if (!node) throw new Error('Expected chart');
 const before = counts.series; shift = 1000;
 await preparedSignal(page, 2); await page.clock.runFor(15000);
 await expect.poll(() => counts.series).toBe(before + 1);
 await expect(power).toHaveAttribute('aria-valuetext', /Потужність: 1101 Вт\./);
 // The same element stays in the DOM and keeps the focus.
 expect(await node.evaluate(element => element.isConnected && element === document.activeElement)).toBe(true);
 await expect(power).toBeFocused();
 await page.keyboard.press('ArrowRight');
 await expect(power).toHaveAttribute('aria-valuenow', '2'); await expect(readout(page)).toContainText('Потужність: 1102 Вт.');
});
