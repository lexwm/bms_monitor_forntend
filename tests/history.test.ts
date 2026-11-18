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

import { aggregateSegments, historyRanges, historyTime } from '../src/history';
import type { AggregateHistorySeries, HistoryBin, HistoryMetricSummary } from '../src/api/validation';
const summary=(changes:Partial<HistoryMetricSummary>={}): HistoryMetricSummary=>({count:12,mean:10,min:-20,max:40,observed_coverage_seconds:60,continuous:true,first_at:stamp(0),last_at:stamp(55),first_boot:'ffffffffffff0001',last_boot:'ffffffffffff0001',...changes});
const bin=(minute:number,changes:Partial<HistoryBin>={}): HistoryBin=>({from:stamp(minute*60),to:stamp((minute+1)*60),status:'ready',observed_coverage_seconds:60,power_w:summary({first_at:stamp(minute*60),last_at:stamp(minute*60+55)}),current_a:null,...changes});
const aggregate=(bins:HistoryBin[]):AggregateHistorySeries=>({kind:'aggregate',range:'12h',from:stamp(0),to:stamp(600),period_seconds:600,source_revision:3,aggregate_revision:2,prepared_at:stamp(600),processing_status:'ready',observed_coverage_seconds:600,prepared_coverage_seconds:600,resolution_seconds:300,bins});
describe('aggregate chart preserves measured limits and uncertainty',()=>{
 it('retains mean and extrema instead of inventing raw points',()=>{
  const segments=aggregateSegments(aggregate([bin(0),bin(1)]),'power_w');
  expect(segments).toHaveLength(1);expect(segments[0]?.points).toHaveLength(2);
  expect(segments[0]?.points[0]).toMatchObject({value:10,min:-20,max:40,partial:false});
 });
 it('splits pending, partial, absent metrics and boot boundaries',()=>{
  const bins=[bin(0),bin(1,{status:'pending',power_w:null,observed_coverage_seconds:null}),bin(2),bin(3,{power_w:summary({observed_coverage_seconds:10,continuous:false,first_at:stamp(180),last_at:stamp(185)})}),bin(4),bin(5,{power_w:summary({first_at:stamp(300),last_at:stamp(355),first_boot:'ffffffffffff0002',last_boot:'ffffffffffff0002'})}),bin(6,{power_w:null}),bin(7)];
  expect(aggregateSegments(aggregate(bins),'power_w').map(s=>s.points.length)).toEqual([1,1,1,1,1,1]);
  expect(aggregateSegments(aggregate(bins),'power_w').flatMap(s=>s.points).filter(p=>p.partial)).toHaveLength(1);
  expect(aggregateSegments(aggregate(bins),'current_a')).toEqual([]);
 });
 it('rejects edges more than ten seconds apart even when both bins claim continuity',()=>{
  const bins=[bin(0,{power_w:summary({last_at:stamp(50)})}),bin(1,{power_w:summary({first_at:stamp(65),last_at:stamp(115)})})];
  expect(aggregateSegments(aggregate(bins),'power_w')).toHaveLength(2);
 });
 it('offers seven common periods and uses Kyiv calendar labels for long periods',()=>{
  expect(historyRanges.map(r=>r.value)).toEqual(['10m','1h','12h','24h','30d','3mo','1y']);
  expect(historyTime('2026-12-31T23:00:00Z','1y')).toContain('2027');
  expect(historyTime('2026-12-31T23:00:00Z','30d')).toMatch(/1.*січ/);
 });
});
