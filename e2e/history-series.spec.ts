import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import { validateState, type StreamState, type HistoryRange, type HistorySeries, type HistoryBin, type HistoryMetricSummary } from '../src/api/validation';
const endpoint='**/api/v1/battery/history/series?*';
const boot='ffffffffffff0001';
const stamp=(seconds:number)=>new Date(Date.UTC(2026,10,18,12)+seconds*1000).toISOString();
function metric(from:number,to:number,changes:Partial<HistoryMetricSummary>={}):HistoryMetricSummary {
 return {count:(to-from)/5,mean:10,min:-100,max:200,observed_coverage_seconds:to-from,continuous:true,first_at:stamp(from),last_at:stamp(to-5),first_boot:boot,last_boot:boot,...changes};
}
function series(range:HistoryRange='10m',pending=false):HistorySeries {
 const common={range,from:stamp(0),to:stamp(600),period_seconds:600,source_revision:1,aggregate_revision:1,prepared_at:stamp(600),processing_status:'ready' as const,observed_coverage_seconds:600,prepared_coverage_seconds:600};
 if(range==='10m' || range==='1h')return {...common,kind:'raw',resolution_seconds:0,gaps:[],points:[0,5].map(seconds=>({received_at:stamp(seconds),sequence:seconds,boot_id:boot,valid:true,power_w:10,current_a:1,soc_percent:50}))};
 const bins:HistoryBin[]=[0,300].map(from=>({from:stamp(from),to:stamp(from+300),status:'ready',observed_coverage_seconds:300,power_w:metric(from,from+300),current_a:metric(from,from+300)}));
 if(pending)bins[1]={from:stamp(300),to:stamp(600),status:'pending',observed_coverage_seconds:null,power_w:null,current_a:null};
 return {...common,kind:'aggregate',resolution_seconds:300,bins,...(pending?{processing_status:'pending',observed_coverage_seconds:null,prepared_coverage_seconds:300}: {})};
}
async function setup(page:Page,request:APIRequestContext) {
 const response=await request.get('/api/v1/telemetry/state');const data:unknown=await response.json();
 if(!validateState(data))throw new Error('Expected local state');
 const state:StreamState={...data,server_time:new Date().toISOString()};
 await page.addInitScript(()=>{
  Object.defineProperty(window,'EventSource',{value:class extends EventTarget {
   message=(event:Event)=>{if(event instanceof CustomEvent)this.dispatchEvent(new MessageEvent(event.detail.type,{data:JSON.stringify(event.detail.data)}));};
   constructor(){super();document.documentElement.dataset.streamCount=String(Number(document.documentElement.dataset.streamCount??0)+1);window.addEventListener('history-test-event',this.message);}
   close(){document.documentElement.dataset.streamCount=String(Number(document.documentElement.dataset.streamCount??0)-1);window.removeEventListener('history-test-event',this.message);}
  }});
 });
 let states=0;
 await page.route('**/api/v1/telemetry/state',route=>{states++;return route.fulfill({json:state});});
 return {state,states:()=>states};
}
async function emit(page:Page,type:string,data:unknown) {
 await page.evaluate(detail=>window.dispatchEvent(new CustomEvent('history-test-event',{detail})),{type,data});
}
async function aggregateSignal(page:Page,revision:number) { await emit(page,'history.updated.v1',{schema:1,aggregate_revision:revision,prepared_at:stamp(600+revision)}); }
const select=(page:Page,label:string)=>page.getByRole('group',{name:'Період історії потужності, струму та повноти'}).getByRole('button',{name:label,exact:true});
const ranges:ReadonlyArray<readonly [HistoryRange,string]>=[['10m','10 хв'],['1h','1 год'],['12h','12 год'],['24h','24 год'],['30d','30 днів'],['3mo','Квартал'],['1y','Рік']];

