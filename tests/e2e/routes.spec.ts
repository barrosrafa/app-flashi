import { expect, test } from '@playwright/test';

type RouteExpectation = {
  path: string;
  heading: string | RegExp;
  exact?: boolean;
};

const routes: RouteExpectation[] = [
  { path: '/', heading: 'Estude um pouco hoje.' },
  { path: '/dashboard', heading: 'Pronto para estudar?' },
  { path: '/decks', heading: 'Meus decks' },
  { path: '/decks/new', heading: 'Novo deck' },
  { path: '/decks/idiomas', heading: 'Deck' },
  { path: '/decks/idiomas/cards', heading: 'Gerenciar cards' },
  { path: '/study/idiomas', heading: 'Sessão de estudo' },
  { path: '/study/demo', heading: 'Sessão de estudo' },
  { path: '/study', heading: 'Estudar' },
  { path: '/exams', heading: 'Metas de estudo', exact: true },
  { path: '/analytics', heading: 'Desempenho' },
  { path: '/profile', heading: 'Seu perfil', exact: true },
  { path: '/profile/learning-plan', heading: 'Sua meta de estudo' },
  { path: '/tools', heading: 'Ferramentas avançadas' },
  { path: '/login', heading: 'Seu próximo cartão começa aqui.' },
  { path: '/register', heading: 'Aprenda algo hoje.' },
  { path: '/onboarding', heading: 'O que você quer aprender?' },
  { path: '/forgot-password', heading: 'Vamos recuperar sua conta.' },
  { path: '/reset-password', heading: 'Escolha uma senha nova.' },
];

test('landing pública entrega metadados, destino de cadastro e SEO técnico', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Flashi/);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /flashcards/i);
  const canonical = new URL((await page.locator('link[rel="canonical"]').getAttribute('href')) ?? '');
  const socialUrl = new URL((await page.locator('meta[property="og:url"]').getAttribute('content')) ?? '');
  expect(socialUrl.origin).toBe(canonical.origin);
  expect(socialUrl.pathname).toBe('/');
  const structuredData = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent()) ?? '{}');
  expect(structuredData).toMatchObject({ '@type': 'SoftwareApplication', name: 'Flashi', inLanguage: 'pt-BR' });
  await expect(page.getByRole('navigation', { name: 'Navegação pública' }).getByRole('link', { name: 'Criar conta' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Testar uma sessão demonstrativa' })).toBeVisible();
  const robots = await page.request.get('/robots.txt');
  expect(robots.ok()).toBeTruthy();
  expect(await robots.text()).toContain('Allow: /');
  expect(await robots.text()).not.toContain('Disallow: /dashboard');
  const sitemap = await page.request.get('/sitemap.xml');
  expect(sitemap.ok()).toBeTruthy();
  expect(await sitemap.text()).toContain(canonical.origin);
});
test('PWA aponta para o app e tem os ícones instaláveis', async ({ page }) => {
  const manifest = await page.request.get('/manifest.webmanifest');
  expect(manifest.ok()).toBeTruthy();
  const value = await manifest.json();
  expect(value.start_url).toBe('/dashboard');
  expect(value.icons).toEqual(expect.arrayContaining([expect.objectContaining({ sizes: '192x192' }), expect.objectContaining({ sizes: '512x512', purpose: 'maskable' })]));
});

test('dropdowns exibem opções nomeadas e mantêm contraste no tema escuro', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('flashi-theme', 'dark'));
  await page.goto('/tools');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#080B14');
  const select = page.getByLabel('Tipo de busca');
  await expect(select).toBeVisible();
  const colors = await select.evaluate((element) => {
    const control = getComputedStyle(element);
    const option = getComputedStyle(element.querySelector('option')!);
    return { background: control.backgroundColor, color: control.color, optionBackground: option.backgroundColor, optionColor: option.color };
  });
  expect(colors).toEqual({
    background: 'rgb(17, 24, 39)',
    color: 'rgb(248, 250, 252)',
    optionBackground: 'rgb(17, 24, 39)',
    optionColor: 'rgb(248, 250, 252)',
  });
  const options = await select.locator('option').allTextContents();
  expect(options.length).toBeGreaterThan(1);
  expect(options.every((label) => label.trim().length > 0)).toBeTruthy();
  await select.selectOption('lexical');
  await expect(select).toHaveValue('lexical');
});

test('seletor de tema é um grupo de rádio navegável por teclado e atualiza a cor do browser', async ({ page }) => {
  await page.goto('/profile');
  const radios = page.getByRole('radio');
  await expect(radios).toHaveCount(3);
  const light = page.getByRole('radio', { name: /Claro/ });
  await light.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: /Escuro/ })).toBeChecked();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#080B14');
});

