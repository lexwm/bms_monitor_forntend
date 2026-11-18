import { afterEach, describe, expect, it, vi } from 'vitest';
import { HistoryRefresh } from '../src/historyRefresh';
afterEach(()=>vi.useRealTimers());
describe('history refresh signals',()=>{
 it('coalesces live signals to 15 seconds and has no periodic polling',()=>{
  vi.useFakeTimers(); const request=vi.fn(); const refresh=new HistoryRefresh(request);
  refresh.immediate(); refresh.complete();
  for(let i=0;i<10;i++)refresh.signal();
  vi.advanceTimersByTime(14999);expect(request).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(1);expect(request).toHaveBeenCalledTimes(2);
  refresh.complete();vi.advanceTimersByTime(120000);expect(request).toHaveBeenCalledTimes(2);
  refresh.dispose();
 });
 it('uses 60 seconds for aggregate history and keeps one trailing signal during a request',()=>{
  vi.useFakeTimers();const request=vi.fn();const refresh=new HistoryRefresh(request);
  refresh.immediate('1y');refresh.signal();refresh.signal();vi.advanceTimersByTime(10000);refresh.complete();
  vi.advanceTimersByTime(49999);expect(request).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(1);expect(request).toHaveBeenCalledTimes(2);refresh.dispose();
 });
 it('an immediate selection cancels the old background timer and resets its limit',()=>{
  vi.useFakeTimers();const request=vi.fn();const refresh=new HistoryRefresh(request);
  refresh.immediate();refresh.complete();refresh.signal();vi.advanceTimersByTime(5000);
  refresh.immediate('30d');refresh.complete();vi.advanceTimersByTime(60000);expect(request).toHaveBeenCalledTimes(2);
  refresh.signal();expect(request).toHaveBeenCalledTimes(3);refresh.dispose();
 });
 it('pauses signals while hidden; the visible recovery fetches the selected period once',()=>{
  vi.useFakeTimers();const request=vi.fn();const refresh=new HistoryRefresh(request);
  refresh.immediate('3mo');refresh.complete();refresh.signal();refresh.visibility(true);
  vi.advanceTimersByTime(120000);refresh.signal();expect(request).toHaveBeenCalledTimes(1);
  refresh.visibility(false);refresh.immediate();refresh.complete();vi.advanceTimersByTime(120000);expect(request).toHaveBeenCalledTimes(2);refresh.dispose();
 });
});