test('seven periods update both graphs and coverage through one stream and one request',async({page,request})=>{
 const initial=await setup(page,request);const calls:string[]=[];
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.route(endpoint,route=>{const range=new URL(route.request().url()).searchParams.get('range');const known=ranges.find(item=>item[0]===range);if(!known)throw new Error('Unknown range');calls.push(known[0]);return route.fulfill({json:series(known[0])});});
 await page.goto('/');await expect(page.locator('.quality .micro')).toHaveText('10 хв');
 const initialCalls=calls.length;const initialStates=initial.states();
 for(const [value,label] of ranges.slice(1)) {
  await select(page,label).click();await expect(page.locator('.quality .micro')).toHaveText(label);
  await expect(page.locator('.current-history .micro')).toHaveText(`Знімок · ${label}`);
  await expect(select(page,label)).toHaveAttribute('aria-pressed','true');await expect(select(page,label)).toBeDisabled();
  expect(calls.at(-1)).toBe(value);
 }
 expect(calls.slice(initialCalls)).toEqual(ranges.slice(1).map(item=>item[0]));expect(initial.states()).toBe(initialStates);
 expect(await page.locator('html').getAttribute('data-stream-count')).toBe('1');
});

test('a delayed older selection cannot replace the last selected period or its saved metadata',async({page,request})=>{
 await setup(page,request);let release=()=>{};const gate=new Promise<void>(resolve=>{release=resolve;});let oldRequested=false;
 await page.route(endpoint,async route=>{
  const range=new URL(route.request().url()).searchParams.get('range');
  if(range==='12h'){oldRequested=true;await gate;await route.fulfill({json:series('12h')}).catch(()=>{});return;}
  await route.fulfill({json:series(range==='1y'?'1y':'10m')});
 });
 await page.goto('/');await expect(page.locator('.quality .micro')).toHaveText('10 хв');
 await select(page,'12 год').click();await expect.poll(()=>oldRequested).toBe(true);
 await expect(page.locator('.quality .micro')).toHaveText('10 хв');await expect(page.locator('.history-warning')).toContainText('Оновлюємо історію · 12 год');
 await select(page,'Рік').click();await expect(page.locator('.quality .micro')).toHaveText('Рік');
 release();await page.waitForTimeout(250);await expect(page.locator('.quality .micro')).toHaveText('Рік');
 await expect(select(page,'Рік')).toHaveAttribute('aria-pressed','true');
});

test('telemetry and independent aggregate signals are coalesced without background polling',async({page,request})=>{
 const initial=await setup(page,request);const frozenAt=new Date();await page.clock.install({time:frozenAt});await page.clock.pauseAt(new Date(frozenAt.getTime()+1000));let count=0;
 await page.route(endpoint,route=>{count++;return route.fulfill({json:series(new URL(route.request().url()).searchParams.get('range')==='1y'?'1y':'10m')});});
 await page.goto('/');await expect(page.locator('.quality .micro')).toHaveText('10 хв');const baseline=count;const stateBaseline=initial.states();
 await emit(page,'telemetry.updated.v1',{schema:1,revision:initial.state.revision+1,server_time:initial.state.server_time,history_changed:true,latest:initial.state.latest?{...initial.state.latest,revision:initial.state.revision+1}:null});
 await aggregateSignal(page,2);await aggregateSignal(page,3);
 await page.clock.runFor(14999);expect(count).toBe(baseline);await page.clock.runFor(1);await expect.poll(()=>count).toBe(baseline+1);
 await page.clock.fastForward(120000);expect(count).toBe(baseline+1);
 await select(page,'Рік').evaluate(button=>{if(button instanceof HTMLButtonElement)button.click();});await expect(page.locator('.quality .micro')).toHaveText('Рік');expect(count).toBe(baseline+2);
 await aggregateSignal(page,4);await aggregateSignal(page,5);
 await page.clock.runFor(59999);expect(count).toBe(baseline+2);await page.clock.runFor(1);await expect.poll(()=>count).toBe(baseline+3);
 expect(initial.states()).toBe(stateBaseline);
});

