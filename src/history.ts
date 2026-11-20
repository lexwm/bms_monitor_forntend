import type { HistoryResponse, HistorySeries, HistoryRange, AggregateHistorySeries, HistoryBin, HistoryPoint, HistoryDetailContinuity, HistoryCompactSummary } from './api/validation';
import { format } from './format';
// Cells and temperature sensors are addressed by their zero-based index in the response arrays.
export type HistoryMetric = 'power_w' | 'current_a' | 'soc_percent' | 'voltage_v' | 'cell_delta_mv' | `cell:${number}` | `temperature:${number}`;
export interface ChartPoint { time: number; value: number; min?: number; max?: number; partial?: boolean }
export interface ChartSegment { points: ChartPoint[] }
type Continuity = HistoryDetailContinuity;
export interface BinValue { mean: number; min: number; max: number; count: number; continuity: Continuity }

function indexed(metric: string): { list: 'cells_v' | 'temperatures_c'; index: number } | null {
 const match = /^(cell|temperature):(\d+)$/.exec(metric);
 return match ? { list: match[1] === 'cell' ? 'cells_v' : 'temperatures_c', index: Number(match[2]) } : null;
}
export function rawValue(point: HistoryPoint, metric: HistoryMetric): number | null {
 switch (metric) {
  case 'power_w': case 'current_a': case 'soc_percent': return point[metric];
  case 'voltage_v': case 'cell_delta_mv': return point[metric] ?? null;
  default: { const item = indexed(metric); return item ? point[item.list]?.[item.index] ?? null : null; }
 }
}
function compact(bin: HistoryBin, metric: HistoryMetric): HistoryCompactSummary | null {
 switch (metric) {
  case 'power_w': case 'current_a': return null;
  case 'soc_percent': case 'voltage_v': case 'cell_delta_mv': return bin[metric] ?? null;
  default: { const item = indexed(metric); return item ? bin[item.list]?.[item.index] ?? null : null; }
 }
}
// Power and current carry their own continuity; additional metrics share the interval's detail continuity.
export function binValue(bin: HistoryBin, metric: HistoryMetric): BinValue | null {
 if (bin.status !== 'ready') return null;
 if (metric === 'power_w' || metric === 'current_a') { const summary = bin[metric]; return summary && summary.count > 0 ? { ...summary, continuity: summary } : null; }
 if (bin.detail_status !== 'ready' || !bin.detail) return null;
 const summary = compact(bin, metric);
 return summary && summary.count > 0 ? { ...summary, continuity: bin.detail } : null;
}
export const basicMetric = (metric: HistoryMetric) => metric === 'power_w' || metric === 'current_a';
// An additional metric is still being prepared when its interval or its detail is pending.
export const binPending = (bin: HistoryBin, metric: HistoryMetric) => bin.status === 'pending' || (!basicMetric(metric) && bin.detail_status === 'pending');

// A metric can be missing even while the overall measurement is valid.
export function historySegments(history: Pick<HistoryResponse, 'points' | 'gaps'>, metric: HistoryMetric): ChartSegment[] {
 const segments: ChartSegment[] = [];
 const gaps = history.gaps.map(gap => ({ from: Date.parse(gap.from), to: Date.parse(gap.to) }));
 let segment: ChartSegment | null = null;
 let previous: HistoryResponse['points'][number] | null = null;
 let gapIndex = 0;
 for (const point of history.points) {
  const timestamp = Date.parse(point.received_at);
  const value = rawValue(point, metric);
  if (!point.valid || value === null) { segment = null; previous = null; continue; }
  const previousTime = previous ? Date.parse(previous.received_at) : timestamp;
  while (gaps[gapIndex] && (gaps[gapIndex]?.to ?? Infinity) <= previousTime) gapIndex++;
  const gap = gaps[gapIndex];
  const crossesGap = gap !== undefined && gap.from < timestamp && gap.to > previousTime;
  if (!segment || !previous || point.boot_id !== previous.boot_id || timestamp <= previousTime || timestamp - previousTime > 10000 || crossesGap) {
   segment = { points: [] }; segments.push(segment);
  }
  segment.points.push({ time: timestamp, value }); previous = point;
 }
 return segments;
}

