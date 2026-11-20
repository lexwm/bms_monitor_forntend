import { useEffect, useMemo, useState } from 'react';
import type { HistoryRange, HistorySeries } from '../api/validation';
import { validateBatteryEventPage, validateEnergyDaily } from '../api/validation';
import { HistoryChart, type ChartCursor, type ChartLine, type LineTone } from '../components/HistoryChart';
import { EnergyBars } from '../components/EnergyBars';
import { EventLog } from '../components/EventLog';
import { energyRange } from '../energy';
import { format, historySeconds, time } from '../format';
import { cursorTimes, cursorValue, historyRangeLabel, historyRanges, nearestIndex } from '../history';
import { historyHash, type HistoryTab } from '../route';
import { useHistorySeries, useRefreshed } from '../useHistorySeries';
import type { TelemetrySignals } from '../useTelemetry';

interface ChartSpec { title: string; unit: string; symbol: string; zero: boolean; lines: ChartLine[] }
const tones: LineTone[] = ['gold', 'silver', 'bronze', 'steel'];
const pad = (value: number) => String(value).padStart(2, '0');
const tabs: ReadonlyArray<{ id: HistoryTab; label: string }> = [{ id: 'overview', label: 'Огляд' }, { id: 'cells', label: 'Комірки' }, { id: 'energy', label: 'Енергія' }, { id: 'events', label: 'Події' }];
// The page reads only what its open tab shows: one series, the daily energy or the first journal page.
const seriesPolicy = { measurement: true, prepared: true };
const energyPolicy = { measurement: false, prepared: true, interval: 60000 };
const eventsPolicy = { measurement: false, prepared: false, interval: 60000 };

function sensorCount(series: HistorySeries | null): number {
 if (!series) return 1;
 const lengths = series.kind === 'raw' ? series.points.map(point => point.temperatures_c?.length ?? 0) : series.bins.map(bin => bin.temperatures_c?.length ?? 0);
 return Math.max(1, Math.min(16, Math.max(0, ...lengths)));
}
function overviewCharts(sensors: number): ChartSpec[] {
 return [
  { title: 'Потужність', unit: 'Потужність, Вт', symbol: 'Вт', zero: true, lines: [{ metric: 'power_w', label: 'Потужність', tone: 'gold' }] },
  { title: 'Струм', unit: 'Струм, А', symbol: 'А', zero: true, lines: [{ metric: 'current_a', label: 'Струм', tone: 'silver' }] },
  { title: 'Заряд', unit: 'Заряд, %', symbol: '%', zero: false, lines: [{ metric: 'soc_percent', label: 'Заряд', tone: 'gold' }] },
  { title: 'Напруга батареї', unit: 'Напруга, В', symbol: 'В', zero: false, lines: [{ metric: 'voltage_v', label: 'Напруга', tone: 'silver' }] },
  { title: 'Температури', unit: 'Температура, °C', symbol: '°C', zero: false, lines: Array.from({ length: sensors }, (_, index) => ({ metric: `temperature:${index}`, label: `Датчик ${pad(index + 1)}`, tone: tones[index % tones.length] ?? 'silver' })) },
 ];
}
function cellCharts(cell: number | null): ChartSpec[] {
 return [
  { title: 'Напруга комірок', unit: 'Напруга, В', symbol: 'В', zero: false, lines: Array.from({ length: 8 }, (_, index) => ({ metric: `cell:${index}`, label: `Комірка ${index + 1}`, tone: cell === index + 1 ? 'gold' : 'silver', ...(cell === null ? {} : { emphasis: cell === index + 1 ? 'strong' : 'dim' }) })) },
  { title: 'Різниця напруг комірок', unit: 'Різниця, мВ', symbol: 'мВ', zero: true, lines: [{ metric: 'cell_delta_mv', label: 'Різниця', tone: 'gold' }] },
 ];
}
// Values under the cursor as one sentence, so the charts never depend on sight alone.
function readout(series: HistorySeries, at: number, charts: readonly ChartSpec[]): string {
 const times = cursorTimes(series); const index = nearestIndex(times, at);
 if (index < 0) return 'Немає точок для курсора.';
 const bin = series.kind === 'aggregate' ? series.bins[index] : undefined;
 const moment = bin ? `${time(bin.from)}–${time(bin.to)}` : time(new Date(times[index] ?? at).toISOString());
 const parts = charts.map(chart => `${chart.title}: ${chart.lines.map(line => {
  const value = cursorValue(series, index, line.metric);
  const text = value === null ? 'немає значення' : value === 'pending' ? 'готується' : value.kind === 'point' ? `${format(value.value, 3)} ${chart.symbol}` : `середнє ${format(value.mean, 3)} ${chart.symbol} (мін. ${format(value.min, 3)}, макс. ${format(value.max, 3)})`;
  return chart.lines.length > 1 ? `${line.label.toLowerCase()} ${text}` : text;
 }).join(', ')}`);
 return `${moment} (Київ). ${parts.join('. ')}.`;
}

