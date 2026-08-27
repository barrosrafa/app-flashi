'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
const items=[['/','Visão geral','⌂'],['/decks','Meus decks','▣'],['/study/demo','Estudar agora','▷'],['/exams','Exames','◷'],['/analytics','Desempenho','↗'],['/profile','Perfil','○']];
export function AppShell({children}:{children:React.ReactNode}){const path=usePathname();return <div className="app"><aside className="sidebar"><div className="brand">flash<span>i</span></div><nav className="nav">{items.map(([href,label,icon])=><Link className={path===href||path.startsWith(href+'/')?'active':''} href={href} key={href}><span>{icon}</span>{label}</Link>)}</nav><div className="sidebar-bottom">Modo local-first<br/><strong>Sincronização protegida</strong></div></aside><main className="main">{children}</main></div>}
export function Topbar({title,subtitle}:{title:string;subtitle?:string}){return <header className="topbar"><div><div className="eyebrow">Seu espaço de aprendizagem</div><h1 className="title">{title}</h1>{subtitle&&<p className="subtitle">{subtitle}</p>}</div><div className="avatar">R</div></header>}
export function SyncBadge(){return <span className="pill">● Online · salvo localmente</span>}
