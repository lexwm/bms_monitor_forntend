import { useLayoutEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { HistorySeries } from '../api/validation';
import { format, time } from '../format';
import { binPending, chartAxis, historyTime, seriesSegments, type HistoryMetric } from '../history';

// gold and silver are the approved line colours; bronze and steel separate further lines of one chart.
export type LineTone = 'gold' | 'silver' | 'bronze' | 'steel';
export interface ChartLine { metric: HistoryMetric; label: string; tone: LineTone; emphasis?: 'strong' | 'dim' }
// The shared cursor: its position among the snapshot's points, the readout text and how it moves.
// Only touch is announced: keys already change the focused slider's value text, and a mouse hover is not announced.
export interface ChartCursor { time: number | null; index: number; count: number; text: string; move: (time: number, announce: boolean) => void; step: (delta: number) => void }

const snapshotKey=(history:HistorySeries | null)=>history ? `${history.range}:${history.to}:${history.source_revision}:${history.aggregate_revision}:${history.prepared_at}` : 'empty';
interface PlotProps { history: HistorySeries | null; lines: readonly ChartLine[]; title: string; unit: string; failed: boolean; zero: boolean; cursor?: ChartCursor; outgoing?: boolean }
function Plot({ history, lines, title, unit, failed, zero, cursor, outgoing=false }: PlotProps) {
 const id = useId();
 const single = lines.length === 1;
 const extra = lines.some(line => line.metric !== 'power_w' && line.metric !== 'current_a');
 // Envelopes stay readable only for one line or for the one emphasised line.
 // Moving the cursor re-renders the plot; the segments depend only on the snapshot and the lines.
 const drawn = useMemo(() => lines.map(line => ({ line, segments: history ? seriesSegments(history, line.metric) : [], envelope: history?.kind === 'aggregate' && (single || line.emphasis === 'strong') })), [history, lines, single]);
 const points = drawn.flatMap(item => item.segments.flatMap(segment => segment.points));
 const values = drawn.flatMap(item => item.segments.flatMap(segment => segment.points.flatMap(point => item.envelope ? [point.value, point.min ?? point.value, point.max ?? point.value] : [point.value])));
 const pending = history?.processing_status === 'pending' || (extra && history?.kind === 'aggregate' && history.detail_processing_status === 'pending');
 const emptyLabel = !history ? failed ? 'Історія недоступна' : 'Завантажуємо історію…' : pending && !values.length ? 'Історія готується…' : 'Немає значень показника за цей період';
 const rangeLabel = values.length ? `${unit}: від ${format(Math.min(...values), 2)} до ${format(Math.max(...values), 2)}` : emptyLabel;
 const { scale, min, max, labels } = chartAxis(values, zero);
 const start = history ? Date.parse(history.from) : 0;
 const end = history ? Date.parse(history.to) : 1;
 const x = (timestamp: number) => (timestamp - start) / (end - start) * 1000;
 const y = (value: number) => 150 - (value / scale - min) / (max - min) * 140;
 const path = (points: readonly { time: number; value: number }[]) => points.map((point, i) => `${i === 0 ? 'M' : 'L'}${x(point.time).toFixed(2)},${y(point.value).toFixed(2)}`).join(' ');
 const gaps=history?.kind==='raw' ? history.gaps : history?.bins.filter(bin=>bin.status==='ready' && bin.observed_coverage_seconds===0) ?? [];
 const metric = lines[0]?.metric ?? 'power_w';
 const pendingBins = history?.kind==='aggregate' ? history.bins.filter(bin=>binPending(bin,metric)) : [];
 const count = single ? `Виміряних точок: ${points.length}` : `Ліній: ${lines.length}. Значень: ${points.length}`;
 const description=history ? history.kind==='raw' ? `${title}. ${count}. ${rangeLabel}. Проміжків без вимірювань: ${gaps.length}` : `${title}. Середні значення${single ? ' та межі мінімуму й максимуму' : ''}. ${rangeLabel}. ${pending ? 'Частина історії ще готується.' : 'Історію підготовлено.'} Часткових інтервалів показника: ${points.filter(point=>point.partial).length}` : `${title}. ${emptyLabel}`;
 function pointer(event: PointerEvent<SVGSVGElement>) {
  if (!cursor || !history || (event.pointerType === 'mouse' && event.type === 'pointerdown' && event.button !== 0)) return;
  const box = event.currentTarget.getBoundingClientRect();
  cursor.move(start + Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)) * (end - start), event.pointerType === 'touch');
 }
 function key(event: KeyboardEvent<SVGSVGElement>) {
  // Home and End jump to the first and the last position; the page clamps the step. Tab is left alone.
  const step = event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -1 : event.key === 'End' ? Number.MAX_SAFE_INTEGER : event.key === 'Home' ? -Number.MAX_SAFE_INTEGER : 0;
  if (!cursor || !step) return;
  event.preventDefault(); cursor.step(step);
 }
 // Without a point there is nothing to move along: the chart stays an image with its text description.
 const interactive = !!cursor && !outgoing && points.length > 0;
 return <div className={`chart-layer${outgoing ? ' chart-outgoing' : ''}`} aria-hidden={outgoing ? true : undefined}>
  <div className="chart-frame">
   <div className="chart-y" aria-hidden="true">{labels.map((label, index) => <span key={index}>{label}</span>)}</div>
   {/* A slider, not an image: screen readers in browse mode pass the arrow keys to it. */}
   <svg className={`chart${interactive ? ' chart-interactive' : ''}`} viewBox="0 0 1000 160" preserveAspectRatio="none" {...(interactive ? { role: 'slider', 'aria-label': title, 'aria-describedby': `${id}-description`, 'aria-valuemin': 0, 'aria-valuemax': Math.max(0, cursor.count - 1), 'aria-valuenow': Math.max(0, cursor.index), 'aria-valuetext': cursor.text } : outgoing ? {} : { role: 'img', 'aria-label': description })}
    tabIndex={interactive ? 0 : undefined} onPointerMove={interactive ? pointer : undefined} onPointerDown={interactive ? pointer : undefined} onKeyDown={interactive ? key : undefined}>
    <defs><pattern id={`${id}-gap`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><line x1="0" y1="0" x2="0" y2="8" stroke="#969da5" strokeOpacity=".2" strokeWidth="2"/></pattern></defs>
    {[10, 80, 150].map(line => <line key={line} className="chart-grid" x1="0" x2="1000" y1={line} y2={line} vectorEffect="non-scaling-stroke"/>)}
    {gaps.map((gap, index) => <rect key={index} className="chart-gap" x={x(Date.parse(gap.from))} y="10" width={Math.max(0, x(Date.parse(gap.to)) - x(Date.parse(gap.from)))} height="140" fill={`url(#${id}-gap)`}><title>Немає вимірювань: {time(gap.from)}–{time(gap.to)}</title></rect>)}
    {pendingBins.map(bin=><rect key={bin.from} className="chart-pending" x={x(Date.parse(bin.from))} y="10" width={Math.max(0,x(Date.parse(bin.to))-x(Date.parse(bin.from)))} height="140"><title>Інтервал готується: {time(bin.from)}–{time(bin.to)}</title></rect>)}
    {drawn.map(({ line, segments, envelope }) => <g key={line.metric} className={line.emphasis ? `chart-${line.emphasis}` : undefined}>
     {/* One path per segment and per layer: the node count does not grow with the number of points. */}
     {envelope && segments.map((segment, index) => <path key={`e${index}`} className={`chart-envelope ${line.tone}`} d={segment.points.map((point,i)=>`${i===0?'M':'L'}${x(point.time)},${y(point.max ?? point.value)}`).concat([...segment.points].reverse().map(point=>`L${x(point.time)},${y(point.min ?? point.value)}`)).join(' ')+' Z'}/>)}
     {envelope && segments.map((segment, index) => <path key={`x${index}`} className={`chart-extrema ${line.tone}${segment.points.length === 1 && segment.points[0]?.partial ? ' chart-partial' : ''}`} d={segment.points.map(point => point.min !== undefined && point.max !== undefined ? `M${x(point.time)},${y(point.min)}V${y(point.max)}` : '').join('')} vectorEffect="non-scaling-stroke"/>)}
     {segments.map((segment, index) => <path key={index} className={`chart-line ${line.tone}`} data-testid={outgoing ? undefined : 'history-segment'} d={segment.points.length === 1 ? `${path(segment.points)}h.01` : path(segment.points)} fill="none" strokeWidth={segment.points.length === 1 ? 4 : line.emphasis === 'strong' ? 2.6 : 1.7} strokeLinecap={segment.points.length === 1 ? 'round' : undefined} vectorEffect="non-scaling-stroke"/>)}
    </g>)}
    {interactive && cursor.time !== null && history && <line className="chart-cursor" data-testid="chart-cursor" x1={x(cursor.time)} x2={x(cursor.time)} y1="4" y2="156" vectorEffect="non-scaling-stroke"/>}
   </svg>
   <p className="chart-empty" hidden={values.length > 0}>{emptyLabel}</p>
   {interactive && <p id={`${id}-description`} hidden>{description}</p>}
  </div>
  <div className="chart-times" aria-hidden="true">{[0, 1 / 3, 2 / 3, 1].map(position => <span key={position}>{history ? historyTime(start + (end - start) * position,history.range) : '—'}</span>)}</div>
 </div>;
}
export function HistoryChart({ history, lines, title, unit, failed, zero, cursor }: PlotProps) {
 const prior=useRef(history); const [outgoing,setOutgoing]=useState<HistorySeries | null>(null);
 useLayoutEffect(()=>{
  const previous=prior.current; prior.current=history;
  if(previous===history || !previous || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {setOutgoing(null);return;}
  setOutgoing(previous);
  const timer=setTimeout(()=>setOutgoing(null),220);
  return ()=>clearTimeout(timer);
 },[history]);
 const many = lines.length > 1;
 // The page explains gaps, averages and preparation once; a chart keeps only its own line key.
 return <section className="panel history-chart" aria-label={title}>
  <div className="panel-head"><h2 className="panel-title">{title}</h2>{many && <span className="micro">{unit}</span>}</div>
  <div className="legend">{lines.map(line => <span key={line.metric} className={line.emphasis === 'dim' ? 'legend-dim' : undefined}><i className={`line-key ${line.tone}`}/>{many ? line.label : unit}</span>)}</div>
  <div className={`chart-plots${outgoing ? ' chart-crossfade' : ''}`}>
   {outgoing && <Plot key={`outgoing-${snapshotKey(outgoing)}`} history={outgoing} lines={lines} title={title} unit={unit} failed={failed} zero={zero} outgoing/>}
   {/* A stable key keeps the focused slider in the DOM when a new snapshot arrives. */}
   <Plot key="current" history={history} lines={lines} title={title} unit={unit} failed={failed} zero={zero} {...(cursor ? { cursor } : {})}/>
  </div>
 </section>;
}