function Quality({ history, failed, loading, range, refresh }: { history: HistorySeries | null; failed: boolean; loading: boolean; range: HistoryRange; refresh: () => void }) {
 const coverage = history && history.observed_coverage_seconds !== null && history.processing_status === 'ready' ? Math.min(100, history.observed_coverage_seconds / history.period_seconds * 100) : null;
 const detail = history?.kind === 'aggregate' && history.detail_processing_status === 'pending' ? ` Додаткові показники готуються: підготовлено ${historySeconds(history.detail_prepared_coverage_seconds)} із ${historySeconds(history.period_seconds)} секунд.` : '';
 return <section className="panel quality" aria-label="Повнота історії"><div className="panel-head"><h2 className="panel-title">Повнота історії</h2><span className="micro">{history ? historyRangeLabel(history.range) : '—'}</span></div><div className="quality-body"><div><div className="quality-value">{format(coverage, 1)}<span>%</span></div><div className="quality-track" aria-hidden="true"><span style={{ width: `${coverage ?? 0}%` }}/></div></div><div className="quality-summary"><p className="quality-copy">Спостерігалося {historySeconds(history?.observed_coverage_seconds)} із {historySeconds(history?.period_seconds)} секунд.<br/>Проміжків без вимірювань: {history?.kind === 'raw' ? history.gaps.length : '—'}.<br/>Станом на {history ? time(history.to) : '—'} (Київ).<br/>{history?.processing_status === 'pending' ? `Історія готується. Підготовлено ${historySeconds(history.prepared_coverage_seconds)} із ${historySeconds(history.period_seconds)} секунд.` : history?.kind === 'aggregate' ? 'Межі коротких пропусків у зведених інтервалах невідомі.' : ''}{detail}</p></div></div><RefreshFoot text={failed ? 'Не вдалося оновити історію. Збережений знімок може бути застарілим.' : loading ? `Оновлюємо історію · ${historyRangeLabel(range)}. Показано попередній знімок.` : history ? 'Знімок історії на момент оновлення.' : 'Знімок історії ще не отримано.'} refresh={refresh}/></section>;
}
const RefreshFoot = ({ text, refresh }: { text: string; refresh: () => void }) => <div className="quality-foot"><p className="history-warning">{text}</p><button type="button" className="refresh-button" onClick={refresh}>Оновити знімок</button></div>;

