import { expect, it } from 'vitest';
import { format, historySeconds } from '../src/format';
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

it('limits physical values and tooltips to three fractional digits', () => {
 expect(format(3.31234, 'full')).toBe('3,312');
 expect(format(12.3455)).toBe('12,346');
 expect(format(-12.3455)).toBe('-12,346');
 expect(format(-0)).toBe('0');
 expect(format(0)).toBe('0');
 expect(format(1.23456789e-19)).toBe('1,235Е-19');
 expect(format(-1.23456789e-19)).toBe('-1,235Е-19');
 expect(format(Number.MIN_VALUE)).not.toBe('0');
 expect(format(1.234567, 8)).toBe('1,235');
});

it('pads cell voltages without inventing missing values or rounding tiny values to zero', () => {
 expect(format(3.3, 3, 3)).toBe('3,300');
 expect(format(3.301, 3, 3)).toBe('3,301');
 expect(format(0, 3, 3)).toBe('0,000');
 expect(format(null, 3, 3)).toBe('—');
 expect(format(0.0001, 3, 3)).toBe('1Е-4');
});

it('formats long history durations as exact grouped Ukrainian seconds',()=>{
 for(const seconds of [2592000,31536000,12345678,0]) {
  const text=historySeconds(seconds);
  expect(text).not.toMatch(/[еe]/i);
  expect(Number(text.replaceAll(/\s/g,''))).toBe(seconds);
 }
 expect(historySeconds(31536000)).toMatch(/^31\s536\s000$/);
 expect(historySeconds(null)).toBe('—');
});
