import { expect, it } from 'vitest';
import type { JbdField } from '../src/api/validation';
import { diffSnapshots, snapshotWear } from '../src/configurationDiff';

const field = (code: string, value: JbdField['value'], status: JbdField['status'] = 'verified', candidate: JbdField['value'] = null): JbdField => ({ code, label_uk: code, raw_hex: '00', value, candidate_value: candidate, unit: null, status, source: 'FA', address: null });

it('reports changed values, compares candidates by their candidate value and counts equal ones', () => {
 const diff = diffSnapshots(
  [field('a', 2), field('b', 5), field('c', null, 'candidate', 7), field('d', 'x')],
  [field('a', 1), field('b', 5), field('c', null, 'candidate', 8), field('d', 'x')]);
 expect(diff.changes.map(change => [change.code, change.before, change.after, change.candidate])).toEqual([['a', 1, 2, false], ['c', 8, 7, true]]);
 expect(diff.same).toBe(2); expect(diff.noData).toEqual([]);
});

it('lists a field absent or not decoded on one side as no data, not as a change; a partial snapshot has nothing to compare', () => {
 const diff = diffSnapshots(
  [field('a', 2), field('b', null, 'raw'), field('c', 1), field('e', null, 'invalid')],
  [field('a', 2), field('b', 4), field('d', 3), field('e', null, 'raw')]);
 expect(diff.changes).toEqual([]); expect(diff.same).toBe(1);
 expect(diff.noData.map(item => item.code)).toEqual(['b', 'c', 'd']);
 const partial = diffSnapshots([field('a', null, 'raw')], [field('a', 1), field('b', 2)]);
 expect(partial).toMatchObject({ changes: [], same: 0, noData: [{ code: 'a' }, { code: 'b' }] });
});

it('computes wear only when every value exists and never treats missing as zero', () => {
 expect(snapshotWear([field('parameter_112', 190), field('parameter_7', 12), field('parameter_0', 200)])).toMatchObject({ learned: { value: 190 }, cycles: { value: 12 }, share: 95 });
 expect(snapshotWear([field('parameter_112', 190), field('parameter_0', null, 'raw')])).toMatchObject({ cycles: null, nominal: null, share: null });
 expect(snapshotWear([field('parameter_112', 0), field('parameter_0', 0)]).share).toBeNull();
 expect(snapshotWear([]).learned).toBeNull();
});
