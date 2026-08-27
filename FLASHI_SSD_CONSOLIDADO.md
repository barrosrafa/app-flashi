# SSD — Flashi Frontend
## Especificação de Arquitetura de Software (Consolidada e Auditada contra o repositório real)

**Versão:** 3.0 — auditada em 27/08/2026 contra `barrosrafa/Flashi` (README.md + `docs/SUPABASE_API.md`), commit atual da branch `main`.
**Substitui:** SSD v2.0 e `PASSO_A_PASSO_DESENVOLVIMENTO.md` anteriores, cujas divergências estão listadas na Seção 0.
**Projeto Supabase:** `flashi` — `https://ykyobzoxoiljyueasdwc.supabase.co`

> ⚠️ Este documento cobre **apenas o frontend**. O backend (schema, RLS, RPCs, Edge Functions) já está implementado no repositório `barrosrafa/Flashi` e é tratado aqui como contrato fixo, não como algo a redesenhar.

---

## 0. Nota do Analista — Divergências Corrigidas

A tabela abaixo já foi apresentada no chat antes deste arquivo; está reproduzida aqui para que o SSD seja autocontido e qualquer pessoa da equipe entenda por que este documento diverge das versões anteriores.

| # | Documento anterior | Realidade verificada | Correção aplicada neste SSD |
|---|---|---|---|
| 1 | Migração `0025` de rate limiting | Não existe no repo (para em `0024`) | Removida toda menção a `X-RateLimit-*`; Seção 15 documenta o que fazer na ausência de rate limit nativo |
| 2 | Bucket `transfers` | Bucket real é `anki-transfers` | Corrigido em todas as seções de Storage e Anki |
| 3 | Edge Function `generate-exam` (quiz por IA) | Não existe; `0024` implementa *agendamento por prioridade*, não geração de perguntas | Seção 12 reescrita around `deck_exams` + `get_due_cards_with_exam_schedule` |
| 4 | Schema local com 6 tabelas | Backend expõe ~24 entidades sincronizáveis | Seção 4 cobre o schema completo |
| 5 | Sync parseado como `{changes, graves}` aninhado | RPC real retorna lista plana `{entity_type, entity_key, usn, is_deleted, payload}` | Motor de sync na Seção 5 reescrito |
| 6 | Tabela `exams` com `questions/answers/score` | `deck_exams` real: `exam_name`, `target_date`, `priority_level`, `status` | Corrigido |
| 7 | Tabela `badges` única | Reais: `user_gamification_profiles`, `badges_definition`, `user_badges` | Corrigido |
| 8 | Next.js 14+/15+ | Padrão vigente do time: Next.js 16.1 | Seção 2 trata a tensão Server-first vs. offline-first |
| 9 | Chave `sb_publishable_...` tratada como possível segredo | É a chave pública sucessora do `anon key`, segura para expor (RLS aplica) | Ver Seção 15.1 |
| 10 | Local de migrações não mencionado | Migrações na raiz do repo, precisam ser movidas para `supabase/migrations/` | Seção 19 (roadmap) inclui o passo |
| 11 | Sem estratégia de app shell offline | Só cache de dados era coberto | Seção 2.3 adiciona Service Worker/PWA |

**Inconsistência interna do próprio backend que a equipe deve confirmar antes de codar:** o topo do README do Flashi afirma que "as migrações `0001` até `0023` estão versionadas", mas a Seção 19 do mesmo README e o `docs/SUPABASE_API.md` descrevem a `0024_gamification_exams_socratic.sql` em detalhe, incluindo RPCs já publicadas (`add_user_xp`, `get_due_cards_with_exam_schedule`, `resolve_socratic_remediation`). Isso sugere que a nota do topo ficou desatualizada em relação ao restante do documento. **Antes de codar a Seção 12 deste SSD, rode `supabase migration list` (ou confira o SQL Editor/Migrations do dashboard) para confirmar que `0024` está de fato aplicada no projeto `flashi`.** Se não estiver, essas telas ficam behind a feature flag até a migração ser aplicada.

---

## 1. Visão Geral do Produto

**Nome:** Flashi
**Tipo:** PWA de flashcards com repetição espaçada (local-first, multi-dispositivo)
**Público-alvo:** Estudantes que memorizam grandes volumes de conteúdo (concursos, medicina, idiomas) e precisam estudar offline (metrô, avião, sala sem sinal)
**Objetivo principal:** Permitir criar, estudar e sincronizar decks de flashcards com agendamento FSRS-6, funcionando 100% offline para o fluxo de estudo

### Requisitos Funcionais

| # | Feature | Prioridade | Observações |
|---|---------|-----------|-------------|
| 1 | Auth (login/registro/reset) | Alta | `@supabase/ssr`, cookies HttpOnly |
| 2 | CRUD de decks/subdecks hierárquicos | Alta | `parent_deck_id`, árvore via `v_deck_tree` |
| 3 | CRUD de notas com múltiplos tipos de cartão (Basic, Reverse, Cloze) | Alta | `notes` + `note_card_definitions` |
| 4 | Estudo offline com FSRS-6 | Alta | Cálculo otimista local + confirmação via Edge Function |
| 5 | Sincronização incremental multi-dispositivo | Alta | Cursor USN monotônico |
| 6 | Upload de mídia com verificação de integridade | Alta | SHA-256, bucket privado `card-media` |
| 7 | Oclusão de imagem | Média | RPC `create_image_occlusion_note()` |
| 8 | Busca semântica com fallback léxico | Média | Depende de `OPENAI_API_KEY` no backend |
| 9 | Ingestão de conteúdo por IA (PDF/YouTube/texto/web) | Média | Cliente só cria o job; processamento é assíncrono |
| 10 | Importação/exportação Anki `.apkg` | Média | Limite 50 MiB, sem preservar scheduling na exportação |
| 11 | Gamificação (XP/nível/badges) | Baixa | `add_user_xp()`, fórmula de nível conhecida |
| 12 | Agendamento de exames por prioridade | Baixa | **Não é geração de perguntas por IA** |
| 13 | Remediação socrática de leeches | Baixa | Sessão de chat guiado quando `lapses >= 4` |
| 14 | Compartilhamento de decks (viewer/editor) | Baixa | `deck_collaborators` |

### Requisitos Não-Funcionais
- Performance: LCP < 2.5s nas rotas públicas/SSR; tela de estudo deve responder a um rating em < 100ms localmente (sem esperar rede)
- Offline: fluxo de estudo, criação de conteúdo e navegação por decks já sincronizados devem funcionar 100% sem rede, incluindo o *app shell* (não só os dados)
- Acessibilidade: WCAG 2.1 AA
- Compatibilidade: navegadores com suporte a IndexedDB, Service Worker e `crypto.subtle` (Chrome 90+, Safari 15.4+, Firefox 90+)
- Idioma: pt-BR

