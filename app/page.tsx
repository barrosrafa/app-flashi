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

  useEffect(() => {
    getDashboardData().then(setData).catch((reason: unknown) => {
      setError(reason instanceof Error && reason.message === 'AUTH_REQUIRED'
        ? 'Entre na sua conta para carregar seus indicadores.'
        : 'Não foi possível carregar o dashboard.');
    });
  }, []);

  const dueCount = data?.dueCards.length ?? 0;
  const studyHref = data?.nextDeck ? `/study/${data.nextDeck.id}` : '/decks';
  const greeting = data?.nextDeck ? `Bom dia, ${data.nextDeck.name}` : 'Seu espaço de estudo';

  return (
    <AppShell>
      <Topbar title={greeting} subtitle="Indicadores calculados a partir da sua conta e do Supabase." />
      {error && <div className="notice" role="status">{error}</div>}
      <div className="grid stats">
        <div className="card"><div className="stat-label">Cartões para hoje</div><div className="stat-value accent">{data ? dueCount : '—'}</div><div className="stat-label">{data ? `${data.dueNewCount} novos · ${data.dueReviewCount} revisão` : 'Carregando fila'}</div></div>
        <div className="card"><div className="stat-label">Sequência atual</div><div className="stat-value">{data ? `${data.currentStreak} dias` : '—'}</div><div className="stat-label">Melhor: {data ? `${data.bestStreak} dias` : '—'}</div></div>
        <div className="card"><div className="stat-label">Tempo estudado</div><div className="stat-value">{data ? formatMinutes(data.weeklyTimeMs) : '—'}</div><div className="stat-label">Últimos 7 dias</div></div>
        <div className="card"><div className="stat-label">XP total</div><div className="stat-value">{data ? data.xpTotal.toLocaleString('pt-BR') : '—'}</div><div className="progress"><span style={{ width: `${Math.min((data?.xpTotal ?? 0) % 1000 / 10, 100)}%` }} /></div></div>
      </div>
      <div className="section-head"><h2>Continue estudando</h2><SyncBadge /></div>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
        <div><div className="eyebrow">Próxima sessão</div><h2 style={{ margin: '8px 0 4px', fontFamily: 'Space Grotesk' }}>{data?.nextDeck?.name ?? 'Escolha um deck'}</h2><p className="subtitle">{data ? `${dueCount} cartões na fila · dados reais` : 'Carregando fila de estudo…'}</p></div>
        <Link className="btn" href={studyHref}>Começar sessão →</Link>
      </div>
      <div className="section-head"><h2>Seus decks</h2><Link className="btn secondary" href="/decks">Ver todos</Link></div>
      <div className="grid deck-grid">
        {(data?.decks ?? []).map((deck) => <Link className="card deck-card" href={`/decks/${deck.id}`} key={deck.id}><div><div className="deck-top"><div className="deck-icon">✦</div><span className="pill">{deck.visibility}</span></div><h3>{deck.name}</h3><div className="deck-count">{deck.cardCount} cartões</div></div><div><div className="progress"><span style={{ width: `${deck.progress}%` }} /></div><div className="stat-label" style={{ marginTop: 8 }}>{deck.progress}% revisado · {deck.newCount} novos</div></div></Link>)}
      </div>
      {data && data.decks.length === 0 && <div className="card empty-state">Nenhum deck remoto foi criado ainda. Comece criando um deck.</div>}
      {data && <div className="card" style={{ marginTop: 18 }}><div className="stat-label">Desempenho nos últimos 7 dias</div><div className="stat-value">{data.weeklyAccuracy}% de precisão</div><div className="stat-label">{data.weeklyCards} cartões estudados</div></div>}
    </AppShell>
  );
}
