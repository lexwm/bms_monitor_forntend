import type { HistoryRange } from './api/validation';

// Signals share one trailing request; the timer exists only while a signal is dirty.
export class HistoryRefresh {
 private timer: ReturnType<typeof setTimeout> | undefined;
 private lastStarted = -Infinity;
 private dirty = false;
 private inFlight = false;
 private hidden = false;
 private stopped = false;
 private range: HistoryRange = '10m';
 constructor(private readonly request: () => void) {}
 signal() { this.dirty = true; this.schedule(); }
 immediate(range: HistoryRange = this.range) {
  this.range = range; clearTimeout(this.timer); this.timer = undefined;
  this.dirty = true;
  if (!this.hidden && !this.stopped) this.start();
 }
 visibility(hidden: boolean) {
  this.hidden = hidden;
  if (hidden) { clearTimeout(this.timer); this.timer = undefined; }
 }
 complete() { this.inFlight = false; this.schedule(); }
 dispose() { this.stopped = true; clearTimeout(this.timer); }
 private start() {
  this.dirty = false; this.inFlight = true; this.lastStarted = performance.now(); this.request();
 }
 private schedule() {
  if (!this.dirty || this.inFlight || this.hidden || this.stopped || this.timer !== undefined) return;
  const delay = Math.max(0, this.lastStarted + (this.range === '10m' || this.range === '1h' ? 15000 : 60000) - performance.now());
  if (delay === 0) this.start();
  else this.timer = setTimeout(() => { this.timer = undefined; this.schedule(); }, delay);
 }
}