---

## 2. Arquitetura Técnica

### 2.1 A tensão central: Server-first (padrão do time) vs. Local-first (exigência do produto)

O padrão vigente para novos projetos prioriza Server Components, Server Actions e `fetch` nativo com cache, evitando estado de cliente sempre que possível. Isso é correto para 90% dos apps, mas **Flashi não é um CRUD comum**: o requisito "estudar offline" é inegociável, e Server Actions dependem de round-trip de rede — não existem sem conexão.

**Decisão arquitetural (híbrida, não é desvio arbitrário do padrão):**

| Camada | Renderização | Mutação | Justificativa |
|---|---|---|---|
| Rotas públicas (landing, termos) | Server Components, SSG | — | Sem necessidade de estado de cliente; segue o padrão puro |
| Auth (login/registro/reset) | Server Components + Server Actions | Server Actions com Zod | Exige rede de qualquer forma (contra `auth.supabase`) |
| Decks / Notas / Cards / Estudo / Sync | Client Components | `@supabase/supabase-js` direto do cliente + fila outbox (Dexie) | Precisa funcionar offline; Server Action é inviável aqui |
| Configurações não-críticas (perfil, preferências) | Server Components para leitura, Server Actions para escrita | Server Actions com Zod | Não faz sentido offline; não faz parte do loop de estudo |

Isso não é "abandonar" o padrão — é aplicá-lo onde ele se encaixa (site público, auth, configurações) e reconhecer explicitamente onde ele não se aplica (o núcleo offline-first). Documentar essa decisão evita que outro desenvolvedor "corrija" o código de estudo para usar Server Actions e quebre o offline.

### 2.2 Stack

| Camada | Tecnologia | Justificativa |
|---|---|---|
| Framework | Next.js 16.1 (App Router, Turbopack) | Padrão vigente; Server Components para as rotas que não exigem offline |
| Linguagem | TypeScript estrito | Tipos gerados via `supabase gen types typescript` a partir do projeto `flashi` |
| Estilização | Tailwind CSS + CVA | Padrão vigente |
| Design System | shadcn/ui + Radix UI | Componentes acessíveis, base para variantes CVA |
| Persistência local | **Dexie.js** sobre IndexedDB | Já validada nos docs anteriores; simplicidade e maturidade superam RxDB/PGLite para este escopo |
| Cliente cloud | `@supabase/supabase-js` (cliente) + `@supabase/ssr` (auth/SSR) | Contrato oficial do backend |
| Estado servidor (rotas não-offline) | `fetch` nativo + cache/`revalidateTag` | Padrão vigente |
| Estado cliente complexo (status de sync, fila offline, contador de pendências) | **Zustand** | Estado genuinamente global e efêmero — não é dado de URL nem prop drilling; é exatamente o caso de exceção previsto no próprio guia de stack ("Zustand apenas se URL/Composition não forem suficientes") |
| Validação | Zod | Client-side (antes de enfileirar mutação offline) e server-side (Server Actions) |
| Formulários | `react-hook-form` + `@hookform/resolvers/zod` | — |
| Gráficos | Recharts, via `next/dynamic` | Streaming/CSR conforme guia de Data Viz |
| PWA / offline shell | `next-pwa` ou Serwist (Workbox para App Router) | Ausente nos docs anteriores — necessário para abrir o app sem rede |
| Confetes | `canvas-confetti` | Feedback de sessão concluída |
| KaTeX | `katex` | Renderização de fórmulas em cartões |

### 2.3 App Shell Offline (lacuna dos docs anteriores)

IndexedDB guarda dados, mas sem Service Worker o navegador não consegue nem carregar o HTML/JS/CSS do app sem rede — o usuário veria a tela de "sem conexão" do navegador, não o Flashi. É necessário:

1. `manifest.json` com ícones, `display: standalone`, `start_url`.
2. Service Worker (via Serwist, compatível com App Router do Next 16) fazendo *precache* do app shell e *runtime cache* (stale-while-revalidate) para rotas de estudo já visitadas.
3. Estratégia de cache separada para chamadas ao Supabase REST/RPC: **network-only com fallback para fila outbox**, nunca cache de resposta de mutação.

### 2.4 Estrutura de Pastas

```
src/
├── app/
│   ├── (public)/                 # SSG — landing, termos
│   ├── (auth)/                   # Server Components + Server Actions
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   ├── reset-password/page.tsx
│   │   └── update-password/page.tsx
│   ├── (app)/                    # Client-heavy, protegido por middleware
│   │   ├── decks/
│   │   │   ├── page.tsx
│   │   │   ├── [deckId]/page.tsx        # params assíncronos (Next 16)
│   │   │   └── import/page.tsx
│   │   ├── study/[deckId]/page.tsx
│   │   ├── exams/page.tsx               # agendamento por prioridade, não quiz IA
│   │   ├── analytics/page.tsx
│   │   └── profile/page.tsx
│   ├── manifest.ts                # PWA manifest (Next 16 metadata API)
│   ├── loading.tsx
│   └── error.tsx
├── components/
│   ├── ui/                        # shadcn/ui + CVA
│   ├── study/                     # TemplateRenderer, StudySession, ImageOcclusion
│   ├── sync/                      # SyncStatusBadge, OfflineIndicator
│   └── layout/
├── lib/
│   ├── supabase/{client,server,middleware}.ts
│   ├── db/                        # Dexie: schema + repositórios
│   │   ├── schema.ts
│   │   ├── sync-engine.ts
│   │   └── outbox-queue.ts
│   ├── actions/                   # Server Actions (só auth/perfil)
│   ├── schemas/                   # Zod
│   ├── srs/fsrs6-client.ts        # cálculo otimista local
│   └── stores/                    # Zustand (sync status, fila offline)
├── sw/                             # Service Worker (Serwist)
└── types/database.ts               # gerado via supabase gen types
```

---

## 3. Contrato do Backend (verificado contra o repositório)

### 3.1 Migrações (ordem obrigatória, `0001` → `0024`)

> As migrações estão na **raiz do repositório**, não em `supabase/migrations/`. Antes de `supabase db push`, copie-as preservando nomes e ordem, ou aplique via SQL Editor em homologação primeiro.

