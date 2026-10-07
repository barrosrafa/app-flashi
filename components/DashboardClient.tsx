'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell, Topbar } from './AppShell';
import {
  estimateDashboardMinutes,
  getDashboardDecksData,
  getDashboardLearningPlanData,
  getDashboardQueueData,
  getDashboardStatsData,
  loadDashboardSection,
  selectNextDashboardDeck,
  type DashboardLearningPlanData,
  type DashboardQueueData,
  type DashboardSectionError,
  type DashboardSectionState,
  type DashboardStatsData,
} from '../lib/services/dashboard-service';
import { useTranslation, type TranslationKey } from '../contexts/LanguageContext';
import type { LearningGoal } from '../lib/services/onboarding-service';

const goalLabels: Record<LearningGoal, TranslationKey> = {
  exam: 'onboarding.goals.exam',
  competition: 'onboarding.goals.competition',
  language: 'onboarding.goals.language',
  university: 'onboarding.goals.university',
  other: 'onboarding.goals.other',
};

function formatMinutes(milliseconds: number) {
  const minutes = Math.round(milliseconds / 60000);
  return minutes === 0 ? '0 min' : `${minutes} min`;
}

function sectionErrorMessage(section: string, error: DashboardSectionError) {
  if (error.kind === 'setup') return `Configure a conexão do Supabase para carregar ${section}.`;
  if (error.kind === 'auth') return `Entre na sua conta para carregar ${section}.`;
  return `Não foi possível carregar ${section}. Tente novamente em instantes.`;
}

function SectionError({ section, error }: { section: string; error: DashboardSectionError }) {
  return <div className="notice error" role="alert"><strong>{sectionErrorMessage(section, error)}</strong>{error.kind === 'auth' && <> <Link href="/login" className="inline-link">Entrar agora</Link></>}</div>;
}

function SectionLoading({ label }: { label: string }) {
  return <div className="card" role="status" aria-live="polite">Carregando {label}…</div>;
}

