'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell, Topbar } from '../../components/AppShell';
import { isEnabled } from '../../lib/config/feature-flags';
import { templateService } from '../../lib/services/template-service';
import type { CardTemplate } from '../../lib/types/card-template';
export default function TemplatesPage() { const [items, setItems] = useState<CardTemplate[]>([]); const [error, setError] = useState(''); useEffect(() => { if (isEnabled('templates')) void templateService.list().then(setItems).catch(() => setError('Não foi possível carregar templates.')); }, []); if (!isEnabled('templates')) return <AppShell><Topbar title="Templates" /><div className="card empty-state">Esta funcionalidade está desativada.</div></AppShell>; return <AppShell><Topbar title="Templates de cards" subtitle="Defina campos e regras de geração reutilizáveis." /><section className="card"><Link className="btn" href="/templates/new">Novo template</Link>{error && <p className="notice error">{error}</p>}<ul>{items.map((item) => <li key={item.id} className="py-2"><Link href={`/templates/${item.id}`}>{item.name}</Link>{item.is_system && <span className="pill">Sistema</span>}</li>)}</ul>{!items.length && !error && <p className="muted">Nenhum template disponível.</p>}</section></AppShell>; }
