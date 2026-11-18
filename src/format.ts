export function format(value: number | null | undefined, digits: number | 'full' = 1, minimumFractionDigits = 0): string {
 if (value == null) return '—';
 const magnitude = Math.abs(value);
 const scientific = magnitude >= 1e6 || (magnitude > 0 && magnitude < 10 ** -(digits === 'full' ? 6 : digits));
 const precision = digits === 'full' ? { maximumSignificantDigits: 21 } : { maximumFractionDigits: digits, minimumFractionDigits: scientific ? 0 : minimumFractionDigits };
 return value.toLocaleString('uk-UA', { ...precision, useGrouping: false, notation: scientific ? 'scientific' : 'standard' });
}
export const time = (value: string) => new Date(value).toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' });
export const clockTime = (value: string | number) => new Date(value).toLocaleTimeString('uk-UA', { timeZone: 'Europe/Kyiv', hour: '2-digit', minute: '2-digit' });
