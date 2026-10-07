import { createClient } from '../supabase/client';
import type { CollaborationInvite, CollaborationInviteInput, DeckCollaborator, DeckRole } from '../types/collaborator';
export const collaboratorService = {
  async list(deckId: string): Promise<DeckCollaborator[]> {
    const { data, error } = await createClient().from('deck_collaborators').select('deck_id,user_id,role,created_at').eq('deck_id', deckId);
    if (error) throw error;
    return (data ?? []) as DeckCollaborator[];
  },
  async createInvite(deckId: string, input: CollaborationInviteInput): Promise<CollaborationInvite> {
    const email = input.email.trim().toLowerCase();
    if (!email) throw new Error('COLLABORATION_INVITE_EMAIL_REQUIRED');
    const { data, error } = await createClient().rpc('create_deck_collaboration_invite', {
      p_deck_id: deckId,
      p_email: email,
      p_display_name: input.displayName?.trim() || undefined,
      p_context: input.context?.trim() || undefined,
      p_role: input.role,
    });
    if (error) throw new Error('COLLABORATION_INVITE_NOT_AVAILABLE');
    const invite = data?.[0];
    if (!invite) throw new Error('COLLABORATION_INVITE_NOT_AVAILABLE');
    return invite as CollaborationInvite;
  },
  async acceptInvite(token: string): Promise<{ deck_id: string; role: DeckRole }> {
    if (!token.trim()) throw new Error('COLLABORATION_INVITE_INVALID_OR_EXPIRED');
    const { data, error } = await createClient().rpc('accept_deck_collaboration_invite', { p_invite_token: token.trim() });
    if (error) throw new Error('COLLABORATION_INVITE_INVALID_OR_EXPIRED');
    const accepted = data?.[0];
    if (!accepted) throw new Error('COLLABORATION_INVITE_INVALID_OR_EXPIRED');
    return accepted;
  },
  async updateRole(deckId: string, userId: string, role: DeckRole) { const { error } = await createClient().from('deck_collaborators').update({ role }).eq('deck_id', deckId).eq('user_id', userId); if (error) throw error; },
  async remove(deckId: string, userId: string) { const { error } = await createClient().from('deck_collaborators').delete().eq('deck_id', deckId).eq('user_id', userId); if (error) throw error; },
};