| Arquivo | Função |
|---|---|
| `0001_types.sql` | Enums de domínio (`card_state`, `review_rating`, `deck_visibility`, `srs_algorithm`, `media_type`, `collaborator_role`) |
| `0002_profiles.sql` | Perfil 1:1 com `auth.users` |
| `0003_decks.sql` | Decks, subdecks, `deck_collaborators` |
| `0004_tags_templates.sql` | Tags e `card_templates` |
| `0005_cards_media.sql` | `cards`, `card_tags`, `card_media` |
| `0006_learning_reviews.sql` | `card_learning_state`, `review_logs` (append-only) |
| `0007_settings_statistics.sql` | `study_settings`, `user_deck_settings`, `daily_statistics` |
| `0008_triggers_functions.sql` | `set_updated_at()`, `handle_new_user()`, `prevent_review_log_mutation()` |
| `0009_rls_policies.sql` | RLS de todas as entidades base |
| `0010_views_rpc.sql` | `v_deck_tree`, `get_due_cards()`, `record_review()`, `get_current_streak()`, `soft_delete_deck()` |
| `0011_storage.sql` | Bucket privado `card-media` + policies |
| `0012_fsrs6_notes_embeddings.sql` | Separação nota/cartão, Cloze, FSRS-6, `notes.embedding` (pgvector 1536d) |
| `0013_incremental_sync_usn_graves.sql` | USN global + `graves` (tombstones) |
| `0014_interoperability_mcp.sql` | Provenance, jobs Anki, `mcp_tool_audit`, RPCs MCP |
| `0015_hardening_workers_contracts.sql` | Idempotência de revisão, `sha256_hash`, índices compostos |
| `0016_security_advisors_hardening.sql` | Hardening de `search_path`, remove EXECUTE público indevido |
| `0017_fix_rls_recursion_and_fk_indexes.sql` | Corrige recursão de RLS, índices de FK faltantes |
| `0018_search_optimizer_anki_contracts.sql` | Bucket **`anki-transfers`**, contratos de jobs FSRS, RPC `.apkg` |
| `0019_fsrs_scheduler.sql` | `pg_cron`/`pg_net`, helper de agendamento com secret no Vault |
| `0020_move_pg_net_registration.sql` | Move `pg_net` para schema `extensions` |
| `0021_ai_ingestion_occlusion_references.sql` | `ai_ingestion_jobs`, oclusão de imagem, `note_references` |
| `0022_harden_image_occlusion_grant.sql` | Remove EXECUTE público da RPC de oclusão |
| `0023_security_definer_cleanup.sql` | `search_path` explícito no sync, RPC de oclusão vira `SECURITY INVOKER` |
| `0024_gamification_exams_socratic.sql` | XP/níveis/badges, `deck_exams` (agendamento por prioridade), remediação socrática |

**Não existe `0025`.** Se alguém mencionar rate limiting por usuário/função, trata-se de trabalho futuro não implementado — não construa UI que dependa de headers `X-RateLimit-*`.

### 3.2 Edge Functions (8, todas Deno/TypeScript, `verify_jwt=true`)

| Função | Autorização | Entrada | Saída | Nunca chamar do frontend com... |
|---|---|---|---|---|
| `sync` | JWT de usuário | `last_usn`, `limit` | lista de mudanças ordenada por `usn`, `next_usn`, `has_more` | — |
| `fsrs-review` | JWT de usuário | `card_id`, `rating`, `client_review_id`, `time_spent_ms` | novo estado FSRS confirmado | — |
| `embeddings` | JWT de usuário | `note_id` | modelo, dimensão, hash, status | — |
| `semantic-search` | JWT de usuário | `query`, `limit`, `mode` (`semantic`\|`lexical`), `request_id` | resultados + metadados | — |
| `fsrs-optimize` | JWT de usuário | `mode: "request"` ou `mode: "run", run_id` | job enfileirado ou pesos calculados | — |
| `fsrs-optimize-worker` | JWT com claim `role: service_role` | `run_id?`, `limit?` | jobs processados | **service_role — servidor/cron apenas, jamais no cliente** |
| `anki-transfer` | JWT de usuário | `action: import\|export`, path/deck | job, contadores, path do `.apkg` | — |
| `ai-ingest` | JWT de usuário | `deck_id`, `source_type`, `content`/`storage_path` | `job_id` em `queued` | — |

Todas as funções de usuário usam `createUserClient(request)` — o JWT do usuário é repassado e o banco deriva `auth.uid()`. **Nenhuma função de usuário precisa nem deve receber `service_role`.**

### 3.3 Storage

| Bucket | Visibilidade | Path obrigatório | Observação |
|---|---|---|---|
| `card-media` | Privado | `{user_id}/{card_id}/{asset_id}.{ext}` | SHA-256 obrigatório em `sha256_hash` |
| `anki-transfers` | Privado | `{user_id}/imports/*.apkg` ou `{user_id}/exports/*.apkg` | **Nome corrigido — não é `transfers`** |

Nunca gere URL pública permanente para esses buckets; use URLs assinadas de curta duração quando necessário.

### 3.4 Secrets do backend (nunca no frontend)

| Secret | Usado por | Nunca fazer |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` (ou `sb_secret_...`) | `fsrs-optimize-worker` | Enviar ao cliente ou ao GitHub |
| `OPENAI_API_KEY` | `embeddings`, `semantic-search` | Logar ou colocar no README/frontend |

### 3.5 RPCs relevantes ao frontend (assinaturas confirmadas)

| RPC | Chamada | Retorno |
|---|---|---|
| `add_user_xp(p_user_id uuid, p_xp_amount int)` | `POST /rest/v1/rpc/add_user_xp` | `user_gamification_profiles` atualizado; `p_user_id` **deve** ser `auth.uid()` |
| `get_due_cards_with_exam_schedule(p_deck_id uuid, p_limit int)` | idem | fila de cartões com `exam_id`, `exam_name`, `days_remaining`, `scheduling_factor` |
| `resolve_socratic_remediation(p_session_id uuid)` | idem | sessão finalizada; reabilita o cartão (`is_suspended=false`, `lapses=0`, `due_at=now()`) |
| `get_incremental_sync(p_after_usn bigint, p_limit int)` | idem | **lista plana**: `entity_type`, `entity_key`, `usn`, `is_deleted`, `payload` |
| `get_due_cards(p_deck_id uuid, p_limit int)` | idem | fila básica sem exame |
| `record_review_fsrs6_idempotent(...)` | via Edge Function `fsrs-review`, não direto | log + estado + estatística, idempotente por `client_review_id` |
| `create_image_occlusion_note(p_note_id uuid, p_boxes jsonb)` | idem | um cartão Cloze por caixa, com `card_id`/`cloze_ordinal` |

**Fórmula de nível confirmada:** `level_current = floor(sqrt(xp_total / 100)) + 1`.

**Prioridades de exame confirmadas:** `priority_level` ∈ `{exam_urgent, currently_studying, maintaining, paused}`; `status` ∈ `{active, completed, cancelled}`. Fator de agendamento: `1.0` (sem exame/>30 dias), `1.2` (≤30 dias), `1.5` (≤7 dias), `2.0` (vencido/hoje).

---

## 4. Modelo de Dados Local (IndexedDB via Dexie) — Completo

O schema anterior cobria 6 das ~24 entidades sincronizáveis. Abaixo, o schema completo, agrupado por domínio. Todas as tabelas com `usn` participam do ciclo de sync; a tabela `sync_meta` guarda o cursor (substituindo o uso de `localStorage`, que não existe dentro de um Service Worker).

```typescript
// lib/db/schema.ts
import Dexie, { type Table } from 'dexie';

