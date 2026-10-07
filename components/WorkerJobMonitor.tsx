'use client';
import { invokeEdge } from '../lib/services/http/edge-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Tables } from '../lib/supabase/client';
import { createClient } from '../lib/supabase/client';
import { listIngestionJobs } from '../lib/services/ingestion-service';
import { listFsrsOptimizationRuns, type OptimizationRun } from '../lib/services/optimizer-service';

type DraftNote = { fields: Record<string, unknown>; cards: unknown[] };
type AiJob = Omit<Tables<'ai_ingestion_jobs'>,'status'> & { status: string; attempt_count?: number; heartbeat_at?: string; result_draft?: DraftNote[] };
type FsrsRun = OptimizationRun & { attempt_count?: number; heartbeat_at?: string };
const sourceLabels: Record<string,string> = { raw_text_block:'Texto',web_page:'Página web',youtube_url:'Vídeo',pdf_document:'Documento PDF' };
const labels: Record<string,string> = { queued:'Na fila',processing:'Processando',running:'Executando',awaiting_review:'Sugestões prontas para revisar',completed:'Concluído',failed:'Falhou',cancelled:'Cancelado',retrying:'Tentando novamente' };
export function isStaleJob(status: string, heartbeat?: string | null, created?: string, now = Date.now()) {
  return ['queued','processing','running'].includes(status) && now-Date.parse(heartbeat || created || new Date(now).toISOString()) > 300_000;
}
function safeJobError(message: string) {
  if (/Missing OPENAI|AI_PROVIDER_NOT_CONFIGURED/.test(message)) return 'O serviço de geração ainda não está configurado. Os dados permanecem salvos; a equipe responsável precisa habilitar o provedor.';
  if (/QUOTA/.test(message)) return 'A cota de geração foi atingida. Tente mais tarde ou use importação de arquivo.';
  return message;
}
export function WorkerJobMonitor({ deckId }: { deckId?: string }) {
  const [aiJobs,setAiJobs] = useState<AiJob[]>([]);
  const [runs,setRuns] = useState<FsrsRun[]>([]);
  const [errors,setErrors] = useState({ ai:'',fsrs:'' });
  const [message,setMessage] = useState('');
  const [busy,setBusy] = useState<string[]>([]);
  const locks = useRef(new Set<string>());
  const [selected,setSelected] = useState<Record<string,number[]>>({});
  const refresh = useCallback(async () => {
    const [ai,fsrs] = await Promise.allSettled([listIngestionJobs(deckId),listFsrsOptimizationRuns()]);
    if (ai.status==='fulfilled') { setAiJobs(ai.value as AiJob[]); setErrors((old) => ({...old,ai:''})); }
    else setErrors((old) => ({...old,ai:'Não foi possível carregar as gerações. Tente atualizar.'}));
    if (fsrs.status==='fulfilled') { setRuns(fsrs.value as FsrsRun[]); setErrors((old) => ({...old,fsrs:''})); }
    else setErrors((old) => ({...old,fsrs:'Não foi possível carregar as otimizações. Tente atualizar.'}));
  },[deckId]);
  useEffect(() => { void refresh(); const timer=window.setInterval(() => void refresh(),10_000); return () => window.clearInterval(timer); },[refresh]);
  async function perform(key:string,operation:()=>Promise<unknown>,success:string) {
    if (locks.current.has(key)) return;
    locks.current.add(key); setBusy((old) => [...old,key]); setMessage('');
    try { await operation(); await refresh(); setMessage(success); }
    catch (error) { setMessage(error instanceof Error ? safeJobError(error.message) : 'Não foi possível concluir. Tente novamente.'); }
    finally { locks.current.delete(key); setBusy((old) => old.filter((id) => id!==key)); }
  }
  async function control(type:'ai'|'fsrs',id:string,action:'retry'|'cancel') {
    return perform(id,async () => { const {error}=await (createClient() as any).rpc('control_worker_job',{p_job_type:type,p_job_id:id,p_action:action}); if(error) throw new Error(error.message); if(action==='retry') await invokeEdge(type==='ai'?'ai-ingest':'fsrs-optimize',{body:type==='ai'?{action:'dispatch',job_id:id}:{mode:'dispatch',run_id:id}}); },action==='retry'?'Operação reenfileirada.':'Operação cancelada.');
  }
  function toggle(jobId:string,index:number) { setSelected((old) => { const values=old[jobId]??[]; return {...old,[jobId]:values.includes(index)?values.filter((value)=>value!==index):[...values,index]}; }); }
  function diagnostics(status:string,attempt:number|undefined,heartbeat:string|undefined,created:string) {
    const stale=isStaleJob(status,heartbeat,created);
    return <><span>Tentativa {attempt??0} · criada em {new Date(created).toLocaleString('pt-BR')}</span><small>Última atividade: {heartbeat?new Date(heartbeat).toLocaleString('pt-BR'):'execução ainda não iniciada'}</small>{stale&&<p className="notice error">Sem atividade há mais de 5 minutos. Você pode reenfileirar ou cancelar esta operação; ela não será apresentada como concluída.</p>}</>;
  }
  return <section className="card" aria-labelledby="worker-jobs-heading">
    <div className="section-head"><div><h2 id="worker-jobs-heading">Operações de processamento</h2><p className="subtitle">Geração, revisão de sugestões, publicação e otimização. Atualização a cada 10 segundos.</p></div><button className="btn ghost" type="button" onClick={()=>void refresh()}>Atualizar</button></div>
    {message&&<p className="notice" role="status">{message}</p>}
    <div className="job-columns"><div><h3>Geração por IA</h3>{errors.ai&&<p className="notice error" role="alert">{errors.ai}</p>}
      {!errors.ai&&!aiJobs.length&&<p className="muted">Nenhuma geração registrada. Envie uma fonte para receber sugestões; nada será publicado sem sua seleção.</p>}
      {aiJobs.map((job)=><div className="job-row" key={job.id}><div><strong>{labels[job.status]??job.status}</strong><span>{sourceLabels[job.source_type]??'Fonte de conteúdo'}</span>{diagnostics(job.status,job.attempt_count,job.heartbeat_at,job.created_at)}
        {job.error_message&&<p className="notice error">{safeJobError(job.error_message)}</p>}
        {job.status==='awaiting_review'&&Array.isArray(job.result_draft)&&<div className="ai-draft-review"><h4>Revise e selecione as notas</h4><p>Somente as sugestões selecionadas serão publicadas no deck.</p>{job.result_draft.map((note,index)=><details key={index}><summary><label><input type="checkbox" checked={(selected[job.id]??[]).includes(index)} onChange={()=>toggle(job.id,index)} /> Sugestão {index+1} · {note.cards.length} cartão(ões)</label></summary><pre><span data-user-content="">{JSON.stringify(note.fields,null,2)}</span></pre></details>)}<button className="btn" type="button" disabled={busy.includes(job.id)||!(selected[job.id]?.length)} onClick={()=>void perform(job.id,async()=>{ const {error}=await (createClient() as any).rpc('publish_ai_ingestion_draft',{p_job_id:job.id,p_selected_indices:selected[job.id]??[]});if(error)throw new Error(error.message); },'Sugestões selecionadas publicadas.')}>Publicar selecionadas ({selected[job.id]?.length??0})</button></div>}
        {job.status==='completed'&&<><span>{job.notes_generated_count} notas · {job.cards_generated_count} cartões publicados</span><a className="link-button" href={`/decks/${job.deck_id}/cards`}>Ver cartões publicados</a></>}
      </div><div>{(['failed','cancelled'].includes(job.status)||isStaleJob(job.status,job.heartbeat_at,job.created_at))&&<button className="link-button" type="button" disabled={busy.includes(job.id)} onClick={()=>void control('ai',job.id,'retry')}>Tentar novamente</button>}{['queued','processing','awaiting_review'].includes(job.status)&&<button className="link-button" type="button" disabled={busy.includes(job.id)} onClick={()=>void control('ai',job.id,'cancel')}>Cancelar processamento</button>}</div></div>)}
    </div><div><h3>Otimização da revisão</h3>{errors.fsrs&&<p className="notice error" role="alert">{errors.fsrs}</p>}{!errors.fsrs&&!runs.length&&<p className="muted">Nenhuma otimização registrada.</p>}
      {runs.map((run)=><div className="job-row" key={run.id}><div><strong>{labels[run.status]??run.status}</strong><span>{run.source_review_count} revisões confirmadas</span>{diagnostics(run.status,run.attempt_count,run.heartbeat_at,run.requested_at)}{run.error_message&&<p className="notice error">{safeJobError(run.error_message)}</p>}</div><div>{(['failed','cancelled'].includes(run.status)||isStaleJob(run.status,run.heartbeat_at,run.requested_at))&&<button className="link-button" type="button" disabled={busy.includes(run.id)} onClick={()=>void control('fsrs',run.id,'retry')}>Tentar novamente</button>}{['queued','running'].includes(run.status)&&<button className="link-button" type="button" disabled={busy.includes(run.id)} onClick={()=>void control('fsrs',run.id,'cancel')}>Cancelar otimização</button>}</div></div>)}
    </div></div>
  </section>;
}
