import type { HistorySeries } from './api/validation';
// Rough time to a full or an empty battery at the present current.
// Only a linear projection of the battery's own counters; it is not a forecast of the load.
export type Estimate = { target: 'full' | 'empty'; minutes: number };

export function estimateTime(currentA: number | null | undefined, remainingAh: number | null | undefined, capacityAh: number | null | undefined): Estimate | null {
 if (currentA == null || remainingAh == null || !Number.isFinite(currentA) || !Number.isFinite(remainingAh) || currentA === 0 || remainingAh < 0) return null;
 if (currentA < 0) return { target: 'empty', minutes: Math.round(remainingAh / -currentA * 60) };
 if (capacityAh == null || !Number.isFinite(capacityAh) || capacityAh < remainingAh) return null;
 return { target: 'full', minutes: Math.round((capacityAh - remainingAh) / currentA * 60) };
}

// The 10-minute average replaces the present current only when it describes one steady direction:
// fresh readings, at least five minutes observed, every valid measurement has a non-zero current of the same sign.
// A kept window after a failed request or a hidden tab is not current: its end must be within 30 s of the latest measurement.
export function averageCurrent(history: HistorySeries | null, healthy: boolean, failed: boolean, measuredAt: number): number | null {
 if (!healthy || failed || !history || history.kind !== 'raw' || history.range !== '10m' || !(measuredAt - Date.parse(history.to) <= 30000) || history.observed_coverage_seconds === null || history.observed_coverage_seconds < 300 || !history.points.length) return null;
 const values: number[] = [];
 for (const point of history.points) {
  if (!point.valid || point.current_a === null || point.current_a === 0 || !Number.isFinite(point.current_a)) return null;
  values.push(point.current_a);
 }
 const positive = values.every(value => value > 0); const negative = values.every(value => value < 0);
 return positive || negative ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

export type EstimateBasis = 'average' | 'instant';
export type ProjectedTime = { status: 'ready'; estimate: Estimate; basis: EstimateBasis; endsAt: number } | { status: 'zero' } | { status: 'unavailable' };
export function projectTime(currentA: number | null | undefined, average: number | null, remainingAh: number | null | undefined, capacityAh: number | null | undefined, measuredAt: number): ProjectedTime {
 // Small currents can arrive as zero, so a zero reading gives no projection at all.
 if (currentA === 0) return { status: 'zero' };
 // A window from before a change of direction does not describe the present one.
 const usable = average !== null && currentA != null && Math.sign(average) === Math.sign(currentA) ? average : null;
 const basis: EstimateBasis = usable === null ? 'instant' : 'average';
 const estimate = estimateTime(usable ?? currentA, remainingAh, capacityAh);
 return estimate ? { status: 'ready', estimate, basis, endsAt: measuredAt + estimate.minutes * 60000 } : { status: 'unavailable' };
}
const kyivDate = (value: number) => new Date(value).toLocaleDateString('uk-UA', { timeZone: 'Europe/Kyiv' });
// «≈ до 14:35», with the Kyiv date when the projected end is not on the same day.
export function endLabel(endsAt: number, now: number): string {
 // A time outside the Date range would print «Invalid Date».
 if (Number.isNaN(new Date(endsAt).getTime())) return '—';
 const clock = new Date(endsAt).toLocaleTimeString('uk-UA', { timeZone: 'Europe/Kyiv', hour: '2-digit', minute: '2-digit' });
 return kyivDate(endsAt) === kyivDate(now) ? `≈ до ${clock}` : `≈ до ${new Date(endsAt).toLocaleDateString('uk-UA', { timeZone: 'Europe/Kyiv', day: '2-digit', month: '2-digit' })} ${clock}`;
}
