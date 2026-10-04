'use client';

import { useEffect, useState } from 'react';
import { AppShell, Topbar } from '../../../components/AppShell';
import { isFeatureEnabled } from '../../../lib/feature-flags';
import { redirectToLoginForAuthError } from '../../../lib/auth/navigation';
import { getGamificationData } from '../../../lib/services/gamification-service';

export default function BadgesPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof getGamificationData>> | null>(null);
  const [message, setMessage] = useState('Carregando…');

  useEffect(() => {
    if (!isFeatureEnabled('gamification')) return;
    getGamificationData().then(setData).catch((reason: unknown) => {
      if (redirectToLoginForAuthError(reason, `${window.location.pathname}${window.location.search}`)) return;
      setMessage('Não foi possível carregar as conquistas. Verifique sua conexão e tente novamente.');
    });
  }, []);

  if (!isFeatureEnabled('gamification')) return <AppShell><Topbar title="Conquistas" /><div className="card empty-state">Esta funcionalidade está desativada.</div></AppShell>;
  const unlocked = new Set(data?.badges.map((badge) => badge.badge_id));
  return <AppShell><Topbar title="Conquistas" subtitle="Acompanhe XP, sequência e badges desbloqueadas." /><section className="card"><h2>{data?.profile?.xp_total ?? 0} XP</h2><p className="subtitle">Nível {data?.profile?.level_current ?? 1} · sequência de {data?.profile?.streak_days_count ?? 0} dias</p></section><div className="grid deck-grid">{data?.definitions.map((badge) => <article className="card" key={badge.id} aria-label={badge.display_name}><div className="eyebrow">{unlocked.has(badge.id) ? 'Desbloqueada' : `${badge.xp_requirement} XP necessários`}</div><h3>{badge.display_name}</h3><p className="subtitle">{badge.description ?? 'Continue estudando para descobrir esta conquista.'}</p></article>)}</div>{!data && <div className="notice" role="status">{message}</div>}</AppShell>;
}
