export interface Tag { id: string; user_id: string; name: string; color?: string | null; created_at: string; usn?: number; }
export interface CardTag { card_id: string; tag_id: string; usn?: number; }
