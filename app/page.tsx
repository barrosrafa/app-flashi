'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell, SyncBadge, Topbar } from '../components/AppShell';
import { getDashboardData, type DashboardData } from '../lib/services/dashboard-service';

function formatMinutes(milliseconds: number) {
  const minutes = Math.round(milliseconds / 60000);
  return minutes === 0 ? '0 min' : `${minutes} min`;
}

export default function Home() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const [authRequired, setAuthRequired] = useState(false);

  useEffect(() => {
    getDashboardData()
      .then(setData)
      .catch((reason: unknown) => {
        const requiresAuth = reason instanceof Error && reason.message === 'AUTH_REQUIRED';
        setAuthRequired(requiresAuth);
        setError(requiresAuth ? 'Entre na sua conta para carregar seus indicadores.' : 'Não foi possível carregar o dashboard. Tente novamente em instantes.');
      });
  }, []);

  const dueCount = data?.dueCards.length ?? 0;
  const studyHref = data?.nextDeck ? `/study/${data.nextDeck.id}` : '/decks';
  const greeting = data?.nextDeck ? `Bom dia, ${data.nextDeck.name}` : 'Seu espaço de estudo';
  const sessionLabel = authRequired ? 'Entrar para estudar' : data?.nextDeck ? 'Começar sessão' : 'Escolher um deck';
  const sessionHref = authRequired ? '/login' : studyHref;

  return (
    <AppShell>
      <Topbar title={greeting} subtitle="Uma visão rápida do que merece sua atenção hoje." />
      {error && (
        <div className="notice error" role="alert">
          <strong>{error}</strong>{' '}
          {authRequired && <Link href="/login" className="inline-link">Entrar agora</Link>}
        </div>
      )}

      <section aria-labelledby="today-title">
        <div className="section-head compact-head">
          <div><h2 id="today-title">Seu ritmo hoje</h2><p className="subtitle">Acompanhe o que está pronto para a próxima sessão.</p></div>
          {data && <SyncBadge />}
        </div>
        <div className="grid stats">
          <article className="card"><div className="stat-label">Cartões para hoje</div><div className="stat-value accent">{data ? dueCount : '—'}</div><div className="stat-label">{data ? `${data.dueNewCount} novos · ${data.dueReviewCount} em revisão` : 'Carregando fila…'}</div></article>
          <article className="card"><div className="stat-label">Sequência atual</div><div className="stat-value">{data ? `${data.currentStreak} dias` : '—'}</div><div className="stat-label">Melhor: {data ? `${data.bestStreak} dias` : '—'}</div></article>
          <article className="card"><div className="stat-label">Tempo estudado</div><div className="stat-value">{data ? formatMinutes(data.weeklyTimeMs) : '—'}</div><div className="stat-label">Últimos 7 dias</div></article>
          <article className="card"><div className="stat-label">XP total</div><div className="stat-value">{data ? data.xpTotal.toLocaleString('pt-BR') : '—'}</div><div className="progress" role="progressbar" aria-label="Progresso para o próximo marco de XP" aria-valuemin={0} aria-valuemax={1000} aria-valuenow={data ? data.xpTotal % 1000 : 0}><span style={{ width: `${Math.min((data?.xpTotal ?? 0) % 1000 / 10, 100)}%` }} /></div></article>
        </div>
      </section>

      <section aria-labelledby="continue-title">
        <div className="section-head"><h2 id="continue-title">Continue estudando</h2></div>
        <div className="card next-session">
          <div><div className="eyebrow">Próxima sessão</div><h2>{data?.nextDeck?.name ?? 'Escolha um deck para começar'}</h2><p className="subtitle">{data ? `${dueCount} cartões na fila · sua próxima revisão já está pronta.` : authRequired ? 'Entre para acessar seus decks sincronizados.' : 'Carregando fila de estudo…'}</p></div>
          <Link className="btn" href={sessionHref}>{sessionLabel}<span aria-hidden="true">→</span></Link>
        </div>
      </section>

      <section aria-labelledby="decks-title">
        <div className="section-head"><div><h2 id="decks-title">Seus decks</h2><p className="subtitle">Retome um assunto ou crie uma nova frente de estudo.</p></div><Link className="btn secondary" href="/decks">Ver todos</Link></div>
        <div className="grid deck-grid">
          {(data?.decks ?? []).map((deck) => <Link className="card deck-card" href={`/decks/${deck.id}`} key={deck.id}><div><div className="deck-top"><div className="deck-icon" aria-hidden="true">✦</div><span className="pill">{deck.visibility}</span></div><h3>{deck.name}</h3><div className="deck-count">{deck.cardCount} cartões</div></div><div><div className="progress" role="progressbar" aria-label={`Progresso de ${deck.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={deck.progress}><span style={{ width: `${deck.progress}%` }} /></div><div className="stat-label" style={{ marginTop: 8 }}>{deck.progress}% revisado · {deck.newCount} novos</div></div></Link>)}
        </div>
        {data && data.decks.length === 0 && <div className="card empty-state"><strong>Seu primeiro deck começa aqui.</strong><span>Crie uma coleção para transformar suas notas em sessões de revisão.</span><br /><Link className="btn" href="/decks/new">Criar meu primeiro deck</Link></div>}
      </section>

      {data && <section className="card performance-card" aria-labelledby="performance-title"><div className="stat-label" id="performance-title">Desempenho nos últimos 7 dias</div><div className="stat-value">{data.weeklyAccuracy}% de precisão</div><div className="stat-label">{data.weeklyCards} cartões estudados</div></section>}
    </AppShell>
  );
}
