# Redesign visual completo — Flashi Aurora

## Direção visual

Todas as telas receberam uma camada visual unificada com linguagem **futurista, arredondada e orientada a produto**. A base usa fundo navy profundo com halos de luz violetas e mint, superfícies elevadas com bordas azuladas, raios entre 14px e 28px, CTAs violetas com profundidade discreta e acentos mint para progresso, sincronização e estados positivos. O objetivo foi criar personalidade sem transformar o produto em uma interface decorativa: conteúdo, formulários e ações continuam sendo os elementos dominantes.

A tipografia mantém Space Grotesk para títulos e contadores e DM Sans para leitura e controles. Os componentes agora compartilham tokens de contraste, borda, superfície, foco e estado. A navegação lateral tem item ativo com barra mint, os cards têm elevação consistente e os estados de formulário, alerta e sucesso usam superfícies cromáticas separadas.

## Cobertura por rota

| Rota | Adaptação visual principal | Capturas |
|---|---|---|
| `/decks` | Biblioteca com cards de maior raio, CTA destacado e estado vazio integrado ao tema Aurora. | `desktop-decks.png`, `mobile-decks.png` |
| `/decks/new` | Formulário de criação em card elevado, inputs navy e ações violetas com agrupamento responsivo. | `desktop-decks-new.png`, `mobile-decks-new.png` |
| `/decks/[deckId]` | Resumo do deck, métricas, amostra e ações com contraste e superfícies unificados. | `desktop-deck-detail.png`, `mobile-deck-detail.png` |
| `/decks/[deckId]/cards` | CRUD com formulário, tabela responsiva, alerta e estados de conteúdo dentro da mesma linguagem. | `desktop-deck-cards.png`, `mobile-deck-cards.png` |
| `/study/[deckId]` | Sessão de foco com card central, progresso, modo foco/claro e avaliações de toque confortável. A captura usa `/study/demo` para exibir o estado completo sem login. | `desktop-study.png`, `mobile-study.png` |
| `/exams` | Configuração de exame com blocos de seleção, avisos e CTA de execução visualmente hierarquizados. | `desktop-exams.png`, `mobile-exams.png` |
| `/analytics` | Métricas e área de atividade com contraste alto e cards consistentes. | `desktop-analytics.png`, `mobile-analytics.png` |
| `/profile` | Resumo da conta e preferências em superfície elevada, com ações alinhadas ao novo sistema. | `desktop-profile.png`, `mobile-profile.png` |
| `/login` | Tela de entrada com card arredondado, fundo radial, campos escuros e CTA primário. | `desktop-login.png`, `mobile-login.png` |
| `/register` | Cadastro com a mesma hierarquia do login, mantendo campos legíveis e helper text acessível. | `desktop-register.png`, `mobile-register.png` |
| `/manifest.webmanifest` | Documento JSON capturado como evidência de resposta HTTP e conteúdo do manifesto; não é uma tela visual de UI. | `desktop-manifest.png`, `mobile-manifest.png` |

## Responsividade e acessibilidade

A estrutura foi mantida **mobile-first na experiência percebida**: a sidebar transforma-se em faixa de navegação superior em telas abaixo de 900px, grids passam a uma coluna em larguras estreitas, formulários preservam gutters e tabelas continuam navegáveis dentro de seus wrappers. O smoke test verifica os viewports 375×812, 768×1024 e 1280×900, além de reduced-motion, overflow horizontal e dimensões mínimas de botões.

Os controles preservam foco visível, nomes acessíveis e áreas de toque de pelo menos 44px nos CTAs principais, alternador de tema, avatar, links de retorno e ações textuais. Contraste e estados não dependem exclusivamente de cor. A folha global mantém suporte a `prefers-reduced-motion`, e a sessão de estudo continua anunciando progresso, resposta e persistência através de atributos ARIA e regiões de status.

## Evidências de validação

O build foi executado após a alteração global, com `pnpm typecheck`, `pnpm test` e `pnpm build` concluídos. A suíte Playwright passou com **17 cenários**, mantendo somente o fluxo autenticado opcional ignorado por falta de credenciais E2E. O smoke test visitou todas as rotas, percorreu links internos, acionou botões visíveis e terminou sem erros de JavaScript, overflow ou controles abaixo do limite configurado.

Foram geradas **22 capturas individuais** — 11 rotas em desktop e mobile — além das folhas de contato `desktop-contact-sheet.png` e `mobile-contact-sheet.png`. Os arquivos originais e o manifesto de captura estão em `artifacts/screens/`; o arquivo `manifest.json` registra viewport, rota, status HTTP e eventuais erros.

## Referências de critérios

As decisões de foco, contraste, navegação por teclado e tamanhos de toque seguem as orientações gerais de acessibilidade do [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/) e o design system persistido em `design-system/flashi-aurora/MASTER.md`.
