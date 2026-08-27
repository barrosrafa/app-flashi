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
├── decks/[deckId]/cards/page.tsx # Gerenciamento de cards incorporado do ZIP
├── layout.tsx
├── manifest.ts
└── globals.css
components/
├── AppShell.tsx               # Navegação persistente e topbar
├── DeckLibrary.tsx             # Leitura remota com fallback local
└── CardBrowser.tsx             # CRUD de cards em notes + cards
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
docs/browser-verification.md    # Evidências de verificação visual
docs/integration-verification.md # Evidências Auth + Supabase
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

## 12. Merge do `flashcards.zip`

O arquivo recebido continha uma segunda aplicação Next.js sob `src/`, uma camada de IndexedDB própria, um cliente HTTP apontando para um backend Express em `localhost:3001` e um backend de rascunho Anki em `scratch/anki-sync-backend`. Esse backend usa convenções diferentes das tabelas públicas do projeto Supabase `flashi`: IDs compostos/BIGINT, `did` e `flds` como strings separadas por caracteres, além de um contexto de usuário definido por variável de sessão PostgreSQL.

A decisão de merge foi seletiva e intencional. Foram incorporados o padrão visual e o fluxo de gerenciamento de cards do ZIP, mas não o backend Express nem as migrations antigas. Copiar essas migrations diretamente teria criado um segundo modelo de persistência e entrado em conflito com o schema já implantado no Supabase. O resultado final usa as entidades atuais `decks`, `notes` e `cards`, com `uuid`, `user_id`, `deck_id` e `fields` JSONB.

| Item do ZIP | Decisão | Motivo |
|---|---|---|
| Tela de browse de cards | Incorporada e adaptada | Entrega busca, criação, listagem e arquivamento em uma experiência única |
| `src/lib/db.ts` do ZIP | Não copiada | Modelo local incompatível com o schema Dexie atual e com o Supabase real |
| `src/lib/api.ts` do ZIP | Não copiada | Dependia de backend HTTP Express em `localhost:3001` e criava fallback de login inseguro |
| `scratch/anki-sync-backend` | Mantido fora do app | É um backend paralelo de referência, não o contrato implantado |
| Migrations SQL do ZIP | Não aplicadas | O projeto Supabase já tinha migrations e tabelas equivalentes em outro desenho |
| Layout e interações de cards | Reimplementadas | Permite usar o visual do ZIP sem abandonar Auth/RLS e Edge Functions atuais |

## 13. Modelo de dados e invariantes

A criação de um deck exige uma sessão válida. O serviço chama `auth.getUser()`, rejeita a operação com `AUTH_REQUIRED` quando não existe usuário e envia `user_id` explicitamente no insert. O banco permanece responsável por RLS, defaults, timestamps e sequência global `usn`.

A criação de um card é composta por duas gravações relacionadas. Primeiro, o serviço insere uma linha em `notes`, contendo `user_id`, `deck_id`, `fields` e `source_format = native`. Depois, insere uma linha em `cards`, usando o `note.id` retornado, o mesmo usuário e deck, `card_kind = basic` e o mesmo objeto JSONB de campos. Assim, o texto editado na interface fica disponível no note e na representação estudável do card.

| Entidade | Campos essenciais usados pelo frontend | Regra de propriedade |
|---|---|---|
| `decks` | `id`, `user_id`, `name`, `description`, `visibility` | O usuário autenticado é o proprietário |
| `notes` | `id`, `user_id`, `deck_id`, `fields`, `source_format` | O note pertence ao mesmo usuário e deck |
| `cards` | `id`, `user_id`, `deck_id`, `note_id`, `fields`, `card_kind`, `is_archived` | O card referencia o note e só é listado quando ativo |
| `card_learning_state` | estado de repetição espaçada | Deve ser atualizado pelo pipeline FSRS, não pelo formulário básico |
| `review_logs` | histórico de avaliações | Deve receber avaliações idempotentes pela Edge Function |

Nesta versão, o insert de note e o insert de card são duas requisições consecutivas do cliente. Se a segunda falhar depois que a primeira foi aceita, pode existir um note órfão; a evolução recomendada é mover a operação para uma RPC transacional ou Edge Function idempotente. O cliente não tenta apagar silenciosamente o note, porque uma compensação automática também pode esconder uma falha de RLS ou de conectividade.

## 14. Fluxos operacionais detalhados

### 14.1 Desenvolvimento local

```bash
git clone https://github.com/barrosrafa/app-flashi.git
cd app-flashi
pnpm install
cp .env.example .env.local
# preencher as duas variáveis públicas do Supabase
pnpm dev
```

Abra `http://localhost:3000/login`, autentique-se e acesse `Meus decks`. Para testar o fluxo incorporado, clique em `Novo deck`, informe nome e descrição, aguarde o redirecionamento para o gerenciador e preencha frente, verso e tags. A mensagem `Card inserido no Supabase.` só aparece depois que o serviço conclui o insert do card e recarrega a listagem remota.

### 14.2 Smoke test sem sessão

O smoke test não cria dados. Ele verifica que uma leitura pública configurada responde, que a RPC de sincronização pode retornar um lote vazio sem usuário e que `fsrs-review` recusa chamada sem JWT:

```bash
set -a && source .env.local && set +a
node scripts/supabase-smoke.mjs
```