test('hidden history pauses while live widgets continue, then visible recovery loads once',async({page,request})=>{
 const initial=await setup(page,request);const frozenAt=new Date();await page.clock.install({time:frozenAt});await page.clock.pauseAt(new Date(frozenAt.getTime()+1000));let count=0;
 await page.route(endpoint,route=>{count++;return route.fulfill({json:series()});});
 await page.goto('/');await expect(page.locator('.quality .micro')).toHaveText('10 хв');const baseline=count;
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
 await aggregateSignal(page,2);await aggregateSignal(page,3);
 if(initial.state.latest?.battery)await emit(page,'telemetry.updated.v1',{schema:1,revision:initial.state.revision+1,server_time:initial.state.server_time,history_changed:true,latest:{...initial.state.latest,revision:initial.state.revision+1,battery:{...initial.state.latest.battery,soc_percent:77}}});
 await expect(page.getByRole('img',{name:'Заряд 77 відсотків'})).toBeVisible();
 await page.clock.fastForward(120000);expect(count).toBe(baseline);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});
 await expect.poll(()=>count).toBe(baseline+1);await page.clock.fastForward(120000);expect(count).toBe(baseline+1);
});

for(const width of [320,390,600,1440]) {
 test(`pending, min/max, errors and transitions preserve chart geometry at ${width}px`,async({page,request},testInfo)=>{
  test.skip(testInfo.project.name!=='desktop','Explicit viewports covered once');
  await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:'reduce'});await setup(page,request);
  let fail=false;
  await page.route(endpoint,route=>route.fulfill(fail?{status:503,json:{error:{code:'database_unavailable',message:'Unavailable'}}}:{json:series(new URL(route.request().url()).searchParams.get('range')==='1y'?'1y':'10m',true)}));
  await page.goto('/');await expect(page.locator('.quality .micro')).toHaveText('10 хв');
  const geometry=()=>page.locator('.history,.current-history,.quality').evaluateAll(nodes=>nodes.map(node=>{const b=node.getBoundingClientRect();return {x:b.x,y:b.y+scrollY,w:b.width,h:b.height};}));
  const baseline=await geometry();
  await select(page,'Рік').click();await expect(page.locator('.quality .micro')).toHaveText('Рік');
  await expect(page.locator('.quality-value')).toContainText('—');await expect(page.locator('.quality-summary')).toContainText('Підготовлено 300 із 600 секунд');
  await expect(page.locator('.history .chart-pending')).toHaveCount(1);await expect(page.locator('.history .chart-gap')).toHaveCount(0);
  await expect(page.locator('.history .chart-extrema')).toHaveCount(1);
  await expect(page.getByRole('img',{name:/Історія потужності. Середні значення/})).toHaveAttribute('aria-label',/від -100 до 200/);
  expect(await geometry()).toEqual(baseline);expect(await page.locator('.chart-outgoing').count()).toBe(0);
  fail=true;await select(page,'30 днів').click();await expect(page.locator('.history-warning')).toContainText('Не вдалося оновити історію');
  await expect(page.locator('.quality .micro')).toHaveText('Рік');await expect(page.locator('.history .chart-extrema')).toHaveCount(1);
  expect(await geometry()).toEqual(baseline);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath(`history-${width}.png`),fullPage:true});
 });
}

test('crossfade keeps at most two plot layers and only the current graph accessible',async({page,request})=>{
 await setup(page,request);await page.emulateMedia({reducedMotion:'no-preference'});
 await page.route(endpoint,route=>route.fulfill({json:series(new URL(route.request().url()).searchParams.get('range')==='1y'?'1y':'10m')}));
 await page.goto('/');await expect(page.locator('.quality .micro')).toHaveText('10 хв');
 await select(page,'Рік').click();await expect(page.locator('.quality .micro')).toHaveText('Рік');
 expect(await page.locator('.history .chart-layer').count()).toBeLessThanOrEqual(2);
 await expect(page.getByRole('img',{name:/Історія потужності/})).toHaveCount(1);
 await page.waitForTimeout(250);await expect(page.locator('.history .chart-layer')).toHaveCount(1);
});

