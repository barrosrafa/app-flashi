import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const baseURL = process.env.BASE_URL ?? 'http://localhost:3000';
const routes = [
  { name: '01-visao-geral', path: '/dashboard' },
  { name: '02-meus-decks', path: '/decks' },
  { name: '03-estudo-inicial', path: '/study' },
  { name: '04-desempenho', path: '/analytics' },
  { name: '05-ferramentas', path: '/tools' },
  { name: '06-perfil', path: '/profile' },
  { name: '07-templates-desativado', path: '/templates' },
  { name: '08-ingestao-desativada', path: '/import/ai-ingest' },
  { name: '09-busca', path: '/search' },
  { name: '10-login', path: '/login' },
  { name: '11-cadastro', path: '/register' },
  { name: '12-novo-deck', path: '/decks/new' },
  { name: '13-importar-anki-desativado', path: '/import/anki' },
  { name: '14-exportar-anki-desativado', path: '/export/anki' },
  { name: '15-importar-url', path: '/import/url' },
  { name: '16-oclusao-desativada', path: '/occlusion' },
  { name: '17-conquistas-desativada', path: '/profile/badges' },
  { name: '18-fsrs-desativado', path: '/settings/fsrs-optimize' },
  { name: '19-mcp', path: '/tools/mcp' },
  { name: '20-detalhe-deck', path: '/decks/idiomas' },
  { name: '21-gerenciar-cards', path: '/decks/idiomas/cards' },
  { name: '22-gerenciar-notes', path: '/decks/idiomas/notes' },
  { name: '23-nova-oclusao', path: '/decks/idiomas/occlusion/new' },
  { name: '24-sessoes-socraticas', path: '/socratic' },
  { name: '25-busca-estudo', path: '/study/search' },
  { name: '26-media-desativada', path: '/media/demo' },
  { name: '27-detalhe-template', path: '/templates/demo' },
  { name: '28-detalhe-socratico', path: '/socratic/demo' },
  { name: '29-estudo-sem-cards', path: '/study/idiomas' },
  { name: '30-estudo-demo', path: '/study/demo' },
  { name: '31-estudo-resposta-e-avaliacao', path: '/study/demo', state: 'revealed' },
  { name: '32-landing-publica', path: '/' },
  { name: '33-recuperacao-senha', path: '/forgot-password' },
  { name: '34-nova-senha', path: '/reset-password' },
  { name: '35-mais-opcoes-mobile', path: '/dashboard', state: 'more' },
  { name: '36-opcoes-avancadas-deck', path: '/decks/new', state: 'deck-options' },
];
const viewports = [
  { name: 'desktop', width: 1440, height: 1000, outDir: 'docs' },
  { name: 'mobile', width: 390, height: 844, outDir: 'docs/screenshots/mobile' },
];
const manifest = [];
const browser = await chromium.launch({ headless: true });

async function prepareState(page, state) {
  if (state === 'revealed') {
    await page.getByRole('button', { name: /Revelar resposta/ }).click();
    await page.getByRole('heading', { name: 'Como foi sua lembrança?' }).waitFor();
  } else if (state === 'more') {
    await page.getByRole('button', { name: 'Mais opções' }).click();
    await page.getByRole('button', { name: 'Fechar menu' }).waitFor();
  } else if (state === 'deck-options') {
    await page.getByText('Mais opções (descrição e organização)').click();
    await page.getByLabel('Descrição (opcional)').waitFor();
  }
}

for (const viewport of viewports) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, colorScheme: 'light' });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mkdir(viewport.outDir, { recursive: true });
  for (const route of routes) {
    if (route.state === 'more' && viewport.name !== 'mobile') continue;
    const errors = [];
    page.removeAllListeners('pageerror');
    page.on('pageerror', (error) => errors.push(error.message));
    const response = await page.goto(`${baseURL}${route.path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(350);
    if (route.state) await prepareState(page, route.state);
    const pngPath = path.join('/tmp', `flashi-${viewport.name}-${route.name}.png`);
    const webpPath = path.join(viewport.outDir, `${route.name}.webp`);
    await page.screenshot({ path: pngPath, fullPage: true, animations: 'disabled', caret: 'hide' });
    const converted = spawnSync('python3', ['-c', 'from PIL import Image; import sys; Image.open(sys.argv[1]).convert("RGB").save(sys.argv[2], "WEBP", quality=82, method=6)', pngPath, webpPath], { encoding: 'utf8' });
    if (converted.status !== 0) throw new Error(`WebP conversion failed for ${route.path}: ${converted.stderr}`);
    const heading = await page.locator('h1').first().textContent().catch(() => '');
    const item = { viewport: viewport.name, route: route.path, state: route.state ?? 'default', status: response?.status() ?? 0, heading: heading?.trim() ?? '', screenshot: webpPath, errors };
    manifest.push(item);
    console.log(`${viewport.name} ${route.path} (${item.state}) -> ${item.status} ${webpPath}`);
  }
  await context.close();
}
await mkdir('docs/screenshots', { recursive: true });
await writeFile('docs/screenshots/capture-manifest.json', JSON.stringify({ capturedAt: new Date().toISOString(), baseURL, results: manifest }, null, 2));
await browser.close();
if (manifest.some((item) => item.status >= 500 || item.status === 0 || item.errors.length)) process.exit(1);
