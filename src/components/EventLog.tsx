import { useEffect, useRef, useState } from 'react';
import { fetchValidated } from '../api/client';
import { validateBatteryEventPage, type BatteryEvent, type BatteryEventPage } from '../api/validation';
import { eventText } from '../events';
import { time } from '../format';

const eventKey = (event: BatteryEvent) => `${event.occurred_at}~${event.boot_id}~${event.sequence}~${event.kind}~${event.bit ?? -1}`;
// Older pages are read only on request; a newly loaded first page starts the list again.
export function EventLog({ first, failed, loading }: { first: BatteryEventPage | null; failed: boolean; loading: boolean }) {
 const [older, setOlder] = useState<{ base: BatteryEventPage | null; events: BatteryEvent[]; next: string | null; failed: boolean }>({ base: null, events: [], next: null, failed: false });
 const [busy, setBusy] = useState(false);
 const controller = useRef<AbortController | null>(null);
 useEffect(() => () => controller.current?.abort(), []);
 const current = older.base === first ? older : { base: first, events: [], next: first?.next_before ?? null, failed: false };
 const seen = new Set<string>();
 const events = [...(first?.events ?? []), ...current.events].filter(event => { const key = eventKey(event); if (seen.has(key)) return false; seen.add(key); return true; });
 async function more() {
  if (current.next === null || busy) return;
  controller.current?.abort(); const own = new AbortController(); controller.current = own; setBusy(true);
  try {
   const page = await fetchValidated(`/api/v1/battery/events?limit=50&before=${encodeURIComponent(current.next)}`, validateBatteryEventPage, own.signal);
   if (!own.signal.aborted) setOlder({ base: current.base, events: [...current.events, ...page.events], next: page.next_before, failed: false });
  } catch { if (!own.signal.aborted) setOlder({ ...current, failed: true }); }
  finally { if (!own.signal.aborted) setBusy(false); }
 }
 return <section className="panel events" aria-label="Журнал подій">
  <div className="panel-head"><h2 className="panel-title">Журнал подій</h2><span className="micro">{first ? `Станом на ${time(first.as_of)} (Київ)` : '—'}</span></div>
  <p className="history-note">За даними батареї; тлумачення сигналів захисту не підтверджено</p>
  <ol className="event-list">
   {events.map(event => <li key={eventKey(event)} className={event.severity} data-testid="battery-event">
    <span className="event-time">{time(event.occurred_at)}</span>
    <strong>{eventText(event)}</strong>
    <span className="event-tags"><span className="event-severity">{event.severity === 'important' ? 'Важлива подія' : 'Інформація'}</span>{event.after_gap && <span>Після проміжку без вимірювань: точний момент невідомий</span>}</span>
   </li>)}
  </ol>
  <p className="history-warning">{failed || current.failed ? 'Не вдалося завантажити журнал. Показано вже отримані події.' : loading && !first ? 'Завантажуємо журнал…' : first && !events.length ? 'Подій поки немає.' : ''}</p>
  {current.next !== null && <button type="button" className="refresh-button" disabled={busy} onClick={() => { void more(); }}>{busy ? 'Завантажуємо…' : 'Показати старіші події'}</button>}
 </section>;
}