test('visible recovery and manual refresh load history once even when the state endpoint fails',async({page,request})=>{
 const initial=await setup(page,request);const frozenAt=new Date();await page.clock.install({time:frozenAt});await page.clock.pauseAt(new Date(frozenAt.getTime()+1000));
 let unavailable=false;let stateRequests=0;let historyRequests=0;let revision=1;
 let releaseState=()=>{};const stateGate=new Promise<void>(resolve=>{releaseState=resolve;});
 await page.route('**/api/v1/telemetry/state',async route=>{
  stateRequests++;
  if(unavailable) {await stateGate;await route.fulfill({status:503,json:{error:{code:'database_unavailable',message:'Unavailable'}}});}
  else await route.fulfill({json:initial.state});
 });
 await page.route(endpoint,route=>{
  historyRequests++;const range=new URL(route.request().url()).searchParams.get('range')==='1y'?'1y':'10m';
  return route.fulfill({json:{...series(range),aggregate_revision:revision,to:stamp(600+revision)}});
 });
 await page.goto('/');await expect(page.locator('.quality .micro')).toHaveText('10 хв');
 await select(page,'Рік').evaluate(button=>{if(button instanceof HTMLButtonElement)button.click();});await expect(page.locator('.quality .micro')).toHaveText('Рік');
 const historyBaseline=historyRequests;const stateBaseline=stateRequests;
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
 revision=2;await aggregateSignal(page,2);unavailable=true;
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});
 await expect.poll(()=>historyRequests).toBe(historyBaseline+1);
 const secondTime=new Date(stamp(602)).toLocaleString('uk-UA',{timeZone:'Europe/Kyiv'});
 await expect(page.locator('.quality-summary')).toContainText(secondTime);
 // A fresh signal during state recovery remains one trailing aggregate request, not a duplicate immediate fetch.
 await aggregateSignal(page,3);releaseState();await expect(page.getByRole('status')).toContainText('База даних недоступна');
 for(let step=0;step<25 && stateRequests<stateBaseline+4;step++) {
  await page.clock.runFor(1000);await page.waitForTimeout(50);
 }
 expect(stateRequests).toBe(stateBaseline+4);
 expect(historyRequests).toBe(historyBaseline+1);
 revision=3;await page.getByRole('button',{name:'Оновити знімок'}).evaluate(button=>{if(button instanceof HTMLButtonElement)button.click();});
 await expect.poll(()=>historyRequests).toBe(historyBaseline+2);
 const thirdTime=new Date(stamp(603)).toLocaleString('uk-UA',{timeZone:'Europe/Kyiv'});
 await expect(page.locator('.quality-summary')).toContainText(thirdTime);
 await page.clock.runFor(20000);expect(historyRequests).toBe(historyBaseline+2);
});

test('long ready and pending periods display exact grouped duration counters',async({page,request})=>{
 await setup(page,request);
 await page.route(endpoint,route=>{
  const range=new URL(route.request().url()).searchParams.get('range');
  const data=range==='30d'?{...series('30d'),period_seconds:2592000,observed_coverage_seconds:1234567,prepared_coverage_seconds:2592000}:range==='1y'?{...series('1y',true),period_seconds:31536000,prepared_coverage_seconds:12345678}:{...series()};
  return route.fulfill({json:data});
 });
 await page.goto('/');await expect(page.locator('.quality .micro')).toHaveText('10 хв');
 await select(page,'30 днів').click();await expect(page.locator('.quality .micro')).toHaveText('30 днів');
 await expect(page.locator('.quality-summary')).toContainText('1 234 567 із 2 592 000 секунд');
 await select(page,'Рік').click();await expect(page.locator('.quality .micro')).toHaveText('Рік');
 await expect(page.locator('.quality-summary')).toContainText('Підготовлено 12 345 678 із 31 536 000 секунд');
 await expect(page.locator('.quality-summary')).not.toContainText(/[еe][+\-]?\d/i);
});

