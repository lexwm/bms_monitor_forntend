import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import type { StreamState } from '../src/api/validation';
import { emit, freshState, knownRange, knownSet, measurementSignal, mockHistory, noEvents, preparedSignal, ranges, requested, series, setHidden, stamp, stubStream, energy } from './support';

const endpoint='**/api/v1/battery/history/series?*';
async function setup(page:Page,request:APIRequestContext) {
 const state:StreamState=await freshState(request);
 await stubStream(page);
 let states=0;
 await page.route('**/api/v1/telemetry/state',route=>{states++;return route.fulfill({json:state});});
 return {state,states:()=>states};
}
const select=(page:Page,label:string)=>page.getByRole('group',{name:'Період історії'}).getByRole('button',{name:label,exact:true});
const quality=(page:Page)=>page.locator('.quality .micro');
const failure={status:503,json:{error:{code:'database_unavailable',message:'Unavailable'}}};

test('seven periods load one series of the open tab through one stream, without new state snapshots',async({page,request})=>{
 const initial=await setup(page,request);
 await page.emulateMedia({reducedMotion:'reduce'});
 const {calls}=await mockHistory(page);
 await page.goto('/#history');await expect(quality(page)).toHaveText('10 хв');
 await expect(page.locator('.history-chart')).toHaveCount(5);
 const initialCalls=calls.length;const initialStates=initial.states();
 for(const [,label] of ranges.slice(1)) {
  await select(page,label).click();await expect(quality(page)).toHaveText(label);
  await expect(select(page,label)).toHaveAttribute('aria-pressed','true');await expect(select(page,label)).toBeDisabled();
 }
 expect(calls.slice(initialCalls)).toEqual(ranges.slice(1).map(item=>`${item[0]}:overview`));
 await page.getByRole('navigation',{name:'Розділи історії'}).getByRole('link',{name:'Комірки'}).click();
 await expect(page.locator('.history-chart')).toHaveCount(2);await expect.poll(()=>calls.at(-1)).toBe('1y:cells');
 const cellsCalls=calls.length;
 await select(page,'30 днів').click();await expect(quality(page)).toHaveText('30 днів');
 expect(calls.slice(cellsCalls)).toEqual(['30d:cells']);
 expect(initial.states()).toBe(initialStates);
 expect(await page.locator('html').getAttribute('data-stream-count')).toBe('1');
});

test('a delayed older selection cannot replace the last selected period or its saved metadata',async({page,request})=>{
 await setup(page,request);let release=()=>{};const gate=new Promise<void>(resolve=>{release=resolve;});let oldRequested=false;
 await mockHistory(page,async(range,set)=>{if(range==='12h'){oldRequested=true;await gate;}return series(range,set);});
 await page.goto('/#history');await expect(quality(page)).toHaveText('10 хв');
 await select(page,'12 год').click();await expect.poll(()=>oldRequested).toBe(true);
 await expect(quality(page)).toHaveText('10 хв');await expect(page.locator('.quality .history-warning')).toContainText('Оновлюємо історію · 12 год');
 await select(page,'Рік').click();await expect(quality(page)).toHaveText('Рік');
 release();await page.waitForTimeout(250);await expect(quality(page)).toHaveText('Рік');
 await expect(select(page,'Рік')).toHaveAttribute('aria-pressed','true');
});

test('measurement and prepared-history signals are coalesced on the history page without background polling',async({page,request})=>{
 const initial=await setup(page,request);const frozenAt=new Date();await page.clock.install({time:frozenAt});await page.clock.pauseAt(new Date(frozenAt.getTime()+1000));
 const {counts}=await mockHistory(page);
 await page.goto('/#history');await expect(quality(page)).toHaveText('10 хв');const baseline=counts.series;const stateBaseline=initial.states();
 await measurementSignal(page,initial.state,initial.state.revision+1);
 await preparedSignal(page,2);await preparedSignal(page,3);
 await page.clock.runFor(14999);expect(counts.series).toBe(baseline);await page.clock.runFor(1);await expect.poll(()=>counts.series).toBe(baseline+1);
 await page.clock.fastForward(120000);expect(counts.series).toBe(baseline+1);
 await select(page,'Рік').evaluate(button=>{if(button instanceof HTMLButtonElement)button.click();});await expect(quality(page)).toHaveText('Рік');expect(counts.series).toBe(baseline+2);
 await preparedSignal(page,4);await preparedSignal(page,5);
 await page.clock.runFor(59999);expect(counts.series).toBe(baseline+2);await page.clock.runFor(1);await expect.poll(()=>counts.series).toBe(baseline+3);
 expect(initial.states()).toBe(stateBaseline);
});

