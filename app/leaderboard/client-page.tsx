'use client';

import { useEffect, useState } from 'react';
import { AppShell, Topbar } from '../../components/AppShell';
import { gamificationService, type LeaderboardEntry } from '../../lib/services/gamification-service';
import { hasBrowserSession } from '../../lib/supabase/guards';
import { useTranslation } from '../../contexts/LanguageContext';

export default function LeaderboardPage() {
  const { locale } = useTranslation();
  const [rows, setRows] = useState<LeaderboardEntry[]>([]);
  const [message, setMessage] = useState('Carregando ranking…');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!(await hasBrowserSession())) { setMessage('Entre na sua conta para ver o ranking.'); return; }
      try {
        try { await gamificationService.refreshLeaderboard(); } catch { /* instalações antigas podem não ter o refresh exposto */ }
        const items = await gamificationService.leaderboard();
        if (!cancelled) { setRows(items); setMessage(items.length ? '' : 'Ainda não há perfis com XP para exibir.'); }
      } catch (error: unknown) {
        if (!cancelled) setMessage(error instanceof Error && error.message === 'AUTH_REQUIRED' ? 'Entre na sua conta para ver o ranking.' : 'O ranking está indisponível no momento.');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return <AppShell><Topbar title="Ranking" subtitle="Uma projeção rápida de XP e nível, atualizada pelo backend sem recalcular a cada abertura." />{message && <div className="notice" role="status">{message}</div>}<section className="card table-wrap"><table className="table"><thead><tr><th scope="col">Posição</th><th scope="col">Estudante</th><th scope="col">Nível</th><th scope="col">XP</th><th scope="col">Atualizado</th></tr></thead><tbody>{rows.map((row) => <tr key={row.user_id}><td><strong>#{row.rank}</strong></td><td>{row.display_name || 'Estudante Flashi'}</td><td>{row.level_current}</td><td>{row.xp_total.toLocaleString(locale)}</td><td>{new Date(row.updated_at).toLocaleDateString(locale)}</td></tr>)}</tbody></table></section></AppShell>;
}
