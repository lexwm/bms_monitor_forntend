import { describe, it, expect } from 'vitest';
import type { HistoryResponse } from '../src/api/validation';
import { historySegments } from '../src/history';
const stamp = (seconds: number) => new Date(Date.UTC(2026, 10, 17, 12, 0, seconds)).toISOString();
const point = (seconds: number, changes: Partial<HistoryResponse['points'][number]> = {}): HistoryResponse['points'][number] => ({ received_at: stamp(seconds), boot_id: 'ffffffffffff0001', sequence: seconds, valid: true, current_a: -10, power_w: -260, soc_percent: 78, ...changes });
function history(points: HistoryResponse['points'], gaps: HistoryResponse['gaps'] = []): HistoryResponse {
 return { from: stamp(0), to: stamp(60), revision: 1, period_seconds: 60, observed_coverage_seconds: 0, points, gaps };
}
describe('history lines preserve missing data', () => {
 it('joins only measured neighbours, preserving actual zero', () => {
  expect(historySegments(history([point(0), point(5, { power_w: 0 }), point(10)]), 'power_w').map(s => s.points.map(p => p.value))).toEqual([[-260, 0, -260]]);
 });
 it('splits a curve across an API gap even for nearby points', () => {
  expect(historySegments(history([point(0), point(5), point(10), point(15)], [{ from: stamp(7), to: stamp(9) }]), 'power_w').map(s => s.points.length)).toEqual([2, 2]);
 });
 it('never substitutes missing or invalid metrics with zero', () => {
  const data = history([point(0), point(5, { power_w: null }), point(10), point(15, { valid: false }), point(20)]);
  expect(historySegments(data, 'power_w').map(s => s.points.length)).toEqual([1, 1, 1]);
  expect(historySegments(data, 'current_a').map(s => s.points.length)).toEqual([3, 1]);
 });
 it('does not connect long pauses, boot changes or duplicate times', () => {
  const data = history([point(0), point(15), point(20, { boot_id: 'ffffffffffff0002' }), point(20, { boot_id: 'ffffffffffff0002' })]);
  expect(historySegments(data, 'power_w').map(s => s.points.length)).toEqual([1, 1, 1, 1]);
 });
 it('keeps an entirely missing series empty', () => {
  expect(historySegments(history([]), 'power_w')).toEqual([]);
  expect(historySegments(history([point(0, { power_w: null })]), 'power_w')).toEqual([]);
 });
});
