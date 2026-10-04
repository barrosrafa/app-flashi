'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell, Topbar } from '../../components/AppShell';
import { getAnalyticsData, getAnalyticsRange, type AnalyticsData } from '../../lib/services/analytics-service';
type RangeRow = { stat_date: string; cards_studied: number; time_studied_ms: number };
function formatDate(date: string) {
  const parsed = new Date(`${date.slice(0, 10)}T12:00:00`);
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).format(parsed);
}
function minutes(milliseconds: number) { return Math.round(milliseconds / 60000); }
export default function Analytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState('');
  const [range, setRange] = useState<7 | 30 | 90>(7);
  const [rangeRows, setRangeRows] = useState<RangeRow[]>([]);
  const [rangeLoading, setRangeLoading] = useState(true);
  const [rangeError, setRangeError] = useState('');
  useEffect(() => {
    getAnalyticsData().then(setData).catch((reason: unknown) => {
      setError(reason instanceof Error && reason.message === 'AUTH_REQUIRED'
        ? 'Entre na sua conta para ver o desempenho real.'
        : 'Não foi possível carregar as métricas. Tente novamente.');
    });
  }, []);
  useEffect(() => {
    let cancelled = false;
    setRangeLoading(true);
    setRangeError('');
    getAnalyticsRange(range).then((rows) => { if (!cancelled) setRangeRows(rows as RangeRow[]); })
      .catch(() => { if (!cancelled) { setRangeRows([]); setRangeError('Não foi possível carregar os dados deste período.'); } })
      .finally(() => { if (!cancelled) setRangeLoading(false); });
    return () => { cancelled = true; };
  }, [range]);
  const comparison = data && data.cardsPreviousWeek > 0
    ? Math.round(((data.cardsThisWeek - data.cardsPreviousWeek) / data.cardsPreviousWeek) * 100)
    : null;
  const accuracyDelta = data && data.accuracyPreviousWeek !== null ? data.accuracy - data.accuracyPreviousWeek : null;
  const studyDays = data?.days.filter((day) => day.cards > 0).length ?? 0;
  const weeklyInsight = !data ? '' : data.cardsPreviousWeek === 0
    ? data.cardsThisWeek > 0 ? 'Você começou a registrar uma nova sequência de estudos. Mantenha um ritmo confortável.' : 'Sua semana ainda não tem revisões registradas. Escolha um deck para começar.'
    : comparison !== null && comparison > 0 ? `Você revisou ${comparison}% mais cards do que na semana anterior. Continue no ritmo que funciona para você.`
    : comparison !== null && comparison < 0 ? `Você revisou ${Math.abs(comparison)}% menos cards do que na semana anterior. Uma sessão curta pode ajudar a retomar o ritmo.`
    : 'Você manteve o mesmo volume de revisões da semana anterior.';
  const activityRows = rangeRows.map((row) => ({ date: row.stat_date, cards: row.cards_studied, minutes: minutes(row.time_studied_ms) }));
  const maxCards = Math.max(...activityRows.map((row) => row.cards), 1);
  const totalCards = activityRows.reduce((sum, row) => sum + row.cards, 0);
  return <AppShell>
    <Topbar title="Desempenho" subtitle="Entenda seu ritmo e acompanhe as revisões registradas." />
    {error && <div className="notice error" role="alert">{error}</div>}
    <div className="grid stats">
      <div className="card"><div className="stat-label">Dias com estudo</div><div className="stat-value accent">{data ? studyDays : '—'}</div><div className="stat-label">nos últimos 7 dias</div></div>
      <div className="card"><div className="stat-label">Cartões esta semana</div><div className="stat-value">{data?.cardsThisWeek ?? '—'}</div><div className="stat-label">{comparison === null ? (data?.cardsPreviousWeek === 0 ? 'Primeira semana comparável' : 'Sem dados comparáveis') : `${comparison > 0 ? '+' : ''}${comparison}% vs. semana anterior`}</div></div>
      <div className="card"><div className="stat-label">Tempo médio</div><div className="stat-value">{data ? `${data.averageTimeSeconds}s` : '—'}</div><div className="stat-label">por revisão registrada</div></div>
      <div className="card"><div className="stat-label">Precisão</div><div className="stat-value">{data ? `${data.accuracy}%` : '—'}</div><div className="stat-label">{accuracyDelta === null ? 'Sem dados anteriores para comparar' : `${accuracyDelta > 0 ? '+' : ''}${accuracyDelta} p.p. vs. semana anterior`}</div></div>
    </div>
    {data && <section className="card analytics-insight" aria-labelledby="weekly-insight-heading"><h2 id="weekly-insight-heading">O que isso significa</h2><p>{weeklyInsight}</p>{accuracyDelta !== null && accuracyDelta !== 0 && <p>Sua precisão {accuracyDelta > 0 ? 'aumentou' : 'diminuiu'} {Math.abs(accuracyDelta)} pontos percentuais em relação à semana anterior.</p>}<Link className="inline-link" href="/study">Ir para uma sessão de estudo →</Link></section>}
    <div className="section-head"><h2 id="activity-heading">Atividade</h2><div className="field analytics-range"><label htmlFor="analytics-range">Período</label><select id="analytics-range" value={range} onChange={(event) => setRange(Number(event.target.value) as 7 | 30 | 90)}><option value="7">7 dias</option><option value="30">30 dias</option><option value="90">90 dias</option></select></div></div>
    {rangeError && <p className="notice error" role="alert">{rangeError}</p>}
    {rangeLoading ? <p className="card" role="status">Carregando atividade…</p> : activityRows.length === 0 ? <div className="card empty-state"><strong>Nenhuma revisão neste período.</strong><span>Quando você estudar, o histórico diário aparecerá aqui.</span></div> : <>
      <div className="card analytics-chart-scroll" aria-labelledby="activity-heading"><div className="analytics-chart" aria-hidden="true" style={{ minWidth: `${Math.max(520, activityRows.length * 30)}px` }}>{activityRows.map((day) => <div className="analytics-day" key={day.date}><div className={day.cards === maxCards ? 'analytics-bar peak' : 'analytics-bar'} style={{ height: `${Math.max((day.cards / maxCards) * 150, day.cards ? 8 : 2)}px` }} /><small className="stat-label">{formatDate(day.date)}</small></div>)}</div></div>
      <div className="card analytics-data-table"><div className="stat-label">{totalCards} cartões registrados no período selecionado</div><div className="table-wrap"><table className="table"><caption className="sr-only">Revisões diárias: {range} dias</caption><thead><tr><th scope="col">Dia</th><th scope="col">Cartões revisados</th><th scope="col">Tempo estudado</th></tr></thead><tbody>{activityRows.map((row) => <tr key={row.date}><th scope="row">{formatDate(row.date)}</th><td>{row.cards}</td><td>{row.minutes} min</td></tr>)}</tbody></table></div></div>
    </>}
    {data && <div className="card analytics-total"><div className="stat-label">Tempo total nos últimos 7 dias</div><div className="stat-value">{minutes(data.totalTimeMs)} min</div><div className="stat-label">Métricas calculadas a partir das revisões reais.</div></div>}
  </AppShell>;
}