export default function DashboardClient() {
  const { t, locale } = useTranslation();
  const [queue, setQueue] = useState<DashboardSectionState<DashboardQueueData>>({ status: 'loading' });
  const [decks, setDecks] = useState<DashboardSectionState<Awaited<ReturnType<typeof getDashboardDecksData>>>>({ status: 'loading' });
  const [stats, setStats] = useState<DashboardSectionState<DashboardStatsData>>({ status: 'loading' });
  const [learningPlan, setLearningPlan] = useState<DashboardSectionState<DashboardLearningPlanData>>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    void loadDashboardSection(getDashboardQueueData).then((result) => { if (!cancelled) setQueue(result); });
    void loadDashboardSection(getDashboardDecksData).then((result) => { if (!cancelled) setDecks(result); });
    void loadDashboardSection(getDashboardStatsData).then((result) => { if (!cancelled) setStats(result); });
    void loadDashboardSection(getDashboardLearningPlanData).then((result) => { if (!cancelled) setLearningPlan(result); });
    return () => { cancelled = true; };
  }, []);

  const queueData = queue.status === 'success' ? queue.data : null;
  const deckData = decks.status === 'success' ? decks.data : [];
  const statsData = stats.status === 'success' ? stats.data : null;
  const planData = learningPlan.status === 'success' ? learningPlan.data : null;
  const dueCount = queueData?.dueCards.length ?? 0;
  const nextDeck = queueData && deckData ? selectNextDashboardDeck(deckData, queueData.dueCards) : null;
  const estimatedMinutes = queueData && statsData ? estimateDashboardMinutes(statsData.weeklyCards, statsData.weeklyTimeMs, dueCount) : null;
  const studyHref = queue.status === 'error' && queue.error.kind === 'auth' ? '/login' : nextDeck ? `/study/${nextDeck.id}` : '/decks';
  const sessionLabel = queue.status === 'error' && queue.error.kind === 'auth' ? 'Entrar para estudar' : nextDeck ? 'Começar agora' : 'Ver meus decks';

  return <AppShell>
    <Topbar title="Pronto para estudar?" subtitle="Veja sua próxima ação e avance um card por vez." />

    <section aria-labelledby="continue-title">
      <div className="section-head compact-head"><div><h2 id="continue-title">Sua próxima sessão</h2><p className="subtitle">Comece pelas revisões que já estão prontas.</p></div></div>
      {queue.status === 'loading' && <SectionLoading label="sua fila" />}
      {queue.status === 'error' && <SectionError section="sua fila" error={queue.error} />}
      {queue.status === 'success' && <div className="card next-session next-session-primary">
        <div>
          <div className="eyebrow">Hoje</div>
          <h2>{nextDeck?.name ?? (dueCount === 0 ? 'Tudo em dia' : 'Continue no seu ritmo')}</h2>
          <p className="subtitle">{dueCount > 0 ? `${dueCount} ${dueCount === 1 ? 'card disponível' : 'cards disponíveis'} para revisar` : 'Sua fila está em dia. Explore os decks ou crie novos cards.'}</p>
        </div>
        <Link className="btn" href={studyHref}>{sessionLabel}<span aria-hidden="true">→</span></Link>
      </div>}
    </section>

    <section className="card learning-plan-summary" aria-labelledby="learning-plan-heading">
      <div className="learning-plan-summary-copy"><div className="eyebrow">{t('dashboard.learningPlanTitle')}</div>
        {learningPlan.status === 'loading' && <p id="learning-plan-heading" className="subtitle" role="status">Carregando seu plano…</p>}
        {learningPlan.status === 'error' && <div id="learning-plan-heading"><SectionError section="seu plano de aprendizagem" error={learningPlan.error} /></div>}
        {learningPlan.status === 'success' && (planData?.goal ? <><h2 id="learning-plan-heading">{t(goalLabels[planData.goal])}</h2><div className="learning-plan-details">{planData.targetDate && <span>{t('dashboard.learningPlanDate')}: {new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(`${planData.targetDate}T12:00:00`))}</span>}{planData.weeklyMinutes !== null && <span>{t('dashboard.learningPlanWeekly')}: {planData.weeklyMinutes} min</span>}</div></> : <p id="learning-plan-heading" className="subtitle">{t('dashboard.learningPlanEmpty')}</p>)}
      </div>
      {learningPlan.status === 'success' && <Link className="btn secondary" href={planData?.goal ? '/profile/learning-plan' : '/onboarding'}>{t(planData?.goal ? 'dashboard.learningPlanEdit' : 'dashboard.learningPlanSet')}</Link>}
    </section>

    {queue.status === 'success' && dueCount > 0 && <p className="dashboard-time-estimate">{estimatedMinutes !== null ? `${t('dashboard.estimatedTime')}: ${estimatedMinutes} min` : t('dashboard.estimateUnavailable')}</p>}

    <section aria-labelledby="today-title">
      <div className="section-head"><div><h2 id="today-title">Seu ritmo hoje</h2><p className="subtitle">Um resumo do progresso recente.</p></div></div>
      {stats.status === 'loading' && <SectionLoading label="suas métricas" />}
      {stats.status === 'error' && <SectionError section="suas métricas" error={stats.error} />}
      {stats.status === 'success' && <div className="grid stats">
        <article className="card"><div className="stat-label">Cartões para hoje</div><div className="stat-value accent">{queueData?.dueCards.length ?? '—'}</div><div className="stat-label">{queueData ? `${queueData.dueNewCount} novos · ${queueData.dueReviewCount} em revisão` : 'Fila indisponível'}</div></article>
        <article className="card"><div className="stat-label">Sequência atual</div><div className="stat-value">{statsData!.currentStreak} dias</div><div className="stat-label">Melhor: {statsData!.bestStreak} dias</div></article>
        <article className="card"><div className="stat-label">Tempo estudado</div><div className="stat-value">{formatMinutes(statsData!.weeklyTimeMs)}</div><div className="stat-label">Últimos 7 dias</div></article>
        <article className="card"><div className="stat-label">XP total</div><div className="stat-value">{statsData!.xpTotal.toLocaleString('pt-BR')}</div><div className="progress" role="progressbar" aria-label="Progresso para o próximo marco de XP" aria-valuemin={0} aria-valuemax={1000} aria-valuenow={statsData!.xpTotal % 1000}><span style={{ width: `${Math.min(statsData!.xpTotal % 1000 / 10, 100)}%` }} /></div></article>
      </div>}
    </section>

    <section aria-labelledby="decks-title">
      <div className="section-head"><div><h2 id="decks-title">Seus decks</h2><p className="subtitle">Retome um assunto ou crie uma nova frente de estudo.</p></div><Link className="btn secondary" href="/decks">Ver todos</Link></div>
      {decks.status === 'loading' && <SectionLoading label="seus decks" />}
      {decks.status === 'error' && <SectionError section="sua biblioteca" error={decks.error} />}
      {decks.status === 'success' && <>
        <div className="grid deck-grid">
          {deckData.map((deck) => <Link className="card deck-card" href={`/decks/${deck.id}`} key={deck.id}><div><div className="deck-top"><div className="deck-icon" aria-hidden="true">✦</div><span className="pill">{deck.visibility}</span></div><h3><span data-user-content="">{deck.name}</span></h3><div className="deck-count">{deck.cardCount} cartões</div></div><div><div className="progress" role="progressbar" aria-label={`Cartões em etapa de revisão em ${deck.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={deck.progress}><span style={{ width: `${deck.progress}%` }} /></div><div className="stat-label" style={{ marginTop: 8 }}>{deck.progress}% dos cards em etapa de revisão · {deck.newCount} novos</div></div></Link>)}
        </div>
        {deckData.length === 0 && <div className="card empty-state"><strong>Seu primeiro deck começa aqui.</strong><span>Crie uma coleção para transformar suas notas em sessões de revisão.</span><Link className="btn" href="/decks/new">Criar meu primeiro deck</Link></div>}
      </>}
    </section>

    {stats.status === 'success' && <section className="card performance-card" aria-labelledby="performance-title"><div className="stat-label" id="performance-title">Desempenho nos últimos 7 dias</div><div className="stat-value">{statsData!.weeklyAccuracy}% de precisão</div><div className="stat-label">{statsData!.weeklyCards} cartões estudados</div><Link className="inline-link" href="/analytics">Ver desempenho completo</Link></section>}
  </AppShell>;
}
