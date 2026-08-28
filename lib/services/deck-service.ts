import { createClient, type Tables } from '../supabase/client';
import type { Database, Json } from '../../src/types/database';
import { db } from '../db/schema';

export type Deck = Pick<
  Tables<'decks'>,
  'id' | 'user_id' | 'name' | 'description' | 'visibility' | 'parent_deck_id'
> & {
  cardCount: number;
  newCount: number;
  reviewCount: number;
  progress: number;
};

export type DeckInsert = Database['public']['Tables']['decks']['Insert'];

function jsonRecord(value: Json): Record<string, unknown> {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

async function requireUser() {
  const {
    data: { user },
  } = await createClient().auth.getUser();
  if (!user) throw new Error('AUTH_REQUIRED');
  return user;
}

export async function listDecks(): Promise<Deck[]> {
  const user = await requireUser();
  const supabase = createClient();

  const [
    { data: deckRows, error: deckError },
    { data: cardRows, error: cardError },
    { data: learningRows, error: learningError },
  ] = await Promise.all([
    supabase
      .from('decks')
      .select(
        'id,user_id,name,description,visibility,parent_deck_id,created_at,updated_at,deleted_at,icon,is_archived,study_config,usn',
      )
      .eq('is_archived', false)
      .order('name')
      .limit(50),
    supabase
      .from('cards')
      .select(
        'id,deck_id,is_archived,fields,card_kind,note_id,created_at,updated_at,user_id,card_ordinal,cloze_ordinal,deleted_at,note_group_id,template_id,usn',
      )
      .eq('is_archived', false)
      .limit(5000),
    supabase
      .from('card_learning_state')
      .select(
        'card_id,state,due_at,user_id,algorithm,algorithm_state,created_at,difficulty,ease_factor,fsrs_last_scheduled_at,fsrs_retrievability,fsrs_state,fsrs_step,fsrs_version,id,interval_days,is_suspended,last_reviewed_at,lapses,reps,stability,updated_at,usn',
      )
      .limit(5000),
  ]);

  if (deckError) throw deckError;
  if (cardError) throw cardError;
  if (learningError) throw learningError;

  const cardsByDeck = new Map<string, number>();
  for (const card of cardRows ?? []) {
    cardsByDeck.set(card.deck_id, (cardsByDeck.get(card.deck_id) ?? 0) + 1);
  }

  const learningByCard = new Map(
    (learningRows ?? []).map((learning) => [learning.card_id, learning]),
  );
  const missingLearningState = (cardRows ?? [])
    .filter((card) => !learningByCard.has(card.id))
    .map((card) => ({ user_id: user.id, card_id: card.id }));
  if (missingLearningState.length) {
    const { error: learningInsertError } = await supabase
      .from('card_learning_state')
      .upsert(missingLearningState, { onConflict: 'user_id,card_id', ignoreDuplicates: true });
    if (learningInsertError) throw learningInsertError;
  }

  const cardIdsByDeck = new Map<string, string[]>();
  for (const card of cardRows ?? []) {
    const cardIds = cardIdsByDeck.get(card.deck_id) ?? [];
    cardIds.push(card.id);
    cardIdsByDeck.set(card.deck_id, cardIds);
  }

  const result = (deckRows ?? []).map((row) => {
    const cardIds = cardIdsByDeck.get(row.id) ?? [];
    const states = cardIds.map((cardId) => learningByCard.get(cardId));
    const newCount = states.filter((state) => !state || state.state === 'new').length;
    const reviewCount = states.filter(
      (state) => state?.state === 'review' || state?.state === 'relearning',
    ).length;
    const cardCount = cardsByDeck.get(row.id) ?? 0;
    const progress = cardCount === 0 ? 0 : Math.round((reviewCount / cardCount) * 100);

    return {
      id: row.id,
      user_id: row.user_id,
      name: row.name,
      description: row.description,
      visibility: row.visibility,
      parent_deck_id: row.parent_deck_id,
      cardCount,
      newCount,
      reviewCount,
      progress,
    } satisfies Deck;
  });

  await db.decks.bulkPut(
    result.map((deck) => ({
      id: deck.id,
      user_id: deck.user_id,
      name: deck.name,
      description: deck.description ?? undefined,
      parent_deck_id: deck.parent_deck_id,
      visibility: deck.visibility,
      usn: deckRows?.find((row) => row.id === deck.id)?.usn ?? 0,
    })),
  );

  await db.cards.bulkPut(
    (cardRows ?? []).map((card) => ({
      id: card.id,
      deck_id: card.deck_id,
      note_id: card.note_id,
      fields: jsonRecord(card.fields),
      card_type: card.card_kind,
      is_suspended: learningByCard.get(card.id)?.is_suspended ?? false,
      deleted_at: card.deleted_at,
      usn: card.usn,
    })),
  );

  return result.filter((deck) => deck.user_id === user.id);
}

export async function createDeck(name: string, description: string) {
  const user = await requireUser();
  const payload = {
    user_id: user.id,
    name: name.trim(),
    description: description.trim() || null,
    visibility: 'private',
  } satisfies DeckInsert;

  const { data, error } = await createClient()
    .from('decks')
    .insert(payload)
    .select('id,user_id,name,description,visibility,parent_deck_id')
    .single();

  if (error) throw error;
  return {
    ...data,
    cardCount: 0,
    newCount: 0,
    reviewCount: 0,
    progress: 0,
  } satisfies Deck;
}
