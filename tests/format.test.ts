import { expect, it } from 'vitest';
import { format } from '../src/format';
it('preserves current precision, zero and missing readings', () => {
 expect(format(0.04, 2)).toBe('0,04');
 expect(format(-0.04, 2)).toBe('-0,04');
 expect(format(9.99, 2)).toBe('9,99');
 expect(format(0, 2)).toBe('0');
 expect(format(null, 2)).toBe('—');
 expect(format(0.0001, 2)).not.toBe('0');
});
it('bounds extreme finite numbers without discarding sign or magnitude', () => {
 for (const value of [1e12, -1e12, Number.MAX_VALUE, -Number.MAX_VALUE, Number.MIN_VALUE]) {
  const text = format(value, 2);
  expect(text.length).toBeLessThanOrEqual(10);
  expect(text).toContain('Е');
  expect(text.startsWith('-')).toBe(value < 0);
 }
});

it('keeps full numeric precision in localized tooltips', () => {
 for (const value of [1.23456789e-19, -1.23456789e-19, Number.MIN_VALUE, Number.MAX_VALUE, 0, -12.3456789012345, 3.31234]) {
  const text = format(value, 'full');
  expect(Number(text.replace(',', '.').replace('Е', 'e'))).toBe(value);
 }
 expect(format(3.31234, 'full')).toBe('3,31234');
});

it('pads cell voltages without inventing missing values or rounding tiny values to zero', () => {
 expect(format(3.3, 3, 3)).toBe('3,300');
 expect(format(3.301, 3, 3)).toBe('3,301');
 expect(format(0, 3, 3)).toBe('0,000');
 expect(format(null, 3, 3)).toBe('—');
 expect(format(0.0001, 3, 3)).toBe('1Е-4');
});
