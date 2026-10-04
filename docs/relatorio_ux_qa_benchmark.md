# Relatório executivo — QA, UX e benchmark do Flashi

**Data da execução:** 04/10/2026
**Frontend:** `barrosrafa/app-flashi`, branch `feat/sdd-activation`, commit de origem `4a03419`
**Backend:** `barrosrafa/Flashi`, branch `feat/sdd-activation`
**Ambiente testado:** Next.js local em `http://127.0.0.1:3000`, sem sessão autenticada
**Escopo:** varredura geral conforme o roteiro entregue; nenhum dado remoto foi criado, alterado ou removido.

## 1. Resumo executivo

A interface local apresentou **estabilidade alta nos fluxos públicos, anônimos e demonstrativos cobertos**. As 38 rotas verificadas responderam HTTP 200. Na telemetria da varredura, não foram observados erros de console ou runtime, requests falhos, respostas HTTP ≥ 400, requests individuais acima de 2 s nem overflow horizontal no viewport desktop de 1280 px. A bateria visual ampliada percorreu as mesmas 38 rotas em quatro larguras e dois temas, sem apontar os problemas de layout ou controles acessíveis que o smoke test procura.

O ciclo de estudo demonstrativo, navegação, alternância de tema, controles de autenticação sem submissão, exibição de campos opcionais e validação de confirmação de senha foram exercitados. **Não foi reproduzido bug funcional** nesses fluxos. Isso não equivale a uma aprovação de integração: não havia URL de staging, usuário de homologação ou credenciais Supabase para validar operações autenticadas, persistência, e-mail, mídia ou workers.

A recomendação de produto é **concentrar a ativação no primeiro ciclo de aprendizagem**: levar o visitante da landing para uma demonstração curta e, depois, para criação do primeiro deck/card; mostrar estados de sincronização e de jobs com próximos passos explícitos; só então expor gradualmente a superfície avançada. O Flashi já possui fundamentos técnicos e de interação compatíveis com produtos maduros de repetição espaçada, mas a maturidade operacional de fluxos autenticados continua pendente de verificação neste ambiente.

## 2. Execução e resultados de QA

### 2.1 Testes executados

| Verificação | Resultado | Observação |
|---|---:|---|
| Playwright E2E (`pnpm test:e2e`) | **51 passaram; 1 ignorado** | O ignorado é o fluxo que faz login, cria deck e grava card; exige `E2E_EMAIL` e `E2E_PASSWORD`. |
| Varredura exploratória Playwright | **38/38 rotas HTTP 200** | 0 navegações falhas; 0 respostas de rota fora de 2xx. |
| Telemetria de console/rede | **0 falhas reais** | 0 `console.error`, 0 erros de página, 0 requests falhos, 0 respostas ≥ 400, 0 requests > 2.000 ms. Na última rodada de produção, 4 prefetches RSC do Next foram abortados ao trocar de rota (`ERR_ABORTED`); o scanner os registra separadamente como cancelamentos esperados, não como erro HTTP/rede. |
| Layout na varredura exploratória | **0 overflow** | viewport desktop 1280 × 900. |
| Smoke visual (`pnpm smoke:ui`) | **passou** | 38 rotas × 4 larguras × 2 temas; 4.358 verificações de controles, 114 dropdowns e 304 títulos. Sem overflow, erro JS, controles sem nome, dropdown sem texto ou alvos < 44 px. |
| Testes unitários do frontend (`pnpm test`) | **34 passaram** | 10 arquivos de teste. |
| TypeScript (`pnpm typecheck`) | **passou** | `tsc --noEmit`. |
| ESLint (`pnpm lint`) | **0 erros; 17 avisos** | Avisos incluem dependências de hooks, variáveis não usadas e uso de `<img>`; não bloqueiam o lint. |
| Parser SQL do backend (`python3 validate_sql.py`) | **26 arquivos passaram** | Migrações `0001`–`0027` verificadas localmente. |
| Contratos do backend (`pytest tests/test_contracts.py`) | **10 testes + 198 subcasos passaram** | Execução local, sem conexão ou migration remota. |
| Build de produção (`NEXT_PUBLIC_SITE_URL=https://flashi.example.invalid pnpm build`) | **passou** | Build Next.js 16; 36 páginas estáticas geradas e rotas dinâmicas compiladas. |
| Integridade dos arquivos (`git diff --check`, `node --check`) | **passou** | Inclui validação da sintaxe do script novo e do JSON do pacote. |

