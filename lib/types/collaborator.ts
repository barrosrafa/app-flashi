export type DeckRole = 'viewer' | 'editor';
export interface DeckCollaborator { deck_id: string; user_id: string; role: DeckRole; created_at: string; }