export function HistoryPage({ tab, cell, signals, refresh, onEventsSeen }: { tab: HistoryTab; cell: number | null; signals: TelemetrySignals; refresh: () => void; onEventsSeen: (value: string | null) => void }) {
 const [range, setRange] = useState<HistoryRange>('10m');
 // The cursor belongs to one tab and period, so it never jumps to the edge of another period's data.
 const view = `${tab}:${range}`;
 const [placed, setPlaced] = useState<{ view: string; at: number; spoken: string } | null>(null);
 const current = placed?.view === view ? placed : null;
 const overview = useHistorySeries(signals, range, 'overview', tab === 'overview', seriesPolicy);
 const cells = useHistorySeries(signals, range, 'cells', tab === 'cells', seriesPolicy);
 const energy = useRefreshed(signals, tab === 'energy' ? `/api/v1/battery/energy/daily?range=${energyRange(range)}` : null, validateEnergyDaily, energyPolicy);
 const events = useRefreshed(signals, tab === 'events' ? '/api/v1/battery/events?limit=50' : null, validateBatteryEventPage, eventsPolicy);
 // Opening the journal marks the server's latest important episode as seen in this browser.
 useEffect(() => { if (events.data) onEventsSeen(events.data.latest_important_at); }, [events.data, onEventsSeen]);
 const active = tab === 'cells' ? cells : overview;
 const series = active.data;
 const sensors = sensorCount(tab === 'overview' ? series : null);
 const charts = useMemo(() => tab === 'cells' ? cellCharts(cell) : overviewCharts(sensors), [tab, cell, sensors]);
 const times = useMemo(() => series ? cursorTimes(series) : [], [series]);
 const index = current === null || !times.length ? -1 : nearestIndex(times, current.at);
 const at = times[index] ?? null;
 const text = series && at !== null ? readout(series, at, charts) : 'Наведіть курсор або торкніться графіка; також можна вибрати графік і рухати курсор клавішами ← та →.';
 // The visible readout follows every move; only touch is announced: keys change the focused slider's value text, and hovering and refreshes do not flood the screen reader.
 const place = (value: number, announce: boolean) => setPlaced({ view, at: value, spoken: announce && series ? readout(series, value, charts) : current?.spoken ?? '' });
 const cursor: ChartCursor = {
  time: at, index, count: times.length, text,
  move: (next, announce) => { const value = times[nearestIndex(times, next)]; if (value !== undefined) place(value, announce); },
  step: delta => {
   const value = times[Math.max(0, Math.min(times.length - 1, (index < 0 ? (delta > 0 ? -1 : times.length) : index) + delta))];
   if (value !== undefined) place(value, false);
  },
 };
 const chartTab = tab === 'overview' || tab === 'cells';
 return <section className="history-page" aria-label="Історія">
  <div className="configuration-head"><div><a className="configuration-back" href="#overview">← Огляд</a><h1>Історія</h1></div>
   {tab !== 'events' && <div className="history-controls" role="group" aria-label="Період історії">{historyRanges.map(item => <button key={item.value} type="button" aria-pressed={range === item.value} disabled={range === item.value} onClick={() => setRange(item.value)}>{item.label}</button>)}</div>}
  </div>
  <nav className="configuration-tabs history-tabs" aria-label="Розділи історії">{tabs.map(item => <a key={item.id} href={historyHash(item.id)} aria-current={tab === item.id ? 'page' : undefined}>{item.label}</a>)}</nav>
  {tab === 'cells' && <nav className="history-cells" aria-label="Вибір комірки"><a href={historyHash('cells')} aria-current={cell === null ? 'page' : undefined}>Усі</a>{Array.from({ length: 8 }, (_, index) => <a key={index} href={historyHash('cells', index + 1)} aria-current={cell === index + 1 ? 'page' : undefined} aria-label={`Комірка ${index + 1}`}>{index + 1}</a>)}</nav>}
  {chartTab && <>
   <p className="history-readout" data-testid="cursor-readout">{text}</p>
   <p className="sr-only" aria-live="polite" data-testid="cursor-announcement">{current?.spoken}</p>
   <div className="legend history-legend"><span><i className="gap-key"/>Немає вимірювань</span>{series?.kind === 'aggregate' && <><span>Середнє; мінімум–максимум — для однієї або виділеної лінії</span><span>Частковий інтервал — окрема точка</span><span>Приглушене тло — готується</span></>}<span>Пропуски не замінюються нулями · час київський</span></div>
   <div className="history-charts">{charts.map(chart => <HistoryChart key={chart.title} title={chart.title} unit={chart.unit} lines={chart.lines} zero={chart.zero} history={series} failed={active.failed} cursor={cursor}/>)}</div>
   <Quality history={series} failed={active.failed} loading={active.loading} range={range} refresh={refresh}/>
  </>}
  {tab === 'energy' && <><EnergyBars daily={energy.data} range={range}/><RefreshFoot text={energy.failed ? 'Не вдалося оновити дані про енергію. Збережений знімок може бути застарілим.' : energy.loading ? 'Оновлюємо дані про енергію…' : energy.data ? `Станом на ${time(energy.data.as_of)} (Київ).` : 'Дані про енергію ще не отримано.'} refresh={refresh}/></>}
  {tab === 'events' && <><EventLog first={events.data} failed={events.failed} loading={events.loading}/><RefreshFoot text="Журнал оновлюється при відкритті та за кнопкою." refresh={refresh}/></>}
 </section>;
}
