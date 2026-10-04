'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { AppShell, Topbar } from '../../../components/AppShell';
import { OcclusionCard } from '../../../components/OcclusionCard';
import { getDueCards, submitReview, type DueCard } from '../../../lib/services/study-service';
import { flushOutboxQueue, enqueueMutation } from '../../../lib/db/outbox-queue';
import type { Json } from '../../../src/types/database';
import type { Rating } from '../../../lib/db/schema';
import { createClient } from '../../../lib/supabase/client';
import { hasBrowserSession, isUuid } from '../../../lib/supabase/guards';
import { gamificationService, type SessionXpResult } from '../../../lib/services/gamification-service';
import { mediaService } from '../../../lib/services/media-service';
import { occlusionService, type OcclusionMask } from '../../../lib/services/occlusion-service';
import { normalizeTemplate, renderCard, renderDefaultCard, type RenderedCard } from '../../../lib/services/template-renderer';

const ratings: Array<{ key: Rating; label: string; tone: string }> = [
  { key: 'again', label: 'De novo', tone: 'again' },
  { key: 'hard', label: 'Difícil', tone: 'hard' },
  { key: 'good', label: 'Bom', tone: 'good' },
  { key: 'easy', label: 'Fácil', tone: 'easy' },
];
const demoCards: DueCard[] = [
  { card_id: 'demo-card-001', deck_id: 'demo', fields: { front: 'O que é repetição espaçada?', back: 'Um método que organiza as revisões ao longo do tempo para ajudar você a recuperar o conteúdo da memória.' } as Json, state: 'new', due_at: new Date().toISOString(), interval_days: 0 },
  { card_id: 'demo-card-002', deck_id: 'demo', fields: { front: 'Por que tentar lembrar antes de ver a resposta?', back: 'A recuperação ativa exige que você busque a informação, tornando o estudo mais participativo do que apenas reler.' } as Json, state: 'new', due_at: new Date().toISOString(), interval_days: 0 },
  { card_id: 'demo-card-003', deck_id: 'demo', fields: { front: 'O que acontece quando você avalia uma resposta?', back: 'Na sessão real, sua avaliação ajuda o agendador do deck a escolher quando este cartão deve voltar.' } as Json, state: 'new', due_at: new Date().toISOString(), interval_days: 0 },
];

