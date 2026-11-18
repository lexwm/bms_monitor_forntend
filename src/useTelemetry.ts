import { useEffect, useRef, useState } from 'react';
import { ApiFailure, fetchValidated } from './api/client';
import { validateState, validateEvent, validateHistorySeries, validateHistoryUpdatedEvent, validateConfigurationUpdatedEvent, type StreamState, type TelemetryEvent, type HistorySeries, type HistoryRange } from './api/validation';
import { ageAt, newer } from './api/stream';
import { HistoryRefresh } from './historyRefresh';
import { useConfiguration } from './useConfiguration';
export function useTelemetry() {
 const configuration = useConfiguration();
 const [state, setState] = useState<StreamState | null>(null);
 const [error, setError] = useState<string | null>(null);
 const [streamProblem, setStreamProblem] = useState(false);
 const [history, setHistory] = useState<HistorySeries | null>(null);
 const [historyError, setHistoryError] = useState(false);
 const [historyLoading, setHistoryLoading] = useState(true);
 const [range, setRange] = useState<HistoryRange>('10m');
 const selectRequest = useRef<(range: HistoryRange) => void>(() => {});
 const refreshRequest = useRef<() => void>(() => {});
 const [age, setAge] = useState<number | null>(null);
 useEffect(() => {
  let active = true;
  let current: StreamState | null = null;
  let buffered: TelemetryEvent | null = null;
  let anchorServer = 0; let anchorLocal = 0;
  let recovery: AbortController | null = null;
  let historyRequest: AbortController | null = null;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let recovering = true; let failures = 0; let invalidResyncUsed=false;
  let invalidConfigurationResyncUsed = false;
  let clockReady=false; let transportDown=false;
  let selected: HistoryRange='10m'; let generation=0; let aggregateRevision=-1;
  const historyRefresh=new HistoryRefresh(() => { void refreshHistory(); });
  historyRefresh.visibility(document.hidden);
  const source = new EventSource('/.well-known/mercure?topic=' + encodeURIComponent('urn:bms:battery:sacred-sun-monitor-01'));
  function tick() {
   const latest=current?.latest;
   setAge(latest ? ageAt(latest.received_at, anchorServer + performance.now() - anchorLocal) : null);
  }
  async function refreshHistory() {
   historyRequest?.abort(); const controller=new AbortController(); historyRequest=controller;
   const requestGeneration=++generation; const requestedRange=selected;
   setHistoryLoading(true);
   try {
    const data=await fetchValidated('/api/v1/battery/history/series?' + new URLSearchParams({range:requestedRange}),validateHistorySeries,controller.signal);
    if(data.range!==requestedRange)throw new ApiFailure('incompatible_response');
    if (active && !controller.signal.aborted && requestGeneration===generation) {
     setHistory(data); setHistoryError(false); aggregateRevision=Math.max(aggregateRevision,data.aggregate_revision);
    }
   } catch { if(active && !controller.signal.aborted && requestGeneration===generation)setHistoryError(true); }
   finally {
    if(active && requestGeneration===generation) { setHistoryLoading(false); historyRefresh.complete(); }
   }
  }
  selectRequest.current=(next) => {
   if(next===selected)return;
   selected=next; setRange(next); historyRefresh.immediate(next);
  };
  function applyEvent(event: TelemetryEvent) {
   if (!newer(current,event)) return;
   const jumped=current!==null && event.revision>current.revision+1;
   current={schema:1, revision:event.revision, server_time:event.server_time, latest:event.latest, topic:'urn:bms:battery:sacred-sun-monitor-01',hub_url:'/.well-known/mercure'};
   // Bootstrap clock stays authoritative: a delayed/replayed event never becomes fresh on arrival.
   setState(current); tick();
   if(jumped || event.history_changed)historyRefresh.signal();
  }
  async function recover(refreshHistory=true) {
   if(!active)return;
   // History has its own endpoint and remains recoverable if the state endpoint fails.
   if(refreshHistory)historyRefresh.immediate();
   recovery?.abort(); clearTimeout(retry);
   const controller=new AbortController(); recovery=controller; recovering=true;
   try {
    const data=await fetchValidated('/api/v1/telemetry/state',validateState,controller.signal);
    if(!active || controller.signal.aborted)return;
    anchorServer=Date.parse(data.server_time); anchorLocal=performance.now(); clockReady=true; historyRefresh.visibility(document.hidden);
    if(current===null || data.revision>=current.revision) { current=data; setState(data); }
    failures=0; setError(null); recovering=false; setStreamProblem(transportDown);
    const pending=buffered; buffered=null;
    if(pending)applyEvent(pending);
    tick();
   } catch(failure: unknown) {
    if(!active || controller.signal.aborted)return;
    setError(failure instanceof ApiFailure ? failure.code : 'network_error');
    recovering=false;
    if(clockReady && buffered) { const pending=buffered; buffered=null; applyEvent(pending); }
    if(++failures<=3)retry=setTimeout(() => { void recover(false); },Math.min(1000*2**failures,8000));
   }
  }
  source.addEventListener('open', () => { transportDown=false; setStreamProblem(false); failures=0; invalidResyncUsed=false; invalidConfigurationResyncUsed=false; configuration.recover(); void recover(); });
  source.addEventListener('error', () => { transportDown=true; if(active)setStreamProblem(true); });
  source.addEventListener('telemetry.updated.v1', (message: MessageEvent<string>) => {
   if(!active)return;
   let value: unknown;
   try { value=JSON.parse(message.data); } catch { value=null; }
   if(!validateEvent(value) || (value.latest!==null && value.latest.revision!==value.revision)) {
    setStreamProblem(true);
    if(!recovering && !invalidResyncUsed) { invalidResyncUsed=true; void recover(); }
    return;
   }
   setStreamProblem(transportDown);
   if(recovering || !clockReady) { if(buffered===null || value.revision>buffered.revision)buffered=value; }
   else applyEvent(value);
  });
  source.addEventListener('history.updated.v1', (message: MessageEvent<string>) => {
   if(!active)return;
   let value: unknown;
   try { value=JSON.parse(message.data); } catch { value=null; }
   if(!validateHistoryUpdatedEvent(value)) {
    setStreamProblem(true);
    if(!recovering && !invalidResyncUsed) { invalidResyncUsed=true; void recover(); }
    return;
   }
   if(value.aggregate_revision>aggregateRevision) {
    aggregateRevision=value.aggregate_revision; historyRefresh.signal();
   }
  });
  source.addEventListener('configuration.updated.v1', (message: MessageEvent<string>) => {
   if (!active) return;
   let value: unknown;
   try { value = JSON.parse(message.data); } catch { value = null; }
   if (validateConfigurationUpdatedEvent(value)) configuration.event(value);
   else if (!invalidConfigurationResyncUsed) { invalidConfigurationResyncUsed = true; configuration.recover(); }
  });
  // Also bootstrap when the hub is unavailable; opening later triggers a fresh snapshot.
  refreshRequest.current=() => { failures=0; void recover(); };
  void recover();
  const timer=setInterval(tick,1000);
  const visible=() => { historyRefresh.visibility(document.hidden); if(document.hidden) { historyRequest?.abort(); generation++; setHistoryLoading(false); historyRefresh.complete(); } else { failures=0; configuration.recover(); void recover(); } };
  document.addEventListener('visibilitychange',visible);
  return () => { active=false; refreshRequest.current=() => {}; selectRequest.current=() => {}; historyRefresh.dispose(); source.close(); clearInterval(timer);clearTimeout(retry);recovery?.abort();historyRequest?.abort();document.removeEventListener('visibilitychange',visible); };
 },[]);
 return {state,error,streamProblem,history,historyError,historyLoading,range,selectRange:(next: HistoryRange)=>selectRequest.current(next),age,refresh:()=>refreshRequest.current(),configuration};
}
