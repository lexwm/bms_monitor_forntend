import { afterEach, expect, it, vi } from 'vitest';
import { ApiFailure, configurationRequestId, requestConfiguration } from '../src/api/client';
import { validateConfigurationState } from '../src/api/validation';

const requestId = '11111111-1111-4111-8111-111111111111';
const job = { request_id: requestId, request_order: 1, state: 'pending', created_at: '2026-11-18T12:00:00Z', deadline_at: '2026-11-18T12:02:00Z', claimed_at: null, profile_id: 'configuration-v1' };
afterEach(() => vi.unstubAllGlobals());

it('creates UUID v4 using insecure-origin-compatible randomness without randomUUID', () => {
 const getRandomValues = vi.fn((bytes: Uint8Array) => bytes.fill(255));
 vi.stubGlobal('crypto', { getRandomValues });
 expect(configurationRequestId()).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
 expect(getRandomValues).toHaveBeenCalledOnce();
});

it('validates configuration state including missing snapshots without inventing values', () => {
 const state = { revision: 0, server_time: job.created_at, request: null, latest: null, previous_complete: null };
 expect(validateConfigurationState(state)).toBe(true);
 expect(validateConfigurationState({ ...state, request: { ...job, state: 'unknown' } })).toBe(false);
 expect(validateConfigurationState({ ...state, revision: '0' })).toBe(false);
 expect(validateConfigurationState({ ...state, latest: { data_status: 'complete' } })).toBe(false);
});

it('creates JSON requests and accepts a validated idempotent reply for the same UUID', async () => {
 const fetch = vi.fn().mockResolvedValue(Response.json(job, { status: 201 })); vi.stubGlobal('fetch', fetch);
 expect(await requestConfiguration(requestId, new AbortController().signal)).toEqual(job);
 expect(fetch).toHaveBeenCalledWith('/api/v1/battery/configuration/requests', expect.objectContaining({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ request_id: requestId }) }));
 fetch.mockResolvedValue(Response.json(job));
 expect(await requestConfiguration(requestId, new AbortController().signal)).toEqual(job);
});

it('rejects malformed or foreign successful replies and preserves active-request conflict', async () => {
 const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
 for (const response of [Response.json({ ...job, request_id: '22222222-2222-4222-8222-222222222222' }), Response.json({ state: 'pending' }), new Response('not JSON')]) {
  fetch.mockResolvedValue(response);
  await expect(requestConfiguration(requestId, new AbortController().signal)).rejects.toMatchObject({ code: 'incompatible_response' });
 }
 fetch.mockResolvedValue(Response.json({ error: { code: 'active_request', message: 'Існує активний запит', active_request: requestId } }, { status: 409 }));
 await expect(requestConfiguration(requestId, new AbortController().signal)).rejects.toEqual(new ApiFailure('active_request'));
});
