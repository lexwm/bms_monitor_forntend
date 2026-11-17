import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import schemas from './generated/schemas.json' with { type: 'json' };
import type { components } from './generated/api';
export type LatestResponse = components['schemas']['LatestResponse'];
export type ErrorResponse = components['schemas']['ErrorResponse'];
const ajv = new Ajv2020({ strict: true, allErrors: true, coerceTypes: false });
addFormats(ajv);
export const validateLatest = ajv.compile<LatestResponse>({ ...schemas, $ref: '#/$defs/LatestResponse' });
export const validateError = ajv.compile<ErrorResponse>({ ...schemas, $ref: '#/$defs/ErrorResponse' });

export type StreamState = components['schemas']['StreamState'];
export type TelemetryEvent = components['schemas']['TelemetryEvent'];
export type HistoryResponse = components['schemas']['HistoryResponse'];
const stateSchema = ajv.compile<StreamState>({ ...schemas, $ref: '#/$defs/StreamState' });
export function validateState(value: unknown): value is StreamState { return stateSchema(value) && (value.latest===null || value.latest.revision===value.revision); }
export const validateEvent = ajv.compile<TelemetryEvent>({ ...schemas, $ref: '#/$defs/TelemetryEvent' });
export const validateHistory = ajv.compile<HistoryResponse>({ ...schemas, $ref: '#/$defs/HistoryResponse' });
