import type { StreamState, TelemetryEvent } from './validation';
// Pure revision policy shared by the live hook and race tests.
export function newer(current: StreamState | null, incoming: StreamState | TelemetryEvent): boolean {
 return current === null || incoming.revision > current.revision;
}
export function ageAt(receivedAt: string, serverNow: number): number {
 return Math.max(0, (serverNow - Date.parse(receivedAt)) / 1000);
}
