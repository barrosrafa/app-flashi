import { chromium } from '@playwright/test';

const routes = ['/', '/decks', '/decks/new', '/decks/idiomas', '/decks/idiomas/cards', '/study/idiomas', '/study/demo', '/exams', '/analytics', '/profile', '/tools', '/login', '/register'];
const viewports = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 375, height: 812 },
];
const browser = await chromium.launch({ headless: true });
const errors = [];

for (const viewport of viewports) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
  await context.grantPermissions([]);
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  page.on('pageerror', (error) => errors.push(`${viewport.name} ${page.url()} :: ${error.message}`));

  for (const route of routes) {
    await page.goto(`http://localhost:3000${route}`, { waitUntil: 'domcontentloaded', timeout: 15_000 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    if (overflow) errors.push(`${viewport.name} ${route} :: horizontal overflow`);

    const links = await page.locator('a:visible').evaluateAll((nodes) => nodes.map((node) => ({ text: node.textContent?.trim() || 'link', href: node.getAttribute('href') })));
    for (const link of links) {
      if (!link.href || link.href.startsWith('#')) continue;
      const target = new URL(link.href, page.url());
      if (target.origin === 'http://localhost:3000') await page.goto(target.href, { waitUntil: 'domcontentloaded', timeout: 15_000 });
    }

    await page.goto(`http://localhost:3000${route}`, { waitUntil: 'domcontentloaded', timeout: 15_000 });
    const buttons = await page.locator('button:visible').evaluateAll((nodes) => nodes.map((node) => ({ label: node.textContent?.trim() || 'button', width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })));
    for (const button of buttons) {
      if (button.width < 40 || button.height < 40) errors.push(`${viewport.name} ${route} :: small button ${button.label}`);
      const locator = page.getByRole('button', { name: button.label, exact: true }).first();
      if (await locator.count() && await locator.isEnabled()) {
        await locator.click({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(100);
      }
    }
    console.log(`${viewport.name} ${route}: ${links.length} links, ${buttons.length} buttons checked`);
  }
  await context.close();
}

await browser.close();
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
