import { memo, useId, useMemo } from 'react';
import type { HistoryResponse } from '../api/validation';
import { clockTime, format } from '../format';
import { historySegments, type HistoryMetric } from '../history';

export const HistoryChart = memo(function HistoryChart({ history, metric, title, unit, failed }: { history: HistoryResponse | null; metric: HistoryMetric; title: string; unit: string; failed: boolean }) {
 const id = useId();
 const segments = useMemo(() => history ? historySegments(history, metric) : [], [history, metric]);
 const values = segments.flatMap(segment => segment.points.map(point => point.value));
 const emptyLabel = !history ? failed ? 'Історія недоступна' : 'Завантажуємо історію…' : 'Немає значень показника за цей період';
 const rangeLabel = values.length ? `${unit}: від ${format(Math.min(...values), 2)} до ${format(Math.max(...values), 2)}` : emptyLabel;
 const scale = Math.max(1, ...values.map(value => Math.abs(value)));
 const low = Math.min(0, ...values.map(value => value / scale)); const high = Math.max(0, ...values.map(value => value / scale));
 const margin = Math.max((high - low) * .12, 1 / scale); const min = low - margin; const max = high + margin;
 const axisValue = (value: number) => Math.max(-Number.MAX_VALUE, Math.min(Number.MAX_VALUE, value * scale));
 const start = history ? Date.parse(history.from) : 0;
 const end = history ? Date.parse(history.to) : 1;
 const x = (timestamp: number) => (timestamp - start) / (end - start) * 1000;
 const y = (value: number) => 150 - (value / scale - min) / (max - min) * 140;
 const tone = metric === 'power_w' ? 'gold' : 'silver';
 return <section id={metric === 'power_w' ? 'history' : undefined} className={`panel history-chart ${metric === 'power_w' ? 'history' : 'current-history'}`} aria-label={title}>
  <div className="panel-head"><h2 className="panel-title">{title}</h2><span className="micro">Знімок · 10 хв</span></div>
  <div className="legend"><span><i className={`line-key ${tone}`}/>{unit}</span><span><i className="gap-key"/>Немає вимірювань</span></div>
   <div className="chart-frame">
    <div className="chart-y" aria-hidden="true"><span>{values.length ? format(axisValue(max)) : '—'}</span><span>{values.length ? format(axisValue((min + max) / 2)) : '—'}</span><span>{values.length ? format(axisValue(min)) : '—'}</span></div>
    <svg className={`chart ${tone}`} viewBox="0 0 1000 160" preserveAspectRatio="none" role="img" aria-label={history ? `${title}. Виміряних точок: ${values.length}. ${rangeLabel}. Проміжків без вимірювань: ${history.gaps.length}` : `${title}. ${emptyLabel}`}>
     <defs><pattern id={`${id}-gap`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><line x1="0" y1="0" x2="0" y2="8" stroke="#969da5" strokeOpacity=".2" strokeWidth="2"/></pattern></defs>
     {[10, 80, 150].map(line => <line key={line} className="chart-grid" x1="0" x2="1000" y1={line} y2={line} vectorEffect="non-scaling-stroke"/>)}
     {history?.gaps.map((gap, index) => <rect key={index} className="chart-gap" x={x(Date.parse(gap.from))} y="10" width={Math.max(0, x(Date.parse(gap.to)) - x(Date.parse(gap.from)))} height="140" fill={`url(#${id}-gap)`}><title>Немає вимірювань: {clockTime(gap.from)}–{clockTime(gap.to)}</title></rect>)}
     {segments.map((segment, index) => <g key={index}>
      <path className="chart-line" data-testid="history-segment" d={segment.points.map((point, i) => `${i === 0 ? 'M' : 'L'}${x(point.time).toFixed(2)},${y(point.value).toFixed(2)}`).join(' ')} fill="none" strokeWidth="1.7" vectorEffect="non-scaling-stroke"/>
      {segment.points.length === 1 && segment.points.map(point => <path key={point.time} className="chart-line" d={`M${x(point.time)},${y(point.value)}h.01`} strokeWidth="4" strokeLinecap="round" vectorEffect="non-scaling-stroke"/>)}
     </g>)}
    </svg>
    <p className="chart-empty" hidden={values.length > 0}>{emptyLabel}</p>
   </div>
   <div className="chart-times" aria-hidden="true">{[0, 1 / 3, 2 / 3, 1].map(position => <span key={position}>{history ? clockTime(start + (end - start) * position) : '—'}</span>)}</div>
   <div className="gap-note"><span>{history ? clockTime(history.from) : '—'}–{history ? clockTime(history.to) : '—'} · Київ</span><span>Пропуски не замінюються нулями</span></div>
 </section>;
});
