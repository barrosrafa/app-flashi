import { createClient, type Tables } from '../supabase/client';
import type { DeckCollaborator, DeckRole } from '../types/collaborator';
export const collaboratorService = {
  async list(deckId: string): Promise<DeckCollaborator[]> {
    const { data, error } = await createClient().from('deck_collaborators').select('deck_id,user_id,role,created_at').eq('deck_id', deckId);
    if (error) throw error;
    return (data ?? []) as DeckCollaborator[];
  },
  async add(deckId: string, userId: string, role: DeckRole): Promise<void> {
    if (!userId.trim()) throw new Error('COLLABORATOR_USER_REQUIRED');
    const { error } = await createClient().from('deck_collaborators').upsert({ deck_id: deckId, user_id: userId.trim(), role });
    if (error) throw error;
  },
  async updateRole(deckId: string, userId: string, role: DeckRole) { const { error } = await createClient().from('deck_collaborators').update({ role }).eq('deck_id', deckId).eq('user_id', userId); if (error) throw error; },
  async remove(deckId: string, userId: string) { const { error } = await createClient().from('deck_collaborators').delete().eq('deck_id', deckId).eq('user_id', userId); if (error) throw error; },
};
