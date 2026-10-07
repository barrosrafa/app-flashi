export type DeckRole = 'viewer' | 'editor';

export interface DeckCollaborator {
  deck_id: string;
  user_id: string;
  role: DeckRole;
  created_at: string;
}

export interface CollaborationInviteInput {
  email: string;
  displayName?: string;
  context?: string;
  role: DeckRole;
}

export interface CollaborationInvite {
  invite_id: string;
  invite_token: string;
  expires_at: string;
  delivery_status: 'pending_copy';
}
