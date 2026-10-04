import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const baseURL = process.env.BASE_URL ?? 'http://localhost:3000';
const outputPath = resolve(process.env.QA_OUTPUT ?? 'docs/qa-results-2026-10-04.json');
const routes = [
  '/', '/dashboard', '/login', '/register', '/onboarding', '/forgot-password', '/reset-password',
  '/study', '/study/demo', '/study/idiomas', '/study/search', '/decks', '/decks/new',
  '/decks/idiomas', '/decks/idiomas/cards', '/decks/idiomas/notes', '/decks/idiomas/occlusion/new',
  '/analytics', '/exams', '/profile', '/profile/learning-plan', '/profile/badges', '/tools', '/tools/mcp', '/search',
  '/templates', '/templates/demo', '/import/ai-ingest', '/import/anki', '/import/deck', '/import/url',
  '/export/anki', '/occlusion', '/media/demo', '/socratic', '/socratic/demo', '/settings/fsrs-optimize', '/leaderboard',
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  serviceWorkers: 'block',
});
const page = await context.newPage();
const consoleErrors = [];
const pageErrors = [];
const failedRequests = [];
const cancelledRequests = [];
const httpErrors = [];
const slowRequests = [];
const startedAt = new Map();

page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push({ url: page.url(), text: message.text() });
});
page.on('pageerror', (error) => pageErrors.push({ url: page.url(), text: error.message }));
page.on('request', (request) => startedAt.set(request, Date.now()));
page.on('requestfailed', (request) => {
  const event = {
    url: request.url(),
    method: request.method(),
    error: request.failure()?.errorText ?? 'unknown',
  };
  if (event.error === 'net::ERR_ABORTED' && !request.isNavigationRequest()) cancelledRequests.push(event);
  else failedRequests.push(event);
});
page.on('response', (response) => {
  const request = response.request();
  const elapsedMs = Date.now() - (startedAt.get(request) ?? Date.now());
  if (response.status() >= 400) {
    httpErrors.push({ url: response.url(), method: request.method(), status: response.status() });
  }
  if (elapsedMs > 2000) slowRequests.push({ url: response.url(), method: request.method(), status: response.status(), elapsedMs });
});

const routeResults = [];
for (const route of routes) {
  const started = Date.now();
  let status = null;
  let navigationError = null;
  try {
    const response = await page.goto(new URL(route, baseURL).toString(), {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    status = response?.status() ?? null;
    await page.waitForLoadState('networkidle', { timeout: 2_000 }).catch(() => {});
    await page.waitForTimeout(100);
  } catch (error) {
    navigationError = error instanceof Error ? error.message : String(error);
  }

  const view = await page.evaluate(() => {
    const visible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    };
    return {
      title: document.title,
      h1: [...document.querySelectorAll('h1')].filter(visible).map((node) => node.textContent?.trim() ?? ''),
      viewportWidth: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      theme: document.documentElement.dataset.theme ?? null,
    };
  }).catch(() => ({ title: '', h1: [], viewportWidth: 0, documentWidth: 0, theme: null }));

  routeResults.push({
    route,
    status,
    navigationError,
    elapsedMs: Date.now() - started,
    ...view,
    horizontalOverflow: view.documentWidth > view.viewportWidth + 1,
  });
  console.log(`${status ?? 'ERR'} ${route} (${Date.now() - started} ms)${navigationError ? ` — ${navigationError}` : ''}`);
}

await browser.close();
const report = {
  generatedAt: new Date().toISOString(),
  baseURL,
  browser: 'Playwright Chromium',
  viewport: { width: 1280, height: 900 },
  thresholds: { slowRequestMs: 2000 },
  totals: {
    routes: routeResults.length,
    navigationFailures: routeResults.filter((result) => result.navigationError).length,
    routeResponsesOutside2xx: routeResults.filter((result) => result.status !== null && (result.status < 200 || result.status >= 300)).length,
    consoleErrors: consoleErrors.length,
    pageErrors: pageErrors.length,
    failedRequests: failedRequests.length,
    cancelledRequests: cancelledRequests.length,
    httpErrors: httpErrors.length,
    slowRequests: slowRequests.length,
    horizontalOverflows: routeResults.filter((result) => result.horizontalOverflow).length,
  },
  routes: routeResults,
  telemetry: { consoleErrors, pageErrors, failedRequests, cancelledRequests, httpErrors, slowRequests },
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`\nResumo: ${JSON.stringify(report.totals)}`);
console.log(`Relatório JSON: ${outputPath}`);
const failed = report.totals.navigationFailures > 0 || report.totals.routeResponsesOutside2xx > 0 ||
  report.totals.consoleErrors > 0 || report.totals.pageErrors > 0 || report.totals.failedRequests > 0 ||
  report.totals.httpErrors > 0 || report.totals.slowRequests > 0 || report.totals.horizontalOverflows > 0;
if (failed) process.exitCode = 1;
