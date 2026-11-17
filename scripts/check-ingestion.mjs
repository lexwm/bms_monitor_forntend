import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
const definitions=JSON.parse(await readFile(new URL('../src/api/generated/schemas.json',import.meta.url),'utf8'));
const ajv=new Ajv2020({strict:true,allErrors:true});addFormats(ajv);
const validate=name=>ajv.compile({...definitions,$ref:'#/$defs/'+name});
const receipt=validate('Receipt'),event=validate('TelemetryEvent'),state=validate('StreamState'),history=validate('HistoryResponse'),error=validate('ErrorResponse'),input=validate('IngestRecord');
const base='http://backend:8000'; const boot=process.env.BMS_TEST_BOOT;
assert.match(boot??'',/^eeee[0-9a-f]{12}$/);
async function post(body,status=201,contentType='application/json') {
 const r=await fetch(base+'/api/v1/telemetry/records',{method:'POST',headers:{'Content-Type':contentType},body:typeof body==='string'?body:JSON.stringify(body)});
 const data=await r.json();assert.equal(r.status,status,JSON.stringify(data));assert.ok(status<300?receipt(data):error(data),JSON.stringify(data));return data;
}
const current=await(await fetch(base+'/api/v1/telemetry/state')).json();assert.ok(state(current));
const battery=current.latest?.battery??current.latest?.last_valid?.battery; assert.ok(battery);
const at=new Date(Date.now()-1).toISOString();
const packet={schema:1,device_id:'sacred-sun-monitor-01',boot_id:boot,sequence:1,uptime_ms:5000,received_at:at,kind:'measurement',valid:true,record:{battery,ble_connected:true,extension:{unknown:[1,'keep',null]}}};
assert.ok(input(packet));
const offline=process.argv.includes('--offline');
let stream;const controller=new AbortController();
if(!offline){stream=await fetch('http://mercure/.well-known/mercure?topic='+encodeURIComponent('urn:bms:battery:sacred-sun-monitor-01'),{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(10000)])});assert.equal(stream.status,200);}
try {
 const stored=await post(packet);
 const duplicate=await post({...packet,received_at:at.replace('Z','+00:00')},200);assert.equal(duplicate.revision,stored.revision);assert.equal(duplicate.status,'duplicate');
 await post({...packet,uptime_ms:6000},409);
 if(stream){
  let buffer='';let received=false;
  for await (const chunk of stream.body){buffer+=new TextDecoder().decode(chunk);let end;
   while((end=buffer.indexOf('\n\n'))>=0){const frame=buffer.slice(0,end);buffer=buffer.slice(end+2);const data=frame.split('\n').find(l=>l.startsWith('data: '));if(!data)continue;const value=JSON.parse(data.slice(6));assert.ok(event(value),JSON.stringify(event.errors));if(value.revision>=stored.revision){assert.equal(value.latest.boot_id,boot);received=true;break;}}
   if(received)break;
  }
  assert.ok(received,'real Mercure delivery');
 }
 const before=await(await fetch(base+'/api/v1/telemetry/state')).json();
 await post({...packet,sequence:2,received_at:new Date(Date.now()-3600000).toISOString()});
 const late=await(await fetch(base+'/api/v1/telemetry/state')).json();assert.ok(state(late));assert.equal(late.latest.sequence,before.latest.sequence);assert.equal(late.latest.boot_id,before.latest.boot_id);assert.equal(late.revision,before.revision+1);
 for(const bad of [{...packet,schema:2},{...packet,valid:null},{...packet,sequence:-1},{...packet,extra:true},{...packet,received_at:'2026-01-01T00:00:00.1234567Z'},{...packet,received_at:'2999-01-01T00:00:00Z'},{...packet,record:{battery:{...battery,cycles:2147483648}}},{...packet,record:{battery:{...battery,soc_percent:'58'}}}])await post(bad,422);
 await post('{',400);await post(' '.repeat(65537),413);await post(packet,415,'text/plain');
 const maximum={...packet,sequence:3,record:{battery:{...battery,cycles:2147483647,protection_flags:2147483647}}};await post(maximum);await post(maximum,200);
 const end=new Date(Date.now()+1000),start=new Date(end.getTime()-600000);
 const response=await fetch(base+'/api/v1/battery/history?'+new URLSearchParams({from:start.toISOString(),to:end.toISOString()}));const data=await response.json();assert.equal(response.status,200,JSON.stringify(data));assert.ok(history(data),JSON.stringify(history.errors));assert.ok(data.gaps.length>0);assert.ok(data.observed_coverage_seconds<data.period_seconds);
 const nullable={...packet,sequence:4,received_at:new Date(Date.now()-1).toISOString(),record:{battery:Object.fromEntries(Object.keys(battery).map(key=>[key,null]))}};
 await post(nullable);
 const nullableState=await(await fetch(base+'/api/v1/telemetry/state')).json();assert.ok(state(nullableState),JSON.stringify(nullableState));assert.equal(nullableState.latest.battery.cells_v,null);assert.equal(nullableState.latest.battery.temperatures_c,null);
 const exact={...packet,kind:'event',valid:null,sequence:10,record:{counter:'RAW_NUMBER'}};
 const original=JSON.stringify(exact).replace('"RAW_NUMBER"','9223372036854775808');
 const savedExact=await post(original);const sameExact=await post(original,200);assert.equal(sameExact.revision,savedExact.revision);
 await post(original.replace('9223372036854775808','9223372036854775809'),409);
 const integerTemplate=JSON.stringify({...packet,sequence:11,record:{battery:{...battery,cycles:'INTEGER',protection_flags:'INTEGER'}}});
 const decimalInteger=integerTemplate.replaceAll('"INTEGER"','1.0');
 const scientificInteger=integerTemplate.replaceAll('"INTEGER"','1e0');
 await post(decimalInteger);await post(scientificInteger,200);
 for (const [field,number] of [['schema','1.0000000000000000001'],['sequence','0.9999999999999999999'],['uptime_ms','9007199254740991.1']]) {
  await post(JSON.stringify({...packet,sequence:12,[field]:'BAD_NUMBER'}).replace('"BAD_NUMBER"',number),422);
 }
 await post(JSON.stringify({...packet,sequence:12,record:{battery:{...battery,cycles:'BAD_NUMBER'}}}).replace('"BAD_NUMBER"','2147483647.0000000001'),422);
 await post({...packet,sequence:12,record:{battery, ['x\u0000y']:1}},422);
 for (const from of ['0000-01-01T00:00:00Z','2026-01-01T00:00:00+24:00']) {
  const invalid=await fetch(base+'/api/v1/battery/history?'+new URLSearchParams({from,to:'2026-01-01T00:00:05Z'}));assert.equal(invalid.status,422);
 }
 console.log(offline?'Hub offline: ingestion and contract cases passed':'Real HTTP → database → Mercure SSE, idempotency, limits, late history passed');
}finally{controller.abort();}
