'use client';

import { useEffect, useState } from 'react';
import { AppShell, Topbar } from '../../components/AppShell';
import { getAnalyticsData, type AnalyticsData } from '../../lib/services/analytics-service';

export default function Analytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getAnalyticsData().then(setData).catch((reason: unknown) => {
      setError(reason instanceof Error && reason.message === 'AUTH_REQUIRED'
        ? 'Entre na sua conta para ver o desempenho real.'
        : 'Não foi possível carregar as métricas.');
    });
  }, []);

  const comparison = data && data.cardsPreviousWeek > 0
    ? Math.round(((data.cardsThisWeek - data.cardsPreviousWeek) / data.cardsPreviousWeek) * 100)
    : null;
  const maxCards = Math.max(...(data?.days.map((day) => day.cards) ?? [0]), 1);

  return <AppShell>
    <Topbar title="Desempenho" subtitle="Uma visão calculada a partir das suas revisões reais." />
    {error && <div className="notice" role="status">{error}</div>}
    <div className="grid stats">
      <div className="card"><div className="stat-label">Retenção estimada</div><div className="stat-value accent">{data ? `${data.retention}%` : '—'}</div><div className="progress"><span style={{ width: `${data?.retention ?? 0}%` }} /></div></div>
      <div className="card"><div className="stat-label">Cartões esta semana</div><div className="stat-value">{data?.cardsThisWeek ?? '—'}</div><div className="stat-label">{comparison === null ? 'Sem semana anterior comparável' : `${comparison >= 0 ? '+' : ''}${comparison}% vs. semana anterior`}</div></div>
      <div className="card"><div className="stat-label">Tempo médio</div><div className="stat-value">{data ? `${data.averageTimeSeconds}s` : '—'}</div><div className="stat-label">por revisão registrada</div></div>
      <div className="card"><div className="stat-label">Precisão</div><div className="stat-value">{data ? `${data.accuracy}%` : '—'}</div><div className="stat-label">últimos 7 dias</div></div>
    </div>
    <div className="section-head"><h2>Atividade dos últimos 7 dias</h2></div>
    <div className="card" style={{ height: 240, display: 'flex', alignItems: 'end', gap: 18, padding: '26px 34px' }}>
      {(data?.days ?? []).map((day) => <div key={day.date} style={{ flex: 1, textAlign: 'center' }}><div title={`${day.cards} cartões · ${day.minutes} min`} style={{ height: `${Math.max((day.cards / maxCards) * 150, day.cards ? 8 : 2)}px`, background: day.cards === maxCards ? '#5146e5' : '#dcd9ff', borderRadius: '8px 8px 3px 3px' }} /><small className="stat-label">{day.label}</small></div>)}
      {!data && !error && <div className="stat-label">Carregando atividade…</div>}
    </div>
    {data && <div className="card" style={{ marginTop: 18 }}><div className="stat-label">Tempo total nos últimos 7 dias</div><div className="stat-value">{Math.round(data.totalTimeMs / 60000)} min</div><div className="stat-label">Métricas calculadas sem valores demonstrativos.</div></div>}
  </AppShell>;
}
