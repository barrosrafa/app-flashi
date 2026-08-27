import Dexie, { type Table } from 'dexie';
export type Rating='again'|'hard'|'good'|'easy';
export interface LocalDeck{id:string;user_id?:string;name:string;description?:string;parent_deck_id?:string|null;visibility?:string;deleted_at?:string|null;usn:number;new_count?:number;review_count?:number;}
export interface LocalCard{id:string;deck_id:string;note_id?:string;fields:Record<string,unknown>;card_type?:string;is_suspended?:boolean;deleted_at?:string|null;usn:number;}
export interface LocalLearning{card_id:string;user_id?:string;state:string;due_at:string;interval_days:number;stability:number;difficulty:number;lapses:number;usn:number;}
export interface LocalReview{id:string;card_id:string;rating:Rating;reviewed_at:string;time_spent_ms:number;client_review_id:string;usn:number;}
export interface OfflineMutation{id:string;table_name:string;action:'insert'|'update'|'delete'|'rpc';rpc_name?:string;payload:Record<string,unknown>;created_at:string;retries:number;}
export interface SyncMeta{key:'last_usn';value:number}
export interface LocalExam{id:string;user_id?:string;deck_id:string;exam_name:string;target_date:string;priority_level:string;status:string;usn:number}
class FlashiDB extends Dexie{decks!:Table<LocalDeck,string>;cards!:Table<LocalCard,string>;learning!:Table<LocalLearning,string>;reviews!:Table<LocalReview,string>;exams!:Table<LocalExam,string>;outbox!:Table<OfflineMutation,string>;sync_meta!:Table<SyncMeta,string>;constructor(){super('FlashiLocalDB');this.version(1).stores({decks:'id,user_id,usn,deleted_at',cards:'id,deck_id,usn,deleted_at',learning:'card_id,due_at,usn',reviews:'id,card_id,client_review_id,usn',exams:'id,deck_id,status,usn',outbox:'id,created_at,table_name,action',sync_meta:'key'});}}
export const db=new FlashiDB();
