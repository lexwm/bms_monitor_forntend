import { expect, it } from 'vitest';
import { estimateTime } from '../src/estimate';

it('projects discharge from the remaining capacity and charge from the missing capacity', () => {
 expect(estimateTime(-12.5, 116, 200)).toEqual({ target: 'empty', minutes: 557 });
 expect(estimateTime(20, 116, 200)).toEqual({ target: 'full', minutes: 252 });
 expect(estimateTime(20, 200, 200)).toEqual({ target: 'full', minutes: 0 });
 // Discharge does not need the declared capacity.
 expect(estimateTime(-10, 50, null)).toEqual({ target: 'empty', minutes: 300 });
});

it('gives no estimate without a direction or without the needed counters', () => {
 expect(estimateTime(0, 116, 200)).toBeNull();
 expect(estimateTime(null, 116, 200)).toBeNull();
 expect(estimateTime(-5, null, 200)).toBeNull();
 expect(estimateTime(5, 116, null)).toBeNull();
 expect(estimateTime(5, 210, 200)).toBeNull();
 expect(estimateTime(-5, -1, 200)).toBeNull();
 expect(estimateTime(Number.NaN, 116, 200)).toBeNull();
});

import { averageCurrent, endLabel, projectTime } from '../src/estimate';
import type { RawHistorySeries } from '../src/api/validation';
const at = (seconds: number) => new Date(Date.UTC(2026, 10, 20, 10, 0, seconds)).toISOString();
function window(currents: (number | null)[], coverage = 600, changes: Partial<RawHistorySeries> = {}): RawHistorySeries {
 return { kind: 'raw', range: '10m', resolution_seconds: 0, aggregate_revision: 1, prepared_at: null, processing_status: 'ready', prepared_coverage_seconds: 600, from: at(0), to: at(600), period_seconds: 600, source_revision: 1, observed_coverage_seconds: coverage, gaps: [],
  points: currents.map((current_a, index) => ({ received_at: at(index * 5), boot_id: 'ffffffffffff0001', sequence: index, valid: true, current_a, power_w: null, soc_percent: null })), ...changes };
}
const now = Date.parse(at(600));
const average = (history: RawHistorySeries, healthy: boolean) => averageCurrent(history, healthy, false, now);
it('averages ten minutes only for fresh, covered, one-direction windows without zeros or gaps in the value', () => {
 expect(average(window([-10, -12, -14]), true)).toBe(-12);
 expect(average(window([10, 20]), true)).toBe(15);
 expect(average(window([-10, -12]), false)).toBeNull();
 expect(average(window([-10, -12], 299), true)).toBeNull();
 expect(average(window([-10, -12], 300), true)).toBe(-11);
 expect(average(window([-10, 0, -12]), true)).toBeNull();
 expect(average(window([-10, 5]), true)).toBeNull();
 expect(average(window([-10, null]), true)).toBeNull();
 expect(average(window([]), true)).toBeNull();
 expect(average(window([-10], 600, { range: '1h' }), true)).toBeNull();
 const invalid = window([-10, -12]); const second = invalid.points[1]; if (second) second.valid = false;
 expect(average(invalid, true)).toBeNull();
});
it('does not use a kept window after a failed request or a window that ended long before the latest measurement', () => {
 expect(averageCurrent(window([-10, -12]), true, false, now + 30000)).toBe(-11);
 // The tab was hidden or requests stopped: the window ends more than 30 s before the measurement.
 expect(averageCurrent(window([-10, -12]), true, false, now + 30001)).toBeNull();
 expect(averageCurrent(window([-10, -12]), true, false, now + 10 * 60000)).toBeNull();
 // The last request failed, so the shown window is the previous snapshot.
 expect(averageCurrent(window([-10, -12]), true, true, now)).toBeNull();
 expect(averageCurrent(window([-10, -12], 600, { to: 'not a time' }), true, false, now)).toBeNull();
});
it('uses the average when available, otherwise the instant current, and refuses a zero instant current', () => {
 const measured = Date.parse('2026-11-20T10:00:00Z');
 expect(projectTime(-10, -20, 100, 200, measured)).toEqual({ status: 'ready', basis: 'average', estimate: { target: 'empty', minutes: 300 }, endsAt: measured + 300 * 60000 });
 expect(projectTime(-10, null, 100, 200, measured)).toMatchObject({ status: 'ready', basis: 'instant', estimate: { minutes: 600 } });
 // A window of the opposite direction does not describe the present one.
 expect(projectTime(10, -20, 100, 200, measured)).toMatchObject({ basis: 'instant', estimate: { target: 'full' } });
 expect(projectTime(0, -20, 100, 200, measured)).toEqual({ status: 'zero' });
 expect(projectTime(null, null, 100, 200, measured)).toEqual({ status: 'unavailable' });
});
it('shows the Kyiv end time, with the date only when it is not the same Kyiv day', () => {
 const now = Date.parse('2026-11-20T10:00:00Z'); // 12:00 Kyiv
 expect(endLabel(Date.parse('2026-11-20T12:35:00Z'), now)).toBe('≈ до 14:35');
 expect(endLabel(Date.parse('2026-11-20T22:30:00Z'), now)).toBe('≈ до 21.11 00:30');
 expect(endLabel(Date.parse('2026-11-23T08:05:00Z'), now)).toBe('≈ до 23.11 10:05');
});
it('shows a dash instead of an invalid end time', () => {
 const now = Date.parse('2026-11-20T10:00:00Z');
 for (const endsAt of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 9e15]) expect(endLabel(endsAt, now)).toBe('—');
});
