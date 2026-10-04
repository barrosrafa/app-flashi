import Link from 'next/link';
export default function NotFound() {
  return <main className="auth"><section className="card auth-card"><p className="eyebrow">404 · página não encontrada</p><h1>Vamos voltar ao caminho.</h1><p className="subtitle">Este endereço não corresponde a uma página disponível no Flashi.</p><div className="landing-actions"><Link className="btn" href="/">Ir para o Flashi</Link><Link className="btn secondary" href="/dashboard">Abrir o app</Link></div></section></main>;
}
