'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { listArchivedDecks, listDecks, restoreDeck, type Deck } from '../lib/services/deck-service';

export type DeckLibraryViewState = 'loading' | 'empty' | 'success' | 'error' | 'not-found';

export function getDeckLibraryViewState(input: { loading: boolean; decks: Deck[]; error: string; notFound?: boolean }): DeckLibraryViewState {
  if (input.loading) return 'loading';
  if (input.notFound) return 'not-found';
  if (input.error) return 'error';
  return input.decks.length ? 'success' : 'empty';
}

function isNotFoundError(reason: unknown) {
  if (reason instanceof Error && reason.message === 'DECK_NOT_FOUND') return true;
  if (!reason || typeof reason !== 'object') return false;
  const candidate = reason as { status?: unknown; code?: unknown };
  return candidate.status === 404 || candidate.code === 'PGRST116';
}

export default function DeckLibrary() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [archived, setArchived] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    setNotFound(false);
    setAuthRequired(false);
    try {
      const [active, old] = await Promise.all([listDecks(), listArchivedDecks()]);
      setDecks(active);
      setArchived(old);
    } catch (reason: unknown) {
      const requiresAuth = reason instanceof Error && reason.message === 'AUTH_REQUIRED';
      const requiresSetup = reason instanceof Error && reason.message === 'SUPABASE_NOT_CONFIGURED';
      setAuthRequired(requiresAuth);
      setNotFound(isNotFoundError(reason));
      setError(requiresSetup
        ? 'Configure a conexão do Supabase para carregar seus decks.'
        : requiresAuth ? 'Entre na sua conta para carregar seus decks.' : isNotFoundError(reason) ? 'A biblioteca solicitada não foi encontrada.' : 'Não foi possível carregar seus decks.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function restore(id: string) {
    try {
      await restoreDeck(id);
      await load();
    } catch {
      setError('Não foi possível restaurar o deck.');
    }
  }

  const state = getDeckLibraryViewState({ loading, decks, error, notFound });
  const count = state === 'loading' || state === 'error' || state === 'not-found' ? '—' : decks.length;

  return <section aria-labelledby="library-heading">
    <div className="section-head">
      <div><h2 id="library-heading">Sua biblioteca <span className="muted">({count})</span></h2><p className="subtitle">Cada deck organiza um assunto e uma próxima revisão.</p></div>
      <Link className="btn" href="/decks/new">Novo deck <span aria-hidden="true">+</span></Link>
    </div>
    {state === 'loading' && <div className="card" role="status" aria-live="polite">Carregando seus decks…</div>}
    {state === 'error' && <div className="notice error" role="alert">{error}{authRequired && <> <Link href="/login" className="inline-link">Entrar</Link></>}</div>}
    {state === 'not-found' && <div className="card" role="status"><strong>Biblioteca não encontrada.</strong><span>Volte para seus decks e tente novamente.</span><Link className="btn secondary" href="/decks">Voltar para decks</Link></div>}
    {state === 'success' && <>
      <div className="pill" role="status" aria-live="polite" style={{ marginBottom: 16 }}>Decks carregados neste dispositivo</div>
      <div className="grid deck-grid">{decks.map((deck) => <Link href={`/decks/${deck.id}`} className="card deck-card" key={deck.id} aria-label={`Abrir deck ${deck.name}`}><div className="deck-top"><div className="deck-icon" aria-hidden="true">✦</div><span className="pill">{deck.visibility}</span></div><div><h3><span data-user-content="">{deck.name}</span></h3><div className="deck-count">{deck.cardCount} cartões</div><div className="stat-label">{deck.newCount} novos · {deck.reviewCount} em revisão</div></div><div><div className="progress" role="progressbar" aria-label={`Progresso de ${deck.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={deck.progress}><span style={{ width: `${deck.progress}%` }} /></div><div className="stat-label" style={{ marginTop: 8 }}>Cards em etapa de revisão: {deck.progress}%</div></div></Link>)}</div>
    </>}
    {state === 'empty' && <div className="card empty-state"><strong>Crie seu primeiro deck.</strong><span>Comece com um assunto que você quer lembrar melhor.</span><br /><Link className="btn" href="/decks/new">Criar deck</Link></div>}
    {archived.length > 0 && state !== 'loading' && <section className="card" style={{ marginTop: 22 }}><div className="section-head compact-head"><div><h2>Arquivados e excluídos</h2><p className="subtitle">Itens arquivados continuam restauráveis.</p></div></div><div className="job-list">{archived.map((deck) => <div className="job-row" key={deck.id}><div><strong><span data-user-content="">{deck.name}</span></strong><span>{deck.is_archived ? 'Arquivado' : 'Excluído'} · {deck.visibility}</span></div><button className="link-button" type="button" onClick={() => void restore(deck.id)}>Restaurar</button></div>)}</div></section>}
  </section>;
}
