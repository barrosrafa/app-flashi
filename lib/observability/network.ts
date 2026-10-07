import { capture,normalizeErrorCode } from './events';
import { captureException } from './sentry';
import { track } from './posthog';
type SupabaseCategory='auth'|'data'|'rpc'|'storage'|'realtime'|'edge';
function classify(url:URL):{category:SupabaseCategory;operation:string}|null {
 const path=url.pathname;
 if(path.startsWith('/functions/v1/'))return {category:'edge',operation:path.replace('/functions/v1/','').split('/')[0]||'unknown'};
 let host='';try{host=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL??'').host;}catch{return null;}
 if(url.host!==host)return null;
 for(const [prefix,category] of [['/auth/v1/','auth'],['/rest/v1/rpc/','rpc'],['/rest/v1/','data'],['/storage/v1/','storage']] as const)if(path.startsWith(prefix))return {category,operation:path.replace(prefix,'').split('/')[0]||'unknown'};
 if(path.startsWith('/realtime/'))return {category:'realtime',operation:'websocket'};
 return null;
}
const rpcEvents:Record<string,string[]>={
 mcp_create_note:['note_created','card_created'],update_note_and_cards_v2:['note_updated'],
 create_image_occlusion_note:['occlusion_created'],stage_image_occlusion_asset:['image_uploaded'],
 create_deck_collaboration_invite:['collaboration_invite_created'],accept_deck_collaboration_invite:['collaboration_invite_accepted'],
 publish_ai_ingestion_draft:['ai_job_completed'],control_worker_job:['job_recovery_requested'],
 update_deck_exam:['goal_updated'],set_card_tags:['tag_added'],soft_delete_deck:['deck_deleted'],restore_deck:['deck_restored'],
};
const entityNames:Record<string,string>={decks:'deck',notes:'note',cards:'card',tags:'tag',deck_exams:'goal',card_media:'media',profiles:'profile'};
export function createObservedFetch(baseFetch:typeof fetch):typeof fetch {
 return async(input:RequestInfo|URL,init?:RequestInit)=>{
  if(typeof window==='undefined')return baseFetch(input,init);
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,window.location.origin);
  const target=classify(url);if(!target||target.category==='edge')return baseFetch(input,init);
  const started=performance.now();const method=(init?.method??(typeof input!=='string'&&!(input instanceof URL)?input.method:'GET')).toUpperCase();
  const requestId=crypto.randomUUID();
  const properties={category:target.category,operation:target.operation,method,request_id:requestId};
  try {
   const response=await baseFetch(input,init);const duration=Math.round(performance.now()-started);
   capture('supabase_request_completed',{...properties,status:response.status,outcome:response.ok?'success':'error',duration_ms:duration});
   if(!response.ok){captureException(new Error('SUPABASE_HTTP_ERROR'),{tags:{area:'supabase-http',operation:target.operation,category:target.category},extra:{status:response.status,request_id:requestId,duration_ms:duration}});}
   else if(!['GET','HEAD','OPTIONS'].includes(method)) {
    let events:string[]=[];
    if(target.category==='rpc')events=rpcEvents[target.operation]??[];
    if(target.category==='auth'&&target.operation==='token')events=['login_completed'];
    if(target.category==='auth'&&target.operation==='logout')events=['logout_completed'];
    if(target.category==='data'&&entityNames[target.operation])events=[`${entityNames[target.operation]}_${method==='POST'?'created':method==='DELETE'?'deleted':'updated'}`];
    if(target.category==='storage'&&url.pathname.includes('/object/')&&!url.pathname.includes('/sign/'))events=[method==='DELETE'?'media_deleted':'media_uploaded'];
    if(target.category==='data'&&target.operation==='card_tags')events=['tag_added'];
    for(const event of events)track(event,{...properties,feature:event.split('_')[0],status:response.status,duration_ms:duration});
   }
   return response;
  } catch(error) {
   const typed=error instanceof Error?error:new Error('NETWORK_ERROR');
   capture('supabase_request_completed',{...properties,status:0,outcome:'network_error',duration_ms:Math.round(performance.now()-started),error_code:normalizeErrorCode(typed)});
   captureException(typed,{tags:{area:'supabase-network',operation:target.operation,category:target.category},extra:{method,request_id:requestId,duration_ms:Math.round(performance.now()-started)}});throw error;
  }
 };
}
