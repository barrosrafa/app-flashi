'use client';

import { useEffect, useState } from 'react';
import { AppShell, Topbar } from '../../components/AppShell';
import { createClient } from '../../lib/supabase/client';
import { getProfileData, updateProfilePreferences, type ProfileData } from '../../lib/services/profile-service';

export default function Profile() {
  const [data, setData] = useState<ProfileData | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [newCardsPerDay, setNewCardsPerDay] = useState(20);
  const [message, setMessage] = useState('');

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
      });
  }, []);

  async function savePreferences() {
    try {
      await updateProfilePreferences({ displayName, newCardsPerDay });
      setMessage('Preferências sincronizadas com o Supabase.');
    } catch (reason: unknown) {
      setMessage(reason instanceof Error && reason.message === 'AUTH_REQUIRED'
        ? 'Entre na sua conta para salvar preferências.'
        : 'Não foi possível salvar as preferências.');
    }
  }

  async function signOut() {
    const { error } = await createClient().auth.signOut();
    setMessage(error ? error.message : 'Sessão encerrada com segurança.');
  }

  const initials = (displayName || data?.email || 'F').slice(0, 1).toUpperCase();

  return <AppShell>
    <Topbar title="Seu perfil" subtitle="Preferências, conta e sincronização." />
    <div className="card">
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 26 }}><div className="avatar" style={{ width: 64, height: 64, fontSize: 22 }}>{initials}</div><div><h2 style={{ margin: '0 0 5px', fontFamily: 'Space Grotesk' }}>{displayName || 'Carregando…'}</h2><p className="subtitle">{data?.email ?? 'Conta Supabase · local-first'}</p></div></div>
      <div className="form">
        <div className="field"><label htmlFor="display-name">Nome de exibição</label><input id="display-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></div>
        <div className="field"><label htmlFor="new-cards">Meta diária de cartões novos</label><input id="new-cards" type="number" min="0" max="999" value={newCardsPerDay} onChange={(event) => setNewCardsPerDay(Number(event.target.value))} /></div>
        <button className="btn" onClick={() => void savePreferences}>Salvar preferências</button>
        <button className="btn ghost" onClick={() => void signOut}>Sair da conta</button>
        {message && <div className="notice" role="status">{message}</div>}
      </div>
    </div>
  </AppShell>;
}