test('tradução incremental cobre texto e atributos adicionados depois da montagem', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('flashi_locale', 'en'));
  await page.goto('/profile');
  await expect(page.getByRole('heading', { name: 'Your profile' })).toBeVisible();
  await page.evaluate(() => {
    const region = document.createElement('section');
    const message = document.createElement('p');
    message.textContent = 'Esta funcionalidade está desativada.';
    const button = document.createElement('button');
    button.setAttribute('aria-label', 'Tema da interface');
    button.textContent = 'Perfil';
    region.append(message, button);
    document.body.append(region);
  });
  await expect(page.getByText('This feature is disabled.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Interface theme' })).toBeVisible();
});
test.describe('rotas principais', () => {
  for (const route of routes) {
    test(`${route.path} abre sem erro de aplicação`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(route.path);
      await expect(page.getByRole('heading', { name: route.heading, exact: route.exact ?? false })).toBeVisible();
      if (route.path !== '/') await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
      expect(errors).toEqual([]);
    });
  }
});

test('gerenciador de cards exibe o contrato real do Supabase', async ({ page }) => {
  await page.goto('/decks/idiomas/cards');
  await expect(page.getByRole('heading', { name: 'Cards do deck' })).toBeVisible();
  await expect(page.getByLabel('Frente')).toBeVisible();
  await expect(page.getByLabel('Verso')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Adicionar card' })).toBeVisible();
});

test('prévia de estudo completa o fluxo frente, verso e avaliação', async ({ page }) => {
  const backendWrites: string[] = [];
  page.on('request', (request) => {
    if (/\/rest\/v1\/|\/functions\/v1\//.test(request.url()) && ['POST', 'PATCH', 'PUT', 'DELETE'].includes(request.method())) backendWrites.push(`${request.method()} ${new URL(request.url()).pathname}`);
  });
  await page.goto('/study/demo');
  await expect(page.getByRole('heading', { name: 'Sessão de estudo' })).toBeVisible();
  for (let card = 0; card < 3; card += 1) {
    await page.getByRole('button', { name: /Revelar resposta/ }).click();
    await expect(page.getByRole('heading', { name: 'Como foi sua lembrança?' })).toBeVisible();
    await page.getByRole('button', { name: 'Bom', exact: true }).click();
  }
  await expect(page.locator('.study-complete')).toContainText('Você revisou 3 cartões.');
  expect(backendWrites).toEqual([]);
});

test('tela de ferramentas expõe contratos avançados', async ({ page }) => {
  await page.goto('/tools');
  await expect(page.getByRole('heading', { name: 'Buscar nas suas notas' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Criar job de fonte' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Otimização personalizada' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Importar ou exportar/ })).toBeVisible();
});

test('app shell abre offline depois de aquecer o service worker', async ({ browser }) => {
  const context = await browser.newContext({ serviceWorkers: 'allow' });
  const page = await context.newPage();

  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Estude um pouco hoje.' })).toBeVisible();
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Pronto para estudar?' })).toBeVisible();

  await context.setOffline(true);
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Pronto para estudar?' })).toBeVisible();

  await context.setOffline(false);
  await context.close();
});

const e2eEmail = process.env.E2E_EMAIL;
const e2ePassword = process.env.E2E_PASSWORD;

test.describe('fluxo autenticado opcional', () => {
  test.skip(!e2eEmail || !e2ePassword, 'Defina E2E_EMAIL e E2E_PASSWORD para executar mutações reais no Supabase.');

  test('faz login, cria deck e insere card no Supabase', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(e2eEmail!);
    await page.getByLabel('Senha').fill(e2ePassword!);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByRole('heading', { name: 'Pronto para estudar?' })).toBeVisible();

    const deckName = `Deck E2E ${Date.now()}`;
    await page.goto('/decks/new');
    await page.getByLabel('Nome do deck').fill(deckName);
    await page.getByText('Mais opções (descrição e organização)').click();
    await page.getByLabel('Descrição (opcional)').fill('Criado pela suíte E2E e2e');
    await page.getByRole('button', { name: 'Criar deck' }).click();
    await expect(page.getByRole('heading', { name: 'Gerenciar cards' })).toBeVisible();

    await page.getByLabel('Frente').fill('Qual é o objetivo do teste E2E?');
    await page.getByLabel('Verso').fill('Confirmar persistência de deck, note e card no Supabase.');
    await page.getByLabel('Tags').fill('e2e supabase');
    await page.getByRole('button', { name: 'Adicionar card' }).click();
    await expect(page.getByRole('status')).toContainText(/Card inserido/);
    await expect(page.getByText('Qual é o objetivo do teste E2E?')).toBeVisible();
  });
});

