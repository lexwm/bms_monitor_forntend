import type { EnergyDaily, HistoryRange } from '../api/validation';
import { coverageText, energyDay, kwh } from '../energy';
import { historyRangeLabel } from '../history';

const dayText = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('uk-UA', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });
// Registered energy per Kyiv day; a day without coverage has a label and no bar, never a zero bar.
export function EnergyBars({ daily, range }: { daily: EnergyDaily | null; range: HistoryRange }) {
 const days = daily ? [...daily.days].reverse().map(day => ({ day, view: energyDay(day, daily) })) : [];
 const largest = Math.max(0, ...days.flatMap(({ day, view }) => view.bar ? [day.charged_wh ?? 0, day.discharged_wh ?? 0] : []));
 const width = (value: number | null) => `${largest > 0 && value !== null ? value / largest * 100 : 0}%`;
 const shorter = range !== '30d' && range !== '3mo' && range !== '1y';
 return <section className="panel energy" aria-label="Зареєстрована енергія">
  <div className="panel-head"><h2 className="panel-title">Зареєстрована енергія по днях</h2><span className="micro">{daily ? historyRangeLabel(daily.range) : '—'}{shorter ? ` · вибраний період ${historyRangeLabel(range)} коротший за 30 днів` : ''}</span></div>
  <p className="history-note" data-testid="energy-warning">Струми, менші приблизно за 2,5 А, можуть реєструватися як 0, тому значення можуть бути заниженими</p>
  <div className="legend"><span><i className="line-key gold"/>Заряджено, кВт·год</span><span><i className="line-key silver"/>Віддано, кВт·год</span><span>Дні за київським часом, нові зверху</span></div>
  <ol className="energy-days" tabIndex={0} aria-label="Зареєстрована енергія по днях">
   {!daily && <li className="energy-empty">Дані про енергію ще не отримано.</li>}
   {days.map(({ day, view }) => <li key={day.date} data-testid="energy-day" data-date={day.date}>
    <div className="energy-day-head"><strong>{dayText(day.date)}</strong><span>покриття {coverageText(view.coverage)} %</span>{view.label && <span className="energy-label">{view.label}</span>}</div>
    {view.bar ? <>
     <div className="energy-bar gold"><span style={{ width: width(day.charged_wh) }}/><b>Заряджено {day.charged_wh === null ? '—' : kwh(day.charged_wh)} кВт·год</b></div>
     <div className="energy-bar silver"><span style={{ width: width(day.discharged_wh) }}/><b>Віддано {day.discharged_wh === null ? '—' : kwh(day.discharged_wh)} кВт·год</b></div>
    </> : null}
   </li>)}
  </ol>
 </section>;
}
