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
  { name: 'narrow-mobile', width: 320, height: 720 },
];
const themes = ['light', 'dark'];
const safeButtons = [
  /^Mais opções$/, /^Fechar menu$/, /^Mostrar senha$/, /^Ocultar senha$/,
  /^More options$/, /^Close menu$/, /^Show password$/, /^Hide password$/,
];
const browser = await chromium.launch({ headless: true });
const findings = [];
let controlChecks = 0;
let selectChecks = 0;
let textChecks = 0;

for (const theme of themes) {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
    await context.addInitScript((value) => localStorage.setItem('flashi-theme', value), theme);
    const page = await context.newPage();
    await page.emulateMedia({ reducedMotion: 'reduce' });

    for (const route of routes) {
      const label = `${theme}/${viewport.name} ${route}`;
      const runtimeErrors = [];
      page.removeAllListeners('pageerror');
      page.on('pageerror', (error) => runtimeErrors.push(error.message));
      let response;
      try {
        response = await page.goto(`${baseURL}${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(100);
      } catch (error) {
        findings.push(`${label}: navegação falhou (${error instanceof Error ? error.message : String(error)})`);
        continue;
      }
      if (!response || response.status() >= 500) findings.push(`${label}: HTTP ${response?.status() ?? 0}`);
      if (runtimeErrors.length) findings.push(`${label}: erro JavaScript ${runtimeErrors.join('; ')}`);

      const layout = await page.evaluate(() => {
        const visible = (element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
        };
        const headings = [...document.querySelectorAll('h1')].filter(visible).map((node) => node.textContent?.trim() ?? '');
        const clips = [...document.querySelectorAll('h1,h2,h3,label,button,a,summary,legend,.pill,.status-text')]
          .filter((node) => visible(node) && !node.classList.contains('sr-only'))
          .flatMap((node) => {
            const style = getComputedStyle(node);
            const text = node.textContent?.trim() ?? '';
            const clipped = node.scrollWidth > node.clientWidth + 3 && (
              style.overflowX === 'hidden' || style.overflowX === 'clip' ||
              style.whiteSpace === 'nowrap' || style.textOverflow === 'ellipsis'
            );
            return clipped && text ? [{ text: text.slice(0, 70), width: node.clientWidth, scroll: node.scrollWidth }] : [];
          });
        return {
          viewport: innerWidth,
          documentWidth: document.documentElement.scrollWidth,
          theme: document.documentElement.dataset.theme,
          headings,
          clips,
        };
      });
      if (layout.documentWidth > layout.viewport + 1) findings.push(`${label}: overflow horizontal ${layout.documentWidth}/${layout.viewport}`);
      if (layout.theme !== theme) findings.push(`${label}: tema resolvido ${layout.theme || '(ausente)'}, esperado ${theme}`);
      if (!layout.headings.length || layout.headings.some((heading) => !heading)) findings.push(`${label}: tela sem h1 visível/nomeado`);
      for (const clip of layout.clips) findings.push(`${label}: texto cortado "${clip.text}" (${clip.scroll}px em ${clip.width}px)`);
      textChecks += layout.headings.length;

      const controls = await page.locator('a:visible,button:visible:not([aria-label="Open Next.js Dev Tools"]),input:visible,select:visible,textarea:visible,summary:visible').evaluateAll((nodes) => nodes.map((node) => {
        const rect = node.getBoundingClientRect();
        const tag = node.tagName.toLowerCase();
        const formControl = ['input', 'select', 'textarea'].includes(tag) && !['hidden', 'submit', 'button', 'image'].includes(node.type || '');
        const associatedLabels = node.labels ? [...node.labels].map((label) => label.textContent?.trim() ?? '').filter(Boolean) : [];
        const accessibleName = node.getAttribute('aria-label') || node.getAttribute('aria-labelledby') || node.getAttribute('title') || associatedLabels.join(' ') || node.closest('label')?.textContent?.trim() || node.textContent?.trim() || '';
        return {
          tag,
          type: node.type || '',
          name: accessibleName.trim(),
          width: rect.width,
          height: rect.height,
          skip: node.classList.contains('skip-link'),
          formControl,
        };
      }));
      for (const control of controls) {
        if (['a', 'button'].includes(control.tag) && !control.name) findings.push(`${label}: ${control.tag} sem nome acessível`);
        if (control.formControl && !control.name) findings.push(`${label}: ${control.tag} sem rótulo acessível`);
        if (['a', 'button'].includes(control.tag) && !control.skip && (control.width < 44 || control.height < 44)) {
          findings.push(`${label}: alvo pequeno ${control.tag} "${control.name}" (${Math.round(control.width)}x${Math.round(control.height)})`);
        }
        controlChecks += 1;
      }

      const selects = await page.locator('select:visible').evaluateAll((nodes) => nodes.map((node) => {
        const style = getComputedStyle(node);
        const options = [...node.options].map((option) => ({ label: option.textContent?.trim() ?? '', disabled: option.disabled }));
        const accessibleName = node.getAttribute('aria-label') || node.getAttribute('aria-labelledby') || [...(node.labels ?? [])].map((label) => label.textContent?.trim() ?? '').join(' ').trim();
        return { accessibleName, background: style.backgroundColor, color: style.color, options };
      }));
      for (const [selectIndex, select] of selects.entries()) {
        if (!select.accessibleName) findings.push(`${label}: dropdown sem rótulo acessível`);
        if (!select.options.length) findings.push(`${label}: dropdown sem opções`);
        if (select.options.some((option) => !option.label)) findings.push(`${label}: dropdown com opção sem texto`);
        if (select.options.length) {
          const option = await page.locator('select:visible').nth(selectIndex).locator('option').first().evaluate((node) => {
            const style = getComputedStyle(node);
            return { background: style.backgroundColor, color: style.color };
          }).catch(() => ({ background: '', color: '' }));
          if (select.background === 'rgba(0, 0, 0, 0)' || !select.color) findings.push(`${label}: dropdown sem cores resolvidas`);
          if (!option.color || option.color === 'rgba(0, 0, 0, 0)') findings.push(`${label}: texto da lista do dropdown sem cor explícita`);
        }
        selectChecks += 1;
      }

      for (const name of safeButtons) {
        const button = page.getByRole('button', { name }).first();
        if (await button.count() && await button.isVisible() && await button.isEnabled()) {
          await button.click({ timeout: 3000 }).catch(() => {});
          controlChecks += 1;
        }
      }
      if (await page.getByRole('button', { name: /Mais opções|More options/ }).count()) {
        await page.keyboard.press('Escape');
      }
      const summary = page.locator('details > summary:visible').first();
      if (await summary.count()) { await summary.click().catch(() => {}); controlChecks += 1; }
      console.log(`${label}: ${controls.length} controles, ${selects.length} dropdowns, ${layout.headings.length} h1`);
    }
    await context.close();
  }
}

await browser.close();
console.log(`Inspecionados ${routes.length} rotas em ${viewports.length} larguras e ${themes.length} temas; ${controlChecks} verificações de controles, ${selectChecks} dropdowns e ${textChecks} títulos.`);
if (findings.length) {
  console.error(`${findings.length} achados:\n${findings.join('\n')}`);
  process.exit(1);
}
console.log('Smoke UI concluído sem overflow, erros JS, controles sem nome, dropdowns sem texto ou alvos menores que 44px.');
