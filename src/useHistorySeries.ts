import { useCallback, useEffect, useState } from 'react';
import { ApiFailure, fetchValidated } from './api/client';
import { HistoryRefresh } from './historyRefresh';
import type { TelemetrySignals } from './useTelemetry';
import { validateHistorySeries, type HistoryRange, type HistorySeries, type HistorySet } from './api/validation';

export interface RefreshPolicy<T> { measurement: boolean; prepared: boolean; interval: number; revision?: (data: T) => number; accept?: (data: T) => boolean }
export interface Refreshed<T> { data: T | null; failed: boolean; loading: boolean }

// One consumer of the shared stream signals: it owns its own request, cap and cancellation.
// A null path keeps the last snapshot but makes no requests and listens to nothing.
export function useRefreshed<T>(signals: TelemetrySignals, path: string | null, validate: (value: unknown) => value is T, policy: RefreshPolicy<T>): Refreshed<T> {
 const [data, setData] = useState<T | null>(null);
 const [failed, setFailed] = useState(false);
 const [loading, setLoading] = useState(path !== null);
 const { measurement, prepared, interval, revision: revisionOf, accept } = policy;
 useEffect(() => {
  if (path === null) { setLoading(false); return; }
  const url = path;
  let active = true; let controller: AbortController | null = null; let generation = 0; let revision = -1;
  const refresh = new HistoryRefresh(() => { void load(); }, interval);
  refresh.visibility(document.hidden);
  async function load() {
   controller?.abort(); const own = new AbortController(); controller = own;
   const request = ++generation; setLoading(true);
   try {
    const value = await fetchValidated(url, validate, own.signal);
    if (accept && !accept(value)) throw new ApiFailure('incompatible_response');
    if (active && !own.signal.aborted && request === generation) { setData(value); setFailed(false); if (revisionOf) revision = Math.max(revision, revisionOf(value)); }
   } catch { if (active && !own.signal.aborted && request === generation) setFailed(true); }
   finally { if (active && request === generation) { setLoading(false); refresh.complete(); } }
  }
  const unsubscribe = signals.subscribe(signal => {
   if (signal.kind === 'measurement') { if (measurement) refresh.signal(); }
   else if (signal.kind === 'prepared') { if (prepared && signal.revision > revision) refresh.signal(); }
   else if (signal.kind === 'recover') refresh.immediate();
   else {
    refresh.visibility(signal.hidden);
    if (signal.hidden) { controller?.abort(); generation++; setLoading(false); refresh.complete(); }
   }
  });
  refresh.immediate();
  return () => { active = false; unsubscribe(); refresh.dispose(); controller?.abort(); };
 }, [signals, path, validate, measurement, prepared, interval, revisionOf, accept]);
 return { data, failed, loading };
}

const seriesRevision = (series: HistorySeries) => series.aggregate_revision;
// Raw periods refresh at most every 15 seconds, prepared summaries at most every 60 seconds.
export function useHistorySeries(signals: TelemetrySignals, range: HistoryRange, set: HistorySet, active: boolean, signalsUsed: { measurement: boolean; prepared: boolean }) {
 const accept = useCallback((series: HistorySeries) => series.range === range, [range]);
 const path = active ? '/api/v1/battery/history/series?' + new URLSearchParams(set === 'basic' ? { range } : { range, set }).toString() : null;
 return useRefreshed(signals, path, validateHistorySeries, { ...signalsUsed, interval: range === '10m' || range === '1h' ? 15000 : 60000, revision: seriesRevision, accept });
}
