export function format(value: number | null | undefined, digits: number | 'full' = 3, minimumFractionDigits = 0): string {
 if (value == null || !Number.isFinite(value)) return '—';
 if (Object.is(value, -0)) value = 0;
 const fractionDigits = digits === 'full' ? 3 : Math.max(0, Math.min(3, digits));
 const magnitude = Math.abs(value);
 const scientific = magnitude >= 1e6 || (magnitude > 0 && magnitude < 10 ** -fractionDigits);
 const precision = { maximumFractionDigits: fractionDigits, minimumFractionDigits: scientific ? 0 : Math.min(fractionDigits, minimumFractionDigits) };
 return value.toLocaleString('uk-UA', { ...precision, useGrouping: false, notation: scientific ? 'scientific' : 'standard' });
}
export const time = (value: string) => new Date(value).toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' });
export const clockTime = (value: string | number) => new Date(value).toLocaleTimeString('uk-UA', { timeZone: 'Europe/Kyiv', hour: '2-digit', minute: '2-digit' });

export function historySeconds(value: number | null | undefined): string {
 return value == null ? '—' : value.toLocaleString('uk-UA', {maximumFractionDigits:0, useGrouping:true, notation:'standard'});
}
