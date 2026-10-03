import { createClient, type Tables } from '../supabase/client';
import type { Database, Json } from '../../src/types/database';
import { refreshNoteEmbedding } from './embedding-service';
import { tagService } from './tag-service';

export type Flashcard = Pick<
  Tables<'cards'>,
  'id' | 'note_id' | 'deck_id' | 'fields' | 'card_kind' | 'is_archived' | 'created_at'
>;

export type CardFields = {
  front: string;
  back: string;
  tags: string[];
};

function cardFields(input: { front: string; back: string; tags?: string[] }): CardFields {
  return {
    front: input.front.trim(),
    back: input.back.trim(),
    tags: input.tags ?? [],
  };
}

export async function listCards(deckId: string): Promise<Flashcard[]> {
  const { data, error } = await createClient()
    .from('cards')
    .select('id,note_id,deck_id,fields,card_kind,is_archived,created_at')
    .eq('deck_id', deckId)
    .eq('is_archived', false)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw error;
  return data ?? [];
}

export async function createCard(input: {
  deckId: string;
  front: string;
  back: string;
  tags?: string[];
}): Promise<Flashcard> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('AUTH_REQUIRED');

  const fields = cardFields(input);
  if (!fields.front || !fields.back) throw new Error('CARD_FIELDS_REQUIRED');

  const rpcArgs = {
    p_deck_id: input.deckId,
    p_fields: fields satisfies Json,
    p_card_definitions: [{
      card_kind: 'basic',
      front: fields.front,
      back: fields.back,
    }] satisfies Json,
    p_source: 'api',
    p_request_id: crypto.randomUUID(),
  } satisfies Database['public']['Functions']['mcp_create_note']['Args'];

  const { data: created, error: createError } = await supabase.rpc('mcp_create_note', rpcArgs);
  if (createError) throw createError;
  const result = created?.[0];
  const cardId = result?.card_ids?.[0];
  if (!result || !cardId) throw new Error('CARD_CREATE_EMPTY_RESULT');

  const { data: card, error: cardError } = await supabase
    .from('cards')
    .select('id,note_id,deck_id,fields,card_kind,is_archived,created_at')
    .eq('id', cardId)
    .single();
  if (cardError) throw cardError;

  for (const tagName of [...new Set(fields.tags.map((tag) => tag.trim()).filter(Boolean))]) {
    const tag = await tagService.create(tagName);
    await tagService.addToCard(cardId, tag.id);
  }

  void refreshNoteEmbedding(result.note_id).catch(() => undefined);
  return card;
}

export async function updateCard(
  cardId: string,
  noteId: string,
  input: { front: string; back: string; tags?: string[] },
) {
  const fields = cardFields(input);
  if (!fields.front || !fields.back) throw new Error('CARD_FIELDS_REQUIRED');
  const supabase = createClient();

  const { error: noteError } = await supabase
    .from('notes')
    .update({ fields })
    .eq('id', noteId);
  if (noteError) throw noteError;

  const { data, error } = await supabase
    .from('cards')
    .update({ fields })
    .eq('id', cardId)
    .select('id,note_id,deck_id,fields,card_kind,is_archived,created_at')
    .single();
  if (error) throw error;

  void refreshNoteEmbedding(noteId).catch(() => undefined);
  return data;
}

export async function archiveCard(cardId: string) {
  const { error } = await createClient()
    .from('cards')
    .update({ is_archived: true })
    .eq('id', cardId);
  if (error) throw error;
}
