import { describe, it, expect } from 'vitest';
import { validateError, validateLatest } from '../src/api/validation';
describe('contract boundary', () => {
 it('does not coerce unknown input', () => {
  expect(validateLatest(null)).toBe(false);
  expect(validateLatest({ state: 'fresh', battery: {} })).toBe(false);
  expect(validateError({ error: { code: 404, message: 'Missing' } })).toBe(false);
 });
 it('accepts additive response fields but not unknown codes', () => {
  expect(validateError({ error: { code: 'no_measurements_yet', message: 'Missing', extra: true }, future: 1 })).toBe(true);
  expect(validateError({ error: { code: 'new_undocumented_code', message: 'Missing' } })).toBe(false);
 });
});
