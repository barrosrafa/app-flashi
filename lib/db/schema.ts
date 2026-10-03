import Dexie, { type Table } from 'dexie';
export type Rating = 'again' | 'hard' | 'good' | 'easy';
export type SyncableRecord = Record<string, unknown> & { id?: string; usn?: number; updated_at?: string | null };
export interface LocalDeck extends SyncableRecord { id: string; user_id?: string; name: string; description?: string | null; parent_deck_id?: string | null; visibility?: string; deleted_at?: string | null; usn: number; }
export interface LocalCard extends SyncableRecord { id: string; deck_id: string; note_id?: string; fields: Record<string, unknown>; card_type?: string; is_suspended?: boolean; deleted_at?: string | null; usn: number; }
export interface LocalLearning extends SyncableRecord { id?: string; card_id: string; user_id?: string; state: string; due_at: string; interval_days: number; stability?: number | null; difficulty?: number | null; lapses: number; usn: number; }
export interface LocalReview extends SyncableRecord { id: string; card_id: string; rating: Rating; reviewed_at: string; time_spent_ms: number; client_review_id: string; usn: number; }
export interface LocalExam extends SyncableRecord { id: string; user_id?: string; deck_id: string; exam_name: string; target_date: string; priority_level: string; status: string; usn: number; }
export interface OfflineMutation { id: string; table_name: string; action: 'insert' | 'update' | 'delete' | 'rpc'; rpc_name?: string; transport?: 'edge' | 'rpc'; payload: Record<string, unknown>; client_mutation_id: string; created_at: string; retries: number; }
export interface SyncMeta { key: 'last_usn'; value: number; }
export const SYNC_TABLES = ['decks','notes','note_card_definitions','note_cloze_deletions','note_references','note_image_occlusion_boxes','cards','card_tags','card_media','card_learning_state','card_templates','field_definitions','tags','review_logs','study_settings','user_deck_settings','daily_statistics','fsrs_optimization_runs','deck_collaborators','deck_exams','user_gamification_profiles','user_badges','badges_definition','socratic_remediation_sessions','ai_ingestion_jobs','anki_transfer_jobs'] as const;
export type SyncTableName = typeof SYNC_TABLES[number];
class FlashiDB extends Dexie {
  decks!: Table<LocalDeck, string>; cards!: Table<LocalCard, string>; learning!: Table<LocalLearning, string>; reviews!: Table<LocalReview, string>; exams!: Table<LocalExam, string>; outbox!: Table<OfflineMutation, string>; sync_meta!: Table<SyncMeta, string>;
  constructor() {
    super('FlashiLocalDB');
    this.version(1).stores({ decks:'id,user_id,usn,deleted_at', cards:'id,deck_id,usn,deleted_at', learning:'card_id,due_at,usn', reviews:'id,card_id,client_review_id,usn', exams:'id,deck_id,status,usn', outbox:'id,created_at,table_name,action', sync_meta:'key' });
    this.version(2).stores(Object.fromEntries([...SYNC_TABLES.map((table) => [table, 'id,usn,updated_at,deck_id,user_id']), ['learning','id,card_id,due_at,usn,user_id'], ['reviews','id,card_id,client_review_id,usn,user_id'], ['exams','id,deck_id,status,usn,user_id'], ['outbox','id,created_at,table_name,action,client_mutation_id'], ['sync_meta','key']]));
  }
}
export const db = new FlashiDB();
