# Auditoria UX/UI — Flashi: correções, testes e pendências

**Data:** 3 de outubro de 2026
**Escopo:** recomendações do arquivo enviado pelo usuário, implementadas e revisitadas no repositório `barrosrafa/app-flashi`.

## Correções concluídas

### Navegação, prioridade e fluxo de estudo

- `/` é uma landing pública; o painel autenticado está em `/dashboard`. A navegação desktop foi agrupada e, no mobile, os destinos mais usados ficam na barra inferior, com os demais em **Mais**; o menu fecha com Esc.
- O dashboard prioriza a fila real do agendador, sem ordenar decks apenas pela quantidade de cards. Para visitantes, explica que é necessário entrar e não mantém o texto de fila em carregamento após a resposta de autenticação.
- A biblioteca não apresenta um falso total zero quando ainda não há sessão; detalhes do deck explicam o bloqueio de acesso.
- O fluxo de estudo exibe ajuda de teclado condizente com as teclas implementadas, não promete intervalos fixos e oferece retorno ao painel.
- O perfil não expõe nem grava preferências padrão enquanto os dados autenticados não carregam; a aparência local continua disponível sem login.

### Acessibilidade, consistência e adaptação

- A identidade e os tokens de cor foram reconciliados com o visual índigo/violeta existente; labels de campos usam agora o token semântico de texto secundário, corrigindo contraste insuficiente observado nas capturas.
- Links de navegação, autenticação e ações receberam alvos mínimos de 44 px; navegação por teclado, foco visível, preferências de movimento reduzido, safe area e layout responsivo foram verificados.
- Tabelas refluem para cards em telas estreitas; tags, referências e ajustes avançados ficam progressivamente disponíveis.
- Referências de notes usam seleção por título, em vez de pedir UUID.
- Login/cadastro usam mensagens de erro compreensíveis, mostrar/ocultar senha e recuperação/redefinição de senha.
- Analytics tem uma tabela equivalente ao gráfico e compara períodos apenas quando existem dados comparáveis.

### PWA, SEO e documentação

- Manifest declara ícones SVG/PNG, PNG maskable e Apple Touch Icon; instalação aponta para `/dashboard`.
- `NEXT_PUBLIC_SITE_URL` foi configurada para o preview temporário em `.env.local` (arquivo ignorado pelo Git). Canonical, `og:url`, `robots.txt` e sitemap foram verificados contra essa origem.
- README e manual de usuário foram revisados; 71 capturas WebP — 35 desktop e 36 mobile — foram atualizadas. As 27 imagens referenciadas pelo manual existem.

## Pendência externa

O painel do projeto Supabase (`fchpvgfjjxjpxfmtsrnc`) redirecionou à tela de login, portanto a allowlist não pôde ser alterada sem autenticação manual do usuário. Após o login, adicionar somente este redirect exato em **Authentication → URL Configuration → Redirect URLs**, preservando o Site URL atual:

`https://3000-ik8vzmehknd3zd7uofzc3-0e9dd9ad.us1.manus.computer/reset-password`

A origem do preview é temporária e não deve ser usada em produção. Antes de publicar, substituir `NEXT_PUBLIC_SITE_URL` pela URL HTTPS estável da aplicação e incluir o respectivo `/reset-password` na allowlist.

## Validação executada

- `pnpm typecheck` — passou.
- `pnpm test` — 27 testes passaram em 8 arquivos.
- `pnpm build` — passou; 33 rotas estáticas geradas e rotas dinâmicas compiladas.
- `pnpm test:e2e` — 46 passaram; 1 teste autenticado foi ignorado por não haver credenciais de homologação.
- `pnpm smoke:ui` — 1.654 controles visíveis em 36 rotas, em desktop, tablet e mobile; sem alvos pequenos ou overflow detectado.
- `pnpm screenshots` — 71 capturas, todas com HTTP 200 e sem erros registrados.
- `git diff --check` — passou.

Os testes não submetem cadastro, recuperação, upload ou gravação remota. O teste E2E autenticado exige `E2E_EMAIL` e `E2E_PASSWORD`; nenhuma conta ou dado remoto foi alterado nesta rodada.

## O que permanece fora do escopo

Conteúdo público indexável além da landing, onboarding guiado completo, migração abrangente de strings antigas para i18n, convite de colaboradores por e-mail com resolução segura de identidade e refatoração integral das regras históricas de CSS continuam como próximos incrementos. Também não foi feita validação manual com leitor de tela nem teste de persistência com uma conta autenticada de homologação.
