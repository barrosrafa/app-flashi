'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  { href: '/', label: 'Visão geral', icon: 'home' },
  { href: '/decks', label: 'Meus decks', icon: 'layers' },
  { href: '/study/demo', label: 'Estudar agora', icon: 'play' },
  { href: '/exams', label: 'Exames', icon: 'calendar' },
  { href: '/analytics', label: 'Desempenho', icon: 'chart' },
  { href: '/tools', label: 'Ferramentas', icon: 'tool' },
  { href: '/templates', label: 'Templates', icon: 'layers' },
  { href: '/socratic', label: 'Socrático', icon: 'play' },
  { href: '/profile', label: 'Perfil', icon: 'user' },
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
    user: <><circle cx="12" cy="8" r="3" /><path d="M5 20a7 7 0 0 1 14 0" /></>,
  };

  return <svg aria-hidden="true" className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();

  return (
    <div className="app">
      <a className="skip-link" href="#main-content">Pular para o conteúdo principal</a>
      <aside className="sidebar" aria-label="Navegação principal">
        <Link className="brand" href="/" aria-label="Flashi, ir para a visão geral">
          flash<span>i</span>
        </Link>
        <nav className="nav" aria-label="Áreas do Flashi">
          {items.map(({ href, label, icon }) => {
            const active = href === '/' ? path === href : path === href || path.startsWith(`${href}/`);
            return (
              <Link className={active ? 'active' : ''} href={href} key={href} aria-current={active ? 'page' : undefined}>
                <Icon name={icon} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-bottom" aria-label="Estado do modo local">
          <span className="status-dot" aria-hidden="true" /> Modo local-first
          <strong>Sincronização protegida</strong>
        </div>
      </aside>
      <main className="main" id="main-content" tabIndex={-1}>{children}</main>
    </div>
  );
}

export function Topbar({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="topbar">
      <div>
        <div className="eyebrow">Seu espaço de aprendizagem</div>
        <h1 className="title">{title}</h1>
        {subtitle && <p className="subtitle">{subtitle}</p>}
      </div>
      <Link className="avatar" href="/profile" aria-label="Abrir seu perfil">R</Link>
    </header>
  );
}

export function SyncBadge() {
  return <span className="pill sync-badge" role="status"><span aria-hidden="true">●</span> Online · salvo localmente</span>;
}
