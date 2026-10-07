'use client';

import { useEffect, useState } from 'react';
import { AppShell, Topbar } from '../../../components/AppShell';
import { useTranslation } from '../../../contexts/LanguageContext';
import { isEnabled } from '../../../lib/config/feature-flags';
import { hasBrowserSession, isUuid } from '../../../lib/supabase/guards';
import { socraticService } from '../../../lib/services/socratic-service';
import { SocraticSessionView } from '../../../components/socratic/SocraticSessionView';
import type { SocraticSession } from '../../../lib/types/socratic';

export default function SocraticDetail({ params }: { params: Promise<{ id: string }> }) {
  const { t } = useTranslation();
  const [session, setSession] = useState<SocraticSession | null>(null);
  const [message, setMessage] = useState(t('socratic.loading'));

  useEffect(() => {
    let cancelled = false;
    void params.then(async ({ id }) => {
      if (!isUuid(id)) { setMessage(t('socratic.invalidSession')); return; }
      if (!(await hasBrowserSession())) { setMessage(t('socratic.signIn')); return; }
      try {
        const item = await socraticService.get(id);
        if (!cancelled) { setSession(item); setMessage(item ? '' : t('socratic.notFound')); }
      } catch {
        if (!cancelled) setMessage(t('socratic.detailError'));
      }
    });
    return () => { cancelled = true; };
  }, [params, t]);

  if (!isEnabled('socratic')) return <AppShell><Topbar title={t('socratic.sessionTitle')} /><div className="card empty-state" role="status">{t('socratic.disabled')}</div></AppShell>;

  return <AppShell><Topbar title={t('socratic.sessionTitle')} />{session ? <SocraticSessionView session={session} /> : <div className="card" role="status" aria-live="polite">{message}</div>}</AppShell>;
}
