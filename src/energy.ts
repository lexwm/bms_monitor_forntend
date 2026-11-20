import type { EnergyDaily, EnergyDay, EnergyRange, HistoryRange } from './api/validation';

// Energy is counted per Kyiv calendar day; periods shorter than 30 days show the last 30 days.
export const energyRange = (range: HistoryRange): EnergyRange => range === '3mo' || range === '1y' ? range : '30d';
const kyivDay = (value: string) => new Date(value).toLocaleDateString('sv-SE', { timeZone: 'Europe/Kyiv' });
export interface EnergyDayView { label: string | null; bar: boolean; coverage: number }
export function energyDay(day: EnergyDay, daily: Pick<EnergyDaily, 'as_of' | 'prepared_from'>): EnergyDayView {
 const coverage = Math.min(100, day.observed_coverage_seconds / day.day_seconds * 100);
 const measured = day.observed_coverage_seconds > 0 && day.charged_wh !== null && day.discharged_wh !== null;
 // Today is always unfinished, so its own label wins over the start of prepared history.
 if (day.date === kyivDay(daily.as_of)) return { label: `сьогодні, станом на ${new Date(daily.as_of).toLocaleTimeString('uk-UA', { timeZone: 'Europe/Kyiv', hour: '2-digit', minute: '2-digit' })}`, bar: measured, coverage };
 if (day.status === 'outside' || (day.status === 'ready' && !measured)) return { label: 'немає даних', bar: false, coverage };
 if (day.status === 'ready') return { label: null, bar: true, coverage };
 return { label: daily.prepared_from !== null && kyivDay(daily.prepared_from) === day.date ? 'частково' : 'готується', bar: measured, coverage };
}
export const kwh = (wh: number) => (wh / 1000).toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });
// Coverage share without scientific notation: a tiny share is still not zero and an almost full day is not complete.
export const coverageText = (share: number) => share > 0 && share < 1 ? 'менше 1' : share > 99 && share < 100 ? 'понад 99' : Math.round(share).toLocaleString('uk-UA');