export const historyRanges: ReadonlyArray<{ value: HistoryRange; label: string }> = [
 {value:'10m',label:'10 хв'}, {value:'1h',label:'1 год'}, {value:'12h',label:'12 год'},
 {value:'24h',label:'24 год'}, {value:'30d',label:'30 днів'}, {value:'3mo',label:'Квартал'}, {value:'1y',label:'Рік'},
];
export const historyRangeLabel = (range: HistoryRange) => historyRanges.find(item => item.value === range)?.label ?? '—';
export function historyTime(value: string | number, range: HistoryRange): string {
 const options: Intl.DateTimeFormatOptions = range === '1y' ? {month:'short',year:'numeric'} : range === '3mo' || range === '30d' ? {day:'numeric',month:'short'} : range === '24h' || range === '12h' ? {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'} : {hour:'2-digit',minute:'2-digit'};
 return new Date(value).toLocaleString('uk-UA',{timeZone:'Europe/Kyiv',...options});
}
function completeMetric(bin: HistoryBin, summary: Continuity): boolean {
 const duration=(Date.parse(bin.to)-Date.parse(bin.from))/1000;
 return summary.continuous && summary.observed_coverage_seconds >= duration && summary.first_at !== null && summary.last_at !== null && summary.first_boot !== null && summary.first_boot===summary.last_boot
  && Date.parse(summary.first_at)-Date.parse(bin.from)<=10000 && Date.parse(bin.to)-Date.parse(summary.last_at)<=10000;
}
export function aggregateSegments(history: AggregateHistorySeries, metric: HistoryMetric): ChartSegment[] {
 const segments: ChartSegment[]=[];
 let previous: Continuity | null=null; let segment: ChartSegment | null=null;
 for(const bin of history.bins) {
  const value=binValue(bin,metric);
  if(!value) {previous=null;segment=null;continue;}
  // A shared continuity covers this metric only when every measurement in it had the metric.
  const summary=value.continuity;
  const complete=completeMetric(bin,summary) && value.count===summary.count;
  const edgeGap=previous?.last_at && summary.first_at ? Date.parse(summary.first_at)-Date.parse(previous.last_at) : Infinity;
  if(!complete || !previous || !segment || previous.last_boot!==summary.first_boot || edgeGap<=0 || edgeGap>10000) { segment={points:[]};segments.push(segment); }
  segment.points.push({time:(Date.parse(bin.from)+Date.parse(bin.to))/2,value:value.mean,min:value.min,max:value.max,partial:!complete});
  previous=complete ? summary : null;
  if(!complete)segment=null;
 }
 return segments;
}
export function seriesSegments(history: HistorySeries, metric: HistoryMetric): ChartSegment[] {
 return history.kind==='raw' ? historySegments(history,metric) : aggregateSegments(history,metric);
}

// The cursor stops at every valid measurement or at every interval; positions are shared by all charts of one response.
export function cursorTimes(history: HistorySeries): number[] {
 return history.kind === 'raw' ? history.points.filter(point => point.valid).map(point => Date.parse(point.received_at)) : history.bins.map(bin => (Date.parse(bin.from) + Date.parse(bin.to)) / 2);
}
export function nearestIndex(times: readonly number[], time: number): number {
 let best = -1; let distance = Infinity;
 times.forEach((value, index) => { const next = Math.abs(value - time); if (next < distance) { best = index; distance = next; } });
 return best;
}
export type CursorValue = { kind: 'point'; value: number } | { kind: 'bin'; mean: number; min: number; max: number } | 'pending' | null;
export function cursorValue(history: HistorySeries, index: number, metric: HistoryMetric): CursorValue {
 if (history.kind === 'raw') {
  const point = history.points.filter(item => item.valid)[index]; const value = point ? rawValue(point, metric) : null;
  return value === null ? null : { kind: 'point', value };
 }
 const bin = history.bins[index];
 if (!bin) return null;
 if (binPending(bin, metric)) return 'pending';
 const value = binValue(bin, metric);
 return value ? { kind: 'bin', mean: value.mean, min: value.min, max: value.max } : null;
}

// Lowest and highest values of all cells or sensors over a period. An older pending interval makes the result pending;
// the newest two intervals are recalculated while measurements keep arriving, so they are left out, not waited for.
export type PeriodExtremes = { status: 'pending' } | { status: 'ready'; min: number | null; max: number | null; delta: number | null };
export function periodExtremes(history: HistorySeries, kind: 'cells' | 'temperatures'): PeriodExtremes {
 const list = kind === 'cells' ? 'cells_v' : 'temperatures_c';
 let mins: number[]; let maxes: number[]; let deltas: number[];
 if (history.kind === 'raw') {
  const values = history.points.filter(point => point.valid).flatMap(point => point[list] ?? []);
  mins = values; maxes = values; deltas = history.points.filter(point => point.valid).flatMap(point => point.cell_delta_mv ?? []);
 } else {
  const liveEdge = Date.parse(history.to) - 600000;
  if (history.bins.some(bin => (bin.status === 'pending' || bin.detail_status === 'pending') && Date.parse(bin.from) < liveEdge)) return { status: 'pending' };
  const summaries = history.bins.flatMap(bin => bin[list] ?? []).flatMap(summary => summary && summary.count > 0 ? [summary] : []);
  mins = summaries.map(summary => summary.min); maxes = summaries.map(summary => summary.max);
  deltas = history.bins.flatMap(bin => bin.cell_delta_mv && bin.cell_delta_mv.count > 0 ? [bin.cell_delta_mv.max] : []);
 }
 return { status: 'ready', min: mins.length ? Math.min(...mins) : null, max: maxes.length ? Math.max(...maxes) : null, delta: kind === 'cells' && deltas.length ? Math.max(...deltas) : null };
}

// The y axis of a chart: bounds in units of `scale`, so huge values never overflow, and the labels of its three grid lines.
// One digit rule for all three labels, chosen by the largest; the half-range is at least one unit of the last printed digit
// (scientific notation from a million counts after the first digit), so a flat line never repeats a label.
export function chartAxis(values: readonly number[], zero: boolean): { scale: number; min: number; max: number; labels: string[] } {
 const scale = Math.max(1, ...values.map(value => Math.abs(value)));
 // Power and current keep zero in view; other metrics fit their own range.
 const bounds = zero || !values.length ? [0] : [];
 const low = Math.min(...bounds, ...values.map(value => value / scale)); const high = Math.max(...bounds, ...values.map(value => value / scale));
 const margin = Math.max((high - low) * .12, (zero ? 1 : .02) / scale); let min = low - margin; let max = high + margin; let digits = 3;
 // Widening can raise the magnitude and lower the digits, so the rule is applied until it holds.
 for (let pass = 0; pass < 8; pass++) {
  const top = Math.max(Math.abs(max), Math.abs(min)); const magnitude = top * scale;
  digits = magnitude >= 100 ? 0 : magnitude >= 10 ? 1 : magnitude >= 1 ? 2 : 3;
  const unit = magnitude >= 1e6 ? 10 ** (Math.floor(Math.log10(top) + Math.log10(scale)) - digits - Math.log10(scale)) : 10 ** -digits / scale;
  if ((max - min) / 2 >= unit) break;
  // A thousandth more keeps values on a rounding boundary apart despite binary fractions.
  const middle = (low + high) / 2; min = middle - unit * 1.001; max = middle + unit * 1.001;
 }
 const real = (value: number) => Math.max(-Number.MAX_VALUE, Math.min(Number.MAX_VALUE, value * scale));
 return { scale, min, max, labels: [max, (min + max) / 2, min].map(value => values.length ? format(real(value), digits) : '—') };
}
