import { expect, it } from 'vitest';
import { coverageText, energyDay, energyRange, kwh } from '../src/energy';
import type { EnergyDay } from '../src/api/validation';
const daily = { as_of: '2026-11-20T10:15:00.000000Z', prepared_from: '2026-11-17T16:55:00.000000Z' };
const day = (date: string, changes: Partial<EnergyDay> = {}): EnergyDay => ({ date, day_seconds: 86400, observed_coverage_seconds: 43200, charged_wh: 1234.5, discharged_wh: 2000, status: 'ready', ...changes });

it('labels days by the D3 rules without zero bars for missing days', () => {
 expect(energyDay(day('2026-11-19'), daily)).toEqual({ label: null, bar: true, coverage: 50 });
 expect(energyDay(day('2026-11-01', { status: 'outside', observed_coverage_seconds: 0, charged_wh: null, discharged_wh: null }), daily)).toMatchObject({ label: 'немає даних', bar: false });
 expect(energyDay(day('2026-11-18', { observed_coverage_seconds: 0, charged_wh: null, discharged_wh: null }), daily)).toMatchObject({ label: 'немає даних', bar: false });
 expect(energyDay(day('2026-11-19', { status: 'partial' }), daily)).toMatchObject({ label: 'готується', bar: true });
 expect(energyDay(day('2026-11-19', { status: 'partial', observed_coverage_seconds: 0, charged_wh: null, discharged_wh: null }), daily)).toMatchObject({ label: 'готується', bar: false });
 // The day that contains the start of prepared history stays partial forever.
 expect(energyDay(day('2026-11-17', { status: 'partial' }), daily)).toMatchObject({ label: 'частково', bar: true });
 expect(energyDay(day('2026-11-20', { status: 'partial' }), daily)).toMatchObject({ label: 'сьогодні, станом на 12:15', bar: true });
 // «today» wins over «partially».
 expect(energyDay(day('2026-11-20', { status: 'partial' }), { ...daily, prepared_from: '2026-11-20T05:00:00Z' }).label).toBe('сьогодні, станом на 12:15');
 expect(energyDay(day('2026-11-19', { status: 'partial' }), { ...daily, prepared_from: null }).label).toBe('готується');
});
it('uses the Kyiv calendar day near midnight and on 23-hour days', () => {
 expect(energyDay(day('2026-11-21', { status: 'partial' }), { as_of: '2026-11-20T22:30:00Z', prepared_from: null }).label).toBe('сьогодні, станом на 00:30');
 expect(energyDay(day('2026-03-29', { day_seconds: 82800, observed_coverage_seconds: 82800 }), daily).coverage).toBe(100);
});
it('formats kilowatt-hours with two decimals and short periods as 30 days', () => {
 expect(kwh(1234.5)).toBe('1,23'); expect(kwh(0)).toBe('0,00'); expect(kwh(0.4)).toBe('0,00'); expect(kwh(15000)).toBe('15,00');
 expect(energyRange('10m')).toBe('30d'); expect(energyRange('24h')).toBe('30d'); expect(energyRange('3mo')).toBe('3mo'); expect(energyRange('1y')).toBe('1y');
 expect(coverageText(0.01)).toBe('менше 1'); expect(coverageText(0)).toBe('0'); expect(coverageText(45.4)).toBe('45');
 expect(coverageText(99.6)).toBe('понад 99'); expect(coverageText(99.01)).toBe('понад 99'); expect(coverageText(100)).toBe('100'); expect(coverageText(99)).toBe('99');
});
