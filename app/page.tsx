import Link from 'next/link';
import type { Metadata } from 'next';
import { siteUrl } from '../lib/site-url';

const socialImage = '/opengraph.png';
const title = 'Flashi — Estude um pouco hoje. Lembre por mais tempo.';
const description = 'Organize seus flashcards por assunto, acompanhe as revisões e construa uma rotina de estudo no seu ritmo.';
export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/' },
  robots: { index: true, follow: true },
  openGraph: { title, description, type: 'website', locale: 'pt_BR', siteName: 'Flashi', url: siteUrl.toString(), images: [{ url: socialImage, width: 1200, height: 630, alt: 'Flashi — estudo que fica' }] },
  twitter: { card: 'summary_large_image', title, description, images: [socialImage] },
};

const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Flashi',
  applicationCategory: 'EducationalApplication',
  operatingSystem: 'Web',
  inLanguage: 'pt-BR',
  url: siteUrl.toString(),
  description,
};

const steps = [
  { number: '01', title: 'Organize por assunto', text: 'Crie decks para separar matérias, idiomas e objetivos de estudo.' },
  { number: '02', title: 'Crie seus cards', text: 'Registre uma pergunta de um lado e a resposta do outro.' },
  { number: '03', title: 'Revise no seu ritmo', text: 'Abra sua fila de estudo e acompanhe o que já avançou.' },
];
export default function Home() {
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} /><main className="landing-page">
    <header className="landing-header">
      <Link href="/" className="brand" aria-label="Flashi, página inicial">flash<span>i</span></Link>
      <nav aria-label="Navegação pública"><Link href="#como-funciona">Como funciona</Link><Link href="#para-quem">Para quem</Link><Link href="/login">Entrar</Link><Link className="btn landing-header-cta" href="/register">Criar conta</Link></nav>
    </header>
    <section className="landing-hero" aria-labelledby="landing-title">
      <div className="landing-copy"><p className="eyebrow">Aprendizagem ativa, um card por vez</p><h1 id="landing-title">Estude um pouco hoje.<br /><span>Lembre por mais tempo.</span></h1><p className="landing-lead">Transforme seus assuntos em flashcards, acompanhe as revisões e construa uma rotina que cabe no seu dia.</p><div className="landing-actions"><Link href="/register" className="btn">Começar a estudar <span aria-hidden="true">→</span></Link><Link href="/login" className="btn secondary">Já tenho uma conta</Link></div><p className="landing-note">Seu próximo passo: crie um deck e adicione o primeiro card.</p></div>
      <div className="landing-preview" aria-label="Exemplo de um flashcard do Flashi"><div className="preview-top"><span className="preview-dot" /><span>SESSÃO DE ESTUDO</span><span className="preview-count">01 / 12</span></div><div className="preview-card"><span className="preview-label">PERGUNTA</span><p>Qual é a ideia principal que você quer lembrar?</p><div className="preview-divider" /><span className="preview-label">RESPOSTA</span><p className="preview-answer">Uma resposta curta, escrita por você, para revisar no momento certo.</p></div><div className="preview-progress"><span style={{ width: '42%' }} /></div><p className="preview-caption">Uma pergunta por vez. Seu progresso fica claro.</p></div>
    </section>
    <section className="landing-benefits" id="para-quem" aria-label="Benefícios do Flashi"><article><span className="landing-symbol" aria-hidden="true">↻</span><h2>Revisões com intenção</h2><p>Volte aos seus cards e mantenha o estudo ativo em vez de apenas reler suas anotações.</p></article><article><span className="landing-symbol" aria-hidden="true">▤</span><h2>Assuntos organizados</h2><p>Separe matérias, idiomas e metas em decks fáceis de encontrar e continuar.</p></article><article><span className="landing-symbol" aria-hidden="true">↗</span><h2>Progresso visível</h2><p>Acompanhe suas sessões e entenda o que já estudou, sem perder de vista o próximo passo.</p></article></section>
    <section className="landing-steps" id="como-funciona" aria-labelledby="steps-title"><div className="section-head"><div><p className="eyebrow">Simples para começar</p><h2 id="steps-title">Do primeiro deck à próxima revisão</h2></div><Link href="/register" className="inline-link">Criar minha conta →</Link></div><div className="landing-step-grid">{steps.map((step) => <article className="card landing-step" key={step.number}><span className="step-number">{step.number}</span><h3>{step.title}</h3><p>{step.text}</p></article>)}</div></section>
    <section className="landing-final"><div><p className="eyebrow">Comece pelo que quer aprender</p><h2>Um bom hábito começa com um card.</h2></div><Link href="/register" className="btn">Criar meu primeiro deck <span aria-hidden="true">→</span></Link></section>
    <footer className="landing-footer"><Link className="brand" href="/" aria-label="Flashi, página inicial">flash<span>i</span></Link><span>Estudo que fica.</span><div><Link href="/login">Entrar</Link><Link href="/register">Criar conta</Link><Link href="/dashboard">Abrir o app</Link></div></footer>
  </main></>;
}
