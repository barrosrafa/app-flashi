'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Tables } from '../lib/supabase/client';
import { ingestionService, listIngestionJobs, type IngestJob, type SourceType } from '../lib/services/ingestion-service';
import { listFsrsOptimizationRuns, requestFsrsOptimization, type OptimizationRun } from '../lib/services/optimizer-service';

type AiJob = Tables<'ai_ingestion_jobs'>;
function statusLabel(status: string) { return ({ queued: 'Na fila', processing: 'Processando', completed: 'Concluído', failed: 'Falhou', running: 'Executando' } as Record<string, string>)[status] ?? status; }

export function WorkerJobMonitor({ deckId }: { deckId?: string }) {
  const [aiJobs, setAiJobs] = useState<AiJob[]>([]);
  const [fsrsRuns, setFsrsRuns] = useState<OptimizationRun[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');
  const refresh = useCallback(async () => { const [ai, fsrs] = await Promise.all([listIngestionJobs(deckId), listFsrsOptimizationRuns()]); setAiJobs(ai as AiJob[]); setFsrsRuns((fsrs ?? []) as OptimizationRun[]); }, [deckId]);
  useEffect(() => { void refresh().catch(() => setMessage('Não foi possível carregar o histórico dos workers.')); const timer = window.setInterval(() => void refresh().catch(() => undefined), 10_000); return () => window.clearInterval(timer); }, [refresh]);
  async function retryAi(job: AiJob) { setBusy(job.id); try { await ingestionService.retry(job as unknown as { deck_id: string; source_type: SourceType; source_reference: string | null }); await refresh(); setMessage('Job de ingestão reenfileirado.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível reenfileirar.'); } finally { setBusy(''); } }
  async function retryFsrs() { setBusy('fsrs'); try { await requestFsrsOptimization(); await refresh(); setMessage('Nova otimização FSRS solicitada.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível solicitar FSRS.'); } finally { setBusy(''); } }
  return <section className="card" aria-labelledby="worker-jobs-heading"><div className="section-head"><div><h2 id="worker-jobs-heading">Operações dos workers</h2><p className="subtitle">Acompanhe fila, execução, falhas e reprocessamento. Atualização automática a cada 10 segundos.</p></div><button className="btn ghost" type="button" onClick={() => void refresh()}>Atualizar</button></div>{message && <p className="notice" role="status">{message}</p>}<div className="job-columns"><div><h3>Ingestão por IA</h3>{!aiJobs.length ? <p className="muted">Nenhum job registrado.</p> : <div className="job-list">{aiJobs.map((job) => <div className="job-row" key={job.id}><div><strong>{statusLabel(job.status)}</strong><span>{job.source_type} · {new Date(job.created_at).toLocaleString('pt-BR')}</span>{job.error_message && <small className="notice error">{job.error_message}</small>}</div>{job.status === 'failed' && <button className="link-button" type="button" onClick={() => void retryAi(job)} disabled={busy === job.id}>{busy === job.id ? 'Reenviando…' : 'Tentar novamente'}</button>}</div>)}</div>}</div><div><h3>Otimização FSRS</h3>{!fsrsRuns.length ? <p className="muted">Nenhuma execução registrada.</p> : <div className="job-list">{fsrsRuns.map((run) => <div className="job-row" key={run.id}><div><strong>{statusLabel(run.status)}</strong><span>{run.source_review_count} revisões · {new Date(run.requested_at).toLocaleString('pt-BR')}</span>{run.error_message && <small className="notice error">{run.error_message}</small>}</div>{run.status === 'failed' && <button className="link-button" type="button" onClick={() => void retryFsrs()} disabled={busy === 'fsrs'}>{busy === 'fsrs' ? 'Solicitando…' : 'Solicitar nova execução'}</button>}</div>)}</div>}</div></div><p className="status-text">O backend não possui um estado cancelado para estes enums; por isso a UI não oferece um cancelamento fictício.</p></section>;
}
