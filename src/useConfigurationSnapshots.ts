import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchValidated } from './api/client';
import { validateConfigurationSnapshot, validateConfigurationSnapshotPage, type ConfigurationSnapshot, type ConfigurationSnapshotMetadata } from './api/validation';

// Snapshot history is read only while its tab is open: one list request per user action and
// decoded snapshots one by one, at most two at a time. No polling, no second EventSource.
const concurrency = 2;
export type SnapshotDetail = ConfigurationSnapshot | 'failed';

export function useConfigurationSnapshots() {
 const [items, setItems] = useState<ConfigurationSnapshotMetadata[]>([]);
 const [next, setNext] = useState<string | null>(null);
 const [loading, setLoading] = useState(true);
 const [failed, setFailed] = useState(false);
 const [details, setDetails] = useState<ReadonlyMap<string, SnapshotDetail>>(new Map());
 const controller = useRef<AbortController | null>(null);
 const started = useRef(new Set<string>());
 const running = useRef(0);
 const busy = useRef(false);
 const nextRef = useRef<string | null>(null);

 useEffect(() => {
  // A development remount aborts the first reads, so their bookkeeping starts again.
  const own = new AbortController(); controller.current = own;
  busy.current = false; running.current = 0; started.current.clear();
  return () => own.abort();
 }, []);

 const load = useCallback(async (before: string | null) => {
  const signal = controller.current?.signal;
  if (!signal || busy.current) return;
  busy.current = true; setLoading(true); setFailed(false);
  try {
   const page = await fetchValidated(`/api/v1/battery/configuration/snapshots?limit=20${before ? `&before=${before}` : ''}`, validateConfigurationSnapshotPage, signal);
   if (signal.aborted) return;
   setItems(current => {
    const known = new Set(current.map(item => item.request_id));
    return [...current, ...page.snapshots.filter(item => !known.has(item.request_id))].sort((a, b) => b.request_order - a.request_order);
   });
   nextRef.current = page.next_before; setNext(page.next_before);
  } catch {
   if (!signal.aborted) setFailed(true);
  } finally {
   if (!signal.aborted) { busy.current = false; setLoading(false); }
  }
 }, []);
 useEffect(() => { void load(null); }, [load]);

 useEffect(() => {
  const signal = controller.current?.signal;
  if (!signal) return;
  for (const item of items) {
   if (running.current >= concurrency) break;
   const id = item.request_id;
   if (started.current.has(id)) continue;
   started.current.add(id); running.current++;
   fetchValidated(`/api/v1/battery/configuration/snapshots/${id}?view=decoded`, validateConfigurationSnapshot, signal)
    .then((snapshot): SnapshotDetail => snapshot.request_id === id ? snapshot : 'failed', (): SnapshotDetail => 'failed')
    .then(result => {
     if (signal.aborted) return;
     running.current--; setDetails(current => new Map(current).set(id, result));
    }, () => undefined);
  }
 }, [items, details]);

 return { items, details, hasMore: next !== null, loading, failed, more: useCallback(() => { void load(nextRef.current); }, [load]) };
}