### 2.2 Interações cobertas

- Abertura de rotas principais e secundárias, incluindo landing, painel, autenticação, decks, estudo, ferramentas, importação/exportação, oclusão, templates, mídia, gamificação e páginas de perfil.
- Sessão demonstrativa completa: revelar a frente/verso, atribuir avaliação “Bom” e concluir os três cartões; o teste confirma que o demo não envia mutações ao Supabase.
- Navegação móvel e painel “Mais”, incluindo fechamento com `Escape`.
- Tema claro/escuro e seletor de busca; checagem de título, metadados, affordances e layout.
- Mostrar/ocultar senha; navegação login → recuperação → volta ao login; mismatch de senha no formulário de redefinição, com alerta claro.
- Divulgação progressiva das opções avançadas no formulário de deck.
- Estado anônimo do painel, biblioteca e perfil, verificando que a interface não sugere contagens zero ou dados carregados quando não há sessão.
- Estados locais do shell em modo offline após aquecer o service worker.

**Não foram submetidos:** login/cadastro reais, recuperação de senha por e-mail, gravações em banco, uploads, criação de jobs, importação/exportação, exclusão ou comandos MCP que pudessem alterar dados. A rota de teste autenticado é explicitamente ignorada sem as credenciais de homologação.

### 2.3 Bugs e falhas funcionais

**Bugs reproduzíveis no escopo anônimo/local: nenhum identificado.** Não foram observados links que falhassem ao abrir as rotas cobertas, erros fatais de JavaScript, falhas de rede ou submissões acidentais nos fluxos exercitados.

**Risco residual — integração não verificada:** a resposta 200 das páginas Next.js e a ausência de erros de rede nesta execução não validam Auth, RLS, persistência nem Edge Functions. É necessária uma rodada separada em staging com conta de teste para verificar login, criação/edição de conteúdo, sincronização, upload, tratamento HTTP 401/403/429/5xx e conclusão dos workers.

**Débito técnico observado no lint:** 17 avisos de qualidade estática, descritos na tabela de execução. Recomenda-se priorizar os avisos de dependências de `useEffect` nos componentes que recarregam dados e as variáveis sem uso; revisar os avisos de imagem separadamente, considerando o uso de mídia autenticada e a estratégia de otimização.

## 3. Diagnóstico de UX e usabilidade

### 3.1 Heurísticas de Nielsen observadas

| Heurística | Evidência nesta execução | Diagnóstico |
|---|---|---|
| Visibilidade do estado do sistema | Estados sem sessão distinguem login necessário de configuração Supabase; demo mostra progresso, avaliação e conclusão. | **Bom no escopo testado.** Estados de sincronização e jobs precisam de validação com servidor real. |
| Correspondência com o mundo real | Deck, card, frente/verso e rótulos de lembrança correspondem a vocabulário reconhecível de estudo. | **Bom.** O manual orienta exemplos concretos de preenchimento. |
| Controle e liberdade do usuário | Links de retorno, divulgação opcional, menu fechável com `Escape`; navegação de autenticação pode voltar ao login. | **Bom.** Não foi testado cancelamento de operações remotas porque nenhuma mutação foi enviada. |
| Prevenção e recuperação de erros | Confirmação de senha divergente produz alerta visível; formulários expõem campos rotulados. | **Adequado no caso testado.** Cobrir em staging erros de campo, perda de conexão e retry em jobs/uploads. |
| Consistência e padrões | Rotas mantêm `h1`; componentes preservam nomes acessíveis e áreas de interação mínimas na matriz do smoke. | **Bom no conjunto verificado.** Manter os mesmos padrões em novos recursos/flags. |
| Reconhecimento em vez de memorização | “Mais opções” revela descrição/organização no formulário; navegação e seletores nomeiam as ações. | **Bom.** Recursos avançados ainda podem ser apresentados por tarefa/objetivo para reduzir carga inicial. |
| Estética e minimalismo | A sessão demonstrativa isola frente, verso e avaliação; o formulário de deck adia campos opcionais. | **Boa base.** A extensão do produto (busca, importação, mídia, MCP, FSRS, etc.) torna importante priorizar o próximo passo e controlar densidade. |

