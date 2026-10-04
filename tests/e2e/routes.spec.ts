import { expect, test, type Page } from '@playwright/test';

type RouteExpectation = {
  path: string;
  heading: string | RegExp;
  exact?: boolean;
};

const publicRoutes: RouteExpectation[] = [
  { path: '/', heading: /Seu espaço de estudo|Bom dia,/ },
  { path: '/login', heading: 'Seu próximo cartão começa aqui.' },
  { path: '/register', heading: 'Aprenda algo hoje.' },
];

const e2eEmail = process.env.E2E_EMAIL;
const e2ePassword = process.env.E2E_PASSWORD;

async function signInTo(page: Page, destination: string) {
  await page.goto(`/login?next=${encodeURIComponent(destination)}`);
  await page.getByLabel('E-mail').fill(e2eEmail!);
  await page.getByLabel('Senha').fill(e2ePassword!);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

test.describe('rotas públicas', () => {
  for (const route of publicRoutes) {
    test(`${route.path} abre sem erro de aplicação`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(route.path);
      await expect(page.getByRole('heading', { name: route.heading, exact: route.exact ?? false })).toBeVisible();
      expect(errors).toEqual([]);
    });
  }
});

test('rota privada envia para login preservando o caminho pedido', async ({ page }) => {
  await page.goto('/decks/new');
  await expect(page).toHaveURL(/\/login\?next=%2Fdecks%2Fnew$/);
  await expect(page.getByRole('heading', { name: 'Seu próximo cartão começa aqui.' })).toBeVisible();
});

test.describe('fluxos autenticados opcionais', () => {
  test.skip(!e2eEmail || !e2ePassword, 'Defina E2E_EMAIL e E2E_PASSWORD para executar estes testes contra o Supabase.');

  test('login retorna para a rota protegida e permite criar deck e card', async ({ page }) => {
    await page.goto('/decks/new');
    await expect(page).toHaveURL(/\/login\?next=%2Fdecks%2Fnew$/);
    await page.getByLabel('E-mail').fill(e2eEmail!);
    await page.getByLabel('Senha').fill(e2ePassword!);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/decks\/new$/);
    await expect(page.getByRole('heading', { name: 'Novo deck' })).toBeVisible();

    const deckName = `Deck E2E ${Date.now()}`;
    await page.getByLabel('Nome do deck').fill(deckName);
    await page.getByLabel('Descrição (opcional)').fill('Criado pela suíte E2E');
    await page.getByRole('button', { name: 'Criar deck' }).click();
    await expect(page.getByRole('heading', { name: 'Gerenciar cards' })).toBeVisible();

    await page.getByLabel('Frente').fill('Qual é o objetivo do teste E2E?');
    await page.getByLabel('Verso').fill('Confirmar persistência de deck, nota e card no Supabase.');
    await page.getByLabel('Tags').fill('e2e supabase');
    await page.getByRole('button', { name: 'Adicionar card' }).click();
    await expect(page.getByRole('status')).toContainText(/Card inserido/);
    await expect(page.getByText('Qual é o objetivo do teste E2E?')).toBeVisible();
  });

  test('ferramentas autenticadas exibem os contratos avançados', async ({ page }) => {
    await signInTo(page, '/tools');
    await expect(page).toHaveURL(/\/tools$/);
    await expect(page.getByRole('heading', { name: 'Buscar nas suas notas' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Criar job de fonte' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Otimização personalizada' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Importar ou exportar/ })).toBeVisible();
  });
});
