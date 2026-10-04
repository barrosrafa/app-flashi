'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useTranslation, type TranslationKey } from '../contexts/LanguageContext';
import { SyncStatusPanel } from './SyncStatusPanel';

type IconName = 'home' | 'layers' | 'play' | 'calendar' | 'chart' | 'tool' | 'upload' | 'spark' | 'trophy' | 'user' | 'search' | 'more';
type NavItem = { href: string; label: TranslationKey; icon: IconName };
const primary: NavItem[] = [
  { href: '/dashboard', label: 'nav.overview', icon: 'home' },
  { href: '/study', label: 'nav.study', icon: 'play' },
  { href: '/decks', label: 'nav.decks', icon: 'layers' },
];
const groups: Array<{ title: TranslationKey; items: NavItem[] }> = [
  { title: 'nav.groupTrack', items: [
    { href: '/analytics', label: 'nav.analytics', icon: 'chart' },
    { href: '/exams', label: 'nav.exams', icon: 'calendar' },
  ] },
  { title: 'nav.groupCreate', items: [
    { href: '/decks/new', label: 'nav.newDeck', icon: 'layers' },
    { href: '/search', label: 'nav.search', icon: 'search' },
    { href: '/import/deck', label: 'nav.imports', icon: 'upload' },
    { href: '/tools', label: 'nav.tools', icon: 'tool' },
  ] },
  { title: 'nav.groupAdvanced', items: [
    { href: '/templates', label: 'nav.templates', icon: 'layers' },
    { href: '/import/ai-ingest', label: 'nav.aiIngest', icon: 'spark' },
    { href: '/import/anki', label: 'nav.anki', icon: 'upload' },
    { href: '/occlusion', label: 'nav.occlusion', icon: 'spark' },
    { href: '/socratic', label: 'nav.socratic', icon: 'play' },
    { href: '/leaderboard', label: 'nav.leaderboard', icon: 'trophy' },
    { href: '/tools/mcp', label: 'nav.mcp', icon: 'tool' },
  ] },
  { title: 'nav.groupAccount', items: [{ href: '/profile', label: 'nav.profile', icon: 'user' }, { href: '/profile/learning-plan', label: 'nav.learningGoal', icon: 'calendar' }] },
];
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
    search: <><circle cx="10.8" cy="10.8" r="6.3" /><path d="m16 16 4 4" /></>,
    more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
  };
  return <svg aria-hidden="true" className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}
function isActive(pathname: string, href: string) {
  if (href === '/profile') return pathname === href;
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}
function NavLink({ item, pathname, onNavigate }: { item: NavItem; pathname: string; onNavigate?: () => void }) {
  const { t } = useTranslation();
  const active = isActive(pathname, item.href);
  return <Link className={active ? 'active' : ''} href={item.href} onClick={onNavigate} aria-current={active ? 'page' : undefined}><Icon name={item.icon} /><span>{t(item.label)}</span></Link>;
}
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const [openMenuPath, setOpenMenuPath] = useState<string | null>(null);
  const moreOpen = openMenuPath === pathname;
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const previousPath = useRef(pathname);
  const primaryMobile: NavItem[] = [...primary, { href: '/search', label: 'nav.search', icon: 'search' }];
  const isPrimaryRoute = primaryMobile.some(({ href }) => isActive(pathname, href));
  useEffect(() => {
    const routeChanged = previousPath.current !== pathname;
    previousPath.current = pathname;
    if (routeChanged) window.requestAnimationFrame(() => document.getElementById('main-content')?.focus());
  }, [pathname]);
  useEffect(() => {
    if (!moreOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpenMenuPath(null);
      window.requestAnimationFrame(() => moreButtonRef.current?.focus());
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [moreOpen]);
  return <div className="app">
    <a className="skip-link" href="#main-content">Pular para o conteúdo principal</a>
    <aside className="sidebar" aria-label="Flashi">
      <Link className="brand" href="/dashboard" aria-label="Flashi, ir para Hoje">flash<span>i</span></Link>
      <nav className="desktop-nav" aria-label="Áreas do Flashi">
        <section className="nav-group"><h2>{t('nav.groupPrimary')}</h2>{primary.map((item) => <NavLink key={item.href} item={item} pathname={pathname} />)}</section>
        {groups.map((group) => <section className="nav-group" key={group.title}><h2>{t(group.title)}</h2>{group.items.map((item) => <NavLink key={item.href} item={item} pathname={pathname} />)}</section>)}
      </nav>
      <div className="sidebar-bottom" aria-label={t('nav.localMode')}><SyncStatusPanel /></div>
    </aside>
    <main className="main" id="main-content" tabIndex={-1}>{children}</main>
    <nav className="mobile-nav" aria-label="Navegação principal">
      {primaryMobile.map((item) => <NavLink key={item.href} item={item} pathname={pathname} />)}
      <button ref={moreButtonRef} type="button" className={!isPrimaryRoute ? 'active' : ''} aria-label={t('nav.moreOptions')} aria-expanded={moreOpen} aria-controls={moreOpen ? 'mobile-more-menu' : undefined} onClick={() => setOpenMenuPath((openPath) => openPath === pathname ? null : pathname)}><Icon name="more" /><span>{t('nav.more')}</span></button>
    </nav>
    {moreOpen && <nav className="mobile-more-menu" id="mobile-more-menu" aria-label={t('nav.moreOptions')}>
      <button className="mobile-more-close" type="button" onClick={() => { setOpenMenuPath(null); window.requestAnimationFrame(() => moreButtonRef.current?.focus()); }}>{t('nav.closeMenu')}</button>
      {groups.map((group) => <section className="nav-group" key={group.title}><h2>{t(group.title)}</h2>{group.items.filter((item) => item.href !== '/search').map((item) => <NavLink key={item.href} item={item} pathname={pathname} onNavigate={() => setOpenMenuPath(null)} />)}</section>)}
      <div className="mobile-sync-status"><SyncStatusPanel /></div>
    </nav>}
  </div>;
}
export function Topbar({ title, subtitle }: { title: string; subtitle?: string }) {
  const { t } = useTranslation();
  return <header className="topbar"><div><div className="eyebrow">{t('topbar.eyebrow')}</div><h1 className="title">{title}</h1>{subtitle && <p className="subtitle">{subtitle}</p>}</div><Link className="avatar" href="/profile" aria-label={t('topbar.profileAria')}><Icon name="user" /></Link></header>;
}
