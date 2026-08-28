import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const baseURL = 'http://localhost:3000';
const routes = [
  { name: 'decks', path: '/decks' },
  { name: 'decks-new', path: '/decks/new' },
  { name: 'deck-detail', path: '/decks/idiomas' },
  { name: 'deck-cards', path: '/decks/idiomas/cards' },
  { name: 'study', path: '/study/demo' },
  { name: 'exams', path: '/exams' },
  { name: 'analytics', path: '/analytics' },
  { name: 'profile', path: '/profile' },
  { name: 'login', path: '/login' },
  { name: 'register', path: '/register' },
  { name: 'manifest', path: '/manifest.webmanifest' },
];
const viewports = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'mobile', width: 390, height: 844 },
];
const outputDir = 'artifacts/screens';
await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];

for (const viewport of viewports) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const route of routes) {
    const errors = [];
    page.removeAllListeners('pageerror');
    page.on('pageerror', (error) => errors.push(error.message));
    const output = `${outputDir}/${viewport.name}-${route.name}.png`;
    try {
      const response = await page.goto(`${baseURL}${route.path}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(180);
      await page.screenshot({ path: output, fullPage: true });
      results.push({ viewport: viewport.name, route: route.path, status: response?.status() ?? 0, output, errors });
      console.log(`${viewport.name} ${route.path} -> ${response?.status() ?? 0} ${output}`);
    } catch (error) {
      results.push({ viewport: viewport.name, route: route.path, status: 0, output, errors: [String(error)] });
      console.error(`${viewport.name} ${route.path} -> failed: ${String(error)}`);
    }
  }
  await page.close();
}

await writeFile(`${outputDir}/manifest.json`, JSON.stringify(results, null, 2));
await browser.close();
if (results.some((result) => result.status >= 500 || result.status === 0 || result.errors.length)) process.exit(1);
