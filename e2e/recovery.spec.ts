import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import { validateState, type StreamState } from '../src/api/validation';

async function snapshot(request: APIRequestContext): Promise<StreamState> {
 const response=await request.get('/api/v1/telemetry/state');
 const value: unknown=await response.json();
 if(!validateState(value) || value.latest?.battery==null)throw new Error('Expected synthetic fixture');
 const now=new Date().toISOString();
 return {...value,server_time:now,latest:{...value.latest,battery:value.latest.battery,server_time:now,received_at:new Date(Date.now()-10000).toISOString(),age_seconds:10,state:'fresh',valid:true,stale:false,mode:'unknown',reason:null,last_valid:null}};
}
async function mockStream(page: Page) {
 await page.addInitScript(()=>{
  Object.defineProperty(window,'EventSource',{value:class extends EventTarget {
   message=(event: Event)=>{if(event instanceof CustomEvent && typeof event.detail==='string')this.dispatchEvent(new MessageEvent('telemetry.updated.v1',{data:event.detail}));};
   open=()=>this.dispatchEvent(new Event('open'));
   error=()=>this.dispatchEvent(new Event('error'));
   constructor(){super();document.documentElement.dataset.streamCount=String(Number(document.documentElement.dataset.streamCount??0)+1);window.addEventListener('test-stream',this.message);window.addEventListener('test-open',this.open);window.addEventListener('test-error',this.error);}
   close(){window.removeEventListener('test-stream',this.message);window.removeEventListener('test-open',this.open);window.removeEventListener('test-error',this.error);}
  }});
 });
}
async function emit(page: Page, value: unknown) {
 await page.evaluate(data=>window.dispatchEvent(new CustomEvent('test-stream',{detail:JSON.stringify(data)})),value);
}
function eventFor(state: StreamState) {
 if(state.latest?.battery==null)throw new Error('Expected battery');
 return {schema:1,revision:state.revision+1,server_time:state.server_time,history_changed:true,latest:{...state.latest,revision:state.revision+1,battery:{...state.latest.battery,soc_percent:77}}};
}

test('valid events still apply after bounded recovery attempts are exhausted',async({page,request})=>{
 const initial=await snapshot(request);await mockStream(page);await page.clock.install();let requests=0;let unavailable=false;
 await page.route('**/api/v1/telemetry/state',async route=>{
  requests++;
  await route.fulfill({status:unavailable?503:200,contentType:'application/json',json:unavailable?{error:{code:'database_unavailable',message:'Unavailable'}}:initial});
 });
 await page.goto('/');await expect(page.getByText('Тестові дані')).toBeVisible();
 const baseline=requests;unavailable=true;
 await page.evaluate(()=>window.dispatchEvent(new Event('test-open')));
 await expect(page.getByRole('status')).toContainText('База даних недоступна');
 for(const [delay,count] of [[2100,baseline+2],[4100,baseline+3],[8100,baseline+4]]) {
  await page.clock.runFor(delay??0);await expect.poll(()=>requests).toBe(count);
 }
 await emit(page,eventFor(initial));
 await expect(page.getByRole('img',{name:'Заряд 77 відсотків'})).toBeVisible();
 await expect(page.getByRole('status')).toContainText('База даних недоступна');
 await page.clock.runFor(10000);expect(requests).toBe(baseline+4);
});

test('failed manual refresh retains the stream and advancing age',async({page,request})=>{
 const initial=await snapshot(request);await mockStream(page);await page.clock.install({time:new Date(initial.server_time)});await page.clock.pauseAt(new Date(Date.parse(initial.server_time)+1000));let requests=0;let unavailable=false;
 await page.route('**/api/v1/telemetry/state',async route=>{
  requests++;await route.fulfill({status:unavailable?503:200,contentType:'application/json',json:unavailable?{error:{code:'database_unavailable',message:'Unavailable'}}:initial});
 });
 await page.goto('/');await expect(page.getByText('Тестові дані')).toBeVisible();
 const readAge=async()=>{const text=await page.getByRole('status').textContent();const age=text?.match(/Вік даних: (\d+) с/)?.[1];if(age===undefined)throw new Error('Expected displayed age');return Number(age);};
 const initialAge=await readAge();await page.clock.runFor(5000);const ageBeforeFailure=await readAge();expect(ageBeforeFailure).toBeGreaterThan(initialAge);
 const streams=await page.locator('html').getAttribute('data-stream-count');unavailable=true;
 await page.getByRole('button',{name:'Оновити знімок'}).evaluate(button=>{if(button instanceof HTMLButtonElement)button.click();});
 await expect(page.getByRole('status')).toContainText('База даних недоступна');
 await page.clock.runFor(2000);await expect.poll(readAge).toBeGreaterThan(ageBeforeFailure);
 expect(await page.locator('html').getAttribute('data-stream-count')).toBe(streams);
});

test('successful resync clears a malformed event warning but not a broken transport',async({page,request})=>{
 const initial=await snapshot(request);await mockStream(page);let requests=0;
 await page.route('**/api/v1/telemetry/state',async route=>{requests++;await route.fulfill({json:initial});});
 await page.goto('/');await expect(page.getByText('Тестові дані')).toBeVisible();
 const baseline=requests;await emit(page,{schema:999});await expect.poll(()=>requests).toBe(baseline+1);
 await emit(page,eventFor(initial));
 await expect(page.getByRole('img',{name:'Заряд 77 відсотків'})).toBeVisible();
 await expect(page.getByText('Канал оновлень відновлюється',{exact:false})).toHaveCount(0);
 await page.evaluate(()=>window.dispatchEvent(new Event('test-error')));
 await page.getByRole('button',{name:'Оновити знімок'}).click();
 await expect.poll(()=>requests).toBe(baseline+2);
 await expect(page.getByText('Канал оновлень відновлюється',{exact:false})).toBeVisible();
});

test('opening the stream resyncs a measurement published after the bootstrap snapshot',async({page,request})=>{
 const initial=await snapshot(request);const newer=eventFor(initial);let current=initial;let requests=0;
 await page.addInitScript(()=>{
  Object.defineProperty(window,'EventSource',{value:class extends EventTarget {
   open=()=>this.dispatchEvent(new Event('open'));
   constructor(){super();window.addEventListener('late-first-open',this.open);}
   close(){window.removeEventListener('late-first-open',this.open);}
  }});
 });
 await page.route('**/api/v1/telemetry/state',route=>{requests++;return route.fulfill({json:current});});
 await page.goto('/');await expect(page.getByText('Тестові дані')).toBeVisible();const baseline=requests;
 current={...initial,revision:newer.revision,latest:newer.latest};
 // The publication occurred before subscription and is never replayed to this client.
 await page.evaluate(()=>window.dispatchEvent(new Event('late-first-open')));
 await expect(page.getByRole('img',{name:'Заряд 77 відсотків'})).toBeVisible();expect(requests).toBe(baseline+1);
});