// --- Conteúdo ---
export interface LocalDeck { id: string; user_id: string; name: string; parent_deck_id: string | null; visibility: 'private'|'shared'|'public'; deleted_at: string | null; usn: number; }
export interface LocalDeckCollaborator { deck_id: string; user_id: string; role: 'viewer'|'editor'; }
export interface LocalTag { id: string; user_id: string; name: string; usn: number; }
export interface LocalCardTemplate { id: string; user_id: string | null; field_definitions: unknown; card_generation: unknown; usn: number; }
export interface LocalNote { id: string; deck_id: string; user_id: string; fields: Record<string, unknown>; tags: string[]; embedding?: number[] | null; deleted_at: string | null; usn: number; }
export interface LocalNoteCardDefinition { id: string; note_id: string; kind: 'basic'|'reverse'|'cloze'; order: number; template_id: string; definition: unknown; usn: number; }
export interface LocalNoteClozeDeletion { id: string; note_id: string; cloze_ordinal: number; text: string; position?: unknown; usn: number; }
export interface LocalCard { id: string; deck_id: string; note_id: string; template_id: string; fields: Record<string, unknown>; card_type: 'basic'|'reverse'|'cloze'|'image_occlusion'; is_suspended: boolean; deleted_at: string | null; usn: number; }
export interface LocalCardTag { card_id: string; tag_id: string; }
export interface LocalCardMedia { id: string; card_id: string; storage_path: string; storage_bucket: 'card-media'; media_type: 'image'|'audio'|'video'|'other'; sha256_hash: string; usn: number; }
export interface LocalNoteImageOcclusionBox { id: string; note_id: string; cloze_ordinal: number; box: { x:number;y:number;width:number;height:number }; usn: number; }
export interface LocalNoteReference { id: string; source_note_id: string; target_note_id: string; usn: number; }

// --- Progresso de aprendizagem ---
export interface LocalCardLearningState { card_id: string; user_id: string; state: 'new'|'learning'|'review'|'relearning'; interval_days: number; stability: number; difficulty: number; retrievability: number; due_at: string; elapsed_days: number; scheduled_days: number; lapses: number; is_suspended: boolean; last_reviewed_at?: string | null; algorithm: 'fsrs'|'sm2'; usn: number; }
export interface LocalReviewLog { id: string; card_id: string; user_id: string; rating: 'again'|'hard'|'good'|'easy'; reviewed_at: string; time_spent_ms: number; client_review_id: string; usn: number; } // append-only, nunca UPDATE/DELETE local

// --- Configuração e estatísticas ---
export interface LocalStudySettings { user_id: string; new_cards_per_day: number; fsrs_weights?: number[]; fsrs_desired_retention?: number; usn: number; }
export interface LocalUserDeckSettings { user_id: string; deck_id: string; overrides: Record<string, unknown>; usn: number; }
export interface LocalDailyStatistic { user_id: string; stat_date: string; cards_studied: number; new_cards_studied: number; usn: number; }
export interface LocalFsrsOptimizationRun { id: string; user_id: string; status: 'queued'|'running'|'completed'|'failed'; usn: number; }

// --- Gamificação (0024) ---
export interface LocalGamificationProfile { user_id: string; xp_total: number; level_current: number; usn: number; }
export interface LocalBadgeDefinition { id: string; code: string; label: string; } // catálogo público, sem usn de usuário
export interface LocalUserBadge { id: string; user_id: string; badge_id: string; awarded_at: string; usn: number; }

// --- Exames por prioridade (0024) — NÃO é quiz gerado por IA ---
export interface LocalDeckExam { id: string; user_id: string; deck_id: string; exam_name: string; target_date: string; priority_level: 'exam_urgent'|'currently_studying'|'maintaining'|'paused'; status: 'active'|'completed'|'cancelled'; usn: number; }

// --- Remediação socrática (0024) ---
export interface LocalSocraticSession { id: string; user_id: string; card_id: string; status: 'queued'|'processing'|'completed'; chat_history: unknown[]; usn: number; }

// --- Anki / IA ---
export interface LocalAnkiTransferJob { id: string; user_id: string; action: 'import'|'export'; status: 'queued'|'running'|'completed'|'failed'; sha256_hash: string; }
export interface LocalAiIngestionJob { id: string; user_id: string; deck_id: string; source_type: 'pdf_document'|'youtube_url'|'raw_text_block'|'web_page'; status: 'queued'|'processing'|'completed'|'failed'; usn: number; }

// --- Infra de sync/offline ---
export interface SyncMeta { key: 'last_usn'; value: number; }
export interface OfflineMutation { id: string; table_name: string; action: 'insert'|'update'|'delete'|'rpc'; rpc_name?: string; payload: Record<string, unknown>; created_at: string; retries: number; }

class FlashiLocalDatabase extends Dexie {
  decks!: Table<LocalDeck, string>;
  deck_collaborators!: Table<LocalDeckCollaborator, [string,string]>;
  tags!: Table<LocalTag, string>;
  card_templates!: Table<LocalCardTemplate, string>;
  notes!: Table<LocalNote, string>;
  note_card_definitions!: Table<LocalNoteCardDefinition, string>;
  note_cloze_deletions!: Table<LocalNoteClozeDeletion, string>;
  cards!: Table<LocalCard, string>;
  card_tags!: Table<LocalCardTag, [string,string]>;
  card_media!: Table<LocalCardMedia, string>;
  note_image_occlusion_boxes!: Table<LocalNoteImageOcclusionBox, string>;
  note_references!: Table<LocalNoteReference, string>;
  card_learning_state!: Table<LocalCardLearningState, string>;
  review_logs!: Table<LocalReviewLog, string>;
  study_settings!: Table<LocalStudySettings, string>;
  user_deck_settings!: Table<LocalUserDeckSettings, [string,string]>;
  daily_statistics!: Table<LocalDailyStatistic, [string,string]>;
  fsrs_optimization_runs!: Table<LocalFsrsOptimizationRun, string>;
  gamification_profiles!: Table<LocalGamificationProfile, string>;
  badges_definition!: Table<LocalBadgeDefinition, string>;
  user_badges!: Table<LocalUserBadge, string>;
  deck_exams!: Table<LocalDeckExam, string>;
  socratic_sessions!: Table<LocalSocraticSession, string>;
  anki_transfer_jobs!: Table<LocalAnkiTransferJob, string>;
  ai_ingestion_jobs!: Table<LocalAiIngestionJob, string>;
  sync_meta!: Table<SyncMeta, string>;
  offline_mutations_queue!: Table<OfflineMutation, string>;

