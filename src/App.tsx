import { useTelemetry } from './useTelemetry';
const format = (value: number | null | undefined, digits = 1) => value == null ? '—' : value.toLocaleString('ru-RU', { maximumFractionDigits: digits });
const time = (value: string) => new Date(value).toLocaleString('ru-RU', { timeZone: 'Europe/Kyiv' });
const errorText: Record<string, string> = {
 no_measurements_yet: 'Измерений пока нет', database_unavailable: 'База данных недоступна',
 invalid_source_data: 'Источник передал некорректные данные', incompatible_response: 'Ответ API не соответствует контракту',
};
export function App() {
 const {state, error, streamProblem, history, historyError, age, refresh}=useTelemetry();
 const data=state?.latest;
 const lastSuccess=state?.server_time;
 const stale = data?.stale === true || (age !== null && age > 20);
 const healthy = data?.state === 'fresh' && !stale && !error;
 const title = error ? (errorText[error] ?? 'Нет связи с сервером') : !data ? (state ? 'Измерений пока нет' : 'Получаем состояние…') : data.state === 'invalid' ? 'Нет корректного измерения' : stale ? 'Нет новых измерений' : 'Данные актуальны';
 const mode = healthy ? data?.mode : 'unknown';
 const modeLabel = { charge: 'Заряд', discharge: 'Разряд', idle: 'Покой', unknown: 'Режим не определён' }[mode ?? 'unknown'];
 const battery = data?.battery;
 return <main>
  <header className="masthead"><a className="brand" href="/" aria-label="BMS Monitor — главная"><span className="brand-symbol">▥</span><span>BMS<span className="brand-light"> / monitor</span></span></a><span className="network">Локальная сеть <span>↗</span></span></header>
  <section className="heading"><div><p className="eyebrow">ЭНЕРГИЯ ПОД НАБЛЮДЕНИЕМ</p><h1>Состояние батареи</h1><p className="subtitle">Последние показания. Без догадок о том, чего мы не знаем.</p></div>{data?.data_source === 'synthetic' && <span className="demo-tag">Тестовые данные</span>}</section>
  <section className={`status-bar ${healthy ? 'good' : 'warning'}`} role="status" aria-live="polite"><div><span className="status-dot"/><strong>{title}</strong></div><span>{age === null ? 'Ожидаем API' : `Возраст данных: ${Math.floor(age)} сек`}</span></section>
  {error && lastSuccess && <p className="notice">Последний успешный ответ: {time(lastSuccess)}. Ниже сохранённые показания, не текущее состояние.</p>}
  {streamProblem && <p className="notice">Канал обновлений восстанавливается. Возраст последних данных продолжает увеличиваться.</p>}
  <div className="overview">
   <section className="soc-card panel"><p className="eyebrow">УРОВЕНЬ ЗАРЯДА · BMS</p><div className="soc-value">{format(battery?.soc_percent, 0)}<span>%</span></div><div className="charge-track" role="img" aria-label={`Заряд ${format(battery?.soc_percent, 0)} процентов`}><div style={{ width: `${battery?.soc_percent ?? 0}%` }}/></div><div className="soc-bottom"><span className="mode">{modeLabel}</span><span>{format(battery?.remaining_ah)} <small>А·ч</small></span></div><p className="muted">Показание BMS, не измерение фактической ёмкости.</p></section>
   <section className="metrics" aria-label="Электрические показатели">
    <Metric label="Напряжение" value={format(battery?.voltage_v, 2)} unit="В" detail="На клеммах батареи"/>
    <Metric label="Ток" value={format(battery?.current_a, 2)} unit="А" detail="Исходный знак сохранён"/>
    <Metric label="Мощность" value={format(battery?.power_w)} unit="Вт" detail="Результирующая мощность батареи"/>
    <Metric label="Разбаланс ячеек" value={format(battery?.cell_delta_mv)} unit="мВ" detail="Разница максимума и минимума"/>
   </section>
  </div>
  <div className="details-grid">
   <section className="panel cells"><div className="section-title"><h2>Напряжение ячеек</h2><span>8 ячеек</span></div><div className="cell-grid">{Array.from({ length: 8 }, (_, index) => <div className="cell" key={index}><span className="cell-label">{String(index + 1).padStart(2, '0')}</span><strong>{format(battery?.cells_v?.[index], 3)}</strong><span>В</span></div>)}</div><p className="muted">Без оценок «норма / опасность»: характеристики батареи ещё не подтверждены.</p></section>
   <section className="panel provenance"><h2>О данных</h2><dl><div><dt>Получено источником</dt><dd>{data ? time(data.received_at) : '—'}</dd></div><div><dt>Часовой пояс</dt><dd>Киев</dd></div><div><dt>Точное время замера</dt><dd>Неизвестно</dd></div><div><dt>Температуры</dt><dd>{battery?.temperatures_c?.map(v => `${format(v)} °C`).join(' / ') || '—'}</dd></div></dl>{data?.last_valid && <p className="notice">Последнее корректное измерение: {time(data.last_valid.received_at)}.</p>}</section>
  </div>
  <section className="panel"><h2>Покрытие последних 10 минут</h2>
   {history && <p>Наблюдалось {format(history.observed_coverage_seconds, 0)} из {format(history.period_seconds, 0)} секунд. Промежутков без данных: {history.gaps.length}.</p>}
   {historyError && <p>Не удалось обновить историю. Сохранённый снимок может быть устаревшим.</p>}
   <p className="muted">Снимок на момент загрузки. Отсутствие показаний не означает нулевой ток или аварию.</p><button type="button" onClick={refresh}>Обновить снимок</button>
  </section>
  <footer><span><span className="footer-mark">◈</span> BMS Monitor</span><span>Только наблюдение · обновления от сервера</span></footer>
 </main>;
}
function Metric({ label, value, unit, detail }: { label: string; value: string; unit: string; detail: string }) {
 return <article className="panel metric"><h2>{label}</h2><p className="metric-value">{value}<span>{unit}</span></p><p className="muted">{detail}</p></article>;
}
