'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { listDecks, type Deck } from '../lib/services/deck-service';

export default function DeckLibrary() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [status, setStatus] = useState('Carregando seus decks…');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    listDecks()
      .then((rows) => {
        if (!active) return;
        setDecks(rows);
        setStatus(rows.length ? 'Sincronizado agora' : 'Nenhum deck criado');
      })
      .catch((reason: unknown) => {
        if (!active) return;
        const message = reason instanceof Error ? reason.message : 'Falha desconhecida';
        setError(message === 'AUTH_REQUIRED' ? 'Entre na sua conta para carregar seus decks.' : 'Não foi possível carregar seus decks.');
        setStatus('Sincronização indisponível');
      });

    return () => { active = false; };
  }, []);

  return <section aria-labelledby="library-heading">
    <div className="section-head"><div><h2 id="library-heading">Sua biblioteca <span className="muted">({decks.length})</span></h2><p className="subtitle">Cada deck organiza um assunto e uma próxima revisão.</p></div><Link className="btn" href="/decks/new">Novo deck <span aria-hidden="true">+</span></Link></div>
    <div className="pill" role="status" aria-live="polite" style={{ marginBottom: 16 }}><span className="status-dot" aria-hidden="true" />{status}</div>
    {error && <div className="notice error" role="alert">{error}{' '}<Link href="/login" className="inline-link">Entrar</Link></div>}
    <div className="grid deck-grid">
      {decks.map((deck) => <Link href={`/decks/${deck.id}`} className="card deck-card" key={deck.id} aria-label={`Abrir deck ${deck.name}`}>
        <div className="deck-top"><div className="deck-icon" aria-hidden="true">✦</div><span className="pill">{deck.visibility === 'public' ? 'público' : 'privado'}</span></div>
        <div><h3>{deck.name}</h3><div className="deck-count">{deck.cardCount} cartões</div><div className="stat-label">{deck.newCount} novos · {deck.reviewCount} em revisão</div></div>
        <div><div className="progress" role="progressbar" aria-label={`Progresso de ${deck.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={deck.progress}><span style={{ width: `${deck.progress}%` }} /></div><div className="stat-label" style={{ marginTop: 8 }}>{deck.progress}% revisado</div></div>
      </Link>)}
    </div>
    {!decks.length && !error && <div className="card empty-state"><strong>Crie seu primeiro deck.</strong><span>Comece com um assunto que você quer lembrar melhor.</span><br /><Link className="btn" href="/decks/new">Criar deck</Link></div>}
  </section>;
}
