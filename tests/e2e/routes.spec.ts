import { expect, test } from '@playwright/test';

type RouteExpectation = {
  path: string;
  heading: string | RegExp;
  exact?: boolean;
};

const routes: RouteExpectation[] = [
  { path: '/', heading: /Seu espaço de estudo|Bom dia,/ },
  { path: '/decks', heading: 'Meus decks' },
  { path: '/decks/new', heading: 'Novo deck' },
  { path: '/decks/idiomas', heading: 'Inglês para concursos' },
  { path: '/decks/idiomas/cards', heading: 'Gerenciar cards' },
  { path: '/study/idiomas', heading: 'Sessão de estudo' },
  { path: '/study/demo', heading: 'Sessão de estudo' },
  { path: '/exams', heading: 'Exames', exact: true },
  { path: '/analytics', heading: 'Desempenho' },
  { path: '/profile', heading: 'Seu perfil', exact: true },
  { path: '/tools', heading: 'Ferramentas avançadas' },
  { path: '/login', heading: 'Seu próximo cartão começa aqui.' },
  { path: '/register', heading: 'Aprenda algo hoje.' },
];

test.describe('rotas principais', () => {
  for (const route of routes) {
    test(`${route.path} abre sem erro de aplicação`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(route.path);
      await expect(page.getByRole('heading', { name: route.heading, exact: route.exact ?? false })).toBeVisible();
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
  await page.goto('/study/demo');
  await expect(page.getByRole('heading', { name: 'Sessão de estudo' })).toBeVisible();
  await page.getByRole('button', { name: /Revelar resposta/ }).click();
  await expect(page.getByRole('heading', { name: 'Como foi sua lembrança?' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Bom, próxima revisão/ })).toBeVisible();
  await page.getByRole('button', { name: /Bom, próxima revisão/ }).click();
  await expect(page.getByRole('status')).toContainText('Sessão concluída');
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
  await expect(page.getByRole('heading', { name: /Seu espaço de estudo|Bom dia,/ })).toBeVisible();

  await context.setOffline(true);
  await page.goto('/decks');
  await expect(page.getByRole('heading', { name: 'Meus decks' })).toBeVisible();

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
    await expect(page.getByRole('heading', { name: /Seu espaço de estudo|Bom dia,/ })).toBeVisible();

    const deckName = `Deck E2E ${Date.now()}`;
    await page.goto('/decks/new');
    await page.getByLabel('Nome do deck').fill(deckName);
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
