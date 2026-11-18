import type { HistoryResponse } from './api/validation';
export type HistoryMetric = 'power_w' | 'current_a';
export interface ChartPoint { time: number; value: number }
export interface ChartSegment { points: ChartPoint[] }

// A metric can be missing even while the overall measurement is valid.
export function historySegments(history: HistoryResponse, metric: HistoryMetric): ChartSegment[] {
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
