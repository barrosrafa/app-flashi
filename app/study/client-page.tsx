'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell, Topbar } from '../../components/AppShell';
import { listDecks, type Deck } from '../../lib/services/deck-service';

export default function StudyStartPage() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    listDecks().then(setDecks).catch((reason: unknown) => {
      setError(reason instanceof Error && reason.message === 'AUTH_REQUIRED'
        ? 'Entre na sua conta para acessar seus decks.'
        : 'Não foi possível carregar seus decks agora.');
    }).finally(() => setLoading(false));
  }, []);
  return <AppShell>
    <Topbar title="Estudar" subtitle="Escolha um deck e continue de onde parou." />
    {loading && <p className="card" role="status">Carregando seus decks…</p>}
    {error && <div className="notice error" role="alert">{error} <Link href="/login" className="inline-link">Entrar</Link></div>}
    {!loading && !error && decks.length === 0 && <div className="card empty-state"><strong>Seu próximo passo é criar um deck.</strong><span>Organize um assunto e adicione alguns cards para começar a revisar.</span><Link href="/decks/new" className="btn">Criar primeiro deck</Link></div>}
    {!loading && !error && decks.length > 0 && <section aria-labelledby="choose-deck-title"><div className="section-head compact-head"><div><h2 id="choose-deck-title">Escolha um deck</h2><p className="subtitle">A sessão começa com os cards disponíveis para revisar.</p></div></div><div className="grid deck-grid">{decks.map((deck) => <article className="card deck-card" key={deck.id}><div><h3><span data-user-content="">{deck.name}</span></h3><p className="deck-count">{deck.reviewCount} para revisar · {deck.newCount} novos</p></div><Link className="btn" href={`/study/${deck.id}`}>Estudar este deck<span aria-hidden="true">→</span></Link></article>)}</div></section>}
  </AppShell>;
}
