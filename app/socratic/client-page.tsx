'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell, Topbar } from '../../components/AppShell';
import { isEnabled } from '../../lib/config/feature-flags';
import { socraticService } from '../../lib/services/socratic-service';
import type { SocraticSession } from '../../lib/types/socratic';
export default function SocraticPage() { const [items, setItems] = useState<SocraticSession[]>([]); const [error, setError] = useState(''); useEffect(() => { if (isEnabled('socratic')) void socraticService.list().then(setItems).catch(() => setError('Não foi possível carregar sessões.')); }, []); if (!isEnabled('socratic')) return <AppShell><Topbar title="Sessões socráticas" /><div className="card empty-state">Esta funcionalidade está desativada.</div></AppShell>; return <AppShell><Topbar title="Sessões socráticas" subtitle="Sessões criadas pelo backend quando um card é detetado como leech." /><section className="card">{error && <p className="notice error">{error}</p>}<ul>{items.map((item) => <li key={item.id} className="py-2"><Link href={`/socratic/${item.id}`}>Card {item.card_id}</Link> · {item.status}</li>)}</ul>{!items.length && !error && <p className="muted">Nenhuma sessão pendente.</p>}</section></AppShell>; }