test('a hidden tab pauses history while live readings continue, then visible recovery loads once per consumer',async({page,request})=>{
 const initial=await setup(page,request);const frozenAt=new Date();await page.clock.install({time:frozenAt});await page.clock.pauseAt(new Date(frozenAt.getTime()+1000));
 const {counts}=await mockHistory(page);
 await page.goto('/#history');await expect(quality(page)).toHaveText('10 хв');const baseline=counts.series;
 await setHidden(page,true);
 await preparedSignal(page,2);await preparedSignal(page,3);
 const latest=initial.state.latest;if(!latest?.battery)throw new Error('Expected battery');
 await emit(page,'telemetry.updated.v1',{schema:1,revision:initial.state.revision+1,server_time:initial.state.server_time,history_changed:true,latest:{...latest,revision:initial.state.revision+1,battery:{...latest.battery,soc_percent:77}}});
 // The dashboard mounted while hidden shows the live reading but requests nothing yet.
 await page.evaluate(()=>{location.hash='#overview';});
 await expect(page.getByRole('img',{name:'Заряд 77 відсотків'})).toBeVisible();
 await page.clock.fastForward(120000);expect(counts.series).toBe(baseline);
 await setHidden(page,false);
 // Three dashboard consumers: the 10-minute window and the two 24-hour summaries.
 await expect.poll(()=>counts.series).toBe(baseline+3);await page.clock.fastForward(120000);expect(counts.series).toBe(baseline+3);
});

test('hidden history page makes no requests and returns with exactly one request per consumer',async({page,request})=>{
 const initial=await setup(page,request);const frozenAt=new Date();await page.clock.install({time:frozenAt});await page.clock.pauseAt(new Date(frozenAt.getTime()+1000));
 const {counts}=await mockHistory(page);
 await page.goto('/#history');await expect(quality(page)).toHaveText('10 хв');await expect.poll(()=>counts.events).toBeGreaterThan(0);
 const series0=counts.series;const events0=counts.events;
 await setHidden(page,true);
 for(let step=0;step<10;step++){await preparedSignal(page,10+step);await measurementSignal(page,initial.state,initial.state.revision+1+step);await page.clock.fastForward(30000);}
 expect(counts.series).toBe(series0);expect(counts.events).toBe(events0);
 await setHidden(page,false);
 await expect.poll(()=>counts.series).toBe(series0+1);await expect.poll(()=>counts.events).toBe(events0+1);
 await page.clock.fastForward(300000);expect(counts.series).toBe(series0+1);expect(counts.events).toBe(events0+1);
});

for(const width of [320,390,600,1440]) {
 test(`loading, empty, pending, min/max and errors preserve chart geometry at ${width}px`,async({page,request},testInfo)=>{
  test.skip(testInfo.project.name!=='desktop','Explicit viewports covered once');
  await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:'reduce'});await setup(page,request);
  let mode:'ready'|'empty'|'fail'='ready';let release=()=>{};const gate=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/api/v1/battery/events?*',route=>route.fulfill({json:noEvents()}));
  await page.route(endpoint,async route=>{
   await gate;const {range,set}=requested(route);const value=series(knownRange(range),knownSet(set),true);
   if(mode==='fail'){await route.fulfill(failure);return;}
   await route.fulfill({json:mode==='empty'&&value.kind==='raw'?{...value,points:[],observed_coverage_seconds:0,gaps:[{from:value.from,to:value.to}]}:value});
  });
  await page.goto('/#history');await expect(page.getByText('Завантажуємо історію…',{exact:true})).toHaveCount(5);
  await expect(page.getByRole('img',{name:'Потужність. Завантажуємо історію…',exact:true})).toBeVisible();await expect(page.getByRole('slider')).toHaveCount(0);
  const geometry=()=>page.locator('.history-chart,.quality').evaluateAll(nodes=>nodes.map(node=>{const b=node.getBoundingClientRect();return {x:b.x,y:b.y+scrollY,w:b.width,h:b.height};}));
  const baseline=await geometry();
  release();await expect(quality(page)).toHaveText('10 хв');expect(await geometry()).toEqual(baseline);
  mode='empty';await page.getByRole('button',{name:'Оновити знімок'}).click();
  await expect(page.getByText('Немає значень показника за цей період',{exact:true})).toHaveCount(5);expect(await geometry()).toEqual(baseline);
  await expect(page.getByRole('img',{name:/^Потужність\. Виміряних точок: 0\./})).toBeVisible();await expect(page.getByRole('slider')).toHaveCount(0);
  mode='ready';await select(page,'Рік').click();await expect(quality(page)).toHaveText('Рік');
  await expect(page.locator('.quality-value')).toContainText('—');await expect(page.locator('.quality-summary')).toContainText('Підготовлено 300 із 600 секунд');
  const power=page.getByRole('region',{name:'Потужність',exact:true});
  await expect(power.locator('.chart-pending')).toHaveCount(1);await expect(power.locator('.chart-gap')).toHaveCount(0);
  await expect(power.locator('.chart-extrema')).toHaveCount(1);
  await expect(page.getByRole('region',{name:'Напруга батареї',exact:true}).locator('.chart-pending')).toHaveCount(1);
  await expect(page.getByRole('slider',{name:'Потужність',exact:true})).toHaveAccessibleDescription(/^Потужність\. Середні значення.*від -100 до 200/);
  await expect(page.locator('.history-legend')).toContainText('Середнє; мінімум–максимум — для однієї або виділеної лінії');
  expect(await geometry()).toEqual(baseline);expect(await page.locator('.chart-outgoing').count()).toBe(0);
  mode='fail';await select(page,'30 днів').click();await expect(page.locator('.quality .history-warning')).toContainText('Не вдалося оновити історію');
  await expect(quality(page)).toHaveText('Рік');await expect(power.locator('.chart-extrema')).toHaveCount(1);
  expect(await geometry()).toEqual(baseline);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath(`history-${width}.png`),fullPage:true});
 });
}

