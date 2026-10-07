import { requireLocalIdentity } from '../db/offline-identity';
import { createClient } from '../supabase/client';
import { db, type Rating } from '../db/schema';
import { bindLocalUserNamespace,withLocalUserNamespace } from '../db/local-user-scope';
import { enqueueMutation, flushOutboxQueue } from '../db/outbox-queue';
import type { Database } from '../../src/types/database';

export type BaseDueCard = Database['public']['Functions']['get_due_cards']['Returns'][number];
export type DueCard = BaseDueCard & {
  exam_id?: string | null;
  exam_name?: string | null;
  target_date?: string | null;
  days_remaining?: number | null;
  scheduling_factor?: number | null;
  card_ordinal?:number;
  template_id?:string|null;
  card_kind?: string;
  note_id?: string | null;
};

export type ReviewResponse = {
  queued: boolean;
  confirmed: boolean;
  client_review_id: string;
  interval_days?: number;
  due_at?: string;
};

export async function submitReview(cardId: string, rating: Rating, sessionId?: string): Promise<ReviewResponse> {
  const user=await requireLocalIdentity();
  await bindLocalUserNamespace(user.id);
  const reviewId = crypto.randomUUID();
  const reviewedAt = new Date().toISOString();
  await withLocalUserNamespace(user.id,()=>db.reviews.put({
    id: reviewId, user_id: user.id, card_id: cardId, rating, reviewed_at: reviewedAt,
    time_spent_ms: 0, client_review_id: reviewId, session_id: sessionId ?? null,
    usn: 0, server_confirmed: false,
  }));
  await enqueueMutation(
    'review_logs', 'rpc',
    { card_id: cardId, rating, client_review_id: reviewId, time_spent_ms: 0, session_id: sessionId ?? null,client_reviewed_at:reviewedAt },
    { rpc_name: 'fsrs-review', transport: 'edge', client_mutation_id: reviewId,expected_user_id:user.id },
  );
  if (typeof navigator === 'undefined' || navigator.onLine) await flushOutboxQueue().catch(()=>undefined);
  const pending = await db.outbox.where('user_id').equals(user.id)
    .and((item) => item.client_mutation_id === reviewId).first();
  const persisted = await db.reviews.where('client_review_id').equals(reviewId).first();
  return {
    queued: Boolean(pending), confirmed: !pending && Boolean(persisted?.server_confirmed),
    client_review_id: reviewId,
    interval_days: persisted?.server_interval_days,
    due_at: persisted?.server_due_at,
  };
}

export async function getDueCards(deckId:string|null,limit=40,useExamSchedule=false):Promise<DueCard[]> {
 const offline=typeof navigator!=='undefined'&&!navigator.onLine;
 const user=await requireLocalIdentity(!offline);await bindLocalUserNamespace(user.id);
 const key=`due-queue:${deckId??'all'}:${useExamSchedule?'exams':'normal'}`;
 const mutations=await db.outbox.where('user_id').equals(user.id).toArray();
 const pendingCards=new Set(mutations.filter((item)=>item.table_name==='review_logs').map((item)=>item.payload.card_id));
 if(offline) {
  const meta=await db.sync_meta.get(key);if(!meta||meta.user_id!==user.id)return [];
  const snapshot=JSON.parse(meta.value) as {stored_at:string;rows:DueCard[]};
  const reviews=await db.reviews.where('user_id').equals(user.id).toArray();
  const rated=new Set(reviews.filter((review)=>Date.parse(review.reviewed_at)>=Date.parse(snapshot.stored_at)).map((review)=>review.card_id));
  return snapshot.rows.filter((row)=>!pendingCards.has(row.card_id)&&!rated.has(row.card_id)).slice(0,limit);
 }
 const supabase=createClient();
 const repair=await (supabase as any).rpc('initialize_unreviewed_card_states',{p_deck_id:deckId,p_limit:1000});if(repair.error)throw repair.error;
 const result=useExamSchedule&&deckId?await supabase.rpc('get_due_cards_with_exam_schedule',{p_deck_id:deckId,p_limit:limit}):await supabase.rpc('get_due_cards',{...(deckId?{p_deck_id:deckId}:{}),p_limit:limit});
 if(result.error)throw result.error;
 const rows=(await enrichDueCards((result.data??[]) as DueCard[])).filter((row)=>!pendingCards.has(row.card_id));
 const active=await requireLocalIdentity();if(active.id!==user.id)throw new Error('AUTH_ACCOUNT_CHANGED');
 await withLocalUserNamespace(user.id,()=>db.sync_meta.put({key,user_id:user.id,value:JSON.stringify({stored_at:new Date().toISOString(),rows})}));
 return rows;
}

export async function checkActiveExams(deckId: string): Promise<boolean> {
  const { data, error } = await createClient().from('deck_exams').select('id')
    .eq('deck_id', deckId).eq('status', 'active').limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

async function enrichDueCards(rows:DueCard[]):Promise<DueCard[]> {
 if(!rows.length)return rows;
 const {data,error}=await createClient().from('cards').select('id,card_ordinal,card_kind,note_id,template_id').in('id',rows.map((row)=>row.card_id)).is('deleted_at',null).limit(5000);
 if(error)throw error; const metadata=new Map((data??[]).map((card)=>[card.id,card]));
 return rows.filter((row)=>metadata.has(row.card_id)).map((row)=>({...row,...metadata.get(row.card_id)}));
}
