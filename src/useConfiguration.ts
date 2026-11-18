import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiFailure, configurationRequestId, fetchValidated, requestConfiguration } from './api/client';
import { validateConfigurationState, type ConfigurationState, type ConfigurationUpdatedEvent } from './api/validation';

// Configuration has its own revision and recovery. A failed settings read must not
// interrupt measurements or history, and notifications share their EventSource.
export function useConfiguration() {
 const [state, setState] = useState<ConfigurationState | null>(null);
 const [error, setError] = useState<string | null>(null);
 const [loading, setLoading] = useState(true);
 const [creating, setCreating] = useState(false);
 const [deadlineReached, setDeadlineReached] = useState<string | null>(null);
 const recoverRef = useRef<() => void>(() => {});
 const eventRef = useRef<(event: ConfigurationUpdatedEvent) => void>(() => {});
 const createRef = useRef<() => void>(() => {});
 useEffect(() => {
  let active = true;
  let current: ConfigurationState | null = null;
  let revision = -1;
  let read: AbortController | null = null;
  let write: AbortController | null = null;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let deadlineReconciled: string | null = null;
  let intent: string | null = null;
  let sequence = 0;
  let queuedRecovery = false;

  function armDeadline(data: ConfigurationState) {
   clearTimeout(deadline);
   const request = data.request;
   if (!request || (request.state !== 'pending' && request.state !== 'running')) {
    setDeadlineReached(request?.state === 'expired' ? request.request_id : null);
    return;
   }
   const remaining = Date.parse(request.deadline_at) - Date.parse(data.server_time);
   if (remaining <= 0) {
    setDeadlineReached(request.request_id);
    return;
   }
   setDeadlineReached(null);
   if (deadlineReconciled === request.request_id) return;
   deadline = setTimeout(() => {
    if (!active || current?.request?.request_id !== request.request_id) return;
    deadlineReconciled = request.request_id;
    setDeadlineReached(request.request_id);
    recover(true);
   }, remaining);
  }

  async function readState(controller: AbortController, generation: number, requestedRevision: number) {
   let followUp = false;
   try {
    const data = await fetchValidated('/api/v1/battery/configuration', validateConfigurationState, controller.signal);
    if (!active || controller.signal.aborted || generation !== sequence) return;
    if (data.revision < revision) {
     followUp = revision > requestedRevision;
     if (!followUp) setError('incompatible_response');
     return;
    }
    revision = data.revision;
    current = data;
    setState(data); setError(null); armDeadline(data);
   } catch (failure: unknown) {
    if (active && !controller.signal.aborted && generation === sequence) {
     setError(failure instanceof ApiFailure ? failure.code : 'network_error');
     followUp = revision > requestedRevision;
    }
   } finally {
    if (active && generation === sequence) {
     read = null; setLoading(false);
     // Keep one recovery for external signals that arrived during this read.
     const recoverAgain = followUp || queuedRecovery;
     queuedRecovery = false;
     if (recoverAgain) recover();
    }
   }
  }
  function recover(external = false) {
   if (!active) return;
   if (read) { if (external) queuedRecovery = true; return; }
   const controller = new AbortController(); read = controller;
   setLoading(true);
   void readState(controller, ++sequence, revision);
  }
  function invalidateRead() {
   read?.abort(); read = null; sequence++; queuedRecovery = false;
   recover();
  }
  async function create() {
   if (!active || write) return;
   const controller = new AbortController(); write = controller; setCreating(true);
   try {
    intent ??= configurationRequestId();
    await requestConfiguration(intent, controller.signal);
    if (!active || controller.signal.aborted) return;
    intent = null; setError(null); invalidateRead();
   } catch (failure: unknown) {
    if (!active || controller.signal.aborted) return;
    if (failure instanceof ApiFailure && failure.code === 'active_request') {
     intent = null; setError(null); invalidateRead();
    } else setError(failure instanceof ApiFailure ? failure.code : 'network_error');
   } finally {
    if (active) { write = null; setCreating(false); }
   }
  }
  recoverRef.current = () => recover(true);
  createRef.current = () => { void create(); };
  eventRef.current = event => {
   if (event.configuration_revision <= revision) return;
   revision = event.configuration_revision;
   recover();
  };
  recover();
  return () => {
   active = false; sequence++; read?.abort(); write?.abort(); clearTimeout(deadline);
   recoverRef.current = () => {}; createRef.current = () => {}; eventRef.current = () => {};
  };
 }, []);
 return {
  state, error, loading, creating, deadlineReached,
  recover: useCallback(() => recoverRef.current(), []),
  event: useCallback((event: ConfigurationUpdatedEvent) => eventRef.current(event), []),
  request: useCallback(() => createRef.current(), []),
 };
}
