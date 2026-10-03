'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell, Topbar } from '../AppShell';
import CardBrowser from '../CardBrowser';
import { CollaboratorManager } from './CollaboratorManager';
import { DeckSettingsForm } from './DeckSettingsForm';
import { listDecks, type Deck } from '../../lib/services/deck-service';
import { isEnabled } from '../../lib/config/feature-flags';

export function DeckDetailClient({ deckId }: { deckId: string }) {
  const [deck, setDeck] = useState<Deck | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    listDecks().then((rows) => setDeck(rows.find((row) => row.id === deckId) ?? null)).catch((reason: unknown) => {
      setError(reason instanceof Error && reason.message === 'AUTH_REQUIRED' ? 'Entre na sua conta para abrir este deck.' : 'Não foi possível carregar este deck.');
    });
  }, [deckId]);

  return <AppShell>
    <Topbar title={deck?.name ?? 'Deck'} subtitle={deck?.description ?? 'Conteúdo e próxima revisão deste deck.'} />
    {error && <div className="notice error" role="alert">{error}</div>}
    {!error && !deck && <div className="card" role="status">Carregando deck…</div>}
    {deck && <>
      <div className="grid stats deck-summary" aria-label="Resumo do deck">
        <article className="card"><div className="stat-label">Cartões</div><div className="stat-value">{deck.cardCount}</div></article>
        <article className="card"><div className="stat-label">Para revisar</div><div className="stat-value accent">{deck.reviewCount}</div></article>
        <article className="card"><div className="stat-label">Progresso</div><div className="stat-value">{deck.progress}%</div></article>
      </div>
      <section aria-labelledby="deck-actions-heading">
        <div className="section-head"><div><h2 id="deck-actions-heading">Ações do deck</h2><p className="subtitle">Gerencie conteúdo ou comece uma revisão real.</p></div><div className="section-head-actions"><Link className="btn secondary" href={`/decks/${deckId}/cards`}>Gerenciar cards</Link><Link className="btn" href={`/study/${deckId}`}>Estudar agora <span aria-hidden="true">→</span></Link></div></div>
      </section>
      <CardBrowser deckId={deckId} />
      <DeckSettingsForm deckId={deckId} />
      {isEnabled('collab') && <CollaboratorManager deckId={deckId} />}
    </>}
  </AppShell>;
}
