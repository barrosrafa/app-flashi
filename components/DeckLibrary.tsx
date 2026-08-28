'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { listDecks, type Deck } from '../lib/services/deck-service';

export default function DeckLibrary() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [status, setStatus] = useState('Carregando dados remotos…');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    listDecks()
      .then((rows) => {
        if (!active) return;
        setDecks(rows);
        setStatus(rows.length ? 'Supabase sincronizado' : 'Nenhum deck remoto');
      })
      .catch((reason: unknown) => {
        if (!active) return;
        const message = reason instanceof Error ? reason.message : 'Falha desconhecida';
        setError(message === 'AUTH_REQUIRED' ? 'Entre na sua conta para carregar seus decks.' : 'Não foi possível carregar seus decks.');
        setStatus('Dados remotos indisponíveis');
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <div className="section-head">
        <h2>Biblioteca ({decks.length})</h2>
        <Link className="btn" href="/decks/new">+ Novo deck</Link>
      </div>
      <div className="pill" style={{ marginBottom: 16 }}>{status}</div>
      {error && <div className="notice" role="status">{error}</div>}
      <div className="grid deck-grid">
        {decks.map((deck) => (
          <Link href={`/decks/${deck.id}`} className="card deck-card" key={deck.id}>
            <div className="deck-top">
              <div className="deck-icon">✦</div>
              <span className="pill">{deck.visibility === 'public' ? 'público' : 'privado'}</span>
            </div>
            <div>
              <h3>{deck.name}</h3>
              <div className="deck-count">{deck.cardCount} cartões</div>
              <div className="stat-label">{deck.newCount} novos · {deck.reviewCount} em revisão</div>
            </div>
            <div>
              <div className="progress"><span style={{ width: `${deck.progress}%` }} /></div>
              <div className="stat-label" style={{ marginTop: 8 }}>{deck.progress}% revisado</div>
            </div>
          </Link>
        ))}
      </div>
      {!decks.length && !error && <div className="card empty-state">Nenhum deck foi criado ainda.</div>}
    </>
  );
}
