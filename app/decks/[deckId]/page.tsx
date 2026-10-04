import { DeckDetailClient } from '../../../components/decks/DeckDetailClient';
import { privatePageMetadata } from '../../../lib/private-page-metadata';

export const metadata = privatePageMetadata('Deck');

export default async function DeckDetail({ params }: { params: Promise<{ deckId: string }> }) {
  const { deckId } = await params;
  return <DeckDetailClient deckId={deckId} />;
}
