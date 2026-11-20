import type { JbdField } from './api/validation';

// Comparison of two decoded settings snapshots. Only verified and candidate values are compared;
// a field that is absent or not decoded on either side is reported separately and is never a change.
export type Value = Exclude<JbdField['value'], null>;
export type Change = { code: string; label: string; unit: string | null; before: Value; after: Value; candidate: boolean };
export type NoData = { code: string; label: string };
export type Diff = { changes: Change[]; noData: NoData[]; same: number };
export type Reading = { value: number; unit: string | null; candidate: boolean };
export type Wear = { learned: Reading | null; cycles: Reading | null; nominal: Reading | null; share: number | null };

function effective(field: JbdField | undefined): Value | undefined {
 const value = field?.status === 'verified' ? field.value : field?.status === 'candidate' ? field.candidate_value : null;
 return value ?? undefined;
}
// The first occurrence of a repeated code wins, as on the settings tabs.
function byCode(fields: JbdField[]): Map<string, JbdField> {
 const map = new Map<string, JbdField>();
 for (const field of fields) if (!map.has(field.code)) map.set(field.code, field);
 return map;
}

export function diffSnapshots(newer: JbdField[], older: JbdField[]): Diff {
 const after = byCode(newer); const before = byCode(older);
 const result: Diff = { changes: [], noData: [], same: 0 };
 for (const code of new Set([...after.keys(), ...before.keys()])) {
  const a = after.get(code); const b = before.get(code); const field = a ?? b;
  const x = effective(a); const y = effective(b);
  if (!field || (x === undefined && y === undefined)) continue;
  if (x === undefined || y === undefined) result.noData.push({ code, label: field.label_uk });
  else if (x === y) result.same++;
  else result.changes.push({ code, label: field.label_uk, unit: a?.unit ?? b?.unit ?? null, before: y, after: x, candidate: a?.status === 'candidate' || b?.status === 'candidate' });
 }
 return result;
}

function reading(field: JbdField | undefined): Reading | null {
 const value = effective(field);
 return field && typeof value === 'number' && Number.isFinite(value) ? { value, unit: field.unit, candidate: field.status === 'candidate' } : null;
}

// Learned capacity (112), cycles (7) and its share of the nominal capacity (0) of the same snapshot.
export function snapshotWear(fields: JbdField[]): Wear {
 const map = byCode(fields);
 const learned = reading(map.get('parameter_112')); const nominal = reading(map.get('parameter_0'));
 return { learned, cycles: reading(map.get('parameter_7')), nominal, share: learned && nominal && nominal.value > 0 ? learned.value / nominal.value * 100 : null };
}