export default function Study({ params }: { params: Promise<{ deckId: string }> }) {
  const { deckId } = use(params);
  const [cards, setCards] = useState<DueCard[]>([]);
  const [done, setDone] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [focusMode, setFocusMode] = useState(true);
  const [examQueue, setExamQueue] = useState(true);
  const [sessionId, setSessionId] = useState('');
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [renderedContent, setRenderedContent] = useState<RenderedCard | null>(null);
  const [occlusion, setOcclusion] = useState<{ imageUrl: string; masks: OcclusionMask[] } | null>(null);
  const [xpResult, setXpResult] = useState<SessionXpResult | null>(null);
  const [settlementStatus, setSettlementStatus] = useState('');
  const [settled, setSettled] = useState(false);

  useEffect(() => { setSessionId((current) => current || (deckId === 'demo' ? 'demo-session' : crypto.randomUUID())); }, [deckId]);
  useEffect(() => {
    let cancelled = false;
    async function loadQueue() {
      setLoading(true); setError(''); setDone(0); setSettled(false); setXpResult(null);
      if (deckId === 'demo') {
        if (!cancelled) { setCards(demoCards); setLoading(false); }
        return;
      }
      if (!isUuid(deckId)) {
        if (!cancelled) { setCards([]); setError('Este deck não possui um identificador válido. Volte para Meus decks e abra um deck existente.'); setLoading(false); }
        return;
      }
      if (!(await hasBrowserSession())) {
        if (!cancelled) { setCards([]); setError('Entre na sua conta para carregar sua fila de estudo.'); setLoading(false); }
        return;
      }
      try {
        const nextCards = await getDueCards(deckId, 40, examQueue);
        if (!cancelled) setCards(nextCards);
      } catch (reason: unknown) {
        if (!cancelled) setError(reason instanceof Error && reason.message === 'AUTH_REQUIRED' ? 'Entre na sua conta para carregar sua fila de estudo.' : 'Não foi possível carregar a fila de estudo. Tente novamente.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadQueue();
    return () => { cancelled = true; };
  }, [deckId, examQueue]);

  const current = cards[done];
  const currentContent = renderedContent ?? (current ? renderDefaultCard(current.fields as Record<string, unknown>) : null);
  useEffect(() => {
    let cancelled = false;
    async function loadCardData() {
      setRenderedContent(null); setOcclusion(null);
      if (!current || deckId === 'demo') return;
      const supabase = createClient();
      const { data: card } = await supabase.from('cards').select('template_id,note_id,card_kind').eq('id', current.card_id).maybeSingle();
      if (card?.template_id) {
        const { data: template } = await supabase.from('card_templates').select('field_definitions,card_generation').eq('id', card.template_id).maybeSingle();
        const normalized = normalizeTemplate(template);
        const rendered = normalized ? renderCard(normalized, current.fields as Record<string, unknown>)[0] : null;
        if (!cancelled) setRenderedContent(rendered ?? null);
      }
      if (card?.note_id && card.card_kind === 'image_occlusion') {
        try {
          const [masks, media] = await Promise.all([occlusionService.listMasks(card.note_id), mediaService.listForCard(current.card_id)]);
          const image = media.find((item) => item.media_type === 'image');
          const imageUrl = image ? await mediaService.signedUrl(image.storage_path) : undefined;
          if (!cancelled && imageUrl && masks.length) setOcclusion({ imageUrl, masks });
        } catch { if (!cancelled) setStatus('Não foi possível carregar a imagem ocluída; a pergunta continua disponível.'); }
      }
    }
    void loadCardData(); return () => { cancelled = true; };
  }, [current, deckId]);

  const progress = cards.length === 0 ? 0 : Math.min((done / cards.length) * 100, 100);
  const completed = !loading && !error && done >= cards.length && cards.length > 0;

  useEffect(() => {
    if (!completed || deckId === 'demo' || !sessionId || settled) return;
    setSettled(true); setSettlementStatus('Sincronizando XP da sessão…');
    void (async () => {
      try {
        await flushOutboxQueue();
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          await enqueueMutation('gamification_xp_sessions', 'rpc', { p_session_id: sessionId }, { rpc_name: 'sync_session_xp', transport: 'rpc' });
          setSettlementStatus('Sessão salva offline; o XP será calculado quando a conexão voltar.');
          return;
        }
        const result = await gamificationService.syncSessionXp(sessionId);
        setXpResult(result); setSettlementStatus('XP da sessão sincronizado com segurança.');
      } catch { setSettlementStatus('Avaliações salvas localmente; o XP será sincronizado na próxima conexão.'); await enqueueMutation('gamification_xp_sessions', 'rpc', { p_session_id: sessionId }, { rpc_name: 'sync_session_xp', transport: 'rpc' }); }
    })();
  }, [completed, deckId, sessionId, settled]);

  async function rate(rating: Rating) {
    if (!current || pending) return;
    setError(''); setStatus(''); setPending(true);
    try {
      if (deckId === 'demo') { setDone((value) => value + 1); setRevealed(false); setStatus('Prévia concluída; nenhuma avaliação foi enviada ao backend.'); return; }
      const result = await submitReview(current.card_id, rating, sessionId);
      setDone((value) => value + 1); setRevealed(false); setStatus(result.queued ? 'Avaliação salva localmente e aguardando sincronização.' : 'Avaliação salva.');
    } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'Não foi possível salvar esta avaliação. Tente novamente.'); } finally { setPending(false); }
  }

  useEffect(() => {
    const keyHandler = (event: KeyboardEvent) => { const target = event.target as HTMLElement | null; const isTyping = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable; const isControl = target?.tagName === 'BUTTON' || target?.tagName === 'A'; if (isTyping || isControl || !current || pending) return; if (event.code === 'Space' && !revealed) { event.preventDefault(); setRevealed(true); return; } if (revealed && ['1','2','3','4'].includes(event.key)) { event.preventDefault(); void rate(ratings[Number(event.key) - 1].key); } };
    window.addEventListener('keydown', keyHandler); return () => window.removeEventListener('keydown', keyHandler);
  }, [current, pending, revealed, sessionId]);

  return <AppShell><div className={`study-page ${focusMode ? 'focus-mode' : ''}`}><Topbar title="Sessão de estudo" subtitle={deckId === 'demo' ? 'Prévia interativa do fluxo de revisão.' : 'Uma pergunta por vez, com fila de revisão personalizada.'} /><div className="study-toolbar"><Link className="back-link" href="/decks">← Meus decks</Link><div className="section-head-actions"><button className="focus-toggle" type="button" onClick={() => setExamQueue((value) => !value)} aria-pressed={examQueue}>{examQueue ? 'Fila de exames' : 'Fila padrão'}</button><button className="focus-toggle" type="button" onClick={() => setFocusMode((value) => !value)} aria-pressed={focusMode}>{focusMode ? 'Modo claro' : 'Modo foco'}<span aria-hidden="true">◐</span></button></div></div>{error && <div className="notice error" role="alert">{error}{' '}<Link href="/decks" className="inline-link">Voltar aos decks</Link></div>}{loading && <div className="card" role="status" aria-live="polite" aria-busy="true">Preparando sua próxima revisão…</div>}{!loading && !error && cards.length === 0 && <div className="card empty-state"><strong>Nenhum cartão para revisar agora.</strong><span>Volte mais tarde ou adicione cards a este deck para começar uma nova sessão.</span><br /><Link className="btn secondary" href={`/decks/${deckId}/cards`}>Gerenciar cards</Link></div>}{!loading && !error && current && currentContent && <section className="study-shell" aria-labelledby="study-card-title"><div className="study-progress-head"><div><span className="eyebrow">Sessão em andamento</span><span className="study-count">{done + 1} <span>de {cards.length}</span></span></div><span className="study-progress-copy">{Math.round(progress)}% concluído</span></div><div className="study-progress-track" role="progressbar" aria-label="Progresso da sessão" aria-valuemin={0} aria-valuemax={cards.length} aria-valuenow={done}><span style={{ width: `${progress}%` }} /></div>{current.exam_name && <div className="notice" role="status">Prioridade: <strong>{current.exam_name}</strong>{current.days_remaining !== null && current.days_remaining !== undefined ? ` · ${current.days_remaining} dia(s) restantes` : ''}</div>}<p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{revealed ? 'Resposta revelada.' : ''}</p><article className="card study-card study-card-refined"><div className="study-card-top"><span className="study-type">{occlusion ? 'Imagem ocluída' : 'Pergunta'}</span><span className="pill">{current.state === 'new' ? 'Novo' : current.state}</span></div><div className="study-prompt"><h2 id="study-card-title">{currentContent.front}</h2></div>{occlusion && <OcclusionCard imageUrl={occlusion.imageUrl} masks={occlusion.masks} revealAll={revealed} onRevealAll={() => setRevealed(true)} />}{revealed ? <div className="study-answer"><div className="study-answer-label">Resposta</div><p>{currentContent.back}</p></div> : <button className="btn reveal-button" type="button" onClick={() => setRevealed(true)} aria-keyshortcuts="Space"><span>{occlusion ? 'Revelar todas as áreas' : 'Revelar resposta'}</span><kbd>Espaço</kbd></button>}</article>{revealed && <div className="study-actions" aria-labelledby="rating-title"><div className="study-actions-head"><div><h2 id="rating-title">Como foi sua lembrança?</h2><p>Escolha com honestidade para o próximo intervalo ser preciso.</p></div><span className="keyboard-hint">1–4 avaliam · Espaço revela</span></div><div className="ratings">{ratings.map((rating, index) => <button className={`rating rating-refined ${rating.tone}`} type="button" disabled={pending} key={rating.key} onClick={() => void rate(rating.key)} aria-keyshortcuts={String(index + 1)} aria-label={rating.label}><span className="rating-key" aria-hidden="true">{index + 1}</span><span className="rating-label">{rating.label}</span></button>)}<p className="status-text rating-explanation">Esta prévia não estima intervalos. Em sessões reais, o agendador do deck define a próxima revisão.</p></div></div>}{pending && <p className="status-text study-status" role="status">Salvando sua avaliação…</p>}{status && !pending && <p className="status-text study-status" role="status">{status}</p>}</section>}{completed && <div className="notice success study-complete" role="status"><strong>Sessão concluída.</strong> Você revisou {cards.length} {cards.length === 1 ? 'cartão' : 'cartões'}.{xpResult && <span> +{xpResult.xp_awarded} XP nesta sessão · {xpResult.xp_total} XP total · nível {xpResult.level_current}.</span>} {settlementStatus && <span>{settlementStatus}</span>} <Link href="/dashboard" className="inline-link">Voltar ao painel</Link></div>}</div></AppShell>;
}
