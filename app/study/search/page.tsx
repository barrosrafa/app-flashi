'use client';
import { useState } from 'react';
import { AppShell, Topbar } from '../../../components/AppShell';
import { isFeatureEnabled } from '../../../lib/feature-flags';
import { semanticSearchService, type SemanticHit } from '../../../lib/services/semantic-search-service';
export default function SemanticSearchPage() {
  const [query, setQuery] = useState(''); const [hits, setHits] = useState<SemanticHit[]>([]); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  if (!isFeatureEnabled('semantic')) return <AppShell><Topbar title="Busca semântica" /><div className="card empty-state">Esta funcionalidade está desativada.</div></AppShell>;
  async function submit(event: React.FormEvent) { event.preventDefault(); setBusy(true); setMessage('Buscando por significado…'); try { const result = await semanticSearchService.query(query); setHits(result.results); setMessage(`${result.results.length} resultado(s) encontrado(s).`); } catch (error) { setMessage(error instanceof Error ? error.message : 'Busca indisponível.'); } finally { setBusy(false); } }
  return <AppShell><Topbar title="Busca semântica" subtitle="Encontre notas pelo significado, não apenas por palavras exatas." /><section className="card"><form className="form" onSubmit={submit}><div className="field"><label htmlFor="semantic-query">Consulta</label><input id="semantic-query" value={query} onChange={(e) => setQuery(e.target.value)} minLength={3} maxLength={8000} placeholder="Ex.: como funciona a sincronização offline?" required /></div><button className="btn" disabled={busy}>{busy ? 'Buscando…' : 'Buscar'}</button></form><p className="status-text" role="status">{message}</p><div className="result-list">{hits.map((hit) => <article className="result-item" key={hit.note_id}><strong>{Math.round(hit.similarity * 100)}%</strong> · {hit.match_type}<p>{typeof hit.fields === 'object' && hit.fields !== null ? Object.values(hit.fields).filter((v): v is string => typeof v === 'string').join(' · ') : String(hit.fields)}</p></article>)}</div></section></AppShell>;
}
