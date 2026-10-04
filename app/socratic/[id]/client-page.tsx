'use client';

import { useEffect, useState } from 'react';
import { AppShell, Topbar } from '../../../components/AppShell';
import { isEnabled } from '../../../lib/config/feature-flags';
import { hasBrowserSession, isUuid } from '../../../lib/supabase/guards';
import { socraticService } from '../../../lib/services/socratic-service';
import { SocraticSessionView } from '../../../components/socratic/SocraticSessionView';
import type { SocraticSession } from '../../../lib/types/socratic';

export default function SocraticDetail({ params }: { params: Promise<{ id: string }> }) {
  const [session, setSession] = useState<SocraticSession | null>(null);
  const [message, setMessage] = useState('Carregando sessão…');

  useEffect(() => {
    let cancelled = false;
    void params.then(async ({ id }) => {
      if (!isUuid(id)) { setMessage('Esta sessão não possui um identificador válido.'); return; }
      if (!(await hasBrowserSession())) { setMessage('Entre na sua conta para abrir esta sessão.'); return; }
      try {
        const item = await socraticService.get(id);
        if (!cancelled) { setSession(item); setMessage(item ? '' : 'Sessão não encontrada.'); }
      } catch {
        if (!cancelled) setMessage('Não foi possível carregar esta sessão.');
      }
    });
    return () => { cancelled = true; };
  }, [params]);

  if (!isEnabled('socratic')) return <AppShell><Topbar title="Sessão socrática" /><div className="card empty-state">Esta funcionalidade está desativada.</div></AppShell>;

  return <AppShell><Topbar title="Sessão socrática" />{session ? <SocraticSessionView session={session} /> : <div className="card" role="status">{message}</div>}</AppShell>;
}