### 3.2 Gaps de clareza e oportunidades UX

Não foi detectada violação bloqueadora de usabilidade nas telas anônimas cobertas. As oportunidades abaixo são melhorias de produto, não defeitos confirmados:

1. **Ativação de ponta a ponta:** oferecer uma sequência contínua `experimentar demo → criar conta → criar primeiro deck → inserir primeiro card → estudar`, com progresso e CTA contextual em cada etapa.
2. **Próxima ação em estados vazios:** para conta sem decks/cards ou sem revisões elegíveis, preservar o motivo e oferecer ação principal e alternativa, em vez de apenas mensagem informativa.
3. **Feedback de operações assíncronas:** depois de confirmar em staging, padronizar status de fila, progresso, espera, retry e resultado final de importação/IA/FSRS com linguagem simples e recuperação clara.
4. **Resultado visível após revisão:** destacar o próximo intervalo calculado e explicar, em linguagem breve, que a agenda depende da lembrança e do histórico FSRS, sem prometer prazo fixo.
5. **Formulários extensos e validação:** validar valores junto ao campo, preservar o que já foi digitado após erro e diferenciar bloqueio de autenticação, indisponibilidade de serviço e erro de formato.
6. **Medição de funil:** instrumentar, respeitando privacidade, conclusão da primeira sessão, criação do primeiro deck/card, retorno à fila e abandono por etapa; usar isso para priorizar simplificação com evidência real.

## 4. Benchmark qualitativo competitivo

**Método e limite:** comparação documental, consultada em 04/10/2026; não é teste de usabilidade lado a lado, auditoria de contas concorrentes nem afirmação de que um produto é superior em todas as dimensões. As fontes são manuais oficiais de Anki e Quizlet.

| Dimensão | Flashi — branch testada | Anki — referência oficial | Quizlet — referência oficial | Oportunidade para Flashi |
|---|---|---|---|---|
| Ciclo de revisão | Demo validada com frente/verso, avaliação e conclusão; atalhos `Espaço` e `1–4` descritos/implementados. Persistência real não verificada. | Opções de deck documentam os quatro ratings **Again, Hard, Good, Easy**, agendamento configurável, passos de aprendizagem e ajustes FSRS. | Modo de repetição espaçada permite virar o cartão, classificar lembrança em quatro opções e continuar até zerar o vencido; a central de ajuda informa que essa modalidade está disponível atualmente no site. | Preservar o fluxo simples e o teclado; tornar a agenda FSRS explicável e verificar o mesmo caminho em uma conta de staging. |
| Conveniência da sessão | Demonstração local de 3 cartões e progresso visível; estudo real usa deck selecionado. | Mais controles de agendamento e opções para adaptar aprendizado/reaprendizado; curva de configuração maior. | Modo de cartões também oferece navegação por setas, embaralhamento, reprodução automática e agrupamento “Still learning/Know”. | Adicionar, como preferências opt-in, repetir cartões difíceis, embaralhar e filtros rápidos sem tornar o início obrigatório mais complexo. |
| Progresso e retenção | Dashboard e analytics implementados no frontend; a precisão dos dados reais depende de sessão e backend, não aferidos aqui. | Manual oficial descreve estatísticas com contagem de escolhas Again/Hard/Good/Easy e gráficos por maturidade. | Recurso “Progress” agrupa termos por acertos/erros e permite prática direcionada; a documentação indica disponibilidade em planos Quizlet Plus e sincronização entre web e apps. | Mostrar tendências derivadas de atividade real, comparar períodos equivalentes e converter resultados em revisão direcionada, sem fabricar métricas para visitantes. |
| Entrada e descoberta | Landing pública, estados sem sessão, demo e formulário curto para deck passaram nos testes aplicáveis. | Modelo de deck e agendamento permitem controle fino, mas pressupõem que o usuário configure conteúdo e opções. | Conjunto de estudo e opções múltiplas permitem começar com cartões existentes e alternar modos. | Fazer da demo e do primeiro deck um caminho óbvio; adiar ferramentas avançadas até o valor principal estar demonstrado. |

