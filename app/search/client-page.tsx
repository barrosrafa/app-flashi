'use client';
import { useEffect, useRef, useState } from 'react';
import { AppShell, Topbar } from '../../components/AppShell';
import { SemanticHitRow } from '../../components/SemanticHitRow';
import { RateLimitBanner } from '../../components/RateLimitBanner';
import { isEnabled } from '../../lib/config/feature-flags';
import { semanticSearchService, type SearchResult } from '../../lib/services/semantic-search-service';

export default function SearchPage() {
  const [q, setQ] = useState(''); const [result, setResult] = useState<SearchResult | null>(null); const [rate, setRate] = useState<number | null>(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(false); const request = useRef(0);
  const runSearch = async (query: string, id: number) => { setLoading(true); setError(''); setRate(null); try { const next = await semanticSearchService.query(query); if (id === request.current) setResult(next); } catch (reason: unknown) { if (id !== request.current) return; if (reason instanceof Error && 'retryAfterSec' in reason) setRate(Number((reason as { retryAfterSec: number }).retryAfterSec)); else setError('Não foi possível concluir a busca. Tente novamente.'); } finally { if (id === request.current) setLoading(false); } };
  useEffect(() => { if (!isEnabled('semantic_search')) return; const query = q.trim(); const id = ++request.current; if (query.length < 3) { setResult(null); setError(query ? 'Digite pelo menos 3 caracteres.' : ''); setLoading(false); return; } const timer = setTimeout(() => void runSearch(query, id), 350); return () => clearTimeout(timer); }, [q]);
  if (!isEnabled('semantic_search')) return <AppShell><Topbar title="Busca" /><div className="card empty-state">Esta funcionalidade está desativada.</div></AppShell>;
  return <AppShell><Topbar title="Busca semântica" subtitle="Encontre notas pelo significado." /><section className="card"><label className="sr-only" htmlFor="semantic-search">Buscar notas</label><input id="semantic-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por significado…" aria-label="Busca" />{rate !== null && <RateLimitBanner retryAfterSec={rate} onExpire={() => setRate(null)} />}{error && <div className="notice error" role="alert">{error} <button className="link-button" type="button" onClick={() => { const id = ++request.current; void runSearch(q.trim(), id); }}>Tentar novamente</button></div>}{loading && <p className="status-text" role="status">Buscando…</p>}{!loading && !error && result && <><p className="status-text">Modo: {result.mode} · {result.results.length} resultado(s)</p>{result.results.length ? <ul className="result-list">{result.results.map((hit) => <SemanticHitRow key={hit.note_id} hit={hit} />)}</ul> : <div className="empty-state">Nenhuma nota encontrada para esta busca.</div>}</>}</section></AppShell>;
}
