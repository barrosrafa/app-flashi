import { chromium } from '@playwright/test';

const routes = ['/', '/decks', '/decks/new', '/decks/idiomas', '/decks/idiomas/cards', '/study/idiomas', '/exams', '/analytics', '/profile', '/tools', '/login', '/register'];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(`${page.url()} :: ${error.message}`));

for (const route of routes) {
  await page.goto(`http://localhost:3000${route}`, { waitUntil: 'networkidle' });
  const links = await page.locator('a:visible').evaluateAll((nodes) => nodes.map((node) => ({ text: node.textContent?.trim() || 'link', href: node.getAttribute('href') })));
  for (const link of links) {
    if (!link.href || link.href.startsWith('#')) continue;
    const target = new URL(link.href, page.url());
    if (target.origin === 'http://localhost:3000') {
      await page.goto(target.href, { waitUntil: 'networkidle' });
    }
  }
  await page.goto(`http://localhost:3000${route}`, { waitUntil: 'networkidle' });
  const buttons = await page.locator('button:visible').evaluateAll((nodes) => nodes.map((node) => node.textContent?.trim() || 'button'));
  for (const label of buttons) {
    const button = page.getByRole('button', { name: label, exact: true }).first();
    if (await button.count() && await button.isEnabled()) {
      await button.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(100);
    }
  }
  console.log(`${route}: ${links.length} links, ${buttons.length} buttons checked`);
}

await browser.close();
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
