import { chromium } from 'playwright-core';

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-webgl', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
});
const page = await browser.newPage();
let failures = 0;
await page.route('**/20260820_RondaLobato/lod-meta.json', async route => {
  if (failures++ === 0) await route.fulfill({ status: 403, body: 'blocked' });
  else await route.continue();
});
await page.goto(process.argv[2] ?? 'http://127.0.0.1:5174/');
await page.getByRole('alert').getByText(/HTTP 403/).waitFor({ timeout: 20000 });
await page.getByRole('button', { name: 'Retry loading' }).click();
await page.waitForFunction(() => performance.getEntriesByType('resource').some(entry => entry.name.endsWith('.webp')), { timeout: 60000 });
await page.getByRole('alert').waitFor({ state: 'hidden' });
const visibleButtons = await page.locator('#overlay button:visible').allTextContents();
const report = { firstRequestFailed: failures >= 2, retryLoadedChunk: true, visibleButtons };
console.log(JSON.stringify(report));
await browser.close();
if (!report.firstRequestFailed || visibleButtons.length !== 1 || visibleButtons[0] !== 'Enter VR') process.exitCode = 1;
