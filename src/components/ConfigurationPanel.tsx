import { useState, type KeyboardEvent } from 'react';
import type { ConfigurationSnapshot, JbdField } from '../api/validation';
import { configurationTabs, matrixColumns, type Section } from '../configurationLayout';
import { format, time } from '../format';
import type { useConfiguration } from '../useConfiguration';

const requestLabels = { pending: 'Очікуємо на збирач даних', running: 'Збирач отримує налаштування', completed: 'Результат отримано', expired: 'Час очікування минув' };
const dataLabels = { complete: 'Повний знімок', partial: 'Частковий знімок', unavailable: 'Налаштування не отримано' };
const fieldLabels = { verified: 'Підтверджене тлумачення', candidate: 'Попереднє тлумачення', unsupported: 'Не підтримується', raw: 'Лише вихідні байти', invalid: 'Некоректна відповідь' };
const units: Record<string, string> = { V: 'В', mV: 'мВ', A: 'А', mA: 'мА', Ah: 'А·год', W: 'Вт', s: 'с', ms: 'мс', 'µs': 'мкс', min: 'хв', h: 'год', days: 'днів', count: 'шт.', 'mΩ': 'мОм' };

function valueText(value: JbdField['value'], unit: string | null): string {
 if (value === null) return 'Невідомо';
 const integer = typeof value === 'number' && Number.isInteger(value) && (unit === null || ['count', 's', 'ms', 'min', 'h', 'days'].includes(unit));
 const text = typeof value === 'number' ? integer ? value.toLocaleString('uk-UA', { maximumFractionDigits: 0, useGrouping: false }) : format(value) : typeof value === 'boolean' ? value ? 'Так' : 'Ні' : value;
 return `${text}${unit ? ` ${units[unit] ?? unit}` : ''}`;
}
const origin = (field: JbdField) => `${field.source}${field.address ? ` · ${field.address}` : ''}`;

const unknownLabels = { unsupported: 'не підтримується', raw: 'не розшифровано', invalid: 'некоректна відповідь' };

function Value({ field }: { field: JbdField | 'missing' | null }) {
 if (!field) return null;
 if (field === 'missing') return <span>Невідомо <small>не отримано</small></span>;
 if (field.status === 'verified') return <span title={origin(field)}>{valueText(field.value, field.unit)}</span>;
 if (field.status === 'candidate') return <span title={origin(field)}>{valueText(field.candidate_value, field.unit)} <small>не підтверджено</small></span>;
 return <span title={origin(field)}>Невідомо <small>{unknownLabels[field.status]}</small></span>;
}

function SectionView({ section }: { section: Section }) {
 return <section className="panel configuration-section"><h3>{section.title}</h3>
  {section.kind === 'list' && <dl className="configuration-fields">{section.fields.map(field => <div key={field.code}><dt>{field.label_uk}</dt><dd><Value field={field}/></dd></div>)}</dl>}
  {section.kind === 'flags' && <ul className="configuration-flags">{section.fields.map((field, index) => <li key={field.code} title={field.label_uk}><span>{index + 1}</span><Value field={field}/></li>)}</ul>}
  {section.kind === 'matrix' && <table className="configuration-matrix"><thead><tr><td/>{matrixColumns.map(column => <th key={column} scope="col">{column}</th>)}</tr></thead>
   <tbody>{section.rows.map(row => <tr key={row.label}><th scope="row">{row.label}</th>{row.cells.map((cell, index) => <td key={index}><Value field={cell}/></td>)}</tr>)}</tbody></table>}
  {section.kind === 'service' && <dl className="configuration-fields service">{section.fields.map((field, index) => <div key={`${field.code}:${index}`}>
   <dt>{field.label_uk}<small>{fieldLabels[field.status]} · {origin(field)}{field.raw_hex && <> · <code>{field.raw_hex}</code></>}</small></dt><dd><Value field={field}/></dd>
  </div>)}</dl>}
 </section>;
}

