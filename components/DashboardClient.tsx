'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell, Topbar } from './AppShell';
import { getDashboardData, type DashboardData } from '../lib/services/dashboard-service';

function formatMinutes(milliseconds: number) {
  const minutes = Math.round(milliseconds / 60000);
  return minutes === 0 ? '0 min' : `${minutes} min`;
}

export default function DashboardClient() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const [authRequired, setAuthRequired] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboardData()
      .then(setData)
      .catch((reason: unknown) => {
        const requiresAuth = reason instanceof Error && reason.message === 'AUTH_REQUIRED';
        setAuthRequired(requiresAuth);
        setError(requiresAuth
          ? 'Entre na sua conta para carregar seus indicadores.'
          : 'Não foi possível carregar o dashboard. Tente novamente em instantes.');
      })
      .finally(() => setLoading(false));
  }, []);

  const dueCount = data?.dueCards.length ?? 0;
  const studyHref = authRequired ? '/login' : data?.nextDeck ? `/study/${data.nextDeck.id}` : '/decks';
  const sessionLabel = authRequired ? 'Entrar para estudar' : data?.nextDeck ? 'Começar agora' : 'Ver meus decks';
  const queueStatus = data
    ? `${data.dueNewCount} novos · ${data.dueReviewCount} em revisão`
    : loading
      ? 'Carregando fila…'
      : authRequired
        ? 'Entre para acessar sua fila.'
        : 'Não foi possível carregar agora.';

  return <AppShell>
    <Topbar title="Pronto para estudar?" subtitle="Veja sua próxima ação e avance um card por vez." />
    {error && <div className="notice error" role="alert"><strong>{error}</strong>{' '}{authRequired && <Link href="/login" className="inline-link">Entrar agora</Link>}</div>}
    <section aria-labelledby="continue-title">
      <div className="section-head compact-head"><div><h2 id="continue-title">Sua próxima sessão</h2><p className="subtitle">Comece pelas revisões que já estão prontas.</p></div></div>
      <div className="card next-session next-session-primary">
        <div>
          <div className="eyebrow">Hoje</div>
          <h2>{data?.nextDeck?.name ?? (authRequired ? 'Entre para ver sua fila' : data && dueCount === 0 ? 'Tudo em dia' : 'Continue no seu ritmo')}</h2>
          <p className="subtitle">{data && dueCount > 0 ? `${dueCount} ${dueCount === 1 ? 'card disponível' : 'cards disponíveis'} para revisar` : data ? 'Sua fila está em dia. Explore os decks ou crie novos cards.' : authRequired ? 'Entre para acessar seus decks e sua fila de revisão.' : loading ? 'Preparando sua próxima sessão.' : 'Abra seus decks e escolha por onde quer começar.'}</p>
        </div>
        <Link className="btn" href={studyHref}>{sessionLabel}<span aria-hidden="true">→</span></Link>
      </div>
    </section>
    <section aria-labelledby="today-title">
      <div className="section-head"><div><h2 id="today-title">Seu ritmo hoje</h2><p className="subtitle">Um resumo do progresso recente.</p></div></div>
      <div className="grid stats">
        <article className="card"><div className="stat-label">Cartões para hoje</div><div className="stat-value accent">{data ? dueCount : '—'}</div><div className="stat-label">{queueStatus}</div></article>
        <article className="card"><div className="stat-label">Sequência atual</div><div className="stat-value">{data ? `${data.currentStreak} dias` : '—'}</div><div className="stat-label">Melhor: {data ? `${data.bestStreak} dias` : '—'}</div></article>
        <article className="card"><div className="stat-label">Tempo estudado</div><div className="stat-value">{data ? formatMinutes(data.weeklyTimeMs) : '—'}</div><div className="stat-label">Últimos 7 dias</div></article>
        <article className="card"><div className="stat-label">XP total</div><div className="stat-value">{data ? data.xpTotal.toLocaleString('pt-BR') : '—'}</div><div className="progress" role="progressbar" aria-label="Progresso para o próximo marco de XP" aria-valuemin={0} aria-valuemax={1000} aria-valuenow={data ? data.xpTotal % 1000 : 0}><span style={{ width: `${Math.min((data?.xpTotal ?? 0) % 1000 / 10, 100)}%` }} /></div></article>
      </div>
    </section>
    <section aria-labelledby="decks-title">
      <div className="section-head"><div><h2 id="decks-title">Seus decks</h2><p className="subtitle">Retome um assunto ou crie uma nova frente de estudo.</p></div><Link className="btn secondary" href="/decks">Ver todos</Link></div>
      <div className="grid deck-grid">
        {(data?.decks ?? []).map((deck) => <Link className="card deck-card" href={`/decks/${deck.id}`} key={deck.id}><div><div className="deck-top"><div className="deck-icon" aria-hidden="true">✦</div><span className="pill">{deck.visibility}</span></div><h3>{deck.name}</h3><div className="deck-count">{deck.cardCount} cartões</div></div><div><div className="progress" role="progressbar" aria-label={`Cartões em etapa de revisão em ${deck.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={deck.progress}><span style={{ width: `${deck.progress}%` }} /></div><div className="stat-label" style={{ marginTop: 8 }}>{deck.progress}% dos cards em etapa de revisão · {deck.newCount} novos</div></div></Link>)}
      </div>
      {data && data.decks.length === 0 && <div className="card empty-state"><strong>Seu primeiro deck começa aqui.</strong><span>Crie uma coleção para transformar suas notas em sessões de revisão.</span><Link className="btn" href="/decks/new">Criar meu primeiro deck</Link></div>}
    </section>
    {data && <section className="card performance-card" aria-labelledby="performance-title"><div className="stat-label" id="performance-title">Desempenho nos últimos 7 dias</div><div className="stat-value">{data.weeklyAccuracy}% de precisão</div><div className="stat-label">{data.weeklyCards} cartões estudados</div><Link className="inline-link" href="/analytics">Ver desempenho completo</Link></section>}
  </AppShell>;
}
