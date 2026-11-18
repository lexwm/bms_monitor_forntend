import { validateConfigurationRequest, validateError, type ConfigurationRequest } from './validation';
export class ApiFailure extends Error {
 constructor(public readonly code: string) { super(code); }
}
export function configurationRequestId(): string {
 // getRandomValues is also available on the installation's plain HTTP LAN origin.
 const bytes = crypto.getRandomValues(new Uint8Array(16));
 bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
 bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
 const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
 return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export async function requestConfiguration(requestId: string, signal: AbortSignal): Promise<ConfigurationRequest> {
 const response = await fetch('/api/v1/battery/configuration/requests', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ request_id: requestId }),
  signal: AbortSignal.any([signal, AbortSignal.timeout(4000)]), cache: 'no-store',
 });
 if (!response.headers.get('content-type')?.includes('application/json')) throw new ApiFailure('incompatible_response');
 const data: unknown = await response.json();
 if ((response.status === 200 || response.status === 201) && validateConfigurationRequest(data) && data.request_id === requestId) return data;
 if (response.status !== 200 && response.status !== 201 && validateError(data)) throw new ApiFailure(data.error.code);
 throw new ApiFailure('incompatible_response');
}
export async function fetchValidated<T>(path: string, validate: (value: unknown) => value is T, signal: AbortSignal): Promise<T> {
 const response = await fetch(path, { signal: AbortSignal.any([signal, AbortSignal.timeout(4000)]), cache: 'no-store' });
 if (!response.headers.get('content-type')?.includes('application/json')) throw new ApiFailure('incompatible_response');
 const data: unknown = await response.json();
 if (response.status === 200 && validate(data)) return data;
 if (response.status !== 200 && validateError(data)) throw new ApiFailure(data.error.code);
 throw new ApiFailure('incompatible_response');
}
