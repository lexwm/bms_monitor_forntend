import { useEffect, useRef, useState } from 'react';
import { ApiFailure, fetchValidated } from './api/client';
import { validateState, validateEvent, validateHistoryUpdatedEvent, validateConfigurationUpdatedEvent, type StreamState, type TelemetryEvent } from './api/validation';
import { ageAt, newer } from './api/stream';
import { useConfiguration } from './useConfiguration';

// The single EventSource stays here; history consumers only receive its signals and own their requests.
export type TelemetrySignal = { kind: 'measurement' } | { kind: 'prepared'; revision: number } | { kind: 'recover' } | { kind: 'visibility'; hidden: boolean };
export class TelemetrySignals {
 private readonly listeners = new Set<(signal: TelemetrySignal) => void>();
 subscribe(listener: (signal: TelemetrySignal) => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
 emit(signal: TelemetrySignal) { for (const listener of [...this.listeners]) listener(signal); }
}
export function useTelemetry() {
 const [signals] = useState(() => new TelemetrySignals());
 const configuration = useConfiguration();
 const [state, setState] = useState<StreamState | null>(null);
 const [error, setError] = useState<string | null>(null);
 const [streamProblem, setStreamProblem] = useState(false);
 const refreshRequest = useRef<() => void>(() => {});
 const [age, setAge] = useState<number | null>(null);
 useEffect(() => {
  let active = true;
  let current: StreamState | null = null;
  let buffered: TelemetryEvent | null = null;
  let anchorServer = 0; let anchorLocal = 0;
  let recovery: AbortController | null = null;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let recovering = true; let failures = 0; let invalidResyncUsed=false;
  let invalidConfigurationResyncUsed = false;
  let clockReady=false; let transportDown=false;
  let aggregateRevision=-1;
  const source = new EventSource('/.well-known/mercure?topic=' + encodeURIComponent('urn:bms:battery:sacred-sun-monitor-01'));
  function tick() {
   const latest=current?.latest;
   setAge(latest ? ageAt(latest.received_at, anchorServer + performance.now() - anchorLocal) : null);
  }
  function applyEvent(event: TelemetryEvent) {
   if (!newer(current,event)) return;
   const jumped=current!==null && event.revision>current.revision+1;
   current={schema:1, revision:event.revision, server_time:event.server_time, latest:event.latest, topic:'urn:bms:battery:sacred-sun-monitor-01',hub_url:'/.well-known/mercure'};
   // Bootstrap clock stays authoritative: a delayed/replayed event never becomes fresh on arrival.
   setState(current); tick();
   if(jumped || event.history_changed)signals.emit({kind:'measurement'});
  }
  async function recover(refreshHistory=true) {
   if(!active)return;
   // History has its own endpoint and remains recoverable if the state endpoint fails.
   if(refreshHistory)signals.emit({kind:'recover'});
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
    aggregateRevision=value.aggregate_revision; signals.emit({kind:'prepared',revision:value.aggregate_revision});
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
  // Consumers load their own first snapshot when they mount.
  void recover(false);
  const timer=setInterval(tick,1000);
  const visible=() => { signals.emit({kind:'visibility',hidden:document.hidden}); if(!document.hidden) { failures=0; configuration.recover(); void recover(); } };
  document.addEventListener('visibilitychange',visible);
  return () => { active=false; refreshRequest.current=() => {}; source.close(); clearInterval(timer);clearTimeout(retry);recovery?.abort();document.removeEventListener('visibilitychange',visible); };
 },[signals]);
 return {state,error,streamProblem,age,refresh:()=>refreshRequest.current(),configuration,signals};
}