test('crossfade keeps at most two plot layers and only the current graph accessible',async({page,request})=>{
 await setup(page,request);await page.emulateMedia({reducedMotion:'no-preference'});
 await mockHistory(page);
 await page.goto('/#history');await expect(quality(page)).toHaveText('10 хв');
 await select(page,'Рік').click();await expect(quality(page)).toHaveText('Рік');
 const power=page.getByRole('region',{name:'Потужність',exact:true});
 expect(await power.locator('.chart-layer').count()).toBeLessThanOrEqual(2);
 await expect(page.getByRole('slider',{name:'Потужність',exact:true})).toHaveCount(1);
 await page.waitForTimeout(250);await expect(power.locator('.chart-layer')).toHaveCount(1);
});

test('visible recovery and manual refresh load history once even when the state endpoint fails',async({page,request})=>{
 const initial=await setup(page,request);const frozenAt=new Date();await page.clock.install({time:frozenAt});await page.clock.pauseAt(new Date(frozenAt.getTime()+1000));
 let unavailable=false;let stateRequests=0;let historyRequests=0;let revision=1;
 let releaseState=()=>{};const stateGate=new Promise<void>(resolve=>{releaseState=resolve;});
 await page.unroute('**/api/v1/telemetry/state');
 await page.route('**/api/v1/telemetry/state',async route=>{
  stateRequests++;
  if(unavailable) {await stateGate;await route.fulfill(failure);}
  else await route.fulfill({json:initial.state});
 });
 await page.route('**/api/v1/battery/events?*',route=>route.fulfill({json:noEvents()}));
 await page.route(endpoint,route=>{
  historyRequests++;const {range,set}=requested(route);
  return route.fulfill({json:{...series(knownRange(range),knownSet(set)),aggregate_revision:revision,to:stamp(600+revision)}});
 });
 await page.goto('/#history');await expect(quality(page)).toHaveText('10 хв');
 await select(page,'Рік').evaluate(button=>{if(button instanceof HTMLButtonElement)button.click();});await expect(quality(page)).toHaveText('Рік');
 const historyBaseline=historyRequests;const stateBaseline=stateRequests;
 await setHidden(page,true);
 revision=2;await preparedSignal(page,2);unavailable=true;
 await setHidden(page,false);
 await expect.poll(()=>historyRequests).toBe(historyBaseline+1);
 const secondTime=new Date(stamp(602)).toLocaleString('uk-UA',{timeZone:'Europe/Kyiv'});
 await expect(page.locator('.quality-summary')).toContainText(secondTime);
 // A fresh signal during state recovery remains one trailing aggregate request, not a duplicate immediate fetch.
 await preparedSignal(page,3);releaseState();await expect(page.getByRole('status')).toContainText('База даних недоступна');
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
 await mockHistory(page,(range,set)=>range==='30d'?{...series('30d',set),period_seconds:2592000,observed_coverage_seconds:1234567,prepared_coverage_seconds:2592000}:range==='1y'?{...series('1y',set,true),period_seconds:31536000,prepared_coverage_seconds:12345678}:series(range,set));
 await page.goto('/#history');await expect(quality(page)).toHaveText('10 хв');
 await select(page,'30 днів').click();await expect(quality(page)).toHaveText('30 днів');
 await expect(page.locator('.quality-summary')).toContainText('1 234 567 із 2 592 000 секунд');
 await select(page,'Рік').click();await expect(quality(page)).toHaveText('Рік');
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
   await page.unroute('**/api/v1/telemetry/state');
   await page.route('**/api/v1/telemetry/state',async route=>{
    stateRequests++;const snapshot=serverState;if(holdState)await stateGate;
    await route.fulfill({json:snapshot});stateReplies++;
   });
   await page.route('**/api/v1/battery/events?*',route=>route.fulfill({json:noEvents()}));
   await page.route(endpoint,async route=>{
    historyRequests++;const data=series('10m','overview');if(data.kind!=='raw')throw new Error('Expected raw fixture');
    // Capture the database snapshot before delaying only its response.
    const sourceRevision=serverState.revision;
    const captured={...data,source_revision:sourceRevision,points:data.points.map(point=>({...point,power_w:sourceRevision===initial.state.revision?10:20}))};
    await historyGate;await route.fulfill({json:captured}).catch(()=>{});
   });
   await page.goto('/#history');await expect(page.getByText('Тестові дані')).toBeVisible();
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
   await emit(page,'open');await expect.poll(()=>stateRequests).toBe(stateBaseline+1);
   if(order==='state-first') {
    releaseState();await expect.poll(()=>stateReplies).toBe(repliesBaseline+1);
    releaseHistory();await expect(quality(page)).toHaveText('10 хв');
   } else {
    releaseHistory();await expect(quality(page)).toHaveText('10 хв');
    releaseState();await expect.poll(()=>stateReplies).toBe(repliesBaseline+1);
   }
   await page.clock.runFor(15000);
   await expect.poll(()=>historyRequests).toBe(historyBaseline+1);
   await expect(page.getByRole('slider',{name:'Потужність',exact:true})).toHaveAccessibleDescription(changed?/від 20 до 20/:/від 10 до 10/);
   await page.clock.fastForward(60000);expect(historyRequests).toBe(historyBaseline+1);
  });
 }
}

