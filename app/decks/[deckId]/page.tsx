import { CollaboratorManager } from '../../../components/decks/CollaboratorManager';
import { DeckSettingsForm } from '../../../components/decks/DeckSettingsForm';
import { isFeatureEnabled } from '../../../lib/feature-flags';
import Link from 'next/link';
import { AppShell, Topbar } from '../../../components/AppShell';
import CardBrowser from '../../../components/CardBrowser';

export default async function DeckDetail({ params }: { params: Promise<{ deckId: string }> }) {
  const { deckId } = await params;
  const name = deckId === 'idiomas' ? 'Inglês para concursos' : deckId === 'medicina' ? 'Fisiologia humana' : 'Sistema nervoso';

  return <AppShell>
    <Topbar title={name} subtitle="Uma visão rápida do deck e acesso direto à próxima revisão." />
    <div className="grid stats deck-summary" aria-label="Resumo do deck">
      <article className="card"><div className="stat-label">Cartões</div><div className="stat-value">128</div></article>
      <article className="card"><div className="stat-label">Para revisar</div><div className="stat-value accent">12</div></article>
      <article className="card"><div className="stat-label">Domínio</div><div className="stat-value">72%</div></article>
    </div>
    <section aria-labelledby="recent-cards-heading">
      <div className="section-head"><div><h2 id="recent-cards-heading">Visão geral dos cards</h2><p className="subtitle">Escolha entre revisar agora ou gerenciar o conteúdo.</p></div><div className="section-head-actions"><Link className="btn secondary" href={`/decks/${deckId}/cards`}>Gerenciar cards</Link><Link className="btn" href={`/study/${deckId}`}>Estudar agora <span aria-hidden="true">→</span></Link></div></div>
      <div className="card sample-card"><div className="sample-label">Amostra recente</div><p className="subtitle">Os exemplos abaixo ajudam a localizar o deck. O conteúdo completo está em “Gerenciar cards”.</p><div className="table-wrap"><table className="table"><thead><tr><th scope="col">Frente</th><th scope="col">Tipo</th><th scope="col">Estado</th></tr></thead><tbody>{[['What is spaced repetition?', 'Basic', 'Revisão'], ['Although / Even though', 'Cloze', 'Aprendendo'], ['Present perfect', 'Reverse', 'Novo']].map((row) => <tr key={row[0]}><td>{row[0]}</td><td><span className="pill">{row[1]}</span></td><td>{row[2]}</td></tr>)}</tbody></table></div></div>
    </section>
    <CardBrowser deckId={deckId} />
  <DeckSettingsForm deckId={deckId} />{isFeatureEnabled('collab') && <CollaboratorManager deckId={deckId} />}</AppShell>;
}
