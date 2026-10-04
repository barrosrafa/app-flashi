'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '../contexts/LanguageContext';
import { translateUiText } from '../contexts/autoTranslations';
import { listImportJobs, type ImportJob } from '../lib/services/import-deck-service';

export function ImportJobMonitor({ deckId }: { deckId?: string }) {
  const { locale } = useTranslation();
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [message, setMessage] = useState('');
  const tr = (value: string) => translateUiText(value, locale);
  const refresh = useCallback(async () => { setJobs(await listImportJobs(deckId)); }, [deckId]);

  useEffect(() => {
    void refresh().catch(() => setMessage('Não foi possível carregar o histórico de importações.'));
    const timer = window.setInterval(() => void refresh().catch(() => undefined), 10_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  return (
    <section className="card" aria-labelledby="import-history-heading">
      <div className="section-head">
        <div>
          <h2 id="import-history-heading">{tr('Histórico de importações')}</h2>
          <p className="subtitle">{tr('Acompanhe cada lote sem perder o arquivo original nem o resultado materializado.')}</p>
        </div>
        <button className="btn ghost" type="button" onClick={() => void refresh()}>{tr('Atualizar')}</button>
      </div>
      {message && <p className="notice error" role="alert">{tr(message)}</p>}
      {!jobs.length ? <p className="muted">{tr('Nenhum lote importado ainda.')}</p> : (
        <div className="job-list">
          {jobs.map((job) => (
            <div className="job-row" key={job.id}>
              <div>
                <strong>{tr(({ queued: 'Na fila', processing: 'Processando', completed: 'Concluído', failed: 'Falhou' } as Record<string, string>)[job.status] ?? job.status)} · {job.format}</strong>
                <span>{new Date(job.created_at).toLocaleString(locale)} · {job.imported_notes} {locale === 'en' ? 'notes' : 'notas'} · {job.imported_cards} {locale === 'es' ? 'tarjetas' : 'cards'}</span>
                {job.status === 'completed' && <a className="link-button" href={`/decks/${job.deck_id}/cards`}>{tr('Ver cards no deck')}</a>}
                {job.error_message && <small className="notice error">{job.error_message}</small>}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
