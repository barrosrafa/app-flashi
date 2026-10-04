'use client';
import { useEffect, useState } from 'react';
import { AppShell, Topbar } from '../../../components/AppShell';
import { isEnabled } from '../../../lib/config/feature-flags';
import { socraticService } from '../../../lib/services/socratic-service';
import { SocraticSessionView } from '../../../components/socratic/SocraticSessionView';
import type { SocraticSession } from '../../../lib/types/socratic';
export default function SocraticDetail({ params }: { params: Promise<{ id: string }> }) { const [session, setSession] = useState<SocraticSession | null>(null); useEffect(() => { void params.then(({ id }) => socraticService.get(id).then(setSession).catch(() => setSession(null))); }, [params]); if (!isEnabled('socratic')) return <AppShell><Topbar title="Sessão socrática" /><div className="card empty-state">Esta funcionalidade está desativada.</div></AppShell>; return <AppShell><Topbar title="Sessão socrática" />{session ? <SocraticSessionView session={session} /> : <div className="card">Sessão não encontrada ou ainda a carregar.</div>}</AppShell>; }
