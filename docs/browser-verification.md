# Verificação de navegador — checkpoint 1

Data: 27/08/2026.

A rota `/` abriu com o título `Flashi — Estudo que fica`, dashboard com métricas de cartões, sequência, tempo, XP, ação `Começar sessão` e três decks navegáveis. A rota `/decks` abriu com biblioteca de três decks, percentuais de progresso, etiquetas de privacidade e ação `+ Novo deck`. Não foram observados erros de runtime no conteúdo renderizado.

A rota `/decks/new` abriu com campos obrigatórios de nome, descrição, botões de criação e cancelamento. A rota `/study/idiomas` abriu com cartão Basic, progresso de sessão e botão de revelação com atalho Espaço. Os controles de rating são renderizados após a revelação; o fluxo local chama `submitReview()` com UUID estável e enfileira fallback no IndexedDB.

No estudo, o clique em `Revelar resposta` mostrou a resposta e os quatro ratings (`De novo`, `Difícil`, `Bom`, `Fácil`). Selecionar `Bom` incrementou a sessão de 1 para 2 de 12 e apresentou novamente o botão de revelação, sem erro visual ou de runtime.

A rota `/exams` abriu com aviso explícito de que exames apenas reordenam a fila, mais formulário completo para nome, deck, data e prioridade. A rota `/analytics` abriu com cartões de retenção, volume semanal, tempo médio, precisão e gráfico de atividade de sete dias. Ambas sem erros observáveis.

A rota `/profile` abriu com preferências editáveis, meta diária, ação de salvar e saída via `auth.signOut()`. A rota `/login` abriu com campos de e-mail/senha, ação `Entrar` e link para cadastro. A autenticação usa o cliente Supabase configurado no navegador; nenhum segredo privilegiado foi incluído.

A rota `/register` abriu com campos de nome, e-mail e senha, feedback de confirmação e link de login. A rota dinâmica `/decks/idiomas` resolveu `params` assíncronos do Next.js 16, renderizando estatísticas e tabela de cartões Basic/Cloze/Reverse com ação de estudo.

Resultado do checkpoint: dashboard, decks, criação, detalhe, estudo, exames, analytics, perfil, login e registro foram abertos em navegador; o estudo também foi interagido com revelar e rating.
