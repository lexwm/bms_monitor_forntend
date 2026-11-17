import { validateError } from './validation';
export class ApiFailure extends Error {
 constructor(public readonly code: string) { super(code); }
}
export async function fetchValidated<T>(path: string, validate: (value: unknown) => value is T, signal: AbortSignal): Promise<T> {
 const response = await fetch(path, { signal: AbortSignal.any([signal, AbortSignal.timeout(4000)]), cache: 'no-store' });
 if (!response.headers.get('content-type')?.includes('application/json')) throw new ApiFailure('incompatible_response');
 const data: unknown = await response.json();
 if (response.status === 200 && validate(data)) return data;
 if (response.status !== 200 && validateError(data)) throw new ApiFailure(data.error.code);
 throw new ApiFailure('incompatible_response');
}
