export type SocraticStatus = 'queued' | 'processing' | 'completed' | 'failed';
export interface SocraticSession { id: string; user_id: string; card_id: string; status: SocraticStatus; chat_history: unknown[]; created_at: string; updated_at: string; }
