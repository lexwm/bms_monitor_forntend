import type { APIRequestContext, Page, Route } from '@playwright/test';
import { validateState, type StreamState, type HistoryRange, type HistorySeries, type HistoryBin, type HistoryMetricSummary, type HistoryPoint, type HistorySet, type EnergyDaily, type BatteryEventPage } from '../src/api/validation';

// Shared mocks for the history, energy and event specs. Every builder returns a contract-shaped value.
export const boot = 'ffffffffffff0001';
export const stamp = (seconds: number) => new Date(Date.UTC(2026, 10, 18, 12) + seconds * 1000).toISOString();
export const ranges: ReadonlyArray<readonly [HistoryRange, string]> = [['10m', '10 хв'], ['1h', '1 год'], ['12h', '12 год'], ['24h', '24 год'], ['30d', '30 днів'], ['3mo', 'Квартал'], ['1y', 'Рік']];
export const rawRange = (range: HistoryRange) => range === '10m' || range === '1h';

export function metric(from: number, to: number, changes: Partial<HistoryMetricSummary> = {}): HistoryMetricSummary {
 return { count: (to - from) / 5, mean: 10, min: -100, max: 200, observed_coverage_seconds: to - from, continuous: true, first_at: stamp(from), last_at: stamp(to - 5), first_boot: boot, last_boot: boot, ...changes };
}
const compact = (mean: number, count: number, spread = 1) => ({ count, mean, min: mean - spread, max: mean + spread });
// A complete interval with every set's additional values; pending intervals have none.
export function readyBin(from: number, to: number, set: HistorySet, index = 0): HistoryBin {
 const base: HistoryBin = { from: stamp(from), to: stamp(to), status: 'ready', observed_coverage_seconds: to - from, power_w: metric(from, to), current_a: metric(from, to) };
 if (set === 'basic') return base;
 const count = (to - from) / 5;
 const detail = { count, observed_coverage_seconds: to - from, continuous: true, first_at: stamp(from), last_at: stamp(to - 5), first_boot: boot, last_boot: boot };
 return set === 'overview' ? { ...base, detail_status: 'ready', detail, soc_percent: compact(60 + index, count), voltage_v: compact(26.4, count, .1), temperatures_c: [compact(24, count), compact(26, count)] }
  : { ...base, detail_status: 'ready', detail, cells_v: Array.from({ length: 8 }, (_, cell) => compact(3.3 + cell / 1000 + index / 10000, count, .01)), cell_delta_mv: compact(8 + index, count, 2) };
}
export function pendingBin(from: number, to: number, set: HistorySet, status: 'pending' | 'detail' = 'pending'): HistoryBin {
 if (status === 'detail') {
  const ready = readyBin(from, to, 'basic');
  return set === 'basic' ? ready : { ...ready, detail_status: 'pending', detail: null, ...(set === 'overview' ? { soc_percent: null, voltage_v: null, temperatures_c: null } : { cells_v: null, cell_delta_mv: null }) };
 }
 const base: HistoryBin = { from: stamp(from), to: stamp(to), status: 'pending', observed_coverage_seconds: null, power_w: null, current_a: null };
 return set === 'basic' ? base : { ...base, detail_status: 'pending', detail: null };
}
export function point(seconds: number, set: HistorySet, changes: Partial<HistoryPoint> = {}): HistoryPoint {
 const base: HistoryPoint = { received_at: stamp(seconds), sequence: seconds, boot_id: boot, valid: true, power_w: 10, current_a: 1, soc_percent: 50 };
 const extra: Partial<HistoryPoint> = set === 'overview' ? { voltage_v: 26.4, temperatures_c: [24, 26] } : set === 'cells' ? { cells_v: Array.from({ length: 8 }, (_, cell) => 3.3 + cell / 1000), cell_delta_mv: 8 } : {};
 return { ...base, ...extra, ...changes };
}
export function series(range: HistoryRange = '10m', set: HistorySet = 'basic', pending = false): HistorySeries {
 const common = { range, from: stamp(0), to: stamp(600), period_seconds: 600, source_revision: 1, aggregate_revision: 1, prepared_at: stamp(600), processing_status: 'ready' as const, observed_coverage_seconds: 600, prepared_coverage_seconds: 600 };
 if (rawRange(range)) return { ...common, kind: 'raw', resolution_seconds: 0, gaps: [], points: [0, 5].map(seconds => point(seconds, set)) };
 const bins = [readyBin(0, 300, set), pending ? pendingBin(300, 600, set) : readyBin(300, 600, set, 1)];
 const detail = set === 'basic' ? {} : { detail_processing_status: pending ? 'pending' as const : 'ready' as const, detail_prepared_coverage_seconds: pending ? 300 : 600 };
 return { ...common, kind: 'aggregate', resolution_seconds: 300, bins, ...detail, ...(pending ? { processing_status: 'pending', observed_coverage_seconds: null, prepared_coverage_seconds: 300 } : {}) };
}
export const requested = (route: Route) => { const url = new URL(route.request().url()); return { range: url.searchParams.get('range'), set: url.searchParams.get('set') ?? 'basic', limit: url.searchParams.get('limit'), before: url.searchParams.get('before') }; };
export const knownRange = (value: string | null): HistoryRange => ranges.find(item => item[0] === value)?.[0] ?? '10m';
export const knownSet = (value: string): HistorySet => value === 'overview' || value === 'cells' ? value : 'basic';
export function energy(range: EnergyDaily['range'] = '30d', changes: Partial<EnergyDaily> = {}): EnergyDaily {
 return { range, time_zone: 'Europe/Kyiv', as_of: '2026-11-20T10:15:00.000000Z', prepared_from: '2026-11-17T16:55:00.000000Z', days: [], ...changes };
}
export const noEvents = (changes: Partial<BatteryEventPage> = {}): BatteryEventPage => ({ as_of: '2026-11-20T10:15:00.000000Z', latest_important_at: null, events: [], next_before: null, ...changes });

