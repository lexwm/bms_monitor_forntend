import type { ConfigurationSnapshot, JbdField } from '../api/validation';
import { format, time } from '../format';
import type { useConfiguration } from '../useConfiguration';

const requestLabels = { pending: 'Очікуємо на збирач даних', running: 'Збирач отримує налаштування', completed: 'Результат отримано', expired: 'Час очікування минув' };
const dataLabels = { complete: 'Повний знімок', partial: 'Частковий знімок', unavailable: 'Налаштування не отримано' };
const fieldLabels = { verified: 'Підтверджене тлумачення', candidate: 'Попереднє тлумачення', unsupported: 'Не підтримується', raw: 'Лише вихідні байти', invalid: 'Некоректна відповідь' };
const units: Record<string, string> = { V: 'В', mV: 'мВ', A: 'А', mA: 'мА', Ah: 'А·год', W: 'Вт', s: 'с', ms: 'мс', min: 'хв', h: 'год', days: 'днів', count: 'шт.' };

function valueText(value: JbdField['value'], unit: string | null): string {
 if (value === null) return 'Невідомо';
 const integer = typeof value === 'number' && Number.isInteger(value) && (unit === null || ['count', 's', 'ms', 'min', 'h', 'days'].includes(unit));
 const text = typeof value === 'number' ? integer ? value.toLocaleString('uk-UA', { maximumFractionDigits: 0, useGrouping: false }) : format(value) : typeof value === 'boolean' ? value ? 'Так' : 'Ні' : value;
 return `${text}${unit ? ` ${units[unit] ?? unit}` : ''}`;
}

export function JbdFields({ fields }: { fields: JbdField[] }) {
 return <dl className="configuration-fields">{fields.map((field, index) => <div key={`${field.source}:${field.code}:${index}`}>
  <dt>{field.label_uk}<small>{fieldLabels[field.status]} · {field.source}{field.address ? ` · ${field.address}` : ''}</small></dt>
  <dd>{field.status === 'verified' ? valueText(field.value, field.unit) : field.status === 'candidate' ? `${valueText(field.candidate_value, field.unit)} · потребує підтвердження` : 'Невідомо'}
   {field.raw_hex && <small className="configuration-raw">Вихідні байти: <code>{field.raw_hex}</code></small>}
  </dd>
 </div>)}</dl>;
}

function Snapshot({ snapshot, previous = false }: { snapshot: ConfigurationSnapshot; previous?: boolean }) {
 return <div className="configuration-snapshot" data-testid={previous ? 'configuration-previous' : 'configuration-latest'}>
  <h3>{previous ? 'Попередній повний знімок' : 'Останній отриманий знімок'} · {dataLabels[snapshot.data_status]}</h3>
  <p className="notice">Період отримання від батареї: {time(snapshot.capture_started_at)}–{time(snapshot.capture_finished_at)} (Київ).<br/>Надійшло на сервер: {time(snapshot.accepted_at)}.</p>
  {snapshot.decoded.fields.length ? <JbdFields fields={snapshot.decoded.fields}/> : <p>Доступних значень немає. Невідомі показники не замінюються нулями.</p>}
  {!!snapshot.decoded.issues.length && <ul className="configuration-issues">{snapshot.decoded.issues.map((issue, index) => <li key={`${issue.code}:${index}`}>{issue.message_uk}</li>)}</ul>}
 </div>;
}

export function ConfigurationPanel({ configuration }: { configuration: ReturnType<typeof useConfiguration> }) {
 const { state, error, loading, creating, deadlineReached, request } = configuration;
 const latest = state?.latest;
 const job = state?.request;
 const expired = !!job && (job.state === 'expired' || deadlineReached === job.request_id);
 const pending = !!job && !expired && (job.state === 'pending' || job.state === 'running');
 return <section className="panel configuration" id="configuration" aria-label="Налаштування батареї">
  <div className="panel-head"><h2 className="panel-title">Налаштування батареї</h2><button type="button" className="refresh-button" disabled={creating || loading || pending} onClick={request}>Оновити налаштування</button></div>
  <p className="notice">Лише перегляд. Кнопка просить збирач прочитати налаштування батареї. Знімок відображає дані за вказаний період; він може бути неповним.</p>
  <p className="configuration-status" aria-live="polite">{creating ? 'Надсилаємо запит…' : expired ? 'Час очікування минув. Можна надіслати новий запит.' : job ? requestLabels[job.state] : state ? 'Запитів на оновлення ще не було.' : 'Стан запитів ще не отримано.'}</p>
  {job && <p className="notice">Останній запит: {time(job.created_at)}. Строк очікування: {time(job.deadline_at)}.{job.claimed_at && <> Збирач почав: {time(job.claimed_at)}.</>}</p>}
  {error && <p className="history-warning">Не вдалося оновити налаштування. {error === 'database_unavailable' ? 'База даних недоступна.' : error === 'incompatible_response' ? 'Сервер надіслав дані в непідтримуваному форматі.' : 'Перевірте зв’язок і повторіть спробу.'} Збережені знімки залишаються нижче.</p>}
  {loading && <p className="notice">Оновлюємо стан налаштувань…</p>}
  {latest ? <Snapshot snapshot={latest}/> : <p>{state ? 'Знімків налаштувань поки немає.' : 'Знімок налаштувань ще не отримано.'}</p>}
  {latest && latest.data_status !== 'complete' && state?.previous_complete && <><p className="notice">Останній результат неповний. Попередній повний знімок наведено окремо: значення між знімками не об’єднуються.</p><details><summary>Попередній повний знімок</summary><Snapshot snapshot={state.previous_complete} previous/></details></>}
 </section>;
}
