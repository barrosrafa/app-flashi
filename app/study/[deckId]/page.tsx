'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { AppShell, Topbar } from '../../../components/AppShell';
import { getDueCards, submitReview, type DueCard } from '../../../lib/services/study-service';
import type { Json } from '../../../src/types/database';
import type { Rating } from '../../../lib/db/schema';
import { createClient } from '../../../lib/supabase/client';
import { normalizeTemplate, renderCard, renderDefaultCard, type RenderedCard } from '../../../lib/services/template-renderer';

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

const ratings: Array<{ key: Rating; label: string; hint: string; tone: string }> = [
  { key: 'again', label: 'De novo', hint: '< 1 min', tone: 'again' },
  { key: 'hard', label: 'Difícil', hint: '6 min', tone: 'hard' },
  { key: 'good', label: 'Bom', hint: '10 min', tone: 'good' },
  { key: 'easy', label: 'Fácil', hint: '4 dias', tone: 'easy' },
];

const demoCard = {
  card_id: 'demo-card-001',
  deck_id: 'demo',
  fields: { front: 'O que é repetição espaçada?', back: 'Um método que agenda revisões no momento em que você está prestes a esquecer o conteúdo.' } as Json,
  state: 'new' as const,
  due_at: new Date().toISOString(),
  interval_days: 0,
};

export default function Study({ params }: { params: Promise<{ deckId: string }> }) {
  const { deckId } = use(params);
  const [cards, setCards] = useState<DueCard[]>([]);
  const [done, setDone] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [focusMode, setFocusMode] = useState(true);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [renderedContent, setRenderedContent] = useState<RenderedCard | null>(null);

  useEffect(() => {
    if (deckId === 'demo') {
      setCards([demoCard]);
      setLoading(false);
      return;
    }

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
  const currentContent = renderedContent ?? (current ? renderDefaultCard(current.fields as Record<string, unknown>) : null);
  useEffect(() => { let cancelled = false; async function loadTemplate() { if (!current || deckId === 'demo') { setRenderedContent(null); return; } const supabase = createClient(); const { data: card } = await supabase.from('cards').select('template_id').eq('id', current.card_id).maybeSingle(); if (!card?.template_id) { setRenderedContent(null); return; } const { data: template } = await supabase.from('card_templates').select('field_definitions,card_generation').eq('id', card.template_id).maybeSingle(); const normalized = normalizeTemplate(template); const rendered = normalized ? renderCard(normalized, current.fields as Record<string, unknown>)[0] : null; if (!cancelled) setRenderedContent(rendered ?? null); } void loadTemplate(); return () => { cancelled = true; }; }, [current, deckId]);
  const progress = cards.length === 0 ? 0 : Math.min((done / cards.length) * 100, 100);
  const completed = !loading && !error && done >= cards.length && cards.length > 0;

  async function rate(rating: Rating) {
    if (!current || pending) return;
    setError('');
    setStatus('');
    setPending(true);
    try {
      const result = await submitReview(current.card_id, rating);
      setDone((value) => value + 1);
      setRevealed(false);
      setStatus(result.queued ? 'Avaliação salva localmente e aguardando sincronização.' : 'Avaliação salva.');
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
      const isNativeControl = target?.tagName === 'BUTTON' || target?.tagName === 'A';
      if (isTyping || isNativeControl || !current || pending) return;
      if (event.code === 'Space' && !revealed) {
        event.preventDefault();
        setRevealed(true);
        return;
      }
      if (revealed && (event.code === 'Space' || event.code === 'Enter')) {
        event.preventDefault();
        void rate('good');
        return;
      }
      if (revealed && ['1', '2', '3', '4'].includes(event.key)) {
        event.preventDefault();
        void rate(ratings[Number(event.key) - 1].key);
      }
    };
    window.addEventListener('keydown', keyHandler);
    return () => window.removeEventListener('keydown', keyHandler);
  }, [current, pending, revealed]);

  return <AppShell>
    <div className={`study-page ${focusMode ? 'focus-mode' : ''}`}>
      <Topbar title="Sessão de estudo" subtitle={deckId === 'demo' ? 'Prévia interativa do fluxo de revisão.' : 'Uma pergunta por vez para lembrar antes de conferir.'} />
      <div className="study-toolbar">
        <Link className="back-link" href="/decks">← Meus decks</Link>
        <button className="focus-toggle" type="button" onClick={() => setFocusMode((value) => !value)} aria-pressed={focusMode}>{focusMode ? 'Modo claro' : 'Modo foco'}<span aria-hidden="true">◐</span></button>
      </div>
      {error && <div className="notice error" role="alert">{error}{' '}<Link href="/decks" className="inline-link">Voltar aos decks</Link></div>}
      {loading && <div className="card" role="status" aria-live="polite" aria-busy="true">Preparando sua próxima revisão…</div>}
      {!loading && !error && cards.length === 0 && <div className="card empty-state"><strong>Nenhum cartão para revisar agora.</strong><span>Volte mais tarde ou adicione cards a este deck para começar uma nova sessão.</span><br /><Link className="btn secondary" href={`/decks/${deckId}/cards`}>Gerenciar cards</Link></div>}
      {!loading && !error && current && currentContent && <section className="study-shell" aria-labelledby="study-card-title">
        <div className="study-progress-head"><div><span className="eyebrow">Sessão em andamento</span><span className="study-count">{done + 1} <span>de {cards.length}</span></span></div><span className="study-progress-copy">{Math.round(progress)}% concluído</span></div>
        <div className="study-progress-track" role="progressbar" aria-label="Progresso da sessão" aria-valuemin={0} aria-valuemax={cards.length} aria-valuenow={done}><span style={{ width: `${progress}%` }} /></div>
        <article className="card study-card study-card-refined" aria-live="polite">
          <div className="study-card-top"><span className="study-type">Pergunta</span><span className="pill">{current.state === 'new' ? 'Novo' : current.state}</span></div>
          <div className="study-prompt"><h2 id="study-card-title">{currentContent.front}</h2></div>
          {revealed ? <div className="study-answer"><div className="study-answer-label">Resposta</div><p>{currentContent.back}</p></div> : <button className="btn reveal-button" type="button" onClick={() => setRevealed(true)} aria-keyshortcuts="Space"><span>Revelar resposta</span><kbd>Espaço</kbd></button>}
        </article>
        {revealed && <div className="study-actions" aria-labelledby="rating-title"><div className="study-actions-head"><div><h2 id="rating-title">Como foi sua lembrança?</h2><p>Escolha com honestidade para o próximo intervalo ser preciso.</p></div><span className="keyboard-hint">1–4 ou Espaço = avaliar</span></div><div className="ratings">{ratings.map((rating, index) => <button className={`rating rating-refined ${rating.tone}`} type="button" disabled={pending} key={rating.key} onClick={() => void rate(rating.key)} aria-keyshortcuts={String(index + 1)} aria-label={`${rating.label}, próxima revisão ${rating.hint}`}><span className="rating-key" aria-hidden="true">{index + 1}</span><span className="rating-label">{rating.label}</span><small>{rating.hint}</small></button>)}</div></div>}
        {pending && <p className="status-text study-status" role="status" aria-live="polite">Salvando sua avaliação…</p>}
        {status && !pending && <p className="status-text study-status" role="status" aria-live="polite">{status}</p>}
      </section>}
      {completed && <div className="notice success study-complete" role="status">Sessão concluída. Você revisou {cards.length} {cards.length === 1 ? 'cartão' : 'cartões'}. <Link href="/" className="inline-link">Voltar ao início</Link></div>}
    </div>
  </AppShell>;
}
