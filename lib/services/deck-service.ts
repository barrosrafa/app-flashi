import { createClient, type Tables } from '../supabase/client';
import type { Database, Json } from '../../src/types/database';
import { db } from '../db/schema';

export type Deck = Pick<Tables<'decks'>, 'id' | 'user_id' | 'name' | 'description' | 'visibility' | 'parent_deck_id' | 'deleted_at' | 'is_archived'> & {
  cardCount: number;
  newCount: number;
  reviewCount: number;
  progress: number;
};
export type DeckInsert = Database['public']['Tables']['decks']['Insert'];
export type DeckVisibility = Database['public']['Enums']['deck_visibility'];

function jsonRecord(value: Json): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
async function requireUser() {
  const { data: { user } } = await createClient().auth.getUser();
  if (!user) throw new Error('AUTH_REQUIRED');
  return user;
}
function validateName(name: string) {
  const value = name.trim();
  if (value.length < 1 || value.length > 120) throw new Error('DECK_NAME_INVALID');
  return value;
}

export async function listDecks(): Promise<Deck[]> {
  const user = await requireUser();
  const supabase = createClient();
  const [{ data: deckRows, error: deckError }, { data: cardRows, error: cardError }, { data: learningRows, error: learningError }] = await Promise.all([
    supabase.from('decks').select('id,user_id,name,description,visibility,parent_deck_id,created_at,updated_at,deleted_at,icon,is_archived,study_config,usn').eq('user_id', user.id).is('deleted_at', null).eq('is_archived', false).order('name').limit(500),
    supabase.from('cards').select('id,deck_id,is_archived,fields,card_kind,note_id,created_at,updated_at,user_id,card_ordinal,cloze_ordinal,deleted_at,note_group_id,template_id,usn').eq('user_id', user.id).eq('is_archived', false).is('deleted_at', null).limit(10000),
    supabase.from('card_learning_state').select('card_id,state,user_id').eq('user_id', user.id).limit(10000),
  ]);
  if (deckError) throw deckError;
  if (cardError) throw cardError;
  if (learningError) throw learningError;
  const cardsByDeck = new Map<string, number>();
  for (const card of cardRows ?? []) cardsByDeck.set(card.deck_id, (cardsByDeck.get(card.deck_id) ?? 0) + 1);
  const learningByCard = new Map((learningRows ?? []).map((learning) => [learning.card_id, learning]));
  const cardsByDeckIds = new Map<string, string[]>();
  for (const card of cardRows ?? []) cardsByDeckIds.set(card.deck_id, [...(cardsByDeckIds.get(card.deck_id) ?? []), card.id]);
  const result = (deckRows ?? []).map((row) => {
    const ids = cardsByDeckIds.get(row.id) ?? [];
    const states = ids.map((cardId) => learningByCard.get(cardId));
    const newCount = states.filter((state) => !state || state.state === 'new').length;
    const reviewCount = states.filter((state) => state?.state === 'review' || state?.state === 'relearning').length;
    const cardCount = cardsByDeck.get(row.id) ?? 0;
    return { ...row, cardCount, newCount, reviewCount, progress: cardCount ? Math.round((reviewCount / cardCount) * 100) : 0 } satisfies Deck;
  });
  await db.decks.bulkPut(result.map((deck) => ({ id: deck.id, user_id: deck.user_id, name: deck.name, description: deck.description ?? undefined, parent_deck_id: deck.parent_deck_id, visibility: deck.visibility, usn: 0 })));
  return result;
}

export async function createDeck(name: string, description: string, visibility: DeckVisibility = 'private', parentDeckId: string | null = null) {
  const user = await requireUser();
  const payload = { user_id: user.id, name: validateName(name), description: description.trim() || null, visibility, parent_deck_id: parentDeckId } satisfies DeckInsert;
  const { data, error } = await createClient().from('decks').insert(payload).select('id,user_id,name,description,visibility,parent_deck_id,deleted_at,is_archived').single();
  if (error) throw error;
  return { ...data, cardCount: 0, newCount: 0, reviewCount: 0, progress: 0 } satisfies Deck;
}

export async function updateDeck(deckId: string, patch: Partial<DeckInsert>) {
  if (patch.name !== undefined) patch.name = validateName(patch.name);
  const { data, error } = await createClient().from('decks').update(patch).eq('id', deckId).select('id,user_id,name,description,visibility,parent_deck_id,deleted_at,is_archived').single();
  if (error) throw error;
  return data;
}
export async function softDeleteDeck(deckId: string) {
  const { error } = await (createClient() as any).rpc('soft_delete_deck', { p_deck_id: deckId });
  if (error) throw error;
}
export async function restoreDeck(deckId: string) {
  const { error } = await createClient().from('decks').update({ deleted_at: null, is_archived: false }).eq('id', deckId);
  if (error) throw error;
}
export async function archiveDeck(deckId: string) {
  const { error } = await createClient().from('decks').update({ is_archived: true }).eq('id', deckId);
  if (error) throw error;
}

export async function listArchivedDecks(): Promise<Deck[]> {
  const user = await requireUser();
  const { data, error } = await createClient().from('decks').select('id,user_id,name,description,visibility,parent_deck_id,deleted_at,is_archived').eq('user_id', user.id).or('is_archived.eq.true,deleted_at.not.is.null').order('name').limit(500);
  if (error) throw error;
  return (data ?? []).map((row) => ({ ...row, cardCount: 0, newCount: 0, reviewCount: 0, progress: 0 }));
}
