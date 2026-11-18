import { memo, useLayoutEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { HistorySeries } from '../api/validation';
import { format, time } from '../format';
import { historyRangeLabel, historyTime, seriesSegments, type HistoryMetric } from '../history';

const snapshotKey=(history:HistorySeries | null)=>history ? `${history.range}:${history.to}:${history.source_revision}:${history.aggregate_revision}:${history.prepared_at}` : 'empty';
interface PlotProps { history: HistorySeries | null; metric: HistoryMetric; title: string; unit: string; failed: boolean; outgoing?: boolean }
function Plot({ history, metric, title, unit, failed, outgoing=false }: PlotProps) {
 const id = useId();
 const segments = history ? seriesSegments(history, metric) : [];
 const points=segments.flatMap(segment=>segment.points);
 const values=points.flatMap(point=>[point.value,point.min ?? point.value,point.max ?? point.value]);
 const pending=history?.processing_status==='pending';
 const emptyLabel = !history ? failed ? 'Історія недоступна' : 'Завантажуємо історію…' : pending && !values.length ? 'Історія готується…' : 'Немає значень показника за цей період';
 const rangeLabel = values.length ? `${unit}: від ${format(Math.min(...values), 2)} до ${format(Math.max(...values), 2)}` : emptyLabel;
 const scale = Math.max(1, ...values.map(value => Math.abs(value)));
 const low = Math.min(0, ...values.map(value => value / scale)); const high = Math.max(0, ...values.map(value => value / scale));
 const margin = Math.max((high - low) * .12, 1 / scale); const min = low - margin; const max = high + margin;
 const axisValue = (value: number) => Math.max(-Number.MAX_VALUE, Math.min(Number.MAX_VALUE, value * scale));
 const start = history ? Date.parse(history.from) : 0;
 const end = history ? Date.parse(history.to) : 1;
 const x = (timestamp: number) => (timestamp - start) / (end - start) * 1000;
 const y = (value: number) => 150 - (value / scale - min) / (max - min) * 140;
 const gaps=history?.kind==='raw' ? history.gaps : history?.bins.filter(bin=>bin.status==='ready' && bin.observed_coverage_seconds===0) ?? [];
 const tone = metric === 'power_w' ? 'gold' : 'silver';
 const description=history ? history.kind==='raw' ? `${title}. Виміряних точок: ${points.length}. ${rangeLabel}. Проміжків без вимірювань: ${gaps.length}` : `${title}. Середні значення та межі мінімуму й максимуму. ${rangeLabel}. ${pending ? 'Частина історії ще готується.' : 'Історію підготовлено.'} Часткових інтервалів показника: ${points.filter(point=>point.partial).length}` : `${title}. ${emptyLabel}`;
 return <div className={`chart-layer${outgoing ? ' chart-outgoing' : ''}`} aria-hidden={outgoing ? true : undefined}>
  <div className="chart-frame">
   <div className="chart-y" aria-hidden="true"><span>{values.length ? format(axisValue(max)) : '—'}</span><span>{values.length ? format(axisValue((min + max) / 2)) : '—'}</span><span>{values.length ? format(axisValue(min)) : '—'}</span></div>
   <svg className={`chart ${tone}`} viewBox="0 0 1000 160" preserveAspectRatio="none" role={outgoing ? undefined : 'img'} aria-label={outgoing ? undefined : description}>
    <defs><pattern id={`${id}-gap`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><line x1="0" y1="0" x2="0" y2="8" stroke="#969da5" strokeOpacity=".2" strokeWidth="2"/></pattern></defs>
    {[10, 80, 150].map(line => <line key={line} className="chart-grid" x1="0" x2="1000" y1={line} y2={line} vectorEffect="non-scaling-stroke"/>)}
    {gaps.map((gap, index) => <rect key={index} className="chart-gap" x={x(Date.parse(gap.from))} y="10" width={Math.max(0, x(Date.parse(gap.to)) - x(Date.parse(gap.from)))} height="140" fill={`url(#${id}-gap)`}><title>Немає вимірювань: {time(gap.from)}–{time(gap.to)}</title></rect>)}
    {history?.kind==='aggregate' && history.bins.filter(bin=>bin.status==='pending').map(bin=><rect key={bin.from} className="chart-pending" x={x(Date.parse(bin.from))} y="10" width={Math.max(0,x(Date.parse(bin.to))-x(Date.parse(bin.from)))} height="140"><title>Інтервал готується: {time(bin.from)}–{time(bin.to)}</title></rect>)}
    {segments.map((segment, index) => <g key={index}>
     {history?.kind==='aggregate' && <path className="chart-envelope" d={segment.points.map((point,i)=>`${i===0?'M':'L'}${x(point.time)},${y(point.max ?? point.value)}`).concat([...segment.points].reverse().map(point=>`L${x(point.time)},${y(point.min ?? point.value)}`)).join(' ')+' Z'}/>}
     <path className="chart-line" data-testid={outgoing ? undefined : 'history-segment'} d={segment.points.map((point, i) => `${i === 0 ? 'M' : 'L'}${x(point.time).toFixed(2)},${y(point.value).toFixed(2)}`).join(' ')} fill="none" strokeWidth="1.7" vectorEffect="non-scaling-stroke"/>
     {segment.points.map(point=><g key={point.time}>
      {point.min!==undefined && point.max!==undefined && <path className={`chart-extrema${point.partial ? ' chart-partial' : ''}`} d={`M${x(point.time)},${y(point.min)}V${y(point.max)}`} vectorEffect="non-scaling-stroke"><title>{point.partial ? 'Частковий інтервал. ' : ''}Мінімум: {format(point.min,2)}; максимум: {format(point.max,2)}; середнє: {format(point.value,2)}. {time(new Date(point.time).toISOString())}</title></path>}
      {segment.points.length===1 && <path className="chart-line" d={`M${x(point.time)},${y(point.value)}h.01`} strokeWidth="4" strokeLinecap="round" vectorEffect="non-scaling-stroke"/>}
     </g>)}
    </g>)}
   </svg>
   <p className="chart-empty" hidden={values.length > 0}>{emptyLabel}</p>
  </div>
  <div className="chart-times" aria-hidden="true">{[0, 1 / 3, 2 / 3, 1].map(position => <span key={position}>{history ? historyTime(start + (end - start) * position,history.range) : '—'}</span>)}</div>
 </div>;
}
export const HistoryChart = memo(function HistoryChart({ history, metric, title, unit, failed, controls }: PlotProps & {controls?: ReactNode}) {
 const prior=useRef(history); const [outgoing,setOutgoing]=useState<HistorySeries | null>(null);
 useLayoutEffect(()=>{
  const previous=prior.current; prior.current=history;
  if(previous===history || !previous || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {setOutgoing(null);return;}
  setOutgoing(previous);
  const timer=setTimeout(()=>setOutgoing(null),220);
  return ()=>clearTimeout(timer);
 },[history]);
 return <section id={metric === 'power_w' ? 'history' : undefined} className={`panel history-chart ${metric === 'power_w' ? 'history' : 'current-history'}`} aria-label={title}>
  <div className="panel-head"><h2 className="panel-title">{title}</h2>{controls ?? <span className="micro">Знімок · {history ? historyRangeLabel(history.range) : '—'}</span>}</div>
  <div className="legend"><span><i className={`line-key ${metric==='power_w'?'gold':'silver'}`}/>{unit}</span><span><i className="gap-key"/>Немає вимірювань</span>{history?.kind==='aggregate' && <><span>Середнє · мінімум–максимум</span><span>Частковий інтервал — окрема точка</span><span>Приглушене тло — готується</span></>}</div>
  <div className={`chart-plots${outgoing ? ' chart-crossfade' : ''}`}>
   {outgoing && <Plot key={`outgoing-${snapshotKey(outgoing)}`} history={outgoing} metric={metric} title={title} unit={unit} failed={failed} outgoing/>}
   <Plot key={snapshotKey(history)} history={history} metric={metric} title={title} unit={unit} failed={failed}/>
  </div>
  <div className="gap-note"><span>{history ? `${historyTime(history.from,history.range)}–${historyTime(history.to,history.range)}` : '—'} · Київ</span><span>Пропуски не замінюються нулями</span></div>
 </section>;
});
