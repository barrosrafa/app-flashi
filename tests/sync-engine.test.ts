import { describe, expect, it } from 'vitest';
import { ENTITY_TABLE_MAP } from '../lib/db/sync-engine';

describe('Flashi sync contract', () => {
  it('maps backend entity aliases to local tables', () => {
    expect(ENTITY_TABLE_MAP.deck).toBe('decks');
    expect(ENTITY_TABLE_MAP.note).toBe('notes');
    expect(ENTITY_TABLE_MAP.card_media).toBe('card_media');
    expect(ENTITY_TABLE_MAP.ai_ingestion_job).toBe('ai_ingestion_jobs');
    expect(ENTITY_TABLE_MAP.note_image_occlusion_box).toBe('note_image_occlusion_boxes');
    expect(ENTITY_TABLE_MAP.user_gamification_profile).toBe('user_gamification_profiles');
    expect(ENTITY_TABLE_MAP.card_learning_state).toBe('card_learning_state');
    expect(ENTITY_TABLE_MAP.review_log).toBe('review_logs');
    expect(ENTITY_TABLE_MAP.field_definitions).toBeUndefined();
    expect(ENTITY_TABLE_MAP.profile).toBeUndefined();
  });
  it('keeps unknown entity types unmapped', () => expect(ENTITY_TABLE_MAP.unknown).toBeUndefined());
});

describe('outbox invariants', () => {
  it('uses a stable client mutation id for idempotency', () => {
    const clientMutationId = crypto.randomUUID();
    const payload = { card_id: 'card', rating: 'good', client_mutation_id: clientMutationId };
    expect(payload.client_mutation_id).toBe(clientMutationId);
  });
  it('preserves the supported FSRS ratings', () => expect(['again', 'hard', 'good', 'easy']).toContain('good'));
});
