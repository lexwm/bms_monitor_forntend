import { describe, it, expect } from 'vitest';
import type { HistoryResponse } from '../src/api/validation';
import { chartAxis, historySegments } from '../src/history';
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

import { cursorTimes, cursorValue, nearestIndex, periodExtremes } from '../src/history';
import type { HistoryCompactSummary, HistoryDetailContinuity } from '../src/api/validation';
const compactValue=(min:number,max:number,count=12):HistoryCompactSummary=>({count,mean:(min+max)/2,min,max});
const detail=(minute:number,changes:Partial<HistoryDetailContinuity>={}):HistoryDetailContinuity=>({count:12,observed_coverage_seconds:60,continuous:true,first_at:stamp(minute*60),last_at:stamp(minute*60+55),first_boot:'ffffffffffff0001',last_boot:'ffffffffffff0001',...changes});
const cellBin=(minute:number,cells:(HistoryCompactSummary|null)[],delta:number,changes:Partial<HistoryBin>={}):HistoryBin=>bin(minute,{detail_status:'ready',detail:detail(minute),cells_v:cells,cell_delta_mv:compactValue(delta-5,delta),...changes});
describe('additional metrics share the interval continuity',()=>{
 it('draws cells and keeps pending detail out of the line',()=>{
  const bins=[cellBin(0,[compactValue(3.2,3.3)],10),cellBin(1,[compactValue(3.2,3.4)],12),bin(2,{detail_status:'pending',detail:null,cells_v:null,cell_delta_mv:null}),cellBin(3,[compactValue(3.1,3.3)],8)];
  expect(aggregateSegments(aggregate(bins),'cell:0').map(s=>s.points.length)).toEqual([2,1]);
  expect(aggregateSegments(aggregate(bins),'cell:1')).toEqual([]);
  expect(cursorValue(aggregate(bins),2,'cell:0')).toBe('pending');
  expect(cursorValue(aggregate(bins),2,'power_w')).toMatchObject({kind:'bin',mean:10});
 });
 it('treats a metric missing in some measurements of an interval as partial',()=>{
  const bins=[cellBin(0,[compactValue(3.2,3.3,6)],10),cellBin(1,[compactValue(3.2,3.3)],10)];
  expect(aggregateSegments(aggregate(bins),'cell:0').flatMap(s=>s.points).map(p=>p.partial)).toEqual([true,false]);
 });
 it('finds 24-hour extremes across all cells and sensors, with a dash and a pending state',()=>{
  const bins=[cellBin(0,[compactValue(3.2,3.3),null,compactValue(3.25,3.45)],10,{temperatures_c:[compactValue(20,22),compactValue(19,25)]}),cellBin(1,[compactValue(3.1,3.3)],35,{temperatures_c:null})];
  expect(periodExtremes(aggregate(bins),'cells')).toEqual({status:'ready',min:3.1,max:3.45,delta:35});
  expect(periodExtremes(aggregate(bins),'temperatures')).toEqual({status:'ready',min:19,max:25,delta:null});
  expect(periodExtremes(aggregate([bin(0)]),'cells')).toEqual({status:'ready',min:null,max:null,delta:null});
  // An interval older than the newest ten minutes that is still being prepared makes the result pending.
  const later={...aggregate([...bins,bin(2,{detail_status:'pending',detail:null})]),to:stamp(780)};
  expect(periodExtremes(later,'cells')).toEqual({status:'pending'});
  expect(periodExtremes({...later,bins:[...bins,bin(2,{status:'pending'})]},'cells')).toEqual({status:'pending'});
  // The newest intervals are recalculated while measurements arrive: they are left out and do not hide ready values.
  expect(periodExtremes({...later,to:stamp(720)},'cells')).toEqual({status:'ready',min:3.1,max:3.45,delta:35});
  expect(periodExtremes(aggregate([...bins,bin(2,{status:'pending'})]),'temperatures')).toEqual({status:'ready',min:19,max:25,delta:null});
 });
 it('moves the cursor between intervals or valid points',()=>{
  const times=cursorTimes(aggregate([bin(0),bin(1)]));
  expect(times).toEqual([Date.parse(stamp(30)),Date.parse(stamp(90))]);
  expect(nearestIndex(times,Date.parse(stamp(70)))).toBe(1);expect(nearestIndex([],0)).toBe(-1);
 });
});

describe('chart axis labels', () => {
 const distinct = (labels: string[]) => new Set(labels).size === 3;
 it('keeps three distinct labels one printed unit apart on a flat line', () => {
  expect(chartAxis([25, 25], false).labels).toEqual(['25,1', '25', '24,9']);
  expect(chartAxis([100, 100], false).labels).toEqual(['101', '100', '99']);
  expect(chartAxis([26.6, 26.6], false).labels).toEqual(['26,7', '26,6', '26,5']);
  expect(chartAxis([25.05, 25.05], false).labels).toEqual(['25,2', '25,1', '24,9']);
  expect(chartAxis([99.99, 99.99], false).labels).toEqual(['101', '100', '99']);
 });
 it('keeps the existing range for cells and negative values', () => {
  expect(chartAxis([3.29, 3.305], false).labels).toEqual(['3,33', '3,3', '3,27']);
  expect(chartAxis([-12, -10], false).labels).toEqual(['-9,8', '-11', '-12,2']);
  expect(chartAxis([-50.5, 20], true).labels).toEqual(['28,5', '-15,2', '-59']);
 });
 it('prints a huge flat line in scientific notation with distinct labels', () => {
  // uk-UA writes the exponent with the Cyrillic «Е».
  expect(chartAxis([1e300, 1e300], false).labels).toEqual(['2Е300', '1Е300', '-1Е297']);
 });
 it('stays finite and distinct for huge values', () => {
  for (const values of [[1e300, 1e300], [-1e300, 1e300], [5e6, 5e6], [123456789, 123456789]]) {
   const axis = chartAxis(values, false);
   expect(distinct(axis.labels), String(values)).toBe(true);
   expect(axis.labels.join(' '), String(values)).not.toMatch(/NaN|∞|Infinity/);
  }
  // Grid lines beyond the largest number are printed at that number, never as infinity.
  for (const values of [[Number.MAX_VALUE, Number.MAX_VALUE], [-Number.MAX_VALUE, Number.MAX_VALUE]]) {
   const axis = chartAxis(values, true);
   expect(axis.labels.join(' ')).not.toMatch(/NaN|∞|Infinity/);
   expect(Number.isFinite(axis.min) && Number.isFinite(axis.max) && axis.min < axis.max).toBe(true);
  }
 });
 it('shows dashes without values and keeps finite bounds', () => {
  for (const zero of [true, false]) {
   const axis = chartAxis([], zero);
   expect(axis.labels).toEqual(['—', '—', '—']);
   expect(Number.isFinite(axis.min) && Number.isFinite(axis.max) && axis.min < axis.max).toBe(true);
  }
 });
});