O status esperado é `200` para o catálogo público, `200` com lista vazia para o cursor sem usuário no ambiente atual e `401` para a Edge Function protegida. O script falha com código de saída diferente de zero apenas quando o comportamento diverge desses contratos.

### 14.3 Verificação administrativa read-only

Para verificar uma execução real, copie o UUID exibido na URL após a criação e execute consultas limitadas no SQL Editor do Supabase. Não selecione senha, token, `service_role` ou dados de outros usuários:

```sql
select id, name, description, visibility, created_at
from public.decks
where id = '<DECK_UUID>'
limit 1;

select c.id, c.note_id, c.deck_id, c.card_kind, c.fields,
       n.fields as note_fields
from public.cards c
join public.notes n on n.id = c.note_id
where c.deck_id = '<DECK_UUID>'
  and c.is_archived = false
order by c.created_at desc
limit 5;
```

A verificação realizada nesta entrega encontrou o deck `Deck QA Supabase 20260827`, um card ativo e um note relacionado. A lista autenticada também exibiu o deck com o status `Supabase sincronizado` após uma nova navegação.

## 15. Tratamento de erros e troubleshooting

| Sintoma | Causa provável | Diagnóstico e ação |
|---|---|---|
| `Entre na sua conta para criar decks.` | Não existe sessão no cliente | Fazer login novamente; confirmar cookies/local storage do Supabase |
| `Entre na sua conta para inserir cards.` | `auth.getUser()` não encontrou usuário | Reautenticar e verificar se a rota está sendo aberta no mesmo domínio |
| `new row violates row-level security policy` | Policy não permite a combinação usuário/deck | Revisar policies e confirmar `user_id = auth.uid()` |
| Deck criado, mas card não aparece | Insert do note/card falhou ou card está arquivado | Consultar `cards` por `deck_id`; verificar logs do navegador e RLS |
| `email rate limit exceeded` | Limite do provedor Auth atingido | Aguardar a janela do Auth ou usar um usuário de teste já confirmado; não repetir tentativas em loop |
| Build acusa `middleware` deprecated | Next.js 16 prefere `proxy.ts` | Migrar o arquivo em alteração separada; não é falha de compilação |
| Biblioteca mostra modo local | A consulta remota veio vazia ou falhou | Verificar ambiente, sessão, RLS e console; o fallback é deliberadamente explícito |

O fallback local não deve ser interpretado como sucesso remoto. Essa distinção é importante para não afirmar que uma escrita foi persistida quando a rede ou o Auth estavam indisponíveis.

## 16. Observabilidade e segurança

O frontend não imprime tokens nem senhas. A documentação de testes também não armazena a senha usada na validação. O `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` pode estar no bundle do navegador, mas o controle de autorização deve permanecer nas policies RLS e nas funções protegidas. Chaves de serviço, tokens administrativos e credenciais de provedores não pertencem a este repositório.

Para investigar uma falha de produção, o procedimento recomendado é correlacionar três pontos: mensagem renderizada pelo componente, erro retornado pelo `supabase-js` e registro correspondente nos logs do Supabase. Em mudanças de persistência, registrar o UUID do deck e o `client_review_id` é suficiente para rastrear a operação sem registrar conteúdo sensível ou tokens.

Os findings de segurança e performance existentes no projeto Supabase continuam documentados na seção 9. Eles não foram mascarados pelo merge do ZIP: policies RLS sem regra, funções `SECURITY DEFINER` excessivamente expostas, índices ausentes e reavaliação por linha de `auth.uid()` devem ser tratados no banco com revisão independente.

## 17. Checklist de release

| Verificação | Critério de aceite | Estado desta entrega |
|---|---|---|
| Instalação limpa | `pnpm install` conclui sem arquivos gerados versionados | Aprovado |
| TypeScript | `pnpm typecheck` sem erros | Aprovado |
| Testes | `pnpm test` com todos os testes verdes | Aprovado: 3 testes |
| Build | `pnpm exec next build --webpack` compila todas as rotas | Aprovado |
| Auth | Login retorna sessão válida e a UI confirma entrada | Aprovado com usuário fornecido |
| Deck | Insert aparece em `public.decks` e lista autenticada | Aprovado |
| Card | Insert relacionado em `public.notes` e `public.cards` | Aprovado |
| Proteção anônima | Card sem sessão não executa insert | Aprovado |
| Segredos | `.env.local` ignorado e nenhuma senha commitada | Aprovado |
| Git | Working tree limpo e branch publicada | Aprovado |

## 18. Referências

[^1]: [Next.js — Proxy, documentação oficial](https://nextjs.org/docs/app/getting-started/proxy), que registra a mudança de Middleware para Proxy no Next.js 16 e descreve o uso da convenção de arquivo.
[^2]: [Supabase — Creating a Supabase client for SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client), que documenta `@supabase/ssr`, variáveis públicas e a separação entre clientes de navegador e servidor.
[^3]: [Supabase — JavaScript `functions.invoke`](https://supabase.com/docs/reference/javascript/functions-invoke), referência oficial de chamadas de Edge Functions e uso do cliente JavaScript.
[^4]: [Repositório de destino — barrosrafa/app-flashi](https://github.com/barrosrafa/app-flashi), onde esta implementação será publicada.
