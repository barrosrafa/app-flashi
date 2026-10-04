import { chromium } from '@playwright/test';

const baseURL = process.env.BASE_URL ?? 'http://localhost:3000';
const routes = [
  '/', '/dashboard', '/login', '/register', '/forgot-password', '/reset-password',
  '/study', '/study/demo', '/study/idiomas', '/study/search', '/decks', '/decks/new',
  '/decks/idiomas', '/decks/idiomas/cards', '/decks/idiomas/notes', '/decks/idiomas/occlusion/new',
  '/analytics', '/exams', '/profile', '/profile/badges', '/tools', '/tools/mcp', '/search',
  '/templates', '/templates/demo', '/import/ai-ingest', '/import/anki', '/import/deck', '/import/url',
  '/export/anki', '/occlusion', '/media/demo', '/socratic', '/socratic/demo',
  '/settings/fsrs-optimize', '/leaderboard',
];
const viewports = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 375, height: 812 },
];
const safeButtonNames = [/^Mais opções$/, /^Fechar menu$/, /^Mostrar senha$/, /^Ocultar senha$/, /^Claro$/, /^Escuro$/, /^Sistema$/];
const browser = await chromium.launch({ headless: true });
const findings = [];
let checks = 0;

for (const viewport of viewports) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const route of routes) {
    const runtimeErrors = [];
    page.removeAllListeners('pageerror');
    page.on('pageerror', (error) => runtimeErrors.push(error.message));
    const response = await page.goto(`${baseURL}${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(120);
    const errors = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth }));
    if (!response || response.status() >= 500) findings.push(`${viewport.name} ${route}: HTTP ${response?.status() ?? 0}`);
    if (errors.width > errors.viewport + 1) findings.push(`${viewport.name} ${route}: horizontal overflow ${errors.width}/${errors.viewport}`);
    if (runtimeErrors.length) findings.push(`${viewport.name} ${route}: ${runtimeErrors.join('; ')}`);
    const controls = await page.locator('a:visible,button:visible,input:visible,select:visible,textarea:visible,summary:visible').evaluateAll((nodes) => nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      return { tag: node.tagName.toLowerCase(), text: (node.textContent || '').trim(), label: node.getAttribute('aria-label') || node.getAttribute('title') || '', width: rect.width, height: rect.height, skip: node.classList.contains('skip-link') };
    }));
    for (const control of controls) {
      if (['a', 'button'].includes(control.tag) && !control.text && !control.label) findings.push(`${viewport.name} ${route}: unnamed ${control.tag}`);
      if (['a', 'button'].includes(control.tag) && !control.skip && (control.width < 44 || control.height < 44)) findings.push(`${viewport.name} ${route}: small ${control.tag} ${control.text || control.label} (${Math.round(control.width)}x${Math.round(control.height)})`);
      checks += 1;
    }
    for (const name of safeButtonNames) {
      const button = page.getByRole('button', { name }).first();
      if (await button.count() && await button.isVisible() && await button.isEnabled()) {
        await button.click({ timeout: 3000 }).catch(() => {});
        checks += 1;
      }
    }
    const summary = page.locator('details > summary:visible').first();
    if (await summary.count()) { await summary.click().catch(() => {}); checks += 1; }
    console.log(`${viewport.name} ${route}: ${controls.length} controls inspected`);
  }
  await context.close();
}
await browser.close();
console.log(`Inspected ${checks} visible controls across ${routes.length} routes and ${viewports.length} viewports.`);
if (findings.length) {
  console.error(findings.join('\n'));
  process.exit(1);
}