test('first stream open refreshes aggregate preparation published before subscription without new telemetry',async({page,request})=>{
 await setup(page,request);await page.emulateMedia({reducedMotion:'reduce'});
 let aggregateRevision=1;let historyRequests=0;
 let release=()=>{};const gate=new Promise<void>(resolve=>{release=resolve;});
 await page.route('**/api/v1/battery/events?*',route=>route.fulfill({json:noEvents()}));
 await page.route(endpoint,async route=>{
  historyRequests++;const {range,set}=requested(route);
  if(range!=='1y') {await route.fulfill({json:series(knownRange(range),knownSet(set))});return;}
  // Capture aggregate preparation independently; source_revision stays unchanged.
  const captured={...series('1y',knownSet(set),aggregateRevision===1),aggregate_revision:aggregateRevision};
  await gate;await route.fulfill({json:captured}).catch(()=>{});
 });
 await page.goto('/#history');await expect(quality(page)).toHaveText('10 хв');
 const beforeSelection=historyRequests;
 await select(page,'Рік').click();await expect.poll(()=>historyRequests).toBe(beforeSelection+1);
 aggregateRevision=2;const beforeOpen=historyRequests;
 // The hub does not replay the already-published history.updated.v1 event.
 await emit(page,'open');await expect.poll(()=>historyRequests).toBe(beforeOpen+1);
 release();await expect(quality(page)).toHaveText('Рік');
 await expect(page.locator('.quality-value')).toContainText('100');
 await expect(page.locator('.quality-summary')).not.toContainText('Історія готується');
 await expect(page.getByRole('region',{name:'Потужність',exact:true}).locator('.chart-pending')).toHaveCount(0);
});

