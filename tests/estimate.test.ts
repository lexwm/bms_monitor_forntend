import { expect, it } from 'vitest';
import { estimateTime } from '../src/estimate';

it('projects discharge from the remaining capacity and charge from the missing capacity', () => {
 expect(estimateTime(-12.5, 116, 200)).toEqual({ target: 'empty', minutes: 557 });
 expect(estimateTime(20, 116, 200)).toEqual({ target: 'full', minutes: 252 });
 expect(estimateTime(20, 200, 200)).toEqual({ target: 'full', minutes: 0 });
 // Discharge does not need the declared capacity.
 expect(estimateTime(-10, 50, null)).toEqual({ target: 'empty', minutes: 300 });
});

it('gives no estimate without a direction or without the needed counters', () => {
 expect(estimateTime(0, 116, 200)).toBeNull();
 expect(estimateTime(null, 116, 200)).toBeNull();
 expect(estimateTime(-5, null, 200)).toBeNull();
 expect(estimateTime(5, 116, null)).toBeNull();
 expect(estimateTime(5, 210, 200)).toBeNull();
 expect(estimateTime(-5, -1, 200)).toBeNull();
 expect(estimateTime(Number.NaN, 116, 200)).toBeNull();
});
