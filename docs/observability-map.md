# Mapa de observabilidade — Flashi

## Objetivo

A branch `feat/sdd-activation` usa **Sentry** para exceções, contexto técnico, traces e replay seguro, e **PostHog** para comportamento, funis e coortes. A instrumentação é best-effort: uma indisponibilidade dos provedores nunca bloqueia login, estudo, sincronização ou qualquer mutação.

## Cobertura implementada

| Camada | Sentry | PostHog | Como é coberta |
|---|---:|---:|---|
| Navegação | — | Sim | `page_viewed` por rota via `ObservabilityBridge` |
| Botões e links | — | Sim | Delegação global para `button`, `a`, `role=button` e submit |
| Formulários | — | Sim | `ui_interaction` com `interaction=submit` |
| Erros JS | Sim | Sim | `window.error`, `unhandledrejection` e error boundary |
| Chamadas Edge | Sim | Sim | `invokeEdge`: início, sucesso, timeout, retry e falha |
| Supabase direto | Sim | Sim | `supabase_request_completed` para auth, data, RPC, storage e realtime |
| Edge Functions | Sim | Sim | wrapper `withObservability` em todas as 12 funções |
| Dependências backend | Sim | Sim | Supabase admin, OpenAI, LLM, ElevenLabs, cache TTS e FSRS WASM |
| Auth | Sim | Sim | identidade de usuário, reset no logout e eventos de login/cadastro existentes |
| Dados sensíveis | Sanitizado | Sanitizado | sem token, cookie, authorization, email, conteúdo, prompt, payload de estudo ou chave de idempotência |

## Eventos PostHog

### Funil de ativação

1. `activation_viewed` — entrada na tela.
2. `activation_submitted` — envio, somente buckets de minutos e flags de preenchimento.
3. `api_request_started` — chamada `activation` iniciada.
4. `activation_backend_completed` — resultado transacional no backend.
5. `activation_completed` ou `activation_failed` — resultado refletido na UI.
6. `api_request_completed` — duração, tentativas e classe de falha.

### Funil de estudo

- `study_session_started`
- `card_rated`
- `study_session_completed`
- `api_request_started` / `api_request_completed` para `fsrs-review`, `sync` e funções auxiliares

### Funil de criação e IA

- `deck_created`
- `card_created`
- `ai_generation_started`
- `ai_generation_completed`
- `ai_generation_failed`
- `api_request_*` para `ai-ingest`, `embeddings`, `semantic-search`, `import-deck` e `anki-transfer`

### Saúde de produto

- `page_viewed`
- `ui_interaction`
- `client_error`
- `edge_request_completed`
- `edge_request_error`
- `edge_request_failed`

## Taxonomia de erros

| Classe | Exemplos | Dimensão principal |
|---|---|---|
| Autenticação | `AUTH_REQUIRED`, `UNAUTHENTICATED`, `FORBIDDEN` | função, rota, status |
| Validação | `VALIDATION_ERROR`, `INVALID_*`, `BOPLA_REJECTED` | código, endpoint, status |
| Idempotência | `IDEMPOTENCY_KEY_REQUIRED`, `IDEMPOTENCY_IN_PROGRESS`, `IDEMPOTENCY_KEY_REUSED` | endpoint activation |
| Limite | `RATE_LIMITED`, `QUOTA_EXCEEDED` | endpoint, status, retryable |
| Disponibilidade | timeout, `UNAVAILABLE`, HTTP 503 | função, duração, tentativa |
| Persistência | erros Supabase/RPC/Storage | função, `error_class`, request id |
| Cliente | erro não tratado, rejeição de Promise, boundary | rota, source, código |
| Worker | falha de claim, processamento, materialização ou provedor | worker, status do job |

O `request_id` é propagado pelo frontend no header `x-request-id`, devolvido em `X-Request-Id` e associado ao Sentry. Ele permite correlacionar sessão, chamada Edge, log e resposta sem enviar o payload bruto.

## Funções backend cobertas

`activation`, `ai-ingest`, `ai-ingest-worker`, `anki-transfer`, `embeddings`, `fsrs-optimize`, `fsrs-optimize-worker`, `fsrs-review`, `import-deck`, `semantic-search`, `sync` e `tts`.

Cada função registra: início implícito pelo request, `status`, `outcome`, `duration_ms`, `function_name`, `request_id`; exceções são capturadas no Sentry e falhas de contrato no PostHog.

## Dashboards e alertas recomendados

1. **Activation conversion:** viewed → submitted → completed; quebra por status e ambiente.
2. **Activation reliability:** erro por `error_code`, p95 de duração, rate limit e conflitos de idempotência.
3. **Study reliability:** taxa de sucesso de `fsrs-review`, timeouts e erros por rating.
4. **Edge health:** requests, p50/p95/p99, 4xx/5xx e timeout por função.
5. **AI pipeline:** queued → processing → completed/failed; falhas por source type e worker.
6. **Client quality:** `client_error` por rota, release e navegador; Sentry replay apenas em erro.
7. **Sync health:** `sync_started` → `sync_completed`, itens falhos, retries e offline backlog.

Alertas iniciais: 5xx > 2% por 10 minutos; p95 > 5s; timeout > 1%; activation completion < 70%; AI failure > 10%; aumento de `AUTH_REQUIRED` ou `RATE_LIMITED` acima do baseline.

## Variáveis de ambiente

### Frontend

`NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_ENVIRONMENT`, `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE`, `NEXT_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE`, `NEXT_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE`, `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`, `NEXT_PUBLIC_POSTHOG_HOST`, `NEXT_PUBLIC_POSTHOG_ENABLED`.

### Supabase Edge

`SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_TRACES_SAMPLE_RATE`, `POSTHOG_PROJECT_TOKEN`, `POSTHOG_HOST`, `POSTHOG_SERVER_ENABLED`.

## Privacidade

Não são enviados tokens, cookies, authorization headers, prompts, conteúdo de cards/notas, e-mails, metas, datas alvo, minutos brutos ou chaves de idempotência. Replay mascara inputs e bloqueia mídia; propriedades são reduzidas a enums, buckets, contagens, duração, status e códigos.

## Validação

- Frontend: `pnpm lint`, `pnpm typecheck`, `pnpm test`.
- Backend: `deno check --config supabase/functions/deno.json` para as funções implantáveis e `deno test --allow-env --allow-net supabase/functions`.
- Verificar em staging se os eventos chegam sem payload sensível e se `request_id` coincide entre frontend, resposta HTTP, logs e Sentry.

A auditoria detalhada, com inventário de 38 rotas, 32 serviços frontend, 12 Edge Functions, RPCs, jobs, dependências, lacunas operacionais e dashboards recomendados está em [`observability-audit.md`](observability-audit.md).