// D7: every consumer keeps its own cap; nothing is requested without signals; a hidden tab pauses all.
test('dashboard request budget: 10-minute window per measurement, 24-hour summaries and bell per prepared history',async({page,request})=>{
 const initial=await setup(page,request);const frozenAt=new Date();await page.clock.install({time:frozenAt});await page.clock.pauseAt(new Date(frozenAt.getTime()+1000));
 const {calls,counts}=await mockHistory(page);
 await page.goto('/');await expect(page.getByTestId('day-range-cells')).toContainText('мін.');
 await expect.poll(()=>counts.events).toBeGreaterThan(0);
 const count=(key:string)=>calls.filter(call=>call===key).length;
 const start={raw:count('10m:basic'),overview:count('24h:overview'),cells:count('24h:cells'),bell:counts.events,states:initial.states()};
 // No signals: no requests at all.
 await page.clock.fastForward(600000);
 expect([count('10m:basic'),count('24h:overview'),count('24h:cells'),counts.events,initial.states()]).toEqual([start.raw,start.overview,start.cells,start.bell,start.states]);
 // Five minutes of a measurement every 5 seconds and a new prepared revision every 5 seconds.
 for(let second=0;second<300;second+=5) {
  await measurementSignal(page,initial.state,initial.state.revision+1+second);await preparedSignal(page,100+second);
  await page.clock.runFor(5000);
 }
 await page.waitForTimeout(100);
 const raw=count('10m:basic')-start.raw;const overview=count('24h:overview')-start.overview;const cells=count('24h:cells')-start.cells;const bell=counts.events-start.bell;
 expect(raw).toBeGreaterThanOrEqual(19);expect(raw).toBeLessThanOrEqual(21);
 for(const value of [overview,cells,bell]){expect(value).toBeGreaterThanOrEqual(4);expect(value).toBeLessThanOrEqual(6);}
 // About 7 requests per minute in this worst case (every signal changes prepared history): 4 + 1 + 1 + 1,
 // plus at most one leading request per consumer at the start of the window.
 expect(raw+overview+cells+bell).toBeLessThanOrEqual(7*5+4);
 expect(counts.energy).toBe(0);expect(initial.states()).toBe(start.states);
 expect(await page.locator('html').getAttribute('data-stream-count')).toBe('1');
 // Hidden: nothing; visible again: exactly one request per consumer.
 await page.clock.fastForward(120000);
 const before={raw:count('10m:basic'),overview:count('24h:overview'),cells:count('24h:cells'),bell:counts.events};
 await setHidden(page,true);
 for(let second=0;second<120;second+=5){await measurementSignal(page,initial.state,initial.state.revision+400+second);await preparedSignal(page,600+second);await page.clock.runFor(5000);}
 expect([count('10m:basic'),count('24h:overview'),count('24h:cells'),counts.events]).toEqual([before.raw,before.overview,before.cells,before.bell]);
 await setHidden(page,false);
 await expect.poll(()=>[count('10m:basic'),count('24h:overview'),count('24h:cells'),counts.events]).toEqual([before.raw+1,before.overview+1,before.cells+1,before.bell+1]);
 await page.clock.fastForward(300000);
 expect([count('10m:basic'),count('24h:overview'),count('24h:cells'),counts.events]).toEqual([before.raw+1,before.overview+1,before.cells+1,before.bell+1]);
});

test('energy tab reads daily energy only on prepared-history signals, at most once a minute',async({page,request})=>{
 const initial=await setup(page,request);const frozenAt=new Date();await page.clock.install({time:frozenAt});await page.clock.pauseAt(new Date(frozenAt.getTime()+1000));
 let energyCalls=0;const asked:string[]=[];
 await page.route('**/api/v1/battery/energy/daily?*',route=>{energyCalls++;asked.push(requested(route).range??'');return route.fulfill({json:energy(requested(route).range==='1y'?'1y':requested(route).range==='3mo'?'3mo':'30d')});});
 await page.route('**/api/v1/battery/events?*',route=>route.fulfill({json:noEvents()}));
 let seriesCalls=0;await page.route(endpoint,route=>{seriesCalls++;return route.fulfill({json:series()});});
 await page.goto('/#history/energy');await expect(page.getByTestId('energy-warning')).toBeVisible();await expect.poll(()=>energyCalls).toBeGreaterThan(0);
 await page.waitForTimeout(100);const baseline=energyCalls;
 expect(seriesCalls).toBe(0);
 for(let second=0;second<120;second+=5){await measurementSignal(page,initial.state,initial.state.revision+1+second);await page.clock.runFor(5000);}
 expect(energyCalls).toBe(baseline);
 for(let second=0;second<120;second+=5){await preparedSignal(page,10+second);await page.clock.runFor(5000);}
 await page.waitForTimeout(50);
 expect(energyCalls-baseline).toBeGreaterThanOrEqual(2);expect(energyCalls-baseline).toBeLessThanOrEqual(3);
 await page.getByRole('group',{name:'Період історії'}).getByRole('button',{name:'Рік'}).evaluate(button=>{if(button instanceof HTMLButtonElement)button.click();});
 await expect.poll(()=>asked.at(-1)).toBe('1y');
 await page.getByRole('group',{name:'Період історії'}).getByRole('button',{name:'24 год'}).evaluate(button=>{if(button instanceof HTMLButtonElement)button.click();});
 await expect.poll(()=>asked.at(-1)).toBe('30d');
 expect(seriesCalls).toBe(0);
});
