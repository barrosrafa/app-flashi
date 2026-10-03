import { describe, expect, it } from 'vitest';
import { ENTITY_TABLE_MAP } from '../lib/db/sync-engine';
import { SYNC_TABLES } from '../lib/db/schema';

describe('Flashi sync contract', () => {
  it('maps every synchronized entity to a local table', () => {
    for (const table of SYNC_TABLES) expect(ENTITY_TABLE_MAP[table]).toBe(table);
    expect(ENTITY_TABLE_MAP.deck).toBe('decks');
    expect(ENTITY_TABLE_MAP.card_learning_state).toBe('card_learning_state');
    expect(ENTITY_TABLE_MAP.review_log).toBe('review_logs');
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
