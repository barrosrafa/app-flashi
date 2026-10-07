'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppShell, Topbar } from './AppShell';
import { RateLimitBanner } from './RateLimitBanner';
import { SemanticHitRow } from './SemanticHitRow';
import { RateLimitError, UnavailableError } from '../lib/services/http/errors';
import { semanticSearchService, type SearchResult } from '../lib/services/semantic-search-service';

type SearchWorkspaceProps = {
  title?: string;
  subtitle?: string;
};

function searchErrorMessage(reason: unknown): string {
  if (reason instanceof UnavailableError) {
    return 'A busca semântica está temporariamente indisponível. Tente novamente em instantes.';
  }
  if (reason instanceof Error && reason.message === 'QUERY_TOO_SHORT') {
    return 'Digite pelo menos 3 caracteres para buscar.';
  }
  if (reason instanceof Error && reason.name === 'EdgeTimeoutError') {
    return 'A busca demorou mais que o esperado. Tente novamente.';
  }
  return 'Não foi possível concluir a busca. Tente novamente.';
}

export function SearchWorkspace({
  title = 'Busca semântica',
  subtitle = 'Encontre notas pelo significado.',
}: SearchWorkspaceProps) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [rate, setRate] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const request = useRef(0);

  const runSearch = useCallback(async (rawQuery: string, id: number) => {
    const cleanQuery = rawQuery.trim();
    if (id !== request.current) return;
    setLoading(true);
    setResult(null);
    setError('');
    setRate(null);
    try {
      const next = await semanticSearchService.query(cleanQuery);
      if (id === request.current) setResult(next);
    } catch (reason: unknown) {
      if (id !== request.current) return;
      if (reason instanceof RateLimitError) {
        setRate(Math.max(1, Math.ceil(reason.retryAfterSec)));
      } else {
        setError(searchErrorMessage(reason));
      }
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, []);

  const retry = useCallback(() => {
    const cleanQuery = query.trim();
    if (cleanQuery.length < 3) return;
    const id = ++request.current;
    void runSearch(cleanQuery, id);
  }, [query, runSearch]);

  useEffect(() => {
    const cleanQuery = query.trim();
    const id = ++request.current;
    setResult(null);
    setError('');
    setRate(null);
    if (!cleanQuery) {
      setLoading(false);
      return undefined;
    }
    if (cleanQuery.length < 3) {
      setLoading(false);
      setError('Digite pelo menos 3 caracteres para buscar.');
      return undefined;
    }
    const timer = window.setTimeout(() => void runSearch(cleanQuery, id), 350);
    return () => window.clearTimeout(timer);
  }, [query, runSearch]);

  const updateQuery = (value: string) => {
    setQuery(value);
    setResult(null);
    setError('');
    setRate(null);
  };

  return (
    <AppShell>
      <Topbar title={title} subtitle={subtitle} />
      <section className="card">
        <label className="sr-only" htmlFor="semantic-search">Buscar notas</label>
        <input
          id="semantic-search"
          value={query}
          onChange={(event) => updateQuery(event.target.value)}
          placeholder="Buscar por significado…"
          aria-label="Busca"
          maxLength={8000}
        />
        {rate !== null && (
          <RateLimitBanner
            retryAfterSec={rate}
            onExpire={() => setRate(null)}
            onRetry={retry}
          />
        )}
        {error && (
          <div className="notice error" role="alert">
            {error}
            <button className="link-button" type="button" onClick={retry}>Tentar novamente</button>
          </div>
        )}
        {loading && <p className="status-text" role="status">Buscando…</p>}
        {!loading && !error && rate === null && result && (
          <>
            <p className="status-text" role="status">Modo: {result.mode} · {result.results.length} resultado(s)</p>
            {result.results.length ? (
              <ul className="result-list">
                {result.results.map((hit) => <SemanticHitRow key={hit.note_id} hit={hit} />)}
              </ul>
            ) : (
              <div className="empty-state">
                <p>Nenhuma nota encontrada para esta busca.</p>
                <button className="link-button" type="button" onClick={retry}>Tentar novamente</button>
              </div>
            )}
          </>
        )}
      </section>
    </AppShell>
  );
}