  constructor() {
    super('FlashiLocalDB');
    this.version(1).stores({
      decks: 'id, parent_deck_id, user_id, usn, deleted_at',
      deck_collaborators: '[deck_id+user_id], deck_id, user_id',
      tags: 'id, user_id, usn',
      card_templates: 'id, user_id, usn',
      notes: 'id, deck_id, user_id, usn, deleted_at',
      note_card_definitions: 'id, note_id, usn',
      note_cloze_deletions: 'id, note_id, cloze_ordinal, usn',
      cards: 'id, deck_id, note_id, usn, deleted_at, is_suspended',
      card_tags: '[card_id+tag_id], card_id, tag_id',
      card_media: 'id, card_id, usn',
      note_image_occlusion_boxes: 'id, note_id, usn',
      note_references: 'id, source_note_id, target_note_id, usn',
      card_learning_state: 'card_id, user_id, state, due_at, usn',
      review_logs: 'id, card_id, user_id, client_review_id, usn',
      study_settings: 'user_id, usn',
      user_deck_settings: '[user_id+deck_id], usn',
      daily_statistics: '[user_id+stat_date], usn',
      fsrs_optimization_runs: 'id, user_id, status, usn',
      gamification_profiles: 'user_id, usn',
      badges_definition: 'id, code',
      user_badges: 'id, user_id, badge_id, usn',
      deck_exams: 'id, deck_id, user_id, status, priority_level, usn',
      socratic_sessions: 'id, user_id, card_id, status, usn',
      anki_transfer_jobs: 'id, user_id, status',
      ai_ingestion_jobs: 'id, user_id, deck_id, status, usn',
      sync_meta: 'key',
      offline_mutations_queue: 'id, table_name, action, created_at',
    });
  }
}

export const db = new FlashiLocalDatabase();
```

> ⚠️ **Decisão de escopo, não erro:** implementar as ~24 tabelas de uma vez no MVP é um esforço grande. A Seção 19 propõe uma ordem de implementação em fases — a tabela acima é o **alvo final do schema**, não uma exigência de "tudo no dia 1".

---

## 5. Motor de Sincronização (USN) — Corrigido

O erro dos documentos anteriores era assumir que a Edge Function `sync` devolve um objeto aninhado por tabela (`{ changes: { decks: [...] }, graves: [...] }`). O contrato real de `get_incremental_sync()` (confirmado em `docs/SUPABASE_API.md`) é uma **lista plana ordenada por `usn`**, cada item com `entity_type`, `entity_key`, `usn`, `is_deleted`, `payload`. Isso simplifica o motor — não precisa de um `if` por tabela para upsert e outro para grave; é um único loop com um mapa de `entity_type → tabela Dexie`.

```typescript
// lib/db/sync-engine.ts
import { db } from './schema';
import { createClient } from '@/lib/supabase/client';

const ENTITY_TABLE_MAP: Record<string, keyof typeof db> = {
  deck: 'decks', note: 'notes', card: 'cards',
  card_learning_state: 'card_learning_state', review_log: 'review_logs',
  card_template: 'card_templates', tag: 'tags', card_media: 'card_media',
  note_card_definition: 'note_card_definitions', note_cloze_deletion: 'note_cloze_deletions',
  study_setting: 'study_settings', user_deck_setting: 'user_deck_settings',
  daily_statistic: 'daily_statistics', fsrs_optimization_run: 'fsrs_optimization_runs',
  card_tag: 'card_tags',
  user_gamification_profile: 'gamification_profiles', user_badge: 'user_badges',
  deck_exam: 'deck_exams', socratic_remediation_session: 'socratic_sessions',
  note_image_occlusion_box: 'note_image_occlusion_boxes', note_reference: 'note_references',
  ai_ingestion_job: 'ai_ingestion_jobs',
};

const SYNC_PAGE_LIMIT = 500; // teto real da RPC é 5000; 500 é o default documentado

export async function executeIncrementalSync(): Promise<boolean> {
  const supabase = createClient();
  let lastUsn = (await db.sync_meta.get('last_usn'))?.value ?? 0;
  let hasMore = true;

  while (hasMore) {
    const { data: changes, error } = await supabase.rpc('get_incremental_sync', {
      p_after_usn: lastUsn,
      p_limit: SYNC_PAGE_LIMIT,
    });
    if (error) { console.error('[sync] falha:', error); return false; }
    if (!changes || changes.length === 0) break;

    await db.transaction('rw', db.tables, async () => {
      for (const change of changes) {
        const table = ENTITY_TABLE_MAP[change.entity_type];
        if (!table) { console.warn('[sync] entity_type desconhecido:', change.entity_type); continue; }
        if (change.is_deleted) {
          await (db[table] as any).delete(change.entity_key);
        } else {
          await (db[table] as any).put(change.payload);
        }
      }
    });

    // Só avança o cursor DEPOIS de persistir o lote inteiro localmente
    const maxUsn = Math.max(...changes.map((c: any) => Number(c.usn)));
    lastUsn = maxUsn;
    await db.sync_meta.put({ key: 'last_usn', value: lastUsn });

    hasMore = changes.length === SYNC_PAGE_LIMIT; // has_more não é campo do payload; infira pelo tamanho da página
  }
  return true;
}
```

> Confirme o formato exato do payload de retorno (se há ou não um campo explícito `has_more`) direto no `docs/SUPABASE_API.md` do commit em uso antes de codar — a versão consultada nesta auditoria só documenta `entity_type/entity_key/usn/is_deleted/payload`, sem `has_more` explícito; o fallback acima (comparar tamanho da página ao limite) é seguro nesse cenário.

---

## 6. Fila de Mutações Offline (Outbox)

Mantém a lógica dos docs anteriores (idempotência via UUID, retry com backoff, ordem preservada), mas com dois ajustes: suporte a **chamadas de RPC** (não só `insert/update/delete` diretos em tabela — necessário para `add_user_xp`, `resolve_socratic_remediation`, `create_image_occlusion_note`) e uso do `sync_meta` em vez de `localStorage`.

```typescript
// lib/db/outbox-queue.ts
import { db } from './schema';
import { createClient } from '@/lib/supabase/client';
import { executeIncrementalSync } from './sync-engine';

export async function enqueueMutation(
  tableName: string,
  action: 'insert' | 'update' | 'delete' | 'rpc',
  payload: Record<string, unknown>,
  rpcName?: string,
) {
  await db.offline_mutations_queue.add({
    id: crypto.randomUUID(),
    table_name: tableName,
    action,
    rpc_name: rpcName,
    payload,
    created_at: new Date().toISOString(),
    retries: 0,
  });
  if (typeof navigator !== 'undefined' && navigator.onLine) flushOutboxQueue();
}