test('landing e app não transbordam entre 320 e 1280 px', async ({ page }) => {
  for (const width of [320, 375, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [path, heading] of [['/', 'Estude um pouco hoje.'], ['/dashboard', 'Pronto para estudar?']]) {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: heading })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${path} em ${width}px`).toBeLessThanOrEqual(width);
    }
  }
});

test('navegação móvel mantém cinco destinos principais e revela as opções secundárias', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/dashboard');
  const nav = page.getByRole('navigation', { name: 'Navegação principal' });
  await expect(nav).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await expect(nav.getByRole('link')).toHaveCount(4);
  await page.getByRole('button', { name: 'Mais opções' }).click();
  await expect(page.getByRole('button', { name: 'Fechar menu' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Criar deck' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Perfil', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Mais opções' })).toHaveAttribute('aria-expanded', 'false');
});

const secondaryRoutes = [
  '/import/ai-ingest', '/import/anki', '/export/anki', '/import/deck', '/import/url',
  '/occlusion', '/profile/badges', '/settings/fsrs-optimize', '/tools/mcp',
  '/decks/idiomas/notes', '/decks/idiomas/occlusion/new', '/socratic', '/study/search',
  '/media/demo', '/templates', '/templates/demo', '/socratic/demo', '/leaderboard',
];

test.describe('todas as telas secundárias abrem sem erro fatal', () => {
  for (const route of secondaryRoutes) {
    test(route, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const response = await page.goto(route);
      expect(response?.status() ?? 0).toBeLessThan(500);
      await expect(page.locator('h1').first()).toBeVisible();
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
      expect(errors).toEqual([]);
    });
  }
});

test('controles de autenticação e divulgação avançada funcionam sem submeter dados remotos', async ({ page }) => {
  await page.goto('/login');
  const password = page.getByLabel('Senha');
  await expect(password).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Mostrar senha' }).click();
  await expect(password).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Ocultar senha' }).click();
  await expect(password).toHaveAttribute('type', 'password');
  await page.getByRole('link', { name: 'Esqueci minha senha' }).click();
  await expect(page.getByRole('heading', { name: 'Vamos recuperar sua conta.' })).toBeVisible();
  await page.getByRole('link', { name: 'Voltar para entrar' }).click();
  await expect(page.getByRole('heading', { name: 'Seu próximo cartão começa aqui.' })).toBeVisible();

  await page.goto('/reset-password');
  await page.getByLabel('Nova senha').fill('senha-segura-123');
  await page.getByLabel('Confirmar senha').fill('senha-diferente-456');
  await page.getByRole('button', { name: 'Atualizar senha' }).click();
  await expect(page.locator('p.notice[role="alert"]')).toContainText('As senhas não são iguais');
});

test('formulário simplificado revela campos opcionais somente quando solicitado', async ({ page }) => {
  await page.goto('/decks/new');
  const description = page.getByLabel('Descrição (opcional)');
  await expect(description).toBeHidden();
  await page.getByText('Mais opções (descrição e organização)').click();
  await expect(description).toBeVisible();
});

test('estados sem sessão não sugerem dados zerados nem falsa sessão', async ({ page }) => {
  await page.goto('/dashboard');
  const dashboardNotice = page.locator('.notice[role="alert"]');
  const supabaseConfigured = !(await dashboardNotice.innerText()).includes('Configure a conexão do Supabase');
  if (supabaseConfigured) {
    await expect(dashboardNotice).toContainText('Entre na sua conta para carregar seus indicadores.');
    await expect(page.getByRole('heading', { name: 'Entre para ver sua fila' })).toBeVisible();
    await expect(page.locator('#learning-plan-heading')).toContainText('Entre para acessar sua fila.');
  } else {
    await expect(page.getByRole('heading', { name: 'Conecte seu projeto Supabase' })).toBeVisible();
  }
  await expect(page.getByText('Carregando fila…')).toBeHidden();

  await page.goto('/decks');
  await expect(page.locator('.notice[role="alert"]')).toContainText(supabaseConfigured
    ? 'Entre na sua conta para carregar seus decks.'
    : 'Configure a conexão do Supabase para carregar seus decks.');
  await expect(page.getByRole('heading', { name: 'Sua biblioteca' })).toContainText('—');
  await expect(page.getByText('Sua biblioteca (0)')).toHaveCount(0);

  await page.goto('/profile');
  await expect(page.getByRole('status').getByText(supabaseConfigured
    ? 'Entre na sua conta para editar o perfil.'
    : 'Configure a conexão do Supabase para carregar o perfil.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Guardar preferências|Salvar preferências/ })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Nome de exibição' })).toHaveCount(0);
});
