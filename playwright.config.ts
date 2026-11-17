import { defineConfig } from '@playwright/test';
export default defineConfig({
 testDir: './e2e', fullyParallel: false, workers: 1, retries: 0, reporter: 'list',
 use: { baseURL: 'http://frontend:5173', headless: true },
 projects: [
  { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
  { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  { name: 'small-mobile', use: { viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true } },
 ],
});
