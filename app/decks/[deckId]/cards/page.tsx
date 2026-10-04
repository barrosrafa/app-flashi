import Link from 'next/link';
import { AppShell, Topbar } from '../../../../components/AppShell';
import CardBrowser from '../../../../components/CardBrowser';
import { privatePageMetadata } from '../../../../lib/private-page-metadata';

export const metadata = privatePageMetadata('Cards do deck');

export default async function CardsPage({ params }: { params: Promise<{ deckId: string }> }) {
  const { deckId } = await params;
  return (
    <AppShell>
      <Topbar title="Gerenciar cards" subtitle="Crie, pesquise e arquive cartões deste deck." />
      <Link href={`/decks/${deckId}`} className="back-link">← Voltar ao deck</Link>
      <CardBrowser deckId={deckId} />
    </AppShell>
  );
}
