'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { AppShell, Topbar } from '../../components/AppShell';
import { createClient } from '../../lib/supabase/client';
import { getProfileData, updateProfilePreferences, type ProfileData } from '../../lib/services/profile-service';
import { ThemeSwitcher } from '../../components/ThemeSwitcher';
import { LanguageSelector } from '../../components/profile/LanguageSelector';
import { useTranslation } from '../../contexts/LanguageContext';

export default function Profile() {
  const { t } = useTranslation();
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
          ? t('profile.authLoad')
          : t('profile.loadError'));
      })
      .finally(() => setLoading(false));
  }, []);

  async function savePreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(t('common.saving'));
    try {
      await updateProfilePreferences({ displayName: displayName.trim(), newCardsPerDay });
      setMessage(t('profile.saved'));
    } catch (reason: unknown) {
      setMessage(reason instanceof Error && reason.message === 'AUTH_REQUIRED'
        ? t('profile.authSave')
        : t('profile.saveError'));
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    setSaving(true);
    const { error } = await createClient().auth.signOut();
    setMessage(error ? error.message : t('profile.signedOut'));
    setSaving(false);
  }

  const initials = (displayName || data?.email || 'F').slice(0, 1).toUpperCase();

  return <AppShell>
    <Topbar title={t('profile.title')} subtitle={t('profile.subtitle')} />
    {message && <div className={`notice ${message.includes('Não foi') || message.includes('Entre') ? 'error' : ''}`} role="status" aria-live="polite">{message}</div>}
    {loading ? <div className="card" role="status">{t('profile.loading')}</div> : <>
      <section className="card" aria-labelledby="profile-heading">
      <div className="profile-summary"><div className="avatar profile-avatar" aria-hidden="true">{initials}</div><div><h2 id="profile-heading">{t('profile.accountPreferences')}</h2><p className="subtitle">{data?.email ?? t('profile.supabaseAccount')}</p></div></div>
      <form className="form" onSubmit={savePreferences}>
        <div className="field"><label htmlFor="display-name">{t('profile.displayName')}</label><input id="display-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" /></div>
        <div className="field"><label htmlFor="new-cards">{t('profile.dailyNewCards')}</label><input id="new-cards" type="number" min="0" max="999" value={newCardsPerDay} onChange={(event) => setNewCardsPerDay(Number(event.target.value))} inputMode="numeric" /><span className="status-text">{t('profile.sustainableGoal')}</span></div>
        <LanguageSelector />
        <div className="section-head-actions"><button className="btn" type="submit" disabled={saving}>{saving ? t('common.saving') : t('profile.savePreferences')}</button><button className="btn ghost" type="button" onClick={() => void signOut()} disabled={saving}>{t('profile.signOut')}</button></div>
      </form>
      </section>
      <section className="card appearance-card" aria-labelledby="appearance-heading">
        <div className="section-head compact-head"><div><h2 id="appearance-heading">{t('profile.appearance')}</h2><p className="subtitle">{t('profile.appearanceSubtitle')}</p></div></div>
        <ThemeSwitcher />
      </section>
    </>}
  </AppShell>;
}
