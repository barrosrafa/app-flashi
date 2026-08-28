# Contratos verificados do backend Flashi

Documento de apoio gerado a partir do repositório `barrosrafa/Flashi` e das migrações/Edge Functions versionadas. O frontend deve tratar este arquivo como referência de integração, não como autorização para adicionar endpoints inexistentes.

## Fonte e inventário

- Repositório de backend: `https://github.com/barrosrafa/Flashi`
- Guia de contratos: `supabase/functions/README.md`
- Migrações verificadas: `0001_types.sql` até `0025_user_function_rate_limits.sql`.
- Edge Functions publicadas: `sync`, `fsrs-review`, `embeddings`, `semantic-search`, `fsrs-optimize`, `fsrs-optimize-worker`, `anki-transfer` e `ai-ingest`.

## RPCs e tabelas usadas pelo frontend

| Contrato | Uso | Observação |
|---|---|---|
| `get_due_cards(p_deck_id?, p_limit?)` | Fila básica de estudo | Só retorna cards com `card_learning_state`; estados `new`, `learning`, `review` e `relearning` |
| `get_due_cards_with_exam_schedule(p_deck_id?, p_limit?)` | Fila com prioridade de exame | Reordena a fila segundo exames ativos |
| `get_incremental_sync(p_after_usn?, p_limit?)` | Sync por cursor USN | Retorna `entity_type`, `entity_key`, `usn`, `is_deleted` e `payload` |
| `get_current_streak()` | Sequência atual | Calculada no banco a partir das estatísticas/revisões |
| `mcp_create_note(...)` | Note + cards em uma transação | Também cria `card_learning_state` e auditoria; é o contrato usado pelo novo CRUD |
| `mcp_search_notes(...)` | Busca lexical/semântica | A Edge Function `semantic-search` aplica o contexto de usuário e chama a RPC |
| `get_fsrs_optimization_status()` | Estado do job FSRS | Leitura autenticada |
| `enqueue_fsrs_optimization()` | Solicitação de otimização | Invocada pela Edge Function `fsrs-optimize` |
| `create_anki_transfer_job(...)` | Metadata de import/export | Paths de Storage pertencem ao usuário autenticado |

## Regras das Edge Functions

A função `semantic-search` recebe `query` com até 8.000 caracteres, `limit` de 1 a 100 e `mode` `semantic` ou `lexical`. O frontend tenta lexical somente quando a modalidade semântica retorna indisponibilidade do provedor, sem mascarar outros erros.

A função `ai-ingest` recebe `deck_id`, `source_type` entre `pdf_document`, `youtube_url`, `raw_text_block` e `web_page`, além de `content` ou `storage_path`. A referência possui limite de 2.000 caracteres; paths de PDF precisam terminar em `.pdf` e começar pelo UUID do usuário.

A função `anki-transfer` exige upload no bucket privado `anki-transfers`. Importações usam `<user_id>/imports/...`; exportações usam `<user_id>/exports/...`. O limite do pacote é 50 MiB. O frontend calcula SHA-256 antes da chamada e nunca envia chave de serviço ao navegador.

A função `fsrs-optimize` usa `{ "mode": "request" }` para enfileirar e `{ "mode": "run", "run_id": "..." }` para executar um job do usuário. O worker `fsrs-optimize-worker` é reservado a JWT `service_role` e não é chamado pelo browser.

A função `embeddings` recebe `note_id`, lê os campos da nota e atualiza o embedding no próprio backend. O frontend a dispara de forma não bloqueante após criar/editar uma nota: uma falha do provedor não invalida a criação do card.

## Regra crítica de estudo

A RPC `get_due_cards` lê somente cards que possuem uma linha em `card_learning_state`. A RPC `mcp_create_note` cria essa linha automaticamente. Por isso, o novo fluxo de criação usa `mcp_create_note` em vez de dois inserts independentes em `notes` e `cards`; isso evita note órfão e torna o card elegível para a fila real.

## Segurança

Todas as funções de usuário devem permanecer com JWT verificado. O worker periódico exige `role=service_role`. Policies RLS continuam sendo a autoridade para ownership. Não versionar secrets, não usar `service_role` no frontend e não executar dados de pacotes `.apkg` como código.

## Referência complementar

A documentação operacional do próprio backend está em `supabase/functions/README.md` no repositório `barrosrafa/Flashi`; o frontend mantém somente este resumo para registrar as decisões de integração.