for(const order of ['state-first','history-first'] as const) {
 for(const changed of [true,false]) {
  test(`first stream open refreshes a held history snapshot: ${order}, ${changed?'new':'same'} revision`,async({page,request})=>{
   const initial=await setup(page,request);const frozenAt=new Date();await page.clock.install({time:frozenAt});await page.clock.pauseAt(new Date(frozenAt.getTime()+1000));
   let serverState=initial.state;let holdState=false;let historyRequests=0;let stateRequests=0;let stateReplies=0;
   let releaseHistory=()=>{};const historyGate=new Promise<void>(resolve=>{releaseHistory=resolve;});
   let releaseState=()=>{};const stateGate=new Promise<void>(resolve=>{releaseState=resolve;});
   await page.route('**/api/v1/telemetry/state',async route=>{
    stateRequests++;const snapshot=serverState;if(holdState)await stateGate;
    await route.fulfill({json:snapshot});stateReplies++;
   });
   await page.route(endpoint,async route=>{
    historyRequests++;const data=series();if(data.kind!=='raw')throw new Error('Expected raw fixture');
    // Capture the database snapshot before delaying only its response.
    const sourceRevision=serverState.revision;
    const captured={...data,source_revision:sourceRevision,points:data.points.map(point=>({...point,power_w:sourceRevision===initial.state.revision?10:20}))};
    await historyGate;await route.fulfill({json:captured}).catch(()=>{});
   });
   await page.goto('/');await expect(page.getByText('Тестові дані')).toBeVisible();
   await expect.poll(()=>historyRequests).toBeGreaterThan(0);
   const historyBaseline=historyRequests;const stateBaseline=stateRequests;const repliesBaseline=stateReplies;
   const latest=initial.state.latest;
   if(changed) {
    if(!latest?.battery)throw new Error('Expected local battery fixture');
    const revision=initial.state.revision+1;
    serverState={...initial.state,revision,latest:{...latest,revision,battery:{...latest.battery,soc_percent:77}}};
   }
   holdState=true;
   // No telemetry/history publication is replayed after the subscription opens.
   await emit(page,'open',{});await expect.poll(()=>stateRequests).toBe(stateBaseline+1);
   if(order==='state-first') {
    releaseState();await expect.poll(()=>stateReplies).toBe(repliesBaseline+1);
    if(changed)await expect(page.getByRole('img',{name:'Заряд 77 відсотків'})).toBeVisible();
    releaseHistory();await expect(page.locator('.quality .micro')).toHaveText('10 хв');
   } else {
    releaseHistory();await expect(page.locator('.quality .micro')).toHaveText('10 хв');
    releaseState();await expect.poll(()=>stateReplies).toBe(repliesBaseline+1);
    if(changed)await expect(page.getByRole('img',{name:'Заряд 77 відсотків'})).toBeVisible();
   }
   await page.clock.runFor(15000);
   await expect.poll(()=>historyRequests).toBe(historyBaseline+1);
   const power=page.getByRole('img',{name:/Історія потужності/});
   await expect(power).toHaveAttribute('aria-label',changed?/від 20 до 20/:/від 10 до 10/);
   await page.clock.fastForward(60000);expect(historyRequests).toBe(historyBaseline+1);
  });
 }
}

test('first stream open refreshes aggregate preparation published before subscription without new telemetry',async({page,request})=>{
 await setup(page,request);await page.emulateMedia({reducedMotion:'reduce'});
 let aggregateRevision=1;let historyRequests=0;
 let release=()=>{};const gate=new Promise<void>(resolve=>{release=resolve;});
 await page.route(endpoint,async route=>{
  historyRequests++;const range=new URL(route.request().url()).searchParams.get('range');
  if(range!=='1y') {await route.fulfill({json:series()});return;}
  // Capture aggregate preparation independently; source_revision stays unchanged.
  const captured={...series('1y',aggregateRevision===1),aggregate_revision:aggregateRevision};
  await gate;await route.fulfill({json:captured}).catch(()=>{});
 });
 await page.goto('/');await expect(page.locator('.quality .micro')).toHaveText('10 хв');
 const beforeSelection=historyRequests;
 await select(page,'Рік').click();await expect.poll(()=>historyRequests).toBe(beforeSelection+1);
 aggregateRevision=2;const beforeOpen=historyRequests;
 // The hub does not replay the already-published history.updated.v1 event.
 await emit(page,'open',{});await expect.poll(()=>historyRequests).toBe(beforeOpen+1);
 release();await expect(page.locator('.quality .micro')).toHaveText('Рік');
 await expect(page.locator('.quality-value')).toContainText('100');
 await expect(page.locator('.quality-summary')).not.toContainText('Історія готується');
 await expect(page.locator('.history .chart-pending')).toHaveCount(0);
});
