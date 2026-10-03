import { createClient } from '../supabase/client';
import type { Json } from '../../src/types/database';
import type { DeckSettings } from '../types/deck-settings';
export const deckSettingsService = {
  async get(deckId: string): Promise<DeckSettings | null> { const { data, error } = await createClient().from('user_deck_settings').select('*').eq('deck_id', deckId).maybeSingle(); if (error) throw error; return data as DeckSettings | null; },
  async upsert(deckId: string, overrides: DeckSettings['overrides'], extra: Pick<DeckSettings, 'is_favorite' | 'display_order'> = {}) { const { data: { user } } = await createClient().auth.getUser(); if (!user) throw new Error('AUTH_REQUIRED'); const { error } = await createClient().from('user_deck_settings').upsert({ user_id: user.id, deck_id: deckId, overrides: overrides as unknown as Json, ...extra }, { onConflict: 'user_id,deck_id' }); if (error) throw error; },
};
