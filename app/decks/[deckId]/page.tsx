import { DeckDetailClient } from '../../../components/decks/DeckDetailClient';

export default async function DeckDetail({ params }: { params: Promise<{ deckId: string }> }) {
  const { deckId } = await params;
  return <DeckDetailClient deckId={deckId} />;
}
