import { useEffect, useRef, useState } from 'react';
import { ApiFailure, fetchValidated } from './api/client';
import { validateState, validateEvent, validateHistory, type StreamState, type TelemetryEvent, type HistoryResponse } from './api/validation';
import { ageAt, newer } from './api/stream';
export function useTelemetry() {
 const [state, setState] = useState<StreamState | null>(null);
 const [error, setError] = useState<string | null>(null);
 const [streamProblem, setStreamProblem] = useState(false);
 const [history, setHistory] = useState<HistoryResponse | null>(null);
 const [historyError, setHistoryError] = useState(false);
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
  let clockReady=false; let transportDown=false;
  const source = new EventSource('/.well-known/mercure?topic=' + encodeURIComponent('urn:bms:battery:sacred-sun-monitor-01'));
  function tick() {
   const latest=current?.latest;
   setAge(latest ? ageAt(latest.received_at, anchorServer + performance.now() - anchorLocal) : null);
  }
  async function refreshHistory() {
   historyRequest?.abort(); const controller=new AbortController(); historyRequest=controller;
   const end=new Date(anchorServer+performance.now()-anchorLocal);
   const start=new Date(end.getTime()-600000);
   try {
    const data=await fetchValidated('/api/v1/battery/history?' + new URLSearchParams({from:start.toISOString(),to:end.toISOString()}),validateHistory,controller.signal);
    if (active && !controller.signal.aborted) { setHistory(data); setHistoryError(false); }
   } catch { if(active && !controller.signal.aborted)setHistoryError(true); }
  }
  function applyEvent(event: TelemetryEvent) {
   if (!newer(current,event)) return;
   const jumped=current!==null && event.revision>current.revision+1;
   current={schema:1, revision:event.revision, server_time:event.server_time, latest:event.latest, topic:'urn:bms:battery:sacred-sun-monitor-01',hub_url:'/.well-known/mercure'};
   // Bootstrap clock stays authoritative: a delayed/replayed event never becomes fresh on arrival.
   setState(current); tick();
   if(jumped)void refreshHistory();
  }
  async function recover() {
   if(!active)return;
   recovery?.abort(); clearTimeout(retry);
   const controller=new AbortController(); recovery=controller; recovering=true;
   try {
    const data=await fetchValidated('/api/v1/telemetry/state',validateState,controller.signal);
    if(!active || controller.signal.aborted)return;
    anchorServer=Date.parse(data.server_time); anchorLocal=performance.now(); clockReady=true;
    if(current===null || data.revision>=current.revision) { current=data; setState(data); }
    failures=0; setError(null); recovering=false; setStreamProblem(transportDown);
    const pending=buffered; buffered=null;
    if(pending)applyEvent(pending);
    tick(); void refreshHistory();
   } catch(failure: unknown) {
    if(!active || controller.signal.aborted)return;
    setError(failure instanceof ApiFailure ? failure.code : 'network_error');
    recovering=false;
    if(clockReady && buffered) { const pending=buffered; buffered=null; applyEvent(pending); }
    if(++failures<=3)retry=setTimeout(() => { void recover(); },Math.min(1000*2**failures,8000));
   }
  }
  source.addEventListener('open', () => { transportDown=false; setStreamProblem(false); failures=0; invalidResyncUsed=false; void recover(); });
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
  // Also bootstrap when the hub is unavailable; opening later triggers a fresh snapshot.
  refreshRequest.current=() => { failures=0; void recover(); };
  void recover();
  const timer=setInterval(tick,1000);
  const visible=() => { if(!document.hidden) { failures=0; void recover(); } };
  document.addEventListener('visibilitychange',visible);
  return () => { active=false; refreshRequest.current=() => {}; source.close(); clearInterval(timer);clearTimeout(retry);recovery?.abort();historyRequest?.abort();document.removeEventListener('visibilitychange',visible); };
 },[]);
 return {state,error,streamProblem,history,historyError,age,refresh:()=>refreshRequest.current()};
}
