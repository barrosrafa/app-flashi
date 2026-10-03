'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTranslation, type TranslationKey } from '../contexts/LanguageContext';
import { SyncStatusPanel } from './SyncStatusPanel';
const items = [
  { href: '/', label: 'nav.overview', icon: 'home' },
  { href: '/decks', label: 'nav.decks', icon: 'layers' },
  { href: '/study/demo', label: 'nav.study', icon: 'play' },
  { href: '/exams', label: 'nav.exams', icon: 'calendar' },
  { href: '/analytics', label: 'nav.analytics', icon: 'chart' },
  { href: '/tools', label: 'nav.tools', icon: 'tool' },
  { href: '/search', label: 'nav.search', icon: 'tool' },
  { href: '/import/deck', label: 'nav.imports', icon: 'upload' },
  { href: '/import/anki', label: 'nav.anki', icon: 'upload' },
  { href: '/import/ai-ingest', label: 'nav.aiIngest', icon: 'spark' },
  { href: '/occlusion', label: 'nav.occlusion', icon: 'spark' },
  { href: '/leaderboard', label: 'nav.leaderboard', icon: 'trophy' },
  { href: '/templates', label: 'nav.templates', icon: 'layers' },
  { href: '/socratic', label: 'nav.socratic', icon: 'play' },
  { href: '/profile', label: 'nav.profile', icon: 'user' },
] as const;
type IconName = (typeof items)[number]['icon'];
function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    home: <><path d="m4 10 8-6 8 6" /><path d="M6 9v9h12V9" /><path d="M10 18v-5h4v5" /></>,
    layers: <><path d="m12 4 8 4-8 4-8-4 8-4Z" /><path d="m4 12 8 4 8-4" /><path d="m4 16 8 4 8-4" /></>,
    play: <><circle cx="12" cy="12" r="8" /><path d="m10 8 5 4-5 4V8Z" /></>,
    calendar: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 9h16" /></>,
    chart: <><path d="M5 19V9M12 19V5M19 19v-7" /><path d="M3 19h18" /></>,
    tool: <><path d="m14.7 6.3 3 3" /><path d="M5 19 15.5 8.5a3.5 3.5 0 0 0-5-5L5 9l3 3-3 3v4Z" /></>,
    upload: <><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M5 20h14" /></>,
    spark: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" /><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z" /></>,
    trophy: <><path d="M8 4h8v4a4 4 0 0 1-8 0V4Z" /><path d="M8 6H4v2a4 4 0 0 0 4 4M16 6h4v2a4 4 0 0 1-4 4M12 12v5M8 20h8M9 17h6" /></>,
    user: <><circle cx="12" cy="8" r="3" /><path d="M5 20a7 7 0 0 1 14 0" /></>,
  };
  return <svg aria-hidden="true" className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname(); const { t } = useTranslation(); const [path, setPath] = useState('');
  useEffect(() => setPath(pathname), [pathname]);
  return <div className="app"><a className="skip-link" href="#main-content">Pular para o conteúdo principal</a><aside className="sidebar" aria-label={t('nav.overview')}><Link className="brand" href="/" aria-label="Flashi, ir para a visão geral">flash<span>i</span></Link><nav className="nav" aria-label="Áreas do Flashi">{items.map(({ href, label, icon }) => { const active = href === '/' ? path === href : path === href || path.startsWith(`${href}/`); return <Link className={active ? 'active' : ''} href={href} key={href} aria-current={active ? 'page' : undefined}><Icon name={icon} /><span>{t(label as TranslationKey)}</span></Link>; })}</nav><div className="sidebar-bottom" aria-label={t('nav.localMode')}><SyncStatusPanel /></div></aside><main className="main" id="main-content" tabIndex={-1}>{children}</main></div>;
}
export function Topbar({ title, subtitle }: { title: string; subtitle?: string }) { const { t } = useTranslation(); return <header className="topbar"><div><div className="eyebrow">{t('topbar.eyebrow')}</div><h1 className="title">{title}</h1>{subtitle && <p className="subtitle">{subtitle}</p>}</div><Link className="avatar" href="/profile" aria-label={t('topbar.profileAria')}>R</Link></header>; }
export function SyncBadge() { return <span className="pill sync-badge" role="status"><span aria-hidden="true">●</span> Online · salvo localmente</span>; }
