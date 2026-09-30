import { chromium } from 'playwright-core';

const url = process.argv[2] ?? 'http://127.0.0.1:5174/';
const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-webgl', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const requests = [];
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('requestfailed', request => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
page.on('response', response => {
  if (response.url().includes('/20260820_RondaLobato/')) requests.push({ url: response.url(), status: response.status() });
});
await page.goto(url);
try {
  await page.locator('[role="status"]').getByText(/Scene ready/).waitFor({ timeout: 60000 });
} catch {
  // Include current status and request details in the report.
}
const status = await page.locator('[role="status"]').textContent();
await page.screenshot({ path: '.context/local-prototype.png' });
await page.keyboard.down('w');
await page.waitForTimeout(5500);
await page.keyboard.up('w');
await page.screenshot({ path: '.context/local-prototype-walk.png' });
await page.getByRole('button', { name: 'Reset view' }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: '.context/local-prototype-reset.png' });
await page.locator('#view').click({ position: { x: 640, y: 360 } });
await page.waitForTimeout(100);
const pointerLocked = await page.evaluate(() => document.pointerLockElement?.id === 'view');
await page.keyboard.press('Escape');
await page.waitForTimeout(100);
const pointerReleased = await page.evaluate(() => document.pointerLockElement === null);
const report = {
  url,
  status,
  manifest: requests.some(item => item.url.endsWith('/lod-meta.json') && item.status === 200),
  chunk: requests.some(item => item.url.endsWith('.webp') && item.status === 200),
  requests: requests.length,
  pointerLocked,
  pointerReleased,
  errors,
};
console.log(JSON.stringify(report, null, 2));
await browser.close();
if (!report.manifest || !report.chunk || errors.length || !status?.includes('Scene ready') || !pointerLocked || !pointerReleased) process.exitCode = 1;
