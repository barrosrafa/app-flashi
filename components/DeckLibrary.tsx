'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { listArchivedDecks, listDecks, restoreDeck, type Deck } from '../lib/services/deck-service';

export default function DeckLibrary() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [archived, setArchived] = useState<Deck[]>([]);
  const [status, setStatus] = useState('Carregando seus decks…');
  const [error, setError] = useState('');
  const [authRequired, setAuthRequired] = useState(false);

  async function load() {
    setError('');
    setAuthRequired(false);
    try {
      const [active, old] = await Promise.all([listDecks(), listArchivedDecks()]);
      setDecks(active);
      setArchived(old);
      setStatus(active.length ? 'Decks carregados neste dispositivo' : 'Nenhum deck ativo');
    } catch (reason: unknown) {
      const requiresAuth = reason instanceof Error && reason.message === 'AUTH_REQUIRED';
      setAuthRequired(requiresAuth);
      setError(requiresAuth ? 'Entre na sua conta para carregar seus decks.' : 'Não foi possível carregar seus decks.');
      setStatus(requiresAuth ? 'Aguardando acesso à conta' : 'Não foi possível atualizar a biblioteca');
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

  return <section aria-labelledby="library-heading">
    <div className="section-head">
      <div><h2 id="library-heading">Sua biblioteca <span className="muted">({authRequired ? '—' : decks.length})</span></h2><p className="subtitle">Cada deck organiza um assunto e uma próxima revisão.</p></div>
      <Link className="btn" href="/decks/new">Novo deck <span aria-hidden="true">+</span></Link>
    </div>
    {!authRequired && <div className="pill" role="status" aria-live="polite" style={{ marginBottom: 16 }}>{status}</div>}
    {error && <div className="notice error" role="alert">{error}{' '}<Link href="/login" className="inline-link">Entrar</Link></div>}
    <div className="grid deck-grid">{decks.map((deck) => <Link href={`/decks/${deck.id}`} className="card deck-card" key={deck.id} aria-label={`Abrir deck ${deck.name}`}><div className="deck-top"><div className="deck-icon" aria-hidden="true">✦</div><span className="pill">{deck.visibility}</span></div><div><h3>{deck.name}</h3><div className="deck-count">{deck.cardCount} cartões</div><div className="stat-label">{deck.newCount} novos · {deck.reviewCount} em revisão</div></div><div><div className="progress" role="progressbar" aria-label={`Progresso de ${deck.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={deck.progress}><span style={{ width: `${deck.progress}%` }} /></div><div className="stat-label" style={{ marginTop: 8 }}>Cards em etapa de revisão: {deck.progress}%</div></div></Link>)}</div>
    {!decks.length && !error && <div className="card empty-state"><strong>Crie seu primeiro deck.</strong><span>Comece com um assunto que você quer lembrar melhor.</span><br /><Link className="btn" href="/decks/new">Criar deck</Link></div>}
    {archived.length > 0 && <section className="card" style={{ marginTop: 22 }}><div className="section-head compact-head"><div><h2>Arquivados e excluídos</h2><p className="subtitle">Itens arquivados continuam restauráveis.</p></div></div><div className="job-list">{archived.map((deck) => <div className="job-row" key={deck.id}><div><strong>{deck.name}</strong><span>{deck.is_archived ? 'Arquivado' : 'Excluído'} · {deck.visibility}</span></div><button className="link-button" type="button" onClick={() => void restore(deck.id)}>Restaurar</button></div>)}</div></section>}
  </section>;
}
