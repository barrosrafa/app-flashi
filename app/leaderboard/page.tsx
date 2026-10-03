'use client';
import { useEffect, useState } from 'react';
import { AppShell, Topbar } from '../../components/AppShell';
import { gamificationService, type LeaderboardEntry } from '../../lib/services/gamification-service';
export default function LeaderboardPage() {
  const [rows, setRows] = useState<LeaderboardEntry[]>([]); const [message, setMessage] = useState('Carregando ranking…');
  useEffect(() => { void (async () => { try { await gamificationService.refreshLeaderboard(); } catch { /* instalações antigas podem não ter o refresh exposto */ } const items = await gamificationService.leaderboard(); setRows(items); setMessage(items.length ? '' : 'Ainda não há perfis com XP para exibir.'); })().catch((error: unknown) => setMessage(error instanceof Error && error.message === 'AUTH_REQUIRED' ? 'Entre na sua conta para ver o ranking.' : 'O ranking está indisponível no momento.')); }, []);
  return <AppShell><Topbar title="Ranking" subtitle="Uma projeção rápida de XP e nível, atualizada pelo backend sem recalcular a cada abertura." />{message && <div className="notice" role="status">{message}</div>}<section className="card table-wrap"><table className="table"><thead><tr><th>Posição</th><th>Estudante</th><th>Nível</th><th>XP</th><th>Atualizado</th></tr></thead><tbody>{rows.map((row) => <tr key={row.user_id}><td><strong>#{row.rank}</strong></td><td>{row.display_name || 'Estudante Flashi'}</td><td>{row.level_current}</td><td>{row.xp_total.toLocaleString('pt-BR')}</td><td>{new Date(row.updated_at).toLocaleDateString('pt-BR')}</td></tr>)}</tbody></table></section></AppShell>;
}
