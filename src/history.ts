import type { HistoryResponse, HistorySeries, HistoryRange, AggregateHistorySeries, HistoryBin, HistoryMetricSummary } from './api/validation';
export type HistoryMetric = 'power_w' | 'current_a';
export interface ChartPoint { time: number; value: number; min?: number; max?: number; partial?: boolean }
export interface ChartSegment { points: ChartPoint[] }

// A metric can be missing even while the overall measurement is valid.
export function historySegments(history: Pick<HistoryResponse, 'points' | 'gaps'>, metric: HistoryMetric): ChartSegment[] {
 const segments: ChartSegment[] = [];
 const gaps = history.gaps.map(gap => ({ from: Date.parse(gap.from), to: Date.parse(gap.to) }));
 let segment: ChartSegment | null = null;
 let previous: HistoryResponse['points'][number] | null = null;
 let gapIndex = 0;
 for (const point of history.points) {
  const timestamp = Date.parse(point.received_at);
  const value = point[metric];
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
function completeMetric(bin: HistoryBin, summary: HistoryMetricSummary): boolean {
 const duration=(Date.parse(bin.to)-Date.parse(bin.from))/1000;
 return summary.continuous && summary.observed_coverage_seconds >= duration && summary.first_at !== null && summary.last_at !== null && summary.first_boot !== null && summary.first_boot===summary.last_boot
  && Date.parse(summary.first_at)-Date.parse(bin.from)<=10000 && Date.parse(bin.to)-Date.parse(summary.last_at)<=10000;
}
export function aggregateSegments(history: AggregateHistorySeries, metric: HistoryMetric): ChartSegment[] {
 const segments: ChartSegment[]=[];
 let previous: HistoryMetricSummary | null=null; let segment: ChartSegment | null=null;
 for(const bin of history.bins) {
  const summary=bin[metric];
  if(bin.status!=='ready' || !summary || summary.count===0) {previous=null;segment=null;continue;}
  const complete=completeMetric(bin,summary);
  const edgeGap=previous?.last_at && summary.first_at ? Date.parse(summary.first_at)-Date.parse(previous.last_at) : Infinity;
  if(!complete || !previous || !segment || previous.last_boot!==summary.first_boot || edgeGap<=0 || edgeGap>10000) { segment={points:[]};segments.push(segment); }
  segment.points.push({time:(Date.parse(bin.from)+Date.parse(bin.to))/2,value:summary.mean,min:summary.min,max:summary.max,partial:!complete});
  previous=complete ? summary : null;
  if(!complete)segment=null;
 }
 return segments;
}
export function seriesSegments(history: HistorySeries, metric: HistoryMetric): ChartSegment[] {
 return history.kind==='raw' ? historySegments(history,metric) : aggregateSegments(history,metric);
}