export async function flushOutboxQueue() {
  const mutations = await db.offline_mutations_queue.orderBy('created_at').toArray();
  if (!mutations.length) return;
  const supabase = createClient();

  for (const mut of mutations) {
    try {
      let error;
      if (mut.action === 'rpc' && mut.rpc_name) {
        ({ error } = await supabase.rpc(mut.rpc_name, mut.payload));
      } else if (mut.action === 'delete') {
        ({ error } = await supabase.from(mut.table_name).delete().eq('id', mut.payload.id));
      } else {
        ({ error } = await supabase.from(mut.table_name).upsert(mut.payload));
      }
      if (error) throw error;
      await db.offline_mutations_queue.delete(mut.id);
    } catch (err) {
      console.error(`[outbox] falha na mutação ${mut.id}:`, err);
      await db.offline_mutations_queue.update(mut.id, { retries: (mut.retries ?? 0) + 1 });
      break; // preserva ordem; próximo flush retoma daqui
    }
  }
  await executeIncrementalSync();
}
```

---

## 7. Autenticação e Sessões (Next.js 16)

Estrutura igual à dos docs anteriores, com uma correção obrigatória: **no Next.js 16, `params`/`searchParams` de rota são assíncronos.** Qualquer página dinâmica (`app/(app)/decks/[deckId]/page.tsx`) precisa `await` esses valores.

```typescript
// app/(app)/decks/[deckId]/page.tsx
export default async function DeckPage({ params }: { params: Promise<{ deckId: string }> }) {
  const { deckId } = await params; // obrigatório no Next 16 — omitir quebra o build
  // ...
}
```

O middleware permanece client-agnostic (roda no Edge, não usa Dexie) e segue o padrão de `@supabase/ssr` com cookies HttpOnly já descrito nos docs anteriores — essa parte estava correta e foi mantida. Use `sb_publishable_...` (ou o `anon key` legado, ainda válido até o fim de 2026) tanto no middleware quanto no cliente do navegador; nunca a chave secreta.

---

## 8. Design System

- Tailwind + CVA para variantes (`Button`, `Input`, `Card`, `Badge` de gamificação).
- shadcn/ui como base de componentes acessíveis (Radix).
- Mobile-first: a tela de estudo é o caminho crítico e deve ser desenhada primeiro para telas pequenas (uso típico: metrô, fila).
- Tokens mínimos:

```css
:root {
  --color-primary: #4f46e5;
  --color-surface: #ffffff;
  --color-background: #f8f9fa;
  --color-again: #ef4444;   /* rating "De Novo" */
  --color-hard: #f59e0b;    /* rating "Difícil" */
  --color-good: #22c55e;    /* rating "Bom" */
  --color-easy: #3b82f6;    /* rating "Fácil" */
  --radius: 8px;
}
```

---

## 9. CRUD de Decks, Notas e Mídia

Mantém o padrão dos docs anteriores (upload com SHA-256, path `{user_id}/{card_id}/{asset_id}.{ext}`), com bucket corrigido e enfileiramento via outbox em vez de escrita direta:

```typescript
// lib/services/media-service.ts
import { createClient } from '@/lib/supabase/client';
import { db } from '@/lib/db/schema';
import { enqueueMutation } from '@/lib/db/outbox-queue';

