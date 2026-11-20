import type { BatteryEvent } from './api/validation';

// The server sends the signal name; the action is worded here from the event kind.
export function eventText(event: BatteryEvent): string {
 switch (event.kind) {
  case 'protection_set': return `Сигнал з’явився: ${event.label}`;
  case 'protection_cleared': return `Сигнал зник: ${event.label}`;
  case 'charge_mos_off': return 'Зарядний ключ вимкнено';
  case 'charge_mos_on': return 'Зарядний ключ увімкнено';
  case 'discharge_mos_off': return 'Розрядний ключ вимкнено';
  case 'discharge_mos_on': return 'Розрядний ключ увімкнено';
 }
}

// SourceTime values share one fixed-width UTC format, so string order is time order.
export const bellLit = (latest: string | null | undefined, seen: string | null) => latest != null && (seen === null || latest > seen);

const markKey = 'bms-monitor.events-seen';
let memoryMark: string | null = null;
export function readSeenMark(): string | null {
 try { return localStorage.getItem(markKey) ?? memoryMark; } catch { return memoryMark; }
}
// An empty server value never erases what this browser has already seen.
export function storeSeenMark(value: string | null): string | null {
 if (value === null) return readSeenMark();
 memoryMark = value;
 try { localStorage.setItem(markKey, value); } catch { /* the tab keeps the mark in memory */ }
 return value;
}
