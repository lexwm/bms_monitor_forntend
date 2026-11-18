import { test, expect } from '@playwright/test';
import { validateState } from '../src/api/validation';
test('real backend JSON renders, with no overflow or browser errors', async ({ page }) => {
 const errors: string[] = [];
 page.on('pageerror', error => errors.push(error.message));
 await page.goto('/');
 await expect(page.getByText('Тестові дані')).toBeVisible();
 await expect(page.getByRole('img', { name: 'Заряд 58 відсотків' })).toBeVisible();
 await expect(page.getByTestId('power-value')).toContainText('-330');
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
 expect(errors).toEqual([]);
});
test('invalid JSON cannot become a displayed battery reading', async ({ page }) => {
 await page.route('**/api/v1/telemetry/state', async route => {
  const original = await route.fetch(); const data: unknown = await original.json();
  if (!validateState(data)) throw new Error('Expected real latest source');
  await route.fulfill({ response: original, json: { ...data, revision: '0' } });
 });
 await page.goto('/');
 await expect(page.getByRole('status')).toContainText('Сервер надіслав дані в непідтримуваному форматі');
 await expect(page.getByRole('img', { name: 'Заряд 58 відсотків' })).toHaveCount(0);
});
test('503 is explicit and recovery uses the validated response', async ({ page }) => {
 let unavailable = true;
 await page.route('**/api/v1/telemetry/state', async route => {
  if (unavailable) await route.fulfill({ status: 503, contentType: 'application/json', json: { error: { code: 'database_unavailable', message: 'Unavailable' } } });
  else await route.continue();
 });
 await page.goto('/');
 await expect(page.getByRole('status')).toContainText('База даних недоступна');
 unavailable = false;
 await expect(page.getByText('Тестові дані')).toBeVisible({ timeout: 10000 });
});

test('healthy stream does not poll API every five seconds', async ({page})=>{
 let snapshots=0;let latest=0;
 page.on('request',request=>{if(request.url().includes('/api/v1/telemetry/state'))snapshots++;if(request.url().includes('/api/v1/battery/latest'))latest++;});
 await page.goto('/');await expect(page.getByText('Тестові дані')).toBeVisible();
 await page.waitForTimeout(1000);const baseline=snapshots;
 await page.waitForTimeout(6000);expect(snapshots).toBe(baseline);expect(latest).toBe(0);
});
test('replayed and reordered events cannot freshen or roll back readings', async ({page,request})=>{
 const response=await request.get('/api/v1/telemetry/state');const initial: unknown=await response.json();
 if(!validateState(initial)||initial.latest===null||initial.latest.battery===null)throw new Error('Expected fixture');
 await page.addInitScript(()=>{
  Object.defineProperty(window,'EventSource',{value:class extends EventTarget {
   listener=(e: Event)=>{if(e instanceof CustomEvent && typeof e.detail==='string')this.dispatchEvent(new MessageEvent('telemetry.updated.v1',{data:e.detail}));};
   constructor(){super();window.addEventListener('test-stream',this.listener);}
   close(){window.removeEventListener('test-stream',this.listener);}
  }});
 });
 await page.goto('/');await expect(page.getByText('Тестові дані')).toBeVisible();
 const event={schema:1,revision:initial.revision+1,server_time:initial.server_time,history_changed:true,latest:{...initial.latest,revision:initial.revision+1,received_at:new Date(Date.now()-60000).toISOString(),battery:{...initial.latest.battery,soc_percent:77}}};
 await page.evaluate(data=>window.dispatchEvent(new CustomEvent('test-stream',{detail:JSON.stringify(data)})),event);
 await expect(page.getByRole('img',{name:'Заряд 77 відсотків'})).toBeVisible();
 await expect(page.getByRole('status')).toContainText('Немає нових вимірювань');
 await page.evaluate(data=>window.dispatchEvent(new CustomEvent('test-stream',{detail:JSON.stringify(data)})),{...event,revision:initial.revision,latest:{...initial.latest,battery:{...initial.latest.battery,soc_percent:22}}});
 await expect(page.getByRole('img',{name:'Заряд 77 відсотків'})).toBeVisible();
});
