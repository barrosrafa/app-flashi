'use client';
import { useCallback, useEffect, useState } from 'react';
import { listImportJobs, type ImportJob } from '../lib/services/import-deck-service';
function label(status: string) { return ({ queued: 'Na fila', processing: 'Processando', completed: 'Concluído', failed: 'Falhou' } as Record<string, string>)[status] ?? status; }
export function ImportJobMonitor({ deckId }: { deckId?: string }) {
  const [jobs, setJobs] = useState<ImportJob[]>([]); const [message, setMessage] = useState('');
  const refresh = useCallback(async () => { setJobs(await listImportJobs(deckId)); }, [deckId]);
  useEffect(() => { void refresh().catch(() => setMessage('Não foi possível carregar o histórico de importações.')); const timer = window.setInterval(() => void refresh().catch(() => undefined), 10_000); return () => window.clearInterval(timer); }, [refresh]);
  return <section className="card" aria-labelledby="import-history-heading"><div className="section-head"><div><h2 id="import-history-heading">Histórico de importações</h2><p className="subtitle">Acompanhe cada lote sem perder o arquivo original nem o resultado materializado.</p></div><button className="btn ghost" type="button" onClick={() => void refresh()}>Atualizar</button></div>{message && <p className="notice error" role="alert">{message}</p>}{!jobs.length ? <p className="muted">Nenhum lote importado ainda.</p> : <div className="job-list">{jobs.map((job) => <div className="job-row" key={job.id}><div><strong>{label(job.status)} · {job.format}</strong><span>{new Date(job.created_at).toLocaleString('pt-BR')} · {job.imported_notes} notas · {job.imported_cards} cards</span>{job.error_message && <small className="notice error">{job.error_message}</small>}</div></div>)}</div>}</section>;
}
