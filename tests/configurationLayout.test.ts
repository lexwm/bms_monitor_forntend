import { expect, it } from 'vitest';
import type { JbdField } from '../src/api/validation';
import { configurationTabs } from '../src/configurationLayout';

const field = (code: string): JbdField => ({ code, label_uk: code, raw_hex: '0000', value: 1, candidate_value: null, unit: null, status: 'verified', source: 'FA', address: null });

it('groups known settings into tabs and keeps every other field on the service tab', () => {
 const fields = ['parameter_20', 'parameter_51', 'model', 'future_code', 'model'].map(field);
 const tabs = configurationTabs(fields);
 expect(tabs.map(tab => tab.id)).toEqual(['general', 'protection', 'service']);
 const voltage = tabs[1]?.sections[0];
 expect(voltage).toMatchObject({ kind: 'matrix', title: 'Напруга', rows: [{ label: 'Комірка: висока', cells: [fields[0], 'missing', fields[1]] }] });
 // The unknown code and the repeated code are not dropped.
 expect(tabs[2]?.sections[0]).toMatchObject({ kind: 'service', fields: [fields[3], fields[4]] });
});

it('returns no tabs for an empty snapshot', () => {
 expect(configurationTabs([])).toEqual([]);
});
