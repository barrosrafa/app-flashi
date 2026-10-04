# Auditoria geral de observabilidade — frontend e backend

**Escopo auditado:** branch `feat/sdd-activation` dos repositórios `app-flashi` e `Flashi`.

## 1. Inventário coberto

| Área | Inventário | Cobertura atual |
|---|---:|---|
| Páginas App Router | 38 | page view automático por rota |
| Error boundaries | `error`, `global-error`, `not-found` | Sentry + evento de erro global |
| Componentes React | 28 em `components/` | cliques/submits por delegação global |
| Serviços frontend | 32 | chamadas Edge + rede Supabase observadas |
| Chamadas diretas Supabase frontend | 104 referências encontradas | auth, REST, RPC, storage e realtime classificados por fetch |
| Edge Functions | 12 | wrapper de request, status, duração e exceção |
| RPCs usadas pelas Edge Functions | 14 nomes | cobertas pela camada de rede Supabase |
| Tabelas tocadas pelas Edge Functions | 20+ | cobertas por dependência Supabase/admin |
| Workers/jobs | AI ingest, FSRS optimization, Anki, import, sync, TTS cache | status de jobs e dependências externas mapeados |
| Dependências externas | OpenAI embeddings/LLM, ElevenLabs, FSRS WASM, cache TTS | status, duração e erro sem payload |

## 2. Mapa frontend

### Rotas e superfícies

- **Aquisição/autenticação:** `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`.
- **Ativação:** `/activation`, `/onboarding`.
- **Estudo:** `/study`, `/study/[deckId]`, `/study/search`.
- **Conteúdo:** `/decks`, `/decks/new`, `/decks/[deckId]`, cards, notes e occlusion.
- **Importação/geração:** `/import/anki`, `/import/deck`, `/import/url`, `/import/ai-ingest`, `/export/anki`.
- **Aprendizagem/engajamento:** analytics, leaderboard, badges, exams, socratic, gamification.
- **Ferramentas/configuração:** search, templates, profile, learning plan, FSRS optimization, MCP, tools, media.

### Eventos automáticos

- `page_viewed`: cada mudança de pathname.
- `ui_interaction`: todo botão, link, `role=button`, submit e controles equivalentes.
- `client_error`: `window.error`, `unhandledrejection` e boundaries.
- `api_request_started` / `api_request_completed`: camada de Edge Function, com retry, timeout, duração e código de erro.
- `supabase_request_completed`: chamadas diretas de auth, REST/data, RPC, storage e realtime; Edge é excluída para evitar duplicação com a camada acima.

### Eventos de produto existentes e esperados

| Funil | Entrada | Progresso | Resultado | Falha |
|---|---|---|---|---|
| Cadastro/login | `signup_started`, `login_*` | submit/auth request | `signup_completed`, `login_succeeded` | `login_failed`, auth error |
| Ativação | `activation_viewed` | `activation_submitted`, request started | backend completed + `activation_completed` | `activation_failed`, validation/rate-limit/idempotency |
| Estudo | `study_session_started` | `card_rated`, FSRS request | `study_session_completed` | timeout, offline, review conflict |
| Deck/card | UI click + `deck_created`/`card_created` | REST/RPC/storage | sucesso da mutação | validation, RLS, conflict |
| IA/importação | generation/import started | job queued/processing | completed + contagens | provider, quota, parsing, materialization |
| Sync/offline | `sync_started`, outbox enqueue | pages/retries | `sync_completed`, outbox flushed | `sync_failed`, backlog, cursor conflict |

## 3. Mapa backend

### Entrada comum

Todas as 12 funções passam por `withObservability`, que:

1. cria/preserva `x-request-id`;
2. propaga o nome da função;
3. configura contexto do Sentry;
4. mede duração e status HTTP;
5. emite `edge_request_completed`, `edge_request_failed` ou `edge_request_error`;
6. não envia payload bruto.

### Edge Functions e dependências

| Função | Domínio | Persistência/filas | Dependências |
|---|---|---|---|
| `activation` | ativação transacional | `process_activation`, rate limit | Supabase |
| `sync` | cursor incremental | `get_incremental_sync` | Supabase |
| `fsrs-review` | revisão/agendamento | `record_review_fsrs6_idempotent` | Supabase |
| `fsrs-optimize` | solicitar/executar otimização | jobs FSRS | Supabase, FSRS WASM |
| `fsrs-optimize-worker` | worker FSRS | claim/complete/fail | Supabase admin, FSRS WASM |
| `ai-ingest` | criar job de ingestão | `ai_ingestion_jobs` | Supabase |
| `ai-ingest-worker` | processar fonte e materializar | quota, claim, materialize | Supabase admin, LLM, PDF/YouTube/web |
| `embeddings` | indexar nota | tabela `notes` | OpenAI embeddings |
| `semantic-search` | busca semântica/lexical | RPC de busca/auditoria | OpenAI embeddings, Supabase |
| `import-deck` | importar conteúdo | `deck_import_jobs` | Storage, URL externa |
| `anki-transfer` | importar/exportar Anki | decks/notes/cards/media/jobs | Storage, SQLite/ZIP |
| `tts` | áudio e cache | Storage `tts_cache` | ElevenLabs |

