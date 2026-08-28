'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { AppShell, Topbar } from '../../../components/AppShell';
import { getDueCards, submitReview, type DueCard } from '../../../lib/services/study-service';
import type { Json } from '../../../src/types/database';
import type { Rating } from '../../../lib/db/schema';

function cardFields(value: Json) {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const fields = value as Record<string, Json | undefined>;
    return {
      front: typeof fields.front === 'string' ? fields.front : 'Cartão sem frente',
      back: typeof fields.back === 'string' ? fields.back : 'Cartão sem verso',
    };
  }
  return { front: 'Cartão sem frente', back: 'Cartão sem verso' };
}

const ratings: Array<{ key: Rating; label: string; hint: string }> = [
  { key: 'again', label: '1 · De novo', hint: '< 1 min' },
  { key: 'hard', label: '2 · Difícil', hint: '6 min' },
  { key: 'good', label: '3 · Bom', hint: '10 min' },
  { key: 'easy', label: '4 · Fácil', hint: '4 dias' },
];

export default function Study({ params }: { params: Promise<{ deckId: string }> }) {
  const { deckId } = use(params);
  const [cards, setCards] = useState<DueCard[]>([]);
  const [done, setDone] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getDueCards(deckId, 40)
      .then(setCards)
      .catch((reason: unknown) => {
        setError(reason instanceof Error && reason.message === 'AUTH_REQUIRED'
          ? 'Entre na sua conta para carregar sua fila de estudo.'
          : 'Não foi possível carregar a fila de estudo.');
      })
      .finally(() => setLoading(false));
  }, [deckId]);

  const current = cards[done];
  const currentContent = current ? cardFields(current.fields) : null;

  async function rate(rating: Rating) {
    if (!current || pending) return;
    setPending(true);
    try {
      await submitReview(current.card_id, rating);
      setDone((value) => value + 1);
      setRevealed(false);
    } finally {
      setPending(false);
    }
  }

  useEffect(() => {
    const keyHandler = (event: KeyboardEvent) => {
      if (event.code === 'Space' && current && !pending) {
        event.preventDefault();
        setRevealed(true);
      }
      if (revealed && ['1', '2', '3', '4'].includes(event.key)) {
        void rate(ratings[Number(event.key) - 1].key);
      }
    };
    window.addEventListener('keydown', keyHandler);
    return () => window.removeEventListener('keydown', keyHandler);
  }, [current, pending, revealed]);

  const progress = cards.length === 0 ? 0 : Math.min((done / cards.length) * 100, 100);

  return (
    <AppShell>
      <Topbar title="Sessão de estudo" subtitle="Espaço revela · 1–4 avalia sua lembrança." />
      {error && <div className="notice" role="status">{error}</div>}
      {loading && <div className="card">Carregando a fila real de estudo…</div>}
      {!loading && !error && cards.length === 0 && <div className="card empty-state">Nenhum cartão devido neste deck. Volte mais tarde ou crie novos cards.</div>}
      {!loading && !error && current && currentContent && <>
        <div className="study-shell">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}><span className="pill">{done + 1} de {cards.length}</span><span className="stat-label">progresso da sessão</span></div>
          <div className="progress"><span style={{ width: `${progress}%` }} /></div>
          <div className="card study-card"><span className="eyebrow">Card {current.card_id.slice(0, 8)} · {current.state}</span><h1>{currentContent.front}</h1>{revealed ? <div className="study-answer">{currentContent.back}</div> : <button className="btn secondary" onClick={() => setRevealed(true)}>Revelar resposta · Espaço</button>}</div>
          {revealed && <div className="ratings">{ratings.map((rating) => <button className={`rating ${rating.key}`} disabled={pending} key={rating.key} onClick={() => void rate(rating.key)}>{rating.label}<small>{rating.hint}</small></button>)}</div>}
        </div>
      </>}
      {!loading && !error && done >= cards.length && cards.length > 0 && <div className="notice" style={{ marginTop: 18 }}>Sessão concluída. As avaliações foram encaminhadas para sincronização. <Link href="/">Voltar ao início</Link></div>}
    </AppShell>
  );
}
