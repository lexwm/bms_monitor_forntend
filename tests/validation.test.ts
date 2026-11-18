import { describe, it, expect } from 'vitest';
import { validateError, validateLatest } from '../src/api/validation';
describe('contract boundary', () => {
 it('does not coerce unknown input', () => {
  expect(validateLatest(null)).toBe(false);
  expect(validateLatest({ state: 'fresh', battery: {} })).toBe(false);
  expect(validateError({ error: { code: 404, message: 'Missing' } })).toBe(false);
 });
 it('accepts additive response fields but not unknown codes', () => {
  expect(validateError({ error: { code: 'no_measurements_yet', message: 'Missing', extra: true }, future: 1 })).toBe(true);
  expect(validateError({ error: { code: 'new_undocumented_code', message: 'Missing' } })).toBe(false);
 });
});

import { validateHistorySeries, validateHistoryUpdatedEvent } from '../src/api/validation';
const raw={kind:'raw',range:'10m',from:'2026-11-18T12:00:00Z',to:'2026-11-18T12:10:00Z',period_seconds:600,source_revision:1,aggregate_revision:0,prepared_at:null,processing_status:'ready',observed_coverage_seconds:0,prepared_coverage_seconds:600,resolution_seconds:0,points:[],gaps:[]};
it('validates both series kinds and independent aggregate publication events',()=>{
 expect(validateHistorySeries(raw)).toBe(true);
 expect(validateHistorySeries({...raw,range:'5m'})).toBe(false);
 expect(validateHistorySeries({...raw,observed_coverage_seconds:'0'})).toBe(false);
 const {points: _points,gaps: _gaps,...common}=raw;
 expect(validateHistorySeries({...common,kind:'aggregate',range:'1y',resolution_seconds:86400,processing_status:'pending',observed_coverage_seconds:null,prepared_coverage_seconds:0,bins:[]})).toBe(true);
 expect(validateHistoryUpdatedEvent({schema:1,aggregate_revision:2,prepared_at:'2026-11-18T12:00:00Z'})).toBe(true);
 expect(validateHistoryUpdatedEvent({schema:1,revision:2,prepared_at:'2026-11-18T12:00:00Z'})).toBe(false);
});