### Fontes primárias do benchmark

- [Anki Manual — Deck Options](https://docs.ankiweb.net/deck-options.html): passos de aprendizagem/reaprendizagem, FSRS e agendamento.
- [Quizlet Help — Studying with Flashcards](https://help.quizlet.com/hc/en-us/articles/360030988091-Studying-with-Flashcards): virar, navegar, shuffle, reprodução e agrupamento.
- [Quizlet Help — Studying with Spaced Repetition](https://help.quizlet.com/hc/en-us/articles/48324742264077-Studying-with-Spaced-Repetition): ratings, atalhos e disponibilidade documentada.
- [Quizlet Help — Using Progress for targeted studying](https://help.quizlet.com/hc/en-us/articles/360048803491-Using-Progress-for-targeted-studying): segmentação de progresso, prática direcionada e sincronização.

## 5. Plano de melhorias priorizado

### Quick wins

1. Exibir no dashboard/estado vazio um CTA único para **começar a primeira sessão** ou **criar o primeiro deck**, ajustado ao estado de login.
2. Ao concluir uma sessão, apresentar quantidade revisada, desempenho de forma não julgadora, próximo passo e retorno ao deck/painel.
3. Em recursos dependentes de backend, mostrar claramente a diferença entre “precisa entrar”, “configure a conexão”, “recurso desativado” e “serviço temporariamente indisponível”.
4. Reforçar mensagens junto ao input nos formulários; manter o alerta já observado para confirmação de senha divergente.
5. Criar um item de lint para reduzir os 17 avisos, começando pelos efeitos de recarga de dados.

### Refatorações estruturais

1. **Ativação guiada opcional:** onboarding com objetivo, exemplo de deck e primeiro card; não impor setup longo antes da demonstração.
2. **Camada uniforme para operações assíncronas:** estados tipados de submissão, progresso, timeout, retry e erro para importações, mídia e workers.
3. **Confiança em sincronização:** tornar pendências offline, conflito, último sync e resolução compreensíveis em todas as rotas de conteúdo.
4. **Progresso orientado à ação:** conectar analytics e FSRS a um próximo passo prático, mantendo explicação acessível e evitando métricas sem histórico suficiente.
5. **Pesquisa com usuários:** conduzir tarefas moderadas ou não moderadas sobre criar deck, primeiro card e primeira revisão; validar barreiras e medir tempo/taxa de conclusão antes de ampliar o catálogo de ferramentas.

## 6. Próxima rodada recomendada

Para fechar a cobertura fim a fim, executar este mesmo conjunto em **staging configurado**, com usuário de teste não produtivo e política explícita de limpeza de dados. Adicionar cenários autenticados de criar/editar/excluir deck/card somente nessa conta; validar upload e jobs com arquivos de fixture; exercitar falhas 401/403/429/503 simuladas; coletar traces e tempos de cada request do backend. A rodada atual não alterou nem aplicou migrations, não acessou credenciais administrativas e não verificou o estado remoto do backend.

## 7. Artefatos e reprodução

- Script novo: `scripts/exploratory-qa.mjs`.
- Evidência JSON por rota: `docs/qa-results-2026-10-04.json`.
- Manual atualizado: `docs/manual_usuario.md`.
- Suítes existentes: `tests/e2e/routes.spec.ts` e `scripts/ui-smoke.mjs`.

Para repetir a varredura exploratória, iniciar o frontend local e executar:

```bash
BASE_URL=http://127.0.0.1:3000 \
QA_OUTPUT=docs/qa-results-2026-10-04.json \
pnpm qa:exploratory
```

Para a suíte E2E e o smoke visual:

```bash
pnpm test:e2e
BASE_URL=http://127.0.0.1:3000 pnpm smoke:ui
```
