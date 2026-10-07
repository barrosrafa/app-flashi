import 'fake-indexeddb/auto';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ userId:'user-a', edge:vi.fn(), rpc:vi.fn() }));
vi.mock('../lib/supabase/client',()=>({ createClient:()=>({auth:{getUser:async()=>({data:{user:{id:state.userId}},error:null})},rpc:state.rpc}) }));
vi.mock('../lib/services/http/edge-client',()=>({invokeEdge:state.edge}));
vi.mock('../lib/observability/posthog',()=>({track:vi.fn()}));
vi.mock('../lib/observability/sentry',()=>({captureException:vi.fn()}));
import { db } from '../lib/db/schema';
import { bindLocalUserNamespace, unbindLocalUserNamespace } from '../lib/db/local-user-scope';
import { enqueueMutation,flushOutboxQueue as actualFlush,retryOutboxItem,retryDelayMs } from '../lib/db/outbox-queue';
import { deriveNoteCardFields } from '../lib/services/note-card-fields';
import { mergeNoteFields } from '../lib/services/note-fields';
import { pageResult } from '../lib/services/pagination';
import { rangeDateBounds } from '../lib/services/analytics-service';
import { safeProperties,scrubSentryEvent } from '../lib/observability/privacy';

beforeEach(async()=>{
  const storage=new Map<string,string>();
  vi.stubGlobal('window',{localStorage:{getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>storage.set(key,value),removeItem:(key:string)=>storage.delete(key)}});
  vi.stubGlobal('navigator',{onLine:false}); state.userId='user-a'; state.edge.mockReset(); state.rpc.mockReset();
  state.edge.mockImplementation(async (_name:string,options:any)=>({review_id:'server-review',client_review_id:options.body.client_review_id,state:'review',due_at:'2026-10-09T12:00:00Z',interval_days:3}));
  state.rpc.mockResolvedValue({data:[{review_count:1,xp_awarded:5}],error:null});
  await db.open(); await bindLocalUserNamespace(state.userId); await db.outbox.clear();
});
afterEach(async()=>{await db.outbox.clear(); await unbindLocalUserNamespace(); vi.unstubAllGlobals();});
function flushOutboxQueue(){ vi.stubGlobal('navigator',{onLine:true});return actualFlush(); }
async function queueReview(id:string,session='session-1') {
  await db.reviews.put({id,user_id:state.userId,card_id:'card-1',rating:'good',reviewed_at:new Date().toISOString(),time_spent_ms:0,client_review_id:id,session_id:session,usn:0});
  return enqueueMutation('review_logs','rpc',{card_id:'card-1',rating:'good',client_review_id:id,session_id:session},{rpc_name:'fsrs-review',transport:'edge',client_mutation_id:id});
}
describe('F02/F36/F37/F38 real IndexedDB outbox',()=>{
  it('F02 records server confirmation before removing a review; singleflight prevents duplicate transport',async()=>{
    await queueReview('review-one'); const a=flushOutboxQueue(); const b=flushOutboxQueue(); expect(a).toBe(b); await a;
    expect(state.edge).toHaveBeenCalledTimes(1); expect(await db.outbox.count()).toBe(0);
    expect((await db.reviews.get('review-one'))?.server_confirmed).toBe(true);
    expect((await db.reviews.get('review-one'))?.server_interval_days).toBe(3);
  });
  it('F02 empty HTTP success is not review confirmation',async()=>{
    await queueReview('review-one'); state.edge.mockResolvedValue({}); await flushOutboxQueue();
    expect(await db.outbox.count()).toBe(1); expect((await db.reviews.get('review-one'))?.server_confirmed).not.toBe(true);
  });
  it('F36 transient failure does not block the next unrelated mutation',async()=>{
    await queueReview('one'); await queueReview('two','session-2'); state.edge.mockRejectedValueOnce(Object.assign(new Error('TEMPORARY_FAILURE'),{status:503}));
    const result=await flushOutboxQueue(); expect(result).toMatchObject({failed:1,flushed:1}); expect(await db.outbox.count()).toBe(1); expect((await db.outbox.toArray())[0].next_attempt_at).toBeTruthy();
    expect(retryDelayMs(3,30)).toBe(30000);
  });
  it('F02/F39 XP remains deferred while a review is backed off',async()=>{
    const id=await queueReview('one'); await db.outbox.update(id,{next_attempt_at:new Date(Date.now()+60000).toISOString()});
    await enqueueMutation('gamification_xp_sessions','rpc',{p_session_id:'session-1',p_expected_review_count:1},{rpc_name:'sync_session_xp_confirmed',transport:'rpc',client_mutation_id:'xp-one'});
    await flushOutboxQueue(); expect(state.rpc).not.toHaveBeenCalled(); expect(await db.outbox.count()).toBe(2);
    await db.outbox.update(id,{next_attempt_at:undefined}); await flushOutboxQueue(); expect(state.rpc).toHaveBeenCalledTimes(1); expect(await db.outbox.count()).toBe(0);
  });
  it('F37 account B cannot flush or retry account A mutations',async()=>{
    const id=await queueReview('one'); state.userId='user-b'; await bindLocalUserNamespace('user-b'); await flushOutboxQueue();
    expect(state.edge).not.toHaveBeenCalled(); expect(await db.outbox.count()).toBe(1); await expect(retryOutboxItem(id)).rejects.toThrow('OUTBOX_OWNER_MISMATCH');
  });
  it('F37 concurrent namespace binding clears replicated cache once and retains owner-partitioned outbox',async()=>{
    await queueReview('one'); await db.notes.put({id:'private-a',user_id:'user-a',fields:{Front:'private'}} as any);
    await Promise.all([bindLocalUserNamespace('user-b'),bindLocalUserNamespace('user-b')]); expect(await db.notes.count()).toBe(0); expect(await db.outbox.count()).toBe(1);
  });
});
it('F04 regenerates each template ordinal and preserves the reverse orientation',()=>{
 const template={field_definitions:[],card_generation:[{front:'{{Question}}',back:'{{Answer}}'},{front:'{{Answer}}',back:'{{Question}}'}]};
 expect(deriveNoteCardFields({Question:'Q',Answer:'A'},{Question:'Q2',Answer:'A2'},{fields:{},card_ordinal:1},template)).toMatchObject({Front:'A2',Back:'Q2'});
 expect(deriveNoteCardFields({Front:'Q',Back:'A'},{Front:'Q2',Back:'A2'},{fields:{Front:'A',Back:'Q'}})).toMatchObject({Front:'A2',Back:'Q2'});
});
it('F06 edited JSON preserves numbers, booleans, arrays, objects and null; invalid type is rejected',()=>{
 expect(mergeNoteFields({n:2,b:false,a:[1],o:{x:1},v:null,s:''},{n:'3',b:'true',a:'[2]',o:'{"x":2}',v:'null',s:''})).toEqual({n:3,b:true,a:[2],o:{x:2},v:null,s:''});
 expect(()=>mergeNoteFields({n:2},{n:'"three"'})).toThrow('preservar o tipo');
});
it('F35 cursor exposes item 101 and preserves tie-breaking ID',()=>{
 const rows=Array.from({length:101},(_,i)=>({id:String(101-i).padStart(3,'0'),created_at:'2026-10-07T00:00:00Z'})); const page=pageResult(rows,100,'created_at'); expect(page.items).toHaveLength(100); expect(page.hasMore).toBe(true); expect(page.nextCursor).toEqual({time:rows[99].created_at,id:rows[99].id});
});
it('F40 period bounds are explicit UTC inclusive/exclusive and exclude future days',()=>{
 expect(rangeDateBounds(7,new Date('2026-10-07T01:30:00+09:00'))).toEqual({startDate:'2026-09-30',endDate:'2026-10-06',since:'2026-09-30T00:00:00.000Z',until:'2026-10-07T00:00:00.000Z'});
});
it('F47 strips secrets from query/header/message/breadcrumb/nested extras while preserving safe correlation',()=>{
 const clean:any=scrubSentryEvent({request:{url:'https://app.test/decks/123?token=SECRET',headers:{authorization:'SECRET'},data:'private'},user:{id:'safe-id',email:'private'},message:'SECRET',extra:{request_id:'correlation',nested:{password:'SECRET'},content:'private'},exception:{values:[{type:'Error',value:'SECRET'}]},breadcrumbs:[{message:'SECRET',data:{cookie:'SECRET',request_id:'correlation'}}]});
 expect(JSON.stringify(clean)).not.toContain('SECRET'); expect(JSON.stringify(clean)).not.toContain('private'); expect(clean.extra.request_id).toBe('correlation'); expect(safeProperties({content:'private',status:503})).toEqual({status:503});
});
