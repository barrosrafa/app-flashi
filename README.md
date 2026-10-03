# Flashi

Aplicação web de flashcards para estudo com repetição espaçada, construída com **Next.js 16**, **React 19**, **TypeScript** e **Supabase**. A versão documentada neste ficheiro corresponde à branch **`feature/v3`** e integra a aplicação frontend com os contratos efetivamente publicados pelo backend [Flashi `v2`](https://github.com/barrosrafa/Flashi/tree/v2).

> **Estado da entrega:** a implementação v3 inclui as funcionalidades de fundação local-first, sincronização incremental, outbox, Anki, importação por URL, busca semântica com fallback lexical, otimização FSRS, ingestão assistida por IA, mídia, oclusão de imagem, gamificação, exames e tratamento global de erros Edge Functions. As funcionalidades opt-in permanecem desativadas por defeito através de feature flags.

## Índice

1. [Visão geral](#1-visão-geral)
2. [Arquitetura](#2-arquitetura)
3. [Stack](#3-stack)
4. [Estrutura do projeto](#4-estrutura-do-projeto)
5. [Configuração local](#5-configuração-local)
6. [Feature flags](#6-feature-flags)
7. [Funcionalidades](#7-funcionalidades)
8. [Rotas](#8-rotas)
9. [Serviços frontend](#9-serviços-frontend)
10. [Persistência local, sincronização e outbox](#10-persistência-local-sincronização-e-outbox)
11. [Contratos com o backend](#11-contratos-com-o-backend)
12. [Segurança e tratamento de erros](#12-segurança-e-tratamento-de-erros)
13. [Testes e validação](#13-testes-e-validação)
14. [Desenvolvimento](#14-desenvolvimento)
15. [Troubleshooting](#15-troubleshooting)
16. [Limitações e decisões contratuais](#16-limitações-e-decisões-contratuais)
17. [Checklist de release](#17-checklist-de-release)
18. [Referências](#18-referências)

---

## 1. Visão geral

O Flashi foi desenhado em torno de três princípios:

1. **A sessão de estudo é local-first.** Revelar um cartão e registrar uma avaliação não deve depender de uma resposta de rede. A avaliação é persistida localmente, identificada por um `client_review_id` estável e encaminhada para a outbox.
2. **O backend é a fonte de verdade remota.** Auth, RLS, RPCs, Edge Functions, Storage, sequência USN e agendamento FSRS pertencem ao backend Supabase.
3. **Divergências contratuais são resolvidas a favor do backend.** O SDD contém alguns nomes exemplificativos que não existem no `Flashi@v2`; o frontend usa os nomes e payloads presentes nas migrations e Edge Functions reais.

O produto disponibiliza:

- autenticação por email e password;
- criação e gestão de decks, notas e cartões;
- sessão de estudo com avaliação otimista;
- sincronização incremental por USN;
- outbox para mutações offline e reprocessamento ordenado;
- importação e exportação de pacotes Anki;
- importação de conteúdos CSV, Markdown, Quizlet e RemNote por URL;
- busca semântica e fallback lexical;
- solicitação e consulta de otimização FSRS;
- ingestão de texto, URL e PDF para revisão humana antes de salvar notas;
- upload e assinatura temporária de mídia privada;
- criação de cartões de oclusão de imagem;
- perfil de XP, nível, sequência e badges;
- agendamento de exames e fila de estudo ponderada por data-alvo;
- PWA com service worker e comportamento tolerante a falhas offline.

---

## 2. Arquitetura

```text
┌─────────────────────────────────────────────────────────────┐
│ Next.js App Router / React UI                               │
│ rotas, componentes, guards de flags e feedback de erros     │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ Serviços frontend                                            │
│ anki · ingestão · busca · FSRS · mídia · exames · XP         │
│ importação · oclusão · cliente Edge único                    │
└───────────────┬───────────────────────────────┬──────────────┘
                │                               │
┌───────────────▼──────────────┐   ┌────────────▼─────────────┐
│ Dexie / IndexedDB             │   │ Supabase browser client  │
│ schema local, repositórios,   │   │ Auth, Data API, RPC,      │
│ cursor USN e outbox           │   │ Storage e Edge Functions  │
└───────────────┬──────────────┘   └────────────┬─────────────┘
                │                               │
                └───────────────┬───────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────┐
│ Backend Flashi@v2                                           │
│ PostgreSQL/RLS · Storage · Edge Functions · workers · RPCs   │
└─────────────────────────────────────────────────────────────┘
```

### Fluxo online

1. A UI chama um serviço de domínio.
2. O serviço lê/escreve localmente quando a operação faz parte do fluxo de estudo ou outbox.
3. Operações remotas passam por `invokeEdge` ou pelo cliente Supabase tipado.
4. O backend valida JWT, propriedade via RLS e payload.
5. A UI apresenta sucesso, estado pendente ou erro tipado.

### Fluxo offline

1. A mutação é escrita no IndexedDB com `_dirty = 1`.
2. Uma entrada com `client_mutation_id` é criada na outbox.
3. O worker tenta enviar quando a aplicação está online, recebe foco ou termina uma escrita.
4. Falhas transitórias ficam pendentes para retry; a ordem das mutações é preservada.
5. A sincronização incremental aplica tombstones e registros até ao próximo `usn`.

---

## 3. Stack

| Camada | Tecnologia | Responsabilidade |
|---|---|---|
| Framework | Next.js 16.1 / App Router | Rotas estáticas, dinâmicas e server rendering |
| UI | React 19 / TypeScript 5.9 | Componentes, formulários e interação |
| Estilos | CSS responsivo próprio | Layout mobile-first e estados da UI |
| Backend | Supabase | Auth, Postgres, RLS, RPC, Storage e Edge Functions |
| Cliente Supabase | `@supabase/ssr` e `@supabase/supabase-js` | Sessão de browser e chamadas remotas |
| Persistência offline | Dexie / IndexedDB | Entidades locais, cursor, estado dirty e outbox |
| Validação | Vitest | Testes de serviços, contratos e invariantes |
| E2E | Playwright | Smoke tests de UI quando o ambiente está configurado |
| PWA | Manifest e service worker | Cache do shell e fallback de navegação |

O Next.js 16 utiliza `proxy.ts` em vez da convenção antiga `middleware.ts`. O cliente Supabase de browser está em `lib/supabase/client.ts` e usa exclusivamente URL pública e chave publishable.

---

## 4. Estrutura do projeto

```text
app/
├── (auth)/login/                 # Login Supabase Auth
├── (auth)/register/              # Registo Supabase Auth
├── analytics/                    # Métricas e atividade
├── decks/                        # Biblioteca e criação de decks
│   └── [deckId]/
│       ├── cards/                # Gestão de cartões
│       └── occlusion/new/        # Editor de oclusão de imagem
├── exams/                        # Exames e prioridade
├── export/anki/                  # Exportação para .apkg
├── import/
│   ├── ai-ingest/                # Ingestão com revisão humana
│   ├── anki/                     # Importação .apkg
│   └── url/                      # Importação CSV/Markdown/etc. por URL
├── media/[id]/                   # Visualização de mídia
├── occlusion/                    # Área de oclusão existente
├── profile/                      # Preferências e badges
├── search/                       # Busca semântica
├── settings/fsrs-optimize/       # Otimização FSRS
├── study/[deckId]/               # Sessão crítica de estudo
├── tools/                        # Ferramentas e jobs
├── layout.tsx                    # Shell global, worker e erros Edge
└── globals.css

components/
├── AppShell.tsx                  # Navegação e topbar
├── EdgeErrorNotice.tsx           # Erros remotos globais
├── RateLimitBanner.tsx            # Countdown para HTTP 429
├── OcclusionEditor.tsx            # Desenho de máscaras percentuais
├── OcclusionCard.tsx              # Revelação individual de máscaras
├── MediaViewer.tsx                # Imagem, áudio e vídeo
└── SemanticHitRow.tsx             # Resultado da busca semântica

lib/
├── config/feature-flags.ts        # Flags v3
├── db/
│   ├── schema.ts                  # Schema Dexie versionado
│   ├── sync-engine.ts             # Cursor, records e tombstones
│   ├── sync-worker.ts             # Coordenação online/foco/intervalo
│   ├── sync-registry.ts           # Registo de handlers
│   ├── outbox-queue.ts            # Mutação pendente e retry
│   └── repositories/               # CRUD local por entidade
├── services/
│   ├── http/edge-client.ts        # Wrapper único de Edge Functions
│   ├── anki-service.ts            # Anki import/export
│   ├── import-deck-service.ts     # Importação via import-deck
│   ├── ingestion-service.ts       # IA, PDF, URL e rascunho
│   ├── semantic-search-service.ts # Busca semântica/lexical
│   ├── optimizer-service.ts       # FSRS optimization
│   ├── media-service.ts           # Storage card-media
│   ├── occlusion-service.ts       # RPC image occlusion
│   ├── gamification-service.ts    # XP, perfis e badges
│   ├── exam-service.ts             # Exames e fila
│   └── study-service.ts            # Avaliação e revisão
└── supabase/client.ts              # Browser client tipado

tests/
├── edge-client.test.ts             # Auth, retry, 429, 503 e timeout
├── feature-services.test.ts        # Validação de oclusão
└── sync-engine.test.ts             # Cursor, tombstone e sincronização

docs/
├── backend-contract-notes.md       # Notas dos contratos remotos
├── integration-verification.md    # Verificação de integração
└── browser-verification.md         # Evidências de UI/browser
```

---

## 5. Configuração local

### Requisitos

- Node.js compatível com Next.js 16;
- pnpm;
- acesso a um projeto Supabase compatível com o backend Flashi;
- credenciais de um utilizador de teste para fluxos autenticados.

### Instalação

```bash
git clone https://github.com/barrosrafa/app-flashi.git
cd app-flashi
git checkout feature/v3
pnpm install
cp .env.example .env.local
```

Preencha `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://ykyobzoxoiljyueasdwc.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

A chave deve ser **publishable/anon**. Nunca coloque no frontend:

- `service_role`;
- `sb_secret`;
- `OPENAI_API_KEY`;
- tokens administrativos;
- passwords de utilizadores.

A autorização é garantida por Auth, RLS e validações nas Edge Functions. A chave publishable pode aparecer no bundle do browser, mas não concede acesso além das policies configuradas.

### Execução

```bash
pnpm dev
```

Abra `http://localhost:3000/login`, autentique-se e navegue para os decks.

---

## 6. Feature flags

Todas as flags v3 são opt-in. O valor `1` ativa a funcionalidade; qualquer outro valor mantém-na desativada.

| Flag | Variável | Escopo |
|---|---|---|
| `sync_v2` | `NEXT_PUBLIC_FF_SYNC_V2` | Worker e sincronização incremental |
| `anki_io` | `NEXT_PUBLIC_FF_ANKI_IO` | Importação/exportação Anki |
| `occlusion` | `NEXT_PUBLIC_FF_OCCLUSION` | Editor e cartões de oclusão |
| `semantic_search` | `NEXT_PUBLIC_FF_SEMANTIC_SEARCH` | Busca semântica e fallback lexical |
| `fsrs_opt` | `NEXT_PUBLIC_FF_FSRS_OPT` | Pedido/consulta de otimização FSRS |
| `ai_ingest` | `NEXT_PUBLIC_FF_AI_INGEST` | Ingestão de texto, URL e PDF |
| `gamification` | `NEXT_PUBLIC_FF_GAMIFICATION` | XP, nível, streak e badges |
| `exams` | `NEXT_PUBLIC_FF_EXAMS` | Exames e fila ponderada |
| `import_url` | `NEXT_PUBLIC_FF_IMPORT_URL` | Importação de conteúdos por URL |

O repositório também conserva flags legadas (`MEDIA`, `SEMANTIC`, `ANKI`, `SYNC_WORKER`) para compatibilidade com a fundação v1/v2. Para uma funcionalidade nova, a UI deve usar `isEnabled(...)` de `lib/config/feature-flags.ts`.

Exemplo:

```dotenv
NEXT_PUBLIC_FF_ANKI_IO=1
NEXT_PUBLIC_FF_SEMANTIC_SEARCH=1
NEXT_PUBLIC_FF_IMPORT_URL=1
```

Uma flag desativada não remove a rota do build; a rota renderiza uma mensagem de recurso desativado e não chama o backend.

---

## 7. Funcionalidades

### 7.1 Sincronização local-first

- Schema Dexie versionado para entidades sincronizáveis.
- Cursor `last_usn` armazenado em `sync_meta`.
- `executeIncrementalSync()` chama a Edge Function `sync` com `{ last_usn, limit }`.
- Registros ativos são aplicados com `put`.
- Tombstones são materializados localmente com `deleted_at`, sem apagar silenciosamente o histórico.
- O cursor só avança depois de o lote completo ser aplicado numa transação Dexie.
- Telemetria local regista `sync.success` e `sync.failure` sem conteúdo de cartões ou tokens.

### 7.2 Outbox e avaliações

- Mutações têm `client_mutation_id` idempotente.
- A ordem é preservada por `created_at`.
- Falhas incrementam retries e interrompem o lote no primeiro item pendente.
- Reviews usam `client_review_id` estável para permitir deduplicação no backend.
- A avaliação otimista não bloqueia a sessão de estudo enquanto aguarda a rede.

### 7.3 Importação e exportação Anki

A importação aceita `.apkg` até **50 MiB** e envia o arquivo para o bucket privado `anki-transfers`, sob o caminho do utilizador:

```text
{user_id}/imports/{timestamp}-{filename}.apkg
```

Depois chama `anki-transfer` com:

```json
{
  "action": "import",
  "storage_path": "<path privado>",
  "target_deck_name": "<opcional>"
}
```

O backend trata deduplicação por pacote, notas, cartões, tags e mídia. A exportação envia `deck_id` e `include_media`, recebe o `storage_path` gerado e cria uma URL assinada temporária para download.

Limites aplicados pelo backend incluem 50 MiB por pacote, 10.000 notas e 2.000 mídias vinculadas.

### 7.4 Importação por URL

A rota `/import/url` permite escolher:

- CSV;
- Markdown;
- Quizlet;
- RemNote.

O browser baixa a URL, converte a resposta numa `File`, envia-a ao bucket `import-media` e chama `import-deck`. O backend real não recebe uma URL diretamente; recebe `deck_id`, `format` e `storage_path` privado. Por isso, a funcionalidade depende de a origem permitir CORS para o browser.

O limite de arquivo é **15 MiB**, conforme `import-deck`.

### 7.5 Busca semântica

`semanticSearchService` chama `semantic-search` com:

```json
{
  "query": "...",
  "limit": 20,
  "mode": "semantic"
}
```

Se a operação semântica receber indisponibilidade `503`, o serviço tenta novamente em modo `lexical`. A resposta inclui `mode`, modelo/dimensões quando aplicável, hash da consulta e resultados com `note_id`, `fields`, `match_type` e `similarity`.

### 7.6 Otimização FSRS

- `optimizerService.request()` chama `fsrs-optimize` em modo `request`.
- `optimizerService.run(runId)` chama a execução do job.
- O estado de uma execução é consultado pela tabela `fsrs_optimization_runs`, porque a Edge Function backend não declara uma ação pública `status`.
- A tela não faz polling agressivo; a consulta ocorre sob demanda.
- A otimização definitiva continua a ser executada pelo backend/worker.

### 7.7 Ingestão assistida por IA

A UI suporta quatro tipos de origem:

- `raw_text_block`;
- `youtube_url`;
- `web_page`;
- `pdf_document`.

O fluxo é deliberadamente de **revisão humana**:

1. o utilizador informa deck e conteúdo;
2. a aplicação cria um `ai_ingestion_job`;
3. o estado `queued`, `processing`, `completed` ou `failed` é exibido;
4. o conteúdo não é salvo automaticamente como nota;
5. o utilizador revê e decide o que salvar.

Rascunhos de texto são guardados em `localStorage` com a chave `flashi:ai-ingest-draft:<deckId>`. O PDF é enviado para `import-media` e referenciado por `storage_path`.

### 7.8 Mídia

`mediaService` usa o bucket privado `card-media` e produz caminhos por utilizador/cartão. URLs de leitura são assinadas por 30 minutos. `MediaViewer` seleciona automaticamente `<img>`, `<audio>` ou `<video>` conforme o MIME type.

### 7.9 Oclusão de imagem

O `OcclusionEditor` desenha retângulos relativos à imagem. As coordenadas são percentuais de 0 a 100:

```json
{
  "cloze_ordinal": 1,
  "label_text": "opcional",
  "x_pos": 10,
  "y_pos": 20,
  "width_pct": 25,
  "height_pct": 15,
  "metadata": {}
}
```

A criação chama a RPC real:

```text
create_image_occlusion_note(p_note_id, p_boxes)
```

O backend v2 associa a oclusão à nota existente. O `OcclusionCard` permite revelar cada máscara individualmente.

### 7.10 Gamificação

`gamificationService` consulta:

- `user_gamification_profiles`;
- `badges_definition`;
- `user_badges`.

A UI apresenta XP, nível, streak e badges desbloqueadas. Badges não obtidas permanecem visíveis com estado visual atenuado. A atribuição de XP usa a RPC existente `add_user_xp` quando ativada pelo fluxo correspondente.

### 7.11 Exames e modo de estudo

`examService` usa `deck_exams` e a RPC:

```text
get_due_cards_with_exam_schedule(p_deck_id, p_limit)
```

O agendamento é baseado em deck, data-alvo e prioridade. A fila devolve cartão, estado, vencimento, exame associado, dias restantes e fator de agendamento. O status inicial de um exame criado pelo frontend é `active`.

---

## 8. Rotas

| Rota | Funcionalidade | Flag |
|---|---|---|
| `/` | Dashboard, decks, XP e cartões do dia | — |
| `/decks` | Biblioteca de decks com fallback local | — |
| `/decks/new` | Criação de deck | — |
| `/decks/[deckId]` | Detalhe e métricas do deck | — |
| `/decks/[deckId]/cards` | CRUD de cards e notes | — |
| `/decks/[deckId]/occlusion/new` | Upload e editor de oclusão | `occlusion` |
| `/study/[deckId]` | Sessão de estudo e ratings | — |
| `/search` | Busca semântica/lexical | `semantic_search` |
| `/import/anki` | Upload `.apkg` | `anki_io` |
| `/export/anki` | Exportação de deck `.apkg` | `anki_io` |
| `/import/url` | Importação CSV/Markdown/etc. via URL | `import_url` |
| `/import/ai-ingest` | Ingestão de texto, URL e PDF | `ai_ingest` |
| `/media/[id]` | Visualização de mídia | `media`/fluxo de mídia |
| `/settings/fsrs-optimize` | Pedido e consulta FSRS | `fsrs_opt` |
| `/profile/badges` | XP, nível, streak e badges | `gamification` |
| `/exams` | Exames e agenda de estudo | `exams` |
| `/analytics` | Retenção, precisão e atividade | — |
| `/profile` | Perfil e sign out | — |
| `/login` | Login | — |
| `/register` | Registo | — |

---

## 9. Serviços frontend

| Serviço | Responsabilidade | Acesso remoto |
|---|---|---|
| `http/edge-client.ts` | Auth, timeout, retry e normalização de erros | Todas as Edge Functions |
| `anki-service.ts` | Upload/import/export Anki | `anki-transfer`, Storage |
| `import-deck-service.ts` | Upload e processamento de formatos | `import-deck`, Storage |
| `semantic-search-service.ts` | Busca com fallback | `semantic-search` |
| `optimizer-service.ts` | FSRS request/run/status | `fsrs-optimize`, Data API |
| `ingestion-service.ts` | Jobs IA, fontes e rascunhos | `ai-ingest`, Data API |
| `media-service.ts` | Upload e URLs assinadas | Storage `card-media` |
| `occlusion-service.ts` | Caixas e cartões de oclusão | RPC `create_image_occlusion_note` |
| `gamification-service.ts` | Perfil, badges e XP | Tabelas e `add_user_xp` |
| `exam-service.ts` | CRUD e fila de exames | `deck_exams`, RPC de agenda |
| `study-service.ts` | Review otimista | `fsrs-review`, outbox |
| `edge-service.ts` | Compatibilidade com serviços legados | Delegação para wrapper |

Como regra, novas chamadas de Edge Function devem usar exclusivamente `invokeEdge`. Chamadas diretas a `functions.invoke` não devem ser adicionadas fora do wrapper.

---

## 10. Persistência local, sincronização e outbox

### Entidades locais

O schema Dexie mantém tabelas para decks, notes, cards, templates, tags, reviews, estado de aprendizagem, mídia, jobs de IA, runs FSRS, gamificação, badges, exames, sessões socráticas, referências e metadados de sincronização.

Cada entidade sincronizável pode carregar:

- `id`;
- `user_id`;
- `usn`;
- `updated_at`;
- `deleted_at`;
- `_dirty`;
- `_synced_at`.

### Sync incremental

A chamada ao backend é:

```json
{
  "last_usn": 0,
  "limit": 500
}
```

A resposta pode conter `data`, `next_usn` e `has_more`. O frontend normaliza a resposta, separa `is_deleted`, ordena pelo USN, materializa tombstones antes dos registros ativos e só então atualiza `sync_meta.last_usn`.

### Repositórios

`BaseRepository` fornece:

- `create` com UUID e `_dirty`;
- `update`;
- `softDelete`;
- `get`;
- `listByUser`;
- `dirtyFor`;
- `markSynced`;
- `bulkUpsertFromServer`.

Os repositórios concretos ficam em `lib/db/repositories/` e são registados por `sync-registry.ts`.

### Worker

O worker é iniciado pelo shell global e pode reagir a:

- intervalo configurado;
- evento `online`;
- retorno de foco da janela;
- pós-escrita local.

O worker deve continuar opt-in em ambientes de desenvolvimento até as regras de rollout remoto estarem definidas.

---

## 11. Contratos com o backend

O frontend foi validado contra [barrosrafa/Flashi, branch `v2`](https://github.com/barrosrafa/Flashi/tree/v2). As Edge Functions consumidas são:

| Função | Uso |
|---|---|
| `sync` | Pull incremental por `last_usn` |
| `fsrs-review` | Submissão idempotente de review |
| `embeddings` | Atualização de embedding de nota |
| `semantic-search` | Busca semântica/lexical |
| `fsrs-optimize` | Enfileirar/executar otimização |
| `anki-transfer` | Importar/exportar `.apkg` |
| `ai-ingest` | Criar job de ingestão |
| `import-deck` | Materializar CSV/Markdown/Quizlet/RemNote |

RPCs e tabelas relevantes:

- `create_image_occlusion_note`;
- `get_due_cards_with_exam_schedule`;
- `add_user_xp`;
- `get_fsrs_optimization_status`;
- `enqueue_fsrs_optimization`;
- `claim_fsrs_optimization_job`;
- `complete_fsrs_optimization_job`;
- `fail_fsrs_optimization_job`;
- `decks`;
- `notes`;
- `cards`;
- `card_media`;
- `deck_exams`;
- `ai_ingestion_jobs`;
- `anki_transfer_jobs`;
- `user_gamification_profiles`;
- `badges_definition`;
- `user_badges`.

### Divergências importantes do SDD

| Tema | Exemplo do SDD | Contrato efetivo usado |
|---|---|---|
| Oclusão | `p_deck_id`, `p_media_asset_id` e resposta `{ note_id, card_ids }` | `p_note_id`, `p_boxes`, resposta com `card_id`/`cloze_ordinal` |
| Importação URL | Edge Function recebe URL | Browser baixa e envia `storage_path` para `import-deck` |
| FSRS status | Ação Edge `status` | Consulta a tabela `fsrs_optimization_runs` |
| IA status | Ação Edge `status` | Consulta `ai_ingestion_jobs` |
| Gamificação | `gamification_profiles` | `user_gamification_profiles` |
| Badges | `badge_definitions` | `badges_definition` |
| Exames | `socratic_enabled` em todos os writes | Campos/tipos disponíveis em `deck_exams` e RPC real |

A regra adotada é não inventar RPCs, argumentos ou tabelas inexistentes no backend.

---

## 12. Segurança e tratamento de erros

### Auth

`invokeEdge` verifica `auth.getSession()` antes da chamada. Sem sessão, lança `AuthRequiredError` com status lógico `401` e não executa a Edge Function.

### Timeout e retry

- timeout default: 30 segundos;
- operações longas podem definir 60 ou 120 segundos;
- falhas transitórias são repetidas com backoff exponencial;
- `429` não é repetido automaticamente;
- `401`/`403` não são repetidos;
- `503` pode ser convertido em `UnavailableError` quando o serviço precisa acionar fallback lexical.

### Rate limit

`RateLimitError` expõe `retryAfterSec`. `RateLimitBanner` mostra countdown e `EdgeErrorNotice` apresenta feedback global. O event bus está em `lib/services/http/event-bus.ts`.

### RLS e Storage

- Todas as queries autenticadas devem filtrar por propriedade quando aplicável.
- Buckets de mídia e Anki são privados.
- Downloads usam URLs assinadas com TTL curto.
- Caminhos de upload são derivados do `user.id` autenticado.
- O frontend não usa credenciais administrativas.

### Observabilidade

A telemetria local não deve conter conteúdo de cartões, tokens ou passwords. Para investigar um problema, correlacione:

1. mensagem exibida na UI;
2. erro tipado do serviço;
3. logs da Edge Function;
4. `client_mutation_id`, `client_review_id` ou UUID da entidade.

---

## 13. Testes e validação

### Comandos frontend

```bash
pnpm typecheck
pnpm test
pnpm build
```

Resultados da validação da `feature/v3`:

- TypeScript: **passou sem erros**;
- Vitest: **11 testes passaram**;
- build Next.js: **passou**;
- `git diff --check`: **passou**.

A suíte unitária cobre:

- sessão ausente e erro `401`;
- resposta bem-sucedida de Edge Function;
- rate limit `429` e `retryAfterSec`;
- retry de falhas `5xx`;
- fallback para indisponibilidade `503`;
- timeout tipado;
- validação das coordenadas de oclusão;
- cursor, records e tombstones de sincronização.

### Validação backend

No clone do backend `Flashi@v2` foram executados:

```bash
python3 validate_sql.py
python3 validate_snapshot.py
python3 validate_readme.py
python3 -m pytest -q
```

Resultado validado:

- todas as migrations foram parseadas;
- snapshot e README passaram;
- **9 testes e 174 subtestes passaram**.

Também foi executada uma auditoria automática de chamadas Edge: as 7 funções consumidas pelo frontend existem no inventário do backend; nenhuma função ficou sem implementação correspondente.

### E2E

```bash
pnpm test:e2e
```

Os testes E2E dependem de Chromium e, nos cenários autenticados, de variáveis de uma conta de QA. Não devem ser interpretados como teste de contrato remoto quando executados sem sessão/configuração.

---

## 14. Desenvolvimento

### Criar uma nova feature

1. Confirmar a tabela, RPC ou Edge Function no backend.
2. Adicionar/ajustar a flag em `lib/config/feature-flags.ts`.
3. Criar ou ajustar o serviço em `lib/services/`.
4. Reutilizar `invokeEdge` para Edge Functions.
5. Adicionar ou atualizar o repositório local quando a entidade for offline-first.
6. Guardar a UI com `isEnabled(...)`.
7. Adicionar testes unitários.
8. Executar typecheck, testes e build.
9. Atualizar esta documentação com qualquer divergência contratual.

### Estilo de commits

Prefira commits pequenos e descritivos, por exemplo:

```text
feat: add semantic search fallback
fix: preserve sync tombstones
 test: cover edge rate limit
```

### Branch atual

```text
feature/v3
```

Commit de implementação documentado:

```text
9f889d7 feat: implement SDD v3 frontend features
```

---

## 15. Troubleshooting

| Sintoma | Causa provável | Ação |
|---|---|---|
| `AUTH_REQUIRED` | Não existe sessão válida | Fazer login novamente e verificar cookies do Supabase |
| `401` ou `403` numa Edge Function | JWT expirado ou RLS/policy | Reautenticar e consultar logs/backend |
| `RATE_LIMITED` | Limite da função atingido | Aguardar o countdown exibido pelo `RateLimitBanner` |
| Busca semântica falha com `503` | Provider de embeddings indisponível | O serviço tenta modo lexical; verificar logs se ambos falharem |
| Importação URL falha por CORS | Origem não permite download pelo browser | Fazer upload manual do arquivo ou usar uma origem com CORS |
| `APKG_TOO_LARGE` | Pacote acima de 50 MiB | Reduzir o pacote ou separar a importação |
| `IMPORT_TOO_LARGE` | Arquivo acima de 15 MiB | Reduzir o arquivo antes do upload |
| Oclusão rejeitada | Caixa fora de 0–100 ou sem área | Ajustar retângulos dentro dos limites da imagem |
| Job IA fica `queued` | Worker backend ainda não processou | Consultar `ai_ingestion_jobs`; não salvar automaticamente |
| Tela mostra recurso desativado | Flag correspondente está em `0` | Ativar a variável em `.env.local` e reiniciar o dev server |
| Deck/cartão não aparece | RLS, sessão ou fallback local | Verificar sessão, console, policies e status remoto |
| Build funciona mas integração falha | Ambiente sem URL/chave válida | Confirmar `.env.local`; nunca copiar `service_role` para o frontend |

---

## 16. Limitações e decisões contratuais

1. **A origem de importação por URL precisa de CORS.** O frontend não introduz um proxy server-side que não existe no contrato atual.
2. **A oclusão usa uma nota existente.** O backend v2 não recebe `deck_id` e `media_asset_id` na RPC de oclusão; a associação da mídia pode exigir evolução posterior do backend.
3. **O status de jobs é consultado por Data API.** Nem `fsrs-optimize` nem `ai-ingest` expõem uma ação pública de status no contrato auditado.
4. **A criação de note + card legado continua sendo composta.** Quando aplicável, duas escritas consecutivas podem exigir uma RPC transacional futura.
5. **A ativação das flags deve ser gradual.** Ativar todas as funcionalidades simultaneamente em produção não substitui testes com utilizadores, Storage e workers configurados.
6. **A cobertura E2E autenticada depende de uma conta de QA.** Nenhuma credencial deve ser commitada ou colocada nesta documentação.
7. **Findings do banco pertencem ao backend.** Policies, índices e funções `SECURITY DEFINER` devem ser revisados no repositório `Flashi`, não corrigidos com workarounds no frontend.

---

## 17. Checklist de release

- [ ] `pnpm install` concluído sem alterações inesperadas.
- [ ] `.env.local` não está versionado.
- [ ] `pnpm typecheck` passa.
- [ ] `pnpm test` passa.
- [ ] `pnpm build` passa.
- [ ] Flags foram ativadas apenas para funcionalidades validadas.
- [ ] Contratos do frontend foram comparados com a branch backend alvo.
- [ ] Storage buckets e policies foram confirmados no Supabase.
- [ ] Cenários `401`, `429`, `503` e timeout foram testados.
- [ ] Importação Anki foi testada com pacote dentro do limite.
- [ ] Importação URL foi testada com origem CORS compatível.
- [ ] Oclusão foi testada com coordenadas percentuais válidas.
- [ ] Jobs IA não salvam notas sem revisão humana.
- [ ] Teste E2E autenticado foi executado com conta de QA, quando disponível.
- [ ] Diff foi verificado com `git diff --check`.
- [ ] Branch e commit foram publicados no remoto.

---

## 18. Referências

- [Repositório frontend — `barrosrafa/app-flashi`](https://github.com/barrosrafa/app-flashi)
- [Branch frontend — `feature/v3`](https://github.com/barrosrafa/app-flashi/tree/feature/v3)
- [Repositório backend — `barrosrafa/Flashi`](https://github.com/barrosrafa/Flashi)
- [Backend branch — `v2`](https://github.com/barrosrafa/Flashi/tree/v2)
- [Next.js Proxy](https://nextjs.org/docs/app/getting-started/proxy)
- [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Supabase JavaScript `functions.invoke`](https://supabase.com/docs/reference/javascript/functions-invoke)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)

---

**Última atualização:** implementação e validação da `feature/v3`.
