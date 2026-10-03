import { createClient } from '../supabase/client';
import { db, type Rating } from '../db/schema';
import { enqueueMutation } from '../db/outbox-queue';
import type { Database, Json } from '../../src/types/database';

export type BaseDueCard = Database['public']['Functions']['get_due_cards']['Returns'][number];
export type DueCard = BaseDueCard & {
  exam_id?: string | null;
  exam_name?: string | null;
  target_date?: string | null;
  days_remaining?: number | null;
  scheduling_factor?: number | null;
  card_kind?: string;
  note_id?: string | null;
};

export type ReviewResponse = {
  queued?: boolean;
  client_review_id: string;
};

export async function submitReview(cardId: string, rating: Rating, sessionId?: string): Promise<ReviewResponse> {
  const reviewId = crypto.randomUUID();
  const reviewedAt = new Date().toISOString();
  const review = {
    id: reviewId,
    card_id: cardId,
    rating,
    reviewed_at: reviewedAt,
    time_spent_ms: 0,
    client_review_id: reviewId,
    session_id: sessionId ?? null,
    usn: 0,
  };

  if (typeof window !== 'undefined') {
    await db.reviews.put(review);
    await enqueueMutation(
      'review_logs',
      'rpc',
      {
        card_id: cardId,
        rating,
        client_review_id: reviewId,
        time_spent_ms: 0,
        session_id: sessionId ?? null,
      },
      {
        rpc_name: 'fsrs-review',
        transport: 'edge',
        client_mutation_id: reviewId,
      },
    );
  }
  return { queued: true, client_review_id: reviewId };
}

export async function getDueCards(deckId: string | null, limit = 40, useExamSchedule = false): Promise<DueCard[]> {
  const supabase = createClient();
  if (useExamSchedule && deckId) {
    const { data, error } = await supabase.rpc('get_due_cards_with_exam_schedule', {
      p_deck_id: deckId,
      p_limit: limit,
    });
    if (error) throw error;
    if (data?.length) return data as DueCard[];
  }

  const params = {
    ...(deckId ? { p_deck_id: deckId } : {}),
    p_limit: limit,
  } satisfies Database['public']['Functions']['get_due_cards']['Args'];
  const { data, error } = await supabase.rpc('get_due_cards', params);
  if (error) throw error;
  if (data?.length) return data as DueCard[];

  // Legacy cards created before mcp_create_note may not have a learning-state row.
  const { data: cardRows, error: cardError } = await supabase
    .from('cards')
    .select('id,deck_id,fields,is_archived,card_kind,note_id')
    .eq('deck_id', deckId ?? '')
    .eq('is_archived', false)
    .limit(limit);
  if (cardError) throw cardError;
  return (cardRows ?? []).map((card) => ({
    card_id: card.id,
    deck_id: card.deck_id,
    fields: card.fields as Json,
    state: 'new' as const,
    due_at: new Date().toISOString(),
    interval_days: 0,
    card_kind: card.card_kind,
    note_id: card.note_id,
  }));
}

export async function checkActiveExams(deckId: string): Promise<boolean> {
  const { data, error } = await createClient()
    .from('deck_exams')
    .select('id')
    .eq('deck_id', deckId)
    .eq('status', 'active')
    .limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}
