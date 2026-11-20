import { afterEach, expect, it, vi } from 'vitest';
import { bellLit, eventText, readSeenMark, storeSeenMark } from '../src/events';
import type { BatteryEvent } from '../src/api/validation';
const event = (kind: BatteryEvent['kind'], bit: number | null = null): BatteryEvent => ({ occurred_at: '2026-11-20T10:00:00.000000Z', boot_id: 'ffffffffffff0001', sequence: 1, kind, bit, label: bit === null ? 'Зарядний ключ' : 'Захист: висока напруга комірки', severity: 'info', after_gap: false });
afterEach(() => vi.unstubAllGlobals());

it('words every event kind in Ukrainian from its kind, keeping the server signal name', () => {
 expect(eventText(event('protection_set', 0))).toBe('Сигнал з’явився: Захист: висока напруга комірки');
 expect(eventText(event('protection_cleared', 0))).toBe('Сигнал зник: Захист: висока напруга комірки');
 expect([eventText(event('charge_mos_off')), eventText(event('charge_mos_on')), eventText(event('discharge_mos_off')), eventText(event('discharge_mos_on'))]).toEqual(['Зарядний ключ вимкнено', 'Зарядний ключ увімкнено', 'Розрядний ключ вимкнено', 'Розрядний ключ увімкнено']);
});
it('lights the bell only for a newer important episode than the seen mark', () => {
 expect(bellLit(null, null)).toBe(false);
 expect(bellLit(undefined, null)).toBe(false);
 expect(bellLit('2026-11-20T10:00:00.000000Z', null)).toBe(true);
 expect(bellLit('2026-11-20T10:00:00.000000Z', '2026-11-20T10:00:00.000000Z')).toBe(false);
 expect(bellLit('2026-11-20T09:59:59.999999Z', '2026-11-20T10:00:00.000000Z')).toBe(false);
 expect(bellLit('2026-11-20T10:30:00.000000Z', '2026-11-20T10:00:00.000000Z')).toBe(true);
});
it('stores the mark, never erases it with null, and keeps it in memory without storage', () => {
 const store = new Map<string, string>();
 vi.stubGlobal('localStorage', { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => { store.set(key, value); } });
 expect(storeSeenMark('2026-11-20T10:00:00.000000Z')).toBe('2026-11-20T10:00:00.000000Z');
 expect(storeSeenMark(null)).toBe('2026-11-20T10:00:00.000000Z');
 expect(readSeenMark()).toBe('2026-11-20T10:00:00.000000Z');
 vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } });
 expect(storeSeenMark('2026-11-21T10:00:00.000000Z')).toBe('2026-11-21T10:00:00.000000Z');
 expect(readSeenMark()).toBe('2026-11-21T10:00:00.000000Z');
});
