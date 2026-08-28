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
    setLoading(true);
    getDueCards(deckId, 40)
      .then(setCards)
      .catch((reason: unknown) => {
        setError(reason instanceof Error && reason.message === 'AUTH_REQUIRED'
          ? 'Entre na sua conta para carregar sua fila de estudo.'
          : 'Não foi possível carregar a fila de estudo. Tente novamente.');
      })
      .finally(() => setLoading(false));
  }, [deckId]);

  const current = cards[done];
  const currentContent = current ? cardFields(current.fields) : null;

  async function rate(rating: Rating) {
    if (!current || pending) return;
    setError('');
    setPending(true);
    try {
      await submitReview(current.card_id, rating);
      setDone((value) => value + 1);
      setRevealed(false);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível salvar esta avaliação. Tente novamente.');
    } finally {
      setPending(false);
    }
  }

  useEffect(() => {
    const keyHandler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if (isTyping || !current || pending) return;
      if (event.code === 'Space' && !revealed) {
        event.preventDefault();
        setRevealed(true);
      }
      if (revealed && ['1', '2', '3', '4'].includes(event.key)) {
        event.preventDefault();
        void rate(ratings[Number(event.key) - 1].key);
      }
    };
    window.addEventListener('keydown', keyHandler);
    return () => window.removeEventListener('keydown', keyHandler);
  }, [current, pending, revealed]);

  const progress = cards.length === 0 ? 0 : Math.min((done / cards.length) * 100, 100);
  const completed = !loading && !error && done >= cards.length && cards.length > 0;

  return (
    <AppShell>
      <Topbar title="Sessão de estudo" subtitle="Revele a resposta e escolha o quanto você lembrou." />
      {error && <div className="notice error" role="alert">{error}{' '}<Link href="/decks" className="inline-link">Voltar aos decks</Link></div>}
      {loading && <div className="card" role="status" aria-live="polite" aria-busy="true">Carregando a fila real de estudo…</div>}
      {!loading && !error && cards.length === 0 && <div className="card empty-state"><strong>Nenhum cartão para revisar agora.</strong><span>Volte mais tarde ou adicione cards a este deck para começar uma nova sessão.</span><br /><Link className="btn secondary" href={`/decks/${deckId}/cards`}>Gerenciar cards</Link></div>}
      {!loading && !error && current && currentContent && <section className="study-shell" aria-labelledby="study-card-title">
        <div className="study-meta"><span className="pill">{done + 1} de {cards.length}</span><span className="stat-label">progresso da sessão</span></div>
        <div className="progress" role="progressbar" aria-label="Progresso da sessão" aria-valuemin={0} aria-valuemax={cards.length} aria-valuenow={done}><span style={{ width: `${progress}%` }} /></div>
        <div className="card study-card" aria-live="polite">
          <span className="eyebrow">Cartão {current.card_id.slice(0, 8)} · {current.state}</span>
          <h1 id="study-card-title">{currentContent.front}</h1>
          {revealed ? <div className="study-answer"><div className="study-answer-label">Resposta</div>{currentContent.back}</div> : <button className="btn secondary" type="button" onClick={() => setRevealed(true)} aria-keyshortcuts="Space">Revelar resposta <span aria-hidden="true">· Espaço</span></button>}
        </div>
        {revealed && <div className="ratings" aria-label="Avalie sua lembrança">{ratings.map((rating) => <button className={`rating ${rating.key}`} type="button" disabled={pending} key={rating.key} onClick={() => void rate(rating.key)} aria-label={`${rating.label}, próxima revisão ${rating.hint}`}>{rating.label}<small>{rating.hint}</small></button>)}</div>}
        {pending && <p className="status-text" role="status" aria-live="polite">Salvando sua avaliação…</p>}
      </section>}
      {completed && <div className="notice success" style={{ marginTop: 18 }} role="status">Sessão concluída. As avaliações foram encaminhadas para sincronização. <Link href="/" className="inline-link">Voltar ao início</Link></div>}
    </AppShell>
  );
}
