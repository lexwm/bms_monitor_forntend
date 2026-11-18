import type { CSSProperties } from 'react';
import { format } from '../format';

// The number may shrink inside its slot; its unit and the card never move.
export function NumericReading({ value, unit, digits = 1 }: { value: number | null | undefined; unit: string; digits?: number }) {
 const text = format(value, digits);
 const negative = text.startsWith('-');
 const magnitude = negative ? text.slice(1) : text;
 const style: CSSProperties & { '--characters': number } = { '--characters': Math.max(4, magnitude.length + 1) };
 return <span className="numeric-reading" style={style} title={value == null ? 'Немає даних' : `${format(value, 'full')} ${unit}`}>
  <span className="reading-number"><span className="reading-sign">{negative ? '-' : '\u00a0'}</span><span className="reading-update" key={text}>{magnitude}</span></span><span className="unit">{unit}</span>
 </span>;
}
