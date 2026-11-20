import { useState } from 'react';
import type { ConfigurationSnapshotMetadata } from '../api/validation';
import { diffSnapshots, snapshotWear, type Reading, type Value } from '../configurationDiff';
import { valueText } from '../configurationLayout';
import { format, time } from '../format';
import { useConfigurationSnapshots, type SnapshotDetail } from '../useConfigurationSnapshots';

const dataLabels = { complete: 'Повний знімок', partial: 'Частковий знімок', unavailable: 'Налаштування не отримано' };
const dash = <span aria-label="немає даних">—</span>;

const ReadingText = ({ reading }: { reading: Reading | null }) => reading ? <>{valueText(reading.value, reading.unit)}{reading.candidate && <> <small>не підтверджено</small></>}</> : dash;
const shown = (value: Value, unit: string | null, candidate: boolean) => <>{valueText(value, unit)}{candidate && <> <small>не підтверджено</small></>}</>;
const Pending = ({ detail, columns }: { detail: SnapshotDetail | undefined; columns: number }) => <td colSpan={columns}>{detail === 'failed' ? 'Не вдалося завантажити знімок' : 'Завантажуємо знімок…'}</td>;

function Comparison({ item, older, details }: { item: ConfigurationSnapshotMetadata; older: ConfigurationSnapshotMetadata | undefined; details: ReadonlyMap<string, SnapshotDetail> }) {
 const current = details.get(item.request_id); const previous = older && details.get(older.request_id);
 if (!older) return <p>Старішого знімка серед завантажених немає. Завантажте наступну сторінку, щоб порівняти.</p>;
 if (!current || current === 'failed' || !previous || previous === 'failed') return <p aria-live="polite">{current === 'failed' || previous === 'failed' ? 'Не вдалося завантажити один зі знімків для порівняння.' : 'Завантажуємо знімки для порівняння…'}</p>;
 const diff = diffSnapshots(current.decoded.fields, previous.decoded.fields);
 return <>
  <p className="configuration-meta">Порівняння зі знімком від {time(older.capture_finished_at)} (Київ){[item, older].some(snapshot => snapshot.data_status !== 'complete') && ' · один зі знімків неповний, тому частину полів порівняти неможливо'}</p>
  {diff.changes.length ? <table className="configuration-matrix configuration-diff"><caption>Змінені значення: {diff.changes.length}</caption>
   <thead><tr><th scope="col">Параметр</th><th scope="col">Було</th><th scope="col">Стало</th></tr></thead>
   <tbody>{diff.changes.map(change => <tr key={change.code}><th scope="row">{change.label}</th><td>{shown(change.before, change.unit, change.candidate)}</td><td>{shown(change.after, change.unit, change.candidate)}</td></tr>)}</tbody></table>
   : <p>Відмінностей серед порівнянних полів немає (збігаються: {diff.same}).</p>}
  {!!diff.noData.length && <><h4>Немає даних для порівняння: {diff.noData.length}</h4><ul className="configuration-nodata">{diff.noData.map(entry => <li key={entry.code}>{entry.label}</li>)}</ul></>}
 </>;
}

export function ConfigurationSnapshots() {
 const { items, details, hasMore, loading, failed, more } = useConfigurationSnapshots();
 const [selected, setSelected] = useState('');
 const index = Math.max(0, items.findIndex(item => item.request_id === selected));
 const item = items[index];
 return <div className="configuration-snapshots" data-testid="configuration-snapshots">
  {failed && <p className="history-warning">Не вдалося завантажити знімки. Спробуйте ще раз.</p>}
  <p className="configuration-meta" aria-live="polite">Показано знімків: {items.length}{hasMore && ' · є старіші'}{loading && ' · завантажуємо…'}</p>
  {!items.length && !loading && !failed && <p>Знімків налаштувань поки немає.</p>}
  {!!items.length && <section className="panel configuration-section"><h3>Знімки</h3>
   <ul className="configuration-snapshot-list">{items.map(entry => <li key={entry.request_id}><button type="button" aria-pressed={entry === item} onClick={() => setSelected(entry.request_id)}>{time(entry.capture_finished_at)}<small>{dataLabels[entry.data_status]}</small></button></li>)}</ul>
   {(hasMore || failed) && <button type="button" className="refresh-button" disabled={loading} onClick={more}>{failed && !hasMore ? 'Повторити' : 'Завантажити ще'}</button>}
  </section>}
  {item && <section className="panel configuration-section"><h3>Порівняння з попереднім знімком</h3>
   <p className="configuration-meta"><strong>{time(item.capture_finished_at)} (Київ)</strong> · {dataLabels[item.data_status]}</p>
   <Comparison item={item} older={items[index + 1]} details={details}/></section>}
  {!!items.length && <section className="panel configuration-section"><h3>Вивчена ємність і цикли</h3>
   <table className="configuration-matrix configuration-wear"><thead><tr><th scope="col">Дата</th><th scope="col">Вивчена ємність</th><th scope="col">Цикли</th><th scope="col">Частка номінальної ємності</th></tr></thead>
    <tbody>{items.map(entry => { const detail = details.get(entry.request_id); const wear = detail && detail !== 'failed' ? snapshotWear(detail.decoded.fields) : null;
     return <tr key={entry.request_id}><th scope="row">{time(entry.capture_finished_at)}{entry.data_status !== 'complete' && <small>{dataLabels[entry.data_status]}</small>}</th>
      {wear ? <><td><ReadingText reading={wear.learned}/></td><td><ReadingText reading={wear.cycles}/></td><td>{wear.share === null ? dash : `${format(wear.share, 1)} %`}</td></> : <Pending detail={detail} columns={3}/>}</tr>; })}</tbody></table>
  </section>}
 </div>;
}