### Observabilidade de infraestrutura

- **Supabase user/admin SDK:** `createObservedFetch` registra categoria `supabase` ou `supabase-admin`, status, método, host e duração.
- **Provedores:** OpenAI embeddings, LLM de ingestão, ElevenLabs TTS, cache TTS e WASM FSRS usam dependência observada.
- **Erros:** `handleError` normaliza códigos e preserva request ID; Sentry recebe exceções inesperadas.
- **Jobs:** a UI já acompanha estados `queued`, `processing`, `running`, `completed` e `failed` para ingestão/importação/FSRS.

## 4. Taxonomia completa de falhas

- **Cliente:** erro de renderização, erro de evento, Promise rejeitada, falha de service worker.
- **Auth/RLS:** `AUTH_REQUIRED`, `UNAUTHENTICATED`, `FORBIDDEN`, sessão ausente ou expirada.
- **Entrada:** `VALIDATION_ERROR`, `INVALID_*`, `BOPLA_REJECTED`, arquivo/URL inválido.
- **Confiabilidade:** timeout, abort, indisponibilidade, retry esgotado, 5xx.
- **Concorrência:** idempotência, cursor, conflito de revisão, job já reivindicado.
- **Limites:** rate limit, quota AI/TTS, tamanho de payload/arquivo, volume de importação.
- **Provedor:** OpenAI, ElevenLabs, YouTube, web externa, parser PDF, WASM.
- **Dados:** falha de RPC, Storage, materialização, persistência ou contrato de schema.
- **Privacidade/segurança:** tentativa de URL privada, credenciais em URL, path de storage inválido, papel de worker inválido.

## 5. Lacunas que ainda devem ser fechadas no ambiente de produção

Estas não são lacunas de instrumentação de código, mas de operação e governança:

1. **Release/versionamento:** adicionar `release`/commit SHA no Sentry e propriedade `app_version` no PostHog.
2. **Ambiente:** separar claramente `development`, `staging` e `production` em Sentry/PostHog.
3. **Consentimento:** confirmar política de analytics/replay, opt-out e retenção antes de habilitar replay em produção.
4. **Alertas:** configurar Sentry para 5xx, regressões, p95/p99, timeouts e aumento de `AUTH_REQUIRED`; PostHog para conversão e abandono.
5. **Jobs:** criar painel de idade da fila, jobs presos em `processing`, taxa de retry e lag do cron.
6. **Banco:** complementar com métricas Supabase/pg_stat/Database Insights para locks, slow queries, RLS denials, Storage e Edge runtime; não registrar payloads em tabela de auditoria.
7. **Provedores:** dashboards de latência, 429, 5xx, quota e custo por OpenAI/ElevenLabs; budget alerts continuam fora do código.
8. **SLOs:** definir metas por domínio: auth, activation, study review, sync, AI ingest, import e TTS.
9. **Teste de telemetria:** pipeline CI deve validar que eventos obrigatórios chegam com schema estável e que nenhum campo sensível é emitido.
10. **Cardinalidade:** manter `route`, `function_name`, `operation`, `error_code` e `dependency` em enums/buckets; nunca usar IDs de conteúdo ou URLs completas como dimensão.

## 6. Dashboards sugeridos

1. **North Star:** ativação completa, primeira sessão de estudo e retenção D1/D7.
2. **Frontend quality:** erros por rota/release/browser, crash-free sessions e replay em erro.
3. **API/Edge:** volume, p50/p95/p99, 4xx/5xx, timeout e retries por função.
4. **Supabase:** auth/RPC/data/storage/realtime por status e duração.
5. **Study + sync:** cards avaliados, falhas FSRS, backlog offline, cursor lag e conflitos.
6. **AI/import:** funil por fonte, idade de job, completude, quota, provider errors e materialização.
7. **Workers:** claim success, processing time, stuck jobs e retry rate.
8. **Security:** rejeições de URL, RLS/403, rate limit, BOPLA e tentativas de worker inválidas.

## 7. Critério de pronto

A cobertura pode ser considerada completa quando cada request tiver `request_id`, função/rota, status/outcome, duração e classificação; cada job tiver transições de estado e idade; cada dependência tiver sucesso/falha/latência; e cada funil de produto tiver entrada, progresso, conversão e abandono mensuráveis — tudo sem payload sensível.