export async function uploadCardMedia(file: File, userId: string, cardId: string) {
  const supabase = createClient();
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const sha256 = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  const extension = file.name.split('.').pop() || 'bin';
  const assetId = crypto.randomUUID();
  const storagePath = `${userId}/${cardId}/${assetId}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from('card-media') // confirmado — não é "media" nem "transfers"
    .upload(storagePath, file, { cacheControl: '3600', upsert: true });
  if (uploadError) throw new Error(`Falha no upload: ${uploadError.message}`);

  const record = {
    id: assetId, card_id: cardId, storage_bucket: 'card-media' as const,
    storage_path: storagePath, media_type: file.type.startsWith('image/') ? 'image' as const : 'other' as const,
    sha256_hash: sha256, usn: 0,
  };
  await db.card_media.put(record);
  await enqueueMutation('card_media', 'insert', record);
  return { storagePath, sha256 };
}
```

O CRUD de decks/notas segue o mesmo padrão: escreve local (Dexie) primeiro, enfileira a mutação, sincroniza quando online. Soft delete via `deleted_at`, nunca `DELETE` físico — coerente com o backend (não há policy de `DELETE` em `decks`/`cards`).

---

## 10. Renderizador de Templates (Basic, Reverse, Cloze, Image Occlusion)

O código dos docs anteriores para Cloze e Image Occlusion está estruturalmente correto (múltiplos `cloze_ordinal`, caixas sobrepostas com SVG/CSS) e foi mantido. Duas correções:

1. As coordenadas das caixas de oclusão são **percentuais (0–100)**, conforme `create_image_occlusion_note(p_note_id, p_boxes)` — não pixels absolutos. Normalize antes de enviar.
2. Ao criar uma oclusão, chame a RPC via outbox (`action: 'rpc', rpc_name: 'create_image_occlusion_note'`), não um insert direto — é uma RPC transacional que cria nota, cartão Cloze e `card_learning_state` atomicamente.

---

## 11. Motor de Estudo e FSRS-6

Fluxo confirmado contra o backend: atualização otimista local → `card_learning_state` local atualizado → mutação enfileirada com `client_review_id` estável (UUID) → quando online, `fsrs-review` Edge Function chama `record_review_fsrs6_idempotent()`, que bloqueia a linha, valida ownership por `auth.uid()` e deduplica por `client_review_id`. A estrutura de `StudySession` dos docs anteriores está correta nesse ponto; a única mudança é registrar a mutação como um item da fila outbox (Seção 6) em vez de uma função paralela `trackOfflineMutation` redundante.

Atalhos de teclado (mantidos): `Espaço` revela resposta; `1`/`2`/`3`/`4` = Again/Hard/Good/Easy.

---

## 12. Gamificação, Agendamento de Exames e Remediação Socrática (Reescrito)

Esta é a seção com a correção conceitual mais importante. **A migração `0024` não gera perguntas por IA.** Ela resolve três problemas distintos:

### 12.1 Gamificação (XP e Badges)

```typescript
// lib/services/gamification-service.ts
export async function awardXp(userId: string, amount: number) {
  await enqueueMutation('user_gamification_profiles', 'rpc', { p_user_id: userId, p_xp_amount: amount }, 'add_user_xp');
  // Otimista: atualiza localmente sem esperar confirmação
  const profile = await db.gamification_profiles.get(userId);
  const newXp = (profile?.xp_total ?? 0) + amount;
  const newLevel = Math.floor(Math.sqrt(newXp / 100)) + 1; // fórmula confirmada no docs/SUPABASE_API.md
  await db.gamification_profiles.put({ user_id: userId, xp_total: newXp, level_current: newLevel, usn: profile?.usn ?? 0 });
}
```

`badges_definition` é o catálogo público (pode ser cacheado agressivamente, RLS permite leitura pública); `user_badges` é privado por usuário.

### 12.2 Agendamento de Exames por Prioridade (não é quiz)

O usuário cadastra uma data-alvo e uma prioridade para um deck; o backend usa isso para **reordenar a fila de estudo**, não para criar perguntas novas:

```typescript
// lib/services/exam-service.ts
export async function createDeckExam(userId: string, deckId: string, examName: string, targetDate: string, priority: 'exam_urgent'|'currently_studying'|'maintaining'|'paused') {
  const exam = { id: crypto.randomUUID(), user_id: userId, deck_id: deckId, exam_name: examName, target_date: targetDate, priority_level: priority, status: 'active' as const, usn: 0 };
  await db.deck_exams.put(exam);
  await enqueueMutation('deck_exams', 'insert', exam); // insert direto na tabela via REST, não uma RPC de geração
  return exam;
}

export async function getStudyQueueWithExamSchedule(deckId: string | null, limit = 40) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('get_due_cards_with_exam_schedule', { p_deck_id: deckId, p_limit: limit });
  if (error) throw error;
  return data; // cada item: card_id, exam_name, target_date, days_remaining, scheduling_factor
}
```

A tela de "Exames" deve, portanto, ser um **formulário de agendamento** (nome, deck, data-alvo, prioridade) e um indicador visual de urgência na fila de estudo — não um gerador de provas.

### 12.3 Remediação Socrática de Leeches

Automática no backend: quando um cartão cruza `lapses >= 4`, um trigger marca `is_suspended = true` e cria uma `socratic_remediation_sessions`. O frontend:

```typescript
// lib/services/socratic-service.ts
export async function listOpenSocraticSessions(userId: string) {
  return db.socratic_sessions.where('user_id').equals(userId).and(s => s.status !== 'completed').toArray();
}

export async function resolveSocraticSession(sessionId: string) {
  await enqueueMutation('socratic_remediation_sessions', 'rpc', { p_session_id: sessionId }, 'resolve_socratic_remediation');
}
```

> ⚠️ O conteúdo da conversa socrática (`chat_history`) **não é gerado pelo banco**. Se o produto quiser um assistente de IA guiando essa remediação, é um worker/serviço adicional fora do escopo atual do backend documentado — não assuma que existe.

---

## 13. Busca Semântica e Ingestão por IA

Confirmado contra o backend: `semantic-search` aceita `mode: "semantic"` (padrão, depende de `OPENAI_API_KEY` no backend, retorna `503` se ausente) e `mode: "lexical"` (sem dependência externa). O frontend deve tratar `503` como "modo semântico indisponível" e oferecer alternar para lexical — não mascarar o erro como fallback automático silencioso, para manter a mesma transparência que o backend adota.

`ai-ingest` só cria o job (`queued`); o processamento (download, OCR, chamada de LLM, materialização de notas) é assíncrono e fora do escopo do frontend. Limites confirmados: PDF até 15 MiB, `source_reference` até 2.000 caracteres.

---

## 14. Interoperabilidade Anki (.apkg)

Estrutura e limites confirmados (mantidos dos docs anteriores, bucket corrigido):

| Limite | Valor |
|---|---|
| Tamanho do pacote | 50 MiB |
| Entradas ZIP | 20.000 |
| Notas importadas | 10.000 |
| Mídias por job | 2.000 |

Upload primeiro para `anki-transfers/{user_id}/imports/*.apkg`, depois chamada à função `anki-transfer` com `action: "import"`. **A exportação não preserva scheduling, revlogs nem múltiplos modelos** — é geração de um pacote Basic compatível, não um round-trip completo. Comunique essa limitação na UI antes do usuário exportar, para não gerar expectativa errada.

---

## 15. Segurança, Segredos e Performance

### 15.1 Classificação de chaves (para não repetir alarme desnecessário)

| Chave | Pode aparecer no frontend/`.env.local` do cliente? | Papel |
|---|---|---|
| `sb_publishable_...` (ou `anon key` legado) | **Sim** — é o que foi colado neste chat; seguro, protegido por RLS | Autenticação de baixo privilégio no navegador |
| `sb_secret_...` (ou `service_role` legado) | **Nunca** | Bypassa RLS inteiramente; só em `fsrs-optimize-worker`/cron |
| `OPENAI_API_KEY` | **Nunca** | Só nas Edge Functions `embeddings`/`semantic-search` |

A chave publishable compartilhada nesta conversa não precisa ser revogada — mas nunca compartilhe a `sb_secret_...` ou o `OPENAI_API_KEY` do projeto da mesma forma, mesmo em chat privado.

### 15.2 Rate limiting

Não existe mecanismo nativo de rate limit documentado no backend (a `0025` citada nos docs anteriores não existe). Até o backend publicar algo assim, trate isso como responsabilidade do frontend: debounce em buscas semânticas, limite de tentativas de retry no outbox, e mensagens de erro genéricas quando o Supabase devolver `429` (limite de infraestrutura, não de aplicação).

### 15.3 Validação

Toda mutação enfileirada offline deve ser validada com Zod **antes** de entrar na fila — validar só no momento do flush é tarde demais para dar feedback ao usuário.

---

## 16. SEO Técnico e Acessibilidade

Aplica-se apenas às rotas `(public)` (landing, termos) — a área autenticada não é indexável.

```typescript
export const metadata: Metadata = {
  title: 'Flashi — Flashcards com repetição espaçada',
  description: 'Estude offline com FSRS-6, sincronize entre dispositivos.',
};
```

Core Web Vitals: LCP < 2.5s na landing; CLS < 0.1 via `loading.tsx` com skeletons; a tela de estudo prioriza tempo de resposta local (< 100ms) sobre métricas de rede, já que seu caminho crítico é IndexedDB, não a rede.

---

## 17. Resiliência

- `error.tsx` por rota, com fallback "Tentar novamente".
- `loading.tsx` com skeletons dimensionados (evita CLS).
- Indicador visual persistente de status de sync (online/offline/sincronizando/pendências na fila) — componente `SyncStatusBadge`, alimentado pela store Zustand de sync.
- Retry com backoff exponencial na fila outbox (já coberto na Seção 6); a ordem da fila nunca é reordenada para preservar consistência.

---

## 18. Governança e DX

- Husky + lint-staged travando commits com erro de lint/tipo.
- Conventional Commits.
- `supabase gen types typescript --project-id ykyobzoxoiljyueasdwc > src/types/database.ts` rodado sempre que uma migração nova for aplicada — é a forma de manter o frontend alinhado ao schema sem reimplementar tipos manualmente (os `Local*` interfaces da Seção 4 devem ser mapeados a partir desses tipos gerados, não escritos à mão a partir de suposições).
- Testes: Vitest para o motor de sync/outbox (a parte mais arriscada do app), Playwright para o fluxo de estudo offline (simulando `navigator.onLine = false`).

---

## 19. Roadmap de Implementação (executável)

### Fase 0 — Preparação (dia 1)

```bash
pnpm create next-app@latest flashi-frontend --typescript --tailwind --app --turbopack
cd flashi-frontend
pnpm add @supabase/supabase-js @supabase/ssr dexie zustand react-hook-form @hookform/resolvers zod \
  lucide-react class-variance-authority clsx tailwind-merge recharts dompurify canvas-confetti katex
pnpm add -D @types/dompurify @types/canvas-confetti @types/katex husky lint-staged
pnpm dlx husky init
```

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://ykyobzoxoiljyueasdwc.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_rMFjWImWBXMppQJ7NBg3bw_hF4xjMuv
```

> Confirme no dashboard do Supabase se o projeto já expõe as chaves no novo formato publishable/secret ou se ainda está só no formato legado (`anon`/`service_role`) antes de nomear as variáveis — o SDK aceita qualquer um dos dois formatos sem mudança de código.

### Fase 1 — Backend (antes de qualquer código de frontend)

```bash
git clone https://github.com/barrosrafa/Flashi.git flashi-backend
cd flashi-backend
sudo pip3 install pglast
python3 validate_sql.py          # valida sintaxe de todas as 0*.sql
mkdir -p supabase/migrations
cp 00*.sql supabase/migrations/  # migrações estão na raiz — precisam ser movidas
supabase link --project-ref ykyobzoxoiljyueasdwc
supabase db push
```

Depois: confirmar no dashboard que as 24 migrações (`0001`–`0024`) e as 8 Edge Functions estão `ACTIVE`, e resolver a inconsistência da Seção 0 sobre até qual migração o projeto realmente está.

### Fase 2 — Tipos e Auth

```bash
supabase gen types typescript --project-id ykyobzoxoiljyueasdwc > src/types/database.ts
```
Implementar `lib/supabase/{client,server,middleware}.ts` e páginas `(auth)/*` com Server Actions + Zod.

### Fase 3 — Schema local + Sync core

Implementar Seção 4 (schema Dexie) **começando pelo subconjunto crítico**: `decks`, `notes`, `cards`, `card_learning_state`, `review_logs`, `sync_meta`, `offline_mutations_queue`. Implementar e testar o motor de sync (Seção 5) e a fila outbox (Seção 6) isoladamente, com testes automatizados, antes de construir qualquer UI — é a peça de maior risco técnico do projeto.

### Fase 4 — CRUD + Estudo + FSRS

Decks/Notas/Cards + upload de mídia (Seção 9), renderizadores de template (Seção 10), tela de estudo com FSRS-6 (Seção 11).

### Fase 5 — App Shell Offline

Service Worker (Serwist), `manifest.json`, teste manual: desconectar rede no DevTools, reabrir o app do zero (não só navegar dentro dele) e confirmar que carrega.

### Fase 6 — Entidades restantes do sync

Estender o schema Dexie e o `ENTITY_TABLE_MAP` para templates, tags, mídia, configurações, estatísticas, definições de nota, Cloze — nessa ordem de prioridade de uso.

### Fase 7 — Gamificação, Exames, Remediação Socrática

Seção 12 completa, incluindo a UI de agendamento de exames (não confundir com gerador de quiz).

### Fase 8 — Busca Semântica, Ingestão IA, Anki

Seções 13 e 14.

### Fase 9 — QA e Deploy

```bash
pnpm tsc --noEmit
pnpm lint
pnpm build
```
Testes manuais de resiliência offline: sessão de estudo completa sem rede, reconexão, verificação de que a fila outbox esvaziou e o cursor USN avançou.

---

## 20. Riscos e Decisões em Aberto

| Risco / decisão | Por que importa | Recomendação |
|---|---|---|
| Cobertura total do schema Dexie (~24 tabelas) é grande para um MVP | Atraso de cronograma se tentado de uma vez | Seguir o faseamento da Seção 19; entidades de gamificação/exames podem esperar |
| Estratégia de conflito para edições concorrentes | USN só ordena entrega, não resolve merge semântico (confirmado no README do backend) | Adotar last-write-wins por `updated_at` no MVP; revisar se o produto crescer para edição colaborativa pesada |
| Confirmação de qual migração está realmente aplicada no projeto `flashi` | README do backend é internamente inconsistente sobre isso (Seção 0) | Rodar `supabase migration list` antes de codar a Seção 12 |
| Formato exato do payload de `get_incremental_sync` (existência de `has_more`) | Não documentado explicitamente na versão auditada | Testar a RPC manualmente via `curl`/SQL Editor antes de finalizar o motor de sync |
| PWA/Service Worker ausente nos docs originais | Sem ele, o app não abre offline, só os dados ficam disponíveis | Não deixar para o final — Fase 5 do roadmap, não Fase 9 |
| Rate limiting inexistente no backend atual | Exposição a abuso de custo (ex.: `embeddings`/`semantic-search` chamando `OPENAI_API_KEY`) | Aplicar debounce/limites no frontend como mitigação temporária; monitorar custo do lado do backend |

---

## 21. Checklist de Entrega

- [ ] Migrações `0001`–`0024` aplicadas e confirmadas (`supabase migration list`)
- [ ] 8 Edge Functions `ACTIVE` com `verify_jwt=true`
- [ ] Tipos gerados via `supabase gen types` e não escritos à mão
- [ ] Motor de sync testado contra o formato plano real de `get_incremental_sync`
- [ ] Fila outbox suporta `insert`/`update`/`delete`/`rpc`
- [ ] Bucket `card-media` e `anki-transfers` (não `transfers`) usados corretamente
- [ ] Nenhuma chave `sb_secret_.../service_role` ou `OPENAI_API_KEY` no bundle do cliente
- [ ] Service Worker cobrindo o app shell, não só os dados
- [ ] Tela de "Exames" é agendamento por prioridade, não gerador de quiz por IA
- [ ] `params`/`searchParams` assíncronos em todas as rotas dinâmicas (Next 16)
- [ ] Server Actions restritas a auth/perfil; núcleo offline usa cliente Supabase direto + outbox
- [ ] Teste manual: sessão de estudo completa 100% offline, incluindo abrir o app do zero sem rede
