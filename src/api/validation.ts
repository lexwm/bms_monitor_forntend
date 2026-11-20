import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import schemas from './generated/schemas.json' with { type: 'json' };
import type { components } from './generated/api';
export type LatestResponse = components['schemas']['LatestResponse'];
export type Battery = components['schemas']['Battery'];
export type ErrorResponse = components['schemas']['ErrorResponse'] | components['schemas']['JbdErrorResponse'];
const ajv = new Ajv2020({ strict: true, allErrors: true, coerceTypes: false });
addFormats(ajv);
export const validateLatest = ajv.compile<LatestResponse>({ ...schemas, $ref: '#/$defs/LatestResponse' });
export const validateError = ajv.compile<ErrorResponse>({ ...schemas, anyOf: [{ $ref: '#/$defs/ErrorResponse' }, { $ref: '#/$defs/JbdErrorResponse' }] });

export type StreamState = components['schemas']['StreamState'];
export type TelemetryEvent = components['schemas']['TelemetryEvent'];
export type HistoryResponse = components['schemas']['HistoryResponse'];
const stateSchema = ajv.compile<StreamState>({ ...schemas, $ref: '#/$defs/StreamState' });
export function validateState(value: unknown): value is StreamState { return stateSchema(value) && (value.latest===null || value.latest.revision===value.revision); }
export const validateEvent = ajv.compile<TelemetryEvent>({ ...schemas, $ref: '#/$defs/TelemetryEvent' });
export const validateHistory = ajv.compile<HistoryResponse>({ ...schemas, $ref: '#/$defs/HistoryResponse' });

export type HistoryRange = components['schemas']['HistoryRange'];
export type HistorySeries = components['schemas']['HistorySeries'];
export type RawHistorySeries = components['schemas']['RawHistorySeries'];
export type AggregateHistorySeries = components['schemas']['AggregateHistorySeries'];
export type HistoryBin = components['schemas']['HistoryBin'];
export type HistoryMetricSummary = components['schemas']['HistoryMetricSummary'];
export type HistoryDetailContinuity = components['schemas']['HistoryDetailContinuity'];
export type HistoryUpdatedEvent = components['schemas']['HistoryUpdatedEvent'];
export const validateHistorySeries = ajv.compile<HistorySeries>({ ...schemas, $ref: '#/$defs/HistorySeries' });
export const validateHistoryUpdatedEvent = ajv.compile<HistoryUpdatedEvent>({ ...schemas, $ref: '#/$defs/HistoryUpdatedEvent' });

export type ConfigurationState = components['schemas']['ConfigurationState'];
export type ConfigurationRequest = components['schemas']['ConfigurationRequest'];
export type ConfigurationSnapshot = components['schemas']['ConfigurationSnapshot'];
export type ConfigurationUpdatedEvent = components['schemas']['ConfigurationUpdatedEvent'];
export type JbdField = components['schemas']['JbdField'];
export const validateConfigurationState = ajv.compile<ConfigurationState>({ ...schemas, $ref: '#/$defs/ConfigurationState' });
export const validateConfigurationRequest = ajv.compile<ConfigurationRequest>({ ...schemas, $ref: '#/$defs/ConfigurationRequest' });
export const validateConfigurationUpdatedEvent = ajv.compile<ConfigurationUpdatedEvent>({ ...schemas, $ref: '#/$defs/ConfigurationUpdatedEvent' });

export type ConfigurationSnapshotMetadata = components['schemas']['ConfigurationSnapshotMetadata'];
export type ConfigurationSnapshotPage = components['schemas']['ConfigurationSnapshotPage'];
export const validateConfigurationSnapshotPage = ajv.compile<ConfigurationSnapshotPage>({ ...schemas, $ref: '#/$defs/ConfigurationSnapshotPage' });
export const validateConfigurationSnapshot = ajv.compile<ConfigurationSnapshot>({ ...schemas, $ref: '#/$defs/ConfigurationSnapshot' });

export type HistoryPoint = components['schemas']['HistoryPoint'];
export type HistorySet = components['schemas']['HistorySet'];
export type HistoryCompactSummary = components['schemas']['HistoryCompactSummary'];
export type EnergyRange = components['schemas']['EnergyRange'];
export type EnergyDay = components['schemas']['EnergyDay'];
export type EnergyDaily = components['schemas']['EnergyDaily'];
export type BatteryEvent = components['schemas']['BatteryEvent'];
export type BatteryEventPage = components['schemas']['BatteryEventPage'];
export const validateEnergyDaily = ajv.compile<EnergyDaily>({ ...schemas, $ref: '#/$defs/EnergyDaily' });
export const validateBatteryEventPage = ajv.compile<BatteryEventPage>({ ...schemas, $ref: '#/$defs/BatteryEventPage' });
