import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTelemetry, type TelemetrySignals } from './useTelemetry';
import { format, time, clockTime } from './format';
import { SocIndicator } from './components/SocIndicator';
import { NumericReading } from './components/NumericReading';
import { ConfigurationPanel } from './components/ConfigurationPanel';
import { Bell } from './components/Bell';
import { HistoryPage } from './pages/HistoryPage';
import { periodExtremes } from './history';
import { averageCurrent, endLabel, projectTime } from './estimate';
import { parseRoute } from './route';
import { useHistorySeries, useRefreshed } from './useHistorySeries';
import { validateBatteryEventPage, type Battery } from './api/validation';
import { bellLit, readSeenMark, storeSeenMark } from './events';

const errorText: Record<string, string> = {
 no_measurements_yet: 'Вимірювань поки немає', database_unavailable: 'База даних недоступна',
 invalid_source_data: 'Джерело передало некоректні дані', incompatible_response: 'Сервер надіслав дані в непідтримуваному форматі',
};
// The bell asks for the newest event only after prepared history changes, at most once a minute.
const bellPolicy = { measurement: false, prepared: true, interval: 60000 };
export function App() {
 const [route, setRoute] = useState(() => parseRoute(location.hash));
 const page = route.page;
 useEffect(() => {
  const change = () => setRoute(parseRoute(location.hash));
  addEventListener('hashchange', change);
  return () => removeEventListener('hashchange', change);
 }, []);
 // Sections of the overview are rendered only on that page, so the browser cannot scroll to them itself.
 useEffect(() => {
  if (page !== 'overview') scrollTo(0, 0);
  else if (location.hash.length > 1) document.getElementById(location.hash.slice(1))?.scrollIntoView();
 }, [page]);
 const { state, error, streamProblem, age, refresh, configuration, signals } = useTelemetry();
 const bell = useRefreshed(signals, '/api/v1/battery/events?limit=1', validateBatteryEventPage, bellPolicy);
 const [seen, setSeen] = useState(readSeenMark);
 const eventsSeen = useCallback((value: string | null) => setSeen(storeSeenMark(value)), []);
 const [menuOpen, setMenuOpen] = useState(false);
 const menuButton = useRef<HTMLButtonElement>(null);
 const data = state?.latest;
 const stale = data?.stale === true || (age !== null && age > 20);
 const healthy = data?.state === 'fresh' && !stale && !error;
 const title = error ? (errorText[error] ?? 'Немає зв’язку із сервером') : !data ? (state ? 'Вимірювань поки немає' : 'Отримуємо стан…') : data.state === 'invalid' ? 'Немає коректного вимірювання' : stale ? 'Немає нових вимірювань' : 'Дані актуальні';
 const mode = healthy ? data?.mode : 'unknown';
 const battery = data?.battery;
 const lastValidAt = data?.valid ? data.received_at : data?.last_valid?.received_at;
 const modeLabel = !healthy ? 'Немає поточних даних' : battery?.current_a == null ? 'Немає даних про струм' : { charge: '↗ Заряджання', discharge: '↘ Розряджання', idle: 'Від мережі / без заряджання', unknown: 'Напрям струму невідомий' }[mode ?? 'unknown'];
 const modeDetail = !healthy ? 'Стан батареї очікує на актуальні показання.' : battery?.current_a == null ? 'Джерело не передало значення струму.' : {
  charge: 'Батарея накопичує енергію.', discharge: 'Батарея віддає енергію.',
  idle: 'Струм батареї дорівнює нулю.',
  unknown: 'Сервер не визначив напрям струму.',
 }[mode ?? 'unknown'];
 const temperatures = battery?.temperatures_c ?? [];
 const temperatureMax = temperatures.length ? Math.max(...temperatures) : null;
 const tempMin = Math.min(0, ...temperatures); const tempMax = Math.max(50, ...temperatures);
 const tempMagnitude = Math.max(Math.abs(tempMin), Math.abs(tempMax));
 const tempPosition = (value: number) => (value / tempMagnitude - tempMin / tempMagnitude) / (tempMax / tempMagnitude - tempMin / tempMagnitude) * 100;
 const cells = battery?.cells_v;
 const cellScale = Math.max(4, Math.ceil(Math.max(0, ...(cells ?? []))));
 const protection = battery?.protection_flags;
 function closeMenu() { setMenuOpen(false); menuButton.current?.focus(); }
 return <main className="stage"><div className="app" onKeyDown={event => { if (event.key === 'Escape' && menuOpen) closeMenu(); }}>
  <header className="topbar">
   <div className="brand"><button ref={menuButton} type="button" className="menu-toggle" aria-label={menuOpen ? 'Закрити меню' : 'Відкрити меню'} aria-expanded={menuOpen} aria-controls="main-menu" onClick={() => setMenuOpen(!menuOpen)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M4 6h16M4 12h11M4 18h16"/></svg></button><a className="brand-link" href="#overview"><span className="brand-name">Монітор <span>батареї</span></span><span className="brand-sub">8 комірок · літій-залізо-фосфатна</span></a></div>
   <section className={`status-bar ${healthy ? 'good' : 'neutral'}`} role="status" aria-live="polite"><span><i className="status-dot"/><strong>{title}</strong></span><span>{streamProblem && 'Канал оновлень відновлюється · '}{age === null ? 'Очікуємо дані' : `Вік даних: ${Math.floor(age)} с`}</span></section>
   <div className="header-right"><Bell lit={bellLit(bell.data?.latest_important_at, seen)} ready={bell.data !== null && !bell.loading}/><span className="demo-tag" style={{ visibility: data?.data_source === 'synthetic' ? 'visible' : 'hidden' }}>Тестові дані</span><span className="time">{data ? clockTime(data.received_at) : '—'} · Київ</span></div>
  </header>
  <nav id="main-menu" className="drawer" aria-label="Головне меню" hidden={!menuOpen}><div className="drawer-head">МОНІТОР БАТАРЕЇ<button type="button" aria-label="Закрити навігацію" onClick={closeMenu}>×</button></div><a href="#overview" className={page === 'overview' ? 'active' : undefined} aria-current={page === 'overview' ? 'page' : undefined} onClick={closeMenu}>Огляд</a><a href="#history" className={page === 'history' ? 'active' : undefined} aria-current={page === 'history' ? 'page' : undefined} onClick={closeMenu}>Історія</a><a href="#configuration" className={page === 'configuration' ? 'active' : undefined} aria-current={page === 'configuration' ? 'page' : undefined} onClick={closeMenu}>Налаштування батареї</a></nav>
  {route.page === 'configuration' ? <ConfigurationPanel configuration={configuration}/> : route.page === 'history' ? <HistoryPage tab={route.tab} cell={route.cell} signals={signals} refresh={refresh} onEventsSeen={eventsSeen}/> : <>
  <div className="grid" id="overview">
   <section className="panel hero"><div className="hero-head"><span className="device-chip">БАТАРЕЯ 01</span><span className="micro">8 комірок · {format(battery?.voltage_v, 2)} В</span></div>
    <SocIndicator value={battery?.soc_percent} mode={modeLabel}/>
    <div className="hero-bottom"><p className="eyebrow">СТАН БАТАРЕЇ</p><h1>Заряд батареї</h1><div className="hero-meta"><span>{format(battery?.remaining_ah)} А·год <span className="muted">за даними батареї</span></span><span>{protection == null ? 'Захист: немає даних' : protection === 0 ? 'Захист не спрацював' : 'Спрацював захист'}</span></div></div>
   </section>
   <Metric label="Струм батареї" detail={modeDetail} kind="current"><NumericReading value={battery?.current_a} unit="А" digits={3}/></Metric>
   <Metric label="Потужність" detail="Потужність батареї" kind="power"><NumericReading value={battery?.power_w} unit="Вт" digits={3}/></Metric>
   <section className="panel cells" aria-label="Напруга комірок"><div className="panel-head"><h2 className="panel-title">Комірки · напруга, В</h2><span className="delta">Δ {format(battery?.cell_delta_mv)} мВ</span></div>
    <div className="cells-grid">{Array.from({ length: 8 }, (_, index) => {
     const voltage = cells?.[index];
     const text = format(voltage, 3, 3);
     return <a className="cell" key={index} href={`#history/cells/${index + 1}`} aria-label={`Комірка ${String(index + 1).padStart(2, '0')}: ${voltage === undefined ? 'немає даних' : `${format(voltage, 3)} В`}. Історія комірки`}>
      <span className="cell-id">{String(index + 1).padStart(2, '0')}</span>
      <div className="cell-body">
       {voltage !== undefined && <div className="cell-fill" aria-hidden="true" style={{ width: `calc((100% - 6px) * ${voltage / cellScale})` }}/>}
       <div className="cell-reading" title={voltage === undefined ? 'Немає даних' : `${format(voltage, 3)} В`}>
        <strong className="reading-update" key={voltage} style={{ fontSize: `${5 / Math.max(5, text.length)}em` }}>{text}</strong><span className="cell-unit"> В</span>
       </div>
      </div>
     </a>;
    })}</div>
    <div className="cells-foot"><span>Мін. <b>{format(battery?.cell_min_v, 3)} В</b></span><span>Макс. <b>{format(battery?.cell_max_v, 3)} В</b></span></div><p className="scale-note">Шкала 0–{format(cellScale)} В · заповнення показує напругу, а не заряд</p>
    <DayRange signals={signals} kind="cells"/>
   </section>
   <section className="panel temps"><div className="panel-head"><h2 className="panel-title">Температури</h2><span className="micro">Датчиків: {temperatures.length || '—'}</span></div><div className="temp-top"><NumericReading value={temperatureMax} unit="°C"/></div><span className="temp-label">Найвище показання</span>
    <div className="temp-list" tabIndex={temperatures.length > 3 ? 0 : undefined} aria-label="Показання датчиків температури">{Array.from({ length: Math.max(3, temperatures.length) }, (_, index) => { const value = temperatures[index]; return <div className="temp-row" key={index} style={{ visibility: value === undefined ? 'hidden' : 'visible' }}><span>Датчик {String(index + 1).padStart(2, '0')}</span><div className="temp-bar" aria-hidden="true"><span style={{ width: value === undefined ? '0%' : `${tempPosition(value)}%` }}/></div><strong title={value === undefined ? undefined : `${format(value, 3)} °C`}>{format(value)}°</strong></div>; })}</div>
    <p className="temp-foot">{temperatures.length ? `Шкала ${format(tempMin)}–${format(tempMax)} °C · без оцінки меж безпеки` : 'Немає показань температури'}</p>
    <DayRange signals={signals} kind="temperatures"/>
   </section>
   <EstimateMetric signals={signals} healthy={healthy} battery={battery} measuredAt={data?.received_at}/>
   <Metric label="Цикли заряджання" detail="За лічильником батареї." kind="cycles"><NumericReading value={battery?.cycles} unit="" digits={3}/></Metric>
  </div>
  <div className="data-row"><details className="data-details" id="data-details"><summary>Про дані та час вимірювань</summary><dl><div><dt>Отримано джерелом</dt><dd>{data ? time(data.received_at) : '—'}</dd></div><div><dt>Точний час вимірювання</dt><dd>Невідомо</dd></div><div><dt>Час стану від сервера</dt><dd>{state ? time(state.server_time) : '—'}</dd></div><div><dt>Напруга батареї</dt><dd>{format(battery?.voltage_v, 2)} В</dd></div></dl><p className="notice">Останнє коректне вимірювання: {lastValidAt ? time(lastValidAt) : '—'}.</p><p>Графіки та повнота історії — на сторінці «Історія». Поточні показання оновлюються за повідомленнями сервера. Мінімум і максимум за 24 год оновлюються після підготовки зведеної історії й можуть відставати від свіжих вимірювань приблизно до 5 хв.</p></details><button type="button" className="refresh-button" onClick={refresh}>Оновити знімок</button></div>
  </>}
  <footer className="footer"><span>МОНІТОР БАТАРЕЇ / ПОКАЗАННЯ БАТАРЕЇ</span><span>Час: Київ · поточні показання від сервера</span></footer>
 </div></main>;
}
const metricIcons = { current: 'M2 12h5l2-7 4 14 3-9 2 2h4', power: 'm13 2-8 12h6l-1 8 9-13h-7z', cycles: 'M20 11a8 8 0 0 0-14.9-3M4 4v4h4M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4', estimate: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z' };
function Metric({ label, detail, kind, children }: { label: string; detail: string; kind: keyof typeof metricIcons; children: ReactNode }) {
 return <section className={`panel metric ${kind}`} aria-label={label}><div className="metric-top"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d={metricIcons[kind]}/></svg>{(kind === 'current' || kind === 'power') && <span className="badge">Постійний струм</span>}</div><div className="metric-value" data-testid={`${kind}-value`}>{children}</div><h2 className="metric-name">{label}</h2><p className="metric-sub">{detail}</p><div className="metric-rule"/></section>;
}

// Lowest and highest values of the last 24 hours; they follow prepared history, not each measurement.
const dayRangePolicy = { measurement: false, prepared: true };
function DayRange({ signals, kind }: { signals: TelemetrySignals; kind: 'cells' | 'temperatures' }) {
 const day = useHistorySeries(signals, '24h', kind === 'cells' ? 'cells' : 'overview', true, dayRangePolicy);
 const range = day.data ? periodExtremes(day.data, kind) : null;
 const unit = kind === 'cells' ? 'В' : '°C'; const digits = kind === 'cells' ? 3 : 1;
 const text = !range ? day.failed ? 'немає даних' : '—' : range.status === 'pending' ? 'готується' : range.min === null && range.max === null ? '—' : `мін. ${format(range.min, digits)} ${unit} · макс. ${format(range.max, digits)} ${unit}${kind === 'cells' ? ` · найбільша Δ ${format(range.delta, 1)} мВ` : ''}`;
 return <p className="day-range" data-testid={`day-range-${kind}`}>За 24 год: {text}{range && day.failed ? ' · не оновлено' : ''}</p>;
}

// The 10-minute window is read on measurement signals, at most every 15 seconds.
const recentPolicy = { measurement: true, prepared: false };
function EstimateMetric({ signals, healthy, battery, measuredAt }: { signals: TelemetrySignals; healthy: boolean; battery: Battery | null | undefined; measuredAt: string | undefined }) {
 const recent = useHistorySeries(signals, '10m', 'basic', true, recentPolicy);
 // A projection from stale or invalid readings would look like a current fact.
 const measured = measuredAt ? Date.parse(measuredAt) : null;
 const projection = healthy && measured !== null ? projectTime(battery?.current_a, averageCurrent(recent.data, healthy, recent.failed, measured), battery?.remaining_ah, battery?.reported_capacity_ah, measured) : null;
 const estimate = projection?.status === 'ready' ? projection.estimate : null;
 const detail = !projection ? 'Немає поточних даних.' : projection.status === 'zero' ? 'Струм дорівнює нулю (малі струми можуть не реєструватися).' : projection.status === 'unavailable' ? 'Недостатньо даних для розрахунку.'
  : `До повного ${projection.estimate.target === 'full' ? 'заряду' : 'розряду'} ${endLabel(projection.endsAt, measured ?? projection.endsAt)}, ${projection.basis === 'average' ? 'за середнім струмом за 10 хв' : 'за поточним струмом'}. Приблизно.`;
 return <Metric label="Розрахунковий час" detail={detail} kind="estimate">{!estimate ? '—' : estimate.minutes >= 60000 ? <><small>понад </small>999<small> год</small></> : <>{Math.floor(estimate.minutes / 60)}<small> год </small>{estimate.minutes % 60}<small> хв</small></>}</Metric>;
}
