import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
const schema = JSON.parse(await readFile(new URL('../src/api/generated/schemas.json', import.meta.url), 'utf8'));
const ajv = new Ajv2020({ strict: true, allErrors: true }); addFormats(ajv);
const latest = ajv.compile({ ...schema, $ref: '#/$defs/LatestResponse' });
const error = ajv.compile({ ...schema, $ref: '#/$defs/ErrorResponse' });
const expected = process.argv[2] || 'fresh';
const response = await fetch('http://backend:8000/api/v1/battery/latest');
const data = await response.json();
assert.equal(response.headers.get('cache-control'), 'no-store, private');
const statuses = { empty:404, future:503, 'bad-source':503, 'db-down':503 };
assert.equal(response.status, statuses[expected] || 200);
assert.ok(response.ok ? latest(data) : error(data), JSON.stringify(ajv.errors));
if (response.ok) {
 assert.equal(data.state, expected);
 assert.equal(data.time_quality, 'reception_only');
 if(expected==='invalid') { assert.equal(data.battery,null); assert.ok(data.last_valid); }
 if(expected==='fresh') {
  assert.equal(data.mode,'discharge'); assert.equal(data.battery.power_w,-330);
  const typed = structuredClone(data); typed.battery.soc_percent='58'; assert.equal(latest(typed),false);
  const missing = structuredClone(data); delete missing.received_at; assert.equal(latest(missing),false);
  const unknown = structuredClone(data); unknown.mode='nonsense'; assert.equal(latest(unknown),false);
  const nullValue = structuredClone(data); nullValue.age_seconds=null; assert.equal(latest(nullValue),false);
  const extra = structuredClone(data); extra.future_optional_field='accepted'; assert.equal(latest(extra),true);
 }
} else {
 assert.equal(data.error.code, {empty:'no_measurements_yet',future:'invalid_source_data','bad-source':'invalid_source_data','db-down':'database_unavailable'}[expected]);
}
for (const [path, method, status] of [['?unknown=1','GET',422],['','POST',405]]) {
 const result = await fetch('http://backend:8000/api/v1/battery/latest'+path,{method});
 assert.equal(result.status,status); assert.ok(error(await result.json()));
}
console.log(`HTTP → generated schema: ${expected} passed`);
