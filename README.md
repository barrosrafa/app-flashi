# Flashi

**Flashi** é uma aplicação web de flashcards em Next.js, orientada a estudo com repetição espaçada e preparada para operação local-first. O projeto foi implementado a partir do [SSD consolidado](./FLASHI_SSD_CONSOLIDADO.md), com uma interface mobile-first, um núcleo local em IndexedDB/Dexie, integração com o projeto Supabase `flashi` e caminhos explícitos para sincronização, avaliações FSRS e agendamento de exames.

> **Estado desta entrega.** Esta versão entrega o shell funcional do produto, as telas principais, o fluxo interativo de estudo, os clientes Supabase, os contratos de sincronização/outbox, o fallback local e a documentação de execução. O backend Supabase existente permanece a fonte de verdade para autenticação, RLS, RPCs, Edge Functions e persistência remota. A materialização completa das aproximadamente 24 entidades locais, importação/exportação Anki, oclusão de imagem e busca semântica avançada estão estruturadas como extensões previstas no SSD, mas não são apresentados como concluídos nesta entrega.

## 1. Objetivos e princípios

O caminho crítico do produto é a sessão de estudo. Por isso, a resposta de revelar um cartão e registrar uma avaliação não deve aguardar a rede. O frontend grava a avaliação localmente com um `client_review_id` estável, cria uma entrada na outbox e tenta chamar a Edge Function `fsrs-review`; se a rede ou a sessão não estiverem disponíveis, a operação permanece pronta para reprocessamento.

A aplicação também preserva transparência no comportamento remoto. Quando não há usuário autenticado ou não existem decks remotos, a biblioteca informa que está em modo local em vez de simular uma sincronização bem-sucedida. A tela de exames segue a correção conceitual do SSD: trata-se de **agendamento por prioridade e data-alvo**, não de geração de perguntas por inteligência artificial.

## 2. Stack

| Camada | Escolha | Papel nesta entrega |
|---|---|---|
| Framework | Next.js 16.1, App Router | Rotas estáticas, rotas dinâmicas e componentes client-side |
| Linguagem | TypeScript estrito | Contratos de UI, serviços e persistência local |
| Interface | React 19, CSS responsivo próprio | Dashboard, estudo, formulários e acessibilidade básica |
| Cloud | `@supabase/supabase-js` + `@supabase/ssr` | Auth, Data API, RPCs, Storage e Edge Functions |
| Offline | Dexie sobre IndexedDB | Cartões, avaliações, cursor de sync e outbox |
| Validação | Vitest | Contratos determinísticos de sync e idempotência |
| PWA | Manifesto Next.js | Nome, tema e modo standalone preparados; precache do shell é próxima etapa |

O uso de `@supabase/ssr` e das variáveis `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` segue a recomendação oficial de separar o cliente de navegador do cliente de servidor.[^2] O Next.js 16 chama a convenção de middleware de **Proxy**; o arquivo atual ainda usa `middleware.ts` por compatibilidade e o build emite apenas um aviso de migração.[^1]

## 3. Estrutura do repositório

```text
app/
├── (auth)/login/page.tsx       # Entrada via Supabase Auth
├── (auth)/register/page.tsx    # Cadastro via Supabase Auth
├── analytics/page.tsx          # Métricas e atividade semanal
├── decks/page.tsx              # Biblioteca conectada ao Data API
├── decks/new/page.tsx          # Criação de deck
├── decks/[deckId]/page.tsx     # Detalhe dinâmico, params assíncronos
├── exams/page.tsx              # Agendamento por prioridade
├── profile/page.tsx            # Preferências e signOut
├── study/[deckId]/page.tsx     # Sessão crítica de estudo
├── layout.tsx
├── manifest.ts
└── globals.css
components/
├── AppShell.tsx               # Navegação persistente e topbar
└── DeckLibrary.tsx             # Leitura remota com fallback local
lib/
├── db/schema.ts               # Dexie e tabelas locais do MVP
├── db/outbox-queue.ts          # Mutações ordenadas e retry
├── db/sync-engine.ts           # Cursor USN e lista plana de mudanças
├── services/deck-service.ts    # list/create de decks
├── services/exam-service.ts    # deck_exams e fila com exame
├── services/study-service.ts   # review otimista + fsrs-review
└── supabase/client.ts          # createBrowserClient
scripts/supabase-smoke.mjs     # Smoke test contra o projeto real
tests/sync-engine.test.ts       # Testes de contrato
```

## 4. Configuração local

Requisitos mínimos: Node.js compatível com Next.js 16, pnpm e acesso ao projeto Supabase `flashi`. Instale as dependências e copie o exemplo de ambiente:

```bash
pnpm install
cp .env.example .env.local
```

Preencha `.env.local` com o URL e a chave **publishable/anon**, nunca com `service_role` ou `sb_secret`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://ykyobzoxoiljyueasdwc.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

A chave publishable pode ser exposta no navegador porque o controle de acesso depende de Auth e RLS. A chave secreta de serviço e qualquer `OPENAI_API_KEY` devem permanecer apenas em funções/worker server-side. A documentação oficial confirma que o cliente usa o URL do projeto e a chave publishable para acessar a Data API e que as permissões devem ser protegidas por RLS.[^3]