function Snapshot({ snapshot, previous }: { snapshot: ConfigurationSnapshot; previous: boolean }) {
 const [selected, setSelected] = useState('');
 const tabs = configurationTabs(snapshot.decoded.fields);
 const active = tabs.find(tab => tab.id === selected) ?? tabs[0];
 const issues = [...new Set(snapshot.decoded.issues.map(issue => issue.message_uk))];
 function move(event: KeyboardEvent<HTMLDivElement>) {
  const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
  const next = step && active ? tabs[(tabs.indexOf(active) + step + tabs.length) % tabs.length] : undefined;
  if (!next) return;
  event.preventDefault(); setSelected(next.id);
  document.getElementById(`configuration-tab-${next.id}`)?.focus();
 }
 return <div className="configuration-snapshot" data-testid={previous ? 'configuration-previous' : 'configuration-latest'}>
  <p className="configuration-meta"><strong>{previous ? 'Попередній повний знімок' : dataLabels[snapshot.data_status]}</strong> · прочитано з батареї {time(snapshot.capture_finished_at)} (Київ)</p>
  {!!issues.length && <ul className="configuration-issues">{issues.map(issue => <li key={issue}>{issue}</li>)}</ul>}
  {active ? <>
   <div className="configuration-tabs" role="tablist" aria-label="Розділи налаштувань" onKeyDown={move}>{tabs.map(tab => <button key={tab.id} type="button" role="tab" id={`configuration-tab-${tab.id}`} aria-selected={tab === active} aria-controls="configuration-tabpanel" tabIndex={tab === active ? 0 : -1} onClick={() => setSelected(tab.id)}>{tab.label}</button>)}</div>
   <div className="configuration-sections" role="tabpanel" id="configuration-tabpanel" aria-labelledby={`configuration-tab-${active.id}`}>{active.sections.map(section => <SectionView key={section.title} section={section}/>)}</div>
  </> : <p>Доступних значень немає.</p>}
 </div>;
}

export function ConfigurationPanel({ configuration }: { configuration: ReturnType<typeof useConfiguration> }) {
 const { state, error, loading, creating, deadlineReached, request } = configuration;
 // The choice belongs to one previous snapshot, so a later partial result is not replaced by an older one unasked.
 const [previousId, setPreviousId] = useState<string | null>(null);
 const latest = state?.latest;
 const job = state?.request;
 const expired = !!job && (job.state === 'expired' || deadlineReached === job.request_id);
 const pending = !!job && !expired && (job.state === 'pending' || job.state === 'running');
 const fallback = latest && latest.data_status !== 'complete' ? state?.previous_complete : null;
 const previous = !!fallback && previousId === fallback.request_id;
 const shown = previous ? fallback : latest;
 return <section className="configuration" id="configuration" aria-label="Налаштування батареї">
  <div className="configuration-head">
   <div><a className="configuration-back" href="#overview">← Огляд</a><h1>Налаштування батареї</h1></div>
   <button type="button" className="refresh-button" disabled={creating || loading || pending} onClick={request}>Оновити налаштування</button>
  </div>
  <p className="configuration-status" aria-live="polite">{creating ? 'Надсилаємо запит…' : expired ? 'Час очікування минув. Можна надіслати новий запит.' : job ? requestLabels[job.state] : state ? 'Запитів на оновлення ще не було.' : 'Стан запитів ще не отримано.'}{pending && <> · до {time(job.deadline_at)}</>}</p>
  {error && <p className="history-warning">Не вдалося оновити налаштування. {error === 'database_unavailable' ? 'База даних недоступна.' : error === 'incompatible_response' ? 'Сервер надіслав дані в непідтримуваному форматі.' : 'Перевірте зв’язок і повторіть спробу.'}</p>}
  {fallback && <div className="configuration-tabs" role="group" aria-label="Знімок налаштувань">
   <button type="button" aria-pressed={!previous} onClick={() => setPreviousId(null)}>Останній знімок</button>
   <button type="button" aria-pressed={previous} onClick={() => setPreviousId(fallback.request_id)}>Попередній повний знімок</button>
  </div>}
  {shown ? <Snapshot snapshot={shown} previous={previous}/> : <p>{state ? 'Знімків налаштувань поки немає.' : 'Знімок налаштувань ще не отримано.'}</p>}
 </section>;
}
