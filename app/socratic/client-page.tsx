'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell, Topbar } from '../../components/AppShell';
import { useTranslation, type TranslationKey } from '../../contexts/LanguageContext';
import { isEnabled } from '../../lib/config/feature-flags';
import { socraticService } from '../../lib/services/socratic-service';
import type { SocraticSession, SocraticStatus } from '../../lib/types/socratic';

const statusKeys: Record<SocraticStatus, TranslationKey> = {
  queued: 'socratic.statusQueued',
  processing: 'socratic.statusProcessing',
  completed: 'socratic.statusCompleted',
  failed: 'socratic.statusFailed',
};

export default function SocraticPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState<SocraticSession[]>([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!isEnabled('socratic')) return;
    void socraticService.list().then(setItems).catch(() => setError(true));
  }, []);
  if (!isEnabled('socratic')) return <AppShell><Topbar title={t('socratic.title')} /><div className="card empty-state" role="status">{t('socratic.disabled')}</div></AppShell>;
  return <AppShell>
    <Topbar title={t('socratic.title')} subtitle={t('socratic.subtitle')} />
    <section className="card socratic-list" aria-labelledby="socratic-list-title">
      <h2 id="socratic-list-title" className="sr-only">{t('socratic.title')}</h2>
      {error && <p className="notice error" role="alert">{t('socratic.loadError')}</p>}
      {items.length > 0 && <ul>{items.map((item) => <li key={item.id} className="py-2"><Link href={`/socratic/${item.id}`}>{t('socratic.cardLabel')} {item.card_id}</Link> · {t(statusKeys[item.status])}</li>)}</ul>}
      {!items.length && !error && <div className="empty-state socratic-empty" role="status" aria-live="polite"><strong>{t('socratic.emptyTitle')}</strong><p>{t('socratic.emptyDescription')}</p><p className="status-text">{t('socratic.emptyCycle')}</p></div>}
    </section>
  </AppShell>;
}
