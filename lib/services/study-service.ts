import { createClient } from '../supabase/client';
import { db, type Rating } from '../db/schema';
import { enqueueMutation } from '../db/outbox-queue';
import type { Database } from '../../src/types/database';

export type DueCard =
  Database['public']['Functions']['get_due_cards']['Returns'][number];

export type ReviewResponse = {
  queued?: boolean;
  client_review_id: string;
};

export async function submitReview(cardId: string, rating: Rating): Promise<ReviewResponse> {
  const reviewId = crypto.randomUUID();
  const reviewedAt = new Date().toISOString();
  const review = {
    id: reviewId,
    card_id: cardId,
    rating,
    reviewed_at: reviewedAt,
    time_spent_ms: 0,
    client_review_id: reviewId,
    usn: 0,
  };

  if (typeof window !== 'undefined') {
    await db.reviews.put(review);
    await enqueueMutation('review_logs', 'rpc', {
      card_id: cardId, rating, client_review_id: reviewId, time_spent_ms: 0,
    }, { rpc_name: 'fsrs-review', transport: 'edge', client_mutation_id: reviewId });
  }
  return { queued: true, client_review_id: reviewId };
}

export async function getDueCards(deckId: string | null, limit = 40): Promise<DueCard[]> {
  const params = {
    ...(deckId ? { p_deck_id: deckId } : {}),
    p_limit: limit,
  } satisfies Database['public']['Functions']['get_due_cards']['Args'];
  const supabase = createClient();
  const { data, error } = await supabase.rpc('get_due_cards', params);
  if (error) throw error;
  if (data?.length) return data;

  // Legacy cards created before `mcp_create_note` may not have a learning-state row.
  // They are still real, owned cards; expose them as new only when the canonical RPC is empty.
  const { data: cardRows, error: cardError } = await supabase
    .from('cards')
    .select('id,deck_id,fields,is_archived')
    .eq('deck_id', deckId ?? '')
    .eq('is_archived', false)
    .limit(limit);
  if (cardError) throw cardError;
  return (cardRows ?? []).map((card) => ({
    card_id: card.id,
    deck_id: card.deck_id,
    fields: card.fields,
    state: 'new' as const,
    due_at: new Date().toISOString(),
    interval_days: 0,
  }));
}
