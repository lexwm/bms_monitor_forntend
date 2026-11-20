import type { JbdField } from './api/validation';
import { format } from './format';

// Presentation-only grouping of decoded settings by their contract code.
// Every field that is not placed here stays visible on the service tab.
export type Section =
 | { kind: 'list'; title: string; fields: JbdField[] }
 | { kind: 'flags'; title: string; fields: JbdField[] }
 | { kind: 'matrix'; title: string; rows: { label: string; cells: (JbdField | 'missing' | null)[] }[] }
 | { kind: 'service'; title: string; fields: JbdField[] };
export type Tab = { id: string; label: string; sections: Section[] };
export const matrixColumns = ['Поріг', 'Відновлення', 'Затримка'];

const p = (...numbers: number[]) => numbers.map(number => `parameter_${number}`);
type MatrixRow = [label: string, trigger: string | null, release: string | null, delay: string | null];
type Plan = { id: string; label: string; sections: ({ kind: 'list' | 'flags'; title: string; codes: string[] } | { kind: 'matrix'; title: string; rows: MatrixRow[] })[] };
const row = (label: string, trigger: number, release: number, delay: number): MatrixRow => [label, `parameter_${trigger}`, `parameter_${release}`, `parameter_${delay}`];

const plans: Plan[] = [
 { id: 'general', label: 'Загальне', sections: [
  { kind: 'list', title: 'Батарея', codes: ['battery_model', 'manufacturer', 'barcode', ...p(6), 'reported_capacity_ah', 'cell_count', ...p(7)] },
  { kind: 'list', title: 'Плата керування (BMS)', codes: ['model', 'bms_code', 'unique_id', 'software_version_hint', 'production_date', 'chip_type', 'temperature_count', ...p(28, 4)] },
 ] },
 { id: 'capacity', label: 'Ємність і заряд', sections: [
  { kind: 'list', title: 'Ємність', codes: p(0, 1, 112, 113, 2, 3) },
  { kind: 'list', title: 'Номінальні значення', codes: p(114, 117, 115, 119, 118, 116, 120) },
  { kind: 'list', title: 'Напруга комірки за рівнем заряду', codes: p(111, 106, 34, 107, 35, 108, 36, 109, 37, 110) },
 ] },
 { id: 'protection', label: 'Захист', sections: [
  { kind: 'matrix', title: 'Напруга', rows: [row('Комірка: висока', 20, 21, 51), row('Комірка: низька', 22, 23, 50), row('Батарея: висока', 16, 17, 49), row('Батарея: низька', 18, 19, 48)] },
  { kind: 'matrix', title: 'Температура', rows: [row('Заряд: висока', 8, 9, 45), row('Заряд: низька', 10, 11, 44), row('Розряд: висока', 12, 13, 47), row('Розряд: низька', 14, 15, 46)] },
  { kind: 'matrix', title: 'Струм', rows: [row('Заряд', 24, 53, 52), row('Розряд', 25, 55, 54)] },
  { kind: 'matrix', title: 'Апаратний захист', rows: [
   ['Комірка: висока напруга', 'parameter_38', null, null], ['Комірка: низька напруга', 'parameter_39', null, null],
   ['Струм: другий ступінь', 'parameter_40_threshold', null, 'parameter_40_delay'], ['Коротке замикання', 'parameter_41_threshold', 'parameter_43', 'parameter_41_delay'],
  ] },
 ] },
 { id: 'functions', label: 'Балансування і функції', sections: [
  { kind: 'list', title: 'Балансування', codes: ['function_bit_2', 'function_bit_3', ...p(26, 27)] },
  { kind: 'list', title: 'Функції', codes: [0, 1, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(bit => `function_bit_${bit}`) },
  { kind: 'flags', title: 'Датчики температури', codes: Array.from({ length: 16 }, (_, index) => `ntc_enabled_${index + 1}`) },
  { kind: 'list', title: 'Живлення та режими', codes: p(121, 122, 32, 33, 104, 105) },
 ] },
];

export function configurationTabs(fields: JbdField[]): Tab[] {
 // The first occurrence wins; a repeated code is never dropped, it goes to the service tab.
 const byCode = new Map<string, JbdField>();
 for (const field of fields) if (!byCode.has(field.code)) byCode.set(field.code, field);
 const placed = new Set<JbdField>();
 const take = (code: string | null): JbdField | null => {
  const field = code === null ? undefined : byCode.get(code);
  if (!field) return null;
  placed.add(field);
  return field;
 };
 const tabs: Tab[] = [];
 for (const plan of plans) {
  const sections: Section[] = [];
  for (const section of plan.sections) {
   if (section.kind === 'matrix') {
    // null: the cell does not exist for this protection; 'missing': the snapshot did not deliver it.
    const rows = section.rows.map(([label, ...codes]) => ({ label, cells: codes.map(code => code === null ? null : take(code) ?? 'missing' as const) })).filter(item => item.cells.some(cell => cell !== null && cell !== 'missing'));
    if (rows.length) sections.push({ kind: 'matrix', title: section.title, rows });
   } else {
    const found = section.codes.map(take).filter(field => field !== null);
    if (found.length) sections.push({ kind: section.kind, title: section.title, fields: found });
   }
  }
  if (sections.length) tabs.push({ id: plan.id, label: plan.label, sections });
 }
 const rest = fields.filter(field => !placed.has(field));
 if (rest.length) tabs.push({ id: 'service', label: 'Службові', sections: [{ kind: 'service', title: 'Службові та нерозпізнані значення', fields: rest }] });
 return tabs;
}

const units: Record<string, string> = { V: 'В', mV: 'мВ', A: 'А', mA: 'мА', Ah: 'А·год', W: 'Вт', s: 'с', ms: 'мс', 'µs': 'мкс', min: 'хв', h: 'год', days: 'днів', count: 'шт.', 'mΩ': 'мОм' };

export function valueText(value: JbdField['value'], unit: string | null): string {
 if (value === null) return 'Невідомо';
 const integer = typeof value === 'number' && Number.isInteger(value) && (unit === null || ['count', 's', 'ms', 'min', 'h', 'days'].includes(unit));
 const text = typeof value === 'number' ? integer ? value.toLocaleString('uk-UA', { maximumFractionDigits: 0, useGrouping: false }) : format(value) : typeof value === 'boolean' ? value ? 'Так' : 'Ні' : value;
 return `${text}${unit ? ` ${units[unit] ?? unit}` : ''}`;
}