## 5. Comandos

| Comando | Finalidade | Resultado validado |
|---|---|---|
| `pnpm dev` | Servidor local | Usado para verificação de navegador em `http://localhost:3000` |
| `pnpm typecheck` | TypeScript estrito | Passou sem erros |
| `pnpm test` | Testes Vitest | 3 testes passaram |
| `pnpm exec next build --webpack` | Build de produção | Compilou 11 rotas sem erros |
| `node scripts/supabase-smoke.mjs` | Smoke test remoto | REST público, RPC de sync e proteção JWT verificados |

A documentação da chamada de Edge Functions do Supabase usa `supabase.functions.invoke`, o mesmo padrão adotado em `lib/services/study-service.ts`.[^3]

## 6. Rotas implementadas

| Rota | Conteúdo | Estado de validação |
|---|---|---|
| `/` | Dashboard com cartões do dia, sequência, XP e decks | Aberta em navegador |
| `/decks` | Biblioteca remota com fallback local | Aberta; status `Sem decks remotos · modo local ativo` confirmado |
| `/decks/new` | Formulário de novo deck | Aberta em navegador |
| `/decks/[deckId]` | Detalhe dinâmico, métricas, tabela e painel de cards | Aberta em navegador |
| `/decks/[deckId]/cards` | CRUD de cards mesclado do ZIP, com `notes` + `cards` | Aberta; insert autenticado confirmado |
| `/study/[deckId]` | Revelar, atalhos e quatro ratings | Aberta e interagida; rating incrementou a sessão |
| `/exams` | Agendamento de exame e prioridade | Aberta em navegador |
| `/analytics` | Retenção, volume, tempo, precisão e gráfico | Aberta em navegador |
| `/profile` | Preferências e `auth.signOut()` | Aberta em navegador |
| `/login` | `auth.signInWithPassword` | Aberta em navegador |
| `/register` | `auth.signUp` | Aberta em navegador |
| `/manifest.webmanifest` | Manifesto PWA | Gerado pelo Next.js |

Os detalhes da evidência visual e textual estão em [`docs/browser-verification.md`](./docs/browser-verification.md). O teste autenticado, incluindo login, criação de deck, criação de card e confirmação por SQL no Supabase, está em [`docs/integration-verification.md`](./docs/integration-verification.md).

## 7. Integração Supabase

O cliente de navegador é criado em `lib/supabase/client.ts`. A URL possui fallback para o projeto auditado, enquanto a chave precisa vir do ambiente local. Os serviços acessam o Data API com consultas filtradas e limitadas:

| Operação | Implementação | Contrato remoto |
|---|---|---|
| Listar decks | `from('decks').select(...).order(...).limit(50)` | RLS controla o conjunto visível |
| Criar deck | `from('decks').insert(...).select(...).single()` | A gravação real exige usuário autenticado |
| Fila de estudo | `rpc('get_due_cards_with_exam_schedule', ...)` | Fila reordenada por prioridade de exame |
| Sync incremental | `rpc('get_incremental_sync', ...)` | Lista plana por `entity_type`, `entity_key`, `usn`, `is_deleted`, `payload` |
| Avaliação | `functions.invoke('fsrs-review', ...)` | JWT do usuário e `client_review_id` idempotente |
| Exame | `from('deck_exams').insert(...).select(...).single()` | Status inicial `active` |
| Auth | `auth.signInWithPassword`, `auth.signUp`, `auth.signOut` | Sessão gerenciada pelo Supabase |

### 7.1 Estado remoto auditado

A instância `flashi` está ativa e saudável no projeto `ykyobzoxoiljyueasdwc`. A auditoria confirmou as migrações `0001` a `0024` e também uma migração adicional chamada `user_function_rate_limits`. A confirmação é importante porque o SSD alertava para a necessidade de verificar a migração `0024`; ela está presente no ambiente real.

O schema público auditado contém, entre outras, `decks`, `notes`, `cards`, `card_learning_state`, `review_logs`, `deck_exams`, `user_gamification_profiles`, `badges_definition`, `user_badges`, `socratic_remediation_sessions`, `ai_ingestion_jobs`, `anki_transfer_jobs`, `graves` e `v_deck_tree`. O projeto possui oito Edge Functions ativas: `sync`, `fsrs-review`, `embeddings`, `semantic-search`, `fsrs-optimize`, `fsrs-optimize-worker`, `anki-transfer` e `ai-ingest`, todas configuradas no inventário remoto com verificação JWT.

### 7.2 Smoke test remoto

O script `scripts/supabase-smoke.mjs` foi executado contra a instância real. O resultado foi:

```text
public badges REST                         200  ok=true
incremental sync RPC sem usuário          200  ok=true  body=[]
fsrs-review sem JWT                        401  ok=true  Authentication is required
```

O primeiro probe retornou lista vazia porque o catálogo de badges ainda não possui registros. O segundo retornou lista vazia no contexto sem usuário, confirmando o formato de resposta vazio sem criar dados. O terceiro confirmou que a função de avaliação não aceita chamadas anônimas.

