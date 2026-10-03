'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { AppShell, Topbar } from '../../components/AppShell';
import { createClient } from '../../lib/supabase/client';
import { getProfileData, updateProfilePreferences, type ProfileData } from '../../lib/services/profile-service';
import { ThemeSwitcher } from '../../components/ThemeSwitcher';

export default function Profile() {
  const [data, setData] = useState<ProfileData | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [newCardsPerDay, setNewCardsPerDay] = useState(20);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProfileData()
      .then((profileData) => {
        setData(profileData);
        setDisplayName(profileData.profile?.display_name ?? profileData.email.split('@')[0]);
        setNewCardsPerDay(profileData.settings?.new_cards_per_day ?? 20);
      })
      .catch((reason: unknown) => {
        setMessage(reason instanceof Error && reason.message === 'AUTH_REQUIRED'
          ? 'Entre na sua conta para editar o perfil.'
          : 'Não foi possível carregar o perfil.');
      })
      .finally(() => setLoading(false));
  }, []);

  async function savePreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage('Salvando suas preferências…');
    try {
      await updateProfilePreferences({ displayName: displayName.trim(), newCardsPerDay });
      setMessage('Preferências sincronizadas com o Supabase.');
    } catch (reason: unknown) {
      setMessage(reason instanceof Error && reason.message === 'AUTH_REQUIRED'
        ? 'Entre na sua conta para salvar preferências.'
        : 'Não foi possível salvar as preferências.');
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    setSaving(true);
    const { error } = await createClient().auth.signOut();
    setMessage(error ? error.message : 'Sessão encerrada com segurança.');
    setSaving(false);
  }

  const initials = (displayName || data?.email || 'F').slice(0, 1).toUpperCase();

  return <AppShell>
    <Topbar title="Seu perfil" subtitle="Preferências, conta e sincronização." />
    {message && <div className={`notice ${message.includes('Não foi') || message.includes('Entre') ? 'error' : ''}`} role="status" aria-live="polite">{message}</div>}
    {loading ? <div className="card" role="status">Carregando suas preferências…</div> : <>
      <section className="card" aria-labelledby="profile-heading">
      <div className="profile-summary"><div className="avatar profile-avatar" aria-hidden="true">{initials}</div><div><h2 id="profile-heading">Preferências da conta</h2><p className="subtitle">{data?.email ?? 'Conta Supabase · local-first'}</p></div></div>
      <form className="form" onSubmit={savePreferences}>
        <div className="field"><label htmlFor="display-name">Nome de exibição</label><input id="display-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" /></div>
        <div className="field"><label htmlFor="new-cards">Meta diária de cartões novos</label><input id="new-cards" type="number" min="0" max="999" value={newCardsPerDay} onChange={(event) => setNewCardsPerDay(Number(event.target.value))} inputMode="numeric" /><span className="status-text">Uma meta menor ajuda a manter a sessão sustentável.</span></div>
        <div className="section-head-actions"><button className="btn" type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar preferências'}</button><button className="btn ghost" type="button" onClick={() => void signOut()} disabled={saving}>Sair da conta</button></div>
      </form>
      </section>
      <section className="card appearance-card" aria-labelledby="appearance-heading">
        <div className="section-head compact-head"><div><h2 id="appearance-heading">Aparência</h2><p className="subtitle">Escolha como o Flashi deve aparecer. A preferência é salva automaticamente.</p></div></div>
        <ThemeSwitcher />
      </section>
    </>}
  </AppShell>;
}
