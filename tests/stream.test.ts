import { describe, it, expect } from 'vitest';
import { ageAt, newer } from '../src/api/stream';
import type { StreamState } from '../src/api/validation';
const state: StreamState={schema:1,revision:10,server_time:'2026-01-01T00:00:30Z',latest:null,topic:'urn:bms:battery:sacred-sun-monitor-01',hub_url:'/.well-known/mercure'};
describe('stream ordering and clock',()=>{
 it('discards duplicates and old buffered events',()=>{expect(newer(state,{...state,revision:9})).toBe(false);expect(newer(state,state)).toBe(false);expect(newer(state,{...state,revision:11})).toBe(true);});
 it('does not freshen replayed telemetry',()=>{expect(ageAt('2026-01-01T00:00:00Z',Date.parse(state.server_time))).toBe(30);});
});
