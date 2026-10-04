'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '../contexts/LanguageContext';
import { translateUiText } from '../contexts/autoTranslations';
import type { Tables } from '../lib/supabase/client';
import { ingestionService, listIngestionJobs, type SourceType } from '../lib/services/ingestion-service';
import { listFsrsOptimizationRuns, requestFsrsOptimization, type OptimizationRun } from '../lib/services/optimizer-service';

type AiJob = Tables<'ai_ingestion_jobs'>;
const sourceLabels: Record<string, string> = {
  raw_text_block: 'raw text block', web_page: 'web page', youtube_url: 'youtube url', pdf_document: 'pdf document',
};

export function WorkerJobMonitor({ deckId }: { deckId?: string }) {
  const { locale } = useTranslation();
  const [aiJobs, setAiJobs] = useState<AiJob[]>([]);
  const [fsrsRuns, setFsrsRuns] = useState<OptimizationRun[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');
  const tr = (value: string) => translateUiText(value, locale);
  const statusLabel = (status: string) => tr(({ queued: 'Na fila', processing: 'Processando', completed: 'Concluído', failed: 'Falhou', running: 'Executando' } as Record<string, string>)[status] ?? status);
  const refresh = useCallback(async () => {
    const [ai, fsrs] = await Promise.all([listIngestionJobs(deckId), listFsrsOptimizationRuns()]);
    setAiJobs(ai as AiJob[]);
    setFsrsRuns((fsrs ?? []) as OptimizationRun[]);
  }, [deckId]);

  useEffect(() => {
    void refresh().catch(() => setMessage('Não foi possível carregar o histórico dos workers.'));
    const timer = window.setInterval(() => void refresh().catch(() => undefined), 10_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  async function retryAi(job: AiJob) {
    setBusy(job.id);
    try {
      await ingestionService.retry(job as unknown as { deck_id: string; source_type: SourceType; source_reference: string | null });
      await refresh();
      setMessage('Job de ingestão reenfileirado.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível reenfileirar.');
    } finally { setBusy(''); }
  }

  async function retryFsrs() {
    setBusy('fsrs');
    try {
      await requestFsrsOptimization();
      await refresh();
      setMessage('Nova otimização FSRS solicitada.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível solicitar FSRS.');
    } finally { setBusy(''); }
  }

  return (
    <section className="card" aria-labelledby="worker-jobs-heading">
      <div className="section-head">
        <div><h2 id="worker-jobs-heading">{tr('Operações dos workers')}</h2><p className="subtitle">{tr('Acompanhe fila, execução, falhas e reprocessamento. Atualização automática a cada 10 segundos.')}</p></div>
        <button className="btn ghost" type="button" onClick={() => void refresh()}>{tr('Atualizar')}</button>
      </div>
      {message && <p className="notice" role="status">{tr(message)}</p>}
      <div className="job-columns">
        <div>
          <h3>{tr('Ingestão por IA')}</h3>
          {!aiJobs.length ? <p className="muted">{tr('Nenhum job registrado.')}</p> : <div className="job-list">{aiJobs.map((job) => (
            <div className="job-row" key={job.id}>
              <div>
                <strong>{statusLabel(job.status)}</strong>
                <span>{tr(sourceLabels[job.source_type] ?? job.source_type)} · {new Date(job.created_at).toLocaleString(locale)}</span>
                {job.status === 'completed' && <span>{job.notes_generated_count} {tr('notas')} · {job.cards_generated_count} {tr('cards')}</span>}
                {job.status === 'completed' && <a className="link-button" href={`/decks/${job.deck_id}/cards`}>{tr('Ver cards no deck')}</a>}
                {job.error_message && <small className="notice error">{job.error_message}</small>}
              </div>
              {job.status === 'failed' && <button className="link-button" type="button" onClick={() => void retryAi(job)} disabled={busy === job.id}>{tr(busy === job.id ? 'Reenviando…' : 'Tentar novamente')}</button>}
            </div>
          ))}</div>}
        </div>
        <div>
          <h3>{tr('Otimização FSRS')}</h3>
          {!fsrsRuns.length ? <p className="muted">{tr('Nenhuma execução registrada.')}</p> : <div className="job-list">{fsrsRuns.map((run) => (
            <div className="job-row" key={run.id}>
              <div><strong>{statusLabel(run.status)}</strong><span>{run.source_review_count} {locale === 'en' ? 'reviews' : locale === 'es' ? 'repasos' : 'revisões'} · {new Date(run.requested_at).toLocaleString(locale)}</span>{run.error_message && <small className="notice error">{run.error_message}</small>}</div>
              {run.status === 'failed' && <button className="link-button" type="button" onClick={() => void retryFsrs()} disabled={busy === 'fsrs'}>{tr(busy === 'fsrs' ? 'Solicitando…' : 'Solicitar nova execução')}</button>}
            </div>
          ))}</div>}
        </div>
      </div>
      <p className="status-text">{tr('O backend não possui um estado cancelado para estes enums; por isso a UI não oferece um cancelamento fictício.')}</p>
    </section>
  );
}