// Counts requests per endpoint; series answers come from a builder so tests can change them.
export async function mockHistory(page: Page, answer: (range: HistoryRange, set: HistorySet) => HistorySeries | Promise<HistorySeries> = (range, set) => series(range, set)) {
 const calls: string[] = []; const counts = { series: 0, energy: 0, events: 0 };
 await page.route('**/api/v1/battery/history/series?*', async route => { const { range, set } = requested(route); calls.push(`${range}:${set}`); counts.series++; await route.fulfill({ json: await answer(knownRange(range), knownSet(set)) }).catch(() => {}); });
 await page.route('**/api/v1/battery/energy/daily?*', route => { counts.energy++; return route.fulfill({ json: energy() }); });
 await page.route('**/api/v1/battery/events?*', route => { counts.events++; return route.fulfill({ json: noEvents() }); });
 return { calls, counts };
}

// Replaces the hub connection; tests dispatch named stream events through the window.
export async function stubStream(page: Page) {
 await page.addInitScript(() => {
  Object.defineProperty(window, 'EventSource', { value: class extends EventTarget {
   message = (event: Event) => {
    if (!(event instanceof CustomEvent)) return;
    const type = String(event.detail.type);
    this.dispatchEvent(type === 'open' || type === 'error' ? new Event(type) : new MessageEvent(type, { data: JSON.stringify(event.detail.data) }));
   };
   constructor() { super(); document.documentElement.dataset.streamCount = String(Number(document.documentElement.dataset.streamCount ?? 0) + 1); window.addEventListener('test-sse', this.message); }
   close() { document.documentElement.dataset.streamCount = String(Number(document.documentElement.dataset.streamCount ?? 0) - 1); window.removeEventListener('test-sse', this.message); }
  } });
 });
}
export async function emit(page: Page, type: string, data: unknown = {}) {
 await page.evaluate(detail => window.dispatchEvent(new CustomEvent('test-sse', { detail })), { type, data });
}
export const preparedSignal = (page: Page, revision: number) => emit(page, 'history.updated.v1', { schema: 1, aggregate_revision: revision, prepared_at: stamp(600 + revision) });
export async function measurementSignal(page: Page, state: StreamState, revision: number) {
 await emit(page, 'telemetry.updated.v1', { schema: 1, revision, server_time: state.server_time, history_changed: true, latest: state.latest ? { ...state.latest, revision } : null });
}
export async function setHidden(page: Page, hidden: boolean) {
 await page.evaluate(value => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => value }); document.dispatchEvent(new Event('visibilitychange')); }, hidden);
}
export async function freshState(request: APIRequestContext): Promise<StreamState> {
 const raw: unknown = await (await request.get('/api/v1/telemetry/state')).json();
 if (!validateState(raw) || raw.latest?.battery == null) throw new Error('Expected local fixture');
 const now = new Date().toISOString();
 return { ...raw, server_time: now, latest: { ...raw.latest, state: 'fresh', valid: true, stale: false, reason: null, last_valid: null, mode: 'discharge', received_at: now, server_time: now, age_seconds: 0, battery: raw.latest.battery } };
}
export async function mockState(page: Page, state: () => StreamState) {
 let count = 0;
 await page.route('**/api/v1/telemetry/state', route => { count++; return route.fulfill({ json: state() }); });
 return () => count;
}
export const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
// Interface text and accessible names must be Ukrainian; measurement symbols and scientific notation are allowed.
export async function ukrainianOnly(page: Page) {
 const text = await page.locator('main').evaluate(root => [root.textContent, ...Array.from(root.querySelectorAll('[aria-label],[title]')).flatMap(node => [node.getAttribute('aria-label'), node.getAttribute('title')])].join(' '));
 return !/[a-zыэъё]/i.test(text.replaceAll('°C', '').replace(/E[+-]?\d+/g, ''));
}