## 8. Offline-first, sync e outbox

O schema local do MVP usa as tabelas `decks`, `cards`, `learning`, `reviews`, `exams`, `outbox` e `sync_meta`. O cursor `last_usn` só é avançado depois de materializar todo o lote retornado pelo RPC. Mudanças com `is_deleted` removem o registro local; mudanças ativas fazem `put` do payload.

A outbox mantém ordem por `created_at`. Ações suportadas são `insert`, `update`, `delete` e `rpc`. Falhas incrementam `retries` e interrompem o lote para não ultrapassar uma operação anterior. O próximo flush retoma do primeiro item pendente. Reviews usam UUID persistente em `client_review_id`, permitindo que a função remota deduplicate reenvios.

> O app não usa `localStorage` para o cursor de sincronização. Isso é deliberado: IndexedDB/Dexie é a persistência apropriada para dados locais do fluxo de estudo e é acessível por componentes que executam no navegador.

## 9. Segurança e findings do ambiente

A análise de segurança do Supabase encontrou um aviso informativo para `user_function_rate_limits`, que possui RLS habilitado sem policy. Também encontrou avisos sobre funções `SECURITY DEFINER` executáveis por usuários autenticados, incluindo `add_user_xp` e `resolve_socratic_remediation`. Esses pontos pertencem ao backend existente e não foram alterados pelo frontend; devem ser revisados antes de produção.

A análise de performance apontou uma foreign key sem índice cobrindo `user_badges.badge_id` e várias policies que reavaliam `auth.uid()` por linha, incluindo policies de `profiles`, `decks`, `cards`, tags e colaboradores. O remédio recomendado é envolver a chamada de autenticação em `select`, conforme o advisory gerado pelo Supabase.

| Finding | Severidade observada | Próxima ação |
|---|---|---|
| RLS sem policy em `user_function_rate_limits` | INFO | Definir policy explícita ou revogar exposição à role de cliente |
| `SECURITY DEFINER` executável por authenticated | WARN | Revisar `EXECUTE`, ownership e validação de `auth.uid()` |
| FK `user_badges.badge_id` sem índice | INFO | Criar índice cobrindo a coluna |
| `auth_rls_initplan` em várias policies | WARN | Usar `(select auth.uid())` conforme advisory |
| Convenção `middleware.ts` depreciada no Next 16 | WARNING de build | Migrar para `proxy.ts` em uma alteração separada |

## 10. Limitações conhecidas

A tela principal usa dados demonstrativos para manter a experiência navegável sem exigir login durante a revisão visual. A biblioteca de decks consulta o Supabase e alterna para esse conteúdo local quando a resposta remota vem vazia ou falha. O fluxo autenticado de criação de deck e card já foi executado com sucesso; para uma conta autenticada, a próxima iteração deve hidratar todos os cartões a partir de `v_deck_tree` e das entidades relacionadas.

O cálculo FSRS-6 não é reimplementado integralmente no cliente nesta versão. A avaliação otimista é persistida e encaminhada a `fsrs-review`; o agendador definitivo deve continuar no contrato do backend. O manifesto PWA está presente, mas o precache do app shell via Serwist/Workbox ainda deve ser adicionado para cumprir o requisito de abrir o JavaScript sem rede pela primeira vez.

Também não há, nesta entrega, upload de mídia com SHA-256, editor completo de notas e templates, oclusão de imagem, processamento de jobs Anki, ingestão de PDF/YouTube/web, busca semântica, gamificação visível ou chat socrático. Os serviços e os contratos devem ser implementados por fases, sem inventar RPCs ou funções que não existem no backend.

## 11. Próximos passos recomendados

A primeira evolução deve gerar `src/types/database.ts` diretamente do projeto Supabase e substituir tipos aproximados dos serviços pelos tipos oficiais. Em seguida, a biblioteca de decks deve receber o usuário autenticado, hidratar Dexie em lotes e exibir contadores reais de cartões novos e de revisão.

A segunda evolução deve concluir o precache do app shell, migrar `middleware.ts` para `proxy.ts`, adicionar Playwright com cenário offline real e tornar a tela de estudo dependente da fila local. A terceira deve implementar uploads privados nos buckets `card-media` e `anki-transfers`, gerar URLs assinadas de curta duração e adicionar os jobs assíncronos com estados `queued`, `processing`, `completed` e `failed`.

## 12. Referências

[^1]: [Next.js — Proxy, documentação oficial](https://nextjs.org/docs/app/getting-started/proxy), que registra a mudança de Middleware para Proxy no Next.js 16 e descreve o uso da convenção de arquivo.
[^2]: [Supabase — Creating a Supabase client for SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client), que documenta `@supabase/ssr`, variáveis públicas e a separação entre clientes de navegador e servidor.
[^3]: [Supabase — JavaScript `functions.invoke`](https://supabase.com/docs/reference/javascript/functions-invoke), referência oficial de chamadas de Edge Functions e uso do cliente JavaScript.
[^4]: [Repositório de destino — barrosrafa/app-flashi](https://github.com/barrosrafa/app-flashi), onde esta implementação será publicada.
