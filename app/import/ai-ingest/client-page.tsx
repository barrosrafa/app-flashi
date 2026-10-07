'use client';

import { useEffect, useState } from 'react';
import { AppShell, Topbar } from '../../../components/AppShell';
import { WorkerJobMonitor } from '../../../components/WorkerJobMonitor';
import { isFeatureEnabled } from '../../../lib/feature-flags';
import { createIngestionJob } from '../../../lib/services/ingestion-service';
import { listDecks, type Deck } from '../../../lib/services/deck-service';

export default function AiIngestPage() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isFeatureEnabled('ai_ingest')) {
      listDecks().then(setDecks).catch((reason: unknown) => setMessage(
        reason instanceof Error && reason.message === 'SUPABASE_NOT_CONFIGURED'
          ? 'Configure a conexão do Supabase para listar seus decks.'
          : 'Entre na sua conta para importar conteúdo.',
      ));
    }
  }, []);

  if (!isFeatureEnabled('ai_ingest')) {
    return <AppShell><Topbar title="Ingestão por IA" /><div className="card empty-state">Esta funcionalidade está desativada.</div></AppShell>;
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    try {
      const result = await createIngestionJob({
        deckId: String(form.get('deck_id')),
        sourceType: 'raw_text_block',
        content: String(form.get('content')).trim(),
      });
      setMessage(`Job ${result.job_id ?? 'criado'} enviado à fila. Após a geração, revise as sugestões abaixo e selecione quais publicar. Nenhum cartão será gravado sem sua ação.`);
      formElement.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível criar o job.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <Topbar title="Ingestão por IA" subtitle="Envie uma fonte, aguarde sugestões, revise e selecione o que deseja publicar." />
      <section className="card">
        <form className="form" onSubmit={submit}>
          <div className="field"><label htmlFor="deck">Deck de destino</label><select id="deck" name="deck_id" required disabled={!decks.length}>{decks.length ? decks.map((deck) => <option data-user-content="" key={deck.id} value={deck.id}>{deck.name}</option>) : <option value="">Nenhum deck disponível</option>}</select></div>
          <div className="field"><label htmlFor="content">Texto-fonte</label><textarea id="content" name="content" maxLength={2000} required placeholder="Cole até 2.000 caracteres…" /></div>
          <button className="btn" disabled={busy || !decks.length}>{busy ? 'Enviando…' : 'Gerar sugestões'}</button>
        </form>
        <p className="status-text" role="status">{message}</p>
      </section>
      <WorkerJobMonitor />
    </AppShell>
  );
}
