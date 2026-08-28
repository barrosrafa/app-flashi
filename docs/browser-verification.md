# Verificação de navegador — checkpoint 1

Data: 27/08/2026.

A rota `/` abriu com o título `Flashi — Estudo que fica`, dashboard com métricas de cartões, sequência, tempo, XP, ação `Começar sessão` e três decks navegáveis. A rota `/decks` abriu com biblioteca de três decks, percentuais de progresso, etiquetas de privacidade e ação `+ Novo deck`. Não foram observados erros de runtime no conteúdo renderizado.

A rota `/decks/new` abriu com campos obrigatórios de nome, descrição, botões de criação e cancelamento. A rota `/study/idiomas` abriu com cartão Basic, progresso de sessão e botão de revelação com atalho Espaço. Os controles de rating são renderizados após a revelação; o fluxo local chama `submitReview()` com UUID estável e enfileira fallback no IndexedDB.

No estudo, o clique em `Revelar resposta` mostrou a resposta e os quatro ratings (`De novo`, `Difícil`, `Bom`, `Fácil`). Selecionar `Bom` incrementou a sessão de 1 para 2 de 12 e apresentou novamente o botão de revelação, sem erro visual ou de runtime.

A rota `/exams` abriu com aviso explícito de que exames apenas reordenam a fila, mais formulário completo para nome, deck, data e prioridade. A rota `/analytics` abriu com cartões de retenção, volume semanal, tempo médio, precisão e gráfico de atividade de sete dias. Ambas sem erros observáveis.

A rota `/profile` abriu com preferências editáveis, meta diária, ação de salvar e saída via `auth.signOut()`. A rota `/login` abriu com campos de e-mail/senha, ação `Entrar` e link para cadastro. A autenticação usa o cliente Supabase configurado no navegador; nenhum segredo privilegiado foi incluído.

A rota `/register` abriu com campos de nome, e-mail e senha, feedback de confirmação e link de login. A rota dinâmica `/decks/idiomas` resolveu `params` assíncronos do Next.js 16, renderizando estatísticas e tabela de cartões Basic/Cloze/Reverse com ação de estudo.

Resultado do checkpoint: dashboard, decks, criação, detalhe, estudo, exames, analytics, perfil, login e registro foram abertos em navegador; o estudo também foi interagido com revelar e rating.

## Complementação do plano — 28/08/2026

Com a sessão autenticada persistida no navegador, `/` passou a mostrar dados reais: fila de hoje, sequência, tempo, XP e deck carregados dos serviços Supabase. A tela exibiu o deck `Deck QA Supabase 20260827`, um card e `1 novos · 0 em revisão`, sem arrays demonstrativos.

A rota `/decks` exibiu `Supabase sincronizado`, o mesmo deck real e contadores calculados a partir de `cards` e `card_learning_state`. A navegação global passou a incluir `/tools` para as integrações avançadas.

## Fila de estudo real — 28/08/2026

Após a criação do estado FSRS para cards legados, a rota `/study/0469c2b7-bdc9-44ea-ba67-a4bc98c3d62a` carregou o card real `06253f02-0a9d-499f-8c70-f50df30e4fbb`, com estado `new`, frente `Qual é o objetivo deste teste?` e verso persistido. O botão de revelar exibiu os quatro ratings; selecionar `3 · Bom` encaminhou o review e apresentou `Sessão concluída` para a sessão de um card.

O probe read-only do Supabase confirmou que o card legado ainda não possuía `card_learning_state`; por isso o serviço mantém fallback explícito de disponibilidade para cards reais quando a RPC canônica retorna vazio. Novos cards usam `mcp_create_note`, que cria note, card e estado FSRS em uma única transação.

## Complementação avançada — 28/08/2026

A rota `/analytics` passou a mostrar zero/estado vazio derivado de `daily_statistics` e `review_logs`, sem os valores fixos anteriores. O gráfico mantém sete dias, mas suas alturas vêm das linhas reais retornadas pelo Supabase.

A rota `/tools` abriu com quatro painéis: busca semântica/lexical, criação de job de ingestão por IA, solicitação de otimização FSRS e import/export Anki. O deck autenticado apareceu no seletor de ingestão e exportação.

Foi executada uma busca lexical pela interface com a consulta `Supabase`. O cliente enviou o payload correto à Edge Function, mas o ambiente respondeu `Failed to send a request to the Edge Function`; a UI exibiu o erro sem inventar resultados. Essa indisponibilidade está documentada como dependência operacional do deploy/allowlist da função, não como falha mascarada do frontend.
